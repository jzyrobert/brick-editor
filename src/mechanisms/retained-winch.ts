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
import sources from "./winch-sources.json";
import {
  bindDrivetrainSources,
  drivetrainInterfaces,
  type DrivetrainSourceBinding,
} from "./drivetrain-interfaces";
import { wormRouting } from "./drivetrain-routing";

export type RetainedWinchBinding = Readonly<{ refs: readonly string[] }>;
type Binding = RetainedWinchBinding;
const geometrySources = new WeakMap<
  Binding,
  Readonly<Record<string, string>>
>();
const bindings = new WeakMap<Binding, DrivetrainSourceBinding>();
const witnesses = new WeakSet<RetainedWinch>();
/** A narrowly reviewed assembly, not permission to weld a submodel or exempt
 * its parts from world collision. The source carrier still needs an external
 * assembly attachment before production ownership can be granted. */
export type RetainedWinch = Readonly<{
  kind: "42042-retained-winch";
  carrierMembers: readonly string[];
  /** Rotationally keyed source seats. Treating either pair as one rigid body
   * also assumes ideal axial keyed grip; captures below retain the worm/gear,
   * not both-sided shaft stops. These lists alone do not authorize a weld. */
  inputMembers: readonly string[];
  outputMembers: readonly string[];
  input: { occurrenceId: string; center: Vec3; axis: Vec3 };
  output: { occurrenceId: string; center: Vec3; axis: Vec3 };
  ratio: number;
  captures: readonly {
    memberId: string;
    supportIds: readonly string[];
    spanLdu: readonly [number, number];
    clearanceLdu: 0;
  }[];
  keyedCarrierEdges: readonly [string, string][];
  /** Only an ideal signed tooth relation; neither friction nor self-locking. */
  idealToothLaw: "single-start-positive-lead-8-tooth";
}>;
export async function bindRetainedWinchSources(
  resolved: Readonly<Record<string, string>>,
  project: Pick<Project, "models">,
): Promise<Binding> {
  const refs = await verifyReviewedSourceClosures(
    resolved,
    sources,
    Object.keys(sources),
    { project },
  );
  const drivetrain = await bindDrivetrainSources(
    resolved,
    ["4716.dat", "10928.dat"],
    { project },
  );
  const binding = Object.freeze({ refs });
  bindings.set(binding, drivetrain);
  geometrySources.set(binding, Object.freeze({ ...resolved }));
  return binding;
}
const BEAM: Transform["basis"] = [0, -1, 0, 1, 0, 0, 0, 0, 1];
const STOP: Transform["basis"] = [-1, 0, 0, 0, -1, 0, 0, 0, 1];
const BLOCK: Transform["basis"] = [1, 0, 0, 0, -1, 0, 0, 0, -1];
const GEAR: Transform["basis"] = [0, 0, 1, 0, 1, 0, -1, 0, 0];
const AXLE: Transform["basis"] = [-1, 0, 0, 0, 1, 0, 0, 0, -1];
const INPUT: Transform["basis"] = [0, -1, 0, 0, 0, -1, 1, 0, 0];
/** Literal source seats relative to4716, from OMR42042 lines12085..12097.
 * 32449: keyed Y-bore at Z±30, round Y-bore at Z10, faces Y±5.
 * 6536: keyed X-bore±10, round Z-bore at Y20, faces Z±10.
 * Thus the gears' original shoulders, not a proximity box, supply capture. */
const SEATS: readonly {
  ref: keyof typeof sources;
  position: Vec3;
  basis: Transform["basis"];
  role: "carrier" | "input" | "output";
}[] = [
  ...[-25, -15, 15, 25].map((x) => ({
    ref: "32449.dat" as const,
    position: [x, 20, 0] as Vec3,
    basis: BEAM,
    role: "carrier" as const,
  })),
  ...[-30, 30].map((z) => ({
    ref: "87083.dat" as const,
    position: [8, 20, z] as Vec3,
    basis: STOP,
    role: "carrier" as const,
  })),
  ...[-30, 30].map((z) => ({
    ref: "6536.dat" as const,
    position: [0, 20, z] as Vec3,
    basis: BLOCK,
    role: "carrier" as const,
  })),
  { ref: "15462.dat", position: [0, 0, -10], basis: INPUT, role: "input" },
  { ref: "10928.dat", position: [0, 20, 10], basis: GEAR, role: "output" },
  { ref: "3737.dat", position: [70, 20, 10], basis: AXLE, role: "output" },
];
export function retainedWinch(
  worm: Occurrence,
  all: readonly Occurrence[],
  binding: Binding,
): RetainedWinch {
  const drivetrain = bindings.get(binding);
  ensure(
    drivetrain &&
      worm.namespace === "official" &&
      worm.node.kind === "part" &&
      worm.node.ref === "4716.dat" &&
      nearlyPhysical(worm.transform),
    "INVALID_INPUT",
    "Use the actual bound worm occurrence.",
  );
  ensure(
    all.length <= 512,
    "RESOURCE_LIMIT",
    "Select a bounded source winch assembly.",
  );
  const frame = orthonormalized(worm.transform),
    inv = inverse(frame);
  const selected = SEATS.map((seat) => {
    const matches = all.filter((o) => {
      if (
        o.namespace !== "official" ||
        o.node.kind !== "part" ||
        o.node.ref !== seat.ref ||
        !nearlyPhysical(o.transform)
      )
        return false;
      const local = compose(inv, orthonormalized(o.transform));
      return (
        Math.hypot(...local.position.map((n, i) => n - seat.position[i])) <=
          1e-6 &&
        local.basis.every((n, i) => Math.abs(n - seat.basis[i]) <= 1e-6)
      );
    });
    ensure(
      matches.length === 1,
      "INVALID_INPUT",
      "Missing, displaced or ambiguous source winch seat: " + seat.ref,
    );
    return { occurrence: matches[0], role: seat.role };
  });
  ensure(
    new Set([worm.id, ...selected.map((s) => s.occurrence.id)]).size === 12,
    "INVALID_INPUT",
    "Winch source members overlap.",
  );
  const gear = selected.find(
    (s) => s.occurrence.node.ref === "10928.dat",
  )!.occurrence;
  const relation = wormRouting(
    drivetrainInterfaces(worm, drivetrain)!,
    drivetrainInterfaces(gear, drivetrain)!,
  );
  const ids = (role: (typeof SEATS)[number]["role"]) =>
    Object.freeze(
      selected.filter((s) => s.role === role).map((s) => s.occurrence.id),
    );
  const beams = selected.slice(0, 4).map((s) => s.occurrence.id),
    crossAxles = selected.slice(4, 6).map((s) => s.occurrence.id),
    blocks = selected.slice(6, 8).map((s) => s.occurrence.id);
  const witness: RetainedWinch = Object.freeze({
    kind: "42042-retained-winch",
    carrierMembers: ids("carrier"),
    inputMembers: Object.freeze([worm.id, ...ids("input")]),
    outputMembers: ids("output"),
    input: Object.freeze({
      occurrenceId: worm.id,
      center: Object.freeze([...relation.axisA.center]) as unknown as Vec3,
      axis: Object.freeze([...relation.axisA.axis]) as unknown as Vec3,
    }),
    output: Object.freeze({
      occurrenceId: gear.id,
      center: Object.freeze([...relation.axisB.center]) as unknown as Vec3,
      axis: Object.freeze([...relation.axisB.axis]) as unknown as Vec3,
    }),
    ratio: relation.ratio,
    captures: Object.freeze([
      Object.freeze({
        memberId: worm.id,
        supportIds: Object.freeze(blocks),
        spanLdu: Object.freeze([-20, 20]) as readonly [number, number],
        clearanceLdu: 0 as const,
      }),
      Object.freeze({
        memberId: gear.id,
        supportIds: Object.freeze([beams[1], beams[2]]),
        spanLdu: Object.freeze([-10, 10]) as readonly [number, number],
        clearanceLdu: 0 as const,
      }),
    ]),
    keyedCarrierEdges: Object.freeze(
      crossAxles.flatMap((axle, i) =>
        [...beams, blocks[i]].map(
          (member) =>
            Object.freeze([axle, member]) as unknown as [string, string],
        ),
      ),
    ),
    idealToothLaw: "single-start-positive-lead-8-tooth",
  });
  witnesses.add(witness);
  return witness;
}
export const isRetainedWinch = (witness: RetainedWinch) =>
  witnesses.has(witness);

/** Immutable source bytes from the same verified closure. Geometry constructors
 * may read these; this does not authorize additional unreviewed profiles. */
export function retainedWinchGeometrySources(binding: RetainedWinchBinding) {
  const resolved = geometrySources.get(binding);
  ensure(resolved, "INVALID_INPUT", "Use bound retained-winch sources.");
  return resolved;
}
