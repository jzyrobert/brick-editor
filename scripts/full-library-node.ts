// Node host for the complete official LDraw library pack: registers the built
// pack from disk (public/libraries/<releaseId>/), verified against the lock,
// so CLI imports resolve every official part without any network access.
import { existsSync, readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import {
  fullLibraryLock,
  registerFullLibrary,
  registeredFullLibrary,
} from "../src/catalog/full-library";
import {
  type FullPackIndex,
  type FullPackManifest,
  chunkPath,
  directReferences,
} from "../src/catalog/full-pack";
import { ensure, type Vec3 } from "../src/core/types";
import { extractConnectors } from "../src/catalog/connector-extract";

const hash = (b: Buffer) => createHash("sha256").update(b).digest("hex");
export const fullLibraryDir = (
  root = fileURLToPath(new URL("../public/", import.meta.url)),
) => `${root}libraries/${fullLibraryLock.releaseId}/`;

/** Registers the pack; returns false when it has not been built. Throws when
 * a present pack does not match its lock. */
export function registerFullLibraryFromDisk(dir = fullLibraryDir()) {
  if (registeredFullLibrary()) return true;
  if (!existsSync(dir + "manifest.json")) return false;
  const raw = readFileSync(dir + "manifest.json");
  ensure(
    hash(raw) === fullLibraryLock.manifestSha256,
    "INVALID_INPUT",
    "Full LDraw library manifest hash mismatch",
  );
  const manifest = JSON.parse(raw.toString()) as FullPackManifest;
  const index = readFileSync(dir + manifest.index.path);
  ensure(
    hash(index) === manifest.index.sha256,
    "INVALID_INPUT",
    "Full LDraw library index hash mismatch",
  );
  registerFullLibrary(manifest, JSON.parse(index.toString()) as FullPackIndex);
  return true;
}

/**
 * Body occupancy boxes of official parts outside the curated catalogue,
 * derived from their geometry exactly as the catalogue's connector pack is
 * (src/catalog/connector-extract.ts), for build checks.
 */
export function fullLibraryOccupancy(refs: Iterable<string>) {
  const names = [...new Set(refs)];
  const sources = fullLibrarySources(names);
  const { index } = registeredFullLibrary()!;
  const out: Record<string, { min: Vec3; max: Vec3 }[]> = {};
  for (const ref of names) {
    const b = index.parts[ref]?.[1];
    if (!b || !sources[ref]) continue;
    out[ref] = extractConnectors(
      sources,
      ref,
      { min: b.slice(0, 3), max: b.slice(3) },
      [0, 0],
    ).occupancy;
  }
  return out;
}

/**
 * Source text of these official files and their whole dependency closure,
 * read from the pack's chunks on disk (each chunk verified against the
 * index), keyed as LDraw references (`s/…`, `48/…`).
 */
export function fullLibrarySources(
  names: Iterable<string>,
  dir = fullLibraryDir(),
): Record<string, string> {
  ensure(
    registerFullLibraryFromDisk(dir),
    "REFERENCE_MISSING",
    "Full LDraw library pack is not built",
  );
  const { index, where } = registeredFullLibrary()!;
  const chunks = new Map<number, Map<string, string>>();
  const read = (chunk: number) => {
    let texts = chunks.get(chunk);
    if (!texts) {
      const [sha, , files, lengths] = index.chunks[chunk];
      const stored = readFileSync(dir + chunkPath(sha));
      ensure(hash(stored) === sha, "INVALID_INPUT", "Chunk hash mismatch");
      const raw = gunzipSync(stored);
      texts = new Map();
      let offset = 0;
      files.forEach((name, i) => {
        texts!.set(name, raw.subarray(offset, offset + lengths[i]).toString());
        offset += lengths[i];
      });
      chunks.set(chunk, texts);
    }
    return texts;
  };
  const out: Record<string, string> = {};
  const visit = (name: string) => {
    if (Object.hasOwn(out, name)) return;
    const at = where.get(name);
    if (!at) return;
    const text = read(at.chunk).get(name)!;
    out[name] = text;
    for (const ref of directReferences(text)) visit(ref);
  };
  for (const name of names) visit(name);
  return out;
}
