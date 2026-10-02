import { identity, compose, add, mv } from "../core/math";
/** Generated drawing ownership, from explicit authoring metadata, never filenames. */
import { encodePath, occurrences } from "../core/document";
import type { Project, Occurrence, Vec3 } from "../core/types";
export type InstructionComponent = {
  id: string;
  sourceModelId: string;
  name: string;
  colorCode: string;
  kind: "flexible" | "composite" | "drawing";
  evidence: "LDCAD-generated" | "LSynth-run";
  occurrenceIds: string[];
  endpoints?: Vec3[];
};
export function instructionComponents(
  p: Project,
  all: Occurrence[] = occurrences(p),
): InstructionComponent[] {
  const components = new Map<string, InstructionComponent>(),
    owned = new Set<string>();
  const sourceText = new Map<string, string>();
  const textFor = (modelId: string) => {
    let text = sourceText.get(modelId);
    if (text === undefined) {
      text = p.models[modelId].records.map((r) => r.raw).join("\n");
      sourceText.set(modelId, text);
    }
    return text;
  };
  for (const o of all) {
    let model = p.models[p.rootModelId],
      world = identity();
    for (let depth = 0; depth < o.path.length - 1; depth++) {
      const node = model.nodes.find((n) => n.id === o.path[depth]);
      if (!node || node.kind !== "submodel") break;
      world = compose(world, node.transform);
      model = p.models[node.ref];
      const text = textFor(model.id);
      const type = text
        .match(/0\s+!LDCAD\s+CONTENT\s+\[type=(path|spring)\]/i)?.[1]
        .toLowerCase();
      if (!type || !/0\s+!LDCAD\s+GENERATED\b/i.test(text)) continue;
      const id = encodePath(o.path.slice(0, depth + 1));
      const points =
        type === "path"
          ? [
              ...text.matchAll(
                /0\s+!LDCAD\s+PATH_POINT[^\n]*\[posOri=([^\]]+)\]/g,
              ),
            ]
              .map(
                (m) => m[1].trim().split(/\s+/).slice(0, 3).map(Number) as Vec3,
              )
              .filter((v) => v.length === 3 && v.every(Number.isFinite))
          : [];
      const endpoints =
        points.length >= 2
          ? [points[0], points[points.length - 1]].map((point) =>
              add(world.position, mv(world.basis, point)),
            )
          : undefined;
      const c =
        components.get(id) ??
        ({
          id,
          sourceModelId: model.id,
          colorCode: o.colorCode,
          kind: type === "spring" ? "composite" : "flexible",
          name:
            type === "spring"
              ? "Generated spring assembly — verify part breakdown"
              : "Generated flexible element — verify identity and length",
          evidence: "LDCAD-generated",
          occurrenceIds: [],
          ...(endpoints ? { endpoints } : {}),
        } as InstructionComponent);
      c.occurrenceIds.push(o.id);
      components.set(id, c);
      owned.add(o.id);
      break;
    }
  }
  // LSynth end/cross-section files describe a path, not individual LEGO parts.
  // Separate runs at their paired ends; retain incomplete runs as drawing only.
  const runs = new Map<
    string,
    {
      parent: string;
      family: string;
      source: string;
      list: Occurrence[];
      ends: number;
    }
  >();
  const flush = (key: string) => {
    const run = runs.get(key);
    if (!run?.list.length) return;
    const complete = run.ends === 2 && run.list.length > 2;
    const first = run.list[0],
      id = "lsynth:" + first.id;
    components.set(id, {
      id,
      sourceModelId: run.source,
      colorCode: first.colorCode,
      kind: complete ? "flexible" : "drawing",
      name: complete
        ? "Generated flexible element — verify identity and length"
        : "Unresolved flexible drawing — not a parts list",
      evidence: "LSynth-run",
      occurrenceIds: run.list.map((o) => o.id),
      ...(complete
        ? {
            endpoints: [
              first.transform.position,
              run.list[run.list.length - 1].transform.position,
            ],
          }
        : {}),
    });
    runs.delete(key);
  };
  for (const o of all) {
    if (owned.has(o.id) || o.node.kind !== "part") continue;
    const model = p.models[o.node.ref];
    if (!model) continue;
    const text = textFor(model.id);
    const description = text.match(
      /^0\s+~?LSynth\s+(.+?)\s+-\s+(End Piece|Cross Section)\s*$/im,
    );
    if (!description || !/^0\s+!KEYWORDS\b.*\bLSynth\b/im.test(text)) continue;
    const parent = encodePath(o.path.slice(0, -1)),
      family = description[1].toLowerCase();
    const key = JSON.stringify([parent, family, o.colorCode]);
    const run = runs.get(key) ?? {
      parent,
      family,
      source: o.modelId,
      list: [],
      ends: 0,
    };
    run.list.push(o);
    if (/End Piece/i.test(description[2])) run.ends++;
    runs.set(key, run);
    if (run.ends === 2) flush(key);
  }
  for (const key of [...runs.keys()]) flush(key);
  return [...components.values()];
}
