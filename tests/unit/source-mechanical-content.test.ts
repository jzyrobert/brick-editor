import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { registerFullLibraryFromDisk } from "../../scripts/full-library-node";
import { occurrences } from "../../src/core/document";
import { compose } from "../../src/core/math";
import { importLDraw, exportLDraw } from "../../src/ldraw/io";
import { sourceMechanicalContent } from "../../src/mechanisms/source-content";

registerFullLibraryFromDisk();
const text = readFileSync(
  "fixtures/play/mechanical-systems/source-hose.mpd",
  "utf8",
);
describe("typed mechanical source content", () => {
  it("retains the actual hose fallback, two exact caps and transformed source points without treating skin segments as bricks", () => {
    const project = importLDraw(text);
    const original = JSON.stringify(project);
    const exported = exportLDraw(project);
    const all = occurrences(project);
    const content = sourceMechanicalContent(project, all);
    expect(content.renderedOccurrences).toBe(12);
    expect(content.hardware).toHaveLength(0);
    expect(content.flexibleRenderOccurrences).toBe(12);
    expect(content.flexible).toHaveLength(1);
    const hose = content.flexible[0];
    expect(hose.kind).toBe("path");
    expect(hose.parameters.looped).toBe("false");
    expect(hose.skins[0].donPart).toBe("166.dat");
    expect(hose.points).toHaveLength(2);
    expect(hose.skinOccurrenceIds).toHaveLength(10);
    expect(hose.occurrenceIds).toEqual(all.map((o) => o.id));
    expect(hose.caps.map((c) => c.group)).toEqual(["start", "end"]);
    expect(
      hose.caps.every((c) => c.sourceNodeId && c.occurrenceIds.length === 1),
    ).toBe(true);
    expect(hose.issues).toEqual([]);
    expect(hose.points[0].frame.position).toEqual([13, -30, 40]);
    const cap = all.find((o) => o.id === hose.caps[0].occurrenceIds[0])!;
    expect(hose.caps[0].frame).toEqual(cap.transform);
    expect(hose.points[1].frame).toEqual(
      compose(hose.frame, {
        position: [-10, 5.469513, 1.560269],
        basis: [
          0.848048, 0, 0.529919, 0.055392, -0.994522, -0.088645, 0.527017,
          0.104528, -0.843402,
        ],
      }),
    );
    expect(JSON.stringify(project)).toBe(original);
    expect(exportLDraw(project)).toBe(exported);
  });
  it("refuses to infer a cap node from approximate placement or ambiguous fallback", () => {
    const displaced = importLDraw(
      text.replace("1 16 0 0 -7 ", "1 16 0.000001 0 -7 "),
    );
    const hose = sourceMechanicalContent(displaced).flexible[0];
    expect(hose.caps[0].sourceNodeId).toBeUndefined();
    expect(hose.issues).toHaveLength(1);
    expect(hose.occurrenceIds).toHaveLength(12);
    const duplicate = importLDraw(
      text.replace(
        "1 16 0 0 -7 1 0 0 0 0 1 0 -1 0 165.dat",
        "1 16 0 0 -7 1 0 0 0 0 1 0 -1 0 165.dat\n1 16 0 0 -7 1 0 0 0 0 1 0 -1 0 165.dat",
      ),
    );
    expect(
      sourceMechanicalContent(duplicate).flexible[0].caps[0].sourceNodeId,
    ).toBeUndefined();
  });
  it("does not consolidate a file merely because its name sounds flexible", () => {
    const project = importLDraw(
      "0 FILE fake-hose.ldr\n1 16 0 0 0 1 0 0 0 1 0 0 0 1 3001.dat\n",
    );
    const content = sourceMechanicalContent(project);
    expect(content.flexible).toHaveLength(0);
    expect(content.hardware).toHaveLength(1);
  });
  it("preserves authored anchors without assigning them to a nearby fallback part", () => {
    const project = importLDraw(
      text +
        "\n0 !LDCAD PATH_ANCHOR [posOri=1 2 3 1 0 0 0 1 0 0 0 1] [group=start]\n",
    );
    const original = JSON.stringify(project);
    const hose = sourceMechanicalContent(project).flexible[0];
    expect(hose.anchors).toHaveLength(1);
    expect(hose.anchors[0].frame.position).toEqual([23, -28, 39]);
    expect(hose.anchors[0].parameters.group).toBe("start");
    expect(hose.caps.map((c) => c.occurrenceIds.length)).toEqual([1, 1]);
    expect(hose.occurrenceIds).toHaveLength(12);
    expect(JSON.stringify(project)).toBe(original);
  });
  it("keeps independently placed instances and motor caps addressable", () => {
    const source = text
      .replace(
        "1 16 20 -30 40 0 0 1 0 1 0 -1 0 0 42043 - pneumaticHose-4.ldr",
        "1 16 20 -30 40 0 0 1 0 1 0 -1 0 0 42043 - pneumaticHose-4.ldr\n1 16 200 -30 40 1 0 0 0 1 0 0 0 1 42043 - pneumaticHose-4.ldr",
      )
      .replaceAll("165.dat", "99499.dat");
    const content = sourceMechanicalContent(importLDraw(source));
    expect(content.flexible).toHaveLength(2);
    expect(content.flexible[0].id).not.toBe(content.flexible[1].id);
    expect(content.flexible[0].caps[0].reference).toBe("99499.dat");
    expect(content.flexible[0].caps[0].occurrenceIds[0]).not.toBe(
      content.flexible[1].caps[0].occurrenceIds[0],
    );
    expect(content.flexibleRenderOccurrences).toBe(24);
  });
  it("rejects incomplete and duplicate metadata rather than deriving partial physics", () => {
    expect(() =>
      sourceMechanicalContent(
        importLDraw(
          text.replace("[posOri=0 0 -7 1 0 0 0 0 1 0 -1 0]", "[posOri=0 0 -7]"),
        ),
      ),
    ).toThrow(/complete finite/);
    expect(() =>
      sourceMechanicalContent(
        importLDraw(text.replace("[type=path]", "[type=path] [type=spring]")),
      ),
    ).toThrow(/unambiguous/);
  });
});
