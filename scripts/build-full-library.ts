// Builds the complete official LDraw library as a versioned, hash-locked "full"
// pack for on-demand loading, from the pinned official archive (complete.zip).
//
//   npx tsx scripts/build-full-library.ts [path/to/complete.zip]
//
// Without a path, the archive is read from (or downloaded to)
// .cache/ldraw/complete-<sha256>.zip. The archive must match the pinned sha256
// in scripts/full-library.json. Output: public/libraries/<releaseId>/ with
//   manifest.json   pack identity; pins index, catalogue, LDConfig and notices by hash
//   index.json      chunk table (sha256, size, file names and lengths in order)
//                   and, per top-level part, its dependency-closure chunks and bounds
//   catalog.json    searchable part list (number, title, category, keywords)
//   chunks/<sha256>.bin  gzip of the exact concatenated bytes of the listed files
//   CAreadme.txt, CAlicense4.txt, CAlicense.txt, NOTICE.txt
// Then run `npm run library:validate`.
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { gzipSync } from "node:zlib";
import { unzipSync } from "fflate";
import { fileURLToPath } from "node:url";
import { libraryBounds, packBounds } from "./library-bounds";
import { canonical } from "../src/ldraw/path";
import {
  FULL_PACK_FORMAT,
  chunkPath,
  type FullPackIndex,
  type FullPackManifest,
} from "../src/catalog/full-pack";

const digest = (b: Uint8Array | string) =>
  createHash("sha256").update(b).digest("hex");

export type FullLibraryConfig = {
  releaseId: string;
  retrieved: string;
  archive: { url: string; sha256: string; bytes: number };
  chunkTargetBytes: number;
  primitiveChunkTargetBytes: number;
};

/**
 * Builds the pack described by `config` from the archive at `zipPath` into
 * `librariesDir/<releaseId>/` and returns its manifest and lock (the caller
 * writes the lock). The archive must match `config.archive.sha256`.
 */
export function buildFullLibrary(options: {
  config: FullLibraryConfig;
  zipPath: string;
  librariesDir: string;
}) {
  const { config, zipPath } = options;
  const archive = readFileSync(zipPath);
  if (digest(archive) !== config.archive.sha256)
    throw new Error(
      `Archive hash mismatch: ${zipPath} is not the pinned complete.zip (${config.archive.sha256}). ` +
        "The upstream archive is updated in place; pin a new release in scripts/full-library.json.",
    );
  const entries = unzipSync(new Uint8Array(archive), {
    filter: (f) =>
      /^ldraw\/(parts|p)\/.+\.dat$/i.test(f.name) ||
      /^ldraw\/(LDConfig\.ldr|CAreadme\.txt|CAlicense4?\.txt)$/.test(f.name),
  });

  // 2. Files: exact bytes (a UTF-8 BOM, if any, is dropped as in the curated
  // pack), licence and provenance gates.
  type File = {
    name: string; // Reference name: path below parts/ or p/.
    path: string; // Library path (parts/…, p/…).
    bytes: Buffer;
    text: string;
    deps: string[];
  };
  const files = new Map<string, File>();
  let latestUpdate = "";
  for (const [zipName, data] of Object.entries(entries)) {
    const m = /^ldraw\/((parts|p)\/(.+))$/i.exec(zipName);
    if (!m) continue;
    let bytes = Buffer.from(data);
    if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf)
      bytes = bytes.subarray(3);
    const text = bytes.toString("utf8");
    const path = m[1].toLowerCase(),
      name = canonical(m[3]);
    if (files.has(name)) throw new Error("Name collision " + name);
    const licenses = [...text.matchAll(/^0 !LICENSE (.+)$/gm)].map((l) =>
      l[1].trim(),
    );
    if (!licenses.length || !licenses.every((l) => l.includes("CC BY 4.0")))
      throw new Error("Licence gate " + path);
    const kind = /^0 !LDRAW_ORG (\S+)(?:.*UPDATE (\d{4}-\d{2}))?/m.exec(text);
    if (!kind || kind[1].startsWith("Unofficial"))
      throw new Error("Not an official library file: " + path);
    if (kind[2] && kind[2] > latestUpdate) latestUpdate = kind[2];
    const deps = [
      ...new Set(
        text
          .split(/\r?\n/)
          .filter((line) => /^1\s/.test(line.trim()))
          .map((line) =>
            canonical(line.trim().split(/\s+/).slice(14).join(" ")),
          ),
      ),
    ];
    files.set(name, { name, path, bytes, text, deps });
  }
  // The official archive itself can reference a file it does not contain (an
  // upstream defect). Such references are recorded, not invented: the pack stays
  // exactly the archive, bounds of affected parts are unknown (null) and the
  // renderer reports the unresolved dependency.
  const unresolvedReferences: { from: string; ref: string }[] = [];
  for (const f of files.values()) {
    for (const d of f.deps)
      if (!files.has(d)) unresolvedReferences.push({ from: f.path, ref: d });
    f.deps = f.deps.filter((d) => files.has(d));
  }

  // 3. Transitive closures (memoised, cycle-checked).
  const closures = new Map<string, Set<string>>();
  const closure = (name: string, path = new Set<string>()): Set<string> => {
    const hit = closures.get(name);
    if (hit) return hit;
    if (path.has(name)) throw new Error("Dependency cycle at " + name);
    const next = new Set(path).add(name),
      out = new Set<string>();
    for (const d of files.get(name)!.deps) {
      out.add(d);
      for (const x of closure(d, next)) out.add(x);
    }
    closures.set(name, out);
    return out;
  };
  const isPart = (f: File) =>
    f.path.startsWith("parts/") && !f.path.startsWith("parts/s/");
  const natural = (a: string, b: string) =>
    a.localeCompare(b, "en", { numeric: true });
  const parts = [...files.values()]
    .filter(isPart)
    .map((f) => f.name)
    .sort(natural);
  for (const p of parts) closure(p);

  // 4. Bounds (unknown, null, when the closure lacks a file).
  const boundsOf = libraryBounds((name) => files.get(name)?.text);

  // 5. Chunk assignment. Primitives are ordered by how many parts use them, so
  // the hot shared ones sit in a few chunks and rare ones stay out of the way.
  // Each subpart travels with the first part (natural order) that uses it, and
  // parts are packed in natural order so a family (3001, 3001a, …) shares chunks.
  const usage = new Map<string, number>();
  for (const p of parts)
    for (const d of closures.get(p)!) usage.set(d, (usage.get(d) ?? 0) + 1);
  const primitives = [...files.values()]
    .filter((f) => f.path.startsWith("p/"))
    .map((f) => f.name)
    // Usage is bucketed (powers of two) so small shifts between releases keep
    // the order, and with it most chunk contents, unchanged.
    .sort(
      (a, b) =>
        Math.floor(Math.log2(1 + (usage.get(b) ?? 0))) -
          Math.floor(Math.log2(1 + (usage.get(a) ?? 0))) || natural(a, b),
    );
  const owner = new Map<string, string>();
  for (const p of parts)
    for (const d of closures.get(p)!)
      if (files.get(d)!.path.startsWith("parts/s/") && !owner.has(d))
        owner.set(d, p);
  const owned = new Map<string, string[]>();
  for (const [s, p] of owner) owned.set(p, [...(owned.get(p) ?? []), s]);
  const orphans = [...files.values()]
    .filter((f) => f.path.startsWith("parts/s/") && !owner.has(f.name))
    .map((f) => f.name)
    .sort(natural);

  // Boundaries are content defined (a unit whose name hashes to 0 mod 4 may end
  // a chunk once it is half full), so a part added in a later release changes
  // only its neighbouring chunks and the others keep their content addresses.
  const groups: string[][] = [];
  const cut = (name: string) => digest(name).charCodeAt(0) % 4 === 0;
  const pack = (order: string[][], target: number) => {
    let current: string[] = [],
      size = 0;
    const close = () => {
      if (current.length) groups.push(current);
      current = [];
      size = 0;
    };
    for (const unit of order) {
      const bytes = unit.reduce(
        (n, name) => n + files.get(name)!.bytes.length,
        0,
      );
      if (size && size + bytes > target * 2) close();
      current.push(...unit);
      size += bytes;
      if (size >= target * 2 || (size >= target / 2 && cut(unit[0]))) close();
    }
    close();
  };
  pack(
    primitives.map((p) => [p]),
    config.primitiveChunkTargetBytes,
  );
  pack(
    [
      ...parts.map((p) => [p, ...(owned.get(p) ?? []).sort(natural)]),
      ...orphans.map((s) => [s]),
    ],
    config.chunkTargetBytes,
  );

  // 6. Write the pack. Chunks are content addressed and never rewritten.
  const root = `${options.librariesDir}${config.releaseId}/`;
  mkdirSync(root + "chunks", { recursive: true });
  const chunkOf = new Map<string, number>();
  const chunkTable: FullPackIndex["chunks"] = [];
  let rawBytes = 0,
    packedBytes = 0;
  const wanted = new Set<string>();
  groups.forEach((names, i) => {
    const raw = Buffer.concat(names.map((n) => files.get(n)!.bytes));
    const gz = gzipSync(raw, { level: 9 });
    const sha = digest(gz);
    wanted.add(sha + ".bin");
    const path = root + chunkPath(sha);
    if (!existsSync(path)) writeFileSync(path, gz);
    rawBytes += raw.length;
    packedBytes += gz.length;
    chunkTable.push([
      sha,
      gz.length,
      names,
      names.map((n) => files.get(n)!.bytes.length),
    ]);
    for (const n of names) chunkOf.set(n, i);
  });
  for (const stale of readdirSync(root + "chunks"))
    if (!wanted.has(stale)) rmSync(root + "chunks/" + stale);

  const index: FullPackIndex = {
    format: FULL_PACK_FORMAT,
    releaseId: config.releaseId,
    chunks: chunkTable,
    parts: Object.fromEntries(
      parts.map((p) => [
        p,
        [
          [
            ...new Set([p, ...closures.get(p)!].map((n) => chunkOf.get(n)!)),
          ].sort((a, b) => a - b),
          packBounds(boundsOf(p)),
        ],
      ]),
    ),
  };
  const catalog = parts.map((p) => {
    const text = files.get(p)!.text;
    const title = (/^0\s+(.*)$/m.exec(text)?.[1] ?? "").trim();
    const category =
      /^0 !CATEGORY (.+)$/m.exec(text)?.[1].trim() ??
      title.replace(/^[~=_|]+/, "").split(/\s+/)[0] ??
      "";
    const keywords = [...text.matchAll(/^0 !KEYWORDS (.+)$/gm)]
      .map((k) => k[1].trim())
      .join(", ");
    return keywords ? [p, title, category, keywords] : [p, title, category];
  });

  const write = (name: string, content: string | Buffer) => {
    writeFileSync(root + name, content);
    const b = readFileSync(root + name);
    return { path: name, sha256: digest(b), bytes: b.length };
  };
  const indexEntry = write("index.json", JSON.stringify(index) + "\n");
  const catalogEntry = write("catalog.json", JSON.stringify(catalog) + "\n");
  const text = (name: string) => {
    const data = entries["ldraw/" + name];
    if (!data) throw new Error("Archive lacks " + name);
    return write(name, Buffer.from(data));
  };
  const colorConfig = text("LDConfig.ldr");
  const notices = [
    text("CAreadme.txt"),
    text("CAlicense4.txt"),
    text("CAlicense.txt"),
    write(
      "NOTICE.txt",
      `LDraw official parts library, complete (${config.releaseId}).\n` +
        `Source: ${config.archive.url} (sha256 ${config.archive.sha256}, latest update ${latestUpdate}).\n` +
        "Licence: CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/); some files also CC BY 2.0. See CAreadme.txt and CAlicense4.txt.\n" +
        "LDraw is a trademark of the Estate of James Jessiman. LEGO is a trademark of the LEGO Group, which does not sponsor or endorse this software.\n" +
        "Files are unmodified: every file keeps its own Name, Author and !LICENSE header, which is its attribution.\n" +
        "chunks/*.bin are gzip streams of the exact concatenated file bytes listed for them in index.json.\n",
    ),
  ];
  const counts = {
    files: files.size,
    parts: parts.length,
    subparts: [...files.values()].filter((f) => f.path.startsWith("parts/s/"))
      .length,
    primitives: primitives.length,
    chunks: groups.length,
  };
  const manifest: FullPackManifest = {
    format: FULL_PACK_FORMAT,
    releaseId: config.releaseId,
    retrieved: config.retrieved,
    source: {
      url: config.archive.url,
      sha256: config.archive.sha256,
      bytes: config.archive.bytes,
      latestUpdate,
    },
    license:
      "CC BY 4.0 (some files also CC BY 2.0); see CAreadme.txt, CAlicense4.txt",
    index: indexEntry,
    catalog: catalogEntry,
    colorConfig,
    notices,
    counts,
    rawBytes,
    packedBytes,
    unresolvedReferences,
  };
  writeFileSync(
    root + "manifest.json",
    JSON.stringify(manifest, null, 2) + "\n",
  );
  const lock = {
    releaseId: config.releaseId,
    manifestSha256: digest(readFileSync(root + "manifest.json")),
  };
  return {
    lock,
    manifest,
    summary: {
      ...lock,
      ...counts,
      rawBytes,
      packedBytes,
      indexBytes: indexEntry.bytes,
      catalogBytes: catalogEntry.bytes,
      latestUpdate,
      unresolvedReferences,
    },
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const config = JSON.parse(
    readFileSync("scripts/full-library.json", "utf8"),
  ) as FullLibraryConfig;
  // 1. Pinned archive.
  let zipPath = process.argv[2];
  if (!zipPath) {
    zipPath = `.cache/ldraw/complete-${config.archive.sha256}.zip`;
    if (!existsSync(zipPath)) {
      mkdirSync(".cache/ldraw", { recursive: true });
      console.log("Downloading " + config.archive.url);
      execFileSync("curl", ["-sSfL", "-o", zipPath, config.archive.url], {
        stdio: "inherit",
      });
    }
  }
  const { lock, summary } = buildFullLibrary({
    config,
    zipPath,
    librariesDir: "public/libraries/",
  });
  // The lock new projects record (src/catalog/catalog.ts adds it to libraryLock).
  writeFileSync(
    "src/catalog/full-library-lock.json",
    JSON.stringify(lock, null, 2) + "\n",
  );
  console.log(JSON.stringify(summary, null, 2));
}
