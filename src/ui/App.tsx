import {
  effectiveInsertionChecks,
  insertionChecksCurrent,
  insertionSummary,
} from "../instructions/motion";
import {
  instructionDisplayState,
  instructionAlternateIds,
} from "../instructions/programme";
import { fitInstructionView } from "../instructions/view-camera";
import { startInstructionGeneration } from "../instructions/worker-client";
import { InstructionTray } from "./InstructionTray";
import { LimitedSource } from "./LimitedSource";
import { ExportProfiles } from "./ExportProfiles";
import { ModelTools } from "./ModelTools";
import { Gallery, type GallerySource } from "./Gallery";
import {
  MODEL_VIEWS,
  galleryPrompts,
  type GalleryEntry,
  type ModelTool,
} from "../catalog/gallery";
import {
  fetchGalleryModel,
  galleryIndexEnabled,
  loadGalleryIndex,
} from "../catalog/gallery-index";
import { RigAuthoring } from "./RigAuthoring";
import { RigPhysicsAuthoring } from "./RigPhysicsAuthoring";
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
  planeOrigin,
  placeBasis,
  type Workplane,
} from "../edit/workplane";
import { TransformPanel } from "./TransformPanel";
import { folderPath } from "./LayerFolders";
import { Segmented, SelectionTools } from "./SelectionTools";
import { attachRegionGesture, type RegionShape } from "../edit/region-gesture";
import {
  combineSelection,
  eligibleSelection,
  type SelectionOperation,
} from "../edit/selection";
import {
  DEFAULT_CONTAINMENT,
  type Containment,
  type RegionMode,
} from "../render/region-selection";
import { QualityPanel } from "./QualityPanel";
import { MechanismBrowser } from "../mechanisms/browser";
import { MechanismPanel } from "./MechanismPanel";
import { ProjectLibrary } from "./ProjectLibrary";
import { OfficialSets } from "./OfficialSets";
import { omrAttribution, omrCredit, type OmrSet } from "../catalog/omr";
import { fetchOmrModel, loadOmrIndex } from "../catalog/omr-loader";
import { InventoryResolution } from "./InventoryResolution";
import { LibraryUpdatePanel } from "./LibraryUpdatePanel";
import { ResourceProfilePanel } from "./ResourceProfilePanel";
import { ReplacePanel } from "./ReplacePanel";
import { CheckpointsPanel } from "./CheckpointsPanel";
import { ClearSavedBuilds } from "./ClearSavedBuilds";
import {
  browserSavedBuildStores,
  clearSavedBuilds,
  describeSavedBuilds,
} from "../persistence/clear-saved";
import { HealthPanel } from "./HealthPanel";
import { CameraCollections } from "./CameraCollections";
import { FloorControls } from "./FloorControls";
import { architectureOf } from "../core/architecture";
import { Icon, type IconName } from "./icons";
import { inspectSelection, sourceLabels } from "../edit/inspect";
import { measure } from "../edit/measure";
import { occurrenceBox, stackingTarget } from "../edit/stacking";
import {
  chooseFit,
  hingeCandidates,
  orientedCandidates,
  sceneConnectors,
  snapCandidates,
  studWorkplane,
  type SnapCandidate,
} from "../edit/snap";
import { connectedAssembly } from "../core/connectivity";
import { trackCandidates } from "../edit/track-snap";
import { trackPart } from "../play/track";
import {
  checkConnection,
  checkMove,
  placementScene,
} from "../edit/connected-placement";
import {
  loadConnectedPreference,
  saveConnectedPreference,
} from "../persistence/connected-preference";
import {
  catalogCategories,
  relatedParts,
  searchCatalog,
  fullLibraryCategories,
} from "../catalog/search";
import { partSpec } from "../catalog/extended";
import {
  fullCatalog,
  fullLibraryGeneration,
  onFullLibraryChange,
} from "../catalog/full-library";
import {
  loadFullCatalog,
  loadFullSources,
} from "../catalog/full-library-loader";
import {
  loadFavourites,
  loadRecent,
  pushRecent,
  saveFavourites,
} from "../persistence/catalog-preferences";
import { OfflinePanel } from "./OfflinePanel";
import { PartThumb } from "./PartThumbs";
import { FullLibraryResults, fullResultCount } from "./FullLibraryPicker";
import { LayerActions } from "./LayerActions";
import { ClipboardTools } from "./ClipboardTools";
import { InstructionEditor } from "./InstructionEditor";
import { InstructionsPublish } from "./InstructionsPublish";
import { InstructionViewer } from "./InstructionViewer";
import { PartsList } from "./PartsList";
import { SharePanel } from "./SharePanel";
import { AutosaveQueue } from "../persistence/autosave";
import { BrowserPlay } from "../play/browser";
import { PlayPanel } from "./PlayPanel";
import { ModeMenu } from "./ModeMenu";
import {
  Component,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { flushSync } from "react-dom";
import { Editor } from "../core/commands";
import { occurrences } from "../core/document";
import {
  type Vec3,
  type Basis,
  type Transform,
  type Scope,
  type CameraSpec,
  type Project,
  type Occurrence,
  AppError,
  uid,
  ensure,
} from "../core/types";
import { identity, rotationY, compose } from "../core/math";
import {
  catalog,
  catalogCategoryOrder,
  colors,
  libraryLock,
  retiredLibraryLocks,
} from "../catalog/catalog";
import { ColorPicker, colourAvailabilityHint } from "./ColorPicker";
import { loadTemplate } from "../catalog/template-loader";
import {
  SHOWCASE_TEMPLATE,
  TEMPLATE_CARDS,
  templatePreview,
  type TemplateName,
} from "../catalog/template-names";
import { ReplaceProjectDialog } from "./ReplaceProjectDialog";
import { connectorCoverage, verifiedConnectors } from "../catalog/connectors";
import { SceneAdapter, type SectionSpec } from "../render/adapter";
import type { AnatomyStatus } from "../render/anatomy-view";
import { LoadProgressIndicator, setLoadProgress } from "./LoadProgress";
import { PhotoProgressIndicator, setPhotoProgress } from "./PhotoProgress";
import { createAPI, type BrickEditorAPI } from "../automation/api";
import { BrowserProjects } from "../persistence/browser-projects";
import { recoverProject } from "../persistence/restore";
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
import {
  loadGridPreference,
  loadLookPreference,
  loadSoftEdgesPreference,
  lookPreferenceControls,
  saveGridPreference,
  saveLookPreference,
  saveSoftEdgesPreference,
} from "../persistence/look-preference";
import {
  BACKDROP_NAMES,
  BACKDROPS,
  backdropOf,
  type BackdropName,
} from "../core/scene";
import { LOOK_NAMES, lookControls, type LookName } from "../render/look";
import "./styles.css";
import "./hud.css";
import "./parts-picker.css";
import "./guide.css";
import "./menus.css";
import "./workshop.css";
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
/** Sections of the camera-views popover, one at a time. */
type ViewTab = "Angle" | "Cut" | "Floors" | "Look";
/** Connector fits for the placement preview: stud fits keep the workplane
 * turn; side-stud and hinge fits carry their own orientation. */
type PlaceFits = {
  list: SnapCandidate[];
  index: number;
  mode: "stud" | "side" | "hinge" | "track";
  /** The tapped surface, for re-fitting after a turn. */
  tap?: { point: Vec3; normal: Vec3 };
};
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
/**
 * Complete-library names, bounds and sources arrive in bursts while a large
 * model loads, and each change re-derives every occurrence of the workspace
 * (a few hundred ms at 20,000 parts). Coalesce a burst into one change
 * (400 ms quiet, at most three seconds late).
 */
let publishedLibraryGeneration = fullLibraryGeneration();
/** The library generation views derive from (it lags bursts; see below). */
const coalescedLibraryGeneration = () => publishedLibraryGeneration;
function onFullLibraryChangeCoalesced(notify: () => void) {
  let timer: ReturnType<typeof setTimeout> | undefined,
    first = 0;
  const publish = () => {
    timer = undefined;
    publishedLibraryGeneration = fullLibraryGeneration();
    notify();
  };
  const unsubscribe = onFullLibraryChange(() => {
    const now = performance.now();
    if (timer === undefined) first = now;
    clearTimeout(timer);
    timer = setTimeout(publish, now - first >= 3000 ? 0 : 400);
  });
  // Changes made while nothing listened are published at once.
  if (publishedLibraryGeneration !== fullLibraryGeneration()) publish();
  return () => {
    clearTimeout(timer);
    unsubscribe();
  };
}
/** Status line for the fit on show. */
function fitStatus(
  mode: PlaceFits["mode"],
  list: SnapCandidate[],
  index: number,
) {
  const fit = list[index];
  const of = list.length > 1 ? ` Fit ${index + 1} of ${list.length}.` : "";
  const lead =
    mode === "track"
      ? fit.contacts > 1
        ? `Joins the track at ${fit.contacts} ends.`
        : "Joins the track."
      : mode === "hinge"
        ? `Seated in the frame: ${plural(fit.contacts, "hinge pin")}.`
        : mode === "side"
          ? `Turned onto the side studs: ${plural(fit.contacts, "stud connection")}.`
          : `Snapped to ${plural(fit.contacts, "stud connection")}.`;
  return lead + of + " Choose Place part (or press Enter) to place it.";
}

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
/** An API or file import started before recovery finished takes precedence. */
let importStarted = false;
const applicationAPI = createAPI(
  editor,
  () => runtime.renderer,
  () => runtime.play,
  () => runtime.mechanisms,
  () => runtime.selection(),
  () => Promise.all([rendererMounted, startupRecovered]).then(() => {}),
  () => {
    importStarted = true;
  },
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
/** Curated parts are listed by the catalogue, so complete-library results skip them. */
const excludeCurated = (id: string) => Object.hasOwn(catalog, id);
/** A part name whose sizes ("2 × 4", "1 × 2 × ⅔") never break across lines. */
function PartName({ name }: { name: string }) {
  return (
    <>
      {name.split(/(\d+(?: × [\d⅓⅔]+)+)/).map((piece, i) =>
        i % 2 ? (
          <span key={i} className="nowrap">
            {piece}
          </span>
        ) : (
          piece
        ),
      )}
    </>
  );
}
/** Compact hotbar label: the stud size ("2×4"), else the first word. */
function shortPartLabel(name: string) {
  const size = name.match(/\d+ × \d+/)?.[0];
  return size ? size.replace(/ /g, "") : name.split(" ")[0];
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
    <WorkspaceBoundary>
      <Workspace key={workspaceEpoch} />
    </WorkspaceBoundary>
  );
}
/** One renderer or panel throw must not blank the whole page. */
class WorkspaceBoundary extends Component<
  { children: ReactNode },
  { error?: Error }
> {
  state: { error?: Error } = {};
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <main className="workspace-crash" role="alert">
        <h1>Something went wrong.</h1>
        <p>
          Your build is saved on this device. Reload to carry on where you left
          off.
        </p>
        <p className="workspace-crash-detail">{this.state.error.message}</p>
        <button className="primary" onClick={() => location.reload()}>
          Reload
        </button>
      </main>
    );
  }
}
function Workspace() {
  const [galleryOpen, setGalleryOpen] = useState(
    () =>
      !location.hash.startsWith("#v=") &&
      new URLSearchParams(location.search).get("automation") !== "1",
  );
  // `?gallery=<id>` opens that published build's page.
  const [galleryDetail, setGalleryDetail] = useState<string | undefined>(
    () => new URLSearchParams(location.search).get("gallery") ?? undefined,
  );
  const [galleryPending, setGalleryPending] = useState<string>();
  const [galleryError, setGalleryError] = useState("");
  // What a failed open was, so its message can name it and try again.
  const [galleryRetry, setGalleryRetry] = useState<{
    entry: GalleryEntry;
    destination: ModelTool | "Play";
  }>();
  const [galleryModel, setGalleryModel] = useState<{
    entry: GalleryEntry;
    projectId: string;
  }>();
  // The published builds (docs/GALLERY-PLAN.md), read once Gallery is shown.
  const [gallerySource, setGallerySource] = useState<GallerySource>({
    state: "loading",
  });
  const [galleryAttempt, setGalleryAttempt] = useState(0);
  const galleryOpenRef = useRef(galleryOpen);
  galleryOpenRef.current = galleryOpen;
  const [generatingInstructions, setGeneratingInstructions] = useState(false);
  const instructionGenerationToken = useRef(0);
  const instructionGenerationJob = useRef<
    ReturnType<typeof startInstructionGeneration> | undefined
  >(undefined);
  const [project, setProject] = useState(() => editor.project),
    [transientView, setTransientView] = useState(false),
    [saveConflict, setSaveConflict] = useState(false),
    [saveCoordinationUnavailable, setSaveCoordinationUnavailable] =
      useState(false),
    [mode, setMode] = useState(
      location.hash.startsWith("#v=") ? "Project" : "Build",
    ),
    // Navigate is the resting tool: a new visitor can turn the build at once.
    [tool, setTool] = useState("Navigate"),
    [shortcuts, setShortcuts] = useState<Shortcuts>(loadShortcuts),
    [transformModeRequest, setTransformModeRequest] = useState<{
      mode: "off" | "translate" | "rotate";
      nonce: number;
    }>(),
    [part, setPart] = useState("3001.dat"),
    [color, setColor] = useState("4"),
    [search, setSearch] = useState(""),
    // "All LDraw parts" scope: opt-in per session, loads the full part list.
    [fullScope, setFullScope] = useState(false),
    [fullScopeError, setFullScopeError] = useState(""),
    // Browsing the complete library by LDraw category instead of the catalogue.
    [browseAll, setBrowseAll] = useState(false),
    [fullCategory, setFullCategory] = useState<string>(),
    [partCategory, setPartCategory] = useState<string>(),
    [favouritesOnly, setFavouritesOnly] = useState(false),
    [favourites, setFavourites] = useState(() =>
      loadFavourites((id) => !!catalog[id]),
    ),
    [recentParts, setRecentParts] = useState(() =>
      loadRecent((id) => !!catalog[id]),
    ),
    [selection, setSelection] = useState<string[]>([]),
    [regionShape, setRegionShape] = useState<RegionShape>("box"),
    /** Explicit box/lasso mode: one finger draws (a mouse drag always can). */
    [regionMode, setRegionMode] = useState(false),
    [regionRules, setRegionRules] = useState<Record<RegionMode, Containment>>(
      () => ({ ...DEFAULT_CONTAINMENT }),
    ),
    [floorOnly, setFloorOnly] = useState(true),
    [selectionOperation, setSelectionOperation] =
      useState<SelectionOperation>("replace"),
    [selectionDepth, setSelectionDepth] = useState<RegionMode>("visible"),
    [activeLayer, setActiveLayer] = useState("base"),
    [crossLayer, setCrossLayer] = useState(false),
    [ghostOtherLayers, setGhostOtherLayers] = useState(false),
    [position, setPosition] = useState<Vec3>([0, -24, 0]),
    [angle, setAngle] = useState(0),
    [workplane, setWorkplane] = useState(defaultWorkplane),
    /** Connector fits offered for the placement preview (cycled with Next fit). */
    [placeFits, setPlaceFits] = useState<PlaceFits | null>(null),
    /** Orientation from a side-stud or hinge fit; null keeps the workplane turn. */
    [placeOrientation, setPlaceOrientation] = useState<Basis | null>(null),
    /** "Snap together": Place and Move accept only parts that connect. */
    [snapTogether, setSnapTogether] = useState(loadConnectedPreference),
    [pickingFace, setPickingFace] = useState<false | "face" | "stud">(false),
    [status, setStatus] = useState("Ready to build"),
    [statusFresh, setStatusFresh] = useState(false),
    [saveStatus, setSaveStatus] = useState("Not yet saved"),
    [panel, setPanel] = useState("Canvas"),
    [sheetFull, setSheetFull] = useState(false),
    [viewsOpen, setViewsOpen] = useState(false),
    [modesOpen, setModesOpen] = useState(false),
    [section, setSection] = useState<SectionSpec | null>(null),
    [measurePoints, setMeasurePoints] = useState<Vec3[]>([]),
    [explodeBricks, setExplodeBricks] = useState(0),
    [anatomy, setAnatomy] = useState<AnatomyStatus | null>(null),
    [renderLook, setRenderLook] = useState<LookName>(loadLookPreference),
    [gridOn, setGridOn] = useState(loadGridPreference),
    [softEdges, setSoftEdges] = useState(loadSoftEdgesPreference),
    [sectionRange, setSectionRange] = useState<{
      min: number;
      max: number;
    } | null>(null),
    [inventoryOpen, setInventoryOpen] = useState(false),
    /** The follow-along instruction viewer (InstructionViewer.tsx). */
    [guideOpen, setGuideOpen] = useState(false),
    [partsListOpen, setPartsListOpen] = useState(false),
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
    [viewTab, setViewTab] = useState<ViewTab>("Angle"),
    [moreOpen, setMoreOpen] = useState(false),
    // The Inspector's advanced tools sit in a Tools tab beside it.
    [inspectorTools, setInspectorTools] = useState(false),
    [allTemplates, setAllTemplates] = useState(false),
    [placeExact, setPlaceExact] = useState(false),
    [detailsOpen, setDetailsOpen] = useState(false),
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
    [overrideId, setOverrideId] = useState(""),
    [replacePrompt, setReplacePrompt] = useState<{
      action: string;
      title: string;
      storedBefore: boolean;
      proceed: () => Promise<void>;
      resolve: (proceeded: boolean) => void;
    } | null>(null);
  const viewport = useRef<HTMLDivElement>(null),
    renderer = useRef<SceneAdapter | undefined>(undefined),
    api = useRef<BrickEditorAPI | undefined>(undefined),
    play = useRef<BrowserPlay | undefined>(undefined),
    mechanisms = useRef<MechanismBrowser | undefined>(undefined),
    modeRef = useRef(mode),
    guideRef = useRef(false),
    fileInput = useRef<HTMLInputElement>(null),
    worker = useRef<Worker | undefined>(undefined),
    saveRevisions = useRef(knownSaveRevisions),
    autosave = useRef<AutosaveQueue | undefined>(undefined),
    loaded = useRef(false),
    operationEpoch = useRef(0),
    observedProjectId = useRef(editor.projectId),
    /** The project as it was when opened (the save/discard prompt's baseline). */
    opened = useRef<{
      id: string;
      revision: number;
      snapshot: Project | null;
      stored: boolean;
    }>({
      id: editor.projectId,
      revision: editor.revision,
      snapshot: null,
      stored: false,
    }),
    nextOpenStored = useRef(false),
    /** The blank project "Clear saved builds" opened: not autosaved until
     * it changes, so a reload finds nothing to recover. */
    clearedBlank = useRef<string | null>(null),
    projectRef = useRef(project),
    selectionRef = useRef(selection),
    allRef = useRef<Occurrence[]>([]),
    interact = useRef({
      tool,
      regionShape,
      regionMode,
      regionRules,
      floorOnly,
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
      position,
      placeFits,
      placeOrientation,
      snapTogether,
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
  // Re-derive the scene when complete-library names, bounds or sources arrive.
  const fullLibraryVersion = useSyncExternalStore(
    onFullLibraryChangeCoalesced,
    coalescedLibraryGeneration,
  );
  const available = editor.materialization.status === "available";
  // Walking every occurrence of a 20,000-part model takes a few hundred ms:
  // derive it once per project (and library change), not on every render.
  const all = useMemo(
      () => (available ? occurrences(project) : []),
      [project, available, fullLibraryVersion],
    ),
    // The parent unmounts this entire derived workspace on limited replacement.

    selected = all.filter((o) => selection.includes(o.id)),
    currentPart = partSpec(part) ?? catalog["3001.dat"],
    currentPlanId = project.instructionPlans[activePlanId]
      ? activePlanId
      : (Object.keys(project.instructionPlans)[0] ?? ""),
    plan = project.instructionPlans[currentPlanId];
  // "Snap together" (docs/CONNECTORS.md, Connected building): whether the
  // placement preview holds on studs, hinges, the ground or (unverified parts)
  // on a part's top. The scene is derived once per project revision.
  const placingConnected =
    tool === "Place" && mode === "Build" && snapTogether && available;
  const placeScene = useMemo(
    () => (placingConnected ? placementScene(project, all) : null),
    [placingConnected, project, all],
  );
  // The tap handler (bound once) reads the same scene.
  const placeSceneRef = useRef(placeScene);
  placeSceneRef.current = placeScene;
  const placeCheck = useMemo(
    () =>
      placeScene
        ? checkConnection(
            part,
            {
              position,
              basis: placeOrientation ?? placeBasis(workplane, angle),
            },
            placeScene,
          )
        : null,
    [placeScene, part, position, placeOrientation, workplane, angle],
  );
  const placeRefused = !!placeCheck && !placeCheck.ok;
  // Before the first tap, and right after placing, the preview still sits
  // where the last part went: guide rather than warn until a spot is chosen.
  const [placeSettled, setPlaceSettled] = useState<Vec3 | null>(null);
  useEffect(() => {
    if (tool === "Place") setPlaceSettled(position);
    // Only entering Place starts quiet; later moves are the person's.
  }, [tool]);
  const placeQuiet =
    !!placeSettled && placeSettled.every((v, i) => v === position[i]);
  /** Snap together: why moving parts to these transforms is refused, or null. */
  const moveRefusal = (transforms: Record<string, Transform>) => {
    if (!snapTogether) return null;
    const check = checkMove(editor.project, transforms);
    return check.ok
      ? null
      : check.reason === "clash"
        ? "Not moved: another part is in the way there."
        : "Not moved: it would float with nothing to connect to. Move it onto studs or the ground, or turn off Snap together.";
  };
  /** The selection's transforms after a world-space nudge. */
  const nudged = (delta: Vec3) =>
    Object.fromEntries(
      selected.map((o) => [
        o.id,
        {
          position: o.transform.position.map((v, i) => v + delta[i]) as Vec3,
          basis: o.transform.basis,
        },
      ]),
    );
  modeRef.current = mode;
  const anatomyOn = !!anatomy?.on;
  const anatomyOnRef = useRef(false);
  anatomyOnRef.current = anatomyOn && mode !== "Play";
  guideRef.current = guideOpen;
  projectRef.current = project;
  selectionRef.current = selection;
  allRef.current = all;
  interact.current = {
    tool,
    regionShape,
    regionMode,
    regionRules,
    floorOnly,
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
    position,
    placeFits,
    placeOrientation,
    snapTogether,
  };
  /** Shows one connector fit in the preview. */
  const applyFit = (fits: PlaceFits) => {
    const fit = fits.list[fits.index];
    setPlaceFits(fits);
    setPosition(fit.position);
    setPlaceOrientation(fits.mode === "stud" ? null : fit.basis);
  };
  /** Next connector fit (the placement card's Next fit, keys N and Tab). */
  const nextFit = () => {
    const fits = interact.current.placeFits;
    if (!fits || fits.list.length < 2) return;
    const index = (fits.index + 1) % fits.list.length;
    applyFit({ ...fits, index });
    setStatus(fitStatus(fits.mode, fits.list, index));
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
  /** Inventory rows: whether the part is known in the colour (spec §6.6). */
  const colourExistenceLabel: Record<string, string> = {
    verified: "Yes (BrickLink)",
    derived: "Yes (Rebrickable)",
    "not-recorded": "Not recorded",
    "not-produced": "Not made",
    unknown: "Unknown",
  };
  // Credit for an open LDraw OMR model, read from its own header (so it
  // survives saving and reopening), linked to its set page when the set
  // number is in the index.
  const omrHeader = useMemo(
    () =>
      omrAttribution(
        project.models[project.rootModelId]?.records
          .slice(0, 200)
          .map((r) => r.raw) ?? [],
      ),
    [project.models, project.rootModelId],
  );
  const [omrSets, setOmrSets] = useState<OmrSet[]>();
  useEffect(() => {
    if (omrHeader && !omrSets)
      void loadOmrIndex()
        .then((i) => setOmrSets(i.sets))
        .catch(() => {});
  }, [omrHeader, omrSets]);
  const omrCreditInfo = useMemo(() => {
    if (!omrHeader) return undefined;
    const n = omrHeader.setNumber,
      title = project.title;
    const set = omrSets?.find(
      (s) =>
        title.startsWith(s.number + " ") ||
        (n && (s.number === n || s.number === n + "-1")),
    );
    return { attribution: omrHeader, set };
  }, [omrHeader, omrSets, project.title]);
  const inspection = useMemo(
    () => inspectSelection(project, selected),
    // `selected` derives from these two (and resolved library names).
    [project, selection, fullLibraryVersion],
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
      (v) =>
        placementOnPlane(v, next, currentPart.height, angle, currentPart.align)
          .position,
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
      // The memoised list when it is current (walking 20,000 parts is slow).
      all =
        projectRef.current === p && allRef.current.length
          ? allRef.current
          : occurrences(p);
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
      `${eligible.length} part${eligible.length === 1 ? "" : "s"} selected${ids.length > eligible.length ? `; ${ids.length - eligible.length} hidden or on another layer` : ""}`,
    );
  };
  useEffect(
    () =>
      attachRegionGesture(
        viewport.current!,
        () => {
          const s = interact.current,
            p = editor.project;
          let everything: Occurrence[] | undefined;
          return {
            enabled:
              modeRef.current === "Build" &&
              s.tool === "Select" &&
              !s.pickingFace,
            regionMode: s.regionMode,
            shape: s.regionShape,
            depth: s.selectionDepth,
            rule: s.regionRules[s.selectionDepth],
            operation: s.selectionOperation,
            floorOnly: s.floorOnly,
            renderer: renderer.current,
            revision: editor.revision,
            eligible: (ids) =>
              eligibleSelection(
                p,
                (everything ??=
                  projectRef.current === p && allRef.current.length
                    ? allRef.current
                    : occurrences(p)),
                ids,
                s.activeLayer,
                s.crossLayer,
              ),
          };
        },
        (ids, operation) => receiveSelection(ids, operation),
        setStatus,
      ),
    [],
  );
  useEffect(() => {
    const openSharedPreview = () => {
      if (location.hash.startsWith("#v=")) {
        setGalleryOpen(false);
        setMode("Project");
      }
    };
    window.addEventListener("hashchange", openSharedPreview);
    return () => window.removeEventListener("hashchange", openSharedPreview);
  }, []);
  useEffect(() => {
    const unsubscribe = editor.subscribe(() => {
      // Shared, never mutated (see Editor.snapshot): no deep copy per commit.
      const p = editor.snapshot as Project;
      play.current?.sourceChanged();
      if (observedProjectId.current !== p.id) {
        observedProjectId.current = p.id;
        // A newly opened build starts in Navigate, like the first one.
        setTool("Navigate");
        setRegionMode(false);
        setSaveConflict(false);
        opened.current = {
          id: p.id,
          revision: p.revision,
          snapshot: p,
          stored: nextOpenStored.current,
        };
        nextOpenStored.current = false;
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
      setSelection((ids) => {
        if (!ids.length) return ids;
        const live = new Set(occurrences(p).map((o) => o.id));
        return ids.filter((id) => live.has(id));
      });
      if (!p.layers[interact.current.activeLayer])
        setActiveLayer(p.defaultLayerId);
      setPreview(null);
      // `p` is this callback's own copy of the project (editor.project
      // returns a fresh one); nothing mutates it after this point.
      renderer.current
        ?.update(p, { owned: true })
        .then(() => renderer.current?.select(selectionRef.current))
        .catch(() => {});
      if (!loaded.current) return;
      // A project just opened (a template, a file, a saved project) has no
      // changes yet; autosave still writes it for recovery.
      setSaveStatus(
        opened.current.id === p.id && opened.current.revision === p.revision
          ? "No changes"
          : "Unsaved changes",
      );
      if (
        clearedBlank.current === p.id &&
        opened.current.id === p.id &&
        opened.current.revision === p.revision
      )
        return;
      autosave.current?.schedule(p, { owned: true });
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
                ? "Saved on this device · version " + p.revision
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
      renderer.current.onProgress = setLoadProgress;
      renderer.current.onAnatomyChange = setAnatomy;
      renderer.current.onPhotoProgress = (progress) => {
        setPhotoProgress(progress);
        if (progress?.phase === "done")
          setStatus(
            progress.renderer === "path"
              ? `Photo refined: ${progress.samples} path-traced samples.`
              : `Photo refined: ${progress.samples} samples.` +
                  (progress.note ? " " + progress.note : ""),
          );
      };
      // Phones degrade the realistic looks; apply the viewer's saved look.
      renderer.current.setLookResourceProfile(editor.resourceProfile);
      const look = loadLookPreference();
      renderer.current.setLook(
        look,
        lookPreferenceControls(look, loadSoftEdgesPreference()),
      );
      renderer.current.setGridVisible(loadGridPreference());
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
    if (new URLSearchParams(location.search).get("automation") === "1") {
      window.brickEditor = api.current;
      window.__brickScene = renderer.current;
    }
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
        // Verified off the main thread, so a large saved project does not
        // freeze the page while it is read back.
        const recoveredProject = id
          ? await recoverProject(id, localStorage)
          : null;
        const saved = recoveredProject?.project;
        if (
          saved &&
          editor.revision === initialRevision &&
          editor.projectId === initialId &&
          !importStarted
        ) {
          saveRevisions.current.set(saved.id, saved.revision);
          observedProjectId.current = saved.id;
          editor.replace(saved, { trusted: recoveredProject.verified });
          opened.current = {
            id: saved.id,
            revision: editor.revision,
            snapshot: saved,
            stored: true,
          };
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
      instructionGenerationToken.current++;
      instructionGenerationJob.current?.cancel();
      autosave.current?.dispose();
      document.removeEventListener("visibilitychange", flushSave);
      window.removeEventListener("storage", notifySavedChange);
      delete window.brickEditor;
      delete window.__brickScene;
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
    // The step viewer only looks: one finger or the left button orbits.
    const orbit = tool === "Navigate" || guideOpen;
    r.controls.enableRotate = mode === "Build" || mode === "Photo" || guideOpen;
    r.controls.mouseButtons.LEFT = orbit ? 0 : (null as any);
    // Right-drag orbits in the editing tools (Shift+right-drag pans), so the
    // left button stays free for taps, boxes and lassos; Navigate keeps pan.
    r.controls.mouseButtons.RIGHT = orbit ? 2 : 0;
    r.controls.touches.ONE = orbit ? 0 : (null as any);
    r.controls.enabled = mode !== "Play";
  }, [tool, mode, transientView, guideOpen]);
  useEffect(() => {
    if (mode === "Instructions" && !ownsTransientView() && !guideOpen)
      renderer.current?.showStep(
        plan ? instructionDisplayState(plan, step).displayIds : null,
        dimPrevious && plan
          ? instructionDisplayState(plan, step).highlightIds
          : undefined,
      );
  }, [mode, step, plan, transientView, dimPrevious, guideOpen]);
  // The step viewer is a view of the Build, Instructions or Project modes.
  useEffect(() => {
    if (mode === "Play" || mode === "Photo") setGuideOpen(false);
  }, [mode]);
  // The step guide frames each step; closing it returns the view the person
  // had (as closing a sheet does).
  useEffect(() => {
    if (!guideOpen) return;
    const before = renderer.current?.currentCamera();
    return () => {
      // Instructions frames its current step itself once the guide closes.
      if (before && modeRef.current !== "Instructions")
        try {
          renderer.current?.setCamera(before);
        } catch {
          // A capture in progress keeps its camera; the view stays as it is.
        }
    };
  }, [guideOpen]);
  useEffect(() => {
    if (!guideOpen) return;
    // The viewer shows its own steps: the editor's step view and the
    // anatomy exploded view step aside (the guide places parts in place).
    // The child viewer owns either its guide mask or the explicit programme
    // mask. Clearing it here would erase its first workbench step on opening.
    if (renderer.current?.anatomy.on)
      renderer.current.setAnatomy({ on: false, animate: false });
    renderer.current?.select([]);
  }, [guideOpen]);
  useEffect(() => {
    if (mode !== "Instructions" && !guideOpen) renderer.current?.showStep(null);
    // Document replacement cancels the old session synchronously through
    // sourceChanged. A delayed plan render must not cancel a new API session.
    if (mode !== "Play") {
      play.current?.exit();
      mechanisms.current?.exit();
    }
    if (mode !== "Build") setPanel("Canvas");
  }, [mode, guideOpen]);
  useEffect(() => {
    setStep((index) =>
      Math.max(0, Math.min(index, (plan?.steps.length ?? 1) - 1)),
    );
  }, [plan]);
  const instructionCamera = useRef<CameraSpec | undefined>(undefined);
  const frameInstructionCamera = () => {
    const r = renderer.current,
      camera = instructionCamera.current;
    if (!r || !camera) return;
    const canvas = r.renderer.domElement.getBoundingClientRect(),
      app = r.renderer.domElement.closest(".app"),
      insets = { top: 0, right: 0, bottom: 0, left: 0 };
    // The title row counts too: on phones it is the only chrome row.
    for (const element of app?.querySelectorAll(
      ".mode-card, .hud-top, .model-context",
    ) ?? []) {
      const box = element.getBoundingClientRect();
      if (!box.width || !box.height) continue;
      if (box.height < 100)
        insets.top = Math.max(insets.top, box.bottom - canvas.top + 8);
      else if (box.left > canvas.left + canvas.width / 2)
        insets.right = Math.max(insets.right, canvas.right - box.left + 8);
      else if (box.right < canvas.left + canvas.width / 2)
        insets.left = Math.max(insets.left, box.right - canvas.left + 8);
      else insets.bottom = Math.max(insets.bottom, canvas.bottom - box.top + 8);
    }
    r.setCamera(fitInstructionView(camera, canvas, insets));
  };
  const showInstructionCamera = (camera: CameraSpec) => {
    instructionCamera.current = camera;
    frameInstructionCamera();
  };
  useEffect(() => {
    const camera = plan?.stepMetadata?.[step]?.camera,
      r = renderer.current;
    if (
      mode !== "Instructions" ||
      guideOpen ||
      !camera ||
      !r ||
      ownsTransientView()
    )
      return;
    let cancelled = false;
    instructionCamera.current = camera;
    const frame = () => {
      if (!cancelled && !ownsTransientView()) frameInstructionCamera();
    };
    const observer = new ResizeObserver(frame);
    observer.observe(r.renderer.domElement);
    for (const element of r.renderer.domElement
      .closest(".app")
      ?.querySelectorAll(".mode-card, .hud-top") ?? [])
      observer.observe(element);
    void r
      .ready()
      .then(frame)
      .catch((e) => setStatus(e.message));
    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, [mode, currentPlanId, step, plan?.stepMetadata, transientView, guideOpen]);

  useEffect(() => {
    renderer.current?.setWorkplaneGuide(workplane);
  }, [workplane]);
  useEffect(() => {
    if (mode !== "Build") setPickingFace(false);
  }, [mode]);
  useEffect(() => {
    if (tool === "Place" && mode === "Build")
      void renderer.current
        ?.previewPart(
          part,
          color,
          position,
          placeOrientation ?? placeBasis(workplane, angle),
          placeRefused,
        )
        .catch((e) => setStatus(e.message));
    else renderer.current?.clearGhost();
  }, [
    tool,
    part,
    color,
    position,
    angle,
    mode,
    project.revision,
    workplane,
    placeOrientation,
    placeRefused,
  ]);
  // Fits belong to one part, tool and workplane.
  useEffect(() => {
    setPlaceFits(null);
    setPlaceOrientation(null);
  }, [part, tool, workplane]);
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
      if (
        (modeRef.current !== "Build" && !anatomyOnRef.current) ||
        modeRef.current !== "Build" ||
        guideRef.current ||
        play.current?.getState().active
      )
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
      if (s.pickingFace === "stud") {
        void run(() => {
          const surface = r.pickSurface(e.clientX, e.clientY);
          const hit =
            surface &&
            occurrences(editor.project).find(
              (o) => o.id === surface.occurrenceId,
            );
          ensure(hit, "INVALID_INPUT", "Tap a stud of a part.");
          const found = studWorkplane(hit!, surface!.point, s.workplane);
          ensure(
            found,
            "INVALID_INPUT",
            "That part has no verified stud near the tap; pick another part or use a face.",
          );
          setWorkplane(found!.plane);
          setPosition(
            (v) =>
              placementOnPlane(
                v,
                found!.plane,
                partSpec(s.part)!.height,
                s.angle,
                partSpec(s.part)!.align,
              ).position,
          );
          setPickingFace(false);
          setFill(null);
          setStatus(
            "Workplane set on the stud; its grid follows that part's studs.",
          );
        });
        return;
      }
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
              placementOnPlane(
                v,
                face.plane,
                partSpec(s.part)!.height,
                s.angle,
                partSpec(s.part)!.align,
              ).position,
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
      // Anatomy: a tap isolates the group under it; a tap on nothing (or on
      // the isolated group again) shows every group.
      if (anatomyOnRef.current) {
        const group = r.anatomyGroupAt(e.clientX, e.clientY);
        const focus = group && group.key !== r.anatomy.focus ? group.key : null;
        r.setAnatomy({ focus });
        setStatus(
          group && focus
            ? `${group.name}: ${group.parts} part${group.parts === 1 ? "" : "s"}.`
            : "Showing every group.",
        );
        return;
      }
      if (modeRef.current !== "Build") return;
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
            const spec = partSpec(s.part)!;
            return stackingTarget(
              s.workplane,
              surface,
              occurrenceBox(project, hit),
              hit.namespace === "official" && !!partSpec(hit.node.ref)?.studded,
              {
                width: spec.width,
                depth: spec.depth,
                angle: s.angle,
                bounds: spec.bounds,
                height: spec.height,
              },
            );
          })();
        const project = editor.project;
        const scene = sceneConnectors(
          project,
          occurrences(project),
          (o) => o.visible,
        );
        // Track snaps end to end with the placed track near the tap (every
        // way one of its ends meets a free rail end; Next fit or Rotate
        // cycles them, so a curve bends either way).
        if (trackPart(s.part)) {
          const point =
            surface?.point ??
            r.planeIntersection(e.clientX, e.clientY, s.workplane);
          const list = point
            ? trackCandidates(s.part, { point }, scene.occupants ?? [])
            : [];
          if (list.length) {
            const index = chooseFit(
              list,
              s.placeOrientation
                ? { position: s.position, basis: s.placeOrientation }
                : null,
            );
            applyFit({ list, index, mode: "track" });
            setStatus(fitStatus("track", list, index));
            return;
          }
        }
        // A hinged leaf tapped onto a frame seats in its hinge sockets; a part
        // tapped onto a face with sideways studs turns to them. The previous
        // fit is kept (hysteresis) while it is still nearly the nearest.
        if (surface) {
          const hinge = hingeCandidates(s.part, surface, scene);
          const list = hinge.length
            ? hinge
            : orientedCandidates(
                s.part,
                s.angle,
                surface,
                scene,
                s.workplane.normal,
              );
          if (list.length) {
            const mode = hinge.length ? "hinge" : "side";
            const index = chooseFit(
              list,
              s.placeOrientation
                ? { position: s.position, basis: s.placeOrientation }
                : null,
            );
            applyFit({ list, index, mode, tap: surface });
            setStatus(fitStatus(mode, list, index));
            return;
          }
        }
        // Verified stud connectors refine the proposal so anti-studs sit on
        // studs (or studs in anti-studs); otherwise the proposal stands.
        const proposal = target
          ? placementOnPlane(
              target.point,
              target.plane,
              partSpec(s.part)!.height,
              s.angle,
              partSpec(s.part)!.align,
            ).position
          : (() => {
              const v = r.planeIntersection(e.clientX, e.clientY, s.workplane);
              return (
                v &&
                placementOnPlane(
                  v,
                  s.workplane,
                  partSpec(s.part)!.height,
                  s.angle,
                  partSpec(s.part)!.align,
                ).position
              );
            })();
        if (!proposal) return;
        const basis = placeBasis(s.workplane, s.angle);
        const list = snapCandidates(
          s.part,
          basis,
          proposal,
          scene,
          s.workplane.normal,
        );
        const index = chooseFit(
          list,
          s.placeOrientation ? null : { position: s.position, basis },
        );
        // Snap together: a proposal that holds nowhere is shown, tinted, but
        // cannot be placed; say why.
        const refusal =
          s.snapTogether && index < 0
            ? checkConnection(
                s.part,
                { position: proposal, basis },
                placeSceneRef.current ?? placementScene(project),
              )
            : null;
        if (refusal && !refusal.ok) {
          setPlaceFits(null);
          setPlaceOrientation(null);
          setPosition(proposal);
          setStatus(refusal.message);
          return;
        }
        if (index >= 0) applyFit({ list, index, mode: "stud" });
        else {
          setPlaceFits(null);
          setPlaceOrientation(null);
          setPosition(proposal);
        }
        const where = !target
          ? "Placement preview ready."
          : surface!.normal[1] < -0.7
            ? "Preview stacked on top."
            : surface!.normal[1] > 0.7
              ? "Preview placed underneath."
              : "Preview placed beside the part.";
        setStatus(
          where +
            (index >= 0 ? " " + fitStatus("stud", list, index) : "") +
            (index >= 0
              ? ""
              : " Choose Place part (or press Enter) to place it."),
        );
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
        void run(async () => {
          await command("parts.recolor", {
            occurrenceIds: [id],
            colorCode: s.color,
            activeLayerId: s.crossLayer ? undefined : s.activeLayer,
          });
          const hint =
            o.namespace === "official" &&
            colourAvailabilityHint(
              o.node.ref,
              partSpec(o.node.ref)?.name ?? o.node.ref.replace(/\.dat$/i, ""),
              s.color,
            );
          if (hint) setStatus("Painted. " + hint);
        });
      else {
        receiveSelection([id], e.shiftKey ? "toggle" : s.selectionOperation);
        // Phones and tablets keep the model in view: the selection strip
        // offers the everyday actions, and More opens the Inspector.
        if (!matchMedia("(max-width: 1100px)").matches) setPanel("Inspector");
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
      if (
        galleryOpenRef.current ||
        modeRef.current !== "Build" ||
        guideRef.current ||
        play.current?.getState().active
      )
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
      // Enter places the previewed part, as the card's Place part does, when
      // focus is on the page or canvas rather than on a button.
      if (
        e.key === "Enter" &&
        interact.current.tool === "Place" &&
        !(e.target instanceof Element && e.target.closest("button,a"))
      ) {
        const place = document.querySelector<HTMLButtonElement>(
          ".placement-card button.primary",
        );
        if (place && !place.disabled) {
          e.preventDefault();
          place.click();
        }
        return;
      }
      // Next connector fit: N (unless remapped to an action), or Tab while
      // focus is on the page or canvas rather than a control.
      const fits = interact.current.placeFits;
      if (
        interact.current.tool === "Place" &&
        fits &&
        fits.list.length > 1 &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey &&
        ((e.key.toLowerCase() === "n" &&
          !e.shiftKey &&
          !shortcutAction(e, shortcuts)) ||
          (e.key === "Tab" &&
            !e.shiftKey &&
            (e.target === document.body ||
              (e.target instanceof Node &&
                !!viewport.current?.contains(e.target)))))
      ) {
        e.preventDefault();
        nextFit();
        return;
      }
      const action = shortcutAction(e, shortcuts);
      // L switches box and lasso for Select drags (unless remapped).
      if (
        !action &&
        interact.current.tool === "Select" &&
        e.key.toLowerCase() === "l" &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey
      ) {
        e.preventDefault();
        const next = interact.current.regionShape === "box" ? "lasso" : "box";
        setRegionShape(next);
        setStatus(next === "box" ? "Drag draws a box." : "Drag draws a lasso.");
        return;
      }
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
        // Nothing picked yet: say what to do rather than "Invalid command".
        if (!selection.length) {
          setStatus(
            action === "remove"
              ? "Pick a part first, then press Delete to remove it."
              : "Pick a part first, then duplicate it.",
          );
          return;
        }
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
        setRegionMode(false);
        setPickingFace(false);
        setTransformModeRequest({
          mode: action === "move" ? "translate" : "rotate",
          nonce: Date.now(),
        });
      }
      if (action === "cancel") {
        if (interact.current.pickingFace) {
          setPickingFace(false);
          setStatus("Picking cancelled.");
          return;
        }
        if (interact.current.regionMode) {
          setRegionMode(false);
          setStatus("Box select finished.");
          return;
        }
        setSelectionSafe([]);
        setFillOpen(false);
        // Leaving Place, Paint or Measure returns to the resting tool.
        setTool((t) => (t === "Select" ? t : "Navigate"));
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
        if (/\.json$/i.test(file.name)) {
          // A build script (docs/AGENT-BUILDING.md), compiled to parts.
          let script: unknown;
          try {
            script = JSON.parse(await file.text());
          } catch {
            throw new AppError(
              "INVALID_INPUT",
              `${file.name} is not a build script (invalid JSON)`,
            );
          }
          ensure(
            epoch === operationEpoch.current,
            "CANCELLED",
            "Import cancelled",
          );
          renderer.current?.requestFitOnFirstParts();
          const result = await api.current!.buildScript.apply({ script });
          setGalleryOpen(false);
          setMode("Build");
          const errors = result.report.problems.filter(
            (p) => p.severity !== "info",
          ).length;
          setStatus(
            `Built “${result.report.title}”: ${result.report.stats.parts} parts` +
              (errors ? `, ${errors} problem(s) — see Health` : ""),
          );
          await renderer.current?.ready();
          renderer.current?.fit();
          setSelectionSafe([]);
          return;
        }
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
        renderer.current?.requestFitOnFirstParts();
        const result = await api.current!.project.import(input);
        if (result.materialization.status === "limited") return;
        setGalleryOpen(false);
        setMode("Build");
        setStatus("Drawing your model…");
        await renderer.current?.ready();
        renderer.current?.fit();
        setSelectionSafe([]);
        setStatus(`Opened “${file.name}”`);
      } finally {
        renderer.current?.requestFitOnFirstParts(false);
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
  async function useTemplate(name: TemplateName) {
    await run(async () => {
      const next = await loadTemplate(name);
      // Frame the build as soon as its first parts appear.
      renderer.current?.requestFitOnFirstParts();
      try {
        editor.replace(next);
        setActiveLayer("base");
        setSelectionSafe([]);
        // Show the new build (on phones the Project sheet would cover it).
        setMode("Build");
        setPanel("Canvas");
        await renderer.current?.ready();
      } finally {
        renderer.current?.requestFitOnFirstParts(false);
      }
      renderer.current?.fit();
      setStatus(
        name === "blank" ? "New blank project" : `Opened “${next.title}”`,
      );
    });
  }
  /**
   * "Clear saved builds": drops the pending autosave, deletes every saved
   * project, autosave snapshot and checkpoint in this browser (never the
   * part, library or set caches) and opens a blank canvas that is not saved
   * until it changes.
   */
  async function clearSavedBuildsAndReset() {
    await autosave.current?.discard(editor.projectId);
    // In the save queue, so no save of this tab lands halfway.
    const cleared = await enqueueSourceSave(() =>
      clearSavedBuilds(browserSavedBuildStores(localStorage)),
    );
    saveRevisions.current.clear();
    const blank = await loadTemplate("blank");
    clearedBlank.current = blank.id;
    editor.replace(blank);
    setActiveLayer("base");
    setSelectionSafe([]);
    setSaveConflict(false);
    setSaveStatus("No changes");
    setMode("Build");
    setPanel("Canvas");
    await renderer.current?.ready();
    renderer.current?.fit();
    setStatus(
      `Deleted ${describeSavedBuilds(cleared)} from this browser. Started a blank canvas.`,
    );
  }
  /** Whether replacing the open project would lose work: it has parts and
   * has changed since it was opened (a pristine template or an unchanged
   * saved project has nothing to lose). */
  function hasUnsavedWork() {
    if (editor.materialization.status !== "available") return false;
    const o = opened.current;
    if (o.id === editor.projectId && o.revision === editor.revision)
      return false;
    return occurrences(editor.project).length > 0;
  }
  /** Runs `proceed` now, or after the save/discard prompt when needed.
   * Resolves false when the person cancels and keeps their build. */
  function replaceProject(
    action: string,
    proceed: () => Promise<void>,
  ): Promise<boolean> {
    if (!hasUnsavedWork()) return proceed().then(() => true);
    return new Promise((resolve) =>
      setReplacePrompt({
        action,
        proceed,
        resolve,
        title: editor.project.title,
        storedBefore:
          opened.current.id === editor.projectId && opened.current.stored,
      }),
    );
  }
  /** Replacement for panels that must stay open when the person cancels. */
  async function replaceOrKeep(action: string, proceed: () => Promise<void>) {
    if (!(await replaceProject(action, proceed)))
      throw new AppError("CANCELLED", "Kept your current build.");
  }
  /** Saves the open project to this device's list and confirms it landed. */
  async function saveOpenProject() {
    const p = editor.project;
    autosave.current?.schedule(p);
    await autosave.current?.flush();
    const saved = await new BrowserProjects(localStorage).load(p.id);
    ensure(
      saved?.revision === p.revision,
      "STORAGE_UNAVAILABLE",
      "Could not save on this device. Download a copy, or cancel.",
    );
  }
  /** Drops the open project's changes: a project that was already saved goes
   * back to how it was opened; a new one leaves the saved list. */
  async function discardOpenProject() {
    const id = editor.projectId,
      o = opened.current;
    await autosave.current?.discard(id);
    const store = new BrowserProjects(localStorage);
    const saved = await store.load(id);
    if (!saved) return;
    if (o.id === id && o.stored && o.snapshot) {
      if (saved.revision !== o.snapshot.revision)
        saveRevisions.current.set(
          id,
          await store.save(
            { ...structuredClone(o.snapshot), revision: saved.revision + 1 },
            saved.revision,
          ),
        );
    } else {
      await store.delete(id, saved.revision);
      saveRevisions.current.delete(id);
    }
  }
  /** Opens an official set's model from the LDraw OMR (through the proxy,
   * or this device's cache) as a new project; its header keeps the author
   * and licence, and its STEP lines become the imported steps. */
  function openOfficialSet(set: OmrSet) {
    void replaceProject(`${set.number} ${set.name}`, () =>
      run(async () => {
        const epoch = ++operationEpoch.current;
        setBusy(true);
        try {
          setStatus(`Loading ${set.number} ${set.name} from LDraw.org…`);
          const { text } = await fetchOmrModel(
            set,
            resourceLimits(editor.resourceProfile).importBytes,
          );
          ensure(
            epoch === operationEpoch.current,
            "CANCELLED",
            "Import cancelled",
          );
          renderer.current?.requestFitOnFirstParts();
          const result = await api.current!.project.import({
            format: "ldraw",
            text,
            name: `${set.number} ${set.name}.mpd`,
          });
          if (result.materialization.status === "limited") return;
          setMode("Build");
          setPanel("Canvas");
          const credit = omrAttribution(text.split("\n", 400));
          setStatus(
            `Opened ${set.number} ${set.name}` +
              (credit ? ` — ${omrCredit(credit)}` : ""),
          );
          await renderer.current?.ready();
          renderer.current?.fit();
          setSelectionSafe([]);
        } finally {
          renderer.current?.requestFitOnFirstParts(false);
          setBusy(false);
        }
      }).then(() => undefined),
    );
  }
  function chooseTemplate(name: TemplateName) {
    const card = TEMPLATE_CARDS.find((c) => c.name === name);
    void replaceProject(
      name === "blank"
        ? "a blank canvas"
        : `the ${card?.title ?? name} template`,
      () => useTemplate(name),
    );
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
        acceptDerivedMappings: acceptUnknown,
      });
      listShown.current = true;
      setPreview(result);
    });
  }
  // Undo, redo or any other edit while the parts list is open refreshes it,
  // so the list never shows (or exports) a stale preview.
  // (Every document change clears the preview; `listShown` remembers that
  // the user had asked for one.)
  const listShown = useRef(false);
  useEffect(() => {
    if (!inventoryOpen) listShown.current = false;
    else if (
      listShown.current &&
      (!preview || preview.documentRevision !== project.revision)
    )
      void previewInventory();
    // previewInventory reads the current editor state.
  }, [inventoryOpen, project.revision]);
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
          acceptDerivedMappings: acceptUnknown,
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
        const look = renderer.current!.currentLook();
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
          // Photos use the chosen look (Camera views); photo accumulates samples.
          look: look.name,
          lookControls: lookControls(look),
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
  // Anatomy is a viewing aid too: Play puts the model back together meanwhile.
  useEffect(() => {
    renderer.current?.suspendAnatomy(mode === "Play");
  }, [mode]);
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
  useEffect(() => {
    renderer.current?.setLookResourceProfile(editor.resourceProfile);
  }, [editor.resourceProfile]);
  // Automation may change the look; show the renderer's when the views open.
  useEffect(() => {
    const current = renderer.current?.currentLook().name;
    if (viewsOpen && current) setRenderLook(current);
  }, [viewsOpen]);
  const chooseLook = (name: LookName) => {
    try {
      renderer.current?.setLook(name, lookPreferenceControls(name, softEdges));
      setRenderLook(name);
      saveLookPreference(name);
      setStatus(
        name === "standard"
          ? "Standard look: flat lighting with part outlines."
          : name === "realistic"
            ? "Realistic look: plastic materials, soft shadows and ambient occlusion."
            : "Photo look: a path-traced studio shot that refines while the view is still.",
      );
    } catch (e) {
      setStatus(e instanceof Error ? e.message : String(e));
    }
  };
  const backdrop = backdropOf(project);
  const chooseBackdrop = (name: BackdropName) => {
    if (name === backdrop) return;
    try {
      command("scene.set", { backdrop: name });
      setStatus(`${BACKDROPS[name].label} backdrop. ${BACKDROPS[name].hint}`);
    } catch (e) {
      setStatus(e instanceof Error ? e.message : String(e));
    }
  };
  const toggleSoftEdges = (on: boolean) => {
    try {
      renderer.current?.setLook(
        "standard",
        lookPreferenceControls("standard", on),
      );
      setSoftEdges(on);
      saveSoftEdgesPreference(on);
      setStatus(
        on
          ? "Soft outlines: each part's edges are a darker shade of its colour."
          : "Outlines drawn dark, as in LDraw.",
      );
    } catch (e) {
      setStatus(e instanceof Error ? e.message : String(e));
    }
  };
  // Camera views belongs to the view it opened in: a new mode, model or the
  // Gallery closes it, and so does Escape.
  useEffect(() => setViewsOpen(false), [mode, project.id, galleryOpen]);
  useEffect(() => {
    if (!viewsOpen) return;
    const close = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopImmediatePropagation();
      setViewsOpen(false);
    };
    document.addEventListener("keydown", close, true);
    return () => document.removeEventListener("keydown", close, true);
  }, [viewsOpen]);
  // Phones and tablets: a bottom sheet (Parts, Inspector, a tool's menu)
  // covers part of the view; the camera keeps the build in what is left.
  useEffect(() => {
    const r = renderer.current;
    if (!r) return;
    const sheets = ".mobile-panel.mobile-open, .mode-card";
    let observer: ResizeObserver | undefined;
    const measure = () => {
      const view = document.querySelector(".viewport")?.getBoundingClientRect();
      // Instructions and the step guide frame their own camera for each
      // step; only Build and Photo leave the view to the person.
      if (
        !view ||
        galleryOpen ||
        guideOpen ||
        (mode !== "Build" && mode !== "Photo") ||
        innerWidth > 1100
      )
        return r.setViewInset({});
      // The tool rail down the right edge is never free either.
      const rail = document
        .querySelector<HTMLElement>(".canvas-toolbar")
        ?.getBoundingClientRect();
      const railSpace =
        rail && rail.height > view.height * 0.3 && rail.left > view.width / 2
          ? view.right - rail.left + 8
          : 0;
      document
        .querySelector<HTMLElement>(".app")
        ?.style.setProperty("--rail-space", `${railSpace || 124}px`);
      // Each sheet leaves its largest free area: above, below or beside it.
      let insets: { top?: number; bottom?: number; left?: number } = {};
      let best = 0;
      for (const el of document.querySelectorAll<HTMLElement>(sheets)) {
        const b = el.getBoundingClientRect();
        if (b.height < 160 || b.width < 160) continue;
        if (b.bottom < view.top || b.top > view.bottom) continue;
        const free = [
          {
            area: (b.top - view.top) * view.width,
            insets: { bottom: view.bottom - b.top },
          },
          {
            area: (view.bottom - b.bottom) * view.width,
            insets: { top: b.bottom - view.top },
          },
          {
            area: (view.right - railSpace - b.right) * view.height,
            insets: { left: b.right - view.left },
          },
        ];
        // A sheet that covers little of the view needs no reframing.
        const covered = (b.width * b.height) / (view.width * view.height);
        if (covered < 0.15) continue;
        for (const f of free)
          if (f.area > best) {
            best = f.area;
            insets = f.insets;
          }
      }
      if (!best) return r.setViewInset({});
      let top = insets.top ?? 0;
      if (insets.bottom) {
        // The title row and tool chips above the band are not free either.
        for (const el of document.querySelectorAll<HTMLElement>(
          ".model-context, .hud-top",
        )) {
          const b = el.getBoundingClientRect();
          if (b.height && b.top < view.top + view.height / 3)
            top = Math.max(top, b.bottom - view.top);
        }
      }
      const band = view.height - top - (insets.bottom ?? 0);
      // Too thin a band to show the build: leave the view as it is.
      if (band < 120) return r.setViewInset({});
      r.setViewInset({
        top,
        bottom: insets.bottom ?? 0,
        left: insets.left ?? 0,
        right: insets.left ? railSpace : 0,
      });
    };
    const frame = requestAnimationFrame(() => {
      measure();
      observer = new ResizeObserver(measure);
      document
        .querySelectorAll<HTMLElement>(`${sheets}, .viewport`)
        .forEach((el) => observer!.observe(el));
    });
    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
    };
  }, [panel, mode, sheetFull, galleryOpen, modesOpen, guideOpen]);
  // Play stages the model alone: the editor's floor grid is for building.
  useEffect(() => {
    renderer.current?.setGridVisible(gridOn && mode !== "Play");
  }, [mode, gridOn]);
  const toggleGrid = (on: boolean) => {
    setGridOn(on);
    saveGridPreference(on);
    renderer.current?.setGridVisible(on);
  };
  // On touch layouts the status toast shows briefly after each change.
  useEffect(() => {
    setStatusFresh(true);
    const timer = window.setTimeout(() => setStatusFresh(false), 4000);
    return () => window.clearTimeout(timer);
  }, [status]);
  // The HUD dims and lets pointers through while a finger or pointer drags the model.
  const appRoot = useRef<HTMLDivElement>(null);
  // Slots that sit beside the tool column or above the placement card read their
  // sizes from CSS variables, so no two HUD slots overlap at any screen size.
  useLayoutEffect(() => {
    const root = appRoot.current;
    if (!root) return;
    const measure = () => {
      const bar = root.querySelector<HTMLElement>(".canvas-toolbar");
      const card = root.querySelector<HTMLElement>(".placement-card");
      root.style.setProperty("--tool-w", (bar?.offsetWidth ?? 0) + "px");
      root.style.setProperty(
        "--placement-h",
        card ? card.offsetHeight + 10 + "px" : "0px",
      );
    };
    const observer = new ResizeObserver(measure);
    root
      .querySelectorAll(".canvas-toolbar, .placement-card")
      .forEach((el) => observer.observe(el));
    measure();
    return () => observer.disconnect();
  }, [tool, mode]);
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
  const pickTool = (t: string) => {
    setTool(t);
    setMoreOpen(false);
    if (t === "Select")
      setTransformModeRequest({ mode: "off", nonce: Date.now() });
    if (t === "Place")
      setPosition(
        (v) =>
          placementOnPlane(
            v,
            workplane,
            currentPart.height,
            angle,
            currentPart.align,
          ).position,
      );
  };
  // Exploded positions are visual only: editing and measuring wait until assembled.
  const toolLocked = (t: string) =>
    (explodeBricks > 0 || anatomyOn) && t !== "Navigate";
  const toolbar = (
    <>
      <div className="tool-segment">
        {(["Select", "Place", "Paint", "Navigate"] as const).map((t) => (
          <button
            key={t}
            disabled={toolLocked(t)}
            className={tool === t ? "active" : ""}
            onClick={() => pickTool(t)}
            title={
              {
                Select: `Select · ${shortcuts.select || "unassigned"}`,
                Place: `Place · ${shortcuts.place || "unassigned"}`,
                Paint: `Paint · ${shortcuts.paint || "unassigned"}`,
                Navigate: "Orbit and pan",
              }[t]
            }
          >
            <Icon name={t.toLowerCase() as IconName} />
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
        <button className="fit-key" onClick={() => renderer.current?.fit()}>
          <Icon name="view" />
          <span className="tool-label">Fit view</span>
        </button>
        <button
          className={"views-toggle" + (viewsOpen ? " open" : "")}
          aria-expanded={viewsOpen}
          onClick={() => {
            setMoreOpen(false);
            setViewsOpen((v) => !v);
          }}
        >
          <Icon name="canvas" />
          <span className="tool-label">Camera views</span>
        </button>
        <div className="tool-more">
          <button
            className={
              (tool === "Measure" ? "active" : "") + (moreOpen ? " open" : "")
            }
            aria-expanded={moreOpen}
            aria-haspopup="true"
            onClick={() => {
              setViewsOpen(false);
              setMoreOpen((v) => !v);
            }}
          >
            <Icon name={tool === "Measure" ? "measure" : "more"} />
            <span className="tool-label">More tools</span>
          </button>
          {moreOpen && (
            <div
              className="tool-more-menu"
              role="group"
              aria-label="More tools"
            >
              <button
                className={tool === "Measure" ? "active" : ""}
                disabled={toolLocked("Measure")}
                title="Measure between two points"
                onClick={() => pickTool("Measure")}
              >
                <Icon name="measure" />
                <span>Measure</span>
              </button>
              <button
                onClick={() => {
                  setMoreOpen(false);
                  setFillOpen(true);
                  setFill(null);
                }}
              >
                <Icon name="fill" />
                <span>Rectangular fill</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
  const catalogParts = Object.values(catalog);
  const partCategories = catalogCategories(catalogParts, catalogCategoryOrder);
  const visibleParts = searchCatalog(catalogParts, {
    query: search,
    category: partCategory,
    favouritesOnly: partCategory === undefined && favouritesOnly,
    favourites: new Set(favourites),
  });
  // Browsing everything groups the palette by category; a search or filter is one ranked list.
  const groupedParts =
    !search.trim() && !partCategory && !favouritesOnly
      ? partCategories
          .map((category) => ({
            category,
            parts: visibleParts.filter((p) => p.category === category),
          }))
          .filter((g) => g.parts.length)
      : [
          {
            category: favouritesOnly
              ? "Favourites"
              : partCategory
                ? partCategory
                : "Search results",
            parts: visibleParts,
          },
        ];
  const choosePart = (id: string) => {
    const p = partSpec(id)!;
    const hint = colourAvailabilityHint(id, p.name, color);
    if (hint) setStatus(hint);
    setPart(id);
    setPosition(
      (v) => placementOnPlane(v, workplane, p.height, angle, p.align).position,
    );
    setTool("Place");
  };
  const fullEntries = fullScope ? fullCatalog() : undefined;
  /** Cards the complete-library section shows (variants folded). */
  const fullCount = useMemo(
    () =>
      fullEntries
        ? fullResultCount(fullEntries, search, {
            exclude: excludeCurated,
            category: browseAll ? fullCategory : undefined,
            browse: browseAll,
          })
        : 0,
    [fullEntries, search, browseAll, fullCategory],
  );
  const fullCategories = useMemo(
    () => (fullEntries ? fullLibraryCategories(fullEntries) : []),
    [fullEntries],
  );
  /** Switches the picker to (or from) browsing the complete library. */
  const browseFullLibrary = (on: boolean) => {
    setBrowseAll(on);
    setFullCategory(undefined);
    if (on) searchAllParts();
  };
  const searchAllParts = () => {
    setFullScope(true);
    setFullScopeError("");
    loadFullCatalog().catch((e) =>
      setFullScopeError(
        "The complete part list is unavailable" +
          (navigator.onLine ? "" : " offline") +
          ": " +
          (e instanceof Error ? e.message : String(e)),
      ),
    );
  };
  /** A complete-library part: load its verified definition, then hold it. */
  const chooseFullPart = (id: string) =>
    void run(async () => {
      setStatus("Loading " + id.replace(/\.dat$/, "") + "…");
      await loadFullSources([id]);
      const spec = partSpec(id);
      ensure(spec, "REFERENCE_MISSING", "This part has no geometry to place.");
      choosePart(id);
      const hint = colourAvailabilityHint(id, spec!.name, color);
      setStatus(
        spec!.name +
          " is ready to place. It is outside the curated catalogue: " +
          (verifiedConnectors(id)
            ? "it snaps by connectors derived from its geometry"
            : "no verified connectors, so it places by its bounds") +
          "; no reviewed marketplace mapping." +
          (hint ? " " + hint : ""),
      );
    });
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
  const heldHex = colorHex(color) ?? "#bac4cb";
  const partCard = (p: (typeof catalogParts)[number]) => {
    const favourite = favourites.includes(p.id);
    return (
      <div key={p.id} className="part-card-wrap">
        <button
          id={"part-" + p.id}
          className={"part-card " + (part === p.id ? "chosen" : "")}
          aria-pressed={part === p.id}
          title={p.name + " · " + p.id.replace(".dat", "")}
          onClick={() => choosePart(p.id)}
        >
          <PartThumb part={p} color={heldHex} />
          <strong>
            <PartName name={p.name} />
          </strong>
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
          title={favourite ? "Remove from favourites" : "Add to favourites"}
          onClick={() => toggleFavourite(p.id)}
        >
          <Icon name="star" size={20} filled={favourite} />
        </button>
      </div>
    );
  };
  const partsToolbar = (
    <>
      <div className="panel-title">
        <h2>Parts library</h2>
        <span
          className="count"
          aria-label={`${browseAll ? fullCount : visibleParts.length} parts shown`}
        >
          {(browseAll ? fullCount : visibleParts.length).toLocaleString("en")}
        </span>
      </div>
      <label className="search">
        <Icon name="search" size={18} />
        <input
          type="search"
          placeholder="Search parts, sizes or numbers"
          aria-label="Search parts"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <kbd>/</kbd>
      </label>
      {browseAll ? (
        <div
          className="part-filters"
          role="group"
          aria-label="Filter LDraw parts"
        >
          <button
            className="library-scope"
            onClick={() => browseFullLibrary(false)}
          >
            <Icon name="arrowLeft" size={14} /> Catalogue
          </button>
          {[undefined, ...fullCategories.map((c) => c.name)].map((category) => (
            <button
              key={category ?? "all"}
              aria-pressed={fullCategory === category}
              onClick={(e) => {
                setFullCategory(category);
                e.currentTarget.scrollIntoView({
                  block: "nearest",
                  inline: "nearest",
                });
              }}
            >
              {category ?? "All"}
            </button>
          ))}
        </div>
      ) : (
        <div className="part-filters" role="group" aria-label="Filter parts">
          {[undefined, "Favourites", "LDraw", ...partCategories].map(
            (category) =>
              category === "LDraw" ? (
                <button
                  key="ldraw"
                  className="library-scope"
                  aria-pressed={false}
                  title="Browse every official LDraw part by category"
                  onClick={() => browseFullLibrary(true)}
                >
                  All LDraw parts <Icon name="arrowRight" size={14} />
                </button>
              ) : category === "Favourites" ? (
                <button
                  key="favourites"
                  aria-pressed={favouritesOnly}
                  onClick={() => {
                    setPartCategory(undefined);
                    setFavouritesOnly((v) => !v);
                  }}
                >
                  <Icon name="star" size={14} filled /> Favourites
                </button>
              ) : (
                <button
                  key={category ?? "all"}
                  aria-pressed={partCategory === category && !favouritesOnly}
                  onClick={(e) => {
                    setPartCategory(category);
                    setFavouritesOnly(false);
                    e.currentTarget.scrollIntoView({
                      block: "nearest",
                      inline: "nearest",
                    });
                  }}
                >
                  {category ?? "All"}
                </button>
              ),
          )}
        </div>
      )}
    </>
  );
  const partsPanel = (
    <>
      <div className="panel-title color-title">
        <h2>Colour</h2>
        <span>{colors.find((c) => c.code === color)?.name}</span>
      </div>
      <ColorPicker
        color={color}
        onChoose={setColor}
        partId={currentPart.id}
        partName={currentPart.name}
      />
      {!browseAll &&
        !search &&
        !favouritesOnly &&
        !partCategory &&
        recentParts.length > 0 && (
          <>
            <h3 className="parts-heading">Recently used</h3>
            <div className="part-chips recent-parts">
              {recentParts.map((id) => (
                <button
                  key={id}
                  aria-pressed={part === id}
                  onClick={() => choosePart(id)}
                >
                  <PartThumb part={partSpec(id)!} color={heldHex} />
                  {partSpec(id)!.name}
                </button>
              ))}
            </div>
          </>
        )}
      {!browseAll &&
        related.length > 0 &&
        visibleParts.length > 0 &&
        !search &&
        !partCategory &&
        !favouritesOnly && (
          <>
            <h3 className="parts-heading related-title">
              Related to {currentPart.name}
            </h3>
            <div className="part-chips recent-parts related-parts">
              {related.map((r) => (
                <button key={r.id} onClick={() => choosePart(r.id)}>
                  {r.name}
                </button>
              ))}
            </div>
          </>
        )}
      {!browseAll && visibleParts.length === 0 && (
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
      {!browseAll &&
        visibleParts.length > 0 &&
        groupedParts.map((group) => (
          <section key={group.category} className="part-group">
            <h3 className="parts-heading">
              {group.category}
              <span className="parts-heading-count">
                {group.parts.length}
                {group === groupedParts[0] && (
                  <span className="offline-tag"> · Offline</span>
                )}
              </span>
            </h3>
            <div className="part-grid">{group.parts.map(partCard)}</div>
          </section>
        ))}
      {(browseAll || search.trim()) && (
        <section
          className="part-group full-library"
          aria-label="All LDraw parts"
        >
          <h3 className="parts-heading">
            {browseAll
              ? (fullCategory ?? "All LDraw parts")
              : "All LDraw parts"}
            {fullEntries && (
              <span className="parts-heading-count">
                {fullCount.toLocaleString("en")}
              </span>
            )}
          </h3>
          {!fullScope ? (
            <button className="full-library-search" onClick={searchAllParts}>
              <Icon name="search" size={16} /> Search every official LDraw part
            </button>
          ) : fullScopeError ? (
            <p className="muted" role="status">
              {fullScopeError}
            </p>
          ) : !fullEntries ? (
            <p className="muted" role="status">
              Loading the official part list…
            </p>
          ) : (
            <FullLibraryResults
              entries={fullEntries}
              query={search}
              category={browseAll ? fullCategory : undefined}
              exclude={excludeCurated}
              browse={browseAll}
              chosen={part}
              color={heldHex}
              onChoose={chooseFullPart}
            />
          )}
        </section>
      )}
      <p className="muted">
        Colours BrickLink lists for a part are audited for it; other
        combinations need inventory review.
      </p>
      <div className="library-note">
        <Icon name="info" size={18} />
        <div>
          <strong>Real LDraw geometry</strong>
          <p>
            {catalogParts.length} official parts · Grid and connector placement
            <br />
            {connectorCoverage.verified} with verified connectors.
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
          Add
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
    </>
  );
  const selectionTools = (
    <SelectionTools
      shape={regionShape}
      operation={selectionOperation}
      depth={selectionDepth}
      rule={regionRules[selectionDepth]}
      floorOnly={floorOnly}
      regionMode={regionMode}
      onShape={setRegionShape}
      onOperation={setSelectionOperation}
      onDepth={setSelectionDepth}
      onRule={(rule) =>
        setRegionRules((rules) => ({ ...rules, [selectionDepth]: rule }))
      }
      onFloorOnly={setFloorOnly}
      onRegionMode={(on) => {
        setRegionMode(on);
        if (!on) return;
        setTool("Select");
        setPickingFace(false);
        // Phones and tablets: put the sheet away so the model is free to draw on.
        if (window.matchMedia("(max-width: 1100px)").matches)
          setPanel("Canvas");
        setStatus("Drag on the model to select.");
      }}
      hasSelection={selected.length > 0}
      onClear={() => setSelectionSafe([])}
      onMatch={(kind) => {
        // A selection made here is for editing: hold Select (handles need it).
        if (interact.current.tool !== "Select") pickTool("Select");
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
        // Show what was selected: back from Tools to the Inspector.
        if (matches.length) setInspectorTools(false);
      }}
      onConnected={() => {
        if (interact.current.tool !== "Select") pickTool("Select");
        const p = editor.project,
          s = interact.current,
          seeds = selectionRef.current;
        const everything = occurrences(p);
        const { occurrenceIds, uncoveredSeeds } = connectedAssembly(
          p,
          seeds,
          everything,
        );
        const chosen = eligibleSelection(
          p,
          everything,
          occurrenceIds,
          s.activeLayer,
          s.crossLayer,
        );
        setSelectionSafe(chosen);
        if (chosen.length) setInspectorTools(false);
        const skipped = occurrenceIds.length - chosen.length;
        setStatus(
          `Selected ${chosen.length} connected part${chosen.length === 1 ? "" : "s"}.` +
            (skipped > 0
              ? ` ${skipped} connected part${skipped === 1 ? " is" : "s are"} hidden, locked or outside the editable layer.`
              : "") +
            (uncoveredSeeds.length
              ? ` ${uncoveredSeeds.length} selected part${uncoveredSeeds.length === 1 ? " has" : "s have"} no verified connector data.`
              : ""),
        );
      }}
    />
  );
  const replaceTool = selected.length > 0 && (
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
          const remapped = (result as { idRemappings?: Record<string, string> })
            .idRemappings;
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
  );
  // The selection's everyday actions: the Inspector's quick actions and the
  // phone selection strip share them.
  const rotateSelected = () =>
    void run(() => {
      ensure(
        selected.length === 1,
        "INVALID_INPUT",
        "Select one part to rotate",
      );
      const transform = {
        position: selected[0].transform.position,
        basis: compose(
          { position: [0, 0, 0], basis: rotationY(90) },
          { position: [0, 0, 0], basis: selected[0].transform.basis },
        ).basis,
      };
      const refusal = moveRefusal({ [selected[0].id]: transform });
      if (refusal) {
        setStatus(refusal);
        return;
      }
      command("parts.transform", { ...scoped(), space: "ldraw", transform });
    });
  const applyColour = () =>
    void run(async () => {
      await command("parts.recolor", {
        ...scoped(),
        colorCode: color,
        preserveFixedColors: true,
      });
      // Said out loud: the strip's Paint uses the hotbar colour at once.
      const name = colors.find((c) => c.code === color)?.name ?? "the colour";
      setStatus(
        `Painted ${selection.length === 1 ? "1 part" : `${selection.length} parts`} ${name.toLowerCase()} · Undo to change back`,
      );
    });
  const duplicateSelected = () =>
    void run(() => command("parts.duplicate", scoped()));
  const deleteSelected = () =>
    void run(() => command("parts.remove", scoped()));
  const inspectorPanel = (
    <>
      <div className="panel-title">
        <h2>Inspector</h2>
        <span>{selection.length} selected</span>
      </div>
      {selected.length ? (
        <>
          <div className="selection-summary">
            {!inspection.part.mixed && partSpec(inspection.part.value.ref) ? (
              <PartThumb
                part={partSpec(inspection.part.value.ref)!}
                color={
                  inspection.color.mixed
                    ? undefined
                    : colorHex(inspection.color.value.code)
                }
              />
            ) : (
              <BrickIcon
                color={
                  inspection.color.mixed
                    ? undefined
                    : colorHex(inspection.color.value.code)
                }
              />
            )}
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
            <dt>Colour</dt>
            <dd>
              {inspection.color.mixed
                ? "Mixed"
                : `${inspection.color.value.name} (${inspection.color.value.code})`}
            </dd>
            <dt>{selected.length === 1 ? "Size" : "Selection size"}</dt>
            <dd>
              {inspection.dimensions ? inspection.dimensions.label : "Unknown"}
              {inspection.dimensions && (
                <small className="muted size-ldu" hidden={!detailsOpen}>
                  {inspection.dimensions.ldu.join(" × ")} LDU incl. studs
                </small>
              )}
            </dd>
            {(detailsOpen || inspection.issues.length > 0) && (
              <>
                <dt>Checks</dt>
                <dd>
                  {inspection.issues.length
                    ? inspection.issues.join("; ")
                    : "No problems found"}
                </dd>
              </>
            )}
            <div className="prop-more" hidden={!detailsOpen}>
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
              <dt>Source</dt>
              <dd>
                {inspection.source.mixed
                  ? "Mixed"
                  : sourceLabels[inspection.source.value]}
              </dd>
            </div>
          </dl>
          <button
            className="text-button details-toggle"
            aria-expanded={detailsOpen}
            onClick={() => setDetailsOpen((v) => !v)}
          >
            {detailsOpen ? "Fewer details" : "More details"}
          </button>
          {detailsOpen && inspection.matrix && (
            <details className="affine-matrix">
              <summary>Placement matrix</summary>
              <p className="muted">Exactly as saved in the LDraw file.</p>
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
          <div className="quick-actions">
            <button onClick={rotateSelected}>
              <Icon name="rotate" size={16} /> Rotate 90°
            </button>
            <button
              onClick={() =>
                void run(() => {
                  const refusal = moveRefusal(nudged([0, -8, 0]));
                  if (refusal) {
                    setStatus(refusal);
                    return;
                  }
                  command("parts.transform", {
                    ...scoped(),
                    delta: [0, -8, 0],
                    space: "ldraw",
                  });
                })
              }
            >
              <Icon name="arrowUp" size={16} /> 1 plate
            </button>
            <button
              onClick={() =>
                void run(() => {
                  const refusal = moveRefusal(nudged([0, 8, 0]));
                  if (refusal) {
                    setStatus(refusal);
                    return;
                  }
                  command("parts.transform", {
                    ...scoped(),
                    delta: [0, 8, 0],
                    space: "ldraw",
                  });
                })
              }
            >
              <Icon name="arrowDown" size={16} /> 1 plate
            </button>
            <button className="quick-colour" onClick={applyColour}>
              <i
                className="quick-swatch"
                style={{ background: colorHex(color) }}
                aria-hidden="true"
              />
              Apply current colour
            </button>
            <button onClick={duplicateSelected}>Duplicate</button>
            <button className="danger" onClick={deleteSelected}>
              Delete
            </button>
          </div>
          <h3 className="position-heading">
            Position <small>20 = 1 stud · 8 = 1 plate</small>
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
          {selected.length > 1 && (
            <p className="muted">
              Position values apply to every selected part.
            </p>
          )}
        </>
      ) : (
        <div className="empty-inspector">
          <span>
            <Icon name="select" size={28} />
          </span>
          <h3>Select a part</h3>
          <p>Tap a part on the model to move, turn or recolour it.</p>
        </div>
      )}
    </>
  );
  // Photo menu sections (src/ui/menus.ts).
  const photoSizeFields = (
    <>
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
    </>
  );
  const photoDownload = (
    <button
      className="primary wide"
      disabled={busy}
      onClick={() => void capture()}
    >
      Download picture <Icon name="arrowDown" size={16} />
    </button>
  );
  const photoViews = (
    <>
      <form
        className="bookmark-form"
        onSubmit={(e) => {
          e.preventDefault();
          void run(() => {
            command("camera.bookmark", {
              name:
                bookmarkName.trim() ||
                "View " + (Object.keys(project.cameraBookmarks).length + 1),
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
            {architectureOf(project).floors.find((f) => f.id === focusFloorId)
              ?.name ?? "floor"}
            ) with this bookmark
          </label>
        )}
        <button className="wide">Save this view</button>
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
    </>
  );
  const photoExact = (
    <>
      <div className="numeric-row">
        {["X", "Y", "Z"].map((axis, i) => (
          <NumberInput
            key={axis}
            label={"Camera " + axis}
            value={camera.position[i]}
            onChange={(n) =>
              setCamera((c) => ({
                ...c,
                position: c.position.map((x, j) => (i === j ? n : x)) as Vec3,
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
                target: c.target.map((x, j) => (i === j ? n : x)) as Vec3,
              }))
            }
          />
        ))}
      </div>
      <div className="button-row">
        <button
          onClick={() => void run(() => renderer.current?.setCamera(camera))}
        >
          Apply exact camera
        </button>
        <button
          onClick={() => setCamera(renderer.current?.currentCamera() || camera)}
        >
          Read current view
        </button>
      </div>
    </>
  );
  const photoCollection = (
    <CameraCollections
      api={api.current!}
      bookmarks={Object.keys(project.cameraBookmarks)}
      size={photoSize}
      transparent={transparent}
      download={download}
      onStatus={setStatus}
    />
  );
  const photoQuality = <QualityPanel renderer={renderer.current} />;
  const bookmarkCount = Object.keys(project.cameraBookmarks).length;
  // Instructions menu sections.
  const generateSteps = (
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
      One step per layer
    </button>
  );
  const restoreInstructionPlacement = (camera?: CameraSpec) => {
    if (!plan) return;
    const state = instructionDisplayState(plan, step);
    renderer.current?.showStep(
      state.displayIds,
      dimPrevious ? state.highlightIds : undefined,
    );
    if (camera) showInstructionCamera(camera);
  };
  const instructionEditor = (
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
  );
  const heuristicSteps = (
    <>
      <button
        className="wide"
        disabled={generatingInstructions}
        onClick={() =>
          void run(async () => {
            const token = ++instructionGenerationToken.current;
            const source = editor.project;
            setGeneratingInstructions(true);
            setStatus("Preparing instruction draft…");
            try {
              await renderer.current?.ready(source.revision, false);
              if (token !== instructionGenerationToken.current) return;
              ensure(
                editor.projectId === source.id &&
                  editor.revision === source.revision,
                "REVISION_CONFLICT",
                "Model changed while preparing instructions; generate again.",
              );
              const job = startInstructionGeneration(source, { maxPerStep: 6 });
              instructionGenerationJob.current = job;
              setStatus(
                "Planning instructions… You can cancel or keep using the editor.",
              );
              const generated = await job.result;
              if (token !== instructionGenerationToken.current) return;
              ensure(
                editor.projectId === source.id &&
                  editor.revision === source.revision,
                "REVISION_CONFLICT",
                "Model changed while generating instructions; generate again.",
              );
              const result = command("instructions.installGenerated", {
                plan: generated,
              });
              setDimPrevious(true);
              setActivePlanId(result.addedPlanIds[0]);
              setStep(0);
              setStatus("Instruction draft ready for review.");
            } catch (e) {
              if (token !== instructionGenerationToken.current) return;
              throw e;
            } finally {
              if (token === instructionGenerationToken.current) {
                instructionGenerationJob.current = undefined;
                setGeneratingInstructions(false);
              }
            }
          })
        }
      >
        {generatingInstructions
          ? "Generating instructions…"
          : "Make steps automatically"}
      </button>
      {generatingInstructions && (
        <button
          className="wide"
          onClick={() => {
            instructionGenerationToken.current++;
            instructionGenerationJob.current?.cancel();
            instructionGenerationJob.current = undefined;
            setGeneratingInstructions(false);
            setStatus("Instruction generation cancelled.");
          }}
        >
          Cancel instruction generation
        </button>
      )}
      {plan?.generation && (
        <details>
          <summary>Generated plan review</summary>
          <p>
            These findings describe the model when this plan was generated.
            Review again after edits.
          </p>
          <ul>
            {plan.generation.insertionFingerprint &&
              !insertionChecksCurrent(project, plan) && (
                <li>
                  Geometry or step order changed. Saved totals describe the
                  original draft; regenerate the approach checks.
                </li>
              )}
            {plan.generation.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </details>
      )}
    </>
  );
  const stepNavigator = plan && (
    <>
      <h3>{plan.name}</h3>
      <p>
        Step {plan.steps.length ? step + 1 : 0} of {plan.steps.length}
        {plan.presentation !== "pictorial" &&
          ![
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
          ].includes(plan.generation?.algorithm ?? "") && (
            <> · {plan.steps[step]?.length ?? 0} new parts</>
          )}
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
      {plan.stepMetadata?.[step]?.insertionChecks && (
        <p className="instruction-approach" role="status">
          {insertionSummary(
            effectiveInsertionChecks(project, plan, plan.stepMetadata[step]),
          )}
        </p>
      )}
      {plan.stepMetadata?.[step]?.assembly && (
        <p>{instructionDisplayState(plan, step).operationLabel}</p>
      )}
      <InstructionTray
        project={project}
        ids={plan.steps[step] ?? []}
        physical={
          plan.presentation === "pictorial" ||
          [
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
          ].includes(plan.generation?.algorithm ?? "")
        }
      />
      {plan.stepMetadata?.[step]?.assembly?.type === "join" && (
        <div className="button-row">
          <button
            onClick={() => {
              const state = instructionDisplayState(plan, step);
              renderer.current?.showStep(state.incomingIds ?? []);
              showInstructionCamera(
                plan.stepMetadata![step].incomingCamera ??
                  plan.stepMetadata![step].camera!,
              );
            }}
          >
            Show completed candidate
          </button>
          <button
            onClick={() => {
              const state = instructionDisplayState(plan, step);
              renderer.current?.showStep(
                state.displayIds,
                dimPrevious ? state.highlightIds : undefined,
              );
              showInstructionCamera(plan.stepMetadata![step].camera!);
            }}
          >
            Show join destination
          </button>
        </div>
      )}
      {plan.stepMetadata?.[step]?.completedDetail && (
        <button
          className="wide"
          onClick={() => {
            const detail = plan.stepMetadata![step].completedDetail!;
            renderer.current?.showStep(
              detail.occurrenceIds,
              dimPrevious
                ? instructionDisplayState(plan, step).highlightIds
                : undefined,
            );
            showInstructionCamera(detail.camera);
          }}
        >
          Show joint detail — access unverified
        </button>
      )}
      {plan.stepMetadata?.[step]?.alternateCamera && (
        <button
          className="wide"
          onClick={() => {
            if (plan.stepMetadata![step].alternateBeforePlacement) {
              renderer.current?.showStep(instructionAlternateIds(plan, step));
            }
            showInstructionCamera(plan.stepMetadata![step].alternateCamera!);
          }}
        >
          {plan.stepMetadata![step].alternateDetailIds
            ? "Show receiver detail — access unverified"
            : plan.stepMetadata![step].alternateBeforePlacement
              ? "Show receiver before placement"
              : "Show another view"}
        </button>
      )}
      {plan.stepMetadata?.[step]?.alternateBeforePlacement &&
        plan.stepMetadata[step].assembly?.type !== "join" &&
        !plan.stepMetadata[step].contextCamera && (
          <button
            className="wide"
            onClick={() =>
              restoreInstructionPlacement(plan.stepMetadata![step].camera)
            }
          >
            Show placement
          </button>
        )}
      {plan.stepMetadata?.[step]?.contextCamera && (
        <div className="button-row">
          <button
            onClick={() =>
              restoreInstructionPlacement(
                plan.stepMetadata![step].contextCamera,
              )
            }
          >
            Show whole assembly
          </button>
          <button
            onClick={() =>
              restoreInstructionPlacement(plan.stepMetadata![step].camera)
            }
          >
            Show placement close-up
          </button>
        </div>
      )}
    </>
  );
  const planJson = plan && (
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
  );
  const instructionsPublish = (
    <InstructionsPublish
      dimPrevious={dimPrevious}
      onDimPreviousChange={setDimPrevious}
      project={project}
      planId={currentPlanId}
      renderer={renderer.current}
    />
  );
  // Browser history mirrors Gallery → detail → model, so Back (and a
  // phone's back gesture) steps out instead of leaving the site.
  type GalleryNav =
    | { view: "grid" }
    | { view: "detail"; id: string }
    | { view: "model" };
  const navDepth = useRef(0);
  const pushNav = (nav: GalleryNav) => {
    navDepth.current++;
    // A detail page's address opens it again (?gallery=<id>).
    const url = new URL(location.href);
    if (nav.view === "detail") url.searchParams.set("gallery", nav.id);
    else url.searchParams.delete("gallery");
    history.pushState(
      { ...history.state, brickNav: nav, brickDepth: navDepth.current },
      "",
      url,
    );
  };
  /** Steps back through our own entries, or runs `fallback` at the first. */
  const navBack = (fallback: () => void) => {
    if (navDepth.current > 0) history.back();
    else fallback();
  };
  useEffect(() => {
    history.replaceState(
      {
        ...history.state,
        brickNav: galleryOpenRef.current
          ? galleryDetail
            ? { view: "detail", id: galleryDetail }
            : { view: "grid" }
          : { view: "model" },
        brickDepth: 0,
      },
      "",
    );
    const restore = (event: PopStateEvent) => {
      const nav = event.state?.brickNav as GalleryNav | undefined;
      if (!nav) return;
      navDepth.current = event.state.brickDepth ?? 0;
      if (nav.view === "model") {
        setModesOpen(false);
        setGalleryOpen(false);
        return;
      }
      play.current?.exit();
      mechanisms.current?.exit();
      setModesOpen(false);
      setGalleryDetail(nav.view === "detail" ? nav.id : undefined);
      setGalleryOpen(true);
    };
    window.addEventListener("popstate", restore);
    return () => window.removeEventListener("popstate", restore);
  }, []);
  const showDetail = (id?: string) => {
    setGalleryError("");
    if (id) {
      pushNav({ view: "detail", id });
      setGalleryDetail(id);
    } else navBack(() => setGalleryDetail(undefined));
  };
  const enterMode = (m: typeof mode) => {
    // Leaving Play for a tool ends the walk rather than leaving it hidden.
    if (m !== "Play" && play.current?.getState().active) play.current.exit();
    if (galleryOpenRef.current) pushNav({ view: "model" });
    galleryOpenRef.current = false;
    setGalleryOpen(false);
    setModesOpen(false);
    if (m === mode) return;
    setMode(m);
    if (m !== "Build") setPanel("Canvas");
    if (m === "Photo") setCamera(renderer.current?.currentCamera() || camera);
  };
  // A tap outside the Tools menu closes it, as Escape does.
  useEffect(() => {
    if (!modesOpen) return;
    const outside = (event: PointerEvent) => {
      if (
        event.target instanceof Element &&
        !event.target.closest(".model-tool-picker")
      )
        setModesOpen(false);
    };
    document.addEventListener("pointerdown", outside, true);
    return () => document.removeEventListener("pointerdown", outside, true);
  }, [modesOpen]);
  useEffect(() => {
    if (!modesOpen) return;
    const close = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      setModesOpen(false);
      document.querySelector<HTMLButtonElement>(".model-tools-toggle")?.focus();
    };
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, [modesOpen]);
  const showGallery = () => {
    if (!galleryOpenRef.current || galleryDetail) pushNav({ view: "grid" });
    galleryOpenRef.current = true;
    play.current?.exit();
    mechanisms.current?.exit();
    setModesOpen(false);
    setGalleryDetail(undefined);
    setGalleryOpen(true);
  };
  useEffect(() => {
    if (!galleryOpen || gallerySource.state === "ready") return;
    if (!galleryIndexEnabled(location)) {
      setGallerySource({
        state: "failed",
        message:
          "This local copy does not read the published gallery (add ?galleryIndex=1).",
      });
      return;
    }
    let live = true;
    setGallerySource({ state: "loading" });
    loadGalleryIndex()
      .then((index) => {
        if (live)
          setGallerySource({ state: "ready", prompts: galleryPrompts(index) });
      })
      .catch((e: Error) => {
        if (live) setGallerySource({ state: "failed", message: e.message });
      });
    return () => {
      live = false;
    };
  }, [galleryOpen, galleryAttempt]);
  /** Opens a published build as a new local project: its MPD is fetched and
   * checked against the index (size, SHA-256, library release) first. */
  async function openGalleryModel(
    entry: GalleryEntry,
    destination: ModelTool | "Play",
  ) {
    if (galleryPending) return;
    // The open document already is this build's copy: resume it.
    if (currentGalleryModel?.id === entry.id) {
      enterMode(destination);
      return;
    }
    setGalleryPending(entry.id);
    setGalleryError("");
    try {
      await applicationAPI.ready();
      await replaceProject(`“${entry.title}”`, async () => {
        const epoch = ++operationEpoch.current;
        const text = await fetchGalleryModel(entry.build, entry.files, {
          maxBytes: resourceLimits(editor.resourceProfile).importBytes,
          locks: [libraryLock, ...retiredLibraryLocks],
        });
        ensure(
          epoch === operationEpoch.current,
          "CANCELLED",
          "Opening the model was cancelled",
        );
        renderer.current?.requestFitOnFirstParts();
        setBusy(true);
        try {
          const result = await applicationAPI.project.import({
            format: "ldraw",
            text,
            name: `${entry.title}.mpd`,
          });
          if (result.materialization.status === "limited") return;
          setGalleryModel({ entry, projectId: editor.projectId });
          setActiveLayer(editor.project.defaultLayerId);
          setSelectionSafe([]);
          setPanel("Canvas");
          enterMode(destination);
          // The document is open: drawing it must not hold the gallery.
          setGalleryPending(undefined);
          await renderer.current?.ready();
          renderer.current?.fit();
          setStatus(
            `Opened “${entry.title}” · ${entry.agent}` +
              (entry.effort ? ` · ${entry.effort} effort` : ""),
          );
        } finally {
          renderer.current?.requestFitOnFirstParts(false);
          setBusy(false);
        }
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setGalleryError(message);
      setGalleryRetry({ entry, destination });
      setStatus(message);
    } finally {
      setGalleryPending(undefined);
    }
  }
  const currentGalleryModel =
    galleryModel?.projectId === project.id ? galleryModel.entry : undefined;
  // Build tools (the Inspector's advanced drawers).
  const toolsTab = inspectorTools;
  const modelTools = (
    <ModelTools
      editor={editor}
      selection={selection}
      activeLayerId={crossLayer ? undefined : activeLayer}
      onSelect={setSelectionSafe}
    />
  );
  const rigAuthoring = (
    <RigAuthoring
      editor={editor}
      project={project}
      occurrences={available ? all : undefined}
      selection={selection}
      activeLayerId={crossLayer ? undefined : activeLayer}
      onSelect={setSelectionSafe}
    />
  );
  const seatAuthoring = (
    <SeatAuthoring
      editor={editor}
      project={project}
      activeLayerId={crossLayer ? undefined : activeLayer}
    />
  );
  const rigPhysics = (
    <RigPhysicsAuthoring
      editor={editor}
      project={project}
      activeLayerId={crossLayer ? undefined : activeLayer}
    />
  );
  const workplanePanel = (
    <WorkplanePanel
      value={workplane}
      onChange={updateWorkplane}
      pickingFace={pickingFace === "face"}
      pickingStud={pickingFace === "stud"}
      onPickStud={() => {
        setPickingFace("stud");
        setTool("Select");
        setPanel("Canvas");
        setStatus("Tap a stud to put the workplane on it.");
      }}
      onCancelPick={() => setPickingFace(false)}
      onPickFace={() => {
        setPickingFace("face");
        setTool("Select");
        setPanel("Canvas");
        setStatus("Tap a visible model face to align the workplane.");
      }}
    />
  );
  // Project menu sections.
  const projectLibraryUpdate = api.current && (
    <LibraryUpdatePanel
      api={api.current}
      project={project}
      onStatus={setStatus}
    />
  );
  const projectLdraw = (
    <button className="wide" onClick={() => void exportFile("ldraw")}>
      Export LDraw MPD <Icon name="arrowDown" size={16} />
    </button>
  );
  // Four samples, then the rest on request: the New tab stays short.
  const projectTemplates = (
    <>
      <div className="template-grid">
        {(allTemplates ? TEMPLATE_CARDS : TEMPLATE_CARDS.slice(0, 4)).map(
          (card) => {
            const preview = templatePreview(card.name);
            return (
              <button
                key={card.name}
                className="template-card"
                onClick={() => chooseTemplate(card.name)}
              >
                {preview ? (
                  <img
                    src={import.meta.env.BASE_URL + preview}
                    alt=""
                    width={160}
                    height={120}
                    loading="lazy"
                  />
                ) : (
                  <span className="template-blank" aria-hidden="true" />
                )}
                <span>{card.title}</span>
              </button>
            );
          },
        )}
      </div>
      <button
        className="text-button template-more"
        aria-expanded={allTemplates}
        onClick={() => setAllTemplates((v) => !v)}
      >
        {allTemplates
          ? "Show fewer templates"
          : `Show all ${TEMPLATE_CARDS.length} templates`}
      </button>
    </>
  );
  const projectOfficial = (
    <OfficialSets open={openOfficialSet} credit={omrCreditInfo} busy={busy} />
  );
  const projectProfiles = (
    <ExportProfiles project={project} selection={selection} />
  );
  const projectShare = (
    <SharePanel
      project={project}
      open={(shared) =>
        replaceOrKeep("the shared model", async () => {
          editor.replace(shared);
          await renderer.current?.ready();
          renderer.current?.fit();
          setPanel("Canvas");
          setMode("Build");
        })
      }
    />
  );
  const projectSaved = (
    <ProjectLibrary
      currentId={project.id}
      open={(saved) =>
        replaceOrKeep(`“${saved.title}”`, async () => {
          await autosave.current?.flush();
          saveRevisions.current.set(saved.id, saved.revision);
          nextOpenStored.current = true;
          editor.replace(saved);
          setSaveConflict(false);
          setMode("Build");
          setPanel("Canvas");
          await renderer.current?.ready();
          renderer.current?.fit();
        })
      }
    />
  );
  const projectCheckpoints = (
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
  );
  const projectHealth = (
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
  );
  const projectLimits = (
    <ResourceProfilePanel editor={editor} onStatus={setStatus} />
  );
  const projectShortcuts = (
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
  );
  const projectAbout = (
    <>
      <p>
        Six pinned LDraw parts, local files, clipboard and arrays, layers,
        inventory, image and instruction publishing, Play exploration and
        kinematic mechanisms. Official textured parts show their printed images.
        Connector snapping, dynamic suspension and advanced assembly planning
        remain unavailable.
      </p>
      <a
        href={import.meta.env.BASE_URL + "notices/LDRAW.txt"}
        target="_blank"
        rel="noreferrer"
      >
        LDraw attribution and licences <Icon name="external" size={14} />
      </a>
    </>
  );
  return (
    <div
      ref={appRoot}
      className={
        "app workshop-app mode-" +
        mode.toLowerCase() +
        (galleryOpen ? " gallery-open" : "") +
        (guideOpen ? " guide-open" : "") +
        (panel !== "Canvas" ? " sheet-open" : "") +
        (sheetFull ? " sheet-full" : "")
      }
    >
      <header className="site-header">
        <button
          className="site-brand"
          aria-label="brickeditor gallery"
          onClick={showGallery}
        >
          <svg viewBox="0 0 28 32" aria-hidden="true">
            <path fill="#f48a4d" d="M3 12h22v18H3zM6 4h6v8H6zm10 0h6v8h-6z" />
            <path
              stroke="#faf7f1"
              strokeWidth="2"
              d="M8 19v5m6-5v5m6-5v5M9 6v4m10-4v4"
            />
          </svg>
          <span>brickeditor</span>
        </button>
        <nav className="primary-modes" aria-label="Main modes">
          <button aria-pressed={galleryOpen} onClick={showGallery}>
            Gallery
          </button>
          <button
            aria-pressed={!galleryOpen && mode === "Play"}
            disabled={!!galleryPending}
            onClick={() => {
              void run(async () => {
                await applicationAPI.ready();
                // From a detail page, Play walks the build on screen; an
                // empty canvas walks the first published build instead.
                const builds =
                  gallerySource.state === "ready"
                    ? gallerySource.prompts.flatMap((p) => p.entries)
                    : [];
                const target = galleryOpen
                  ? galleryDetail
                    ? builds.find((e) => e.id === galleryDetail)
                    : occurrences(editor.project).length
                      ? undefined
                      : builds[0]
                  : undefined;
                if (target) await openGalleryModel(target, "Play");
                else enterMode("Play");
              });
            }}
          >
            Play
          </button>
        </nav>
        <button
          className="site-open"
          disabled={!!galleryPending}
          onClick={() => fileInput.current?.click()}
        >
          <Icon name="arrowUp" size={18} />
          <span>Open your model</span>
        </button>
      </header>
      {galleryOpen && (
        <Gallery
          source={gallerySource}
          onRetry={() => setGalleryAttempt((n) => n + 1)}
          maxBytes={resourceLimits(editor.resourceProfile).importBytes}
          detailId={galleryDetail}
          onDetail={showDetail}
          openId={currentGalleryModel?.id}
          resume={
            all.length
              ? {
                  title: currentGalleryModel?.title ?? project.title,
                  go: () => enterMode(mode),
                }
              : undefined
          }
          onOpen={(s, m) => void openGalleryModel(s, m)}
          onImport={() => fileInput.current?.click()}
          pending={galleryPending}
          error={galleryError}
          errorTitle={galleryRetry?.entry.title}
          onRetryOpen={() =>
            galleryRetry &&
            void openGalleryModel(galleryRetry.entry, galleryRetry.destination)
          }
          onDismissError={() => setGalleryError("")}
        />
      )}
      {!galleryOpen && (
        <div className="model-context">
          <div className="model-heading">
            <button
              aria-label="Back to gallery"
              onClick={() => navBack(showGallery)}
            >
              <Icon name="arrowLeft" size={18} />
            </button>
            <div>
              <strong>{currentGalleryModel?.title ?? project.title}</strong>
              <span>
                {currentGalleryModel && (
                  <>
                    <span className="model-agent">
                      {currentGalleryModel.agent} ·{" "}
                    </span>
                    {currentGalleryModel.effort
                      ? `${currentGalleryModel.effort} effort · `
                      : ""}
                  </>
                )}
                {all.length.toLocaleString("en")} parts
              </span>
            </div>
          </div>
          <div className="model-tool-picker">
            <button
              className="model-tools-toggle"
              aria-label="Model tools"
              aria-expanded={modesOpen}
              aria-controls="model-tools-menu"
              onClick={() => {
                // From Play the walk waits, paused, while the menu is open;
                // choosing another view ends it (enterMode), closing resumes
                // the pause sheet.
                if (play.current?.getState().active) play.current.pause(true);
                setModesOpen((open) => !open);
              }}
            >
              <Icon name="inspector" size={18} />
              Tools
              <Icon name="collapse" size={16} />
            </button>
            {modesOpen && (
              <nav
                className="model-tools-menu"
                id="model-tools-menu"
                aria-label="Editor mode"
              >
                <div className="model-tools-title">
                  <h2>Your building kit.</h2>
                  <button
                    aria-label="Close model tools"
                    onClick={() => setModesOpen(false)}
                  >
                    <Icon name="close" size={18} />
                  </button>
                </div>
                <p>A whole workshop, whenever you need it.</p>
                {MODEL_VIEWS.map((t) => (
                  <button
                    key={t.name}
                    aria-label={t.name}
                    aria-pressed={mode === t.name}
                    onClick={() => enterMode(t.name)}
                  >
                    <span className="model-tool-icon">
                      <Icon name={t.name.toLowerCase() as IconName} />
                    </span>
                    <span>
                      <strong>{t.name}</strong>
                      <small>{t.description}</small>
                    </span>
                    <Icon name="arrowRight" size={18} />
                  </button>
                ))}
                <small>Your changes stay on this device.</small>
              </nav>
            )}
          </div>
        </div>
      )}
      <div className="hud-top hud-el">
        <button
          className="workspace-tool-label hud-slab"
          onClick={() => setModesOpen((open) => !open)}
        >
          <Icon name={mode.toLowerCase() as IconName} size={18} />
          {mode}
        </button>
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
            {/* Autosave keeps the build on this device; this downloads a
                backup file, so it says so rather than reading as status. */}
            <Icon name="save" />
            <span className="tool-label">Download backup</span>
            <span className="save-chip" aria-hidden="true">
              Backup
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
          {/* Search and filters stay in reach while hundreds of parts scroll. */}
          <div className="parts-sticky">
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
            {partsToolbar}
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
          {guideOpen && available && (
            <InstructionViewer
              project={project}
              all={all}
              renderer={renderer.current ?? null}
              onClose={() => setGuideOpen(false)}
              initialPlanId={currentPlanId}
              onPartsList={() => setPartsListOpen(true)}
            />
          )}
          <div
            className={"view-controls hud-el" + (viewsOpen ? " open" : "")}
            aria-label="Camera views"
            role="group"
          >
            <div className="view-tabs" role="group" aria-label="View options">
              {(["Angle", "Cut", "Floors", "Look"] as const)
                .filter((t) => t !== "Floors" || mode !== "Play")
                .map((t) => (
                  <button
                    key={t}
                    aria-pressed={viewTab === t}
                    onClick={() => {
                      setViewTab(t);
                      if (
                        t === "Floors" &&
                        architectureOf(project).floors.length
                      )
                        setFloorGuides(true);
                    }}
                  >
                    {t}
                    {((t === "Cut" &&
                      (section !== null || explodeBricks > 0 || anatomyOn)) ||
                      (t === "Floors" && focusFloorId !== null)) && (
                      <i className="view-tab-on" aria-hidden="true" />
                    )}
                  </button>
                ))}
            </div>
            {viewTab === "Angle" && (
              <div className="view-pane view-angles">
                <button
                  title="Fit the whole model in a 3D view"
                  onClick={() => renderer.current?.fit()}
                >
                  Fit
                </button>
                {(["Top", "Front", "Side"] as const).map((v) => (
                  <button
                    key={v}
                    onClick={() =>
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
                      })
                    }
                  >
                    {v}
                  </button>
                ))}
              </div>
            )}
            {viewTab === "Cut" && (
              <div className="view-pane">
                <div className="section-control">
                  <button
                    className="view-switch"
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
                  {section !== null && sectionRange ? (
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
                  ) : (
                    <p className="view-hint">Slice the model to see inside.</p>
                  )}
                </div>
                <div className="section-control explode-control">
                  <div
                    className="explode-switches"
                    role="group"
                    aria-label="Exploded views"
                  >
                    <button
                      className="view-switch"
                      aria-pressed={explodeBricks > 0}
                      onClick={() => {
                        if (explodeBricks) {
                          setExplodeBricks(0);
                          setStatus(
                            "Floors assembled. Editing tools are back.",
                          );
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
                    <button
                      className="view-switch"
                      aria-pressed={anatomyOn}
                      title="Take the model apart by its submodels"
                      onClick={() => {
                        const r = renderer.current;
                        if (!r) return;
                        if (anatomyOn) {
                          r.setAnatomy({ on: false });
                          setStatus(
                            "Put back together. Editing tools are back.",
                          );
                          return;
                        }
                        setExplodeBricks(0);
                        setTool("Navigate");
                        const next = r.setAnatomy({ on: true });
                        if (next.on) {
                          r.fitAnatomy();
                          // Phones: the pane would hide the model coming apart.
                          if (window.matchMedia("(max-width: 1100px)").matches)
                            setViewsOpen(false);
                        }
                        setStatus(
                          next.on
                            ? `Anatomy: ${next.movers + 1} groups by ${next.basis === "submodels" ? "submodel" : next.basis === "layers" ? "layer" : "section"}. Tap one to isolate it; editing is paused.`
                            : "Nothing to take apart: the model needs submodels, layers or separate sections.",
                        );
                      }}
                    >
                      {anatomyOn ? "Put together" : "Anatomy"}
                    </button>
                  </div>
                  {explodeBricks > 0 ? (
                    <label>
                      <span className="section-label">
                        {explodeBricks} brick{explodeBricks === 1 ? "" : "s"}{" "}
                        apart
                      </span>
                      <input
                        type="range"
                        aria-label="Explode spread"
                        min={1}
                        max={20}
                        step={1}
                        value={explodeBricks}
                        onChange={(e) =>
                          setExplodeBricks(Number(e.target.value))
                        }
                      />
                    </label>
                  ) : anatomy?.on ? (
                    <>
                      <label>
                        <span className="section-label">
                          Spread {Math.round(anatomy.spread * 100)}%
                        </span>
                        <input
                          type="range"
                          aria-label="Anatomy spread"
                          min={50}
                          max={300}
                          step={25}
                          value={Math.round(anatomy.spread * 100)}
                          onChange={(e) =>
                            renderer.current?.setAnatomy({
                              spread: Number(e.target.value) / 100,
                            })
                          }
                        />
                      </label>
                      {(() => {
                        const focused = anatomy.groups.find(
                          (g) => g.key === anatomy.focus,
                        );
                        return (
                          <div className="anatomy-row">
                            <label className="floor-check">
                              <input
                                type="checkbox"
                                checked={anatomy.guides}
                                onChange={(e) =>
                                  renderer.current?.setAnatomy({
                                    guides: e.target.checked,
                                  })
                                }
                              />
                              Guides
                            </label>
                            {focused ? (
                              <button
                                className="anatomy-focus"
                                title="Show every group"
                                onClick={() =>
                                  renderer.current?.setAnatomy({ focus: null })
                                }
                              >
                                <span>{focused.name}</span>
                                <small>
                                  {focused.parts} part
                                  {focused.parts === 1 ? "" : "s"}
                                </small>
                                <span aria-hidden="true">×</span>
                              </button>
                            ) : (
                              <p className="view-hint">
                                Tap a group to isolate it.
                              </p>
                            )}
                          </div>
                        );
                      })()}
                    </>
                  ) : (
                    <p className="view-hint">
                      Lift the floors apart, or take the model apart by its
                      submodels.
                    </p>
                  )}
                </div>
              </div>
            )}
            {viewTab === "Floors" && mode !== "Play" && (
              <div className="view-pane">
                <FloorControls
                  project={project}
                  command={command}
                  run={run}
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
                  exploded={explodeBricks > 0 || anatomyOn}
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
              </div>
            )}
            {viewTab === "Look" && (
              <div className="view-pane">
                <div
                  className="look-control"
                  role="group"
                  aria-label="Render look"
                >
                  {LOOK_NAMES.map((name) => (
                    <button
                      key={name}
                      aria-pressed={renderLook === name}
                      onClick={() => chooseLook(name)}
                    >
                      {name === "standard"
                        ? "Standard"
                        : name === "realistic"
                          ? "Realistic"
                          : "Photo"}
                    </button>
                  ))}
                </div>
                <div className="look-hint">
                  <p className="view-hint">
                    {renderLook === "standard"
                      ? "Flat colours with outlines. Fastest."
                      : renderLook === "realistic"
                        ? "Shiny plastic and soft shadows."
                        : "Sharpens itself while the view is still."}
                  </p>
                  {renderLook === "standard" && (
                    <label className="backdrop-grid">
                      <input
                        type="checkbox"
                        checked={softEdges}
                        onChange={(e) => toggleSoftEdges(e.target.checked)}
                      />
                      Soft outlines
                    </label>
                  )}
                </div>
                <div className="backdrop-control">
                  <div className="backdrop-head">
                    <span id="backdrop-title">Backdrop</span>
                    <label className="backdrop-grid">
                      <input
                        type="checkbox"
                        checked={gridOn}
                        onChange={(e) => toggleGrid(e.target.checked)}
                      />
                      Grid
                    </label>
                  </div>
                  <div
                    className="backdrop-swatches"
                    role="group"
                    aria-labelledby="backdrop-title"
                  >
                    {BACKDROP_NAMES.map((name) => (
                      <button
                        key={name}
                        aria-pressed={backdrop === name}
                        aria-label={BACKDROPS[name].label}
                        title={BACKDROPS[name].label}
                        onClick={() => chooseBackdrop(name)}
                      >
                        <i style={{ background: BACKDROPS[name].swatch }} />
                      </button>
                    ))}
                  </div>
                  <p className="view-hint">
                    <strong>{BACKDROPS[backdrop].label}</strong> ·{" "}
                    {BACKDROPS[backdrop].hint} Saved with this build.
                  </p>
                </div>
              </div>
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
              <span>
                {pickingFace === "stud"
                  ? "Tap a stud to put the workplane on it."
                  : "Tap a model face to align the workplane."}
              </span>
              <button onClick={() => setPickingFace(false)}>
                Cancel picking
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
                Choose a part, tap the grid, and place it.{" "}
                <span className="welcome-note">
                  Your build stays on this device.
                </span>
              </p>
              <button
                className="primary"
                onClick={() => chooseTemplate(SHOWCASE_TEMPLATE)}
              >
                Explore the corner café <Icon name="arrowRight" size={16} />
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
            <div
              className={
                "placement-card" +
                (placeExact ? " exact" : "") +
                (placeRefused && !placeQuiet ? " refused" : "")
              }
            >
              <div>
                <div className="placement-title">
                  <strong>
                    {currentPart.name} ·{" "}
                    {colors.find((c) => c.code === color)?.name}
                  </strong>
                  <button
                    className="snap-switch"
                    role="switch"
                    aria-checked={snapTogether}
                    title={
                      snapTogether
                        ? "Snap together is on: parts must connect to studs or the ground"
                        : "Snap together is off: parts can go anywhere"
                    }
                    onClick={() => {
                      const next = !snapTogether;
                      setSnapTogether(next);
                      saveConnectedPreference(next);
                      setStatus(
                        next
                          ? "Snap together is on: parts must connect to studs or the ground."
                          : "Snap together is off: parts can go anywhere.",
                      );
                    }}
                  >
                    <i aria-hidden="true" />
                    Snap together
                  </button>
                </div>
                {placeRefused && !placeQuiet ? (
                  <span className="placement-refusal" aria-live="polite">
                    {placeCheck!.message}
                  </span>
                ) : (
                  <span>
                    {matchMedia("(pointer: fine)").matches
                      ? "Click the ground or a part, then Enter to place"
                      : "Tap the ground, or a part to stack on or beside"}{" "}
                    ·{" "}
                    {workplane.free
                      ? "free placement"
                      : workplane.grid % 20 === 0
                        ? `${workplane.grid / 20}-stud grid`
                        : workplane.grid === 10
                          ? "half-stud grid"
                          : `${workplane.grid} LDU grid`}
                  </span>
                )}
              </div>
              <button
                className="placement-exact"
                aria-label="Exact position"
                aria-expanded={placeExact}
                onClick={() => setPlaceExact((v) => !v)}
              >
                X Y Z
              </button>
              <div className="placement-values">
                {["X", "Y", "Z"].map((axis, i) => (
                  <NumberInput
                    key={axis}
                    label={"Place " + axis}
                    value={position[i]}
                    step={i === 1 ? 8 : 20}
                    onChange={(n) => {
                      // Typed coordinates leave the offered fits behind.
                      setPlaceFits(null);
                      setPosition(
                        (v) => v.map((x, j) => (j === i ? n : x)) as Vec3,
                      );
                    }}
                  />
                ))}
              </div>
              <button
                aria-label="Rotate placement"
                onClick={() => {
                  // A door in its frame turns by swapping the hinge side.
                  if (
                    placeFits?.mode === "hinge" ||
                    placeFits?.mode === "track"
                  ) {
                    nextFit();
                    return;
                  }
                  const next = (angle + workplane.rotationIncrement) % 360;
                  setAngle(next);
                  const p = editor.project;
                  const scene = sceneConnectors(
                    p,
                    occurrences(p),
                    (o) => o.visible,
                  );
                  // On side studs the part spins about the stud axis.
                  if (placeFits?.mode === "side" && placeFits.tap) {
                    const list = orientedCandidates(
                      currentPart.id,
                      next,
                      placeFits.tap,
                      scene,
                      workplane.normal,
                    );
                    if (list.length) {
                      const index = chooseFit(list, { position });
                      applyFit({
                        list,
                        index,
                        mode: "side",
                        tap: placeFits.tap,
                      });
                      setStatus(fitStatus("side", list, index));
                      return;
                    }
                  }
                  // A turn swaps which axis carries an odd stud count. The
                  // preview keeps its level (a stacked part stays stacked) and
                  // re-snaps to verified connectors where it can.
                  const n = workplane.normal,
                    base = planeOrigin(workplane);
                  const k =
                    (position[0] - base[0]) * n[0] +
                    (position[1] - base[1]) * n[1] +
                    (position[2] - base[2]) * n[2] -
                    currentPart.height;
                  const level = {
                    ...workplane,
                    origin: workplane.origin.map(
                      (o, i) => o + n[i] * k,
                    ) as Vec3,
                  };
                  const turned = placementOnPlane(
                    position,
                    level,
                    currentPart.height,
                    next,
                    currentPart.align,
                  ).position;
                  const list = snapCandidates(
                    currentPart.id,
                    placeBasis(workplane, next),
                    turned,
                    scene,
                    workplane.normal,
                  );
                  const index = chooseFit(list);
                  if (index >= 0) applyFit({ list, index, mode: "stud" });
                  else {
                    setPlaceFits(null);
                    setPlaceOrientation(null);
                    setPosition(turned);
                  }
                }}
              >
                <Icon name="rotate" size={16} /> {angle}°
              </button>
              {placeFits && placeFits.list.length > 1 && (
                <button
                  className="placement-fit"
                  aria-label="Next fit"
                  title="Next fit (N or Tab)"
                  onClick={nextFit}
                >
                  <Icon name="arrowRight" size={16} /> {placeFits.index + 1}/
                  {placeFits.list.length}
                </button>
              )}
              <button
                className="primary"
                disabled={placeRefused}
                title={placeRefused ? placeCheck!.message : undefined}
                onClick={() =>
                  void run(() => {
                    if (placeRefused) return;
                    command("parts.add", {
                      layerId: activeLayer,
                      parts: [
                        {
                          ref: part,
                          colorCode: color,
                          transform: {
                            position,
                            basis:
                              placeOrientation ?? placeBasis(workplane, angle),
                          },
                        },
                      ],
                    });
                    // The part now fills that fit; the next tap finds new ones.
                    setPlaceFits(null);
                    setPlaceSettled(position);
                    setStatus("Placed " + currentPart.name);
                    // Recently used means placed, not merely browsed.
                    setRecentParts((recent) => pushRecent(recent, part));
                  })
                }
              >
                Place part
              </button>
              <button onClick={() => setTool("Navigate")}>Cancel</button>
            </div>
          )}
          {mode === "Photo" && (
            <ModeMenu
              menu="Photo"
              label="Photo"
              sections={{
                download: photoDownload,
                // The same choice as Camera views › Look, where a photo is
                // actually set up.
                look: (
                  <div
                    className="look-control"
                    role="group"
                    aria-label="Picture look"
                  >
                    {LOOK_NAMES.map((name) => (
                      <button
                        key={name}
                        aria-pressed={renderLook === name}
                        onClick={() => chooseLook(name)}
                      >
                        {name === "standard"
                          ? "Standard"
                          : name === "realistic"
                            ? "Realistic"
                            : "Photo"}
                      </button>
                    ))}
                  </div>
                ),
                size: photoSizeFields,
                views: photoViews,
                exact: photoExact,
                collection: bookmarkCount > 0 && photoCollection,
                quality: photoQuality,
              }}
            />
          )}
          {mode === "Instructions" && (
            <ModeMenu
              menu="Instructions"
              label="Instructions"
              sections={{
                follow: (
                  <div className="menu-actions">
                    <button
                      className="primary guide-open-button"
                      disabled={!available || !all.length}
                      onClick={() => setGuideOpen(true)}
                    >
                      <Icon name="instructions" /> Build it step by step
                    </button>
                    <button
                      disabled={!available}
                      onClick={() => setPartsListOpen(true)}
                    >
                      <Icon name="parts" /> Parts list
                    </button>
                  </div>
                ),
                step: stepNavigator,
                plan: (
                  <>
                    <p className="muted">
                      Let the app suggest steps, then check its notes on fit and
                      reach, or make one step per layer. Real bricks may still
                      need a different order.
                    </p>
                    {heuristicSteps}
                    {generateSteps}
                    {instructionEditor}
                    {planJson}
                  </>
                ),
                publish: plan && instructionsPublish,
              }}
            />
          )}
          {mode === "Play" && play.current && (
            <PlayPanel
              editor={editor}
              selection={selection}
              play={play.current}
              layers={project.layers}
              rigs={project.motionRigs}
              playHint={project.scene?.playHint}
              // Stay on the model with the entry dock, ready to walk again.
              exit={() => {}}
              modelLoading={busy || !!galleryPending}
              empty={!all.length}
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
            <ModeMenu
              menu="Project"
              label="Project"
              sections={{
                "library-update": projectLibraryUpdate,
                files: (
                  <>
                    <div className="menu-actions">
                      <button onClick={() => fileInput.current?.click()}>
                        <Icon name="arrowUp" size={16} /> Open file
                      </button>
                      <button onClick={() => void exportFile("native")}>
                        <Icon name="arrowDown" size={16} /> Download backup
                      </button>
                    </div>
                    <p className="muted menu-note">
                      Opens .ldr, .mpd, backups and build scripts. Browser
                      storage can be cleared, so keep a backup.
                    </p>
                  </>
                ),
                templates: projectTemplates,
                official: projectOfficial,
                saved: projectSaved,
                checkpoints: projectCheckpoints,
                health: projectHealth,
                clear: <ClearSavedBuilds onClear={clearSavedBuildsAndReset} />,
                export: (
                  <>
                    {projectLdraw}
                    {projectProfiles}
                  </>
                ),
                share: projectShare,
                offline: <OfflinePanel />,
                limits: projectLimits,
                shortcuts: projectShortcuts,
                about: projectAbout,
              }}
            />
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
          {mode === "Build" && tool === "Select" && regionMode && (
            <div
              className="measure-chip region-chip hud-el hud-slab"
              role="group"
              aria-label="Box select"
            >
              <div className="region-chip-row">
                <Segmented
                  label="Region shape"
                  value={regionShape}
                  options={[
                    ["box", "Box"],
                    ["lasso", "Lasso"],
                  ]}
                  onChange={setRegionShape}
                />
                <button
                  className="region-done"
                  onClick={() => {
                    setRegionMode(false);
                    setStatus("Box select finished.");
                  }}
                >
                  Done
                </button>
              </div>
              <div className="region-chip-row">
                <Segmented
                  label="Region depth"
                  value={selectionDepth}
                  options={[
                    ["visible", "Visible"],
                    ["through", "Through"],
                  ]}
                  onChange={setSelectionDepth}
                />
                <Segmented
                  label="Region action"
                  value={selectionOperation}
                  options={[
                    ["replace", "New"],
                    ["add", "Add"],
                    ["remove", "Remove"],
                  ]}
                  onChange={setSelectionOperation}
                />
              </div>
            </div>
          )}
          {mode === "Build" &&
            panel === "Canvas" &&
            tool !== "Place" &&
            !regionMode &&
            selection.length > 0 && (
              <div
                className="selection-strip hud-el"
                role="toolbar"
                aria-label="Selected parts"
              >
                <span className="selection-strip-count">
                  {selection.length === 1
                    ? (partSpec(selected[0]?.node.ref ?? "")?.name ?? "1 part")
                    : `${selection.length} parts`}
                </span>
                <button
                  onClick={rotateSelected}
                  disabled={selected.length !== 1}
                >
                  <Icon name="rotate" size={18} />
                  <span>Rotate</span>
                </button>
                <button onClick={applyColour}>
                  <i
                    className="quick-swatch"
                    style={{ background: colorHex(color) }}
                    aria-hidden="true"
                  />
                  <span>Paint</span>
                </button>
                <button onClick={duplicateSelected}>
                  <Icon name="copy" size={18} />
                  <span>Copy</span>
                </button>
                <button className="danger" onClick={deleteSelected}>
                  <Icon name="trash" size={18} />
                  <span>Delete</span>
                </button>
                <button onClick={() => setPanel("Inspector")}>
                  <Icon name="inspector" size={18} />
                  <span>More</span>
                </button>
              </div>
            )}
          <div className="canvas-bottom hud-el hud-slab">
            <span>
              {all.length.toLocaleString()} parts <b>·</b> {selection.length}{" "}
              selected
            </span>
            <span className="grid-state">
              {tool === "Select"
                ? `${regionShape === "box" ? "Box" : "Lasso"} · ${selectionDepth === "visible" ? "Visible" : "Through"}`
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
          data-panel={panel}
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
              className={
                "tab-layers " + (panel !== "Inspector" ? "active" : "")
              }
              onClick={() => setPanel("Layers")}
            >
              Layers
            </button>
            <button
              className={panel === "Inspector" && !toolsTab ? "active" : ""}
              onClick={() => {
                setPanel("Inspector");
                setInspectorTools(false);
              }}
            >
              Inspector
            </button>
            <button
              className={toolsTab ? "active" : ""}
              onClick={() => {
                setPanel("Inspector");
                setInspectorTools(true);
              }}
            >
              {/* "Tools" is the header's menu of views; these are extras. */}
              Extras
            </button>
          </div>
          {panel === "Inspector" ? (
            !toolsTab && inspectorPanel
          ) : (
            <>
              {layersPanel}
              <LayerActions
                project={project}
                occurrences={available ? all : undefined}
                layerId={activeLayer}
                dispatch={(type, payload) => command(type, payload)}
                onRemoved={setActiveLayer}
                onCreated={setActiveLayer}
                ghostOtherLayers={ghostOtherLayers}
                onGhostChange={setGhostOtherLayers}
              />
            </>
          )}
          <div hidden={panel !== "Inspector" || toolsTab || !selection.length}>
            <TransformPanel
              editor={editor}
              renderer={() => renderer.current}
              selection={selection}
              revision={project.revision}
              enabled={
                mode === "Build" &&
                tool === "Select" &&
                !regionMode &&
                !pickingFace
              }
              activeLayerId={crossLayer ? undefined : activeLayer}
              report={setStatus}
              modeRequest={transformModeRequest}
              snapTogether={snapTogether}
              onSnapTogether={(next) => {
                setSnapTogether(next);
                saveConnectedPreference(next);
              }}
              guard={snapTogether ? moveRefusal : undefined}
            />
          </div>
          {panel === "Inspector" && !toolsTab && (
            <ClipboardTools
              editor={editor}
              selection={selection}
              layerId={activeLayer}
              crossLayer={crossLayer}
              position={position}
              onSelect={setSelectionSafe}
            />
          )}
          {/* Advanced tools: a tab of their own, one drawer each. */}
          <ModeMenu
            menu="Tools"
            label="Extras"
            className="menu-tools"
            hidden={panel !== "Inspector" || !toolsTab}
            sections={{
              selection: selectionTools,
              replace: panel === "Inspector" && replaceTool,
              workplane: workplanePanel,
              submodels: panel === "Inspector" && modelTools,
              rig: rigAuthoring,
              seat: seatAuthoring,
              physics: rigPhysics,
            }}
            hints={{
              workplane: workplane.free
                ? "Free placement"
                : `Grid ${workplane.grid}`,
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
        <LoadProgressIndicator />
        <PhotoProgressIndicator />
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
              aria-label={"Place " + partSpec(id)!.name}
              onClick={() => {
                choosePart(id);
                setPanel("Canvas");
              }}
            >
              <PartThumb part={partSpec(id)!} color={heldHex} />
              <span>{shortPartLabel(partSpec(id)!.name)}</span>
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
        accept=".ldr,.mpd,.dat,.brickproj,.json"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void replaceProject(`“${f.name}”`, () => openFile(f));
          e.target.value = "";
        }}
      />
      {replacePrompt && (
        <ReplaceProjectDialog
          title={replacePrompt.title}
          action={replacePrompt.action}
          storedBefore={replacePrompt.storedBefore}
          onSave={async () => {
            await saveOpenProject();
            // Close the prompt before the (possibly slow) replacement starts.
            flushSync(() => setReplacePrompt(null));
            await replacePrompt.proceed();
            replacePrompt.resolve(true);
          }}
          onDiscard={async () => {
            await discardOpenProject();
            flushSync(() => setReplacePrompt(null));
            await replacePrompt.proceed();
            replacePrompt.resolve(true);
          }}
          onDownload={() => exportFile("native")}
          onCancel={() => {
            setReplacePrompt(null);
            replacePrompt.resolve(false);
            setStatus("Kept your current build.");
          }}
        />
      )}
      {partsListOpen && available && (
        <PartsList
          project={project}
          all={all}
          onClose={() => setPartsListOpen(false)}
          onBrickLink={() => {
            setPartsListOpen(false);
            setGuideOpen(false);
            setInventoryOpen(true);
          }}
          download={download}
          onStatus={setStatus}
        />
      )}
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
                <Icon name="close" />
              </button>
            </div>
            <div className="export-shortcuts">
              <button
                disabled={!available}
                onClick={() => {
                  setInventoryOpen(false);
                  setPartsListOpen(true);
                }}
              >
                <strong>Parts list</strong>
                <small>Every part with counts · CSV</small>
              </button>
              <button
                disabled={!available || !all.length}
                onClick={() => {
                  setInventoryOpen(false);
                  setGuideOpen(true);
                }}
              >
                <strong>Build steps</strong>
                <small>Follow along, step by step</small>
              </button>
              <button onClick={() => void exportFile("native")}>
                <strong>Editable backup</strong>
                <small>Reopen it here (.brickproj)</small>
              </button>
              <button onClick={() => void exportFile("ldraw")}>
                <strong>LDraw model</strong>
                <small>For other LDraw apps (.mpd)</small>
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
            <h3>Parts list for BrickLink</h3>
            <p>
              Make a Wanted List of every brick you need. It is made on this
              device.
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
            </div>
            <details className="dialog-more">
              <summary>More options</summary>
              <div className="form-row">
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
                Allow parts and colours that are not audited yet
              </label>
              <button className="wide" onClick={() => void perLayer()}>
                One list per layer (ZIP)
              </button>
              <p className="muted">
                Upload the XML to BrickLink’s Wanted List. Uploading into a list
                that already has parts may add to it instead of replacing it.
                Not yet checked against a live upload.
              </p>
            </details>
            <button className="wide" onClick={() => void previewInventory()}>
              Preview parts list
            </button>
            {preview && (
              <>
                <div className="inventory-stats">
                  <div>
                    <strong>{preview.sourceOccurrenceCount}</strong>
                    <span>parts in the build</span>
                  </div>
                  <div>
                    <strong>{preview.resolvedPhysicalUnitCount}</strong>
                    <span>pieces to buy</span>
                  </div>
                  <div>
                    <strong>{preview.lotCount}</strong>
                    <span>lines in the list</span>
                  </div>
                  <div>
                    <strong>{preview.excludedOccurrenceIds.length}</strong>
                    <span>not in the list</span>
                  </div>
                </div>
                <InventoryResolution
                  preview={preview}
                  decisions={project.marketplace.partDecisions ?? {}}
                  decide={(part, decision) =>
                    void run(async () => {
                      command("inventory.override", { part, decision });
                      await previewInventory();
                    })
                  }
                  show={(ids) => {
                    setInventoryOpen(false);
                    setMode("Build");
                    setPanel("Canvas");
                    setSelectionSafe(ids);
                    setStatus(
                      `${ids.length} part${ids.length === 1 ? "" : "s"} selected from the parts list.`,
                    );
                  }}
                />
                <details className="dialog-more">
                  <summary>
                    Technical details ({preview.lotCount} lots,{" "}
                    {preview.diagnostics.length} notes)
                  </summary>
                  <div className="table-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>Part</th>
                          <th>Colour ID</th>
                          <th>Quantity</th>
                          <th>Mapping</th>
                          <th>Colour made</th>
                        </tr>
                      </thead>
                      <tbody>
                        {preview.rows.map((row) => (
                          <tr key={row.itemId + ":" + row.colorId}>
                            <td>{row.itemId}</td>
                            <td>{row.colorId}</td>
                            <td>{row.quantity}</td>
                            <td>{row.verification}</td>
                            <td>{colourExistenceLabel[row.colorExistence]}</td>
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
                </details>
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
                <Icon name="close" />
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
