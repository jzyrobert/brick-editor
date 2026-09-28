import { LimitedSource } from "./LimitedSource";
import { ExportProfiles } from "./ExportProfiles";
import { ModelTools } from "./ModelTools";
import { RigAuthoring } from "./RigAuthoring";
import { SeatAuthoring } from "./SeatAuthoring";
import { ShortcutSettings } from "./ShortcutSettings";
import {
  loadShortcuts,
  saveShortcuts,
  shortcutAction,
  type Shortcuts,
} from "../edit/shortcuts";
import { copyToClipboard, pasteFromClipboard } from "../edit/clipboard";
import { WorkplanePanel } from "./WorkplanePanel";
import {
  defaultWorkplane,
  placementOnPlane,
  placeBasis,
  type Workplane,
} from "../edit/workplane";
import { TransformPanel } from "./TransformPanel";
import { folderPath } from "./LayerFolders";
import { SelectionTools, type SelectionShape } from "./SelectionTools";
import { attachRegionGesture } from "../edit/region-gesture";
import {
  combineSelection,
  eligibleSelection,
  type SelectionOperation,
} from "../edit/selection";
import type { RegionMode } from "../render/region-selection";
import { QualityPanel } from "./QualityPanel";
import { MechanismBrowser } from "../mechanisms/browser";
import { MechanismPanel } from "./MechanismPanel";
import { ProjectLibrary } from "./ProjectLibrary";
import { ResourceProfilePanel } from "./ResourceProfilePanel";
import { ReplacePanel } from "./ReplacePanel";
import { CheckpointsPanel } from "./CheckpointsPanel";
import { HealthPanel } from "./HealthPanel";
import { CameraCollections } from "./CameraCollections";
import { FloorControls } from "./FloorControls";
import { architectureOf } from "../core/architecture";
import { Icon, type IconName } from "./icons";
import { inspectSelection, sourceLabels } from "../edit/inspect";
import { measure } from "../edit/measure";
import { occurrenceBox, stackingTarget } from "../edit/stacking";
import {
  catalogCategories,
  relatedParts,
  searchCatalog,
} from "../catalog/search";
import {
  loadFavourites,
  loadRecent,
  pushRecent,
  saveFavourites,
} from "../persistence/catalog-preferences";
import { OfflinePanel } from "./OfflinePanel";
import { LayerActions } from "./LayerActions";
import { ClipboardTools } from "./ClipboardTools";
import { InstructionEditor } from "./InstructionEditor";
import { InstructionsPublish } from "./InstructionsPublish";
import { SharePanel } from "./SharePanel";
import { AutosaveQueue } from "../persistence/autosave";
import { BrowserPlay } from "../play/browser";
import { PlayPanel } from "./PlayPanel";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { Editor } from "../core/commands";
import { occurrences } from "../core/document";
import {
  type Vec3,
  type Scope,
  type CameraSpec,
  uid,
  ensure,
} from "../core/types";
import { identity, rotationY, compose } from "../core/math";
import { catalog, colors } from "../catalog/catalog";
import { template } from "../catalog/templates";
import { SceneAdapter, type SectionSpec } from "../render/adapter";
import { createAPI, type BrickEditorAPI } from "../automation/api";
import { BrowserProjects } from "../persistence/browser-projects";
import {
  applyResourcePreference,
  loadResourcePreference,
  resourceStatus,
} from "../persistence/resource-preference";
import { resourceLimits } from "../core/resource-profile";
import { type Preview } from "../inventory/service";
import { FillOptions, defaultFillOptions } from "./FillOptions";
import { type FillRequest, fillPreview } from "../edit/fill";
import { zipSync, strToU8 } from "fflate";
import "./styles.css";
import "./hud.css";
const editor = new Editor();
// A stored preference was acknowledged when chosen; otherwise the device decides.
try {
  applyResourcePreference(editor, loadResourcePreference(), {
    acknowledgeImpact: true,
    persist: false,
  });
} catch {
  // Unavailable device hints leave the desktop default.
}
const knownSaveRevisions = new Map<string, number>();
let sourceSaveTail: Promise<unknown> = Promise.resolve();
function enqueueSourceSave<T>(action: () => Promise<T>): Promise<T> {
  const result = sourceSaveTail.then(action, action);
  sourceSaveTail = result.catch(() => {});
  return result;
}
let recoveryStarted = false;
const runtime: {
  renderer?: SceneAdapter;
  play?: BrowserPlay;
  mechanisms?: MechanismBrowser;
  selection: () => string[];
} = { selection: () => [] };
let releaseRendererMount = () => {};
let rendererMounted = Promise.resolve();
function expectRendererMount() {
  rendererMounted = new Promise<void>((resolve) => {
    releaseRendererMount = resolve;
  });
}
expectRendererMount();
// Stored-project recovery is asynchronous (IndexedDB); automation readiness must not
// resolve against the blank startup document while it is still in flight.
let releaseStartupRecovery = () => {};
const startupRecovered = new Promise<void>((resolve) => {
  releaseStartupRecovery = resolve;
});
const applicationAPI = createAPI(
  editor,
  () => runtime.renderer,
  () => runtime.play,
  () => runtime.mechanisms,
  () => runtime.selection(),
  () => Promise.all([rendererMounted, startupRecovered]).then(() => {}),
);
function download(
  name: string,
  bytes: Uint8Array | Blob,
  mime = "application/octet-stream",
) {
  const blob =
    bytes instanceof Blob
      ? bytes
      : new Blob([bytes as BlobPart], { type: mime });
  const url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function BrickIcon({
  width = 4,
  depth = 2,
  color = "#bac4cb",
}: {
  width?: number;
  depth?: number;
  color?: string;
}) {
  return (
    <svg viewBox="0 0 130 88" aria-hidden="true">
      <path d="M15 32 72 12 116 34 60 55Z" fill={color} />
      <path
        d="M15 32 60 55 60 77 15 54Z"
        fill={color}
        style={{ filter: "brightness(.8)" }}
      />
      <path
        d="M60 55 116 34 116 57 60 77Z"
        fill={color}
        style={{ filter: "brightness(.65)" }}
      />
      {Array.from(
        { length: Math.min(width, 4) * Math.min(depth, 2) },
        (_, i) => {
          const x = i % Math.min(width, 4),
            z = Math.floor(i / Math.min(width, 4));
          return (
            <g key={i}>
              <path
                d={`M${34 + x * 13 + z * 20} ${26 - x * 4 + z * 10}v7a7 4 0 0 0 14 0v-7`}
                fill={color}
              />
              <ellipse
                cx={41 + x * 13 + z * 20}
                cy={26 - x * 4 + z * 10}
                rx="7"
                ry="4"
                fill={color}
                stroke="#ffffff66"
                strokeWidth="1"
              />
            </g>
          );
        },
      )}
    </svg>
  );
}
function NumberInput({
  label,
  value,
  onChange,
  step = 1,
}: {
  label: string;
  /** Undefined shows "Mixed" for a batch whose members differ. */
  value: number | undefined;
  onChange: (n: number) => void;
  step?: number;
}) {
  return (
    <label className="number-field">
      <span>{label}</span>
      <input
        type="number"
        aria-label={label}
        placeholder={value === undefined ? "Mixed" : undefined}
        value={
          value === undefined
            ? ""
            : Number.isFinite(value)
              ? Number(value.toFixed(4))
              : 0
        }
        step={step}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (Number.isFinite(n)) onChange(n);
        }}
      />
    </label>
  );
}
export default function App() {
  const [availability, setAvailability] = useState(
    () => editor.materialization,
  );
  const [workspaceEpoch, setWorkspaceEpoch] = useState(0);
  useEffect(
    () =>
      editor.subscribe(() => {
        const next = editor.materialization;
        if (next.status === "limited") setWorkspaceEpoch((epoch) => epoch + 1);
        setAvailability(next);
      }),
    [],
  );
  return availability.status === "limited" ? (
    <LimitedSource
      editor={editor}
      api={applicationAPI}
      knownSaveRevisions={knownSaveRevisions}
      enqueueSave={enqueueSourceSave}
    />
  ) : (
    <Workspace key={workspaceEpoch} />
  );
}
function Workspace() {
  const [project, setProject] = useState(() => editor.project),
    [transientView, setTransientView] = useState(false),
    [saveConflict, setSaveConflict] = useState(false),
    [saveCoordinationUnavailable, setSaveCoordinationUnavailable] =
      useState(false),
    [mode, setMode] = useState(
      location.hash.startsWith("#v=") ? "Project" : "Build",
    ),
    [tool, setTool] = useState("Select"),
    [shortcuts, setShortcuts] = useState<Shortcuts>(loadShortcuts),
    [transformModeRequest, setTransformModeRequest] = useState<{
      mode: "off" | "translate" | "rotate";
      nonce: number;
    }>(),
    [part, setPart] = useState("3001.dat"),
    [color, setColor] = useState("4"),
    [search, setSearch] = useState(""),
    [partCategory, setPartCategory] = useState<string>(),
    [favouritesOnly, setFavouritesOnly] = useState(false),
    [favourites, setFavourites] = useState(() =>
      loadFavourites((id) => !!catalog[id]),
    ),
    [recentParts, setRecentParts] = useState(() =>
      loadRecent((id) => !!catalog[id]),
    ),
    [selection, setSelection] = useState<string[]>([]),
    [selectionShape, setSelectionShape] = useState<SelectionShape>("click"),
    [selectionOperation, setSelectionOperation] =
      useState<SelectionOperation>("replace"),
    [selectionDepth, setSelectionDepth] = useState<RegionMode>("visible"),
    [activeLayer, setActiveLayer] = useState("base"),
    [crossLayer, setCrossLayer] = useState(false),
    [ghostOtherLayers, setGhostOtherLayers] = useState(false),
    [position, setPosition] = useState<Vec3>([0, -24, 0]),
    [angle, setAngle] = useState(0),
    [workplane, setWorkplane] = useState(defaultWorkplane),
    [pickingFace, setPickingFace] = useState(false),
    [status, setStatus] = useState("Ready to build"),
    [statusFresh, setStatusFresh] = useState(false),
    [saveStatus, setSaveStatus] = useState("Not yet saved"),
    [panel, setPanel] = useState("Parts"),
    [sheetFull, setSheetFull] = useState(false),
    [viewsOpen, setViewsOpen] = useState(false),
    [modesOpen, setModesOpen] = useState(false),
    [section, setSection] = useState<SectionSpec | null>(null),
    [measurePoints, setMeasurePoints] = useState<Vec3[]>([]),
    [explodeBricks, setExplodeBricks] = useState(0),
    [sectionRange, setSectionRange] = useState<{
      min: number;
      max: number;
    } | null>(null),
    [inventoryOpen, setInventoryOpen] = useState(false),
    [inventoryScope, setInventoryScope] = useState<Scope["kind"]>("all"),
    [condition, setCondition] = useState("any"),
    [acceptUnknown, setAcceptUnknown] = useState(false),
    [preview, setPreview] = useState<Preview | null>(null),
    [busy, setBusy] = useState(false),
    [fillOpen, setFillOpen] = useState(false),
    [fillOptions, setFillOptions] = useState(defaultFillOptions),
    [columns, setColumns] = useState(5),
    [rows, setRows] = useState(4),
    [fill, setFill] = useState<ReturnType<typeof fillPreview> | null>(null),
    [step, setStep] = useState(0),
    [dimPrevious, setDimPrevious] = useState(false),
    [activePlanId, setActivePlanId] = useState(""),
    [photoSize, setPhotoSize] = useState([1600, 1200]),
    [transparent, setTransparent] = useState(false),
    [bookmarkName, setBookmarkName] = useState(""),
    [bookmarkFloor, setBookmarkFloor] = useState(true),
    [floorsOpen, setFloorsOpen] = useState(false),
    [focusFloorId, setFocusFloorId] = useState<string | null>(null),
    [ghostBelow, setGhostBelow] = useState(true),
    [floorGuides, setFloorGuides] = useState(false),
    [roomLabels, setRoomLabels] = useState(true),
    [labelDraft, setLabelDraft] = useState<string | null>(null),
    [camera, setCamera] = useState<CameraSpec>({
      space: "ldraw",
      projection: "perspective",
      position: [420, -340, 460],
      target: [0, -25, 0],
      up: [0, -1, 0],
      fovDeg: 45,
      near: 0.5,
      far: 50000,
    }),
    [overridePart, setOverridePart] = useState(""),
    [overrideColor, setOverrideColor] = useState(""),
    [overrideId, setOverrideId] = useState("");
  const viewport = useRef<HTMLDivElement>(null),
    renderer = useRef<SceneAdapter | undefined>(undefined),
    api = useRef<BrickEditorAPI | undefined>(undefined),
    play = useRef<BrowserPlay | undefined>(undefined),
    mechanisms = useRef<MechanismBrowser | undefined>(undefined),
    modeRef = useRef(mode),
    fileInput = useRef<HTMLInputElement>(null),
    worker = useRef<Worker | undefined>(undefined),
    saveRevisions = useRef(knownSaveRevisions),
    autosave = useRef<AutosaveQueue | undefined>(undefined),
    loaded = useRef(false),
    operationEpoch = useRef(0),
    observedProjectId = useRef(editor.projectId),
    projectRef = useRef(project),
    selectionRef = useRef(selection),
    interact = useRef({
      tool,
      selectionShape,
      selectionOperation,
      selectionDepth,
      part,
      color,
      activeLayer,
      crossLayer,
      workplane,
      pickingFace,
      angle,
      labelDraft,
    });
  const ownsTransientView = () => {
    const playing = play.current?.getState(),
      moving = mechanisms.current?.getState();
    return !!(
      playing?.active ||
      playing?.loading ||
      moving?.active ||
      moving?.loading
    );
  };
  const all =
      editor.materialization.status === "available" ? occurrences(project) : [],
    // The parent unmounts this entire derived workspace on limited replacement.

    selected = all.filter((o) => selection.includes(o.id)),
    currentPart = catalog[part],
    currentPlanId = project.instructionPlans[activePlanId]
      ? activePlanId
      : (Object.keys(project.instructionPlans)[0] ?? ""),
    plan = project.instructionPlans[currentPlanId];
  modeRef.current = mode;
  projectRef.current = project;
  selectionRef.current = selection;
  interact.current = {
    tool,
    selectionShape,
    selectionOperation,
    selectionDepth,
    part,
    color,
    activeLayer,
    crossLayer,
    workplane,
    pickingFace,
    angle,
    labelDraft,
  };
  const run = async (fn: () => unknown | Promise<unknown>) => {
    try {
      return await fn();
    } catch (e) {
      setStatus(e instanceof Error ? e.message : String(e));
      return undefined;
    }
  };
  const command = (type: string, payload: Record<string, any> = {}) =>
    editor.dispatch({
      schemaVersion: 1,
      commandId: uid(),
      expectedRevision: editor.revision,
      type,
      payload,
    });
  const scoped = () => ({
    occurrenceIds: selection,
    includeHidden: false,
    ...(!crossLayer ? { activeLayerId: activeLayer } : {}),
  });
  const colorHex = (code: string) => colors.find((c) => c.code === code)?.hex;
  const inspection = useMemo(
    () => inspectSelection(project, selected),
    // `selected` derives from these two.
    [project, selection],
  );
  /** Set one world axis on every selected part: one undoable transaction, one
   * command per distinct current value. */
  const setAxis = (axis: number, value: number) => {
    const groups = new Map<number, string[]>();
    for (const o of selected) {
      const current = o.transform.position[axis];
      groups.set(current, [...(groups.get(current) ?? []), o.id]);
    }
    const p = editor.project;
    const commands = [...groups]
      .filter(([current]) => current !== value)
      .map(([current, occurrenceIds]) => {
        const delta: Vec3 = [0, 0, 0];
        delta[axis] = value - current;
        return {
          schemaVersion: 1 as const,
          commandId: uid(),
          expectedRevision: p.revision,
          type: "parts.transform",
          payload: { ...scoped(), occurrenceIds, delta, space: "ldraw" },
        };
      });
    if (!commands.length) return;
    if (commands.length === 1) command(commands[0].type, commands[0].payload);
    else
      editor.transaction({
        commandId: uid(),
        expectedRevision: p.revision,
        commands,
      });
  };
  const updateWorkplane = (next: Workplane) => {
    setWorkplane(next);
    setPosition(
      (v) => placementOnPlane(v, next, currentPart.height, angle).position,
    );
    setFill(null);
  };
  const setSelectionSafe = (ids: string[]) => {
    setSelection(ids);
    renderer.current?.select(ids);
  };
  const receiveSelection = (ids: string[], operation?: SelectionOperation) => {
    const p = editor.project,
      s = interact.current,
      all = occurrences(p);
    const eligible = eligibleSelection(
      p,
      all,
      ids,
      s.activeLayer,
      s.crossLayer,
    );
    const next = combineSelection(
      selectionRef.current,
      eligible,
      operation ?? s.selectionOperation,
    );
    setSelectionSafe(
      eligibleSelection(p, all, next, s.activeLayer, s.crossLayer),
    );
    setStatus(
      `${eligible.length} matching editable part${eligible.length === 1 ? "" : "s"}${ids.length > eligible.length ? `; ${ids.length - eligible.length} excluded by scope` : ""}`,
    );
  };
  useEffect(
    () =>
      attachRegionGesture(
        viewport.current!,
        () => ({
          enabled:
            modeRef.current === "Build" &&
            interact.current.tool === "Select" &&
            !interact.current.pickingFace,
          shape: interact.current.selectionShape,
          depth: interact.current.selectionDepth,
          renderer: renderer.current,
          revision: editor.revision,
        }),
        (ids) => receiveSelection(ids),
        setStatus,
      ),
    [
      mode,
      tool,
      selectionShape,
      selectionDepth,
      activeLayer,
      crossLayer,
      pickingFace,
    ],
  );
  useEffect(() => {
    const openSharedPreview = () => {
      if (location.hash.startsWith("#v=")) setMode("Project");
    };
    window.addEventListener("hashchange", openSharedPreview);
    return () => window.removeEventListener("hashchange", openSharedPreview);
  }, []);
  useEffect(() => {
    const unsubscribe = editor.subscribe(() => {
      const p = editor.project;
      play.current?.sourceChanged();
      if (observedProjectId.current !== p.id) {
        observedProjectId.current = p.id;
        setSaveConflict(false);
      }
      if (editor.materialization.status === "limited") {
        setSelection([]);
        void autosave.current?.flush();
        mechanisms.current?.exit();
        renderer.current?.dispose();
        renderer.current = undefined;
        runtime.renderer = undefined;
        runtime.play = undefined;
        runtime.mechanisms = undefined;
        runtime.selection = () => [];
        releaseRendererMount();
        expectRendererMount();
        return;
      }
      setProject(p);
      setSelection((ids) =>
        ids.filter((id) => occurrences(p).some((o) => o.id === id)),
      );
      if (!p.layers[interact.current.activeLayer])
        setActiveLayer(p.defaultLayerId);
      setPreview(null);
      renderer.current
        ?.update(p)
        .then(() => renderer.current?.select(selectionRef.current))
        .catch(() => {});
      if (!loaded.current) return;
      setSaveStatus("Unsaved changes");
      autosave.current?.schedule(p);
    });
    const save = (p: typeof project) =>
      enqueueSourceSave(async () => {
        try {
          if (editor.projectId === p.id) setSaveStatus("Saving…");
          const store = new BrowserProjects(localStorage);
          saveRevisions.current.set(
            p.id,
            await store.save(p, saveRevisions.current.get(p.id) ?? null),
          );
          if (editor.projectId === p.id) {
            localStorage.setItem("brick-editor-current", p.id);
            setSaveCoordinationUnavailable(false);
            setSaveStatus(
              editor.revision === p.revision
                ? "Saved revision " + p.revision
                : "Unsaved changes",
            );
          }
        } catch (e) {
          if (editor.projectId !== p.id) return;
          if (
            (e as { code?: string }).code === "STORAGE_COORDINATION_UNAVAILABLE"
          )
            setSaveCoordinationUnavailable(true);
          if ((e as { code?: string }).code === "REVISION_CONFLICT")
            setSaveConflict(true);
          setSaveStatus("Save failed — download a backup");
          setStatus(e instanceof Error ? e.message : String(e));
        }
      });
    autosave.current = new AutosaveQueue(save, (e) =>
      setStatus(e instanceof Error ? e.message : String(e)),
    );
    const flushSave = () => {
      if (document.hidden) void autosave.current?.flush();
    };
    document.addEventListener("visibilitychange", flushSave);
    const notifySavedChange = (event: StorageEvent) => {
      const id = editor.projectId;
      if (
        event.key !== "brick-editor:" + encodeURIComponent(id) + ":head" &&
        event.key !== "brick-editor-project-change"
      )
        return;
      void new BrowserProjects(localStorage)
        .load(id)
        .then((saved) => {
          if (editor.projectId !== id || !loaded.current) return;
          const known = saveRevisions.current.get(id);
          if (known !== undefined && (saved?.revision ?? null) !== known) {
            setSaveConflict(true);
            setStatus(
              saved
                ? "Another tab saved a new revision. Your current draft is unchanged."
                : "Another tab removed the saved copy. Keep a backup or fork your draft.",
            );
          }
        })
        .catch(() =>
          setStatus(
            "Could not check another tab's save; keep a native backup.",
          ),
        );
    };
    window.addEventListener("storage", notifySavedChange);
    try {
      renderer.current = new SceneAdapter(viewport.current!, setStatus);
    } catch (e) {
      setStatus(e instanceof Error ? e.message : String(e));
    }
    mechanisms.current = new MechanismBrowser(editor, () => renderer.current);
    play.current = new BrowserPlay(
      () => renderer.current,
      () => editor.revision,
      () => mechanisms.current?.exit(),
      () => editor.project,
    );
    const syncTransientView = () => setTransientView(ownsTransientView());
    const unsubscribePlayView = play.current.subscribe(syncTransientView);
    const unsubscribeMechanismView =
      mechanisms.current.subscribe(syncTransientView);
    runtime.renderer = renderer.current;
    runtime.play = play.current;
    runtime.mechanisms = mechanisms.current;
    runtime.selection = () => [...selectionRef.current];
    api.current = applicationAPI;
    releaseRendererMount();
    if (new URLSearchParams(location.search).get("automation") === "1")
      window.brickEditor = api.current;
    const init = async () => {
      if (recoveryStarted) {
        loaded.current = true;
        const reopened = editor.project;
        renderer.current?.update(reopened).catch(() => {});
        autosave.current?.schedule(reopened);
        // Returning from the source-only view (e.g. after raising device limits):
        // show the model itself rather than an empty catalogue sheet.
        const count = editor.materialization.estimate.metrics.leafCount;
        if (count) {
          setPanel("Canvas");
          void renderer.current
            ?.ready()
            .then(() => renderer.current?.fit())
            .catch(() => {});
          const raised = resourceStatus(editor).raisedAboveDevice;
          setStatus(
            `${raised ? "Desktop limits on. " : ""}Project opened: ${count.toLocaleString("en")} parts and shapes.`,
          );
        }
        return;
      }
      recoveryStarted = true;
      const initialRevision = editor.revision,
        initialId = editor.projectId;
      let recovered = false;
      try {
        const id = localStorage.getItem("brick-editor-current");
        const saved = id
          ? await new BrowserProjects(localStorage).load(id)
          : null;
        if (
          saved &&
          editor.revision === initialRevision &&
          editor.projectId === initialId
        ) {
          saveRevisions.current.set(saved.id, saved.revision);
          observedProjectId.current = saved.id;
          editor.replace(saved);
          recovered = true;
          setStatus("Recovered local project");
        } else renderer.current?.update(editor.project).catch(() => {});
      } catch (e) {
        setStatus("Local storage is unavailable; use native file backups.");
        renderer.current?.update(editor.project).catch(() => {});
      }
      loaded.current = true;
      releaseStartupRecovery();
      if (
        !recovered &&
        (editor.revision !== initialRevision || editor.projectId !== initialId)
      )
        autosave.current?.schedule(editor.project);
    };
    void init();
    return () => {
      unsubscribe();
      unsubscribePlayView();
      unsubscribeMechanismView();
      play.current?.dispose();
      mechanisms.current?.dispose();
      renderer.current?.dispose();
      worker.current?.terminate();
      autosave.current?.dispose();
      document.removeEventListener("visibilitychange", flushSave);
      window.removeEventListener("storage", notifySavedChange);
      delete window.brickEditor;
    };
  }, []);
  useEffect(() => {
    renderer.current?.ghostOtherLayers(
      mode === "Build" && ghostOtherLayers ? activeLayer : null,
    );
  }, [mode, ghostOtherLayers, activeLayer]);
  useEffect(() => {
    const r = renderer.current;
    if (!r || ownsTransientView()) return;
    r.controls.enableRotate = mode === "Build" || mode === "Photo";
    r.controls.mouseButtons.LEFT = tool === "Navigate" ? 0 : (null as any);
    r.controls.touches.ONE = tool === "Navigate" ? 0 : (null as any);
    r.controls.enabled = mode !== "Play";
  }, [tool, mode, transientView]);
  useEffect(() => {
    if (mode === "Instructions" && !ownsTransientView())
      renderer.current?.showStep(
        plan ? plan.steps.slice(0, step + 1).flat() : null,
        dimPrevious && plan ? plan.steps[step] : undefined,
      );
  }, [mode, step, plan, transientView, dimPrevious]);
  useEffect(() => {
    if (mode !== "Instructions") renderer.current?.showStep(null);
    // Document replacement cancels the old session synchronously through
    // sourceChanged. A delayed plan render must not cancel a new API session.
    if (mode !== "Play") {
      play.current?.exit();
      mechanisms.current?.exit();
    }
    if (mode !== "Build") setPanel("Canvas");
  }, [mode]);
  useEffect(() => {
    setStep((index) =>
      Math.max(0, Math.min(index, (plan?.steps.length ?? 1) - 1)),
    );
  }, [plan]);
  useEffect(() => {
    const camera = plan?.stepMetadata?.[step]?.camera,
      r = renderer.current;
    if (mode !== "Instructions" || !camera || !r || ownsTransientView()) return;
    let cancelled = false;
    void r
      .ready()
      .then(() => {
        if (!cancelled && !ownsTransientView()) r.setCamera(camera);
      })
      .catch((e) => setStatus(e.message));
    return () => {
      cancelled = true;
    };
  }, [mode, currentPlanId, step, plan?.stepMetadata, transientView]);

  useEffect(() => {
    renderer.current?.setWorkplaneGuide(workplane);
  }, [workplane]);
  useEffect(() => {
    if (mode !== "Build") setPickingFace(false);
  }, [mode]);
  useEffect(() => {
    if (tool === "Place" && mode === "Build")
      void renderer.current
        ?.previewPart(part, color, position, placeBasis(workplane, angle))
        .catch((e) => setStatus(e.message));
    else renderer.current?.clearGhost();
  }, [tool, part, color, position, angle, mode, project.revision, workplane]);
  useEffect(() => {
    if (!inventoryOpen && !fillOpen) return;
    const previous = document.activeElement as HTMLElement;
    const frame = requestAnimationFrame(() => {
      (document.querySelector(".dialog button") as HTMLElement)?.focus();
    });
    const trap = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setInventoryOpen(false);
        setFillOpen(false);
        worker.current?.terminate();
        setBusy(false);
      }
      if (e.key !== "Tab") return;
      const items = Array.from(
        document.querySelectorAll<HTMLElement>(
          ".dialog button:not(:disabled),.dialog input,.dialog select,.dialog a",
        ),
      ).filter((el) => el.offsetParent !== null);
      const first = items[0],
        last = items.at(-1);
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", trap);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("keydown", trap);
      previous?.focus();
    };
  }, [inventoryOpen, fillOpen]);
  useEffect(() => {
    const el = viewport.current!;
    const pointers = new Map<number, { x: number; y: number }>();
    let navigated = false;
    const down = (e: PointerEvent) => {
      const r = renderer.current;
      if (r?.transformDragging || r?.transformHitTest(e.clientX, e.clientY))
        return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size > 1) navigated = true;
    };
    const up = (e: PointerEvent) => {
      if (modeRef.current !== "Build" || play.current?.getState().active)
        return;
      const start = pointers.get(e.pointerId);
      pointers.delete(e.pointerId);
      const wasNavigation = navigated;
      if (!pointers.size) navigated = false;
      if (
        !start ||
        wasNavigation ||
        Math.hypot(e.clientX - start.x, e.clientY - start.y) > 6 ||
        e.button !== 0
      )
        return;
      const r = renderer.current,
        s = interact.current;
      if (!r) return;
      if (s.pickingFace) {
        void run(() => {
          const face = r.pickFace(e.clientX, e.clientY, undefined, s.workplane);
          ensure(
            face,
            "INVALID_INPUT",
            "Tap a visible model face to define the workplane.",
          );
          setWorkplane(face.plane);
          setPosition(
            (v) =>
              placementOnPlane(v, face.plane, catalog[s.part].height, s.angle)
                .position,
          );
          setPickingFace(false);
          setFill(null);
          setStatus("Workplane aligned to the selected face.");
        });
        return;
      }
      if (s.labelDraft !== null) {
        const text = s.labelDraft;
        const point =
          r.pickPoint(e.clientX, e.clientY) ??
          r.planeIntersection(e.clientX, e.clientY, s.workplane);
        if (!point) return;
        void run(() => {
          command("labels.add", { text, position: point });
          setLabelDraft(null);
          setStatus(
            `Label “${text}” placed. Edit or remove it under Floors & rooms.`,
          );
        });
        return;
      }
      if (s.tool === "Navigate") return;
      if (s.tool === "Measure") {
        const point =
          r.pickPoint(e.clientX, e.clientY) ??
          r.planeIntersection(e.clientX, e.clientY, s.workplane);
        if (!point) return;
        setMeasurePoints((points) => {
          const next = points.length === 1 ? [points[0], point] : [point];
          setStatus(
            next.length === 1
              ? "First point set. Tap a second point to measure."
              : "Measured: " + measure(next[0], next[1]).label,
          );
          return next;
        });
        return;
      }
      const p = editor.project;
      if (s.tool === "Place") {
        // Tapping an existing part stacks on its top or sits beside it; otherwise the
        // tap lands on the workplane.
        const surface = r.pickSurface(e.clientX, e.clientY);
        const target =
          surface &&
          (() => {
            const project = editor.project;
            const hit = occurrences(project).find(
              (o) => o.id === surface.occurrenceId,
            );
            if (!hit) return null;
            const spec = catalog[s.part];
            return stackingTarget(
              s.workplane,
              surface,
              occurrenceBox(project, hit),
              hit.namespace === "official" && !!catalog[hit.node.ref],
              { width: spec.width, depth: spec.depth, angle: s.angle },
            );
          })();
        if (target) {
          setPosition(
            placementOnPlane(
              target.point,
              target.plane,
              catalog[s.part].height,
              s.angle,
            ).position,
          );
          setStatus(
            surface!.normal[1] < -0.7
              ? "Preview stacked on top. Choose Place part to commit."
              : "Preview placed beside the part. Choose Place part to commit.",
          );
          return;
        }
        const v = r.planeIntersection(e.clientX, e.clientY, s.workplane);
        if (v) {
          setPosition(
            placementOnPlane(v, s.workplane, catalog[s.part].height, s.angle)
              .position,
          );
          setStatus("Placement preview ready. Choose Place part to commit.");
        }
        return;
      }
      const id = r.pick(e.clientX, e.clientY);
      if (!id) {
        if (s.selectionOperation === "replace") setSelectionSafe([]);
        return;
      }
      const o = occurrences(p).find((o) => o.id === id);
      if (!o) {
        setStatus("The scene is updating; select again when ready.");
        return;
      }
      if (
        p.layers[o.layerId].locked ||
        (!s.crossLayer && o.layerId !== s.activeLayer)
      ) {
        setStatus("This part is outside the active editable layer.");
        return;
      }
      if (s.tool === "Paint")
        void run(() =>
          command("parts.recolor", {
            occurrenceIds: [id],
            colorCode: s.color,
            activeLayerId: s.crossLayer ? undefined : s.activeLayer,
          }),
        );
      else {
        receiveSelection([id], e.shiftKey ? "toggle" : s.selectionOperation);
        setPanel("Inspector");
      }
    };
    const cancel = () => {
      pointers.clear();
      navigated = false;
    };
    el.addEventListener("pointerdown", down);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", cancel);
    return () => {
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", cancel);
    };
  }, []);
  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      if (modeRef.current !== "Build" || play.current?.getState().active)
        return;
      if (
        (e.target instanceof Element &&
          e.target.closest(
            "input,textarea,select,[contenteditable]:not([contenteditable=false]),[role=textbox]",
          )) ||
        inventoryOpen ||
        fillOpen ||
        e.isComposing
      )
        return;
      const action = shortcutAction(e, shortcuts);
      if (!action) return;
      e.preventDefault();
      if (e.repeat && !["undo", "redo"].includes(action)) return;
      if (action === "undo" || action === "redo") {
        void run(() => command("history." + action));
        return;
      }
      if (action === "copy" || action === "cut") {
        void run(() => {
          copyToClipboard(
            editor,
            selectionRef.current,
            activeLayer,
            crossLayer,
            action === "cut",
          );
          setStatus(
            action === "cut"
              ? "Cut to internal clipboard"
              : "Copied selection to internal clipboard",
          );
        });
        return;
      }
      if (action === "paste") {
        void run(() => {
          const result = pasteFromClipboard(editor, activeLayer);
          setSelectionSafe(result.addedIds);
          setStatus(`Pasted ${result.addedIds.length} occurrences`);
        });
        return;
      }
      if (action === "duplicate" || action === "remove") {
        void run(() =>
          command(
            action === "duplicate" ? "parts.duplicate" : "parts.remove",
            scoped(),
          ),
        );
        return;
      }
      if (action === "select") {
        setTool("Select");
        setTransformModeRequest({ mode: "off", nonce: Date.now() });
      }
      if (action === "place") setTool("Place");
      if (action === "paint") setTool("Paint");
      if (action === "focus") renderer.current?.fit();
      if (action === "move" || action === "rotate") {
        if (!selectionRef.current.length) {
          setStatus("Select parts before showing transform handles.");
          return;
        }
        setTool("Select");
        setSelectionShape("click");
        setPickingFace(false);
        setTransformModeRequest({
          mode: action === "move" ? "translate" : "rotate",
          nonce: Date.now(),
        });
      }
      if (action === "cancel") {
        if (interact.current.pickingFace) {
          setPickingFace(false);
          setStatus("Face picking cancelled.");
          return;
        }
        setSelectionSafe([]);
        setFillOpen(false);
        setTool("Select");
      }
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, [selection, activeLayer, crossLayer, inventoryOpen, fillOpen, shortcuts]);
  async function openFile(file: File) {
    await run(async () => {
      const importBytes = resourceLimits(editor.resourceProfile).importBytes;
      ensure(
        file.size <= importBytes,
        "LIMIT_EXCEEDED",
        `File exceeds ${importBytes / 1024 / 1024} MiB (${editor.resourceProfile} profile)`,
      );
      const epoch = ++operationEpoch.current;
      setBusy(true);
      try {
        const input = file.name.endsWith(".brickproj")
          ? {
              format: "native" as const,
              bytes: Array.from(new Uint8Array(await file.arrayBuffer())),
            }
          : {
              format: "ldraw" as const,
              text: await file.text(),
              name: file.name,
            };
        ensure(
          epoch === operationEpoch.current,
          "CANCELLED",
          "Import cancelled",
        );
        const result = await api.current!.project.import(input);
        if (result.materialization.status === "limited") return;
        setStatus("Imported revision " + result.revision);
        await renderer.current?.ready();
        renderer.current?.fit();
        setSelectionSafe([]);
      } finally {
        setBusy(false);
      }
    });
  }
  async function exportFile(format: "native" | "ldraw") {
    await run(async () => {
      const a = await api.current!.project.export({ format });
      download(a.name, a.bytes, a.mimeType);
      setStatus("Downloaded " + a.name);
    });
  }
  async function useTemplate(name: Parameters<typeof template>[0]) {
    await run(async () => {
      if (all.length) {
        const backup = await api.current!.project.export({ format: "native" });
        download(backup.name, backup.bytes, backup.mimeType);
      }
      editor.replace(template(name));
      setActiveLayer("base");
      setSelectionSafe([]);
      await renderer.current?.ready();
      renderer.current?.fit();
      setStatus(
        name === "blank"
          ? "New blank project"
          : "Original template loaded; previous build downloaded as backup",
      );
    });
  }
  async function previewInventory() {
    await run(async () => {
      const scope: Scope =
        inventoryScope === "layers"
          ? { kind: "layers", layerIds: [activeLayer] }
          : inventoryScope === "selection"
            ? { kind: "selection", occurrenceIds: selection }
            : inventoryScope === "submodel"
              ? { kind: "submodel", occurrenceId: selection[0] || "" }
              : { kind: inventoryScope };
      const result = await api.current!.inventory.preview({
        expectedRevision: editor.revision,
        format: "bricklink-wanted-xml",
        scope,
        condition: condition as any,
        acceptUnknownColors: acceptUnknown,
      });
      setPreview(result);
    });
  }
  async function exportInventory(partial = false, copy = false) {
    await run(async () => {
      ensure(preview, "INVALID_INPUT", "Generate a preview first");
      const a = await api.current!.inventory.export({
        previewId: preview.previewId,
        expectedRevision: preview.documentRevision,
        expectedMappingPackSha256: preview.mappingPackSha256,
        errorPolicy: partial ? "export-resolved" : "block",
      });
      if (copy) {
        ensure(
          a.mimeType === "application/xml",
          "INVALID_INPUT",
          "Only a complete XML export can be copied",
        );
        await navigator.clipboard.writeText(new TextDecoder().decode(a.bytes));
        setStatus("XML copied");
      } else download(a.name, a.bytes, a.mimeType);
    });
  }
  async function perLayer() {
    await run(async () => {
      const files: Record<string, Uint8Array> = {},
        reports: unknown[] = [];
      for (const layer of Object.values(project.layers)) {
        const p = await api.current!.inventory.preview({
          expectedRevision: project.revision,
          format: "bricklink-wanted-xml",
          scope: { kind: "layers", layerIds: [layer.id] },
          condition: condition as any,
          acceptUnknownColors: acceptUnknown,
        });
        if (p.sourceOccurrenceCount === 0) continue;
        const a = await api.current!.inventory.export({
          previewId: p.previewId,
          expectedRevision: p.documentRevision,
          expectedMappingPackSha256: p.mappingPackSha256,
          errorPolicy: "block",
        });
        files[`layer-${layer.order}-${encodeURIComponent(layer.id)}.xml`] =
          a.bytes;
        reports.push(a.manifest);
      }
      files["inventory-report.json"] = strToU8(
        JSON.stringify(reports, null, 2),
      );
      download("layer-wanted-lists.zip", zipSync(files), "application/zip");
    });
  }
  useEffect(() => {
    if (worker.current) {
      worker.current.terminate();
      worker.current = undefined;
      setBusy(false);
    }
    setFill(null);
  }, [
    fillOptions,
    columns,
    rows,
    position,
    part,
    color,
    activeLayer,
    angle,
    workplane,
  ]);
  function startFill() {
    void run(() => {
      worker.current?.terminate();
      let mask: boolean[] | undefined;
      if (fillOptions.enabled && fillOptions.maskText.trim()) {
        const lines = fillOptions.maskText
          .trim()
          .split(/\r?\n/)
          .map((line) => line.trim());
        ensure(
          lines.length === rows &&
            lines.every(
              (line) => line.length === columns && /^[01]+$/.test(line),
            ),
          "INVALID_INPUT",
          "Cell mask must match the row/column counts and contain only 1 or 0.",
        );
        mask = lines.flatMap((line) => [...line].map((cell) => cell === "1"));
      }
      const r: FillRequest = {
        ...(fillOptions.enabled
          ? {
              allowedRefs: fillOptions.allowedRefs,
              orientations: fillOptions.orientations,
              ...(mask ? { mask } : {}),
            }
          : { ref: part }),
        colorCode: color,
        columns,
        rows,
        origin: position,
        basis: placeBasis(workplane, angle),
        layerId: activeLayer,
        maxAdditions: resourceLimits(editor.resourceProfile)
          .additionsPerCommand,
      };
      setFill(null);
      setBusy(true);
      const fillWorker = new Worker(
        new URL("../workers/fill.worker.ts", import.meta.url),
        { type: "module" },
      );
      worker.current = fillWorker;
      fillWorker.onmessage = (e) => {
        if (worker.current !== fillWorker) return;
        worker.current = undefined;
        setBusy(false);
        if (e.data.error) setStatus(e.data.error.message ?? e.data.error);
        else {
          setFill(e.data.result);
          setStatus("Fill preview ready");
        }
        fillWorker.terminate();
      };
      fillWorker.onerror = () => {
        if (worker.current !== fillWorker) return;
        worker.current = undefined;
        setBusy(false);
        setStatus("Fill worker failed");
        fillWorker.terminate();
      };
      fillWorker.postMessage({ project: editor.project, request: r });
    });
  }
  async function capture() {
    await run(async () => {
      const epoch = ++operationEpoch.current;
      setBusy(true);
      try {
        const p = editor.project;
        const qualityProfile = renderer.current!.currentQuality();
        const {
          edges,
          shadows,
          shadowMapSize,
          pixelRatioCap,
          toneMapping,
          exposure,
        } = qualityProfile;
        const result = await api.current!.render.image({
          revision: p.revision,
          width: photoSize[0],
          height: photoSize[1],
          format: "png",
          visibility: { mode: "current" },
          background: transparent
            ? { type: "transparent" }
            : { type: "solid", color: "#f4f5f6" },
          quality: qualityProfile.name,
          qualityControls: {
            edges,
            shadows,
            shadowMapSize,
            pixelRatioCap,
            toneMapping,
            exposure,
          },
          strict: true,
        });
        ensure(
          epoch === operationEpoch.current,
          "CANCELLED",
          "Capture cancelled",
        );
        download(p.title + ".png", result.blob);
        download(
          p.title + ".render.json",
          strToU8(JSON.stringify(result.manifest, null, 2)),
          "application/json",
        );
        setStatus("PNG and render manifest downloaded");
      } finally {
        setBusy(false);
      }
    });
  }
  /** Start (or switch) the section cut along an axis, halfway through the model. */
  const startSection = (axis: SectionSpec["axis"]) => {
    const range = renderer.current?.modelRange(axis) ?? null;
    setSectionRange(range);
    if (!range) {
      setStatus("Add parts before cutting a section.");
      return;
    }
    const unit = axis === "y" ? 8 : 20;
    const mid = (range.min + range.max) / 2;
    // Vertical cuts hide the half facing the viewer, so the cut opens toward the camera.
    const eye = renderer.current?.currentCamera().position;
    const index = axis === "x" ? 0 : 2;
    setSection({
      axis,
      at:
        axis === "y"
          ? range.max - Math.round((range.max - mid) / unit) * unit
          : range.min + Math.round((mid - range.min) / unit) * unit,
      flip: axis !== "y" && !!eye && eye[index] < mid,
    });
    setStatus(
      axis === "y"
        ? "Section cut on: everything above the cut is hidden."
        : "Vertical section on: one side of the model is hidden.",
    );
  };
  // Exploded floors are a viewing aid; Play shares the renderer, so it is suspended there.
  useEffect(() => {
    const groups =
      renderer.current?.setExplode(mode === "Play" ? 0 : explodeBricks * 24) ??
      0;
    if (explodeBricks && mode !== "Play" && groups < 2) {
      setExplodeBricks(0);
      setStatus(
        "Nothing to explode: the model needs two or more submodels or layers.",
      );
    }
  }, [explodeBricks, mode]);
  // Measurements exist only while the Measure tool is in hand.
  useEffect(() => {
    if (tool !== "Measure" && measurePoints.length) setMeasurePoints([]);
  }, [tool]);
  useEffect(() => {
    renderer.current?.setMeasurement(
      mode === "Build" && tool === "Measure" ? measurePoints : [],
    );
  }, [measurePoints, tool, mode]);
  // Floor focus and floor/room overlays are viewing aids, suspended in Play like the cut.
  const floorIds = (project.architecture?.floors ?? []).map((f) => f.id).join();
  useEffect(() => {
    if (focusFloorId && !floorIds.split(",").includes(focusFloorId))
      setFocusFloorId(null);
  }, [floorIds, focusFloorId]);
  useEffect(() => {
    const r = renderer.current;
    if (!r) return;
    const focus =
      mode === "Play" || !focusFloorId
        ? null
        : { floorId: focusFloorId, ghostBelow };
    let current = true;
    try {
      r.setFloorFocus(focus);
    } catch {
      // The renderer may still hold the previous document: retry once it is drawn.
      void r
        .ready()
        .then(() => current && r.setFloorFocus(focus))
        .catch(() => {});
    }
    return () => {
      current = false;
    };
  }, [focusFloorId, ghostBelow, mode, floorIds]);
  useEffect(() => {
    renderer.current?.setAnnotations({
      floorGuides: mode !== "Play" && floorGuides,
      roomLabels: mode !== "Play" && roomLabels,
    });
  }, [floorGuides, roomLabels, mode]);
  useEffect(() => {
    if (mode !== "Build") setLabelDraft(null);
  }, [mode]);
  // The section cut is an editing aid; Play shares the renderer, so it is suspended there.
  useEffect(() => {
    renderer.current?.setSectionPlane(mode === "Play" ? null : section);
  }, [section, mode]);
  // On touch layouts the status toast shows briefly after each change.
  useEffect(() => {
    setStatusFresh(true);
    const timer = window.setTimeout(() => setStatusFresh(false), 4000);
    return () => window.clearTimeout(timer);
  }, [status]);
  // The HUD dims and lets pointers through while a finger or pointer drags the model.
  const appRoot = useRef<HTMLDivElement>(null);
  const canvasGesture = useRef<
    { x: number; y: number; timer?: number } | undefined
  >(undefined);
  const beginCanvasGesture = (e: ReactPointerEvent) => {
    window.clearTimeout(canvasGesture.current?.timer);
    canvasGesture.current = { x: e.clientX, y: e.clientY };
  };
  const moveCanvasGesture = (e: ReactPointerEvent) => {
    const g = canvasGesture.current;
    if (!g || g.timer !== undefined) return;
    if (Math.hypot(e.clientX - g.x, e.clientY - g.y) > 8)
      appRoot.current?.classList.add("hud-dim");
  };
  const endCanvasGesture = () => {
    const g = canvasGesture.current;
    if (!g) return;
    g.timer = window.setTimeout(() => {
      appRoot.current?.classList.remove("hud-dim");
      canvasGesture.current = undefined;
    }, 250);
  };
  const toolbar = (
    <>
      <div className="tool-segment">
        {["Select", "Place", "Paint", "Navigate", "Measure"].map((t, i) => (
          <button
            key={t}
            // Exploded positions are visual only: editing and measuring wait until assembled.
            disabled={explodeBricks > 0 && t !== "Navigate"}
            className={tool === t ? "active" : ""}
            onClick={() => {
              setTool(t);
              if (t === "Select")
                setTransformModeRequest({ mode: "off", nonce: Date.now() });
              if (t === "Place")
                setPosition(
                  (v) =>
                    placementOnPlane(v, workplane, currentPart.height, angle)
                      .position,
                );
            }}
            title={
              [
                `Select · ${shortcuts.select || "unassigned"}`,
                `Place · ${shortcuts.place || "unassigned"}`,
                `Paint · ${shortcuts.paint || "unassigned"}`,
                "Orbit and pan",
                "Measure between two points",
              ][i]
            }
          >
            <Icon
              name={
                (["select", "place", "paint", "navigate", "measure"] as const)[
                  i
                ]
              }
            />
            <span className="tool-label">{t}</span>
          </button>
        ))}
      </div>
      <div className="tool-segment">
        <button
          aria-label="Undo"
          disabled={!editor.canUndo}
          onClick={() => void run(() => command("history.undo"))}
        >
          <Icon name="undo" />
        </button>
        <button
          aria-label="Redo"
          disabled={!editor.canRedo}
          onClick={() => void run(() => command("history.redo"))}
        >
          <Icon name="redo" />
        </button>
      </div>
      <div className="tool-segment">
        <button onClick={() => renderer.current?.fit()}>
          <Icon name="view" />
          <span className="tool-label">Fit view</span>
        </button>
        <button
          className="views-toggle"
          aria-expanded={viewsOpen}
          onClick={() => setViewsOpen((v) => !v)}
        >
          <Icon name="canvas" />
          <span className="tool-label">Camera views</span>
        </button>
        <button
          onClick={() => {
            setFillOpen(true);
            setFill(null);
          }}
        >
          <Icon name="fill" />
          <span className="tool-label">Rectangular fill</span>
        </button>
      </div>
    </>
  );
  const catalogParts = Object.values(catalog);
  const visibleParts = searchCatalog(catalogParts, {
    query: search,
    category: partCategory,
    favouritesOnly: partCategory === undefined && favouritesOnly,
    favourites: new Set(favourites),
  });
  const choosePart = (id: string) => {
    const p = catalog[id];
    setPart(id);
    setPosition(
      (v) => placementOnPlane(v, workplane, p.height, angle).position,
    );
    setTool("Place");
  };
  const toggleFavourite = (id: string) =>
    setFavourites((current) => {
      const next = current.includes(id)
        ? current.filter((f) => f !== id)
        : [...current, id];
      if (!saveFavourites(next))
        setStatus(
          "Favourites apply for this session; they could not be saved.",
        );
      return next;
    });
  const related = relatedParts(catalogParts, currentPart);
  const partsPanel = (
    <>
      <div className="panel-title">
        <h2>Parts library</h2>
        <span
          className="count"
          aria-label={`${visibleParts.length} parts shown`}
        >
          {visibleParts.length}
        </span>
      </div>
      <label className="search">
        <Icon name="search" size={18} />
        <input
          placeholder="Search parts, sizes or numbers"
          aria-label="Search parts"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <kbd>/</kbd>
      </label>
      <div className="part-filters" role="group" aria-label="Filter parts">
        {[undefined, ...catalogCategories(catalogParts)].map((category) => (
          <button
            key={category ?? "all"}
            aria-pressed={partCategory === category && !favouritesOnly}
            onClick={() => {
              setPartCategory(category);
              setFavouritesOnly(false);
            }}
          >
            {category ?? "All"}
          </button>
        ))}
        <button
          aria-pressed={favouritesOnly}
          onClick={() => {
            setPartCategory(undefined);
            setFavouritesOnly((v) => !v);
          }}
        >
          <Icon name="star" size={14} filled /> Favourites
        </button>
      </div>
      {!search &&
        !favouritesOnly &&
        !partCategory &&
        recentParts.length > 0 && (
          <>
            <h3 className="parts-heading">Recently used</h3>
            <div className="part-chips">
              {recentParts.map((id) => (
                <button
                  key={id}
                  aria-pressed={part === id}
                  onClick={() => choosePart(id)}
                >
                  {catalog[id].name}
                </button>
              ))}
            </div>
          </>
        )}
      <h3 className="parts-heading">
        {favouritesOnly
          ? "Favourites"
          : partCategory
            ? partCategory
            : "Starter collection"}
        <span className="offline-tag">Offline</span>
      </h3>
      {visibleParts.length === 0 && (
        <div className="empty-parts" role="status">
          <p>
            {favouritesOnly && !favourites.length
              ? "No favourites yet. Use the star on a part to keep it here."
              : `No parts match${search ? ` “${search}”` : ""}.`}
          </p>
          <button
            onClick={() => {
              setSearch("");
              setPartCategory(undefined);
              setFavouritesOnly(false);
            }}
          >
            Show all parts
          </button>
        </div>
      )}
      <div className="part-grid">
        {visibleParts.map((p) => {
          const favourite = favourites.includes(p.id);
          return (
            <div key={p.id} className="part-card-wrap">
              <button
                id={"part-" + p.id}
                className={"part-card " + (part === p.id ? "chosen" : "")}
                aria-pressed={part === p.id}
                onClick={() => choosePart(p.id)}
              >
                <BrickIcon width={p.width / 20} depth={p.depth / 20} />
                <strong>{p.name}</strong>
                <small>{p.id.replace(".dat", "")}</small>
                {part === p.id && (
                  <span className="part-check">
                    <Icon name="check" size={16} />
                  </span>
                )}
              </button>
              <button
                className="part-favourite"
                aria-label={"Favourite " + p.name}
                aria-pressed={favourite}
                title={
                  favourite ? "Remove from favourites" : "Add to favourites"
                }
                onClick={() => toggleFavourite(p.id)}
              >
                <Icon name="star" size={20} filled={favourite} />
              </button>
            </div>
          );
        })}
      </div>
      {related.length > 0 &&
        visibleParts.length > 0 &&
        !search &&
        !partCategory &&
        !favouritesOnly && (
          <>
            <h3 className="parts-heading related-title">
              Related to {currentPart.name}
            </h3>
            <div className="part-chips">
              {related.map((r) => (
                <button key={r.id} onClick={() => choosePart(r.id)}>
                  {r.name}
                </button>
              ))}
            </div>
          </>
        )}
      <div className="panel-title color-title">
        <h2>Colour</h2>
        <span>{colors.find((c) => c.code === color)?.name}</span>
      </div>
      <div className="swatches" id="colour-swatches">
        {colors.map((c) => (
          <button
            key={c.code}
            aria-label={c.name}
            title={c.name}
            style={{ background: c.hex }}
            className={color === c.code ? "chosen" : ""}
            aria-pressed={color === c.code}
            onClick={() => setColor(c.code)}
          >
            {color === c.code && <Icon name="check" size={18} />}
          </button>
        ))}
      </div>
      <p className="muted">
        Red, blue, yellow, white and black combinations are audited. Other
        colours require inventory review.
      </p>
      <div className="library-note">
        <Icon name="info" size={18} />
        <div>
          <strong>Real LDraw geometry</strong>
          <p>
            6 audited parts · Grid placement
            <br />
            Connector snapping is unverified.
          </p>
        </div>
      </div>
    </>
  );
  const layersPanel = (
    <>
      <div className="panel-title">
        <h2>Layers</h2>
        <button
          aria-label="Add layer"
          onClick={() =>
            void run(() =>
              command("layers.add", {
                name: "Layer " + (Object.keys(project.layers).length + 1),
              }),
            )
          }
        >
          + Add
        </button>
      </div>
      <div className="layer-list">
        {Object.values(project.layers)
          .sort((a, b) => a.order - b.order)
          .map((l) => (
            <div
              key={l.id}
              className={"layer-row " + (l.id === activeLayer ? "active" : "")}
            >
              <button
                className="layer-name"
                onClick={() => setActiveLayer(l.id)}
              >
                <span className="layer-dot" />
                {l.name}
                <small>{all.filter((o) => o.layerId === l.id).length}</small>
              </button>
              <button
                aria-label={(l.visible ? "Hide " : "Show ") + l.name}
                onClick={() =>
                  void run(() =>
                    command("layers.update", {
                      layerId: l.id,
                      visible: !l.visible,
                    }),
                  )
                }
              >
                <Icon name={l.visible ? "eye" : "eyeOff"} size={18} />
              </button>
              <button
                aria-label={(l.locked ? "Unlock " : "Lock ") + l.name}
                onClick={() =>
                  void run(() =>
                    command("layers.update", {
                      layerId: l.id,
                      locked: !l.locked,
                    }),
                  )
                }
              >
                <Icon name={l.locked ? "lock" : "unlock"} size={18} />
              </button>
            </div>
          ))}
      </div>
      <label className="check">
        <input
          type="checkbox"
          checked={crossLayer}
          onChange={(e) => setCrossLayer(e.target.checked)}
        />{" "}
        Edit across layers
      </label>
      {selection.length > 0 && (
        <button
          className="wide"
          onClick={() =>
            void run(() =>
              command("layers.assign", { ...scoped(), layerId: activeLayer }),
            )
          }
        >
          Move selection to active layer
        </button>
      )}
      <label className="number-field">
        <span>Active layer name</span>
        <input
          key={activeLayer + project.layers[activeLayer]?.name}
          aria-label="Active layer name"
          defaultValue={project.layers[activeLayer]?.name}
          onBlur={(e) => {
            if (e.target.value !== project.layers[activeLayer]?.name)
              void run(() =>
                command("layers.rename", {
                  layerId: activeLayer,
                  name: e.target.value,
                }),
              );
          }}
        />
      </label>
      <div className="button-row">
        <button
          onClick={() =>
            void run(() => {
              const p = editor.project;
              editor.transaction({
                commandId: uid(),
                expectedRevision: p.revision,
                commands: Object.values(p.layers).map((l) => ({
                  schemaVersion: 1,
                  commandId: uid(),
                  expectedRevision: p.revision,
                  type: "layers.update",
                  payload: { layerId: l.id, visible: l.id === activeLayer },
                })),
              });
            })
          }
        >
          Solo active
        </button>
        <button
          onClick={() =>
            void run(() => {
              const p = editor.project;
              editor.transaction({
                commandId: uid(),
                expectedRevision: p.revision,
                commands: Object.values(p.layers).map((l) => ({
                  schemaVersion: 1,
                  commandId: uid(),
                  expectedRevision: p.revision,
                  type: "layers.update",
                  payload: { layerId: l.id, visible: true },
                })),
              });
            })
          }
        >
          Show all
        </button>
      </div>
      <p className="muted">
        Locked layers cannot be edited. Hidden layers still count in whole-build
        exports.
      </p>
    </>
  );
  const inspectorPanel = (
    <>
      <div className="panel-title">
        <h2>Inspector</h2>
        <span>{selection.length} selected</span>
      </div>
      {selected.length ? (
        <>
          <div className="selection-summary">
            <BrickIcon
              color={
                inspection.color.mixed
                  ? undefined
                  : colorHex(inspection.color.value.code)
              }
            />
            <strong>
              {inspection.part.mixed
                ? `${selected.length} mixed parts`
                : selected.length === 1
                  ? inspection.part.value.name
                  : `${selected.length} × ${inspection.part.value.name}`}
            </strong>
            <small>
              {inspection.part.mixed
                ? `${new Set(selected.map((o) => o.node.ref)).size} part types`
                : inspection.part.value.ref}
            </small>
          </div>
          <dl className="inspector-properties">
            <dt>Source</dt>
            <dd>
              {inspection.source.mixed
                ? "Mixed"
                : sourceLabels[inspection.source.value]}
            </dd>
            <dt>Colour</dt>
            <dd>
              {inspection.color.mixed
                ? "Mixed"
                : `${inspection.color.value.name} (${inspection.color.value.code})`}
            </dd>
            <dt>Layer</dt>
            <dd>
              {inspection.layer.mixed ? "Mixed" : inspection.layer.value.name}
            </dd>
            <dt>Submodel</dt>
            <dd>
              {inspection.parent.mixed
                ? "Mixed"
                : inspection.parent.value.root
                  ? "Main model"
                  : inspection.parent.value.name}
            </dd>
            <dt>Orientation</dt>
            <dd>
              {inspection.orientation.mixed
                ? "Mixed"
                : inspection.orientation.value}
            </dd>
            <dt>{selected.length === 1 ? "Size" : "Selection size"}</dt>
            <dd>
              {inspection.dimensions ? inspection.dimensions.label : "Unknown"}
              {inspection.dimensions && (
                <small className="muted size-ldu">
                  {inspection.dimensions.ldu.join(" × ")} LDU incl. studs
                </small>
              )}
            </dd>
            <dt>Checks</dt>
            <dd>
              {inspection.issues.length
                ? inspection.issues.join("; ")
                : "No problems found"}
            </dd>
          </dl>
          <h3>
            Position <small>LDU · 20 = 1 stud, 8 = 1 plate</small>
          </h3>
          <div className="numeric-row">
            {["X", "Y", "Z"].map((axis, i) => (
              <NumberInput
                key={axis}
                label={"Position " + axis}
                value={
                  inspection.position[i].mixed
                    ? undefined
                    : inspection.position[i].value
                }
                step={i === 1 ? 8 : 20}
                onChange={(n) => void run(() => setAxis(i, n))}
              />
            ))}
          </div>
          {inspection.matrix && (
            <details className="affine-matrix">
              <summary>Advanced: placement matrix</summary>
              <p className="muted">
                Rotation/scale matrix (rows) and position, exactly as saved in
                the LDraw file.
              </p>
              <table>
                <thead>
                  <tr>
                    <th scope="colgroup" colSpan={3}>
                      Rotation / scale
                    </th>
                    <th scope="col">Position</th>
                  </tr>
                </thead>
                <tbody>
                  {[0, 1, 2].map((row) => (
                    <tr key={row}>
                      {[0, 1, 2].map((c) => (
                        <td key={c}>{inspection.matrix!.basis[row * 3 + c]}</td>
                      ))}
                      <td>{inspection.matrix!.position[row]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
          )}
          <div className="button-row">
            <button
              onClick={() =>
                void run(() =>
                  command("parts.transform", {
                    ...scoped(),
                    delta: [0, -8, 0],
                    space: "ldraw",
                  }),
                )
              }
            >
              <Icon name="arrowUp" size={16} /> 1 plate
            </button>
            <button
              onClick={() =>
                void run(() =>
                  command("parts.transform", {
                    ...scoped(),
                    delta: [0, 8, 0],
                    space: "ldraw",
                  }),
                )
              }
            >
              <Icon name="arrowDown" size={16} /> 1 plate
            </button>
          </div>
          <button
            className="wide"
            onClick={() =>
              void run(() => {
                ensure(
                  selected.length === 1,
                  "INVALID_INPUT",
                  "Select one part to rotate",
                );
                command("parts.transform", {
                  ...scoped(),
                  space: "ldraw",
                  transform: {
                    position: selected[0].transform.position,
                    basis: compose(
                      { position: [0, 0, 0], basis: rotationY(90) },
                      {
                        position: [0, 0, 0],
                        basis: selected[0].transform.basis,
                      },
                    ).basis,
                  },
                });
              })
            }
          >
            Rotate 90°
          </button>
          <button
            className="wide"
            onClick={() =>
              void run(() =>
                command("parts.recolor", {
                  ...scoped(),
                  colorCode: color,
                  preserveFixedColors: true,
                }),
              )
            }
          >
            Apply current colour
          </button>
          <ReplacePanel
            project={project}
            all={all}
            selected={selected}
            activeLayerId={activeLayer}
            crossLayer={crossLayer}
            onReplace={(payloads) =>
              run(() => {
                const p = editor.project;
                const commands = payloads.map((payload) => ({
                  schemaVersion: 1 as const,
                  commandId: uid(),
                  expectedRevision: p.revision,
                  type: "parts.replace",
                  payload: {
                    ...payload,
                    includeHidden: false,
                    ...(!crossLayer ? { activeLayerId: activeLayer } : {}),
                  },
                }));
                const result =
                  commands.length === 1
                    ? command(commands[0].type, commands[0].payload)
                    : editor.transaction({
                        commandId: uid(),
                        expectedRevision: p.revision,
                        commands,
                      });
                // Replaced parts inside shared submodels may get new IDs.
                const remapped = (
                  result as { idRemappings?: Record<string, string> }
                ).idRemappings;
                if (remapped)
                  setSelection((ids) => ids.map((id) => remapped[id] ?? id));
                const n = payloads.reduce(
                  (sum, x) => sum + x.occurrenceIds.length,
                  0,
                );
                setStatus(
                  `Replaced ${n} part${n === 1 ? "" : "s"} with ${catalog[payloads[0].ref]?.name ?? payloads[0].ref}. Undo restores ${n === 1 ? "it" : "them"}.`,
                );
                return true;
              })
            }
          />
          <div className="button-row">
            <button
              onClick={() =>
                void run(() => command("parts.duplicate", scoped()))
              }
            >
              Duplicate
            </button>
            <button
              className="danger"
              onClick={() => void run(() => command("parts.remove", scoped()))}
            >
              Delete
            </button>
          </div>
          <p className="muted">
            {selected.length > 1
              ? "A position value applies to every selected part. "
              : ""}
            Shared submodels become unique when edited.
          </p>
        </>
      ) : (
        <div className="empty-inspector">
          <span>↖</span>
          <h3>Select a part</h3>
          <p>Inspect dimensions, move, rotate or recolour your build.</p>
        </div>
      )}
      <SelectionTools
        shape={selectionShape}
        operation={selectionOperation}
        depth={selectionDepth}
        onShape={(v) => {
          setSelectionShape(v);
          setTool("Select");
        }}
        onOperation={setSelectionOperation}
        onDepth={setSelectionDepth}
        hasSelection={selected.length > 0}
        onClear={() => setSelectionSafe([])}
        onMatch={(kind) => {
          const matches = all.filter(
            (o) =>
              kind === "all" ||
              selected.some((chosen) =>
                kind === "part"
                  ? chosen.node.ref === o.node.ref &&
                    chosen.namespace === o.namespace
                  : kind === "color"
                    ? chosen.colorCode === o.colorCode
                    : chosen.layerId === o.layerId,
              ),
          );
          receiveSelection(matches.map((o) => o.id));
        }}
      />
    </>
  );
  return (
    <div
      ref={appRoot}
      className={
        "app mode-" +
        mode.toLowerCase() +
        (panel !== "Canvas" ? " sheet-open" : "") +
        (sheetFull ? " sheet-full" : "")
      }
    >
      <div className="hud-top hud-el">
        <nav
          className={"mode-tabs hud-slab" + (modesOpen ? " open" : "")}
          aria-label="Editor mode"
        >
          {(["Build", "Instructions", "Photo", "Play", "Project"] as const).map(
            (m) => (
              <button
                key={m}
                aria-label={m}
                title={m}
                aria-pressed={mode === m}
                className={mode === m ? "active" : ""}
                onClick={() => {
                  // On phones the current mode is a chip that opens the switcher.
                  if (m === mode) {
                    setModesOpen((open) => !open);
                    return;
                  }
                  setModesOpen(false);
                  setMode(m);
                  if (m !== "Build") setPanel("Canvas");
                  if (m === "Photo")
                    setCamera(renderer.current?.currentCamera() || camera);
                }}
              >
                <Icon name={m.toLowerCase() as IconName} />
                <span className="mode-label">{m}</span>
                {mode === m && (
                  <span className="mode-chevron">
                    <Icon name="collapse" size={16} />
                  </span>
                )}
              </button>
            ),
          )}
        </nav>
        <div className="project-bar hud-slab">
          <span className="brand" aria-hidden="true">
            brick<b>editor</b>
          </span>
          <i className="save-dot" aria-hidden="true" />
          <input
            aria-label="Project title"
            value={project.title}
            onChange={(e) =>
              void run(() =>
                command("project.rename", { title: e.target.value }),
              )
            }
          />
          <span className="save-state">{saveStatus}</span>
        </div>
        <div className="header-actions">
          <button
            className="hud-slab"
            onClick={() => void exportFile("native")}
          >
            <Icon name="save" />
            <span className="tool-label">Save project</span>
            <span className="save-chip" aria-hidden="true">
              {saveStatus.startsWith("Saved")
                ? "Saved"
                : /…|ing/.test(saveStatus)
                  ? "Saving"
                  : "Save"}
            </span>
          </button>
          <button className="primary" onClick={() => setInventoryOpen(true)}>
            <Icon name="export" />
            <span className="tool-label">Export</span>
          </button>
        </div>
      </div>
      {saveCoordinationUnavailable && (
        <div className="save-conflict" role="alert">
          <span>
            Automatic saving is unavailable because this browser cannot safely
            coordinate tabs. Your edits remain in memory. Download a native
            backup before closing.
          </span>
          <button onClick={() => void exportFile("native")}>
            Download my backup
          </button>
          <button
            onClick={() => {
              autosave.current?.schedule(editor.project);
              setSaveStatus("Retrying automatic save…");
            }}
          >
            Retry automatic save
          </button>
        </div>
      )}
      {saveConflict && (
        <div className="save-conflict" role="alert">
          <span>
            Another tab saved this project. Your edits are still here; saving is
            blocked until you make a separate copy.
          </span>
          <button onClick={() => void exportFile("native")}>
            Download my backup
          </button>
          <button
            onClick={() =>
              void run(async () => {
                await autosave.current?.flush();
                const baseRevision = editor.revision,
                  projectId = editor.projectId;
                const backup = await api.current!.project.export({
                  format: "native",
                });
                download(backup.name, backup.bytes, backup.mimeType);
                const saved = await new BrowserProjects(localStorage).load(
                  projectId,
                );
                ensure(
                  editor.projectId === projectId &&
                    editor.revision === baseRevision,
                  "REVISION_CONFLICT",
                  "Your draft changed while reloading; it has been kept in memory.",
                );
                ensure(
                  saved,
                  "INVALID_INPUT",
                  "The saved copy is no longer available. Keep the backup or fork your draft.",
                );
                saveRevisions.current.set(saved.id, saved.revision);
                loaded.current = false;
                try {
                  editor.replace(saved);
                } finally {
                  loaded.current = true;
                }
                setSaveConflict(false);
                setSaveStatus("Recovered saved revision " + saved.revision);
                setStatus(
                  "Downloaded your draft backup and reloaded the saved project.",
                );
              })
            }
          >
            Back up and reload saved
          </button>
          <button
            onClick={() => {
              const copy = editor.project;
              copy.id = uid();
              copy.title += " (copy)";
              editor.replace(copy);
              setSaveConflict(false);
              setStatus("Created a separate project for your edits.");
            }}
          >
            Fork my edits
          </button>
        </div>
      )}
      <main className="workspace">
        <aside
          className={
            "left-sidebar mobile-panel " +
            (panel === "Parts" ? "mobile-open" : "")
          }
        >
          <div className="mobile-sheet-head">
            <button
              className="sheet-handle"
              aria-label={sheetFull ? "Collapse panel" : "Expand panel"}
              onClick={() => setSheetFull((v) => !v)}
            />
            <strong>
              Parts
              <small className="selected-colour">
                {colors.find((c) => c.code === color)?.name}
              </small>
            </strong>
            <button
              className="primary"
              onClick={() => {
                setTool("Place");
                setPanel("Canvas");
              }}
            >
              Place selected part <Icon name="arrowRight" size={16} />
            </button>
            <button onClick={() => setPanel("Canvas")}>Close</button>
          </div>
          {partsPanel}
        </aside>
        <section className="canvas-shell">
          <div className="canvas-toolbar">{toolbar}</div>
          <div
            className="viewport"
            ref={viewport}
            onPointerDown={beginCanvasGesture}
            onPointerMove={moveCanvasGesture}
            onPointerUp={endCanvasGesture}
            onPointerCancel={endCanvasGesture}
          />
          <div className={"view-controls hud-el" + (viewsOpen ? " open" : "")}>
            {["Top", "Front", "Side"].map((v) => (
              <button
                key={v}
                onClick={() => {
                  if (v === "Fit") {
                    renderer.current?.fit();
                    return;
                  }
                  renderer.current?.setCamera({
                    ...camera,
                    projection: "orthographic",
                    position:
                      v === "Top"
                        ? [0, -1000, 0]
                        : v === "Front"
                          ? [0, -150, 1000]
                          : [1000, -150, 0],
                    target: [0, -50, 0],
                    up: v === "Top" ? [0, 0, -1] : [0, -1, 0],
                    span: 700,
                  });
                }}
              >
                {v}
              </button>
            ))}
            <div className="section-control explode-control">
              <button
                aria-pressed={explodeBricks > 0}
                onClick={() => {
                  if (explodeBricks) {
                    setExplodeBricks(0);
                    setStatus("Floors assembled. Editing tools are back.");
                    return;
                  }
                  setTool("Navigate");
                  setExplodeBricks(4);
                  setStatus(
                    "Exploded view: floors are lifted apart for viewing; editing is paused until you assemble.",
                  );
                }}
              >
                {explodeBricks ? "Assemble floors" : "Explode floors"}
              </button>
              {explodeBricks > 0 && (
                <label>
                  <span className="section-label">
                    {explodeBricks} brick{explodeBricks === 1 ? "" : "s"} apart
                  </span>
                  <input
                    type="range"
                    aria-label="Explode spread"
                    min={1}
                    max={20}
                    step={1}
                    value={explodeBricks}
                    onChange={(e) => setExplodeBricks(Number(e.target.value))}
                  />
                </label>
              )}
            </div>
            <div className="section-control">
              <button
                aria-pressed={section !== null}
                onClick={() => {
                  if (section !== null) {
                    setSection(null);
                    setStatus("Section cut off.");
                    return;
                  }
                  startSection("y");
                }}
              >
                Section cut
              </button>
              {section !== null && sectionRange && (
                <>
                  <div
                    className="section-axes"
                    role="group"
                    aria-label="Cut direction"
                  >
                    {(
                      [
                        ["y", "Height"],
                        ["z", "Front–back"],
                        ["x", "Left–right"],
                      ] as const
                    ).map(([axis, label]) => (
                      <button
                        key={axis}
                        aria-pressed={section.axis === axis}
                        onClick={() => startSection(axis)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <label>
                    <span className="section-label">
                      {section.axis === "y"
                        ? `Cut ${Math.round((sectionRange.max - section.at) / 8)} plates up`
                        : `Cut ${Math.round((section.at - sectionRange.min) / 20)} studs in`}
                    </span>
                    <input
                      type="range"
                      aria-label="Section height"
                      min={0}
                      max={Math.max(
                        1,
                        Math.ceil(
                          (sectionRange.max - sectionRange.min) /
                            (section.axis === "y" ? 8 : 20),
                        ),
                      )}
                      step={1}
                      value={
                        section.axis === "y"
                          ? Math.round((sectionRange.max - section.at) / 8)
                          : Math.round((section.at - sectionRange.min) / 20)
                      }
                      onChange={(e) => {
                        const n = Number(e.target.value);
                        setSection({
                          ...section,
                          at:
                            section.axis === "y"
                              ? sectionRange.max - n * 8
                              : sectionRange.min + n * 20,
                        });
                      }}
                    />
                  </label>
                  <button
                    aria-pressed={!!section.flip}
                    onClick={() =>
                      setSection({ ...section, flip: !section.flip })
                    }
                  >
                    Show other side
                  </button>
                </>
              )}
            </div>
            {mode !== "Play" && (
              <FloorControls
                project={project}
                command={command}
                run={run}
                open={floorsOpen}
                setOpen={setFloorsOpen}
                focusFloorId={focusFloorId}
                setFocusFloorId={setFocusFloorId}
                ghostBelow={ghostBelow}
                setGhostBelow={setGhostBelow}
                guides={floorGuides}
                setGuides={setFloorGuides}
                labels={roomLabels}
                setLabels={setRoomLabels}
                sectionHeight={
                  section?.axis === "y" && !section.flip ? section.at : null
                }
                exploded={explodeBricks > 0}
                modelBottom={() =>
                  renderer.current?.modelHeightRange()?.bottom ?? null
                }
                onPlaceLabel={(text) => {
                  if (mode !== "Build") {
                    setStatus("Switch to Build to place a room label.");
                    return;
                  }
                  setLabelDraft(text);
                  setViewsOpen(false);
                  setStatus(`Tap the model where “${text}” goes.`);
                }}
                onStatus={setStatus}
              />
            )}
          </div>
          {labelDraft !== null && mode === "Build" && (
            <div className="face-pick-card label-pick-card" role="status">
              <span>Tap the model where “{labelDraft}” goes.</span>
              <button onClick={() => setLabelDraft(null)}>Cancel label</button>
            </div>
          )}
          {pickingFace && mode === "Build" && (
            <div className="face-pick-card">
              <span>Tap a model face to align the workplane.</span>
              <button onClick={() => setPickingFace(false)}>
                Cancel face picking
              </button>
            </div>
          )}
          {all.length === 0 && mode === "Build" && tool !== "Place" && (
            <div className="welcome">
              <h1>
                Make something
                <br />
                piece by piece.
              </h1>
              <p>
                Choose a part, tap the grid, and place it.
                <br />
                Your build stays on this device.
              </p>
              <button
                className="primary"
                onClick={() => void useTemplate("room")}
              >
                Explore the studio template <Icon name="arrowRight" size={16} />
              </button>
              <button
                className="text-button"
                onClick={() => {
                  setTool("Place");
                  setPanel("Parts");
                }}
              >
                Or start with a single brick
              </button>
            </div>
          )}
          {tool === "Place" && mode === "Build" && (
            <div className="placement-card">
              <div>
                <strong>
                  {currentPart.name} ·{" "}
                  {colors.find((c) => c.code === color)?.name}
                </strong>
                <span>
                  Tap the ground, or a part to stack on or beside ·{" "}
                  {workplane.free
                    ? "free placement"
                    : `${workplane.grid} LDU grid`}
                </span>
              </div>
              <div className="placement-values">
                {["X", "Y", "Z"].map((axis, i) => (
                  <NumberInput
                    key={axis}
                    label={"Place " + axis}
                    value={position[i]}
                    step={i === 1 ? 8 : 20}
                    onChange={(n) =>
                      setPosition(
                        (v) => v.map((x, j) => (j === i ? n : x)) as Vec3,
                      )
                    }
                  />
                ))}
              </div>
              <button
                aria-label="Rotate placement"
                onClick={() =>
                  setAngle((a) => (a + workplane.rotationIncrement) % 360)
                }
              >
                ↻ {angle}°
              </button>
              <button
                className="primary"
                onClick={() =>
                  void run(() => {
                    command("parts.add", {
                      layerId: activeLayer,
                      parts: [
                        {
                          ref: part,
                          colorCode: color,
                          transform: {
                            position,
                            basis: placeBasis(workplane, angle),
                          },
                        },
                      ],
                    });
                    setStatus("Placed " + currentPart.name);
                    // Recently used means placed, not merely browsed.
                    setRecentParts((recent) => pushRecent(recent, part));
                  })
                }
              >
                Place part
              </button>
              <button onClick={() => setTool("Select")}>Cancel</button>
            </div>
          )}
          {mode === "Photo" && (
            <div className="mode-card">
              <h2>A different perspective.</h2>
              <p>
                Position the camera freely, or enter an exact interior view.
                Exports contain only the build.
              </p>
              <div className="numeric-row">
                {["X", "Y", "Z"].map((axis, i) => (
                  <NumberInput
                    key={axis}
                    label={"Camera " + axis}
                    value={camera.position[i]}
                    onChange={(n) =>
                      setCamera((c) => ({
                        ...c,
                        position: c.position.map((x, j) =>
                          i === j ? n : x,
                        ) as Vec3,
                      }))
                    }
                  />
                ))}
              </div>
              <div className="numeric-row">
                {["X", "Y", "Z"].map((axis, i) => (
                  <NumberInput
                    key={axis}
                    label={"Target " + axis}
                    value={camera.target[i]}
                    onChange={(n) =>
                      setCamera((c) => ({
                        ...c,
                        target: c.target.map((x, j) =>
                          i === j ? n : x,
                        ) as Vec3,
                      }))
                    }
                  />
                ))}
              </div>
              <div className="button-row">
                <button
                  onClick={() =>
                    void run(() => renderer.current?.setCamera(camera))
                  }
                >
                  Apply exact camera
                </button>
                <button
                  onClick={() =>
                    setCamera(renderer.current?.currentCamera() || camera)
                  }
                >
                  Read current view
                </button>
              </div>
              <form
                className="bookmark-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  void run(() => {
                    command("camera.bookmark", {
                      name:
                        bookmarkName.trim() ||
                        "View " +
                          (Object.keys(project.cameraBookmarks).length + 1),
                      camera: renderer.current?.currentCamera() || camera,
                      // "Hide the roof in this camera": keep the floor focus with it.
                      ...(focusFloorId
                        ? {
                            floorFocus: bookmarkFloor
                              ? { floorId: focusFloorId, ghostBelow }
                              : null,
                          }
                        : {}),
                    });
                    setBookmarkName("");
                  });
                }}
              >
                <label>
                  Bookmark name
                  <input
                    value={bookmarkName}
                    placeholder="e.g. exterior/front"
                    maxLength={120}
                    onChange={(e) => setBookmarkName(e.target.value)}
                  />
                </label>
                {focusFloorId && (
                  <label className="check-row">
                    <input
                      type="checkbox"
                      checked={bookmarkFloor}
                      onChange={(e) => setBookmarkFloor(e.target.checked)}
                    />
                    Save floor focus (
                    {architectureOf(project).floors.find(
                      (f) => f.id === focusFloorId,
                    )?.name ?? "floor"}
                    ) with this bookmark
                  </label>
                )}
                <button className="wide">Save current camera bookmark</button>
              </form>
              {Object.entries(project.cameraBookmarks).map(([name, spec]) => {
                const view = architectureOf(project).views[name];
                return (
                  <button
                    key={name}
                    onClick={() =>
                      void run(() => {
                        renderer.current?.setCamera(spec);
                        setCamera(spec);
                        // A bookmark with a saved floor view restores it.
                        if (view) {
                          setFocusFloorId(view.floorId);
                          setGhostBelow(view.ghostBelow);
                        }
                      })
                    }
                  >
                    {name}
                    {view &&
                      " · " +
                        (architectureOf(project).floors.find(
                          (f) => f.id === view.floorId,
                        )?.name ?? "")}
                  </button>
                );
              })}
              <CameraCollections
                api={api.current!}
                bookmarks={Object.keys(project.cameraBookmarks)}
                size={photoSize}
                transparent={transparent}
                download={download}
                onStatus={setStatus}
              />
              <div className="numeric-row">
                <NumberInput
                  label="Width"
                  value={photoSize[0]}
                  onChange={(n) => setPhotoSize([n, photoSize[1]])}
                />
                <NumberInput
                  label="Height"
                  value={photoSize[1]}
                  onChange={(n) => setPhotoSize([photoSize[0], n])}
                />
              </div>
              <label className="check">
                <input
                  type="checkbox"
                  checked={transparent}
                  onChange={(e) => setTransparent(e.target.checked)}
                />
                Transparent background
              </label>
              <button
                className="primary wide"
                disabled={busy}
                onClick={() => void capture()}
              >
                Download PNG + manifest <Icon name="arrowDown" size={16} />
              </button>
              <QualityPanel renderer={renderer.current} />
            </div>
          )}
          {mode === "Instructions" && (
            <div className="mode-card">
              <h2>One step at a time.</h2>
              <p>
                Create an organisational sequence from your layers. This is not
                a physically validated assembly plan.
              </p>
              <button
                className="wide"
                onClick={() =>
                  void run(() => {
                    const result = command("instructions.layers", {
                      name: "Layer sequence",
                      maxPerStep: 10,
                    });
                    setActivePlanId(result.addedPlanIds[0]);
                    setStep(0);
                  })
                }
              >
                Generate layer steps
              </button>
              <InstructionEditor
                canUndo={editor.canUndo}
                canRedo={editor.canRedo}
                project={project}
                planId={currentPlanId}
                onPlanChange={setActivePlanId}
                step={step}
                onStepChange={setStep}
                selection={selection}
                dispatch={(type, payload) => command(type, payload)}
                currentCamera={() => renderer.current?.currentCamera()}
                applyCamera={(camera) => {
                  void run(() => renderer.current?.setCamera(camera));
                }}
              />
              {plan && (
                <>
                  <h3>{plan.name}</h3>
                  <p>
                    Step {plan.steps.length ? step + 1 : 0} of{" "}
                    {plan.steps.length} · {plan.steps[step]?.length || 0} new
                    parts
                  </p>
                  <input
                    aria-label="Instruction step"
                    disabled={!plan.steps.length}
                    type="range"
                    min="0"
                    max={Math.max(0, plan.steps.length - 1)}
                    value={step}
                    onChange={(e) => setStep(Number(e.target.value))}
                  />
                  <button
                    className="wide"
                    onClick={() =>
                      download(
                        "instructions.json",
                        strToU8(JSON.stringify(plan, null, 2)),
                        "application/json",
                      )
                    }
                  >
                    Download plan JSON
                  </button>
                  <InstructionsPublish
                    dimPrevious={dimPrevious}
                    onDimPreviousChange={setDimPrevious}
                    project={project}
                    planId={currentPlanId}
                    renderer={renderer.current}
                  />
                </>
              )}
            </div>
          )}
          {mode === "Play" && play.current && (
            <PlayPanel
              play={play.current}
              layers={project.layers}
              rigs={project.motionRigs}
              exit={() => setMode("Build")}
              bookmark={() => {
                const view = play.current!.camera();
                command("camera.bookmark", {
                  name: "Exploration view",
                  camera: view,
                });
                setCamera(view);
                setStatus("Exploration view saved in Photo bookmarks.");
              }}
            >
              {mechanisms.current && (
                <MechanismPanel
                  mechanisms={mechanisms.current}
                  rigs={project.motionRigs}
                />
              )}
            </PlayPanel>
          )}
          {mode === "Project" && (
            <div className="mode-card">
              <h2>Keep the things you make.</h2>
              <p>
                Download a native backup to preserve your project. Browser
                storage can be cleared.
              </p>
              <div className="button-row">
                <button onClick={() => fileInput.current?.click()}>
                  Open file <Icon name="arrowUp" size={16} />
                </button>
                <button onClick={() => void exportFile("native")}>
                  Native backup <Icon name="arrowDown" size={16} />
                </button>
              </div>
              <button className="wide" onClick={() => void exportFile("ldraw")}>
                Export LDraw MPD <Icon name="arrowDown" size={16} />
              </button>
              <ExportProfiles project={project} selection={selection} />
              <SharePanel
                project={project}
                open={async (shared) => {
                  if (occurrences(editor.project).length)
                    await exportFile("native");
                  editor.replace(shared);
                  await renderer.current?.ready();
                  renderer.current?.fit();
                  setPanel("Canvas");
                  setMode("Build");
                }}
              />
              <ProjectLibrary
                currentId={project.id}
                open={async (saved) => {
                  if (occurrences(editor.project).length)
                    await exportFile("native");
                  await autosave.current?.flush();
                  saveRevisions.current.set(saved.id, saved.revision);
                  editor.replace(saved);
                  setSaveConflict(false);
                  setMode("Build");
                  setPanel("Canvas");
                  await renderer.current?.ready();
                  renderer.current?.fit();
                }}
              />
              <CheckpointsPanel
                api={api.current!}
                projectId={project.id}
                revision={project.revision}
                download={download}
                backupCurrent={() => exportFile("native")}
                showChanges={(ids) => {
                  setMode("Build");
                  setPanel("Canvas");
                  setSelectionSafe(ids);
                  setStatus(
                    `${ids.length} changed part${ids.length === 1 ? "" : "s"} selected.`,
                  );
                }}
                onStatus={setStatus}
              />
              <HealthPanel
                api={api.current!}
                revision={project.revision}
                select={(ids) => {
                  setMode("Build");
                  setPanel("Canvas");
                  setSelectionSafe(ids);
                  setStatus(
                    `${ids.length} part${ids.length === 1 ? "" : "s"} selected from the health check.`,
                  );
                }}
              />
              <OfflinePanel />
              <ResourceProfilePanel editor={editor} onStatus={setStatus} />
              <h3>Start from an original template</h3>
              <p className="muted">
                Your current build is downloaded before a template replaces it.
              </p>
              <div className="template-grid">
                {(
                  [
                    "blank",
                    "room",
                    "wall",
                    "200",
                    "explore",
                    "mechanisms",
                    "seated-vehicle",
                  ] as const
                ).map((t) => (
                  <button key={t} onClick={() => void useTemplate(t)}>
                    {t === "seated-vehicle"
                      ? "Open-bench vehicle"
                      : t === "mechanisms"
                        ? "Door & vehicle"
                        : t === "explore"
                          ? "Exploration room"
                          : t === "blank"
                            ? "Blank canvas"
                            : t === "room"
                              ? "Courtyard studio"
                              : t === "wall"
                                ? "Simple wall"
                                : "200-part build"}
                  </button>
                ))}
              </div>
              <ShortcutSettings
                value={shortcuts}
                onChange={(value) => {
                  setShortcuts(value);
                  setStatus(
                    saveShortcuts(value)
                      ? "Keyboard shortcuts saved on this device."
                      : "Keyboard shortcuts applied for this session; browser preferences could not be saved.",
                  );
                }}
              />
              <details>
                <summary>Supported features and source notices</summary>
                <p>
                  Six pinned LDraw parts, local files, clipboard and arrays,
                  layers, inventory, image and instruction publishing, Play
                  exploration and kinematic mechanisms. Texture projection,
                  connector snapping, dynamic suspension and advanced assembly
                  planning remain unavailable.
                </p>
                <a
                  href={import.meta.env.BASE_URL + "notices/LDRAW.txt"}
                  target="_blank"
                  rel="noreferrer"
                >
                  LDraw attribution and licences{" "}
                  <Icon name="external" size={14} />
                </a>
              </details>
            </div>
          )}
          {mode === "Build" && tool === "Measure" && (
            <div className="measure-chip hud-el hud-slab" role="status">
              {measurePoints.length === 2
                ? measure(measurePoints[0], measurePoints[1]).label
                : measurePoints.length === 1
                  ? "Tap a second point"
                  : "Tap two points on the model to measure"}
            </div>
          )}
          <div className="canvas-bottom hud-el hud-slab">
            <span>
              {all.length.toLocaleString()} parts <b>·</b> {selection.length}{" "}
              selected
            </span>
            <span className="grid-state">
              {tool === "Select" && selectionShape !== "click"
                ? `${selectionShape === "box" ? "Box" : "Lasso"} · ${selectionDepth === "visible" ? "Visible surfaces" : "Through"}`
                : workplane.free
                  ? "Free placement"
                  : `Grid · ${workplane.grid} LDU`}
            </span>
          </div>
        </section>
        <aside
          className={
            "right-sidebar mobile-panel " +
            (["Layers", "Inspector"].includes(panel) ? "mobile-open" : "")
          }
        >
          <div className="mobile-sheet-head">
            <button
              className="sheet-handle"
              aria-label={sheetFull ? "Collapse panel" : "Expand panel"}
              onClick={() => setSheetFull((v) => !v)}
            />
            <strong>{panel}</strong>
            <button onClick={() => setPanel("Canvas")}>Close</button>
          </div>
          <div className="right-tabs">
            <button
              className={panel !== "Inspector" ? "active" : ""}
              onClick={() => setPanel("Layers")}
            >
              Layers
            </button>
            <button
              className={panel === "Inspector" ? "active" : ""}
              onClick={() => setPanel("Inspector")}
            >
              Inspector
            </button>
          </div>
          {panel === "Inspector" ? (
            <>
              {inspectorPanel}
              <ModelTools
                editor={editor}
                selection={selection}
                activeLayerId={crossLayer ? undefined : activeLayer}
                onSelect={setSelectionSafe}
              />
              <ClipboardTools
                editor={editor}
                selection={selection}
                layerId={activeLayer}
                crossLayer={crossLayer}
                position={position}
                onSelect={setSelectionSafe}
              />
            </>
          ) : (
            <>
              {layersPanel}
              <LayerActions
                project={project}
                layerId={activeLayer}
                dispatch={(type, payload) => command(type, payload)}
                onRemoved={setActiveLayer}
                onCreated={setActiveLayer}
                ghostOtherLayers={ghostOtherLayers}
                onGhostChange={setGhostOtherLayers}
              />
            </>
          )}
          <div hidden={panel !== "Inspector"}>
            <TransformPanel
              editor={editor}
              renderer={() => renderer.current}
              selection={selection}
              revision={project.revision}
              enabled={
                mode === "Build" &&
                tool === "Select" &&
                selectionShape === "click" &&
                !pickingFace
              }
              activeLayerId={crossLayer ? undefined : activeLayer}
              report={setStatus}
              modeRequest={transformModeRequest}
            />
          </div>
          <div hidden={panel !== "Inspector"}>
            <RigAuthoring
              editor={editor}
              project={project}
              selection={selection}
              activeLayerId={crossLayer ? undefined : activeLayer}
              onSelect={setSelectionSafe}
            />
            <SeatAuthoring
              editor={editor}
              project={project}
              activeLayerId={crossLayer ? undefined : activeLayer}
            />
          </div>
          <WorkplanePanel
            value={workplane}
            onChange={updateWorkplane}
            pickingFace={pickingFace}
            onCancelPick={() => setPickingFace(false)}
            onPickFace={() => {
              setPickingFace(true);
              setTool("Select");
              setPanel("Canvas");
              setStatus("Tap a visible model face to align the workplane.");
            }}
          />
        </aside>
      </main>
      <footer
        className={"status-bar hud-el" + (statusFresh || busy ? " fresh" : "")}
      >
        <span role="status" aria-live="polite">
          {busy ? "Working… " : ""}
          {status}
        </span>
        {busy && (
          <button
            onClick={() => {
              operationEpoch.current++;
              worker.current?.terminate();
              void api.current?.jobs
                .list()
                .then((list) =>
                  Promise.all(
                    list
                      .filter((j) => j.state === "running")
                      .map((j) => api.current!.jobs.cancel(j.id)),
                  ),
                );
              setBusy(false);
              setStatus("Cancelled");
            }}
          >
            Cancel
          </button>
        )}
        <span>
          Revision {project.revision}
          <b>·</b>
          {project.layers[activeLayer]?.name}
        </span>
      </footer>
      <nav className="mobile-nav hud-el hud-slab" aria-label="Mobile panels">
        <button
          className="hotbar-colour-slot"
          aria-label={
            "Colour: " + (colors.find((c) => c.code === color)?.name ?? color)
          }
          onClick={() => {
            setPanel("Parts");
            requestAnimationFrame(() =>
              document
                .getElementById("colour-swatches")
                ?.scrollIntoView({ block: "center" }),
            );
          }}
        >
          <i
            className="hotbar-swatch"
            style={{ background: colors.find((c) => c.code === color)?.hex }}
          />
        </button>
        {[part, ...recentParts.filter((id) => id !== part)]
          .slice(0, 2)
          .map((id) => (
            <button
              key={id}
              className={"hotbar-part" + (part === id ? " chosen" : "")}
              aria-label={"Place " + catalog[id].name}
              onClick={() => {
                choosePart(id);
                setPanel("Canvas");
              }}
            >
              <BrickIcon
                width={catalog[id].width / 20}
                depth={catalog[id].depth / 20}
                color={colors.find((c) => c.code === color)?.hex}
              />
              <span>
                {catalog[id].name
                  .replace(/^(Brick|Plate) /, "")
                  .replace(/ /g, "")}
              </span>
            </button>
          ))}
        {(["Parts", "Layers", "Inspector"] as const).map((p) => (
          <button
            key={p}
            className={panel === p ? "active" : ""}
            aria-label={p}
            aria-pressed={panel === p}
            onClick={() => setPanel(panel === p ? "Canvas" : p)}
          >
            <Icon
              name={
                p === "Parts"
                  ? "parts"
                  : p === "Layers"
                    ? "layers"
                    : "inspector"
              }
            />
            <span aria-hidden="true">{p === "Inspector" ? "Inspect" : p}</span>
          </button>
        ))}
      </nav>
      <input
        hidden
        ref={fileInput}
        type="file"
        accept=".ldr,.mpd,.dat,.brickproj"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void openFile(f);
          e.target.value = "";
        }}
      />
      {inventoryOpen && (
        <div className="modal-backdrop">
          <section
            className="dialog inventory-dialog"
            role="dialog"
            aria-modal="true"
            aria-label="Export build"
          >
            <div className="dialog-heading">
              <div>
                <h2>Export build</h2>
              </div>
              <button
                aria-label="Close export"
                onClick={() => setInventoryOpen(false)}
              >
                ✕
              </button>
            </div>
            <div className="export-shortcuts">
              <button onClick={() => void exportFile("native")}>
                <strong>Native project</strong>
                <small>Editable .brickproj backup</small>
              </button>
              <button onClick={() => void exportFile("ldraw")}>
                <strong>LDraw model</strong>
                <small>Interoperable .mpd</small>
              </button>
              <button
                onClick={() => {
                  setInventoryOpen(false);
                  setMode("Photo");
                }}
              >
                <strong>PNG image</strong>
                <small>Open photo studio</small>
              </button>
            </div>
            <h3>BrickLink Wanted List</h3>
            <p>
              Generate a parts list locally. No account or network connection
              required.
            </p>
            <div className="form-row">
              <label>
                Scope
                <select
                  value={inventoryScope}
                  onChange={(e) => {
                    setInventoryScope(e.target.value as Scope["kind"]);
                    setPreview(null);
                  }}
                >
                  <option value="all">Entire build (includes hidden)</option>
                  <option value="visible">Visible layers</option>
                  <option value="layers">Active layer</option>
                  <option value="selection">Selection</option>
                </select>
              </label>
              <label>
                Condition
                <select
                  value={condition}
                  onChange={(e) => {
                    setCondition(e.target.value);
                    setPreview(null);
                  }}
                >
                  <option value="any">Any</option>
                  <option value="new">New</option>
                  <option value="used">Used</option>
                </select>
              </label>
            </div>
            <label className="check">
              <input
                type="checkbox"
                checked={acceptUnknown}
                onChange={(e) => {
                  setAcceptUnknown(e.target.checked);
                  setPreview(null);
                }}
              />
              I accept uncertainty for unaudited part/colour combinations.
            </label>
            <button className="wide" onClick={() => void previewInventory()}>
              Preview parts list
            </button>
            {preview && (
              <>
                <div className="inventory-stats">
                  <div>
                    <strong>{preview.sourceOccurrenceCount}</strong>
                    <span>source parts</span>
                  </div>
                  <div>
                    <strong>{preview.resolvedPhysicalUnitCount}</strong>
                    <span>resolved units</span>
                  </div>
                  <div>
                    <strong>{preview.lotCount}</strong>
                    <span>distinct lots</span>
                  </div>
                  <div>
                    <strong>{preview.excludedOccurrenceIds.length}</strong>
                    <span>omitted parts</span>
                  </div>
                </div>
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Part</th>
                        <th>Colour ID</th>
                        <th>Quantity</th>
                        <th>Mapping</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.rows.map((row) => (
                        <tr key={row.itemId + ":" + row.colorId}>
                          <td>{row.itemId}</td>
                          <td>{row.colorId}</td>
                          <td>{row.quantity}</td>
                          <td>{row.verification}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {preview.diagnostics.length > 0 && (
                  <div className="diagnostics">
                    {preview.diagnostics.map((d, i) => (
                      <button
                        key={i}
                        onClick={() => {
                          setSelectionSafe(d.occurrenceIds);
                          setOverrideId(d.occurrenceIds[0] || "");
                        }}
                      >
                        <strong>{d.code}</strong>
                        <span>{d.message}</span>
                      </button>
                    ))}
                  </div>
                )}
                {overrideId && (
                  <div className="resolution">
                    <h3>Explicit mapping for selected problem</h3>
                    <input
                      aria-label="BrickLink part ID"
                      placeholder="BrickLink part ID"
                      value={overridePart}
                      onChange={(e) => setOverridePart(e.target.value)}
                    />
                    <input
                      aria-label="BrickLink colour ID"
                      placeholder="BrickLink colour ID"
                      value={overrideColor}
                      onChange={(e) => setOverrideColor(e.target.value)}
                    />
                    <button
                      onClick={() =>
                        void run(() => {
                          command("inventory.override", {
                            occurrenceId: overrideId,
                            mapping: {
                              itemId: overridePart,
                              colorId: overrideColor,
                              acknowledged: true,
                              substitution: true,
                            },
                          });
                          setOverrideId("");
                        })
                      }
                    >
                      Acknowledge this unverified substitution
                    </button>
                  </div>
                )}
                <div className="button-row">
                  <button
                    className="primary"
                    disabled={!preview.canExportComplete}
                    onClick={() => void exportInventory()}
                  >
                    Download XML <Icon name="arrowDown" size={16} />
                  </button>
                  <button
                    disabled={!preview.canExportComplete}
                    onClick={() => void exportInventory(false, true)}
                  >
                    Copy XML
                  </button>
                  <button
                    onClick={() =>
                      download(
                        "inventory-report.json",
                        strToU8(JSON.stringify(preview, null, 2)),
                        "application/json",
                      )
                    }
                  >
                    Report <Icon name="arrowDown" size={16} />
                  </button>
                </div>
                {!preview.canExportComplete && (
                  <button
                    className="wide warning"
                    onClick={() => void exportInventory(true)}
                  >
                    Export resolved items only (
                    {preview.excludedOccurrenceIds.length} omitted) + report ZIP
                  </button>
                )}
              </>
            )}
            <button className="wide" onClick={() => void perLayer()}>
              Export one complete list per nonempty layer (ZIP)
            </button>
            <p className="muted">
              Use BrickLink’s Wanted List XML upload. Importing into a populated
              list may add demand instead of replacing it. Live destination
              validation has not been performed.
            </p>
          </section>
        </div>
      )}
      {fillOpen && (
        <div className="modal-backdrop">
          <section
            className="dialog"
            role="dialog"
            aria-modal="true"
            aria-label="Rectangular fill"
          >
            <div className="dialog-heading">
              <h2>Rectangular fill</h2>
              <button
                aria-label="Close fill"
                onClick={() => {
                  worker.current?.terminate();
                  setBusy(false);
                  setFillOpen(false);
                }}
              >
                ✕
              </button>
            </div>
            <p>
              {currentPart.name} · {colors.find((c) => c.code === color)?.name}{" "}
              · {project.layers[activeLayer]?.name}
            </p>
            <FillOptions value={fillOptions} onChange={setFillOptions} />
            <div className="numeric-row">
              <NumberInput
                label="Columns"
                value={columns}
                onChange={(n) => {
                  setColumns(n);
                  setFill(null);
                }}
              />
              <NumberInput
                label="Rows"
                value={rows}
                onChange={(n) => {
                  setRows(n);
                  setFill(null);
                }}
              />
            </div>
            <p className="muted">
              Starts at the placement coordinates. Hidden parts count as
              obstacles. Conservative bounds can leave extra gaps.
            </p>
            <div className="numeric-row">
              {["X", "Y", "Z"].map((axis, i) => (
                <NumberInput
                  key={axis}
                  label={"Fill " + axis}
                  value={position[i]}
                  onChange={(n) => {
                    setPosition(
                      (v) => v.map((x, j) => (i === j ? n : x)) as Vec3,
                    );
                    setFill(null);
                  }}
                />
              ))}
            </div>
            <button className="wide" disabled={busy} onClick={startFill}>
              Preview fill
            </button>
            {fill && (
              <>
                <p>
                  {fill.parts.length} additions · {fill.unresolvedCells.length}{" "}
                  unresolved cells
                </p>
                <p>
                  {fill.coveredCells} of {fill.eligibleCells} eligible cells
                  covered.
                </p>
                {fill.diagnostics.map((message, i) => (
                  <p className="muted" key={i}>
                    {message}
                  </p>
                ))}
                <button
                  className="primary wide"
                  disabled={!fill.parts.length}
                  onClick={() =>
                    void run(() => {
                      ensure(
                        fill.revision === editor.revision,
                        "REVISION_CONFLICT",
                        "Fill preview is stale",
                      );
                      command("parts.add", {
                        layerId: fill.layerId,
                        parts: fill.parts,
                        maxAdditions: resourceLimits(editor.resourceProfile)
                          .additionsPerCommand,
                      });
                      setFillOpen(false);
                      setStatus("Fill committed as one undo step");
                    })
                  }
                >
                  Commit {fill.parts.length} parts
                </button>
              </>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
