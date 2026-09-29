/**
 * Format of the connector and occupancy pack derived from the complete
 * official LDraw library (scripts/build-full-connectors.ts), shared by the
 * browser loader, the Node host, the build and validation.
 *
 * Trust chain: the build's lock (full-connectors-lock.json, also recorded in
 * project library locks as `full.connectorPackSha256`) pins manifest.json by
 * sha256; the manifest pins the full library it was derived from and every
 * shard by the sha256 of its stored (gzip) bytes. A part's shard is
 * `shardOf(name, manifest.shards.length)`, so no index is needed.
 *
 * Per-part entries use the curated pack's encoding (connector-pack.ts).
 */
import type { Encoded } from "./connector-pack";

export const FULL_CONNECTOR_FORMAT = "brick-editor-ldraw-full-connectors/1";

/** [sha256 of stored bytes, stored bytes, parts in the shard]. */
export type FullConnectorShard = [string, number, number];
export type FullConnectorManifest = {
  format: typeof FULL_CONNECTOR_FORMAT;
  id: string;
  /** Complete library the pack was derived from (must match the full lock). */
  library: { releaseId: string; manifestSha256: string };
  licence: string;
  method: string;
  shards: FullConnectorShard[];
  coverage: FullConnectorCoverage;
  rawBytes: number;
  packedBytes: number;
};
export type FullConnectorCoverage = {
  parts: number;
  /** Parts whose geometry was derived (bounds known, extraction succeeded). */
  derived: number;
  verified: number;
  byRule: Record<string, number>;
  /** LDraw category → [parts, derived, verified]. */
  byCategory: Record<string, [number, number, number]>;
  /** Parts whose derivation failed (unresolved references, budget). */
  failed: number;
};
export type FullConnectorEntry = Encoded & {
  verified: boolean;
  rule?: string;
  reasons?: string[];
  occupancy?: number[];
  hinge?: {
    axis: [number, number, number];
    pivot: [number, number, number];
    pins: [[number, number, number], [number, number, number]];
    protrusion: number;
    radius: number;
  };
  sockets?: {
    top: [number, number, number];
    bottom: [number, number, number];
    depth: number;
  }[];
};
export type FullConnectorShardData = {
  format: typeof FULL_CONNECTOR_FORMAT;
  parts: Record<string, FullConnectorEntry>;
};

export const shardPath = (sha256: string) => `shards/${sha256}.bin`;

/** FNV-1a (32 bit) of the reference name, modulo the shard count. */
export function shardOf(name: string, shards: number) {
  let h = 0x811c9dc5;
  for (let i = 0; i < name.length; i++) {
    h ^= name.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h % shards;
}

/** Catalogue categories the verification rules know (connector-extract.ts),
 * from LDraw `!CATEGORY` values. Anything else keeps its LDraw category, to
 * which no category-specific rule applies. */
const CATEGORY: Record<string, string> = {
  Brick: "Bricks",
  Plate: "Plates",
  Tile: "Tiles",
  Slope: "Slopes",
  Arch: "Arches",
  Door: "Windows & doors",
  Window: "Windows & doors",
  Bracket: "Brackets & hinges",
  Hinge: "Brackets & hinges",
  Baseplate: "Baseplates",
};
export const verifierCategory = (ldrawCategory: string) =>
  CATEGORY[ldrawCategory] ?? ldrawCategory;

/** An LDraw title in the catalogue's naming style: prefix marks dropped,
 * runs of spaces collapsed, stud dimensions written "2 × 4". */
export function catalogueStyleTitle(title: string) {
  let t = title
    .replace(/^[~=_|]+/, "")
    .replace(/\s+/g, " ")
    .trim();
  for (let i = 0; i < 3; i++)
    t = t.replace(/(\d(?:\.\d+)?) x (\d)/g, "$1 × $2");
  return t;
}

const studs = (extent: number) => Math.max(1, Math.round(extent / 20)) * 20;
/** Grid phase of one axis (as scripts/build-parts.ts and extended.ts). */
export const gridPhase = (min: number, max: number) => {
  const off = (v: number) => Math.abs(v - Math.round(v / 10) * 10);
  const edge = off(max) < off(min) ? max : min;
  const r = (((-edge % 20) + 20) % 20) / 10;
  return Math.round(r) % 2 ? 10 : 0;
};
/**
 * What the verification rules see of a full-library part: its title in the
 * catalogue's style, its category mapped to the catalogue's, and the stud
 * footprint and grid phase from its bounds, exactly as extended.ts derives
 * the placement spec the editor uses for it.
 */
export function fullPartSpec(
  title: string,
  ldrawCategory: string,
  b: readonly number[],
) {
  return {
    name: catalogueStyleTitle(title),
    category: verifierCategory(ldrawCategory),
    width: studs(b[3] - b[0]),
    depth: studs(b[5] - b[2]),
    align: [gridPhase(b[0], b[3]), gridPhase(b[2], b[5])],
  };
}
