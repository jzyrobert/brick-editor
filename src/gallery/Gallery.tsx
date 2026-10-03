// The agent gallery page (gallery.html, docs/GALLERY-PLAN.md §6): builds
// that models made from the same brief, as still renders. Everything here is
// static: index.json and the files it names come from the gallery bucket.
// Routes live in the fragment so static hosting needs no rewrites.
import { useEffect, useMemo, useState } from "react";
import {
  GALLERY_VIEWS,
  fetchGalleryIndex,
  galleryFileUrl,
  galleryDuration,
  galleryStats,
  gunzipBounded,
  type GalleryBuild,
  type GalleryIndex,
  type GalleryView,
} from "../catalog/gallery";
import { sha256 } from "../core/hash";

type Route =
  | { page: "home" }
  | { page: "prompt"; id: string }
  | { page: "build"; id: string };

export function parseRoute(hash: string): Route {
  const m = hash.match(/^#\/(p|b)\/([^/?#]+)$/);
  if (!m) return { page: "home" };
  const id = decodeURIComponent(m[2]);
  return m[1] === "p" ? { page: "prompt", id } : { page: "build", id };
}
const href = (r: Route) =>
  r.page === "home"
    ? "#/"
    : `#/${r.page === "prompt" ? "p" : "b"}/${encodeURIComponent(r.id)}`;

const VIEW_LABELS: Record<GalleryView, string> = {
  iso: "Corner",
  front: "Front",
  "iso-back": "Back",
  top: "Top",
};

function useRoute() {
  const [route, setRoute] = useState(() => parseRoute(location.hash));
  useEffect(() => {
    const on = () => {
      setRoute(parseRoute(location.hash));
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  return route;
}

type Load =
  | { state: "loading" }
  | { state: "ready"; index: GalleryIndex }
  | { state: "error"; message: string };

export function Gallery() {
  const route = useRoute();
  const [load, setLoad] = useState<Load>({ state: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [agent, setAgent] = useState("");
  useEffect(() => {
    let live = true;
    setLoad({ state: "loading" });
    if (!navigator.onLine) {
      setLoad({ state: "error", message: "The gallery needs a connection." });
      return;
    }
    fetchGalleryIndex()
      .then((index) => live && setLoad({ state: "ready", index }))
      .catch(
        (e: Error) => live && setLoad({ state: "error", message: e.message }),
      );
    return () => {
      live = false;
    };
  }, [attempt]);
  useEffect(() => {
    const retry = () => setAttempt((n) => n + 1);
    window.addEventListener("online", retry);
    return () => window.removeEventListener("online", retry);
  }, []);
  const title =
    load.state === "ready" ? pageTitle(load.index, route) : "Agent gallery";
  useEffect(() => {
    document.title = `${title} · Brick Editor`;
  }, [title]);
  return (
    <div className="gallery">
      <header className="gallery-bar">
        <a className="gallery-home" href="#/">
          Agent gallery
        </a>
        <a className="gallery-editor" href="./">
          Open the editor
        </a>
      </header>
      <main className="gallery-main">
        {load.state === "loading" && (
          <p className="gallery-note" role="status">
            Loading the gallery…
          </p>
        )}
        {load.state === "error" && (
          <section className="gallery-note" role="alert">
            <p>{load.message}</p>
            <button onClick={() => setAttempt((n) => n + 1)}>Try again</button>
          </section>
        )}
        {load.state === "ready" && route.page === "home" && (
          <Home index={load.index} agent={agent} setAgent={setAgent} />
        )}
        {load.state === "ready" && route.page === "prompt" && (
          <PromptPage
            index={load.index}
            id={route.id}
            agent={agent}
            setAgent={setAgent}
          />
        )}
        {load.state === "ready" && route.page === "build" && (
          <BuildPage index={load.index} id={route.id} />
        )}
      </main>
    </div>
  );
}

function pageTitle(index: GalleryIndex, route: Route) {
  if (route.page === "prompt")
    return index.prompts.find((p) => p.id === route.id)?.brief ?? "Not found";
  if (route.page === "build") {
    const b = index.builds.find((b) => b.id === route.id);
    return b ? agentName(index, b.agent) : "Not found";
  }
  return "Agent gallery";
}
const agentName = (index: GalleryIndex, id: string) =>
  index.agents.find((a) => a.id === id)?.name ?? id;
const sentence = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function AgentFilter({
  index,
  agent,
  setAgent,
  agents,
}: {
  index: GalleryIndex;
  agent: string;
  setAgent: (a: string) => void;
  agents: string[];
}) {
  return (
    <label className="gallery-filter">
      Made by
      <select value={agent} onChange={(e) => setAgent(e.target.value)}>
        <option value="">Any model</option>
        {index.agents
          .filter((a) => agents.includes(a.id))
          .map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
      </select>
    </label>
  );
}

function Home({
  index,
  agent,
  setAgent,
}: {
  index: GalleryIndex;
  agent: string;
  setAgent: (a: string) => void;
}) {
  const prompts = index.prompts
    .map((p) => ({
      prompt: p,
      builds: index.builds.filter(
        (b) => b.prompt === p.id && (!agent || b.agent === agent),
      ),
    }))
    .filter((p) => p.builds.length);
  return (
    <>
      <section className="gallery-intro">
        <h1>Agent gallery</h1>
        <p>
          AI models were given the same short brief and a part budget, and each
          wrote a build script that this app turned into real bricks. Compare
          what they made, then open any build in 3D.
        </p>
        <AgentFilter
          index={index}
          agent={agent}
          setAgent={setAgent}
          agents={[...new Set(index.builds.map((b) => b.agent))]}
        />
      </section>
      {prompts.length === 0 && <p className="gallery-note">No builds yet.</p>}
      <ul className="gallery-prompts">
        {prompts.map(({ prompt, builds }) => (
          <li key={prompt.id}>
            <a
              className="gallery-prompt"
              href={href({ page: "prompt", id: prompt.id })}
            >
              <span className="gallery-strip" aria-hidden="true">
                {builds.slice(0, 4).map((b) => (
                  <CardImage key={b.id} index={index} build={b} alt="" />
                ))}
              </span>
              <span className="gallery-prompt-text">
                <strong>{sentence(prompt.brief)}</strong>
                <span className="muted">
                  {builds.length} build{builds.length === 1 ? "" : "s"}
                  {prompt.targetParts
                    ? ` · aiming for ${prompt.targetParts.toLocaleString("en-US")} parts`
                    : ""}
                </span>
              </span>
            </a>
          </li>
        ))}
      </ul>
    </>
  );
}

function CardImage({
  index,
  build,
  alt,
}: {
  index: GalleryIndex;
  build: GalleryBuild;
  alt: string;
}) {
  const sha = build.renders.card ?? build.renders.iso;
  if (!sha) return <span className="gallery-card-image missing" />;
  return (
    <img
      className="gallery-card-image"
      src={galleryFileUrl(index.files, "r", sha)}
      width={480}
      height={360}
      loading="lazy"
      decoding="async"
      alt={alt}
    />
  );
}

function PromptPage({
  index,
  id,
  agent,
  setAgent,
}: {
  index: GalleryIndex;
  id: string;
  agent: string;
  setAgent: (a: string) => void;
}) {
  const prompt = index.prompts.find((p) => p.id === id);
  const all = index.builds.filter((b) => b.prompt === id);
  if (!prompt) return <NotFound what="brief" />;
  // Grouped by model, then effort, so one model's runs sit together.
  const shown = all
    .filter((b) => !agent || b.agent === agent)
    .sort(
      (a, b) =>
        a.agent.localeCompare(b.agent, "en") ||
        b.created.localeCompare(a.created),
    );
  return (
    <>
      <nav className="gallery-crumbs">
        <a href="#/">All briefs</a>
      </nav>
      <section className="gallery-intro">
        <h1>{sentence(prompt.brief)}</h1>
        <p className="muted">
          {all.length} build{all.length === 1 ? "" : "s"}
          {prompt.targetParts
            ? ` · each aiming for ${prompt.targetParts.toLocaleString("en-US")} parts`
            : ""}
        </p>
        <AgentFilter
          index={index}
          agent={agent}
          setAgent={setAgent}
          agents={[...new Set(all.map((b) => b.agent))]}
        />
      </section>
      <ul className="gallery-cards">
        {shown.map((b) => (
          <li key={b.id}>
            <a
              className="gallery-card"
              href={href({ page: "build", id: b.id })}
            >
              <CardImage
                index={index}
                build={b}
                alt={`${agentName(index, b.agent)}: ${prompt.brief}`}
              />
              <span className="gallery-card-text">
                <strong>{agentName(index, b.agent)}</strong>
                <span className="muted">{galleryStats(b)}</span>
                {b.warnings > 0 && (
                  <span className="gallery-warning">
                    {b.warnings} warning{b.warnings === 1 ? "" : "s"}
                  </span>
                )}
              </span>
            </a>
          </li>
        ))}
      </ul>
    </>
  );
}

function BuildPage({ index, id }: { index: GalleryIndex; id: string }) {
  const build = index.builds.find((b) => b.id === id);
  const [view, setView] = useState<GalleryView>("iso");
  const [download, setDownload] = useState("");
  const views = useMemo(
    () => GALLERY_VIEWS.filter((v) => build?.renders[v]),
    [build],
  );
  if (!build) return <NotFound what="build" />;
  const prompt = index.prompts.find((p) => p.id === build.prompt)!;
  const name = agentName(index, build.agent);
  const sha = build.renders[view] ?? build.renders.iso;
  const facts: [string, string | undefined][] = [
    ["Parts", build.parts.toLocaleString("en-US")],
    [
      "Time",
      build.seconds === undefined ? undefined : galleryDuration(build.seconds),
    ],
    [
      "Cost",
      build.costUsd === undefined ? undefined : `$${build.costUsd.toFixed(2)}`,
    ],
    ["Replies", build.attempts?.toString()],
    ["Output tokens", build.outputTokens?.toLocaleString("en-US")],
    ["Warnings", String(build.warnings)],
  ];
  const saveModel = async () => {
    setDownload("Downloading…");
    try {
      const res = await fetch(galleryFileUrl(index.files, "b", build.mpd));
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const bytes = gunzipBounded(
        new Uint8Array(await res.arrayBuffer()),
        build.mpdBytes,
      );
      if ((await sha256(bytes)) !== build.mpd)
        throw new Error("checksum mismatch");
      const url = URL.createObjectURL(
        new Blob([bytes], { type: "text/plain" }),
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = `${prompt.id}-${build.id}.mpd`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setDownload("");
    } catch (e) {
      setDownload(
        navigator.onLine
          ? `Could not download the model (${(e as Error).message}).`
          : "The gallery needs a connection.",
      );
    }
  };
  return (
    <>
      <nav className="gallery-crumbs">
        <a href="#/">All briefs</a>
        <span aria-hidden="true"> › </span>
        <a href={href({ page: "prompt", id: prompt.id })}>
          {sentence(prompt.brief)}
        </a>
      </nav>
      <section className="gallery-build">
        <figure className="gallery-figure">
          {sha && (
            <img
              src={galleryFileUrl(index.files, "r", sha)}
              width={1024}
              height={768}
              alt={`${name}: ${prompt.brief}, ${VIEW_LABELS[view].toLowerCase()} view`}
            />
          )}
          {views.length > 1 && (
            <div className="gallery-views" role="group" aria-label="View">
              {views.map((v) => (
                <button
                  key={v}
                  aria-pressed={v === view}
                  onClick={() => setView(v)}
                >
                  {VIEW_LABELS[v]}
                </button>
              ))}
            </div>
          )}
        </figure>
        <div className="gallery-side">
          <h1>{name}</h1>
          <p className="muted">{sentence(prompt.brief)}</p>
          <a className="gallery-open primary" href={`./?gallery=${build.id}`}>
            Look around in 3D
          </a>
          <dl className="gallery-facts">
            {facts.map(([k, v]) =>
              v === undefined ? null : (
                <div key={k}>
                  <dt>{k}</dt>
                  <dd>{v}</dd>
                </div>
              ),
            )}
          </dl>
          <div className="gallery-downloads">
            <button onClick={() => void saveModel()}>
              Download model (.mpd)
            </button>
            {build.script && (
              <a
                href={galleryFileUrl(index.files, "s", build.script)}
                target="_blank"
                rel="noopener"
              >
                Build script (JSON)
              </a>
            )}
            {build.report && (
              <a
                href={galleryFileUrl(index.files, "p", build.report)}
                target="_blank"
                rel="noopener"
              >
                Run report (JSON)
              </a>
            )}
          </div>
          {download && <p role="status">{download}</p>}
          {build.source && (
            <p className="muted gallery-source">From run “{build.source}”.</p>
          )}
        </div>
      </section>
    </>
  );
}

function NotFound({ what }: { what: string }) {
  return (
    <section className="gallery-note" role="alert">
      <p>This {what} is not in the gallery (it may have been removed).</p>
      <a href="#/">See all briefs</a>
    </section>
  );
}
