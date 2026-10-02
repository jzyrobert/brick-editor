import {
  insertionCheckReader,
  insertionSummary,
} from "../src/instructions/motion";
import { instructionDisplayStates } from "../src/instructions/programme";
import { registerInstructionGeometryFromDisk } from "./instruction-geometry-node";
/** Reproducible offline evaluation; --fetch opts into polite OMR downloads.
 * --render additionally captures representative cumulative views with software
 * WebGL. All model files and publications stay in the chosen output directory.
 * npm run instructions:evaluate -- --fetch --render --output .local/instructions
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { resolve, join } from "node:path";
import { importLDraw } from "../src/ldraw/io";
import { occurrences } from "../src/core/document";
import { connectionGraph } from "../src/core/connectivity";
import { generateInstructions } from "../src/instructions/generate";
import { prepareInstructionPlan } from "../src/instructions/publish";
import { template } from "../src/catalog/templates";
import { instructionLots } from "../src/instructions/lots";
import { instructionComponents } from "../src/instructions/components";
import {
  illustrationHtml,
  illustrationCss,
} from "../src/instructions/illustrate";
import { SAMPLE_TEMPLATES } from "../src/catalog/template-names";
import {
  SCRIPT_TEMPLATES,
  isScriptTemplate,
} from "../src/catalog/script-templates";
import {
  OMR_UPSTREAM,
  decodeOmrIndex,
  omrFileName,
  omrAttribution,
} from "../src/catalog/omr";
import index from "../src/catalog/omr-index.json";
import {
  registerFullLibraryFromDisk,
  registerFullCatalogFromDisk,
} from "./full-library-node";
import { encodeNative } from "../src/persistence/native";
import { withHeadlessPage } from "./headless";
import type { Project, InstructionPlan } from "../src/core/types";

export const EVALUATION_SETS = [
  "6350-1",
  "6361-1",
  "6450-1",
  "6980-1",
  "8832-1",
  "21034-1",
  "31025-1",
  "31088-1",
];
const hash = (raw: string) => createHash("sha256").update(raw).digest("hex");
const escape = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );

/** Compare only pairs separated by actual source STEP/ROTSTEP boundaries.
 * Nested instances are expanded by path; submodel definitions without STEP
 * contribute no authored ordering claims. Equal generated steps score 0.5.
 */
export function authoredAgreement(p: Project, plan: InstructionPlan) {
  const all = occurrences(p),
    generated = new Map(
      plan.steps.flatMap((s, i) => s.map((id) => [id, i] as const)),
    );
  let pairs = 0,
    agree = 0,
    authoredInstances = 0;
  function walk(modelId: string, prefix: string[]) {
    const model = p.models[modelId],
      stepOf = new Map<string, number>();
    let step = 0,
      boundaries = 0;
    for (const record of model.records) {
      if (/^\s*0\s+(?:ROT)?STEP\b/i.test(record.raw)) {
        step++;
        boundaries++;
      }
      if (record.nodeId) stepOf.set(record.nodeId, step);
    }
    if (boundaries) {
      authoredInstances++;
      const relevant = all.filter((o) =>
        prefix.every((v, i) => o.path[i] === v),
      );
      for (let i = 0; i < relevant.length; i++)
        for (let j = i + 1; j < relevant.length; j++) {
          const a = relevant[i],
            b = relevant[j],
            sa = stepOf.get(a.path[prefix.length]),
            sb = stepOf.get(b.path[prefix.length]);
          if (sa === undefined || sb === undefined || sa === sb) continue;
          pairs++;
          const delta = generated.get(a.id)! - generated.get(b.id)!;
          agree +=
            delta === 0 ? 0.5 : Math.sign(delta) === Math.sign(sa - sb) ? 1 : 0;
        }
    }
    for (const n of model.nodes)
      if (n.kind === "submodel") walk(n.ref, [...prefix, n.id]);
  }
  walk(p.rootModelId, []);
  return {
    authoredInstances,
    comparablePairs: pairs,
    agreement: pairs ? agree / pairs : null,
  };
}
function lowerContactViolations(p: Project, plan: InstructionPlan) {
  const all = occurrences(p),
    byId = new Map(all.map((o) => [o.id, o])),
    stepOf = new Map(
      plan.steps.flatMap((s, i) => s.map((id) => [id, i] as const)),
    );
  let pairs = 0,
    violations = 0;
  for (const [id, edges] of connectionGraph(p, all).edges)
    for (const otherId of edges) {
      const upper = byId.get(id)!,
        lower = byId.get(otherId)!;
      // Independent origin-based diagnostic; rotated/off-centre parts can differ
      // from the generator's body-centre precedence. Do not call this stability.
      if (lower.transform.position[1] <= upper.transform.position[1] + 0.5)
        continue;
      pairs++;
      if (stepOf.get(otherId)! > stepOf.get(id)!) violations++;
    }
  return { pairs, violations };
}
async function main() {
  const args = process.argv.slice(2),
    i = args.indexOf("--output"),
    out = resolve(i >= 0 ? args[i + 1] : ".local/instructions"),
    fetchModels = args.includes("--fetch");
  await mkdir(join(out, "models"), { recursive: true });
  await mkdir(join(out, "plans"), { recursive: true });
  if (!registerFullLibraryFromDisk())
    throw new Error("Complete library pack is required");
  registerFullCatalogFromDisk();
  const inputs: { name: string; p: Project; provenance?: unknown }[] = [];
  for (const name of SAMPLE_TEMPLATES.filter((n) => n !== "blank")) {
    const p = isScriptTemplate(name)
      ? importLDraw(
          await readFile(
            new URL(
              "../fixtures/ldraw/templates/" + SCRIPT_TEMPLATES[name].file,
              import.meta.url,
            ),
            "utf8",
          ),
          name + ".mpd",
          { profile: "desktop" },
        )
      : template(name);
    inputs.push({ name, p });
  }
  const sets = decodeOmrIndex(index as any);
  for (const number of EVALUATION_SETS) {
    const set = sets.find((s) => s.number === number)!,
      file = omrFileName(set),
      path = join(out, "models", file);
    let raw: string;
    try {
      raw = await readFile(path, "utf8");
    } catch {
      if (!fetchModels)
        throw new Error(
          `Cached ${file} missing. Use --fetch once to download OMR files.`,
        );
      const response = await fetch(OMR_UPSTREAM + file, {
        headers: {
          "User-Agent":
            "brick-editor instruction evaluation (+https://bricks.robertj.in; one-off 1 req/2 s)",
        },
      });
      if (!response.ok) throw new Error(file + " HTTP " + response.status);
      raw = await response.text();
      await writeFile(path, raw);
      await new Promise((r) => setTimeout(r, 2000));
    }
    inputs.push({
      name: number,
      p: importLDraw(raw, file, { profile: "desktop" }),
      provenance: {
        ...set,
        url: OMR_UPSTREAM + file,
        sha256: hash(raw),
        attribution: omrAttribution(raw.split(/\r?\n/)),
      },
    });
  }
  const rows: any[] = [],
    successful: typeof inputs = [];
  for (const input of inputs) {
    const { name, p, provenance } = input;
    try {
      const sourceHash = hash(JSON.stringify(p.models));
      registerInstructionGeometryFromDisk(p);
      const start = performance.now(),
        { plan, report } = generateInstructions(p),
        ms = Math.round(performance.now() - start);
      if (sourceHash !== hash(JSON.stringify(p.models)))
        throw new Error("Generator changed model source or poses");
      const all = occurrences(p),
        ids = plan.steps.flat();
      if (
        ids.length !== all.length ||
        new Set(ids).size !== all.length ||
        all.some((o) => !ids.includes(o.id))
      )
        throw new Error("Coverage invariant failed");
      p.instructionPlans.heuristic = plan;
      const byLayer: InstructionPlan = { name: "Layer baseline", steps: [] };
      for (const layer of Object.values(p.layers).sort(
        (a, b) => a.order - b.order,
      )) {
        const ids = all.filter((o) => o.layerId === layer.id).map((o) => o.id);
        for (let n = 0; n < ids.length; n += 6)
          byLayer.steps.push(ids.slice(n, n + 6));
      }
      let publishable = true,
        publicationError: string | undefined;
      try {
        prepareInstructionPlan(p, "heuristic");
      } catch (e) {
        publishable = false;
        publicationError = String(e);
      }
      const agreement = authoredAgreement(p, plan),
        sizes = plan.steps.map((s) => s.length),
        physicalOwners = instructionComponents(p);
      const row = {
        name,
        title: p.title,
        provenance,
        status: "generated",
        occurrences: all.length,
        steps: plan.steps.length,
        meanRenderOccurrencesPerStep: all.length / plan.steps.length,
        meanPlanningUnitsPerStep:
          plan.steps.reduce(
            (n, ids) =>
              n +
              instructionLots(p, ids, {
                physical: true,
                components: physicalOwners,
              }).reduce(
                (sum, lot) => sum + (lot.kind === "drawing" ? 1 : lot.quantity),
                0,
              ),
            0,
          ) / plan.steps.length,
        singletonSteps: sizes.filter((n) => n === 1).length,
        zeroNewPartJoins:
          plan.stepMetadata?.filter((m) => m.assembly?.type === "join")
            .length ?? 0,
        workbenchCandidates: Object.keys(plan.modules ?? {}).length,
        ms,
        coverageComplete: true,
        sourceHash,
        sourcePreserved: true,
        generatedComponents: instructionComponents(p).map((c) => ({
          kind: c.kind,
          evidence: c.evidence,
          renderOccurrences: c.occurrenceIds.length,
        })),
        publishable,
        publicationError,
        report,
        authored: agreement,
        layerBaseline: {
          steps: byLayer.steps.length,
          authored: authoredAgreement(p, byLayer),
          lowerContact: lowerContactViolations(p, byLayer),
        },
        lowerContact: lowerContactViolations(p, plan),
      };
      rows.push(row);
      successful.push(input);
      await writeFile(
        join(out, "plans", name + ".json"),
        JSON.stringify(plan, null, 2),
      );
      console.log(
        `${name}: ${all.length} occurrences, ${plan.steps.length} steps, ${ms} ms${publishable ? "" : " (publication budget exceeded)"}`,
      );
    } catch (e) {
      rows.push({
        name,
        provenance,
        status: "rejected",
        occurrences: occurrences(p).length,
        error: String(e),
      });
      console.log(name, String(e));
    }
  }
  await writeFile(
    join(out, "evaluation.json"),
    JSON.stringify(
      {
        schemaVersion: 1,
        retrieved: new Date().toISOString().slice(0, 10),
        node: process.version,
        platform: process.platform + " " + process.arch,
        method: rows.find((r) => r.report)?.report.algorithm ?? "unknown",
        rows,
      },
      null,
      2,
    ),
  );
  if (args.includes("--render")) {
    await mkdir(join(out, "renders"), { recursive: true });
    await withHeadlessPage(successful[0].p, async (page) => {
      await page.setViewportSize({ width: 640, height: 480 });
      // tsx preserves named callbacks using this helper in serialized functions.
      await page.evaluate("globalThis.__name = (fn) => fn");
      const only = args
        .find((a) => a.startsWith("--only="))
        ?.slice(7)
        .split(",");
      const selected = only
        ? successful
            .filter((i) => only.includes(i.name))
            .sort((a, b) => only.indexOf(a.name) - only.indexOf(b.name))
        : successful;
      for (const { name, p } of selected) {
        try {
          await page.evaluate(
            async (bytes) => {
              const a = window.brickEditor!;
              await a.project.import({ format: "native", bytes });
              await a.ready({ strict: true });
            },
            Array.from(await encodeNative(p)),
          );
          const plan = p.instructionPlans.heuristic,
            displayStates = instructionDisplayStates(plan),
            middle = Math.floor(plan.steps.length / 2),
            late = Math.floor((plan.steps.length * 3) / 4),
            indices = args.includes("--review")
              ? [
                  ...new Set(
                    [
                      0,
                      1,
                      middle,
                      middle + 1,
                      middle + 2,
                      late,
                      late + 1,
                      late + 2,
                      plan.steps.length - 1,
                    ].filter((i) => i < plan.steps.length),
                  ),
                ]
              : [
                  ...new Set(
                    [
                      0,
                      1,
                      2,
                      Math.floor(plan.steps.length / 4),
                      middle,
                      middle + 1,
                      middle + 2,
                      late,
                      late + 1,
                      late + 2,
                      plan.steps.length - 1,
                    ].filter((i) => i < plan.steps.length),
                  ),
                ];
          // Keep the critic's concrete baseline failures comparable when order changes.
          const baselineWindows: Record<string, number[]> = {
            house: [2, 3, 104],
            castle: [55],
            windmill: [29, 87, 88],
            train: [121, 122, 123, 160],
            cafe: [124],
            jeep: [28],
            lighthouse: [64],
            "8832-1": [19, 20, 21, 28, 29, 30],
            "21034-1": [149, 150],
            "31025-1": [154, 155],
            "31088-1": [41, 42, 43, 61, 62, 63],
          };
          if (args.includes("--review")) {
            const baseline = JSON.parse(
              await readFile(
                resolve(".local/instructions/plans", name + ".json"),
                "utf8",
              ),
            ) as InstructionPlan;
            const sourceIds = new Set(
              (baselineWindows[name] ?? []).flatMap(
                (n) => baseline.steps[n - 1] ?? [],
              ),
            );
            for (let n = 0; n < plan.steps.length; n++)
              if (plan.steps[n].some((id) => sourceIds.has(id)))
                indices.push(n);
            const priorWindows: Record<string, number[]> = {
              cafe: [117, 118, 119],
              lighthouse: [105],
            };
            if (priorWindows[name]) {
              const previous = JSON.parse(
                await readFile(
                  resolve(".local/instruction-round2/plans", name + ".json"),
                  "utf8",
                ),
              ) as InstructionPlan;
              const critical = new Set(
                priorWindows[name].flatMap((n) => previous.steps[n - 1] ?? []),
              );
              for (let n = 0; n < plan.steps.length; n++)
                if (plan.steps[n].some((id) => critical.has(id)))
                  indices.push(n);
            }
            // Exact reviewer failures survive reordering; capture receiving state
            // and the following operation, not only the highlighted destination.
            const tracked: Record<string, string[][]> = {
              lighthouse: [["n10", "n220"]],
              house: [
                ["n8", "n150"],
                ["n8", "n151"],
              ],
              cafe: [
                ["n10", "n214"],
                ["n10", "n224"],
                ["n10", "n225"],
                ["n12", "n352"],
              ],
              "31025-1": [
                ["n6", "n304", "n583"],
                ["n6", "n304", "n584"],
                ["n6", "n431"],
                ["n6", "n445"],
                ["n6", "n252"],
                ["n6", "n253"],
                ["n6", "n250"],
                ["n6", "n254"],
                ["n6", "n248"],
                ["n6", "n255"],
                ["n6", "n400"],
                ["n6", "n401"],
              ],
              "21034-1": [
                ["n233"],
                ["n228"],
                ["n20", "n316"],
                ["n20", "n314"],
                ["n20", "n324"],
                ["n20", "n325"],
                ["n20", "n320"],
                ["n20", "n321"],
                ["n217", "n559"],
                ["n217", "n561"],
                ["n217", "n562"],
                ["n217", "n560"],
                ["n217", "n563"],
                ["n297", "n696"],
                ["n297", "n702"],
              ],
              "8832-1": [
                ["n45"],
                ["n47"],
                ["n48"],
                ["n49"],
                ["n50"],
                ["n88"],
                ["n89"],
              ],
            };
            const trackedIds = new Set(
              (tracked[name] ?? []).map((p) => JSON.stringify(p)),
            );
            for (let n = 0; n < plan.steps.length; n++)
              if (plan.steps[n].some((id) => trackedIds.has(id)))
                indices.push(
                  ...[n - 1, n, n + 1].filter(
                    (i) => i >= 0 && i < plan.steps.length,
                  ),
                );
            for (let n = 0; n < plan.steps.length; n++)
              if (plan.stepMetadata?.[n]?.axisReference)
                indices.push(
                  ...[n - 1, n, n + 1].filter(
                    (i) => i >= 0 && i < plan.steps.length,
                  ),
                );
            for (const key of Object.keys(plan.modules ?? {})) {
              const builds = plan.stepMetadata!.flatMap((meta, index) =>
                meta.assembly?.moduleId === key &&
                meta.assembly.type === "build"
                  ? [index]
                  : [],
              );
              const join = plan.stepMetadata!.findIndex(
                (meta) =>
                  meta.assembly?.moduleId === key &&
                  meta.assembly.type === "join",
              );
              indices.push(builds[0], builds[builds.length - 1], join);
            }
            for (const index of [...indices])
              if (plan.stepMetadata?.[index + 1]?.assembly?.type === "join")
                indices.push(index + 1);
            indices.sort((a, b) => a - b);
          }
          const readChecks = insertionCheckReader(p, plan);
          const cumulative: string[] = [];
          const tiles: string[] = [];
          for (let n = 0; n < plan.steps.length; n++) {
            cumulative.push(...plan.steps[n]);
            if (!indices.includes(n)) continue;
            const meta = plan.stepMetadata![n];
            const lots = instructionLots(p, plan.steps[n], {
              named: true,
              physical: [
                "connected-bottom-up-v4",
                "connected-bottom-up-v5",
                "connected-bottom-up-v6",
                "connected-bottom-up-v7",
                "connected-bottom-up-v8",
                "connected-bottom-up-v9",
                "connected-bottom-up-v10",
                "connected-bottom-up-v11",
                "connected-bottom-up-v12",
                "connected-bottom-up-v13",
                "connected-bottom-up-v14",
                "connected-bottom-up-v15",
                "connected-bottom-up-v16",
              ].includes(plan.generation!.algorithm),
            });
            const step = {
              number: n + 1,
              addedIds: plan.steps[n],
              cumulativeIds: [...cumulative],
              partCount: lots.reduce((v, l) => v + l.quantity, 0),
              lots,
              ...meta,
              insertionChecks: readChecks(meta),
              notes: [meta.notes, insertionSummary(readChecks(meta))]
                .filter(Boolean)
                .join(" "),
              ...(plan.modules ? displayStates[n] : {}),
              ...(displayStates[n].incomingIds
                ? { incomingCamera: meta.incomingCamera ?? meta.camera }
                : {}),
            };
            const signature = hash(
              JSON.stringify([
                p.models,
                p.library,
                step,
                "illustration-8-cad-approach",
              ]),
            );
            const signaturePath = join(
              out,
              "renders",
              `${name}-step-${n + 1}.capture.json`,
            );
            const previousSignature = await readFile(
              signaturePath,
              "utf8",
            ).catch(() => "");
            const cachedMain =
              args.includes("--reuse-main") && previousSignature === signature
                ? await readFile(
                    join(out, "renders", `${name}-step-${n + 1}.png`),
                  ).catch(() => undefined)
                : undefined;
            const packed = await page.evaluate(
              async ({ step, cachedMain }) => {
                const a = window.brickEditor!;
                const path = "/src/instructions/illustrate.ts";
                const { captureInstructionIllustration } = await import(path);
                const q = await a.query();
                let first = true;
                const result = await captureInstructionIllustration(
                  q.revision,
                  step,
                  {
                    setCamera: (c: any) => a.camera.set(c),
                    image: (r: any) => {
                      if (first && cachedMain) {
                        first = false;
                        return Promise.resolve({
                          blob: new Blob([new Uint8Array(cachedMain)], {
                            type: "image/png",
                          }),
                        });
                      }
                      first = false;
                      return a.render.image(r);
                    },
                  },
                  {
                    width: 640,
                    height: 480,
                    dimPrevious: true,
                    pictorial: true,
                    mainIsIllustrated: !!cachedMain,
                  },
                );
                return {
                  main: Array.from(result.main),
                  context: result.context
                    ? Array.from(result.context)
                    : undefined,
                  alternate: result.alternate
                    ? Array.from(result.alternate)
                    : undefined,
                  incoming: result.incoming
                    ? Array.from(result.incoming)
                    : undefined,
                  completed: result.completed
                    ? Array.from(result.completed)
                    : undefined,
                  tray: result.tray.map((t: any) => ({
                    lot: t.lot,
                    png: t.png ? Array.from(t.png) : undefined,
                  })),
                };
              },
              {
                step,
                cachedMain: cachedMain ? Array.from(cachedMain) : undefined,
              },
            );
            const illustrated = {
              main: new Uint8Array(packed.main as number[]),
              context: packed.context
                ? new Uint8Array(packed.context as number[])
                : undefined,
              alternate: packed.alternate
                ? new Uint8Array(packed.alternate as number[])
                : undefined,
              incoming: packed.incoming
                ? new Uint8Array(packed.incoming as number[])
                : undefined,
              completed: packed.completed
                ? new Uint8Array(packed.completed as number[])
                : undefined,
              tray: packed.tray.map((t: any) => ({
                lot: t.lot,
                png: t.png ? new Uint8Array(t.png) : undefined,
              })),
            };
            const file = `${name}-step-${n + 1}.png`;
            await writeFile(join(out, "renders", file), illustrated.main);
            await writeFile(signaturePath, signature);
            if (illustrated.context)
              await writeFile(
                join(out, "renders", `${name}-context-${n + 1}.png`),
                illustrated.context,
              );
            for (const kind of ["alternate", "incoming", "completed"] as const)
              if (illustrated[kind])
                await writeFile(
                  join(out, "renders", `${name}-${kind}-${n + 1}.png`),
                  illustrated[kind]!,
                );
            tiles.push(
              `<article><h2>Step ${n + 1} / ${plan.steps.length}</h2>${illustrationHtml(step, illustrated)}<p>${escape(step.notes ?? "")}</p></article>`,
            );
          }
          const html = `<!doctype html><meta charset="utf-8"><style>body{font:16px system-ui;margin:24px;background:#f3f4f5}h1{margin:0 0 12px}main{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}article{background:white;border:1px solid #bbb;padding:12px}img{width:100%}h2{font-size:18px;margin:0}p{font-size:13px;line-height:1.4;margin:8px 0}${illustrationCss}</style><h1>${escape(name + " — " + p.title)}</h1><p>Representative steps; review runs also retain the baseline critic’s affected occurrence IDs. Previous parts opaque pale; close-up and context where needed. ${plan.steps.flat().length} occurrences. Review-only heuristic.</p><main>${tiles.join("")}</main>`;
          await writeFile(join(out, "renders", name + ".html"), html);
          const gallery = await page.context().browser()!.newPage();
          await gallery.setViewportSize({ width: 1500, height: 1000 });
          await gallery.setContent(html);
          await gallery.screenshot({
            path: join(out, "renders", name + ".jpg"),
            fullPage: true,
            type: "jpeg",
            quality: 85,
          });
          // Bound screenshot height: large software-browser full-page captures
          // can repeat strips. These pages retain every selected actual diagram.
          for (let start = 0; start < tiles.length; start += 9) {
            await gallery.setContent(
              html.replace(
                tiles.join(""),
                tiles.slice(start, start + 9).join(""),
              ),
            );
            await gallery.screenshot({
              path: join(
                out,
                "renders",
                `${name}-page-${Math.floor(start / 9) + 1}.jpg`,
              ),
              fullPage: true,
              type: "jpeg",
              quality: 85,
            });
          }
          await gallery.close();
          rows.find((r) => r.name === name).renderedSteps = [
            ...new Set(indices),
          ].length;
          console.log(name, "rendered", tiles.length, "views");
        } catch (e) {
          rows.find((r) => r.name === name).renderError = String(e);
          console.log(name, "render error", String(e));
        }
      }
    });
    await writeFile(
      join(out, "evaluation.json"),
      JSON.stringify(
        {
          schemaVersion: 1,
          retrieved: new Date().toISOString().slice(0, 10),
          node: process.version,
          platform: process.platform + " " + process.arch,
          method: rows.find((r) => r.report)?.report.algorithm ?? "unknown",
          rows,
        },
        null,
        2,
      ),
    );
  }
}
if (import.meta.url === `file://${process.argv[1]}`) await main();
