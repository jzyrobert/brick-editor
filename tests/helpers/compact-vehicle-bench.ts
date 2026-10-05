import RAPIER from "@dimforge/rapier3d-compat";
import { Mesh, Vector3 } from "three";
import { occurrences } from "../../src/core/document";
import { add, mv } from "../../src/core/math";
import type { Occurrence, Project, Vec3 } from "../../src/core/types";
import {
  AUTO_VEHICLE_LIMITS,
  deriveVehicleRigs,
} from "../../src/play/auto-vehicles";
import { reviewedAxleWheelMounts } from "../../src/play/reviewed-wheel-mounts";
import { occurrenceBounds } from "../../src/play/trains";
import {
  CompactRaycastVehicle,
  clusterHulls,
  compactWheelStations,
  hullMember,
  type HullCluster,
  type HullMember,
} from "../../src/play/compact-vehicle";
import { DYNAMIC_DEFAULTS } from "../../src/play/dynamics";
import { METRES_PER_LDU as S, toPhysics } from "../../src/play/physics-frame";
import { compileOfficialPart } from "./compile-part";

/** Engineering benchmark for docs/reviews/EFFICIENT-VEHICLE-AND-SYSTEMS-PHYSICS.md.
 * Not an ordinary Play path. */
export type MemberGeometry = {
  id: string;
  vertices: Float32Array;
  indices: Uint32Array;
};
const DT = 1 / 60;

/** Each occurrence's compiled source triangles in world LDU. Unique parts are
 * compiled once (as the renderer does) and placed by their source transform. */
export async function memberGeometry(
  project: Project,
  ids: readonly string[],
): Promise<{ members: Map<string, MemberGeometry>; skipped: string[] }> {
  const lookup = new Map(occurrences(project).map((o) => [o.id, o]));
  const members = new Map<string, MemberGeometry>(),
    skipped: string[] = [];
  for (const id of ids) {
    const o = lookup.get(id)!;
    if (o.namespace !== "official" || o.node.kind !== "part") {
      skipped.push(id);
      continue;
    }
    const group = await compileOfficialPart(o.node.ref);
    group.updateMatrixWorld(true);
    const vertices: number[] = [],
      indices: number[] = [];
    const v = new Vector3();
    group.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      const p = object.geometry.getAttribute("position"),
        offset = vertices.length / 3;
      for (let i = 0; i < p.count; i++) {
        v.fromBufferAttribute(p, i).applyMatrix4(object.matrixWorld);
        vertices.push(
          ...add(o.transform.position, mv(o.transform.basis, [v.x, v.y, v.z])),
        );
      }
      const index = object.geometry.index;
      for (let i = 0; i < (index?.count ?? p.count); i++)
        indices.push(offset + (index ? index.getX(i) : i));
    });
    members.set(id, {
      id,
      vertices: Float32Array.from(vertices),
      indices: Uint32Array.from(indices),
    });
  }
  return { members, skipped };
}

/** The reviewed source vehicle: fixed islands, boundaries and tyre stations. */
export function reviewSourceVehicle(
  project: Project,
  per: "assembly" | "tyre" = "assembly",
) {
  const derived = deriveVehicleRigs(project, {
    reserved: new Set(),
    maxRigs: 8,
    maxGroups: 128,
  });
  const assembly = derived.sourceAssemblies?.assemblies[0];
  if (!assembly) throw new Error("No reviewed source vehicle assembly");
  const all = occurrences(project);
  const mounts = reviewedAxleWheelMounts(
    all,
    new Set(),
    occurrenceBounds(project),
    AUTO_VEHICLE_LIMITS,
  );
  const ids = new Set(assembly.occurrenceIds);
  const assemblies = mounts.assemblies.filter((a) => ids.has(a.carrier.id));
  return {
    derived,
    assembly,
    wheelAssemblies: assemblies,
    stations: compactWheelStations(assemblies, per),
    /** Rotating source members the rays stand in for (rims, tyres, pins). */
    rotating: new Set(assemblies.flatMap((a) => a.members.map((m) => m.id))),
    lookup: new Map<string, Occurrence>(all.map((o) => [o.id, o])),
  };
}

export type Representation =
  | "islands-trimesh"
  | "islands-member-hulls"
  | "chassis-member-hulls"
  | "chassis-clustered"
  | "chassis-island-hulls";
export type BenchResult = {
  representation: Representation;
  compound?: boolean;
  groundMesh?: boolean;
  memberMass?: boolean;
  bodies: number;
  colliders: number;
  joints: number;
  rays: number;
  convexChildren: number;
  colliderTriangles: number;
  hullPoints: number;
  setupMs: number;
  /** First step includes broad-phase and contact-graph construction. */
  firstStepMs: number;
  restTicksRun: number;
  stepMs: { mean: number; p95: number; max: number };
  contacts: {
    pairs: number;
    points: number;
    internalPairs: number;
    internalPoints: number;
    deepInternal: number;
    maxInternalDepthLdu: number;
    groundPoints: number;
  };
  maxSpeedLdu: number;
  snapshotBytes: number;
  drive?: {
    forwardLdu: number;
    forwardSpeedLdu: number;
    headingDegrees: number;
    reverseSpeedLdu: number;
    wheelsInContact: number;
    /** Chassis-hull/ground contact points summed over every tick (scraping). */
    chassisGroundContacts: number;
  };
  hulls?: { minFill: number; meanFill: number };
};

function contactsOf(
  world: RAPIER.World,
  vehicle: Set<number>,
  bodyOf: Map<number, number>,
  ground: number,
  deep: number,
) {
  const seen = new Set<string>();
  const out = {
    pairs: 0,
    points: 0,
    internalPairs: 0,
    internalPoints: 0,
    deepInternal: 0,
    maxInternalDepthLdu: 0,
    groundPoints: 0,
  };
  for (const handle of vehicle) {
    const a = world.getCollider(handle);
    world.contactPairsWith(a, (b) => {
      const key =
        a.handle < b.handle
          ? `${a.handle}:${b.handle}`
          : `${b.handle}:${a.handle}`;
      if (seen.has(key)) return;
      seen.add(key);
      const internal =
        vehicle.has(b.handle) && bodyOf.get(a.handle) !== bodyOf.get(b.handle);
      let points = 0;
      world.contactPair(a, b, (manifold) => {
        for (let i = 0; i < manifold.numContacts(); i++) {
          const dist = manifold.contactDist(i);
          if (dist > 0) continue;
          points++;
          if (internal) {
            out.internalPoints++;
            const depth = -dist / S;
            out.maxInternalDepthLdu = Math.max(out.maxInternalDepthLdu, depth);
            if (depth > deep) out.deepInternal++;
          }
          if (b.handle === ground) out.groundPoints++;
        }
      });
      if (!points) return;
      out.pairs++;
      out.points += points;
      if (internal) out.internalPairs++;
    });
  }
  return out;
}
const percentile = (values: number[], p: number) =>
  [...values].sort((a, b) => a - b)[
    Math.min(values.length - 1, Math.floor(values.length * p))
  ];

/**
 * Build one representation in a fresh world with a ground half-space at the
 * lowest source point, rest for `restTicks`, then (single-body variants) drive.
 * Island variants hold every source boundary with a fixed joint: a lower bound
 * on the cost of the real articulated graph, which needs revolute/prismatic
 * joints and motors instead.
 */
export function benchRepresentation(
  review: ReturnType<typeof reviewSourceVehicle>,
  geometry: Map<string, MemberGeometry>,
  representation: Representation,
  options: {
    restTicks?: number;
    driveTicks?: number;
    minFill?: number;
    deepLdu?: number;
    budgetMs?: number;
    /** false: one collider per hull instead of one compound. */
    compound?: boolean;
    /** A two-triangle mesh floor instead of the session half-space. */
    groundMesh?: boolean;
    /** Mass from member hulls, not the merged collision hulls. */
    memberMass?: boolean;
    hullMembers?: Map<string, HullMember>;
  } = {},
): BenchResult {
  const restTicks = options.restTicks ?? 60,
    driveTicks = options.driveTicks ?? 120,
    deepLdu = options.deepLdu ?? 0.5;
  const t0 = performance.now();
  const world = new RAPIER.World({ x: 0, y: -DYNAMIC_DEFAULTS.gravity, z: 0 });
  world.timestep = DT;
  const islands = review.assembly.fixedIslands
    .map((island) => island.filter((id) => geometry.has(id)))
    .filter((island) => island.length);
  let lowest = -Infinity;
  for (const m of geometry.values())
    for (let i = 1; i < m.vertices.length; i += 3)
      lowest = Math.max(lowest, m.vertices[i]);
  for (const w of review.stations)
    lowest = Math.max(lowest, w.center[1] + w.radius);
  // Play's session ground is a half-space; a static world floor is a mesh.
  const half = 20_000 * S;
  const groundCollider = world.createCollider(
    (options.groundMesh
      ? RAPIER.ColliderDesc.trimesh(
          Float32Array.from([
            -half,
            0,
            -half,
            half,
            0,
            -half,
            half,
            0,
            half,
            -half,
            0,
            half,
          ]),
          Uint32Array.from([0, 2, 1, 0, 3, 2]),
        )
      : new RAPIER.ColliderDesc(new RAPIER.HalfSpace({ x: 0, y: 1, z: 0 }))
    )
      .setTranslation(0, -lowest * S, 0)
      .setFriction(DYNAMIC_DEFAULTS.friction),
  );
  const vehicle = new Set<number>(),
    bodyOf = new Map<number, number>(),
    bodies: RAPIER.RigidBody[] = [];
  let joints = 0,
    convexChildren = 0,
    colliderTriangles = 0,
    hullPoints = 0,
    compact: CompactRaycastVehicle | undefined,
    clusters: HullCluster[] | undefined;
  const hullFor = (id: string, island: number) => {
    const cached = options.hullMembers?.get(id);
    if (cached) return { ...cached, island };
    const h = hullMember(id, island, geometry.get(id)!.vertices);
    options.hullMembers?.set(id, h);
    return h;
  };
  if (representation.startsWith("islands-")) {
    const islandOf = new Map<string, number>();
    islands.forEach((island, index) => {
      island.forEach((id) => islandOf.set(id, index));
      const points = island.flatMap((id) => {
        const v = geometry.get(id)!.vertices;
        return [v[0], v[1], v[2]];
      });
      const centre: Vec3 = [0, 1, 2].map(
        (k) =>
          points.filter((_, i) => i % 3 === k).reduce((a, b) => a + b) /
          (points.length / 3),
      ) as Vec3;
      const start = toPhysics(centre);
      const body = world.createRigidBody(
        RAPIER.RigidBodyDesc.dynamic()
          .setTranslation(start.x, start.y, start.z)
          .setCcdEnabled(true),
      );
      bodies.push(body);
      for (const id of island) {
        const g = geometry.get(id)!;
        let desc: RAPIER.ColliderDesc | null;
        if (representation === "islands-trimesh") {
          const local = new Float32Array(g.vertices.length);
          for (let i = 0; i < g.vertices.length; i += 3) {
            const q = toPhysics([
              g.vertices[i] - centre[0],
              g.vertices[i + 1] - centre[1],
              g.vertices[i + 2] - centre[2],
            ]);
            local.set([q.x, q.y, q.z], i);
          }
          if (!g.indices.length) continue;
          desc = RAPIER.ColliderDesc.trimesh(local, g.indices.slice());
          desc.setDensity(0);
          colliderTriangles += g.indices.length / 3;
        } else {
          const h = hullFor(id, index);
          const local = new Float32Array(h.points.length * 3);
          h.points.forEach((p, i) => {
            const q = toPhysics([
              p[0] - centre[0],
              p[1] - centre[1],
              p[2] - centre[2],
            ]);
            local.set([q.x, q.y, q.z], i * 3);
          });
          desc = RAPIER.ColliderDesc.convexHull(local);
          desc?.setDensity(DYNAMIC_DEFAULTS.density);
          convexChildren++;
          hullPoints += h.points.length;
        }
        if (!desc) continue;
        const c = world.createCollider(
          desc.setFriction(DYNAMIC_DEFAULTS.friction),
          body,
        );
        vehicle.add(c.handle);
        bodyOf.set(c.handle, body.handle);
      }
      if (representation === "islands-trimesh") {
        // Open source triangle shells have no reliable volume: give each body
        // the same bounding-box mass the hull variant would roughly have.
        const b = bounds(island.map((id) => geometry.get(id)!.vertices));
        const size = b.max.map((v, k) => (v - b.min[k]) * S);
        const mass = Math.max(
          0.05,
          DYNAMIC_DEFAULTS.density * size[0] * size[1] * size[2] * 0.3,
        );
        body.setAdditionalMassProperties(
          mass,
          { x: 0, y: 0, z: 0 },
          {
            x: (mass * (size[1] ** 2 + size[2] ** 2)) / 12 + 1e-6,
            y: (mass * (size[0] ** 2 + size[2] ** 2)) / 12 + 1e-6,
            z: (mass * (size[0] ** 2 + size[1] ** 2)) / 12 + 1e-6,
          },
          { x: 0, y: 0, z: 0, w: 1 },
          true,
        );
      }
    });
    const pairs = new Set<string>();
    for (const edge of review.assembly.boundaries) {
      const a = islandOf.get(edge.a),
        b = islandOf.get(edge.b);
      if (a === undefined || b === undefined || a === b) continue;
      const key = a < b ? `${a}:${b}` : `${b}:${a}`;
      if (pairs.has(key)) continue;
      pairs.add(key);
      const ba = bodies[a],
        bb = bodies[b],
        pa = ba.translation(),
        pb = bb.translation(),
        anchor = edge.pivot
          ? toPhysics(edge.pivot)
          : {
              x: (pa.x + pb.x) / 2,
              y: (pa.y + pb.y) / 2,
              z: (pa.z + pb.z) / 2,
            };
      const identity = { x: 0, y: 0, z: 0, w: 1 };
      world.createImpulseJoint(
        RAPIER.JointData.fixed(
          { x: anchor.x - pa.x, y: anchor.y - pa.y, z: anchor.z - pa.z },
          identity,
          { x: anchor.x - pb.x, y: anchor.y - pb.y, z: anchor.z - pb.z },
          identity,
        ),
        ba,
        bb,
        true,
      );
      joints++;
    }
  } else {
    const chassisIds = review.assembly.occurrenceIds.filter(
      (id) => geometry.has(id) && !review.rotating.has(id),
    );
    const islandIndex = new Map<string, number>();
    review.assembly.fixedIslands.forEach((island, i) =>
      island.forEach((id) => islandIndex.set(id, i)),
    );
    const members = chassisIds.map((id) => hullFor(id, islandIndex.get(id)!));
    clusters = clusterHulls(
      members,
      representation === "chassis-member-hulls"
        ? { minFill: 2, scope: "island" }
        : representation === "chassis-island-hulls"
          ? { minFill: 0, scope: "island" }
          : { minFill: options.minFill ?? 0.5, scope: "chassis" },
    );
    compact = new CompactRaycastVehicle(world, {
      hulls: clusters,
      wheels: review.stations,
      forward: [0, 0, -1],
      compound: options.compound ?? true,
      ...(options.memberMass ? { memberMass: members } : {}),
    });
    bodies.push(compact.body);
    for (const c of compact.colliders) {
      vehicle.add(c.handle);
      bodyOf.set(c.handle, compact.body.handle);
    }
    convexChildren = clusters.length;
    hullPoints = clusters.reduce((n, c) => n + c.points.length, 0);
  }
  const setupMs = performance.now() - t0;
  const steps: number[] = [];
  let maxSpeed = 0;
  const tick = () => {
    const s = performance.now();
    compact?.beforeStep(DT);
    world.step();
    steps.push(performance.now() - s);
    for (const b of bodies) {
      const v = b.linvel();
      maxSpeed = Math.max(maxSpeed, Math.hypot(v.x, v.y, v.z) / S);
    }
    if (compact)
      world.contactPair(compact.colliders[0], groundCollider, (m) => {
        for (let i = 0; i < m.numContacts(); i++)
          if (m.contactDist(i) <= 0) chassisGroundTicks++;
      });
  };
  let chassisGroundTicks = 0;
  tick();
  const firstStepMs = steps.pop()!;
  const budget = performance.now() + (options.budgetMs ?? 120_000);
  for (let i = 1; i < restTicks && performance.now() < budget; i++) tick();
  const restTicksRun = steps.length + 1;
  const contacts = contactsOf(
    world,
    vehicle,
    bodyOf,
    groundCollider.handle,
    deepLdu,
  );
  let drive: BenchResult["drive"];
  if (compact && driveTicks) {
    const rest = compact.report();
    compact.setInput(1, 0);
    for (let i = 0; i < driveTicks; i++) tick();
    const driven = compact.report();
    compact.setInput(1, 1);
    for (let i = 0; i < driveTicks; i++) tick();
    const turned = compact.report();
    compact.setInput(-1, 0);
    for (let i = 0; i < driveTicks * 2; i++) tick();
    const reversed = compact.report();
    const along = (a: Vec3, b: Vec3) =>
      Math.hypot(b[0] - a[0], b[2] - a[2]) * Math.sign(a[2] - b[2] || 1);
    drive = {
      forwardLdu: along(rest.position, driven.position),
      forwardSpeedLdu: driven.speed,
      headingDegrees: turned.headingDegrees,
      reverseSpeedLdu: reversed.speed,
      wheelsInContact: driven.wheels.filter((w) => w.contact).length,
      chassisGroundContacts: chassisGroundTicks,
    };
  }
  const snapshotBytes = world.takeSnapshot().byteLength;
  const result: BenchResult = {
    representation,
    groundMesh: !!options.groundMesh,
    memberMass: !!options.memberMass,
    compound: representation.startsWith("chassis-")
      ? (options.compound ?? true)
      : undefined,
    bodies: bodies.length,
    colliders: vehicle.size,
    joints,
    rays: compact ? review.stations.length : 0,
    convexChildren,
    colliderTriangles,
    hullPoints,
    setupMs,
    firstStepMs,
    restTicksRun,
    stepMs: {
      mean: steps.reduce((a, b) => a + b, 0) / steps.length,
      p95: percentile(steps, 0.95),
      max: Math.max(...steps),
    },
    contacts,
    maxSpeedLdu: maxSpeed,
    snapshotBytes,
    ...(drive ? { drive } : {}),
    ...(clusters
      ? {
          hulls: {
            minFill: Math.min(...clusters.map((c) => c.fill)),
            meanFill:
              clusters.reduce((n, c) => n + c.fill, 0) / clusters.length,
          },
        }
      : {}),
  };
  world.free();
  return result;
}
function bounds(meshes: Float32Array[]) {
  const min: Vec3 = [Infinity, Infinity, Infinity],
    max: Vec3 = [-Infinity, -Infinity, -Infinity];
  for (const v of meshes)
    for (let i = 0; i < v.length; i += 3)
      for (let k = 0; k < 3; k++) {
        min[k] = Math.min(min[k], v[i + k]);
        max[k] = Math.max(max[k], v[i + k]);
      }
  return { min, max };
}
