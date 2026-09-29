import { loadStoredProject } from "../persistence/browser-projects";

/**
 * Reads the recovered project off the main thread: the IndexedDB read, hash
 * check, JSON parse, schema and source validation and lock adoption of a
 * large project took seconds of main-thread time at page load. Replies with
 * the verified JSON (the main thread parses it once) or what was found.
 */
self.onmessage = async (e: MessageEvent<{ id: string }>) => {
  try {
    const stored = await loadStoredProject(e.data.id);
    self.postMessage(
      stored === null
        ? { deleted: true }
        : stored
          ? { json: stored.json }
          : { missing: true },
    );
  } catch (error) {
    self.postMessage({
      error: error instanceof Error ? error.message : String(error),
    });
  }
};
