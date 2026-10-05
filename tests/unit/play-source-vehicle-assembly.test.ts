import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import { registerFullLibraryFromDisk } from "../../scripts/full-library-node";
import { occurrences } from "../../src/core/document";
import { exportLDraw, importLDraw } from "../../src/ldraw/io";
import { partsList } from "../../src/inventory/parts-list";
import { deriveVehicleRigs } from "../../src/play/auto-vehicles";
import {
  sourceAssemblyEdges,
  sourceAssemblyPartition,
} from "../../src/play/source-assembly";

beforeAll(() => expect(registerFullLibraryFromDisk()).toBe(true));
const source = () =>
  readFileSync("fixtures/play/official-cars/5540-carrier-graph.ldr", "utf8");
const fixture = () => importLDraw(source());
const derive = (p: ReturnType<typeof fixture>, reserved = new Set<string>()) =>
  deriveVehicleRigs(p, { reserved, maxRigs: 8, maxGroups: 128 });

describe("detected source vehicle body ownership", () => {
  it("keeps the default ideal clutch API while preserving independent mobile keyed collars in vehicle review", () => {
    const p = importLDraw(`0 Original mobile keyed collar arrangement
1 16 0 0 0 1 0 0 0 1 0 0 0 1 3707.dat
1 16 0 0 0 0 0 1 0 1 0 -1 0 0 4265a.dat`);
    expect(sourceAssemblyPartition(p).rigidIslands).toHaveLength(1);
    expect(
      sourceAssemblyPartition(p, { keyedAxialFreedom: true }).rigidIslands,
    ).toHaveLength(2);
    expect(
      sourceAssemblyEdges(p, occurrences(p), { keyedAxialFreedom: true }),
    ).toMatchObject([{ kind: "articulated" }]);
    const captured = importLDraw(`0 Original source captured accessory
1 16 0 0 0 1 0 0 0 1 0 0 0 1 3707.dat
1 16 0 0 0 0 0 1 0 1 0 -1 0 0 4185a.dat
1 16 -15 0 0 0 0 1 0 1 0 -1 0 0 4265a.dat
1 16 15 0 0 0 0 1 0 1 0 -1 0 0 4265a.dat`),
      witness = (mobile: boolean) =>
        sourceAssemblyEdges(captured, occurrences(captured), {
          keyedAxialFreedom: mobile,
        }).find(
          (e) => e.evidence.profile === "source-captured-keyed-accessory",
        );
    expect(witness(false)?.axialLimitsLdu).toEqual([-5, 5]);
    expect(witness(true)?.kind).toBe("articulated");
    expect(witness(true)?.axialLimitsLdu).toBeUndefined();
  });
  it("retains all four real wheel carriers and nine hinges in the review and drives the graph only as one drawn body", () => {
    const p = fixture(),
      all = occurrences(p),
      original = JSON.stringify(p),
      exported = exportLDraw(p),
      inventory = partsList(p, all),
      result = derive(p);
    // The one-body profile (source-vehicle-articulation.ts) moves the whole
    // attached graph as one chassis; the source review keeps every island.
    expect(result.vehicles).toHaveLength(1);
    const rig = Object.values(result.rigs)[0];
    expect(rig.groups.map((g) => g.occurrenceIds.length)).toEqual([
      52, 6, 6, 10, 10,
    ]);
    expect(result.vehicles[0].articulation?.knuckles).toHaveLength(2);
    const review = result.sourceAssemblies!;
    expect(review.assemblies).toHaveLength(1);
    const assembly = review.assemblies[0];
    expect(assembly.carrierOccurrenceIds).toHaveLength(4);
    expect(assembly.occurrenceIds).toHaveLength(84);
    expect(assembly.wheelOccurrenceIds).toHaveLength(32);
    expect(assembly.fixedIslands).toHaveLength(52);
    expect(assembly.boundaries).toHaveLength(71);
    expect(
      assembly.boundaries.filter((e) => /hinge/.test(e.evidence.profile)),
    ).toHaveLength(9);
    expect(assembly.rigidWheelProfileCompatible).toBe(false);
    expect(result.skipped).toEqual([]);
    expect(review.occurrenceIds).toHaveLength(117);
    expect(new Set(review.fixedIslands.flat()).size).toBe(117);
    expect(assembly.fixedIslands.flat().sort()).toEqual(
      [...assembly.occurrenceIds].sort(),
    );
    expect(JSON.stringify(p)).toBe(original);
    expect(exportLDraw(p)).toBe(exported);
    expect(partsList(p, all)).toEqual(inventory);
  });

  it("keeps the complete separate cowl and pulley/tyre under world ownership even when every part shares one MPD ancestor", () => {
    for (const nested of [false, true]) {
      const p = importLDraw(
          nested
            ? `0 FILE world.ldr\n1 16 0 0 0 1 0 0 0 1 0 0 0 1 entire-car.ldr\n0 FILE entire-car.ldr\n${source()}`
            : source(),
        ),
        all = occurrences(p),
        r = derive(p).sourceAssemblies!,
        owned = new Set(r.assemblies[0].occurrenceIds),
        loose = new Set(r.unattachedOccurrenceIds),
        cowl = all.find(
          (o) => o.node.ref === "3031.dat" && o.transform.position[1] === -120,
        )!,
        pulley = all.find((o) => o.node.ref === "4185a.dat")!;
      expect(r.assemblies[0].occurrenceIds).toHaveLength(84);
      expect(r.unattachedOccurrenceIds).toHaveLength(33);
      for (const o of [cowl, pulley]) {
        const island = r.fixedIslands.find((g) => g.includes(o.id))!;
        expect(island.every((id) => loose.has(id) && !owned.has(id))).toBe(
          true,
        );
        expect(island).toHaveLength(o === cowl ? 31 : 2);
      }
    }
  });

  it("accounts for unsupported embedded visual/flexible parents without granting source attachment or dropping inventory", () => {
    const p = importLDraw(
        `0 FILE car.ldr\n${source()}\n1 16 0 -100 0 1 0 0 0 1 0 0 0 1 unreviewed-flexible.ldr\n0 FILE unreviewed-flexible.ldr\n0 !LDRAW_ORG Unofficial_Part\n3 16 0 0 0 1 0 0 0 1 0`,
      ),
      all = occurrences(p),
      original = JSON.stringify(p),
      inventory = partsList(p, all),
      result = derive(p),
      custom = all.find((o) => o.node.ref === "unreviewed-flexible.ldr")!;
    expect(custom.namespace).toBe("project");
    expect(result.sourceAssemblies!.occurrenceIds).toHaveLength(118);
    expect(result.sourceAssemblies!.unattachedOccurrenceIds).toContain(
      custom.id,
    );
    expect(result.sourceAssemblies!.assemblies[0].occurrenceIds).not.toContain(
      custom.id,
    );
    expect(result.vehicles.flatMap((v) => v.occurrenceIds)).not.toContain(
      custom.id,
    );
    expect(JSON.stringify(p)).toBe(original);
    expect(partsList(p, all)).toEqual(inventory);
  });

  it("records existing foreign ownership inside the source assembly without admitting a partial chassis", () => {
    const p = fixture(),
      before = derive(p).sourceAssemblies!.assemblies[0],
      owner = before.carrierOccurrenceIds[0],
      result = derive(p, new Set([owner]));
    expect(result.vehicles).toEqual([]);
    expect(
      result.sourceAssemblies!.assemblies.some((a) =>
        a.reservedOccurrenceIds.includes(owner),
      ),
    ).toBe(true);
    expect(
      result.sourceAssemblies!.assemblies.every(
        (a) => !a.rigidWheelProfileCompatible,
      ),
    ).toBe(true);
  });

  it("declines reviewed vehicle ownership if the project shadows an actual source dependency", () => {
    const p = importLDraw(
        `0 FILE car.ldr\n${source()}\n0 FILE axlehole.dat\n3 16 0 0 0 1 0 0 0 1 0`,
      ),
      result = derive(p);
    expect(result.vehicles).toEqual([]);
    expect(result.sourceAssemblies).toBeUndefined();
    expect(
      result.skipped.some((s) =>
        s.reason.includes("shadow installed source geometry"),
      ),
    ).toBe(true);
  });
});
