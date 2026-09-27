#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { zipSync, strToU8 } from "fflate";
import { importLDraw, exportLDraw, scopedLDraw } from "../src/ldraw/io";
import { decodeNative, encodeNative } from "../src/persistence/native";
import {
  InventoryService,
  type InventoryRequest,
} from "../src/inventory/service";
import { Editor } from "../src/core/commands";
import { occurrences } from "../src/core/document";
import { AppError, ensure, uid, type Scope } from "../src/core/types";
import { libraryLock } from "../src/catalog/catalog";
export async function main(argv: string[]) {
  const [operation, ...args] = argv;
  const flag = (key: string) => {
    const i = args.indexOf("--" + key);
    return i < 0 ? undefined : args[i + 1];
  };
  const flags = (key: string) =>
    args.flatMap((a, i) => (a === "--" + key ? [args[i + 1]] : []));
  const output = flag("output"),
    input = flag("input"),
    reportPath =
      flag("report") ||
      (output ? output + ".report.json" : "inventory-report.json");
  if (!operation || operation === "help") {
    console.log(
      "brick-cli validate|apply|export|inventory|instructions|render --input file [--output file] [--report file]\nInventory: --format bricklink-wanted-xml --scope all|visible|selection --selection JSON --layer ID --per-layer --condition any|new|used --multiplier N --accept-unknown-colors --allow-partial\nApply: --commands commands.json\nExport: --format native|ldraw\nRender: --camera camera.json --width 1600 --height 1200 --output image.png",
    );
    return;
  }
  ensure(input, "INVALID_INPUT", "--input is required");
  const bytes = new Uint8Array(await readFile(input));
  const p = input.endsWith(".brickproj")
    ? await decodeNative(bytes)
    : importLDraw(new TextDecoder().decode(bytes), input.split("/").at(-1));
  if (operation === "validate") {
    console.log(
      JSON.stringify(
        {
          valid: true,
          revision: p.revision,
          occurrences: occurrences(p).length,
          diagnostics: p.diagnostics,
          library: p.library,
        },
        null,
        2,
      ),
    );
    return;
  }
  if (operation === "inventory") {
    ensure(
      !flag("format") || flag("format") === "bricklink-wanted-xml",
      "INVALID_INPUT",
      "Unsupported inventory format",
    );
    ensure(output, "INVALID_INPUT", "--output is required");
    const service = new InventoryService(),
      layers = flags("layer");
    ensure(
      !flag("scope") ||
        ["all", "visible", "selection"].includes(flag("scope")!),
      "INVALID_INPUT",
      "Unsupported inventory scope",
    );
    const scope: Scope = layers.length
      ? { kind: "layers", layerIds: layers }
      : flag("scope") === "visible"
        ? { kind: "visible" }
        : flag("scope") === "selection"
          ? {
              kind: "selection",
              occurrenceIds: JSON.parse(flag("selection") || "[]"),
            }
          : { kind: "all" };
    const request: InventoryRequest = {
      expectedRevision: p.revision,
      format: "bricklink-wanted-xml",
      scope,
      condition: (flag("condition") || "any") as InventoryRequest["condition"],
      buildMultiplier: Number(flag("multiplier") || 1),
      acceptUnknownColors: args.includes("--accept-unknown-colors"),
    };
    const partial = args.includes("--allow-partial");
    try {
      if (args.includes("--per-layer")) {
        ensure(
          output.endsWith(".zip"),
          "INVALID_INPUT",
          "Per-layer output must end in .zip",
        );
        const files: Record<string, Uint8Array> = {},
          reports: unknown[] = [];
        for (const id of layers.length ? layers : Object.keys(p.layers)) {
          const preview = await service.preview(p, {
            ...request,
            scope: { kind: "layers", layerIds: [id] },
          });
          if (!preview.sourceOccurrenceCount) continue;
          const artifact = await service.export(p, {
            previewId: preview.previewId,
            expectedRevision: p.revision,
            expectedMappingPackSha256: preview.mappingPackSha256,
            errorPolicy: partial ? "export-resolved" : "block",
          });
          files["layer-" + encodeURIComponent(id) + "-" + artifact.name] =
            artifact.bytes;
          reports.push(artifact.manifest);
        }
        files["inventory-report.json"] = strToU8(
          JSON.stringify(reports, null, 2),
        );
        await writeFile(output, zipSync(files));
        await writeFile(reportPath, JSON.stringify(reports, null, 2));
        return;
      }
      const preview = await service.preview(p, request);
      await writeFile(reportPath, JSON.stringify(preview, null, 2));
      const artifact = await service.export(p, {
        previewId: preview.previewId,
        expectedRevision: p.revision,
        expectedMappingPackSha256: preview.mappingPackSha256,
        errorPolicy: partial ? "export-resolved" : "block",
      });
      if (artifact.mimeType === "application/zip")
        ensure(
          output.endsWith(".zip"),
          "INVALID_INPUT",
          "Partial output must use a visibly partial .zip filename",
        );
      if (artifact.mimeType === "application/json") {
        console.log("No emitted lots; report written without an XML file.");
        return;
      }
      await writeFile(reportPath, JSON.stringify(artifact.manifest, null, 2));
      await writeFile(output, artifact.bytes);
      console.log(
        JSON.stringify({
          output,
          report: reportPath,
          complete: artifact.manifest.complete,
        }),
      );
      return;
    } catch (e) {
      if (e instanceof AppError && e.details)
        await writeFile(reportPath, JSON.stringify(e.details, null, 2));
      throw e;
    }
  }
  if (operation === "apply") {
    ensure(
      output && flag("commands"),
      "INVALID_INPUT",
      "--commands and --output are required",
    );
    const commands = JSON.parse(await readFile(flag("commands")!, "utf8")),
      editor = new Editor(p);
    if (Array.isArray(commands)) for (const c of commands) editor.dispatch(c);
    else editor.dispatch(commands);
    await writeFile(output, await encodeNative(editor.project));
    return;
  }
  if (operation === "instructions") {
    ensure(output, "INVALID_INPUT", "--output is required");
    const editor = new Editor(p);
    editor.dispatch({
      schemaVersion: 1,
      commandId: uid(),
      expectedRevision: p.revision,
      type: "instructions.layers",
      payload: { maxPerStep: Number(flag("max-per-step") || 10) },
    });
    await writeFile(
      output,
      JSON.stringify(editor.project.instructionPlans, null, 2),
    );
    return;
  }
  if (operation === "export") {
    ensure(output, "INVALID_INPUT", "--output is required");
    ensure(
      !flag("format") || ["native", "ldraw"].includes(flag("format")!),
      "INVALID_INPUT",
      "Unsupported export format",
    );
    await writeFile(
      output,
      flag("format") === "native" ? await encodeNative(p) : exportLDraw(p),
    );
    return;
  }
  if (operation === "render") {
    ensure(
      output && flag("camera"),
      "INVALID_INPUT",
      "--output and --camera are required",
    );
    const { createServer } = await import("vite"),
      { chromium } = await import("@playwright/test");
    const server = await createServer({
      server: { host: "127.0.0.1", port: 0 },
      logLevel: "error",
    });
    await server.listen();
    let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
    try {
      browser = await chromium.launch({
        headless: true,
        args: [
          "--no-sandbox",
          "--use-angle=swiftshader",
          "--enable-unsafe-swiftshader",
        ],
      });
      const page = await browser.newPage();
      await page.goto(server.resolvedUrls!.local[0] + "?automation=1");
      await page.waitForFunction(
        () => window.brickEditor?.apiVersion === "1.0",
      );
      const result = await page.evaluate(
        async ({ bytes, camera, width, height }) => {
          const a = window.brickEditor!;
          const imported = await a.project.import({ format: "native", bytes });
          await a.ready({ minRevision: imported.revision, strict: true });
          await a.camera.set(camera);
          const image = await a.render.image({
            revision: imported.revision,
            width,
            height,
            format: "png",
            visibility: { mode: "all" },
            background: { type: "solid", color: "#ffffff" },
            quality: "photo",
            strict: true,
          });
          return {
            bytes: Array.from(new Uint8Array(await image.blob.arrayBuffer())),
            manifest: image.manifest,
          };
        },
        {
          bytes: Array.from(await encodeNative(p)),
          camera: JSON.parse(await readFile(flag("camera")!, "utf8")),
          width: Number(flag("width") || 1600),
          height: Number(flag("height") || 1200),
        },
      );
      await writeFile(output, new Uint8Array(result.bytes));
      await writeFile(
        reportPath,
        JSON.stringify(
          {
            ...result.manifest,
            headlessImplementation: "Chromium SwiftShader software WebGL2",
          },
          null,
          2,
        ),
      );
    } finally {
      await browser?.close();
      await server.close();
    }
    return;
  }
  throw new AppError("INVALID_INPUT", "Unknown CLI operation " + operation);
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
)
  main(process.argv.slice(2)).catch((e) => {
    console.error(
      JSON.stringify({
        code: e instanceof AppError ? e.code : "ERROR",
        message: e instanceof Error ? e.message : String(e),
      }),
    );
    process.exitCode = 1;
  });
