import { readFileSync } from "node:fs";
import RAPIER from "@dimforge/rapier3d-compat";
import { beforeAll, describe, expect, it } from "vitest";
import { registerFullLibraryFromDisk } from "../../scripts/full-library-node";
import { occurrences } from "../../src/core/document";
import type { Project } from "../../src/core/types";
import { exportLDraw, importLDraw } from "../../src/ldraw/io";
import { partsList } from "../../src/inventory/parts-list";
import {
  CompactRaycastVehicle,
  clusterHulls,
  compactWheelStations,
  hullMember,
  type HullMember,
} from "../../src/play/compact-vehicle";
import { DYNAMIC_DEFAULTS } from "../../src/play/dynamics";
import { METRES_PER_LDU as S, toPhysics } from "../../src/play/physics-frame";
import {
  benchRepresentation,
  memberGeometry,
  reviewSourceVehicle,
  type MemberGeometry,
} from "../helpers/compact-vehicle-bench";

// EXPERIMENTAL compact vehicle (docs/reviews/EFFICIENT-VEHICLE-AND-SYSTEMS-PHYSICS.md):
// measured against the committed 5540 carrier-graph excerpt. Nothing here is
// admitted to ordinary Play.
let project: Project,
  review: ReturnType<typeof reviewSourceVehicle>,
  geometry: Map<string, MemberGeometry>,
  members: HullMember[];
const hulls = new Map<string, HullMember>();
beforeAll(async () => {
  expect(registerFullLibraryFromDisk()).toBe(true);
  await RAPIER.init();
  project = importLDraw(
    readFileSync("fixtures/play/official-cars/5540-carrier-graph.ldr", "utf8"),
  );
  review = reviewSourceVehicle(project);
  geometry = (await memberGeometry(project, review.assembly.occurrenceIds))
    .members;
  const island = new Map<string, number>();
  review.assembly.fixedIslands.forEach((ids, i) =>
    ids.forEach((id) => island.set(id, i)),
  );
  members = review.assembly.occurrenceIds
    .filter((id) => !review.rotating.has(id))
    .map((id) => hullMember(id, island.get(id)!, geometry.get(id)!.vertices));
  for (const m of members) hulls.set(m.id, m);
}, 60000);

describe("experimental compact source vehicle", () => {
  it("derives wheel rays from the reviewed 5540 mounts, not from an invented layout", () => {
    expect(review.assembly.fixedIslands).toHaveLength(52);
    expect(review.wheelAssemblies).toHaveLength(4);
    const perAssembly = review.stations,
      perTyre = compactWheelStations(review.wheelAssemblies, "tyre");
    expect(perAssembly).toHaveLength(4);
    expect(perTyre).toHaveLength(10);
    for (const w of [...perAssembly, ...perTyre]) {
      expect(w.radius).toBe(54.005);
      expect(w.axis.map(Math.abs)).toEqual([1, 0, 0]);
      expect(w.center[1]).toBe(-54);
    }
    expect(
      perAssembly.filter((w) => w.steering).map((w) => w.center[2]),
    ).toEqual([-200, -200]);
    expect(
      perAssembly.filter((w) => !w.steering).map((w) => w.center[2]),
    ).toEqual([230, 230]);
    // The rays stand in for the 32 rotating source members (20 rims/tyres
    // and 12 joining pins); every other attached member keeps a hull.
    expect(review.rotating.size).toBe(32);
    expect(members).toHaveLength(84 - 32);
  });

  it("decomposes source members into conservative hulls at bounded counts", () => {
    const perMember = clusterHulls(members, { minFill: 2, scope: "island" }),
      perIsland = clusterHulls(members, { minFill: 0, scope: "island" }),
      clustered = clusterHulls(members, { minFill: 0.5, scope: "chassis" }),
      single = clusterHulls(members, { minFill: 0, scope: "chassis" });
    expect(perMember).toHaveLength(members.length);
    expect(perIsland).toHaveLength(new Set(members.map((m) => m.island)).size);
    expect(single).toHaveLength(1);
    expect(clustered.length).toBeGreaterThan(1);
    expect(clustered.length).toBeLessThan(members.length);
    for (const c of clustered) {
      if (c.memberIds.length > 1) expect(c.fill).toBeGreaterThanOrEqual(0.5);
      expect(c.points.length).toBeLessThanOrEqual(64);
    }
    // Every member belongs to exactly one child, and no child cuts a member.
    for (const set of [perMember, perIsland, clustered, single])
      expect(set.flatMap((c) => c.memberIds).sort()).toEqual(
        members.map((m) => m.id).sort(),
      );
    // A single hull fills the open frame: it is the coarsest, most void-filling choice.
    expect(single[0].fill).toBeLessThan(0.5);
  });

  it("drives, steers and reverses as one body with no internal contact pairs", () => {
    const before = JSON.stringify(project),
      exported = exportLDraw(project),
      inventory = partsList(project, occurrences(project));
    for (const representation of [
      "chassis-member-hulls",
      "chassis-clustered",
      "chassis-island-hulls",
    ] as const) {
      const r = benchRepresentation(review, geometry, representation, {
        hullMembers: hulls,
      });
      expect(r.bodies).toBe(1);
      expect(r.colliders).toBe(1);
      expect(r.joints).toBe(0);
      expect(r.rays).toBe(4);
      expect(r.contacts.internalPairs).toBe(0);
      expect(r.contacts.deepInternal).toBe(0);
      expect(r.drive!.wheelsInContact).toBe(4);
      expect(r.drive!.forwardLdu).toBeGreaterThan(150);
      expect(r.drive!.forwardSpeedLdu).toBeGreaterThan(100);
      expect(r.drive!.forwardSpeedLdu).toBeLessThan(170);
      expect(Math.abs(r.drive!.headingDegrees)).toBeGreaterThan(10);
      expect(r.drive!.reverseSpeedLdu).toBeLessThan(-100);
      expect(r.maxSpeedLdu).toBeLessThan(200);
      // Member-granular hulls keep the source ground clearance; the coarse
      // per-island hull (fill 0.33) may scrape under pitch, so it is not asserted.
      if (representation !== "chassis-island-hulls")
        expect(r.drive!.chassisGroundContacts).toBe(0);
    }
    expect(JSON.stringify(project)).toBe(before);
    expect(exportLDraw(project)).toBe(exported);
    expect(partsList(project, occurrences(project))).toEqual(inventory);
  }, 60000);

  it("measures the false deep contacts of one native body per fixed island", () => {
    const hullsIslands = benchRepresentation(
      review,
      geometry,
      "islands-member-hulls",
      { hullMembers: hulls, restTicks: 30 },
    );
    expect(hullsIslands.bodies).toBe(52);
    expect(hullsIslands.joints).toBeGreaterThan(50);
    expect(hullsIslands.contacts.internalPairs).toBeGreaterThan(50);
    expect(hullsIslands.contacts.deepInternal).toBeGreaterThan(100);
    expect(hullsIslands.contacts.maxInternalDepthLdu).toBeGreaterThan(10);
    // The source triangles themselves: three ticks are enough to show cost.
    const triangles = benchRepresentation(review, geometry, "islands-trimesh", {
      restTicks: 3,
    });
    expect(triangles.colliderTriangles).toBeGreaterThan(100_000);
    expect(triangles.contacts.internalPoints).toBeGreaterThan(10_000);
    expect(triangles.contacts.deepInternal).toBeGreaterThan(1_000);
  }, 120000);

  it("still collides with foreign geometry: a wall stops the chassis", () => {
    const world = new RAPIER.World({
      x: 0,
      y: -DYNAMIC_DEFAULTS.gravity,
      z: 0,
    });
    world.timestep = 1 / 60;
    world.createCollider(
      new RAPIER.ColliderDesc(new RAPIER.HalfSpace({ x: 0, y: 1, z: 0 })),
    );
    // A 40 LDU-high kerb wall 100 LDU ahead of the front tyres, across the car.
    const wallZ = -200 - 54 - 100,
      centre = toPhysics([0, -20, wallZ - 10]);
    const wall = world.createCollider(
      RAPIER.ColliderDesc.cuboid(400 * S, 20 * S, 10 * S).setTranslation(
        centre.x,
        centre.y,
        centre.z,
      ),
    );
    const vehicle = new CompactRaycastVehicle(world, {
      hulls: clusterHulls(members, { minFill: 0.5, scope: "chassis" }),
      wheels: review.stations,
      forward: [0, 0, -1],
    });
    vehicle.setInput(1, 0);
    let touched = 0,
      deepest = 0;
    for (let i = 0; i < 240; i++) {
      vehicle.beforeStep(1 / 60);
      world.step();
      world.contactPair(vehicle.colliders[0], wall, (m) => {
        for (let k = 0; k < m.numContacts(); k++) {
          const d = m.contactDist(k);
          if (d <= 0) {
            touched++;
            deepest = Math.max(deepest, -d / S);
          }
        }
      });
    }
    const r = vehicle.report();
    expect(touched).toBeGreaterThan(0);
    expect(deepest).toBeLessThan(3);
    expect(Math.abs(r.speed)).toBeLessThan(20);
    // The front of the source chassis stays behind the wall's face.
    expect(r.displacement[2]).toBeGreaterThan(-120);
    world.free();
  });
});
