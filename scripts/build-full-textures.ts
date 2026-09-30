// Builds the texture pack of the complete official LDraw library: every
// `!TEXMAP` image (PNG) in the pinned official archive, unmodified.
//
//   npx tsx scripts/build-full-textures.ts [path/to/complete.zip]
//
// Without a path, the archive is read from .cache/ldraw/complete-<sha256>.zip
// (npm run library:full downloads it). The complete pack
// (public/libraries/<releaseId>/) must be built first: which parts use which
// textures is derived from its files. Output: public/libraries/textures-<releaseId>/
//   manifest.json             pins every image by sha256 and names the
//                             complete pack (release and manifest hash) it serves
//   textures/<sha256>.png     the archive's images, byte for byte
// and src/catalog/full-textures-lock.json. Then run `npm run library:validate`.
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { createHash } from "node:crypto";
import { gunzipSync } from "node:zlib";
import { fileURLToPath } from "node:url";
import { unzipSync } from "fflate";
import {
  chunkPath,
  directReferences,
  type FullPackIndex,
  type FullPackManifest,
} from "../src/catalog/full-pack";
import {
  FULL_TEXTURE_FORMAT,
  pngSize,
  texmapTextures,
  texturePackIdFor,
  texturePath,
  type FullTextureManifest,
} from "../src/catalog/full-texture-pack";
import type { FullLibraryConfig } from "./build-full-library";

const digest = (b: Uint8Array | string) =>
  createHash("sha256").update(b).digest("hex");
const natural = (a: string, b: string) =>
  a.localeCompare(b, "en", { numeric: true });

/** Every file of a built complete pack by reference name. */
export function packTexts(dir: string) {
  const manifest = JSON.parse(
    readFileSync(dir + "manifest.json", "utf8"),
  ) as FullPackManifest;
  const index = JSON.parse(
    readFileSync(dir + manifest.index.path, "utf8"),
  ) as FullPackIndex;
  const texts = new Map<string, string>();
  for (const [sha, , names, lengths] of index.chunks) {
    const body = gunzipSync(readFileSync(dir + chunkPath(sha)));
    let offset = 0;
    names.forEach((name, i) => {
      texts.set(name, body.subarray(offset, offset + lengths[i]).toString());
      offset += lengths[i];
    });
  }
  return { manifest, index, texts };
}

/**
 * Which files and top-level parts map which textures. A part's closure
 * follows texture-mapped references (`0 !: 1 …`) too.
 */
export function textureUse(
  texts: Map<string, string>,
  parts: Iterable<string>,
) {
  const files: Record<string, string[]> = {};
  for (const [name, text] of texts) {
    if (!/!TEXMAP/i.test(text)) continue;
    const names = texmapTextures(text).sort(natural);
    if (names.length) files[name] = names;
  }
  const memo = new Map<string, Set<string>>();
  const closure = (name: string, path: Set<string>): Set<string> => {
    const hit = memo.get(name);
    if (hit) return hit;
    const out = new Set<string>(files[name] ?? []);
    if (path.has(name)) return out;
    const next = new Set(path).add(name);
    for (const d of directReferences(texts.get(name) ?? ""))
      if (texts.has(d)) for (const t of closure(d, next)) out.add(t);
    memo.set(name, out);
    return out;
  };
  const partUse: Record<string, string[]> = {};
  for (const p of [...parts].sort(natural)) {
    const used = [...closure(p, new Set())].sort(natural);
    if (used.length) partUse[p] = used;
  }
  return { files, parts: partUse };
}

export function buildFullTextures(options: {
  config: FullLibraryConfig;
  zipPath: string;
  librariesDir: string;
}) {
  const { config } = options;
  const libraryDir = `${options.librariesDir}${config.releaseId}/`;
  const libraryManifestSha = digest(readFileSync(libraryDir + "manifest.json"));
  const { index, texts } = packTexts(libraryDir);
  const archive = readFileSync(options.zipPath);
  if (digest(archive) !== config.archive.sha256)
    throw new Error(
      `Archive hash mismatch: ${options.zipPath} is not the pinned complete.zip (${config.archive.sha256}).`,
    );
  // Texture search path (spec): textures/<name> then <name>, under parts/ and p/.
  const entries = unzipSync(new Uint8Array(archive), {
    filter: (f) => /^ldraw\/(parts|p)\/(textures\/)?.+\.png$/i.test(f.name),
  });
  const images = new Map<string, Uint8Array>();
  for (const [zipName, data] of Object.entries(entries)) {
    const m = /^ldraw\/(?:parts|p)\/(textures\/)?(.+)$/i.exec(zipName)!;
    const name = m[2].replace(/\\/g, "/").toLowerCase();
    // textures/ wins over the bare folder, parts/ over p/ (search order).
    const key =
      (m[1] ? "0" : "1") + (/^ldraw\/parts\//i.test(zipName) ? "0" : "1");
    const existing = images.get(name) as
      | (Uint8Array & { key?: string })
      | undefined;
    if (existing && existing.key! <= key) continue;
    images.set(name, Object.assign(data, { key }));
  }
  const use = textureUse(texts, Object.keys(index.parts));
  const referenced = new Set(Object.values(use.files).flat());
  const unresolved: FullTextureManifest["unresolved"] = [];
  for (const [from, names] of Object.entries(use.files))
    for (const t of names)
      if (!images.has(t)) unresolved.push({ from, texture: t });

  const id = texturePackIdFor(config.releaseId);
  const root = `${options.librariesDir}${id}/`;
  mkdirSync(root + "textures", { recursive: true });
  const textures: FullTextureManifest["textures"] = {};
  const wanted = new Set<string>();
  let bytes = 0,
    pixels = 0;
  for (const name of [...referenced].sort(natural)) {
    const data = images.get(name);
    if (!data) continue;
    const size = pngSize(data);
    if (!size) throw new Error("Not a PNG: " + name);
    const sha = digest(data);
    const path = root + texturePath(sha);
    if (!existsSync(path)) writeFileSync(path, data);
    wanted.add(sha + ".png");
    textures[name] = [sha, data.length, size[0], size[1]];
    bytes += data.length;
    pixels += size[0] * size[1];
  }
  for (const stale of readdirSync(root + "textures"))
    if (!wanted.has(stale)) rmSync(root + "textures/" + stale);
  const manifest: FullTextureManifest = {
    format: FULL_TEXTURE_FORMAT,
    id,
    library: {
      releaseId: config.releaseId,
      manifestSha256: libraryManifestSha,
    },
    source: { url: config.archive.url, sha256: config.archive.sha256 },
    licence:
      "CC BY 4.0 (LDraw.org Parts Library; see the complete pack's CAreadme.txt, CAlicense4.txt and NOTICE.txt, and public/notices/LDRAW.txt). Images are unmodified; each is attributed through the part files that reference it.",
    counts: {
      textures: Object.keys(textures).length,
      bytes,
      pixels,
      files: Object.keys(use.files).length,
      parts: Object.keys(use.parts).length,
    },
    textures,
    files: use.files,
    parts: use.parts,
    unresolved,
  };
  writeFileSync(
    root + "manifest.json",
    JSON.stringify(manifest, null, 1) + "\n",
  );
  const lock = {
    texturePackId: id,
    manifestSha256: digest(readFileSync(root + "manifest.json")),
  };
  return {
    lock,
    manifest,
    unused: [...images.keys()].filter((n) => !referenced.has(n)),
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const config = JSON.parse(
    readFileSync("scripts/full-library.json", "utf8"),
  ) as FullLibraryConfig;
  const zipPath =
    process.argv[2] ?? `.cache/ldraw/complete-${config.archive.sha256}.zip`;
  if (!existsSync(zipPath))
    throw new Error(
      `${zipPath} missing: run npm run library:full first (it downloads the pinned archive).`,
    );
  const { lock, manifest, unused } = buildFullTextures({
    config,
    zipPath,
    librariesDir: "public/libraries/",
  });
  writeFileSync(
    "src/catalog/full-textures-lock.json",
    JSON.stringify(lock, null, 2) + "\n",
  );
  console.log(
    JSON.stringify(
      {
        ...lock,
        ...manifest.counts,
        largest: Object.entries(manifest.textures)
          .sort((a, b) => b[1][1] - a[1][1])[0]
          ?.slice(0, 2),
        unresolved: manifest.unresolved,
        unused,
      },
      null,
      2,
    ),
  );
}
