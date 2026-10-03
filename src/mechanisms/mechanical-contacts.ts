import { libraryLock } from "../catalog/catalog";
import { fullLibraryLock } from "../catalog/full-library";
import { verifiedConnectors } from "../catalog/connectors";
import { ConnectorIndex } from "../core/connectivity";
import { occurrences } from "../core/document";
import { add, mv, nearlyPhysical, orthonormalized } from "../core/math";
import {
  ensure,
  type Occurrence,
  type Project,
  type Vec3,
} from "../core/types";
import {
  MECHANICAL_PACK,
  MECHANICAL_PARTS,
  type MechanicalFeature,
} from "./mechanical-pack";

export const MECHANICAL_LIMITS = Object.freeze({
  occurrences: 2048,
  features: 8192,
  cells: 100000,
  pairChecks: 200000,
  contacts: 8192,
});
const T = 0.5;
const dot = (a: Vec3, b: Vec3) => a.reduce((s, x, i) => s + x * b[i], 0);
const subtract = (a: Vec3, b: Vec3) => a.map((x, i) => x - b[i]) as Vec3;
const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
export type WorldMechanicalFeature = MechanicalFeature & {
  occurrenceId: string;
  ref: string;
  key: string;
};
type Endpoint = { occurrenceId: string; featureId: string };
type ContactBase = { a: Endpoint; b: Endpoint };
type AxialContact = ContactBase & {
  pivot: Vec3;
  axis: Vec3;
  engagementLdu: number;
};
export type MechanicalContact =
  | (ContactBase & { kind: "stud-weld" })
  | (AxialContact & {
      kind: "bearing";
      rotationLocked: false;
      axialFreedom: true;
    })
  | (AxialContact & {
      kind: "keyed-slide";
      rotationLocked: true;
      axialGrip: boolean;
      axialFreedom: boolean;
    })
  | (AxialContact & {
      kind: "pin-bearing";
      retained: boolean;
      friction: boolean;
    })
  | (AxialContact & { kind: "finger-hinge"; retained: true })
  | (AxialContact & {
      kind: "spur-mesh";
      teethA: number;
      teethB: number;
      ratio: number;
    });
export type MechanicalGraph = {
  features: WorldMechanicalFeature[];
  contacts: MechanicalContact[];
  rejected: Array<ContactBase & { reason: string }>;
  uncovered: Array<{ occurrenceId: string; reason: string }>;
  pairChecks: number;
};
export const featureEndpoint = (f: WorldMechanicalFeature): Endpoint => ({
  occurrenceId: f.occurrenceId,
  featureId: f.id,
});

/** Source placements stay untouched; exact simulation feature frames tolerate
 * LDraw's rounded rotations, but never a reflected, scaled or custom copy. */
export function worldMechanicalFeatures(
  o: Occurrence,
): WorldMechanicalFeature[] | undefined {
  if (
    o.namespace !== "official" ||
    o.node.kind !== "part" ||
    !nearlyPhysical(o.transform) ||
    !o.transform.position.every((x) => Number.isFinite(x) && Math.abs(x) <= 1e7)
  )
    return undefined;
  const profile = Object.hasOwn(MECHANICAL_PARTS, o.node.ref)
    ? MECHANICAL_PARTS[o.node.ref]
    : undefined;
  if (
    !profile ||
    libraryLock.manifestSha256 !== MECHANICAL_PACK.curatedManifestSha256 ||
    fullLibraryLock.manifestSha256 !== MECHANICAL_PACK.fullManifestSha256
  )
    return undefined;
  const frame = orthonormalized(o.transform);
  return profile.features.map((local) => {
    const f = structuredClone(local) as WorldMechanicalFeature;
    f.center = add(frame.position, mv(frame.basis, local.center));
    f.axis = mv(frame.basis, local.axis);
    if ("keyDirection" in f) f.keyDirection = mv(frame.basis, f.keyDirection);
    if ("toothDirection" in f)
      f.toothDirection = mv(frame.basis, f.toothDirection);
    if ("leafDirection" in f)
      f.leafDirection = mv(frame.basis, f.leafDirection);
    if ("normal" in f) f.normal = mv(frame.basis, f.normal);
    return {
      ...f,
      occurrenceId: o.id,
      ref: o.node.ref,
      key: JSON.stringify([o.id, f.id]),
    };
  });
}
export function mechanicalInterval(
  f: WorldMechanicalFeature,
  reference: WorldMechanicalFeature,
  span = f.span,
): [number, number] {
  const offset = dot(subtract(f.center, reference.center), reference.axis),
    sign = dot(f.axis, reference.axis);
  const ends = span.map((x) => offset + x * sign).sort((a, b) => a - b);
  return [ends[0], ends[1]];
}
const interval = mechanicalInterval;
const overlap = (a: [number, number], b: [number, number]) =>
  Math.min(a[1], b[1]) - Math.max(a[0], b[0]);
const contains = (a: [number, number], b: [number, number]) =>
  a[0] <= b[0] + T && a[1] >= b[1] - T;
const sameInterval = (a: [number, number], b: [number, number]) =>
  a.every((x, i) => Math.abs(x - b[i]) <= T);
function aligned(a: WorldMechanicalFeature, b: WorldMechanicalFeature) {
  if (Math.abs(dot(a.axis, b.axis)) < 0.99999) return false;
  const d = subtract(b.center, a.center),
    t = dot(d, a.axis);
  return Math.hypot(...d.map((x, i) => x - t * a.axis[i])) <= T;
}
function phaseMatches(a: Vec3, b: Vec3) {
  const angle = Math.acos(Math.min(1, Math.abs(dot(a, b))));
  return Math.min(angle, Math.abs(Math.PI / 2 - angle)) <= Math.PI / 360;
}
function axialBase(
  a: WorldMechanicalFeature,
  b: WorldMechanicalFeature,
): AxialContact {
  const other = interval(b, a),
    lo = Math.max(a.span[0], other[0]),
    hi = Math.min(a.span[1], other[1]);
  return {
    a: featureEndpoint(a),
    b: featureEndpoint(b),
    axis: [...a.axis],
    pivot: add(a.center, a.axis.map((x) => (x * (lo + hi)) / 2) as Vec3),
    engagementLdu: hi - lo,
  };
}
type Match = MechanicalContact | { reason: string } | undefined;
/** Contact freedom is explicit: a keyed bore alone is not a weld; neither is a
 * friction pin. Partial engagement never establishes seated pin retention. */
export function matchMechanicalFeatures(
  a: WorldMechanicalFeature,
  b: WorldMechanicalFeature,
): Match {
  if (a.occurrenceId === b.occurrenceId) return undefined;
  if (
    (b.kind === "axle" || b.kind === "pin") &&
    a.kind !== "axle" &&
    a.kind !== "pin"
  )
    return matchMechanicalFeatures(b, a);
  if (
    (a.kind === "axle" || a.kind === "pin") &&
    (b.kind === "round-hole" || b.kind === "keyed-hole")
  ) {
    const delta = subtract(b.center, a.center),
      along = dot(delta, a.axis);
    if (
      Math.hypot(...delta.map((x, i) => x - along * a.axis[i])) >
      a.radius + b.radius + T
    )
      return undefined;
    const bore = interval(b, a),
      engagement = overlap(a.span, bore);
    if (engagement < 4) return undefined;
    if (!aligned(a, b))
      return { reason: "Shaft and bore axes are not collinear." };
    if (!contains(a.span, bore))
      return { reason: "The shaft does not span the bore's bearing section." };
    const base = axialBase(a, b);
    if (a.kind === "pin") {
      if (b.kind !== "round-hole")
        return { reason: "A round pin is not a keyed axle." };
      return {
        ...base,
        kind: "pin-bearing",
        retained: sameInterval(a.seatSpan, interval(b, a, b.faceSpan)),
        friction: a.friction,
      };
    }
    if (b.kind === "round-hole")
      return {
        ...base,
        kind: "bearing",
        rotationLocked: false,
        axialFreedom: true,
      };
    if (!phaseMatches(a.keyDirection, b.keyDirection))
      return {
        reason:
          "The axle and keyed bore cross sections have incompatible phase.",
      };
    return {
      ...base,
      kind: "keyed-slide",
      rotationLocked: true,
      axialGrip: b.axialGrip,
      axialFreedom: !b.axialGrip,
    };
  }
  if (a.kind === "finger-hinge" && b.kind === "finger-hinge") {
    if (a.fingers === b.fingers)
      return {
        reason:
          "Finger hinges need complementary two- and three-finger halves.",
      };
    if (!aligned(a, b) || Math.hypot(...subtract(a.center, b.center)) > T)
      return { reason: "Finger hinge pivots do not coincide." };
    return { ...axialBase(a, b), kind: "finger-hinge", retained: true };
  }
  if (a.kind === "spur-gear" && b.kind === "spur-gear") {
    if (
      Math.abs(dot(a.axis, b.axis)) < 0.99999 ||
      Math.abs(a.moduleLdu - b.moduleLdu) > 1e-6
    )
      return { reason: "Spur gears need parallel axes and the same module." };
    const d = subtract(b.center, a.center),
      along = dot(d, a.axis),
      radial = subtract(d, a.axis.map((x) => x * along) as Vec3),
      distance = Math.hypot(...radial);
    if (
      Math.abs(distance - (a.teeth * a.moduleLdu + b.teeth * b.moduleLdu) / 2) >
      T
    )
      return { reason: "Gear centres are not separated by their pitch radii." };
    const engagement = overlap(a.span, interval(b, a));
    if (engagement < 2)
      return { reason: "Gear tooth faces have insufficient axial overlap." };
    const direction = radial.map((x) => x / distance) as Vec3,
      opposite = direction.map((x) => -x) as Vec3;
    const phase = (f: typeof a, dir: Vec3) =>
      (Math.atan2(
        dot(cross(f.toothDirection, dir), f.axis),
        dot(f.toothDirection, dir),
      ) *
        f.teeth) /
      (2 * Math.PI);
    const sign = dot(a.axis, b.axis) < 0 ? -1 : 1;
    const toothPhase = phase(a, direction) + sign * phase(b, opposite);
    if (Math.abs(toothPhase - Math.round(toothPhase - 0.5) - 0.5) > 0.06)
      return {
        reason: "Gear teeth are not staggered at the authored rest phase.",
      };
    return {
      a: featureEndpoint(a),
      b: featureEndpoint(b),
      kind: "spur-mesh",
      pivot: a.center,
      axis: a.axis,
      engagementLdu: engagement,
      teethA: a.teeth,
      teethB: b.teeth,
      ratio: (-sign * a.teeth) / b.teeth,
    };
  }
  return undefined;
}

function featureBounds(f: WorldMechanicalFeature) {
  const radius =
    f.kind === "spur-gear"
      ? (f.teeth * f.moduleLdu) / 2 + T
      : f.kind === "finger-hinge"
        ? 4
        : "radius" in f
          ? f.radius
          : 0;
  const ends = f.span.map((s) =>
    add(f.center, f.axis.map((x) => x * s) as Vec3),
  );
  return {
    low: f.center.map((_, i) => Math.min(ends[0][i], ends[1][i]) - radius - T),
    high: f.center.map((_, i) => Math.max(ends[0][i], ends[1][i]) + radius + T),
  };
}
function featureCells(bounds: ReturnType<typeof featureBounds>) {
  const low = bounds.low.map((x) => Math.floor(x / 20)),
    high = bounds.high.map((x) => Math.floor(x / 20));
  const cells: string[] = [];
  for (let x = low[0]; x <= high[0]; x++)
    for (let y = low[1]; y <= high[1]; y++)
      for (let z = low[2]; z <= high[2]; z++) cells.push(`${x},${y},${z}`);
  return cells;
}
/** Bounded mechanical analysis of a selected assembly. Unknown geometry remains
 * unknown; an exhausted budget fails the whole analysis rather than making
 * apparently unambiguous proposals from a partial search. */
export function mechanicalContactGraph(
  project: Project,
  all = occurrences(project),
): MechanicalGraph {
  ensure(
    all.length <= MECHANICAL_LIMITS.occurrences,
    "LIMIT_EXCEEDED",
    "Select at most 2,048 parts for mechanical analysis.",
  );
  const result: MechanicalGraph = {
    features: [],
    contacts: [],
    rejected: [],
    uncovered: [],
    pairChecks: 0,
  };
  const cells = new Map<string, number[]>(),
    compared = new Set<string>();
  let occupied = 0;
  for (const o of all) {
    const features = worldMechanicalFeatures(o);
    if (features) result.features.push(...features);
    else
      result.uncovered.push({
        occurrenceId: o.id,
        reason:
          "No reviewed mechanical features for this official, unmirrored part and source pack.",
      });
  }
  ensure(
    result.features.length <= MECHANICAL_LIMITS.features,
    "LIMIT_EXCEEDED",
    "Too many mechanical features; select a smaller assembly.",
  );
  const bounds = result.features.map(featureBounds);
  for (let i = 0; i < result.features.length; i++)
    for (const key of featureCells(bounds[i])) {
      ensure(
        ++occupied <= MECHANICAL_LIMITS.cells,
        "LIMIT_EXCEEDED",
        "Mechanical spatial index reached its budget; select a smaller assembly.",
      );
      const list = cells.get(key) ?? [];
      for (const j of list) {
        const pair = `${j}:${i}`;
        if (compared.has(pair)) continue;
        compared.add(pair);
        ensure(
          ++result.pairChecks <= MECHANICAL_LIMITS.pairChecks,
          "LIMIT_EXCEEDED",
          "Mechanical contact search reached its budget; select a smaller assembly.",
        );
        if (
          !bounds[i].low.every(
            (lo, k) =>
              lo <= bounds[j].high[k] && bounds[j].low[k] <= bounds[i].high[k],
          )
        )
          continue;
        const a = result.features[j],
          b = result.features[i],
          match = matchMechanicalFeatures(a, b);
        if (match && "reason" in match)
          result.rejected.push({
            a: featureEndpoint(a),
            b: featureEndpoint(b),
            reason: match.reason,
          });
        else if (match) result.contacts.push(match);
        ensure(
          result.contacts.length + result.rejected.length <=
            MECHANICAL_LIMITS.contacts,
          "LIMIT_EXCEEDED",
          "Mechanical contact report reached its budget; select a smaller assembly.",
        );
      }
      list.push(i);
      cells.set(key, list);
    }
  // Verified stud contacts are rigid; legacy hinge-pin contacts are deliberately
  // excluded from this collapse. Reviewed hinge top studs are independent of
  // the existing catalogue's whole-part connector coverage.
  const studs = new ConnectorIndex(),
    females: Parameters<ConnectorIndex["add"]>[0][] = [];
  let connectorCount = 0;
  for (const o of all) {
    if (
      o.namespace !== "official" ||
      o.node.kind !== "part" ||
      !nearlyPhysical(o.transform)
    )
      continue;
    const frame = orthonormalized(o.transform),
      profile = worldMechanicalFeatures(o)
        ? MECHANICAL_PARTS[o.node.ref]
        : undefined;
    const seen = new Set<string>();
    for (const c of [
      ...(verifiedConnectors(o.node.ref) ?? []),
      ...(profile?.studs ?? []),
    ]) {
      if (c.kind !== "stud" && c.kind !== "antistud") continue;
      ensure(
        ++connectorCount <= MECHANICAL_LIMITS.features,
        "LIMIT_EXCEEDED",
        "Too many stud features; select a smaller mechanical assembly.",
      );
      const key = JSON.stringify([c.kind, c.p, c.axis]);
      if (seen.has(key)) continue;
      seen.add(key);
      const world = {
        kind: c.kind,
        p: add(frame.position, mv(frame.basis, c.p)),
        axis: mv(frame.basis, c.axis),
        occurrenceId: o.id,
      };
      if (c.kind === "stud") studs.add(world);
      else females.push(world);
    }
  }
  for (const b of females)
    for (const a of studs.mates(b, "stud")) {
      if (a.occurrenceId === b.occurrenceId) continue;
      ensure(
        ++result.pairChecks <= MECHANICAL_LIMITS.pairChecks,
        "LIMIT_EXCEEDED",
        "Mechanical stud matching reached its budget; select a smaller assembly.",
      );
      result.contacts.push({
        kind: "stud-weld",
        a: { occurrenceId: a.occurrenceId, featureId: `stud:${a.p.join(",")}` },
        b: {
          occurrenceId: b.occurrenceId,
          featureId: `antistud:${b.p.join(",")}`,
        },
      });
      ensure(
        result.contacts.length + result.rejected.length <=
          MECHANICAL_LIMITS.contacts,
        "LIMIT_EXCEEDED",
        "Mechanical contact report reached its budget; select a smaller assembly.",
      );
    }
  return result;
}
