import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  DEFAULT_GALLERY_FILTERS,
  filterGallery,
  GALLERY_ANGLES,
  type GalleryFilters,
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
  /** The build a failed open was for, and how to try it again. */
  errorTitle?: string;
  onRetryOpen: () => void;
  onDismissError: () => void;
  onImport: () => void;
  /** This device's import limit (the 3D preview checks against it). */
  maxBytes: number;
  /** The build open as the current document. */
  openId?: string;
  /** The open document's name and how to go back to it, when it has parts. */
  resume?: { title: string; go: () => void };
};
const count = (n: number) => n.toLocaleString("en");
/** Where the list was scrolled, kept while Play or a tool replaces it. */
let listScroll = 0;
const PROMPTS_PER_PAGE = 6;
// Gallery is replaced by Play/tools. Keep this visit's browsing choices alongside
// its scroll so returning to the collection restores the same results.
let browseMemory = {
  filters: DEFAULT_GALLERY_FILTERS,
  angle: "iso" as GalleryAngle,
  visible: PROMPTS_PER_PAGE,
  more: false,
};
const agentLabel = (e: GalleryEntry) =>
  e.effort ? `${e.agent}, ${e.effort} effort` : e.agent;
/** The detail page opens in live 3D everywhere; only a browser asking to
 * save data starts on the still pictures and loads 3D on request. */
const startsStill = () =>
  !!(navigator as Navigator & { connection?: { saveData?: boolean } })
    .connection?.saveData;

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
  const [attempt, setAttempt] = useState(0);
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
          key={attempt}
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
          <>
            <span className="gallery-stage-note" role="status">
              The 3D view could not load. The pictures are still here.
            </span>
            <button
              className="gallery-spin"
              onClick={() => {
                setState({ s: "loading" });
                setAttempt((n) => n + 1);
              }}
            >
              <Icon name="rotate" size={18} />
              Try again
            </button>
          </>
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
  openId,
  resume,
  errorTitle,
  onRetryOpen,
  onDismissError,
}: Props) {
  const prompts = source.state === "ready" ? source.prompts : [];
  const [filters, setFilters] = useState(browseMemory.filters);
  const [angle, setAngle] = useState<GalleryAngle>(browseMemory.angle);
  const [visible, setVisible] = useState(browseMemory.visible);
  const [more, setMore] = useState(browseMemory.more);
  useEffect(() => {
    browseMemory = { filters, angle, visible, more };
  }, [filters, angle, visible, more]);
  const heading = useRef<HTMLHeadingElement>(null);
  const page = useRef<HTMLElement>(null);
  useEffect(() => {
    // A failed open is said where the person is looking.
    if (error)
      page.current
        ?.querySelector(".gallery-error")
        ?.scrollIntoView({ block: "nearest" });
  }, [error]);
  const gridScroll = useRef(listScroll);
  useLayoutEffect(() => {
    // A detail page opens at its top; the list comes back where it was.
    const el = page.current;
    if (el) el.scrollTop = detailId ? 0 : gridScroll.current;
  }, [detailId]);
  useEffect(() => {
    if (!detailId) return;
    const close = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      event.preventDefault();
      onDetail(undefined);
    };
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, [detailId, onDetail]);
  const groups = useMemo(
    () => filterGallery(prompts, filters),
    [prompts, filters],
  );
  const models = [
    ...new Set(prompts.flatMap((p) => p.entries.map((e) => e.agent))),
  ].sort();
  const efforts = [
    ...new Set(
      prompts.flatMap((p) =>
        p.entries.flatMap((e) => (e.effort ? [e.effort] : [])),
      ),
    ),
  ];
  const matching = groups.reduce((n, p) => n + p.entries.length, 0);
  const shown = groups.slice(0, visible);
  const shownBuilds = shown.reduce((n, p) => n + p.entries.length, 0);
  const activeFilters = !!(
    filters.query ||
    filters.prompt ||
    filters.model ||
    filters.effort
  );
  const filterCount = [filters.prompt, filters.model, filters.effort].filter(
    Boolean,
  ).length;
  const filterSummary = [
    prompts.find((p) => p.id === filters.prompt)?.name,
    filters.model,
    filters.effort ? `${filters.effort} effort` : "",
  ]
    .filter(Boolean)
    .join(" · ");
  const all = prompts.flatMap((p) => p.entries.map((e) => ({ p, e })));
  const detail = all.find((x) => x.e.id === detailId);
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
  }, [detailId]);
  const changeFilters = (change: Partial<GalleryFilters>) => {
    setFilters((current) => ({ ...current, ...change }));
    setVisible(PROMPTS_PER_PAGE);
    gridScroll.current = listScroll = 0;
    page.current?.scrollTo({ top: 0 });
  };
  const clearFilters = () => changeFilters(DEFAULT_GALLERY_FILTERS);
  const pendingEntry = all.find((x) => x.e.id === pending)?.e;
  const errorBanner = error && (
    <div className="gallery-error" role="alert">
      <p>
        <strong>
          Couldn’t open {errorTitle ?? "this build"}.{" "}
          {/HTTP 5\d\d/.test(error)
            ? "The gallery is busy; try again in a moment."
            : /does not match|damaged|gzip/i.test(error)
              ? "Its file arrived damaged; try again."
              : "Check your internet and try again."}
        </strong>{" "}
        <small>{error}</small>
      </p>
      <div>
        <button className="primary" onClick={onRetryOpen}>
          Try again
        </button>
        <button aria-label="Dismiss" onClick={onDismissError}>
          <Icon name="close" size={18} />
        </button>
      </div>
    </div>
  );
  const footer = (
    <footer className="gallery-footer">
      <strong>Same brief, different models. Step inside.</strong>
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
  if (source.state !== "ready" || !prompts.length)
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
    <main
      ref={page}
      className="gallery-page"
      aria-label="Agent model gallery"
      onScroll={(e) => {
        if (!detailId)
          gridScroll.current = listScroll = e.currentTarget.scrollTop;
      }}
    >
      {error && !detail && errorBanner}
      {/* A detail page's Explore button says it is opening itself. */}
      {pendingEntry && !detail && (
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
                {pending === detail.e.id
                  ? "Opening…"
                  : openId === detail.e.id
                    ? "Continue exploring"
                    : "Explore this model"}
                <Icon name="arrowRight" size={18} />
              </button>
              {error && errorBanner}
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
          <div className="gallery-body gallery-collection">
            {resume && (
              <button className="gallery-resume" onClick={resume.go}>
                <Icon name="resume" size={16} />
                <span>
                  Continue with <strong>{resume.title}</strong>
                </span>
                <Icon name="arrowRight" size={16} />
              </button>
            )}
            <div className="gallery-heading">
              <div>
                <h1 ref={heading} tabIndex={-1}>
                  Build gallery
                </h1>
                <p>Compare AI builds, prompt by prompt.</p>
              </div>
              <span className="gallery-collection-total">
                {count(all.length)} builds · {count(prompts.length)} prompts
              </span>
            </div>
            <section
              className={`gallery-browse${more ? " expanded" : ""}`}
              aria-label="Filter gallery"
            >
              <div className="gallery-filter-fields">
                <div className="gallery-search-row">
                  <label className="gallery-search-field">
                    <span>Search</span>
                    <div className="gallery-search">
                      <Icon name="search" size={18} />
                      <input
                        type="search"
                        aria-label="Search"
                        placeholder="Search gallery"
                        value={filters.query}
                        onChange={(e) =>
                          changeFilters({ query: e.target.value })
                        }
                      />
                      {filters.query && (
                        <button
                          aria-label="Clear search"
                          onClick={() => changeFilters({ query: "" })}
                        >
                          <Icon name="close" size={16} />
                        </button>
                      )}
                    </div>
                  </label>
                  <button
                    className="gallery-filter-toggle"
                    aria-label={`Filters${filterCount ? `, ${filterCount} active` : ""}`}
                    aria-expanded={more}
                    aria-controls="gallery-prompt-filter gallery-model-filter gallery-more-filters"
                    data-active={filterCount > 0}
                    onClick={() => setMore(!more)}
                  >
                    <Icon name="inspector" size={16} />
                    Filters
                    {filterCount > 0 && (
                      <span aria-hidden="true">{filterCount}</span>
                    )}
                  </button>
                </div>
                <label
                  className="gallery-select-field"
                  id="gallery-prompt-filter"
                >
                  <span>Prompt</span>
                  <select
                    value={filters.prompt}
                    onChange={(e) => changeFilters({ prompt: e.target.value })}
                  >
                    <option value="">
                      All prompts ({count(prompts.length)})
                    </option>
                    {[...prompts]
                      .sort((a, b) => a.name.localeCompare(b.name, "en"))
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} · {count(p.entries.length)}{" "}
                          {p.entries.length === 1 ? "build" : "builds"}
                        </option>
                      ))}
                  </select>
                </label>
                <label
                  className="gallery-select-field"
                  id="gallery-model-filter"
                >
                  <span>AI model</span>
                  <select
                    value={filters.model}
                    onChange={(e) => changeFilters({ model: e.target.value })}
                  >
                    <option value="">
                      All models ({count(models.length)})
                    </option>
                    {models.map((model) => (
                      <option key={model} value={model}>
                        {model}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="gallery-browse-bottom">
                <p
                  className="gallery-result-count"
                  role="status"
                  aria-live="polite"
                  aria-atomic="true"
                >
                  {count(matching)} {matching === 1 ? "build" : "builds"} ·{" "}
                  {count(groups.length)}{" "}
                  {groups.length === 1 ? "prompt" : "prompts"}
                  {activeFilters && (
                    <span> · of {count(all.length)} builds</span>
                  )}
                  {filterSummary && (
                    <span
                      className="gallery-mobile-filter-summary"
                      title={filterSummary}
                    >
                      {filterSummary}
                    </span>
                  )}
                </p>
                <div className="gallery-browse-actions">
                  {activeFilters && (
                    <button className="gallery-quiet" onClick={clearFilters}>
                      Clear filters
                    </button>
                  )}
                  <button
                    className="gallery-more-toggle"
                    aria-expanded={more}
                    aria-controls="gallery-more-filters"
                    onClick={() => setMore(!more)}
                  >
                    More filters
                    {filters.effort && (
                      <span className="sr-only">, effort filter active</span>
                    )}
                    <Icon name={more ? "close" : "inspector"} size={16} />
                  </button>
                </div>
              </div>
              <div className="gallery-more-filters" id="gallery-more-filters">
                {more && (
                  <div className="gallery-extra-fields">
                    <label>
                      <span>Reasoning effort</span>
                      <select
                        value={filters.effort}
                        onChange={(e) =>
                          changeFilters({ effort: e.target.value })
                        }
                      >
                        <option value="">All efforts</option>
                        {efforts.map((effort) => (
                          <option key={effort} value={effort}>
                            {effort}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <span>Sort by</span>
                      <select
                        value={filters.sort}
                        onChange={(e) =>
                          changeFilters({
                            sort: e.target.value as GalleryFilters["sort"],
                          })
                        }
                      >
                        <option value="newest">Newest builds</option>
                        <option value="prompt">Prompt A–Z</option>
                      </select>
                    </label>
                  </div>
                )}
                <div
                  className={`gallery-browse-angles${more ? " expanded" : ""}`}
                >
                  <span>Viewing angle</span>
                  <Angles value={angle} onChange={setAngle} />
                </div>
              </div>
              {filters.effort && (
                <p className="gallery-active-effort">
                  {filters.effort} effort{" "}
                  <button
                    className="gallery-quiet"
                    aria-label="Remove effort filter"
                    onClick={() => changeFilters({ effort: "" })}
                  >
                    <Icon name="close" size={16} />
                  </button>
                </p>
              )}
            </section>
            {groups.length ? (
              <div className="gallery-prompt-groups">
                {shown.map((p) => (
                  <section
                    className="gallery-prompt-group"
                    key={p.id}
                    aria-label={p.name}
                  >
                    <div className="gallery-group-heading">
                      <div>
                        <h2>{p.name}</h2>
                        <p>
                          {count(p.entries.length)}{" "}
                          {p.entries.length === 1 ? "build" : "builds"} ·{" "}
                          {count(new Set(p.entries.map((e) => e.agent)).size)}{" "}
                          {new Set(p.entries.map((e) => e.agent)).size === 1
                            ? "model"
                            : "models"}
                        </p>
                      </div>
                      {!filters.prompt && (
                        <button
                          className="gallery-quiet"
                          aria-label={`Show only ${p.name}`}
                          onClick={() => changeFilters({ prompt: p.id })}
                        >
                          View prompt <Icon name="arrowRight" size={16} />
                        </button>
                      )}
                    </div>
                    <details className="gallery-prompt-brief">
                      <summary>
                        Read the prompt
                        {p.targetParts
                          ? ` · ${count(p.targetParts)} parts`
                          : ""}
                      </summary>
                      <p>“{p.brief}”</p>
                    </details>
                    <div
                      className={`gallery-responses${p.entries.length <= 2 ? " gallery-pair" : ""}`}
                    >
                      {p.entries.map((s) => (
                        <article className="gallery-response" key={s.id}>
                          <div
                            className={`gallery-stage gallery-tone-${s.tone}`}
                          >
                            <ModelImage entry={s} angle={angle} />
                            <div className="gallery-agent">
                              <Icon name="build" size={18} />
                              <span>
                                {s.agent}
                                {s.effort && <small>{s.effort} effort</small>}
                              </span>
                            </div>
                            {openId === s.id && (
                              <span className="gallery-open-badge">
                                Open now
                              </span>
                            )}
                            <button
                              className="gallery-fit"
                              aria-label={`Look closer at ${s.title}`}
                              onClick={() => onDetail(s.id)}
                            >
                              <Icon name="view" size={18} />
                            </button>
                          </div>
                          <h3>{s.title}</h3>
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
                              {pending === s.id
                                ? "Opening…"
                                : openId === s.id
                                  ? "Continue"
                                  : "Explore"}
                              <span className="sr-only"> {s.title}</span>
                            </button>
                          </div>
                        </article>
                      ))}
                    </div>
                  </section>
                ))}
                {groups.length > visible && (
                  <div className="gallery-show-more">
                    <p>
                      Showing {count(shownBuilds)} of {count(matching)} matching
                      builds
                    </p>
                    <button
                      onClick={() => setVisible((n) => n + PROMPTS_PER_PAGE)}
                    >
                      Show{" "}
                      {count(
                        Math.min(PROMPTS_PER_PAGE, groups.length - visible),
                      )}{" "}
                      more prompts <Icon name="arrowDown" size={18} />
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <section
                className="gallery-no-results"
                aria-labelledby="gallery-no-results-title"
              >
                <Icon name="search" size={28} />
                <h2 id="gallery-no-results-title">No matching builds</h2>
                <p>
                  Try a different search or clear your filters to see the whole
                  collection.
                </p>
                <button onClick={clearFilters}>Clear filters</button>
              </section>
            )}
            {footer}
          </div>
        </>
      )}
    </main>
  );
}
