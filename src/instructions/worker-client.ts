import { instructionWorkerData } from "./worker-data";
import type { GenerationOptions } from "./generate";
import { AppError, type InstructionPlan, type Project } from "../core/types";
export function startInstructionGeneration(
  project: Project,
  options: GenerationOptions = {},
) {
  const data = instructionWorkerData(project);
  const worker = new Worker(
    new URL("../workers/instructions.worker.ts", import.meta.url),
    { type: "module" },
  );
  let cancel = () => {};
  const result = new Promise<InstructionPlan>((resolve, reject) => {
    let settled = false;
    const finish = (plan?: InstructionPlan, error?: Error) => {
      if (settled) return;
      settled = true;
      worker.terminate();
      error ? reject(error) : resolve(plan!);
    };
    cancel = () =>
      finish(
        undefined,
        new AppError("INVALID_INPUT", "Instruction generation cancelled."),
      );
    worker.onmessage = (e) =>
      e.data.error
        ? finish(
            undefined,
            new AppError(e.data.error.code, e.data.error.message),
          )
        : finish(e.data.plan);
    worker.onerror = () =>
      finish(
        undefined,
        new AppError(
          "INVALID_INPUT",
          "Instruction generation worker failed. Try again.",
        ),
      );
    try {
      worker.postMessage({ data, options });
    } catch (e) {
      finish(undefined, e instanceof Error ? e : new Error(String(e)));
    }
  });
  return { result, cancel: () => cancel() };
}
