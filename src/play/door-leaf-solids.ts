import { add, inverse, mv } from "../core/math";
import { ensure, type Occurrence, type Vec3 } from "../core/types";
import type { CollisionSnapshot } from "./types";

/** Partition the ACTUAL captured surface of reviewed hinged leaves at their
 * source body-end and (for the smooth door) handle-plinth planes. A whole hull lofts hinge bumps and
 * handle studs across broad edges, filling empty space in the rendered part.
 * The shutter spine ends at Y4/44; its end relief is not a convex loft.
 * These are conservative convex covers, not mating/contact exclusions. */
export function doorLeafSolids(
  mesh: CollisionSnapshot,
  occurrence: Occurrence,
  work: { value: number },
  limits: { sourcePointsPerMember: number; clippingWork: number },
): Vec3[][] | undefined {
  if (
    occurrence.namespace !== "official" ||
    !["60616a.dat", "3582.dat"].includes(occurrence.node.ref)
  )
    return undefined;
  ensure(
    mesh.indices.length / 3 <= 8192,
    "LIMIT_EXCEEDED",
    "This mechanism is too complex to check safely. Try fewer moving parts.",
  );
  const shutter = occurrence.node.ref === "3582.dat",
    bodyEnd = shutter ? 44 : 136,
    frame = occurrence.transform,
    inv = inverse(frame),
    toLocal = (p: Vec3) => add(inv.position, mv(inv.basis, p)),
    toWorld = (p: Vec3) => add(frame.position, mv(frame.basis, p)),
    pieces = Array.from(
      { length: shutter ? 3 : 5 },
      () => new Map<string, Vec3>(),
    );
  const clip = (
    polygon: Vec3[],
    axis: number,
    plane: number,
    keepAbove: boolean,
  ) => {
    const result: Vec3[] = [];
    for (let k = 0; k < polygon.length; k++) {
      ensure(
        ++work.value <= limits.clippingWork,
        "LIMIT_EXCEEDED",
        "This mechanism is too complex to check safely. Try fewer moving parts.",
      );
      const a = polygon[k],
        b = polygon[(k + 1) % polygon.length],
        da = a[axis] - plane,
        db = b[axis] - plane,
        insideA = keepAbove ? da >= 0 : da <= 0,
        insideB = keepAbove ? db >= 0 : db <= 0;
      if (insideA) result.push(a);
      if (insideA !== insideB) {
        const fraction = da / (da - db);
        result.push(
          a.map((v, k) =>
            k === axis ? plane : v + (b[k] - v) * fraction,
          ) as Vec3,
        );
      }
    }
    return result;
  };
  for (let n = 0; n < mesh.indices.length; n += 3) {
    const triangle = Array.from({ length: 3 }, (_, k) => {
        const i = mesh.indices[n + k] * 3;
        return toLocal(Array.from(mesh.vertices.slice(i, i + 3)) as Vec3);
      }),
      minimum = Math.min(...triangle.map((p) => p[1])),
      maximum = Math.max(...triangle.map((p) => p[1]));
    const body =
        maximum >= 4 && minimum <= bodyEnd
          ? clip(clip(triangle, 1, 4, true), 1, bodyEnd, false)
          : [],
      zMinimum = Math.min(...body.map((p) => p[2])),
      zMaximum = Math.max(...body.map((p) => p[2]));
    const clipped = shutter
      ? [
          minimum < 4 ? clip(triangle, 1, 4, false) : [],
          body,
          maximum > bodyEnd ? clip(triangle, 1, bodyEnd, true) : [],
        ]
      : [
          minimum < 4 ? clip(triangle, 1, 4, false) : [],
          body.length && zMaximum >= -3.75 && zMinimum <= 3.75
            ? clip(clip(body, 2, -3.75, true), 2, 3.75, false)
            : [],
          // Handle studs protrude from the source plinths at Z±3.75. Strict
          // participation keeps broad coplanar body facets out of their covers.
          zMinimum < -3.75 ? clip(body, 2, -3.75, false) : [],
          zMaximum > 3.75 ? clip(body, 2, 3.75, true) : [],
          // Broad coplanar body-end triangles are retained in the body, never in
          // the little pin's below-body hull.
          maximum > bodyEnd ? clip(triangle, 1, bodyEnd, true) : [],
        ];
    for (let k = 0; k < clipped.length; k++)
      for (const p of clipped[k]) {
        pieces[k].set(p.join(","), p);
        ensure(
          pieces[k].size <= limits.sourcePointsPerMember,
          "LIMIT_EXCEEDED",
          "Mechanical member source point budget exhausted",
        );
      }
  }
  return pieces
    .filter((p) => p.size > 0)
    .map((p) => [...p.values()].map(toWorld));
}
