import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import { registerFullLibraryFromDisk } from "../../scripts/full-library-node";
import { occurrences } from "../../src/core/document";
import { add, compose, mv, rotationY } from "../../src/core/math";
import type { Project, Transform } from "../../src/core/types";
import { exportLDraw, importLDraw } from "../../src/ldraw/io";
import { partsList } from "../../src/inventory/parts-list";
import { AUTO_VEHICLE_LIMITS } from "../../src/play/auto-vehicles";
import { sourceAssemblyPartition } from "../../src/play/source-assembly";
import { sourceWheelAttachments } from "../../src/play/source-wheel-attachments";
import { occurrenceBounds } from "../../src/play/trains";

beforeAll(() => expect(registerFullLibraryFromDisk()).toBe(true));
const source = () =>
  readFileSync("fixtures/play/official-cars/5540-wheel-mounts.ldr", "utf8");
const fixture = () => importLDraw(source());
const review = (
  p: Project,
  options: Partial<Parameters<typeof sourceWheelAttachments>[1]> = {},
) =>
  sourceWheelAttachments(p, {
    reserved: new Set(),
    bounds: occurrenceBounds(p),
    limits: AUTO_VEHICLE_LIMITS,
    ...options,
  });

describe("actual retained wheel attachment boundaries", () => {
  it("keeps source wheel/hub, keyed collar and off-axis pin freedom outside the rubber fixed islands", () => {
    const p = fixture(),
      all = occurrences(p),
      before = JSON.stringify(p),
      exported = exportLDraw(p),
      inventory = partsList(p, all),
      result = review(p);
    expect(result.skipped).toEqual([]);
    expect(result.assemblies.map((a) => a.instances.length)).toEqual([
      2, 2, 3, 3,
    ]);
    expect(result.attachments).toHaveLength(60);
    expect(result.attachments.filter((e) => e.kind === "fixed")).toHaveLength(
      10,
    );
    const boundaries = result.attachments.filter(
      (e) => e.kind === "articulated",
    );
    expect(boundaries).toHaveLength(50);
    expect(boundaries.every((e) => e.pivot && e.axis)).toBe(true);
    const partition = sourceAssemblyPartition(p, {
      attachments: result.attachments,
      keyedAxialFreedom: true,
    });
    expect(partition.occurrenceIds).toHaveLength(52);
    expect(partition.attachmentComponents.map((g) => g.length).sort()).toEqual([
      12, 12, 14, 14,
    ]);
    for (const assembly of result.assemblies)
      for (const instance of assembly.instances) {
        const island = partition.rigidIslands.find((g) =>
          g.includes(instance.rim.id),
        )!;
        expect(island).toContain(instance.tyre.id);
        expect(island).not.toContain(assembly.shaft.id);
        expect(island).not.toContain(assembly.carrier.id);
      }
    const shaft = result.assemblies[0].shaft;
    expect(
      partition.rigidIslands.find((g) => g.includes(shaft.id)),
    ).toHaveLength(1);
    expect(JSON.stringify(p)).toBe(before);
    expect(exportLDraw(p)).toBe(exported);
    expect(partsList(p, all)).toEqual(inventory);
  });

  it("locates the actual wheel/frame bore lines and carries them through source yaw without editing rounded transforms", () => {
    const p = fixture(),
      all = occurrences(p),
      base = review(p),
      frame: Transform = { position: [340, 24, -190], basis: rotationY(37) },
      moved = all.map((o) => ({
        ...o,
        transform: compose(frame, o.transform),
      })),
      saved = structuredClone(moved),
      result = review(p, { all: moved });
    expect(result.skipped).toEqual([]);
    const first = base.assemblies[0],
      wheel = base.attachments.find(
        (e) => e.a === first.shaft.id && e.b === first.instances[0].rim.id,
      )!;
    expect(wheel.pivot).toEqual([-160, -54, -200]);
    expect(wheel.axis).toEqual([1, 0, 0]);
    const bearing = base.attachments.find(
      (e) =>
        e.a === first.shaft.id &&
        all.find((o) => o.id === e.b)?.node.ref === "4261.dat",
    )!;
    expect(bearing.pivot).toEqual([-110, -54, -200]);
    for (const edge of base.attachments.filter(
      (e) => e.kind === "articulated",
    )) {
      const actual = result.attachments.find(
        (e) => e.a === edge.a && e.b === edge.b,
      )!;
      const expectedPoint = add(frame.position, mv(frame.basis, edge.pivot!)),
        expectedAxis = mv(frame.basis, edge.axis!);
      for (let k = 0; k < 3; k++) {
        expect(actual.pivot![k]).toBeCloseTo(expectedPoint[k], 8);
        expect(actual.axis![k]).toBeCloseTo(expectedAxis[k], 8);
      }
    }
    expect(moved).toEqual(saved);
  });

  it("preserves actual keyed steering link axial freedom and capturing plate socket articulation", () => {
    // Four unchanged source placements from the attributed original 5540 OMR
    // whose 52-part wheel-mount excerpt is the fixture above. These connect the
    // existing source steering arms to their actual link plate sockets.
    const links = [-1, 1].flatMap((side) => [
        `1 7 ${side * 110} -64 -160 0 0 1 1 0 0 0 1 0 3749.dat`,
        `1 7 ${side * 80} -72 -160 1 0 0 0 1 0 0 0 1 4263.dat`,
      ]),
      p = importLDraw(source() + links.join("\n")),
      all = occurrences(p),
      result = review(p);
    expect(result.skipped).toEqual([]);
    expect(result.attachments).toHaveLength(64);
    for (const pin of all.slice(-4).filter((o) => o.node.ref === "3749.dat")) {
      expect(result.attachments.find((e) => e.b === pin.id)).toMatchObject({
        kind: "articulated",
        evidence: {
          profile: "source-wheel-axial-retainer",
          featureA: "source-keyed-arm-bore",
        },
      });
      expect(result.attachments.find((e) => e.a === pin.id)).toMatchObject({
        kind: "articulated",
        pivot: pin.transform.position,
        axis: [0, 1, 0],
      });
    }
  });

  it("never emits unavailable mounts, lost source geometry or attachments after bounded review fails", () => {
    const p = fixture(),
      target = review(p).assemblies[0],
      reserved = new Set([target.shaft.id]),
      result = review(p, { reserved });
    expect(result.assemblies).toHaveLength(3);
    expect(
      result.attachments.some((e) => reserved.has(e.a) || reserved.has(e.b)),
    ).toBe(false);
    const bounded = review(p, {
      limits: { ...AUTO_VEHICLE_LIMITS, connectionWork: 1 },
    });
    expect(bounded.assemblies).toEqual([]);
    expect(bounded.attachments).toEqual([]);
    expect(bounded.skipped[0].reason).toContain("connection budget");
    const missing = review(p, { bounds: () => null });
    expect(missing.assemblies).toEqual([]);
    expect(missing.attachments).toEqual([]);
    const all = occurrences(p);
    expect(() => review(p, { all: [...all, all[0]] })).toThrow(
      "must be unique",
    );
  });

  it("refuses embedded official dependency shadows before granting wheel ownership", () => {
    const p = importLDraw(
      `0 FILE mounts.ldr\n${source()}\n0 FILE axlehole.dat\n3 16 0 0 0 1 0 0 0 1 0`,
    );
    expect(() => review(p)).toThrow("shadow installed source geometry");
  });
});
