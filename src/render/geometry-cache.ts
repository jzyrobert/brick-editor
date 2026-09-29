import { sha256 } from "../core/hash";

/**
 * Persistent cache of compiled part records (src/render/part-record.ts), so
 * reopening a model does not compile its parts again.
 *
 * - Keys name everything the geometry depends on (see `geometryCacheKey`).
 * - Every entry stores the SHA-256 of its bytes; a read whose bytes do not
 *   match is deleted and treated as a miss (corruption, partial writes).
 * - Bounded: least-recently-used entries are evicted past `maxBytes`.
 * - Best effort: any storage failure (quota, private mode, blocked or
 *   unavailable IndexedDB) degrades to compiling, never to an error.
 */
export type CacheMeta = { key: string; bytes: number; lastUsed: number };
export interface CacheStore {
  get(key: string): Promise<{ data: ArrayBuffer; sha256: string } | undefined>;
  put(meta: CacheMeta, data: ArrayBuffer, sha256: string): Promise<void>;
  touch(meta: CacheMeta): Promise<void>;
  delete(key: string): Promise<void>;
  /** Metadata of every entry (not the data). */
  entries(): Promise<CacheMeta[]>;
}

export function geometryCacheKey(parts: {
  compiler: string;
  library: string;
  fullLibrary: string;
  ref: string;
  context: string;
}) {
  return [
    parts.compiler,
    parts.library,
    parts.fullLibrary,
    parts.context,
    parts.ref.toLowerCase(),
  ].join("|");
}

const isQuota = (e: unknown) =>
  (e as { name?: string })?.name === "QuotaExceededError" ||
  /quota/i.test(String((e as { message?: string })?.message ?? e));

export class GeometryCache {
  /** In-memory LRU index (oldest first), loaded from the store once. */
  private index?: Promise<Map<string, CacheMeta>>;
  private total = 0;
  private broken = false;
  stats = {
    hits: 0,
    misses: 0,
    writes: 0,
    evictions: 0,
    corrupt: 0,
    errors: 0,
  };
  constructor(
    private readonly store: Promise<CacheStore | undefined>,
    public maxBytes: number,
    private readonly now: () => number = () => Date.now(),
    private readonly hash: (data: Uint8Array) => Promise<string> = sha256,
  ) {}
  get bytes() {
    return this.total;
  }
  private async ready() {
    if (this.broken) return undefined;
    const store = await this.store.catch(() => undefined);
    if (!store) {
      this.broken = true;
      return undefined;
    }
    this.index ??= store.entries().then((entries) => {
      const index = new Map<string, CacheMeta>();
      for (const meta of entries.sort((a, b) => a.lastUsed - b.lastUsed)) {
        index.set(meta.key, meta);
        this.total += meta.bytes;
      }
      return index;
    });
    try {
      return { store, index: await this.index };
    } catch {
      this.broken = true;
      return undefined;
    }
  }
  private fail() {
    this.stats.errors++;
  }
  async get(key: string): Promise<ArrayBuffer | undefined> {
    const open = await this.ready();
    if (!open) return undefined;
    const { store, index } = open;
    if (!index.has(key)) {
      this.stats.misses++;
      return undefined;
    }
    let entry: { data: ArrayBuffer; sha256: string } | undefined;
    try {
      entry = await store.get(key);
    } catch {
      this.fail();
      return undefined;
    }
    if (!entry) {
      this.forget(index, key);
      this.stats.misses++;
      return undefined;
    }
    if ((await this.hash(new Uint8Array(entry.data))) !== entry.sha256) {
      this.stats.corrupt++;
      this.forget(index, key);
      await store.delete(key).catch(() => this.fail());
      return undefined;
    }
    const meta = { ...index.get(key)!, lastUsed: this.now() };
    index.delete(key);
    index.set(key, meta);
    // Recency is advisory: never wait for (or fail on) its write.
    store.touch(meta).catch(() => this.fail());
    this.stats.hits++;
    return entry.data;
  }
  private forget(index: Map<string, CacheMeta>, key: string) {
    const meta = index.get(key);
    if (!meta) return;
    this.total -= meta.bytes;
    index.delete(key);
  }
  /** Evicts least recently used entries until `limit` bytes remain. */
  private async evict(
    store: CacheStore,
    index: Map<string, CacheMeta>,
    limit: number,
  ) {
    for (const key of [...index.keys()]) {
      if (this.total <= limit) break;
      this.forget(index, key);
      this.stats.evictions++;
      await store.delete(key).catch(() => this.fail());
    }
  }
  async put(key: string, data: ArrayBuffer) {
    const open = await this.ready();
    if (!open || data.byteLength > this.maxBytes / 4) return;
    const { store, index } = open;
    const digest = await this.hash(new Uint8Array(data));
    const meta = { key, bytes: data.byteLength, lastUsed: this.now() };
    this.forget(index, key);
    await this.evict(store, index, this.maxBytes - meta.bytes);
    for (let attempt = 0; attempt < 2; attempt++)
      try {
        await store.put(meta, data, digest);
        index.set(key, meta);
        this.total += meta.bytes;
        this.stats.writes++;
        return;
      } catch (e) {
        this.fail();
        if (!isQuota(e) || attempt) return;
        // Out of quota: make room (half of what is kept) and retry once.
        await this.evict(store, index, this.total / 2);
      }
  }
  /** Applies a new size bound (evicting at once when it shrank). */
  async setMaxBytes(maxBytes: number) {
    this.maxBytes = maxBytes;
    const open = await this.ready();
    if (open) await this.evict(open.store, open.index, maxBytes);
  }
}

/** In-memory store (tests, and a stand-in where IndexedDB is unavailable). */
export class MemoryStore implements CacheStore {
  data = new Map<
    string,
    { meta: CacheMeta; data: ArrayBuffer; sha256: string }
  >();
  async get(key: string) {
    const entry = this.data.get(key);
    return entry && { data: entry.data.slice(0), sha256: entry.sha256 };
  }
  async put(meta: CacheMeta, data: ArrayBuffer, sha256: string) {
    this.data.set(meta.key, { meta, data: data.slice(0), sha256 });
  }
  async touch(meta: CacheMeta) {
    const entry = this.data.get(meta.key);
    if (entry) entry.meta = meta;
  }
  async delete(key: string) {
    this.data.delete(key);
  }
  async entries() {
    return [...this.data.values()].map((e) => ({ ...e.meta }));
  }
}

const request = <T>(r: IDBRequest<T>) =>
  new Promise<T>((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
const done = (tx: IDBTransaction) =>
  new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error("Transaction aborted"));
  });

/**
 * IndexedDB store: small metadata records (for the LRU index) are kept apart
 * from the geometry bytes so loading the index never reads geometry.
 * Resolves undefined when IndexedDB is unavailable or cannot be opened.
 */
export async function openIndexedDbStore(
  name = "brick-editor-geometry",
): Promise<CacheStore | undefined> {
  if (typeof indexedDB === "undefined") return undefined;
  let db: IDBDatabase;
  try {
    const open = indexedDB.open(name, 1);
    open.onupgradeneeded = () => {
      open.result.createObjectStore("meta", { keyPath: "key" });
      open.result.createObjectStore("data");
    };
    db = await Promise.race([
      request(open),
      // A blocked or hung open (another tab mid-upgrade) must not stall loads.
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("IndexedDB open timed out")), 3000),
      ),
    ]);
  } catch {
    return undefined;
  }
  db.onversionchange = () => db.close();
  return {
    async get(key) {
      const tx = db.transaction("data", "readonly");
      const value = (await request(tx.objectStore("data").get(key))) as
        | { data: ArrayBuffer; sha256: string }
        | undefined;
      return value && value.data instanceof ArrayBuffer ? value : undefined;
    },
    async put(meta, data, sha256) {
      const tx = db.transaction(["meta", "data"], "readwrite");
      tx.objectStore("data").put({ data, sha256 }, meta.key);
      tx.objectStore("meta").put(meta);
      await done(tx);
    },
    async touch(meta) {
      const tx = db.transaction("meta", "readwrite");
      tx.objectStore("meta").put(meta);
      await done(tx);
    },
    async delete(key) {
      const tx = db.transaction(["meta", "data"], "readwrite");
      tx.objectStore("data").delete(key);
      tx.objectStore("meta").delete(key);
      await done(tx);
    },
    async entries() {
      const tx = db.transaction("meta", "readonly");
      return (await request(tx.objectStore("meta").getAll())) as CacheMeta[];
    },
  };
}
