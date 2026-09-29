// Validates the connector pack derived from the complete official library:
// lock → manifest → every shard's bytes and format, one entry per top-level
// part of the complete pack it names, coverage counts that match the entries,
// and a re-derivation of sample parts that must reproduce the stored entries.
import { deepStrictEqual } from "node:assert";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { gunzipSync } from "node:zlib";
import {
  FULL_CONNECTOR_FORMAT,
  shardOf,
  shardPath,
  type FullConnectorEntry,
  type FullConnectorManifest,
  type FullConnectorShardData,
} from "../src/catalog/full-connector-pack";
import { deriveEntry, readFullPack } from "./build-full-connectors";

const hash = (b: Buffer | Uint8Array) =>
  createHash("sha256").update(b).digest("hex");
const fail = (message: string): never => {
  throw new Error("Full-library connectors: " + message);
};

/** Parts re-derived on every validation (hand-checked in the unit tests). */
export const SAMPLE_PARTS = [
  "3001.dat",
  "3010.dat",
  "3665a.dat",
  "60616a.dat",
  "30179.dat",
  "3794b.dat",
];

export function validateFullConnectors(options: {
  librariesDir: string;
  lock: { connectorPackId: string; manifestSha256: string };
  full: { releaseId: string; manifestSha256: string };
  samples?: string[];
}) {
  const root = `${options.librariesDir}${options.lock.connectorPackId}/`;
  const raw = readFileSync(root + "manifest.json");
  if (hash(raw) !== options.lock.manifestSha256) fail("lock mismatch");
  const m = JSON.parse(raw.toString()) as FullConnectorManifest;
  if (
    m.format !== FULL_CONNECTOR_FORMAT ||
    m.id !== options.lock.connectorPackId ||
    m.library.releaseId !== options.full.releaseId ||
    m.library.manifestSha256 !== options.full.manifestSha256
  )
    fail("manifest identity or library binding");
  const pack = readFullPack(
    `${options.librariesDir}${options.full.releaseId}/`,
    options.full.manifestSha256,
  );
  const parts = new Map<string, FullConnectorEntry>();
  const onDisk = new Set(readdirSync(root + "shards"));
  const listed = new Set<string>();
  let packed = 0;
  m.shards.forEach(([sha, bytes, count], i) => {
    const file = shardPath(sha);
    // Identical shards (empty ones in a tiny pack) share one file.
    if (!onDisk.has(file.slice("shards/".length)))
      fail("shard missing " + file);
    listed.add(file.slice("shards/".length));
    const gz = readFileSync(root + file);
    if (gz.length !== bytes || hash(gz) !== sha) fail("shard hash " + file);
    packed += gz.length;
    const data = JSON.parse(
      gunzipSync(gz).toString(),
    ) as FullConnectorShardData;
    if (data.format !== FULL_CONNECTOR_FORMAT) fail("shard format " + file);
    const names = Object.keys(data.parts);
    if (names.length !== count) fail("shard count " + file);
    for (const n of names) {
      if (shardOf(n, m.shards.length) !== i) fail("part in wrong shard " + n);
      parts.set(n, data.parts[n]);
    }
  });
  const unlisted = [...onDisk].filter((f) => !listed.has(f));
  if (unlisted.length) fail("unlisted shards " + unlisted.slice(0, 3).join());
  if (packed !== m.packedBytes) fail("packed byte total");
  const expected = Object.keys(pack.index.parts);
  if (parts.size !== expected.length || expected.some((n) => !parts.has(n)))
    fail("entries do not cover every top-level part");
  let verified = 0;
  for (const e of parts.values()) {
    if (e.verified) {
      verified++;
      if (!e.rule) fail("verified entry without a rule");
    } else if (e.rule) fail("unverified entry with a rule");
  }
  if (verified !== m.coverage.verified) fail("coverage count");
  const titles = new Map(pack.catalog.map((c) => [c[0], c]));
  for (const name of options.samples ?? SAMPLE_PARTS) {
    if (!parts.has(name)) continue;
    const [, title = "", category = ""] = titles.get(name) ?? [];
    const { derived: _, ...again } = deriveEntry(
      pack.sources(name),
      name,
      title,
      category,
      pack.index.parts[name][1],
    );
    deepStrictEqual(
      JSON.parse(JSON.stringify(again)),
      parts.get(name),
      "Stale derived entry: " + name,
    );
  }
  return {
    id: m.id,
    parts: parts.size,
    verified,
    shards: m.shards.length,
    packedBytes: m.packedBytes,
  };
}

export const fullConnectorPackBuilt = (librariesDir: string, id: string) =>
  existsSync(`${librariesDir}${id}/manifest.json`);
