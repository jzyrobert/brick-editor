import { ensure } from "../core/types";
import type { PlayMemberLocalGeometry } from "./types";

/** Bind generated reviewed geometry to the actual captured occurrence surface.
 * Triangle/material order and BFC winding do not change the occupied surface;
 * every exact part-local vertex coordinate and triangle multiplicity does.
 * This is not a filename or namespace-only proxy lookup. */
export async function reviewedGeometryDigest(
  geometry: Pick<PlayMemberLocalGeometry, "vertices" | "indices">,
) {
  const { vertices, indices } = geometry;
  ensure(
    vertices instanceof Float64Array &&
      indices instanceof Uint32Array &&
      vertices.length % 3 === 0 &&
      indices.length % 3 === 0 &&
      vertices.length <= 8192 * 9 &&
      indices.length <= 8192 * 3,
    "LIMIT_EXCEEDED",
    "This part is too complex to check safely.",
  );
  ensure(
    vertices.every(Number.isFinite) &&
      indices.every((i) => i < vertices.length / 3),
    "INVALID_INPUT",
    "Reviewed geometry needs complete finite source triangles",
  );
  const triangles: string[] = [];
  for (let i = 0; i < indices.length; i += 3) {
    const triangle: string[] = [];
    for (let j = 0; j < 3; j++) {
      const start = indices[i + j] * 3;
      triangle.push(
        `${vertices[start]},${vertices[start + 1]},${vertices[start + 2]}`,
      );
    }
    triangles.push(triangle.sort().join(";"));
  }
  const encoded = new TextEncoder().encode(
      "brick-play-canonical-surface-v1\n" + triangles.sort().join("\n"),
    ),
    digest = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(digest), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}
