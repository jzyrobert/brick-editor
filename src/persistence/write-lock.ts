import { AppError } from "../core/types";
import type { StorageAdapter } from "./storage";
const memoryQueues = new WeakMap<StorageAdapter, Promise<unknown>>();
const unavailable = (message: string) =>
  new AppError(
    "STORAGE_COORDINATION_UNAVAILABLE",
    message + " Automatic saving is disabled; download a native backup.",
  );
/** LocalStorage has no compare-and-swap. Keep the entire verified read/write
 * inside a browser cross-tab lock, including asynchronous checksum work.
 * IndexedDB's exclusive readwrite transaction is the fallback coordination
 * primitive; project data remains in LocalStorage. No lease clock is involved.
 */
export async function withStorageWriteLock<T>(
  storage: StorageAdapter,
  key: string,
  operation: (assertHeld: () => void) => Promise<T>,
): Promise<T> {
  if (typeof navigator !== "undefined" && navigator.locks)
    return navigator.locks.request("brick-editor-save:" + key, () =>
      operation(() => {}),
    );
  if (typeof window === "undefined") {
    // Headless domain callers own their adapter; serialize concurrent calls
    // sharing that object. This is not used as a browser cross-tab fallback.
    const prior = memoryQueues.get(storage) ?? Promise.resolve();
    const next = prior.catch(() => {}).then(() => operation(() => {}));
    memoryQueues.set(storage, next);
    try {
      return await next;
    } finally {
      if (memoryQueues.get(storage) === next) memoryQueues.delete(storage);
    }
  }
  if (typeof indexedDB === "undefined")
    throw unavailable("This browser cannot coordinate saved-project writes.");
  const database = await new Promise<IDBDatabase>((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      settled = true;
      reject(unavailable("Saved-project coordination timed out."));
    }, 10000);
    let request: IDBOpenDBRequest;
    try {
      request = indexedDB.open("brick-editor-write-coordination", 1);
    } catch {
      clearTimeout(timer);
      reject(unavailable("Saved-project coordination is unavailable."));
      return;
    }
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains("mutex"))
        request.result.createObjectStore("mutex");
    };
    request.onsuccess = () => {
      clearTimeout(timer);
      if (settled) {
        request.result.close();
        return;
      }
      settled = true;
      resolve(request.result);
    };
    request.onerror = () => {
      clearTimeout(timer);
      if (!settled) {
        settled = true;
        reject(unavailable("Saved-project coordination is unavailable."));
      }
    };
    request.onblocked = () => {
      clearTimeout(timer);
      if (!settled) {
        settled = true;
        reject(
          unavailable("Another tab is blocking saved-project coordination."),
        );
      }
    };
  });
  try {
    return await new Promise<T>((resolve, reject) => {
      let transaction: IDBTransaction;
      try {
        transaction = database.transaction("mutex", "readwrite");
      } catch {
        reject(unavailable("Cannot acquire a safe saved-project writer."));
        return;
      }
      const store = transaction.objectStore("mutex");
      let started = false,
        finished = false,
        value: T,
        failure: unknown;
      // A pending request keeps the transaction active across checksum awaits.
      // All writes use the same object store, so different fallback writers
      // cannot observe the same head and both publish a replacement.
      const pulse = () => {
        if (finished) return;
        const request = store.get("writer");
        request.onsuccess = () => {
          if (!started) {
            started = true;
            void operation(() => {
              if (finished || failure)
                throw (
                  failure ??
                  unavailable(
                    "Saved-project coordination ended before publication.",
                  )
                );
            }).then(
              (result) => {
                value = result;
                finished = true;
              },
              (error) => {
                failure = error;
                finished = true;
                try {
                  transaction.abort();
                } catch {}
              },
            );
          }
          if (!finished) pulse();
        };
      };
      const timer = setTimeout(() => {
        if (!finished) {
          failure = unavailable("Saved-project coordination timed out.");
          finished = true;
          try {
            transaction.abort();
          } catch {}
        }
      }, 30000);
      transaction.oncomplete = () => {
        clearTimeout(timer);
        if (failure) reject(failure);
        else if (finished) resolve(value!);
        else reject(unavailable("Saved-project coordination ended early."));
      };
      transaction.onabort = () => {
        clearTimeout(timer);
        finished = true;
        reject(
          failure ?? unavailable("Saved-project coordination was interrupted."),
        );
      };
      transaction.onerror = () => {
        failure ??= unavailable("Saved-project coordination failed.");
      };
      pulse();
    });
  } finally {
    database.close();
  }
}
