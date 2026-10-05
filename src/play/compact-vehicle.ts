import RAPIER from "@dimforge/rapier3d-compat";
import { Vector3 } from "three";
import { ConvexGeometry } from "three/examples/jsm/geometries/ConvexGeometry.js";
import { ensure, type Vec3 } from "../core/types";
import type { ReviewedAxleWheelAssembly } from "./reviewed-wheel-mounts";
import { DYNAMIC_DEFAULTS } from "./dynamics";
import {
  METRES_PER_LDU as S,
  fromPhysics,
  toPhysics,
  toPhysicsDirection,
} from "./physics-frame";

/**
 * EXPERIMENTAL — not admitted to ordinary Play.
 *
 * A compact driven-vehicle representation: one chassis rigid body whose
 * collision is a bounded set of convex hulls, on Rapier's ray-cast wheel
 * controller with one ray per reviewed source tyre. It exists to measure how
 * much smaller and cheaper a source vehicle can be than one native body per
 * source fixed island, and to show which parts of that model are source
 * positive (wheel stations, radii, axle and steering evidence) and which are
 * approximations (rest-locked hinges and bearings, filled holes inside hulls,
 * spring suspension the source does not have). See
 * docs/reviews/EFFICIENT-VEHICLE-AND-SYSTEMS-PHYSICS.md.
 */
export const COMPACT_VEHICLE_LIMITS = Object.freeze({
  members: 600,
  hulls: 512,
  hullPoints: 64,
  wheels: 16,
  splitWork: 4_096,
  /** Occupancy samples per candidate hull. */
  fillSamples: 2_048,
  fillWork: 200_000_000,
});

type Plane = [number, number, number, number];
type Hull = {
  points: Vec3[];
  planes: Plane[];
  volume: number;
  min: Vec3;
  max: Vec3;
};
export type HullMember = Hull & {
  id: string;
  /** Index of the actual source fixed island that owns this member. */
  island: number;
  centroid: Vec3;
};
export type HullCluster = {
  memberIds: string[];
  islands: number[];
  /** Convex hull points, world LDU, at most COMPACT_VEHICLE_LIMITS.hullPoints. */
  points: Vec3[];
  volume: number;
  /** Sampled share of the hull occupied by the union of its member hulls:
   * 1 adds no empty space; low values fill cockpits, bays and gaps. */
  fill: number;
};

function boundsOf(points: readonly Vec3[]) {
  const min: Vec3 = [Infinity, Infinity, Infinity],
    max: Vec3 = [-Infinity, -Infinity, -Infinity];
  for (const p of points)
    for (let k = 0; k < 3; k++) {
      min[k] = Math.min(min[k], p[k]);
      max[k] = Math.max(max[k], p[k]);
    }
  return { min, max };
}
function boxHull(min: Vec3, max: Vec3): Hull {
  const points = Array.from(
    { length: 8 },
    (_, n) => [0, 1, 2].map((k) => (n & (1 << k) ? max[k] : min[k])) as Vec3,
  );
  const planes: Plane[] = [];
  for (let k = 0; k < 3; k++) {
    const n: Vec3 = [0, 0, 0];
    n[k] = 1;
    planes.push([...n, max[k]] as Plane);
    n[k] = -1;
    planes.push([...n, -min[k]] as Plane);
  }
  const size = max.map((v, k) => v - min[k]);
  return { points, planes, volume: size[0] * size[1] * size[2], min, max };
}
function hullOf(points: readonly Vec3[]): Hull {
  const unique = [
    ...new Map(
      points.map((p) => [p.map((n) => n.toFixed(4)).join(","), p]),
    ).values(),
  ];
  const box = boundsOf(unique);
  // Flat members keep the existing thin-envelope behaviour: ±0.5 LDU.
  if (
    unique.length < 4 ||
    [0, 1, 2].some((k) => box.max[k] - box.min[k] < 1e-6)
  ) {
    for (const k of [0, 1, 2])
      if (box.max[k] - box.min[k] < 1e-6) {
        box.min[k] -= 0.5;
        box.max[k] += 0.5;
      }
    return boxHull(box.min, box.max);
  }
  const geometry = new ConvexGeometry(unique.map((p) => new Vector3(...p)));
  const position = geometry.getAttribute("position");
  const extremes = new Map<string, Vec3>(),
    planes = new Map<string, Plane>();
  let volume = 0;
  const a = new Vector3(),
    b = new Vector3(),
    c = new Vector3(),
    n = new Vector3();
  for (let i = 0; i < position.count; i += 3) {
    a.fromBufferAttribute(position, i);
    b.fromBufferAttribute(position, i + 1);
    c.fromBufferAttribute(position, i + 2);
    volume += a.dot(b.clone().cross(c)) / 6;
    n.subVectors(b, a).cross(c.clone().sub(a));
    if (n.lengthSq() > 1e-12) {
      n.normalize();
      const plane: Plane = [n.x, n.y, n.z, n.dot(a)];
      planes.set(plane.map((v) => v.toFixed(3)).join(","), plane);
    }
    for (const v of [a, b, c])
      extremes.set(v.toArray().join(","), v.toArray() as Vec3);
  }
  geometry.dispose();
  const hullPoints = [...extremes.values()],
    bounds = boundsOf(hullPoints);
  return {
    points: hullPoints,
    planes: [...planes.values()],
    volume: Math.abs(volume),
    ...bounds,
  };
}
const inside = (h: Hull, p: Vec3, eps = 1e-6) =>
  p.every((v, k) => v >= h.min[k] - eps && v <= h.max[k] + eps) &&
  h.planes.every(([x, y, z, d]) => x * p[0] + y * p[1] + z * p[2] <= d + eps);
/** Keep the 26 directional extremes, then a stride: a subset of hull points can
 * only shrink, never inflate, the hull (the existing proxyPoints rule). */
function reduce(points: Vec3[], limit: number) {
  if (points.length <= limit) return points;
  const picked = new Set<number>();
  for (const dx of [-1, 0, 1])
    for (const dy of [-1, 0, 1])
      for (const dz of [-1, 0, 1]) {
        if (!dx && !dy && !dz) continue;
        let best = 0,
          score = -Infinity;
        points.forEach((p, i) => {
          const s = p[0] * dx + p[1] * dy + p[2] * dz;
          if (s > score) {
            score = s;
            best = i;
          }
        });
        picked.add(best);
      }
  const stride = points.length / Math.max(1, limit - picked.size);
  for (let k = 0; picked.size < limit && k * stride < points.length; k++)
    picked.add(Math.floor(k * stride));
  return [...picked].sort((x, y) => x - y).map((i) => points[i]);
}

/** One member's convex hull from its compiled world vertices (LDU). */
export function hullMember(
  id: string,
  island: number,
  vertices: ArrayLike<number>,
): HullMember {
  ensure(
    vertices.length % 3 === 0 && vertices.length >= 3,
    "INVALID_INPUT",
    "A hull member needs compiled vertices",
  );
  const points: Vec3[] = [];
  for (let i = 0; i < vertices.length; i += 3)
    points.push([vertices[i], vertices[i + 1], vertices[i + 2]]);
  const hull = hullOf(points);
  return {
    ...hull,
    id,
    island,
    centroid: hull.min.map((v, k) => (v + hull.max[k]) / 2) as Vec3,
  };
}

/**
 * Approximate convex decomposition over source members (a bounded,
 * member-granular relative of V-HACD). Each seed set (one per fixed island,
 * or the whole chassis) becomes one hull when the union of its member hulls
 * occupies at least `minFill` of that hull, measured on a regular sample
 * grid; otherwise it splits at the median member centroid along its longest
 * axis. `minFill: 0` gives one hull per seed, `minFill > 1` one hull per
 * member. Members are never cut, so every child contains complete member
 * hulls and no source surface moves inward; hulls only add filled space.
 */
export function clusterHulls(
  members: readonly HullMember[],
  options: { minFill: number; scope: "island" | "chassis" },
): HullCluster[] {
  ensure(
    members.length <= COMPACT_VEHICLE_LIMITS.members,
    "LIMIT_EXCEEDED",
    "Too many members for a compact vehicle",
  );
  const seeds =
    options.scope === "chassis"
      ? [members.slice()]
      : [
          ...members
            .reduce((m, member) => {
              const list = m.get(member.island) ?? [];
              list.push(member);
              return m.set(member.island, list);
            }, new Map<number, HullMember[]>())
            .values(),
        ];
  const out: HullCluster[] = [];
  let work = 0,
    fillWork = 0;
  const occupancy = (hull: Hull, set: readonly HullMember[]) => {
    const size = hull.max.map((v, k) => v - hull.min[k]),
      step = Math.cbrt(
        (size[0] * size[1] * size[2]) / COMPACT_VEHICLE_LIMITS.fillSamples,
      );
    if (!(step > 0)) return 1;
    const n = size.map((s) => Math.max(1, Math.round(s / step))) as Vec3,
      at = (axis: number, i: number) =>
        hull.min[axis] + ((i + 0.5) * size[axis]) / n[axis],
      index = (i: number, j: number, k: number) => (i * n[1] + j) * n[2] + k,
      state = new Uint8Array(n[0] * n[1] * n[2]);
    let total = 0,
      occupied = 0;
    for (let i = 0; i < n[0]; i++)
      for (let j = 0; j < n[1]; j++)
        for (let k = 0; k < n[2]; k++) {
          fillWork += hull.planes.length;
          if (inside(hull, [at(0, i), at(1, j), at(2, k)])) {
            state[index(i, j, k)] = 1;
            total++;
          }
        }
    const range = (axis: number, lo: number, hi: number) => [
      Math.max(
        0,
        Math.ceil(((lo - hull.min[axis]) * n[axis]) / size[axis] - 0.5),
      ),
      Math.min(
        n[axis] - 1,
        Math.floor(((hi - hull.min[axis]) * n[axis]) / size[axis] - 0.5),
      ),
    ];
    for (const m of set) {
      const [i0, i1] = range(0, m.min[0] - 0.5, m.max[0] + 0.5),
        [j0, j1] = range(1, m.min[1] - 0.5, m.max[1] + 0.5),
        [k0, k1] = range(2, m.min[2] - 0.5, m.max[2] + 0.5);
      for (let i = i0; i <= i1; i++)
        for (let j = j0; j <= j1; j++)
          for (let k = k0; k <= k1; k++) {
            const s = index(i, j, k);
            if (state[s] !== 1) continue;
            fillWork += m.planes.length;
            if (inside(m, [at(0, i), at(1, j), at(2, k)], 0.5)) {
              state[s] = 2;
              occupied++;
            }
          }
    }
    ensure(
      fillWork <= COMPACT_VEHICLE_LIMITS.fillWork,
      "LIMIT_EXCEEDED",
      "Compact hull occupancy work exhausted",
    );
    return total ? occupied / total : 1;
  };
  const visit = (set: HullMember[]) => {
    ensure(
      ++work <= COMPACT_VEHICLE_LIMITS.splitWork,
      "LIMIT_EXCEEDED",
      "Compact hull decomposition work exhausted",
    );
    const hull =
      set.length === 1 ? set[0] : hullOf(set.flatMap((m) => m.points));
    const fill =
      set.length === 1 || options.minFill <= 0 || options.minFill > 1
        ? set.length === 1
          ? 1
          : NaN
        : occupancy(hull, set);
    if (
      set.length === 1 ||
      options.minFill <= 0 ||
      (options.minFill <= 1 && fill >= options.minFill)
    ) {
      out.push({
        memberIds: set.map((m) => m.id).sort(),
        islands: [...new Set(set.map((m) => m.island))].sort((a, b) => a - b),
        points: reduce(hull.points, COMPACT_VEHICLE_LIMITS.hullPoints),
        volume: hull.volume,
        fill: Number.isNaN(fill) ? occupancy(hull, set) : fill,
      });
      return;
    }
    const b = boundsOf(set.map((m) => m.centroid)),
      axis = [0, 1, 2].reduce((best, k) =>
        b.max[k] - b.min[k] > b.max[best] - b.min[best] ? k : best,
      ),
      sorted = [...set].sort(
        (x, y) => x.centroid[axis] - y.centroid[axis] || (x.id < y.id ? -1 : 1),
      ),
      half = Math.floor(sorted.length / 2);
    visit(sorted.slice(0, half));
    visit(sorted.slice(half));
  };
  for (const seed of seeds) if (seed.length) visit(seed);
  ensure(
    out.length <= COMPACT_VEHICLE_LIMITS.hulls,
    "LIMIT_EXCEEDED",
    "Compact vehicle needs more convex hulls than its limit",
  );
  return out;
}

export type CompactWheelStation = {
  /** Source tyre occurrence id(s), joined with "+" for a coaxial stack. */
  id: string;
  rimIds: string[];
  /** Reviewed tyre centre and compiled radial envelope, LDU. */
  center: Vec3;
  radius: number;
  axis: Vec3;
  steering: boolean;
  assembly: number;
};
/** Wheel rays from the reviewed mounts: centre, reviewed radius, bearing axis
 * and steering-pivot evidence all come from source. `per: "assembly"` gives
 * the existing controller's one ray per rotating group, centred across its
 * coaxial stack; `per: "tyre"` gives one ray per physical tyre. */
export function compactWheelStations(
  assemblies: readonly ReviewedAxleWheelAssembly[],
  per: "assembly" | "tyre" = "assembly",
): CompactWheelStation[] {
  const out = assemblies.flatMap((a, assembly) =>
    per === "tyre"
      ? a.instances.map((i) => ({
          id: i.tyre.id,
          rimIds: [i.rim.id],
          center: [...i.center] as Vec3,
          radius: i.radius,
          axis: [...a.axis] as Vec3,
          steering: a.steering,
          assembly,
        }))
      : [
          {
            id: a.instances.map((i) => i.tyre.id).join("+"),
            rimIds: a.instances.map((i) => i.rim.id),
            center: [...a.center] as Vec3,
            radius: a.radius,
            axis: [...a.axis] as Vec3,
            steering: a.steering,
            assembly,
          },
        ],
  );
  ensure(
    out.length >= 3 && out.length <= COMPACT_VEHICLE_LIMITS.wheels,
    "INVALID_INPUT",
    "A compact vehicle needs between 3 and 16 reviewed wheel rays",
  );
  return out;
}

export type CompactVehicleOptions = {
  hulls: readonly { points: readonly Vec3[] }[];
  wheels: readonly CompactWheelStation[];
  /** Source chassis forward, LDU direction. */
  forward: Vec3;
  /** One compound collider (default) or one collider per hull. */
  compound?: boolean;
  /** Collision membership bit for the chassis; rays skip it. */
  membership?: number;
  massKg?: number;
  maxSpeedLdu?: number;
  maxSteerDegrees?: number;
};
const bit = (n: number) => 1 << n;
const groups = (membership: number, filter: number) =>
  ((membership & 0xffff) << 16) | (filter & 0xffff);
/** One rigid chassis on per-tyre rays. All colliders share one body, so the
 * chassis has no internal contact pairs at all. */
export class CompactRaycastVehicle {
  readonly body: RAPIER.RigidBody;
  readonly colliders: RAPIER.Collider[] = [];
  readonly controller: RAPIER.DynamicRayCastVehicleController;
  readonly origin: Vec3;
  private forward: { x: number; y: number; z: number };
  private engineForce: number;
  private brake: number;
  private maxSpeed: number;
  private maxSteer: number;
  private throttle = 0;
  private steering = 0;
  private own: number;
  constructor(
    private world: RAPIER.World,
    readonly options: CompactVehicleOptions,
  ) {
    ensure(
      options.hulls.length >= 1 &&
        options.hulls.length <= COMPACT_VEHICLE_LIMITS.hulls,
      "LIMIT_EXCEEDED",
      "A compact chassis needs 1–256 convex hulls",
    );
    const all = options.hulls.flatMap((h) => h.points as Vec3[]);
    const b = boundsOf(all);
    this.origin = b.min.map((v, k) => (v + b.max[k]) / 2) as Vec3;
    const start = toPhysics(this.origin);
    this.own = bit(options.membership ?? 2);
    this.body = world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(start.x, start.y, start.z)
        .setLinearDamping(0.05)
        .setAngularDamping(0.1)
        .setCcdEnabled(true),
    );
    const descs = options.hulls.map((hull) => {
      const local = new Float32Array(hull.points.length * 3);
      hull.points.forEach((p, i) => {
        const q = toPhysics([
          p[0] - this.origin[0],
          p[1] - this.origin[1],
          p[2] - this.origin[2],
        ]);
        local.set([q.x, q.y, q.z], i * 3);
      });
      const desc = RAPIER.ColliderDesc.convexHull(local);
      ensure(desc, "INVALID_INPUT", "A compact hull is degenerate");
      return desc;
    });
    // One compound collider is one broad-phase proxy with an internal BVH;
    // separate colliders each pair with every nearby (or infinite) proxy.
    const finals =
      options.compound === false || descs.length === 1
        ? descs
        : [
            new RAPIER.ColliderDesc(
              new RAPIER.Compound(
                descs.map((d) => d.shape),
                descs.map(() => ({ x: 0, y: 0, z: 0 })),
                descs.map(() => ({ x: 0, y: 0, z: 0, w: 1 })),
              ),
            ),
          ];
    for (const desc of finals)
      this.colliders.push(
        world.createCollider(
          desc
            .setDensity(DYNAMIC_DEFAULTS.density)
            .setFriction(DYNAMIC_DEFAULTS.friction)
            .setCollisionGroups(groups(this.own, 0xffff)),
          this.body,
        ),
      );
    if (options.massKg !== undefined) {
      this.body.recomputeMassPropertiesFromColliders();
      const scale = options.massKg / this.body.mass();
      for (const c of this.colliders)
        c.setDensity(DYNAMIC_DEFAULTS.density * scale);
    }
    this.body.recomputeMassPropertiesFromColliders();
    const controller = world.createVehicleController(this.body);
    controller.indexUpAxis = 1;
    (
      controller as unknown as { setIndexForwardAxis: number }
    ).setIndexForwardAxis = 2;
    const f = toPhysicsDirection(options.forward),
      length = Math.hypot(f.x, f.y, f.z);
    this.forward = { x: f.x / length, y: f.y / length, z: f.z / length };
    const suspension = DYNAMIC_DEFAULTS.suspension,
      rest = suspension.restLength * S;
    options.wheels.forEach((w, index) => {
      const local = toPhysics(
        w.center.map((c, k) => c - this.origin[k]) as Vec3,
      );
      let axle = toPhysicsDirection(w.axis);
      const drive = { x: axle.z, y: 0, z: -axle.x }; // up × axle, up = +Y
      if (drive.x * this.forward.x + drive.z * this.forward.z < 0)
        axle = { x: -axle.x, y: -axle.y, z: -axle.z };
      controller.addWheel(
        { x: local.x, y: local.y + rest, z: local.z },
        { x: 0, y: -1, z: 0 },
        axle,
        rest,
        w.radius * S,
      );
      controller.setWheelMaxSuspensionTravel(index, suspension.travel * S);
      controller.setWheelSuspensionStiffness(index, suspension.stiffness);
      controller.setWheelSuspensionCompression(index, suspension.damping);
      controller.setWheelSuspensionRelaxation(index, suspension.damping * 1.2);
      controller.setWheelMaxSuspensionForce(index, 100000);
      controller.setWheelFrictionSlip(index, 2);
    });
    this.controller = controller;
    const mass = this.body.mass();
    this.engineForce = mass * DYNAMIC_DEFAULTS.engineAccel;
    this.brake = Math.max(1, mass * 0.1);
    this.maxSpeed = (options.maxSpeedLdu ?? 160) * S;
    this.maxSteer = ((options.maxSteerDegrees ?? 30) * Math.PI) / 180;
  }
  setInput(throttle: number, steering: number) {
    ensure(
      Number.isFinite(throttle) &&
        Number.isFinite(steering) &&
        Math.abs(throttle) <= 1 &&
        Math.abs(steering) <= 1,
      "INVALID_INPUT",
      "Vehicle input must be between -1 and 1",
    );
    this.throttle = throttle;
    this.steering = steering;
  }
  /** Signed chassis velocity along its current source forward, LDU/s. The
   * native controller's own speed is a velocity norm, which also counts
   * vertical suspension motion. */
  speedLdu() {
    const forward = new Vector3(
        this.forward.x,
        this.forward.y,
        this.forward.z,
      ).applyQuaternion(this.body.rotation() as never),
      v = this.body.linvel();
    return (v.x * forward.x + v.y * forward.y + v.z * forward.z) / S;
  }
  /** Wheel forces for the next world step (call before world.step). */
  beforeStep(dt: number) {
    const speed = this.speedLdu() * S,
      limited =
        (this.throttle > 0 && speed >= this.maxSpeed) ||
        (this.throttle < 0 && speed <= -this.maxSpeed),
      n = this.options.wheels.length,
      force = limited ? 0 : (this.throttle * this.engineForce) / n;
    this.options.wheels.forEach((w, i) => {
      this.controller.setWheelEngineForce(i, force);
      this.controller.setWheelBrake(i, this.throttle === 0 ? this.brake : 0);
      this.controller.setWheelSteering(
        i,
        w.steering ? this.steering * this.maxSteer : 0,
      );
    });
    this.controller.updateVehicle(
      dt,
      undefined,
      groups(0xffff, 0xffff & ~this.own),
    );
  }
  report() {
    const t = this.body.translation(),
      q = this.body.rotation(),
      f = new Vector3(this.forward.x, 0, this.forward.z).applyQuaternion(
        q as never,
      ),
      rest = new Vector3(this.forward.x, 0, this.forward.z);
    const heading =
      (Math.atan2(rest.x * f.z - rest.z * f.x, rest.x * f.x + rest.z * f.z) *
        -180) /
      Math.PI;
    return {
      position: fromPhysics(t),
      displacement: fromPhysics(t).map((v, k) => v - this.origin[k]) as Vec3,
      headingDegrees: heading,
      speed: this.speedLdu(),
      wheels: this.options.wheels.map((w, i) => ({
        id: w.id,
        contact: this.controller.wheelIsInContact(i),
        rotationDegrees:
          ((this.controller.wheelRotation(i) ?? 0) * 180) / Math.PI,
        steeringDegrees:
          ((this.controller.wheelSteering(i) ?? 0) * 180) / Math.PI,
        suspensionLdu: (this.controller.wheelSuspensionLength(i) ?? 0) / S,
      })),
    };
  }
  dispose() {
    this.world.removeVehicleController(this.controller);
    this.world.removeRigidBody(this.body);
  }
}
