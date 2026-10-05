import { createHash } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import {
  fullLibrarySources,
  registerFullLibraryFromDisk,
} from "../../scripts/full-library-node";
import { occurrences } from "../../src/core/document";
import { exportLDraw, importLDraw } from "../../src/ldraw/io";
import {
  ASSEMBLY_STUD_SUBSETS,
  ASSEMBLY_KEYED_BORES,
  assemblyHingeInterface,
  assemblyStudConnectors,
} from "../../src/play/reviewed-assembly-attachments";
import {
  ACCESSORY_FIT_SOURCES,
  reviewedAccessoryFits,
} from "../../src/play/reviewed-accessory-fits";
import {
  sourceConnectedAssembly,
  sourceAssemblyEdges,
  sourceAssemblyPartition,
  type SourceAssemblyEdge,
} from "../../src/play/source-assembly";

beforeAll(() => expect(registerFullLibraryFromDisk()).toBe(true));
const arrangement = () =>
  importLDraw(`0 Original source-interface test arrangement
1 16 0 0 0 1 0 0 0 1 0 0 0 1 3937.dat
1 16 0 0 0 1 0 0 0 1 0 0 0 1 3938.dat
1 16 0 -8 0 1 0 0 0 1 0 0 0 1 3023.dat
1 16 0 24 0 1 0 0 0 1 0 0 0 1 3023.dat
1 16 150 0 0 1 0 0 0 1 0 0 0 1 3001.dat`);

describe("source attachment ownership", () => {
  it("pins narrow connector subsets to exact complete-library sources", () => {
    const profiles = {
      ...ASSEMBLY_STUD_SUBSETS,
      ...ASSEMBLY_KEYED_BORES,
      ...Object.fromEntries(
        Object.entries(ACCESSORY_FIT_SOURCES).map(([ref, sourceSha256]) => [
          ref,
          { sourceSha256 },
        ]),
      ),
    };
    const sources = fullLibrarySources(Object.keys(profiles));
    for (const [ref, subset] of Object.entries(profiles))
      expect(createHash("sha256").update(sources[ref]).digest("hex"), ref).toBe(
        subset.sourceSha256,
      );
  });
  it("partitions loose source objects separately without granting chassis ownership", () => {
    const p = arrangement(),
      all = occurrences(p);
    const result = sourceAssemblyPartition(p);
    expect(result.occurrenceIds).toHaveLength(5);
    expect(result.rigidIslands.map((g) => g.length).sort()).toEqual([1, 2, 2]);
    expect(result.attachmentComponents.map((g) => g.length).sort()).toEqual([
      1, 4,
    ]);
    expect(
      sourceConnectedAssembly(p, { seeds: [all[0].id] }).occurrenceIds,
    ).not.toContain(all[4].id);
    expect(
      sourceAssemblyPartition(p, { reserved: new Set([all[4].id]) })
        .occurrenceIds,
    ).toHaveLength(4);
  });
  it("retains a round bearing only when both source collars seat its faces", () => {
    const p = importLDraw(`0 Original retained-bearing interface arrangement
1 16 0 0 0 1 0 0 0 1 0 0 0 1 3707.dat
1 16 0 -10 0 0 0 1 0 1 0 -1 0 0 3700.dat
1 16 -15 0 0 0 0 1 0 1 0 -1 0 0 4265a.dat
1 16 15 0 0 0 0 1 0 1 0 -1 0 0 4265a.dat`);
    const retained = (all = occurrences(p)) =>
      sourceAssemblyEdges(p, all).filter(
        (e) => e.evidence.profile === "source-retained-axle-bearing",
      );
    expect(retained()).toHaveLength(1);
    expect(retained().every((e) => e.kind === "articulated")).toBe(true);
    expect(retained(occurrences(p).slice(0, 3))).toEqual([]);
    const changed = occurrences(p);
    changed[3].transform.position[0] += 4;
    expect(retained(changed)).toEqual([]);
  });
  it("captures a keyed pulley between actual collars without erasing its axial clearance", () => {
    const p = importLDraw(`0 Original keyed accessory interface arrangement
1 16 0 0 0 1 0 0 0 1 0 0 0 1 3707.dat
1 16 0 0 0 0 0 1 0 1 0 -1 0 0 4185a.dat
1 16 -15 0 0 0 0 1 0 1 0 -1 0 0 4265a.dat
1 16 15 0 0 0 0 1 0 1 0 -1 0 0 4265a.dat`);
    const captured = (all = occurrences(p)) =>
      sourceAssemblyEdges(p, all).filter(
        (e) => e.evidence.profile === "source-captured-keyed-accessory",
      );
    expect(captured()).toMatchObject([
      { kind: "articulated", axialLimitsLdu: [-5, 5] },
    ]);
    expect(captured(occurrences(p).slice(0, 3))).toEqual([]);
    const changed = occurrences(p);
    changed[1].namespace = "project";
    expect(captured(changed)).toEqual([]);
    changed[1] = structuredClone(occurrences(p)[1]);
    changed[1].transform.position[1] = 2;
    expect(captured(changed)).toEqual([]);
  });
  it("recognizes the literal headlight rear stud cavity independently of its front hollow stud", () => {
    const p = importLDraw(`0 Original rear stud cavity arrangement
1 16 0 0 0 1 0 0 0 1 0 0 0 1 4070.dat
1 16 0 10 10 1 0 0 0 0 -1 0 1 0 3024.dat`);
    expect(
      sourceConnectedAssembly(p, { seeds: [occurrences(p)[0].id] })
        .fixedIslands,
    ).toHaveLength(1);
    expect(
      sourceConnectedAssembly(p, { seeds: [occurrences(p)[0].id] })
        .occurrenceIds,
    ).toHaveLength(2);
  });
  it("attaches seated tap/cone and pulley/tyre source fits but refuses displaced or ambiguous partners", () => {
    const p = importLDraw(`0 Original narrow accessory fit arrangement
1 16 0 0 0 1 0 0 0 1 0 0 0 1 4599a.dat
1 16 0 4 20 1 0 0 0 0 -1 0 1 0 4589.dat
1 16 100 0 0 1 0 0 0 1 0 0 0 1 4185a.dat
1 16 100 0 0 1 0 0 0 1 0 0 0 1 2815.dat`),
      all = occurrences(p);
    expect(reviewedAccessoryFits(all)).toHaveLength(2);
    const duplicate = structuredClone(all[1]);
    duplicate.id = "ambiguous-cone";
    expect(reviewedAccessoryFits([...all, duplicate])).toHaveLength(1);
    const changed = structuredClone(all);
    changed[1].transform.position[0] = 2;
    changed[3].namespace = "project";
    expect(reviewedAccessoryFits(changed)).toEqual([]);
  });
  it("carries a hinged leaf and its stud-attached plate without welding the hinge or unrelated root scenery", () => {
    const p = arrangement(),
      before = exportLDraw(p),
      all = occurrences(p),
      root = all.find((o) => o.node.ref === "3937.dat")!;
    const result = sourceConnectedAssembly(p, { seeds: [root.id] });
    expect(result.occurrenceIds).toHaveLength(4);
    expect(result.fixedIslands.map((g) => g.length).sort()).toEqual([2, 2]);
    expect(result.boundaries).toHaveLength(1);
    expect(result.boundaries[0]).toMatchObject({
      kind: "articulated",
      pivot: [0, 10, 0],
      axis: [1, 0, 0],
    });
    expect(result.occurrenceIds).not.toContain(all[4].id);
    expect(exportLDraw(p)).toBe(before);
  });
  it("refuses ambiguous hinge partners and displaced/rotated halves", () => {
    const p = arrangement(),
      all = occurrences(p),
      leaf = all.find((o) => o.node.ref === "3938.dat")!;
    const duplicate = structuredClone(leaf);
    duplicate.id = "duplicate-leaf";
    expect(
      sourceAssemblyEdges(p, [...all, duplicate]).filter(
        (e) => e.evidence.profile === "source-plate-barrel-hinge",
      ),
    ).toEqual([]);
    for (const alteration of ["displace", "rotate"]) {
      const changed = structuredClone(all),
        target = changed.find((o) => o.id === leaf.id)!;
      if (alteration === "displace") target.transform.position[0] = 2;
      else target.transform.basis = [0, 0, 1, 0, 1, 0, -1, 0, 0];
      expect(
        sourceAssemblyEdges(p, changed).filter(
          (e) => e.evidence.profile === "source-plate-barrel-hinge",
        ),
      ).toEqual([]);
    }
  });
  it("does not trust project copies or mirrored interfaces; rounded proper source frames remain unmodified", () => {
    const leaf = occurrences(arrangement())[0],
      custom = structuredClone(leaf),
      mirror = structuredClone(leaf),
      rounded = structuredClone(leaf);
    custom.namespace = "project";
    mirror.transform.basis[0] = -1;
    rounded.transform.basis = [1, 0, 0, 0, 0.208, -0.978, 0, 0.978, 0.208];
    const before = structuredClone(rounded.transform);
    expect(assemblyStudConnectors(custom)).toEqual([]);
    expect(assemblyHingeInterface(custom)).toBeUndefined();
    expect(assemblyStudConnectors(mirror)).toEqual([]);
    expect(assemblyHingeInterface(mirror)).toBeUndefined();
    expect(assemblyStudConnectors(rounded)).toHaveLength(2);
    expect(assemblyHingeInterface(rounded)).toBeDefined();
    expect(rounded.transform).toEqual(before);
  });
  it("refuses embedded official primitive shadows rather than trusting an official root basename", () => {
    const p = importLDraw(`0 FILE assembly.ldr
1 16 0 0 0 1 0 0 0 1 0 0 0 1 3707.dat
1 16 0 0 0 0 0 1 0 1 0 -1 0 0 4265a.dat
0 FILE axlehole.dat
0 Original deliberately unrelated replacement geometry
3 16 0 0 0 1 0 0 0 1 0`);
    expect(occurrences(p)[0].namespace).toBe("official");
    expect(() => sourceAssemblyEdges(p)).toThrow(
      "shadow installed source geometry",
    );
  });
  it("keeps reserved/excluded attachments outside ownership and preserves explicit visual boundaries", () => {
    const p = arrangement(),
      all = occurrences(p),
      root = all[0],
      leaf = all[1],
      decoration = all[4];
    expect(
      sourceConnectedAssembly(p, {
        seeds: [root.id],
        reserved: new Set([leaf.id]),
      }).occurrenceIds,
    ).not.toContain(leaf.id);
    const edge: SourceAssemblyEdge = {
      a: root.id,
      b: decoration.id,
      kind: "visual",
      evidence: {
        profile: "test-reviewed-adhesive-face",
        featureA: "face",
        featureB: "backing",
      },
    };
    const result = sourceConnectedAssembly(p, {
      seeds: [root.id],
      attachments: [edge],
    });
    expect(result.occurrenceIds).toContain(decoration.id);
    expect(result.fixedIslands.find((g) => g.includes(decoration.id))).toEqual([
      decoration.id,
    ]);
    expect(result.boundaries).toContainEqual(edge);
    expect(() =>
      sourceConnectedAssembly(p, {
        seeds: [leaf.id],
        reserved: new Set([leaf.id]),
      }),
    ).toThrow("already owned");
    expect(() =>
      sourceConnectedAssembly(p, {
        seeds: [root.id],
        attachments: [{ ...edge, b: "missing" }],
      }),
    ).toThrow("attachment evidence");
  });
});
