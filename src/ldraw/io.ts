import {
  type Project,
  type Model,
  type Node,
  type Basis,
  type Vec3,
  ensure,
} from "../core/types";
import { identity, mv, add, determinant } from "../core/math";
import { createProject, validateDocument, occurrences } from "../core/document";
import { canonical } from "./path";
import { catalog } from "../catalog/catalog";
const num = (s: string) => {
  const n = Number(s);
  ensure(
    s.trim() !== "" && Number.isFinite(n),
    "INVALID_INPUT",
    "Invalid numeric token",
  );
  return n;
};
export function importLDraw(text: string, name = "main.ldr"): Project {
  ensure(
    new TextEncoder().encode(text).length <= 25 * 1024 * 1024,
    "LIMIT_EXCEEDED",
    "Import exceeds 25 MiB",
  );
  ensure(!text.includes("\0"), "INVALID_INPUT", "NUL in source");
  const p = createProject(name.replace(/\.[^.]+$/, ""));
  p.models = {};
  let current: Model | undefined;
  let first: string | undefined;
  let counter = 0;
  const start = (name: string) => {
    const key = canonical(name);
    ensure(
      !p.models[key],
      "INVALID_INPUT",
      "Duplicate canonical filename " + name,
    );
    ensure(
      Object.keys(p.models).length < 10000,
      "LIMIT_EXCEEDED",
      "Too many embedded files",
    );
    current = {
      id: key,
      name,
      nodes: [],
      records: [],
      classification: "model",
    };
    p.models[key] = current;
    first ??= key;
    return current;
  };
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const mpd = lines.some((l) => /^0\s+FILE\s+/i.test(l.trim()));
  const preamble: string[] = [];
  for (const raw of lines) {
    const line = raw.trim();
    const file = line.match(/^0\s+FILE\s+(.+)$/i);
    if (file) {
      start(file[1]);
      continue;
    }
    if (/^0\s+NOFILE\s*$/i.test(line)) {
      current = undefined;
      continue;
    }
    if (!current) {
      if (mpd) {
        preamble.push(raw);
        continue;
      }
      start(name);
    }
    const m = current!;
    const rid = "r" + counter++;
    const record: { id: string; raw: string; nodeId?: string } = {
      id: rid,
      raw,
    };
    m.records.push(record);
    if (
      /^0\s+!LDRAW_ORG\s+(?:Unofficial_)?(?:Part|Subpart|Primitive)/i.test(line)
    )
      m.classification = "custom";
    if (/^0\s+!TEXMAP|^0\s+!DATA/i.test(line))
      p.diagnostics.push({
        code: "UNSUPPORTED_RENDER_FEATURE",
        severity: "warning",
        message:
          "Texture source retained; texture projection is not supported.",
        occurrenceIds: [],
      });
    if (/^0\s+!COLOUR.*\b(?:GLITTER|SPECKLE)\b/i.test(line))
      p.diagnostics.push({
        code: "UNSUPPORTED_RENDER_FEATURE",
        severity: "warning",
        message:
          "Glitter/speckle material semantics are retained but rendering fidelity is unsupported.",
        occurrenceIds: [],
      });
    const tok = raw.trim().split(/\s+/);
    if (!raw.trim() || tok[0] === "0") continue;
    ensure(/^[1-5]$/.test(tok[0]), "INVALID_INPUT", "Invalid LDraw line type");
    let node: Node;
    if (tok[0] === "1") {
      const match = raw
        .trim()
        .match(/^1\s+(\S+)\s+((?:\S+\s+){11}\S+)\s+(.+)$/);
      ensure(match, "INVALID_INPUT", "Malformed reference");
      const values = match[2].split(/\s+/).map(num);
      const ref = canonical(match[3]);
      node = {
        id: "n" + counter,
        kind: "part",
        ref,
        colorCode: match[1],
        transform: {
          position: values.slice(0, 3) as Vec3,
          basis: values.slice(3) as Basis,
        },
        sourceRecordId: rid,
      };
    } else {
      const count = { 2: 8, 3: 11, 4: 14, 5: 14 }[Number(tok[0])];
      ensure(
        tok.length === count,
        "INVALID_INPUT",
        "Malformed geometry record",
      );
      tok.slice(2).forEach(num);
      node = {
        id: "n" + counter,
        kind: "geometry",
        ref: m.id,
        colorCode: tok[1],
        transform: identity(),
        sourceRecordId: rid,
      };
    }
    ensure(
      /^(?:\d+|0x2[\da-f]{6})$/i.test(node.colorCode),
      "INVALID_INPUT",
      "Invalid colour identifier",
    );
    record.nodeId = node.id;
    m.nodes.push(node);
  }
  ensure(first, "INVALID_INPUT", "Empty document");
  p.rootModelId = first;
  p.metadata.preamble = preamble;
  for (const m of Object.values(p.models))
    for (const n of m.nodes) {
      if (n.kind !== "part") continue;
      const parent = m.id.includes("/")
        ? m.id.slice(0, m.id.lastIndexOf("/") + 1)
        : "";
      const local = p.models[canonical(parent + n.ref)]
        ? canonical(parent + n.ref)
        : n.ref;
      if (p.models[local]) {
        n.ref = local;
        n.kind =
          p.models[local].classification === "custom" ? "part" : "submodel";
      } else if (!catalog[n.ref])
        p.diagnostics.push({
          code: "REFERENCE_MISSING",
          severity: "warning",
          message: "Unresolved reference: " + n.ref,
          occurrenceIds: [],
          details: { ref: n.ref },
        });
    }
  // Validate custom-part graphs as well as expanded user models.
  const done = new Set<string>();
  const check = (id: string, stack: Set<string>) => {
    ensure(!stack.has(id), "REFERENCE_CYCLE", "Cyclic embedded definition");
    if (done.has(id)) return;
    ensure(stack.size < 64, "LIMIT_EXCEEDED", "Reference depth exceeds 64");
    const next = new Set(stack).add(id);
    for (const n of p.models[id].nodes)
      if (n.kind !== "geometry" && p.models[n.ref]) check(n.ref, next);
    done.add(id);
  };
  for (const id of Object.keys(p.models)) check(id, new Set());
  validateDocument(p);
  const root = p.models[p.rootModelId];
  if (root.records.some((r) => /^0\s+(?:STEP|ROTSTEP)(?:\s|$)/i.test(r.raw))) {
    const all = occurrences(p);
    const steps: string[][] = [];
    let step: string[] = [];
    for (const r of root.records) {
      if (/^0\s+(?:STEP|ROTSTEP)(?:\s|$)/i.test(r.raw)) {
        if (step.length) steps.push(step);
        step = [];
      } else if (r.nodeId)
        step.push(
          ...all.filter((o) => o.path[0] === r.nodeId).map((o) => o.id),
        );
    }
    if (step.length) steps.push(step);
    p.instructionPlans.imported = {
      name: "Imported steps (rotation metadata retained)",
      steps,
    };
  }
  return p;
}
export function nodeLine(n: Node, p: Project) {
  const ref = p.models[n.ref]?.name || n.ref;
  return `1 ${n.colorCode} ${[...n.transform.position, ...n.transform.basis].map((x) => (Object.is(x, -0) ? "0" : String(x))).join(" ")} ${ref}`;
}
export function exportLDraw(p: Project): string {
  const order = [
    p.rootModelId,
    ...Object.keys(p.models).filter((k) => k !== p.rootModelId),
  ];
  const blocks: string[] = [];
  for (const key of order) {
    const m = p.models[key];
    const nodes = new Map(m.nodes.map((n) => [n.id, n]));
    const emitted = new Set<string>();
    const lines: string[] = [];
    for (let recordIndex = 0; recordIndex < m.records.length; recordIndex++) {
      const r = m.records[recordIndex];
      if (/^0\s+BFC\s+INVERTNEXT\s*$/.test(r.raw.trim())) {
        // INVERTNEXT binds only to its next nonblank source line. A deleted
        // reference must not transfer its inversion to the next surviving one.
        let nextIndex = recordIndex + 1;
        while (nextIndex < m.records.length && !m.records[nextIndex].raw.trim())
          nextIndex++;
        const next = m.records[nextIndex];
        if (
          next?.nodeId &&
          /^1\s/.test(next.raw.trim()) &&
          !nodes.has(next.nodeId)
        )
          continue;
      }
      if (!r.nodeId) {
        lines.push(r.raw);
        continue;
      }
      const n = nodes.get(r.nodeId);
      if (!n) continue;
      emitted.add(n.id);
      if (n.kind === "geometry") {
        lines.push(geometryLine(n, r.raw));
        continue;
      } // Preserve original token formatting when semantics did not change.
      const generated = nodeLine(n, p);
      const original = r.raw.trim().split(/\s+/),
        changed = generated.split(/\s+/);
      const same =
        original.length === changed.length &&
        original.every((v, i) =>
          i >= 2 && i <= 13
            ? Number(v) === Number(changed[i])
            : v.replaceAll("\\", "/").toLowerCase() ===
              changed[i].toLowerCase(),
        );
      lines.push(same ? r.raw : generated);
    }
    for (const n of m.nodes)
      if (!emitted.has(n.id) && n.kind !== "geometry")
        lines.push(nodeLine(n, p));
    blocks.push("0 FILE " + m.name + "\n" + lines.join("\n"));
  }
  const preamble = Array.isArray(p.metadata.preamble)
    ? (p.metadata.preamble as string[]).join("\n")
    : "";
  return (preamble ? preamble + "\n" : "") + blocks.join("\n") + "\n0 NOFILE\n";
}
export function scopedLDraw(
  p: Project,
  ids: string[],
  acknowledgeMetadataLoss = false,
) {
  const copy = structuredClone(p);
  const all = occurrences(p),
    byId = new Map(all.map((o) => [o.id, o]));
  type Branch = Map<string, Branch>;
  const selection: Branch = new Map();
  for (const id of new Set(ids)) {
    const occurrence = byId.get(id);
    ensure(
      occurrence,
      "INVALID_INPUT",
      "Scoped export contains an unknown occurrence",
    );
    let branch = selection;
    for (const nodeId of occurrence.path) {
      if (!branch.has(nodeId)) branch.set(nodeId, new Map());
      branch = branch.get(nodeId)!;
    }
  }
  // Keep the original ancestor structure: flattening loses inherited local
  // colour declarations, BFC culling/inversion, and other source scope.
  let counter = 0,
    prunedCount = 0;
  const pruned: Record<string, Model> = {};
  const prune = (modelId: string, branch: Branch, root = false): string => {
    let key = p.rootModelId;
    if (!root) {
      do {
        key = `__scoped__/model-${counter++}.ldr`;
      } while (copy.models[key] || pruned[key]);
    }
    ensure(
      prunedCount++ < 10000,
      "LIMIT_EXCEEDED",
      "Scoped export exceeds definition budget",
    );
    const model = structuredClone(p.models[modelId]);
    model.id = key;
    if (!root) model.name = key;
    pruned[key] = model;
    model.nodes = model.nodes
      .filter((node) => branch.has(node.id))
      .map((node) => {
        if (node.kind === "submodel")
          node.ref = prune(node.ref, branch.get(node.id)!);
        else if (node.kind === "geometry") node.ref = key;
        return node;
      });
    return key;
  };
  prune(p.rootModelId, selection, true);
  Object.assign(copy.models, pruned);
  // Include only the selected hierarchy and its complete embedded part closure.
  const reachable = new Set<string>();
  const visit = (key: string) => {
    if (reachable.has(key)) return;
    reachable.add(key);
    for (const node of copy.models[key].nodes)
      if (node.kind !== "geometry" && copy.models[node.ref]) visit(node.ref);
  };
  visit(copy.rootModelId);
  copy.models = Object.fromEntries(
    [...reachable].map((key) => [key, copy.models[key]]),
  );
  const metadata = Object.values(copy.models)
    .flatMap((model) => model.records)
    .some(
      (record) =>
        /^0\s+!/.test(record.raw.trim()) &&
        !/^0\s+!(?:LDRAW_ORG|LICENSE|HISTORY|COLOUR|CATEGORY|KEYWORDS)\b/.test(
          record.raw.trim(),
        ),
    );
  ensure(
    !metadata || acknowledgeMetadataLoss,
    "INVALID_INPUT",
    "Scoped export may invalidate custom metadata; explicit acknowledgement is required",
  );
  return exportLDraw(copy);
}

export function geometryLine(n: Node, raw: string) {
  const tok = raw.trim().split(/\s+/);
  if (
    JSON.stringify(n.transform) === JSON.stringify(identity()) &&
    n.colorCode === tok[1]
  )
    return raw;
  const numbers = tok.slice(2).map(Number),
    points: number[] = [];
  for (let i = 0; i < numbers.length; i += 3)
    points.push(
      ...add(
        n.transform.position,
        mv(n.transform.basis, numbers.slice(i, i + 3) as Vec3),
      ),
    );
  // A reflected type-1 instance reverses the renderer's winding convention.
  // Once its transform is baked into polygon coordinates, encode that reversal
  // explicitly so BFC-facing semantics do not change on export/reimport.
  if (
    (tok[0] === "3" || tok[0] === "4") &&
    determinant(n.transform.basis) < 0
  ) {
    const vertices: number[][] = [];
    for (let i = 0; i < points.length; i += 3)
      vertices.push(points.slice(i, i + 3));
    points.splice(
      0,
      points.length,
      ...vertices[0],
      ...vertices.slice(1).reverse().flat(),
    );
  }
  return (
    tok[0] +
    " " +
    n.colorCode +
    " " +
    points.map((x) => (Object.is(x, -0) ? "0" : String(x))).join(" ")
  );
}
