import { test, expect, vi } from "vitest";
import { AutosaveQueue } from "../../src/persistence/autosave";
import { createProject } from "../../src/core/document";
test("sustained editing still saves within three seconds and serialises slow writes", async () => {
  vi.useFakeTimers();
  try {
    const writes: number[] = [];
    let release!: () => void;
    const queue = new AutosaveQueue(
      async (p) => {
        writes.push(p.revision);
        if (writes.length === 1)
          await new Promise<void>((r) => {
            release = r;
          });
      },
      (e) => {
        throw e;
      },
    );
    const p = createProject();
    for (let i = 0; i < 6; i++) {
      p.revision = i;
      queue.schedule(p);
      await vi.advanceTimersByTimeAsync(500);
    }
    expect(writes).toEqual([5]);
    p.revision = 6;
    queue.schedule(p);
    await vi.advanceTimersByTimeAsync(800);
    expect(writes).toEqual([5]);
    release();
    await queue.flush();
    expect(writes).toEqual([5, 6]);
    queue.dispose();
  } finally {
    vi.useRealTimers();
  }
});
test("project switches preserve pending work and write failures do not poison the queue", async () => {
  const a = createProject(),
    b = createProject();
  const ids: string[] = [],
    errors: unknown[] = [];
  const queue = new AutosaveQueue(
    async (p) => {
      ids.push(p.id);
      if (p.id === a.id) throw new Error("quota");
    },
    (e) => errors.push(e),
  );
  queue.schedule(a);
  queue.schedule(b);
  await queue.flush();
  expect(ids).toEqual([a.id, b.id]);
  expect(errors).toHaveLength(1);
  queue.dispose();
});
