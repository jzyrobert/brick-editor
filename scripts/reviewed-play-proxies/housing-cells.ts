type Plane = { n: number[]; d: number };
type Vertex = { xAffine: number[]; boundaryPlanes: Plane[] };
export type HousingConstruction = {
  planes: {
    normal: number[];
    offset: number;
    sourceFaces: [string, number][][];
  }[];
  bands: { lo: number; hi: number; vertices: number[][]; paths: number[][] }[];
};

/** Reviewed contours include the approved roof/rib and crossbrace union masks.
 * Keep every positive interval and exact serialized affine-cut identity. */
export function housingCells(spec: HousingConstruction) {
  const cells = [];
  const at = (v: Vertex, z: number) => v.xAffine[0] + v.xAffine[1] * z;
  for (const band of spec.bands) {
    const vertices = band.vertices.map(([a, b, incoming]) => ({
      xAffine: [a, b],
      boundaryPlanes: [
        { n: spec.planes[incoming].normal, d: spec.planes[incoming].offset },
      ],
    }));
    const paths = band.paths.map((path) => path.map((i) => vertices[i]));
    const vs = paths.flat(),
      levels = [band.lo, band.hi];
    for (let i = 0; i < vs.length; i++)
      for (let j = 0; j < i; j++) {
        const l = at(vs[i], band.lo) - at(vs[j], band.lo),
          h = at(vs[i], band.hi) - at(vs[j], band.hi);
        if (l * h < 0) {
          const z = band.lo + ((band.hi - band.lo) * l) / (l - h);
          if (z > band.lo && z < band.hi) levels.push(z);
        }
      }
    const zs = [...new Set(levels)].sort((a, b) => a - b);
    for (let zi = 0; zi < zs.length - 1; zi++) {
      const lo = zs[zi],
        hi = zs[zi + 1],
        mid = (lo + hi) / 2;
      const cuts = [
        ...new Map(vs.map((v) => [JSON.stringify(v.xAffine), v])).values(),
      ].sort((a, b) => at(a, mid) - at(b, mid));
      for (let xi = 0; xi < cuts.length - 1; xi++) {
        const left = cuts[xi],
          right = cuts[xi + 1],
          x = (at(left, mid) + at(right, mid)) / 2;
        if (at(right, mid) - at(left, mid) <= 0) continue;
        const crossings: { y: number; plane: Plane }[] = [];
        for (const path of paths)
          for (let i = 0; i < path.length; i++) {
            const next = path[(i + 1) % path.length];
            if (at(path[i], mid) > x === at(next, mid) > x) continue;
            const plane = next.boundaryPlanes[0],
              [nx, ny, nz] = plane.n;
            if (Math.abs(ny) < 1e-8) throw new Error("Vertical crossing");
            crossings.push({ y: (plane.d - nx * x - nz * mid) / ny, plane });
          }
        crossings.sort((a, b) => a.y - b.y);
        if (crossings.length % 2) throw new Error("Odd crossings");
        for (let i = 0; i < crossings.length; i += 2) {
          if (crossings[i + 1].y - crossings[i].y <= 0) continue;
          cells.push({
            lo,
            hi,
            left: left.xAffine,
            right: right.xAffine,
            lower: crossings[i].plane,
            upper: crossings[i + 1].plane,
          });
        }
      }
    }
  }
  return cells;
}
