import manifest from "./arocs-wheel-sources.json";
import {
  verifyReviewedSourceClosures,
  type ReviewedSourceOptions,
} from "../mechanisms/reviewed-source-closure";
import { add, mv, nearlyPhysical, orthonormalized } from "../core/math";
import { ensure, type Occurrence, type Vec3 } from "../core/types";

export type ArocsWheelRef = keyof typeof manifest;
export type ArocsWheelBinding = Readonly<{ refs: readonly ArocsWheelRef[] }>;
const bindings = new WeakMap<ArocsWheelBinding, ReadonlySet<string>>();
const verified = new WeakSet<ArocsPartInterface>();
export async function bindArocsWheelSources(
  sources: Readonly<Record<string, string>>,
  refs: readonly ArocsWheelRef[],
  options: ReviewedSourceOptions = {},
): Promise<ArocsWheelBinding> {
  const bound = await verifyReviewedSourceClosures(
      sources,
      manifest,
      refs,
      options,
    ),
    result = Object.freeze({
      refs: Object.freeze([...bound]) as readonly ArocsWheelRef[],
    });
  bindings.set(result, new Set(bound));
  return result;
}
export type ArocsAxisInterface = {
  id: string;
  occurrenceId: string;
  center: Vec3;
  axis: Vec3;
  span: [number, number];
  keyDirection?: Vec3;
  radius?: number;
};
export type ArocsPartInterface = {
  occurrenceId: string;
  ref: ArocsWheelRef;
  axis?: ArocsAxisInterface;
  keyedSpans?: readonly [number, number][];
  stops?: readonly { span: [number, number]; radius: number }[];
  bearings: readonly ArocsAxisInterface[];
  tyre?: { radius: number; span: [number, number]; originOffset: -9.5 };
};
/** Literal source interfaces, not automatic vehicle/rig admission. Each token
 * is bound to the actual resolved dependency closure and source occurrence. */
export function arocsPartInterface(
  o: Occurrence,
  binding: ArocsWheelBinding,
): ArocsPartInterface | undefined {
  if (
    o.node.kind !== "part" ||
    o.namespace !== "official" ||
    !bindings.get(binding)?.has(o.node.ref) ||
    !nearlyPhysical(o.transform) ||
    !o.transform.position.every((n) => Number.isFinite(n) && Math.abs(n) <= 1e7)
  )
    return;
  const frame = orthonormalized(o.transform),
    feature = (
      id: string,
      center: Vec3,
      axis: Vec3,
      span: [number, number],
      key?: Vec3,
      radius?: number,
    ): ArocsAxisInterface => ({
      id,
      occurrenceId: o.id,
      center: add(frame.position, mv(frame.basis, center)),
      axis: mv(frame.basis, axis),
      span,
      ...(key ? { keyDirection: mv(frame.basis, key) } : {}),
      ...(radius !== undefined ? { radius } : {}),
    }),
    result: ArocsPartInterface = {
      occurrenceId: o.id,
      ref: o.node.ref as ArocsWheelRef,
      bearings: [],
    };
  switch (result.ref) {
    case "86652.dat":
      result.axis = feature(
        "short-keyed-hub",
        [0, 0, 0],
        [0, 0, 1],
        [-10, 10],
        [1, 0, 0],
      );
      break;
    case "32019.dat":
      result.axis = feature(
        "stepped-tyre",
        [0, 0, 0],
        [0, 0, 1],
        [-34.5, 15.5],
      );
      result.tyre = { radius: 78.299, span: [-34.5, 15.5], originOffset: -9.5 };
      break;
    case "87083.dat":
      result.axis = feature(
        "stopped-4L-shaft",
        [0, 0, 0],
        [1, 0, 0],
        [-40, 40],
        [0, 1, 0],
      );
      result.keyedSpans = [[-37.5, 38]];
      result.stops = [{ span: [38, 40], radius: 8 }];
      break;
    case "59426.dat":
      result.axis = feature(
        "stopped-5.5L-shaft",
        [0, 0, 0],
        [1, 0, 0],
        [-55, 55],
        [0, 1, 0],
      );
      result.keyedSpans = [
        [-52.5, -37],
        [-27, 52.5],
      ];
      result.stops = [{ span: [-37, -35], radius: 8 }];
      break;
    case "4519.dat":
      result.axis = feature(
        "3L-shaft",
        [0, 0, 0],
        [1, 0, 0],
        [-30, 30],
        [0, 1, 0],
      );
      result.keyedSpans = [[-27.5, 27.5]];
      break;
    case "32123a.dat":
      result.axis = feature(
        "half-bush",
        [0, 0, 0],
        [0, 0, 1],
        [-5, 5],
        [1, 0, 0],
      );
      break;
    case "59443.dat":
      result.axis = feature(
        "coupler",
        [0, 0, 0],
        [0, 0, 1],
        [-20, 20],
        [1, 0, 0],
      );
      result.keyedSpans = [
        [-20, -0.25],
        [0.25, 20],
      ];
      break;
    case "48989.dat":
      result.bearings = [-20, 0, 20].map((y) =>
        feature(`round-${y}`, [0, y, 0], [1, 0, 0], [-10, 10], undefined, 6),
      );
      break;
    case "32184.dat":
      result.bearings = [
        feature("central-round", [0, 0, 0], [0, 0, 1], [-10, 10], undefined, 6),
      ];
      break;
  }
  const freeze = (v: unknown) => {
    if (!v || typeof v !== "object" || Object.isFrozen(v)) return;
    Object.values(v).forEach(freeze);
    Object.freeze(v);
  };
  freeze(result);
  verified.add(result);
  return result;
}
const dot = (a: Vec3, b: Vec3) => a.reduce((s, x, k) => s + x * b[k], 0);
const sub = (a: Vec3, b: Vec3) => a.map((x, k) => x - b[k]) as Vec3;
function pair(a: ArocsAxisInterface, b: ArocsAxisInterface) {
  const delta = sub(a.center, b.center),
    t = dot(delta, b.axis),
    transverse = delta.map((x, k) => x - t * b.axis[k]) as Vec3,
    sign = dot(a.axis, b.axis),
    span = a.span.map((n) => t + sign * n).sort((a, b) => a - b) as [
      number,
      number,
    ];
  return {
    transverse,
    mismatchLdu: Math.hypot(...transverse),
    span,
    parallel: Math.abs(sign) >= 0.999999,
  };
}
export type ArocsWheelUnit = {
  shaft: ArocsPartInterface;
  wheels: readonly {
    rim: ArocsPartInterface;
    tyre: ArocsPartInterface;
    /** Translation of the wheel to its compatible shaft centreline. Source stays unchanged. */
    idealCoaxialTranslation: Vec3;
    authoredTransverseMismatchLdu: number;
    sourceCenter: Vec3;
    radius: number;
  }[];
  carrier: ArocsPartInterface;
  bearing: ArocsAxisInterface;
  collars: readonly ArocsPartInterface[];
  /** The keyed short hubs share an actual shaft, not invented inter-rim pins. */
  members: readonly string[];
  freedom: {
    bearingRotation: "free";
    hubRotation: "keyed";
    axialCapture: "two-collars" | "source-stop-and-coupler" | "unproved";
  };
  /** Suspension/steering hierarchy and contact/load realization are separate. */
  attachmentOnly: true;
};
export type ArocsDrivelineWitness = {
  coupler: ArocsPartInterface;
  shafts: readonly {
    shaft: ArocsPartInterface;
    side: -1 | 1;
    engagementLdu: number;
  }[];
  freedom: { rotation: "keyed"; axial: "not-a-weld" };
};
/** A passive shaft connection, never a motor/power inference. The short
 * stopped-axle stub and the independent 3L axle occupy opposite actual bores.
 * The separator Z[-.25,.25] stays closed. */
export function arocsDrivelineWitnesses(parts: readonly ArocsPartInterface[]) {
  ensure(
    parts.length <= 256 && parts.every((p) => verified.has(p)),
    "INVALID_INPUT",
    "Bind bounded actual Arocs source interfaces first.",
  );
  let work = 0;
  const shafts = parts.filter(
      (p) => p.ref === "59426.dat" || p.ref === "4519.dat",
    ),
    result: ArocsDrivelineWitness[] = [];
  for (const coupler of parts.filter((p) => p.ref === "59443.dat")) {
    const matches = shafts.flatMap((shaft) => {
      ensure(
        ++work <= 100000,
        "RESOURCE_LIMIT",
        "Arocs driveline witness budget exceeded.",
      );
      const f = pair(shaft.axis!, coupler.axis!),
        k = Math.abs(
          dot(shaft.axis!.keyDirection!, coupler.axis!.keyDirection!),
        );
      if (!f.parallel || f.mismatchLdu > 1e-7 || !(k >= 0.999999 || k <= 1e-7))
        return [];
      const spans = shaft.keyedSpans!.map(
        (span) => pair({ ...shaft.axis!, span }, coupler.axis!).span,
      );
      const material = pair(
        {
          ...shaft.axis!,
          // Both literal axleend2 references stop 0.5 LDU inside the nominal
          // end. Retain all material, including the taper beyond keyed core.
          span: [shaft.axis!.span[0] + 0.5, shaft.axis!.span[1] - 0.5],
        },
        coupler.axis!,
      ).span;
      return coupler.keyedSpans!.flatMap(([lo, hi]) =>
        spans.flatMap(([a, b]) => {
          const engagementLdu = Math.min(hi, b) - Math.max(lo, a);
          const separatorSafe =
            hi < 0 ? material[1] <= -0.25 : material[0] >= 0.25;
          return engagementLdu >= 10 && separatorSafe
            ? [{ shaft, side: (hi < 0 ? -1 : 1) as -1 | 1, engagementLdu }]
            : [];
        }),
      );
    });
    if (
      matches.length === 2 &&
      matches[0].side !== matches[1].side &&
      matches[0].shaft.occurrenceId !== matches[1].shaft.occurrenceId
    )
      result.push({
        coupler,
        shafts: matches,
        freedom: { rotation: "keyed", axial: "not-a-weld" },
      });
  }
  return result;
}
export function arocsWheelUnits(parts: readonly ArocsPartInterface[]) {
  ensure(
    parts.length <= 256 && parts.every((p) => verified.has(p)),
    "INVALID_INPUT",
    "Bind bounded actual Arocs source interfaces first.",
  );
  let work = 0;
  const charge = () =>
    ensure(
      ++work <= 100000,
      "RESOURCE_LIMIT",
      "Arocs wheel contact review exceeds its bounded budget.",
    );
  const rims = parts.filter((p) => p.ref === "86652.dat"),
    tyres = parts.filter((p) => p.ref === "32019.dat"),
    shafts = parts.filter(
      (p) => p.ref === "87083.dat" || p.ref === "59426.dat",
    ),
    units = new Map<string, ArocsWheelUnit>(),
    skipped: Array<{ occurrenceId: string; reason: string }> = [];
  for (const rim of rims) {
    const fits = tyres.filter((t) => {
      charge();
      const f = pair(t.axis!, rim.axis!);
      return (
        f.parallel &&
        dot(t.axis!.axis, rim.axis!.axis) > 0 &&
        Math.hypot(...sub(t.axis!.center, rim.axis!.center)) <= 1e-7
      );
    });
    if (fits.length !== 1) {
      skipped.push({
        occurrenceId: rim.occurrenceId,
        reason: "Choose the actual same-origin asymmetric tyre.",
      });
      continue;
    }
    const axles = shafts.filter((s) => {
      charge();
      const f = pair(rim.axis!, s.axis!);
      if (
        !f.parallel ||
        f.mismatchLdu > 0.05 ||
        !s.keyedSpans?.some(([lo, hi]) => f.span[0] >= lo && f.span[1] <= hi)
      )
        return false;
      const k = Math.abs(dot(rim.axis!.keyDirection!, s.axis!.keyDirection!));
      return k >= 0.999999 || k <= 1e-7;
    });
    if (axles.length !== 1) {
      skipped.push({
        occurrenceId: rim.occurrenceId,
        reason: "Choose one real spanning keyed stopped axle.",
      });
      continue;
    }
    const shaft = axles[0],
      candidates = parts.flatMap((carrier) =>
        carrier.bearings.flatMap((bearing) => {
          charge();
          const f = pair(bearing, shaft.axis!);
          return f.parallel &&
            f.mismatchLdu <= 1e-7 &&
            f.span[0] >= shaft.axis!.span[0] &&
            f.span[1] <= shaft.axis!.span[1]
            ? [{ carrier, bearing }]
            : [];
        }),
      );
    if (candidates.length !== 1) {
      skipped.push({
        occurrenceId: rim.occurrenceId,
        reason: "Choose the actual round carrier bearing.",
      });
      continue;
    }
    const { carrier, bearing } = candidates[0],
      f = pair(rim.axis!, shaft.axis!),
      collars = parts.filter((p) => {
        charge();
        if (p.ref !== "32123a.dat") return false;
        const c = pair(p.axis!, shaft.axis!),
          k = Math.abs(dot(p.axis!.keyDirection!, shaft.axis!.keyDirection!));
        return (
          c.parallel &&
          c.mismatchLdu <= 1e-7 &&
          (k >= 0.999999 || k <= 1e-7) &&
          c.span[0] >= shaft.axis!.span[0] &&
          c.span[1] <= shaft.axis!.span[1]
        );
      }),
      wheel = {
        rim,
        tyre: fits[0],
        idealCoaxialTranslation: f.transverse.map((x) => -x) as Vec3,
        authoredTransverseMismatchLdu: f.mismatchLdu,
        sourceCenter: rim.axis!.center,
        radius: fits[0].tyre!.radius,
      },
      prior = units.get(shaft.occurrenceId);
    if (prior) {
      ensure(
        prior.carrier === carrier,
        "INVALID_INPUT",
        "A stopped wheel shaft has ambiguous carriers.",
      );
      units.set(shaft.occurrenceId, {
        ...prior,
        wheels: [...prior.wheels, wheel],
        members: [...prior.members, rim.occurrenceId, fits[0].occurrenceId],
      });
    } else {
      const r = pair(rim.axis!, shaft.axis!),
        cs = collars.map((c) => pair(c.axis!, shaft.axis!).span),
        captured =
          cs.some((c) => c[1] === r.span[0]) &&
          cs.some((c) => c[0] === r.span[1]);
      units.set(shaft.occurrenceId, {
        shaft,
        wheels: [wheel],
        carrier,
        bearing,
        collars,
        members: [
          shaft.occurrenceId,
          rim.occurrenceId,
          fits[0].occurrenceId,
          ...collars.map((c) => c.occurrenceId),
        ],
        freedom: {
          bearingRotation: "free",
          hubRotation: "keyed",
          axialCapture: captured ? "two-collars" : "unproved",
        },
        attachmentOnly: true,
      });
    }
  }
  const driveline = arocsDrivelineWitnesses(parts);
  for (const unit of units.values()) {
    if (unit.shaft.ref !== "59426.dat") continue;
    const connected = driveline.filter((d) =>
      d.shafts.some((s) => s.shaft === unit.shaft),
    );
    if (connected.length !== 1) continue;
    const stop = unit.shaft.stops![0],
      relative = pair(
        { ...unit.shaft.axis!, span: stop.span },
        connected[0].coupler.axis!,
      ),
      bearing = pair(unit.bearing, unit.shaft.axis!);
    // Literal R8 shoulder fills only the carrier's R8 mouth, ending at its
    // R6 core; its opposite face seats on the real coupler's open end.
    if (
      relative.parallel &&
      relative.mismatchLdu <= 1e-7 &&
      ((Math.abs(relative.span[0] - 20) <= 1e-7 &&
        Math.abs(relative.span[1] - 22) <= 1e-7) ||
        (Math.abs(relative.span[0] + 22) <= 1e-7 &&
          Math.abs(relative.span[1] + 20) <= 1e-7)) &&
      Math.abs(bearing.span[0] - stop.span[0]) <= 1e-7 &&
      Math.abs(stop.span[1] - bearing.span[0] - 2) <= 1e-7
    )
      unit.freedom.axialCapture = "source-stop-and-coupler";
  }
  return { units: [...units.values()], driveline, skipped, work };
}
