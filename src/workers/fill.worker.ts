import { AppError } from "../core/types";
import { fillPreview } from "../edit/fill";
self.onmessage = (e) => {
  try {
    self.postMessage({ result: fillPreview(e.data.project, e.data.request) });
  } catch (e) {
    self.postMessage({
      error: {
        code: e instanceof AppError ? e.code : "INVALID_INPUT",
        message: e instanceof Error ? e.message : String(e),
      },
    });
  }
};
