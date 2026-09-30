/**
 * LDraw `!TEXMAP` language extension (https://www.ldraw.org/texmap-spec.html):
 * command parsing and the three texture projections. Pure maths, shared by
 * the vendored loader (compile workers and the main thread) and the tests.
 *
 * Texture coordinates are returned in image space: u runs left to right and
 * v top to bottom (v = 0 is the image's first row), so textures are uploaded
 * with `flipY = false`. Values outside 0…1 lie beyond the texture's extent;
 * the renderer shows the part colour there.
 */

export type TexmapMethod = "PLANAR" | "CYLINDRICAL" | "SPHERICAL";
type Vec3 = [number, number, number];
export type TexmapProjection = {
  method: TexmapMethod;
  p1: Vec3;
  p2: Vec3;
  p3: Vec3;
  /** CYLINDRICAL: angular extent a; SPHERICAL: a (horizontal), b (vertical). Degrees. */
  a?: number;
  b?: number;
};
export type Texmap = TexmapProjection & {
  /** Texture file as referenced (quotes removed, `\` → `/`, lower case). */
  texture: string;
  glossmap?: string;
};
export type TexmapCommand =
  | { command: "START" | "NEXT"; texmap: Texmap }
  | { command: "FALLBACK" | "END" };

const PARAMETERS: Record<TexmapMethod, number> = {
  PLANAR: 9,
  CYLINDRICAL: 10,
  SPHERICAL: 11,
};

/** Splits TEXMAP arguments, honouring double-quoted names with `\"` and `\\` escapes. */
function tokens(text: string) {
  const out: string[] = [];
  let i = 0;
  while (i < text.length) {
    while (i < text.length && /\s/.test(text[i])) i++;
    if (i >= text.length) break;
    if (text[i] === '"') {
      let value = "";
      i++;
      while (i < text.length && text[i] !== '"') {
        if (text[i] === "\\" && (text[i + 1] === '"' || text[i + 1] === "\\")) {
          value += text[i + 1];
          i += 2;
        } else value += text[i++];
      }
      i++;
      out.push(value);
    } else {
      let value = "";
      while (i < text.length && !/\s/.test(text[i])) value += text[i++];
      out.push(value);
    }
  }
  return out;
}

/** Normalized texture reference: `\` → `/`, lower case (LDraw names are case-insensitive). */
export const textureName = (name: string) =>
  name.trim().replace(/\\/g, "/").toLowerCase();

/**
 * Parses the text after `0 !TEXMAP`. Returns undefined for a malformed or
 * unknown command (the caller then ignores the line, as the spec asks).
 */
export function parseTexmapCommand(rest: string): TexmapCommand | undefined {
  const t = tokens(rest);
  const command = t[0]?.toUpperCase();
  if (command === "FALLBACK" || command === "END") return { command };
  if (command !== "START" && command !== "NEXT") return undefined;
  const method = t[1]?.toUpperCase() as TexmapMethod;
  const count = PARAMETERS[method];
  if (!count) return undefined;
  const values = t.slice(2, 2 + count).map(Number);
  if (values.length !== count || !values.every(Number.isFinite))
    return undefined;
  const texture = t[2 + count];
  if (!texture) return undefined;
  const extra = t.slice(3 + count);
  const glossAt = extra.findIndex((x) => x.toUpperCase() === "GLOSSMAP");
  const texmap: Texmap = {
    method,
    p1: values.slice(0, 3) as Vec3,
    p2: values.slice(3, 6) as Vec3,
    p3: values.slice(6, 9) as Vec3,
    texture: textureName(texture),
  };
  if (method !== "PLANAR") texmap.a = values[9];
  if (method === "SPHERICAL") texmap.b = values[10];
  if (glossAt >= 0 && extra[glossAt + 1])
    texmap.glossmap = textureName(extra[glossAt + 1]);
  return { command, texmap };
}

const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const scale = (a: Vec3, s: number): Vec3 => [a[0] * s, a[1] * s, a[2] * s];
const normalize = (a: Vec3): Vec3 => {
  const l = Math.hypot(a[0], a[1], a[2]);
  return l > 0 ? scale(a, 1 / l) : [0, 0, 0];
};
/** Component of `v` perpendicular to unit vector `n`. */
const reject = (v: Vec3, n: Vec3) => sub(v, scale(n, dot(v, n)));
const RAD = Math.PI / 180;

/**
 * A function mapping a point (in the coordinate system the TEXMAP command was
 * given in) to image-space texture coordinates.
 *
 * - PLANAR: point 1 is the image's top-left corner, point 2 its top-right and
 *   point 3 its bottom-left: u = distance from plane P1 (through point 1,
 *   normal 1→2) / |1→2|, v likewise along 1→3.
 * - CYLINDRICAL: point 1 is the bottom centre, point 2 the top centre, point
 *   3 on the bottom rim where the bottom centre of the image touches. u is the
 *   angle about the axis 1→2 (right-handed, so the image reads left to right
 *   seen from outside) from the radial 1→3, over the extent a (−a/2…a/2
 *   ↦ 0…1); v is 1 − height above the base / |1→2| (image top at the top).
 * - SPHERICAL: point 1 is the centre, point 2 where the image centre touches,
 *   point 3 in the plane P1 that bisects the image horizontally (its normal
 *   (1→2) × (1→3) points to the image top). u is the angle within P1 from 1→2
 *   over a (−a/2…a/2 ↦ 0…1), v the elevation above P1 over b (image top
 *   towards P1's normal): the angle within P2 the spec names, for points on P2.
 */
export function texmapProjector(
  projection: TexmapProjection,
): (x: number, y: number, z: number) => [number, number] {
  const { p1 } = projection;
  if (projection.method === "PLANAR") {
    const d12 = sub(projection.p2, p1),
      d13 = sub(projection.p3, p1);
    const l12 = dot(d12, d12) || 1,
      l13 = dot(d13, d13) || 1;
    return (x, y, z) => {
      const w: Vec3 = [x - p1[0], y - p1[1], z - p1[2]];
      return [dot(w, d12) / l12, dot(w, d13) / l13];
    };
  }
  if (projection.method === "CYLINDRICAL") {
    const axis = sub(projection.p2, p1);
    const height = Math.hypot(...axis) || 1;
    const up = scale(axis, 1 / height);
    const radial = normalize(reject(sub(projection.p3, p1), up));
    const extent = (projection.a ?? 360) * RAD || 2 * Math.PI;
    return (x, y, z) => {
      const w: Vec3 = [x - p1[0], y - p1[1], z - p1[2]];
      const flat = reject(w, up);
      const angle = Math.atan2(dot(up, cross(radial, flat)), dot(radial, flat));
      return [0.5 + angle / extent, 1 - dot(w, up) / height];
    };
  }
  const forward = normalize(sub(projection.p2, p1));
  const n1 = normalize(cross(forward, sub(projection.p3, p1)));
  const a = (projection.a ?? 360) * RAD || 2 * Math.PI;
  const b = (projection.b ?? 180) * RAD || Math.PI;
  return (x, y, z) => {
    const w: Vec3 = [x - p1[0], y - p1[1], z - p1[2]];
    const w1 = reject(w, n1);
    const u = Math.atan2(dot(n1, cross(forward, w1)), dot(forward, w1));
    // The spec's angle within P2 equals the elevation above P1 on P2; the
    // elevation (latitude) is used everywhere, since the in-plane angle of
    // a point projected onto P2 jumps to ±180° just behind the centre.
    const length = Math.hypot(...w);
    const v =
      length > 0
        ? Math.asin(Math.max(-1, Math.min(1, dot(w, n1) / length)))
        : 0;
    return [0.5 + u / a, 0.5 - v / b];
  };
}

/**
 * Texture coordinates of one polygon's corners. Cylindrical and spherical
 * angles wrap at ±180°; a polygon straddling that seam has its corners moved
 * onto one side so the image is not smeared across it.
 */
export function projectPolygon(
  project: (x: number, y: number, z: number) => [number, number],
  method: TexmapMethod,
  vertices: { x: number; y: number; z: number }[],
  extentDegrees = 360,
): number[] {
  const uv = vertices.map((v) => project(v.x, v.y, v.z));
  if (method !== "PLANAR") {
    // One full turn in u units.
    const turn = 360 / (extentDegrees || 360);
    const us = uv.map((p) => p[0]);
    if (Math.max(...us) - Math.min(...us) > turn / 2) {
      const mid = 0.5;
      for (const p of uv) if (p[0] < mid) p[0] += turn;
    }
  }
  return uv.flat();
}
