import { describe, expect, it } from "vitest";
import {
  GeometryCache,
  MemoryStore,
  geometryCacheKey,
  type CacheMeta,
} from "../../src/render/geometry-cache";

const bytes = (n: number, fill = 1) => new Uint8Array(n).fill(fill).buffer;
function cache(store = new MemoryStore(), maxBytes = 1000) {
  let t = 0;
  return {
    store,
    cache: new GeometryCache(Promise.resolve(store), maxBytes, () => ++t),
  };
}

describe("persistent geometry cache", () => {
  it("returns what was stored, keyed by every compile input", async () => {
    const { cache: c } = cache();
    const key = geometryCacheKey({
      compiler: "bpc2",
      library: "lib",
      fullLibrary: "full",
      ref: "3001.DAT",
      context: "ctx",
    });
    expect(key).toContain("3001.dat");
    expect(
      geometryCacheKey({
        compiler: "bpc3",
        library: "lib",
        fullLibrary: "full",
        ref: "3001.dat",
        context: "ctx",
      }),
    ).not.toBe(key);
    expect(await c.get(key)).toBeUndefined();
    await c.put(key, bytes(100, 7));
    const hit = await c.get(key);
    expect(new Uint8Array(hit!)).toEqual(new Uint8Array(bytes(100, 7)));
    expect(c.stats).toMatchObject({ hits: 1, misses: 1, writes: 1 });
    expect(c.bytes).toBe(100);
  });

  it("verifies each read against its hash and drops corrupt entries", async () => {
    const { cache: c, store } = cache();
    await c.put("a", bytes(64, 3));
    // Flip a byte behind the cache's back.
    const entry = store.data.get("a")!;
    new Uint8Array(entry.data)[10] = 99;
    expect(await c.get("a")).toBeUndefined();
    expect(c.stats.corrupt).toBe(1);
    expect(store.data.has("a")).toBe(false);
    expect(c.bytes).toBe(0);
  });

  it("evicts least recently used entries past its byte bound", async () => {
    const { cache: c, store } = cache(new MemoryStore(), 1000);
    await c.put("a", bytes(200));
    await c.put("b", bytes(200));
    await c.put("c", bytes(200));
    await c.put("d", bytes(200));
    // Reading "a" makes it the most recently used.
    expect(await c.get("a")).toBeDefined();
    await c.put("e", bytes(250));
    expect([...store.data.keys()].sort()).toEqual(["a", "c", "d", "e"]);
    expect(c.bytes).toBeLessThanOrEqual(1000);
    expect(c.stats.evictions).toBe(1);
    // Entries larger than a quarter of the bound are not cached at all.
    await c.put("huge", bytes(400));
    expect(store.data.has("huge")).toBe(false);
    // Shrinking the bound evicts at once.
    await c.setMaxBytes(500);
    expect(c.bytes).toBeLessThanOrEqual(500);
    expect(store.data.has("e")).toBe(true);
  });

  it("restores its LRU index from stored metadata", async () => {
    const store = new MemoryStore();
    const first = cache(store, 4000).cache;
    await first.put("old", bytes(400));
    await first.put("new", bytes(400));
    // A new session (page) reads the index back and evicts the oldest.
    const second = new GeometryCache(Promise.resolve(store), 1000, () => 1e9);
    await second.put("next", bytes(250));
    expect([...store.data.keys()].sort()).toEqual(["new", "next"]);
  });

  it("survives quota errors and unavailable storage without throwing", async () => {
    class QuotaStore extends MemoryStore {
      failures = 1;
      async put(meta: CacheMeta, data: ArrayBuffer, sha256: string) {
        if (this.failures-- > 0)
          throw Object.assign(new Error("full"), {
            name: "QuotaExceededError",
          });
        return super.put(meta, data, sha256);
      }
    }
    const quota = new QuotaStore();
    const { cache: c } = cache(quota, 1000);
    await c.put("a", bytes(100));
    await c.put("b", bytes(100));
    // The first write hit the quota: room is made and it is retried once.
    expect(quota.data.size).toBeGreaterThan(0);
    expect(c.stats.errors).toBe(1);

    class BrokenStore extends MemoryStore {
      async put(): Promise<void> {
        throw new Error("disk on fire");
      }
      async get(): Promise<undefined> {
        throw new Error("disk on fire");
      }
    }
    const broken = cache(new BrokenStore()).cache;
    await expect(broken.put("a", bytes(10))).resolves.toBeUndefined();
    await expect(broken.get("a")).resolves.toBeUndefined();

    const none = new GeometryCache(Promise.resolve(undefined), 1000);
    await none.put("a", bytes(10));
    expect(await none.get("a")).toBeUndefined();
    const rejected = new GeometryCache(Promise.reject(new Error("no")), 1000);
    expect(await rejected.get("a")).toBeUndefined();
  });
});
