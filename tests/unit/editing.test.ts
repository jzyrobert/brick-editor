import { describe, expect, it } from "vitest";
import { Editor } from "../../src/core/commands";
import { createProject, occurrences } from "../../src/core/document";
import { copyFragment } from "../../src/core/fragments";
import { importLDraw, exportLDraw } from "../../src/ldraw/io";
import { identity } from "../../src/core/math";
import { uid } from "../../src/core/types";
const source = () =>
  importLDraw(`0 FILE main.ldr
0 !LICENSE CC0-1.0
1 4 10 0 20 1 0 0 0 1 0 0 0 1 room.ldr
1 1 200 0 20 0 0 1 0 1 0 -1 0 0 room.ldr
0 FILE room.ldr
0 BFC CERTIFY CCW
1 16 0 0 0 1 0 0 0 1 0 0 0 1 custom.dat
1 16 40 0 0 1 0 0 0 1 0 0 0 1 3001.dat
0 FILE custom.dat
0 !LDRAW_ORG Unofficial_Part
0 !LICENSE CC0-1.0
0 BFC CERTIFY CCW
3 16 0 0 0 20 0 0 0 -20 0
3 14 0 -2 -1 3 -2 -1 0 -5 -1
0 NOFILE
`);
function command(
  e: Editor,
  type: string,
  payload: Record<string, unknown>,
  dryRun = false,
) {
  return e.dispatch({
    schemaVersion: 1,
    commandId: uid(),
    expectedRevision: e.project.revision,
    type,
    payload,
    dryRun,
  });
}
describe("native clipboard fragments", () => {
  it("preserves selected hierarchy, custom source/fixed colours, affine position, assets and occurrence metadata", () => {
    const p = source(),
      selected = occurrences(p)[2];
    p.groups.test = [selected.id];
    p.instructionPlans.plan = { name: "Assembly", steps: [[selected.id]] };
    p.assets["texture.bin"] = "preserved bytes";
    p.marketplace.overrides[selected.id] = {
      itemId: "original-custom",
      colorId: "1",
      acknowledged: true,
      substitution: true,
    };
    const fragment = copyFragment(p, { occurrenceIds: [selected.id] });
    expect(occurrences(fragment.project)).toHaveLength(1);
    expect(
      Object.values(fragment.project.models).some(
        (m) => m.classification === "custom",
      ),
    ).toBe(true);
    const e = new Editor(createProject());
    const result = command(e, "clipboard.paste", {
      fragment,
      delta: [30, 0, 0],
    });
    const [o] = occurrences(e.project);
    expect(o.transform.position).toEqual([230, 0, 20]);
    expect(o.transform.basis).toEqual(selected.transform.basis);
    expect(o.colorCode).toBe("1");
    expect(e.project.assets).toEqual(p.assets);
    expect(e.project.marketplace.overrides[o.id]).toEqual(
      p.marketplace.overrides[selected.id],
    );
    expect(Object.values(e.project.groups)[0]).toEqual([o.id]);
    expect(Object.values(e.project.instructionPlans)[0].steps).toEqual([
      [o.id],
    ]);
    expect(exportLDraw(e.project)).toContain("3 14 0 -2 -1 3 -2 -1 0 -5 -1");
    expect(result.copyMappings[selected.id]).toEqual([o.id]);
    command(e, "history.undo", {});
    expect(occurrences(e.project)).toHaveLength(0);
    command(e, "history.redo", {});
    expect(occurrences(e.project)[0].id).toBe(o.id);
  });
  it("copies raw primitives with context and removes orphaned INVERTNEXT safely", () => {
    const p = importLDraw(
      "0 BFC CERTIFY CCW\n0 BFC INVERTNEXT\n1 4 0 0 0 1 0 0 0 1 0 0 0 1 3001.dat\n3 14 0 0 0 20 0 0 0 -20 0\n",
    );
    const selected = occurrences(p)[1];
    const fragment = copyFragment(p, { occurrenceIds: [selected.id] });
    const e = new Editor();
    command(e, "clipboard.paste", { fragment });
    const result = exportLDraw(e.project);
    expect(result).toContain("BFC CERTIFY CCW");
    expect(result).not.toContain("INVERTNEXT");
    expect(result).toContain("3 14 0 0 0 20 0 0 0 -20 0");
  });
  it("cut is atomic on lock/revision failure and undo restores the exact source occurrence", () => {
    const e = new Editor(source()),
      id = occurrences(e.project)[0].id;
    const original = e.project;
    expect(() =>
      e.cut({ occurrenceIds: [id], expectedRevision: 99, commandId: uid() }),
    ).toThrow();
    expect(e.project).toEqual(original);
    const cut = e.cut({
      occurrenceIds: [id],
      expectedRevision: e.project.revision,
      commandId: uid(),
    });
    expect(occurrences(cut.fragment.project)).toHaveLength(1);
    expect(occurrences(e.project)).toHaveLength(3);
    command(e, "history.undo", {});
    expect(occurrences(e.project).map((o) => o.id)).toEqual(
      occurrences(original).map((o) => o.id),
    );
    command(e, "layers.update", {
      layerId: e.project.defaultLayerId,
      locked: true,
    });
    const locked = e.project;
    expect(() =>
      e.cut({
        occurrenceIds: [id],
        expectedRevision: e.project.revision,
        commandId: uid(),
      }),
    ).toThrow();
    expect(e.project).toEqual(locked);
  });
  it("refuses opaque directives, conflicting assets and locked destinations without partial writes", () => {
    const p = source();
    p.models[p.rootModelId].records.push({
      id: "opaque",
      raw: "0 !CUSTOM mechanics room.ldr",
    });
    expect(() =>
      copyFragment(p, { occurrenceIds: [occurrences(p)[0].id] }),
    ).toThrow(/directive/);
    const f = copyFragment(source(), {
      occurrenceIds: [occurrences(source())[0].id],
    });
    f.project.assets.test = "new";
    const target = createProject();
    target.assets.test = "old";
    const e = new Editor(target);
    expect(() => command(e, "clipboard.paste", { fragment: f })).toThrow(
      /conflicts/,
    );
    expect(e.project).toEqual(target);
    delete f.project.assets.test;
    command(e, "layers.update", {
      layerId: e.project.defaultLayerId,
      locked: true,
    });
    expect(() =>
      command(e, "clipboard.paste", {
        fragment: f,
        layerId: e.project.defaultLayerId,
      }),
    ).toThrow(/locked/);
  });
});
describe("linear and circular arrays", () => {
  it("previews bounded copies without mutation then commits and undoes as one operation", () => {
    const e = new Editor();
    command(e, "parts.add", {
      parts: [{ ref: "3001.dat", colorCode: "4", transform: identity() }],
    });
    const id = occurrences(e.project)[0].id,
      before = e.project;
    const payload = {
      occurrenceIds: [id],
      kind: "linear",
      count: 3,
      delta: [80, 0, 0],
      maxAdditions: 3,
    };
    const preview = command(e, "parts.array", payload, true);
    expect(preview.addedIds).toHaveLength(3);
    expect(preview.partCount).toBe(4);
    expect(e.project).toEqual(before);
    command(e, "parts.array", payload);
    expect(occurrences(e.project).map((o) => o.transform.position[0])).toEqual([
      0, 80, 160, 240,
    ]);
    command(e, "history.undo", {});
    expect(occurrences(e.project)).toHaveLength(1);
    expect(() =>
      command(e, "parts.array", { ...payload, maxAdditions: 2 }),
    ).toThrow();
    expect(occurrences(e.project)).toHaveLength(1);
  });
  it("rotates full bases and positions around a declared world axis without flattening the custom part", () => {
    const e = new Editor(source()),
      o = occurrences(e.project)[0];
    command(e, "parts.array", {
      occurrenceIds: [o.id],
      kind: "circular",
      count: 3,
      center: [10, 0, 0],
      axis: [0, 1, 0],
      angleDegrees: 90,
      maxAdditions: 3,
    });
    const all = occurrences(e.project);
    expect(all).toHaveLength(7);
    expect(all[4].transform.position[0]).toBeCloseTo(30);
    expect(all[4].transform.position[2]).toBeCloseTo(0);
    expect(all[5].transform.position[0]).toBeCloseTo(10);
    expect(all[5].transform.position[2]).toBeCloseTo(-20);
    expect(all[4].namespace).toBe("project");
    expect(() =>
      command(e, "parts.array", {
        occurrenceIds: [o.id],
        kind: "circular",
        count: 1,
        center: [0, 0, 0],
        axis: [0, 0, 0],
        angleDegrees: 90,
      }),
    ).toThrow(/axis/);
  });
});
it("retains attribution preamble and rejects dangling fragment metadata atomically", () => {
  const p = source();
  p.metadata.preamble = [
    "0 Original author: Example Maker",
    "0 Copyright retained",
  ];
  const fragment = copyFragment(p, { occurrenceIds: [occurrences(p)[0].id] }),
    e = new Editor();
  command(e, "clipboard.paste", { fragment });
  expect(exportLDraw(e.project)).toContain("0 Original author: Example Maker");
  const invalid = structuredClone(fragment);
  invalid.project.groups.bad = ["not-an-occurrence"];
  const before = e.project;
  expect(() => command(e, "clipboard.paste", { fragment: invalid })).toThrow(
    /outside the fragment/,
  );
  expect(e.project).toEqual(before);
  const injection = structuredClone(p);
  injection.metadata.preamble = ["0 FILE injected.ldr"];
  expect(() =>
    copyFragment(injection, { occurrenceIds: [occurrences(p)[0].id] }),
  ).toThrow();
});
it("cut retries return the original immutable fragment without reapplying, and reject command ID reuse", () => {
  const e = new Editor(source()),
    id = occurrences(e.project)[0].id,
    request = {
      occurrenceIds: [id],
      expectedRevision: e.project.revision,
      commandId: "idempotent-cut",
    },
    first = e.cut(request),
    revision = e.project.revision;
  const expected = structuredClone(first);
  first.fragment.project.title = "Caller mutation";
  const retry = e.cut(request);
  expect(retry).toEqual(expected);
  expect(e.project.revision).toBe(revision);
  expect(() => e.cut({ ...request, includeHidden: true })).toThrow(/reused/);
  command(e, "history.undo", {});
  const undoRevision = e.project.revision;
  expect(e.cut(request)).toEqual(expected);
  expect(e.project.revision).toBe(undoRevision);
  expect(occurrences(e.project)).toHaveLength(4);
  const fresh = source();
  e.replace(fresh);
  expect(() =>
    e.cut({ ...request, expectedRevision: e.project.revision }),
  ).not.toThrow();
});
