import { describe, expect, it } from "vitest";
import { Editor } from "../../src/core/commands";
import { occurrences } from "../../src/core/document";
import { identity } from "../../src/core/math";
import { uid } from "../../src/core/types";
import { importLDraw } from "../../src/ldraw/io";
import { changedOccurrenceIds, compareProjects } from "../../src/core/compare";

const command = (e: Editor, type: string, payload: Record<string, unknown>) =>
  e.dispatch({
    schemaVersion: 1,
    commandId: uid(),
    expectedRevision: e.project.revision,
    type,
    payload,
  });
const source = `0 FILE root.ldr
1 4 0 0 0 1 0 0 0 1 0 0 0 1 3001.dat
1 1 100 0 0 1 0 0 0 1 0 0 0 1 3003.dat
1 14 200 0 0 1 0 0 0 1 0 0 0 1 3005.dat
1 15 300 0 0 1 0 0 0 1 0 0 0 1 3004.dat`;

describe("occurrence-level comparison", () => {
  it("classifies added, removed, moved, recoloured, relayered and replaced parts", () => {
    const e = new Editor(importLDraw(source));
    const before = e.project;
    const [a, b, c, d] = occurrences(before);
    command(e, "parts.transform", {
      occurrenceIds: [a.id],
      delta: [0, -24, 0],
      space: "ldraw",
    });
    command(e, "parts.recolor", { occurrenceIds: [b.id], colorCode: "2" });
    command(e, "parts.replace", { occurrenceIds: [c.id], ref: "3001.dat" });
    command(e, "parts.remove", { occurrenceIds: [d.id] });
    const roof = command(e, "layers.add", { name: "Roof" }).addedLayerIds[0];
    command(e, "layers.assign", { occurrenceIds: [b.id], layerId: roof });
    command(e, "parts.add", {
      parts: [{ ref: "3005.dat", colorCode: "4", transform: identity() }],
    });
    const report = compareProjects(before, e.project);
    expect(report.counts).toMatchObject({
      added: 1,
      removed: 1,
      moved: 1,
      recoloured: 1,
      relayered: 1,
      replaced: 1,
      unchanged: 0,
      total: 4,
    });
    const byId = Object.fromEntries(report.changes.map((c) => [c.id, c]));
    expect(byId[a.id].kinds).toEqual(["moved"]);
    expect(byId[a.id].before?.position[1]).toBe(0);
    expect(byId[a.id].after?.position[1]).toBe(-24);
    expect(byId[b.id].kinds).toEqual(["recoloured", "relayered"]);
    expect(byId[c.id]).toMatchObject({
      kinds: ["replaced"],
      before: { ref: "3005.dat" },
      after: { ref: "3001.dat" },
    });
    expect(byId[d.id].kinds).toEqual(["removed"]);
    // Removed parts no longer exist to highlight.
    expect(changedOccurrenceIds(report)).not.toContain(d.id);
    expect(changedOccurrenceIds(report)).toHaveLength(4);
    expect(report.identity).toBe("source-path");
  });

  it("reports an identical project as unchanged and bounds the change list", () => {
    const p = importLDraw(source);
    const same = compareProjects(p, structuredClone(p));
    expect(same.changes).toEqual([]);
    expect(same.counts.unchanged).toBe(4);
    const bounded = compareProjects(importLDraw("0 FILE empty.ldr"), p, {
      maxChanges: 2,
    });
    expect(bounded.counts.added).toBe(4);
    expect(bounded.changes).toHaveLength(2);
  });
});
