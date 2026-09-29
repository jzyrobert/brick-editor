import { compilePartRecord } from "../render/part-compile-core";
import { AppError } from "../core/types";

/**
 * Compiles official part geometry off the main thread: LDraw parsing,
 * subfile merging, normal smoothing and repair. Replies with the packed record
 * (transferred, not copied) or `portable: false` when the part needs
 * file-local materials and must compile on the main thread.
 */
self.onmessage = async (e: MessageEvent<{ id: number; text: string }>) => {
  const { id, text } = e.data;
  try {
    const buffer = await compilePartRecord(text);
    if (buffer) self.postMessage({ id, buffer }, { transfer: [buffer] });
    else self.postMessage({ id, portable: false });
  } catch (error) {
    self.postMessage({
      id,
      error: {
        code: error instanceof AppError ? error.code : "INVALID_INPUT",
        message: error instanceof Error ? error.message : String(error),
      },
    });
  }
};
