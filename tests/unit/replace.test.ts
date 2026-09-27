import { describe, expect, it } from "vitest";
import { Editor } from "../../src/core/commands";
import { occurrences } from "../../src/core/document";
import { mv } from "../../src/core/math";
import { uid } from "../../src/core/types";
import { importLDraw } from "../../src/ldraw/io";
import { planReplacement } from "../../src/edit/replace";

const source = `0 FILE root.ldr
1 4 0 0 0 1 0 0 0 1 0 0 0 1 3001.dat
1 1 100 0 0 1 0 0 0 1 0 0 0 1 3001.dat
1 14 0 0 200 0 -1 0 1 0 0 0 0 1 sub.ldr
3 15 0 0 0 20 0 0 0 0 20
0 FILE sub.ldr
1 16 0 0 0 1 0 0 0 1 0 0 0 1 3003.dat`;
const replace = (e: Editor, payload: Record<string, unknown>) =>
  e.dispatch({
    schemaVersion: 1,
    commandId: uid(),
    expectedRevision: e.project.revision,
    type: "parts.replace",
    payload,
  });

describe("part replacement", () => {
  it("keeps the bottom face by default, preserving colour and layer; top anchor keeps the origin", () => {
    const e = new Editor(importLDraw(source));
    const bricks = occurrences(e.project).filter(
      (o) => o.node.ref === "3001.dat",
    );
    const plan = planReplacement(bricks, "3020.dat");
    expect(plan.replaced).toBe(2);
    expect(plan.payloads).toEqual([
      {
        occurrenceIds: bricks.map((o) => o.id),
        ref: "3020.dat",
        anchorOffset: [0, 16, 0],
      },
    ]);
    expect(plan.changes).toEqual([
      { from: "Brick 2 × 4", count: 2, heightChange: -16, footprint: "same" },
    ]);
    expect(plan.mayOverlap).toBe(false);
    replace(e, { ...plan.payloads[0], includeHidden: false });
    const plates = occurrences(e.project).filter(
      (o) => o.node.ref === "3020.dat",
    );
    expect(plates.map((o) => o.colorCode)).toEqual(["4", "1"]);
    expect(plates.map((o) => o.layerId)).toEqual(bricks.map((o) => o.layerId));
    // Plate bottom (origin + 8) sits where the brick bottom (origin + 24) was.
    expect(plates.map((o) => o.transform.position[1] + 8)).toEqual([24, 24]);
    const top = planReplacement(bricks, "3020.dat", "top");
    expect(top.payloads[0]).not.toHaveProperty("anchorOffset");
  });
  it("offsets along the part's own axes inside rotated submodels and excludes non-catalogue geometry", () => {
    const e = new Editor(importLDraw(source));
    const all = occurrences(e.project);
    const nested = all.find((o) => o.node.ref === "3003.dat")!;
    const plan = planReplacement(all, "3022.dat");
    expect(plan.excluded).toBe(1); // raw triangle
    expect(plan.replaced).toBe(3);
    // Smaller and lower replacements cannot grow into neighbours; larger ones may.
    expect(plan.mayOverlap).toBe(false);
    expect(planReplacement(all, "3001.dat").mayOverlap).toBe(true);
    for (const payload of plan.payloads) replace(e, payload);
    const after = occurrences(e.project).find(
      (o) => o.path.join("/") === nested.path.join("/"),
    )!;
    const expected = nested.transform.position.map(
      (v, i) => v + mv(nested.transform.basis, [0, 16, 0])[i],
    );
    after.transform.position.forEach((v, i) =>
      expect(v).toBeCloseTo(expected[i], 6),
    );
    // The rotated parent turns local +Y into world −X.
    expect(after.transform.position[0]).toBeCloseTo(
      nested.transform.position[0] - 16,
      6,
    );
    // Shared submodels are made unique; undo restores the original source.
    e.dispatch({
      schemaVersion: 1,
      commandId: uid(),
      expectedRevision: e.project.revision,
      type: "history.undo",
      payload: {},
    });
    expect(
      occurrences(e.project).filter((o) => o.node.ref === "3022.dat").length,
    ).toBe(2);
  });
  it("rejects malformed anchor offsets", () => {
    const e = new Editor(importLDraw(source));
    const id = occurrences(e.project)[0].id;
    expect(() =>
      replace(e, {
        occurrenceIds: [id],
        ref: "3020.dat",
        anchorOffset: [0, 1],
      }),
    ).toThrow();
    expect(() =>
      replace(e, {
        occurrenceIds: [id],
        ref: "3020.dat",
        anchorOffset: [0, 1e9, 0],
      }),
    ).toThrow(/anchorOffset/);
  });
});
