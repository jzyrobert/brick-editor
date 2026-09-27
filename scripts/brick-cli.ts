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
import { withHeadlessPage } from "./headless";
import type { CameraSpec } from "../src/core/types";
import type { PlayCameraMode, PlayLocomotion } from "../src/play/types";
import type { PublishFormat } from "../src/instructions/publish";
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
      "brick-cli validate|apply|export|inventory|instructions|render|play --input file [--output file] [--report file]\nInventory: --format bricklink-wanted-xml --scope all|visible|selection --selection JSON --layer ID --per-layer --condition any|new|used --multiplier N --accept-unknown-colors --allow-partial\nApply: --commands commands.json\nExport: --format native|ldraw\nInstructions: --format json|pdf|png-zip|html-zip --plan-id ID --max-per-step N --camera camera.json --width 960 --height 720\nRender: --camera camera.json --width 1600 --height 1200 --output image.png\nPlay: --ticks 120 --move-forward 1 --locomotion walk|fly-noclip --camera-mode first-person|third-person --position JSON --yaw 0 --pitch 0 --width 1280 --height 720 --output play.png --report play.json",
    );
    return;
  }
  const allowed: Record<string, string[]> = {
    validate: [],
    apply: ["commands"],
    export: ["format"],
    inventory: [
      "format",
      "scope",
      "selection",
      "layer",
      "per-layer",
      "condition",
      "multiplier",
      "accept-unknown-colors",
      "allow-partial",
    ],
    instructions: [
      "format",
      "plan-id",
      "max-per-step",
      "camera",
      "width",
      "height",
    ],
    render: ["camera", "width", "height"],
    play: [
      "ticks",
      "move-forward",
      "move-right",
      "vertical",
      "run",
      "jump",
      "locomotion",
      "camera-mode",
      "position",
      "yaw",
      "pitch",
      "no-ground",
      "width",
      "height",
    ],
  };
  ensure(
    allowed[operation],
    "INVALID_INPUT",
    "Unknown CLI operation " + operation,
  );
  const switches = new Set([
      "per-layer",
      "accept-unknown-colors",
      "allow-partial",
      "run",
      "jump",
      "no-ground",
    ]),
    used = new Set<string>();
  for (let i = 0; i < args.length; i++) {
    const key = args[i].slice(2);
    ensure(
      args[i].startsWith("--") &&
        [...allowed[operation], "input", "output", "report"].includes(key),
      "INVALID_INPUT",
      "Unknown flag or positional argument: " + args[i],
    );
    ensure(
      key === "layer" || !used.has(key),
      "INVALID_INPUT",
      "Duplicate flag --" + key,
    );
    used.add(key);
    if (!switches.has(key)) {
      ensure(
        args[i + 1] !== undefined && !args[i + 1].startsWith("--"),
        "INVALID_INPUT",
        "Missing value for --" + key,
      );
      i++;
    }
  }
  const numberFlag = (
    key: string,
    fallback: number,
    min: number,
    max: number,
    integer = false,
  ) => {
    const n = Number(flag(key) ?? fallback);
    ensure(
      Number.isFinite(n) &&
        n >= min &&
        n <= max &&
        (!integer || Number.isInteger(n)),
      "INVALID_INPUT",
      `--${key} must be ${integer ? "an integer" : "a number"} between ${min} and ${max}`,
    );
    return n;
  };
  ensure(input, "INVALID_INPUT", "--input is required");
  if (output && ["play", "render", "instructions"].includes(operation)) {
    ensure(
      resolve(output) !== resolve(input!),
      "INVALID_INPUT",
      "Output must differ from the source file.",
    );
    ensure(
      resolve(reportPath) !== resolve(input!) &&
        resolve(reportPath) !== resolve(output),
      "INVALID_INPUT",
      "Report must differ from the source and output files.",
    );
  }

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
    const format = flag("format") ?? "json";
    ensure(
      ["json", "pdf", "png-zip", "html-zip"].includes(format),
      "INVALID_INPUT",
      "Unsupported instruction format",
    );
    ensure(
      !(flag("plan-id") && flag("max-per-step")),
      "INVALID_INPUT",
      "Choose an existing plan or generate layer steps, not both.",
    );
    const editor = new Editor(p);
    if (flag("max-per-step") || !Object.keys(p.instructionPlans).length)
      editor.dispatch({
        schemaVersion: 1,
        commandId: uid(),
        expectedRevision: p.revision,
        type: "instructions.layers",
        payload: { maxPerStep: numberFlag("max-per-step", 10, 1, 1000, true) },
      });
    const project = editor.project,
      planId = flag("plan-id") ?? Object.keys(project.instructionPlans).at(-1)!;
    ensure(
      project.instructionPlans[planId],
      "INVALID_INPUT",
      "Instruction plan does not exist",
    );
    if (format === "json") {
      await writeFile(
        output,
        JSON.stringify({ [planId]: project.instructionPlans[planId] }, null, 2),
      );
      return;
    }
    const width = numberFlag("width", 960, 64, 4096, true),
      height = numberFlag("height", 720, 64, 4096, true);
    ensure(
      width * height <= 4000000 &&
        width * height * project.instructionPlans[planId].steps.length <=
          64000000,
      "LIMIT_EXCEEDED",
      "Publication exceeds the 4 megapixel page or 64 megapixel total budget.",
    );
    const camera: CameraSpec | undefined = flag("camera")
      ? JSON.parse(await readFile(flag("camera")!, "utf8"))
      : undefined;
    const result = await withHeadlessPage(project, (page) =>
      page.evaluate(
        async ({ planId, format, width, height, camera }) => {
          const a = window.brickEditor!;
          if (camera) await a.camera.set(camera);
          else await a.camera.fit();
          const artifact = await a.instructions.publish({
            planId,
            format,
            width,
            height,
          });
          return { ...artifact, bytes: Array.from(artifact.bytes) };
        },
        { planId, format: format as PublishFormat, width, height, camera },
      ),
    );
    await writeFile(output, new Uint8Array(result.bytes));
    await writeFile(reportPath, JSON.stringify(result.report, null, 2));
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
  if (operation === "render" || operation === "play") {
    ensure(output, "INVALID_INPUT", "--output is required");
    const width = numberFlag(
        "width",
        operation === "play" ? 1280 : 1600,
        1,
        4096,
        true,
      ),
      height = numberFlag(
        "height",
        operation === "play" ? 720 : 1200,
        1,
        4096,
        true,
      );
    ensure(
      width * height <= 16000000,
      "LIMIT_EXCEEDED",
      "Capture exceeds 16 megapixels",
    );
    if (operation === "render")
      ensure(flag("camera"), "INVALID_INPUT", "--camera is required");
    const camera: CameraSpec | undefined = flag("camera")
      ? JSON.parse(await readFile(flag("camera")!, "utf8"))
      : undefined;
    const ticks = numberFlag("ticks", 120, 0, 3600, true),
      moveZ = numberFlag("move-forward", 0, -1, 1),
      moveX = numberFlag("move-right", 0, -1, 1),
      vertical = numberFlag("vertical", 0, -1, 1),
      yaw = numberFlag("yaw", 0, -1000000, 1000000),
      pitch = numberFlag("pitch", 0, -1.48, 1.48);
    const locomotion = flag("locomotion") ?? "walk",
      cameraMode = flag("camera-mode") ?? "first-person";
    ensure(
      ["walk", "fly-noclip"].includes(locomotion),
      "INVALID_INPUT",
      "Unknown locomotion",
    );
    ensure(
      ["first-person", "third-person"].includes(cameraMode),
      "INVALID_INPUT",
      "Unknown camera mode",
    );
    const position = flag("position")
      ? JSON.parse(flag("position")!)
      : undefined;
    ensure(
      position === undefined ||
        (Array.isArray(position) &&
          position.length === 3 &&
          position.every(
            (n) =>
              typeof n === "number" &&
              Number.isFinite(n) &&
              Math.abs(n) <= 10000000,
          )),
      "INVALID_INPUT",
      "--position requires a JSON array of three finite LDU coordinates",
    );
    const result = await withHeadlessPage(p, (page) =>
      page.evaluate(
        async ({ operation, camera, width, height, request, input, ticks }) => {
          const a = window.brickEditor!,
            q = await a.query();
          try {
            let before, after;
            if (operation === "play") {
              before = await a.play.enter(request);
              await a.play.setInput(input);
              after = await a.play.stepTicks(ticks);
            } else await a.camera.set(camera!);
            const image = await a.render.image({
              revision: q.revision,
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
              manifest: {
                ...image.manifest,
                ...(operation === "play"
                  ? { playRun: { initial: before, final: after, input, ticks } }
                  : {}),
              },
            };
          } finally {
            if (operation === "play") await a.play.exit();
          }
        },
        {
          operation,
          camera,
          width,
          height,
          request: {
            position,
            locomotion: locomotion as PlayLocomotion,
            cameraMode: cameraMode as PlayCameraMode,
            yaw,
            pitch,
            ground: !args.includes("--no-ground"),
            realtime: false,
          },
          input: {
            moveX,
            moveZ,
            vertical,
            yaw,
            pitch,
            run: args.includes("--run"),
            jump: args.includes("--jump"),
          },
          ticks,
        },
      ),
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
