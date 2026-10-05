import { sha256 } from "../core/hash";
import { installedSource } from "../catalog/catalog";
import { assemblySourcesMatch } from "./reviewed-assembly-attachments";
import { mv, nearlyPhysical, orthonormalized } from "../core/math";
import {
  ensure,
  type Occurrence,
  type Project,
  type Transform,
  type Vec3,
} from "../core/types";
import type { SourceAssemblyEdge } from "./source-assembly";
import type {
  SourceContactSurface,
  SourceTriangle,
} from "./source-support-contacts";

/** Reviewed literal embedded sticker geometries, identified by all geometry
 * records, never a model name. Pattern bytes/licence headers stay in the source.
 * Each box5-12 backing ends at localY0; no library source is modified. */
export const REVIEWED_ADHESIVE_BACKINGS = Object.freeze({
  "4843fe0156a626a6e5fed3b3997959f27f74df0b10808349ab91d6d9b0126cfe": [23, 16],
  "4ab981c0f19949543e25ce20f22e1eae5826ef97bad2f87505dee879a73098d1": [
    16, 22.371,
  ],
  "269dcb60216fc784eab605d921a45412eee1376de592bd903a7fce8c8aa4e2c3": [111, 23],
  f5678696844845fe7b442770253f495eb6f54fed51ca30ee28709741799a667b: [19, 9],
  "925b0730e6a85b26b94829087dc92eb2c93200c4a7d8fa528a8373cfd768aeba": [19, 9],
  "44a8c314b6ce76d40d67d4bcc7099c5de5bf93d18148222b4d8b26131f16af6b": [37, 15],
});
type Point = [number, number];
const area = (p: readonly Point[]) =>
  Math.abs(
    p.reduce((s, a, i) => {
      const b = p[(i + 1) % p.length];
      return s + a[0] * b[1] - a[1] * b[0];
    }, 0),
  ) / 2;
const signed = (p: readonly Point[]) =>
  p.reduce((s, a, i) => {
    const b = p[(i + 1) % p.length];
    return s + a[0] * b[1] - a[1] * b[0];
  }, 0);
const side = (a: Point, b: Point, p: Point) =>
  (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
function half(p: Point[], a: Point, b: Point, inside: boolean) {
  const out: Point[] = [];
  for (let i = 0; i < p.length; i++) {
    const c = p[i],
      d = p[(i + 1) % p.length],
      cs = side(a, b, c),
      ds = side(a, b, d);
    const ci = inside ? cs >= 0 : cs <= 0,
      di = inside ? ds >= 0 : ds <= 0;
    if (ci) out.push(c);
    if (ci !== di) {
      const t = cs / (cs - ds);
      out.push([c[0] + (d[0] - c[0]) * t, c[1] + (d[1] - c[1]) * t]);
    }
  }
  return out;
}
/** Subtract the actual union of coplanar source faces from the complete backing.
 * Vertex/center samples and bounds overlap cannot prove adhesive support over a
 * hole; leftover polygons expose unsupported gaps explicitly. */
export function sourceBackingCoverage(
  halfWidth: number,
  halfDepth: number,
  triangles: readonly SourceTriangle[],
) {
  ensure(
    halfWidth > 0 &&
      halfDepth > 0 &&
      Number.isFinite(halfWidth + halfDepth) &&
      halfWidth <= 1000 &&
      halfDepth <= 1000 &&
      triangles.length <= 20000,
    "LIMIT_EXCEEDED",
    "Adhesive backing geometry budget exceeded",
  );
  let missing: Point[][] = [
      [
        [-halfWidth, -halfDepth],
        [halfWidth, -halfDepth],
        [halfWidth, halfDepth],
        [-halfWidth, halfDepth],
      ],
    ],
    work = 0;
  const contributing: number[] = [];
  for (const [index, t] of triangles.entries()) {
    ensure(
      t.length === 3 &&
        t.every((p) => p.length === 3 && p.every(Number.isFinite)),
      "INVALID_INPUT",
      "Adhesive support needs finite source triangles",
    );
    if (t.some((p) => Math.abs(p[1]) > 0.05)) continue;
    const clip = t.map((p) => [p[0], p[2]] as Point);
    if (area(clip) < 1e-8) continue;
    if (signed(clip) < 0) clip.reverse();
    const before = missing.reduce((s, p) => s + area(p), 0),
      next: Point[][] = [];
    for (const p of missing) {
      ensure(
        ++work <= 200000,
        "LIMIT_EXCEEDED",
        "Adhesive backing face work budget exceeded",
      );
      let inside = p;
      for (let i = 0; i < 3 && inside.length; i++) {
        const a = clip[i],
          b = clip[(i + 1) % 3],
          outside = half(inside, a, b, false);
        if (area(outside) > 1e-8) next.push(outside);
        inside = half(inside, a, b, true);
      }
    }
    ensure(
      next.length <= 4096,
      "LIMIT_EXCEEDED",
      "Adhesive backing fragment budget exceeded",
    );
    missing = next;
    if (before - missing.reduce((s, p) => s + area(p), 0) > 1e-8)
      contributing.push(index);
    if (!missing.length) break;
  }
  const backingArea = 4 * halfWidth * halfDepth,
    missingArea = missing.reduce((s, p) => s + area(p), 0);
  return {
    backingAreaLdu2: backingArea,
    missingAreaLdu2: missingArea,
    coverage: 1 - missingArea / backingArea,
    unsupportedPolygons: missing,
    contributingTriangles: contributing,
  };
}
/** Rounded authored slope frames can leave a microscopic strip at the backing
 * rim. Permit at most0.05LDU there; this never excuses an interior unsupported
 * hole, a wider overhang, or a host/backing plane gap. */
export function sourceBackingSeated(
  halfWidth: number,
  halfDepth: number,
  coverage: ReturnType<typeof sourceBackingCoverage>,
) {
  if (coverage.missingAreaLdu2 <= 0.01) return true;
  const x = Math.max(0, halfWidth - 0.05),
    z = Math.max(0, halfDepth - 0.05),
    rim: Point[] = [
      [-x, -z],
      [x, -z],
      [x, z],
      [-x, z],
    ];
  return coverage.unsupportedPolygons.every((p) => {
    let interior = p;
    for (let i = 0; i < 4 && interior.length; i++)
      interior = half(interior, rim[i], rim[(i + 1) % 4], true);
    return area(interior) <= 1e-8;
  });
}
export type ReviewedStickerBacking = {
  occurrenceId: string;
  geometrySha256: string;
  halfWidth: number;
  halfDepth: number;
  transform: Transform;
};
const reviewed = new WeakMap<ReviewedStickerBacking, ReviewedStickerBacking>();
export async function reviewedStickerBacking(
  project: Project,
  o: Occurrence,
): Promise<ReviewedStickerBacking | undefined> {
  if (
    o.namespace !== "project" ||
    !nearlyPhysical(o.transform) ||
    !assemblySourcesMatch() ||
    Object.keys(project.models).some(installedSource)
  )
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
    "Sticker geometry budget exceeded",
  );
  const hash = await sha256(geometry),
    dimensions =
      REVIEWED_ADHESIVE_BACKINGS[
        hash as keyof typeof REVIEWED_ADHESIVE_BACKINGS
      ];
  if (!dimensions) return undefined;
  const backing = {
    occurrenceId: o.id,
    geometrySha256: hash,
    halfWidth: dimensions[0],
    halfDepth: dimensions[1],
    transform: structuredClone(o.transform),
  };
  reviewed.set(backing, structuredClone(backing));
  return backing;
}
/** Hosts must belong to one independently proven fixed source island. All host
 * triangles must come from the actual resolved source closure/collision mesh.
 * A reviewed pattern alone grants no attachment; its whole backing must seat.
 * This adapter creates visual attachment witnesses, never chassis welds. */
export function reviewedAdhesiveContacts(
  backing: ReviewedStickerBacking,
  hosts: readonly SourceContactSurface[],
) {
  const approved = reviewed.get(backing);
  ensure(
    approved && hosts.length <= 2048,
    "INVALID_INPUT",
    "Adhesive attachment needs a reviewed source backing",
  );
  backing = approved;
  const frame = orthonormalized(backing.transform),
    inverse = [
      frame.basis[0],
      frame.basis[3],
      frame.basis[6],
      frame.basis[1],
      frame.basis[4],
      frame.basis[7],
      frame.basis[2],
      frame.basis[5],
      frame.basis[8],
    ] as Transform["basis"];
  const triangles: SourceTriangle[] = [],
    owners: number[] = [];
  for (const [i, host] of hosts.entries()) {
    ensure(
      host.occurrenceId !== backing.occurrenceId &&
        /^[a-f0-9]{64}$/.test(host.sourceClosureSha256),
      "INVALID_INPUT",
      "Adhesive host needs a source closure identity",
    );
    for (const triangle of host.triangles) {
      ensure(
        triangles.length < 20000,
        "LIMIT_EXCEEDED",
        "Adhesive host triangle budget exceeded",
      );
      triangles.push(
        triangle.map((p) =>
          mv(inverse, p.map((x, i) => x - frame.position[i]) as Vec3),
        ) as SourceTriangle,
      );
      owners.push(i);
    }
  }
  const coverage = sourceBackingCoverage(
    backing.halfWidth,
    backing.halfDepth,
    triangles,
  );
  if (!sourceBackingSeated(backing.halfWidth, backing.halfDepth, coverage))
    return { coverage, attachments: [] as SourceAssemblyEdge[] };
  const contributingHosts = [
    ...new Set(coverage.contributingTriangles.map((i) => owners[i])),
  ];
  return {
    coverage,
    attachments: contributingHosts.map((i) => ({
      a: hosts[i].occurrenceId,
      b: backing.occurrenceId,
      kind: "visual" as const,
      evidence: {
        profile: "source-supported-adhesive-backing",
        featureA: hosts[i].sourceClosureSha256,
        featureB: backing.geometrySha256,
      },
    })),
  };
}
