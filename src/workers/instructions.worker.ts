import {
  restoreInstructionWorkerData,
  type instructionWorkerData,
} from "../instructions/worker-data";
import {
  generateInstructions,
  type GenerationOptions,
} from "../instructions/generate";
import { AppError } from "../core/types";
self.onmessage = (
  event: MessageEvent<{
    data: ReturnType<typeof instructionWorkerData>;
    options: GenerationOptions;
  }>,
) => {
  try {
    restoreInstructionWorkerData(event.data.data);
    self.postMessage({
      plan: generateInstructions(event.data.data.project, event.data.options)
        .plan,
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
