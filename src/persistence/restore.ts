import type { Project } from "../core/types";
import { BrowserProjects } from "./browser-projects";
import type { StorageAdapter } from "./storage";

/**
 * The saved project to recover at page load. A worker verifies the stored
 * snapshot (hash, schema, source validation, lock adoption), so the main
 * thread only parses JSON it can trust (`verified`). Legacy snapshots, a
 * missing IndexedDB copy or a worker that cannot run fall back to the
 * main-thread path, which validates as before.
 */
export async function recoverProject(
  id: string,
  legacyStorage: StorageAdapter,
): Promise<{ project: Project; verified: boolean } | null> {
  const reply = await new Promise<
    { json?: string; deleted?: boolean; missing?: boolean } | undefined
  >((resolve) => {
    let worker: Worker;
    try {
      worker = new Worker(
        new URL("../workers/project-restore.worker.ts", import.meta.url),
        { type: "module" },
      );
    } catch {
      resolve(undefined);
      return;
    }
    const done = (value?: {
      json?: string;
      deleted?: boolean;
      missing?: boolean;
    }) => {
      worker.terminate();
      resolve(value);
    };
    worker.onmessage = (e) => done(e.data?.error ? undefined : e.data);
    worker.onerror = (e) => {
      e.preventDefault();
      done();
    };
    worker.postMessage({ id });
  });
  if (reply?.deleted) return null;
  if (reply?.json) {
    try {
      return { project: JSON.parse(reply.json) as Project, verified: true };
    } catch {
      /* Fall through to the validating path. */
    }
  }
  const project = await new BrowserProjects(legacyStorage).load(id);
  return project ? { project, verified: false } : null;
}
