import { ShapeUtils, Vector2 } from "three";

const cross = (a: number[], b: number[], c: number[]) =>
  (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
const area = (p: number[][]) =>
  Math.abs(
    p.reduce((v, a, i) => {
      const b = p[(i + 1) % p.length];
      return v + a[0] * b[1] - a[1] * b[0];
    }, 0),
  ) / 2;
const key = (p: number[]) => p.map((n) => n.toFixed(5)).join(",");
function hull(ps: number[][]) {
  const u = [...new Map(ps.map((p) => [key(p), p])).values()].sort(
    (a, b) => a[0] - b[0] || a[1] - b[1],
  );
  const half = (p: number[][]) => {
    const o: number[][] = [];
    for (const a of p) {
      while (o.length > 1 && cross(o.at(-2)!, o.at(-1)!, a) <= 1e-8) o.pop();
      o.push(a);
    }
    return o;
  };
  return [...half(u).slice(0, -1), ...half([...u].reverse()).slice(0, -1)];
}
export function rackSectionPieces(
  sections: Array<{ paths: number[][][]; bands: number[][] }>,
) {
  const pieces: number[][][] = [];
  for (const [index, section] of sections.entries())
    for (const [lo, hi] of section.bands) {
      const paths = section.paths.map(
          (p: any) =>
            p
              .filter(
                (q: number[], i: number, a: number[][]) =>
                  i === 0 || key(q) !== key(a[i - 1]),
              )
              .filter(
                (q: number[], i: number, a: number[][]) =>
                  i === 0 || i !== a.length - 1 || key(q) !== key(a[0]),
              ) as number[][],
        ),
        sorted = paths.sort(
          (a: number[][], b: number[][]) => area(b) - area(a),
        ),
        outer = sorted[0],
        holes = sorted.slice(1),
        coordinates = [outer, ...holes].flat(),
        triangles = ShapeUtils.triangulateShape(
          outer.map((p) => new Vector2(...(p as [number, number]))),
          holes.map((p) =>
            p.map((q) => new Vector2(...(q as [number, number]))),
          ),
        );
      const live = new Map(
          triangles
            .map((t, i) => [
              i,
              {
                points: t.map((i) => coordinates[i]),
                area: area(t.map((i) => coordinates[i])),
              },
            ])
            .filter(([, p]: any) => p.area > 1e-7) as Array<
            [number, { points: number[][]; area: number }]
          >,
        ),
        owners = new Map<string, Set<number>>();
      const register = (i: number, p: number[][]) => {
        for (const q of p) {
          const k = key(q),
            o = owners.get(k) ?? new Set<number>();
          o.add(i);
          owners.set(k, o);
        }
      };
      for (const [i, p] of live) register(i, p.points);
      let work = 0;
      for (const [i] of live) {
        let changed = true;
        while (changed) {
          changed = false;
          const a = live.get(i);
          if (!a) break;
          const neighbors = new Map<number, number>();
          for (const k of new Set(a.points.map(key)))
            for (const j of owners.get(k) ?? [])
              if (j !== i && live.has(j))
                neighbors.set(j, (neighbors.get(j) ?? 0) + 1);
          for (const [j, n] of neighbors) {
            if (n < 2) continue;
            if (++work > 200000) throw new Error("merge budget");
            const b = live.get(j)!,
              h = hull([...a.points, ...b.points]);
            if (Math.abs(area(h) - a.area - b.area) > 1e-5) continue;
            for (const q of b.points) owners.get(key(q))!.delete(j);
            a.points = [
              ...new Map(
                [...a.points, ...b.points].map((p) => [key(p), p]),
              ).values(),
            ];
            a.area += b.area;
            register(i, a.points);
            live.delete(j);
            changed = true;
            break;
          }
        }
      }
      const polygons = [...live.values()].map((p) => hull(p.points));
      console.log(
        "band",
        index,
        lo,
        hi,
        "triangles",
        triangles.length,
        "regions",
        polygons.length,
        "area",
        polygons.reduce((v, p) => v + area(p), 0),
      );
      pieces.push(
        ...polygons.map((poly) =>
          poly.flatMap((p) => [lo, hi].map((z) => [...p, z])),
        ),
      );
    }
  return pieces;
}
