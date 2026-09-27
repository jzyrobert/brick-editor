import {
  type Project,
  type Command,
  type Node,
  type Occurrence,
  type Transform,
  ensure,
  uid,
} from "./types";
import {
  createProject,
  occurrences,
  validateDocument,
  encodePath,
} from "./document";
import { identity, compose, inverse, add } from "./math";
import { validate } from "./validate";
import { canonical } from "../ldraw/path";
import { stable } from "./hash";
type Patch = { path: string[]; before: unknown; after: unknown };
function diff(a: any, b: any, path: string[] = []): Patch[] {
  if (stable(a) === stable(b)) return [];
  if (
    a &&
    b &&
    !Array.isArray(a) &&
    !Array.isArray(b) &&
    typeof a === "object" &&
    typeof b === "object"
  )
    return [...new Set([...Object.keys(a), ...Object.keys(b)])]
      .filter((k) => k !== "revision" || path.length > 0)
      .flatMap((k) => diff(a[k], b[k], [...path, k]));
  return [{ path, before: a, after: b }];
}
function applyPatches(p: Project, patches: Patch[], undo: boolean) {
  for (const patch of patches) {
    let obj: any = p;
    for (const key of patch.path.slice(0, -1)) obj = obj[key];
    const key = patch.path.at(-1)!;
    const value = undo ? patch.before : patch.after;
    if (value === undefined) delete obj[key];
    else obj[key] = structuredClone(value);
  }
}
function fields(payload: Record<string, any>, allowed: string[]) {
  ensure(
    Object.keys(payload).every((k) => allowed.includes(k)),
    "INVALID_INPUT",
    "Unknown command payload field",
  );
}
function editable(p: Project, payload: Record<string, any>): Occurrence[] {
  ensure(
    Array.isArray(payload.occurrenceIds) && payload.occurrenceIds.length > 0,
    "INVALID_INPUT",
    "Select at least one occurrence",
  );
  const all = occurrences(p),
    found = all.filter((o) => payload.occurrenceIds.includes(o.id));
  ensure(
    found.length === new Set(payload.occurrenceIds).size,
    "INVALID_INPUT",
    "Unknown occurrence ID",
  );
  for (const o of found) {
    ensure(
      !p.layers[o.layerId].locked,
      "LAYER_LOCKED",
      "Unlock the target layer before editing",
    );
    ensure(
      o.visible || payload.includeHidden === true,
      "INVALID_INPUT",
      "Hidden targets require includeHidden",
    );
    if (payload.activeLayerId)
      ensure(
        o.layerId === payload.activeLayerId,
        "INVALID_INPUT",
        "Target outside active layer",
      );
  }
  return found;
}
// Node IDs are local to definitions. Cloning a definition preserves its local IDs,
// hence all occurrence paths and occurrence-scoped metadata stay stable.
function uniqueNode(p: Project, o: Occurrence): Node {
  let model = p.models[p.rootModelId];
  for (const id of o.path.slice(0, -1)) {
    const n = model.nodes.find((n) => n.id === id)!;
    let count = 0;
    for (const m of Object.values(p.models))
      count += m.nodes.filter(
        (x) => x.kind === "submodel" && x.ref === n.ref,
      ).length;
    if (count > 1) {
      const cloned = structuredClone(p.models[n.ref]);
      cloned.id = uid();
      cloned.name = `unique-${cloned.id}.ldr`;
      p.models[cloned.id] = cloned;
      n.ref = cloned.id;
    }
    model = p.models[n.ref];
  }
  return model.nodes.find((n) => n.id === o.path.at(-1))!;
}
function mutate(p: Project, c: Command) {
  const v = c.payload;
  const scopeFields = ["occurrenceIds", "includeHidden", "activeLayerId"];
  switch (c.type) {
    case "project.rename":
      fields(v, ["title"]);
      ensure(
        typeof v.title === "string" && v.title.length <= 200,
        "INVALID_INPUT",
        "Invalid title",
      );
      p.title = v.title;
      break;
    case "parts.add": {
      fields(v, ["parts", "layerId", "maxAdditions"]);
      ensure(
        Array.isArray(v.parts) &&
          v.parts.length > 0 &&
          v.parts.length <= Math.min(v.maxAdditions ?? 10000, 10000),
        "LIMIT_EXCEEDED",
        "Invalid additions budget",
      );
      const layer = v.layerId || p.defaultLayerId;
      ensure(p.layers[layer], "INVALID_INPUT", "Unknown layer");
      ensure(!p.layers[layer].locked, "LAYER_LOCKED", "Target layer is locked");
      for (const input of v.parts) {
        fields(input, ["ref", "colorCode", "transform"]);
        const n: Node = {
          id: uid(),
          kind: "part",
          ref: canonical(input.ref),
          colorCode: input.colorCode,
          transform: input.transform || identity(),
        };
        ensure(
          typeof n.colorCode === "string",
          "INVALID_INPUT",
          "Color code required",
        );
        p.models[p.rootModelId].nodes.push(n);
        p.layerAssignments[encodePath([n.id])] = layer;
      }
      break;
    }
    case "parts.remove":
    case "parts.recolor":
    case "parts.transform":
    case "parts.replace":
    case "parts.duplicate": {
      const allowed =
        c.type === "parts.recolor"
          ? ["colorCode", "preserveFixedColors"]
          : c.type === "parts.transform"
            ? ["delta", "transform", "space"]
            : c.type === "parts.replace"
              ? ["ref"]
              : c.type === "parts.duplicate"
                ? ["delta"]
                : [];
      fields(v, [...scopeFields, ...allowed]);
      const selected = editable(p, v);
      if (c.type === "parts.recolor")
        ensure(
          typeof v.colorCode === "string" &&
            /^\d+$|^0x2[\da-f]{6}$/i.test(v.colorCode),
          "INVALID_INPUT",
          "Invalid color code",
        );
      if (c.type === "parts.transform")
        ensure(
          (v.space ?? "ldraw") === "ldraw" && (v.delta || v.transform),
          "INVALID_INPUT",
          "Specify an LDraw transform or delta",
        );
      for (const o of selected) {
        const n = uniqueNode(p, o);
        if (c.type === "parts.remove") {
          const owner = Object.values(p.models).find((m) =>
            m.nodes.includes(n),
          )!;
          owner.nodes = owner.nodes.filter((x) => x !== n);
          delete p.layerAssignments[o.id];
          delete p.marketplace.overrides[o.id];
          for (const g of Object.values(p.groups)) {
            const i = g.indexOf(o.id);
            if (i >= 0) g.splice(i, 1);
          }
          for (const plan of Object.values(p.instructionPlans))
            plan.steps = plan.steps.map((s) => s.filter((id) => id !== o.id));
        }
        if (c.type === "parts.recolor") n.colorCode = v.colorCode;
        if (c.type === "parts.replace") {
          n.ref = canonical(v.ref);
          n.kind = "part";
        }
        if (c.type === "parts.transform") {
          const parent = parentTransform(p, o.path);
          const world: Transform = v.transform || {
            ...o.transform,
            position: add(o.transform.position, v.delta),
          };
          n.transform = compose(inverse(parent), world);
        }
        if (c.type === "parts.duplicate") {
          ensure(
            n.kind !== "geometry",
            "INVALID_INPUT",
            "Duplicate a custom part definition rather than a standalone source primitive",
          );
          const copy = {
            ...structuredClone(n),
            id: uid(),
            transform: {
              ...o.transform,
              position: add(o.transform.position, v.delta || [20, 0, 20]),
            },
          };
          delete copy.sourceRecordId;
          p.models[p.rootModelId].nodes.push(copy);
          p.layerAssignments[encodePath([copy.id])] = o.layerId;
        }
      }
      break;
    }
    case "layers.add":
      fields(v, ["name"]);
      ensure(
        typeof v.name === "string",
        "INVALID_INPUT",
        "Layer name required",
      );
      {
        const id = uid();
        p.layers[id] = {
          id,
          name: v.name,
          visible: true,
          locked: false,
          order: Object.keys(p.layers).length,
        };
      }
      break;
    case "layers.update":
      fields(v, ["layerId", "name", "visible", "locked"]);
      {
        const l = p.layers[v.layerId];
        ensure(l, "INVALID_INPUT", "Unknown layer");
        for (const key of ["name", "visible", "locked"] as const)
          if (v[key] !== undefined) (l as any)[key] = v[key];
      }
      break;
    case "layers.rename":
      fields(v, ["layerId", "name"]);
      ensure(
        p.layers[v.layerId] && typeof v.name === "string",
        "INVALID_INPUT",
        "Invalid layer name",
      );
      p.layers[v.layerId].name = v.name;
      break;
    case "layers.reorder":
      fields(v, ["layerIds"]);
      ensure(
        Array.isArray(v.layerIds) &&
          v.layerIds.length === Object.keys(p.layers).length &&
          new Set(v.layerIds).size === v.layerIds.length &&
          v.layerIds.every((id: string) => p.layers[id]),
        "INVALID_INPUT",
        "Provide every layer exactly once",
      );
      v.layerIds.forEach((id: string, i: number) => (p.layers[id].order = i));
      break;
    case "layers.remove": {
      fields(v, ["layerId", "mode", "destinationLayerId"]);
      const layer = p.layers[v.layerId];
      ensure(
        layer && !layer.locked,
        "LAYER_LOCKED",
        "Unlock the layer before deleting it",
      );
      ensure(
        Object.keys(p.layers).length > 1,
        "INVALID_INPUT",
        "Keep at least one layer",
      );
      ensure(
        v.mode === "delete-contents" || v.mode === "reassign",
        "INVALID_INPUT",
        "Choose deletion or reassignment explicitly",
      );
      const target = p.layers[v.destinationLayerId];
      ensure(
        target && target.id !== layer.id && !target.locked,
        "LAYER_LOCKED",
        "Choose a different unlocked destination layer",
      );
      const ids = occurrences(p)
        .filter((o) => o.layerId === layer.id)
        .map((o) => o.id);
      if (v.mode === "delete-contents" && ids.length)
        mutate(p, {
          ...c,
          type: "parts.remove",
          payload: { occurrenceIds: ids, includeHidden: true },
        });
      else for (const id of ids) p.layerAssignments[id] = target.id;
      if (p.defaultLayerId === layer.id) p.defaultLayerId = target.id;
      delete p.layers[layer.id];
      break;
    }
    case "groups.create":
      fields(v, ["name", "occurrenceIds"]);
      ensure(
        typeof v.name === "string" &&
          !["__proto__", "constructor", "prototype"].includes(v.name),
        "INVALID_INPUT",
        "Invalid group name",
      );
      {
        const all = new Set(occurrences(p).map((o) => o.id));
        ensure(
          Array.isArray(v.occurrenceIds) &&
            v.occurrenceIds.every((id: string) => all.has(id)),
          "INVALID_INPUT",
          "Invalid group members",
        );
        p.groups[v.name] = [...new Set(v.occurrenceIds as string[])];
      }
      break;
    case "camera.bookmark":
      fields(v, ["name", "camera"]);
      validate("camera", v.camera);
      ensure(
        typeof v.name === "string" &&
          !["__proto__", "constructor", "prototype"].includes(v.name),
        "INVALID_INPUT",
        "Invalid bookmark name",
      );
      p.cameraBookmarks[v.name] = v.camera;
      break;
    case "layers.assign":
      fields(v, [...scopeFields, "layerId"]);
      ensure(
        p.layers[v.layerId] && !p.layers[v.layerId].locked,
        "LAYER_LOCKED",
        "Destination unavailable",
      );
      for (const o of editable(p, v)) p.layerAssignments[o.id] = v.layerId;
      break;
    case "inventory.override":
      fields(v, ["occurrenceId", "mapping"]);
      ensure(
        occurrences(p).some((o) => o.id === v.occurrenceId),
        "INVALID_INPUT",
        "Unknown occurrence",
      );
      if (v.mapping === null) delete p.marketplace.overrides[v.occurrenceId];
      else {
        ensure(
          v.mapping?.acknowledged === true,
          "INVALID_INPUT",
          "Mapping requires acknowledgement",
        );
        p.marketplace.overrides[v.occurrenceId] = v.mapping;
      }
      break;
    case "instructions.layers":
      fields(v, ["name", "maxPerStep"]);
      {
        const n = v.maxPerStep ?? 10;
        ensure(
          Number.isInteger(n) && n > 0 && n <= 1000,
          "INVALID_INPUT",
          "Invalid step size",
        );
        const all = occurrences(p);
        const steps: string[][] = [];
        for (const layer of Object.values(p.layers).sort(
          (a, b) => a.order - b.order,
        )) {
          const ids = all
            .filter((o) => o.layerId === layer.id)
            .map((o) => o.id);
          for (let i = 0; i < ids.length; i += n)
            steps.push(ids.slice(i, i + n));
        }
        p.instructionPlans[uid()] = { name: v.name || "By layer", steps };
      }
      break;
    default:
      ensure(false, "INVALID_INPUT", "Unsupported command " + c.type);
  }
}
function parentTransform(p: Project, path: string[]) {
  let t = identity(),
    m = p.models[p.rootModelId];
  for (const id of path.slice(0, -1)) {
    const n = m.nodes.find((n) => n.id === id)!;
    t = compose(t, n.transform);
    m = p.models[n.ref];
  }
  return t;
}
export class Editor {
  private state: Project;
  private past: Patch[][] = [];
  private future: Patch[][] = [];
  private ledger = new Map<string, { key: string; result: any }>();
  private listeners = new Set<() => void>();
  historyTruncated = false;
  constructor(p = createProject()) {
    validate("project", p);
    validateDocument(p);
    this.state = structuredClone(p);
  }
  get project() {
    return structuredClone(this.state);
  }
  subscribe(fn: () => void) {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }
  private emit() {
    for (const fn of this.listeners) fn();
  }
  replace(p: Project) {
    validate("project", p);
    validateDocument(p);
    const revision = Math.max(this.state.revision, p.revision) + 1;
    ensure(
      Number.isSafeInteger(revision),
      "LIMIT_EXCEEDED",
      "Revision counter exhausted",
    );
    this.state = structuredClone(p);
    this.state.revision = revision;
    this.past = [];
    this.future = [];
    this.ledger.clear();
    this.emit();
    return { revision: this.state.revision };
  }
  dispatch(c: Command) {
    return this.transaction({
      commandId: c.commandId,
      expectedRevision: c.expectedRevision,
      commands: [c],
      dryRun: c.dryRun,
    });
  }
  transaction(input: {
    commandId: string;
    expectedRevision: number;
    commands: Command[];
    dryRun?: boolean;
  }) {
    ensure(
      input.commands.length > 0 && input.commands.length <= 1000,
      "LIMIT_EXCEEDED",
      "Invalid transaction size",
    );
    for (const c of input.commands) validate("command", c);
    const key = stable(input);
    const previous = this.ledger.get(input.commandId);
    if (previous) {
      ensure(
        previous.key === key,
        "INVALID_INPUT",
        "Command ID reused with different content",
      );
      return structuredClone(previous.result);
    }
    ensure(
      input.expectedRevision === this.state.revision &&
        input.commands.every(
          (c) => c.expectedRevision === input.expectedRevision,
        ),
      "REVISION_CONFLICT",
      "Document changed; refresh before editing",
    );
    const p = structuredClone(this.state);
    const history = input.commands[0].type;
    let undoPatch: Patch[] | undefined;
    if (history === "history.undo" || history === "history.redo") {
      ensure(
        input.commands.length === 1,
        "INVALID_INPUT",
        "History command must stand alone",
      );
      undoPatch = (history === "history.undo" ? this.past : this.future).at(-1);
      ensure(undoPatch, "INVALID_INPUT", "Nothing to " + history.split(".")[1]);
      applyPatches(p, undoPatch, history === "history.undo");
    } else for (const c of input.commands) mutate(p, c);
    p.diagnostics = p.diagnostics.filter((d) => d.code !== "REFERENCE_MISSING");
    for (const o of occurrences(p))
      if (o.namespace === "missing")
        p.diagnostics.push({
          code: "REFERENCE_MISSING",
          severity: "warning",
          message: "Unresolved reference: " + o.node.ref,
          occurrenceIds: [o.id],
        });
    validate("project", p);
    validateDocument(p);
    const patches = diff(this.state, p);
    ensure(
      Number.isSafeInteger(p.revision + 1),
      "LIMIT_EXCEEDED",
      "Revision counter exhausted",
    );
    p.revision++;
    const result = {
      revision: p.revision,
      affectedIds: occurrences(p).map((o) => o.id),
      idRemappings: {},
      diagnostics: p.diagnostics,
      partCount: occurrences(p).length,
      dryRun: !!input.dryRun,
    };
    if (input.dryRun) return result;
    if (undoPatch) {
      if (history === "history.undo") {
        this.past.pop();
        this.future.push(undoPatch);
      } else {
        this.future.pop();
        this.past.push(undoPatch);
      }
    } else {
      this.past.push(patches);
      this.future = [];
    }
    while (
      this.past.length > 100 ||
      JSON.stringify(this.past).length > 8 * 1024 * 1024
    ) {
      this.past.shift();
      this.historyTruncated = true;
    }
    this.state = p;
    this.ledger.set(input.commandId, { key, result });
    if (this.ledger.size > 500)
      this.ledger.delete(this.ledger.keys().next().value!);
    this.emit();
    return result;
  }
  get canUndo() {
    return this.past.length > 0;
  }
  get canRedo() {
    return this.future.length > 0;
  }
}
