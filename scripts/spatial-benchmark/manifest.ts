import {
  registerFullLibraryFromDisk,
  registerFullCatalogFromDisk,
} from "../full-library-node";
import { catalog } from "../../src/catalog/catalog";
import {
  REFERENCE_V2,
  REFERENCE_GUIDE,
  V2_GUIDES,
  referenceV2,
  discoveryEntry,
} from "./reference-v2";
import { oneShotPrompt } from "../one-shot-build";
import {
  FACT_VERSION,
  FIELD_GUIDES,
  partReference,
  type FactField,
  json,
  hash,
} from "./part-reference";
export const MANIFEST_VERSION = "spatial-benchmark/1";
export type Policy =
  | "blind-no-feedback"
  | "blind-mechanical"
  | "legacy-control";
export type Budgets = {
  turns: number;
  searchCalls: number;
  infoCalls: number;
  referenceBytes: number;
  checks: number;
  repairs: number;
  compileMs: number;
  totalMs: number;
  compilerBytes: number;
  sourceBytes: number;
  maxOutputTokens: number;
};
export type Task = {
  id: string;
  split: "calibration" | "development" | "held-out";
  brief: string;
  targetParts: number;
  sizePolicy?: "advisory" | "exact";
  palette: string[];
  inventory: Record<string, number> | null;
  aliases: Record<string, string> | null;
};
export type Condition = {
  id: string;
  prompt: "build-agent.md" | "build-agent-diorama.md";
  reply: "brick-build.md" | "brick-build-diorama.md";
  policy: Policy;
  facts: FactField[];
  exposure: "on-demand" | "automatic";
};
export type Manifest = {
  version: typeof MANIFEST_VERSION;
  id: string;
  language: "build-script-v1/brick.build-v1";
  assistance: "macro-assisted-v1";
  factsVersion: typeof FACT_VERSION | typeof REFERENCE_V2;
  model: {
    id: string;
    effort: string;
    sampling: {
      temperature: number | null;
      topP: number | null;
      seed: number | null;
    };
  };
  buildSeed: number;
  orderSeed: number;
  repetitions: number;
  order: "interleaved" | "randomised";
  budgets: Budgets;
  infrastructureRetries: 0;
  evaluator: { version: string; views: string[]; protocol: string };
  tasks: Task[];
  conditions: Condition[];
};
function object(
  v: unknown,
  keys: string[],
  where: string,
  optional: string[] = [],
): asserts v is Record<string, unknown> {
  if (!v || typeof v !== "object" || Array.isArray(v))
    throw new Error(`${where}: expected object`);
  for (const k of Object.keys(v))
    if (!keys.includes(k) && !optional.includes(k))
      throw new Error(`${where}: forbidden/unknown field ${k}`);
  for (const k of keys)
    if (!Object.hasOwn(v, k)) throw new Error(`${where}: missing ${k}`);
}
const string = (v: unknown) => typeof v === "string" && v.trim().length > 0;
const safeId = (v: unknown) =>
  typeof v === "string" && /^[a-z][a-z0-9-]*$/.test(v);
const integer = (v: unknown, min = 0) =>
  Number.isSafeInteger(v) && Number(v) >= min;
const strings = (v: unknown) =>
  Array.isArray(v) && v.every(string) && new Set(v).size === v.length;
const ids = (v: unknown) =>
  strings(v) && (v as string[]).every((s) => /^[a-z0-9_-]+\.dat$/.test(s));
export function validateManifest(input: unknown): Manifest {
  object(
    input,
    [
      "version",
      "id",
      "language",
      "assistance",
      "factsVersion",
      "model",
      "buildSeed",
      "orderSeed",
      "repetitions",
      "order",
      "budgets",
      "infrastructureRetries",
      "evaluator",
      "tasks",
      "conditions",
    ],
    "manifest",
  );
  if (
    input.version !== MANIFEST_VERSION ||
    input.language !== "build-script-v1/brick.build-v1" ||
    input.assistance !== "macro-assisted-v1" ||
    ![FACT_VERSION, REFERENCE_V2].includes(String(input.factsVersion))
  )
    throw new Error("Unsupported contract version");
  if (
    !safeId(input.id) ||
    !integer(input.buildSeed) ||
    !integer(input.orderSeed) ||
    !integer(input.repetitions, 1) ||
    !["interleaved", "randomised"].includes(String(input.order)) ||
    input.infrastructureRetries !== 0
  )
    throw new Error("Invalid schedule/retry contract");
  object(input.model, ["id", "effort", "sampling"], "model");
  object(input.model.sampling, ["temperature", "topP", "seed"], "sampling");
  if (!string(input.model.id) || !string(input.model.effort))
    throw new Error("Model/effort required");
  for (const [k, v] of Object.entries(input.model.sampling))
    if (
      v !== null &&
      (typeof v !== "number" ||
        !Number.isFinite(v) ||
        (k === "seed" && !integer(v)))
    )
      throw new Error("Invalid sampling value");
  const keys = [
    "turns",
    "searchCalls",
    "infoCalls",
    "referenceBytes",
    "checks",
    "repairs",
    "compileMs",
    "totalMs",
    "compilerBytes",
    "sourceBytes",
    "maxOutputTokens",
  ];
  object(input.budgets, keys, "budgets");
  for (const [k, v] of Object.entries(input.budgets))
    if (
      !integer(
        v,
        [
          "turns",
          "referenceBytes",
          "compileMs",
          "totalMs",
          "compilerBytes",
          "sourceBytes",
          "maxOutputTokens",
        ].includes(k)
          ? 1
          : 0,
      )
    )
      throw new Error(`Invalid budget ${k}`);
  if (Number(input.budgets.turns) > 1000 || Number(input.repetitions) > 1000)
    throw new Error("Schedule exceeds preflight cap");
  object(input.evaluator, ["version", "views", "protocol"], "evaluator");
  if (
    !string(input.evaluator.version) ||
    !string(input.evaluator.protocol) ||
    !strings(input.evaluator.views) ||
    (input.evaluator.views as string[]).some(
      (v) => !["iso", "front", "iso-back", "back"].includes(v),
    )
  )
    throw new Error("Invalid evaluator configuration");
  if (
    !Array.isArray(input.tasks) ||
    !input.tasks.length ||
    !Array.isArray(input.conditions) ||
    !input.conditions.length
  )
    throw new Error("Tasks and conditions required");
  for (const t of input.tasks) {
    object(
      t,
      [
        "id",
        "split",
        "brief",
        "targetParts",
        "palette",
        "inventory",
        "aliases",
      ],
      "task",
      ["sizePolicy"],
    );
    if (
      t.sizePolicy !== undefined &&
      !["advisory", "exact"].includes(String(t.sizePolicy))
    )
      throw new Error("Invalid size policy");
    if (
      !safeId(t.id) ||
      !["calibration", "development", "held-out"].includes(String(t.split)) ||
      !string(t.brief) ||
      !integer(t.targetParts, 1) ||
      !ids(t.palette)
    )
      throw new Error("Invalid task");
    if (t.inventory !== null) {
      if (
        !t.inventory ||
        typeof t.inventory !== "object" ||
        Array.isArray(t.inventory)
      )
        throw new Error("Invalid inventory");
      for (const [ref, n] of Object.entries(t.inventory))
        if (!(t.palette as string[]).includes(ref) || !integer(n, 1))
          throw new Error("Inventory outside palette/invalid count");
    }
    if (t.aliases !== null) {
      if (
        !t.aliases ||
        typeof t.aliases !== "object" ||
        Array.isArray(t.aliases)
      )
        throw new Error("Invalid aliases");
      const entries = Object.entries(t.aliases);
      if (
        entries.length !== (t.palette as string[]).length ||
        new Set(entries.map(([, p]) => p)).size !== entries.length ||
        entries.some(
          ([alias, p]) =>
            !/^p\d+$/.test(alias) ||
            !(t.palette as string[]).includes(String(p)),
        )
      )
        throw new Error("Aliases must bijectively cover the palette");
    }
  }
  for (const c of input.conditions) {
    object(
      c,
      ["id", "prompt", "reply", "policy", "facts", "exposure"],
      "condition",
    );
    if (
      !safeId(c.id) ||
      !["build-agent.md", "build-agent-diorama.md"].includes(
        String(c.prompt),
      ) ||
      !["brick-build.md", "brick-build-diorama.md"].includes(String(c.reply)) ||
      !["blind-no-feedback", "blind-mechanical", "legacy-control"].includes(
        String(c.policy),
      ) ||
      !strings(c.facts) ||
      (c.facts as string[]).some((f) => !Object.hasOwn(FIELD_GUIDES, f)) ||
      !["on-demand", "automatic"].includes(String(c.exposure))
    )
      throw new Error("Invalid observation/fact condition");
    if (
      c.policy === "blind-no-feedback" &&
      (input.budgets.checks !== 0 || input.budgets.repairs !== 0)
    )
      throw new Error("blind-no-feedback forbids checks and repairs");
    if (c.policy === "legacy-control" && input.budgets.checks !== 3)
      throw new Error(
        "legacy-control requires the existing three-check feedback",
      );
  }
  if (
    input.conditions.some((c) => c.policy === "legacy-control") &&
    input.tasks.some((t) => t.inventory !== null || t.sizePolicy === "exact")
  )
    throw new Error(
      "legacy-control does not include inventory or exact-count feedback; use a separate mechanical condition",
    );
  for (const list of [input.tasks, input.conditions])
    if (
      new Set(list.map((v: unknown) => (v as { id: string }).id)).size !==
      list.length
    )
      throw new Error("Duplicate IDs");
  return input as unknown as Manifest;
}
export type ScheduledCase = {
  id: string;
  task: Task;
  condition: Condition;
  repetition: number;
};
export function schedule(m: Manifest): ScheduledCase[] {
  const out: ScheduledCase[] = [];
  for (let r = 1; r <= m.repetitions; r++)
    for (const task of m.tasks)
      for (const condition of m.conditions)
        out.push({
          id: `${task.id}--${condition.id}--${r}`,
          task,
          condition,
          repetition: r,
        });
  if (m.order === "randomised") {
    let state = m.orderSeed >>> 0;
    for (let i = out.length - 1; i > 0; i--) {
      state = (Math.imul(1664525, state) + 1013904223) >>> 0;
      const j = Math.floor((state / 2 ** 32) * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
  }
  return out;
}
export function effectivePrompt(m: Manifest, c: ScheduledCase) {
  const corrected = m.factsVersion === REFERENCE_V2;
  if (
    corrected &&
    (!registerFullLibraryFromDisk() || !registerFullCatalogFromDisk())
  )
    throw new Error("Reference v2 requires the pinned full library");
  const reference = corrected ? referenceV2 : partReference;
  let prompt = oneShotPrompt(c.task.brief, c.task.targetParts, {
    promptFile: c.condition.prompt,
    replyPromptFile: c.condition.reply,
    partsList: !c.task.aliases && !corrected,
    search: true,
    check: c.condition.policy !== "blind-no-feedback",
  });
  if (corrected) {
    // Technical corrections only; frozen E/reply files and v1 inputs are untouched.
    prompt = prompt
      .replaceAll('"seed": 1', `"seed": ${m.buildSeed}`)
      .replace(
        "Turns** are clockwise seen from above:",
        "Turns** follow this explicit axis mapping:",
      )
      .replace(
        "**Parts you place are exact**: `place` 1;",
        "**Emitted instances**: `place` 1 except automatic panes/wheel assemblies described in reference v2;",
      );
    prompt += `\nThe build-program seed is ${m.buildSeed}; omit input.seed or use exactly this value.\n`;
    prompt += "\n" + REFERENCE_GUIDE + "\n";
    const palette = c.task.palette.length
      ? c.task.palette
      : Object.keys(catalog);
    prompt +=
      "\nPlacement reference at turn 0:\n" +
      aliasPayload(
        palette.map((ref) => discoveryEntry(ref, !!c.task.aliases)),
        c.task,
      ) +
      "\n";
  }
  if (c.task.sizePolicy === "exact") {
    prompt = prompt.replace(
      "A build of any size compiles. Land within about ±15% of the target (1,700–2,300 for 2,000); within that range, the idea and how good it looks decide everything, so do not trade design for an exact count. Estimate the count as you design.",
      "The compiler accepts different counts, but this task's exact count is a separate validity requirement.",
    );
  }
  if (c.task.sizePolicy === "exact")
    prompt += `\nTask validity requires exactly ${c.task.targetParts} compiler-emitted instances; this is enforced separately from compiler acceptance.\n`;
  if (c.task.aliases)
    prompt += `\nPalette uses temporary IDs: ${Object.keys(c.task.aliases).join(", ")}. Use these IDs in place operations.\n`;
  if (c.task.palette.length)
    prompt += `\nTask palette: ${json(c.task.aliases ? Object.keys(c.task.aliases) : c.task.palette)}. Inventory maxima: ${json(c.task.inventory ? Object.fromEntries(Object.entries(c.task.inventory).map(([ref, n]) => [c.task.aliases ? Object.keys(c.task.aliases).find((a) => c.task.aliases![a] === ref)! : ref, n])) : null)}.\n`;
  for (const field of c.condition.facts)
    prompt += "\n" + (corrected ? V2_GUIDES : FIELD_GUIDES)[field] + "\n";
  if (c.condition.facts.length)
    prompt += `\nInspect selected parts with {"part_info":{"part_ids":["${c.task.aliases ? "p1" : "3039"}"],"fields":${json(c.condition.facts)},"offset":0,"limit":16}}. Returned facts are JSON, in request order. Only declared fields are available.\n`;
  if (c.condition.exposure === "automatic" && c.condition.facts.length) {
    if (!c.task.palette.length)
      throw new Error("Automatic exposure requires an explicit palette");
    for (const ref of c.task.palette) {
      // All connectors returned, by explicit pages rather than silently truncating.
      for (let offset = 0; ; ) {
        const facts = reference(ref, c.condition.facts, offset, 64);
        prompt += "\n" + aliasPayload(facts, c.task) + "\n";
        const next = facts.connectors?.nextOffset;
        if (next === null || next === undefined) break;
        offset = next;
      }
    }
  }
  if (c.condition.policy === "blind-mechanical")
    prompt += `\nMechanical feedback v1 replaces count/error prose: compiler acceptance, bounded syntax and inventory records and conservative collision/connection warnings only. Unknown coverage is retained. No rendering or aesthetic evaluation is available.\n`;
  if (c.task.aliases)
    for (const [alias, ref] of Object.entries(c.task.aliases)) {
      prompt = prompt
        .replaceAll(ref, alias)
        .replace(new RegExp(`\\b${ref.slice(0, -4)}\\b`, "g"), alias);
    }
  return prompt;
}
export function aliasPayload(value: unknown, task: Task) {
  let text = json(value);
  if (task.aliases)
    for (const [alias, ref] of Object.entries(task.aliases))
      text = text.replaceAll(ref, alias);
  return text;
}
export function resolvePart(part: string, task: Task) {
  if (task.aliases) {
    if (!Object.hasOwn(task.aliases, part))
      throw new Error("Unknown temporary part ID");
    return task.aliases[part];
  }
  return part.endsWith(".dat") ? part : part + ".dat";
}
export const payloadIdentity = (text: string) => ({
  bytes: Buffer.byteLength(text),
  characters: text.length,
  sha256: hash(text),
});
