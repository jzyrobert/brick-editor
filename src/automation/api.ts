import { validateRequest } from "../core/validate-request";
import { queryProject, type QueryRequest } from "./query";
import type { FillRequest, fillPreview } from "../edit/fill";
import type { ExportRequest as ProfileRequest } from "../ldraw/export-profiles";
import type { MechanismBrowser } from "../mechanisms/browser";
import type { QualityName, QualityControls } from "../render/quality";
import type { PublishFormat } from "../instructions/publish";
import type { CopyRequest } from "../core/fragments";
import type { BrowserPlay } from "../play/browser";
import type {
  PlayRequest,
  PlayCameraSettings,
  PlaySpawnRequest,
  PlayInput,
  PlayJointTargetRequest,
  PlayCameraMode,
  PlayLocomotion,
  PlayTeleportRequest,
} from "../play/types";
import { type Editor } from "../core/commands";
import { type CameraSpec, type Command, ensure } from "../core/types";
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
  selection?: () => string[],
  renderMounted?: () => Promise<void>,
) {
  const inventory = new InventoryService(),
    jobs = new JobRegistry();
  const renderer = () => {
    editor.requireMaterialization();
    const r = render();
    ensure(r, "WEBGL_UNAVAILABLE", "WebGL2 renderer unavailable");
    return r;
  };
  const player = () => {
    editor.requireMaterialization();
    const p = play?.();
    ensure(p, "INVALID_INPUT", "Play controller unavailable");
    return p;
  };
  const mechanism = () => {
    editor.requireMaterialization();
    const m = mechanisms?.();
    ensure(m, "INVALID_INPUT", "Mechanism controller unavailable");
    return m;
  };
  const startFillPreview = (request: FillRequest) => {
    editor.requireMaterialization();
    validateRequest("fillRequest", request);
    const source = structuredClone(editor.project);
    return jobs.start("fill-preview", async (signal) => {
      const result = await runWorker<ReturnType<typeof fillPreview>>(
        new Worker(new URL("../workers/fill.worker.ts", import.meta.url), {
          type: "module",
        }),
        { project: source, request },
        signal,
      );
      ensure(
        editor.project.id === source.id &&
          editor.project.revision === source.revision,
        "REVISION_CONFLICT",
        "Fill preview is stale; request a new preview",
      );
      return result;
    });
  };
  return {
    fill: {
      startPreview: async (request: FillRequest) => ({
        jobId: startFillPreview(request),
      }),
      preview: async (request: FillRequest) =>
        jobs.wait<ReturnType<typeof fillPreview>>(startFillPreview(request)),
    },
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
        dimPrevious?: boolean;
        width?: number;
        height?: number;
      }) => {
        ensure(
          Object.keys(request).every((k) =>
            ["planId", "format", "width", "height", "dimPrevious"].includes(k),
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
        validateRequest("playRequest", request);
        mechanisms?.()?.exit();
        const report = await player().enter(request);
        validate("playSnapshot", report);
        return report;
      },
      configureCamera: async (settings: Partial<PlayCameraSettings>) =>
        player().configureCamera(settings),
      chooseSpawn: async (input: PlaySpawnRequest) =>
        player().chooseSpawn(input),
      useSpawn: async () => player().useSpawn(),
      exit: async () => player().exit(),
      setInput: async (input: PlayInput) => {
        validateRequest("playInput", input);
        return player().setInput(input);
      },
      setJointTarget: async (input: PlayJointTargetRequest) => {
        validateRequest("playJointTarget", input);
        return player().setJointTarget(input);
      },
      setMechanismJoint: async (
        jointId: string,
        value: number,
        rigId?: string,
      ) => player().setMechanismJoint(jointId, value, rigId),
      setMechanismVehicleInput: async (
        input: {
          throttle: number;
          steering: number;
        },
        rigId?: string,
      ) => player().setMechanismVehicleInput(input, rigId),
      setCameraMode: async (mode: PlayCameraMode) =>
        player().setCameraMode(mode),
      setLocomotion: async (mode: PlayLocomotion) =>
        player().setLocomotion(mode),
      teleport: async (input: PlayTeleportRequest) => {
        validateRequest("playTeleport", input);
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
    ready: async (options: { minRevision?: number; strict?: boolean } = {}) => {
      editor.requireMaterialization();
      let unsubscribe = () => {};
      let finished = false;
      const invalidated = new Promise<never>((_resolve, reject) => {
        unsubscribe = editor.subscribe(() => {
          try {
            editor.requireMaterialization();
          } catch (error) {
            reject(error);
          }
        });
      });
      try {
        return await Promise.race([
          (async () => {
            await renderMounted?.();
            ensure(
              !finished,
              "CANCELLED",
              "Renderer readiness was invalidated",
            );
            return renderer().ready(options.minRevision, options.strict);
          })(),
          invalidated,
        ]);
      } finally {
        finished = true;
        unsubscribe();
        editor.requireMaterialization();
      }
    },
    project: {
      status: async () => ({
        ...editor.materialization,
        sourceModels: Object.keys(editor.project.models).length,
      }),
      exportProfile: async (request: ProfileRequest) => {
        editor.requireMaterialization();
        validateRequest("exportProfileRequest", request);
        const snapshot = editor.project;
        return jobs.wait<
          Awaited<
            ReturnType<
              (typeof import("../ldraw/export-profiles"))["exportProfile"]
            >
          >
        >(
          jobs.start("model-export", async (signal, progress) => {
            const { exportProfile } = await import("../ldraw/export-profiles");
            progress(0.1);
            const artifact = await exportProfile(snapshot, request, {
              signal,
              progress: () => progress(0.5),
            });
            const current = editor.project;
            ensure(
              current.id === snapshot.id &&
                current.revision === snapshot.revision,
              "REVISION_CONFLICT",
              "Document changed during model export",
            );
            return artifact;
          }),
        );
      },
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
        validateRequest("exportRequest", input);
        if (input.format === "ldraw" && input.scope)
          editor.requireMaterialization();
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
      preview: async (input: InventoryRequest) => {
        editor.requireMaterialization();
        return inventory.preview(editor.project, input);
      },
      export: async (input: Parameters<InventoryService["export"]>[1]) => {
        editor.requireMaterialization();
        return inventory.export(editor.project, input);
      },
    },
    query: async (input: QueryRequest = {}) => {
      editor.requireMaterialization();
      return queryProject(editor.project, input, selection?.());
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
        const pauseRevision = activePlay?.pauseRevision;
        const sessionEpoch = activePlay?.sessionEpoch;
        let result;
        let restorePlayCamera: (() => void) | undefined;
        try {
          if (playState?.active)
            restorePlayCamera = activePlay!.prepareCapture(
              input.width / input.height,
            );
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
          restorePlayCamera?.();
          if (
            resumePlay &&
            activePlay?.getState().active &&
            activePlay.pauseRevision === pauseRevision &&
            activePlay.sessionEpoch === sessionEpoch
          )
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
