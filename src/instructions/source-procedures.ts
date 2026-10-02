/** Bounded ordering and isolation gates for source-reviewed display procedures. */
import { unionBounds, type Bounds } from "../core/spatial";
export type SourceGraphItem = {
  index: number;
  ids: string[];
  box: Bounds | null;
  broad: boolean;
  component?: unknown;
  supports: Set<number>;
  hosts: Set<number>;
  access: Set<number>;
  adjacent: Set<number>;
};
/** Install all proposed source-reviewed ordering edges only when no existing
 * prerequisite would cycle. Exhaustion keeps the original constraints. */
export function sourcePrecedence<
  Group extends {
    edges: [string, string][];
    operations: Map<string, unknown>;
    workbench?: { ids: string[] };
  },
>(groups: Group[], items: SourceGraphItem[]) {
  const byId = new Map(
    items.flatMap((i) => i.ids.map((id) => [id, i] as const)),
  );
  let work = 0,
    exhausted = false;
  type Operation = Group["operations"] extends Map<string, infer O> ? O : never;
  const operations = new Map<number, Operation>(),
    accepted: Group[] = [];
  let conflicts = 0;
  for (const group of groups) {
    const proposed = new Map<number, Set<number>>();
    for (const [child, host] of group.edges) {
      const i = byId.get(child)!.index,
        h = byId.get(host)!.index;
      if (i === h) continue;
      const list = proposed.get(i) ?? new Set<number>();
      list.add(h);
      proposed.set(i, list);
    }
    const cyclic = (child: number, host: number) => {
      const queue = [host],
        seen = new Set<number>();
      for (let n = 0; n < queue.length; n++) {
        if (++work > 200000) {
          exhausted = true;
          return true;
        }
        if (queue[n] === child) return true;
        const item = items[queue[n]];
        if (seen.has(item.index)) continue;
        seen.add(item.index);
        queue.push(
          ...item.supports,
          ...item.hosts,
          ...item.access,
          ...(proposed.get(item.index) ?? []),
        );
      }
      return false;
    };
    // Contract a held joint only if no original outside prerequisite leads
    // back into it. Leaf acyclicity alone does not establish a usable bench.
    const inside = new Set(
      group.workbench?.ids.map((id) => byId.get(id)!.index),
    );
    const benchCycle = () => {
      const queue = [...inside]
        .flatMap((n) => [
          ...items[n].supports,
          ...items[n].hosts,
          ...items[n].access,
          ...(proposed.get(n) ?? []),
        ])
        .filter((n) => !inside.has(n));
      const seen = new Set<number>();
      for (let n = 0; n < queue.length; n++) {
        if (++work > 200000) {
          exhausted = true;
          return true;
        }
        const index = queue[n];
        if (inside.has(index)) return true;
        if (seen.has(index)) continue;
        seen.add(index);
        queue.push(
          ...items[index].supports,
          ...items[index].hosts,
          ...items[index].access,
          ...(proposed.get(index) ?? []),
        );
      }
      return false;
    };
    if (
      benchCycle() ||
      [...proposed].some(([child, hosts]) =>
        [...hosts].some((host) => cyclic(child, host)),
      )
    ) {
      conflicts++;
      continue;
    }
    for (const [child, hosts] of proposed)
      for (const host of hosts) items[child].access.add(host);
    for (const [id, operation] of group.operations)
      operations.set(byId.get(id)!.index, operation as Operation);
    accepted.push(group);
  }
  return {
    operations,
    groups: accepted,
    conflicts,
    exhausted,
  };
}

/** Complete isolated source membership is a scene workbench candidate only;
 * missing known crossings do not prove physical independence or support. */
export function isolatedWorkbenchCandidates<Group extends { ids: string[] }>(
  groups: Group[],
  items: SourceGraphItem[],
) {
  const byId = new Map(
    items.flatMap((i) => i.ids.map((id) => [id, i] as const)),
  );
  return groups.filter((group) => {
    const inside = new Set(group.ids.map((id) => byId.get(id)!.index)),
      section = [...inside].map((n) => items[n]);
    if (
      section.some((i) => !i.box || i.broad || i.component) ||
      items.some((i) =>
        [...i.adjacent, ...i.supports, ...i.hosts, ...i.access].some(
          (n) => inside.has(i.index) !== inside.has(n),
        ),
      )
    )
      return false;
    const bounds = section
      .map((i) => i.box!)
      .reduce<Bounds | null>(unionBounds, null)!;
    if (
      bounds.max[0] - bounds.min[0] > 160 ||
      bounds.max[2] - bounds.min[2] > 160 ||
      bounds.max[1] - bounds.min[1] > 180
    )
      return false;
    return true;
  });
}
