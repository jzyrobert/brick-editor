import { describe, expect, it } from "vitest";
import {
  clearSavedBuilds,
  countSavedBuilds,
  describeSavedBuilds,
  type SavedBuildStores,
} from "../../src/persistence/clear-saved";
import {
  CURRENT_PROJECT_KEY,
  LocalProjects,
  legacyProjectKeys,
  type StorageAdapter,
} from "../../src/persistence/storage";
import { createProject } from "../../src/core/document";

function memory(): StorageAdapter & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
    key: (i) => [...data.keys()][i] ?? null,
    get length() {
      return data.size;
    },
  };
}

describe("clear saved builds", () => {
  it("finds legacy project snapshots and the current pointer, never caches or preferences", async () => {
    const storage = memory();
    const project = createProject("Castle");
    await new LocalProjects(storage).save(project, null);
    storage.setItem(CURRENT_PROJECT_KEY, project.id);
    const kept = {
      "brick-editor-ldraw-full:chunk-3": "part chunk",
      "brick-editor-part-thumbnails:3001": "thumb",
      "brick-editor-play-keys-v1": "{}",
      "brick-editor-shortcuts-v1": "{}",
      "brick-editor-omr-v1": "sets",
      "brick-editor-project-change": "{}",
      "someone-else:x:head": "foreign",
    };
    for (const [k, v] of Object.entries(kept)) storage.setItem(k, v);
    const keys = legacyProjectKeys(storage);
    expect(keys).toContain(CURRENT_PROJECT_KEY);
    expect(keys.some((k) => k.endsWith(":head"))).toBe(true);
    expect(keys.some((k) => k.includes(":snapshot:"))).toBe(true);
    for (const k of Object.keys(kept)) expect(keys).not.toContain(k);
    for (const k of keys) storage.removeItem(k);
    expect(await new LocalProjects(storage).list()).toEqual([]);
    for (const [k, v] of Object.entries(kept))
      expect(storage.getItem(k)).toBe(v);
  });
  it("counts, then clears projects and checkpoints", async () => {
    const log: string[] = [];
    let projects = 3,
      checkpoints = 2;
    const stores: SavedBuildStores = {
      projects: {
        count: async () => projects,
        clearAll: async () => {
          log.push("projects");
          projects = 0;
        },
      },
      checkpoints: {
        count: async () => checkpoints,
        clearAll: async () => {
          log.push("checkpoints");
          checkpoints = 0;
        },
      },
    };
    expect(await countSavedBuilds(stores)).toEqual({
      projects: 3,
      checkpoints: 2,
    });
    expect(await clearSavedBuilds(stores)).toEqual({
      projects: 3,
      checkpoints: 2,
    });
    expect(log).toEqual(["projects", "checkpoints"]);
    expect(await countSavedBuilds(stores)).toEqual({
      projects: 0,
      checkpoints: 0,
    });
  });
  it("treats missing checkpoint storage as none", async () => {
    const stores: SavedBuildStores = {
      projects: { count: async () => 1, clearAll: async () => {} },
      checkpoints: {
        count: () => Promise.reject(new Error("no IndexedDB")),
        clearAll: () => Promise.reject(new Error("no IndexedDB")),
      },
    };
    expect(await clearSavedBuilds(stores)).toEqual({
      projects: 1,
      checkpoints: 0,
    });
  });
  it("says what will be deleted", () => {
    expect(describeSavedBuilds({ projects: 1, checkpoints: 0 })).toBe(
      "1 saved project",
    );
    expect(describeSavedBuilds({ projects: 3, checkpoints: 2 })).toBe(
      "3 saved projects and 2 checkpoints",
    );
  });
});
