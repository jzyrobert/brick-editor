import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { importLDraw, exportLDraw, scopedLDraw } from "../../src/ldraw/io";
import { occurrences, validateDocument } from "../../src/core/document";
import { Editor } from "../../src/core/commands";

// Original synthetic source metadata/selection fixture, CC0-1.0.
const fixture = readFileSync("fixtures/ldraw/scoped-materials.mpd", "utf8");
const semantic = (p: ReturnType<typeof importLDraw>) =>
  occurrences(p).map((o) => ({
    ref: o.node.ref,
    color: o.colorCode,
    transform: o.transform,
    namespace: o.namespace,
  }));

describe("source-aware scoped interchange", () => {
  it("preserves inherited declarations, BFC context and transforms while pruning shared instances", () => {
    const p = importLDraw(fixture),
      all = occurrences(p),
      ids = [all[0].id, all[3].id];
    const source = scopedLDraw(p, ids),
      reload = importLDraw(source);
    expect(semantic(reload)).toEqual([semantic(p)[0], semantic(p)[3]]);
    expect(semantic(reload)).toEqual(
      JSON.parse(
        readFileSync("fixtures/ldraw/scoped-materials.expected.json", "utf8"),
      ),
    );
    expect(source).toContain(
      "0 !COLOUR LocalRed CODE 1000 VALUE #CC2233 EDGE #111111",
    );
    expect(source).toContain("0 BFC INVERTNEXT\n1 1000 100 20 30 -1");
    expect(source).toContain("0 BFC NOCLIP");
    expect(source).toContain("0 BFC CLIP CW");
    expect(source).not.toContain("unused.ldr");
    expect(source).not.toContain("!TEXMAP");
    expect(
      Object.values(reload.models).filter((m) =>
        m.name.startsWith("__scoped__"),
      ),
    ).toHaveLength(2);
    expect(source).toBe(scopedLDraw(p, ids));
  });
  it("does not transfer deleted INVERTNEXT to the next retained reference", () => {
    const p = importLDraw(
      `0 FILE main.ldr\n0 BFC CERTIFY CCW\n0 BFC INVERTNEXT\n\n1 4 0 0 0 1 0 0 0 1 0 0 0 1 custom.dat\n1 1 40 0 0 1 0 0 0 1 0 0 0 1 custom.dat\n0 FILE custom.dat\n0 !LDRAW_ORG Unofficial_Part\n3 16 0 0 0 1 0 0 0 1 0`,
    );
    const editor = new Editor(p);
    editor.dispatch({
      schemaVersion: 1,
      commandId: "delete",
      expectedRevision: p.revision,
      type: "parts.remove",
      payload: { occurrenceIds: [occurrences(p)[0].id] },
    });
    expect(exportLDraw(editor.project)).not.toContain("INVERTNEXT");
    expect(scopedLDraw(p, [occurrences(p)[1].id])).not.toContain("INVERTNEXT");
    expect(exportLDraw(p)).toContain("INVERTNEXT\n\n1 4");
  });
  it("retains raw geometry records under their BFC ancestor instead of flattening them", () => {
    const p = importLDraw(
      "0 FILE root.ldr\n0 BFC CERTIFY CCW\n0 BFC INVERTNEXT\n1 4 20 0 0 -1 0 0 0 1 0 0 0 1 panel.ldr\n0 FILE panel.ldr\n0 BFC CERTIFY CW\n3 16 0 0 0 10 0 0 0 10 0\n3 14 0 0 0 0 10 0 0 0 10",
    );
    const leaf = occurrences(p)[0],
      out = scopedLDraw(p, [leaf.id]),
      reload = importLDraw(out);
    expect(occurrences(reload)[0].transform).toEqual(leaf.transform);
    expect(occurrences(reload)[0].colorCode).toBe("4");
    expect(out).toContain("0 BFC CERTIFY CW\n3 16");
    expect(occurrences(reload)).toHaveLength(1);
  });
  it("requires acknowledgement for surviving unknown metadata and rejects unknown IDs", () => {
    const p = importLDraw(
      "0 FILE a.ldr\n0 !CUSTOM ASSOCIATION x\n1 4 0 0 0 1 0 0 0 1 0 0 0 1 3001.dat",
    );
    expect(() => scopedLDraw(p, [occurrences(p)[0].id])).toThrow(
      "acknowledgement",
    );
    expect(scopedLDraw(p, [occurrences(p)[0].id], true)).toContain(
      "!CUSTOM ASSOCIATION x",
    );
    expect(() => scopedLDraw(p, ["missing"], true)).toThrow(
      "unknown occurrence",
    );
  });
  it("accepts leading whitespace MPD boundaries and diagnoses indented texture metadata", () => {
    const p = importLDraw(
      "  0 FILE main.ldr  \n1 4 0 0 0 1 0 0 0 1 0 0 0 1 custom.dat\n\t0 FILE custom.dat\n 0 !LDRAW_ORG Unofficial_Part\n 0 !TEXMAP START PLANAR 0 0 0 1 0 0 0 1 0 x.png\n3 16 0 0 0 1 0 0 0 1 0\n 0 NOFILE",
    );
    expect(p.rootModelId).toBe("main.ldr");
    expect(p.models["custom.dat"].classification).toBe("custom");
    expect(
      p.diagnostics.some((d) => d.code === "UNSUPPORTED_RENDER_FEATURE"),
    ).toBe(true);
    p.models[p.rootModelId].records.push({
      id: "injected",
      raw: " 0 FILE injected.ldr",
    });
    expect(() => validateDocument(p)).toThrow("non-boundary");
  });
  it("preserves BFC polygon winding when a reflected primitive transform is baked", () => {
    const p = importLDraw(
      "0 BFC CERTIFY CCW\n3 4 0 0 0 10 0 0 0 10 0\n4 4 0 0 0 10 0 0 10 10 0 0 10 0\n5 24 0 0 0 10 0 0 0 10 0 0 -10 0",
    );
    for (const node of p.models[p.rootModelId].nodes)
      node.transform = {
        position: [20, 0, 0],
        basis: [-1, 0, 0, 0, 1, 0, 0, 0, 1],
      };
    const output = exportLDraw(p);
    expect(output).toContain("3 4 20 0 0 20 10 0 10 0 0");
    expect(output).toContain("4 4 20 0 0 20 10 0 10 10 0 10 0 0");
    // Conditional-line endpoints and control points keep their separate roles.
    expect(output).toContain("5 24 20 0 0 10 0 0 20 10 0 20 -10 0");
    expect(exportLDraw(importLDraw(output))).toBe(output);
  });
});
