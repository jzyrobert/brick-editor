/**
 * Browser/worker loader for the complete official LDraw library pack.
 *
 * Every file is verified against the hash chain rooted in the build's lock
 * (manifest → index → chunk) before use, both when fetched and when read back
 * from Cache Storage. Verified responses are stored in a Cache Storage cache
 * named after the release, so a model that rendered once keeps rendering
 * offline. Chunks are fetched in one planned batch (bounded concurrency): each
 * top-level part's index entry lists every chunk of its dependency closure.
 */
import { gunzipSync } from "fflate";
import { sha256 } from "../core/hash";
import { AppError, ensure, type Project } from "../core/types";
import { retiredFullLibraryLocks } from "./catalog";
import {
  FULL_PACK_FORMAT,
  chunkPath,
  chunksFor,
  directReferences,
  type FullPackCatalogEntry,
  type FullPackIndex,
  type FullPackManifest,
} from "./full-pack";
import {
  addFullSources,
  curatedHas,
  fullCatalog,
  fullLibraryLock,
  fullSource,
  markFullUnavailable,
  pendingFullSources,
  registerFullCatalog,
  registerFullLibrary,
  registeredFullLibrary,
} from "./full-library";
import {
  addFullConnectorShard,
  fullConnectorLock,
  fullConnectorManifest,
  fullConnectorShardLoaded,
  registerFullConnectorManifest,
} from "./full-connectors";
import {
  FULL_CONNECTOR_FORMAT,
  shardOf,
  shardPath,
  type FullConnectorManifest,
  type FullConnectorShardData,
} from "./full-connector-pack";

export const fullLibraryCacheName =
  "brick-editor-ldraw-full:" + fullLibraryLock.releaseId;
const base = () =>
  new URL(
    import.meta.env.BASE_URL + "libraries/" + fullLibraryLock.releaseId + "/",
    location.href,
  ).href;
const decoder = new TextDecoder();

/** Request statistics (for tests and diagnostics). */
export const fullLibraryStats = { requests: 0, cacheHits: 0, bytes: 0 };

async function openCache() {
  try {
    return typeof caches === "undefined"
      ? undefined
      : await caches.open(fullLibraryCacheName);
  } catch {
    return undefined; // Opaque origins, private modes: network only.
  }
}

/** Verified bytes of one pack file: cache first (re-verified; a corrupt entry
 * is dropped), then network. A network response that fails its pin is rejected. */
async function verified(
  path: string,
  expected: string,
  bytes?: number,
  root = base(),
) {
  const url = root + path;
  const cache = await openCache();
  const hit = await cache?.match(url).catch(() => undefined);
  if (hit) {
    const b = new Uint8Array(await hit.arrayBuffer());
    if ((await sha256(b)) === expected) {
      fullLibraryStats.cacheHits++;
      return b;
    }
    await cache!.delete(url).catch(() => false);
  }
  let res: Response;
  try {
    fullLibraryStats.requests++;
    res = await fetch(url);
  } catch {
    throw new AppError(
      "REFERENCE_MISSING",
      "Full LDraw library is unavailable offline: " +
        path +
        " was not downloaded while online",
    );
  }
  ensure(
    res.ok,
    "REFERENCE_MISSING",
    "Full LDraw library file unavailable: " + path,
  );
  const b = new Uint8Array(await res.arrayBuffer());
  ensure(
    (bytes === undefined || b.length === bytes) &&
      (await sha256(b)) === expected,
    "INVALID_INPUT",
    "Full LDraw library hash mismatch: " + path,
  );
  fullLibraryStats.bytes += b.length;
  await cache?.put(url, new Response(b as BufferSource)).catch(() => {});
  return b;
}

let manifestLoad: Promise<FullPackManifest> | undefined;
const loadManifest = () =>
  (manifestLoad ??= (async () => {
    const manifest = JSON.parse(
      decoder.decode(
        await verified("manifest.json", fullLibraryLock.manifestSha256),
      ),
    ) as FullPackManifest;
    ensure(
      manifest.format === FULL_PACK_FORMAT,
      "INVALID_INPUT",
      "Unsupported full library format",
    );
    return manifest;
  })().catch((e) => {
    manifestLoad = undefined;
    throw e;
  }));

let indexLoad: Promise<void> | undefined;
/** Loads and registers the verified index (names, closures, bounds). */
export function loadFullLibraryIndex(): Promise<void> {
  if (registeredFullLibrary()) return Promise.resolve();
  return (indexLoad ??= (async () => {
    const manifest = await loadManifest();
    const index = JSON.parse(
      decoder.decode(
        await verified(
          manifest.index.path,
          manifest.index.sha256,
          manifest.index.bytes,
        ),
      ),
    ) as FullPackIndex;
    registerFullLibrary(manifest, index);
  })().catch((e) => {
    indexLoad = undefined;
    throw e;
  }));
}

let catalogLoad: Promise<FullPackCatalogEntry[]> | undefined;
/** Loads the searchable list of every official part (for the parts picker). */
export function loadFullCatalog(): Promise<FullPackCatalogEntry[]> {
  const ready = fullCatalog();
  if (ready) return Promise.resolve(ready);
  return (catalogLoad ??= (async () => {
    const manifest = await loadManifest();
    const entries = JSON.parse(
      decoder.decode(
        await verified(
          manifest.catalog.path,
          manifest.catalog.sha256,
          manifest.catalog.bytes,
        ),
      ),
    ) as FullPackCatalogEntry[];
    registerFullCatalog(entries);
    return entries;
  })().catch((e) => {
    catalogLoad = undefined;
    throw e;
  }));
}

const chunkLoads = new Map<number, Promise<Map<string, string>>>();
function loadChunk(index: FullPackIndex, chunk: number) {
  let load = chunkLoads.get(chunk);
  if (!load) {
    load = (async () => {
      const [sha, bytes, names, lengths] = index.chunks[chunk];
      const raw = gunzipSync(await verified(chunkPath(sha), sha, bytes));
      ensure(
        raw.length === lengths.reduce((a, b) => a + b, 0),
        "INVALID_INPUT",
        "Full LDraw library chunk layout mismatch",
      );
      const texts = new Map<string, string>();
      let offset = 0;
      names.forEach((name, i) => {
        texts.set(
          name,
          decoder.decode(raw.subarray(offset, offset + lengths[i])),
        );
        offset += lengths[i];
      });
      return texts;
    })();
    load.catch(() => chunkLoads.delete(chunk));
    chunkLoads.set(chunk, load);
  }
  return load;
}

async function pooled<T>(
  items: T[],
  limit: number,
  work: (item: T) => Promise<unknown>,
) {
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) await work(items[next++]);
    }),
  );
}

/**
 * Loads these official definitions and their whole dependency closure. One
 * round normally suffices (top-level parts carry their closure's chunk list);
 * references reached only through directly used subparts or primitives take
 * further rounds.
 */
export async function loadFullSources(names: Iterable<string>) {
  await loadFullLibraryIndex();
  const { index, where } = registeredFullLibrary()!;
  const requested = [...names];
  // Derived connector and occupancy data travels with each top-level part. It
  // is optional: a part without it still renders and places by its bounds, so
  // its failure never fails the geometry load.
  const connectors = loadFullConnectors(
    requested.filter((n) => Object.hasOwn(index.parts, n)),
  ).catch(() => {});
  const roots = pendingFullSources(requested);
  markFullUnavailable(roots, false);
  let wanted = roots;
  for (let round = 0; wanted.length; round++) {
    ensure(round < 64, "REFERENCE_CYCLE", "Full library closure too deep");
    const chunks = [...chunksFor(index, where, wanted)];
    const texts = new Map<string, string>();
    const failed = new Set<number>();
    let error: unknown;
    await pooled(chunks, 12, async (c) => {
      try {
        for (const [name, text] of await loadChunk(index, c))
          if (!curatedHas(name) && !fullSource(name)) texts.set(name, text);
      } catch (e) {
        failed.add(c);
        error ??= e;
      }
    });
    addFullSources(texts);
    if (error) {
      // Parts whose closure touches a refused or unavailable chunk resolve as
      // missing (a visible diagnostic), never as partially loaded geometry.
      markFullUnavailable(
        roots.filter((n) =>
          (index.parts[n]?.[0] ?? [where.get(n)!.chunk]).some((c) =>
            failed.has(c),
          ),
        ),
        true,
      );
      throw error;
    }
    // Anything the loaded closure still lacks (reached via a subpart root).
    const missing = new Set<string>();
    const seen = new Set<string>();
    const visit = (name: string) => {
      if (seen.has(name)) return;
      seen.add(name);
      const text = fullSource(name);
      if (text === undefined) {
        missing.add(name);
        return;
      }
      for (const d of directReferences(text)) visit(d);
    };
    for (const n of wanted) visit(n);
    wanted = pendingFullSources(missing);
  }
  await connectors;
}

const connectorBase = () =>
  new URL(
    import.meta.env.BASE_URL +
      "libraries/" +
      fullConnectorLock.connectorPackId +
      "/",
    location.href,
  ).href;
let connectorManifestLoad: Promise<FullConnectorManifest> | undefined;
const loadConnectorManifest = () =>
  (connectorManifestLoad ??= (async () => {
    const m = JSON.parse(
      decoder.decode(
        await verified(
          "manifest.json",
          fullConnectorLock.manifestSha256,
          undefined,
          connectorBase(),
        ),
      ),
    ) as FullConnectorManifest;
    registerFullConnectorManifest(m);
    return fullConnectorManifest()!;
  })().catch((e) => {
    connectorManifestLoad = undefined;
    throw e;
  }));
const shardLoads = new Map<number, Promise<void>>();
/**
 * Loads the derived connector and occupancy data (full-connectors.ts) of
 * these complete-library parts: one verified shard per part group, cached
 * offline like the geometry. Snapping, clash tests and health use it once
 * registered.
 */
export async function loadFullConnectors(names: Iterable<string>) {
  const wanted = [...names].filter((n) => !curatedHas(n));
  if (!wanted.length) return;
  const m = await loadConnectorManifest();
  const shards = new Set(wanted.map((n) => shardOf(n, m.shards.length)));
  await pooled([...shards], 6, async (shard) => {
    if (fullConnectorShardLoaded(shard)) return;
    let load = shardLoads.get(shard);
    if (!load) {
      load = (async () => {
        const [sha, bytes] = m.shards[shard];
        const data = JSON.parse(
          decoder.decode(
            gunzipSync(
              await verified(shardPath(sha), sha, bytes, connectorBase()),
            ),
          ),
        ) as FullConnectorShardData;
        ensure(
          data.format === FULL_CONNECTOR_FORMAT,
          "INVALID_INPUT",
          "Unsupported connector shard format",
        );
        addFullConnectorShard(shard, data.parts);
      })();
      load.catch(() => shardLoads.delete(shard));
      shardLoads.set(shard, load);
    }
    await load;
  });
}

/** Library references of a project that name files outside the curated pack. */
export function unresolvedCuratedRefs(p: Project) {
  const refs = new Set<string>();
  for (const m of Object.values(p.models))
    for (const n of m.nodes)
      if (n.kind !== "geometry" && !Object.hasOwn(p.models, n.ref))
        if (!curatedHas(n.ref)) refs.add(n.ref);
  return refs;
}

/** Names in LDraw source text (type-1 lines) outside the curated pack. */
export function sourceNeedsFullLibrary(text: string) {
  const local = new Set(
    [...text.matchAll(/^\s*0\s+FILE\s+(.+?)\s*$/gim)].map((m) =>
      m[1].replaceAll("\\", "/").toLowerCase(),
    ),
  );
  for (const ref of directReferences(text))
    if (!curatedHas(ref) && !local.has(ref)) return true;
  return false;
}

/**
 * Makes every official reference of a project resolvable: registers the index
 * and loads definitions (with dependencies) the curated pack lacks. Resolves
 * to an error message instead of throwing, so an unavailable pack leaves those
 * parts visibly unresolved rather than blocking the rest of the model.
 */
export async function prepareFullLibrary(p: Project): Promise<string | null> {
  const refs = unresolvedCuratedRefs(p);
  if (!refs.size) return null;
  if (
    p.library.full &&
    p.library.full.manifestSha256 !== fullLibraryLock.manifestSha256
  ) {
    const retired = retiredFullLibraryLocks.find(
      (l) => l.manifestSha256 === p.library.full!.manifestSha256,
    );
    if (retired) {
      const changed = new Set(retired.affected ?? []);
      const hit = [...refs].filter((r) => !retired.affected || changed.has(r));
      return `This project pins the retired complete LDraw library ${retired.releaseId}. ${hit.length ? hit.slice(0, 5).join(", ") + (hit.length > 5 ? "…" : "") : "Its parts"} changed in ${fullLibraryLock.releaseId}, so parts outside the curated pack stay unresolved rather than silently changing.`;
    }
    return "This project pins a different complete LDraw library; parts outside the curated pack stay unresolved.";
  }
  try {
    await loadFullSources(refs);
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
}
