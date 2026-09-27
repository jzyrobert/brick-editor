import type { Project } from "../core/types";

/** Debounced but never indefinitely postponed; serialises writes to avoid stale-head races. */
export class AutosaveQueue {
  private pending?: Project;
  private debounce?: ReturnType<typeof setTimeout>;
  private deadline?: ReturnType<typeof setTimeout>;
  private tail: Promise<void> = Promise.resolve();
  private disposed = false;
  constructor(
    private write: (project: Project) => Promise<void>,
    private onError: (error: unknown) => void,
    private delay = 750,
    private maxDelay = 3000,
  ) {}
  schedule(project: Project) {
    if (this.disposed) return;
    // A project switch must not discard the prior project's pending snapshot.
    if (this.pending && this.pending.id !== project.id) this.flush();
    this.pending = structuredClone(project);
    clearTimeout(this.debounce);
    this.debounce = setTimeout(() => this.flush(), this.delay);
    this.deadline ??= setTimeout(() => this.flush(), this.maxDelay);
  }
  flush() {
    clearTimeout(this.debounce);
    clearTimeout(this.deadline);
    this.debounce = this.deadline = undefined;
    const next = this.pending;
    this.pending = undefined;
    if (next)
      this.tail = this.tail.then(() => this.write(next)).catch(this.onError);
    return this.tail;
  }
  dispose() {
    this.disposed = true;
    clearTimeout(this.debounce);
    clearTimeout(this.deadline);
    this.pending = undefined;
  }
}
