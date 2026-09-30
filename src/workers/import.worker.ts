import { importLDraw } from "../ldraw/io";
import { validate } from "../core/validate";
import { validateSourceDocument } from "../core/document";
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
    const result = importLDraw(
      e.data.text,
      e.data.name,
      isResourceProfile(e.data.profile) ? { profile: e.data.profile } : {},
    );
    // Validated here, so the page can adopt the result without validating
    // (and deep-copying) a large document again on the main thread.
    validate("project", result);
    validateSourceDocument(result);
    self.postMessage({ result });
  } catch (e) {
    self.postMessage({
      error: {
        code: e instanceof AppError ? e.code : "INVALID_INPUT",
        message: e instanceof Error ? e.message : String(e),
      },
    });
  }
};
