import { installedSource } from "../catalog/catalog";
import { occurrences } from "../core/document";
import { add, mv, orthonormalized } from "../core/math";
import {
  ensure,
  type Occurrence,
  type Project,
  type Vec3,
} from "../core/types";
import type { Bounds } from "../core/spatial";
import {
  SOURCE_ASSEMBLY_LIMITS,
  type SourceAssemblyEdge,
} from "./source-assembly";
import { reviewedAxleWheelMounts } from "./reviewed-wheel-mounts";

const point = (o: Occurrence, local: Vec3): Vec3 => {
  const frame = orthonormalized(o.transform);
  return add(frame.position, mv(frame.basis, local));
};
const direction = (o: Occurrence, local: Vec3): Vec3 =>
  mv(orthonormalized(o.transform).basis, local);

/** Converts the reviewed, retained wheel mounts to source ownership evidence.
 * Rubber seating and keyed retainer fits are ideal fixed connections. Round
 * bores (including the two off-axis joining pins) remain articulated: a wheel
 * controller's rigid stack is not permission to weld every source member.
 * Pivot/axis identifies the actual bore line, not a native constraint or proof
 * that all axial clearance has vanished. Native contact/closure admission is
 * still required before these boundaries may move in an ordinary session. */
export function sourceWheelAttachments(
  project: Project,
  options: {
    all?: Occurrence[];
    reserved: ReadonlySet<string>;
    bounds: (o: Occurrence) => Bounds | null;
    limits: { wheelParts: number; holders: number; connectionWork: number };
  },
) {
  ensure(
    !Object.keys(project.models).some(installedSource),
    "INVALID_INPUT",
    "Project definitions shadow installed source geometry; wheel attachments need unshadowed dependencies",
  );
  const all = options.all ?? occurrences(project),
    lookup = new Map(all.map((o) => [o.id, o]));
  ensure(
    all.length <= SOURCE_ASSEMBLY_LIMITS.parts,
    "LIMIT_EXCEEDED",
    "Too many parts for source wheel attachment review",
  );
  ensure(
    lookup.size === all.length,
    "INVALID_INPUT",
    "Wheel attachment occurrences must be unique",
  );
  const mounts = reviewedAxleWheelMounts(
    all,
    options.reserved,
    options.bounds,
    options.limits,
  );
  const attachments: SourceAssemblyEdge[] = mounts.edges.map((edge) => {
    const a = lookup.get(edge.a)!,
      b = lookup.get(edge.b)!,
      fixed = edge.kind === "tyre-fit" || edge.kind === "axial-retainer";
    let pivot: Vec3 | undefined,
      axis: Vec3 | undefined,
      featureA: string,
      featureB: string;
    switch (edge.kind) {
      case "tyre-fit":
        featureA = "source-stepped-rim-seat";
        featureB = "source-matching-rubber-groove";
        break;
      case "axial-retainer":
        featureA =
          a.node.ref === "4261.dat" ? "source-keyed-arm-bore" : "shaft";
        featureB =
          b.node.ref === "3749.dat"
            ? "source-keyed-pin-end"
            : "source-keyed-bush";
        break;
      case "round-bearing":
        pivot = point(b, b.node.ref === "2695.dat" ? [0, 0, 0] : [0, 10, 0]);
        axis = direction(a, [1, 0, 0]);
        featureA = "shaft";
        featureB =
          b.node.ref === "2695.dat"
            ? "source-round-wheel-hub"
            : "source-round-frame-bore";
        break;
      case "inter-rim-pin":
        pivot = point(b, [0, 0, 0]);
        axis = direction(b, [1, 0, 0]);
        featureA = "source-offset-round-rim-bore";
        featureB = "source-joining-pin";
        break;
      case "retained-pivot":
        pivot = point(a, [0, 0, 0]);
        axis = direction(a, a.node.ref === "4261.dat" ? [0, 1, 0] : [1, 0, 0]);
        featureA =
          a.node.ref === "4261.dat"
            ? "source-arm-pivot-pins"
            : "source-link-round-pin";
        featureB = "source-capturing-plate-socket";
        break;
    }
    return {
      a: edge.a,
      b: edge.b,
      kind: fixed ? "fixed" : "articulated",
      evidence: {
        profile: `source-wheel-${edge.kind}`,
        featureA,
        featureB,
      },
      ...(pivot ? { pivot, axis } : {}),
    };
  });
  return {
    assemblies: mounts.assemblies,
    attachments,
    skipped: mounts.skipped,
  };
}
