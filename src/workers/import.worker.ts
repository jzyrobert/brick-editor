import { importLDraw } from "../ldraw/io";
import { AppError } from "../core/types";
self.onmessage = (e) => {
  try {
    self.postMessage({ result: importLDraw(e.data.text, e.data.name) });
  } catch (e) {
    self.postMessage({
      error: {
        code: e instanceof AppError ? e.code : "INVALID_INPUT",
        message: e instanceof Error ? e.message : String(e),
      },
    });
  }
};
