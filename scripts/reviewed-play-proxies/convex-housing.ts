import { Vector3 } from "three";
import { ConvexHull } from "three/addons/math/ConvexHull.js";
export function convexHousing(input: number[][][]): number[][][] {
  const key = (p: number[]) => p.map((x) => x.toFixed(8)).join(",");
  const shape = (ps: number[][]) => {
    const points = [...new Map(ps.map((p) => [JSON.stringify(p), p])).values()],
      centre = points.reduce(
        (s, p) => s.map((x, i) => x + p[i] / points.length),
        [0, 0, 0],
      ),
      h = new ConvexHull().setFromPoints(
        points.map((p) =>
          Object.assign(
            new Vector3(
              ...(p.map((x, i) => x - centre[i]) as [number, number, number]),
            ),
            { original: p },
          ),
        ),
      );
    let volume = 0;
    const verts = new Map<string, number[]>();
    for (const f of h.faces) {
      const a = f.edge.head().point,
        b = f.edge.next.head().point,
        c = f.edge.next.next.head().point;
      volume += a.dot(new Vector3().crossVectors(b, c)) / 6;
      let e = f.edge;
      do {
        const p = (e.head().point as Vector3 & { original: number[] }).original;
        verts.set(JSON.stringify(p), p);
        e = e.next;
      } while (e !== f.edge);
    }
    return { points: [...verts.values()], volume: Math.abs(volume) };
  };
  const live = new Map<number, ReturnType<typeof shape>>(
      input
        .map((ps, i): [number, ReturnType<typeof shape>] => [i, shape(ps)])
        .sort((a, b) => b[1].volume - a[1].volume),
    ),
    owners = new Map<string, Set<number>>();
  const add = (i: number, ps: number[][]) => {
    for (const p of ps) {
      const k = key(p),
        s = owners.get(k) ?? new Set<number>();
      s.add(i);
      owners.set(k, s);
    }
  };
  for (const [i, p] of live) add(i, p.points);
  let work = 0,
    merged = 0,
    maxDelta = 0;
  for (const [i] of live) {
    let repeat = true;
    while (repeat) {
      repeat = false;
      const a = live.get(i);
      if (!a) break;
      const neighbors = new Map<number, number>();
      for (const p of a.points)
        for (const j of owners.get(key(p)) ?? [])
          if (j !== i && live.has(j))
            neighbors.set(j, (neighbors.get(j) ?? 0) + 1);
      for (const [j, n] of neighbors) {
        if (n < 2) continue;
        const b = live.get(j)!;
        const zs = (p: number[][]) => [
          Math.min(...p.map((p) => p[2])),
          Math.max(...p.map((p) => p[2])),
        ];
        const az = zs(a.points),
          bz = zs(b.points);
        if (Math.min(az[1], bz[1]) < Math.max(az[0], bz[0]) - 1e-9) continue;
        if (++work > 100000) throw new Error("work cap");
        let c;
        try {
          c = shape([...a.points, ...b.points]);
        } catch {
          continue;
        }
        const delta = Math.abs(c.volume - a.volume - b.volume);
        if (delta > Math.max(1e-7, c.volume * 2e-12)) continue;
        maxDelta = Math.max(maxDelta, delta);
        for (const p of b.points) owners.get(key(p))!.delete(j);
        live.set(i, c);
        add(i, c.points);
        live.delete(j);
        merged++;
        repeat = true;
        break;
      }
    }
  }
  const regions = [...live.values()].map((p) => p.points);
  console.log(
    JSON.stringify({
      input: input.length,
      output: live.size,
      merged,
      work,
      maxDelta,
      volume: [...live.values()].reduce((s, p) => s + p.volume, 0),
    }),
  );

  return regions;
}
