import { describe, expect, it } from "vitest";
import { TimeSlicer, yieldToMain } from "../../src/render/scheduling";
import {
  PartCompiler,
  type CompileWorker,
} from "../../src/render/part-compiler";
import { GeometryCache, MemoryStore } from "../../src/render/geometry-cache";

describe("time slicing", () => {
  it("yields only once the slice budget is spent", async () => {
    let now = 0,
      yields = 0;
    const slicer = new TimeSlicer(
      10,
      () => now,
      async () => {
        yields++;
      },
    );
    expect(await slicer.maybeYield()).toBe(false);
    now = 9;
    expect(slicer.due).toBe(false);
    now = 10;
    expect(slicer.due).toBe(true);
    expect(await slicer.maybeYield()).toBe(true);
    expect(yields).toBe(1);
    // A new budget starts after each yield.
    now = 15;
    expect(await slicer.maybeYield()).toBe(false);
    now = 20;
    expect(await slicer.maybeYield()).toBe(true);
    expect(slicer.yields).toBe(2);
  });

  it("ends the task: a queued macrotask runs before the continuation", async () => {
    const order: string[] = [];
    setTimeout(() => order.push("timer"), 0);
    await new Promise((r) => setTimeout(r, 0));
    const channel = new MessageChannel();
    channel.port1.onmessage = () => order.push("message");
    channel.port2.postMessage(null);
    await yieldToMain();
    order.push("continued");
    channel.port1.close();
    expect(order).toEqual(["timer", "message", "continued"]);
  });
});

/** A compile worker double that replies when told to. */
class FakeWorker implements CompileWorker {
  static all: FakeWorker[] = [];
  listeners = new Map<string, ((e: Event) => void)[]>();
  received: { id: number; text: string }[] = [];
  terminated = false;
  constructor() {
    FakeWorker.all.push(this);
  }
  addEventListener(type: string, listener: (e: Event) => void) {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }
  postMessage(message: { id: number; text: string }) {
    this.received.push(message);
  }
  terminate() {
    this.terminated = true;
  }
  emit(type: string, data: unknown) {
    for (const l of this.listeners.get(type) ?? [])
      l(Object.assign(new Event(type), { data }) as Event);
  }
  reply(index = 0, bytes = 8) {
    const { id } = this.received[index];
    this.emit("message", { id, buffer: new ArrayBuffer(bytes) });
  }
}
const flush = () => new Promise((r) => setTimeout(r, 0));

describe("part compile pool", () => {
  it("bounds concurrency, builds sources only when dispatched, and caches results", async () => {
    FakeWorker.all = [];
    const cache = new GeometryCache(
      Promise.resolve(new MemoryStore()),
      1 << 20,
    );
    const compiler = new PartCompiler({
      size: 2,
      createWorker: () => new FakeWorker(),
      cache,
    });
    const built: string[] = [];
    const results = ["a", "b", "c"].map((key) =>
      compiler.compile(key, () => {
        built.push(key);
        return "source " + key;
      }),
    );
    await flush();
    expect(FakeWorker.all).toHaveLength(2);
    // The third job waits in the queue without its source text.
    expect(built).toEqual(["a", "b"]);
    FakeWorker.all[0].reply(0, 16);
    await flush();
    expect(built).toEqual(["a", "b", "c"]);
    expect(FakeWorker.all[0].received[1].text).toBe("source c");
    FakeWorker.all[1].reply(0);
    FakeWorker.all[0].reply(1);
    expect((await results[0])!.byteLength).toBe(16);
    await Promise.all(results);
    expect(compiler.stats.workerCompiles).toBe(3);
    await flush();
    // A second request is served from the persistent cache, no worker.
    const again = await compiler.compile("a", () => {
      throw new Error("not needed");
    });
    expect(again!.byteLength).toBe(16);
    expect(compiler.stats.diskHits).toBe(1);
    compiler.dispose();
    expect(FakeWorker.all.every((w) => w.terminated)).toBe(true);
  });

  it("propagates worker errors, and falls back to the main thread when workers fail", async () => {
    FakeWorker.all = [];
    const compiler = new PartCompiler({
      size: 1,
      createWorker: () => new FakeWorker(),
    });
    const failing = compiler.compile("x", () => "x");
    await flush();
    const worker = FakeWorker.all[0];
    worker.emit("message", {
      id: worker.received[0].id,
      error: { code: "REFERENCE_MISSING", message: "Unresolved dependency" },
    });
    await expect(failing).rejects.toMatchObject({ code: "REFERENCE_MISSING" });
    const pending = [
      compiler.compile("y", () => "y"),
      compiler.compile("z", () => "z"),
    ];
    await flush();
    worker.emit("error", new Event("error"));
    // The running and the queued job both go back to the caller (null).
    expect(await Promise.all(pending)).toEqual([null, null]);
    expect(await compiler.compile("w", () => "w")).toBeNull();
    expect(compiler.stats.mainThread).toBe(3);
    const none = new PartCompiler({ size: 2 });
    expect(await none.compile("q", () => "q")).toBeNull();
  });
});
