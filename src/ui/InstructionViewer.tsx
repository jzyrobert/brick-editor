import { insertionBadge } from "../instructions/motion";
import {
  instructionDisplayState,
  instructionAlternateIds,
} from "../instructions/programme";
import { fitInstructionView } from "../instructions/view-camera";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { partSpec } from "../catalog/extended";
import type { CameraSpec, Occurrence, Project } from "../core/types";
import {
  deriveGuide,
  laterParts,
  sequencePositions,
  stepView,
  type Guide,
  type GuideStep,
} from "../instructions/guide";
import { colorHex, colorName } from "../inventory/parts-list";
import type { SceneAdapter } from "../render/adapter";
import { Icon } from "./icons";
import { GenericThumb, PartThumb } from "./PartThumbs";

/**
 * Follow-along instruction viewer (docs/INSTRUCTIONS.md): one step at a time
 * over the full-screen model, with the step's parts, previous/next, a
 * scrubber, swipes and arrow keys. It only views: nothing here changes the
 * document.
 */
type Options = { later: boolean; tray: boolean; animate: boolean };
const OPTIONS_KEY = "brick-editor:guide-options";
const readOptions = (): Options => {
  const fallback = { later: false, tray: true, animate: true };
  try {
    return { ...fallback, ...JSON.parse(localStorage.getItem(OPTIONS_KEY)!) };
  } catch {
    return fallback;
  }
};
const positionKey = (projectId: string, source: string) =>
  `brick-editor:guide-step:${projectId}:${source}`;

type Source = { key: string; label: string };

export function InstructionViewer({
  project,
  all,
  renderer,
  onClose,
  onPartsList,
  initialPlanId,
}: {
  project: Project;
  all: readonly Occurrence[];
  renderer: SceneAdapter | null;
  onClose: () => void;
  onPartsList: () => void;
  initialPlanId?: string;
}) {
  const sources = useMemo<Source[]>(() => {
    const list: Source[] = [{ key: "model", label: "" }];
    for (const [id, plan] of Object.entries(project.instructionPlans))
      if (id !== "imported" && plan.steps.length)
        list.push({ key: "plan:" + id, label: plan.name });
    return list;
  }, [project.instructionPlans]);
  const [sourceKey, setSourceKey] = useState(
    initialPlanId && initialPlanId !== "imported"
      ? "plan:" + initialPlanId
      : "model",
  );
  const source = sources.find((s) => s.key === sourceKey) ?? sources[0];
  const guide: Guide = useMemo(() => {
    const plan = source.key.startsWith("plan:")
      ? project.instructionPlans[source.key.slice(5)]
      : undefined;
    return deriveGuide(project, all, plan ? { plan } : {});
  }, [project, all, source.key]);
  const positions = useMemo(() => sequencePositions(guide), [guide]);
  const total = guide.steps.length;
  const [index, setIndexState] = useState(() => {
    try {
      const saved = Number(
        localStorage.getItem(positionKey(project.id, source.key)),
      );
      return Number.isInteger(saved) && saved > 0 ? saved : 0;
    } catch {
      return 0;
    }
  });
  const step = Math.min(index, Math.max(0, total - 1));
  const [options, setOptions] = useState(readOptions);
  const [menuOpen, setMenuOpen] = useState(false);
  /** How the last change was made: a single step forward animates. */
  const cause = useRef<"next" | "jump" | "scrub">("jump");
  const setIndex = useCallback(
    (next: number, how: "next" | "jump" | "scrub") => {
      cause.current = how;
      setIndexState(Math.max(0, Math.min(total - 1, next)));
    },
    [total],
  );
  useEffect(() => {
    try {
      localStorage.setItem(OPTIONS_KEY, JSON.stringify(options));
    } catch {
      /* Private windows keep the defaults. */
    }
  }, [options]);
  useEffect(() => {
    try {
      localStorage.setItem(positionKey(project.id, source.key), String(step));
    } catch {
      /* Not remembered without storage. */
    }
  }, [project.id, source.key, step]);

  const panel = useRef<HTMLDivElement>(null);
  const top = useRef<HTMLDivElement>(null);
  const current: GuideStep | undefined = guide.steps[step];
  const sequence = current ? guide.sequences[current.sequence] : undefined;
  const explicitCamera = useRef<CameraSpec | undefined>(undefined);
  const frameExplicitCamera = () => {
    const r = renderer,
      camera = explicitCamera.current;
    if (!r || !camera) return;
    const canvas = r.renderer.domElement.getBoundingClientRect(),
      box = panel.current?.getBoundingClientRect(),
      bar = top.current?.getBoundingClientRect(),
      insets = { top: 0, right: 0, bottom: 0, left: 0 };
    if (box) {
      if (
        box.width < canvas.width * 0.5 &&
        box.left > canvas.left + canvas.width * 0.5
      )
        insets.right = Math.max(0, canvas.right - box.left);
      else insets.bottom = Math.max(0, canvas.bottom - box.top);
    }
    if (bar) insets.top = Math.max(0, bar.bottom - canvas.top);
    r.setCamera(fitInstructionView(camera, canvas, insets));
  };

  // Drive the renderer: this step's view, tray, fly-in and framing.
  const scrubTimer = useRef(0);
  useEffect(() => {
    const r = renderer;
    if (!r || !current) return;
    if (guide.explicitPlan) {
      const state = instructionDisplayState(
        guide.explicitPlan,
        current.planStep!,
      );
      r.showGuideStep(null);
      r.showStep(state.displayIds, state.highlightIds);
      explicitCamera.current =
        guide.explicitPlan.stepMetadata?.[current.planStep!]?.camera;
      let cancelled = false;
      const frame = () => {
        if (!cancelled) frameExplicitCamera();
      };
      const observer = new ResizeObserver(frame);
      observer.observe(r.renderer.domElement);
      if (panel.current) observer.observe(panel.current);
      void r
        .ready()
        .then(frame)
        .catch(() => undefined);
      return () => {
        cancelled = true;
        observer.disconnect();
      };
    }
    const apply = () => {
      const insets = { top: 0, right: 0, bottom: 0, left: 0 };
      const canvas = r.renderer.domElement.getBoundingClientRect();
      const box = panel.current?.getBoundingClientRect();
      if (box) {
        // A side panel (landscape phones, wide screens) or a bottom sheet.
        if (box.height > canvas.height * 0.6)
          insets.right = Math.max(0, canvas.right - box.left);
        else insets.bottom = Math.max(0, canvas.bottom - box.top);
      }
      const bar = top.current?.getBoundingClientRect();
      if (bar) insets.top = Math.max(0, bar.bottom - canvas.top);
      const representative = new Map<string, { id: string; count: number }>();
      const byId = occurrenceIndex(all);
      for (const unit of current.units) {
        if (unit.length !== 1) continue;
        const o = byId.get(unit[0]);
        if (!o || o.node.kind !== "part") continue;
        const key = o.node.ref + "\u0000" + o.colorCode;
        const lot = representative.get(key);
        if (lot) lot.count++;
        else representative.set(key, { id: o.id, count: 1 });
      }
      r.showGuideStep({
        visible: stepView(guide, step),
        units: current.units,
        lots: [...representative.values()].map((l) => ({
          representative: l.id,
          count: l.count,
        })),
        ghost: options.later ? laterParts(guide, step) : [],
        animate: options.animate && cause.current === "next",
        tray: options.tray,
        insets,
      });
    };
    window.clearTimeout(scrubTimer.current);
    // Dragging the scrubber waits for a pause before redrawing big models.
    if (cause.current === "scrub")
      scrubTimer.current = window.setTimeout(apply, 90);
    else apply();
    return () => window.clearTimeout(scrubTimer.current);
  }, [renderer, guide, step, current, options, all]);
  // Leaving the viewer restores the editor's view.
  useEffect(
    () => () => {
      renderer?.showGuideStep(null);
      if (guide.explicitPlan) renderer?.showStep(null);
    },
    [renderer, guide.explicitPlan],
  );

  const next = useCallback(() => {
    if (step >= total - 1) {
      onClose();
      return;
    }
    renderer?.finishGuideAnimation();
    setIndex(step + 1, "next");
  }, [step, total, renderer, setIndex, onClose]);
  const previous = useCallback(() => {
    renderer?.finishGuideAnimation();
    setIndex(step - 1, "jump");
  }, [step, renderer, setIndex]);

  // Arrow keys, Page Up/Down, Space, Home/End; Escape leaves.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        e.defaultPrevented ||
        e.altKey ||
        e.ctrlKey ||
        e.metaKey ||
        (target &&
          (target.isContentEditable ||
            /^(INPUT|SELECT|TEXTAREA)$/.test(target.tagName)))
      )
        return;
      if (e.key === "Escape") {
        if (menuOpen) setMenuOpen(false);
        else onClose();
      } else if (["ArrowRight", "PageDown", " "].includes(e.key)) next();
      else if (["ArrowLeft", "PageUp"].includes(e.key)) previous();
      else if (e.key === "Home") setIndex(0, "jump");
      else if (e.key === "End") setIndex(total - 1, "jump");
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, previous, setIndex, total, onClose, menuOpen]);

  // A quick horizontal flick on the model steps (a slow drag still orbits).
  useEffect(() => {
    const canvas = renderer?.renderer.domElement;
    if (!canvas) return;
    let start: { x: number; y: number; t: number; id: number } | null = null;
    const down = (e: PointerEvent) => {
      if (e.pointerType !== "touch" || !e.isPrimary) {
        start = null;
        return;
      }
      start = { x: e.clientX, y: e.clientY, t: e.timeStamp, id: e.pointerId };
    };
    const up = (e: PointerEvent) => {
      const s = start;
      start = null;
      if (!s || s.id !== e.pointerId) return;
      const dx = e.clientX - s.x,
        dy = e.clientY - s.y;
      if (e.timeStamp - s.t > 320 || Math.abs(dx) < 70) return;
      if (Math.abs(dx) < Math.abs(dy) * 2) return;
      if (dx < 0) next();
      else previous();
    };
    const cancel = () => (start = null);
    canvas.addEventListener("pointerdown", down);
    window.addEventListener("pointerup", up);
    canvas.addEventListener("pointercancel", cancel);
    // A second finger is a pinch or pan, never a swipe.
    const multi = (e: PointerEvent) => {
      if (start && e.pointerId !== start.id) start = null;
    };
    canvas.addEventListener("pointerdown", multi);
    return () => {
      canvas.removeEventListener("pointerdown", down);
      window.removeEventListener("pointerup", up);
      canvas.removeEventListener("pointercancel", cancel);
      canvas.removeEventListener("pointerdown", multi);
    };
  }, [renderer, next, previous]);

  // The step readout for screen readers.
  const heading = current
    ? sequence!.kind === "callout"
      ? `Sub-assembly ${sequence!.name}${sequence!.instances > 1 ? ` (make ${sequence!.instances})` : ""}, step ${positions.position[step]} of ${positions.count(current.sequence)}`
      : `Step ${positions.position[step]} of ${positions.count(0)}`
    : "No steps";
  const partsInStep = current
    ? current.lots.reduce((n, l) => n + l.count, 0)
    : 0;

  useLayoutEffect(() => {
    // Keep the menu within the screen on short phones.
    if (!menuOpen) return;
    const close = (e: PointerEvent) => {
      const el = e.target as HTMLElement;
      if (!el.closest(".guide-menu, .guide-menu-button")) setMenuOpen(false);
    };
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, [menuOpen]);

  if (!total)
    return (
      <div className="guide-overlay" role="region" aria-label="Build steps">
        <div className="guide-top" ref={top}>
          <button
            className="guide-key"
            onClick={onClose}
            aria-label="Close steps"
          >
            <Icon name="close" />
          </button>
        </div>
        <div className="guide-panel guide-empty" ref={panel}>
          <p>This model has no parts to build yet.</p>
        </div>
      </div>
    );

  return (
    <div
      className="guide-overlay"
      role="region"
      aria-label="Build steps"
      aria-roledescription="step-by-step instructions"
    >
      <div className="guide-top" ref={top}>
        <button
          className="guide-key"
          onClick={onClose}
          aria-label="Close steps"
          title="Close (Esc)"
        >
          <Icon name="close" />
        </button>
        <div className="guide-title">
          <strong aria-live="polite">
            {sequence!.kind === "callout" ? (
              <>
                <span className="guide-badge">Sub-assembly</span>{" "}
                {positions.position[step]}/{positions.count(current!.sequence)}
              </>
            ) : (
              <>
                Step {positions.position[step]}
                <small> / {positions.count(0)}</small>
              </>
            )}
          </strong>
          <span className="sr-only">{heading}</span>
        </div>
        <button
          className="guide-key"
          onClick={onPartsList}
          aria-label="Parts list"
          title="Parts list"
        >
          <Icon name="parts" />
        </button>
        <button
          className="guide-key guide-menu-button"
          aria-label="Step options"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((v) => !v)}
        >
          <Icon name="more" />
        </button>
        {menuOpen && (
          <div className="guide-menu" role="group" aria-label="Step options">
            {sources.length > 1 && (
              <label className="guide-field">
                <span>Steps</span>
                <select
                  value={source.key}
                  onChange={(e) => {
                    setSourceKey(e.target.value);
                    setIndex(0, "jump");
                  }}
                >
                  {sources.map((s) => (
                    <option key={s.key} value={s.key}>
                      {s.key === "model"
                        ? guide.source === "plan"
                          ? "From the model"
                          : sourceLabel(guide)
                        : s.label}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {sources.length === 1 && (
              <p className="guide-note">{sourceLabel(guide)}</p>
            )}
            {!guide.explicitPlan && (
              <Toggle
                label="Show later parts faintly"
                on={options.later}
                set={(later) => setOptions((o) => ({ ...o, later }))}
              />
            )}
            <Toggle
              label="Parts tray beside the model"
              on={options.tray}
              set={(tray) => setOptions((o) => ({ ...o, tray }))}
            />
            {!guide.explicitPlan && (
              <Toggle
                label="Animate new parts"
                on={options.animate}
                set={(animate) => setOptions((o) => ({ ...o, animate }))}
              />
            )}
          </div>
        )}
      </div>
      <div
        className={
          "guide-panel" + (guide.explicitPlan ? " guide-explicit" : "")
        }
        ref={panel}
      >
        <div className="guide-need">
          {guide.explicitPlan && (
            <>
              <p className="guide-note">
                {
                  instructionDisplayState(
                    guide.explicitPlan,
                    current!.planStep!,
                  ).operationLabel
                }
              </p>
              {(guide.explicitPlan.stepMetadata?.[current!.planStep!]
                ?.alternateBeforePlacement ||
                guide.explicitPlan.stepMetadata?.[current!.planStep!]
                  ?.incomingCamera ||
                guide.explicitPlan.stepMetadata?.[current!.planStep!]
                  ?.completedDetail) && (
                <details>
                  <summary>Placement views</summary>
                  {guide.explicitPlan.stepMetadata?.[current!.planStep!]
                    ?.completedDetail && (
                    <button
                      className="wide"
                      onClick={() => {
                        const detail =
                          guide.explicitPlan!.stepMetadata![current!.planStep!]
                            .completedDetail!;
                        renderer?.showStep(
                          detail.occurrenceIds,
                          instructionDisplayState(
                            guide.explicitPlan!,
                            current!.planStep!,
                          ).highlightIds,
                        );
                        explicitCamera.current = detail.camera;
                        frameExplicitCamera();
                      }}
                    >
                      Show joint detail — access unverified
                    </button>
                  )}
                  {guide.explicitPlan.stepMetadata?.[current!.planStep!]
                    ?.incomingCamera && (
                    <button
                      className="wide"
                      onClick={() => {
                        const meta =
                            guide.explicitPlan!.stepMetadata![
                              current!.planStep!
                            ],
                          state = instructionDisplayState(
                            guide.explicitPlan!,
                            current!.planStep!,
                          );
                        renderer?.showStep(state.incomingIds ?? []);
                        explicitCamera.current = meta.incomingCamera;
                        frameExplicitCamera();
                      }}
                    >
                      Show completed candidate
                    </button>
                  )}
                  {guide.explicitPlan.stepMetadata?.[current!.planStep!]
                    ?.alternateBeforePlacement && (
                    <button
                      className="wide"
                      onClick={() => {
                        const meta =
                            guide.explicitPlan!.stepMetadata![
                              current!.planStep!
                            ],
                          receiving = instructionAlternateIds(
                            guide.explicitPlan!,
                            current!.planStep!,
                          );
                        renderer?.showStep(receiving);
                        explicitCamera.current = meta.alternateCamera;
                        frameExplicitCamera();
                      }}
                    >
                      {guide.explicitPlan.stepMetadata![current!.planStep!]
                        .alternateDetailIds
                        ? "Show receiver detail — access unverified"
                        : "Show receiver before placement"}
                    </button>
                  )}
                  <button
                    className="wide"
                    onClick={() => {
                      const meta =
                          guide.explicitPlan!.stepMetadata![current!.planStep!],
                        state = instructionDisplayState(
                          guide.explicitPlan!,
                          current!.planStep!,
                        );
                      renderer?.showStep(state.displayIds, state.highlightIds);
                      explicitCamera.current = meta.camera;
                      frameExplicitCamera();
                    }}
                  >
                    {guide.explicitPlan.stepMetadata?.[current!.planStep!]
                      ?.assembly?.type === "join" &&
                    guide.explicitPlan.modules?.[
                      guide.explicitPlan.stepMetadata[current!.planStep!]
                        .assembly!.moduleId
                    ]?.purpose === "wheel"
                      ? "Show wheel placement"
                      : "Show placement"}
                  </button>
                </details>
              )}
              {/* The generator's fit and access notes are for checking a
                  plan, not following it: folded away by default. */}
              {(guide.explicitPlan.stepMetadata?.[current!.planStep!]
                ?.insertionChecks ||
                guide.explicitPlan.stepMetadata?.[current!.planStep!]
                  ?.notes) && (
                <details className="guide-tech-notes">
                  <summary>Building notes</summary>
                  {guide.explicitPlan.stepMetadata?.[current!.planStep!]
                    ?.insertionChecks && (
                    <p className="guide-note guide-approach-note" role="status">
                      {insertionBadge(
                        guide.explicitPlan.stepMetadata[current!.planStep!]
                          .insertionChecks,
                      )}
                    </p>
                  )}
                  {guide.explicitPlan.stepMetadata?.[current!.planStep!]
                    ?.notes && (
                    <p className="guide-note guide-placement-note">
                      {
                        guide.explicitPlan.stepMetadata[current!.planStep!]
                          .notes
                      }
                    </p>
                  )}
                </details>
              )}
            </>
          )}
          <span className="guide-need-title">
            {sequence!.kind === "callout"
              ? `Build ${sequence!.instances > 1 ? sequence!.instances + " × " : ""}${sequence!.name}`
              : current!.assemblies.length && !partsInStep
                ? "Add the sub-assembly"
                : current!.lots.some((lot) => lot.kind)
                  ? `Add ${partsInStep} parts / unverified representations`
                  : `Add ${partsInStep} part${partsInStep === 1 ? "" : "s"}`}
          </span>
          <ul className="guide-lots" aria-label="Parts for this step">
            {current!.assemblies.map((a) => (
              <li
                key={"a:" + a.modelId}
                className="guide-lot guide-assembly"
                title={a.name}
                aria-label={`${a.count} × sub-assembly ${a.name}`}
              >
                <span className="guide-assembly-icon" aria-hidden="true">
                  <Icon name="layers" size={22} />
                </span>
                <b>×{a.count}</b>
                <span className="guide-lot-name">{a.name}</span>
              </li>
            ))}
            {current!.lots.map((lot) => {
              const spec = !lot.kind
                ? partSpec(lot.thumbnailRef ?? lot.ref)
                : undefined;
              const name =
                lot.name ?? spec?.name ?? lot.ref.replace(/\.dat$/i, "");
              return (
                <li
                  key={lot.ref + lot.colorCode}
                  className="guide-lot"
                  title={`${name} · ${colorName(lot.colorCode)}`}
                  aria-label={`${lot.count} × ${name}, ${colorName(lot.colorCode)}`}
                >
                  {spec ? (
                    <PartThumb part={spec} color={colorHex(lot.colorCode)} />
                  ) : (
                    <GenericThumb />
                  )}
                  <b>×{lot.count}</b>
                  <span className="guide-lot-name">{name}</span>
                </li>
              );
            })}
          </ul>
        </div>
        <div className="guide-nav">
          <button
            className="guide-step-button"
            onClick={previous}
            disabled={step === 0}
            aria-label="Previous step"
          >
            <Icon name="arrowLeft" />
          </button>
          <input
            className="guide-scrubber"
            type="range"
            min={0}
            max={Math.max(0, total - 1)}
            value={step}
            aria-label="Step"
            aria-valuetext={heading}
            onChange={(e) => setIndex(Number(e.target.value), "scrub")}
          />
          <button
            className="guide-step-button guide-next"
            onClick={next}
            aria-label={step >= total - 1 ? "Finish" : "Next step"}
          >
            {step >= total - 1 ? (
              <>
                <Icon name="check" />
                <span>Done</span>
              </>
            ) : (
              <>
                <span>Next</span>
                <Icon name="arrowRight" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function sourceLabel(guide: Guide) {
  return guide.source === "model-steps"
    ? "Steps from the model file"
    : guide.source === "generated"
      ? "Steps made for this model, bottom up"
      : guide.label;
}

function Toggle({
  label,
  on,
  set,
}: {
  label: string;
  on: boolean;
  set: (on: boolean) => void;
}) {
  return (
    <label className="guide-toggle">
      <input
        type="checkbox"
        checked={on}
        onChange={(e) => set(e.target.checked)}
      />
      <span>{label}</span>
    </label>
  );
}

const indexes = new WeakMap<readonly Occurrence[], Map<string, Occurrence>>();
function occurrenceIndex(all: readonly Occurrence[]) {
  let map = indexes.get(all);
  if (!map) indexes.set(all, (map = new Map(all.map((o) => [o.id, o]))));
  return map;
}
