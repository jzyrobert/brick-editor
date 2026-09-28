import { importLDraw } from "../ldraw/io";
import { AppError } from "../core/types";
import { isResourceProfile } from "../core/resource-profile";
import {
  loadFullLibraryIndex,
  sourceNeedsFullLibrary,
} from "../catalog/full-library-loader";
self.onmessage = async (e) => {
  try {
    // References outside the curated pack resolve against the complete
    // official pack's index; if it is unavailable they stay unresolved.
    if (sourceNeedsFullLibrary(e.data.text))
      await loadFullLibraryIndex().catch(() => {});
    self.postMessage({
      result: importLDraw(
        e.data.text,
        e.data.name,
        isResourceProfile(e.data.profile) ? { profile: e.data.profile } : {},
      ),
    });
  } catch (e) {
    self.postMessage({
      error: {
        code: e instanceof AppError ? e.code : "INVALID_INPUT",
        message: e instanceof Error ? e.message : String(e),
      },
    });
  }
};
