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
  { rim: "4624", tyre: "3641", offset: 0, seat: 30, radius: 18.001 },
  { rim: "6014b", tyre: "56890", offset: -6, seat: 33, radius: 30.001 },
] as const;
const key = (o: Occurrence) =>
  o.node.ref
    .toLowerCase()
    .replaceAll("\\", "/")
    .replace(/^.*\//, "")
    .replace(/\.dat$/, "");
const dot = (a: Vec3, b: Vec3) => a.reduce((sum, v, k) => sum + v * b[k], 0);
const distance = (a: Vec3, b: Vec3) => Math.hypot(...a.map((v, k) => v - b[k]));
const unit = (v: Vec3) => v.map((n) => n / Math.hypot(...v)) as Vec3;
const worldX = (transform: Transform, local: Vec3) => {
  const axis = unit(mv(transform.basis, local));
  return Math.abs(axis[1]) <= 1e-4 && Math.abs(axis[2]) <= 1e-4;
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
};
export type AutoVehicle = {
  rigId: string;
  occurrenceIds: string[];
  wheelOccurrenceIds: string[];
  wheelbase: number;
  rule: "source-wheel-pin-layout";
};
export type AutoVehicleSkip = { occurrenceIds: string[]; reason: string };
export type DerivedVehicles = {
  rigs: Record<string, MotionRig>;
  vehicles: AutoVehicle[];
  skipped: AutoVehicleSkip[];
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
  authored = false,
) {
  const wheels: Wheel[] = [],
    skipped: AutoVehicleSkip[] = [],
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
    holders = official.filter((o) => key(o) === "4600");
  if (!rims.length) return { wheels, skipped };
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
          dot(axis, unit(mv(t.transform.basis, [0, 0, 1]))) >= 0.9999,
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
    if (
      authored ? Math.abs(axis[1]) > 1e-4 : !worldX(rim.transform, [0, 0, 1])
    ) {
      skipped.push({
        occurrenceIds: ids,
        reason:
          "Automatic driving currently needs horizontal world-X wheel axles",
      });
      continue;
    }
    const seats: Array<{ holder: Occurrence; side: -1 | 1 }> = [];
    for (const holder of holders) {
      if (
        authored
          ? Math.abs(unit(mv(holder.transform.basis, [1, 0, 0]))[1]) > 1e-4
          : !worldX(holder.transform, [1, 0, 0])
      )
        continue;
      if (
        Math.abs(dot(axis, unit(mv(holder.transform.basis, [1, 0, 0])))) <
        0.9999
      )
        continue;
      const inv = inverse(holder.transform),
        p = add(inv.position, mv(inv.basis, rim.transform.position));
      for (const side of [-1, 1] as const)
        if (distance(p, [side * family.seat, 5, 0]) <= 0.5)
          seats.push({ holder, side });
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
    const box = bounds(authored ? { ...tyre, transform: identity() } : tyre);
    if (!validBox(box)) {
      skipped.push({
        occurrenceIds: ids,
        reason: "This tyre needs complete source bounds",
      });
      continue;
    }
    const radius = Math.max(
      family.radius,
      ...(authored ? [0, 1] : [1, 2]).flatMap((k) => [
        box.max[k] - (authored ? 0 : tyre.transform.position[k]),
        (authored ? 0 : tyre.transform.position[k]) - box.min[k],
      ]),
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
    for (const id of [w.tyre.id, `${w.holder.id}:${w.side}`])
      used.set(id, (used.get(id) ?? 0) + 1);
  return {
    wheels: wheels.filter((w) => {
      const unique =
        used.get(w.tyre.id) === 1 && used.get(`${w.holder.id}:${w.side}`) === 1;
      if (!unique)
        skipped.push({
          occurrenceIds: [w.rim.id, w.tyre.id],
          reason: "A tyre or pin seat is claimed by more than one wheel",
        });
      return unique;
    }),
    skipped,
  };
}

function wheelbase(wheels: Wheel[]) {
  if (!wheels.length) return "This vehicle needs real mounted source wheels";
  const axis = unit(mv(wheels[0].holder.transform.basis, [1, 0, 0])),
    forward: Vec3 = [-axis[2], 0, axis[0]],
    coordinates = (p: Vec3) => [dot(p, axis), p[1], dot(p, forward)];
  if (
    wheels.some(
      (w) =>
        Math.abs(dot(axis, unit(mv(w.holder.transform.basis, [1, 0, 0])))) <
        0.9999,
    )
  )
    return "The wheel axles are not parallel";
  const holders = [...new Set(wheels.map((w) => w.holder.id))];
  if (wheels.length !== 4 || holders.length !== 2)
    return "Automatic driving needs exactly two axles with a wheel on both ends";
  for (const id of holders) {
    const pair = wheels.filter((w) => w.holder.id === id);
    if (pair.length !== 2 || pair[0].side === pair[1].side)
      return "Both ends of each axle need a mounted wheel";
    if (
      Math.abs(
        coordinates(pair[0].center)[1] - coordinates(pair[1].center)[1],
      ) > 0.5 ||
      Math.abs(
        coordinates(pair[0].center)[2] - coordinates(pair[1].center)[2],
      ) > 0.5
    )
      return "The wheels on an axle do not share a horizontal centerline";
  }
  const axles = holders
    .map((id) => {
      const pair = wheels
        .filter((w) => w.holder.id === id)
        .map((w) => ({ center: coordinates(w.center) }));
      return {
        x: (pair[0].center[0] + pair[1].center[0]) / 2,
        y: (pair[0].center[1] + pair[1].center[1]) / 2,
        z: (pair[0].center[2] + pair[1].center[2]) / 2,
        track: Math.abs(pair[0].center[0] - pair[1].center[0]),
      };
    })
    .sort((a, b) => a.z - b.z);
  const length = Math.abs(axles[1].z - axles[0].z);
  if (
    length < 40 ||
    length > 400 ||
    axles.some((a) => a.track < 40 || a.track > 160) ||
    Math.abs(axles[0].x - axles[1].x) > 0.5 ||
    Math.abs(axles[0].y - axles[1].y) > 0.5 ||
    Math.abs(axles[0].track - axles[1].track) > 0.5
  )
    return "The two axles do not form a stable parallel wheelbase";
  const r = wheels.map((w) => w.radius);
  if (Math.max(...r) - Math.min(...r) > 0.5)
    return "The wheel radii do not give a level supported chassis";
  return length;
}

/** Complete bounded source stud graph, shared by inferred and authored cars. */
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
    // The four 4600 source studs are reviewed here; its whole connector pack
    // remains unverified. Wheel pins are checked by the seat geometry above.
    // 3788 has central stug-2x2 at Y=8 and a four-cell underside at Y=16
    // (INVERTNEXT box5 ±16). Only these source-backed stud interfaces are used.
    const local =
      key(o) === "4600"
        ? [-10, 10].flatMap((x) =>
            [-10, 10].map((z) => ({
              kind: "stud" as const,
              p: [x, 0, z] as Vec3,
              axis: [0, -1, 0] as Vec3,
            })),
          )
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
  if (rig.groups.length !== 5 || rig.joints.length)
    return {
      supported: false,
      reason:
        "The wheel driving exception covers only a chassis and four wheel groups",
    };
  const all = options.all ?? occurrences(project),
    ids = new Set(rig.groups.flatMap((g) => g.occurrenceIds)),
    members = all.filter((o) => ids.has(o.id)),
    lookup = new Map(members.map((o) => [o.id, o])),
    found = mountedWheels(
      members,
      new Set(),
      options.bounds ?? occurrenceBounds(project),
      true,
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
    wheels = found.wheels.filter(
      (w) => rotating.has(w.rim.id) && rotating.has(w.tyre.id),
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
    declared.length !== 8 ||
    new Set(wheels.flatMap((w) => [w.rim.id, w.tyre.id])).size !== rotating.size
  )
    return {
      supported: false,
      reason:
        "Declared wheel groups need exactly their matching source rims and tyres",
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
      group.occurrenceIds.length !== 2 ||
      !wheels.some(
        (w) =>
          group.occurrenceIds.includes(w.rim.id) &&
          group.occurrenceIds.includes(w.tyre.id),
      ) ||
      !wheels.some(
        (w) =>
          group.occurrenceIds.includes(w.rim.id) &&
          Math.abs(
            dot(
              unit(mv(group.frame.basis, spec.axis)),
              unit(mv(w.rim.transform.basis, [0, 0, 1])),
            ),
          ) >= 0.9999,
      )
    )
      return {
        supported: false,
        reason: "A declared wheel group does not match a real mounted wheel",
      };
  }
  const graph = sourceStudGraph(
    members.filter((o) => chassis.occurrenceIds.includes(o.id)),
  );
  if (!graph.edges) return { supported: false, reason: graph.reason };
  const holderIds = [...new Set(wheels.map((w) => w.holder.id))],
    connected = new Set<string>(),
    stack = [holderIds[0]];
  while (stack.length) {
    const id = stack.pop()!;
    if (connected.has(id)) continue;
    connected.add(id);
    for (const next of graph.edges.get(id) ?? []) stack.push(next);
  }
  if (connected.size <= 2 || holderIds.some((id) => !connected.has(id)))
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
  const holders = [
      ...new Map(found.wheels.map((w) => [w.holder.id, w.holder])).values(),
    ],
    wheelIds = new Set(found.wheels.flatMap((w) => [w.rim.id, w.tyre.id])),
    near = (o: Occurrence) => {
      const b = boxes(o);
      if (!validBox(b)) return false;
      return holders.some(
        (h) =>
          b.min[0] >= h.transform.position[0] - 140 &&
          b.max[0] <= h.transform.position[0] + 140 &&
          b.min[1] >= h.transform.position[1] - 320 &&
          b.max[1] <= h.transform.position[1] + 40 &&
          b.min[2] >= h.transform.position[2] - 200 &&
          b.max[2] <= h.transform.position[2] + 200,
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
      ids = wheels.flatMap((w) => [w.rim.id, w.tyre.id]),
      length = wheelbase(wheels);
    const refuse = (reason: string) =>
      result.skipped.push({ occurrenceIds: ids, reason });
    if (typeof length === "string") {
      refuse(length);
      continue;
    }
    if (component.size <= 2) {
      refuse("The wheel holders need a connected real brick chassis");
      continue;
    }
    if ([...component].some((id) => options.reserved.has(id))) {
      refuse("This chassis is already connected to another active mechanism");
      continue;
    }
    // Include unknown official decoration only within a non-root authored
    // submodel touched by this stud component. Never sweep all root scenery in.
    const parents = new Set(
        all
          .filter((o) => component.has(o.id) && o.path.length > 1)
          .map((o) => JSON.stringify(o.path.slice(0, -1))),
      ),
      chassis = all.filter(
        (o) =>
          component.has(o.id) ||
          (!wheelIds.has(o.id) &&
            o.path.length > 1 &&
            parents.has(JSON.stringify(o.path.slice(0, -1)))),
      ),
      members = [...chassis, ...wheels.flatMap((w) => [w.rim, w.tyre])];
    if (chassis.some((o) => key(o) === "4600" && !component.has(o.id))) {
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
      (result.vehicles.length + 1) * 5 > options.maxGroups
    ) {
      refuse("No room remains within the Play vehicle/group budget");
      continue;
    }
    const rigId = AUTO_VEHICLE_PREFIX + holder.id,
      origin = wheels
        .reduce((p, w) => add(p, w.center), [0, 0, 0] as Vec3)
        .map((v) => v / 4) as Vec3,
      group = (
        id: string,
        parts: Occurrence[],
        position: Vec3,
      ): RigidGroup => ({
        id,
        occurrenceIds: parts.map((o) => o.id),
        frame: { ...identity(), position: [...position] },
        restTransforms: Object.fromEntries(
          parts.map((o) => [o.id, structuredClone(o.transform)]),
        ),
      }),
      ordered = [...wheels].sort(
        (a, b) => a.center[2] - b.center[2] || a.center[0] - b.center[0],
      ),
      front = Math.min(...wheels.map((w) => w.center[2])),
      rig: MotionRig = {
        schemaVersion: 1,
        id: rigId,
        name: `Vehicle ${result.vehicles.length + 1}`,
        mode: "kinematic",
        joints: [],
        groups: [
          group("chassis", chassis, origin),
          ...ordered.map((w, i) =>
            group(`wheel-${i + 1}`, [w.rim, w.tyre], w.center),
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
            steering: Math.abs(w.center[2] - front) <= 0.5,
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
      rule: "source-wheel-pin-layout",
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
