import { ensure, type Vec3 } from "../core/types";
import {
  isReviewedDrivetrainInterface,
  drivetrainDot as dot,
  drivetrainCross as cross,
  type DrivetrainPartInterfaces,
  type DrivetrainAxisInterface,
} from "./drivetrain-interfaces";
const sub = (a: Vec3, b: Vec3) => a.map((x, i) => x - b[i]) as Vec3;
const plus = (a: Vec3, b: Vec3) => a.map((x, i) => x + b[i]) as Vec3;
const scale = (a: Vec3, k: number) => a.map((x) => x * k) as Vec3;
const norm = (a: Vec3) => Math.hypot(...a);
const requireSources = (...parts: DrivetrainPartInterfaces[]) =>
  ensure(
    parts.every(isReviewedDrivetrainInterface),
    "INVALID_INPUT",
    "Use actual bound drivetrain sources.",
  );
/** Closest points on true source axes, not AABB or chassis proximity. */
function axes(a: DrivetrainAxisInterface, b: DrivetrainAxisInterface) {
  ensure(
    Math.abs(dot(a.axis, b.axis)) < 0.0001,
    "INVALID_INPUT",
    "Routing requires orthogonal source axes.",
  );
  const d = sub(b.center, a.center),
    c = dot(a.axis, b.axis),
    divisor = 1 - c * c;
  const sa = (dot(d, a.axis) - c * dot(d, b.axis)) / divisor;
  const sb = (c * dot(d, a.axis) - dot(d, b.axis)) / divisor;
  const pa = plus(a.center, scale(a.axis, sa)),
    pb = plus(b.center, scale(b.axis, sb));
  return { sa, sb, pa, pb, gap: norm(sub(pa, pb)) };
}
/** Ideal increment relation from an actual single-start thread and eight-tooth
 * wheel seat. Does not weld either carrier or exempt native tooth contacts.
 * Self-locking is a friction/load question, not inferred from the source mesh. */
export function wormRouting(
  worm: DrivetrainPartInterfaces,
  gear: DrivetrainPartInterfaces,
) {
  requireSources(worm, gear);
  ensure(
    worm.ref === "4716.dat" &&
      worm.worm &&
      gear.ref === "10928.dat" &&
      gear.gear,
    "INVALID_INPUT",
    "Use the reviewed 4716/10928 worm pair.",
  );
  const a = worm.worm.axis,
    b = gear.gear.axis,
    p = axes(a, b);
  ensure(
    Math.abs(p.gap - 20) <= 0.05 &&
      Math.abs(p.sb) <= 0.05 &&
      Math.abs(p.sa) <= 10.05,
    "INVALID_INPUT",
    "Wheel is outside the actual worm thread seat.",
  );
  const tangent = cross(b.axis, sub(p.pa, p.pb));
  const direction = Math.sign(dot(tangent, a.axis));
  ensure(
    direction !== 0,
    "INVALID_INPUT",
    "Worm contact has no axial wheel motion.",
  );
  return {
    kind: "worm-mesh" as const,
    a: worm.occurrenceId,
    b: gear.occurrenceId,
    ratio: (-worm.worm.hand * direction * worm.worm.starts) / gear.gear.teeth,
    threadStationLdu: p.sa,
    centerDistanceLdu: p.gap,
    axisA: a,
    axisB: b,
    requiresRetainedCarriers: true as const,
  };
}
/** The narrow reviewed mating families present in the source sets. Signed axial
 * stations include each family's actual tooth-face origin; tooth radius alone
 * cannot substitute for these offsets. */
const BEVEL_SEATS = [
  { a: "32270.dat", b: "6589.dat", sa: [-20, 20], sb: [17] },
  { a: "87407.dat", b: "6589.dat", sa: [-20], sb: [27] },
  { a: "6589.dat", b: "6589.dat", sa: [17], sb: [17] },
] as const;
export function bevelRouting(
  a: DrivetrainPartInterfaces,
  b: DrivetrainPartInterfaces,
) {
  requireSources(a, b);
  ensure(
    a.gear && b.gear,
    "INVALID_INPUT",
    "Choose reviewed bevel gear interfaces.",
  );
  let seat = BEVEL_SEATS.find((s) => s.a === a.ref && s.b === b.ref),
    reverse = false;
  if (!seat) {
    seat = BEVEL_SEATS.find((s) => s.a === b.ref && s.b === a.ref);
    reverse = true;
  }
  ensure(seat, "INVALID_INPUT", "This bevel family pairing is not reviewed.");
  const p = axes(a.gear.axis, b.gear.axis);
  const as = reverse ? seat.sb : seat.sa,
    bs = reverse ? seat.sa : seat.sb;
  ensure(
    p.gap <= 0.05 &&
      as.some((x) => Math.abs(p.sa - x) <= 0.05) &&
      bs.some((x) => Math.abs(p.sb - x) <= 0.05),
    "INVALID_INPUT",
    "Bevel tooth faces do not occupy the reviewed apex seat.",
  );
  // Common pitch-ray tangents determine direction; literal tooth counts determine ratio.
  const ta = cross(a.gear.axis.axis, sub(b.gear.axis.center, p.pb));
  const tb = cross(b.gear.axis.axis, sub(a.gear.axis.center, p.pa));
  const direction = Math.sign(dot(ta, tb));
  ensure(direction !== 0, "INVALID_INPUT", "Bevel pitch tangents do not meet.");
  return {
    kind: "bevel-mesh" as const,
    a: a.occurrenceId,
    b: b.occurrenceId,
    ratio: (direction * a.gear.teeth) / b.gear.teeth,
    axisA: a.gear.axis,
    axisB: b.gear.axis,
    apex: scale(plus(p.pa, p.pb), 0.5),
    sourceAxisGapLdu: p.gap,
    requiresRetainedCarriers: true as const,
  };
}
/** Three source members inside the actual differential carrier. Side shafts are
 * independently keyed/retained by the assembly graph; the spider turns on the
 * case's literal round pin. A differential is not a pairwise rigid gear weld. */
export function differentialRouting(
  carrier: DrivetrainPartInterfaces,
  gears: readonly DrivetrainPartInterfaces[],
) {
  requireSources(carrier, ...gears);
  ensure(
    carrier.ref === "62821.dat" &&
      carrier.differential &&
      gears.length === 3 &&
      gears.every((g) => g.ref === "6589.dat" && g.gear),
    "INVALID_INPUT",
    "Use the actual carrier and its three bevel gears.",
  );
  const d = carrier.differential;
  const locate = (seat: DrivetrainAxisInterface) => {
    const matches = gears.filter(
      (g) =>
        norm(sub(g.gear!.axis.center, seat.center)) <= 0.05 &&
        dot(g.gear!.axis.axis, seat.axis) > 0.99999,
    );
    ensure(
      matches.length === 1,
      "INVALID_INPUT",
      "Differential gear is not on its actual source seat.",
    );
    return matches[0];
  };
  const sideA = locate(d.sideSeats[0]),
    sideB = locate(d.sideSeats[1]),
    spider = locate(d.spiderSeat);
  ensure(
    new Set([sideA, sideB, spider]).size === 3,
    "INVALID_INPUT",
    "Differential seats overlap.",
  );
  const meshA = bevelRouting(sideA, spider),
    meshB = bevelRouting(sideB, spider);
  const signA = Math.sign(dot(sideA.gear!.axis.axis, d.axis.axis)),
    signB = Math.sign(dot(sideB.gear!.axis.axis, d.axis.axis));
  return {
    kind: "differential" as const,
    carrier: carrier.occurrenceId,
    sideA: sideA.occurrenceId,
    sideB: sideB.occurrenceId,
    spider: spider.occurrenceId,
    carrierAxis: d.axis,
    spiderSeat: d.spiderSeat,
    equation: {
      terms: [
        { occurrenceId: sideA.occurrenceId, coefficient: signA },
        { occurrenceId: sideB.occurrenceId, coefficient: signB },
        { occurrenceId: carrier.occurrenceId, coefficient: -2 },
      ],
      equals: 0 as const,
    },
    // deltaSpider = ratio*(deltaSideA - carrierProjection*deltaCarrier)
    spiderRelation: { ratio: meshA.ratio, carrierProjection: signA },
    meshes: [meshA, meshB],
    requiresRetainedSideShafts: true as const,
  };
}
