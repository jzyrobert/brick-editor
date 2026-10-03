import { useEffect, useRef, useState } from "react";
import {
  GALLERY_ANGLES,
  MODEL_TOOLS,
  type GalleryAngle,
  type GalleryEntry,
  type GalleryPromptView,
  type ModelTool,
} from "../catalog/gallery";
import { GalleryPreview, type PreviewState } from "./GalleryPreview";
import { Icon, type IconName } from "./icons";

/** Where the published builds are: loading, unavailable, or here. */
export type GallerySource =
  | { state: "loading" }
  | { state: "failed"; message: string }
  | { state: "ready"; prompts: GalleryPromptView[] };

type Props = {
  source: GallerySource;
  onRetry: () => void;
  detailId?: string;
  onDetail: (id?: string) => void;
  onOpen: (entry: GalleryEntry, mode: ModelTool | "Play") => void;
  pending?: string;
  error: string;
  onImport: () => void;
  /** This device's import limit (the 3D preview checks against it). */
  maxBytes: number;
};
const count = (n: number) => n.toLocaleString("en");
const agentLabel = (e: GalleryEntry) =>
  e.effort ? `${e.agent}, ${e.effort} effort` : e.agent;
/** Phones and touch tablets start the detail page on its still pictures, and
 * load the 3D view on request (data and battery). */
const startsStill = () =>
  typeof matchMedia === "function" &&
  matchMedia("(pointer: coarse), (max-width: 760px)").matches;

function Angles({
  value,
  onChange,
}: {
  value: GalleryAngle;
  onChange: (v: GalleryAngle) => void;
}) {
  return (
    <div
      className="gallery-angles"
      role="group"
      aria-label="Model viewing angle"
    >
      {GALLERY_ANGLES.map((a) => (
        <button
          key={a.id}
          aria-pressed={value === a.id}
          onClick={() => onChange(a.id)}
        >
          {a.label}
        </button>
      ))}
    </div>
  );
}
function ModelImage({
  entry,
  angle,
}: {
  entry: GalleryEntry;
  angle: GalleryAngle;
}) {
  return (
    <img
      src={entry.images[angle]}
      alt={`${entry.title}, ${agentLabel(entry)}, ${GALLERY_ANGLES.find((a) => a.id === angle)!.label} view`}
      loading="lazy"
      width="1280"
      height="960"
    />
  );
}

function DetailStage({
  entry,
  maxBytes,
}: {
  entry: GalleryEntry;
  maxBytes: number;
}) {
  const [angle, setAngle] = useState<GalleryAngle>("iso");
  const [live, setLive] = useState(() => !startsStill());
  const [state, setState] = useState<{ s: PreviewState; message?: string }>({
    s: "loading",
  });
  useEffect(() => {
    setAngle("iso");
    setLive(!startsStill());
    setState({ s: "loading" });
  }, [entry.id]);
  const showing3d = live && state.s === "ready";
  return (
    <section
      className={`gallery-detail-stage gallery-tone-${entry.tone}${showing3d ? " live" : ""}`}
      aria-label="Selected model preview"
    >
      <ModelImage entry={entry} angle={angle} />
      {live && state.s !== "failed" && (
        <GalleryPreview
          entry={entry}
          angle={angle}
          maxBytes={maxBytes}
          onState={(s, message) => setState({ s, message })}
        />
      )}
      <div className="gallery-stage-status">
        {!live && (
          <button className="gallery-spin" onClick={() => setLive(true)}>
            <Icon name="view" size={18} />
            Spin in 3D
          </button>
        )}
        {live && state.s === "loading" && (
          <span className="gallery-stage-note" role="status">
            Loading the 3D model…
          </span>
        )}
        {live && state.s === "ready" && (
          <span className="gallery-stage-note">
            Drag to turn · pinch to zoom
          </span>
        )}
        {live && state.s === "failed" && (
          <span className="gallery-stage-note" role="status">
            The 3D view could not load ({state.message?.replace(/\.$/, "")}).
            The pictures are still here.
          </span>
        )}
      </div>
      <Angles value={angle} onChange={setAngle} />
    </section>
  );
}

export function Gallery({
  source,
  onRetry,
  detailId,
  onDetail,
  onOpen,
  pending,
  error,
  onImport,
  maxBytes,
}: Props) {
  const prompts = source.state === "ready" ? source.prompts : [];
  const [promptId, setPromptId] = useState("");
  const [angle, setAngle] = useState<GalleryAngle>("iso");
  const [compare, setCompare] = useState(false);
  const [pair, setPair] = useState<[string, string]>(["", ""]);
  // Builds hidden by the agent filter (new builds start shown).
  const [hidden, setHidden] = useState<string[]>([]);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const prompt = prompts.find((p) => p.id === promptId) ?? prompts[0];
  const entries = prompt?.entries ?? [];
  const all = prompts.flatMap((p) => p.entries.map((e) => ({ p, e })));
  const detail = all.find((x) => x.e.id === detailId);
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
  }, [detailId]);
  useEffect(() => {
    setPair([entries[0]?.id ?? "", entries[1]?.id ?? entries[0]?.id ?? ""]);
    setHidden([]);
    setCompare(false);
  }, [prompt?.id, prompts]);
  const byId = (id: string) => entries.find((e) => e.id === id);
  const shown = compare
    ? pair.map(byId).filter((e): e is GalleryEntry => !!e)
    : entries.filter((e) => !hidden.includes(e.id));
  const selectPrompt = (value: string) => {
    setPromptId(value);
    onDetail(undefined);
  };
  // Agent filter: one group per model, one box per reasoning level (repeat
  // runs at a level share it).
  const groups = [...new Set(entries.map((e) => e.agent))].map((agent) => {
    const mine = entries.filter((e) => e.agent === agent);
    const label = (e: GalleryEntry) =>
      e.effort ? `${e.effort} effort` : e.title;
    return {
      agent,
      levels: [...new Set(mine.map(label))].map((l) => ({
        label: l,
        ids: mine.filter((e) => label(e) === l).map((e) => e.id),
      })),
    };
  });
  const pendingEntry = all.find((x) => x.e.id === pending)?.e;
  const footer = (
    <footer className="gallery-footer">
      <strong>One prompt. Many builds. Step inside.</strong>
      <span>
        {prompts.length
          ? `${count(all.length)} published builds`
          : "Published agent builds"}
      </span>
      <button className="gallery-phone-import" onClick={onImport}>
        <Icon name="arrowUp" size={18} /> Open your model
      </button>
    </footer>
  );
  if (source.state !== "ready" || !prompt)
    return (
      <main className="gallery-page" aria-label="Agent model gallery">
        <div className="gallery-body">
          {source.state === "loading" ? (
            <div className="gallery-empty" role="status">
              <Icon name="layers" size={36} />
              <h1>Fetching the builds…</h1>
              <p>The gallery loads its models from the published collection.</p>
            </div>
          ) : (
            <div className="gallery-empty" role="alert">
              <Icon name="layers" size={36} />
              <h1>
                {source.state === "failed" ? source.message : "No builds yet."}
              </h1>
              <p>
                {source.state === "failed"
                  ? "You can still open your own models."
                  : "Published builds will appear here."}
              </p>
              <div className="gallery-empty-actions">
                {source.state === "failed" && (
                  <button className="primary" onClick={onRetry}>
                    Try again
                  </button>
                )}
                <button onClick={onImport}>
                  <Icon name="arrowUp" size={18} /> Open your model
                </button>
              </div>
            </div>
          )}
          {footer}
        </div>
      </main>
    );
  return (
    <main className="gallery-page" aria-label="Agent model gallery">
      {error && (
        <div className="gallery-error" role="alert">
          {error} Try opening the model again.
        </div>
      )}
      {pendingEntry && (
        <div className="gallery-loading" role="status">
          Opening {pendingEntry.title}…
        </div>
      )}
      {detail ? (
        <div className="gallery-detail">
          <button className="gallery-back" onClick={() => onDetail(undefined)}>
            <Icon name="arrowLeft" size={18} />
            All responses
          </button>
          <div className="gallery-detail-layout">
            <DetailStage entry={detail.e} maxBytes={maxBytes} />
            <section className="gallery-detail-info">
              <h1
                ref={heading}
                tabIndex={-1}
                className={detail.e.title.length > 32 ? "long" : undefined}
              >
                {detail.e.title}
              </h1>
              <p className="gallery-source">
                {detail.e.agent}{" "}
                {detail.e.effort && <span>{detail.e.effort} effort</span>}
              </p>
              <p>
                Built from the brief “{detail.p.brief}”
                {detail.p.targetParts
                  ? `, aiming for ${count(detail.p.targetParts)} parts`
                  : ""}
                . {detail.e.summary}.
              </p>
              <dl>
                {detail.e.facts.map(([k, v]) => (
                  <div key={k}>
                    <dt>{k}</dt>
                    <dd>{v}</dd>
                  </div>
                ))}
              </dl>
              <button
                className="primary gallery-explore"
                disabled={!!pending}
                onClick={() => onOpen(detail.e, "Play")}
              >
                <Icon name="resume" />
                Explore this model
                <Icon name="arrowRight" size={18} />
              </button>
              <div
                className="gallery-model-tools"
                aria-label="Tools for this model"
              >
                {MODEL_TOOLS.map((t) => (
                  <button
                    key={t.name}
                    disabled={!!pending}
                    onClick={() => onOpen(detail.e, t.name)}
                  >
                    <Icon name={t.name.toLowerCase() as IconName} size={18} />
                    {t.name}
                  </button>
                ))}
              </div>
              <details className="gallery-notes">
                <summary>Prompt &amp; generation notes</summary>
                <p>
                  “{detail.p.brief}”
                  {detail.p.targetParts
                    ? ` · Target: ${count(detail.p.targetParts)} parts.`
                    : "."}{" "}
                  The model wrote a build script, which this app compiled into
                  real parts and checked. Warnings are the compiler’s own notes,
                  such as parts that float.
                  {detail.e.build.source
                    ? ` Source run: ${detail.e.build.source}.`
                    : ""}
                </p>
                <p>
                  Titles are the models’ own. Models open as editable local
                  copies; the gallery originals stay intact.
                </p>
              </details>
            </section>
          </div>
        </div>
      ) : (
        <>
          <div className="gallery-prompts">
            <span>Pick a prompt</span>
            <div
              className="gallery-prompt-tabs"
              role="group"
              aria-label="Choose a prompt"
            >
              {prompts.map((p) => (
                <button
                  key={p.id}
                  aria-pressed={prompt.id === p.id}
                  onClick={() => selectPrompt(p.id)}
                >
                  {p.name}
                  <small>{p.entries.length}</small>
                </button>
              ))}
            </div>
            <select
              aria-label="Choose a prompt"
              value={prompt.id}
              onChange={(e) => selectPrompt(e.target.value)}
            >
              {prompts.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} · {p.entries.length}
                </option>
              ))}
            </select>
          </div>
          <div className="gallery-body">
            <div className="gallery-heading">
              <div>
                <h1 ref={heading} tabIndex={-1}>
                  {prompt.heading}
                </h1>
                <p>The brief: “{prompt.brief}”</p>
              </div>
              {prompt.targetParts && (
                <div className="gallery-target">
                  <Icon name="build" size={18} />
                  <strong>{count(prompt.targetParts)} parts</strong>
                  <span>in the brief</span>
                </div>
              )}
            </div>
            <div className="gallery-controls">
              <div className="gallery-filter-wrap">
                <button
                  className="gallery-quiet"
                  aria-expanded={filtersOpen}
                  onClick={() => setFiltersOpen((v) => !v)}
                >
                  Agent settings
                  <Icon name="collapse" size={16} />
                </button>
                <span>
                  {shown.length} of {entries.length} builds
                </span>
                {filtersOpen && (
                  <div className="gallery-filters">
                    {groups.map((g) => (
                      <fieldset key={g.agent}>
                        <legend>
                          <strong>{g.agent}</strong>
                        </legend>
                        <p>Reasoning levels</p>
                        {g.levels.map((l) => (
                          <label key={l.label}>
                            <input
                              type="checkbox"
                              checked={
                                !l.ids.every((id) => hidden.includes(id))
                              }
                              onChange={(ev) => {
                                setCompare(false);
                                setHidden((h) =>
                                  ev.target.checked
                                    ? h.filter((id) => !l.ids.includes(id))
                                    : [...h, ...l.ids],
                                );
                              }}
                            />
                            {l.label}
                          </label>
                        ))}
                      </fieldset>
                    ))}
                  </div>
                )}
              </div>
              <Angles value={angle} onChange={setAngle} />
              <button
                className="gallery-quiet gallery-compare"
                aria-label="Compare responses"
                aria-pressed={compare}
                disabled={entries.length < 2}
                onClick={() => {
                  setCompare((v) => !v);
                  setFiltersOpen(false);
                }}
              >
                <Icon name="columns" size={18} />
                <span>Compare</span>
              </button>
            </div>
            <p className="gallery-sample-note">
              <span className="gallery-note-full">
                {groups.length === 1
                  ? `Every build here comes from ${groups[0].agent}, at several reasoning levels.`
                  : `${groups.length} models, each at several reasoning levels, answered the same brief.`}
              </span>
              <span className="gallery-note-short">
                {groups.length === 1 ? "One model" : `${groups.length} models`}{" "}
                · {entries.length} real builds
              </span>
            </p>
            {compare && (
              <div
                className="gallery-compare-pickers"
                aria-label="Choose responses to compare"
              >
                {pair.map((id, i) => (
                  <label key={i}>
                    Response {i + 1}
                    <select
                      aria-label={`Compare response ${i + 1}`}
                      value={id}
                      onChange={(e) => {
                        const next = [...pair] as typeof pair;
                        const choice = e.target.value;
                        if (choice === pair[1 - i]) next[1 - i] = pair[i];
                        next[i] = choice;
                        setPair(next);
                      }}
                    >
                      {entries.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.agent}
                          {s.effort ? ` · ${s.effort}` : ""} · {s.title}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
            )}
            {shown.length ? (
              <section
                className={`gallery-responses${compare ? " gallery-comparing" : ""}`}
                aria-label="Responses to the same prompt"
              >
                {shown.map((s) => (
                  <article className="gallery-response" key={s.id}>
                    <div className={`gallery-stage gallery-tone-${s.tone}`}>
                      <ModelImage entry={s} angle={angle} />
                      <div className="gallery-agent">
                        <Icon name="build" size={18} />
                        <span>
                          {s.agent}
                          {s.effort && <small>{s.effort} effort</small>}
                        </span>
                      </div>
                      <button
                        className="gallery-fit"
                        aria-label={`Look closer at ${s.title}`}
                        onClick={() => onDetail(s.id)}
                      >
                        <Icon name="view" size={18} />
                      </button>
                    </div>
                    <h2>{s.title}</h2>
                    <p>{s.summary}</p>
                    <div className="gallery-response-actions">
                      <span>
                        <strong>{count(s.parts)}</strong> parts
                      </span>
                      <button
                        className="gallery-quiet"
                        onClick={() => onDetail(s.id)}
                      >
                        Look closer
                      </button>
                      <button
                        className="primary"
                        disabled={!!pending}
                        onClick={() => onOpen(s, "Play")}
                      >
                        <Icon name="resume" size={16} />
                        Explore<span className="sr-only"> {s.title}</span>
                      </button>
                    </div>
                  </article>
                ))}
              </section>
            ) : (
              <div className="gallery-empty">
                <h2>No responses selected.</h2>
                <p>Choose a reasoning level to bring its builds back.</p>
                <button onClick={() => setHidden([])}>
                  Show all responses
                </button>
              </div>
            )}
            {footer}
          </div>
        </>
      )}
    </main>
  );
}
