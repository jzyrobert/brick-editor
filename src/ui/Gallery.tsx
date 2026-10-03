import { useEffect, useRef, useState } from "react";
import {
  GALLERY_ANGLES,
  MODEL_TOOLS,
  type GalleryAngle,
  type GalleryEntry,
  type GalleryPromptView,
  type ModelTool,
} from "../catalog/gallery";
import { Icon, type IconName } from "./icons";

type Props = {
  /** Built-in samples, or the published gallery when its index loaded. */
  prompts: GalleryPromptView[];
  /** Where `prompts` came from; built-in samples say so. */
  published: boolean;
  detailId?: string;
  onDetail: (id?: string) => void;
  onOpen: (entry: GalleryEntry, mode: ModelTool | "Play") => void;
  pending?: string;
  error: string;
  onImport: () => void;
};
const count = (n: number) => n.toLocaleString("en");
const agentLabel = (e: GalleryEntry) =>
  e.effort ? `${e.agent}, ${e.effort} effort` : e.agent;

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
      width="1440"
      height="1000"
    />
  );
}

export function Gallery({
  prompts,
  published,
  detailId,
  onDetail,
  onOpen,
  pending,
  error,
  onImport,
}: Props) {
  const [promptId, setPromptId] = useState(prompts[0]?.id ?? "");
  const [angle, setAngle] = useState<GalleryAngle>("iso");
  const [compare, setCompare] = useState(false);
  const [pair, setPair] = useState<[string, string]>(["", ""]);
  // Entries hidden by the agent filter (so new entries start shown).
  const [hidden, setHidden] = useState<string[]>([]);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [detailAngle, setDetailAngle] = useState<GalleryAngle>("iso");
  const heading = useRef<HTMLHeadingElement>(null);
  const prompt =
    prompts.find((p) => p.id === promptId) ??
    prompts.find((p) => !p.placeholder) ??
    prompts[0];
  const entries = prompt?.entries ?? [];
  const all = prompts.flatMap((p) => p.entries.map((e) => ({ p, e })));
  const detail = all.find((x) => x.e.id === detailId);
  useEffect(() => {
    setDetailAngle("iso");
    heading.current?.focus({ preventScroll: true });
  }, [detailId]);
  // A new source (the published index arriving) or prompt resets the
  // comparison to the first two entries.
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
  // Agent filter: one group per model, one box per effort (or build).
  // Repeated runs at one level share a box: it shows or hides them all.
  const groups = [...new Set(entries.map((e) => e.agent))].map((agent) => {
    const mine = entries.filter((e) => e.agent === agent);
    const labels = [
      ...new Set(mine.map((e) => (e.effort ? `${e.effort} effort` : e.title))),
    ];
    return {
      agent,
      entries: mine,
      levels: labels.map((label) => ({
        label,
        entries: mine.filter(
          (e) => (e.effort ? `${e.effort} effort` : e.title) === label,
        ),
      })),
    };
  });
  const agentCount = groups.length;
  const pending_ = all.find((x) => x.e.id === pending)?.e;
  const entryLabel = (e: GalleryEntry) =>
    agentCount > 1
      ? `${e.agent}${e.effort ? ` · ${e.effort}` : ""}`
      : (e.effort ?? e.title);
  return (
    <main className="gallery-page" aria-label="Agent model gallery">
      {error && (
        <div className="gallery-error" role="alert">
          {error} Try opening the model again.
        </div>
      )}
      {pending_ && (
        <div className="gallery-loading" role="status">
          Opening {pending_.title}…
        </div>
      )}
      {detail ? (
        <div className="gallery-detail">
          <button className="gallery-back" onClick={() => onDetail(undefined)}>
            <Icon name="arrowLeft" size={18} />
            All responses
          </button>
          <div className="gallery-detail-layout">
            <section
              className={`gallery-detail-stage gallery-tone-${detail.e.tone}`}
              aria-label="Selected model preview"
            >
              <ModelImage entry={detail.e} angle={detailAngle} />
              <Angles value={detailAngle} onChange={setDetailAngle} />
            </section>
            <section className="gallery-detail-info">
              <h1 ref={heading} tabIndex={-1}>
                {detail.e.title.replace(/\.?$/, ".")}
              </h1>
              <p className="gallery-source">
                {detail.e.agent}{" "}
                {detail.e.effort && <span>{detail.e.effort} effort</span>}
              </p>
              <p>
                {detail.e.description} Generated from the brief “
                {detail.p.brief}”.
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
                <p>{detail.p.notes}</p>
                <p>
                  {detail.e.source.kind === "sample"
                    ? "Titles are editorial descriptions. "
                    : "Titles are the models’ own. "}
                  Models open as editable local copies; the gallery originals
                  stay intact.
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
                  aria-pressed={prompt?.id === p.id}
                  onClick={() => selectPrompt(p.id)}
                >
                  {p.name}
                  <small>
                    {p.placeholder ? "Placeholder" : p.entries.length}
                  </small>
                </button>
              ))}
            </div>
            <select
              aria-label="Choose a prompt"
              value={prompt?.id}
              onChange={(e) => selectPrompt(e.target.value)}
            >
              {prompts.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.placeholder
                    ? `${p.name} · Placeholder`
                    : p.brief.charAt(0).toUpperCase() + p.brief.slice(1)}
                </option>
              ))}
            </select>
          </div>
          <div className="gallery-body">
            {prompt && !prompt.placeholder ? (
              <>
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
                    <span>{shown.length} real responses</span>
                    {filtersOpen && (
                      <div className="gallery-filters">
                        {groups.map((g) => (
                          <fieldset key={g.agent}>
                            <legend>
                              <strong>{g.agent}</strong>
                            </legend>
                            {g.entries.some((e) => e.effort) && (
                              <p>Reasoning levels</p>
                            )}
                            {g.levels.map((l) => {
                              const ids = l.entries.map((e) => e.id);
                              return (
                                <label key={l.label}>
                                  <input
                                    type="checkbox"
                                    checked={
                                      !ids.every((id) => hidden.includes(id))
                                    }
                                    onChange={(ev) => {
                                      setCompare(false);
                                      setHidden((h) =>
                                        ev.target.checked
                                          ? h.filter((id) => !ids.includes(id))
                                          : [...h, ...ids],
                                      );
                                    }}
                                  />
                                  {l.label}
                                </label>
                              );
                            })}
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
                  {published ? (
                    <>
                      <span className="gallery-note-full">
                        {agentCount === 1
                          ? `These builds come from one model at ${entries.length} reasoning levels.`
                          : `These builds come from ${agentCount} models, each at several reasoning levels.`}
                      </span>
                      <span className="gallery-note-short">
                        {agentCount === 1
                          ? "One model"
                          : `${agentCount} models`}{" "}
                        · {entries.length} real builds.
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="gallery-note-full">
                        These samples use one agent at five reasoning levels.
                        Other agents are shown as placeholders.
                      </span>
                      <span className="gallery-note-short">
                        One agent · five reasoning levels · real builds.
                      </span>
                    </>
                  )}
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
                              {entryLabel(s)} · {s.title}
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
                        <p>{s.description}</p>
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
                    {!compare && agentCount === 1 && (
                      <article className="gallery-placeholder">
                        <Icon name="layers" size={32} />
                        <h2>Another agent’s take.</h2>
                        <p>
                          A placeholder for the next response to this same
                          brief.
                        </p>
                        <span>Placeholder · No model yet</span>
                      </article>
                    )}
                  </section>
                ) : (
                  <div className="gallery-empty">
                    <h2>No responses selected.</h2>
                    <p>Choose a reasoning level to bring its model back.</p>
                    <button onClick={() => setHidden([])}>
                      Show all responses
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className="gallery-empty">
                <Icon name="layers" size={36} />
                <h1>This world is still waiting.</h1>
                <p>
                  {prompt?.name ?? "This prompt"} is a placeholder prompt. No
                  generated models are available yet.
                </p>
                <button
                  className="primary"
                  onClick={() =>
                    selectPrompt(prompts.find((p) => !p.placeholder)?.id ?? "")
                  }
                >
                  Browse the {prompts.find((p) => !p.placeholder)?.noun}{" "}
                  responses
                </button>
              </div>
            )}
            <footer className="gallery-footer">
              <strong>One prompt. Many builds. Step inside.</strong>
              <span>
                {published
                  ? "Published agent builds"
                  : "Generated sample · 2 October 2026"}
              </span>
              <button className="gallery-phone-import" onClick={onImport}>
                <Icon name="arrowUp" size={18} /> Open your model
              </button>
            </footer>
          </div>
        </>
      )}
    </main>
  );
}
