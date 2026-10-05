import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { registerFullLibraryFromDisk } from "../../scripts/full-library-node";
import { occurrences } from "../../src/core/document";
import { importLDraw, exportLDraw } from "../../src/ldraw/io";
import { sourceHardwareIndex } from "../../src/mechanisms/source-hardware-index";
registerFullLibraryFromDisk();
const source = readFileSync(
  "fixtures/play/mechanical-systems/42043-pneumatic-routing.mpd",
  "utf8",
);
describe("semantic source hardware ownership", () => {
  it("retains25 real parent placements,28 full hoses and56 separate cap components with every source leaf owned once", () => {
    const project = importLDraw(source),
      all = occurrences(project),
      original = JSON.stringify(project),
      exported = exportLDraw(project);
    const index = sourceHardwareIndex(project, all);
    expect(index.hardware).toHaveLength(25);
    expect(index.flexible).toHaveLength(28);
    expect(index.capComponents).toHaveLength(56);
    expect(index.sourcePlacements).toBe(53);
    expect(index.unresolved).toHaveLength(0);
    expect(Object.keys(index.byLeaf)).toHaveLength(all.length);
    const body = index.hardware.filter(
      (h) => h.reference === "42043 - 19466c01.dat",
    );
    expect(body).toHaveLength(2);
    expect(
      body.every(
        (h) => h.namespace === "project" && h.occurrenceIds.length > 1,
      ),
    ).toBe(true);
    expect(
      body.every((h) =>
        h.occurrenceIds.every(
          (id) =>
            index.byLeaf[id].kind === "hardware" &&
            index.byLeaf[id].id === h.id,
        ),
      ),
    ).toBe(true);
    const owned = [
      ...index.hardware.flatMap((h) => h.occurrenceIds),
      ...index.capComponents.flatMap((h) => h.occurrenceIds),
      ...index.flexible.flatMap((h) => h.skinOccurrenceIds),
    ];
    expect(owned.length).toBe(all.length);
    expect(new Set(owned).size).toBe(all.length);
    expect(JSON.stringify(project)).toBe(original);
    expect(exportLDraw(project)).toBe(exported);
  });
  it("uses explicit embedded part declarations while ordinary model hierarchy and raw surfaces carry no part or weld claim", () => {
    const project = importLDraw(`0 FILE main.ldr
1 16 10 0 0 1 0 0 0 1 0 0 0 1 named-assembly.dat
1 16 100 0 0 1 0 0 0 1 0 0 0 1 packed.dat
0 FILE named-assembly.dat
0 Plain assembly with a DAT filename
1 16 0 0 0 1 0 0 0 1 0 0 0 1 3001.dat
1 16 60 0 0 1 0 0 0 1 0 0 0 1 3001.dat
0 FILE packed.dat
0 !LDRAW_ORG Unofficial_Shortcut
1 16 0 0 0 1 0 0 0 1 0 0 0 1 3001.dat
3 16 0 0 0 1 0 0 0 1 0
`);
    const index = sourceHardwareIndex(project);
    expect(index.hardware.map((h) => h.reference)).toEqual([
      "3001.dat",
      "3001.dat",
      "packed.dat",
    ]);
    expect(index.hardware.map((h) => h.frame.position[0])).toEqual([
      10, 70, 100,
    ]);
    expect(index.hardware[2].occurrenceIds).toHaveLength(2);
    expect(index.unresolved).toHaveLength(0);
    const raw = sourceHardwareIndex(
      importLDraw("0 FILE raw.ldr\n3 16 0 0 0 1 0 0 0 1 0\n"),
    );
    expect(raw.hardware).toHaveLength(0);
    expect(raw.unresolved).toHaveLength(1);
    expect(Object.values(raw.byLeaf)[0].kind).toBe("unresolved");
  });
  it("keeps independent repeated embedded placements separate and rejects duplicate or mismatched supplied leaf views", () => {
    const project = importLDraw(
        "0 FILE main.ldr\n1 16 0 0 0 1 0 0 0 1 0 0 0 1 packed.dat\n1 16 80 0 0 1 0 0 0 1 0 0 0 1 packed.dat\n0 FILE packed.dat\n0 !LDRAW_ORG Unofficial_Part\n1 16 0 0 0 1 0 0 0 1 0 0 0 1 3001.dat\n",
      ),
      all = occurrences(project),
      index = sourceHardwareIndex(project, all);
    expect(index.hardware).toHaveLength(2);
    expect(index.hardware[0].id).not.toBe(index.hardware[1].id);
    expect(index.hardware[0].occurrenceIds).not.toEqual(
      index.hardware[1].occurrenceIds,
    );
    expect(() => sourceHardwareIndex(project, [...all, all[0]])).toThrow(
      /Duplicate source render leaf/,
    );
    expect(() =>
      sourceHardwareIndex(project, [
        { ...all[0], path: ["not-a-node"], id: '["not-a-node"]' },
      ]),
    ).toThrow(/source leaf path/);
    expect(() => sourceHardwareIndex(project, all.slice(0, 1))).toThrow(
      /incomplete/,
    );
  });
});
