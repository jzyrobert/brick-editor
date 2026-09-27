import type { MechanismBrowser } from "../mechanisms/browser";
import type { QualityName, QualityControls } from "../render/quality";
import type { PublishFormat } from "../instructions/publish";
import type { CopyRequest } from "../core/fragments";
import type { BrowserPlay } from "../play/browser";
import type {
  PlayRequest,
  PlayInput,
  PlayCameraMode,
  PlayLocomotion,
  PlayTeleportRequest,
} from "../play/types";
import { type Editor } from "../core/commands";
import { type CameraSpec, type Command, ensure } from "../core/types";
import { occurrences } from "../core/document";
import { importLDraw, exportLDraw, scopedLDraw } from "../ldraw/io";
import { encodeNative, decodeNative } from "../persistence/native";
import {
  InventoryService,
  type InventoryRequest,
  resolveScope,
} from "../inventory/service";
import type { SceneAdapter, RenderRequest } from "../render/adapter";
import { template } from "../catalog/templates";
import capabilities from "./capabilities.json";
import { JobRegistry, runWorker } from "./jobs";
import type { Project } from "../core/types";
import { validate } from "../core/validate";
export function createAPI(
  editor: Editor,
  render: () => SceneAdapter | undefined,
  play?: () => BrowserPlay | undefined,
  mechanisms?: () => MechanismBrowser | undefined,
) {
  const inventory = new InventoryService(),
    jobs = new JobRegistry();
  const renderer = () => {
    const r = render();
    ensure(r, "WEBGL_UNAVAILABLE", "WebGL2 renderer unavailable");
    return r;
  };
  const player = () => {
    const p = play?.();
    ensure(p, "INVALID_INPUT", "Play controller unavailable");
    return p;
  };
  const mechanism = () => {
    const m = mechanisms?.();
    ensure(m, "INVALID_INPUT", "Mechanism controller unavailable");
    return m;
  };
  return {
    mechanisms: {
      enter: async (rigId: string) => {
        player().exit();
        return mechanism().enter(rigId);
      },
      setJointPosition: async (jointId: string, value: number) =>
        mechanism().setJointPosition(jointId, value),
      setVehicleInput: async (input: { throttle: number; steering: number }) =>
        mechanism().setVehicleInput(input),
      stepTicks: async (count: number) => mechanism().stepTicks(count),
      snapshot: async () => mechanism().snapshot(),
      applyPose: async () => mechanism().applyPose(),
      exit: async () => mechanism().exit(),
    },
    clipboard: {
      copy: async (request: CopyRequest) => editor.copy(request),
      cut: async (
        request: CopyRequest & { expectedRevision: number; commandId: string },
      ) => editor.cut(request),
    },
    instructions: {
      publish: async (request: {
        planId: string;
        format: PublishFormat;
        width?: number;
        height?: number;
      }) => {
        ensure(
          Object.keys(request).every((k) =>
            ["planId", "format", "width", "height"].includes(k),
          ),
          "INVALID_INPUT",
          "Unknown publication option",
        );
        const { publishInstructions } = await import("../instructions/publish");
        return jobs.wait<Awaited<ReturnType<typeof publishInstructions>>>(
          jobs.start("instruction-publication", (signal) =>
            publishInstructions(editor.project, request.planId, renderer(), {
              ...request,
              signal,
            }),
          ),
        );
      },
    },
    play: {
      enter: async (request: PlayRequest = {}) => {
        validate("playRequest", request);
        mechanisms?.()?.exit();
        const report = await player().enter(request);
        validate("playSnapshot", report);
        return report;
      },
      exit: async () => player().exit(),
      setInput: async (input: PlayInput) => {
        validate("playInput", input);
        return player().setInput(input);
      },
      setCameraMode: async (mode: PlayCameraMode) =>
        player().setCameraMode(mode),
      setLocomotion: async (mode: PlayLocomotion) =>
        player().setLocomotion(mode),
      teleport: async (input: PlayTeleportRequest) => {
        validate("playTeleport", input);
        return player().teleport(input);
      },
      stepTicks: async (count: number) => player().stepTicks(count),
      snapshot: async () => player().snapshot(),
      pause: async (paused = true) => player().pause(paused),
    },
    apiVersion: "1.0" as const,
    capabilities: async () => capabilities,
    jobs: {
      list: async () => jobs.list(),
      status: async (id: string) => jobs.status(id),
      cancel: async (id: string) => jobs.cancel(id),
      wait: async (id: string) => jobs.wait(id),
    },
    ready: async (options: { minRevision?: number; strict?: boolean } = {}) =>
      renderer().ready(options.minRevision, options.strict),
    project: {
      import: async (input: {
        format: "ldraw" | "native" | "template";
        text?: string;
        bytes?: number[];
        name?: string;
        strict?: boolean;
        template?: "blank" | "room" | "wall" | "200" | "explore" | "mechanisms";
      }) => {
        validate("importRequest", input);
        ensure(
          ["ldraw", "native", "template"].includes(input.format),
          "INVALID_INPUT",
          "Unknown import format",
        );
        const baseRevision = editor.project.revision;
        const p =
          input.format === "ldraw"
            ? await jobs.wait<Project>(
                jobs.start("import", (signal) =>
                  runWorker<Project>(
                    new Worker(
                      new URL("../workers/import.worker.ts", import.meta.url),
                      { type: "module" },
                    ),
                    { text: input.text || "", name: input.name },
                    signal,
                  ),
                ),
              )
            : input.format === "native"
              ? await jobs.wait<Project>(
                  jobs.start("native-import", () =>
                    decodeNative(new Uint8Array(input.bytes || [])),
                  ),
                )
              : template(input.template || "blank");
        if (input.strict)
          ensure(
            !p.diagnostics.some((d) => d.code === "REFERENCE_MISSING"),
            "REFERENCE_MISSING",
            "Strict import refuses missing references",
          );
        ensure(
          editor.project.revision === baseRevision,
          "REVISION_CONFLICT",
          "Document changed during import",
        );
        return editor.replace(p);
      },
      export: async (input: {
        format: "ldraw" | "native";
        scope?: Parameters<typeof resolveScope>[1];
      }) => {
        validate("exportRequest", input);
        const p = editor.project;
        return input.format === "native"
          ? {
              name: p.title + ".brickproj",
              mimeType: "application/zip",
              bytes: await encodeNative(p),
            }
          : {
              name: p.title + ".mpd",
              mimeType: "text/plain",
              bytes: new TextEncoder().encode(
                input.scope
                  ? scopedLDraw(
                      p,
                      resolveScope(p, input.scope).map((o) => o.id),
                    )
                  : exportLDraw(p),
              ),
            };
      },
    },
    inventory: {
      preview: async (input: InventoryRequest) =>
        inventory.preview(editor.project, input),
      export: async (input: Parameters<InventoryService["export"]>[1]) =>
        inventory.export(editor.project, input),
    },
    query: async (
      input: {
        colorCode?: string;
        ref?: string;
        layerId?: string;
        occurrenceIds?: string[];
      } = {},
    ) => {
      validate("query", input);
      const p = editor.project;
      return {
        revision: p.revision,
        occurrences: occurrences(p).filter(
          (o) =>
            (!input.colorCode || o.colorCode === input.colorCode) &&
            (!input.ref || o.node.ref === input.ref) &&
            (!input.layerId || o.layerId === input.layerId) &&
            (!input.occurrenceIds || input.occurrenceIds.includes(o.id)),
        ),
        diagnostics: p.diagnostics,
      };
    },
    dispatch: async (input: Command) => editor.dispatch(input),
    transaction: async (input: Parameters<Editor["transaction"]>[0]) =>
      editor.transaction(input),
    camera: {
      set: async (input: CameraSpec) => renderer().setCamera(input),
      fit: async () => renderer().fit(),
    },
    render: {
      quality: {
        get: async () => renderer().currentQuality(),
        set: async (
          name: QualityName,
          controls: Partial<QualityControls> = {},
        ) => renderer().setQuality(name, controls),
      },
      image: async (input: RenderRequest) => {
        ensure(
          input.revision === editor.project.revision,
          "REVISION_CONFLICT",
          "Capture revision is stale",
        );
        const activePlay = play?.();
        const playState = activePlay?.getState();
        const resumePlay = playState?.active && !playState.paused;
        if (resumePlay) activePlay!.pause(true);
        let result;
        try {
          const image = await renderer().image(input);
          result = {
            ...image,
            manifest: {
              ...image.manifest,
              ...(playState?.active ? { play: activePlay!.snapshot() } : {}),
              ...(mechanisms?.()?.active
                ? { mechanism: mechanisms!()!.snapshot() }
                : {}),
            },
          };
        } finally {
          if (resumePlay && activePlay?.getState().active)
            activePlay.pause(false);
        }
        ensure(
          input.revision === editor.project.revision,
          "REVISION_CONFLICT",
          "Document changed during capture",
        );
        return result;
      },
    },
  };
}
export type BrickEditorAPI = ReturnType<typeof createAPI>;
declare global {
  interface Window {
    brickEditor?: BrickEditorAPI;
  }
}
