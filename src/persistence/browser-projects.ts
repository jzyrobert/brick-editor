import { AppError, ensure, type Project } from "../core/types";
import { validate } from "../core/validate";
import { validateSourceDocument } from "../core/document";
import { adoptCurrentLocks } from "../catalog/catalog";
import { sha256 } from "../core/hash";
import { encodeNative } from "./native";
import {
  LEGACY_KEY,
  LocalProjects,
  legacyProjectKeys,
  type StorageAdapter,
} from "./storage";
import { withStorageWriteLock } from "./write-lock";

export const PROJECT_DATABASE = "brick-editor-projects";
export const PROJECT_CHANGE_KEY = "brick-editor-project-change";
type Snapshot = { json: string; hash: string; revision: number };
type RecordValue = { token: string; snapshots: Snapshot[]; deleted?: boolean };
const storageFailure = () =>
  new AppError(
    "STORAGE_QUOTA",
    "Browser project storage is unavailable or full. Your build is still in memory; download a native backup.",
  );
function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const fail = () => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        reject(storageFailure());
      }
    };
    const timer = setTimeout(fail, 10000);
    try {
      const request = indexedDB.open(PROJECT_DATABASE, 1);
      request.onupgradeneeded = () => {
        request.result.createObjectStore("projects");
      };
      request.onerror = fail;
      request.onblocked = fail;
      request.onsuccess = () => {
        if (settled) {
          request.result.close();
          return;
        }
        settled = true;
        clearTimeout(timer);
        request.result.onversionchange = () => request.result.close();
        resolve(request.result);
      };
    } catch {
      fail();
    }
  });
}
async function readRecord(id: string): Promise<RecordValue | undefined> {
  const db = await database();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction("projects", "readonly"),
        request = tx.objectStore("projects").get(id);
      let value: RecordValue | undefined;
      request.onsuccess = () => {
        value = request.result;
      };
      tx.oncomplete = () => resolve(value);
      tx.onabort = tx.onerror = () => reject(storageFailure());
    });
  } finally {
    db.close();
  }
}
async function validSnapshot(
  id: string,
  record?: RecordValue,
): Promise<{ project: Project; snapshot: Snapshot; adopted: boolean } | null> {
  if (record?.deleted) return null;
  for (const snapshot of record?.snapshots ?? []) {
    try {
      if ((await sha256(snapshot.json)) !== snapshot.hash) continue;
      const project = JSON.parse(snapshot.json);
      validate("project", project);
      validateSourceDocument(project);
      const adopted = adoptCurrentLocks(project);
      if (project.id !== id || project.revision !== snapshot.revision) continue;
      return { project, snapshot, adopted };
    } catch {
      /* A failed newest snapshot must not hide the previous valid revision. */
    }
  }
  return null;
}
/**
 * The newest verified snapshot in IndexedDB: hash-checked, parsed, validated
 * and re-pinned to current locks. `null` when the project was deleted,
 * `undefined` when IndexedDB holds no valid copy (the legacy store may).
 * Needs no DOM or localStorage, so it also runs in a worker.
 */
export async function loadStoredProject(
  id: string,
): Promise<{ project: Project; json: string } | null | undefined> {
  const record = await readRecord(id);
  if (record?.deleted) return null;
  const valid = await validSnapshot(id, record);
  if (!valid) return undefined;
  return {
    project: valid.project,
    json: valid.adopted ? JSON.stringify(valid.project) : valid.snapshot.json,
  };
}
/** Publish a checksum already computed outside the transaction. The token CAS
 * and snapshot replacement occur in one exclusive readwrite transaction. */
async function publish(
  id: string,
  prior: RecordValue | undefined,
  next: RecordValue,
  assertHeld: () => void,
) {
  const db = await database();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("projects", "readwrite"),
        store = tx.objectStore("projects"),
        request = store.get(id);
      let failure: unknown;
      request.onsuccess = () => {
        try {
          assertHeld();
        } catch (error) {
          failure = error;
          tx.abort();
          return;
        }
        if (request.result?.token !== prior?.token) {
          failure = new AppError(
            "REVISION_CONFLICT",
            "Another tab saved this project. Export a backup or fork it.",
          );
          tx.abort();
          return;
        }
        store.put(next, id);
      };
      tx.oncomplete = () => resolve();
      tx.onabort = tx.onerror = () => reject(failure ?? storageFailure());
    });
  } finally {
    db.close();
  }
}

/** A worker save that must be redone on the main thread (nothing was written). */
export const SAVE_ON_MAIN_THREAD = "SAVE_ON_MAIN_THREAD";
/**
 * The save transaction: validate, serialize and hash `project`, then, under
 * the cross-tab write lock, compare it with the stored copy and publish.
 * `legacy` is the localStorage adapter for copies not yet in IndexedDB; a
 * worker passes EMPTY_STORAGE when the page found no legacy copy, else null,
 * and is then told to hand the save back (SAVE_ON_MAIN_THREAD) if it would
 * need that copy.
 */
export async function saveSnapshot(
  project: Project,
  expectedStoredRevision: number | null,
  legacy: StorageAdapter | null,
) {
  validate("project", project);
  validateSourceDocument(project);
  const json = JSON.stringify(project),
    snapshot = { json, hash: await sha256(json), revision: project.revision };
  return withStorageWriteLock(
    legacy ?? workerLockOwner,
    project.id,
    async (assertHeld) => {
      const record = await readRecord(project.id),
        valid = await validSnapshot(project.id, record);
      if (!record?.deleted && !valid && !legacy)
        throw new Error(SAVE_ON_MAIN_THREAD);
      const previous = record?.deleted
        ? null
        : (valid?.project ??
          (await new LocalProjects(legacy!).load(project.id)));
      ensure(
        (previous?.revision ?? null) === expectedStoredRevision,
        "REVISION_CONFLICT",
        "Another tab saved this project. Export a backup or fork it.",
      );
      if (previous) {
        ensure(
          project.revision >= previous.revision,
          "REVISION_CONFLICT",
          "Cannot replace a newer saved revision",
        );
        if (project.revision === previous.revision)
          ensure(
            json === JSON.stringify(previous),
            "REVISION_CONFLICT",
            "Saved revision has different content",
          );
      }
      const previousSnapshot =
        valid?.snapshot ??
        (previous
          ? {
              json: JSON.stringify(previous),
              hash: await sha256(JSON.stringify(previous)),
              revision: previous.revision,
            }
          : undefined);
      const snapshots = [snapshot];
      if (previousSnapshot && previousSnapshot.revision !== snapshot.revision)
        snapshots.push(previousSnapshot);
      await publish(
        project.id,
        record,
        {
          token: crypto.randomUUID(),
          snapshots,
        },
        assertHeld,
      );
      return project.revision;
    },
  );
}
/** Lock owner for worker saves (Web Locks only; never the memory queue). */
const workerLockOwner = {} as StorageAdapter;

let saveWorker: Worker | null | undefined;
let saveSequence = 0;
const saveReplies = new Map<
  number,
  (reply: {
    revision?: number;
    fallback?: boolean;
    error?: { code: string; message: string };
  }) => void
>();
/** The persistent save worker, or null where workers cannot run. */
function projectSaveWorker() {
  if (saveWorker !== undefined) return saveWorker;
  saveWorker = null;
  if (
    typeof Worker === "undefined" ||
    typeof navigator === "undefined" ||
    !navigator.locks
  )
    return null;
  try {
    const worker = new Worker(
      new URL("../workers/project-save.worker.ts", import.meta.url),
      { type: "module" },
    );
    worker.onmessage = (e) => {
      const reply = saveReplies.get(e.data?.sequence);
      saveReplies.delete(e.data?.sequence);
      reply?.(e.data);
    };
    worker.onerror = (e) => {
      e.preventDefault();
      // A worker that cannot start (or crashed): every waiting save and all
      // later ones run on the main thread.
      saveWorker = null;
      worker.terminate();
      for (const reply of saveReplies.values()) reply({ fallback: true });
      saveReplies.clear();
    };
    saveWorker = worker;
  } catch {
    saveWorker = null;
  }
  return saveWorker;
}
/** Save through the worker: the new revision, or undefined when the save
 * must run on the main thread instead (nothing was written). */
async function saveInWorker(
  project: Project,
  expectedStoredRevision: number | null,
  legacyCopy: boolean,
): Promise<number | undefined> {
  // The page's own coordination decides: without Web Locks or IndexedDB here
  // the main-thread path reports saving as unavailable, as it always has.
  if (
    typeof navigator === "undefined" ||
    !navigator.locks ||
    typeof indexedDB === "undefined" ||
    !indexedDB
  )
    return undefined;
  const worker = projectSaveWorker();
  if (!worker) return undefined;
  const sequence = ++saveSequence;
  const reply = await new Promise<{
    revision?: number;
    fallback?: boolean;
    error?: { code: string; message: string };
  }>((resolve) => {
    saveReplies.set(sequence, resolve);
    try {
      worker.postMessage({
        sequence,
        project,
        expectedStoredRevision,
        legacyCopy,
      });
    } catch {
      saveReplies.delete(sequence);
      resolve({ fallback: true });
    }
  });
  if (reply.error)
    throw new AppError(reply.error.code as never, reply.error.message);
  return reply.fallback ? undefined : reply.revision;
}

/** Durable browser default. LocalProjects remains the injectable legacy adapter.
 * Legacy snapshots are read without mutation and migrated only after a verified
 * save. A tombstone prevents deleted legacy copies reappearing in the library. */
export class BrowserProjects {
  constructor(private legacyStorage: StorageAdapter) {}
  private notify(id: string) {
    try {
      this.legacyStorage.setItem(
        PROJECT_CHANGE_KEY,
        JSON.stringify({ id, nonce: crypto.randomUUID() }),
      );
    } catch {
      /* Data is already committed; notification is best effort. */
    }
  }
  async load(id: string): Promise<Project | null> {
    const stored = await loadStoredProject(id);
    if (stored === null) return null;
    return stored?.project ?? new LocalProjects(this.legacyStorage).load(id);
  }
  /**
   * Save a verified snapshot. The work — schema and source validation, JSON,
   * hashing and verifying the stored copy it replaces — runs in a worker
   * (`project-save.worker.ts`) when one can take the cross-tab lock itself;
   * otherwise (no workers or Web Locks, a legacy localStorage copy to
   * migrate) on the main thread as before.
   */
  async save(input: Project, expectedStoredRevision: number | null) {
    const saved = await saveInWorker(
      input,
      expectedStoredRevision,
      new LocalProjects(this.legacyStorage).hasCopy(input.id),
    );
    if (saved !== undefined) {
      this.notify(input.id);
      return saved;
    }
    const revision = await saveSnapshot(
      structuredClone(input),
      expectedStoredRevision,
      this.legacyStorage,
    );
    this.notify(input.id);
    return revision;
  }
  async list() {
    const db = await database();
    let ids: string[];
    try {
      ids = await new Promise((resolve, reject) => {
        const tx = db.transaction("projects", "readonly"),
          request = tx.objectStore("projects").getAllKeys();
        request.onsuccess = () => resolve(request.result.map(String));
        request.onerror = () => reject(storageFailure());
      });
    } finally {
      db.close();
    }
    const legacy = await new LocalProjects(this.legacyStorage).list();
    const result: {
      id: string;
      title: string;
      revision: number;
      approximateBytes: number;
    }[] = [];
    for (const id of new Set([...ids, ...legacy.map((p) => p.id)])) {
      const project = await this.load(id);
      if (project)
        result.push({
          id,
          title: project.title,
          revision: project.revision,
          approximateBytes: JSON.stringify(project).length * 2,
        });
    }
    return result.sort((a, b) => a.title.localeCompare(b.title));
  }
  async delete(id: string, expectedRevision: number) {
    await withStorageWriteLock(this.legacyStorage, id, async (assertHeld) => {
      const record = await readRecord(id),
        project = await this.load(id);
      ensure(
        project?.revision === expectedRevision,
        "REVISION_CONFLICT",
        "Saved project changed; refresh before deleting",
      );
      await publish(
        id,
        record,
        {
          token: crypto.randomUUID(),
          snapshots: [],
          deleted: true,
        },
        assertHeld,
      );
      this.notify(id);
    });
  }
  async exportBackup(id: string) {
    const project = await this.load(id);
    ensure(project, "INVALID_INPUT", "Saved project is unavailable");
    return encodeNative(project);
  }
  /**
   * How many projects this browser keeps (each one's autosave snapshots
   * included), without reading them back.
   */
  async count() {
    const db = await database();
    let records: Array<[string, RecordValue | undefined]>;
    try {
      records = await new Promise((resolve, reject) => {
        const tx = db.transaction("projects", "readonly"),
          store = tx.objectStore("projects"),
          keys = store.getAllKeys(),
          values = store.getAll();
        tx.oncomplete = () =>
          resolve(
            keys.result.map((k, i) => [String(k), values.result[i]] as const),
          );
        tx.onabort = tx.onerror = () => reject(storageFailure());
      });
    } finally {
      db.close();
    }
    const ids = new Set<string>(),
      gone = new Set<string>();
    for (const [id, record] of records)
      (record?.deleted || !record?.snapshots.length ? gone : ids).add(id);
    for (const key of legacyProjectKeys(this.legacyStorage)) {
      const match = key.match(LEGACY_KEY);
      if (!match) continue;
      try {
        const id = decodeURIComponent(match[1]);
        if (!gone.has(id)) ids.add(id);
      } catch {
        /* A foreign key. */
      }
    }
    return ids.size;
  }
  /**
   * Deletes every saved project and its autosave snapshots from this
   * browser (IndexedDB and the legacy localStorage copies) and forgets the
   * current project, so the next start recovers nothing. Part geometry,
   * library and official-set caches live in other stores and are kept.
   */
  async clearAll() {
    const db = await database();
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction("projects", "readwrite");
        tx.objectStore("projects").clear();
        tx.oncomplete = () => resolve();
        tx.onabort = tx.onerror = () => reject(storageFailure());
      });
    } finally {
      db.close();
    }
    for (const key of legacyProjectKeys(this.legacyStorage))
      this.legacyStorage.removeItem(key);
    this.notify("");
  }
}
