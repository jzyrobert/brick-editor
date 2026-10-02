/** Source-owned instruction candidates; authored order is a prior, not fit proof. */
import { inverse, add, mv } from "../core/math";
import type { Model, Occurrence, Project, Vec3 } from "../core/types";
import { unionBounds, type Bounds } from "../core/spatial";
import type { SourceGraphItem } from "./source-procedures";
import type { SourceProgrammeCandidate } from "./source-programme";
import {
  articulatedJawProfiles,
  articulatedDisplayFrames,
  articulatedEndpointError,
  type ArticulatedJawMatch,
} from "./articulated-procedures";

export type SourceCandidateProvenance = {
  moduleId: string;
  mode: "authored-source-prior";
  sourcePath: string[];
  recordIds: string[];
  sourceSteps: number;
  contactVerification: "unknown";
};
export type SourceCandidateResult = {
  candidates: SourceProgrammeCandidate[];
  matches: Map<string, ArticulatedJawMatch>;
  provenance: SourceCandidateProvenance[];
  refusals: { incomingId: string; reason: string }[];
  exhausted: boolean;
};
const keyFor = (role: string, path: string[]) => {
  let hash = 2166136261;
  for (const character of JSON.stringify(path))
    hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
  return `source-${role}-${(hash >>> 0).toString(16).padStart(8, "0")}`;
};
const prefix = (path: string[], wanted: string[]) =>
  wanted.every((id, n) => path[n] === id);
const step = (raw: string) => /^0\s+(?:STEP|ROTSTEP)(?:\s|$)/i.test(raw.trim());
class Refusal extends Error {}

/** A complete source section and its receiver's contiguous direct-part run are
 * distinct benches. Unmatched sibling sections/props never enter the parent.
 * Current nodes remain the geometry authority; retained records supply order. */
export function sourceGuidedCandidates(
  project: Project,
  all: Occurrence[],
  items: SourceGraphItem[],
  maxWork = 200000,
): SourceCandidateResult {
  const result: SourceCandidateResult = {
    candidates: [],
    matches: new Map(),
    provenance: [],
    refusals: [],
    exhausted: false,
  };
  if (!Number.isSafeInteger(maxWork) || maxWork < 0 || maxWork > 200000)
    return { ...result, exhausted: true };
  const profile = articulatedJawProfiles(project, all, Math.floor(maxWork / 2));
  if (profile.exhausted) return { ...result, exhausted: true };
  if (!profile.matches.length) return result;
  let work = Math.floor(maxWork / 2);
  const tick = () => {
    if (++work > maxWork) {
      result.exhausted = true;
      throw new Refusal("Source candidate search exhausted its budget.");
    }
  };
  const byId = new Map<string, Occurrence>(),
    byItem = new Map<string, SourceGraphItem>();
  try {
    for (const o of all) {
      tick();
      if (byId.has(o.id)) throw new Refusal("Source occurrence IDs repeat.");
      byId.set(o.id, o);
    }
    for (const item of items)
      for (const id of item.ids) {
        tick();
        if (byItem.has(id))
          throw new Refusal("Source drawing ownership repeats.");
        byItem.set(id, item);
      }
  } catch (error) {
    return {
      ...result,
      refusals: [{ incomingId: "", reason: (error as Error).message }],
      exhausted: result.exhausted,
    };
  }
  const recordCache = new Map<
    string,
    {
      ordered: Model["nodes"];
      ranks: Map<string, number>;
      stages: Map<string, number>;
      steps: number;
    }
  >();
  const orderedSource = (model: Model) => {
    const cached = recordCache.get(model.id);
    if (cached) return cached;
    if (model.classification !== "model")
      throw new Refusal(
        "Source section is a custom drawing, not an authored model.",
      );
    const records = new Map<
      string,
      { record: Model["records"][number]; rank: number; stage: number }
    >();
    let stages = 0;
    for (const [rank, record] of model.records.entries()) {
      tick();
      if (records.has(record.id))
        throw new Refusal("Source records repeat IDs.");
      records.set(record.id, { record, rank, stage: stages });
      if (step(record.raw)) stages++;
    }
    if (!stages)
      throw new Refusal("Source section has no authored STEP ordering prior.");
    const ranks = new Map<string, number>(),
      sourceStages = new Map<string, number>();
    for (const node of model.nodes) {
      tick();
      const r = records.get(node.sourceRecordId ?? "");
      if (
        !r ||
        r.record.nodeId !== node.id ||
        !/^1\s/.test(r.record.raw.trim())
      )
        throw new Refusal(
          "Current source membership lacks an unambiguous authored reference record.",
        );
      if (ranks.has(node.id)) throw new Refusal("Source node IDs repeat.");
      ranks.set(node.id, r.rank);
      sourceStages.set(node.id, r.stage);
    }
    const ordered = [...model.nodes].sort(
      (a, b) => ranks.get(a.id)! - ranks.get(b.id)!,
    );
    const out = { ordered, ranks, stages: sourceStages, steps: stages };
    recordCache.set(model.id, out);
    return out;
  };
  const flatten = (
    model: Model,
    path: string[],
    active = new Set<string>(),
  ): string[] => {
    tick();
    if (active.has(model.id) || path.length > 16)
      throw new Refusal(
        "Source section has cyclic or excessive nested membership.",
      );
    const next = new Set(active).add(model.id),
      source = orderedSource(model),
      ids: string[] = [];
    for (const node of source.ordered) {
      tick();
      if (node.kind === "geometry")
        throw new Refusal(
          "Source candidate includes separate drawing geometry.",
        );
      const full = [...path, node.id];
      if (node.kind === "submodel") {
        const child = project.models[node.ref];
        if (!child) throw new Refusal("A complete source child is missing.");
        ids.push(...flatten(child, full, next));
      } else {
        const id = JSON.stringify(full);
        if (!byId.has(id))
          throw new Refusal("Source occurrence list omits a source member.");
        ids.push(id);
      }
    }
    return ids;
  };
  const checkMembers = (ids: string[]) => {
    if (!ids.length || ids.length > 300 || new Set(ids).size !== ids.length)
      throw new Refusal(
        "Source membership is empty, repeated or exceeds 300 occurrences.",
      );
    const selected = ids.map((id) => byId.get(id)!);
    for (const o of selected) {
      tick();
      const item = byItem.get(o.id);
      if (
        o.node.kind !== "part" ||
        !item?.box ||
        item.broad ||
        item.component ||
        item.ids.length !== 1 ||
        [...item.box.min, ...item.box.max].some(
          (v) => !Number.isFinite(v) || Math.abs(v) > 10000000,
        ) ||
        item.box.min.some((v, n) => v > item.box!.max[n])
      )
        throw new Refusal(
          "A source member has unknown/broad bounds or whole drawing ownership.",
        );
    }
    const frames = articulatedDisplayFrames(
      project,
      selected,
      Math.max(0, maxWork - work),
    );
    work += frames.work;
    if (frames.exhausted) {
      result.exhausted = true;
      throw new Refusal("Source display-frame search exhausted its budget.");
    }
    if (frames.frames.size !== selected.length)
      throw new Refusal(
        "A complete source member has an invalid raw display path.",
      );
    let bounds: Bounds | null = null;
    for (const o of selected) {
      const box = byItem.get(o.id)!.box!,
        frame = frames.frames.get(o.id)!,
        local = inverse(o.transform);
      bounds = unionBounds(bounds, box);
      for (const x of [box.min[0], box.max[0]])
        for (const y of [box.min[1], box.max[1]])
          for (const z of [box.min[2], box.max[2]]) {
            tick();
            const p = add(local.position, mv(local.basis, [x, y, z] as Vec3));
            if (Math.hypot(...articulatedEndpointError(frame, p)) > 0.25)
              throw new Refusal(
                "A source member exceeds the bounded display-frame endpoint discrepancy.",
              );
          }
    }
    if (
      [0, 2].some((n) => bounds!.max[n] - bounds!.min[n] > 500) ||
      bounds!.max[1] - bounds!.min[1] > 650
    )
      throw new Refusal(
        "Source workbench envelope exceeds its reviewed bounds.",
      );
  };
  const adopted = new Map<
    string,
    {
      parent: SourceProgrammeCandidate;
      children: SourceProgrammeCandidate[];
      model: Model;
      path: string[];
      run: Model["nodes"];
      provenance: SourceCandidateProvenance;
    }
  >();
  for (const match of profile.matches) {
    try {
      tick();
      const incoming = byId.get(match.incomingId)!,
        receiver = byId.get(match.receiverId)!;
      const path = match.sourcePath,
        parentPath = path.slice(0, -1);
      if (
        !path.length ||
        JSON.stringify(receiver.path.slice(0, -1)) !==
          JSON.stringify(parentPath)
      )
        throw new Refusal(
          "The receiving part is not in the source child's actual parent model.",
        );
      const model = project.models[receiver.modelId],
        source = orderedSource(model),
        reference = source.ordered.find((n) => n.id === path.at(-1));
      if (!reference || reference.kind !== "submodel")
        throw new Refusal(
          "Incoming membership has no source submodel reference.",
        );
      const childModel = project.models[reference.ref];
      if (!childModel || incoming.modelId !== childModel.id)
        throw new Refusal(
          "Incoming source model is not the complete immediate section.",
        );
      const receiverIndex = source.ordered.findIndex(
        (n) => n.id === receiver.node.id,
      );
      if (receiverIndex < 0)
        throw new Refusal("Receiver source record is missing.");
      let first = receiverIndex,
        last = receiverIndex;
      while (first > 0 && source.ordered[first - 1].kind === "part") first--;
      while (
        last + 1 < source.ordered.length &&
        source.ordered[last + 1].kind === "part"
      )
        last++;
      const run = source.ordered.slice(first, last + 1),
        referenceRank = source.ranks.get(reference.id)!;
      if (
        source.ranks.get(run.at(-1)!.id)! >= referenceRank ||
        source.stages.get(reference.id)! <= source.stages.get(run.at(-1)!.id)!
      )
        throw new Refusal(
          "Source child placement has no later authored STEP boundary after the receiving run.",
        );
      const childMembers = flatten(childModel, path),
        direct = run.map((n) => JSON.stringify([...parentPath, n.id]));
      if (
        !childMembers.includes(incoming.id) ||
        childMembers.includes(receiver.id)
      )
        throw new Refusal("Source child/receiver ownership is inconsistent.");
      const actual = all.filter((o) => prefix(o.path, path)).map((o) => o.id);
      if (
        actual.length !== childMembers.length ||
        actual.some((id) => !childMembers.includes(id))
      )
        throw new Refusal(
          "Source child membership is incomplete or contains foreign leaves.",
        );
      const parentId = keyFor("body", [
          ...parentPath,
          run[0].id,
          run.at(-1)!.id,
        ]),
        childId = keyFor("attachment", path);
      const existing = adopted.get(parentId);
      const previousMatch = result.matches.get(childId);
      if (
        previousMatch &&
        JSON.stringify(previousMatch.sourcePath) !== JSON.stringify(path)
      )
        throw new Refusal("Stable attachment key collision.");
      if (
        existing &&
        (JSON.stringify(existing.path) !== JSON.stringify(parentPath) ||
          JSON.stringify(existing.run.map((n) => n.id)) !==
            JSON.stringify(run.map((n) => n.id)))
      )
        throw new Refusal("Stable source key collision.");
      const child: SourceProgrammeCandidate = {
        id: childId,
        name: childModel.name,
        members: childMembers,
        sourceOrder: [...childMembers],
        parentId,
        placement: "attachment",
        receivers: [receiver.id],
        buildNotes:
          "Build this source section on its own supported workbench. Keep loose foundation pieces in the pictured relative positions until later connecting parts. Prepare both clip openings for the later handle comparison; source order does not prove detached support or physical fit.",
        joinNotes:
          "Support the receiving body and this source section underneath. Compare both 60470b clip openings with the exposed 48336 handle. Keep a supplied joined assembly intact. Check spacing and engagement before releasing. No new parts. The source pose does not prescribe a snap, insertion route or safe physical turn.",
      };
      if (existing?.children.some((c) => c.id === childId))
        throw new Refusal(
          "A source section has competing attachment procedures.",
        );
      const children = [...(existing?.children ?? []), child],
        members = [...direct, ...children.flatMap((c) => c.members)];
      checkMembers(members);
      const parent: SourceProgrammeCandidate = {
        id: parentId,
        name: `${model.name} — main source body`,
        members,
        sourceOrder: source.ordered.flatMap((n) =>
          run.includes(n)
            ? [JSON.stringify([...parentPath, n.id])]
            : (children.find(
                (c) => c.id === keyFor("attachment", [...parentPath, n.id]),
              )?.sourceOrder ?? []),
        ),
        placement: "scene",
        receivers: [],
        buildNotes:
          "Build this source body's pictured pieces on its own supported bench. Keep loose members in their shown relative positions until later connecting pieces. Authored source order, support and physical fit remain unverified.",
        joinNotes:
          "Place this completed source body in the scene as shown. No new parts and no mating connection inferred. Support it underneath and choose a safe resting position before releasing; the source pose does not establish balance or a supported physical turn.",
      };
      const childRecords = orderedSource(childModel),
        provenance: SourceCandidateProvenance = {
          moduleId: parentId,
          mode: "authored-source-prior",
          sourcePath: parentPath,
          recordIds: [
            ...run.map((n) => n.sourceRecordId!),
            reference.sourceRecordId!,
          ],
          sourceSteps: source.steps,
          contactVerification: "unknown",
        };
      adopted.set(parentId, {
        parent,
        children,
        model,
        path: parentPath,
        run,
        provenance,
      });
      result.matches.set(childId, match);
      result.provenance.push({
        moduleId: childId,
        mode: "authored-source-prior",
        sourcePath: [...path],
        recordIds: childRecords.ordered.map((n) => n.sourceRecordId!),
        sourceSteps: childRecords.steps,
        contactVerification: "unknown",
      });
    } catch (error) {
      result.refusals.push({
        incomingId: match.incomingId,
        reason: (error as Error).message,
      });
      if (result.exhausted) break;
    }
  }
  if (result.exhausted)
    return { ...result, candidates: [], matches: new Map(), provenance: [] };
  for (const entry of adopted.values()) {
    result.candidates.push(entry.parent, ...entry.children);
    result.provenance.push(entry.provenance);
  }
  const owned = new Map<string, string>();
  for (const c of result.candidates.filter((c) => !c.parentId))
    for (const id of c.members) {
      if (owned.has(id))
        return {
          ...result,
          candidates: [],
          matches: new Map(),
          provenance: [],
          refusals: [
            ...result.refusals,
            {
              incomingId: "",
              reason:
                "Source parents overlap without a proven laminar relationship.",
            },
          ],
        };
      owned.set(id, c.id);
    }
  return result;
}
