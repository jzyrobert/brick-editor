// Validates the texture pack of the complete official library: lock →
// manifest → every image's bytes, PNG size and content address; the pack
// names the current complete pack; which files and parts map which textures
// is re-derived from the complete pack; every texture-mapped reference
// (`0 !: 1 …`) resolves; no stray files; deployment file-size limit.
import { deepStrictEqual } from "node:assert";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import {
  FULL_TEXTURE_FORMAT,
  pngSize,
  texturePath,
  type FullTextureManifest,
} from "../src/catalog/full-texture-pack";
import { packTexts, textureUse } from "./build-full-textures";

const hash = (b: Buffer | Uint8Array) =>
  createHash("sha256").update(b).digest("hex");
const fail = (message: string): never => {
  throw new Error("Full-library textures: " + message);
};
/** Cloudflare Pages per-file limit. */
const MAX_FILE_BYTES = 25 * 1024 * 1024;

export function validateFullTextures(options: {
  librariesDir: string;
  lock: { texturePackId: string; manifestSha256: string };
  full: { releaseId: string; manifestSha256: string };
}) {
  const root = `${options.librariesDir}${options.lock.texturePackId}/`;
  const raw = readFileSync(root + "manifest.json");
  if (hash(raw) !== options.lock.manifestSha256)
    fail("manifest hash differs from src/catalog/full-textures-lock.json");
  const m = JSON.parse(raw.toString()) as FullTextureManifest;
  if (m.format !== FULL_TEXTURE_FORMAT) fail("unsupported format " + m.format);
  if (m.id !== options.lock.texturePackId) fail("pack id differs from lock");
  deepStrictEqual(
    m.library,
    options.full,
    "Full-library textures: built for a different complete pack",
  );
  let bytes = 0,
    pixels = 0;
  const files = new Set<string>();
  for (const [name, [sha, size, width, height]] of Object.entries(m.textures)) {
    const path = root + texturePath(sha);
    if (!existsSync(path)) fail("missing image " + name);
    const b = readFileSync(path);
    if (b.length !== size || hash(b) !== sha) fail("hash mismatch " + name);
    if (size > MAX_FILE_BYTES) fail("image over 25 MiB " + name);
    deepStrictEqual(pngSize(b), [width, height], "PNG size of " + name);
    files.add(sha + ".png");
    bytes += size;
    pixels += width * height;
  }
  for (const f of readdirSync(root + "textures"))
    if (!files.has(f)) fail("stray file textures/" + f);
  const libraryDir = `${options.librariesDir}${options.full.releaseId}/`;
  const { index, texts } = packTexts(libraryDir);
  const use = textureUse(texts, Object.keys(index.parts));
  deepStrictEqual(m.files, use.files, "Full-library textures: file table");
  deepStrictEqual(m.parts, use.parts, "Full-library textures: part table");
  const unresolved = Object.entries(use.files).flatMap(([from, names]) =>
    names.filter((t) => !m.textures[t]).map((texture) => ({ from, texture })),
  );
  deepStrictEqual(m.unresolved, unresolved, "Full-library textures: missing");
  // Texture-mapped references are outside the pinned index closures; each
  // must still be a file of the complete pack.
  let texmapReferences = 0;
  for (const [name, text] of texts)
    for (const line of text.matchAll(
      /^\s*0\s+!:\s*1\s+\S+(?:\s+\S+){12}\s+(.+?)\s*$/gm,
    )) {
      texmapReferences++;
      const ref = line[1].replace(/\\/g, "/").toLowerCase();
      if (!texts.has(ref)) fail(`${name} maps a missing file ${ref}`);
    }
  deepStrictEqual(
    m.counts,
    {
      textures: Object.keys(m.textures).length,
      bytes,
      pixels,
      files: Object.keys(m.files).length,
      parts: Object.keys(m.parts).length,
    },
    "Full-library textures: counts",
  );
  return {
    id: m.id,
    manifestSha256: options.lock.manifestSha256,
    ...m.counts,
    texmapReferences,
  };
}
