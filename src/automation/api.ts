import { validateRequest } from "../core/validate-request";
import { queryProject, type QueryRequest } from "./query";
import type { FillRequest, fillPreview } from "../edit/fill";
import type { ExportRequest as ProfileRequest } from "../ldraw/export-profiles";
import type { MechanismBrowser } from "../mechanisms/browser";
import type { QualityName, QualityControls } from "../render/quality";
import type { LookName, LookControls } from "../render/look";
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
  PlayMotorRequest,
} from "../play/types";
import { type Editor } from "../core/commands";
import { type CameraSpec, type Command, ensure } from "../core/types";
import { importLDraw, exportLDraw, scopedLDraw } from "../ldraw/io";
import {
  loadFullLibraryIndex,
  unresolvedCuratedRefs,
} from "../catalog/full-library-loader";
import { encodeNative, decodeNative } from "../persistence/native";
import {
  InventoryService,
  type InventoryRequest,
  resolveScope,
} from "../inventory/service";
import type { SceneAdapter, RenderRequest } from "../render/adapter";
import { template } from "../catalog/templates";
import capabilities from "./capabilities.json";
import {
  resourceLimits,
  type ResourcePreference,
} from "../core/resource-profile";
import {
  createCheckpoint,
  deleteCheckpoint,
  listCheckpoints,
  loadCheckpoint,
} from "../persistence/checkpoints";
import { compareProjects } from "../core/compare";
import { modelHealth } from "../core/health";
import { connectorService } from "./connectors";
import {
  applyResourcePreference,
  resourceStatus,
} from "../persistence/resource-preference";
import { JobRegistry, runWorker } from "./jobs";
import type { Project } from "../core/types";
import { validate } from "../core/validate";
import { detectFloors, floorReport } from "../edit/floors";
import { architectureOf, type FloorFocus } from "../core/architecture";
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
        editor.projectId === source.id && editor.revision === source.revision,
        "REVISION_CONFLICT",
        "Fill preview is stale; request a new preview",
      );
      return result;
    });
  };
  const captureImage = async (input: RenderRequest) => {
    const pixels = resourceLimits(editor.resourceProfile).imagePixels;
    ensure(
      input.width * input.height <= pixels,
      "LIMIT_EXCEEDED",
      `Capture exceeds ${pixels / 1e6} megapixels (${editor.resourceProfile} profile)`,
      { resource: "imagePixels", limit: pixels },
    );
    ensure(
      input.revision === editor.revision,
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
      input.revision === editor.revision,
      "REVISION_CONFLICT",
      "Document changed during capture",
    );
    return result;
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
      /** Authored rigs with their joints and optional dynamic settings. */
      list: async () =>
        Object.values(editor.project.motionRigs ?? {})
          .map((rig) => ({
            id: rig.id,
            name: rig.name,
            vehicle: !!rig.vehicle,
            joints: rig.joints.map((joint) => ({
              id: joint.id,
              kind: joint.kind,
              ...(joint.motor ? { motor: structuredClone(joint.motor) } : {}),
            })),
            ...(rig.dynamics
              ? { dynamics: structuredClone(rig.dynamics) }
              : {}),
          }))
          .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)),
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
      /** Static posed LDraw text; the project and rest pose are unchanged. */
      exportPosedModel: async () => mechanism().exportPosedModel(),
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
      setMotor: async (input: PlayMotorRequest) => {
        validateRequest("playMotorRequest", input);
        return player().setMotor(input);
      },
      /** The contextual E/touch action: nearest door, joint or vehicle. */
      interact: async () => {
        player().interact();
        return player().snapshot();
      },
      /** Static posed LDraw snapshot; the project and rest pose are unchanged. */
      exportPosedModel: async () => player().exportPosedModel(),
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
      enterVehicle: async (input: { rigId: string; seatId: string }) => {
        validateRequest("playSeatRequest", input);
        return player().enterVehicle(input);
      },
      exitVehicle: async (input: { exitIndex?: number } = {}) => {
        validateRequest("playSeatExit", input);
        return player().exitVehicle(input);
      },
      vehicleSeatEligibility: async (input: {
        rigId: string;
        seatId: string;
      }) => {
        validateRequest("playSeatRequest", input);
        return player().vehicleSeatEligibility(input);
      },
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
    /** Floor guides, room labels and camera floor views (spec §20.2). Edit them with the
     * floors.set, labels.add/update/remove and camera.bookmark.focus commands. */
    architecture: {
      get: async () => {
        editor.requireMaterialization();
        return floorReport(editor.project);
      },
      detectFloors: async () => {
        editor.requireMaterialization();
        return { floors: detectFloors(editor.project) };
      },
    },
    health: {
      check: async () => {
        editor.requireMaterialization();
        return modelHealth(editor.project);
      },
    },
    /** Verified stud/anti-stud connectors (docs/CONNECTORS.md). */
    connectors: connectorService(() => {
      editor.requireMaterialization();
      return editor.project;
    }),
    checkpoints: {
      list: async () => listCheckpoints(editor.projectId),
      create: async (input: { name: string }) =>
        createCheckpoint(
          editor.project,
          input?.name ?? "",
          editor.materialization.estimate.metrics.leafCount,
        ),
      /** Structured change report from a checkpoint (before) to the current project (after). */
      compare: async (input: { checkpointId: string; maxChanges?: number }) => {
        editor.requireMaterialization();
        const { summary, project } = await loadCheckpoint(input.checkpointId);
        ensure(
          summary.projectId === editor.projectId,
          "INVALID_INPUT",
          "That checkpoint belongs to a different project.",
        );
        return {
          checkpoint: summary,
          report: compareProjects(project, editor.project, {
            maxChanges: input.maxChanges,
          }),
        };
      },
      /** Replace the current document with a checkpoint. Undo history is cleared, so the
       * caller should keep a backup of the current state first. */
      restore: async (input: {
        checkpointId: string;
        expectedRevision: number;
      }) => {
        const { summary, project } = await loadCheckpoint(input.checkpointId);
        ensure(
          summary.projectId === editor.projectId,
          "INVALID_INPUT",
          "That checkpoint belongs to a different project.",
        );
        ensure(
          input.expectedRevision === editor.revision,
          "REVISION_CONFLICT",
          "The project changed; review the checkpoint again before restoring.",
        );
        return editor.replace({ ...project, revision: editor.revision });
      },
      export: async (input: { checkpointId: string }) => {
        const { summary, project } = await loadCheckpoint(input.checkpointId);
        return {
          name: `${project.title} - ${summary.name}.brickproj`,
          mimeType: "application/zip",
          bytes: await encodeNative(project),
        };
      },
      delete: async (input: { checkpointId: string }) =>
        deleteCheckpoint(input.checkpointId),
    },
    resources: {
      status: async () => resourceStatus(editor),
      setProfile: async (input: {
        profile: ResourcePreference;
        acknowledgeImpact?: boolean;
      }) =>
        applyResourcePreference(editor, input?.profile, {
          acknowledgeImpact: input?.acknowledgeImpact === true,
        }),
    },
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
        template?:
          | "blank"
          | "room"
          | "wall"
          | "200"
          | "explore"
          | "mechanisms"
          | "seated-vehicle"
          | "door-room"
          | "physics";
      }) => {
        validate("importRequest", input);
        ensure(
          ["ldraw", "native", "template"].includes(input.format),
          "INVALID_INPUT",
          "Unknown import format",
        );
        const baseRevision = editor.revision;
        const profile = editor.resourceProfile,
          limits = resourceLimits(profile);
        ensure(
          (input.format === "ldraw"
            ? new TextEncoder().encode(input.text || "").length
            : (input.bytes?.length ?? 0)) <= limits.importBytes,
          "LIMIT_EXCEEDED",
          `Import exceeds ${limits.importBytes / 1024 / 1024} MiB (${profile} profile)`,
          { resource: "importBytes", limit: limits.importBytes, profile },
        );
        const p =
          input.format === "ldraw"
            ? await jobs.wait<Project>(
                jobs.start("import", (signal) =>
                  runWorker<Project>(
                    new Worker(
                      new URL("../workers/import.worker.ts", import.meta.url),
                      { type: "module" },
                    ),
                    { text: input.text || "", name: input.name, profile },
                    signal,
                  ),
                ),
              )
            : input.format === "native"
              ? await jobs.wait<Project>(
                  jobs.start("native-import", () =>
                    decodeNative(new Uint8Array(input.bytes || []), limits),
                  ),
                )
              : template(input.template || "blank");
        // Register the complete official pack's index before the document
        // replaces the current one, so its parts resolve as official at once.
        if (unresolvedCuratedRefs(p).size)
          await loadFullLibraryIndex().catch(() => {});
        if (input.strict)
          ensure(
            !p.diagnostics.some((d) => d.code === "REFERENCE_MISSING"),
            "REFERENCE_MISSING",
            "Strict import refuses missing references",
          );
        ensure(
          editor.revision === baseRevision,
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
      /** Shading look: standard (default), realistic (IBL, finishes, AO, soft shadows,
       * no outlines) or photo (realistic plus progressive still refinement). */
      look: {
        get: async () => renderer().currentLook(),
        set: async (name: LookName, controls: Partial<LookControls> = {}) =>
          renderer().setLook(name, controls),
      },
      image: captureImage,
      /** Exploded view: lift floors (top-level submodels, else layers) apart. Render-only. */
      explode: {
        set: async (input: { gap: number }) => ({
          groups: renderer().setExplode(input.gap),
          gap: renderer().exploded,
        }),
        get: async () => ({ gap: renderer().exploded }),
      },
      /** Floor focus and architectural overlays: show one floor with the floors above
       * hidden and those below ghosted; draw floor guides and room labels. View only. */
      floors: {
        set: async (input: {
          focus?: FloorFocus | null;
          floorGuides?: boolean;
          roomLabels?: boolean;
        }) => {
          ensure(
            input &&
              Object.keys(input).every((k) =>
                ["focus", "floorGuides", "roomLabels"].includes(k),
              ),
            "INVALID_INPUT",
            "render.floors.set takes focus, floorGuides and roomLabels.",
          );
          const r = renderer();
          const { focus, ...overlays } = input;
          if (Object.keys(overlays).length) r.setAnnotations(overlays);
          if (focus !== undefined) r.setFloorFocus(focus);
          return { ...r.floorFocus, ...r.annotationState };
        },
        get: async () => {
          const r = renderer();
          return { ...r.floorFocus, ...r.annotationState };
        },
      },
      /** Section cut: hide everything above an LDraw height (authoring aid). */
      section: {
        /** `{ height }` cuts horizontally; `{ axis, at, flip }` cuts along x, y or z. */
        set: async (
          input:
            | { height: number | null }
            | { axis: "x" | "y" | "z"; at: number; flip?: boolean }
            | null,
        ) => {
          const r = renderer();
          if (input === null) r.setSectionPlane(null);
          else if ("height" in input) r.setSection(input.height);
          else r.setSectionPlane(input);
          return { height: r.section, plane: r.sectionPlane };
        },
        get: async () => {
          const r = renderer();
          return {
            height: r.section,
            plane: r.sectionPlane,
            range: {
              x: r.modelRange("x"),
              y: r.modelRange("y"),
              z: r.modelRange("z"),
            },
          };
        },
      },
      /** Render every camera bookmark in a collection (a name prefix such as "exterior/")
       * against one revision, with one shared manifest (spec §20.3). */
      collection: async (input: {
        prefix?: string;
        names?: string[];
        width: number;
        height: number;
        quality?: RenderRequest["quality"];
        look?: RenderRequest["look"];
        background?: RenderRequest["background"];
        visibility?: RenderRequest["visibility"];
      }) => {
        const r = renderer();
        const p = editor.project;
        const revision = p.revision;
        const names = (
          input.names ??
          Object.keys(p.cameraBookmarks).filter(
            (name) => !input.prefix || name.startsWith(input.prefix),
          )
        ).sort();
        ensure(
          names.length > 0,
          "INVALID_INPUT",
          input.prefix
            ? `No camera bookmarks start with “${input.prefix}”.`
            : "This project has no camera bookmarks.",
        );
        ensure(
          names.length <= 24,
          "LIMIT_EXCEEDED",
          "A camera collection renders at most 24 views at once.",
        );
        for (const name of names)
          ensure(
            Object.hasOwn(p.cameraBookmarks, name),
            "INVALID_INPUT",
            "Unknown camera bookmark: " + name,
          );
        const previous = r.currentCamera(),
          previousFocus = r.floorFocus.focus,
          views = architectureOf(p).views;
        const shots: Array<{ name: string; blob: Blob; file: string }> = [];
        let first:
          | Awaited<ReturnType<typeof captureImage>>["manifest"]
          | undefined;
        try {
          for (const name of names) {
            r.setCamera(p.cameraBookmarks[name]);
            // A bookmark's saved floor view ("hide the roof in this camera") applies to
            // its image only; bookmarks without one show every floor.
            r.setFloorFocus(views[name] ?? null);
            const shot = await captureImage({
              revision,
              width: input.width,
              height: input.height,
              format: "png",
              visibility: input.visibility ?? { mode: "all" },
              background: input.background ?? {
                type: "solid",
                color: "#ffffff",
              },
              quality: input.quality ?? "balanced",
              ...(input.look ? { look: input.look } : {}),
            });
            first ??= shot.manifest;
            shots.push({
              name,
              blob: shot.blob,
              file:
                name.replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") +
                ".png",
            });
          }
        } finally {
          r.setCamera(previous);
          try {
            r.setFloorFocus(previousFocus);
          } catch {
            r.setFloorFocus(null);
          }
        }
        return {
          manifest: {
            schemaVersion: 1 as const,
            collection: input.prefix ?? null,
            revision,
            documentHash: first?.documentHash,
            renderer: first?.renderer,
            appVersion: first?.appVersion,
            width: input.width,
            height: input.height,
            images: shots.map((shot) => ({
              name: shot.name,
              file: shot.file,
              camera: p.cameraBookmarks[shot.name],
              floorFocus: views[shot.name] ?? null,
            })),
          },
          images: shots,
        };
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
