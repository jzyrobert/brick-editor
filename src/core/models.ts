import { encodePath, occurrences } from "./document";
import { identity, add } from "./math";
import {
  ensure,
  uid,
  type Project,
  type Occurrence,
  type Node,
  type Vec3,
  type Model,
} from "./types";
import { validateRig } from "../mechanisms/kinematic";

type Bfc = {
  certified: boolean | null;
  ccw: boolean;
  clip: boolean;
  invert: boolean;
};
function stateBefore(records: Model["records"], index: number): Bfc {
  const s: Bfc = { certified: null, ccw: true, clip: true, invert: false };
  for (const r of records.slice(0, index)) {
    const line = r.raw.trim();
    if (!line) continue;
    const bfc = line.match(/^0\s+BFC\s+(.+)$/);
    s.invert = false;
    if (bfc) {
      if (s.certified === false) continue;
      const t = bfc[1].split(/\s+/);
      if (t.includes("NOCERTIFY")) {
        s.certified = false;
        continue;
      }
      s.certified = true;
      if (t.includes("CW")) s.ccw = false;
      if (t.includes("CCW")) s.ccw = true;
      if (t.includes("CLIP")) s.clip = true;
      if (t.includes("NOCLIP")) s.clip = false;
      if (t.includes("INVERTNEXT")) s.invert = true;
    } else if (/^[1-5]\s/.test(line) && s.certified === null)
      s.certified = false;
  }
  return s;
}
function metadataSafe(model: Model) {
  for (const r of model.records) {
    const directive = r.raw
      .trim()
      .match(/^0\s+(!\S+|STEP|ROTSTEP|BUFEXCHG|GHOST|SYNTH|MLCAD|LPUB)\b/i)?.[1]
      .toUpperCase();
    ensure(
      !directive ||
        [
          "!COLOUR",
          "!LICENSE",
          "!LDRAW_ORG",
          "!CATEGORY",
          "!KEYWORDS",
          "!HISTORY",
        ].includes(directive),
      "INVALID_INPUT",
      `Make submodel cannot safely relocate ${directive} source metadata. Use an editor group or remove that directive explicitly.`,
    );
  }
}
function remapMetadata(p: Project, mapping: Record<string, string>) {
  const remap = (id: string) => mapping[id] || id;
  p.layerAssignments = Object.fromEntries(
    Object.entries(p.layerAssignments).map(([id, value]) => [remap(id), value]),
  );
  p.marketplace.overrides = Object.fromEntries(
    Object.entries(p.marketplace.overrides).map(([id, value]) => [
      remap(id),
      value,
    ]),
  );
  for (const name of Object.keys(p.groups))
    p.groups[name] = p.groups[name].map(remap);
  for (const plan of Object.values(p.instructionPlans))
    plan.steps = plan.steps.map((step) => step.map(remap));
  for (const diagnostic of p.diagnostics)
    diagnostic.occurrenceIds = diagnostic.occurrenceIds.map(remap);
  for (const rig of Object.values(p.motionRigs)) {
    for (const group of rig.groups) {
      group.occurrenceIds = group.occurrenceIds.map(remap);
      group.restTransforms = Object.fromEntries(
        Object.entries(group.restTransforms).map(([id, value]) => [
          remap(id),
          value,
        ]),
      );
    }
    validateRig(p, rig);
  }
}
/** Structural grouping of contiguous sibling leaves, preserving local source scope. */
export function makeSubmodel(
  p: Project,
  selected: Occurrence[],
  request: { name: string; pivot?: Vec3 },
  makeUnique: (p: Project, o: Occurrence) => Node,
) {
  const parent = selected[0].path.slice(0, -1),
    parentKey = encodePath(parent);
  ensure(
    selected.every((o) => encodePath(o.path.slice(0, -1)) === parentKey),
    "INVALID_INPUT",
    "Make submodel requires sibling parts in one parent instance. Group separate parent instances individually.",
  );
  ensure(
    typeof request.name === "string" &&
      request.name.trim().length > 0 &&
      request.name.length <= 200 &&
      !/[\r\n\0]/.test(request.name),
    "INVALID_INPUT",
    "Name the new submodel.",
  );
  ensure(
    Object.keys(p.metadata).every((key) => key === "preamble"),
    "INVALID_INPUT",
    "Make submodel cannot remap unknown project metadata.",
  );
  makeUnique(p, selected[0]);
  let owner = p.models[p.rootModelId];
  for (const id of parent)
    owner = p.models[owner.nodes.find((n) => n.id === id)!.ref];
  metadataSafe(owner);
  const chosen = new Set(selected.map((o) => o.node.id)),
    positions = owner.nodes
      .map((n, i) => (chosen.has(n.id) ? i : -1))
      .filter((i) => i >= 0);
  ensure(
    positions.at(-1)! - positions[0] + 1 === selected.length,
    "INVALID_INPUT",
    "Select contiguous siblings to preserve authored source ordering.",
  );
  // Materialize existing authored references in their original export order so
  // every moved node has a stable source anchor, including newly placed parts.
  for (const node of owner.nodes)
    if (!node.sourceRecordId) {
      ensure(
        node.kind !== "geometry",
        "INVALID_INPUT",
        "Primitive source record is required.",
      );
      const recordId = uid();
      node.sourceRecordId = recordId;
      owner.records.push({
        id: recordId,
        nodeId: node.id,
        raw: `1 ${node.colorCode} ${[...node.transform.position, ...node.transform.basis].join(" ")} ${p.models[node.ref]?.name || node.ref}`,
      });
    }
  const nodes = owner.nodes.slice(positions[0], positions.at(-1)! + 1),
    key = uid(),
    wrapper = uid(),
    pivot = request.pivot || [0, 0, 0];
  ensure(
    pivot.length === 3 && pivot.every(Number.isFinite),
    "INVALID_INPUT",
    "Pivot must be a finite parent-local LDraw position.",
  );
  const records = owner.records,
    recordIndices = records
      .map((r, i) => (r.nodeId && chosen.has(r.nodeId) ? i : -1))
      .filter((i) => i >= 0);
  ensure(
    recordIndices.length === 0 || recordIndices.length === nodes.length,
    "INVALID_INPUT",
    "Cannot mix source-backed and newly added nodes in one structural operation. Group them separately.",
  );
  const liveIds = new Set(owner.nodes.map((node) => node.id));
  ensure(
    !records
      .slice(recordIndices[0], recordIndices.at(-1)! + 1)
      .some(
        (record) =>
          record.nodeId &&
          liveIds.has(record.nodeId) &&
          !chosen.has(record.nodeId),
      ),
    "INVALID_INPUT",
    "Selection crosses unselected source records; choose a contiguous source span.",
  );
  const child: Model = {
    id: key,
    name: `submodel-${key}.ldr`,
    classification: "model",
    nodes: structuredClone(nodes),
    records: [],
  };
  const childRecord = (raw: string) => ({ id: uid(), raw });
  if (recordIndices.length) {
    const first = recordIndices[0],
      last = recordIndices.at(-1)!,
      state = stateBefore(records, first),
      winding = state.ccw ? "CCW" : "CW";
    child.records.push(childRecord(`0 ${request.name.trim()}`));
    for (const r of records.slice(0, first))
      if (/^0\s+!COLOUR\s/.test(r.raw.trim()))
        child.records.push(childRecord(r.raw));
    child.records.push(
      childRecord(
        state.certified === true
          ? `0 BFC CERTIFY ${winding}`
          : "0 BFC NOCERTIFY",
      ),
    );
    if (state.certified === true && !state.clip)
      child.records.push(childRecord("0 BFC NOCLIP"));
    if (state.invert) child.records.push(childRecord("0 BFC INVERTNEXT"));
    for (const record of structuredClone(records.slice(first, last + 1)))
      child.records.push(record);
    const sourceId = uid();
    const replacement: Model["records"] = [
      ...(state.certified === true ? [childRecord("0 BFC CLIP CCW")] : []),
      {
        id: sourceId,
        raw: `1 16 ${pivot.join(" ")} 1 0 0 0 1 0 0 0 1 ${child.name}`,
        nodeId: wrapper,
      },
      ...(state.certified === true
        ? state.clip
          ? [childRecord(`0 BFC CLIP ${winding}`)]
          : [childRecord(`0 BFC ${winding}`), childRecord("0 BFC NOCLIP")]
        : []),
    ];
    owner.records = records.flatMap((r, i) => {
      if (/^0\s+BFC\s+INVERTNEXT\s*$/.test(r.raw.trim())) {
        let next = i + 1;
        while (next < records.length && !records[next].raw.trim()) next++;
        if (records[next]?.nodeId && chosen.has(records[next].nodeId!))
          return [];
      }
      if (i === first) return replacement;
      if (r.nodeId && chosen.has(r.nodeId)) return [];
      return [r];
    });
    const reference: Node = {
      id: wrapper,
      kind: "submodel",
      ref: key,
      colorCode: "16",
      transform: { ...identity(), position: [...pivot] as Vec3 },
      sourceRecordId: sourceId,
    };
    owner.nodes.splice(positions[0], nodes.length, reference);
  } else {
    child.records = [childRecord(`0 ${request.name.trim()}`)];
    owner.nodes.splice(positions[0], nodes.length, {
      id: wrapper,
      kind: "submodel",
      ref: key,
      colorCode: "16",
      transform: { ...identity(), position: [...pivot] as Vec3 },
    });
  }
  for (const node of child.nodes) {
    node.transform.position = add(
      node.transform.position,
      pivot.map((n) => -n) as Vec3,
    );
    if (node.kind === "geometry") node.ref = key;
  }
  p.models[key] = child;
  const mapping = Object.fromEntries(
    selected.map((o) => [o.id, encodePath([...parent, wrapper, o.node.id])]),
  );
  remapMetadata(p, mapping);
  return mapping;
}
export function sharedDefinitionTargets(
  p: Project,
  definitionId: string,
  nodeIds: string[],
) {
  const definition = p.models[definitionId];
  ensure(
    definition && definition.classification === "model",
    "INVALID_INPUT",
    "Shared editing targets a user submodel definition, not a physical part.",
  );
  ensure(
    nodeIds.length > 0 && new Set(nodeIds).size === nodeIds.length,
    "INVALID_INPUT",
    "Choose unique definition node IDs.",
  );
  ensure(
    nodeIds.every((id) =>
      definition.nodes.some((n) => n.id === id && n.kind !== "submodel"),
    ),
    "INVALID_INPUT",
    "Shared edits currently target direct leaf nodes; choose their owning definition.",
  );
  const targets = occurrences(p).filter(
    (o) => o.modelId === definitionId && nodeIds.includes(o.node.id),
  );
  ensure(
    targets.length > 0,
    "INVALID_INPUT",
    "Definition has no placed target occurrences.",
  );
  return targets;
}
