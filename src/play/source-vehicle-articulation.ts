import { compose, inverse, mv } from "../core/math";
import type { MotionRig } from "../mechanisms/types";
import { axisRotation } from "../mechanisms/kinematic";
import type { Occurrence, Transform, Vec3 } from "../core/types";
import type { SourceAssemblyEdge } from "./source-assembly";
import type { SourceVehicleAssembly } from "./source-vehicle-assembly";

/**
 * Compact source vehicle profile ("one body, animated articulation").
 *
 * The whole attached source graph drives as ONE rigid chassis on ray-cast
 * wheels. Its articulated source boundaries do not become native bodies:
 *
 * - steering arms turn about their reviewed vertical pivots, from the wheel
 *   steering angle the vehicle model already computes;
 * - a part joining both steering arms (a rack or tie rod) slides with them;
 * - a steering column geared to that rack turns with it (nominal pitch);
 * - wheels spin as before; front wheels swing about the real pivots;
 * - every other boundary (hinged panels, bushes) is held as built.
 *
 * All of this is drawing only: no extra dynamic body, no joint, no contact
 * exemption. See docs/reviews/EFFICIENT-VEHICLE-AND-SYSTEMS-PHYSICS.md.
 */
export const SOURCE_VEHICLE_ARTICULATION_PROFILE =
  "source-vehicle-one-body-v1" as const;
/** Boundary kinds the profile understands. Anything else is refused. */
const KNOWN = new Set([
  "keyed-slide",
  "source-retained-axle-bearing",
  "source-captured-keyed-accessory",
  "source-finger-hinge",
  "source-plate-barrel-hinge",
  "source-wheel-retained-pivot",
  "source-wheel-axial-retainer",
  "source-wheel-round-bearing",
  "source-wheel-inter-rim-pin",
]);
/** Nominal LEGO Technic gear module: 1 mm = 2.5 LDU of pitch diameter per tooth. */
const PITCH_LDU_PER_TOOTH = 2.5;
const COLUMN_GEARS: Readonly<Record<string, number>> = Object.freeze({
  "4143.dat": 14,
});
const RACKS = new Set(["3743.dat"]);
/** LDraw up (negative Y). */
const UP: Vec3 = [0, -1, 0];

export type RideAlongKind =
  | "resting-cover"
  | "steering-wheel"
  | "sticker"
  | "flexible-hose";
export type SourceVehicleArticulation = {
  profile: typeof SOURCE_VEHICLE_ARTICULATION_PROFILE;
  chassisGroup: string;
  knuckles: Array<{
    wheelGroupId: string;
    pivot: Vec3;
    occurrenceIds: string[];
  }>;
  linkage?: {
    occurrenceIds: string[];
    /** Pin points (rest, world LDU) by knuckle index. */
    pins: Array<{ knuckle: number; point: Vec3 }>;
    slideAxis: Vec3;
  };
  column?: {
    occurrenceIds: string[];
    point: Vec3;
    /** Unit axis pointing from the driver towards the front. */
    axis: Vec3;
    pitchRadiusLdu: number;
  };
  held: Array<{ profile: string; occurrenceIds: string[] }>;
  rideAlong: Array<{
    kind: RideAlongKind;
    occurrenceIds: string[];
    follows: "chassis" | "column";
    /** No collision: drawn only. */
    visualOnly: boolean;
  }>;
  notes: string[];
  /** Filled in at Play entry from captured geometry (compactArticulatedSource). */
  chassis?: {
    hulls: Vec3[][];
    massParts: Array<{ volume: number; centroid: Vec3; min: Vec3; max: Vec3 }>;
    members: number;
    drawnOnly: number;
  };
};

const sub = (a: Vec3, b: Vec3): Vec3 => a.map((x, k) => x - b[k]) as Vec3;
const add = (a: Vec3, b: Vec3): Vec3 => a.map((x, k) => x + b[k]) as Vec3;
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const unit = (a: Vec3): Vec3 => a.map((x) => x / Math.hypot(...a)) as Vec3;
const mean = (points: Vec3[]): Vec3 =>
  points
    .reduce((s, p) => add(s, p), [0, 0, 0] as Vec3)
    .map((v) => v / points.length) as Vec3;
/** Rotation by `deg` about the line through `point` along `axis`. */
export function rotationAbout(point: Vec3, axis: Vec3, deg: number): Transform {
  const basis = axisRotation(unit(axis), deg);
  return { basis, position: sub(point, mv(basis, point)) };
}
const translation = (t: Vec3): Transform => ({
  basis: [1, 0, 0, 0, 1, 0, 0, 0, 1],
  position: t,
});

/**
 * Plan the drawn articulation of a reviewed source assembly whose rigid wheel
 * profile was refused. Returns a plain-words reason instead when a boundary
 * cannot be explained.
 */
export function planSourceVehicleArticulation(
  assembly: SourceVehicleAssembly,
  wheels: ReadonlyArray<{
    groupId: string;
    steering: boolean;
    members: readonly string[];
    carrierId: string;
  }>,
  lookup: ReadonlyMap<string, Occurrence>,
): SourceVehicleArticulation | { reason: string } {
  const unknown = assembly.boundaries.find(
    (e) => !KNOWN.has(e.evidence.profile),
  );
  if (unknown)
    return {
      reason: `This vehicle has a ${unknown.evidence.profile} connection that Play cannot draw yet`,
    };
  const islandOf = new Map<string, number>();
  assembly.fixedIslands.forEach((island, i) =>
    island.forEach((id) => islandOf.set(id, i)),
  );
  const wheelIslands = new Set(
    wheels.flatMap((w) => w.members.map((id) => islandOf.get(id)!)),
  );
  const carrierIslands = new Set(wheels.map((w) => islandOf.get(w.carrierId)!));
  if (carrierIslands.size !== 1)
    return {
      reason: "The wheel carriers are not all on one rigid chassis part group",
    };
  const main = [...carrierIslands][0];
  const neighbours = new Map<number, SourceAssemblyEdge[]>();
  for (const e of assembly.boundaries)
    for (const [x, y] of [
      [e.a, e.b],
      [e.b, e.a],
    ]) {
      const i = islandOf.get(x),
        j = islandOf.get(y);
      if (i === undefined || j === undefined || i === j) continue;
      neighbours.set(i, [...(neighbours.get(i) ?? []), e]);
    }
  const other = (e: SourceAssemblyEdge, i: number) =>
    islandOf.get(e.a) === i ? islandOf.get(e.b)! : islandOf.get(e.a)!;
  const pivotNeighbours = (i: number) =>
    new Set(
      (neighbours.get(i) ?? [])
        .filter((e) => e.evidence.profile === "source-wheel-retained-pivot")
        .map((e) => other(e, i)),
    );
  // A part pinned to two or more others (a rack or tie rod) joins the arms.
  const isLink = (i: number) => i !== main && pivotNeighbours(i).size >= 2;
  const knuckles: SourceVehicleArticulation["knuckles"] = [],
    knuckleIslands: Set<number>[] = [];
  for (const wheel of wheels.filter((w) => w.steering)) {
    const pivots = (neighbours.get(main) ?? []).filter(
      (e) =>
        e.evidence.profile === "source-wheel-retained-pivot" &&
        e.pivot &&
        e.axis &&
        // the arm on this wheel's side of the car
        Math.sign(e.pivot[0]) ===
          Math.sign(
            mean(
              wheel.members.map((id) => lookup.get(id)!.transform.position),
            )[0],
          ),
    );
    if (pivots.length !== 1)
      return {
        reason:
          "A steering wheel has no single reviewed steering pivot on the chassis",
      };
    const edge = pivots[0];
    if (Math.abs(Math.abs(dot(unit(edge.axis!), UP)) - 1) > 1e-6)
      return { reason: "A steering pivot is not upright" };
    const start = other(edge, main),
      seen = new Set<number>([start]),
      stack = [start];
    while (stack.length) {
      const i = stack.pop()!;
      for (const e of neighbours.get(i) ?? []) {
        const j = other(e, i);
        if (
          seen.has(j) ||
          j === main ||
          wheelIslands.has(j) ||
          isLink(j) ||
          /hinge/.test(e.evidence.profile)
        )
          continue;
        seen.add(j);
        stack.push(j);
      }
    }
    if (knuckleIslands.some((s) => [...seen].some((i) => s.has(i))))
      return { reason: "The two steering arms share parts" };
    knuckleIslands.push(seen);
    knuckles.push({
      wheelGroupId: wheel.groupId,
      pivot: [...edge.pivot!] as Vec3,
      occurrenceIds: [...seen].flatMap((i) => assembly.fixedIslands[i]),
    });
  }
  let linkage: SourceVehicleArticulation["linkage"];
  const links = [
    ...new Set(
      knuckleIslands.flatMap((s) =>
        [...s].flatMap((i) =>
          (neighbours.get(i) ?? [])
            .filter(
              (e) =>
                e.evidence.profile === "source-wheel-retained-pivot" &&
                isLink(other(e, i)) &&
                !knuckleIslands.some((k) => k.has(other(e, i))),
            )
            .map((e) => other(e, i)),
        ),
      ),
    ),
  ];
  if (links.length > 1)
    return {
      reason: "The steering arms are joined by more than one link",
    };
  if (links.length) {
    const link = links[0],
      pins = knuckleIslands.flatMap((s, k) =>
        (neighbours.get(link) ?? [])
          .filter(
            (e) =>
              e.evidence.profile === "source-wheel-retained-pivot" &&
              s.has(other(e, link)) &&
              e.pivot,
          )
          .map((e) => ({ knuckle: k, point: [...e.pivot!] as Vec3 })),
      );
    if (new Set(pins.map((p) => p.knuckle)).size !== knuckles.length)
      return { reason: "The steering link does not reach both steering arms" };
    linkage = {
      occurrenceIds: [...assembly.fixedIslands[link]],
      pins,
      slideAxis: [1, 0, 0],
    };
  }
  // A keyed column carrying a gear next to the rack turns with it.
  let column: SourceVehicleArticulation["column"];
  if (linkage) {
    const rack = linkage.occurrenceIds
      .map((id) => lookup.get(id)!)
      .find((o) => RACKS.has(o.node.ref));
    const gearEdge = assembly.boundaries.find((e) => {
      if (e.evidence.profile !== "source-captured-keyed-accessory")
        return false;
      const gear = [e.a, e.b]
        .map((id) => lookup.get(id)!)
        .find((o) => COLUMN_GEARS[o.node.ref]);
      if (!gear || !rack || !e.axis) return false;
      const r = (COLUMN_GEARS[gear.node.ref] * PITCH_LDU_PER_TOOTH) / 2;
      return (
        Math.hypot(...sub(gear.transform.position, rack.transform.position)) <=
        r + 10
      );
    });
    if (gearEdge) {
      const axleIsland = [gearEdge.a, gearEdge.b]
        .map((id) => islandOf.get(id)!)
        .find((i) =>
          (neighbours.get(i) ?? []).some(
            (e) => e.evidence.profile === "source-retained-axle-bearing",
          ),
        );
      if (axleIsland !== undefined) {
        const set = new Set<number>([axleIsland]);
        for (const e of neighbours.get(axleIsland) ?? [])
          if (
            e.evidence.profile === "keyed-slide" ||
            e.evidence.profile === "source-captured-keyed-accessory"
          )
            set.add(other(e, axleIsland));
        const gear = [gearEdge.a, gearEdge.b]
          .map((id) => lookup.get(id)!)
          .find((o) => COLUMN_GEARS[o.node.ref])!;
        let axis = unit(gearEdge.axis!);
        if (dot(axis, [0, 0, -1]) < 0) axis = axis.map((v) => -v) as Vec3;
        column = {
          occurrenceIds: [...set].flatMap((i) => assembly.fixedIslands[i]),
          point: [...gearEdge.pivot!] as Vec3,
          axis,
          pitchRadiusLdu:
            (COLUMN_GEARS[gear.node.ref] * PITCH_LDU_PER_TOOTH) / 2,
        };
      }
    }
  }
  const moving = new Set([
    ...knuckles.flatMap((k) => k.occurrenceIds),
    ...(linkage?.occurrenceIds ?? []),
    ...(column?.occurrenceIds ?? []),
    ...wheels.flatMap((w) => w.members),
  ]);
  const held = new Map<string, Set<string>>();
  for (const e of assembly.boundaries) {
    if (moving.has(e.a) || moving.has(e.b)) continue;
    const ids = held.get(e.evidence.profile) ?? new Set<string>();
    for (const id of [e.a, e.b]) ids.add(id);
    held.set(e.evidence.profile, ids);
  }
  const hinges = assembly.boundaries.filter((e) =>
    /hinge/.test(e.evidence.profile),
  ).length;
  return {
    profile: SOURCE_VEHICLE_ARTICULATION_PROFILE,
    chassisGroup: "chassis",
    knuckles,
    ...(linkage ? { linkage } : {}),
    ...(column ? { column } : {}),
    held: [...held].map(([profile, ids]) => ({
      profile,
      occurrenceIds: [...ids].sort(),
    })),
    rideAlong: [],
    notes: [
      "This car moves as one piece on its wheels. The steering arms, steering link and wheels are drawn turning; they are not simulated separately.",
      ...(hinges
        ? [
            `${hinges === 1 ? "Its hinge stays" : `Its ${hinges} hinge joints stay`} as built while you drive.`,
          ]
        : []),
    ],
  };
}

/** Wheel steering angle (degrees about LDraw up) from a reported wheel frame. */
function steeringDegrees(
  rig: MotionRig,
  frames: Record<string, Transform>,
  delta: Transform,
  groupId: string,
) {
  const group = rig.groups.find((g) => g.id === groupId)!,
    wheel = rig.vehicle!.wheels.find((w) => w.groupId === groupId)!,
    relative = compose(inverse(delta), frames[groupId]),
    rotation = compose(relative, inverse(group.frame)).basis,
    a0 = mv(group.frame.basis, wheel.axis),
    a1 = mv(rotation, a0);
  return (Math.atan2(dot(UP, cross(a0, a1)), dot(a0, a1)) * 180) / Math.PI;
}

/**
 * Draw the planned articulation into a mechanism report's transforms. Only
 * `transforms` change; frames, physics and reports stay the vehicle model's.
 */
export function articulateVehicleTransforms<
  T extends {
    groupFrames: Record<string, Transform>;
    transforms: Record<string, Transform>;
  },
>(report: T, rig: MotionRig, a: SourceVehicleArticulation): T {
  const chassis = rig.groups.find((g) => g.id === a.chassisGroup);
  const frame = report.groupFrames[a.chassisGroup];
  if (!chassis || !frame) return report;
  const delta = compose(frame, inverse(chassis.frame)),
    rest = (id: string) => {
      for (const g of rig.groups)
        if (g.restTransforms[id]) return g.restTransforms[id];
      return undefined;
    },
    transforms = { ...report.transforms },
    place = (ids: readonly string[], local: Transform) => {
      for (const id of ids) {
        const r = rest(id);
        if (r) transforms[id] = compose(delta, compose(local, r));
      }
    };
  const angles = a.knuckles.map((k) =>
    report.groupFrames[k.wheelGroupId]
      ? steeringDegrees(rig, report.groupFrames, delta, k.wheelGroupId)
      : 0,
  );
  a.knuckles.forEach((k, i) => {
    const turn = rotationAbout(k.pivot, UP, angles[i]);
    place(k.occurrenceIds, turn);
    // The vehicle model swings a front wheel about its own centre; move it
    // to swing about the real pivot instead (a pure translation).
    const wheel = rig.groups.find((g) => g.id === k.wheelGroupId);
    if (!wheel) return;
    const correction = compose(
        turn,
        inverse(rotationAbout(wheel.frame.position, UP, angles[i])),
      ),
      world = compose(delta, compose(correction, inverse(delta)));
    for (const id of wheel.occurrenceIds)
      if (transforms[id]) transforms[id] = compose(world, transforms[id]);
  });
  let shift = 0;
  if (a.linkage) {
    const moves = a.linkage.pins.map((pin) => {
      const k = a.knuckles[pin.knuckle],
        moved = add(
          mv(rotationAbout(k.pivot, UP, angles[pin.knuckle]).basis, pin.point),
          rotationAbout(k.pivot, UP, angles[pin.knuckle]).position,
        );
      return dot(sub(moved, pin.point), a.linkage!.slideAxis);
    });
    shift = moves.reduce((s, v) => s + v, 0) / moves.length;
    place(
      a.linkage.occurrenceIds,
      translation(a.linkage.slideAxis.map((v) => v * shift) as Vec3),
    );
  }
  if (a.column) {
    const meanAngle = angles.reduce((s, v) => s + v, 0) / (angles.length || 1),
      // Turning right (negative about up) turns the wheel clockwise for the
      // driver: positive about the axis pointing away from the driver.
      degrees =
        ((-Math.sign(meanAngle) * Math.abs(shift)) / a.column.pitchRadiusLdu) *
        (180 / Math.PI),
      turn = rotationAbout(a.column.point, a.column.axis, degrees);
    place(a.column.occurrenceIds, turn);
    for (const ride of a.rideAlong)
      if (ride.follows === "column") place(ride.occurrenceIds, turn);
  }
  return { ...report, transforms };
}
