import { AppError, ensure, type Project } from "../core/types";
import { validate } from "../core/validate";
import { validateSourceDocument } from "../core/document";
import { sha256 } from "../core/hash";
import { encodeNative } from "./native";
import { LocalProjects, type StorageAdapter } from "./storage";
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
): Promise<{ project: Project; snapshot: Snapshot } | null> {
  if (record?.deleted) return null;
  for (const snapshot of record?.snapshots ?? []) {
    try {
      if ((await sha256(snapshot.json)) !== snapshot.hash) continue;
      const project = JSON.parse(snapshot.json);
      validate("project", project);
      validateSourceDocument(project);
      if (project.id !== id || project.revision !== snapshot.revision) continue;
      return { project, snapshot };
    } catch {
      /* A failed newest snapshot must not hide the previous valid revision. */
    }
  }
  return null;
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
    const record = await readRecord(id);
    if (record?.deleted) return null;
    const valid = await validSnapshot(id, record);
    return valid?.project ?? new LocalProjects(this.legacyStorage).load(id);
  }
  async save(input: Project, expectedStoredRevision: number | null) {
    const project = structuredClone(input);
    validate("project", project);
    validateSourceDocument(project);
    const json = JSON.stringify(project),
      snapshot = { json, hash: await sha256(json), revision: project.revision };
    return withStorageWriteLock(
      this.legacyStorage,
      project.id,
      async (assertHeld) => {
        const record = await readRecord(project.id),
          valid = await validSnapshot(project.id, record);
        const previous = record?.deleted
          ? null
          : (valid?.project ??
            (await new LocalProjects(this.legacyStorage).load(project.id)));
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
        this.notify(project.id);
        return project.revision;
      },
    );
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
}
