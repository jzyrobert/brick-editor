import { sha256 } from "../core/hash";
import { validate } from "../core/validate";
import { validateSourceDocument } from "../core/document";
import { ensure, uid, type Project } from "../core/types";

/** Named checkpoints: explicit, independent recovery points for one project (spec §10.4).
 * Stored apart from autosave snapshots so autosave pruning never removes them. */
const DATABASE = "brick-editor-checkpoints";
const STORE = "checkpoints";
export const CHECKPOINT_LIMITS = Object.freeze({
  perProject: 20,
  nameLength: 80,
  jsonCharacters: 64 * 1024 * 1024,
});
export type CheckpointSummary = {
  id: string;
  projectId: string;
  name: string;
  createdAt: string;
  revision: number;
  parts: number;
  bytes: number;
};
type CheckpointRecord = CheckpointSummary & { json: string; hash: string };

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    ensure(
      typeof indexedDB !== "undefined",
      "STORAGE_UNAVAILABLE",
      "Checkpoints need browser storage (IndexedDB).",
    );
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => {
      const store = request.result.createObjectStore(STORE, { keyPath: "id" });
      store.createIndex("projectId", "projectId");
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = request.onblocked = () =>
      reject(
        Object.assign(new Error("Checkpoint storage is unavailable."), {
          code: "STORAGE_UNAVAILABLE",
        }),
      );
  });
}
async function run<T>(
  mode: IDBTransactionMode,
  work: (store: IDBObjectStore) => IDBRequest<T> | void,
): Promise<T> {
  const db = await open();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      let result: T;
      const request = work(tx.objectStore(STORE));
      if (request) request.onsuccess = () => (result = request.result);
      tx.oncomplete = () => resolve(result);
      tx.onerror = tx.onabort = () =>
        reject(tx.error ?? new Error("Checkpoint storage failed."));
    });
  } finally {
    db.close();
  }
}

export async function listCheckpoints(
  projectId: string,
): Promise<CheckpointSummary[]> {
  const records = await run<CheckpointRecord[]>("readonly", (store) =>
    store.index("projectId").getAll(projectId),
  );
  return (records ?? [])
    .map(({ json: _json, hash: _hash, ...summary }) => summary)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function createCheckpoint(
  project: Project,
  name: string,
  parts: number,
): Promise<CheckpointSummary> {
  const trimmed = name.trim();
  ensure(
    trimmed.length > 0 && trimmed.length <= CHECKPOINT_LIMITS.nameLength,
    "INVALID_INPUT",
    `Checkpoint names need 1–${CHECKPOINT_LIMITS.nameLength} characters.`,
  );
  const existing = await listCheckpoints(project.id);
  ensure(
    existing.length < CHECKPOINT_LIMITS.perProject,
    "LIMIT_EXCEEDED",
    `This project already has ${CHECKPOINT_LIMITS.perProject} checkpoints; delete one first.`,
  );
  const json = JSON.stringify(project);
  ensure(
    json.length <= CHECKPOINT_LIMITS.jsonCharacters,
    "LIMIT_EXCEEDED",
    "This project is too large to keep as a checkpoint; download a native backup instead.",
  );
  const record: CheckpointRecord = {
    id: uid(),
    projectId: project.id,
    name: trimmed,
    createdAt: new Date().toISOString(),
    revision: project.revision,
    parts,
    bytes: json.length,
    json,
    hash: await sha256(json),
  };
  await run("readwrite", (store) => store.add(record));
  const { json: _json, hash: _hash, ...summary } = record;
  return summary;
}

/** Load and verify a checkpoint's project; a corrupted record is refused, never used. */
export async function loadCheckpoint(id: string): Promise<{
  summary: CheckpointSummary;
  project: Project;
}> {
  const record = await run<CheckpointRecord | undefined>("readonly", (store) =>
    store.get(id),
  );
  ensure(record, "INVALID_INPUT", "That checkpoint no longer exists.");
  ensure(
    (await sha256(record.json)) === record.hash,
    "CHECKSUM_MISMATCH",
    "This checkpoint is damaged and cannot be restored.",
  );
  const project = JSON.parse(record.json) as Project;
  validate("project", project);
  validateSourceDocument(project);
  const { json: _json, hash: _hash, ...summary } = record;
  return { summary, project };
}

export async function deleteCheckpoint(id: string) {
  await run("readwrite", (store) => store.delete(id));
}
