import { add, mv, nearlyPhysical, orthonormalized } from "../core/math";
import { ensure, type Occurrence, type Vec3 } from "../core/types";
import { DRIVETRAIN_SOURCES } from "./drivetrain-sources";
import {
  verifyReviewedSourceClosures,
  type ReviewedSourceOptions,
} from "./reviewed-source-closure";

export type DrivetrainRef = keyof typeof DRIVETRAIN_SOURCES;
export type DrivetrainSourceBinding = Readonly<{
  refs: readonly DrivetrainRef[];
}>;
const verifiedInterfaces = new WeakSet<DrivetrainPartInterfaces>();
const bindings = new WeakMap<DrivetrainSourceBinding, ReadonlySet<string>>();
/** Hash once when assembling the session. Source/root/subpart changes fail the
 * complete binding; a project file named after an official part never qualifies. */
export async function bindDrivetrainSources(
  sources: Readonly<Record<string, string>>,
  refs: readonly DrivetrainRef[],
  options: ReviewedSourceOptions = {},
): Promise<DrivetrainSourceBinding> {
  const verified = new Set<DrivetrainRef>(
    (await verifyReviewedSourceClosures(
      sources,
      DRIVETRAIN_SOURCES,
      refs,
      options,
    )) as readonly DrivetrainRef[],
  );
  const binding = Object.freeze({ refs: Object.freeze([...verified]) });
  bindings.set(binding, verified);
  return binding;
}
export type DrivetrainAxisInterface = {
  id: string;
  occurrenceId: string;
  center: Vec3;
  axis: Vec3;
  span: [number, number];
  keyDirection?: Vec3;
};
export type DrivetrainPartInterfaces = {
  occurrenceId: string;
  ref: DrivetrainRef;
  /** Distinct source component ownership. These paths are not newly authored parts. */
  components: readonly {
    id: string;
    sourcePath: readonly string[];
    rotates: boolean;
  }[];
  holes: DrivetrainAxisInterface[];
  pins: DrivetrainAxisInterface[];
  shaft?: DrivetrainAxisInterface;
  socket?: DrivetrainAxisInterface;
  gear?: {
    axis: DrivetrainAxisInterface;
    teeth: number;
    pitchRadiusLdu: number;
    bore: "keyed" | "round";
  };
  worm?: { axis: DrivetrainAxisInterface; starts: 1; leadLdu: 8; hand: 1 };
  differential?: {
    axis: DrivetrainAxisInterface;
    spiderSeat: DrivetrainAxisInterface;
    sideSeats: readonly DrivetrainAxisInterface[];
  };
  selector?: {
    axis: DrivetrainAxisInterface;
    dogSpan: [number, number];
    travel: [number, number];
  };
  clutch?: {
    axis: DrivetrainAxisInterface;
    teeth: 16;
    pockets: readonly [number, number][];
    freeOnAxle: true;
  };
};
export function drivetrainInterfaces(
  o: Occurrence,
  binding: DrivetrainSourceBinding,
): DrivetrainPartInterfaces | undefined {
  const ref =
    o.node.kind === "part" ? (o.node.ref as DrivetrainRef) : undefined;
  if (
    !ref ||
    o.namespace !== "official" ||
    !bindings.get(binding)?.has(ref) ||
    !nearlyPhysical(o.transform) ||
    !o.transform.position.every((x) => Number.isFinite(x) && Math.abs(x) <= 1e7)
  )
    return undefined;
  const frame = orthonormalized(o.transform);
  const feature = (
    id: string,
    center: Vec3,
    axis: Vec3,
    span: [number, number],
    key?: Vec3,
  ): DrivetrainAxisInterface => ({
    id,
    occurrenceId: o.id,
    center: add(frame.position, mv(frame.basis, center)),
    axis: mv(frame.basis, axis),
    span,
    ...(key ? { keyDirection: mv(frame.basis, key) } : {}),
  });
  const result: DrivetrainPartInterfaces = {
    occurrenceId: o.id,
    ref,
    components: [],
    holes: [],
    pins: [],
  };
  if (ref === "99499.dat") {
    result.components = [
      { id: "case", sourcePath: ["99499.dat", "10089c01.dat"], rotates: false },
      { id: "output", sourcePath: ["99499.dat", "10095.dat"], rotates: true },
    ];
    result.socket = feature("output", [0, 0, 0], [0, 0, 1], [0, 20], [1, 0, 0]);
    //10090+s/10090s01: mouths Z0/20, 6-radius core Z2..18.
    for (const [x, y] of [
      [-20, 0],
      [20, 0],
      [0, -20],
      [0, 20],
    ])
      result.holes.push(
        feature(`front-${x}-${y}`, [x, y, 0], [0, 0, 1], [0, 20]),
      );
    //10090/front and10089/back side bores, each opposed mouth opens inward.
    for (const z of [10, 130])
      for (const x of [-30, 30])
        for (const y of [-20, 20])
          result.holes.push(
            feature(
              `side-${x}-${y}-${z}`,
              [x, y, z],
              [-Math.sign(x), 0, 0],
              [0, 20],
            ),
          );
  } else if (ref === "48989.dat") {
    for (const y of [-20, 20])
      for (const z of [-10, 10])
        result.pins.push(
          feature(
            `integrated-${y}-${z}`,
            [0, y, z],
            [0, 0, Math.sign(z)],
            [0, 20],
          ),
        );
  } else if (ref === "2780.dat" || ref === "3673.dat") {
    for (const s of [-1, 1])
      result.pins.push(feature(`pin-${s}`, [0, 0, 0], [s, 0, 0], [0, 20]));
  } else if (ref === "3705.dat" || ref === "3707.dat") {
    const half = ref === "3705.dat" ? 40 : 80;
    result.shaft = feature(
      "shaft",
      [0, 0, 0],
      [1, 0, 0],
      [-half, half],
      [0, 1, 0],
    );
  } else if (ref === "18947.dat") {
    result.selector = {
      axis: feature("ring", [0, 0, 0], [0, 0, 1], [-28, 28], [1, 0, 0]),
      dogSpan: [8, 28],
      travel: [-10, 10],
    };
  } else if (ref === "18946.dat") {
    result.clutch = {
      axis: feature("gear", [0, 0, 0], [0, 0, 1], [-10, 10], [1, 0, 0]),
      teeth: 16,
      pockets: [
        [-10, -2],
        [2, 10],
      ],
      freeOnAxle: true,
    };
  } else if (ref === "18948.dat") {
    result.shaft = feature(
      "ridged-coupler",
      [0, 0, 0],
      [0, 0, 1],
      [-30, 30],
      [1, 0, 0],
    );
  }
  const gearProfiles: Partial<
    Record<DrivetrainRef, [number, [number, number], "keyed" | "round"]>
  > = {
    "10928.dat": [8, [-10, 10], "keyed"],
    "94925.dat": [16, [-10, 10], "keyed"],
    "18946.dat": [16, [-10, 10], "round"],
    "32270.dat": [12, [-10, 10], "keyed"],
    "32269.dat": [20, [-10, 10], "keyed"],
    "6589.dat": [12, [0, 7], "keyed"],
    "87407.dat": [20, [-10, 10], "round"],
  };
  const gear = gearProfiles[ref];
  if (gear)
    result.gear = {
      axis: feature("gear-axis", [0, 0, 0], [0, 0, 1], gear[1], [1, 0, 0]),
      teeth: gear[0],
      pitchRadiusLdu: gear[0] * 1.25,
      bore: gear[2],
    };
  if (ref === "4716.dat")
    result.worm = {
      axis: feature("worm", [0, 0, 0], [0, 0, 1], [-20, 20], [1, 0, 0]),
      starts: 1,
      leadLdu: 8,
      hand: 1,
    };
  if (ref === "62821.dat")
    result.differential = {
      axis: feature("carrier", [0, 0, 0], [0, 0, 1], [-30, 30]),
      // Literal 4-4cylc at (0,-10,0), radius3 and height-10.
      spiderSeat: feature("spider-pin", [0, -17, 0], [0, 1, 0], [-3, 7]),
      sideSeats: [-1, 1].map((side) =>
        feature(`side-${side}`, [0, 0, side * 17], [0, 0, -side], [0, 7]),
      ),
    };
  const freeze = (value: unknown): void => {
    if (!value || typeof value !== "object" || Object.isFrozen(value)) return;
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  };
  freeze(result);
  verifiedInterfaces.add(result);
  return result;
}
const dot = (a: Vec3, b: Vec3) => a.reduce((s, x, i) => s + x * b[i], 0);
const sub = (a: Vec3, b: Vec3) => a.map((x, i) => x - b[i]) as Vec3;
const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
function aligned(a: DrivetrainAxisInterface, b: DrivetrainAxisInterface) {
  const d = sub(b.center, a.center),
    z = dot(d, a.axis);
  return (
    Math.abs(dot(a.axis, b.axis)) >= 0.99999 &&
    Math.hypot(...d.map((x, i) => x - z * a.axis[i])) <= 0.05
  );
}
function interval(
  a: DrivetrainAxisInterface,
  b: DrivetrainAxisInterface,
): [number, number] {
  const z = dot(sub(a.center, b.center), b.axis),
    s = dot(a.axis, b.axis);
  return a.span.map((x) => z + s * x).sort((a, b) => a - b) as [number, number];
}
function keyed(a: DrivetrainAxisInterface, b: DrivetrainAxisInterface) {
  if (!a.keyDirection || !b.keyDirection) return false;
  const phase = Math.acos(
    Math.min(1, Math.abs(dot(a.keyDirection, b.keyDirection))),
  );
  return Math.min(phase, Math.abs(Math.PI / 2 - phase)) <= Math.PI / 360;
}
/** Finite pin/socket geometry witness only. Assembly must additionally bind the
 * seated pin owners and output bearings to its actual fixed carrier island. */
export function pfLargeMotorContacts(
  motor: DrivetrainPartInterfaces,
  supports: readonly DrivetrainPartInterfaces[],
  shaft: DrivetrainPartInterfaces,
) {
  ensure(
    verifiedInterfaces.has(motor) &&
      verifiedInterfaces.has(shaft) &&
      supports.every((s) => verifiedInterfaces.has(s)),
    "INVALID_INPUT",
    "Bind actual source interfaces before motor admission.",
  );
  ensure(
    motor.ref === "99499.dat" && motor.socket && shaft.shaft,
    "INVALID_INPUT",
    "Choose reviewed PF-L motor/output interfaces.",
  );
  ensure(
    supports.length <= 64,
    "RESOURCE_LIMIT",
    "Motor mounting witness budget exceeded.",
  );
  const socket = motor.socket,
    axle = shaft.shaft;
  ensure(aligned(socket, axle), "INVALID_INPUT", "Motor axle is off-axis.");
  const ends = interval(axle, socket);
  ensure(
    ends[0] <= 0.05 && ends[1] >= 7.5 && ends[1] <= 20.05,
    "INVALID_INPUT",
    "Insert the axle without crossing the motor socket's closed back.",
  );
  const seats = motor.holes.flatMap((hole) =>
    supports.flatMap((owner) =>
      owner.pins
        .filter((pin) => {
          if (dot(pin.axis, hole.axis) < 0.99999 || !aligned(hole, pin))
            return false;
          const p = interval(pin, hole);
          return Math.abs(p[0]) <= 0.05 && Math.abs(p[1] - 20) <= 0.05;
        })
        .map((pin) => ({ hole, pin, ownerId: owner.occurrenceId })),
    ),
  );
  const unique = new Map(seats.map((seat) => [seat.hole.id, seat]));
  ensure(
    unique.size >= 2,
    "INVALID_INPUT",
    "Mount PF-L using at least two distinct source-seated pins.",
  );
  ensure(
    [...unique.values()].every(
      (s) => seats.filter((x) => x.hole.id === s.hole.id).length === 1,
    ),
    "INVALID_INPUT",
    "Overlapping motor mount candidates.",
  );
  ensure(
    socket.keyDirection && axle.keyDirection,
    "INVALID_INPUT",
    "The motor output requires a keyed axle.",
  );
  //The independently rotating10095 hub can seat any axle phase. The casing is
  //not its key frame; record the rotor phase instead of twisting source bricks.
  const phase = Math.atan2(
    dot(cross(socket.keyDirection, axle.keyDirection), socket.axis),
    dot(socket.keyDirection, axle.keyDirection),
  );
  const rotorRestPhaseDegrees =
    (((phase * 180) / Math.PI + 45 + 360) % 90) - 45;
  return {
    rotorRestPhaseDegrees,
    caseOccurrenceId: motor.occurrenceId,
    outputComponentId: "output",
    shaftOccurrenceId: shaft.occurrenceId,
    socket,
    engagementLdu: Math.min(20, ends[1]),
    mounts: [...unique.values()],
  };
}
/** Geometric selector state. No rotational weld while neutral, entering or
 * tooth phase mismatched. Requires the separately mounted ridged coupler. */
export function clutchSelectorState(
  ring: DrivetrainPartInterfaces,
  coupler: DrivetrainPartInterfaces,
  gears: readonly DrivetrainPartInterfaces[],
) {
  ensure(
    ring.selector &&
      coupler.ref === "18948.dat" &&
      coupler.shaft &&
      gears.length === 2 &&
      gears.every((g) => g.clutch),
    "INVALID_INPUT",
    "Use one reviewed ring/coupler and its two clutch gears.",
  );
  const r = ring.selector.axis,
    c = coupler.shaft;
  ensure(
    aligned(r, c) && keyed(r, c),
    "INVALID_INPUT",
    "Driving ring is not on its ridged coupler.",
  );
  ensure(
    verifiedInterfaces.has(ring) &&
      verifiedInterfaces.has(coupler) &&
      gears.every((g) => verifiedInterfaces.has(g)),
    "INVALID_INPUT",
    "Bind actual source interfaces before selector admission.",
  );
  const travel = dot(sub(r.center, c.center), c.axis);
  const sides = gears.map((g) => {
    const axis = g.clutch!.axis;
    ensure(
      aligned(c, axis),
      "INVALID_INPUT",
      "Clutch gear is not on the selector shaft.",
    );
    const z = dot(sub(axis.center, c.center), c.axis);
    ensure(
      Math.abs(Math.abs(z) - 40) <= 0.5,
      "INVALID_INPUT",
      "Clutch gear does not face the source dog ring.",
    );
    return { gear: g, axis, z, side: Math.sign(z) };
  });
  ensure(
    sides[0].side !== sides[1].side,
    "INVALID_INPUT",
    "Selector requires opposed clutch gears.",
  );
  const negative = sides.find((s) => s.side < 0)!,
    positive = sides.find((s) => s.side > 0)!;
  //Use actual pocket shoulders, including authored0.5LDU origin differences.
  const limits: [number, number] = [negative.z + 30, positive.z - 30];
  ensure(
    travel >= limits[0] && travel <= limits[1],
    "INVALID_INPUT",
    "Driving ring crosses its source pocket shoulder.",
  );
  const ringCoupling = {
    a: coupler.occurrenceId,
    b: ring.occurrenceId,
    ratio: dot(c.axis, r.axis),
    kind: "keyed-slide" as const,
  };
  const common = { travel, limits, ringCoupling };
  if (travel - 28 >= negative.z + 10 && travel + 28 <= positive.z - 10)
    return { ...common, state: "neutral" as const, relations: [] };
  const selected = travel > 0 ? positive : negative;
  if (!keyed(r, selected.axis))
    return { ...common, state: "blocked-phase" as const, relations: [] };
  if (Math.abs(travel - (travel > 0 ? limits[1] : limits[0])) > 0.05)
    return { ...common, state: "entering" as const, relations: [] };
  return {
    ...common,
    state: "engaged" as const,
    relations: [
      {
        a: ring.occurrenceId,
        b: selected.gear.occurrenceId,
        ratio: dot(r.axis, selected.axis.axis),
        kind: "dog-clutch" as const,
      },
    ],
  };
}
export { dot as drivetrainDot, cross as drivetrainCross };

export const isReviewedDrivetrainInterface = (part: DrivetrainPartInterfaces) =>
  verifiedInterfaces.has(part);
