#!/usr/bin/env node
import {
  assertRequestBudget,
  MAX_REQUEST_BYTES,
} from "../src/core/request-budget";
import { queryProject } from "../src/automation/query";
import { readFile, writeFile, stat } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { zipSync, strToU8 } from "fflate";
import { importLDraw, exportLDraw, scopedLDraw } from "../src/ldraw/io";
import { decodeNative, encodeNative } from "../src/persistence/native";
import {
  isResourceProfile,
  resourceLimits,
} from "../src/core/resource-profile";
import { assessMaterialization } from "../src/core/materialization";
import { compareProjects } from "../src/core/compare";
import { modelHealth } from "../src/core/health";
import { connectorService } from "../src/automation/connectors";
import { floorReport } from "../src/edit/floors";
import {
  InventoryService,
  type InventoryRequest,
} from "../src/inventory/service";
import { Editor } from "../src/core/commands";
import { occurrences } from "../src/core/document";
import { AppError, ensure, uid, type Scope } from "../src/core/types";
import { withHeadlessPage } from "./headless";
import { registerInstructionGeometryFromDisk } from "./instruction-geometry-node";
import { buildCommand, partsCommand } from "./build-script-cli";
import {
  registerFullLibraryFromDisk,
  registerFullCatalogFromDisk,
} from "./full-library-node";
import type { CameraSpec } from "../src/core/types";
import type { PlayCameraMode, PlayLocomotion } from "../src/play/types";
import type { PublishFormat } from "../src/instructions/publish";
import { isLookName } from "../src/render/look";
import { BACKDROP_NAMES, isBackdropName } from "../src/core/scene";
export async function main(argv: string[]) {
  const [operation, ...args] = argv;
  // Official parts outside the curated pack resolve from the built complete
  // pack on disk (verified against its lock); no network is used.
  registerFullLibraryFromDisk();
  if (operation === "instructions") registerFullCatalogFromDisk();
  if (operation === "build") return buildCommand(args);
  if (operation === "parts") return partsCommand(args);
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
      'brick-cli build|parts|validate|health|connectors|floors|compare|query|apply|export|export-profile|inventory|instructions|render|play --input file [--output file] [--report file] [--resource-profile desktop|mobile]\nInventory: --format bricklink-wanted-xml --scope all|visible|selection --selection JSON --layer ID --per-layer --condition any|new|used --multiplier N --accept-unknown-colors --accept-derived-mappings --allow-partial\nQuery: --request query.json [--output query-result.json]\nConnectors: connectors --input file [--connected JSON-array-of-occurrence-IDs] [--output connectors.json] (verified stud connection groups, uncovered parts, connected assembly)\nFloors: floors --input file [--output floors.json] (stored floors, parts per floor, room labels, camera floor views and detected floors)\nCompare: --against after.ldr|after.brickproj [--output report.json]\nApply: --commands commands.json\nExport: --format native|ldraw\nInstructions: --method heuristic|layers --format json|pdf|png-zip|html-zip --plan-id ID --max-per-step N --camera camera.json --width 960 --height 720\nRender collection: render-collection --collection exterior/ --width 1280 --height 960 --output views.zip\nRender: --camera camera.json --width 1600 --height 1200 --look standard|realistic|photo [--samples N] --backdrop blank|grass|street|beach|night|studio --output image.png\nBuild: build --script build.json --output build.mpd [--render view.png --views iso,front] (brick-cli build --help)\nParts: parts search "cheese slope" [--size 1x2] [--colour red --available] [--json]\nPlay: --ticks 120 --move-forward 1 --locomotion walk|fly-noclip --camera-mode first-person|third-person --position JSON --yaw 0 --pitch 0 --width 1280 --height 720 --output play.png --report play.json',
    );
    return;
  }
  const allowed: Record<string, string[]> = {
    validate: [],
    compare: ["against"],
    health: [],
    connectors: ["connected"],
    floors: [],
    query: ["request"],
    apply: ["commands"],
    export: ["format"],
    "export-profile": [
      "profile",
      "scope",
      "selection",
      "layer",
      "submodel",
      "include-official",
      "include-complete",
      "acknowledge-scoped-metadata",
    ],
    inventory: [
      "format",
      "scope",
      "selection",
      "layer",
      "per-layer",
      "condition",
      "multiplier",
      "accept-unknown-colors",
      "accept-derived-mappings",
      "allow-partial",
    ],
    instructions: [
      "method",
      "dim-previous",
      "format",
      "plan-id",
      "max-per-step",
      "camera",
      "width",
      "height",
    ],
    render: ["camera", "width", "height", "look", "samples", "backdrop"],
    "render-collection": [
      "collection",
      "width",
      "height",
      "look",
      "samples",
      "backdrop",
    ],
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
      "look",
      "samples",
      "backdrop",
      "rigs",
      "dynamic-rigs",
      "no-auto-doors",
      "open-doors",
      "joint-targets",
      "motors",
      "vehicle",
      "posed-output",
      "train-throttle",
      "points",
      "no-trains",
      "ride-train",
    ],
  };
  ensure(
    allowed[operation],
    "INVALID_INPUT",
    "Unknown CLI operation " + operation,
  );
  const switches = new Set([
      "dim-previous",
      "per-layer",
      "accept-unknown-colors",
      "accept-derived-mappings",
      "allow-partial",
      "run",
      "jump",
      "no-ground",
      "no-auto-doors",
      "open-doors",
      "no-trains",
      "ride-train",
      "include-official",
      "include-complete",
      "acknowledge-scoped-metadata",
    ]),
    used = new Set<string>();
  for (let i = 0; i < args.length; i++) {
    const key = args[i].slice(2);
    ensure(
      args[i].startsWith("--") &&
        [
          ...allowed[operation],
          "input",
          "output",
          "report",
          "resource-profile",
        ].includes(key),
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
  if (
    output &&
    [
      "play",
      "render",
      "render-collection",
      "instructions",
      "export-profile",
    ].includes(operation)
  ) {
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

  const resourceProfile = flag("resource-profile") ?? "desktop";
  ensure(
    isResourceProfile(resourceProfile),
    "INVALID_INPUT",
    "--resource-profile must be desktop or mobile",
  );
  const resources = resourceLimits(resourceProfile);
  ensure(
    (await stat(input)).size <= resources.importBytes,
    "LIMIT_EXCEEDED",
    `Input exceeds ${resources.importBytes / 1024 / 1024} MiB (${resourceProfile} profile)`,
  );
  const bytes = new Uint8Array(await readFile(input));
  const p = input.endsWith(".brickproj")
    ? await decodeNative(bytes, resources)
    : importLDraw(new TextDecoder().decode(bytes), input.split("/").at(-1), {
        profile: resourceProfile,
      });
  if (operation === "query") {
    const requestPath = flag("request");
    if (output)
      ensure(
        resolve(output) !== resolve(input) &&
          (!requestPath || resolve(output) !== resolve(requestPath)),
        "INVALID_INPUT",
        "Query output must differ from source and request files",
      );
    if (requestPath)
      ensure(
        (await stat(requestPath)).size <= 25 * 1024 * 1024,
        "LIMIT_EXCEEDED",
        "Query request exceeds 25 MiB",
      );
    const request = requestPath
      ? JSON.parse(await readFile(requestPath, "utf8"))
      : {};
    const result = JSON.stringify(queryProject(p, request), null, 2) + "\n";
    if (output) await writeFile(output, result);
    else console.log(result.trimEnd());
    return;
  }
  if (operation === "floors") {
    const report = JSON.stringify(floorReport(p), null, 2);
    if (output) await writeFile(output, report);
    else console.log(report);
    return;
  }
  if (operation === "connectors") {
    const service = connectorService(() => p);
    const connected = flag("connected");
    const report = JSON.stringify(
      {
        coverage: await service.coverage(),
        ...(await service.groups()),
        ...(connected
          ? {
              connected: await service.connected({
                occurrenceIds: JSON.parse(connected),
              }),
            }
          : {}),
      },
      null,
      2,
    );
    if (output) await writeFile(output, report);
    else console.log(report);
    return;
  }
  if (operation === "health") {
    const report = JSON.stringify(modelHealth(p), null, 2);
    if (output) await writeFile(output, report);
    else console.log(report);
    return;
  }
  if (operation === "compare") {
    const against = flag("against");
    ensure(against, "INVALID_INPUT", "--against file is required");
    ensure(
      (await stat(against!)).size <= resources.importBytes,
      "LIMIT_EXCEEDED",
      "Comparison input exceeds the import budget",
    );
    const otherBytes = new Uint8Array(await readFile(against!));
    const after = against!.endsWith(".brickproj")
      ? await decodeNative(otherBytes, resources)
      : importLDraw(
          new TextDecoder().decode(otherBytes),
          against!.split("/").at(-1),
          { profile: resourceProfile },
        );
    const report = JSON.stringify(compareProjects(p, after), null, 2);
    if (output) await writeFile(output, report);
    else console.log(report);
    return;
  }
  if (operation === "validate") {
    console.log(
      JSON.stringify(
        {
          valid: true,
          revision: p.revision,
          occurrences: occurrences(p).length,
          diagnostics: p.diagnostics,
          library: p.library,
          resourceProfile,
          materialization: (({ status, diagnostic }) => ({
            status,
            ...(diagnostic ? { diagnostic } : {}),
          }))(assessMaterialization(p, { profile: resourceProfile })),
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
      acceptDerivedMappings: args.includes("--accept-derived-mappings"),
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
    ensure(
      (await stat(flag("commands")!)).size <= MAX_REQUEST_BYTES,
      "LIMIT_EXCEEDED",
      "Command file exceeds 25 MiB",
    );
    const commands = JSON.parse(await readFile(flag("commands")!, "utf8")),
      editor = new Editor(p, { profile: resourceProfile });
    assertRequestBudget(commands);
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
      !(flag("plan-id") && (flag("max-per-step") || flag("method"))),
      "INVALID_INPUT",
      "Choose an existing plan or generate steps, not both.",
    );
    const method = flag("method") ?? "layers";
    if (method === "heuristic") registerInstructionGeometryFromDisk(p);
    ensure(
      ["heuristic", "layers"].includes(method),
      "INVALID_INPUT",
      "Unknown instruction method",
    );
    const editor = new Editor(p, { profile: resourceProfile });
    if (
      flag("method") ||
      flag("max-per-step") ||
      !Object.keys(p.instructionPlans).length
    )
      editor.dispatch({
        schemaVersion: 1,
        commandId: uid(),
        expectedRevision: p.revision,
        type:
          method === "heuristic"
            ? "instructions.generate"
            : "instructions.layers",
        payload: {
          maxPerStep: numberFlag(
            "max-per-step",
            method === "heuristic" ? 6 : 10,
            1,
            method === "heuristic" ? 20 : 1000,
            true,
          ),
        },
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
        async ({ planId, format, width, height, camera, dimPrevious }) => {
          const a = window.brickEditor!;
          if (camera) await a.camera.set(camera);
          else await a.camera.fit();
          const artifact = await a.instructions.publish({
            planId,
            format,
            width,
            height,
            dimPrevious,
          });
          // Transfer one bounded binary string rather than millions of numeric
          // protocol entries; a full allowed HTML booklet can otherwise exhaust
          // Node's heap even though its ZIP respects publication byte budgets.
          const base64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onerror = () =>
              reject(reader.error ?? new Error("Publication transfer failed"));
            reader.onload = () => {
              const url = reader.result as string;
              resolve(url.slice(url.indexOf(",") + 1));
            };
            reader.readAsDataURL(new Blob([new Uint8Array(artifact.bytes)]));
          });
          return { report: artifact.report, base64 };
        },
        {
          planId,
          format: format as PublishFormat,
          width,
          height,
          camera,
          dimPrevious:
            args.includes("--dim-previous") || method === "heuristic",
        },
      ),
    );
    await writeFile(output, Buffer.from(result.base64, "base64"));
    await writeFile(reportPath, JSON.stringify(result.report, null, 2));
    return;
  }
  if (operation === "export-profile") {
    ensure(output, "INVALID_INPUT", "--output is required");
    const layers = flags("layer"),
      kind = (flag("scope") ?? "all") as Scope["kind"];
    ensure(
      ["all", "visible", "selection", "layers", "submodel"].includes(kind),
      "INVALID_INPUT",
      "Unsupported export scope",
    );
    const scope: Scope = layers.length
      ? { kind: "layers", layerIds: layers }
      : kind === "selection"
        ? { kind, occurrenceIds: JSON.parse(flag("selection") ?? "[]") }
        : kind === "submodel"
          ? { kind, occurrenceId: flag("submodel") ?? "" }
          : kind === "layers"
            ? { kind, layerIds: [] }
            : { kind };
    const { exportProfile } = await import("../src/ldraw/export-profiles");
    const artifact = await exportProfile(
      p,
      {
        profile: (flag("profile") ??
          "standard") as import("../src/ldraw/export-profiles").ExportProfile,
        scope,
        expectedRevision: p.revision,
        includeOfficial: args.includes("--include-official"),
        includeCompleteModel: args.includes("--include-complete"),
        acknowledgeScopedMetadata: args.includes(
          "--acknowledge-scoped-metadata",
        ),
      },
      {
        readAsset: (path) =>
          readFile(new URL("../public/" + path, import.meta.url)),
      },
    );
    await writeFile(output, artifact.bytes);
    await writeFile(reportPath, JSON.stringify(artifact.manifest, null, 2));
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
  const look = flag("look") ?? "standard";
  ensure(
    isLookName(look),
    "INVALID_INPUT",
    "--look must be standard, realistic or photo",
  );
  // Path-traced samples for --look photo (software WebGL costs seconds each).
  const lookControls =
    look === "photo" && flag("samples") !== undefined
      ? { pathSamples: numberFlag("samples", 256, 1, 4096, true) }
      : undefined;
  const backdrop = flag("backdrop");
  ensure(
    backdrop === undefined || isBackdropName(backdrop),
    "INVALID_INPUT",
    "--backdrop must be " + BACKDROP_NAMES.join(", "),
  );
  if (operation === "render-collection") {
    ensure(output, "INVALID_INPUT", "--output collection.zip is required");
    const width = numberFlag("width", 1280, 1, 4096, true),
      height = numberFlag("height", 960, 1, 4096, true);
    ensure(
      width * height <= resources.imagePixels,
      "LIMIT_EXCEEDED",
      `Capture exceeds ${resources.imagePixels / 1e6} megapixels (${resourceProfile} profile)`,
    );
    const prefix = flag("collection");
    const result = await withHeadlessPage(p, (page) =>
      page.evaluate(
        async ({ prefix, width, height, look, lookControls, backdrop }) => {
          const r = await window.brickEditor!.render.collection({
            prefix,
            width,
            height,
            quality: "photo",
            look,
            ...(lookControls ? { lookControls } : {}),
            ...(backdrop ? { backdrop } : {}),
          });
          return {
            manifest: r.manifest,
            images: await Promise.all(
              r.images.map(async (image) => ({
                file: image.file,
                bytes: Array.from(
                  new Uint8Array(await image.blob.arrayBuffer()),
                ),
              })),
            ),
          };
        },
        { prefix, width, height, look, lookControls, backdrop },
      ),
    );
    const files: Record<string, Uint8Array> = {
      "manifest.json": strToU8(JSON.stringify(result.manifest, null, 2)),
    };
    for (const image of result.images)
      files[image.file] = new Uint8Array(image.bytes);
    await writeFile(output!, zipSync(files, { level: 0 }));
    await writeFile(reportPath, JSON.stringify(result.manifest, null, 2));
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
      width * height <= resources.imagePixels,
      "LIMIT_EXCEEDED",
      `Capture exceeds ${resources.imagePixels / 1e6} megapixels (${resourceProfile} profile)`,
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
    const json = (key: string) => {
      const text = flag(key);
      if (text === undefined) return undefined;
      try {
        return JSON.parse(text) as unknown;
      } catch {
        throw new AppError("INVALID_INPUT", `--${key} must be JSON`);
      }
    };
    const idList = (key: string) => {
      const value = flag(key) === "all" ? "all" : json(key);
      ensure(
        value === undefined ||
          value === "all" ||
          (Array.isArray(value) &&
            value.length <= 32 &&
            value.every((v) => typeof v === "string" && v.length > 0)),
        "INVALID_INPUT",
        `--${key} takes "all" or a JSON array of rig IDs`,
      );
      return value as "all" | string[] | undefined;
    };
    const rigs = idList("rigs"),
      dynamicRigs = idList("dynamic-rigs");
    const jointTargets = (json("joint-targets") ?? []) as Array<{
        rigId?: string;
        jointId: string;
        target: number;
        speed: number;
      }>,
      motors = (json("motors") ?? []) as Array<{
        rigId?: string;
        jointId: string;
        enabled: boolean;
      }>,
      vehicle = json("vehicle") as
        | { rigId?: string; throttle: number; steering: number }
        | undefined;
    ensure(
      Array.isArray(jointTargets) &&
        jointTargets.length <= 128 &&
        Array.isArray(motors) &&
        motors.length <= 128 &&
        (vehicle === undefined ||
          (vehicle !== null && typeof vehicle === "object")),
      "INVALID_INPUT",
      "--joint-targets and --motors take JSON arrays; --vehicle takes a JSON object",
    );
    // Trains: one throttle for every train (−1..1), points to set first.
    const trainThrottle =
      flag("train-throttle") === undefined
        ? undefined
        : numberFlag("train-throttle", 0, -1, 1);
    const points = (json("points") ?? []) as Array<{
      occurrenceId: string;
      route?: "straight" | "branch";
    }>;
    ensure(
      Array.isArray(points) && points.length <= 256,
      "INVALID_INPUT",
      "--points takes a JSON array of {occurrenceId, route}",
    );
    const posedOutput = flag("posed-output");
    if (posedOutput)
      ensure(
        operation === "play" &&
          ![input, output, reportPath].some(
            (path) => path && resolve(path) === resolve(posedOutput),
          ),
        "INVALID_INPUT",
        "--posed-output must be a new path for a play run",
      );
    const result = await withHeadlessPage(p, (page) =>
      page.evaluate(
        async ({
          operation,
          camera,
          width,
          height,
          request,
          input,
          ticks,
          look,
          lookControls,
          backdrop,
          rigs,
          dynamicRigs,
          jointTargets,
          motors,
          vehicle,
          openDoors,
          trainThrottle,
          points,
          rideTrain,
          posed,
        }) => {
          const a = window.brickEditor!,
            q = await a.query();
          try {
            let before, after, posedModel;
            if (operation === "play") {
              const authored = (await a.mechanisms.list()).map((rig) => rig.id);
              const rigIds = rigs === "all" ? authored : (rigs ?? []);
              before = await a.play.enter({
                ...request,
                ...(rigIds.length ? { rigIds } : {}),
                ...(dynamicRigs
                  ? {
                      dynamicRigIds:
                        dynamicRigs === "all" ? rigIds : dynamicRigs,
                    }
                  : {}),
              });
              for (const motor of motors) await a.play.setMotor(motor);
              for (const p of points) await a.play.setPoints(p);
              if (trainThrottle !== undefined)
                for (const train of before.trains?.trains ?? [])
                  await a.play.setTrainThrottle({
                    trainId: train.id,
                    throttle: trainThrottle,
                  });
              if (rideTrain && before.trains?.trains.length)
                await a.play.rideTrain({ trainId: before.trains.trains[0].id });
              if (openDoors)
                for (const door of before.autoDoors?.doors ?? [])
                  if (door.swing !== "blocked")
                    await a.play.setJointTarget({
                      rigId: door.rigId,
                      jointId: door.jointId,
                      target: door.swing === "negative" ? -90 : 90,
                      speed: 90,
                    });
              for (const target of jointTargets)
                await a.play.setJointTarget(target);
              if (vehicle)
                await a.play.setMechanismVehicleInput(
                  { throttle: vehicle.throttle, steering: vehicle.steering },
                  vehicle.rigId,
                );
              await a.play.setInput(input);
              after = await a.play.stepTicks(ticks);
              if (posed) posedModel = await a.play.exportPosedModel();
            } else await a.camera.set(camera!);
            const image = await a.render.image({
              revision: q.revision,
              width,
              height,
              format: "png",
              visibility: { mode: "all" },
              background: { type: "solid", color: "#ffffff" },
              quality: "photo",
              look,
              ...(lookControls ? { lookControls } : {}),
              ...(backdrop ? { backdrop } : {}),
              strict: true,
            });
            return {
              bytes: Array.from(new Uint8Array(await image.blob.arrayBuffer())),
              posedModel,
              manifest: {
                ...image.manifest,
                ...(operation === "play"
                  ? {
                      playRun: {
                        initial: before,
                        final: after,
                        input,
                        ticks,
                        ...(jointTargets.length ? { jointTargets } : {}),
                        ...(motors.length ? { motors } : {}),
                        ...(vehicle ? { vehicle } : {}),
                        ...(openDoors ? { openDoors: true } : {}),
                        ...(trainThrottle !== undefined
                          ? { trainThrottle }
                          : {}),
                        ...(points.length ? { points } : {}),
                      },
                    }
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
          look,
          lookControls,
          backdrop,
          request: {
            position,
            locomotion: locomotion as PlayLocomotion,
            cameraMode: cameraMode as PlayCameraMode,
            yaw,
            pitch,
            ground: !args.includes("--no-ground"),
            realtime: false,
            ...(args.includes("--no-auto-doors") ? { autoDoors: false } : {}),
            ...(args.includes("--no-trains") ? { trains: false } : {}),
          },
          rigs,
          dynamicRigs,
          jointTargets,
          motors,
          vehicle,
          openDoors: args.includes("--open-doors"),
          trainThrottle,
          points,
          rideTrain: args.includes("--ride-train"),
          posed: !!posedOutput,
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
    if (posedOutput && result.posedModel)
      await writeFile(posedOutput, result.posedModel.text);
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
