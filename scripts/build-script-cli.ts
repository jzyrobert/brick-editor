// `brick-cli build` and `brick-cli parts search`: the agent-facing build
// script compiler and part search, headless (docs/AGENT-BUILDING.md).
import { existsSync, readFileSync } from "node:fs";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  compileBuildScript,
  outsideBudget,
  type CompileReport,
} from "../src/build-script/compile";
import { targetText } from "../src/build-script/budget";
import { buildScriptJsonSchema, opReference } from "../src/build-script/spec";
import { promptPartList } from "../src/build-script/part-list";
import {
  parseSize,
  registerSearchThumbnails,
  searchParts,
} from "../src/build-script/part-search";
import {
  BUILD_VIEWS,
  isBuildView,
  viewCamera,
} from "../src/build-script/views";
import {
  colorAvailabilityLoaded,
  registerColorAvailability,
  type ColorAvailabilityPack,
} from "../src/catalog/color-availability";
import { fullCatalog, registerFullCatalog } from "../src/catalog/full-library";
import type {
  FullPackCatalogEntry,
  FullPackManifest,
} from "../src/catalog/full-pack";
import {
  thumbnailPackId,
  type PartThumbnailIndex,
} from "../src/catalog/part-thumbnails";
import { encodeNative } from "../src/persistence/native";
import { isLookName } from "../src/render/look";
import { BACKDROP_NAMES, isBackdropName } from "../src/core/scene";
import {
  isResourceProfile,
  resourceLimits,
} from "../src/core/resource-profile";
import { AppError, ensure } from "../src/core/types";
import { fullLibraryDir, fullLibraryOccupancy } from "./full-library-node";
import { curatedHas } from "../src/catalog/full-library";
import { occurrences } from "../src/core/document";
import { withHeadlessPage } from "./headless";

const root = fileURLToPath(new URL("../", import.meta.url));

/** Registers the part names, colour availability and thumbnails from disk
 * (the complete library itself is registered by the CLI entry point). */
export function registerAgentData() {
  if (!colorAvailabilityLoaded())
    registerColorAvailability(
      JSON.parse(
        readFileSync(root + "src/catalog/color-availability.json", "utf8"),
      ) as ColorAvailabilityPack,
    );
  const dir = fullLibraryDir();
  if (!fullCatalog() && existsSync(dir + "manifest.json")) {
    const manifest = JSON.parse(
      readFileSync(dir + "manifest.json", "utf8"),
    ) as FullPackManifest;
    registerFullCatalog(
      JSON.parse(
        readFileSync(dir + manifest.catalog.path, "utf8"),
      ) as FullPackCatalogEntry[],
    );
  }
  const thumbs = `${root}public/thumbnails/${thumbnailPackId}/index.json`;
  if (existsSync(thumbs))
    registerSearchThumbnails(
      JSON.parse(readFileSync(thumbs, "utf8")) as PartThumbnailIndex,
    );
}

type Args = {
  flag: (key: string) => string | undefined;
  has: (key: string) => boolean;
  positional: string[];
};
function parse(args: string[], allowed: string[], switches: string[]): Args {
  const values = new Map<string, string>();
  const on = new Set<string>();
  const positional: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (!a.startsWith("--")) {
      positional.push(a);
      continue;
    }
    const key = a.slice(2);
    ensure(
      allowed.includes(key) || switches.includes(key),
      "INVALID_INPUT",
      `Unknown flag ${a} (allowed: ${[...allowed, ...switches].map((k) => "--" + k).join(" ")})`,
    );
    ensure(
      !values.has(key) && !on.has(key),
      "INVALID_INPUT",
      "Duplicate flag " + a,
    );
    if (switches.includes(key)) on.add(key);
    else {
      ensure(
        args[i + 1] !== undefined && !args[i + 1].startsWith("--"),
        "INVALID_INPUT",
        "Missing value for " + a,
      );
      values.set(key, args[++i]);
    }
  }
  return { flag: (k) => values.get(k), has: (k) => on.has(k), positional };
}

const HELP_BUILD = `brick-cli build --script build.json [--output build.mpd|build.brickproj] [--report report.json]
    [--render view.png [--views iso,front,back,left,right,top,iso-back] [--width 1280 --height 960]
     [--look standard|realistic|photo] [--backdrop ${BACKDROP_NAMES.join("|")}]]
    [--no-check] [--resource-profile desktop|mobile] [--target-parts N]
  --target-parts N  part target, as guidance: the summary and the report's \`target\` say
                    how far the build landed from it, with the largest sections and the
                    costliest ops (a build of any size is still written)
brick-cli build --reference   op reference (units, fields, one example each)
brick-cli build --schema      JSON Schema of build scripts`;

/** Compact human summary of a report. */
export function summary(r: CompileReport) {
  const lines = [
    `${r.title}: ${r.stats.parts} parts (${r.stats.designs} designs, ${r.stats.lots} lots) from a ${(r.stats.scriptBytes / 1024).toFixed(1)} KB script; ${r.stats.partsPerScriptKB} parts/KB; compile ${r.stats.compileMs} ms, check ${r.stats.checkMs} ms`,
  ];
  if (r.target)
    lines.push(
      `size: ${targetText(r.stats.parts, r.target.target)}; sections: ${[
        ...r.sections,
      ]
        .sort((a, b) => b.parts - a.parts)
        .map((s) => `${s.name} ${s.parts.toLocaleString("en-US")}`)
        .join(", ")}; costliest ops: ${r.costliestOps
        .slice(0, 5)
        .map((o) => `${o.op} ${o.parts.toLocaleString("en-US")}`)
        .join(", ")}`,
    );
  if (r.bounds)
    lines.push(
      `bounds (studs, y in plates): ${JSON.stringify(r.bounds.studs.min)} .. ${JSON.stringify(r.bounds.studs.max)}`,
    );
  if (r.check)
    lines.push(
      `check: ${r.check.overlaps} overlaps, ${r.check.offGrid} off grid, ${r.check.groups} connected group(s); ${r.check.health}`,
    );
  for (const p of r.problems.slice(0, 20))
    lines.push(
      `${p.severity}: ${p.code}: ${p.message}${p.ops?.length ? " [" + p.ops.join(", ") + "]" : ""}`,
    );
  if (r.problems.length > 20)
    lines.push(`… ${r.problems.length - 20} more problems in the report`);
  lines.push(r.ok ? "OK" : "FAILED (errors above)");
  return lines.join("\n");
}

export async function buildCommand(argv: string[]) {
  const a = parse(
    argv,
    [
      "script",
      "output",
      "report",
      "render",
      "views",
      "width",
      "height",
      "look",
      "backdrop",
      "resource-profile",
      "target-parts",
    ],
    ["reference", "schema", "no-check", "json", "help"],
  );
  if (
    a.has("help") ||
    (!a.flag("script") && !a.has("reference") && !a.has("schema"))
  ) {
    console.log(HELP_BUILD);
    return;
  }
  if (a.has("reference")) {
    console.log(opReference());
    return;
  }
  if (a.has("schema")) {
    console.log(JSON.stringify(buildScriptJsonSchema(), null, 2));
    return;
  }
  const scriptPath = a.flag("script")!;
  const profile = a.flag("resource-profile") ?? "desktop";
  ensure(
    isResourceProfile(profile),
    "INVALID_INPUT",
    "--resource-profile must be desktop or mobile",
  );
  ensure(
    (await stat(scriptPath)).size <= resourceLimits(profile).importBytes,
    "LIMIT_EXCEEDED",
    "Build script exceeds the import budget",
  );
  let script: unknown;
  try {
    script = JSON.parse(await readFile(scriptPath, "utf8"));
  } catch (e) {
    throw new AppError(
      "INVALID_INPUT",
      `${scriptPath} is not valid JSON: ${(e as Error).message}`,
    );
  }
  const num = (flag: string) =>
    a.flag(flag) === undefined ? undefined : Number(a.flag(flag));
  const targetParts = num("target-parts");
  ensure(
    targetParts === undefined ||
      (Number.isInteger(targetParts) && targetParts > 0),
    "INVALID_INPUT",
    "--target-parts must be a positive integer",
  );
  registerAgentData();
  const started = performance.now();
  const result = compileBuildScript(script, {
    profile,
    check: !a.has("no-check"),
    targetParts,
    occupancyFor: (refs) =>
      fullLibraryOccupancy(refs.filter((r) => !curatedHas(r))),
  });
  const { report, project } = result;
  const output = a.flag("output");
  // Over the script's own limits.maxParts: no model and no views, and no
  // older model left behind to be mistaken for this one.
  const refused = outsideBudget(report);
  if (output && refused) await rm(output, { force: true });
  else if (output) {
    await mkdir(dirname(resolve(output)), { recursive: true });
    await writeFile(
      output,
      output.endsWith(".brickproj")
        ? await encodeNative(project!)
        : result.ldraw,
    );
  }
  const reportPath =
    a.flag("report") ?? (output ? output + ".report.json" : undefined);
  const render = a.flag("render");
  const images: string[] = [];
  if (render && !refused && project && occurrences(project).length) {
    const views = (a.flag("views") ?? "iso").split(",").map((v) => v.trim());
    for (const v of views)
      ensure(
        isBuildView(v),
        "INVALID_INPUT",
        `Unknown view ${v} (views: ${BUILD_VIEWS.join(", ")})`,
      );
    const width = Number(a.flag("width") ?? 1280),
      height = Number(a.flag("height") ?? 960);
    ensure(
      Number.isInteger(width) &&
        Number.isInteger(height) &&
        width > 0 &&
        height > 0 &&
        width * height <= resourceLimits(profile).imagePixels,
      "INVALID_INPUT",
      "--width/--height must be positive integers within the capture budget",
    );
    const look = a.flag("look") ?? "standard";
    ensure(
      isLookName(look),
      "INVALID_INPUT",
      "--look must be standard, realistic or photo",
    );
    const backdrop = a.flag("backdrop");
    ensure(
      backdrop === undefined || isBackdropName(backdrop),
      "INVALID_INPUT",
      "--backdrop must be " + BACKDROP_NAMES.join(", "),
    );
    const cameras = views.map((v) => ({
      view: v,
      camera: viewCamera(report.bounds!.ldu, v as never, width / height),
    }));
    const shots = await withHeadlessPage(project, (page) =>
      page.evaluate(
        async ({ cameras, width, height, look, backdrop }) => {
          const api = window.brickEditor!;
          const out: { view: string; bytes: number[] }[] = [];
          for (const { view, camera } of cameras) {
            await api.camera.set(camera);
            const q = await api.query();
            const image = await api.render.image({
              revision: q.revision,
              width,
              height,
              format: "png",
              visibility: { mode: "all" },
              background: { type: "solid", color: "#ffffff" },
              quality: "photo",
              look: look as never,
              ...(backdrop ? { backdrop: backdrop as never } : {}),
              strict: true,
            });
            out.push({
              view,
              bytes: Array.from(new Uint8Array(await image.blob.arrayBuffer())),
            });
          }
          return out;
        },
        { cameras, width, height, look, backdrop },
      ),
    );
    for (const shot of shots) {
      const file =
        shots.length === 1
          ? render
          : render.replace(/(\.png)?$/i, `-${shot.view}.png`);
      await mkdir(dirname(resolve(file)), { recursive: true });
      await writeFile(file, new Uint8Array(shot.bytes));
      images.push(file);
    }
  }
  const full = {
    ...report,
    ...(output && !refused ? { output } : {}),
    ...(images.length ? { images } : {}),
    totalMs: Math.round(performance.now() - started),
  };
  if (reportPath)
    await writeFile(reportPath, JSON.stringify(full, null, 2) + "\n");
  if (a.has("json")) console.log(JSON.stringify(full, null, 2));
  else {
    console.log(summary(report));
    if (output) console.log((refused ? "not written: " : "wrote ") + output);
    for (const i of images) console.log("wrote " + i);
    if (reportPath) console.log("report " + reportPath);
  }
  if (!report.ok) process.exitCode = 2;
}

const HELP_PARTS = `brick-cli parts search "<query>" [--category Slopes] [--size 1x4 | 1x4x3 (plates) | 1x4x1b (bricks)]
    [--colour red] [--available] [--connectable] [--curated] [--limit 20] [--json]
brick-cli parts list   the curated parts with their common colours (the prompt's {{PARTS}})`;
export async function partsCommand(argv: string[]) {
  const [sub, ...rest] = argv;
  const a = parse(
    rest,
    ["category", "size", "colour", "color", "limit"],
    ["available", "connectable", "curated", "json", "help"],
  );
  if (sub === "list" && !a.has("help")) {
    // The prompt's part list ({{PARTS}} in prompts/build-agent.md).
    registerAgentData();
    console.log(promptPartList());
    return;
  }
  if (sub !== "search" || a.has("help")) {
    console.log(HELP_PARTS);
    return;
  }
  registerAgentData();
  const limit = Number(a.flag("limit") ?? 20);
  ensure(
    Number.isInteger(limit) && limit > 0 && limit <= 200,
    "INVALID_INPUT",
    "--limit must be 1..200",
  );
  const results = searchParts({
    query: a.positional.join(" "),
    category: a.flag("category"),
    ...(a.flag("size") ? { size: parseSize(a.flag("size")!) } : {}),
    ...((a.flag("colour") ?? a.flag("color"))
      ? { colour: (a.flag("colour") ?? a.flag("color"))! }
      : {}),
    availableInColour: a.has("available"),
    connectable: a.has("connectable"),
    scope: a.has("curated") ? "curated" : "all",
    limit,
  });
  if (a.has("json")) {
    console.log(JSON.stringify(results, null, 2));
    return;
  }
  for (const r of results)
    console.log(
      [
        r.id.padEnd(14),
        `${r.size.w}x${r.size.d}x${r.size.h}p`.padEnd(9),
        (r.curated ? "curated" : "library").padEnd(8),
        (r.verified ? "snaps" : r.verified === false ? "-" : "?").padEnd(6),
        String(r.colours).padStart(3) + " col",
        r.inColour ? r.inColour.padEnd(13) : "",
        r.name,
      ].join(" "),
    );
  if (!results.length) console.log("No parts match.");
}
