import type { Bounds } from "../core/spatial";

export type AccessItem = {
  index: number;
  box: Bounds | null;
  parent: string;
  eligible: boolean;
  blocksTop?: boolean;
  requires: Set<number>;
};

/** Estimated top approach with 12 LDU handling margin.
 * Only squat overhead bodies enter the blocker index, not tall thin walls/leaves.
 * Boxes cannot validate a hand, hollow space or insertion path. Keep these edges separate
 * from contact/support evidence and refuse cycles rather than deleting supports.
 */
export function enclosurePrecedence(items: AccessItem[]) {
  const edges = items.map(() => new Set<number>()),
    conflicts = new Set<number>(),
    cell = 80,
    cells = new Map<string, Set<number>>();
  let work = 0;
  const budget = 2000000;
  const range = (box: Bounds, margin = 0) => {
    const lo = [0, 2].map((a) => Math.floor((box.min[a] - margin) / cell)),
      hi = [0, 2].map((a) => Math.floor((box.max[a] + margin) / cell));
    return { lo, hi };
  };
  for (const item of items) {
    if (
      !item.box ||
      item.blocksTop === false ||
      item.box.max[1] - item.box.min[1] >
        Math.min(
          item.box.max[0] - item.box.min[0],
          item.box.max[2] - item.box.min[2],
        ) +
          0.5
    )
      continue;
    const { lo, hi } = range(item.box);
    if ((hi[0] - lo[0] + 1) * (hi[1] - lo[1] + 1) > budget - work)
      return { edges, conflicts, exhausted: true, work };
    for (let x = lo[0]; x <= hi[0]; x++)
      for (let z = lo[1]; z <= hi[1]; z++) {
        if (++work > budget) return { edges, conflicts, exhausted: true, work };
        const key = `${x},${z}`,
          bucket = cells.get(key) ?? new Set<number>();
        bucket.add(item.index);
        cells.set(key, bucket);
      }
  }
  const depends = (from: number, on: number) => {
    const seen = new Set<number>(),
      queue = [from];
    for (let n = 0; n < queue.length; n++) {
      if (++work > budget) return true;
      const at = queue[n];
      if (at === on) return true;
      if (seen.has(at)) continue;
      seen.add(at);
      queue.push(...items[at].requires, ...edges[at]);
    }
    return false;
  };
  for (const item of items) {
    if (!item.eligible || !item.box) continue;
    const { lo, hi } = range(item.box, 12),
      candidates = new Set<number>();
    for (let x = lo[0]; x <= hi[0]; x++)
      for (let z = lo[1]; z <= hi[1]; z++) {
        if (++work > budget) return { edges, conflicts, exhausted: true, work };
        for (const index of cells.get(`${x},${z}`) ?? []) {
          if (++work > budget)
            return { edges, conflicts, exhausted: true, work };
          candidates.add(index);
        }
      }
    for (const index of [...candidates].sort((a, b) => a - b)) {
      if (++work > budget) return { edges, conflicts, exhausted: true, work };
      const other = items[index],
        b = other.box;
      if (
        index === item.index ||
        !b ||
        other.parent === item.parent ||
        b.min[1] >= item.box.min[1] - 0.5 ||
        ![0, 2].every(
          (a) =>
            b.max[a] > item.box!.min[a] - 12 &&
            b.min[a] < item.box!.max[a] + 12,
        )
      )
        continue;
      // Contact supports may themselves enclose the part. Their required order
      // wins; unresolved access is reported for manual review.
      if (depends(item.index, index)) {
        conflicts.add(item.index);
        continue;
      }
      edges[index].add(item.index);
    }
  }
  return { edges, conflicts, exhausted: work > budget, work };
}
