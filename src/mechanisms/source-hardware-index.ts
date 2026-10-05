import { encodePath, occurrences } from "../core/document";
import { preflightExpansion, expansionLimits } from "../core/expansion-policy";
import { compose, identity } from "../core/math";
import {
  ensure,
  type Model,
  type Occurrence,
  type Project,
  type Transform,
} from "../core/types";
import {
  sourceMechanicalContent,
  type SourceFlexibleContent,
} from "./source-content";

/** Organization only: these identities prove source ancestry, never an
 * attachment, inventory certification, collision proxy or movable joint. */
export const SOURCE_HARDWARE_LIMITS = Object.freeze({
  placements: 8192,
  owners: 16384,
  visitedNodes: 200_000,
  leafAssignments: 150_000,
  pathVisits: 4_000_000,
});
export type SourceHardwarePlacement = {
  id: string;
  path: string[];
  reference: string;
  frame: Transform;
  sourceNodeId: string;
  modelId: string;
  namespace: "official" | "project" | "missing";
  /** Every original materialized leaf, including authored primitive surfaces. */
  occurrenceIds: string[];
};
export type SourceFlexibleCapComponent = SourceHardwarePlacement & {
  flexibleId: string;
  end: "start" | "end";
};
type Owner = {
  kind: "hardware" | "cap" | "skin" | "unresolved";
  id: string;
  occurrenceIds: string[];
};
type Trie = { children: Map<string, Trie>; owner?: Owner };
const declaredPart = (model: Model) =>
  model.records.some((r) =>
    /^\s*0\s+!LDRAW_ORG\s+(?:Unofficial_)?(?:Part|Shortcut)(?:\s|$)/i.test(
      r.raw,
    ),
  );

/** Bounded semantic source hierarchy, independent of rendered triangulation.
 * Embedded declared DAT parts retain their actual parent placement even when
 * the ordinary renderer expands them into many primitive/part leaves. Plain
 * submodel hierarchy never supplies a physical parent or weld. Flexible caps
 * remain separately addressable components of their owning hose/spring; they
 * are not additional inventory bricks. All leaves have exactly one owner. */
export function sourceHardwareIndex(
  project: Project,
  all: Occurrence[] = occurrences(project),
) {
  const expected = preflightExpansion(project, expansionLimits()).metrics
      .leafCount,
    content = sourceMechanicalContent(project, all);
  ensure(
    all.length <= SOURCE_HARDWARE_LIMITS.leafAssignments,
    "LIMIT_EXCEEDED",
    "Too many source leaves for the hardware index",
  );
  const hardware: SourceHardwarePlacement[] = [],
    capComponents: SourceFlexibleCapComponent[] = [],
    unresolved: SourceHardwarePlacement[] = [],
    flexible = new Map(content.flexible.map((f) => [f.id, f])),
    lookup = new Map(all.map((o) => [o.id, o])),
    classifications = new Map<string, boolean>();
  const isPart = (modelId: string) => {
    if (!classifications.has(modelId))
      classifications.set(modelId, declaredPart(project.models[modelId]));
    return classifications.get(modelId)!;
  };
  const nodeLookup = new Map(
    Object.entries(project.models).map(([id, m]) => [
      id,
      new Map(m.nodes.map((n) => [n.id, n])),
    ]),
  );
  const root: Trie = { children: new Map() },
    owners: Owner[] = [],
    byLeaf: Record<string, { kind: Owner["kind"]; id: string }> =
      Object.create(null);
  let nodes = 0,
    pathVisits = 0;
  const register = (path: string[], owner: Owner) => {
    ensure(
      owners.length < SOURCE_HARDWARE_LIMITS.owners,
      "LIMIT_EXCEEDED",
      "Too many physical source owners",
    );
    let cursor = root;
    for (const step of path) {
      let next = cursor.children.get(step);
      if (!next) {
        next = { children: new Map() };
        cursor.children.set(step, next);
      }
      cursor = next;
    }
    ensure(!cursor.owner, "INVALID_INPUT", "Ambiguous physical source owner");
    cursor.owner = owner;
    owners.push(owner);
  };
  const caps = (host: SourceFlexibleContent) => {
    register(host.path, { kind: "skin", id: host.id, occurrenceIds: [] });
    for (const cap of host.caps) {
      if (!cap.sourceNodeId) continue; // Unresolved metadata remains in issues.
      const model = project.models[host.modelId],
        node = model.nodes.find((n) => n.id === cap.sourceNodeId)!;
      ensure(node, "INVALID_INPUT", "The source cap placement disappeared");
      const path = [...host.path, cap.sourceNodeId],
        occurrenceIds: string[] = [],
        placement: SourceFlexibleCapComponent = {
          id: encodePath(path),
          path,
          reference: cap.reference,
          frame: structuredClone(cap.frame),
          sourceNodeId: cap.sourceNodeId,
          modelId: host.modelId,
          namespace:
            node.kind === "submodel"
              ? "project"
              : cap.occurrenceIds.some(
                    (id) => lookup.get(id)?.namespace === "missing",
                  )
                ? "missing"
                : "official",
          occurrenceIds,
          flexibleId: host.id,
          end: cap.group,
        };
      capComponents.push(placement);
      register(path, { kind: "cap", id: placement.id, occurrenceIds });
    }
  };
  const walk = (modelId: string, path: string[], frame: Transform) => {
    const model = project.models[modelId];
    for (const node of model.nodes) {
      ensure(
        ++nodes <= SOURCE_HARDWARE_LIMITS.visitedNodes,
        "LIMIT_EXCEEDED",
        "Too many source hierarchy nodes",
      );
      const next = [...path, node.id],
        id = encodePath(next),
        transform = compose(frame, node.transform),
        host = flexible.get(id);
      if (host) {
        caps(host);
        continue;
      }
      if (node.kind === "submodel" && !isPart(node.ref)) {
        walk(node.ref, next, transform);
        continue;
      }
      const occurrenceIds: string[] = [],
        namespace =
          node.kind === "submodel"
            ? "project"
            : (lookup.get(id)?.namespace ?? "missing");
      const placement: SourceHardwarePlacement = {
        id,
        path: next,
        reference: node.ref,
        frame: transform,
        sourceNodeId: node.id,
        modelId,
        namespace,
        occurrenceIds,
      };
      // An authored primitive surface has no claim to be a real catalogue part.
      if (node.kind === "geometry") {
        unresolved.push(placement);
        register(next, { kind: "unresolved", id, occurrenceIds });
      } else {
        hardware.push(placement);
        register(next, { kind: "hardware", id, occurrenceIds });
      }
      ensure(
        hardware.length + unresolved.length + capComponents.length <=
          SOURCE_HARDWARE_LIMITS.placements,
        "LIMIT_EXCEEDED",
        "Too many source hardware placements",
      );
    }
  };
  walk(project.rootModelId, [], identity());
  const seen = new Set<string>();
  for (const leaf of all) {
    ensure(!seen.has(leaf.id), "INVALID_INPUT", "Duplicate source render leaf");
    seen.add(leaf.id);
    ensure(
      leaf.id === encodePath(leaf.path),
      "INVALID_INPUT",
      "Invalid source leaf path identity",
    );
    let modelId = project.rootModelId;
    for (let k = 0; k < leaf.path.length; k++) {
      const node = nodeLookup.get(modelId)?.get(leaf.path[k]);
      ensure(
        node &&
          (k === leaf.path.length - 1
            ? node === leaf.node && node.kind !== "submodel"
            : node.kind === "submodel"),
        "INVALID_INPUT",
        "A source leaf path does not match its actual definition",
      );
      modelId = node.ref;
    }
    let cursor = root,
      owner = cursor.owner;
    for (const step of leaf.path) {
      ensure(
        ++pathVisits <= SOURCE_HARDWARE_LIMITS.pathVisits,
        "LIMIT_EXCEEDED",
        "Source hardware path work exceeds its budget",
      );
      const next = cursor.children.get(step);
      if (!next) break;
      cursor = next;
      owner = cursor.owner ?? owner;
    }
    ensure(
      owner,
      "INVALID_INPUT",
      "A source render leaf has no hardware owner",
    );
    owner.occurrenceIds.push(leaf.id);
    byLeaf[leaf.id] = { kind: owner.kind, id: owner.id };
  }
  ensure(
    all.length === expected,
    "INVALID_INPUT",
    "The source leaf view is incomplete",
  );
  // Exact authored ancestry must agree with the ordinary source-content view.
  for (const cap of capComponents) {
    const declared = flexible
      .get(cap.flexibleId)!
      .caps.find((c) => c.sourceNodeId === cap.sourceNodeId)!;
    ensure(
      JSON.stringify(cap.occurrenceIds) ===
        JSON.stringify(declared.occurrenceIds),
      "INVALID_INPUT",
      "Source cap leaves disagree with their literal ancestry",
    );
  }
  return {
    hardware,
    flexible: content.flexible,
    capComponents,
    unresolved,
    byLeaf,
    renderedOccurrences: all.length,
    sourcePlacements: hardware.length + content.flexible.length,
    visitedNodes: nodes,
    pathVisits,
  };
}
