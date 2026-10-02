/** Verified source registration for synchronous instruction geometry queries. */
import { readFileSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";
import { libraryLock } from "../src/catalog/catalog";
import {
  addFullSources,
  curatedHas,
  fullSource,
  registeredFullLibrary,
} from "../src/catalog/full-library";
import {
  curatedGeometrySource,
  registerCuratedGeometrySources,
} from "../src/catalog/geometry-sources";
import {
  fullLibraryDir,
  registerFullLibraryFromDisk,
} from "./full-library-node";
import { chunkPath } from "../src/catalog/full-pack";
import { collectInstructionGeometrySources } from "../src/instructions/worker-data";
import { ensure, type Project } from "../src/core/types";
import { occurrences } from "../src/core/document";
let curatedReady = false;
export function registerInstructionGeometryFromDisk(p: Project) {
  if (!curatedReady) {
    const root = fileURLToPath(
      new URL(`../public/libraries/${libraryLock.releaseId}/`, import.meta.url),
    );
    const raw = readFileSync(root + "manifest.json"),
      hash = (b: Buffer) => createHash("sha256").update(b).digest("hex");
    ensure(
      hash(raw) === libraryLock.manifestSha256,
      "INVALID_INPUT",
      "Instruction geometry manifest mismatch",
    );
    const manifest = JSON.parse(raw.toString()),
      bytes = readFileSync(root + manifest.bundle.path);
    ensure(
      bytes.length === manifest.bundle.bytes &&
        hash(bytes) === manifest.bundle.sha256,
      "INVALID_INPUT",
      "Instruction geometry bundle mismatch",
    );
    const texts = new Map<string, string>();
    let offset = 0;
    for (const f of manifest.files) {
      const text = bytes.subarray(offset, offset + f.bytes).toString();
      offset += f.bytes;
      if (f.path !== "LDConfig.ldr")
        texts.set(f.path.replace(/^(parts|p)\//, ""), text);
    }
    ensure(
      offset === bytes.length,
      "INVALID_INPUT",
      "Instruction geometry bundle length mismatch",
    );
    registerCuratedGeometrySources(texts);
    curatedReady = true;
  }
  const all = occurrences(p);
  if (all.length > 5000) return;
  // Read single pinned files instead of recursively materialising an unbounded
  // official closure. The shared collector follows current local definitions.
  const chunks = new Map<number, Buffer>();
  let decodedBytes = 0;
  const read = (ref: string) => {
    const available = curatedGeometrySource(ref) ?? fullSource(ref);
    if (available !== undefined) return available;
    if (!registerFullLibraryFromDisk()) return undefined;
    const library = registeredFullLibrary()!,
      at = library.where.get(ref);
    if (!at || at.length > 20_000_000) return undefined;
    let raw = chunks.get(at.chunk);
    if (!raw) {
      const [sha, bytes, , lengths] = library.index.chunks[at.chunk],
        expected = lengths.reduce((sum, length) => sum + length, 0);
      // Hard allocation/work caps leave oversized dependencies unavailable.
      if (
        bytes > 16_000_000 ||
        expected > 16_000_000 ||
        decodedBytes + expected > 64_000_000 ||
        chunks.size >= 256
      )
        return undefined;
      const path = fullLibraryDir() + chunkPath(sha);
      ensure(
        statSync(path).size === bytes,
        "INVALID_INPUT",
        "Instruction geometry chunk size mismatch",
      );
      const stored = readFileSync(path);
      ensure(
        stored.length === bytes &&
          createHash("sha256").update(stored).digest("hex") === sha,
        "INVALID_INPUT",
        "Instruction geometry chunk hash mismatch",
      );
      raw = gunzipSync(stored, { maxOutputLength: 16_000_000 });
      ensure(
        raw.length === expected,
        "INVALID_INPUT",
        "Instruction geometry chunk length mismatch",
      );
      decodedBytes += raw.length;
      chunks.set(at.chunk, raw);
    }
    return raw.subarray(at.offset, at.offset + at.length).toString();
  };
  const { sources } = collectInstructionGeometrySources(
    p,
    all.map((o) => o.node.ref),
    read,
  );
  addFullSources(new Map([...sources].filter(([name]) => !curatedHas(name))));
}
