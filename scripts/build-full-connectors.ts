// Derives connectors (studs, side studs, jumper studs, anti-studs, hinge pins
// and sockets) and body occupancy for every top-level part of the complete
// official LDraw pack, verifies each part with the same whole-part rules as
// the curated catalogue (src/catalog/connector-extract.ts) and writes a
// hash-locked, sharded pack loaded on demand with the part:
//
//   npm run library:full-connectors [-- --workers 4]
//
// Output: public/libraries/connectors-<full releaseId>/
//   manifest.json          identity, library it was derived from, coverage, shard table
//   shards/<sha256>.bin    gzip of {"format", "parts": {name: entry}}; a part's
//                          shard is shardOf(name, shards.length)
// and src/catalog/full-connectors-lock.json (the lock builds and projects record).
// Work is spread over worker threads (one per core by default). Method, rules
// and limits: docs/CONNECTORS.md.
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { createHash } from "node:crypto";
import { gunzipSync, gzipSync } from "node:zlib";
import { availableParallelism } from "node:os";
import { fileURLToPath } from "node:url";
import {
  Worker,
  isMainThread,
  parentPort,
  workerData,
} from "node:worker_threads";
import {
  extractConnectors,
  verifyConnectors,
  type RawConnector,
} from "../src/catalog/connector-extract";
import {
  encodeConnectors,
  encodeOccupancy,
} from "../src/catalog/connector-pack";
import {
  FULL_CONNECTOR_FORMAT,
  fullPartSpec,
  shardOf,
  shardPath,
  type FullConnectorEntry,
  type FullConnectorManifest,
} from "../src/catalog/full-connector-pack";
import {
  chunkPath,
  directReferences,
  type FullPackCatalogEntry,
  type FullPackIndex,
  type FullPackManifest,
} from "../src/catalog/full-pack";

const digest = (b: Uint8Array | string) =>
  createHash("sha256").update(b).digest("hex");

/** Shards of the pack: ~100 parts (tens of KB gzip) each for 25k parts. */
export const SHARDS = 256;
export const connectorPackIdFor = (releaseId: string) =>
  "connectors-" + releaseId;

/** Reads a built complete pack from disk, verified against its manifest. */
export function readFullPack(dir: string, manifestSha256?: string) {
  const raw = readFileSync(dir + "manifest.json");
  if (manifestSha256 && digest(raw) !== manifestSha256)
    throw new Error("Full library manifest does not match its lock: " + dir);
  const manifest = JSON.parse(raw.toString()) as FullPackManifest;
  const pinned = (f: { path: string; sha256: string }) => {
    const b = readFileSync(dir + f.path);
    if (digest(b) !== f.sha256) throw new Error("Hash mismatch " + f.path);
    return JSON.parse(b.toString());
  };
  const index = pinned(manifest.index) as FullPackIndex;
  const catalog = pinned(manifest.catalog) as FullPackCatalogEntry[];
  const where = new Map<string, number>();
  index.chunks.forEach(([, , names], i) =>
    names.forEach((n) => where.set(n, i)),
  );
  const chunks = new Map<number, Map<string, string>>();
  const chunk = (i: number) => {
    let texts = chunks.get(i);
    if (!texts) {
      const [sha, , names, lengths] = index.chunks[i];
      const stored = readFileSync(dir + chunkPath(sha));
      if (digest(stored) !== sha) throw new Error("Chunk hash mismatch " + sha);
      const body = gunzipSync(stored);
      texts = new Map();
      let offset = 0;
      names.forEach((n, k) => {
        texts!.set(n, body.subarray(offset, offset + lengths[k]).toString());
        offset += lengths[k];
      });
      chunks.set(i, texts);
    }
    return texts;
  };
  /** A file and its whole dependency closure, keyed by reference name. */
  const sources = (name: string) => {
    const out: Record<string, string> = {};
    const visit = (n: string) => {
      if (Object.hasOwn(out, n)) return;
      const c = where.get(n);
      if (c === undefined) return;
      const text = chunk(c).get(n)!;
      out[n] = text;
      for (const d of directReferences(text)) visit(d);
    };
    visit(name);
    return out;
  };
  return { manifest, index, catalog, sources };
}

/** Derives and verifies one part (the curated build's rules and encoding). */
export function deriveEntry(
  sources: Record<string, string>,
  name: string,
  title: string,
  category: string,
  b: readonly number[] | null,
): FullConnectorEntry & { derived: boolean } {
  if (!b)
    return {
      derived: false,
      verified: false,
      runs: [],
      reasons: [
        "Bounds unknown: the official archive lacks a file this part uses",
      ],
    };
  const spec = fullPartSpec(title, category, b);
  let e;
  try {
    e = extractConnectors(
      sources,
      name,
      { min: b.slice(0, 3), max: b.slice(3) },
      spec.align,
    );
  } catch (error) {
    return {
      derived: false,
      verified: false,
      runs: [],
      reasons: [
        "Derivation failed: " +
          String(error instanceof Error ? error.message : error).slice(0, 160),
      ],
    };
  }
  const v = verifyConnectors(spec, e);
  const connectors = (e.connectors as RawConnector[]).filter(
    (c) => v.rule !== "hinge-leaf" || c.kind === "pin",
  );
  return {
    derived: true,
    verified: v.verified,
    ...(v.rule ? { rule: v.rule } : {}),
    ...encodeConnectors(connectors),
    ...(e.pins
      ? {
          hinge: {
            axis: e.pins.axis,
            pivot: e.pins.top.map((n, i) =>
              i === 1 ? (n + e.pins!.bottom[1]) / 2 : n,
            ) as [number, number, number],
            pins: [e.pins.top, e.pins.bottom],
            protrusion: e.pins.protrusion,
            radius: e.pins.radius,
          },
        }
      : {}),
    ...(e.sockets.length ? { sockets: e.sockets } : {}),
    occupancy: encodeOccupancy(e.occupancy),
    ...(v.reasons.length ? { reasons: v.reasons.slice(0, 4) } : {}),
  };
}

type Job = { dir: string; manifestSha256: string };

// Worker: derive the parts it is sent, one batch at a time.
if (!isMainThread && workerData?.fullConnectorJob) {
  const { dir, manifestSha256 } = workerData.fullConnectorJob as Job;
  const pack = readFullPack(dir, manifestSha256);
  const titles = new Map(pack.catalog.map((c) => [c[0], c]));
  parentPort!.on("message", (names: string[] | null) => {
    if (!names) return process.exit(0);
    const out: [string, FullConnectorEntry & { derived: boolean }][] = [];
    for (const name of names) {
      const [, title = "", category = ""] = titles.get(name) ?? [];
      out.push([
        name,
        deriveEntry(
          pack.sources(name),
          name,
          title,
          category,
          pack.index.parts[name][1],
        ),
      ]);
    }
    parentPort!.postMessage(out);
  });
  parentPort!.postMessage("ready");
}

/**
 * Builds the pack for the complete library in `libraryDir` into
 * `outRoot/connectors-<releaseId>/` and returns its manifest and lock.
 */
export async function buildFullConnectors(options: {
  libraryDir: string;
  manifestSha256: string;
  outRoot: string;
  workers?: number;
  /** Only these parts (tests); the others are left out of the pack. */
  only?: string[];
  log?: (line: string) => void;
}) {
  const log = options.log ?? (() => {});
  const { manifest, index, catalog } = readFullPack(
    options.libraryDir,
    options.manifestSha256,
  );
  const names = (options.only ?? Object.keys(index.parts)).filter((n) =>
    Object.hasOwn(index.parts, n),
  );
  // Largest closures first, so a slow part does not finish last.
  const cost = (n: string) => index.parts[n][0].length;
  const queue = [...names].sort((a, b) => cost(b) - cost(a));
  const results = new Map<string, FullConnectorEntry & { derived: boolean }>();
  const count = Math.max(
    1,
    Math.min(options.workers ?? availableParallelism(), queue.length || 1),
  );
  const started = Date.now();
  if (options.workers === 0) {
    // In process (tests, tiny packs).
    const pack = readFullPack(options.libraryDir, options.manifestSha256);
    const titles = new Map(pack.catalog.map((c) => [c[0], c]));
    for (const name of queue) {
      const [, title = "", category = ""] = titles.get(name) ?? [];
      results.set(
        name,
        deriveEntry(
          pack.sources(name),
          name,
          title,
          category,
          index.parts[name][1],
        ),
      );
    }
    queue.length = 0;
  }
  if (queue.length)
    await Promise.all(
      Array.from(
        { length: count },
        () =>
          new Promise<void>((resolve, reject) => {
            // Workers load this TypeScript file through tsx's loader.
            const worker = new Worker(
              `import(${JSON.stringify(import.meta.resolve("tsx/esm/api"))})` +
                `.then((m) => { m.register(); return import(${JSON.stringify(import.meta.url)}); })`,
              {
                eval: true,
                workerData: {
                  fullConnectorJob: {
                    dir: options.libraryDir,
                    manifestSha256: options.manifestSha256,
                  } satisfies Job,
                },
              },
            );
            const next = () => {
              const batch = queue.splice(0, 20);
              worker.postMessage(batch.length ? batch : null);
              if (!batch.length) resolve();
            };
            worker.on("message", (m) => {
              if (m !== "ready")
                for (const [n, e] of m as [
                  string,
                  FullConnectorEntry & { derived: boolean },
                ][])
                  results.set(n, e);
              if (results.size && results.size % 2000 < 20)
                log(
                  `${results.size}/${names.length} parts, ${Math.round((Date.now() - started) / 1000)} s`,
                );
              next();
            });
            worker.on("error", reject);
            worker.on("exit", (code) =>
              code ? reject(new Error("Worker exited " + code)) : resolve(),
            );
          }),
      ),
    );
  if (results.size !== names.length)
    throw new Error(`Derived ${results.size} of ${names.length} parts`);

  // Coverage by LDraw category.
  const categoryOf = new Map(catalog.map((c) => [c[0], c[2] || "Other"]));
  const coverage: FullConnectorManifest["coverage"] = {
    parts: names.length,
    derived: 0,
    verified: 0,
    byRule: {},
    byCategory: {},
    failed: 0,
  };
  for (const n of names) {
    const e = results.get(n)!;
    const cat = categoryOf.get(n) ?? "Other";
    const row = (coverage.byCategory[cat] ??= [0, 0, 0]);
    row[0]++;
    if (e.derived) {
      coverage.derived++;
      row[1]++;
    } else coverage.failed++;
    if (e.verified) {
      coverage.verified++;
      row[2]++;
      coverage.byRule[e.rule!] = (coverage.byRule[e.rule!] ?? 0) + 1;
    }
  }
  coverage.byCategory = Object.fromEntries(
    Object.entries(coverage.byCategory).sort(
      (a, b) => b[1][0] - a[1][0] || a[0].localeCompare(b[0]),
    ),
  );

  // Shards: content addressed, never rewritten.
  const id = connectorPackIdFor(manifest.releaseId);
  const root = `${options.outRoot}${id}/`;
  mkdirSync(root + "shards", { recursive: true });
  const buckets: string[][] = Array.from({ length: SHARDS }, () => []);
  for (const n of names) buckets[shardOf(n, SHARDS)].push(n);
  const natural = (a: string, b: string) =>
    a.localeCompare(b, "en", { numeric: true });
  let rawBytes = 0,
    packedBytes = 0;
  const wanted = new Set<string>();
  const shards = buckets.map((list) => {
    const parts: Record<string, FullConnectorEntry> = {};
    for (const n of list.sort(natural)) {
      const { derived: _, ...entry } = results.get(n)!;
      parts[n] = entry;
    }
    const json = JSON.stringify({ format: FULL_CONNECTOR_FORMAT, parts });
    const gz = gzipSync(json, { level: 9 });
    const sha = digest(gz);
    const path = root + shardPath(sha);
    if (!existsSync(path)) writeFileSync(path, gz);
    wanted.add(sha + ".bin");
    rawBytes += json.length;
    packedBytes += gz.length;
    return [sha, gz.length, list.length] as [string, number, number];
  });
  for (const stale of readdirSync(root + "shards"))
    if (!wanted.has(stale)) rmSync(root + "shards/" + stale);
  const pack: FullConnectorManifest = {
    format: FULL_CONNECTOR_FORMAT,
    id,
    library: {
      releaseId: manifest.releaseId,
      manifestSha256: options.manifestSha256,
    },
    licence:
      "Derived by an automated pipeline from the official LDraw parts library geometry (CC BY 4.0; see the complete pack's NOTICE.txt and public/notices/LDRAW.txt); the derived positions and occupancy boxes are distributed under the same licence with that attribution. No LDCad shadow-library data is used.",
    method:
      "Each top-level part is flattened through its subfile tree and derived and verified exactly as the curated catalogue (docs/CONNECTORS.md, connector pack ldraw-derived-connectors-2): stud primitives, cavity-tested anti-studs, hinge pins and sockets, occupancy boxes. The rules read the part's LDraw title in catalogue style (\"2 × 4\"), its !CATEGORY mapped to the catalogue's categories, and its footprint and grid phase from the pack's bounds. A part is verified only when a whole-part rule holds.",
    shards,
    coverage,
    rawBytes,
    packedBytes,
  };
  writeFileSync(root + "manifest.json", JSON.stringify(pack, null, 1) + "\n");
  const lock = {
    connectorPackId: id,
    manifestSha256: digest(readFileSync(root + "manifest.json")),
  };
  log(
    `Derived ${names.length} parts in ${Math.round((Date.now() - started) / 1000)} s with ${count} workers`,
  );
  return { manifest: pack, lock, root };
}

if (isMainThread && process.argv[1] === fileURLToPath(import.meta.url)) {
  const full = JSON.parse(
    readFileSync("src/catalog/full-library-lock.json", "utf8"),
  );
  const at = process.argv.indexOf("--workers");
  const { manifest, lock } = await buildFullConnectors({
    libraryDir: `public/libraries/${full.releaseId}/`,
    manifestSha256: full.manifestSha256,
    outRoot: "public/libraries/",
    workers: at > 0 ? Number(process.argv[at + 1]) : undefined,
    log: console.log,
  });
  writeFileSync(
    "src/catalog/full-connectors-lock.json",
    JSON.stringify(lock, null, 2) + "\n",
  );
  console.log(
    JSON.stringify(
      {
        ...lock,
        shards: manifest.shards.length,
        rawBytes: manifest.rawBytes,
        packedBytes: manifest.packedBytes,
        coverage: { ...manifest.coverage, byCategory: undefined },
      },
      null,
      2,
    ),
  );
}
