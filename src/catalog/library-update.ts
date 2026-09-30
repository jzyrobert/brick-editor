// Explicit re-pinning of a project to the current complete official library
// (Project → "Update to the latest parts library"; `library.update` command).
//
// A project pinned to a superseded complete release is re-pinned automatically
// on load only when none of its parts changed (catalog.ts adoptCurrentLocks).
// Otherwise it keeps its pin and those parts stay unresolved rather than
// silently changing. This module previews what an update would change and
// applies it as an ordinary undoable document command that records the
// previous lock in metadata.previousLocks.
import { ensure, type Project } from "../core/types";
import { occurrences } from "../core/document";
import {
  fullLibraryRefs,
  projectLibraryLock,
  retiredFullLibraryLocks,
} from "./catalog";
import { fullLibraryLock } from "./full-library";
import textureLock from "./full-textures-lock.json";

export type LibraryUpdateStatus = {
  /** The project pins another complete release than the current one. */
  needed: boolean;
  pinned: { releaseId: string; manifestSha256: string } | null;
  current: { releaseId: string; manifestSha256: string };
  /** The texture pack (!TEXMAP images) bound to the current release; a
   * project follows it with its complete-library pin (it is not pinned
   * separately), so updating also adopts it. */
  textures: { texturePackId: string; manifestSha256: string };
  /** The pinned release is a known retired release of this app. */
  retired: boolean;
  /** Whether the release records which files changed (else every part
   * outside the curated catalogue may look different). */
  changesKnown: boolean;
  /** Parts of this project that change (or may change), most used first. */
  changed: { ref: string; occurrences: number }[];
  /** Occurrences of those parts in the project. */
  changedOccurrences: number;
  /** Official parts outside the curated catalogue the project uses. */
  partsOutsideCatalogue: number;
};

/** What updating the project's complete-library pin would change. */
export function libraryUpdateStatus(p: Project): LibraryUpdateStatus {
  const pinned = p.library.full
    ? {
        releaseId: p.library.full.releaseId,
        manifestSha256: p.library.full.manifestSha256,
      }
    : null;
  const current = { ...fullLibraryLock };
  const needed =
    !!pinned && pinned.manifestSha256 !== fullLibraryLock.manifestSha256;
  const retired = needed
    ? retiredFullLibraryLocks.find(
        (l) =>
          l.releaseId === pinned!.releaseId &&
          l.manifestSha256 === pinned!.manifestSha256,
      )
    : undefined;
  const refs = fullLibraryRefs(p);
  const changesKnown = !!retired?.affected;
  const affected = new Set(retired?.affected ?? []);
  const counts = new Map<string, number>();
  if (needed)
    for (const o of occurrences(p))
      if (
        o.node.kind !== "geometry" &&
        refs.has(o.node.ref) &&
        (!changesKnown || affected.has(o.node.ref))
      )
        counts.set(o.node.ref, (counts.get(o.node.ref) ?? 0) + 1);
  const changed = [...counts]
    .map(([ref, n]) => ({ ref, occurrences: n }))
    .sort(
      (a, b) => b.occurrences - a.occurrences || a.ref.localeCompare(b.ref),
    );
  return {
    needed,
    pinned,
    current,
    textures: { ...textureLock },
    retired: !!retired,
    changesKnown,
    changed,
    changedOccurrences: changed.reduce((s, c) => s + c.occurrences, 0),
    partsOutsideCatalogue: refs.size,
  };
}

/**
 * Re-pins the project's complete library to the current release. `expected`
 * is the pin the caller previewed (a changed pin is refused). The previous
 * lock is appended to metadata.previousLocks with the reason and the parts
 * that change, so the update is visible and can be undone.
 */
export function updateFullLibraryLock(
  p: Project,
  expected: { releaseId: string; manifestSha256: string },
) {
  const status = libraryUpdateStatus(p);
  ensure(
    status.needed,
    "INVALID_INPUT",
    "This project already uses the latest parts library.",
  );
  ensure(
    !!expected &&
      status.pinned!.releaseId === expected.releaseId &&
      status.pinned!.manifestSha256 === expected.manifestSha256,
    "REVISION_CONFLICT",
    "The project's parts library changed; preview the update again.",
  );
  const previous = {
    full: { ...p.library.full! },
    reason: "user-update",
    // Texture pack adopted with the release (recorded for the change log).
    textures: { ...textureLock },
    changed: status.changesKnown
      ? status.changed.map((c) => c.ref).slice(0, 200)
      : null,
  };
  p.library = { ...p.library, full: { ...projectLibraryLock.full! } };
  const history = Array.isArray(p.metadata.previousLocks)
    ? p.metadata.previousLocks
    : [];
  p.metadata = {
    ...p.metadata,
    previousLocks: [...history, previous].slice(-8),
  };
}
