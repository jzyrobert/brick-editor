import { encodePath, occurrences } from "../core/document";
import { compose, identity } from "../core/math";
import {
  ensure,
  type Basis,
  type Model,
  type Occurrence,
  type Project,
  type Transform,
  type Vec3,
} from "../core/types";
import { canonical } from "../ldraw/path";
import {
  assertExpansionResource,
  expansionLimits,
  preflightExpansion,
} from "../core/expansion-policy";

/** Source organization only. A path, cap or submodel is not a weld, a hose
 * connection, a spring constant or a certificate of mechanical support.
 * Public format: https://www.melkert.net/LDCad/tech/meta . No shadow data used. */
export const SOURCE_CONTENT_LIMITS = Object.freeze({
  models: 4096,
  flexiblePlacements: 256,
  points: 8192,
  caps: 1024,
  metadataCharacters: 2 * 1024 * 1024,
});
type Parameters = Readonly<Record<string, string>>;
type Meta = { kind: string; parameters: Parameters; recordId: string };
export type SourceContentPoint = {
  frame: Transform;
  parameters: Parameters;
  recordId: string;
};
export type SourceContentCap = SourceContentPoint & {
  group: "start" | "end";
  reference: string;
  /** Exact source node; absence/ambiguity makes the content unresolved. */
  sourceNodeId?: string;
  occurrenceIds: string[];
};
export type SourceFlexibleContent = {
  id: string;
  path: string[];
  modelId: string;
  kind: "path" | "spring";
  frame: Transform;
  parameters: Parameters;
  points: SourceContentPoint[];
  anchors: SourceContentPoint[];
  skins: Parameters[];
  sections: Parameters[];
  caps: SourceContentCap[];
  /** All original render leaves, including caps. These still cost the normal
   * renderer's part/triangle budgets and retain their source/export identity. */
  occurrenceIds: string[];
  skinOccurrenceIds: string[];
  issues: string[];
};
const sameFrame = (a: Transform, b: Transform) =>
  a.position.every((v, i) => v === b.position[i]) &&
  a.basis.every((v, i) => v === b.basis[i]);
const prefix = (path: string[], parent: string[]) =>
  parent.length <= path.length && parent.every((v, i) => v === path[i]);

function frame(parameters: Parameters): Transform {
  const numbers = parameters.posOri?.trim().split(/\s+/).map(Number);
  ensure(
    numbers?.length === 12 &&
      numbers.every((n) => Number.isFinite(n) && Math.abs(n) <= 1e7),
    "INVALID_INPUT",
    "Flexible source points need a complete finite LDraw frame",
  );
  return {
    position: numbers.slice(0, 3) as Vec3,
    basis: numbers.slice(3) as Basis,
  };
}
function metas(model: Model, consume: (characters: number) => void): Meta[] {
  return model.records.flatMap((record) => {
    const match = /^\s*0\s+!LDCAD\s+(CONTENT|PATH_\w+|SPRING_\w+)\s*(.*)$/.exec(
      record.raw,
    );
    if (!match) return [];
    consume(record.raw.length);
    const parameters: Record<string, string> = Object.create(null);
    const option = /\[([^=\]\s]+)=([^\]]*)\]/g;
    let previous = 0;
    for (const value of match[2].matchAll(option)) {
      ensure(
        !match[2].slice(previous, value.index).trim() &&
          (!Object.hasOwn(parameters, value[1]) ||
            parameters[value[1]] === value[2]),
        "INVALID_INPUT",
        "Flexible source parameters must be complete and unambiguous",
        { modelId: model.id, recordId: record.id },
      );
      parameters[value[1]] = value[2];
      previous = value.index! + value[0].length;
    }
    ensure(
      !match[2].slice(previous).trim(),
      "INVALID_INPUT",
      "Malformed flexible source parameters",
    );
    return [{ kind: match[1], parameters, recordId: record.id }];
  });
}

/** Consolidate authored flexible content without flattening its rendered skin
 * into thousands of supposed independent bricks. Motor/shock caps stay
 * separately addressable. Closed track skins stay addressable too: callers
 * must review actual link hardware, not replace a track with a hose. */
export function sourceMechanicalContent(
  project: Project,
  all = occurrences(project),
) {
  const limits = expansionLimits();
  preflightExpansion(project, limits);
  ensure(
    Object.keys(project.models).length <= SOURCE_CONTENT_LIMITS.models,
    "LIMIT_EXCEEDED",
    "Too many source models for mechanical content review",
  );
  const definitions = new Map<string, Meta[]>();
  let characters = 0;
  for (const model of Object.values(project.models)) {
    const metadata = metas(model, (count) => {
      characters += count;
      ensure(
        characters <= SOURCE_CONTENT_LIMITS.metadataCharacters,
        "LIMIT_EXCEEDED",
        "Flexible source metadata exceeds the review budget",
      );
    });
    definitions.set(model.id, metadata);
  }
  const flexible: SourceFlexibleContent[] = [];
  const contained = new Set<string>();
  let pointCount = 0;
  let capCount = 0;
  let visited = 0;
  const walk = (
    modelId: string,
    path: string[],
    world: Transform,
    ancestors: ReadonlySet<string>,
  ) => {
    assertExpansionResource(
      "referenceDepth",
      path.length + 1,
      limits,
      "traversal",
    );
    ensure(
      !ancestors.has(modelId),
      "REFERENCE_CYCLE",
      "Cyclic flexible source reference",
    );
    const next = new Set(ancestors).add(modelId);
    const model = project.models[modelId];
    const metadata = definitions.get(modelId)!;
    const declarations = metadata.filter((m) => m.kind === "CONTENT");
    const content = declarations.find((m) =>
      ["path", "spring"].includes(m.parameters.type),
    );
    if (content) {
      ensure(
        declarations.length === 1 &&
          flexible.length < SOURCE_CONTENT_LIMITS.flexiblePlacements,
        "LIMIT_EXCEEDED",
        "Flexible source content must have one bounded declaration",
      );
      const kind = content.parameters.type as "path" | "spring";
      const tag = kind === "path" ? "PATH" : "SPRING";
      const leaves = all.filter((o) => prefix(o.path, path));
      const points = metadata
        .filter((m) => m.kind === `${tag}_POINT`)
        .map((m) => ({
          frame: compose(world, frame(m.parameters)),
          parameters: m.parameters,
          recordId: m.recordId,
        }));
      pointCount += points.length;
      ensure(
        pointCount <= SOURCE_CONTENT_LIMITS.points,
        "LIMIT_EXCEEDED",
        "Flexible source point budget exceeded",
      );
      const issues: string[] = [];
      if (points.length < 2)
        issues.push("The source has fewer than two points.");
      if (
        kind === "spring" &&
        (points.length !== 2 ||
          new Set(points.map((p) => p.parameters.group)).size !== 2 ||
          points.some((p) => !["start", "end"].includes(p.parameters.group)))
      )
        issues.push("Spring endpoints need one start and one end.");
      const anchors = metadata
        .filter((m) => m.kind === `${tag}_ANCHOR`)
        .map((m) => ({
          frame: compose(world, frame(m.parameters)),
          parameters: m.parameters,
          recordId: m.recordId,
        }));
      pointCount += anchors.length;
      ensure(
        pointCount <= SOURCE_CONTENT_LIMITS.points,
        "LIMIT_EXCEEDED",
        "Flexible source point/anchor budget exceeded",
      );
      const caps: SourceContentCap[] = metadata
        .filter((m) => m.kind === `${tag}_CAP`)
        .map((m) => {
          const local = frame(m.parameters);
          ensure(
            ["start", "end"].includes(m.parameters.group) && m.parameters.part,
            "INVALID_INPUT",
            "Flexible source caps need a start/end group and reference",
          );
          const reference = canonical(m.parameters.part);
          const matches = model.nodes.filter(
            (n) =>
              canonical(n.ref) === reference && sameFrame(n.transform, local),
          );
          if (matches.length !== 1)
            issues.push(`Cap ${m.recordId} has no unique exact fallback node.`);
          const sourceNodeId = matches.length === 1 ? matches[0].id : undefined;
          return {
            frame: compose(world, local),
            parameters: m.parameters,
            recordId: m.recordId,
            reference,
            group: m.parameters.group as "start" | "end",
            sourceNodeId,
            occurrenceIds: sourceNodeId
              ? leaves
                  .filter((o) => prefix(o.path, [...path, sourceNodeId]))
                  .map((o) => o.id)
              : [],
          };
        });
      capCount += caps.length;
      ensure(
        capCount <= SOURCE_CONTENT_LIMITS.caps,
        "LIMIT_EXCEEDED",
        "Flexible source cap budget exceeded",
      );
      const capIds = new Set(caps.flatMap((c) => c.occurrenceIds));
      if (capIds.size !== caps.reduce((n, c) => n + c.occurrenceIds.length, 0))
        issues.push("Different caps resolve to the same fallback occurrence.");
      for (const leaf of leaves) contained.add(leaf.id);
      flexible.push({
        id: encodePath(path),
        path,
        modelId,
        kind,
        frame: world,
        parameters: content.parameters,
        points,
        anchors,
        caps,
        skins: metadata
          .filter((m) => m.kind === "PATH_SKIN")
          .map((m) => m.parameters),
        sections: metadata
          .filter((m) => m.kind === "SPRING_SECTION")
          .map((m) => m.parameters),
        occurrenceIds: leaves.map((o) => o.id),
        skinOccurrenceIds: leaves
          .filter((o) => !capIds.has(o.id))
          .map((o) => o.id),
        issues,
      });
      return;
    }
    for (const node of model.nodes) {
      assertExpansionResource("visitedNodes", ++visited, limits, "traversal");
      if (node.kind === "submodel")
        walk(
          node.ref,
          [...path, node.id],
          compose(world, node.transform),
          next,
        );
    }
  };
  // occurrences() performs the source cycle/depth/resource preflight. A supplied
  // occurrence view is an internal optimization, never an imported bypass flag.
  walk(project.rootModelId, [], identity(), new Set());
  return {
    hardware: all.filter((o) => !contained.has(o.id)),
    flexible,
    renderedOccurrences: all.length,
    flexibleRenderOccurrences: contained.size,
  };
}
