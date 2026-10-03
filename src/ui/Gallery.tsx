import { useEffect, useRef, useState } from "react";
import {
  GALLERY_ANGLES,
  GALLERY_SAMPLES,
  MODEL_TOOLS,
  galleryAsset,
  type GalleryAngle,
  type GallerySample,
  type GallerySampleId,
  type ModelTool,
} from "../catalog/gallery";
import { Icon, type IconName } from "./icons";

type Props = {
  detailId?: GallerySampleId;
  onDetail: (id?: GallerySampleId) => void;
  onOpen: (sample: GallerySample, mode: ModelTool | "Play") => void;
  pending?: GallerySampleId;
  error: string;
  onImport: () => void;
};
const count = (n: number) => n.toLocaleString("en");

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
  sample,
  angle,
}: {
  sample: GallerySample;
  angle: GalleryAngle;
}) {
  return (
    <img
      src={galleryAsset(sample, `${angle}.png`)}
      alt={`${sample.title}, GPT-6.1-Sol at ${sample.effort} effort, ${GALLERY_ANGLES.find((a) => a.id === angle)!.label} view`}
      loading="lazy"
      width="1440"
      height="1000"
    />
  );
}

export function Gallery({
  detailId,
  onDetail,
  onOpen,
  pending,
  error,
  onImport,
}: Props) {
  const [prompt, setPrompt] = useState("temple");
  const [angle, setAngle] = useState<GalleryAngle>("iso");
  const [compare, setCompare] = useState(false);
  const [pair, setPair] = useState<[GallerySampleId, GallerySampleId]>([
    "high",
    "xhigh",
  ]);
  const [efforts, setEfforts] = useState<GallerySampleId[]>(
    GALLERY_SAMPLES.map((s) => s.id),
  );
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [detailAngle, setDetailAngle] = useState<GalleryAngle>("iso");
  const heading = useRef<HTMLHeadingElement>(null);
  const sample = GALLERY_SAMPLES.find((s) => s.id === detailId);
  useEffect(() => {
    setDetailAngle("iso");
    heading.current?.focus({ preventScroll: true });
  }, [detailId]);
  const open = (s: GallerySample, mode: ModelTool | "Play") => onOpen(s, mode);
  const filtered = compare
    ? pair.map((id) => GALLERY_SAMPLES.find((s) => s.id === id)!)
    : GALLERY_SAMPLES.filter((s) => efforts.includes(s.id));
  const selectPrompt = (value: string) => {
    setPrompt(value);
    onDetail(undefined);
  };
  return (
    <main className="gallery-page" aria-label="Agent model gallery">
      {error && (
        <div className="gallery-error" role="alert">
          {error} Try opening the model again.
        </div>
      )}
      {pending && (
        <div className="gallery-loading" role="status">
          Opening the{" "}
          {GALLERY_SAMPLES.find((s) => s.id === pending)?.title.toLowerCase()}…
        </div>
      )}
      {sample ? (
        <div className="gallery-detail">
          <button className="gallery-back" onClick={() => onDetail(undefined)}>
            <Icon name="arrowLeft" size={18} />
            All responses
          </button>
          <div className="gallery-detail-layout">
            <section
              className={`gallery-detail-stage gallery-tone-${sample.tone}`}
              aria-label="Selected model preview"
            >
              <ModelImage sample={sample} angle={detailAngle} />
              <Angles value={detailAngle} onChange={setDetailAngle} />
            </section>
            <section className="gallery-detail-info">
              <h1 ref={heading} tabIndex={-1}>
                {sample.title}.
              </h1>
              <p className="gallery-source">
                GPT-6.1-Sol <span>{sample.effort} effort</span>
              </p>
              <p>
                {sample.description} Generated from the same short temple brief.
              </p>
              <dl>
                <div>
                  <dt>Parts</dt>
                  <dd>{count(sample.parts)}</dd>
                </div>
                <div>
                  <dt>Generation</dt>
                  <dd>One-shot + repair</dd>
                </div>
                <div>
                  <dt>Source</dt>
                  <dd>Geometry-rules run</dd>
                </div>
              </dl>
              <button
                className="primary gallery-explore"
                disabled={!!pending}
                onClick={() => open(sample, "Play")}
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
                    onClick={() => open(sample, t.name)}
                  >
                    <Icon name={t.name.toLowerCase() as IconName} size={18} />
                    {t.name}
                  </button>
                ))}
              </div>
              <details className="gallery-notes">
                <summary>Prompt &amp; generation notes</summary>
                <p>
                  “a japanese buddhist temple” · Target: 2,000 parts ± 5%.
                  GPT-6.1-Sol, 2 October 2026. Every effort was accepted after a
                  second reply. Warning diagnostics still apply.
                </p>
                <p>
                  Titles are editorial descriptions. Models open as editable
                  local copies; the gallery originals stay intact.
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
              {[
                { id: "temple", name: "Japanese temple", meta: "5" },
                { id: "village", name: "Seaside village", meta: "Placeholder" },
                { id: "station", name: "Space station", meta: "Placeholder" },
              ].map((p) => (
                <button
                  key={p.id}
                  aria-pressed={prompt === p.id}
                  onClick={() => selectPrompt(p.id)}
                >
                  {p.name}
                  <small>{p.meta}</small>
                </button>
              ))}
            </div>
            <select
              aria-label="Choose a prompt"
              value={prompt}
              onChange={(e) => selectPrompt(e.target.value)}
            >
              <option value="temple">Japanese Buddhist temple</option>
              <option value="village">Seaside village · Placeholder</option>
              <option value="station">Space station · Placeholder</option>
            </select>
          </div>
          <div className="gallery-body">
            {prompt === "temple" ? (
              <>
                <div className="gallery-heading">
                  <div>
                    <h1 ref={heading} tabIndex={-1}>
                      One temple. Five takes.
                    </h1>
                    <p>The brief: “a japanese buddhist temple”</p>
                  </div>
                  <div className="gallery-target">
                    <Icon name="build" size={18} />
                    <strong>2,000 parts</strong>
                    <span>in the brief · ± 5%</span>
                  </div>
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
                    <span>{filtered.length} real responses</span>
                    {filtersOpen && (
                      <div className="gallery-filters">
                        <strong>GPT-6.1-Sol</strong>
                        <p>Reasoning levels</p>
                        {GALLERY_SAMPLES.map((s) => (
                          <label key={s.id}>
                            <input
                              type="checkbox"
                              checked={efforts.includes(s.id)}
                              onChange={() => {
                                setCompare(false);
                                setEfforts((ids) =>
                                  ids.includes(s.id)
                                    ? ids.filter((id) => id !== s.id)
                                    : [...ids, s.id],
                                );
                              }}
                            />
                            {s.effort} effort
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                  <Angles value={angle} onChange={setAngle} />
                  <button
                    className="gallery-quiet gallery-compare"
                    aria-label="Compare responses"
                    aria-pressed={compare}
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
                    These samples use one agent at five reasoning levels. Other
                    agents are shown as placeholders.
                  </span>
                  <span className="gallery-note-short">
                    One agent · five reasoning levels · real builds.
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
                            const choice = e.target.value as GallerySampleId;
                            if (choice === pair[1 - i]) next[1 - i] = pair[i];
                            next[i] = choice;
                            setPair(next);
                          }}
                        >
                          {GALLERY_SAMPLES.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.effort} · {s.title}
                            </option>
                          ))}
                        </select>
                      </label>
                    ))}
                  </div>
                )}
                {filtered.length ? (
                  <section
                    className={`gallery-responses${compare ? " gallery-comparing" : ""}`}
                    aria-label="Responses to the same prompt"
                  >
                    {filtered.map((s) => (
                      <article className="gallery-response" key={s.id}>
                        <div className={`gallery-stage gallery-tone-${s.tone}`}>
                          <ModelImage sample={s} angle={angle} />
                          <div className="gallery-agent">
                            <Icon name="build" size={18} />
                            <span>
                              GPT-6.1-Sol<small>{s.effort} effort</small>
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
                            onClick={() => open(s, "Play")}
                          >
                            <Icon name="resume" size={16} />
                            Explore<span className="sr-only"> {s.title}</span>
                          </button>
                        </div>
                      </article>
                    ))}
                    {!compare && (
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
                    <button
                      onClick={() =>
                        setEfforts(GALLERY_SAMPLES.map((s) => s.id))
                      }
                    >
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
                  {prompt === "village" ? "Seaside village" : "Space station"}{" "}
                  is a placeholder prompt. No generated models are available
                  yet.
                </p>
                <button
                  className="primary"
                  onClick={() => selectPrompt("temple")}
                >
                  Browse the temple responses
                </button>
              </div>
            )}
            <footer className="gallery-footer">
              <strong>One prompt. Many builds. Step inside.</strong>
              <span>Generated sample · 2 October 2026</span>
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
