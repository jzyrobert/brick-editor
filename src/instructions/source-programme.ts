/** Source-guided event ordering, separate from verified contact connectivity. */
import type { InstructionPlan, InstructionStepMetadata } from "../core/types";
import type { SourceGraphItem } from "./source-procedures";
import { validateInstructionProgramme } from "./programme";

export type SourceProgrammeCandidate = {
  id: string;
  name: string;
  members: string[];
  /** Complete source order; children appear at their first source member. */
  sourceOrder: string[];
  parentId?: string;
  placement: "attachment" | "scene";
  receivers: string[];
  buildNotes: string;
  joinNotes: string;
};
type Event = {
  id: string;
  ids: string[];
  meta: InstructionStepMetadata;
  requires: Set<string>;
  rank: number[];
};
const prerequisites = (i: SourceGraphItem) =>
  new Set([...i.supports, ...i.hosts, ...i.access]);

/** Source stages are an ordering prior, never permission to delete a hard edge.
 * Every outside receiver must be available on the relevant destination bench;
 * introduction on an unjoined sibling is insufficient. Failure is atomic. */
export function sourceGuidedProgramme(
  baseline: InstructionPlan,
  items: SourceGraphItem[],
  candidates: SourceProgrammeCandidate[],
  maxWork = 200000,
): { plan: InstructionPlan; adopted: number; reason?: string } {
  const refuse = (reason: string) => ({ plan: baseline, adopted: 0, reason });
  if (!candidates.length) return { plan: baseline, adopted: 0 };
  if (!Number.isSafeInteger(maxWork) || maxWork < 0 || maxWork > 200000)
    return refuse("Invalid source-event work budget.");
  // Existing verified/typed programmes retain their stronger gates. Mixed
  // planning modes require a separate ownership proof, not a silent overwrite.
  if (Object.keys(baseline.modules ?? {}).length)
    return refuse("An existing owned programme requires separate integration.");
  let work = 0;
  const spend = () => ++work <= maxWork;
  const byId = new Map(
      items.flatMap((i) => i.ids.map((id) => [id, i] as const)),
    ),
    definitions = new Map(candidates.map((c) => [c.id, c])),
    sets = new Map(candidates.map((c) => [c.id, new Set(c.members)])),
    chains = new Map<string, string[]>();
  if (definitions.size !== candidates.length || candidates.length > 100)
    return refuse("Source candidates repeat keys or exceed membership limits.");
  let members = 0;
  for (const c of candidates) {
    members += c.members.length;
    if (
      !c.members.length ||
      members > 200000 ||
      sets.get(c.id)!.size !== c.members.length ||
      c.members.some((id) => !byId.has(id)) ||
      c.sourceOrder.length !== c.members.length ||
      new Set(c.sourceOrder).size !== c.members.length ||
      c.sourceOrder.some((id) => !sets.get(c.id)!.has(id)) ||
      (c.parentId && c.placement === "scene")
    )
      return refuse("Source ownership or complete source order is invalid.");
    const chain: string[] = [];
    for (
      let key: string | undefined = c.id;
      key;
      key = definitions.get(key)!.parentId
    ) {
      if (!spend()) return refuse("Source-event search exhausted its budget.");
      if (!definitions.has(key) || chain.includes(key) || chain.length >= 16)
        return refuse("Unknown, cyclic or excessive source parent.");
      chain.push(key);
    }
    chains.set(c.id, chain);
    if (c.parentId) {
      const parent = sets.get(c.parentId);
      if (
        !parent ||
        parent.size <= c.members.length ||
        c.members.some((id) => !parent.has(id))
      )
        return refuse("Source child is not a strict subset of its parent.");
    }
    if (
      new Set(c.receivers).size !== c.receivers.length ||
      c.receivers.some((id) => !byId.has(id) || sets.get(c.id)!.has(id)) ||
      (c.placement === "attachment" && !c.receivers.length) ||
      (c.parentId && c.receivers.some((id) => !sets.get(c.parentId!)!.has(id)))
    )
      return refuse("Source receiving membership is invalid.");
  }
  const owner = new Map<string, string>();
  for (const c of [...candidates].sort(
    (a, b) => chains.get(b.id)!.length - chains.get(a.id)!.length,
  ))
    for (const id of c.members) {
      if (!spend()) return refuse("Source-event search exhausted its budget.");
      const previous = owner.get(id);
      if (previous && !chains.get(previous)!.includes(c.id))
        return refuse("Source siblings overlap without a parent.");
      if (!previous) owner.set(id, c.id);
    }
  for (const item of items)
    if (item.ids.some((id) => owner.get(id) !== owner.get(item.ids[0])))
      return refuse("A source candidate splits a whole drawing owner.");
  const baselineIndex = new Map(
      baseline.steps.flatMap((ids, n) => ids.map((id) => [id, n] as const)),
    ),
    sourceIndex = new Map<string, number>(),
    events = new Map<string, Event>(),
    introductions = new Map<string, string>();
  // Rank every descendant in the outer source sequence. A local child index
  // would start its loose foundation before the parent receiver is prepared.
  for (const c of candidates.filter((c) => !c.parentId))
    for (const [n, id] of c.sourceOrder.entries()) sourceIndex.set(id, n);
  const earliest = new Map(
    candidates.map((c) => [
      c.id,
      c.members.reduce(
        (n, id) => Math.min(n, baselineIndex.get(id) ?? Infinity),
        Infinity,
      ),
    ]),
  );
  for (const item of items) {
    const moduleId = owner.get(item.ids[0]);
    if (!moduleId) continue;
    if (!spend()) return refuse("Source-event search exhausted its budget.");
    const id = `source-build-${item.index}`,
      c = definitions.get(moduleId)!;
    const first = c.sourceOrder.find((member) => owner.get(member) === c.id);
    events.set(id, {
      id,
      ids: [...item.ids],
      requires: new Set(),
      meta: {
        assembly: { type: "build", moduleId },
        notes: item.ids.includes(first!)
          ? c.buildNotes
          : "Add the pictured part in its shown relative position. Support the receiving work underneath; attachment and handling remain unverified.",
      },
      rank: [
        earliest.get(chains.get(moduleId)!.at(-1)!)!,
        sourceIndex.get(item.ids[0])!,
        chains.get(moduleId)!.length,
        item.index,
      ],
    });
    for (const member of item.ids) introductions.set(member, id);
  }
  // Foreign batches keep their exact ordered occurrences. Split at ownership
  // boundaries instead of putting an unrelated source prop on a child's bench.
  for (const [n, ids] of baseline.steps.entries()) {
    let chunks: string[][] = [];
    for (const id of ids) {
      if (owner.has(id)) {
        chunks.push([]);
        continue;
      }
      if (!chunks.length) chunks.push([]);
      chunks.at(-1)!.push(id);
    }
    chunks = chunks.filter((c) => c.length);
    for (const [j, chunk] of chunks.entries()) {
      const id = `source-retained-${n}-${j}`;
      // The displayed state changes when a source member leaves this batch.
      // Rebuild views/targets/checks afterwards; retain only authored wording.
      const notes = baseline.stepMetadata?.[n]?.notes;
      events.set(id, {
        id,
        ids: [...chunk],
        meta: notes ? { notes } : {},
        requires: new Set(),
        rank: [n, 0, 0, j],
      });
      for (const member of chunk) {
        if (introductions.has(member))
          return refuse("Repeated baseline introduction.");
        introductions.set(member, id);
      }
    }
  }
  if (
    introductions.size !== baseline.steps.flat().length ||
    items.some((i) => i.ids.some((id) => !introductions.has(id)))
  )
    return refuse("Source events do not cover the exact baseline inventory.");
  for (const c of candidates)
    events.set(`source-join-${c.id}`, {
      id: `source-join-${c.id}`,
      ids: [],
      meta: { assembly: { type: "join", moduleId: c.id }, notes: c.joinNotes },
      requires: new Set(),
      rank: [
        earliest.get(chains.get(c.id)!.at(-1)!)!,
        c.members.reduce((n, id) => Math.max(n, sourceIndex.get(id)!), 0) + 0.5,
        chains.get(c.id)!.length,
        0,
      ],
    });
  /** The first join carrying a prerequisite into the consumer's destination.
   * Ancestor members may be omitted on a held child bench, but must actually
   * exist in that ancestor before detached work; captions retain that boundary. */
  const available = (id: string, consumer: string | undefined) => {
    let source = owner.get(id);
    if (
      !source ||
      source === consumer ||
      (consumer && chains.get(consumer)!.includes(source))
    )
      return introductions.get(id)!;
    const consumerChain = new Set(consumer ? chains.get(consumer)! : []);
    while (
      definitions.get(source)!.parentId &&
      !consumerChain.has(definitions.get(source)!.parentId!)
    )
      source = definitions.get(source)!.parentId!;
    return `source-join-${source}`;
  };
  const depend = (event: string, prerequisite: string) => {
    if (!spend()) return false;
    if (!events.has(event) || !events.has(prerequisite)) return false;
    if (event !== prerequisite) events.get(event)!.requires.add(prerequisite);
    return true;
  };
  for (const item of items) {
    const event = introductions.get(item.ids[0])!,
      moduleId = owner.get(item.ids[0]);
    for (const n of prerequisites(item)) {
      const prior = items[n];
      if (!prior) return refuse("Unknown retained prerequisite.");
      for (const id of prior.ids) {
        // A dependent addition sharing one original batch cannot be made prior.
        if (introductions.get(id) === event && !item.ids.includes(id))
          return refuse("A retained batch contains a dependent addition.");
        if (!depend(event, available(id, moduleId)))
          return refuse("Source-event search exhausted its budget.");
      }
    }
  }
  for (const c of candidates) {
    const join = `source-join-${c.id}`;
    for (const id of c.members)
      if (!depend(join, available(id, c.id)))
        return refuse("Source-event search exhausted its budget.");
    for (const id of c.receivers)
      if (!depend(join, available(id, c.parentId)))
        return refuse("Source-event search exhausted its budget.");
    const order: string[] = [];
    for (const id of c.sourceOrder) {
      const event = available(id, c.id);
      if (!order.includes(event)) order.push(event);
    }
    for (let n = 1; n < order.length; n++)
      if (!depend(order[n], order[n - 1]))
        return refuse("Source-event search exhausted its budget.");
    // Preserve the previous generator's external prerequisite readiness at the
    // whole child boundary. A->outside->B contraction therefore still refuses.
    const own = c.sourceOrder.filter((id) => owner.get(id) === c.id),
      first = own.length ? introductions.get(own[0]) : undefined;
    if (first)
      for (const id of c.members)
        for (const n of prerequisites(byId.get(id)!))
          for (const prior of items[n].ids)
            if (
              !sets.get(c.id)!.has(prior) &&
              !depend(first, available(prior, c.id))
            )
              return refuse("Source-event search exhausted its budget.");
  }
  const remaining = new Map(events),
    completed = new Set<string>(),
    ordered: Event[] = [];
  while (remaining.size) {
    const ready: Event[] = [];
    for (const e of remaining.values()) {
      if (!spend()) return refuse("Source-event search exhausted its budget.");
      let available = true;
      for (const id of e.requires) {
        if (!spend())
          return refuse("Source-event search exhausted its budget.");
        if (!completed.has(id)) {
          available = false;
          break;
        }
      }
      if (available) ready.push(e);
    }
    ready.sort((a, b) => {
      for (let n = 0; n < a.rank.length; n++) {
        const d = a.rank[n] - b.rank[n];
        if (d) return d;
      }
      return a.id.localeCompare(b.id);
    });
    if (!ready.length)
      return refuse(
        "Source order or contraction conflicts with a retained availability prerequisite.",
      );
    ordered.push(ready[0]);
    completed.add(ready[0].id);
    remaining.delete(ready[0].id);
  }
  if (ordered.length > 2000)
    return refuse("Source programme exceeds the operation budget.");
  const modules: NonNullable<InstructionPlan["modules"]> = {};
  for (const c of candidates)
    modules[c.id] = {
      name: c.name,
      occurrenceIds: [...c.members],
      feasibility: "unknown",
      purpose: "source",
      placement: c.placement,
      hostIds: [...c.receivers],
      ...(c.parentId ? { parentModuleId: c.parentId } : {}),
    };
  const plan: InstructionPlan = {
    ...baseline,
    modules,
    steps: ordered.map((e) => e.ids),
    stepMetadata: ordered.map((e) => e.meta),
  };
  try {
    validateInstructionProgramme(plan);
  } catch {
    return refuse(
      "Source programme failed actual ownership or receiving replay.",
    );
  }
  return { plan, adopted: candidates.length };
}
