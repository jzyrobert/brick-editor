import { BrowserProjects } from "./browser-projects";
import { clearAllCheckpoints, countAllCheckpoints } from "./checkpoints";
import type { StorageAdapter } from "./storage";

/** What "Clear saved builds" deletes. */
export type SavedBuildCounts = {
  /** Saved projects, each with its autosave (recovery) snapshots. */
  projects: number;
  /** Named checkpoints of every project. */
  checkpoints: number;
};
/** The stores that hold saved builds (injectable for tests). */
export type SavedBuildStores = {
  projects: { count(): Promise<number>; clearAll(): Promise<void> };
  checkpoints: { count(): Promise<number>; clearAll(): Promise<void> };
};
export function browserSavedBuildStores(
  legacy: StorageAdapter,
): SavedBuildStores {
  const projects = new BrowserProjects(legacy);
  return {
    projects: {
      count: () => projects.count(),
      clearAll: () => projects.clearAll(),
    },
    checkpoints: {
      count: countAllCheckpoints,
      clearAll: clearAllCheckpoints,
    },
  };
}
/** Checkpoint storage may be missing (no IndexedDB): nothing to count. */
async function orZero(count: () => Promise<number>) {
  try {
    return await count();
  } catch {
    return 0;
  }
}
export async function countSavedBuilds(
  stores: SavedBuildStores,
): Promise<SavedBuildCounts> {
  return {
    projects: await stores.projects.count(),
    checkpoints: await orZero(stores.checkpoints.count),
  };
}
/**
 * Deletes every saved project, autosave snapshot and checkpoint in this
 * browser. The part geometry cache, the library chunks and cached official
 * sets are separate stores and stay warm. Returns what was there.
 */
export async function clearSavedBuilds(
  stores: SavedBuildStores,
): Promise<SavedBuildCounts> {
  const before = await countSavedBuilds(stores);
  await stores.projects.clearAll();
  if (before.checkpoints) await stores.checkpoints.clearAll();
  return before;
}
/** "3 saved projects and 2 checkpoints" for the confirmation. */
export function describeSavedBuilds({
  projects,
  checkpoints,
}: SavedBuildCounts) {
  const plural = (n: number, word: string) =>
    `${n.toLocaleString("en")} ${word}${n === 1 ? "" : "s"}`;
  return checkpoints
    ? `${plural(projects, "saved project")} and ${plural(checkpoints, "checkpoint")}`
    : plural(projects, "saved project");
}
