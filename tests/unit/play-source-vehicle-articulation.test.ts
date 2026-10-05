import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  fullLibrarySources,
  registerFullLibraryFromDisk,
} from "../../scripts/full-library-node";
import { directReferences } from "../../src/catalog/full-pack";
import { occurrences } from "../../src/core/document";
import type { Project, Transform, Vec3 } from "../../src/core/types";
import { exportLDraw, importLDraw } from "../../src/ldraw/io";
import { partsList } from "../../src/inventory/parts-list";
import {
  deriveVehicleRigs,
  type DerivedVehicles,
} from "../../src/play/auto-vehicles";
import { DynamicRig } from "../../src/play/dynamics";
import { PlaySession } from "../../src/play/session";
import {
  bindFlexibleHoseSources,
  FLEXIBLE_HOSE_SOURCES,
} from "../../src/play/source-flexible-hose";
import { admitSourceRideAlong } from "../../src/play/source-vehicle-ride-along";
import { occurrenceBounds } from "../../src/play/trains";
import { memberGeometry } from "../helpers/compact-vehicle-bench";
import { playSources } from "../helpers/play-dynamic-source";

registerFullLibraryFromDisk();
const EXCERPT = "fixtures/play/official-cars/5540-carrier-graph.ldr";
const WHOLE = ".local/5540-1.mpd";
const derive = (p: Project) =>
  deriveVehicleRigs(p, { reserved: new Set(), maxRigs: 8, maxGroups: 128 });
const rideAlong = (p: Project, derived: DerivedVehicles) =>
  admitSourceRideAlong({
    project: p,
    derived,
    all: occurrences(p),
    bounds: occurrenceBounds(p),
    surfaces: async (ids) => {
      const { members } = await memberGeometry(p, ids);
      return Object.fromEntries(
        [...members].map(([id, m]) => [
          id,
          {
            revision: p.revision,
            vertices: m.vertices,
            indices: m.indices,
            bounds: { min: [0, 0, 0] as Vec3, max: [0, 0, 0] as Vec3 },
          },
        ]),
      );
    },
    hoseBinding: () =>
      bindFlexibleHoseSources(
        fullLibrarySources(Object.keys(FLEXIBLE_HOSE_SOURCES)),
        p,
      ),
  });
const distance = (a: Transform, b: Transform) =>
  Math.hypot(...(a.position.map((v, k) => v - b.position[k]) as Vec3));
/** Drive a derived one-body car and return its drawn poses. */
async function drive(p: Project, derived: DerivedVehicles) {
  const vehicle = derived.vehicles[0],
    id = vehicle.rigId,
    all = occurrences(p),
    prepared = await playSources(
      { ...p, motionRigs: derived.rigs },
      [id],
      fullLibrarySources([
        ...all.map((o) => o.node.ref),
        ...Object.values(p.models).flatMap((m) =>
          directReferences(m.records.map((r) => r.raw).join("\n")),
        ),
      ]),
    );
  prepared.sources[0].articulation = vehicle.articulation;
  const play = await PlaySession.create(
    prepared.geometry,
    {
      rigIds: [id],
      // No dynamicRigIds: a one-body source car becomes dynamic by itself.
      position: [700, -0.3, 700],
    },
    prepared.sources,
  );
  try {
    const compact = (
      play as unknown as { dynamics?: { rig(id: string): DynamicRig } }
    ).dynamics?.rig(id)?.compactReport;
    play.stepTicks(60);
    const rest = play.snapshot().mechanisms![id];
    play.setMechanismVehicleInput({ throttle: 1, steering: 0 }, id);
    const straight = play.stepTicks(120).mechanisms![id];
    play.setMechanismVehicleInput({ throttle: 1, steering: 1 }, id);
    const turned = play.stepTicks(90).mechanisms![id];
    return { id, rest, straight, turned, compact };
  } finally {
    play.dispose();
  }
}
/** The excerpt without its loose cover and steering wheel (they stay put and
 * would sit in the car's way in a test world). */
function attachedOnly(p: Project) {
  const loose = new Set(derive(p).sourceAssemblies!.unattachedOccurrenceIds);
  const lines = occurrences(p)
    .filter((o) => !loose.has(o.id))
    .map(
      (o) =>
        `1 ${o.colorCode} ${o.transform.position.join(" ")} ${o.transform.basis.join(" ")} ${o.node.ref}`,
    );
  return importLDraw(["0 Attached 5540 excerpt", ...lines].join("\n"));
}

describe("one-body 5540 source vehicle with drawn articulation", () => {
  it("plans steering arms from the reviewed pivots and holds the nine hinges", () => {
    const p = importLDraw(readFileSync(EXCERPT, "utf8")),
      derived = derive(p),
      v = derived.vehicles[0],
      a = v.articulation!;
    expect(derived.vehicles).toHaveLength(1);
    expect(v.rule).toBe("source-retained-axle-layout");
    expect(a.knuckles.map((k) => k.pivot)).toEqual([
      [-110, -64, -200],
      [110, -64, -200],
    ]);
    const lookup = new Map(occurrences(p).map((o) => [o.id, o]));
    for (const k of a.knuckles)
      expect(k.occurrenceIds.map((id) => lookup.get(id)!.node.ref)).toEqual(
        expect.arrayContaining(["4261.dat", "3706.dat", "3749.dat"]),
      );
    expect(
      a.held
        .filter((h) => /hinge/.test(h.profile))
        .reduce((n, h) => n + h.occurrenceIds.length, 0),
    ).toBeGreaterThan(0);
    expect(a.notes.join(" ")).toContain("9 hinge joints stay as built");
  });

  it("keeps loose parts where they were built when the evidence is missing", async () => {
    const p = importLDraw(readFileSync(EXCERPT, "utf8")),
      before = exportLDraw(p),
      derived = derive(p),
      [result] = await rideAlong(p, derived);
    // The excerpt omits the bodywork the cover rests on and the steering column.
    expect(result.admitted).toEqual([]);
    expect(result.staying.map((s) => s.occurrenceIds.length).sort()).toEqual([
      2, 31,
    ]);
    expect(derived.vehicles[0].articulation!.notes.at(-1)).toBe(
      "33 loose parts stay where they were built.",
    );
    expect(exportLDraw(p)).toBe(before);
  }, 60000);

  it("drives as one dynamic body, chosen automatically, and draws the arms turning about their pivots", async () => {
    const p = attachedOnly(importLDraw(readFileSync(EXCERPT, "utf8"))),
      before = JSON.stringify(p),
      exported = exportLDraw(p),
      inventory = partsList(p, occurrences(p)),
      derived = derive(p),
      a = derived.vehicles[0].articulation!,
      { rest, straight, turned, compact } = await drive(p, derived);
    expect(rest.mode).toBe("dynamic");
    expect(compact!.members).toBe(52);
    expect(compact!.hulls).toBeLessThan(52);
    const travel =
      rest.pose.vehicle!.position[2] - straight.pose.vehicle!.position[2];
    expect(travel).toBeGreaterThan(150);
    expect(Math.abs(turned.pose.vehicle!.headingDegrees)).toBeGreaterThan(5);
    // Each drawn arm keeps its own axle and its wheel at the same distance
    // as built while it turns about the reviewed pivot.
    const rig = derived.rigs[rest.rigId];
    for (const k of a.knuckles) {
      const axle = k.occurrenceIds.find((id) =>
          occurrences(p)
            .find((o) => o.id === id)!
            .node.ref.startsWith("3706"),
        )!,
        rim = rig.groups.find((g) => g.id === k.wheelGroupId)!.occurrenceIds[0];
      const built = distance(rest.transforms[axle], rest.transforms[rim]),
        steered = distance(turned.transforms[axle], turned.transforms[rim]);
      expect(Math.abs(steered - built)).toBeLessThan(1);
    }
    expect(rest.warnings.join(" ")).toContain("moves as one piece");
    expect(JSON.stringify(p)).toBe(before);
    expect(exportLDraw(p)).toBe(exported);
    expect(partsList(p, occurrences(p))).toEqual(inventory);
  }, 180000);

  // The whole OMR car is private (gitignored .local); this runs where it exists.
  it.skipIf(!existsSync(WHOLE))(
    "carries the whole car's cover, steering wheel, stickers and hoses along",
    async () => {
      const p = importLDraw(readFileSync(WHOLE, "utf8")),
        derived = derive(p),
        [result] = await rideAlong(p, derived),
        a = derived.vehicles[0].articulation!;
      const count = (kind: string) =>
        result.admitted
          .filter((x) => x.kind === kind)
          .reduce((n, x) => n + x.occurrenceIds.length, 0);
      expect(count("resting-cover")).toBe(31);
      expect(count("steering-wheel")).toBe(2);
      expect(count("sticker")).toBe(13);
      expect(count("flexible-hose")).toBe(4);
      expect(result.staying).toEqual([]);
      expect(a.linkage).toBeDefined();
      expect(a.column?.pitchRadiusLdu).toBe(17.5);
      const { rest, straight, turned } = await drive(p, derived);
      const cover = a.rideAlong.find((r) => r.kind === "resting-cover")!
          .occurrenceIds[0],
        wheel = a.rideAlong.find((r) => r.kind === "steering-wheel")!
          .occurrenceIds[0];
      // The cover moves rigidly with the body: its distance to a body part
      // stays as built while the car drives.
      const anchor = derived.rigs[rest.rigId].groups[0].occurrenceIds[0];
      expect(
        Math.abs(
          distance(straight.transforms[cover], straight.transforms[anchor]) -
            distance(rest.transforms[cover], rest.transforms[anchor]),
        ),
      ).toBeLessThan(1e-3);
      expect(
        distance(rest.transforms[cover], straight.transforms[cover]),
      ).toBeGreaterThan(150);
      // The steering wheel turns once the front wheels steer.
      expect(turned.transforms[wheel].basis).not.toEqual(
        straight.transforms[wheel].basis,
      );
    },
    600000,
  );
});
