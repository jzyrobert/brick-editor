/**
 * Registry of the connector and occupancy pack derived from the complete
 * official library (scripts/build-full-connectors.ts; format in
 * full-connector-pack.ts). Entries arrive per shard: the browser loader
 * (full-library-loader.ts) fetches the shards of the parts it loads, the Node
 * host (scripts/full-library-node.ts) reads them from disk on first use.
 * connectors.ts consults this registry for official parts outside the
 * curated catalogue; curated parts always use the curated pack.
 */
import fullConnectorsLock from "./full-connectors-lock.json";
import { fullLibraryLock, notifyFullLibraryChange } from "./full-library";
import {
  FULL_CONNECTOR_FORMAT,
  shardOf,
  type FullConnectorEntry,
  type FullConnectorManifest,
} from "./full-connector-pack";
import { ensure } from "../core/types";

/** Lock of the derived pack this build ships (recorded in project locks as
 * `library.full.connectorPackId/connectorPackSha256`). */
export const fullConnectorLock: {
  connectorPackId: string;
  manifestSha256: string;
} = fullConnectorsLock;

let manifest: FullConnectorManifest | undefined;
const entries = new Map<string, FullConnectorEntry>();
const loadedShards = new Set<number>();
/** Synchronous source of shards (Node host); undefined in the browser. */
let provider: ((shard: number) => Record<string, FullConnectorEntry>) | null =
  null;

/** Registers the verified manifest. It must be derived from the complete
 * pack this build ships. */
export function registerFullConnectorManifest(m: FullConnectorManifest) {
  ensure(
    m.format === FULL_CONNECTOR_FORMAT &&
      m.id === fullConnectorLock.connectorPackId &&
      m.library.releaseId === fullLibraryLock.releaseId &&
      m.library.manifestSha256 === fullLibraryLock.manifestSha256,
    "INVALID_INPUT",
    "Full-library connector pack does not match the complete library lock",
  );
  manifest ??= m;
}
export const fullConnectorManifest = () => manifest;
/** Registers a Node-side reader that returns a shard's parts synchronously. */
export function setFullConnectorProvider(
  read: ((shard: number) => Record<string, FullConnectorEntry>) | null,
) {
  provider = read;
}

/** Shard index of a part in the registered pack. */
export const fullConnectorShard = (name: string) =>
  manifest ? shardOf(name, manifest.shards.length) : -1;

/** Adds one verified shard's entries. */
export function addFullConnectorShard(
  shard: number,
  parts: Record<string, FullConnectorEntry>,
) {
  if (loadedShards.has(shard)) return;
  loadedShards.add(shard);
  for (const [name, entry] of Object.entries(parts)) entries.set(name, entry);
  notifyFullLibraryChange();
}
export const fullConnectorShardLoaded = (shard: number) =>
  loadedShards.has(shard);

/** The derived entry of a complete-library part, when its shard is loaded
 * (or readable from disk in Node); undefined otherwise. */
export function fullConnectorEntry(
  name: string,
): FullConnectorEntry | undefined {
  const hit = entries.get(name);
  if (hit || !manifest || !provider) return hit;
  const shard = shardOf(name, manifest.shards.length);
  if (loadedShards.has(shard)) return undefined;
  loadedShards.add(shard);
  for (const [n, e] of Object.entries(provider(shard))) entries.set(n, e);
  return entries.get(name);
}
