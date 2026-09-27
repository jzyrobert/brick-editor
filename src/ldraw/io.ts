import {
  type Project,
  type Model,
  type Node,
  type Basis,
  type Vec3,
  ensure,
  uid,
} from "../core/types";
import { identity, mv, add } from "../core/math";
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
  const mpd = lines.some((l) => /^0\s+FILE\s+/i.test(l));
  const preamble: string[] = [];
  for (const raw of lines) {
    const file = raw.match(/^0\s+FILE\s+(.+)$/i);
    if (file) {
      start(file[1]);
      continue;
    }
    if (/^0\s+NOFILE\s*$/i.test(raw)) {
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
      /^0\s+!LDRAW_ORG\s+(?:Unofficial_)?(?:Part|Subpart|Primitive)/i.test(raw)
    )
      m.classification = "custom";
    if (/^0\s+!TEXMAP|^0\s+!DATA/i.test(raw))
      p.diagnostics.push({
        code: "UNSUPPORTED_RENDER_FEATURE",
        severity: "warning",
        message:
          "Texture source retained; texture projection is not supported.",
        occurrenceIds: [],
      });
    if (/^0\s+!COLOUR.*\b(?:GLITTER|SPECKLE)\b/i.test(raw))
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
    for (const r of m.records) {
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
  const selected = new Set(ids),
    copy = structuredClone(p);
  const root = {
    id: copy.rootModelId,
    name: "scoped.ldr",
    classification: "model" as const,
    records: [] as Model["records"],
    nodes: [] as Node[],
  };
  const metadata = Object.values(p.models)
    .flatMap((m) => m.records)
    .some(
      (r) =>
        /^0\s+!/.test(r.raw) &&
        !/^0\s+!(?:LDRAW_ORG|LICENSE|HISTORY|COLOUR|CATEGORY|KEYWORDS)\b/.test(
          r.raw,
        ),
    );
  ensure(
    !metadata || acknowledgeMetadataLoss,
    "INVALID_INPUT",
    "Scoped export may invalidate custom metadata; explicit acknowledgement is required",
  );
  for (const o of occurrences(p).filter((o) => selected.has(o.id))) {
    const n = {
      ...structuredClone(o.node),
      id: uid(),
      transform: o.transform,
      colorCode: o.colorCode,
    };
    if (n.kind === "geometry") {
      const source = p.models[o.modelId].records.find(
        (r) => r.id === o.node.sourceRecordId,
      )!;
      const recordId = uid();
      root.records.push({
        id: recordId,
        raw: geometryLine(n, source.raw),
        nodeId: n.id,
      });
      n.sourceRecordId = recordId;
      n.transform = identity();
      n.ref = copy.rootModelId;
    } else delete n.sourceRecordId;
    root.nodes.push(n);
  }
  copy.models[copy.rootModelId] = root;
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
  return (
    tok[0] +
    " " +
    n.colorCode +
    " " +
    points.map((x) => (Object.is(x, -0) ? "0" : String(x))).join(" ")
  );
}
