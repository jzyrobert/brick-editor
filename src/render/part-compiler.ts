import { AppError } from "../core/types";
import type { GeometryCache } from "./geometry-cache";

/** A compile worker as the pool uses it (a real Worker, or a test double). */
export type CompileWorker = Pick<
  Worker,
  "postMessage" | "terminate" | "addEventListener"
>;
type Reply = {
  id: number;
  buffer?: ArrayBuffer;
  portable?: false;
  error?: { code: string; message: string };
};
type Job = {
  id: number;
  /** Built when the job is dispatched, so queued jobs hold no source text. */
  source: () => string;
  resolve: (buffer: ArrayBuffer | null) => void;
  reject: (error: unknown) => void;
};
type Slot = { worker: CompileWorker; job?: Job };

export type PartCompileStats = {
  /** Records served from the persistent cache. */
  diskHits: number;
  /** Parts compiled by workers. */
  workerCompiles: number;
  /** Parts the caller had to compile on the main thread (no workers, or
   * materials that cannot be shared). */
  mainThread: number;
  workerMs: number;
  workers: number;
};

/**
 * Compiles official part geometry off the main thread with a small worker
 * pool, backed by the persistent geometry cache. `compile` resolves the
 * packed record, or null when the caller must compile on the main thread
 * (workers unavailable or failed, or the part's materials cannot be shared).
 */
export class PartCompiler {
  private slots: Slot[] = [];
  private queue: Job[] = [];
  private nextId = 1;
  private broken = false;
  private disposed = false;
  stats: PartCompileStats = {
    diskHits: 0,
    workerCompiles: 0,
    mainThread: 0,
    workerMs: 0,
    workers: 0,
  };
  constructor(
    private readonly options: {
      /** Maximum concurrent workers (created on demand). */
      size: number;
      createWorker?: () => CompileWorker;
      cache?: GeometryCache;
    },
  ) {}
  setSize(size: number) {
    this.options.size = Math.max(1, size);
  }
  /**
   * The compiled record for `key`: from the persistent cache, else compiled
   * by a worker from `source()` (called only on a cache miss) and stored.
   * Rejects with the worker's AppError (e.g. REFERENCE_MISSING).
   */
  async compile(
    key: string,
    source: () => string,
  ): Promise<ArrayBuffer | null> {
    const cached = await this.options.cache?.get(key);
    if (cached) {
      this.stats.diskHits++;
      return cached;
    }
    if (this.broken || this.disposed || !this.options.createWorker) {
      this.stats.mainThread++;
      return null;
    }
    const start = performance.now();
    const buffer = await new Promise<ArrayBuffer | null>((resolve, reject) => {
      this.queue.push({ id: this.nextId++, source, resolve, reject });
      this.pump();
    });
    if (!buffer) {
      this.stats.mainThread++;
      return null;
    }
    this.stats.workerCompiles++;
    this.stats.workerMs += performance.now() - start;
    // Stored in the background: the cache copies the bytes when it writes.
    void this.options.cache?.put(key, buffer).catch(() => {});
    return buffer;
  }
  private pump() {
    while (this.queue.length) {
      let slot = this.slots.find((s) => !s.job);
      if (!slot && this.slots.length < this.options.size) {
        const created = this.spawn();
        if (!created) break;
        slot = created;
      }
      if (!slot) return;
      const job = this.queue.shift()!;
      slot.job = job;
      try {
        slot.worker.postMessage({ id: job.id, text: job.source() });
      } catch (e) {
        slot.job = undefined;
        job.reject(e);
      }
    }
    if (this.broken) this.drain();
  }
  private spawn(): Slot | undefined {
    let worker: CompileWorker;
    try {
      worker = this.options.createWorker!();
    } catch {
      this.broken = true;
      return undefined;
    }
    const slot: Slot = { worker };
    worker.addEventListener("message", (e: Event) => {
      const reply = (e as MessageEvent<Reply>).data;
      const job = slot.job;
      if (!job || job.id !== reply.id) return;
      slot.job = undefined;
      if (reply.error)
        job.reject(new AppError(reply.error.code, reply.error.message));
      else job.resolve(reply.buffer ?? null);
      this.pump();
    });
    worker.addEventListener("error", (e: Event) => {
      // A worker that cannot load or crashed: compile on the main thread.
      (e as ErrorEvent).preventDefault?.();
      this.broken = true;
      const job = slot.job;
      slot.job = undefined;
      job?.resolve(null);
      this.drain();
    });
    this.slots.push(slot);
    this.stats.workers = this.slots.length;
    return slot;
  }
  /** Hands every queued job back to the main thread. */
  private drain() {
    for (const job of this.queue.splice(0)) job.resolve(null);
  }
  dispose() {
    this.disposed = true;
    for (const slot of this.slots) {
      slot.job?.resolve(null);
      slot.worker.terminate();
    }
    this.slots = [];
    this.drain();
  }
}
