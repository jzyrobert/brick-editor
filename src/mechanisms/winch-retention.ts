import {
  compose,
  inverse,
  nearlyPhysical,
  orthonormalized,
} from "../core/math";
import {
  ensure,
  type Occurrence,
  type Project,
  type Transform,
  type Vec3,
} from "../core/types";
import { verifyReviewedSourceClosures } from "./reviewed-source-closure";
import {
  bindRetainedWinchSources,
  retainedWinch,
  type RetainedWinchBinding,
} from "./retained-winch";
import sources from "./winch-retention-sources.json";

export type WinchRetentionBinding = Readonly<{ refs: readonly string[] }>;
const bindings = new WeakMap<WinchRetentionBinding, RetainedWinchBinding>();
export async function bindWinchRetentionSources(
  resolved: Readonly<Record<string, string>>,
  project: Pick<Project, "models">,
) {
  const refs = await verifyReviewedSourceClosures(
      resolved,
      sources,
      Object.keys(sources),
      { project },
    ),
    binding = Object.freeze({ refs });
  bindings.set(binding, await bindRetainedWinchSources(resolved, project));
  return binding;
}
const BUSH: Transform["basis"] = [0, 0, -1, 1, 0, 0, 0, -1, 0];
/** The remaining fifteen directly placed hardware seats in Philo's complete
 * first winch, OMR42042 lines12098..12114. These are source relationships,
 * never a submodel weld or permission to absorb neighbouring scenery. */
const SEATS: readonly {
  ref: string;
  position: Vec3;
  basis: Transform["basis"];
}[] = [
  {
    ref: "18948.dat",
    position: [0, 0, -70],
    basis: [1, 0, 0, 0, 1, 0, 0, 0, 1],
  },
  {
    ref: "4519.dat",
    position: [0, 0, -110],
    basis: [0, 0, 1, 0, -1, 0, 1, 0, 0],
  },
  {
    ref: "32525.dat",
    position: [40, 20, -10],
    basis: [0, 1, 0, -1, 0, 0, 0, 0, 1],
  },
  ...[90, 50].map((z) => ({
    ref: "6558.dat",
    position: [40, 20, z] as Vec3,
    basis: [-1, 0, 0, 0, -1, 0, 0, 0, 1] as Transform["basis"],
  })),
  {
    ref: "2780.dat",
    position: [30, 20, -10],
    basis: [-1, 0, 0, 0, -1, 0, 0, 0, 1],
  },
  {
    ref: "11214.dat",
    position: [40, 20, -110],
    basis: [-1, 0, 0, 0, -1, 0, 0, 0, 1],
  },
  {
    ref: "60484.dat",
    position: [60, 20, 90],
    basis: [0, 1, 0, 1, 0, 0, 0, 0, -1],
  },
  ...[55, 75, 125, 145].map((x) => ({
    ref: "32123a.dat",
    position: [x, 20, 10] as Vec3,
    basis: BUSH,
  })),
  ...[65, 135].map((x) => ({
    ref: "4185.dat",
    position: [x, 20, 10] as Vec3,
    basis: BUSH,
  })),
  {
    ref: "62462.dat",
    position: [100, 20, 10],
    basis: [-1, 0, 0, 0, -1, 0, 0, 0, 1],
  },
];
export type WinchRetention = Readonly<{
  sourceMembers: readonly string[];
  input: Readonly<{
    shaftId: string;
    keyedTo: string;
    stopSupportId: string;
    /** Positive displacement follows the actual worm axis. */
    headStationLdu: 38;
    coreEndStationLdu: 38;
    headRadiusLdu: 8;
    roundCoreRadiusLdu: 6;
    opposingHardStop: null;
    joinerId: string;
    freeEndToDividerGapLdu: 8.5;
  }>;
  output: Readonly<{
    shaftId: string;
    keyedTo: string;
    bushes: readonly string[];
    pulleys: readonly string[];
    roundSleeveId: string;
    hardStops: readonly [];
  }>;
  /** A literal key proves rotation coupling, not bilateral axial ownership. */
  shaftOwnership: "axially-free-keyed";
}>;
const reviews = new WeakSet<WinchRetention>();
export function winchRetention(
  worm: Occurrence,
  all: readonly Occurrence[],
  binding: WinchRetentionBinding,
): WinchRetention {
  const bound = bindings.get(binding);
  ensure(bound, "INVALID_INPUT", "Use actual bound winch-retention sources.");
  const base = retainedWinch(worm, all, bound),
    frame = inverse(orthonormalized(worm.transform));
  const selected = SEATS.map((seat) => {
    const matches = all.filter((o) => {
      if (
        o.namespace !== "official" ||
        o.node.kind !== "part" ||
        o.node.ref !== seat.ref ||
        !nearlyPhysical(o.transform)
      )
        return false;
      const p = compose(frame, orthonormalized(o.transform));
      return (
        Math.hypot(...p.position.map((x, i) => x - seat.position[i])) <= 1e-6 &&
        p.basis.every((x, i) => Math.abs(x - seat.basis[i]) <= 1e-6)
      );
    });
    ensure(
      matches.length === 1,
      "INVALID_INPUT",
      "Missing/displaced/ambiguous winch retention seat: " + seat.ref,
    );
    return matches[0];
  });
  const ids = (ref: string) =>
      Object.freeze(
        selected.filter((o) => o.node.ref === ref).map((o) => o.id),
      ),
    members = Object.freeze([
      ...base.carrierMembers,
      ...base.inputMembers,
      ...base.outputMembers,
      ...selected.map((o) => o.id),
    ]);
  ensure(
    new Set(members).size === 27,
    "INVALID_INPUT",
    "Winch retention members overlap.",
  );
  const review: WinchRetention = Object.freeze({
    sourceMembers: members,
    input: Object.freeze({
      shaftId: base.inputMembers.find((id) => id !== base.input.occurrenceId)!,
      keyedTo: base.input.occurrenceId,
      stopSupportId: base.captures[0].supportIds[1],
      headStationLdu: 38,
      coreEndStationLdu: 38,
      headRadiusLdu: 8,
      roundCoreRadiusLdu: 6,
      opposingHardStop: null,
      joinerId: ids("18948.dat")[0],
      freeEndToDividerGapLdu: 8.5,
    }),
    output: Object.freeze({
      shaftId: base.outputMembers.find(
        (id) => id !== base.output.occurrenceId,
      )!,
      keyedTo: base.output.occurrenceId,
      bushes: ids("32123a.dat"),
      pulleys: ids("4185.dat"),
      roundSleeveId: ids("62462.dat")[0],
      hardStops: Object.freeze([]) as readonly [],
    }),
    shaftOwnership: "axially-free-keyed",
  });
  reviews.add(review);
  return review;
}
export const isWinchRetention = (review: WinchRetention) => reviews.has(review);
