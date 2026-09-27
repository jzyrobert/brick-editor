import { importLDraw } from "../ldraw/io";
import { AppError } from "../core/types";
import { isResourceProfile } from "../core/resource-profile";
self.onmessage = (e) => {
  try {
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
