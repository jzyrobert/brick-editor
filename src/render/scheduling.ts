/**
 * Cooperative yielding for long main-thread work (model compile/update).
 *
 * `yieldToMain` ends the current task so input, rendering and other tasks can
 * run: `scheduler.yield()` where the platform has it (the continuation keeps
 * its priority), otherwise a MessageChannel message (unlike `setTimeout(0)`,
 * never clamped to 4 ms after nesting).
 */
export type Yielder = () => Promise<void>;

export function yieldToMain(): Promise<void> {
  const scheduler = (
    globalThis as { scheduler?: { yield?: () => Promise<void> } }
  ).scheduler;
  if (typeof scheduler?.yield === "function") return scheduler.yield();
  if (typeof MessageChannel === "function")
    return new Promise((resolve) => {
      const channel = new MessageChannel();
      channel.port1.onmessage = () => {
        channel.port1.close();
        resolve();
      };
      channel.port2.postMessage(null);
    });
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * Splits a loop into tasks of at most about `budgetMs`: call `maybeYield()`
 * between units of work; it yields only once the budget is spent, so cheap
 * iterations do not pay a task switch each.
 */
export class TimeSlicer {
  private start: number;
  /** Tasks ended so far (diagnostics and tests). */
  yields = 0;
  constructor(
    private readonly budgetMs = 12,
    private readonly now: () => number = () => performance.now(),
    private readonly yielder: Yielder = yieldToMain,
  ) {
    this.start = now();
  }
  /** Whether the current task has used its budget. */
  get due() {
    return this.now() - this.start >= this.budgetMs;
  }
  /** Yields when the budget is spent; resolves true when it yielded. */
  async maybeYield(): Promise<boolean> {
    if (!this.due) return false;
    await this.yield();
    return true;
  }
  /** Ends the current task unconditionally and starts a new budget. */
  async yield() {
    this.yields++;
    await this.yielder();
    this.start = this.now();
  }
  /** Starts a new budget without yielding (after an await that already did). */
  reset() {
    this.start = this.now();
  }
}
