import { sha256 } from "../core/hash";
import {
  add,
  compose,
  mv,
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
import { verifyReviewedSourceClosures } from "../mechanisms/reviewed-source-closure";
import { assemblyStudConnectors } from "./reviewed-assembly-attachments";

export const FLEXIBLE_HOSE_SOURCES = Object.freeze({
  "752.dat": {
    files: 9,
    closureSha256:
      "472b144c74f1bac75be4382854fa4ca01aad3599a2b1cb097a4d8bd2835448c8",
  },
  "754.dat": {
    files: 7,
    closureSha256:
      "306822a20ff02cb7967038c122448b338dc7df6f51b3700d78c2d6f99b24d8ad",
  },
  "755.dat": {
    files: 8,
    closureSha256:
      "5562d13c1bdd488d3c9dc491399262ce6b09ff511411e92283182fef42619369",
  },
  "756.dat": {
    files: 6,
    closureSha256:
      "27c08eb14d5471fb119d73ab7082aff2ac1d190e38420c70d0d9c7fbdf43d30d",
  },
});
/** Full literal fallback geometry fingerprints, independent of model names.
 * Proprietary PATH authoring metadata is neither read nor copied. */
export const REVIEWED_FLEXIBLE_GEOMETRY = Object.freeze([
  "d4b15c2c0e53be857723129ceb5287264ffc3b8cbda29cc1f11c944402c3dd78",
  "a21a6f48fb4024146ab228fa7da2d87a05d589af048469e8ed06d99a17d22fec",
  "ff46765bc632c8dc06406a526ce6c65ee6693538c13a464abc2f16097ad06bdd",
  "4b9408fe20617c25ed145a40f235e8d26e084dc3a2df59ae7c20f5e1d62a30c1",
]);
export type FlexibleHoseSourceBinding = Readonly<{ refs: readonly string[] }>;
const bindings = new WeakMap<
  FlexibleHoseSourceBinding,
  { project: Project; revision: number }
>();
export async function bindFlexibleHoseSources(
  sources: Readonly<Record<string, string>>,
  project: Project,
) {
  const refs = await verifyReviewedSourceClosures(
    sources,
    FLEXIBLE_HOSE_SOURCES,
    Object.keys(FLEXIBLE_HOSE_SOURCES),
    { project },
  );
  const binding = Object.freeze({ refs });
  bindings.set(binding, { project, revision: project.revision });
  return binding;
}
export type SourceFlexibleComponent = {
  parentOccurrenceId: string;
  componentId: string;
  /** Source record identity disambiguates repeated references. */
  sourcePath: readonly { ref: string; viaRecordId?: string }[];
  ref: string;
  sourceClosureSha256: string;
  transform: Transform;
  role: "cap" | "end-section" | "flexible-segment";
};
export type SourceFlexibleEndpoint = {
  componentId: string;
  hostOccurrenceId: string;
  hostStudPoint: Vec3;
  point: Vec3;
  axis: Vec3;
  evidence: {
    profile: "source-752-stud-seat";
    feature: "antistud-Y18-radius6";
  };
};
export type SourceFlexibleHoseWitness = {
  parentOccurrenceId: string;
  geometrySha256: string;
  components: SourceFlexibleComponent[];
  endpoints: [SourceFlexibleEndpoint, SourceFlexibleEndpoint];
};
/** A flexible witness is NOT a SourceAssemblyEdge. Its two caps attach to real
 * host studs; source segment branches deform between them. The parent remains
 * one source/inventory occurrence; no rigid whole-hose teleport is authorized. */
export async function sourceFlexibleHoseWitness(
  project: Project,
  o: Occurrence,
  all: readonly Occurrence[],
  binding: FlexibleHoseSourceBinding,
): Promise<SourceFlexibleHoseWitness | undefined> {
  ensure(
    bindings.get(binding)?.project === project &&
      bindings.get(binding)?.revision === project.revision,
    "INVALID_INPUT",
    "Flexible hose needs verified source closures",
  );
  ensure(
    all.length <= 2048,
    "LIMIT_EXCEEDED",
    "Flexible hose attachment part budget exceeded",
  );
  if (o.namespace !== "project" || !nearlyPhysical(o.transform))
    return undefined;
  const model = project.models[o.node.ref];
  if (!model) return undefined;
  const geometry = model.records
    .filter((r) => /^[1-5]\s/.test(r.raw.trim()))
    .map((r) => r.raw.trim().replace(/\s+/g, " "))
    .join("\n");
  ensure(
    geometry.length <= 200000,
    "LIMIT_EXCEEDED",
    "Flexible source geometry budget exceeded",
  );
  const hash = await sha256(geometry);
  if (!REVIEWED_FLEXIBLE_GEOMETRY.includes(hash)) return undefined;
  const components: SourceFlexibleComponent[] = model.nodes.map((n) => {
    const profile =
      FLEXIBLE_HOSE_SOURCES[n.ref as keyof typeof FLEXIBLE_HOSE_SOURCES];
    ensure(
      profile && n.sourceRecordId && nearlyPhysical(n.transform),
      "INVALID_INPUT",
      "Unreviewed flexible source component",
    );
    return {
      parentOccurrenceId: o.id,
      componentId: JSON.stringify([o.id, n.sourceRecordId]),
      sourcePath: [
        { ref: o.node.ref },
        { ref: n.ref, viaRecordId: n.sourceRecordId },
      ],
      ref: n.ref,
      sourceClosureSha256: profile.closureSha256,
      transform: compose(o.transform, n.transform),
      role:
        n.ref === "752.dat"
          ? "cap"
          : n.ref === "755.dat"
            ? "end-section"
            : "flexible-segment",
    };
  });
  const caps = components.filter((c) => c.role === "cap");
  if (caps.length !== 2) return undefined;
  const studs = all.flatMap((o) =>
    assemblyStudConnectors(o).filter((c) => c.kind === "stud"),
  );
  ensure(
    studs.length <= 20000,
    "LIMIT_EXCEEDED",
    "Flexible hose stud review budget exceeded",
  );
  const endpoints: SourceFlexibleEndpoint[] = [];
  for (const c of caps) {
    const frame = orthonormalized(c.transform),
      point = add(frame.position, mv(frame.basis, [0, 18, 0])),
      axis = mv(frame.basis, [0, 1, 0]);
    const mates = studs.filter(
      (s) =>
        Math.hypot(...s.p.map((x, i) => x - point[i])) <= 0.05 &&
        s.axis.reduce((n, x, i) => n + x * axis[i], 0) <= -0.99999,
    );
    if (mates.length !== 1) return undefined;
    endpoints.push({
      componentId: c.componentId,
      hostOccurrenceId: mates[0].occurrenceId,
      hostStudPoint: mates[0].p,
      point,
      axis,
      evidence: {
        profile: "source-752-stud-seat",
        feature: "antistud-Y18-radius6",
      },
    });
  }
  return {
    parentOccurrenceId: o.id,
    geometrySha256: hash,
    components,
    endpoints: endpoints as [SourceFlexibleEndpoint, SourceFlexibleEndpoint],
  };
}
