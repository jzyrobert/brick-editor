/**
 * Format of the complete official LDraw library pack (scripts/build-full-library.ts).
 * Pure data and planning helpers shared by the browser loader, the CLI and the
 * build/validation scripts.
 *
 * Trust chain: the project library lock pins manifest.json by sha256; the
 * manifest pins index.json, catalog.json and LDConfig.ldr by sha256; index.json
 * pins every chunk by the sha256 of its stored (gzip) bytes. A chunk is the gzip
 * of its files' exact bytes concatenated in the listed order.
 */
export const FULL_PACK_FORMAT = "brick-editor-ldraw-full/1";

export type PinnedFile = { path: string; sha256: string; bytes: number };
export type FullPackManifest = {
  format: typeof FULL_PACK_FORMAT;
  releaseId: string;
  retrieved: string;
  source: { url: string; sha256: string; bytes: number; latestUpdate: string };
  license: string;
  index: PinnedFile;
  catalog: PinnedFile;
  colorConfig: PinnedFile;
  notices: PinnedFile[];
  counts: {
    files: number;
    parts: number;
    subparts: number;
    primitives: number;
    chunks: number;
  };
  rawBytes: number;
  packedBytes: number;
  /** References the official archive makes to files it does not contain. */
  unresolvedReferences: { from: string; ref: string }[];
};
/** [sha256 of stored bytes, stored bytes, file names in order, file lengths]. */
export type FullPackChunk = [string, number, string[], number[]];
export type FullPackIndex = {
  format: typeof FULL_PACK_FORMAT;
  releaseId: string;
  chunks: FullPackChunk[];
  /** Top-level part → [chunks of the part and its full dependency closure,
   * conservative source bounds (min xyz, max xyz; LDraw axes) or null]. */
  parts: Record<string, [number[], number[] | null]>;
};
/** [reference name, title, category, keywords?] for every top-level part. */
export type FullPackCatalogEntry = [string, string, string, string?];

export const chunkPath = (sha256: string) => `chunks/${sha256}.bin`;

export type FileLocation = { chunk: number; offset: number; length: number };

/** Name → location lookup over the chunk table. */
export function locateFiles(index: FullPackIndex) {
  const where = new Map<string, FileLocation>();
  index.chunks.forEach(([, , names, lengths], chunk) => {
    let offset = 0;
    names.forEach((name, i) => {
      where.set(name, { chunk, offset, length: lengths[i] });
      offset += lengths[i];
    });
  });
  return where;
}

/** Direct references of an LDraw file (lower-cased, `\` → `/`). */
export function directReferences(text: string): string[] {
  const refs = new Set<string>();
  for (const m of text.matchAll(/^\s*1\s+\S+(?:\s+\S+){12}\s+(.+?)\s*$/gm))
    refs.add(m[1].replaceAll("\\", "/").toLowerCase());
  return [...refs];
}

/** Chunks to fetch for these roots: each part's precomputed closure chunks,
 * or just the file's own chunk for subparts/primitives (whose dependencies
 * are then discovered after parsing). */
export function chunksFor(
  index: FullPackIndex,
  where: Map<string, FileLocation>,
  names: Iterable<string>,
) {
  const chunks = new Set<number>();
  for (const name of names) {
    const part = index.parts[name];
    if (part) for (const c of part[0]) chunks.add(c);
    else {
      const at = where.get(name);
      if (at) chunks.add(at.chunk);
    }
  }
  return chunks;
}
