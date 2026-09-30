import type { Project } from "../core/types";
import { AppError } from "../core/types";
import {
  SAVE_ON_MAIN_THREAD,
  saveSnapshot,
} from "../persistence/browser-projects";
import { EMPTY_STORAGE } from "../persistence/storage";

/**
 * Autosave off the main thread: schema and source validation, JSON, hashing,
 * verifying the stored copy being replaced and the IndexedDB publish of a
 * large project took hundreds of milliseconds of main-thread time per save.
 * The worker takes the same cross-tab Web Lock the page would. A save that
 * needs the page's localStorage (a legacy copy to migrate) is handed back
 * before anything is written.
 */
self.onmessage = async (
  e: MessageEvent<{
    sequence: number;
    project: Project;
    expectedStoredRevision: number | null;
    legacyCopy: boolean;
  }>,
) => {
  const { sequence, project, expectedStoredRevision, legacyCopy } = e.data;
  try {
    if (!navigator.locks) {
      self.postMessage({ sequence, fallback: true });
      return;
    }
    const revision = await saveSnapshot(
      project,
      expectedStoredRevision,
      legacyCopy ? null : EMPTY_STORAGE,
    );
    self.postMessage({ sequence, revision });
  } catch (error) {
    if (error instanceof Error && error.message === SAVE_ON_MAIN_THREAD)
      self.postMessage({ sequence, fallback: true });
    else
      self.postMessage({
        sequence,
        error: {
          code: error instanceof AppError ? error.code : "STORAGE_QUOTA",
          message: error instanceof Error ? error.message : String(error),
        },
      });
  }
};
