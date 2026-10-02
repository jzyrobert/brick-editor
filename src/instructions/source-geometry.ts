import { curatedGeometrySource } from "../catalog/geometry-sources";
import { fullSource } from "../catalog/full-library";
import { add, compose, identity, mv } from "../core/math";
import type { Bounds } from "../core/spatial";
import type {
  Basis,
  Model,
  Node,
  Project,
  Transform,
  Vec3,
} from "../core/types";
import { canonical } from "../ldraw/path";

/** Display bounds only: no namespace, inventory or physical-connection inference. */
export const INSTRUCTION_SOURCE_GEOMETRY_LIMITS = Object.freeze({
  sourceCharacters: 20_000_000,
  recordCharacters: 16_384,
  records: 2_000_000,
  instances: 100_000,
  triangles: 50_000,
  depth: 32,
  coordinate: 10_000_000,
});
type Limits = {
  -readonly [K in keyof typeof INSTRUCTION_SOURCE_GEOMETRY_LIMITS]: number;
};
export type SourceGeometryOptions = {
  /** Already available, verified sources; this function never fetches anything. */
  readSource?: (ref: string) => string | undefined;
  /** May lower, but never raise, the hard limits. */
  limits?: Partial<Limits>;
};
export type SourceGeometryDiagnostic = {
  code:
    | "missing-source"
    | "unsupported-source"
    | "cycle"
    | "budget"
    | "malformed-source"
    | "ambiguous-source"
    | "empty-geometry";
  ref: string;
  resource?: keyof Limits;
};
export type SourceGeometryResult = {
  bounds: Bounds | null;
  diagnostic: SourceGeometryDiagnostic | null;
  stats: {
    sourceCharacters: number;
    records: number;
    instances: number;
    triangles: number;
    vertices: number;
    maxDepth: number;
  };
};
class UnknownSource extends Error {
  constructor(readonly diagnostic: SourceGeometryDiagnostic) {
    super(diagnostic.code);
  }
}

/**
 * Exact vertex bounds of the complete available source closure, including studs
 * and tubes. Project definitions shadow library definitions at EVERY level.
 * Current nodes supply reference transforms; polygon records supply vertices.
 * Missing, malformed, unsupported or over-budget closures return no partial box.
 * Unlike transformed child boxes, vertices remain exact under nested rotations.
 * The project and its source records are never changed.
 */
export function getLocalInstructionBounds(
  project: Project,
  ref: string,
  options: SourceGeometryOptions = {},
): SourceGeometryResult {
  const stats: SourceGeometryResult["stats"] = {
    sourceCharacters: 0,
    records: 0,
    instances: 0,
    triangles: 0,
    vertices: 0,
    maxDepth: 0,
  };
  let at = ref;
  const fail = (
    code: SourceGeometryDiagnostic["code"],
    resource?: keyof Limits,
  ): never => {
    throw new UnknownSource({
      code,
      ref: at,
      ...(resource ? { resource } : {}),
    });
  };
  try {
    const limits: Limits = { ...INSTRUCTION_SOURCE_GEOMETRY_LIMITS };
    for (const key of Object.keys(limits) as (keyof Limits)[]) {
      const requested = options.limits?.[key];
      if (requested === undefined) continue;
      if (
        !Number.isFinite(requested) ||
        requested < 0 ||
        (key !== "coordinate" && !Number.isInteger(requested))
      )
        fail("budget", key);
      limits[key] = Math.min(limits[key], requested);
    }
    const safeName = (value: string): string => {
      try {
        return canonical(value);
      } catch {
        return fail("malformed-source");
      }
    };
    const models = new Map<string, Model>(),
      ambiguous = new Set<string>();
    const allModels = Object.entries(project.models);
    if (allModels.length > limits.instances) fail("budget", "instances");
    for (const [key, model] of allModels)
      for (const value of [key, model.id, model.name]) {
        const name = safeName(value),
          previous = models.get(name);
        if (previous && previous !== model) ambiguous.add(name);
        models.set(name, model);
      }
    const read =
      options.readSource ??
      ((name: string) => curatedGeometrySource(name) ?? fullSource(name));
    const min: Vec3 = [Infinity, Infinity, Infinity],
      max: Vec3 = [-Infinity, -Infinity, -Infinity];
    const checkNumbers = (values: number[]) => {
      if (values.some((v) => !Number.isFinite(v))) fail("malformed-source");
      if (values.some((v) => Math.abs(v) > limits.coordinate))
        fail("budget", "coordinate");
    };
    const checkTransform = (t: Transform) => {
      if (t.position.length !== 3 || t.basis.length !== 9)
        fail("malformed-source");
      checkNumbers([...t.position, ...t.basis]);
      return t;
    };
    const countInstance = () => {
      if (++stats.instances > limits.instances) fail("budget", "instances");
    };
    const countRecord = (raw: string) => {
      if (raw.length > limits.recordCharacters)
        fail("budget", "recordCharacters");
      stats.sourceCharacters += raw.length + 1;
      if (stats.sourceCharacters > limits.sourceCharacters)
        fail("budget", "sourceCharacters");
      if (++stats.records > limits.records) fail("budget", "records");
    };
    const point = (v: Vec3, transform: Transform) => {
      const world = add(transform.position, mv(transform.basis, v));
      checkNumbers(world);
      stats.vertices++;
      for (let i = 0; i < 3; i++) {
        min[i] = Math.min(min[i], world[i]);
        max[i] = Math.max(max[i], world[i]);
      }
    };
    const active = new Set<string>();
    const resolve = (name: string, parent?: string, currentNode = false) => {
      const direct = safeName(name);
      // Imported/current node references are already namespace-resolved.
      if (currentNode && models.has(direct)) return direct;
      if (parent?.includes("/")) {
        const relative = safeName(
          parent.slice(0, parent.lastIndexOf("/") + 1) + name,
        );
        if (models.has(relative)) return relative;
      }
      return direct;
    };
    const visit = (name: string, transform: Transform, depth: number) => {
      at = name;
      if (depth > limits.depth) fail("budget", "depth");
      stats.maxDepth = Math.max(stats.maxDepth, depth);
      countInstance();
      checkTransform(transform);
      if (ambiguous.has(name)) fail("ambiguous-source");
      const model = models.get(name),
        identityKey = model ? `project:${model.id}` : `library:${name}`;
      if (active.has(identityKey)) fail("cycle");
      active.add(identityKey);
      const line = (raw: string, node?: Node) => {
        at = name;
        countRecord(raw);
        const trimmed = raw.trim();
        if (!trimmed) {
          if (node) fail("malformed-source");
          return;
        }
        if (/^0(?:\s|$)/.test(trimmed)) {
          if (node) fail("malformed-source");
          if (
            /^0\s+(?:!TEXMAP\b|!?LSYNTH\b|!?SYNTH\b|!DATA\b|!:)/i.test(trimmed)
          )
            fail("unsupported-source");
          return;
        }
        const tokens = trimmed.split(/\s+/),
          kind = Number(tokens[0]);
        if (!/^[1-5]$/.test(tokens[0]) || tokens.length < 2)
          fail("malformed-source");
        if (!/^(?:\d+|0x[23][\da-f]{6})$/i.test(tokens[1]))
          fail("malformed-source");
        if (kind === 1) {
          if (tokens.length < 15 || node?.kind === "geometry")
            fail("malformed-source");
          const values = tokens.slice(2, 14).map(Number);
          checkNumbers(values);
          const local = node
            ? checkTransform(node.transform)
            : {
                position: values.slice(0, 3) as Vec3,
                basis: values.slice(3) as Basis,
              };
          const child = resolve(
            node?.ref ?? tokens.slice(14).join(" "),
            model ? name : undefined,
            !!node,
          );
          visit(child, checkTransform(compose(transform, local)), depth + 1);
          return;
        }
        const corners = kind === 2 ? 2 : kind === 3 ? 3 : 4;
        if (
          tokens.length !== 2 + 3 * corners ||
          (node && node.kind !== "geometry")
        )
          fail("malformed-source");
        const values = tokens.slice(2).map(Number);
        checkNumbers(values);
        stats.triangles += kind === 3 ? 1 : kind === 4 ? 2 : 0;
        if (stats.triangles > limits.triangles) fail("budget", "triangles");
        const local = node
          ? checkTransform(compose(transform, checkTransform(node.transform)))
          : transform;
        // Conditional-line control vertices affect visibility, not occupied geometry.
        for (let i = 0; i < (kind === 5 ? 2 : corners); i++)
          point(values.slice(i * 3, i * 3 + 3) as Vec3, local);
      };
      if (model) {
        if (model.nodes.length > limits.instances) fail("budget", "instances");
        const nodes = new Map(model.nodes.map((n) => [n.id, n])),
          emitted = new Set<string>();
        if (nodes.size !== model.nodes.length) fail("malformed-source");
        for (const record of model.records) {
          const node = record.nodeId ? nodes.get(record.nodeId) : undefined;
          if (record.nodeId && !node) continue; // Deleted nodes, as in native export.
          if (node) {
            if (emitted.has(node.id)) fail("malformed-source");
            emitted.add(node.id);
          }
          line(record.raw, node);
        }
        for (const node of model.nodes)
          if (!emitted.has(node.id)) {
            at = name;
            if (node.kind === "geometry") fail("malformed-source");
            countRecord("");
            visit(
              resolve(node.ref, name, true),
              checkTransform(
                compose(transform, checkTransform(node.transform)),
              ),
              depth + 1,
            );
          }
      } else {
        const text = read(name) ?? fail("missing-source");
        if (text.length > limits.sourceCharacters - stats.sourceCharacters)
          fail("budget", "sourceCharacters");
        // Scan lines without allocating an unbounded split array.
        for (let start = 0; start <= text.length; ) {
          const end = text.indexOf("\n", start);
          line(text.slice(start, end < 0 ? text.length : end));
          if (end < 0) break;
          start = end + 1;
        }
      }
      active.delete(identityKey);
    };
    visit(safeName(ref), identity(), 0);
    if (!stats.vertices) fail("empty-geometry");
    return { bounds: { min, max }, diagnostic: null, stats };
  } catch (error) {
    return {
      bounds: null,
      diagnostic:
        error instanceof UnknownSource
          ? error.diagnostic
          : { code: "malformed-source", ref: at },
      stats,
    };
  }
}
