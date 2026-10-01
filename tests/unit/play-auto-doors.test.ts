import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import doorTable from "../../src/play/door-parts.json";
import { importLDraw, exportLDraw } from "../../src/ldraw/io";
import { occurrences } from "../../src/core/document";
import { doorRoomSource } from "../../src/catalog/door-room";
import { template } from "../../src/catalog/templates";
import {
  deriveDoorRigs,
  doorHinge,
  isAutoDoorRig,
} from "../../src/play/auto-doors";
import { deriveDoorHinge, doorGeometry } from "../../src/play/door-derive";
import { nearbyInteraction } from "../../src/play/interaction";
import { PlaySession } from "../../src/play/session";
import { posedLDraw } from "../../src/mechanisms/posed-export";
import { validate } from "../../src/core/validate";
import { officialSources, readPack } from "../helpers/official-geometry";
import { hingeData } from "../../src/catalog/connectors";

const table = doorTable as unknown as {
  hinges: Record<string, ReturnType<typeof doorHinge>>;
  excluded: Record<string, { title: string; reason: string }>;
  aliases: Record<string, string>;
};
const derive = (project = importLDraw(doorRoomSource(), "door-room.ldr")) => ({
  project,
  derived: deriveDoorRigs(project, {
    all: occurrences(project),
    reserved: new Set(),
    maxRigs: 32,
    maxGroups: 128,
  }),
});
async function doorSession(
  source = doorRoomSource(),
  position: [number, number, number] = [0, -0.3, 220],
) {
  const project = importLDraw(source, "door-room.ldr");
  const { derived } = derive(project);
  const { geometry, sources } = await officialSources(project, derived.rigs);
  const play = await PlaySession.create(
    geometry,
    { rigIds: Object.keys(derived.rigs), position },
    sources,
    derived,
  );
  return { play, project, derived };
}

describe("official LDraw door table", () => {
  it("pins hinge axes, pivots and leaf directions derived from part geometry", () => {
    expect(Object.keys(table.hinges).length).toBeGreaterThanOrEqual(180);
    const pick = (part: string) => {
      const h = table.hinges[part]!;
      return {
        rule: h.rule,
        pivot: h.pivot,
        axis: h.axis,
        leaf: h.leaf,
        width: h.width,
      };
    };
    // Modern 1 x 4 x 6 doors: hinge pins at the origin, leaf along +X.
    expect(pick("60616a")).toEqual({
      rule: "origin-edge",
      pivot: [0, 70, 0],
      axis: [0, -1, 0],
      leaf: [1, 0, 0],
      width: 67,
    });
    expect(pick("60623")).toMatchObject({ pivot: [0, 70, 0], leaf: [1, 0, 0] });
    expect(pick("60616b").leaf).toEqual([1, 0, 0]);
    // Classic 1 x 4 x 5 doors (right, left and their glazed variants): leaf along +Z.
    for (const part of [
      "73194c01",
      "73312",
      "73313",
      "47899c01",
      "3861c",
      "3644",
    ])
      expect(pick(part)).toMatchObject({ axis: [0, -1, 0], leaf: [0, 0, 1] });
    // Leaves authored towards -X.
    expect(pick("93096").leaf).toEqual([-1, 0, 0]);
    expect(pick("87601").leaf).toEqual([-1, 0, 0]);
    // Container box doors drop down on two collinear hinge pins.
    expect(pick("4346")).toMatchObject({
      rule: "hinge-pins",
      pivot: [0, 44, -26],
      axis: [1, 0, 0],
    });
    expect(table.hinges["4346"]!.leaf[1]).toBeLessThan(-0.9);
    // Cupboard doors and patterned variants follow their base part.
    expect(pick("4533")).toMatchObject({ leaf: [0, 0, 1] });
    expect(pick("4346p01")).toEqual(pick("4346"));
    // Official "moved to" names resolve.
    expect(table.aliases["3861"]).toBe("3861c");
    expect(doorHinge("3861.dat")?.part).toBe("3861c");
    expect(doorHinge("S\\..\\60616A.DAT")?.part).toBe("60616a");
    // Sliding, lifting and revolving doors are explained, not hinged.
    expect(table.excluded["4511"].reason).toMatch(/Slides or lifts/);
    expect(table.excluded["30102"].reason).toMatch(/Slides or lifts/);
    expect(table.excluded["32a"].reason).toMatch(/No hinge convention/);
  });

  it("agrees with the verified connector pack and uses its pins for catalogue leaves", () => {
    for (const part of ["60616a", "60623"]) {
      const hinge = doorHinge(part + ".dat")!;
      expect(hinge.rule).toBe("connector-pins");
      // The geometry-derived table matches the pack's pins.
      expect(hinge.pivot).toEqual(table.hinges[part]!.pivot);
      expect(hinge.axis).toEqual(table.hinges[part]!.axis);
      expect(hinge.leaf).toEqual(table.hinges[part]!.leaf);
      expect(hinge.pins).toEqual([
        [0, 4, 0],
        [0, 136, 0],
      ]);
    }
    // Window panes are hinged leaves too: the pack's pins, the table's leaf.
    const pane = doorHinge("60608.dat")!;
    expect(pane).toMatchObject({
      rule: "connector-pins",
      pivot: [0, 30, 0],
      leaf: [0, 0, -1],
      pins: [
        [0, 0, 0],
        [0, 60, 0],
      ],
    });
    expect(table.hinges["60608"]!.pins).toEqual(pane.pins);
  });

  it("re-derives every pinned-pack door from the shipped geometry", () => {
    const inPack = Object.keys(table.hinges).filter((part) =>
      readPack(part + ".dat"),
    );
    expect(inPack.sort()).toEqual([
      "4346",
      "60607",
      "60608",
      "60616a",
      "60616b",
      "60623",
    ]);
    for (const part of inPack) {
      const title = readPack(part + ".dat")!
        .split(/\r?\n/, 1)[0]
        .slice(2)
        .trim();
      expect(
        deriveDoorHinge(
          part,
          title,
          doorGeometry(readPack, part + ".dat"),
          hingeData(part + ".dat")?.hinge,
        ),
      ).toEqual(table.hinges[part]);
    }
  });
});

describe("automatic doors in Play", () => {
  it("hinges the door room's real door to its frame without editing the project", () => {
    const { project, derived } = derive();
    expect(readFileSync("fixtures/ldraw/door-room.ldr", "utf8")).toBe(
      doorRoomSource(),
    );
    expect(template("door-room").title).toBe("Door room");
    expect(derived.skipped).toEqual([]);
    expect(derived.doors).toHaveLength(1);
    const [door] = derived.doors;
    const all = occurrences(project);
    expect(all.find((o) => o.id === door.occurrenceId)!.node.ref).toBe(
      "60616a.dat",
    );
    expect(all.find((o) => o.id === door.anchorOccurrenceId)!.node.ref).toBe(
      "60596.dat",
    );
    expect(door.pivot).toEqual([-32, -74, 5]);
    expect(isAutoDoorRig(door.rigId)).toBe(true);
    expect(project.motionRigs).toEqual({});
  });

  it("opens only the free way, lets the explorer through, and exports a static posed snapshot", async () => {
    const { play, project, derived } = await doorSession();
    const original = JSON.stringify(project);
    const report = play.snapshot();
    validate("playSnapshot", report);
    expect(report.autoDoors!.doors[0].swing).toBe("positive");
    // Closed: walking stops at the door.
    play.setInput({ moveZ: 1 });
    play.stepTicks(150);
    expect(play.snapshot().position[2]).toBeGreaterThan(10);
    play.clearInput();
    // The nearby action is "Open door", aimed at the free (+Z) side.
    const near = nearbyInteraction(
      {
        ...derived.rigs["auto-door:0"],
        joints: [{ ...derived.rigs["auto-door:0"].joints[0], limits: [0, 90] }],
      },
      play.snapshot(),
    );
    expect(near).toMatchObject({
      kind: "joint",
      label: "Open door",
      target: 90,
      available: true,
    });
    // The frame blocks the other way.
    expect(() =>
      play.setJointTarget({
        rigId: "auto-door:0",
        jointId: "door",
        target: -45,
        speed: 90,
      }),
    ).toThrow(/limits/);
    play.teleport({ position: [0, -0.3, 220] });
    play.setJointTarget({
      rigId: "auto-door:0",
      jointId: "door",
      target: 90,
      speed: 90,
    });
    play.stepTicks(70);
    expect(
      play.snapshot().mechanisms!["auto-door:0"].jointTargets.door.status,
    ).toBe("complete");
    play.setInput({ moveZ: 1 });
    play.stepTicks(240);
    expect(play.snapshot().position[2]).toBeLessThan(-100);
    const transforms = play.snapshot().mechanisms!["auto-door:0"].transforms;
    const posed = posedLDraw(project, transforms);
    expect(posed.text).toMatch(
      /^1 4 -32 -144 5 0 0 -1 0 1 0 1 0 0 60616a\.dat$/m,
    );
    expect(exportLDraw(project)).toMatch(
      /^1 4 -32 -144 5 1 0 0 0 1 0 0 0 1 60616a\.dat$/m,
    );
    expect(JSON.stringify(project)).toBe(original);
    play.dispose();
  });

  it("opens a two-way door away from the explorer and reports skipped doors", async () => {
    // A lone door hinged on a brick column, free both ways.
    const source = [
      "0 Two-way door",
      "1 15 -42 -24 5 1 0 0 0 1 0 0 0 1 3005.dat",
      "1 15 -42 -48 5 1 0 0 0 1 0 0 0 1 3005.dat",
      "1 15 -42 -72 5 1 0 0 0 1 0 0 0 1 3005.dat",
      "1 15 -42 -96 5 1 0 0 0 1 0 0 0 1 3005.dat",
      "1 4 -32 -144 5 1 0 0 0 1 0 0 0 1 60616a.dat",
      "1 4 400 -144 400 1 0 0 0 1 0 0 0 1 60623.dat",
      "1 4 -400 -144 -400 -1 0 0 0 1 0 0 0 1 60616a.dat",
      "",
    ].join("\n");
    const { play, derived } = await doorSession(source, [0, -0.3, 120]);
    const reasons = derived.skipped.map((s) => [s.part, s.reason]);
    expect(reasons).toContainEqual([
      "60623",
      expect.stringMatching(/No frame or holding part/),
    ]);
    expect(reasons).toContainEqual([
      "60616a",
      expect.stringMatching(/Mirrored/),
    ]);
    const door = play.snapshot().autoDoors!.doors[0];
    expect(door.swing).toBe("both");
    const rig = {
      ...derived.rigs[door.rigId],
      joints: [
        {
          ...derived.rigs[door.rigId].joints[0],
          limits: [-90, 90] as [number, number],
        },
      ],
    };
    // Explorer on +Z: opening swings the leaf towards -Z, away from them.
    expect(nearbyInteraction(rig, play.snapshot())).toMatchObject({
      target: -90,
    });
    play.teleport({ position: [0, -0.3, -120] });
    expect(nearbyInteraction(rig, play.snapshot())).toMatchObject({
      target: 90,
    });
    play.dispose();
  });

  it("skips doors owned by authored rigs and respects the moving-part budget", () => {
    const project = importLDraw(doorRoomSource(), "door-room.ldr");
    const all = occurrences(project);
    const door = all.find((o) => o.node.ref === "60616a.dat")!;
    const reserved = deriveDoorRigs(project, {
      all,
      reserved: new Set([door.id]),
      maxRigs: 32,
      maxGroups: 128,
    });
    expect(reserved.doors).toEqual([]);
    expect(reserved.skipped[0].reason).toMatch(/authored mechanism/);
    const full = deriveDoorRigs(project, {
      all,
      reserved: new Set(),
      maxRigs: 0,
      maxGroups: 128,
    });
    expect(full.skipped[0].reason).toMatch(/budget/);
    const hidden = deriveDoorRigs(project, {
      all,
      included: new Set(all.filter((o) => o.id !== door.id).map((o) => o.id)),
      reserved: new Set(),
      maxRigs: 32,
      maxGroups: 128,
    });
    expect(hidden.doors).toEqual([]);
  });
});
