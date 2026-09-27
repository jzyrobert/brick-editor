import { AppError, ensure, uid } from "../core/types";
export type JobStatus = {
  id: string;
  kind: string;
  state: "running" | "succeeded" | "failed" | "cancelled";
  progress: number;
  error?: { code: string; message: string };
};
export class JobRegistry {
  private jobs = new Map<
    string,
    {
      status: JobStatus;
      controller: AbortController;
      promise: Promise<unknown>;
    }
  >();
  start<T>(
    kind: string,
    work: (
      signal: AbortSignal,
      progress: (value: number) => void,
    ) => Promise<T>,
  ) {
    ensure(
      this.jobs.size < 100 ||
        [...this.jobs.values()].some((j) => j.status.state !== "running"),
      "LIMIT_EXCEEDED",
      "Too many active jobs",
    );
    if (this.jobs.size >= 100) {
      const first = [...this.jobs].find(
        ([, j]) => j.status.state !== "running",
      );
      if (first) this.jobs.delete(first[0]);
    }
    const id = uid(),
      controller = new AbortController(),
      status: JobStatus = { id, kind, state: "running", progress: 0 };
    const promise = Promise.resolve()
      .then(() =>
        work(controller.signal, (n) => {
          status.progress = Math.max(0, Math.min(1, n));
        }),
      )
      .then(
        (result) => {
          if (controller.signal.aborted)
            throw new AppError("CANCELLED", "Job cancelled");
          status.state = "succeeded";
          status.progress = 1;
          return result;
        },
        (e) => {
          status.state = controller.signal.aborted ? "cancelled" : "failed";
          status.error = {
            code: controller.signal.aborted
              ? "CANCELLED"
              : e instanceof AppError
                ? e.code
                : "JOB_FAILED",
            message: e instanceof Error ? e.message : String(e),
          };
          throw e;
        },
      );
    promise.catch(() => {});
    this.jobs.set(id, { status, controller, promise });
    return id;
  }
  list() {
    return [...this.jobs.values()].map((j) => structuredClone(j.status));
  }
  status(id: string) {
    const job = this.jobs.get(id);
    ensure(job, "INVALID_INPUT", "Unknown job ID");
    return structuredClone(job.status);
  }
  cancel(id: string) {
    const job = this.jobs.get(id);
    ensure(job, "INVALID_INPUT", "Unknown job ID");
    if (job.status.state === "running") {
      job.controller.abort();
      job.status.state = "cancelled";
    }
  }
  wait<T = unknown>(id: string): Promise<T> {
    const job = this.jobs.get(id);
    ensure(job, "INVALID_INPUT", "Unknown job ID");
    return job.promise as Promise<T>;
  }
}
export function runWorker<T>(
  worker: Worker,
  input: unknown,
  signal: AbortSignal,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const cancel = () => {
      worker.terminate();
      reject(new AppError("CANCELLED", "Job cancelled"));
    };
    if (signal.aborted) {
      cancel();
      return;
    }
    signal.addEventListener("abort", cancel, { once: true });
    const done = () => {
      worker.terminate();
      signal.removeEventListener("abort", cancel);
    };
    worker.onmessage = (e) => {
      done();
      if (e.data.error)
        reject(
          new AppError(
            e.data.error.code || "INVALID_INPUT",
            e.data.error.message || e.data.error,
          ),
        );
      else resolve(e.data.result);
    };
    worker.onerror = (e) => {
      done();
      reject(new AppError("JOB_FAILED", e.message));
    };
    worker.postMessage(input);
  });
}
