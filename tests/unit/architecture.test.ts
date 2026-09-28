import { describe, expect, it } from "vitest";
import { Editor } from "../../src/core/commands";
import { importLDraw, exportLDraw } from "../../src/ldraw/io";
import { occurrences } from "../../src/core/document";
import { encodeNative, decodeNative } from "../../src/persistence/native";
import { copyFragment } from "../../src/core/fragments";
import { uid, type Command, type Project } from "../../src/core/types";
import { architectureOf } from "../../src/core/architecture";
import {
  detectFloors,
  floorFocusSets,
  floorReport,
  liftAt,
  occurrenceBottoms,
  type BottomCache,
} from "../../src/edit/floors";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { main } from "../../scripts/brick-cli";

// Two storeys and a roof, as top-level submodels (4-brick storeys, 96 LDU).
const house = `0 FILE house.ldr
1 16 0 0 0 1 0 0 0 1 0 0 0 1 ground.ldr
1 16 0 -96 0 1 0 0 0 1 0 0 0 1 upper.ldr
1 16 0 -192 0 1 0 0 0 1 0 0 0 1 roof.ldr
0 FILE ground.ldr
1 4 0 0 0 1 0 0 0 1 0 0 0 1 3001.dat
1 4 0 -24 0 1 0 0 0 1 0 0 0 1 3001.dat
0 FILE upper.ldr
1 1 0 0 0 1 0 0 0 1 0 0 0 1 3001.dat
1 1 0 -24 0 1 0 0 0 1 0 0 0 1 3001.dat
0 FILE roof.ldr
1 14 0 0 0 1 0 0 0 1 0 0 0 1 3001.dat`;

const run = (editor: Editor, type: string, payload: Record<string, unknown>) =>
  editor.dispatch({
    schemaVersion: 1,
    commandId: uid(),
    expectedRevision: editor.revision,
    type,
    payload,
  } as Command);

const withFloors = () => {
  const editor = new Editor(importLDraw(house));
  run(editor, "floors.set", { floors: detectFloors(editor.project) });
  return editor;
};
const colourOf = (p: Project, id: string) =>
  occurrences(p).find((o) => o.id === id)!.colorCode;

describe("floor guides", () => {
  it("detects floors bottom-up from the exploded-view clustering", () => {
    const floors = detectFloors(importLDraw(house));
    expect(floors.map((f) => f.name)).toEqual([
      "Ground floor",
      "Floor 1",
      "Floor 2",
    ]);
    // A brick's lowest point is its bottom face: 24 LDU below its origin.
    expect(floors.map((f) => f.y)).toEqual([24, -72, -168]);
  });
  it("stores, renames, moves and removes floors as undoable document edits", () => {
    const editor = withFloors();
    const [ground, first, roof] = architectureOf(editor.project).floors;
    run(editor, "floors.set", {
      floors: [
        ground,
        { ...first, name: "Upstairs", y: first.y - 8 },
        { ...roof, name: "Roof" },
      ],
    });
    expect(architectureOf(editor.project).floors.map((f) => f.name)).toEqual([
      "Ground floor",
      "Upstairs",
      "Roof",
    ]);
    run(editor, "history.undo", {});
    expect(architectureOf(editor.project).floors[1].name).toBe("Floor 1");
    // Parts never change: floors are metadata.
    const source = exportLDraw(editor.project);
    run(editor, "floors.set", { floors: [] });
    expect(editor.project.architecture).toBeUndefined();
    expect(exportLDraw(editor.project)).toBe(source);
  });
  it("rejects invalid floors", () => {
    const editor = withFloors();
    for (const floors of [
      [{ name: "", y: 0 }],
      [{ name: "Line\nbreak", y: 0 }],
      [{ name: "x".repeat(61), y: 0 }],
      [
        { id: "a", name: "A", y: 0 },
        { id: "a", name: "B", y: -96 },
      ],
      Array.from({ length: 65 }, (_, i) => ({ name: "F" + i, y: -i * 96 })),
    ])
      expect(() => run(editor, "floors.set", { floors })).toThrow();
  });
  it("reports parts per floor", () => {
    const report = floorReport(withFloors().project);
    expect(report.floors.map((f) => f.parts)).toEqual([2, 2, 1]);
    expect(report.belowLowestFloor).toBe(0);
    expect(report.detected).toHaveLength(3);
  });
  it("offsets guides with the exploded view", () => {
    expect(liftAt(24, [24, -72], 100)).toBe(0);
    expect(liftAt(-72, [24, -72], 100)).toBe(100);
    expect(liftAt(-168, [24, -72], 100)).toBe(100);
  });
});

describe("floor focus", () => {
  it("hides floors above and ghosts floors below without touching the build", () => {
    const editor = withFloors();
    const p = editor.project;
    const [ground, first] = architectureOf(p).floors;
    const all = occurrences(p);
    const byColour = (c: string) =>
      all.filter((o) => o.colorCode === c).map((o) => o.id);
    const focus = floorFocusSets(p, { floorId: first.id, ghostBelow: true });
    expect([...focus.hidden].sort()).toEqual(byColour("14").sort()); // the roof
    expect([...focus.ghosted].sort()).toEqual(byColour("4").sort()); // ground
    const plain = floorFocusSets(p, { floorId: first.id, ghostBelow: false });
    expect(plain.ghosted.size).toBe(0);
    const groundOnly = floorFocusSets(p, {
      floorId: ground.id,
      ghostBelow: true,
    });
    expect(groundOnly.hidden.size).toBe(3);
    expect(groundOnly.ghosted.size).toBe(0);
    expect(
      floorFocusSets(p, { floorId: "missing", ghostBelow: true }).index,
    ).toBe(-1);
    // Colours and placements are unchanged.
    for (const o of all)
      expect(colourOf(editor.project, o.id)).toBe(o.colorCode);
  });
  it("saves a floor view with a camera bookmark and drops it with its floor", () => {
    const editor = withFloors();
    const [, first, roof] = architectureOf(editor.project).floors;
    const camera = {
      space: "ldraw",
      projection: "perspective",
      position: [300, -300, 300],
      target: [0, -50, 0],
      up: [0, -1, 0],
      fovDeg: 45,
      near: 1,
      far: 5000,
    };
    run(editor, "camera.bookmark", {
      name: "upper-floor/interior",
      camera,
      floorFocus: { floorId: first.id, ghostBelow: true },
    });
    expect(architectureOf(editor.project).views).toEqual({
      "upper-floor/interior": { floorId: first.id, ghostBelow: true },
    });
    // Re-saving the camera without a floorFocus keeps the view; null clears it.
    run(editor, "camera.bookmark", { name: "upper-floor/interior", camera });
    expect(
      architectureOf(editor.project).views["upper-floor/interior"],
    ).toBeDefined();
    run(editor, "camera.bookmark.focus", {
      name: "upper-floor/interior",
      floorFocus: null,
    });
    expect(architectureOf(editor.project).views).toEqual({});
    expect(() =>
      run(editor, "camera.bookmark.focus", {
        name: "missing",
        floorFocus: { floorId: first.id, ghostBelow: true },
      }),
    ).toThrow(/bookmark/);
    expect(() =>
      run(editor, "camera.bookmark.focus", {
        name: "upper-floor/interior",
        floorFocus: { floorId: "nope", ghostBelow: true },
      }),
    ).toThrow(/floor/);
    run(editor, "camera.bookmark.focus", {
      name: "upper-floor/interior",
      floorFocus: { floorId: roof.id, ghostBelow: false },
    });
    run(editor, "floors.set", {
      floors: architectureOf(editor.project).floors.filter(
        (f) => f.id !== roof.id,
      ),
    });
    expect(architectureOf(editor.project).views).toEqual({});
  });
});

describe("room labels", () => {
  it("adds labels tied to the floor they stand on, edits and removes them", () => {
    const editor = withFloors();
    const [ground, first] = architectureOf(editor.project).floors;
    run(editor, "labels.add", {
      id: "kitchen",
      text: "Kitchen",
      position: [0, -24, 0],
    });
    run(editor, "labels.add", {
      id: "bed",
      text: "Bedroom",
      position: [0, -120, 0],
    });
    run(editor, "labels.add", {
      id: "site",
      text: "Garden",
      position: [200, 0, 0],
      floorId: null,
    });
    const labels = architectureOf(editor.project).labels;
    expect(labels.map((l) => [l.id, l.floorId])).toEqual([
      ["kitchen", ground.id],
      ["bed", first.id],
      ["site", undefined],
    ]);
    run(editor, "labels.update", {
      labelId: "kitchen",
      text: " Kitchen/diner ",
    });
    run(editor, "labels.update", { labelId: "bed", floorId: null });
    expect(
      architectureOf(editor.project).labels.map((l) => [l.text, l.floorId]),
    ).toEqual([
      ["Kitchen/diner", ground.id],
      ["Bedroom", undefined],
      ["Garden", undefined],
    ]);
    // Removing a floor unties its labels instead of deleting them.
    run(editor, "floors.set", {
      floors: architectureOf(editor.project).floors.filter(
        (f) => f.id !== ground.id,
      ),
    });
    expect(architectureOf(editor.project).labels[0].floorId).toBeUndefined();
    run(editor, "labels.remove", { labelId: "site" });
    expect(architectureOf(editor.project).labels).toHaveLength(2);
    for (const [type, payload] of [
      ["labels.add", { text: "", position: [0, 0, 0] }],
      ["labels.add", { text: "<b>\n</b>", position: [0, 0, 0] }],
      ["labels.add", { id: "kitchen", text: "Again", position: [0, 0, 0] }],
      ["labels.add", { text: "Loft", position: [0, 0, 0], floorId: "none" }],
      ["labels.update", { labelId: "missing", text: "x" }],
      ["labels.remove", { labelId: "missing" }],
    ] as const)
      expect(() => run(editor, type, payload)).toThrow();
  });
});

describe("persistence", () => {
  it("round-trips through native projects but not LDraw, and stays out of fragments", async () => {
    const editor = withFloors();
    run(editor, "labels.add", {
      text: "Hall",
      position: [0, -24, 0],
    });
    const p = editor.project;
    const restored = await decodeNative(await encodeNative(p));
    expect(restored.architecture).toEqual(p.architecture);
    // LDraw/MPD export carries only the model: guides and labels are omitted.
    const mpd = exportLDraw(p);
    expect(mpd).not.toMatch(/Hall|Ground floor/);
    expect(importLDraw(mpd).architecture).toBeUndefined();
    const fragment = copyFragment(p, {
      occurrenceIds: [occurrences(p)[0].id],
    });
    expect(fragment.project.architecture).toBeUndefined();
  });
});

describe("floor analysis cache and CLI", () => {
  it("reuses unchanged part bottoms and recomputes moved ones", () => {
    const p = importLDraw(house);
    const cache: BottomCache = new Map();
    const first = occurrenceBottoms(p, undefined, cache);
    expect(occurrenceBottoms(p)).toEqual(first);
    expect(cache.size).toBe(5);
    const moved = structuredClone(p);
    moved.models["roof.ldr"].nodes[0].transform.position[1] = -24;
    const roof = occurrences(moved).find((o) => o.colorCode === "14")!;
    const again = occurrenceBottoms(moved, undefined, cache);
    expect(again.get(roof.id)).toBe(first.get(roof.id)! - 24);
    expect(again).toEqual(occurrenceBottoms(moved));
  });
  it("reports floors offline from the CLI", async () => {
    const dir = await mkdtemp(join(tmpdir(), "brick-floors-")),
      input = join(dir, "house.mpd"),
      output = join(dir, "floors.json");
    await writeFile(input, house);
    await main(["floors", "--input", input, "--output", output]);
    const report = JSON.parse(await readFile(output, "utf8"));
    expect(report.floors).toEqual([]);
    expect(report.detected.map((f: { name: string }) => f.name)).toEqual([
      "Ground floor",
      "Floor 1",
      "Floor 2",
    ]);
  });
});
