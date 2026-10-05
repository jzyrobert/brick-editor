import { Group, Mesh, Vector3 } from "three";
import { LDrawLoader } from "three/examples/jsm/loaders/LDrawLoader.js";
import { LDrawConditionalLineMaterial } from "three/examples/jsm/materials/LDrawConditionalLineMaterial.js";
import { directReferences } from "../catalog/full-pack";
import { occurrences } from "../core/document";
import { add, mv } from "../core/math";
import {
  ensure,
  type Occurrence,
  type Project,
  type Transform,
  type Vec3,
} from "../core/types";
import { normalizeBfcSource } from "../render/bfc-source";
import { occurrenceRenderContext } from "../render/source-context";
import type { PlayMemberLocalGeometry } from "../play/types";
import { bindRetainedWinchSources, retainedWinch } from "./retained-winch";
import {
  bindWinchCarrierSources,
  winchCarrierPlan,
  type WinchCarrierPlan,
} from "./winch-carrier";
import {
  winchConvexRegions,
  WINCH_SOURCE_PLANE_ENVELOPE_LDU,
} from "./winch-convex";

type Geometry = { points: Vec3[]; triangles: number[] };
export type WinchCollisionRegion = Readonly<{
  kind: "source-trimesh" | "source-convex";
  /** Owner's original basis is ALREADY applied. Centered on owner.frame.position
   * in LDU; apply toPhysics only. Native body rest quaternion is identity. */
  points: readonly Readonly<Vec3>[];
  triangles?: readonly number[];
  contactClass: "core" | "tooth";
  source: string;
}>;
export type SourceBoundWinchCollision = Readonly<{
  plan: WinchCarrierPlan;
  owners: readonly Readonly<{
    occurrenceId: string;
    ref: string;
    frame: Transform;
    regions: readonly WinchCollisionRegion[];
  }>[];
  rotorCaps: readonly Readonly<{
    occurrenceId: string;
    supportIds: readonly string[];
    center: Readonly<Vec3>;
    axis: Readonly<Vec3>;
    spanLdu: readonly [number, number];
    sourceHalfspaceErrorLdu: number;
  }>[];
  sourceTriangles: number;
  literalMeshTriangles: number;
  childCount: number;
  /** Declared existing finite flank-source reconciliation, not an allowance
   * for unrelated contacts or a general full-solid theorem. */
  rotorSourcePlaneEnvelopeLdu: number;
  captureBinding: "matched-canonical";
  nativeRestRotation: "identity";
  ordinaryAdmission: false;
}>;
const packets = new WeakMap<
  SourceBoundWinchCollision,
  { project: Project; revision: number }
>();
export const isSourceBoundWinchCollision = (
  value: unknown,
): value is SourceBoundWinchCollision =>
  !!value &&
  typeof value === "object" &&
  packets.has(value as SourceBoundWinchCollision);
export const winchCollisionMatchesProject = (
  packet: SourceBoundWinchCollision,
  project: Project,
) => {
  const bound = packets.get(packet);
  return bound?.project === project && bound.revision === project.revision;
};

/** Oriented F32 face multiset. Preserve winding and duplicate faces; material,
 * vertex and index ordering cannot alter the actual source geometry binding. */
function signature(vertices: ArrayLike<number>, indices: ArrayLike<number>) {
  const points = Array.from({ length: vertices.length / 3 }, (_, i) =>
    [0, 1, 2].map((k) => Math.fround(vertices[3 * i + k])).join(","),
  );
  const faces: string[] = [];
  for (let i = 0; i < indices.length; i += 3) {
    const p = [
      points[indices[i]],
      points[indices[i + 1]],
      points[indices[i + 2]],
    ];
    faces.push(
      [
        p.join(";"),
        [p[1], p[2], p[0]].join(";"),
        [p[2], p[0], p[1]].join(";"),
      ].sort()[0],
    );
  }
  return faces.sort().join("\n");
}
function closure(
  sources: Readonly<Record<string, string>>,
  refs: readonly string[],
) {
  const out: Record<string, string> = {},
    pending = [...refs];
  let bytes = 0;
  while (pending.length) {
    const ref = pending.pop()!;
    if (Object.hasOwn(out, ref)) continue;
    const text = sources[ref];
    ensure(
      typeof text === "string",
      "INVALID_INPUT",
      "Missing bound winch source dependency: " + ref,
    );
    bytes += text.length;
    ensure(
      Object.keys(out).length < 1024 && bytes <= 8_000_000,
      "RESOURCE_LIMIT",
      "Winch geometry dependency budget exceeded.",
    );
    out[ref] = text;
    pending.push(...directReferences(text));
  }
  return out;
}
async function canonical(
  project: Project,
  o: Occurrence,
  sources: Record<string, string>,
): Promise<Geometry> {
  const context = occurrenceRenderContext(project, o),
    source = normalizeBfcSource(
      [
        "0 FILE __winch_collision__.ldr",
        "0 !COLOUR WinchGrey CODE 71 VALUE #888888 EDGE #333333",
        context.source,
        `1 ${o.colorCode} 0 0 0 1 0 0 0 1 0 0 0 1 ${o.node.ref}`,
      ].join("\n"),
    );
  const loader = new LDrawLoader().setConditionalLineMaterial(
    LDrawConditionalLineMaterial,
  );
  loader.setFileMap(
    Object.fromEntries(Object.keys(sources).map((ref) => [ref, ref])),
  );
  (
    loader as unknown as {
      partsCache: {
        parseCache: { fetchData: (ref: string) => Promise<string> };
      };
    }
  ).partsCache.parseCache.fetchData = async (ref) => {
    const text = sources[ref.toLowerCase().replaceAll("\\", "/")];
    ensure(text, "INVALID_INPUT", "Unbound canonical winch source: " + ref);
    return text;
  };
  const group = await new Promise<Group>((ok, fail) =>
    (
      loader.parse as unknown as (
        s: string,
        ok: (g: Group) => void,
        fail: (e: unknown) => void,
      ) => void
    )(source, ok, fail),
  );
  group.updateMatrixWorld(true);
  const points: Vec3[] = [],
    triangles: number[] = [];
  group.traverse((o) => {
    if (!(o instanceof Mesh)) return;
    const p = o.geometry.getAttribute("position"),
      offset = points.length;
    for (let i = 0; i < p.count; i++)
      points.push(
        new Vector3()
          .fromBufferAttribute(p, i)
          .applyMatrix4(o.matrixWorld)
          .toArray() as Vec3,
      );
    const index = o.geometry.index;
    for (let i = 0; i < (index?.count ?? p.count); i++)
      triangles.push(offset + (index ? index.getX(i) : i));
  });
  group.traverse((o) => {
    if (o instanceof Mesh) o.geometry.dispose();
  });
  ensure(
    points.length <= 16_384 &&
      triangles.length % 3 === 0 &&
      triangles.length / 3 <= 200_000 &&
      points.every((p) => p.every(Number.isFinite)),
    "RESOURCE_LIMIT",
    "Winch canonical geometry budget exceeded.",
  );
  return { points, triangles };
}
const frozenPoints = (points: readonly Vec3[]) =>
  Object.freeze(points.map((p) => Object.freeze([...p]) as Readonly<Vec3>));

/** Async actual-renderer collision binding before any native allocation. Every
 * source member retains its own owner, literal frame and full source faces.
 * Only the already reviewed worm/gear convex constructors replace their source
 * surfaces, preserving their keyed openings and literal tooth sectors. This
 * packet creates no ownership weld, fit friction or contact exemption. */
export async function prepareWinchCollision(
  project: Project,
  wormId: string,
  resolved: Readonly<Record<string, string>>,
  captured: Readonly<Record<string, PlayMemberLocalGeometry>>,
): Promise<SourceBoundWinchCollision> {
  const all = occurrences(project),
    worm = all.find((o) => o.id === wormId);
  ensure(
    worm,
    "INVALID_INPUT",
    "Missing actual mounted winch source occurrence.",
  );
  const binding = await bindWinchCarrierSources(resolved, project),
    plan = winchCarrierPlan(worm, all, binding),
    rotorBinding = await bindRetainedWinchSources(resolved, project),
    sources = closure(resolved, binding.refs),
    members = new Map(
      all
        .filter((o) => plan.bodies.some((b) => b.occurrenceId === o.id))
        .map((o) => [o.id, o]),
    );
  const cache = new Map<string, Geometry>();
  let sourceTriangles = 0,
    literalMeshTriangles = 0,
    childCount = 0;
  const owners: SourceBoundWinchCollision["owners"][number][] = [];
  for (const body of plan.bodies) {
    const member = members.get(body.occurrenceId)!,
      actual = captured[member.id],
      context = occurrenceRenderContext(project, member),
      key = member.node.ref + "\n" + member.colorCode + "\n" + context.source;
    let expected = cache.get(key);
    if (!expected) {
      expected = await canonical(project, member, sources);
      cache.set(key, expected);
    }
    ensure(
      actual &&
        !actual.unsupported &&
        actual.occurrenceId === member.id &&
        actual.namespace === "official" &&
        actual.revision === project.revision &&
        JSON.stringify(actual.frame) === JSON.stringify(member.transform) &&
        actual.vertices.length % 3 === 0 &&
        actual.indices.length % 3 === 0 &&
        actual.vertices.length / 3 <= 16_384 &&
        actual.indices.length / 3 <= 200_000 &&
        actual.vertices.every(Number.isFinite) &&
        actual.indices.every(
          (i) =>
            Number.isInteger(i) && i >= 0 && i < actual.vertices.length / 3,
        ),
      "INVALID_INPUT",
      "Actual canonical mounted winch capture is missing or stale.",
    );
    ensure(
      signature(expected.points.flat(), expected.triangles) ===
        signature(actual.vertices, actual.indices),
      "INVALID_INPUT",
      "Actual mounted winch canonical source geometry changed.",
    );
    sourceTriangles += actual.indices.length / 3;
    const regions: WinchCollisionRegion[] = [];
    if (member.node.ref === "4716.dat" || member.node.ref === "10928.dat") {
      for (const r of winchConvexRegions(rotorBinding, member.node.ref))
        regions.push(
          Object.freeze({
            kind: "source-convex",
            points: frozenPoints(
              r.points.map((p) => mv(member.transform.basis, p)),
            ),
            contactClass: r.contactClass,
            source: r.source,
          }),
        );
    } else {
      const points: Vec3[] = [];
      // Native inertia/bounds must not inherit an unreferenced capture vertex.
      // Retain the complete oriented face multiset, expanding its actual indices.
      for (const index of actual.indices)
        points.push(
          mv(
            member.transform.basis,
            Array.from(actual.vertices.slice(index * 3, index * 3 + 3)) as Vec3,
          ),
        );
      regions.push(
        Object.freeze({
          kind: "source-trimesh",
          points: frozenPoints(points),
          triangles: Object.freeze(points.map((_, index) => index)),
          contactClass: "core",
          source: member.node.ref + " complete actual oriented canonical faces",
        }),
      );
      literalMeshTriangles += actual.indices.length / 3;
    }
    childCount += regions.length;
    const frame = structuredClone(member.transform);
    Object.freeze(frame.position);
    Object.freeze(frame.basis);
    owners.push(
      Object.freeze({
        occurrenceId: member.id,
        ref: member.node.ref,
        frame: Object.freeze(frame),
        regions: Object.freeze(regions),
      }),
    );
  }
  ensure(
    sourceTriangles <= 200_000 &&
      literalMeshTriangles <= 200_000 &&
      childCount <= 4096,
    "RESOURCE_LIMIT",
    "Mounted winch collision packet exceeds existing native limits.",
  );
  const witness = retainedWinch(worm, [...members.values()], rotorBinding),
    dot = (a: Readonly<Vec3>, b: Readonly<Vec3>) =>
      a.reduce((s, n, i) => s + n * b[i], 0),
    rotorCaps = witness.captures.map((c, index) => {
      const port = index === 0 ? witness.input : witness.output;
      let error = 0;
      for (const id of [c.memberId, ...c.supportIds]) {
        const owner = owners.find((o) => o.occurrenceId === id)!;
        for (const region of owner.regions)
          for (const p of region.points) {
            const world = add(owner.frame.position, p as Vec3),
              station = dot(
                world.map((n, i) => n - port.center[i]) as Vec3,
                port.axis,
              );
            error = Math.max(
              error,
              id === c.memberId
                ? Math.max(c.spanLdu[0] - station, station - c.spanLdu[1])
                : id === c.supportIds[0]
                  ? station - c.spanLdu[0]
                  : c.spanLdu[1] - station,
            );
          }
      }
      ensure(
        error <= 1e-6,
        "INVALID_INPUT",
        "Mounted winch source cap halfspaces are not separated.",
      );
      return Object.freeze({
        occurrenceId: c.memberId,
        supportIds: Object.freeze([...c.supportIds]),
        center: Object.freeze([...port.center]) as Readonly<Vec3>,
        axis: Object.freeze([...port.axis]) as Readonly<Vec3>,
        spanLdu: c.spanLdu,
        sourceHalfspaceErrorLdu: error,
      });
    });
  const packet: SourceBoundWinchCollision = Object.freeze({
    plan,
    owners: Object.freeze(owners),
    rotorCaps: Object.freeze(rotorCaps),
    sourceTriangles,
    literalMeshTriangles,
    childCount,
    rotorSourcePlaneEnvelopeLdu: WINCH_SOURCE_PLANE_ENVELOPE_LDU,
    captureBinding: "matched-canonical",
    nativeRestRotation: "identity",
    ordinaryAdmission: false,
  });
  packets.set(packet, { project, revision: project.revision });
  return packet;
}
