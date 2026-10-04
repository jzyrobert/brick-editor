import RAPIER from "@dimforge/rapier3d-compat";
import { ConvexGeometry } from "three/examples/jsm/geometries/ConvexGeometry.js";
import { Quaternion, Vector3 } from "three";
import { occurrences } from "../core/document";
import {
  add,
  inverse,
  mv,
  compose,
  identity,
  orthonormalized,
} from "../core/math";
import { ensure, type Transform, type Vec3 } from "../core/types";
import { worldMechanicalFeatures } from "../mechanisms/mechanical-contacts";
import type { MotionRig } from "../mechanisms/types";
import { anchoredGroup } from "../mechanisms/dynamics-settings";
import { unsupportedMechanicalPlayContact } from "../mechanisms/mechanical-play-support";
import type { PlayMechanismSource } from "./mechanism";
import { METRES_PER_LDU as S, toPhysics, frameRotation } from "./physics-frame";
import type { CollisionSnapshot } from "./types";
import { surfaceCompound, surfaceCompoundLocal } from "./surface-compound";

export const MECHANICAL_CONTACT_LIMITS = Object.freeze({
  solids: 4096,
  solidsPerMember: 4096,
  hullPoints: 256,
  sourceVertices: 600000,
  sourcePointsPerMember: 16384,
  enumeration: 200000,
  queryColliders: 512,
  queryVertices: 3000000,
  queryTriangles: 1000000,
  clippingWork: 200000,
  pairChecks: 200000,
  sweepSegments: 1024,
  sweepLdu: 0.25,
});
export type MechanicalSolid = {
  groupId: string;
  memberId?: string;
  shape: RAPIER.Shape;
  points: Float32Array;
  bounds: { min: Vec3; max: Vec3 };
  childCount: number;
  radius: number;
  /** Explicit bearing regions that wholly contain this solid at rest. */
  mating: Set<string>;
  feature?: "spur-gear" | "rack" | "rack-guide";
};
type Bearing = {
  id: string;
  a: string;
  b: string;
  pivot: Vec3;
  normals: Vec3[];
  extents: number[];
};
const dot = (a: Vec3, b: Vec3) => a.reduce((v, n, k) => v + n * b[k], 0);
function bearingNormals(axis?: Vec3): Vec3[] {
  if (!axis)
    return [
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
    ];
  const helper: Vec3 = Math.abs(axis[0]) < 0.8 ? [1, 0, 0] : [0, 1, 0];
  const cross = (a: Vec3, b: Vec3): Vec3 => [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
  const p = cross(axis, helper),
    length = Math.hypot(...p),
    n = p.map((v) => v / length) as Vec3;
  return [n, cross(axis, n)];
}
const position = (frame: Transform, p: Vec3) =>
  add(frame.position, mv(frame.basis, p));

/** Contacts are local bearing regions, rigid welds, or explicitly authored
 * ideal tooth meshes. Sharing a rig never supplies an exclusion. */
export class MechanicalContactPolicy {
  readonly bearings: Bearing[];
  private fixedRoots = new Map<string, string>();
  private meshes = new Map<string, Set<string>>();
  private bearingsByPair = new Map<string, Map<string, Bearing[]>>();
  constructor(rig: MotionRig, _source?: PlayMechanismSource) {
    const groups = new Map(rig.groups.map((g) => [g.id, g]));
    this.bearings = [...rig.joints, ...(rig.loopClosures ?? [])]
      .filter((j) => j.kind === "revolute" && j.mating)
      .map((j) => {
        const axis = mv(groups.get(j.bodyA)!.frame.basis, j.axisA!),
          normals = [...bearingNormals(axis), axis];
        return {
          id: j.id,
          a: j.bodyA,
          b: j.bodyB,
          pivot: position(groups.get(j.bodyA)!.frame, j.anchorA),
          normals,
          extents: [
            j.mating!.radiusLdu,
            j.mating!.radiusLdu,
            j.mating!.halfLengthLdu,
          ],
        };
      });
    const parent = new Map(rig.groups.map((g) => [g.id, g.id]));
    const root = (id: string): string =>
      parent.get(id) === id ? id : root(parent.get(id)!);
    for (const j of rig.joints)
      if (j.kind === "fixed") parent.set(root(j.bodyB), root(j.bodyA));
    for (const group of rig.groups)
      this.fixedRoots.set(group.id, root(group.id));
    for (const t of rig.transmissions ?? []) {
      const a = rig.joints.find((j) => j.id === t.jointA)!;
      const b = rig.joints.find((j) => j.id === t.jointB)!;
      for (const [from, to] of [
        [a.bodyB, b.bodyB],
        [b.bodyB, a.bodyB],
      ]) {
        const adjacent = this.meshes.get(from) ?? new Set<string>();
        adjacent.add(to);
        this.meshes.set(from, adjacent);
      }
    }
    for (const bearing of this.bearings)
      for (const [from, to] of [
        [bearing.a, bearing.b],
        [bearing.b, bearing.a],
      ]) {
        const adjacent =
          this.bearingsByPair.get(from) ?? new Map<string, Bearing[]>();
        const list = adjacent.get(to) ?? [];
        list.push(bearing);
        adjacent.set(to, list);
        this.bearingsByPair.set(from, adjacent);
      }
  }
  allowed(
    a: MechanicalSolid,
    b:
      | MechanicalSolid
      | { groupId: string; memberId?: string; feature?: "rack-guide" },
  ) {
    const fixedRoot = this.fixedRoots.get(a.groupId);
    if (
      a.groupId === b.groupId ||
      (fixedRoot !== undefined && fixedRoot === this.fixedRoots.get(b.groupId))
    )
      return true;
    if (
      "feature" in b &&
      this.meshes.get(a.groupId)?.has(b.groupId) &&
      a.feature &&
      b.feature &&
      (a.feature === "spur-gear" || b.feature === "spur-gear")
    )
      return true;
    return (
      this.bearingsByPair
        .get(a.groupId)
        ?.get(b.groupId)
        ?.some(
          (bearing) =>
            a.mating.has(bearing.id) ||
            ("mating" in b && b.mating.has(bearing.id)),
        ) ?? false
    );
  }
}

function bounds(points: Vec3[]) {
  const min: Vec3 = [Infinity, Infinity, Infinity],
    max: Vec3 = [-Infinity, -Infinity, -Infinity];
  for (const p of points)
    for (let k = 0; k < 3; k++) {
      min[k] = Math.min(min[k], p[k]);
      max[k] = Math.max(max[k], p[k]);
    }
  return { min, max };
}
/** Convex clipping includes intersections with hull edges, rather than selecting
 * vertices and shrinking the original proxy. */
function split(
  points: Vec3[],
  normal: Vec3,
  plane: number,
  work: { value: number },
) {
  const left = points.filter((p) => dot(p, normal) <= plane + 1e-8),
    right = points.filter((p) => dot(p, normal) >= plane - 1e-8);
  if (!left.length || !right.length) return [points];
  const hull = new ConvexGeometry(points.map((p) => new Vector3(...p)));
  const vertices = hull.getAttribute("position");
  for (let i = 0; i < vertices.count; i += 3)
    for (let j = 0; j < 3; j++) {
      ensure(
        ++work.value <= MECHANICAL_CONTACT_LIMITS.clippingWork,
        "LIMIT_EXCEEDED",
        "Mechanical proxy clipping work exhausted",
      );
      const a = new Vector3()
        .fromBufferAttribute(vertices, i + j)
        .toArray() as Vec3;
      const b = new Vector3()
        .fromBufferAttribute(vertices, i + ((j + 1) % 3))
        .toArray() as Vec3;
      if ((dot(a, normal) - plane) * (dot(b, normal) - plane) < 0) {
        const t = (plane - dot(a, normal)) / (dot(b, normal) - dot(a, normal));
        const p = a.map((v, k) => v + (b[k] - v) * t) as Vec3;
        left.push(p);
        right.push(p);
      }
    }
  hull.dispose();
  const unique = (p: Vec3[]) => [
    ...new Map(
      p.map((v) => [v.map((n) => n.toFixed(8)).join(","), v]),
    ).values(),
  ];
  return [unique(left), unique(right)].filter(
    (p) =>
      p.length >= 4 &&
      [0, 1, 2].every((k) => bounds(p).max[k] - bounds(p).min[k] > 1e-7),
  );
}
function clip2(
  poly: number[][],
  normal: number[],
  plane: number,
  inside: boolean,
) {
  const out: number[][] = [],
    distance = (p: number[]) => p[0] * normal[0] + p[1] * normal[1] - plane;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i],
      b = poly[(i + 1) % poly.length],
      da = distance(a),
      db = distance(b);
    const keepA = inside ? da <= 1e-8 : da >= -1e-8,
      keepB = inside ? db <= 1e-8 : db >= -1e-8;
    if (keepA) out.push(a);
    if (keepA !== keepB) {
      const t = da / (da - db);
      out.push(a.map((v, k) => v + (b[k] - v) * t));
    }
  }
  return out;
}
/** Source-reviewed 3700/3701/3702 round bores survive as sixteen-sided
 * openings with 0.1 LDU ideal-bearing clearance. The outer envelope remains
 * a simplified brick solid, including studs/undersides, just like a hull. */
function boreSolids(
  mesh: CollisionSnapshot,
  occurrence: ReturnType<typeof occurrences>[number],
) {
  const features = worldMechanicalFeatures(occurrence);
  const holes = features?.filter((f) => f.kind === "round-hole");
  if (
    !holes?.length ||
    !["3700.dat", "3701.dat", "3702.dat"].includes(occurrence.node.ref)
  )
    return undefined;
  const inv = inverse(occurrence.transform),
    local: Vec3[] = [];
  for (let i = 0; i < mesh.vertices.length; i += 3)
    local.push(
      position(inv, Array.from(mesh.vertices.slice(i, i + 3)) as Vec3),
    );
  const box = bounds(local),
    centers = holes
      .map((h) => position(inv, h.center))
      .sort((a, b) => a[0] - b[0]);
  const result: Vec3[][] = [];
  for (let h = 0; h < centers.length; h++) {
    const c = centers[h],
      low = h ? (centers[h - 1][0] + c[0]) / 2 : box.min[0],
      high =
        h + 1 < centers.length ? (centers[h + 1][0] + c[0]) / 2 : box.max[0];
    let poly = [
      [low, box.min[1]],
      [high, box.min[1]],
      [high, box.max[1]],
      [low, box.max[1]],
    ];
    for (let n = 0; n < 16 && poly.length; n++) {
      const normal = [Math.cos((n * Math.PI) / 8), Math.sin((n * Math.PI) / 8)];
      const plane = c[0] * normal[0] + c[1] * normal[1] + 6.1;
      const outside = clip2(poly, normal, plane, false);
      if (outside.length >= 3)
        result.push(
          outside.flatMap((p) =>
            [box.min[2], box.max[2]].map((z) =>
              position(occurrence.transform, [p[0], p[1], z]),
            ),
          ),
        );
      poly = clip2(poly, normal, plane, true);
    }
  }
  return result;
}
function rackSolids(
  mesh: CollisionSnapshot,
  occurrence: ReturnType<typeof occurrences>[number],
) {
  if (
    !["18942.dat", "3647.dat", "3648b.dat"].includes(occurrence.node.ref) ||
    !worldMechanicalFeatures(occurrence)?.some((f) =>
      ["rack-slide", "spur-gear"].includes(f.kind),
    )
  )
    return undefined;
  return surfaceCompound(mesh, occurrence.transform, occurrence.node.ref);
}

export function mechanicalSolids(
  source: PlayMechanismSource,
  policy: MechanicalContactPolicy,
) {
  const rig = source.project.motionRigs[source.rigId],
    lookup =
      source.lookup ??
      new Map(occurrences(source.project).map((o) => [o.id, o]));
  const input = source.members
    ? Object.values(source.members)
    : Object.values(source.groups);
  ensure(
    input.reduce((n, m) => n + m.vertices.length / 3, 0) <=
      MECHANICAL_CONTACT_LIMITS.sourceVertices,
    "LIMIT_EXCEEDED",
    "Mechanical source vertex budget exhausted",
  );
  const out: MechanicalSolid[] = [],
    work = { value: 0 };
  for (const group of rig.groups) {
    if (
      anchoredGroup(rig, group.id) ||
      rig.vehicle?.wheels.some((w) => w.groupId === group.id)
    )
      continue;
    const entries = source.members
      ? group.occurrenceIds.map((id) => [id, source.members![id]] as const)
      : [[undefined, source.groups[group.id]] as const];
    for (const [id, mesh] of entries) {
      if (!mesh?.indices.length) continue;
      const occurrence = id ? lookup.get(id) : undefined;
      ensure(
        occurrence?.node.ref !== "18940.dat",
        "INVALID_INPUT",
        "This moving rack housing needs a reviewed hollow collision proxy. Anchor its frame and try again.",
      );
      const memberLocal = id
        ? (
            source as PlayMechanismSource & {
              memberLocals?: Record<
                string,
                {
                  vertices: Float64Array;
                  indices: Uint32Array;
                  frame: Transform;
                }
              >;
            }
          ).memberLocals?.[id]
        : undefined;
      const canonical =
        occurrence &&
        memberLocal &&
        worldMechanicalFeatures(occurrence) &&
        [
          "3700.dat",
          "3701.dat",
          "3702.dat",
          "3647.dat",
          "3648b.dat",
          "18942.dat",
        ].includes(occurrence.node.ref);
      // Use the same rounded-rotation realization as reviewed feature frames.
      // Canonical vertices stay unchanged; only their rigid child pose moves.
      const partFrame = canonical
        ? orthonormalized(occurrence.transform)
        : undefined;
      const geometryBearings = partFrame
        ? policy.bearings.map((b) => {
            const inv = inverse(partFrame);
            return {
              ...b,
              pivot: position(inv, b.pivot),
              normals: b.normals.map((n) => mv(inv.basis, n)),
            };
          })
        : policy.bearings;
      let pieces = canonical
        ? (boreSolids(memberLocal as unknown as CollisionSnapshot, {
            ...occurrence,
            transform: identity(),
          }) ?? surfaceCompoundLocal(memberLocal, occurrence.node.ref))
        : occurrence
          ? (boreSolids(mesh, occurrence) ?? rackSolids(mesh, occurrence))
          : undefined;
      if (!pieces) {
        const points: Vec3[] = [],
          seen = new Set<string>();
        for (let i = 0; i < mesh.vertices.length; i += 3) {
          const p = Array.from(mesh.vertices.slice(i, i + 3)) as Vec3,
            k = p.join(",");
          if (!seen.has(k)) {
            seen.add(k);
            points.push(p);
          }
        }
        if (!points.length) continue;
        ensure(
          points.length <= MECHANICAL_CONTACT_LIMITS.sourcePointsPerMember,
          "LIMIT_EXCEEDED",
          "Mechanical member source point budget exhausted",
        );
        // Flat members retain the existing thin-envelope behavior.
        const box = bounds(points);
        if ([0, 1, 2].some((k) => box.max[k] - box.min[k] < 1e-6)) {
          for (let k = 0; k < 3; k++)
            if (box.max[k] - box.min[k] < 1e-6) {
              box.min[k] -= 0.5;
              box.max[k] += 0.5;
            }
          pieces = [
            Array.from(
              { length: 8 },
              (_, n) =>
                [0, 1, 2].map((k) =>
                  n & (1 << k) ? box.max[k] : box.min[k],
                ) as Vec3,
            ),
          ];
        } else {
          const hull = new ConvexGeometry(points.map((p) => new Vector3(...p))),
            vertices = hull.getAttribute("position");
          const extremes: Vec3[] = [],
            seen = new Set<string>();
          for (let i = 0; i < vertices.count; i++) {
            const p = new Vector3()
                .fromBufferAttribute(vertices, i)
                .toArray() as Vec3,
              k = p.join(",");
            if (!seen.has(k)) {
              seen.add(k);
              extremes.push(p);
            }
          }
          hull.dispose();
          ensure(
            extremes.length <= MECHANICAL_CONTACT_LIMITS.hullPoints,
            "LIMIT_EXCEEDED",
            "Mechanical convex hull exceeds 256 boundary vertices",
          );
          pieces = [extremes];
        }
      }
      for (const bearing of geometryBearings.filter(
        (b) => b.a === group.id || b.b === group.id,
      )) {
        const all = pieces.flat();
        // Preserve the original hull when it already fits the declared round
        // cylinder. Inscribed radial cuts add unnecessary boundary vertices
        // to round collars after an oblique Float32 source transform.
        if (
          all.every((p) => {
            const offset = p.map((v, k) => v - bearing.pivot[k]) as Vec3;
            return (
              Math.hypot(
                dot(offset, bearing.normals[0]),
                dot(offset, bearing.normals[1]),
              ) <= bearing.extents[0] &&
              Math.abs(dot(offset, bearing.normals[2])) <= bearing.extents[2]
            );
          })
        )
          continue;
        if (
          bearing.normals.some(
            (normal, n) =>
              all.every(
                (p) =>
                  dot(p.map((v, k) => v - bearing.pivot[k]) as Vec3, normal) >
                  bearing.extents[n],
              ) ||
              all.every(
                (p) =>
                  dot(p.map((v, k) => v - bearing.pivot[k]) as Vec3, normal) <
                  -bearing.extents[n],
              ),
          )
        )
          continue;
        pieces = pieces.flatMap((piece) => {
          let inner = [piece];
          const outer: Vec3[][] = [];
          const radialInside = piece.every((p) => {
            const offset = p.map((v, k) => v - bearing.pivot[k]) as Vec3;
            return (
              Math.hypot(
                dot(offset, bearing.normals[0]),
                dot(offset, bearing.normals[1]),
              ) <= bearing.extents[0]
            );
          });
          const planes: Array<[Vec3, number]> = Array.from(
            { length: radialInside ? 0 : 16 },
            (_, n) => {
              const angle = ((n + 0.5) * Math.PI) / 8;
              return [
                bearing.normals[0].map(
                  (v, k) =>
                    v * Math.cos(angle) +
                    bearing.normals[1][k] * Math.sin(angle),
                ) as Vec3,
                bearing.extents[0] * Math.cos(Math.PI / 16),
              ];
            },
          );
          planes.push(
            [bearing.normals[2], bearing.extents[2]],
            [bearing.normals[2].map((v) => -v) as Vec3, bearing.extents[2]],
          );
          for (const [normal, extent] of planes) {
            const plane = dot(bearing.pivot, normal) + extent,
              next: Vec3[][] = [];
            for (const candidate of inner)
              for (const cut of split(candidate, normal, plane, work)) {
                if (cut.every((p) => dot(p, normal) <= plane + 1e-6))
                  next.push(cut);
                else outer.push(cut);
              }
            inner = next;
          }
          return [...outer, ...inner];
        });
        ensure(
          pieces.length <= MECHANICAL_CONTACT_LIMITS.solidsPerMember,
          "LIMIT_EXCEEDED",
          "Mechanical member compound exceeds 4,096 solids",
        );
      }
      const feature =
        occurrence &&
        worldMechanicalFeatures(occurrence)?.find(
          (f) => f.kind === "spur-gear" || f.kind === "rack",
        )?.kind;
      for (const sourcePiece of pieces) {
        let piece = sourcePiece;
        if (piece.length > MECHANICAL_CONTACT_LIMITS.hullPoints) {
          const hull = new ConvexGeometry(piece.map((p) => new Vector3(...p))),
            vertices = hull.getAttribute("position"),
            extremes = new Map<string, Vec3>();
          for (let i = 0; i < vertices.count; i++) {
            const p = new Vector3()
              .fromBufferAttribute(vertices, i)
              .toArray() as Vec3;
            extremes.set(p.map((n) => n.toFixed(8)).join(","), p);
          }
          hull.dispose();
          piece = [...extremes.values()];
        }
        ensure(
          piece.length <= MECHANICAL_CONTACT_LIMITS.hullPoints,
          "LIMIT_EXCEEDED",
          "Mechanical convex solid exceeds 256 boundary vertices",
        );
        const inv = inverse(group.frame),
          relative = partFrame ? compose(inv, partFrame) : undefined,
          nativePosition = relative
            ? toPhysics(relative.position)
            : { x: 0, y: 0, z: 0 },
          nativeRotation = relative
            ? frameRotation(relative).normalize()
            : new Quaternion(),
          hullPoints = Float32Array.from(
            piece.flatMap((p) => {
              const q = toPhysics(partFrame ? p : position(inv, p));
              return [q.x, q.y, q.z];
            }),
          ),
          points = relative
            ? Float32Array.from(
                Array.from({ length: hullPoints.length / 3 }, (_, i) => {
                  const p = new Vector3(
                    hullPoints[i * 3],
                    hullPoints[i * 3 + 1],
                    hullPoints[i * 3 + 2],
                  ).applyQuaternion(nativeRotation);
                  return [
                    p.x + nativePosition.x,
                    p.y + nativePosition.y,
                    p.z + nativePosition.z,
                  ];
                }).flat(),
              )
            : hullPoints;
        const desc = RAPIER.ColliderDesc.convexHull(hullPoints);
        ensure(
          desc,
          "INVALID_INPUT",
          "A mechanical compound solid could not be prepared",
        );
        if (relative) {
          const raw = desc.shape.intoRaw();
          ensure(
            raw,
            "INVALID_INPUT",
            "This part cannot be checked safely. Try a simpler mechanism.",
            { memberId: id, feature, stage: "canonicalNativeAdmission" },
          );
          raw.free();
        }
        out.push({
          groupId: group.id,
          memberId: id,
          shape: relative
            ? new RAPIER.Compound(
                [desc.shape],
                [nativePosition],
                [nativeRotation],
              )
            : desc.shape,
          points,
          childCount: 1,
          bounds: bounds(
            Array.from(
              { length: points.length / 3 },
              (_, n) => Array.from(points.slice(3 * n, 3 * n + 3)) as Vec3,
            ),
          ),
          radius: Array.from(
            { length: points.length / 3 },
            (_, i) =>
              Math.hypot(points[i * 3], points[i * 3 + 1], points[i * 3 + 2]) /
              S,
          ).reduce((r, n) => Math.max(r, n), 0),
          mating: new Set(
            geometryBearings
              .filter(
                (b) =>
                  (b.a === group.id || b.b === group.id) &&
                  piece.every((p) => {
                    const offset = p.map((v, k) => v - b.pivot[k]) as Vec3;
                    return (
                      Math.hypot(
                        dot(offset, b.normals[0]),
                        dot(offset, b.normals[1]),
                      ) <=
                        b.extents[0] + 0.001 &&
                      Math.abs(dot(offset, b.normals[2])) <=
                        b.extents[2] + 0.001
                    );
                  }),
              )
              .map((b) => b.id),
          ),
          ...(feature === "spur-gear" || feature === "rack" ? { feature } : {}),
        });
        ensure(
          out.length <= MECHANICAL_CONTACT_LIMITS.solids,
          "LIMIT_EXCEEDED",
          "Mechanical contact proxy budget exceeds 4,096 solids",
        );
      }
    }
  }
  const classes = new Map<string, MechanicalSolid[]>();
  for (const solid of out) {
    const k = JSON.stringify([
      solid.groupId,
      solid.memberId,
      solid.feature,
      [...solid.mating].sort(),
    ]);
    const list = classes.get(k) ?? [];
    list.push(solid);
    classes.set(k, list);
  }
  return [...classes.values()].map((children) => {
    if (children.length === 1) return children[0];
    const local = children.flatMap((s) =>
      Array.from(
        { length: s.points.length / 3 },
        (_, i) => Array.from(s.points.slice(3 * i, 3 * i + 3)) as Vec3,
      ),
    );
    return {
      ...children[0],
      shape: new RAPIER.Compound(
        children.flatMap((s) =>
          s.shape instanceof RAPIER.Compound ? s.shape.shapes : [s.shape],
        ),
        children.flatMap((s) =>
          s.shape instanceof RAPIER.Compound
            ? s.shape.positions
            : [{ x: 0, y: 0, z: 0 }],
        ),
        children.flatMap((s) =>
          s.shape instanceof RAPIER.Compound
            ? s.shape.rotations
            : [{ x: 0, y: 0, z: 0, w: 1 }],
        ),
      ),
      points: Float32Array.from(local.flat()),
      bounds: bounds(local),
      radius: Math.max(...children.map((s) => s.radius)),
      childCount: children.reduce((n, s) => n + s.childCount, 0),
    };
  });
}

/** Exact per-member stationary surfaces keep a reviewed guide distinct from
 * neighboring structural pieces. These are private query shapes, not extra
 * walking geometry. */
export function mechanicalStationarySolids(source: PlayMechanismSource) {
  const rig = source.project.motionRigs[source.rigId],
    lookup =
      source.lookup ??
      new Map(occurrences(source.project).map((o) => [o.id, o]));
  const out: MechanicalSolid[] = [];
  for (const group of rig.groups) {
    const entries = source.members
      ? group.occurrenceIds.map((id) => [id, source.members![id]] as const)
      : [[undefined, source.groups[group.id]] as const];
    for (const [memberId, mesh] of entries) {
      if (!mesh?.indices.length) continue;
      const inv = inverse(group.frame),
        local: Vec3[] = [];
      for (let i = 0; i < mesh.vertices.length; i += 3) {
        const p = toPhysics(
          position(inv, Array.from(mesh.vertices.slice(i, i + 3)) as Vec3),
        );
        local.push([p.x, p.y, p.z]);
      }
      const points = Float32Array.from(local.flat()),
        occurrence = memberId && lookup.get(memberId);
      out.push({
        groupId: group.id,
        memberId,
        shape: new RAPIER.TriMesh(points, mesh.indices.slice()),
        points,
        childCount: 1,
        bounds: bounds(local),
        radius: local.reduce((r, p) => Math.max(r, Math.hypot(...p)), 0) / S,
        mating: new Set(),
        ...(occurrence &&
        worldMechanicalFeatures(occurrence)?.some(
          (f) => f.kind === "rack-guide",
        )
          ? { feature: "rack-guide" as const }
          : {}),
      });
    }
  }
  return out;
}

export type PreparedMechanicalSource = {
  policy: MechanicalContactPolicy;
  solids: MechanicalSolid[];
  stationary: MechanicalSolid[];
};
/** Aggregate child-solid cap before any native rig/proxy allocation. */
export function prepareMechanicalSources(sources: PlayMechanismSource[]) {
  const prepared = new Map<string, PreparedMechanicalSource>();
  let count = 0,
    vertices = 0;
  for (const source of sources) {
    for (const mesh of Object.values(source.members ?? source.groups))
      vertices += mesh.vertices.length / 3;
    ensure(
      vertices <= MECHANICAL_CONTACT_LIMITS.sourceVertices,
      "LIMIT_EXCEEDED",
      "Combined mechanical source vertex budget exhausted",
    );
    const unsupported = unsupportedMechanicalPlayContact(
      source.project,
      source.project.motionRigs[source.rigId],
      source.lookup,
    );
    ensure(
      !unsupported,
      "INVALID_INPUT",
      unsupported?.reason ?? "Unsupported mechanical contact",
      unsupported,
    );
    const policy = new MechanicalContactPolicy(
        source.project.motionRigs[source.rigId],
        source,
      ),
      solids = mechanicalSolids(source, policy);
    count += solids.reduce((n, s) => n + s.childCount, 0);
    ensure(
      count <= MECHANICAL_CONTACT_LIMITS.solids,
      "LIMIT_EXCEEDED",
      "Combined mechanical contact proxies exceed 4,096 child solids",
    );
    prepared.set(source.rigId, {
      policy,
      solids,
      stationary: mechanicalStationarySolids(source),
    });
  }
  return prepared;
}
