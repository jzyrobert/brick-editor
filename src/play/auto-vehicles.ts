import { occurrences } from "../core/document";
import { worldConnectors, type WorldConnector } from "../core/connectivity";
import { add, identity, inverse, mv, nearlyPhysical } from "../core/math";
import {
  ensure,
  type Occurrence,
  type Project,
  type Vec3,
  type Transform,
} from "../core/types";
import type { Bounds } from "../core/spatial";
import type { MotionRig, RigidGroup } from "../mechanisms/types";
import { validateRig } from "../mechanisms/kinematic";
import { occurrenceBounds } from "./trains";
import {
  sourceVehicleAssemblyReview,
  type SourceVehicleAssemblyReview,
} from "./source-vehicle-assembly";
import {
  reviewedAxleWheelMounts,
  type ReviewedVehicleAttachment,
  type ReviewedWheelInstance,
} from "./reviewed-wheel-mounts";

export const AUTO_VEHICLE_PREFIX = "auto-vehicle:";
export const isAutoVehicleRig = (id: string) =>
  id.startsWith(AUTO_VEHICLE_PREFIX);
export const AUTO_VEHICLE_LIMITS = Object.freeze({
  vehicles: 8,
  wheelParts: 256,
  holders: 128,
  candidates: 2000,
  partsPerVehicle: 600,
  connectors: 20000,
  connectionWork: 100000,
});

/** Reviewed pinned LDraw wheel families, not a cylinder/part-title classifier.
 * 4624 (Jessiman) and 3641 share Z[-8,8]. 6014b/56890 (Forsberg) seat at
 * offset -6: rim Z[-20,8] and tyre bore Z[-14,14]. The 4600 source (Jessiman)
 * places wheel pins at X±22,Y5; these hub origins seat on those pins.
 * Radii enclose all compiled source radial vertices, checked in unit tests.
 * Original licensed files and their headers remain in the pinned packs. */
const FAMILIES = [
  { rim: "4624", tyre: "3641", offset: 0, radius: 18.001 },
  { rim: "6014b", tyre: "56890", offset: -6, radius: 30.001 },
  { rim: "93593", tyre: "50951", offset: 0, radius: 19.001 },
  // Same literal s/93593s01 hub and external tyre ring; different spokes.
  { rim: "93595", tyre: "50951", offset: 0, radius: 19.001 },
] as const;
// Literal pin placements in the pinned source, not chassis proximity.
// 2441 carries both axles; 6157 carries the wider 93593 wheel assembly.
const HOLDERS: Record<
  string,
  { axles: number[]; seats: Record<string, number> }
> = {
  "4600": { axles: [0], seats: { "4624": 30, "6014b": 33 } },
  "2441": { axles: [-50, 50], seats: { "4624": 32 } },
  "6157": { axles: [0], seats: { "93593": 40, "93595": 40 } },
};
const key = (o: Occurrence) =>
  o.node.ref
    .toLowerCase()
    .replaceAll("\\", "/")
    .replace(/^.*\//, "")
    .replace(/\.dat$/, "");
const dot = (a: Vec3, b: Vec3) => a.reduce((sum, v, k) => sum + v * b[k], 0);
const distance = (a: Vec3, b: Vec3) => Math.hypot(...a.map((v, k) => v - b[k]));
const unit = (v: Vec3) => v.map((n) => n / Math.hypot(...v)) as Vec3;
const horizontal = (transform: Transform, local: Vec3) => {
  const axis = unit(mv(transform.basis, local));
  return Math.abs(axis[1]) <= 1e-4;
};
const validBox = (b: Bounds | null): b is Bounds =>
  !!b &&
  b.min.every(
    (v, k) => Number.isFinite(v) && Number.isFinite(b.max[k]) && v <= b.max[k],
  );
type Wheel = {
  rim: Occurrence;
  tyre: Occurrence;
  holder: Occurrence;
  center: Vec3;
  radius: number;
  side: -1 | 1;
  axle: string;
  axis?: Vec3;
  steering?: boolean;
  members?: Occurrence[];
  instances?: ReviewedWheelInstance[];
  mountMembers?: Occurrence[];
  attachments?: ReviewedVehicleAttachment[];
};
const wheelMembers = (w: Wheel) => w.members ?? [w.rim, w.tyre];
const wheelInstances = (w: Wheel) =>
  w.instances ?? [
    { rim: w.rim, tyre: w.tyre, center: w.center, radius: w.radius },
  ];
const wheelAxis = (w: Wheel) =>
  w.axis ?? unit(mv(w.holder.transform.basis, [1, 0, 0]));
export type AutoVehicle = {
  rigId: string;
  occurrenceIds: string[];
  wheelOccurrenceIds: string[];
  wheelbase: number;
  rule: "source-wheel-pin-layout" | "source-retained-axle-layout";
};
export type AutoVehicleSkip = { occurrenceIds: string[]; reason: string };
export type DerivedVehicles = {
  rigs: Record<string, MotionRig>;
  vehicles: AutoVehicle[];
  skipped: AutoVehicleSkip[];
  /** Included retained-axle source bodies, including deferred/removable members.
   * This is ownership evidence; only `vehicles` grant current driving admission. */
  sourceAssemblies?: SourceVehicleAssemblyReview;
};
export type AutoVehicleOptions = {
  all?: Occurrence[];
  included?: ReadonlySet<string>;
  reserved: ReadonlySet<string>;
  maxRigs: number;
  maxGroups: number;
  bounds?: (o: Occurrence) => Bounds | null;
};

function mountedWheels(
  all: Occurrence[],
  reserved: ReadonlySet<string>,
  bounds: (o: Occurrence) => Bounds | null,
) {
  const eligible = all.filter(
    (o) =>
      o.namespace === "official" &&
      o.node.kind === "part" &&
      nearlyPhysical(o.transform),
  );
  const wheelParts = eligible.filter(
    (o) =>
      FAMILIES.some((f) => f.rim === key(o) || f.tyre === key(o)) ||
      ["2695", "2696"].includes(key(o)),
  );
  const mountParts = eligible.filter(
    (o) =>
      Object.hasOwn(HOLDERS, key(o)) ||
      ["3700", "4261", "4262", "4263"].includes(key(o)),
  );
  if (!wheelParts.length) return { wheels: [] as Wheel[], skipped: [] };
  if (
    wheelParts.length > AUTO_VEHICLE_LIMITS.wheelParts ||
    mountParts.length > AUTO_VEHICLE_LIMITS.holders
  )
    return {
      wheels: [] as Wheel[],
      skipped: [
        {
          occurrenceIds: wheelParts
            .filter((o) => !reserved.has(o.id))
            .map((o) => o.id),
          reason: "Too many wheel parts to infer a vehicle safely",
        },
      ],
    };
  const reviewed = reviewedAxleWheelMounts(
      all,
      reserved,
      bounds,
      AUTO_VEHICLE_LIMITS,
    ),
    axleWheels: Wheel[] = reviewed.assemblies.map((a) => ({
      rim: a.instances[0].rim,
      tyre: a.instances[0].tyre,
      holder: a.carrier,
      center: a.center,
      radius: a.radius,
      side: a.side,
      axle: a.shaft.id,
      axis: a.axis,
      steering: a.steering,
      members: a.members,
      instances: a.instances,
      mountMembers: a.mountMembers,
      attachments: reviewed.edges,
    })),
    wheels: Wheel[] = [],
    skipped: AutoVehicleSkip[] = [...reviewed.skipped],
    official = all.filter(
      (o) =>
        o.namespace === "official" &&
        o.node.kind === "part" &&
        nearlyPhysical(o.transform),
    ),
    rims = official.filter(
      (o) => FAMILIES.some((f) => f.rim === key(o)) && !reserved.has(o.id),
    ),
    tyres = official.filter((o) => FAMILIES.some((f) => f.tyre === key(o))),
    holders = official.filter((o) => Object.hasOwn(HOLDERS, key(o)));
  if (!rims.length) return { wheels: axleWheels, skipped };
  if (
    rims.length + tyres.length > AUTO_VEHICLE_LIMITS.wheelParts ||
    holders.length > AUTO_VEHICLE_LIMITS.holders
  )
    return {
      wheels,
      skipped: [
        {
          occurrenceIds: rims.map((o) => o.id),
          reason: "Too many wheel parts to infer a vehicle safely",
        },
      ],
    };
  for (const rim of rims) {
    const family = FAMILIES.find((f) => f.rim === key(rim))!,
      expected = add(
        rim.transform.position,
        mv(rim.transform.basis, [0, 0, family.offset]),
      ),
      axis = unit(mv(rim.transform.basis, [0, 0, 1])),
      matches = tyres.filter(
        (t) =>
          key(t) === family.tyre &&
          distance(t.transform.position, expected) <= 0.5 &&
          // The reviewed zero-offset tyres are symmetric across their hub
          // plane; official models may reverse their axial orientation.
          (family.offset === 0
            ? Math.abs(dot(axis, unit(mv(t.transform.basis, [0, 0, 1]))))
            : dot(axis, unit(mv(t.transform.basis, [0, 0, 1])))) >= 0.9999,
      );
    const ids = [rim.id, ...matches.map((t) => t.id)];
    if (matches.length !== 1) {
      skipped.push({
        occurrenceIds: ids,
        reason: matches.length
          ? "Overlapping tyres make this wheel ambiguous"
          : "This wheel needs its matching real tyre",
      });
      continue;
    }
    const tyre = matches[0];
    if (reserved.has(tyre.id)) {
      skipped.push({
        occurrenceIds: ids,
        reason: "This wheel is already owned by another mechanism",
      });
      continue;
    }
    if (!horizontal(rim.transform, [0, 0, 1])) {
      skipped.push({
        occurrenceIds: ids,
        reason: "Driving needs a horizontal wheel axle",
      });
      continue;
    }
    const seats: Array<{ holder: Occurrence; side: -1 | 1; axle: string }> = [];
    for (const holder of holders) {
      if (!horizontal(holder.transform, [1, 0, 0])) continue;
      const mount = HOLDERS[key(holder)],
        seat = mount.seats[family.rim];
      if (seat === undefined) continue;
      if (
        Math.abs(dot(axis, unit(mv(holder.transform.basis, [1, 0, 0])))) <
        0.9999
      )
        continue;
      const inv = inverse(holder.transform),
        p = add(inv.position, mv(inv.basis, rim.transform.position));
      for (const z of mount.axles)
        for (const side of [-1, 1] as const)
          if (distance(p, [side * seat, 5, z]) <= 0.5)
            seats.push({ holder, side, axle: `${holder.id}:${z}` });
    }
    if (seats.length !== 1 || reserved.has(seats[0].holder.id)) {
      skipped.push({
        occurrenceIds: ids,
        reason:
          seats.length > 1
            ? "This wheel has more than one possible holder"
            : "This wheel is not seated on an available real wheel-pin plate",
      });
      continue;
    }
    const box = bounds({ ...tyre, transform: identity() });
    if (!validBox(box)) {
      skipped.push({
        occurrenceIds: ids,
        reason: "This tyre needs complete source bounds",
      });
      continue;
    }
    const radius = Math.max(
      family.radius,
      ...[0, 1].flatMap((k) => [box.max[k], -box.min[k]]),
    );
    if (radius < 4 || radius > 100) {
      skipped.push({
        occurrenceIds: ids,
        reason: "This wheel radius is outside the supported source range",
      });
      continue;
    }
    wheels.push({
      rim,
      tyre,
      ...seats[0],
      center: [...tyre.transform.position],
      radius,
    });
  }
  // One tyre and one wheel-pin seat can belong to only one rotating group.
  const used = new Map<string, number>();
  for (const w of wheels)
    for (const id of [w.tyre.id, `${w.axle}:${w.side}`])
      used.set(id, (used.get(id) ?? 0) + 1);
  return {
    wheels: [
      ...axleWheels,
      ...wheels.filter((w) => {
        const unique =
          used.get(w.tyre.id) === 1 && used.get(`${w.axle}:${w.side}`) === 1;
        if (!unique)
          skipped.push({
            occurrenceIds: [w.rim.id, w.tyre.id],
            reason: "A tyre or pin seat is claimed by more than one wheel",
          });
        return unique;
      }),
    ],
    skipped,
  };
}

/** Physical wheel instances share a source support plane; different radii
 * are valid when their actual centre heights supply that same plane. Coaxial
 * pin-linked tyres remain one controller assembly. No suspension is invented. */
function wheelbase(wheels: Wheel[]) {
  if (wheels.length < 2 || wheels.length > 16)
    return "Automatic driving needs 2–16 real mounted wheel assemblies";
  const axis = wheelAxis(wheels[0]),
    forward: Vec3 = [-axis[2], 0, axis[0]],
    coordinates = (p: Vec3) => [dot(p, axis), p[1], dot(p, forward)];
  if (wheels.some((w) => Math.abs(dot(axis, wheelAxis(w))) < 0.9999))
    return "The wheel axles are not parallel";
  const stations: Array<{ wheels: Wheel[]; z: number }> = [];
  for (const w of [...wheels].sort(
    (a, b) => coordinates(a.center)[2] - coordinates(b.center)[2],
  )) {
    const z = coordinates(w.center)[2],
      last = stations.at(-1);
    if (last && Math.abs(z - last.z) <= 0.5) last.wheels.push(w);
    else stations.push({ wheels: [w], z });
  }
  if (stations.length < 2)
    return "Driving needs at least two distinct supported axle stations";
  const frames = stations.map((station) => {
    const left = station.wheels.filter((w) => w.side === -1),
      right = station.wheels.filter((w) => w.side === 1);
    if (!left.length || left.length !== right.length) return;
    const ls = left.map((w) => coordinates(w.center)[0]).sort((a, b) => a - b),
      rs = right.map((w) => coordinates(w.center)[0]).sort((a, b) => b - a),
      mid = ls.map((x, k) => (x + rs[k]) / 2);
    if (
      Math.max(...mid) - Math.min(...mid) > 0.5 ||
      Math.min(...rs) - Math.max(...ls) < 40
    )
      return;
    return { x: mid.reduce((s, x) => s + x, 0) / mid.length, z: station.z };
  });
  if (frames.some((f) => !f))
    return "Both sides of each axle need a symmetric mounted wheel assembly";
  if (
    Math.max(...frames.map((f) => f!.x)) -
      Math.min(...frames.map((f) => f!.x)) >
    0.5
  )
    return "The axle stations do not share a stable chassis centreline";
  const support = wheels.flatMap((w) =>
    wheelInstances(w).map((i) => i.center[1] + i.radius),
  );
  // This allowance covers reviewed source radial envelopes (2696 has a
  // 0.005 LDU enclosing margin), not suspension or a sloped contact plane.
  if (Math.max(...support) - Math.min(...support) > 0.01)
    return "The source wheels do not share a level support plane";
  for (let i = 1; i < stations.length; i++)
    if (
      stations[i].z - stations[i - 1].z <
      Math.max(...stations[i].wheels.map((w) => w.radius)) +
        Math.max(...stations[i - 1].wheels.map((w) => w.radius)) -
        0.5
    )
      return "Adjacent axle stations overlap their source wheel envelopes";
  const length = stations.at(-1)!.z - stations[0].z;
  if (length < 40 || !Number.isFinite(length))
    return "The axle stations need a stable supported wheelbase";
  return length;
}

function connectReviewedMounts(
  edges: Map<string, Set<string>>,
  wheels: Wheel[],
  candidateIds: ReadonlySet<string>,
) {
  for (const wheel of wheels) {
    const mountIds = new Set(wheel.mountMembers?.map((o) => o.id) ?? []);
    for (const e of wheel.attachments ?? [])
      if (
        mountIds.has(e.a) &&
        mountIds.has(e.b) &&
        candidateIds.has(e.a) &&
        candidateIds.has(e.b)
      ) {
        const a = edges.get(e.a) ?? new Set<string>(),
          b = edges.get(e.b) ?? new Set<string>();
        a.add(e.b);
        b.add(e.a);
        edges.set(e.a, a);
        edges.set(e.b, b);
      }
  }
}

/** Bounded enumeration of reviewed stud interfaces for inferred/authored cars. */
function sourceStudGraph(candidates: Occurrence[]) {
  if (candidates.length > AUTO_VEHICLE_LIMITS.candidates)
    return {
      edges: null,
      reason: "Too many source parts to check vehicle connections",
    };
  const index = new Map<string, WorldConnector[]>(),
    females: WorldConnector[] = [],
    edges = new Map<string, Set<string>>();
  let connectorCount = 0,
    work = 0;
  for (const o of candidates) {
    // These literal 4600/6157/2441 stud subsets are source-reviewed; their
    // whole connector packs remain unverified. Pins use the seat checks above.
    // 3788 has central stug-2x2 at Y=8 and a four-cell underside at Y=16
    // (INVERTNEXT box5 ±16). Only these source-backed stud interfaces are used.
    const local =
      key(o) === "4600" || key(o) === "6157"
        ? [-10, 10].flatMap((x) =>
            [-10, 10].map((z) => ({
              kind: "stud" as const,
              p: [x, key(o) === "6157" ? 8 : 0, z] as Vec3,
              axis: [0, -1, 0] as Vec3,
            })),
          )
        : key(o) === "2441"
          ? [
              ...[-50, 50].flatMap((z) =>
                [-10, 10].map((x) => ({
                  kind: "stud" as const,
                  p: [x, 0, z] as Vec3,
                  axis: [0, -1, 0] as Vec3,
                })),
              ),
              ...[-20, 0, 20].flatMap((z) =>
                [-30, -10, 10, 30].map((x) => ({
                  kind: "stud" as const,
                  p: [x, 8, z] as Vec3,
                  axis: [0, -1, 0] as Vec3,
                })),
              ),
            ]
          : key(o) === "3788"
            ? [-10, 10].flatMap((x) =>
                [-10, 10].flatMap((z) => [
                  {
                    kind: "stud" as const,
                    p: [x, 8, z] as Vec3,
                    axis: [0, -1, 0] as Vec3,
                  },
                  {
                    kind: "antistud" as const,
                    p: [x, 16, z] as Vec3,
                    axis: [0, 1, 0] as Vec3,
                  },
                ]),
              )
            : null;
    const list: WorldConnector[] = local
      ? local.map((c) => ({
          ...c,
          occurrenceId: o.id,
          p: add(o.transform.position, mv(o.transform.basis, c.p)),
          axis: mv(o.transform.basis, c.axis),
        }))
      : (worldConnectors(o) ?? []).filter(
          (c) => c.kind === "stud" || c.kind === "antistud",
        );
    connectorCount += list.length;
    if (connectorCount > AUTO_VEHICLE_LIMITS.connectors) {
      return {
        edges: null,
        reason: "Vehicle stud connections exceed the bounded detection budget",
      };
    }
    if (!list.length) continue;
    edges.set(o.id, new Set());
    for (const c of list)
      if (c.kind === "stud") {
        const cell = c.p.map(Math.round).join(","),
          bucket = index.get(cell) ?? [];
        bucket.push(c);
        index.set(cell, bucket);
      } else females.push(c);
  }
  for (const c of females) {
    const mates: WorldConnector[] = [],
      [x, y, z] = c.p.map(Math.round);
    for (let dx = -1; dx <= 1; dx++)
      for (let dy = -1; dy <= 1; dy++)
        for (let dz = -1; dz <= 1; dz++) {
          work++;
          const bucket = index.get(`${x + dx},${y + dy},${z + dz}`) ?? [];
          work += bucket.length;
          if (work > AUTO_VEHICLE_LIMITS.connectionWork) {
            return {
              edges: null,
              reason:
                "Vehicle stud connections exceed the bounded detection budget",
            };
          }
          for (const s of bucket)
            if (distance(c.p, s.p) <= 0.5 && dot(c.axis, s.axis) <= -0.99)
              mates.push(s);
        }
    for (const mate of mates)
      if (mate.occurrenceId !== c.occurrenceId) {
        edges.get(c.occurrenceId)!.add(mate.occurrenceId);
        edges.get(mate.occurrenceId)!.add(c.occurrenceId);
      }
  }
  return { edges };
}

/** Lightweight source check for declared vehicle wheel groups. It never
 * grants a cylinder/custom-part exception and does not alter the authored rig.
 * Trains are checked by their separate reviewed rail-part detector. */
export function authoredVehicleWheelSupport(
  project: Project,
  rig: MotionRig,
  options: {
    all?: Occurrence[];
    bounds?: (o: Occurrence) => Bounds | null;
  } = {},
) {
  if (!rig.vehicle)
    return { supported: false, reason: "This rig has no vehicle wheelbase" };
  if (rig.groups.length !== rig.vehicle.wheels.length + 1 || rig.joints.length)
    return {
      supported: false,
      reason:
        "The wheel driving exception covers a chassis and its reviewed wheel assemblies",
    };
  const all = options.all ?? occurrences(project),
    ids = new Set(rig.groups.flatMap((g) => g.occurrenceIds)),
    members = all.filter((o) => ids.has(o.id)),
    lookup = new Map(members.map((o) => [o.id, o])),
    found = mountedWheels(
      members,
      new Set(),
      options.bounds ?? occurrenceBounds(project),
    );
  const chassis = rig.groups.find((g) => g.id === rig.vehicle!.chassisGroup);
  if (
    !chassis ||
    members.length > AUTO_VEHICLE_LIMITS.partsPerVehicle ||
    chassis.occurrenceIds.some((id) => {
      const o = lookup.get(id);
      return (
        !o ||
        o.namespace !== "official" ||
        o.node.kind !== "part" ||
        !nearlyPhysical(o.transform)
      );
    })
  )
    return {
      supported: false,
      reason: "A vehicle chassis needs real source brick parts",
    };
  const declared = rig.vehicle.wheels.flatMap(
      (w) => rig.groups.find((g) => g.id === w.groupId)?.occurrenceIds ?? [],
    ),
    rotating = new Set(declared),
    wheels = found.wheels.filter((w) =>
      wheelMembers(w).every((o) => rotating.has(o.id)),
    ),
    result = wheelbase(wheels);
  if (wheels.some((w) => !chassis.occurrenceIds.includes(w.holder.id)))
    return {
      supported: false,
      reason: "The real wheel-pin plates must belong to the chassis",
    };
  if (typeof result === "string")
    return { supported: false, reason: found.skipped[0]?.reason ?? result };
  if (
    wheels.length !== rig.vehicle.wheels.length ||
    new Set(wheels.flatMap((w) => wheelMembers(w).map((o) => o.id))).size !==
      rotating.size
  )
    return {
      supported: false,
      reason:
        "Declared wheel groups need every member of their real matching source wheel assembly",
    };
  if (
    !Number.isFinite(rig.vehicle.wheelbase) ||
    Math.abs(rig.vehicle.wheelbase - result) > 0.5
  )
    return {
      supported: false,
      reason: "Declared wheelbase does not match the real axle spacing",
    };
  for (const spec of rig.vehicle.wheels) {
    const group = rig.groups.find((g) => g.id === spec.groupId)!;
    const wheel = wheels.find(
      (w) =>
        group.occurrenceIds.includes(w.rim.id) &&
        group.occurrenceIds.includes(w.tyre.id),
    );
    if (
      !wheel ||
      !Number.isFinite(spec.radius) ||
      !group.frame.position.every(Number.isFinite) ||
      distance(group.frame.position, wheel.center) > 0.5 ||
      Math.abs(spec.radius - wheel.radius) > 0.5
    )
      return {
        supported: false,
        reason: "Declared wheel pivot or radius does not match its source tyre",
      };
    if (
      group.occurrenceIds.length !== wheelMembers(wheel).length ||
      !wheelMembers(wheel).every((o) => group.occurrenceIds.includes(o.id)) ||
      Math.abs(dot(unit(mv(group.frame.basis, spec.axis)), wheelAxis(wheel))) <
        0.9999
    )
      return {
        supported: false,
        reason:
          "A declared wheel group does not match a real mounted wheel assembly",
      };
    if (wheel.mountMembers?.some((o) => !chassis.occurrenceIds.includes(o.id)))
      return {
        supported: false,
        reason:
          "Every real axle support and retainer must stay with its reviewed chassis",
      };
  }
  const graph = sourceStudGraph(
    members.filter((o) => chassis.occurrenceIds.includes(o.id)),
  );
  if (!graph.edges) return { supported: false, reason: graph.reason };
  connectReviewedMounts(graph.edges, wheels, new Set(chassis.occurrenceIds));
  const holderIds = [...new Set(wheels.map((w) => w.holder.id))],
    connected = new Set<string>(),
    stack = [holderIds[0]];
  while (stack.length) {
    const id = stack.pop()!;
    if (connected.has(id)) continue;
    connected.add(id);
    for (const next of graph.edges.get(id) ?? []) stack.push(next);
  }
  if (
    (holderIds.length > 1 && connected.size <= holderIds.length) ||
    holderIds.some((id) => !connected.has(id))
  )
    return {
      supported: false,
      reason: "The real wheel holders need a stud-connected chassis",
    };
  return { supported: true };
}

/** Session-only, source-preserving vehicles. Detect after authored rigs, doors
 * and trains reserve their members. No project write or native allocation. */
export function deriveVehicleRigs(
  project: Project,
  options: AutoVehicleOptions,
): DerivedVehicles {
  ensure(
    Number.isInteger(options.maxRigs) &&
      options.maxRigs >= 0 &&
      options.maxRigs <= 32 &&
      Number.isInteger(options.maxGroups) &&
      options.maxGroups >= 0 &&
      options.maxGroups <= 128,
    "INVALID_INPUT",
    "Automatic vehicles need valid remaining rig/group limits",
  );
  const all = (options.all ?? occurrences(project)).filter(
      (o) =>
        (!options.included || options.included.has(o.id)) &&
        o.node.kind === "part",
    ),
    boxes = options.bounds ?? occurrenceBounds(project),
    found = mountedWheels(all, options.reserved, boxes),
    result: DerivedVehicles = {
      rigs: {},
      vehicles: [],
      skipped: found.skipped,
    };
  if (!found.wheels.length) return result;
  // The reviewed axle family has actual retained carrier/shaft/hinge boundaries.
  // A source submodel is not permission to flatten those parts into one body.
  // Ordinary wheel-pin families retain their bounded existing driving profile.
  const sourceAxleWheels = found.wheels.filter((wheel) => wheel.mountMembers);
  if (sourceAxleWheels.length) {
    try {
      result.sourceAssemblies = sourceVehicleAssemblyReview(project, {
        all,
        reserved: options.reserved,
        bounds: boxes,
        limits: AUTO_VEHICLE_LIMITS,
      });
    } catch (error) {
      result.skipped.push({
        occurrenceIds: sourceAxleWheels.flatMap((wheel) =>
          wheelMembers(wheel).map((o) => o.id),
        ),
        reason: (error as Error).message,
      });
      found.wheels = found.wheels.filter((wheel) => !wheel.mountMembers);
      if (!found.wheels.length) return result;
    }
  }
  // Traverse actual source ownership for these mounts rather than their MPD
  // ancestors. Unsupported multi-body assemblies remain wholly in the world.
  for (const assembly of result.sourceAssemblies?.assemblies ?? []) {
    const carriers = new Set(assembly.carrierOccurrenceIds),
      wheels = found.wheels.filter(
        (wheel) => wheel.mountMembers && carriers.has(wheel.holder.id),
      ),
      length = wheelbase(wheels),
      reason =
        typeof length === "string"
          ? length
          : assembly.reservedOccurrenceIds.length
            ? "This source vehicle is connected to another active mechanism"
            : !assembly.rigidWheelProfileCompatible
              ? "This vehicle’s axle and hinge assembly is not supported in Play yet"
              : undefined;
    if (reason) {
      result.skipped.push({
        occurrenceIds: assembly.wheelOccurrenceIds,
        reason,
      });
      const rejected = new Set(assembly.carrierOccurrenceIds);
      found.wheels = found.wheels.filter(
        (wheel) => !wheel.mountMembers || !rejected.has(wheel.holder.id),
      );
    }
  }
  if (!found.wheels.length) return result;
  const holders = [
      ...new Map(found.wheels.map((w) => [w.holder.id, w.holder])).values(),
    ],
    wheelIds = new Set(
      found.wheels.flatMap((w) => wheelMembers(w).map((o) => o.id)),
    ),
    near = (o: Occurrence) => {
      const b = boxes(o);
      if (!validBox(b)) return false;
      return holders.some(
        (h) =>
          b.min[0] >= h.transform.position[0] - 260 &&
          b.max[0] <= h.transform.position[0] + 260 &&
          b.min[1] >= h.transform.position[1] - 320 &&
          b.max[1] <= h.transform.position[1] + 40 &&
          b.min[2] >= h.transform.position[2] - 260 &&
          b.max[2] <= h.transform.position[2] + 260,
      );
    },
    candidates = all.filter(
      (o) =>
        !wheelIds.has(o.id) &&
        o.namespace === "official" &&
        nearlyPhysical(o.transform) &&
        near(o),
    );
  if (candidates.length > AUTO_VEHICLE_LIMITS.candidates) {
    result.skipped.push({
      occurrenceIds: found.wheels.flatMap((w) => [w.rim.id, w.tyre.id]),
      reason: "Too many nearby parts to bound a vehicle assembly",
    });
    return result;
  }
  const graph = sourceStudGraph(candidates);
  if (!graph.edges) {
    result.skipped.push({
      occurrenceIds: holders.map((o) => o.id),
      reason: graph.reason,
    });
    return result;
  }
  const edges = graph.edges;
  connectReviewedMounts(
    edges,
    found.wheels,
    new Set(candidates.map((o) => o.id)),
  );
  const seen = new Set<string>();
  for (const holder of holders.sort((a, b) => a.id.localeCompare(b.id))) {
    if (seen.has(holder.id)) continue;
    const component = new Set<string>(),
      stack = [holder.id];
    while (stack.length) {
      const id = stack.pop()!;
      if (component.has(id)) continue;
      component.add(id);
      seen.add(id);
      for (const next of edges.get(id) ?? []) stack.push(next);
    }
    const wheels = found.wheels.filter((w) => component.has(w.holder.id)),
      ids = wheels.flatMap((w) => wheelMembers(w).map((o) => o.id)),
      length = wheelbase(wheels);
    const refuse = (reason: string) =>
      result.skipped.push({ occurrenceIds: ids, reason });
    if (typeof length === "string") {
      refuse(length);
      continue;
    }
    if (
      new Set(wheels.map((w) => w.holder.id)).size > 1 &&
      component.size <= 2
    ) {
      refuse("The wheel holders need a connected real brick chassis");
      continue;
    }
    if ([...component].some((id) => options.reserved.has(id))) {
      refuse("This chassis is already connected to another active mechanism");
      continue;
    }
    // Include unknown official decoration only within a non-root authored
    // submodel touched by this stud component. Never sweep all root scenery in.
    const sourceAssembly = wheels.some((wheel) => wheel.mountMembers)
        ? result.sourceAssemblies?.assemblies.find((assembly) =>
            assembly.carrierOccurrenceIds.includes(holder.id),
          )
        : undefined,
      sourceChassis = sourceAssembly
        ? new Set(sourceAssembly.chassisOccurrenceIds)
        : undefined,
      parents = new Set(
        all
          .filter((o) => component.has(o.id) && o.path.length > 1)
          .map((o) => JSON.stringify(o.path.slice(0, -1))),
      ),
      chassis = all.filter((o) =>
        sourceChassis
          ? sourceChassis.has(o.id)
          : component.has(o.id) ||
            (!wheelIds.has(o.id) &&
              o.path.length > 1 &&
              o.path.some(
                (_, k) =>
                  k > 0 && parents.has(JSON.stringify(o.path.slice(0, k))),
              )),
      ),
      members = [...chassis, ...wheels.flatMap(wheelMembers)];
    if (
      chassis.some(
        (o) => Object.hasOwn(HOLDERS, key(o)) && !component.has(o.id),
      )
    ) {
      refuse("A shared chassis submodel contains another wheel assembly");
      continue;
    }
    if (
      members.some(
        (o) =>
          options.reserved.has(o.id) ||
          o.namespace !== "official" ||
          !nearlyPhysical(o.transform),
      )
    ) {
      refuse(
        "The chassis submodel contains unavailable or unsupported members",
      );
      continue;
    }
    if (chassis.some((o) => !near(o) || !validBox(boxes(o)))) {
      refuse("The chassis submodel extends beyond the bounded wheel assembly");
      continue;
    }
    if (members.length > AUTO_VEHICLE_LIMITS.partsPerVehicle) {
      refuse("A derived vehicle may contain at most 600 parts");
      continue;
    }
    if (
      result.vehicles.length >=
        Math.min(options.maxRigs, AUTO_VEHICLE_LIMITS.vehicles) ||
      Object.values(result.rigs).reduce((n, r) => n + r.groups.length, 0) +
        wheels.length +
        1 >
        options.maxGroups
    ) {
      refuse("No room remains within the Play vehicle/group budget");
      continue;
    }
    const rigId = AUTO_VEHICLE_PREFIX + holder.id,
      axis = wheelAxis(wheels[0]),
      // Exact rigid yaw frame: authored LDraw rounded member bases stay intact.
      yawAxis = unit([axis[0], 0, axis[2]]),
      forward: Vec3 = [-yawAxis[2], 0, yawAxis[0]],
      basis: Transform["basis"] = [
        yawAxis[0],
        0,
        forward[0],
        0,
        1,
        0,
        yawAxis[2],
        0,
        forward[2],
      ],
      origin = wheels
        .reduce((p, w) => add(p, w.center), [0, 0, 0] as Vec3)
        .map((v) => v / wheels.length) as Vec3,
      group = (
        id: string,
        parts: Occurrence[],
        position: Vec3,
      ): RigidGroup => ({
        id,
        occurrenceIds: parts.map((o) => o.id),
        frame: { basis: [...basis], position: [...position] },
        restTransforms: Object.fromEntries(
          parts.map((o) => [o.id, structuredClone(o.transform)]),
        ),
      }),
      ordered = [...wheels].sort(
        (a, b) =>
          dot(a.center, forward) - dot(b.center, forward) ||
          dot(a.center, yawAxis) - dot(b.center, yawAxis),
      ),
      front = Math.min(...wheels.map((w) => dot(w.center, forward))),
      rig: MotionRig = {
        schemaVersion: 1,
        id: rigId,
        name: `Vehicle ${result.vehicles.length + 1}`,
        mode: "kinematic",
        joints: [],
        groups: [
          group("chassis", chassis, origin),
          ...ordered.map((w, i) =>
            group(`wheel-${i + 1}`, wheelMembers(w), w.center),
          ),
        ],
        vehicle: {
          chassisGroup: "chassis",
          wheelbase: length,
          maxSpeed: 160,
          maxSteerDegrees: 30,
          wheels: ordered.map((w, i) => ({
            groupId: `wheel-${i + 1}`,
            axis: [1, 0, 0],
            radius: w.radius,
            steering:
              w.steering ?? Math.abs(dot(w.center, forward) - front) <= 0.5,
          })),
        },
      };
    validateRig(
      { ...project, motionRigs: { ...project.motionRigs, [rigId]: rig } },
      rig,
    );
    result.rigs[rigId] = rig;
    result.vehicles.push({
      rigId,
      occurrenceIds: members.map((o) => o.id),
      wheelOccurrenceIds: ids,
      wheelbase: length,
      rule: wheels.some((w) => w.mountMembers)
        ? "source-retained-axle-layout"
        : "source-wheel-pin-layout",
    });
  }
  const claimed = new Set(result.vehicles.flatMap((v) => v.occurrenceIds));
  result.skipped = result.skipped.filter(
    (s) => !s.occurrenceIds.every((id) => claimed.has(id)),
  );
  return result;
}

/** Source-backed exception for authored road vehicles; rail vehicles use the separate train detector. */
export function checkAuthoredVehicleSource(
  project: Project,
  rig: MotionRig,
  all?: Occurrence[],
) {
  const result = authoredVehicleWheelSupport(project, rig, { all });
  return {
    eligible: result.supported,
    ...(result.reason ? { reason: result.reason } : {}),
  };
}
