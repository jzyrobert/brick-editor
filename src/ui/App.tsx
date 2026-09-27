import { ExportProfiles } from "./ExportProfiles";
import { ModelTools } from "./ModelTools";
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
import { OfflinePanel } from "./OfflinePanel";
import { LayerActions } from "./LayerActions";
import { ClipboardTools } from "./ClipboardTools";
import { InstructionEditor } from "./InstructionEditor";
import { InstructionsPublish } from "./InstructionsPublish";
import { SharePanel } from "./SharePanel";
import { AutosaveQueue } from "../persistence/autosave";
import { BrowserPlay } from "../play/browser";
import { PlayPanel } from "./PlayPanel";
import { useEffect, useRef, useState } from "react";
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
import { SceneAdapter } from "../render/adapter";
import { createAPI, type BrickEditorAPI } from "../automation/api";
import { LocalProjects } from "../persistence/storage";
import { type Preview } from "../inventory/service";
import { type FillRequest, fillPreview } from "../edit/fill";
import { zipSync, strToU8 } from "fflate";
import "./styles.css";
const editor = new Editor();
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
  value: number;
  onChange: (n: number) => void;
  step?: number;
}) {
  return (
    <label className="number-field">
      <span>{label}</span>
      <input
        type="number"
        aria-label={label}
        value={Number.isFinite(value) ? Number(value.toFixed(4)) : 0}
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
  const [project, setProject] = useState(editor.project),
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
    [saveStatus, setSaveStatus] = useState("Not yet saved"),
    [panel, setPanel] = useState("Parts"),
    [inventoryOpen, setInventoryOpen] = useState(false),
    [inventoryScope, setInventoryScope] = useState<Scope["kind"]>("all"),
    [condition, setCondition] = useState("any"),
    [acceptUnknown, setAcceptUnknown] = useState(false),
    [preview, setPreview] = useState<Preview | null>(null),
    [busy, setBusy] = useState(false),
    [fillOpen, setFillOpen] = useState(false),
    [columns, setColumns] = useState(5),
    [rows, setRows] = useState(4),
    [fill, setFill] = useState<ReturnType<typeof fillPreview> | null>(null),
    [step, setStep] = useState(0),
    [activePlanId, setActivePlanId] = useState(""),
    [photoSize, setPhotoSize] = useState([1600, 1200]),
    [transparent, setTransparent] = useState(false),
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
    saveRevisions = useRef(new Map<string, number>()),
    autosave = useRef<AutosaveQueue | undefined>(undefined),
    loaded = useRef(false),
    operationEpoch = useRef(0),
    observedProjectId = useRef(editor.project.id),
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
    });
  const all = occurrences(project),
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
      expectedRevision: editor.project.revision,
      type,
      payload,
    });
  const scoped = () => ({
    occurrenceIds: selection,
    includeHidden: false,
    ...(!crossLayer ? { activeLayerId: activeLayer } : {}),
  });
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
      `${eligible.length} matching editable parts${ids.length > eligible.length ? `; ${ids.length - eligible.length} excluded by scope` : ""}`,
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
          revision: editor.project.revision,
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
    const save = async (p: typeof project) => {
      try {
        if (editor.project.id === p.id) setSaveStatus("Saving…");
        const store = new LocalProjects(localStorage);
        saveRevisions.current.set(
          p.id,
          await store.save(p, saveRevisions.current.get(p.id) ?? null),
        );
        if (editor.project.id === p.id) {
          localStorage.setItem("brick-editor-current", p.id);
          setSaveCoordinationUnavailable(false);
          setSaveStatus(
            editor.project.revision === p.revision
              ? "Saved revision " + p.revision
              : "Unsaved changes",
          );
        }
      } catch (e) {
        if (editor.project.id !== p.id) return;
        if (
          (e as { code?: string }).code === "STORAGE_COORDINATION_UNAVAILABLE"
        )
          setSaveCoordinationUnavailable(true);
        if ((e as { code?: string }).code === "REVISION_CONFLICT")
          setSaveConflict(true);
        setSaveStatus("Save failed — download a backup");
        setStatus(e instanceof Error ? e.message : String(e));
      }
    };
    autosave.current = new AutosaveQueue(save, (e) =>
      setStatus(e instanceof Error ? e.message : String(e)),
    );
    const flushSave = () => {
      if (document.hidden) void autosave.current?.flush();
    };
    document.addEventListener("visibilitychange", flushSave);
    const notifySavedChange = (event: StorageEvent) => {
      const id = editor.project.id;
      if (event.key !== "brick-editor:" + encodeURIComponent(id) + ":head")
        return;
      void new LocalProjects(localStorage)
        .load(id)
        .then((saved) => {
          if (editor.project.id !== id || !loaded.current) return;
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
      () => editor.project.revision,
      () => mechanisms.current?.exit(),
      () => editor.project,
    );
    api.current = createAPI(
      editor,
      () => renderer.current,
      () => play.current,
      () => mechanisms.current,
    );
    if (new URLSearchParams(location.search).get("automation") === "1")
      window.brickEditor = api.current;
    const init = async () => {
      const initialRevision = editor.project.revision,
        initialId = editor.project.id;
      let recovered = false;
      try {
        const id = localStorage.getItem("brick-editor-current");
        const saved = id
          ? await new LocalProjects(localStorage).load(id)
          : null;
        if (
          saved &&
          editor.project.revision === initialRevision &&
          editor.project.id === initialId
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
      if (
        !recovered &&
        (editor.project.revision !== initialRevision ||
          editor.project.id !== initialId)
      )
        autosave.current?.schedule(editor.project);
    };
    void init();
    return () => {
      unsubscribe();
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
    if (!r) return;
    r.controls.enableRotate = mode === "Build" || mode === "Photo";
    r.controls.mouseButtons.LEFT = tool === "Navigate" ? 0 : (null as any);
    r.controls.touches.ONE = tool === "Navigate" ? 0 : (null as any);
    r.controls.enabled = mode !== "Play";
    r.showStep(
      mode === "Instructions" && plan
        ? plan.steps.slice(0, step + 1).flat()
        : null,
    );
    if (mode !== "Play") {
      play.current?.exit();
      mechanisms.current?.exit();
    }
    if (mode !== "Build") setPanel("Canvas");
  }, [tool, mode, step, plan]);
  useEffect(() => {
    setStep((index) =>
      Math.max(0, Math.min(index, (plan?.steps.length ?? 1) - 1)),
    );
  }, [plan]);
  useEffect(() => {
    const camera = plan?.stepMetadata?.[step]?.camera,
      r = renderer.current;
    if (mode !== "Instructions" || !camera || !r) return;
    let cancelled = false;
    void r
      .ready()
      .then(() => {
        if (!cancelled) r.setCamera(camera);
      })
      .catch((e) => setStatus(e.message));
    return () => {
      cancelled = true;
    };
  }, [mode, currentPlanId, step, plan?.stepMetadata]);

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
      if (s.tool === "Navigate") return;
      const p = editor.project;
      if (s.tool === "Place") {
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
      ensure(
        file.size <= 25 * 1024 * 1024,
        "LIMIT_EXCEEDED",
        "File exceeds 25 MiB",
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
        expectedRevision: editor.project.revision,
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
  function startFill() {
    void run(() => {
      worker.current?.terminate();
      setBusy(true);
      const r: FillRequest = {
        ref: part,
        colorCode: color,
        columns,
        rows,
        origin: position,
        basis: placeBasis(workplane, angle),
        layerId: activeLayer,
        maxAdditions: 10000,
      };
      worker.current = new Worker(
        new URL("../workers/fill.worker.ts", import.meta.url),
        { type: "module" },
      );
      worker.current.onmessage = (e) => {
        setBusy(false);
        if (e.data.error) setStatus(e.data.error);
        else {
          setFill(e.data.result);
          setStatus("Fill preview ready");
        }
        worker.current?.terminate();
      };
      worker.current.onerror = () => {
        setBusy(false);
        setStatus("Fill worker failed");
        worker.current?.terminate();
      };
      worker.current.postMessage({ project: editor.project, request: r });
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
  const toolbar = (
    <>
      <div className="tool-segment">
        {["Select", "Place", "Paint", "Navigate"].map((t, i) => (
          <button
            key={t}
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
              ][i]
            }
          >
            <span aria-hidden="true">{["↖", "⊞", "◈", "⤧"][i]}</span>
            {t}
          </button>
        ))}
      </div>
      <div className="tool-segment">
        <button
          aria-label="Undo"
          disabled={!editor.canUndo}
          onClick={() => void run(() => command("history.undo"))}
        >
          ↶
        </button>
        <button
          aria-label="Redo"
          disabled={!editor.canRedo}
          onClick={() => void run(() => command("history.redo"))}
        >
          ↷
        </button>
      </div>
      <button onClick={() => renderer.current?.fit()}>
        ⌖ <span>Fit view</span>
      </button>
    </>
  );
  const partsPanel = (
    <>
      <div className="panel-title">
        <h2>Parts library</h2>
        <span className="count">06</span>
      </div>
      <label className="search">
        <span aria-hidden="true">⌕</span>
        <input
          placeholder="Search parts or numbers"
          aria-label="Search parts"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <kbd>/</kbd>
      </label>
      <div className="eyebrow">
        STARTER COLLECTION <span>OFFLINE</span>
      </div>
      <div className="part-grid">
        {Object.values(catalog)
          .filter((p) =>
            (p.name + " " + p.id + " " + p.category)
              .toLowerCase()
              .includes(search.toLowerCase()),
          )
          .map((p) => (
            <button
              key={p.id}
              className={"part-card " + (part === p.id ? "chosen" : "")}
              aria-pressed={part === p.id}
              onClick={() => {
                setPart(p.id);
                setPosition(
                  (v) =>
                    placementOnPlane(v, workplane, p.height, angle).position,
                );
                setTool("Place");
              }}
            >
              <BrickIcon width={p.width / 20} depth={p.depth / 20} />
              <strong>{p.name}</strong>
              <small>{p.id.replace(".dat", "")}</small>
              {part === p.id && <span className="part-check">✓</span>}
            </button>
          ))}
      </div>
      <div className="panel-title color-title">
        <h2>Colour</h2>
        <span>{colors.find((c) => c.code === color)?.name}</span>
      </div>
      <div className="swatches">
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
            {color === c.code ? "✓" : ""}
          </button>
        ))}
      </div>
      <p className="muted">
        Red, blue, yellow, white and black combinations are audited. Other
        colours require inventory review.
      </p>
      <div className="library-note">
        <span>◎</span>
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
                {l.visible ? "◉" : "○"}
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
                {l.locked ? "▣" : "□"}
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
      {selected.length ? (
        <>
          <div className="selection-summary">
            <BrickIcon
              color={colors.find((c) => c.code === selected[0].colorCode)?.hex}
            />
            <strong>
              {selected.length === 1
                ? catalog[selected[0].node.ref]?.name || selected[0].node.ref
                : "Multiple parts"}
            </strong>
            <small>
              {selected.length === 1
                ? selected[0].node.ref
                : "Selection spans " +
                  new Set(selected.map((o) => o.layerId)).size +
                  " layers"}
            </small>
          </div>
          <h3>
            Position <small>LDU · world</small>
          </h3>
          <div className="numeric-row">
            {["X", "Y", "Z"].map((axis, i) => (
              <NumberInput
                key={axis}
                label={"Position " + axis}
                value={selected[0].transform.position[i]}
                step={i === 1 ? 8 : 20}
                onChange={(n) =>
                  void run(() => {
                    const delta: Vec3 = [0, 0, 0];
                    delta[i] = n - selected[0].transform.position[i];
                    command("parts.transform", {
                      ...scoped(),
                      delta,
                      space: "ldraw",
                    });
                  })
                }
              />
            ))}
          </div>
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
              ↑ 1 plate
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
              ↓ 1 plate
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
              ? "Position fields move the selection by the delta from its first part. "
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
    </>
  );
  return (
    <div className={"app mode-" + mode.toLowerCase()}>
      <header className="header">
        <a className="brand" href="#" aria-label="Brick Editor home">
          <span className="brand-icon">▦</span>
          <span>
            brick<span className="brand-light">editor</span>
          </span>
        </a>
        <nav className="mode-tabs" aria-label="Editor mode">
          {["Build", "Instructions", "Photo", "Play", "Project"].map((m) => (
            <button
              key={m}
              className={mode === m ? "active" : ""}
              onClick={() => {
                setMode(m);
                if (m !== "Build") setPanel("Canvas");
                if (m === "Photo")
                  setCamera(renderer.current?.currentCamera() || camera);
              }}
            >
              {m}
            </button>
          ))}
        </nav>
        <div className="header-actions">
          <span className="local-badge">
            <i />
            Local workspace
          </span>
          <button className="primary" onClick={() => setInventoryOpen(true)}>
            Export <span>↗</span>
          </button>
        </div>
      </header>
      <div className="project-bar">
        <div>
          <span className="project-icon">▱</span>
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
        <button onClick={() => void exportFile("native")}>
          Save project ↓
        </button>
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
                const baseRevision = editor.project.revision,
                  projectId = editor.project.id;
                const backup = await api.current!.project.export({
                  format: "native",
                });
                download(backup.name, backup.bytes, backup.mimeType);
                const saved = await new LocalProjects(localStorage).load(
                  projectId,
                );
                ensure(
                  editor.project.id === projectId &&
                    editor.project.revision === baseRevision,
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
              Place selected part →
            </button>
            <button onClick={() => setPanel("Canvas")}>Close</button>
          </div>
          {partsPanel}
        </aside>
        <section className="canvas-shell">
          <div className="canvas-toolbar">{toolbar}</div>
          <div className="viewport" ref={viewport} />
          <div className="canvas-label">
            <span className="live-dot" />{" "}
            {mode === "Build" ? "BUILD WORKSPACE" : mode.toUpperCase()}
            <small>LDraw coordinates · 20 LDU / stud</small>
          </div>
          <div className="view-controls">
            {["Fit", "Top", "Front", "Side"].map((v) => (
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
          </div>
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
              <span className="eyebrow">A LITTLE SPACE FOR BIG IDEAS</span>
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
                Explore the studio template ↗
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
                  Tap the workplane to preview ·{" "}
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
              <span className="eyebrow">PHOTO STUDIO</span>
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
              <button
                className="wide"
                onClick={() =>
                  void run(() =>
                    command("camera.bookmark", {
                      name:
                        "View " +
                        (Object.keys(project.cameraBookmarks).length + 1),
                      camera: renderer.current?.currentCamera() || camera,
                    }),
                  )
                }
              >
                Save current camera bookmark
              </button>
              {Object.entries(project.cameraBookmarks).map(([name, spec]) => (
                <button
                  key={name}
                  onClick={() =>
                    void run(() => {
                      renderer.current?.setCamera(spec);
                      setCamera(spec);
                    })
                  }
                >
                  {name}
                </button>
              ))}
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
                Download PNG + manifest ↓
              </button>
              <QualityPanel renderer={renderer.current} />
            </div>
          )}
          {mode === "Instructions" && (
            <div className="mode-card">
              <span className="eyebrow">ASSEMBLY SEQUENCE</span>
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
              <span className="eyebrow">YOUR LOCAL WORKSPACE</span>
              <h2>Keep the things you make.</h2>
              <p>
                Download a native backup to preserve your project. Browser
                storage can be cleared.
              </p>
              <div className="button-row">
                <button onClick={() => fileInput.current?.click()}>
                  Open file ↑
                </button>
                <button onClick={() => void exportFile("native")}>
                  Native backup ↓
                </button>
              </div>
              <button className="wide" onClick={() => void exportFile("ldraw")}>
                Export LDraw MPD ↓
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
              <OfflinePanel />
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
                  ] as const
                ).map((t) => (
                  <button key={t} onClick={() => void useTemplate(t)}>
                    {t === "mechanisms"
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
                  LDraw attribution and licences ↗
                </a>
              </details>
            </div>
          )}
          <div className="canvas-bottom">
            <span>
              {all.length.toLocaleString()} parts <b>·</b> {selection.length}{" "}
              selected
            </span>
            <button
              onClick={() => {
                setFillOpen(true);
                setFill(null);
              }}
            >
              ⊞ Rectangular fill
            </button>
            <span>
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
      <footer className="status-bar">
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
      <nav className="mobile-nav" aria-label="Mobile panels">
        {["Canvas", "Parts", "Layers", "Inspector"].map((p) => (
          <button
            key={p}
            className={panel === p ? "active" : ""}
            aria-pressed={panel === p}
            onClick={() => setPanel(p)}
          >
            {p}
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
                <span className="eyebrow">TAKE YOUR BUILD WITH YOU</span>
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
                    Download XML ↓
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
                    Report ↓
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
                <button
                  className="primary wide"
                  disabled={!fill.parts.length}
                  onClick={() =>
                    void run(() => {
                      ensure(
                        fill.revision === editor.project.revision,
                        "REVISION_CONFLICT",
                        "Fill preview is stale",
                      );
                      command("parts.add", {
                        layerId: activeLayer,
                        parts: fill.parts,
                        maxAdditions: 10000,
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
