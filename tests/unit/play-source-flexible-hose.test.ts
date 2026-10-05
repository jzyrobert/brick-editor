import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import {
  fullLibrarySources,
  registerFullLibraryFromDisk,
} from "../../scripts/full-library-node";
import { occurrences } from "../../src/core/document";
import { exportLDraw, importLDraw } from "../../src/ldraw/io";
import {
  bindFlexibleHoseSources,
  FLEXIBLE_HOSE_SOURCES,
  sourceFlexibleHoseWitness,
} from "../../src/play/source-flexible-hose";
beforeAll(() => expect(registerFullLibraryFromDisk()).toBe(true));
const fixture = () =>
  importLDraw(
    readFileSync(
      "fixtures/play/official-cars/5540-hose-attachment.ldr",
      "utf8",
    ),
  );
describe("actual flexible hose source attachment", () => {
  it("preserves one inventory occurrence while identifying actual56source branches and BOTH stud-seated caps", async () => {
    const p = fixture(),
      all = occurrences(p),
      hose = all.find((o) => o.namespace === "project")!,
      before = exportLDraw(p),
      binding = await bindFlexibleHoseSources(
        fullLibrarySources(Object.keys(FLEXIBLE_HOSE_SOURCES)),
        p,
      );
    const witness = await sourceFlexibleHoseWitness(p, hose, all, binding);
    expect(witness?.components).toHaveLength(56);
    expect(new Set(witness?.components.map((c) => c.componentId)).size).toBe(
      56,
    );
    expect(
      witness?.components.every((c) => c.parentOccurrenceId === hose.id),
    ).toBe(true);
    expect(witness?.endpoints.map((e) => e.point)).toEqual([
      [0, 0, 0],
      [-40, -118, 46],
    ]);
    expect(
      witness?.endpoints.every(
        (e) =>
          all.find((o) => o.id === e.hostOccurrenceId)?.node.ref === "3024.dat",
      ),
    ).toBe(true);
    expect(witness).not.toHaveProperty("kind");
    expect(all).toHaveLength(3);
    expect(exportLDraw(p)).toBe(before);
  });
  it("refuses missing/displaced or ambiguous endpoint studs rather than attaching the root", async () => {
    const p = fixture(),
      all = occurrences(p),
      hose = all[0],
      binding = await bindFlexibleHoseSources(
        fullLibrarySources(Object.keys(FLEXIBLE_HOSE_SOURCES)),
        p,
      );
    expect(
      await sourceFlexibleHoseWitness(p, hose, all.slice(0, 2), binding),
    ).toBeUndefined();
    const changed = structuredClone(all);
    changed[2].transform.position[0] += 2;
    expect(
      await sourceFlexibleHoseWitness(p, hose, changed, binding),
    ).toBeUndefined();
    const duplicate = structuredClone(all[1]);
    duplicate.id = "ambiguous-stud";
    expect(
      await sourceFlexibleHoseWitness(p, hose, [...all, duplicate], binding),
    ).toBeUndefined();
  });
  it("refuses changed source fallback geometry and authoritative primitive shadows", async () => {
    const p = fixture(),
      all = occurrences(p),
      binding = await bindFlexibleHoseSources(
        fullLibrarySources(Object.keys(FLEXIBLE_HOSE_SOURCES)),
        p,
      );
    const model = p.models[all[0].node.ref];
    model.records.find((r) => /^1 /.test(r.raw))!.raw += " changed";
    expect(
      await sourceFlexibleHoseWitness(p, all[0], all, binding),
    ).toBeUndefined();
    const shadow = fixture();
    shadow.models["4-4cylo.dat"] = {
      ...structuredClone(shadow.models[shadow.rootModelId]),
      id: "4-4cylo.dat",
      name: "4-4cylo.dat",
    };
    await expect(
      bindFlexibleHoseSources(
        fullLibrarySources(Object.keys(FLEXIBLE_HOSE_SOURCES)),
        shadow,
      ),
    ).rejects.toThrow("Project shadows reviewed source");
  });
});
