/**
 * Registry of the complete official LDraw library pack (scripts/build-full-library.ts).
 *
 * The curated pack stays the eagerly loaded, placeable catalogue. Every other
 * official file resolves through this registry once its index is registered:
 * names become "official" (installedSource), top-level parts get build-time
 * bounds in the shared installed-bounds table used by stacking, health, explode,
 * floors and queries, and fetched definitions are kept for the renderer.
 *
 * Registration is host neutral: the browser loader (full-library-loader.ts)
 * fetches, verifies and caches; the CLI (scripts/full-library-node.ts) reads the
 * built pack from disk.
 */
import installedBounds from "./bounds.json";
import fullLock from "./full-library-lock.json";
import {
  directReferences,
  locateFiles,
  type FileLocation,
  type FullPackCatalogEntry,
  type FullPackIndex,
  type FullPackManifest,
} from "./full-pack";
import type { Bounds } from "../core/spatial";
import { ensure } from "../core/types";

/** Lock of the complete pack this build ships (recorded in project locks). */
export const fullLibraryLock: { releaseId: string; manifestSha256: string } =
  fullLock;

type State = {
  manifest: FullPackManifest;
  index: FullPackIndex;
  where: Map<string, FileLocation>;
};
let state: State | undefined;
let catalogEntries: FullPackCatalogEntry[] | undefined;
/** Fetched official definitions (reference name → exact text). */
const sources = new Map<string, string>();
const listeners = new Set<() => void>();
let generation = 0;

const curatedBounds = installedBounds.bounds as unknown as Record<
  string,
  Bounds | null
>;
/** Names the curated pack defines (captured before any full-pack bounds are added). */
const curatedNames = new Set(Object.keys(curatedBounds));
export const curatedHas = (name: string) => curatedNames.has(name);
const curatedTransitive = installedBounds.dependencies.transitive as Record<
  string,
  string[]
>;

export const fullLibraryRegistered = () => !!state;
/** Increments whenever names, bounds or sources are added. */
export const fullLibraryGeneration = () => generation;
export function onFullLibraryChange(listener: () => void) {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}
const changed = () => {
  generation++;
  for (const l of [...listeners]) l();
};

/** Parts whose definitions failed to load or verify (retried on next load). */
const unavailable = new Set<string>();

/** Whether the complete pack defines this reference name and it has not
 * failed to load or verify. */
export function fullLibraryHas(name: string) {
  return !!state?.where.has(name) && !unavailable.has(name);
}
/** Marks names unresolvable after a failed load (tampered, offline and not
 * cached), or clears the mark before a retry. */
export function markFullUnavailable(names: Iterable<string>, failed: boolean) {
  let touched = false;
  for (const n of names)
    if (failed ? !unavailable.has(n) : unavailable.has(n)) {
      if (failed) unavailable.add(n);
      else unavailable.delete(n);
      touched = true;
    }
  if (touched) changed();
}
/** Whether this is a top-level part file (parts/*.dat, not a subpart or primitive). */
export function fullLibraryIsPart(name: string) {
  return !!state && Object.hasOwn(state.index.parts, name);
}

/**
 * Registers a verified manifest and index. Installs each top-level part's
 * build-time bounds into the shared installed-bounds table (curated entries are
 * never replaced), so every spatial consumer sees them synchronously.
 */
export function registerFullLibrary(
  manifest: FullPackManifest,
  index: FullPackIndex,
) {
  ensure(
    manifest.releaseId === fullLibraryLock.releaseId &&
      index.releaseId === manifest.releaseId,
    "INVALID_INPUT",
    "Full library release does not match its lock",
  );
  if (state) return;
  state = { manifest, index, where: locateFiles(index) };
  for (const [name, [, b]] of Object.entries(index.parts))
    if (!curatedNames.has(name))
      curatedBounds[name] = b && {
        min: [b[0], b[1], b[2]],
        max: [b[3], b[4], b[5]],
      };
  changed();
}
export function registeredFullLibrary() {
  return state;
}

export function registerFullCatalog(entries: FullPackCatalogEntry[]) {
  catalogEntries = entries;
  changed();
}
export const fullCatalog = () => catalogEntries;

/** Adds verified definition texts. Records each loaded part's transitive
 * dependencies so project definitions shadowing one of them make its bounds
 * unknown (as for curated parts). */
export function addFullSources(texts: Map<string, string>) {
  if (!texts.size) return;
  for (const [name, text] of texts) sources.set(name, text);
  const closure = (name: string, seen: Set<string>) => {
    for (const d of directReferences(sources.get(name) ?? ""))
      if (!seen.has(d)) {
        seen.add(d);
        closure(d, seen);
      }
    return seen;
  };
  for (const name of texts.keys())
    if (!curatedNames.has(name) && fullLibraryIsPart(name))
      curatedTransitive[name] = [...closure(name, new Set())];
  changed();
}
export const fullSource = (name: string) => sources.get(name);
export const fullSourceNames = () => sources.keys();

/** Official references (outside the curated pack) that the full pack defines
 * and that are not loaded yet, among these names. */
export function pendingFullSources(names: Iterable<string>) {
  const out: string[] = [];
  for (const n of names)
    if (!sources.has(n) && !curatedNames.has(n) && state?.where.has(n))
      out.push(n);
  return out;
}
