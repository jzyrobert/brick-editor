// Validates the complete official LDraw pack end to end: lock → manifest →
// index/catalogue/LDConfig/notices → every chunk's bytes, layout, licence and
// provenance headers, dependency closures, per-part closure chunk lists and
// bounds, and byte identity with the curated pack.
import { deepStrictEqual } from "node:assert";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { gunzipSync } from "node:zlib";
import { canonical } from "../src/ldraw/path";
import { fullLibraryLock } from "../src/catalog/full-library";
import {
  FULL_PACK_FORMAT,
  chunkPath,
  directReferences,
  type FullPackCatalogEntry,
  type FullPackIndex,
  type FullPackManifest,
} from "../src/catalog/full-pack";
import { libraryBounds, packBounds } from "./library-bounds";

const hash = (b: Buffer | Uint8Array) =>
  createHash("sha256").update(b).digest("hex");
const fail = (message: string): never => {
  throw new Error("Full library: " + message);
};

export function validateFullLibrary(curated: {
  root: string;
  files: { path: string; sha256: string }[];
  colorConfigSha256: string;
}) {
  const root = `public/libraries/${fullLibraryLock.releaseId}/`;
  const config = JSON.parse(readFileSync("scripts/full-library.json", "utf8"));
  if (config.releaseId !== fullLibraryLock.releaseId)
    fail("scripts/full-library.json and the lock name different releases");
  const raw = readFileSync(root + "manifest.json");
  if (hash(raw) !== fullLibraryLock.manifestSha256) fail("lock mismatch");
  const manifest = JSON.parse(raw.toString()) as FullPackManifest;
  if (
    manifest.format !== FULL_PACK_FORMAT ||
    manifest.releaseId !== fullLibraryLock.releaseId ||
    manifest.source.sha256 !== config.archive.sha256
  )
    fail("manifest identity");
  for (const f of [
    manifest.index,
    manifest.catalog,
    manifest.colorConfig,
    ...manifest.notices,
  ]) {
    const b = readFileSync(root + f.path);
    if (b.length !== f.bytes || hash(b) !== f.sha256) fail("hash " + f.path);
  }
  if (manifest.colorConfig.sha256 !== curated.colorConfigSha256)
    fail("LDConfig differs from the curated pack's");
  for (const notice of ["CAreadme.txt", "CAlicense4.txt", "NOTICE.txt"])
    if (!manifest.notices.some((n) => n.path === notice))
      fail("notice missing " + notice);
  const index = JSON.parse(
    readFileSync(root + manifest.index.path, "utf8"),
  ) as FullPackIndex;
  const catalog = JSON.parse(
    readFileSync(root + manifest.catalog.path, "utf8"),
  ) as FullPackCatalogEntry[];

  // Every chunk: stored bytes, layout, and each file's licence/provenance.
  const texts = new Map<string, string>(),
    bytes = new Map<string, Buffer>(),
    chunkOf = new Map<string, number>();
  let rawBytes = 0,
    packedBytes = 0;
  const onDisk = new Set(readdirSync(root + "chunks"));
  index.chunks.forEach(([sha, size, names, lengths], i) => {
    const path = chunkPath(sha);
    if (!onDisk.delete(path.slice("chunks/".length)))
      fail("chunk missing " + path);
    const gz = readFileSync(root + path);
    if (gz.length !== size || hash(gz) !== sha) fail("chunk hash " + path);
    const body = gunzipSync(gz);
    if (body.length !== lengths.reduce((a, b) => a + b, 0))
      fail("chunk layout " + path);
    let offset = 0;
    names.forEach((name, j) => {
      const b = body.subarray(offset, offset + lengths[j]);
      offset += lengths[j];
      if (texts.has(name)) fail("duplicate file " + name);
      const text = b.toString("utf8");
      const licences = [...text.matchAll(/^0 !LICENSE (.+)$/gm)];
      if (
        !licences.length ||
        !licences.every((l) => l[1].includes("CC BY 4.0"))
      )
        fail("licence gate " + name);
      const kind = /^0 !LDRAW_ORG (\S+)/m.exec(text);
      if (!kind || kind[1].startsWith("Unofficial"))
        fail("not official " + name);
      if (canonical(name) !== name) fail("non-canonical name " + name);
      texts.set(name, text);
      bytes.set(name, b);
      chunkOf.set(name, i);
    });
    rawBytes += body.length;
    packedBytes += gz.length;
  });
  if (onDisk.size) fail("unlisted chunk files " + [...onDisk].slice(0, 3));
  if (
    texts.size !== manifest.counts.files ||
    index.chunks.length !== manifest.counts.chunks ||
    Object.keys(index.parts).length !== manifest.counts.parts ||
    catalog.length !== manifest.counts.parts ||
    rawBytes !== manifest.rawBytes ||
    packedBytes !== manifest.packedBytes
  )
    fail("counts do not match the manifest");

  // Every curated file is in the complete pack with the same geometry. The
  // curated pack was partly fetched file by file from the library website, so
  // a file may differ in `0 !` header metadata only (e.g. !CATEGORY vs
  // !PREVIEW); the curated copy takes precedence when both are loaded.
  const geometry = (text: string) =>
    text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l && !/^0\s+(!|\/\/)/.test(l))
      .join("\n");
  let headerOnlyDifferences = 0;
  for (const f of curated.files) {
    if (f.path === "LDConfig.ldr") continue;
    const name = f.path.replace(/^(parts|p)\//, "");
    const b = bytes.get(name);
    if (!b) fail("curated file missing " + f.path);
    if (hash(b!) === f.sha256) continue;
    if (
      geometry(texts.get(name)!) !==
      geometry(readFileSync(curated.root + f.path, "utf8"))
    )
      fail("curated file geometry differs " + f.path);
    headerOnlyDifferences++;
  }

  // Dependencies: all present except the recorded upstream defects; each
  // part's chunk list is exactly its closure's chunks.
  const unresolved: { from: string; ref: string }[] = [];
  const direct = new Map<string, string[]>();
  for (const [name, text] of texts) {
    // Pinned closures follow ordinary references; texture-mapped ones are
    // checked with the texture pack (validate-full-textures.ts).
    const refs = directReferences(text, false).map((r) => canonical(r));
    for (const ref of refs)
      if (!texts.has(ref))
        unresolved.push({
          from:
            (index.parts[name] || name.startsWith("s/") ? "parts/" : "p/") +
            name,
          ref,
        });
    direct.set(
      name,
      refs.filter((r) => texts.has(r)),
    );
  }
  const key = (u: { from: string; ref: string }) => u.from + " " + u.ref;
  deepStrictEqual(
    unresolved.map(key).sort(),
    manifest.unresolvedReferences.map(key).sort(),
    "Full library: unresolved references differ from the manifest record",
  );
  const chunkClosure = new Map<string, Set<number>>();
  const closure = (name: string): Set<number> => {
    let set = chunkClosure.get(name);
    if (set) return set;
    set = new Set([chunkOf.get(name)!]);
    chunkClosure.set(name, set);
    for (const d of direct.get(name)!) for (const c of closure(d)) set.add(c);
    return set;
  };
  const boundsOf = libraryBounds((name) => texts.get(name));
  const partNames = new Set(catalog.map((e) => e[0]));
  for (const [name, [chunks, b]] of Object.entries(index.parts)) {
    if (!texts.has(name) || !partNames.has(name)) fail("unknown part " + name);
    deepStrictEqual(
      chunks,
      [...closure(name)].sort((a, b) => a - b),
      "Full library: closure chunks of " + name,
    );
    deepStrictEqual(
      b,
      packBounds(boundsOf(name)),
      "Full library: bounds " + name,
    );
  }
  if (!existsSync(root + "CAreadme.txt")) fail("CAreadme.txt missing");
  // Official files kept as test fixtures (fixtures/ldraw-parts/<set>/{parts,p})
  // must be the same bytes the complete pack resolves.
  let fixtureFiles = 0;
  const fixtures = "fixtures/ldraw-parts/";
  for (const set of existsSync(fixtures) ? readdirSync(fixtures) : [])
    for (const dir of ["parts", "p"]) {
      const base = `${fixtures}${set}/${dir}/`;
      if (!existsSync(base)) continue;
      for (const file of readdirSync(base, { recursive: true }) as string[]) {
        if (!file.endsWith(".dat")) continue;
        const name = canonical(file);
        const b = bytes.get(name);
        if (!b || !b.equals(readFileSync(base + file)))
          fail("official fixture differs from the pack: " + base + file);
        fixtureFiles++;
      }
    }
  return {
    releaseId: manifest.releaseId,
    manifestSha256: fullLibraryLock.manifestSha256,
    archiveSha256: manifest.source.sha256,
    files: texts.size,
    parts: manifest.counts.parts,
    chunks: index.chunks.length,
    rawBytes,
    packedBytes,
    unresolvedUpstreamReferences: manifest.unresolvedReferences.length,
    curatedHeaderOnlyDifferences: headerOnlyDifferences,
    officialFixtureFilesMatched: fixtureFiles,
  };
}
