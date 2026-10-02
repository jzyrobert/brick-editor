/** Organise isolated source sections without inferring a safe detach. */
import type { InstructionPlan, Project, Occurrence } from "../core/types";
import { physical } from "../core/math";
import { unionBounds, type Bounds } from "../core/spatial";
import { validateInstructionProgramme } from "./programme";

type Item = {
  index: number;
  ids: string[];
  o: Occurrence;
  box: Bounds | null;
  broad: boolean;
  component?: unknown;
  adjacent: Set<number>;
  supports: Set<number>;
  hosts: Set<number>;
  access: Set<number>;
};
const requirements = (item: Item) =>
  new Set([...item.supports, ...item.hosts, ...item.access]);

/** Keep the already ordered leaf/wheel programme. Admit a parent only when no
 * known dependency/contact crosses its boundary and all prerequisites are
 * assembled on the actual active or receiving bench. Unknown contacts remain
 * unknown: these are organisational candidates, not proven separate objects. */
export function sceneWorkbenches(
  project: Project,
  plan: InstructionPlan,
  items: Item[],
) {
  const byId = new Map(
      items.flatMap((i) => i.ids.map((id) => [id, i] as const)),
    ),
    warnings: string[] = [],
    staticModules: string[] = [],
    groups = project.models[project.rootModelId].nodes.flatMap((node) =>
      node.kind === "submodel"
        ? [
            {
              name: project.models[node.ref].name,
              items: items.filter((i) => i.o.path[0] === node.id),
              wholeRoot: false,
            },
          ]
        : [],
    );
  // A small single-object sample can span chassis/body/wheel source sections.
  // Whole-root grouping additionally requires a connected contact/support graph.
  groups.push({
    name: project.models[project.rootModelId].name,
    items,
    wholeRoot: true,
  });
  let adopted = 0,
    sourceVehicle = false;
  const rejected = new Map<string, number>();
  const reject = (reason: string) =>
    rejected.set(reason, (rejected.get(reason) ?? 0) + 1);
  for (const group of groups) {
    // A rejected source vehicle must stay flat. Do not evade its boundary by
    // absorbing the rest of the scene into a whole-root candidate.
    if (group.wholeRoot && (adopted || sourceVehicle)) continue;
    const inside = new Set(group.items.map((i) => i.index)),
      ids = group.items.flatMap((i) => i.ids),
      idSet = new Set(ids),
      children = Object.entries(plan.modules ?? {}).filter(([, m]) =>
        m.occurrenceIds.some((id) => idSet.has(id)),
      ),
      hosted = children.filter(
        ([, m]) =>
          m.purpose === "wheel" &&
          m.hostIds?.length &&
          m.hostIds.every((id) => idSet.has(id)),
      );
    const staticSection = !group.wholeRoot && children.length === 0;
    if (hosted.length < 2 && !staticSection) continue;
    if (!group.wholeRoot && hosted.length >= 2) sourceVehicle = true;
    if (
      group.items.length < 4 ||
      ids.length > 300 ||
      group.items.some(
        (i) =>
          !i.box ||
          i.broad ||
          i.component ||
          i.o.node.kind !== "part" ||
          !physical(i.o.transform, 0.001),
      ) ||
      children.some(
        ([, m]) =>
          (m.purpose !== "wheel" && m.purpose !== "joint") ||
          m.parentModuleId ||
          !m.hostIds?.length ||
          !m.occurrenceIds.every((id) => idSet.has(id)) ||
          m.hostIds?.some((id) => !idSet.has(id)),
      )
    ) {
      reject("geometry, membership or non-wheel children");
      continue;
    }
    const bounds = group.items
      .map((i) => i.box!)
      .reduce<Bounds | null>(unionBounds, null)!;
    if (
      bounds.max[0] - bounds.min[0] > 500 ||
      bounds.max[2] - bounds.min[2] > 500 ||
      bounds.max[1] - bounds.min[1] > 650
    ) {
      reject("envelope");
      continue;
    }
    if (
      items.some((i) =>
        [...i.adjacent, ...requirements(i)].some(
          (n) => inside.has(i.index) !== inside.has(n),
        ),
      )
    ) {
      reject("cross-boundary contact or prerequisite");
      continue;
    }
    if (group.wholeRoot || staticSection) {
      const edges = new Map(
        group.items.map((i) => [i.index, new Set<number>()]),
      );
      const link = (a: number, b: number) => {
        edges.get(a)!.add(b);
        edges.get(b)!.add(a);
      };
      for (const i of group.items)
        for (const n of new Set([
          ...i.adjacent,
          ...i.supports,
          ...i.hosts,
          ...i.access,
        ]))
          link(i.index, n);
      for (const [, m] of children) {
        const wheel = m.occurrenceIds.map((id) => byId.get(id)!.index);
        for (const n of [
          ...wheel.slice(1),
          ...(m.hostIds ?? []).map((id) => byId.get(id)!.index),
        ])
          link(wheel[0], n);
      }
      const queue = [group.items[0].index],
        seen = new Set(queue);
      for (let cursor = 0; cursor < queue.length; cursor++)
        for (const n of edges.get(queue[cursor])!)
          if (!seen.has(n)) {
            seen.add(n);
            queue.push(n);
          }
      if (seen.size !== group.items.length) {
        reject("disconnected contact/prerequisite topology");
        continue;
      }
    }
    const key = `scene-${adopted + 1}`,
      childKeys = new Set(children.map(([k]) => k)),
      childOwner = new Map(
        children.flatMap(([k, m]) =>
          m.occurrenceIds.map((id) => [id, k] as const),
        ),
      ),
      bench = new Set<string>(),
      childBenches = new Map(children.map(([k]) => [k, new Set<string>()]));
    const loose = new Set<number>();
    let ready = true,
      last = -1;
    // This preflight checks real availability, including child joins. Merely
    // having introduced a receiver on another, unjoined bench is insufficient.
    for (let n = 0; n < plan.steps.length && ready; n++) {
      const additions = plan.steps[n].filter((id) => idSet.has(id)),
        action = plan.stepMetadata?.[n]?.assembly;
      if (action && childKeys.has(action.moduleId)) {
        last = n;
        if (action.type === "join") {
          const m = plan.modules![action.moduleId];
          if (m.hostIds?.some((id) => !bench.has(id))) {
            ready = false;
            break;
          }
          for (const id of m.occurrenceIds) bench.add(id);
          continue;
        }
      }
      if (!additions.length) continue;
      last = n;
      const active = action ? childBenches.get(action.moduleId) : bench;
      if (!active) {
        ready = false;
        break;
      }
      if (
        staticSection &&
        !action &&
        (bench.size || additions.length > 1) &&
        additions.some((id) => {
          const i = byId.get(id)!;
          return ![...i.adjacent, ...requirements(i)].some((n) =>
            items[n].ids.some((other) => bench.has(other)),
          );
        })
      )
        loose.add(n);
      for (const item of new Set(additions.map((id) => byId.get(id)!)))
        for (const dependency of requirements(item))
          for (const id of items[dependency].ids) {
            // A child's host is ready on the destination parent while its members
            // are held separately; intra-child prerequisites stay local.
            const available =
              childOwner.get(id) === action?.moduleId && action
                ? active.has(id)
                : bench.has(id);
            if (!available) ready = false;
          }
      for (const id of additions) active.add(id);
    }
    if (!ready || last < 0) {
      reject("prerequisite not assembled on the active or destination bench");
      continue;
    }
    // A static source object can remain on its own bench while the rest of the
    // in-place scene is prepared. Finish that construction before positioning
    // it at its final source location. This is workspace scheduling, not a new
    // inferred support edge (for example, no wheel/rail fit is asserted).
    let placement = last;
    if (staticSection)
      for (let n = last + 1; n < plan.steps.length; n++) {
        const action = plan.stepMetadata?.[n]?.assembly;
        if (
          (!action && plan.steps[n].length) ||
          (action?.type === "join" &&
            !plan.modules?.[action.moduleId].parentModuleId &&
            plan.modules?.[action.moduleId].placement !== "scene")
        )
          placement = n;
      }
    const modules = structuredClone(plan.modules ?? {});
    modules[key] = {
      name: group.name,
      occurrenceIds: ids,
      feasibility: "unknown",
      placement: "scene",
    };
    for (const [child] of children) modules[child].parentModuleId = key;
    const steps: string[][] = [],
      meta: NonNullable<InstructionPlan["stepMetadata"]> = [];
    for (let n = 0; n < plan.steps.length; n++) {
      const oldMeta = plan.stepMetadata?.[n] ?? {};
      if (oldMeta.assembly) {
        steps.push(plan.steps[n]);
        meta.push(structuredClone(oldMeta));
      } else {
        // Split even adversarial mixed batches; preserve their internal ordering
        // and exact source IDs rather than moving foreign parts onto this bench.
        const chunks: { inside: boolean; ids: string[] }[] = [];
        for (const id of plan.steps[n]) {
          const member = idSet.has(id),
            prior = chunks.at(-1);
          if (prior?.inside === member) prior.ids.push(id);
          else chunks.push({ inside: member, ids: [id] });
        }
        for (const chunk of chunks) {
          steps.push(chunk.ids);
          meta.push({
            ...structuredClone(oldMeta),
            ...(chunk.inside && loose.has(n)
              ? {
                  notes:
                    (oldMeta.notes ? oldMeta.notes + " " : "") +
                    "Keep these loose pieces supported in the pictured relative positions. No connection to the earlier bench parts has been established; check spacing before fitting later connecting pieces.",
                }
              : {}),
            ...(chunk.inside && n === last && placement > last
              ? {
                  notes:
                    (oldMeta.notes ? oldMeta.notes + " " : "") +
                    "Keep this completed candidate supported on the workbench or set it aside while building the remaining scene. Position it at the later scene-placement step; support and handling remain unverified.",
                }
              : {}),
            ...(chunk.inside
              ? { assembly: { type: "build", moduleId: key } as const }
              : {}),
          });
        }
      }
      if (n === placement) {
        steps.push([]);
        meta.push({
          assembly: { type: "join", moduleId: key },
          notes:
            "Place the completed candidate object in the scene as shown. No new parts and no mating connection inferred. Source hierarchy and absence of known cross-boundary contacts do not prove physical independence. Detached support, handling and placement need review.",
        });
      }
    }
    if (steps.length > 2000) {
      reject("programme budget");
      continue;
    }
    const candidate = { ...plan, modules, steps, stepMetadata: meta };
    validateInstructionProgramme(candidate);
    plan.modules = modules;
    plan.steps = steps;
    plan.stepMetadata = meta;
    if (staticSection) staticModules.push(key);
    adopted++;
  }
  if (adopted)
    warnings.push(
      `${adopted} isolated source candidates use workbenches and scene placement. Static source sections require one contact/prerequisite component; wheel-bearing parents retain reviewed child ownership. Child wheel receivers and all known prerequisites are assembled on their actual destination bench. Incomplete connector coverage, detached support, physical independence, handling and fit remain unverified.`,
    );
  if (rejected.size)
    warnings.push(
      `Scene workbench candidates retained the flat programme: ${[...rejected].map(([reason, n]) => `${n} (${reason})`).join("; ")}. No prerequisite was dropped.`,
    );
  return { adopted, warnings, staticModules };
}
