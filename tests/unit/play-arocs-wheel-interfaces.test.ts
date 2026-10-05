import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import { Mesh, DoubleSide, Raycaster, Vector3 } from "three";
import {
  registerFullLibraryFromDisk,
  fullLibrarySources,
} from "../../scripts/full-library-node";
import { occurrences } from "../../src/core/document";
import { compose, rotationY } from "../../src/core/math";
import { importLDraw, exportLDraw } from "../../src/ldraw/io";
import { partsList } from "../../src/inventory/parts-list";
import manifest from "../../src/play/arocs-wheel-sources.json";
import {
  bindArocsWheelSources,
  arocsPartInterface,
  arocsWheelUnits,
  arocsDrivelineWitnesses,
  type ArocsWheelBinding,
  type ArocsWheelRef,
} from "../../src/play/arocs-wheel-interfaces";
import { compileOfficialPart } from "../helpers/compile-part";
let binding: ArocsWheelBinding;
const refs = Object.keys(manifest) as ArocsWheelRef[];
beforeAll(async () => {
  expect(registerFullLibraryFromDisk()).toBe(true);
  binding = await bindArocsWheelSources(fullLibrarySources(refs), refs);
});
const fixture = () =>
  importLDraw(
    readFileSync(
      "fixtures/play/official-cars/42043-wheel-carriers.ldr",
      "utf8",
    ),
  );
const review = (p = fixture(), all = occurrences(p)) =>
  arocsWheelUnits(
    all.flatMap((o) => {
      const f = arocsPartInterface(o, binding);
      return f ? [f] : [];
    }),
  );
describe("source-bound actual Arocs wheel carriers", () => {
  it("refuses changed dependency closure, project shadows and fabricated binding/interface tokens", async () => {
    const sources = fullLibrarySources(refs);
    await expect(
      bindArocsWheelSources(
        { ...sources, "axl3hole.dat": sources["axl3hole.dat"] + "\n0 changed" },
        refs,
      ),
    ).rejects.toThrow("geometry changed");
    const p = importLDraw(
      "0 FILE root.ldr\n1 16 0 0 0 1 0 0 0 1 0 0 0 1 86652.dat\n0 FILE axl3hole.dat\n3 16 0 0 0 1 0 0 0 1 0",
    );
    await expect(
      bindArocsWheelSources(sources, refs, { project: p }),
    ).rejects.toThrow("shadows");
    const o = occurrences(fixture()).find((o) => o.node.ref === "86652.dat")!;
    expect(
      arocsPartInterface({ ...o, namespace: "project" }, binding),
    ).toBeUndefined();
    expect(arocsPartInterface(o, { refs })).toBeUndefined();
    expect(() =>
      arocsWheelUnits([{ ...arocsPartInterface(o, binding)! }]),
    ).toThrow("actual");
  });
  it("preserves four stations, twelve physical tyres, eight stopped rotating units and passive keyed drives", () => {
    const p = fixture(),
      before = JSON.stringify(p),
      source = exportLDraw(p),
      inventory = partsList(p, occurrences(p)),
      r = review(p);
    expect(r.skipped).toEqual([]);
    expect(r.units).toHaveLength(8);
    expect(r.units.map((u) => u.wheels.length)).toEqual([
      1, 1, 1, 1, 2, 2, 2, 2,
    ]);
    expect(r.units.flatMap((u) => u.wheels)).toHaveLength(12);
    expect(
      [
        ...new Set(
          r.units.flatMap((u) => u.wheels.map((w) => w.sourceCenter[2])),
        ),
      ].sort((a, b) => a - b),
    ).toEqual([-242.4, 17.6, 500, 700]);
    expect(
      r.units
        .slice(0, 4)
        .every((u) => u.freedom.axialCapture === "two-collars"),
    ).toBe(true);
    expect(
      r.units
        .slice(4)
        .every((u) => u.freedom.axialCapture === "source-stop-and-coupler"),
    ).toBe(true);
    expect(
      r.units.every(
        (u) => u.attachmentOnly && u.freedom.bearingRotation === "free",
      ),
    ).toBe(true);
    expect(r.driveline).toHaveLength(4);
    expect(
      r.driveline.every(
        (d) =>
          d.shafts
            .map((s) => s.engagementLdu)
            .sort((a, b) => a - b)
            .join(",") === "15.5,17.5",
      ),
    ).toBe(true);
    expect(JSON.stringify(p)).toBe(before);
    expect(exportLDraw(p)).toBe(source);
    expect(partsList(p, occurrences(p))).toEqual(inventory);
  });
  it("reports authored suspension heights and the explicit second-front mismatch without moving source", () => {
    const p = fixture(),
      before = JSON.stringify(p),
      r = review(p),
      wheels = r.units.flatMap((u) => u.wheels),
      front = wheels.filter((w) => w.sourceCenter[2] < 100),
      rear = wheels.filter((w) => w.sourceCenter[2] > 100);
    expect(front.every((w) => w.sourceCenter[1] === -80.56)).toBe(true);
    expect(rear.every((w) => w.sourceCenter[1] === -80)).toBe(true);
    const mismatched = front.filter((w) => w.authoredTransverseMismatchLdu > 0);
    expect(mismatched).toHaveLength(2);
    for (const w of mismatched) {
      expect(w.authoredTransverseMismatchLdu).toBeCloseTo(
        Math.hypot(0.037, 0.011),
        12,
      );
      for (const [k, n] of [0, -0.037, 0.011].entries())
        expect(w.idealCoaxialTranslation[k]).toBeCloseTo(n, 12);
    }
    expect(JSON.stringify(p)).toBe(before);
  });
  it("preserves exact interfaces and source discrepancies under translated yaw", () => {
    for (const yaw of [37, 90, 180]) {
      const p = fixture(),
        all = occurrences(p).map((o) => ({
          ...o,
          transform: compose(
            { position: [340, 24, -190], basis: rotationY(yaw) },
            o.transform,
          ),
        })),
        r = review(p, all);
      expect(r.units).toHaveLength(8);
      expect(r.units.flatMap((u) => u.wheels)).toHaveLength(12);
      expect(
        r.units
          .slice(4)
          .every((u) => u.freedom.axialCapture === "source-stop-and-coupler"),
      ).toBe(true);
      expect(
        r.units
          .flatMap((u) => u.wheels)
          .filter((w) => w.authoredTransverseMismatchLdu > 0.001)
          .map((w) => w.authoredTransverseMismatchLdu),
      ).toEqual(
        expect.arrayContaining([
          expect.closeTo(Math.hypot(0.037, 0.011), 9),
          expect.closeTo(Math.hypot(0.037, 0.011), 9),
        ]),
      );
    }
  });
  it("keeps missing retainers and couplers explicit instead of inventing a weld", () => {
    const p = fixture(),
      all = occurrences(p),
      base = review(p),
      collar = base.units[0].collars[0].occurrenceId;
    expect(
      review(
        p,
        all.filter((o) => o.id !== collar),
      ).units[0].freedom.axialCapture,
    ).toBe("unproved");
    const coupler = base.driveline[0].coupler.occurrenceId;
    const changed = review(
      p,
      all.filter((o) => o.id !== coupler),
    );
    expect(changed.driveline).toHaveLength(3);
    expect(
      changed.units.slice(4).some((u) => u.freedom.axialCapture === "unproved"),
    ).toBe(true);
  });
  it("refuses separated tyres, source hub misalignment and a shaft crossing the real coupler separator", () => {
    const p = fixture(),
      all = occurrences(p),
      base = review(p),
      rim = base.units[0].wheels[0].rim.occurrenceId,
      changed = structuredClone(all),
      tyre = base.units[0].wheels[0].tyre.occurrenceId;
    for (const id of [rim, tyre])
      changed.find((o) => o.id === id)!.transform.position[1] += 0.2;
    expect(review(p, changed).units).toHaveLength(7);
    const drive = base.driveline[0],
      inner = drive.shafts.find((s) => s.shaft.ref === "4519.dat")!.shaft,
      parts = all.flatMap((o) => {
        const f = arocsPartInterface(o, binding);
        return f ? [f] : [];
      }),
      moved = structuredClone(all.find((o) => o.id === inner.occurrenceId)!);
    moved.transform.position = moved.transform.position.map(
      (x, k) =>
        x +
        0.6 *
          (drive.shafts.find((s) => s.shaft === inner)!.side === -1 ? 1 : -1) *
          drive.coupler.axis!.axis[k],
    ) as typeof moved.transform.position;
    const replacement = arocsPartInterface(moved, binding)!;
    expect(
      arocsDrivelineWitnesses(
        parts.map((p) =>
          p.occurrenceId === inner.occurrenceId ? replacement : p,
        ),
      ),
    ).toHaveLength(3);
  });
  it("independently checks the compiled short keyed hub walls and asymmetric tyre support", async () => {
    const rim = await compileOfficialPart("86652.dat");
    rim.updateMatrixWorld(true);
    rim.traverse((o) => {
      if (o instanceof Mesh)
        for (const m of Array.isArray(o.material) ? o.material : [o.material])
          m.side = DoubleSide;
    });
    for (const z of [-8, 0, 8]) {
      const hit = new Raycaster(
        new Vector3(0, 0, z),
        new Vector3(-1, 0, 0),
      ).intersectObject(rim, true)[0];
      expect(hit.point.x).toBeCloseTo(-6, 5);
    }
    // Actual second-front offset extends the opposite nominal axle tip to
    // X=-6.037 in this source plane. This is keyed material contact, not a
    // claim of literal free clearance or a source-transform correction.
    const tyre = await compileOfficialPart("32019.dat");
    tyre.updateMatrixWorld(true);
    let min = Infinity,
      max = -Infinity,
      radius = 0;
    tyre.traverse((o) => {
      if (!(o instanceof Mesh)) return;
      const b = o.geometry.getAttribute("position");
      for (let i = 0; i < b.count; i++) {
        const v = new Vector3()
          .fromBufferAttribute(b, i)
          .applyMatrix4(o.matrixWorld);
        min = Math.min(min, v.z);
        max = Math.max(max, v.z);
        radius = Math.max(radius, Math.hypot(v.x, v.y));
      }
    });
    expect(min).toBe(-34.5);
    expect(max).toBe(15.5);
    expect(radius).toBeGreaterThan(78.29);
    expect(radius).toBeLessThan(78.299);
  });
});
