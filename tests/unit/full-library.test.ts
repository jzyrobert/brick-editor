import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { importLDraw } from "../../src/ldraw/io";
import { occurrences } from "../../src/core/document";
import { modelHealth } from "../../src/core/health";
import { occurrenceBox } from "../../src/edit/stacking";
import { queryProject } from "../../src/automation/query";
import {
  adoptCurrentLocks,
  installedSource,
  projectLibraryLock,
} from "../../src/catalog/catalog";
import {
  fullLibraryLock,
  fullSource,
  registeredFullLibrary,
} from "../../src/catalog/full-library";
import { directReferences } from "../../src/catalog/full-pack";
import { partSpec } from "../../src/catalog/extended";
import { deriveDoorRigs, doorHinge } from "../../src/play/auto-doors";
import {
  fullLibraryDir,
  registerFullLibraryFromDisk,
} from "../../scripts/full-library-node";

const fixture = readFileSync("fixtures/ldraw/full-library.ldr", "utf8");
const outside = [
  "3861.dat",
  "60616b.dat",
  "86500.dat",
  "30367c.dat",
  "6079.dat",
  "32932.dat",
  "15254.dat",
  "3581.dat",
  "3582.dat",
];

describe("complete official library pack", () => {
  it("leaves parts outside the curated pack unresolved until the pack is registered", () => {
    expect(registeredFullLibrary()).toBeUndefined();
    expect(installedSource("86500.dat")).toBe(false);
    const p = importLDraw(fixture, "full-library.ldr");
    expect(occurrences(p).filter((o) => o.namespace === "missing").length).toBe(
      outside.length,
    );
  });

  it("resolves every official part from the built pack on disk, with bounds", () => {
    expect(registerFullLibraryFromDisk()).toBe(true);
    for (const ref of outside) expect(installedSource(ref), ref).toBe(true);
    // Subparts and primitives (including 48/ and 8/) are official too.
    expect(installedSource("s/3861cs01.dat")).toBe(
      registeredFullLibrary()!.where.has("s/3861cs01.dat"),
    );
    expect(installedSource("48/4-4cyli.dat")).toBe(true);
    expect(installedSource("box3#8p.dat")).toBe(true);
    expect(installedSource("not-a-part.dat")).toBe(false);
    const p = importLDraw(fixture, "full-library.ldr");
    expect(p.diagnostics.filter((d) => d.code === "REFERENCE_MISSING")).toEqual(
      [],
    );
    const all = occurrences(p);
    expect(all.every((o) => o.namespace === "official")).toBe(true);
    const health = modelHealth(p).checks.find(
      (c) => c.id === "missing-definitions",
    )!;
    expect(health.status).toBe("ok");
    for (const o of all) expect(occurrenceBox(p, o), o.node.ref).not.toBeNull();
    // The dome's box spans its 4 × 4 stud base (plus its rim).
    const dome = all.find((o) => o.node.ref === "86500.dat")!,
      box = occurrenceBox(p, dome)!;
    expect(box.max[0] - box.min[0]).toBeGreaterThanOrEqual(80);
    expect(box.max[0] - box.min[0]).toBeLessThan(100);
    // Spatial queries include the new parts.
    const q = queryProject(p, {
      bounds: {
        min: [550, -200, -100],
        max: [650, 100, 100],
        mode: "intersects",
      },
    });
    expect(q.occurrences.map((o) => o.node.ref)).toEqual(["86500.dat"]);
    expect(q.unresolvedReferences).toEqual([]);
    const whole = queryProject(p, { spatial: true });
    expect(whole.spatial!.complete).toBe(true);
    // A placement spec is derived with the curated catalogue's rules.
    const spec = partSpec("86500.dat")!;
    expect(spec).toMatchObject({ width: 80, depth: 80, extended: true });
    // Play's automatic doors see the complete-pack door leaves (3861 via its
    // moved-to alias 3861c, and 60616b) as official hinged doors.
    const doors = deriveDoorRigs(p, {
      all,
      reserved: new Set(),
      maxRigs: 32,
      maxGroups: 128,
    });
    const found = [
      ...doors.doors.map((d) => d.part),
      ...doors.skipped.map((d) => d.part),
    ];
    expect(found).toEqual(expect.arrayContaining(["3861", "60616b"]));
    expect(doorHinge("3861.dat")?.part).toBe("3861c");
  });

  it("records the complete pack in new and re-pinned project locks", () => {
    const p = importLDraw(fixture, "x.ldr");
    expect(p.library.full).toEqual(fullLibraryLock);
    const old = structuredClone(p);
    delete old.library.full;
    expect(adoptCurrentLocks(old)).toBe(true);
    expect(old.library).toEqual(projectLibraryLock);
    expect(old.library.connectorPackSha256).toBeTruthy();
    expect(old.metadata.previousLocks).toEqual([{ full: null }]);
    // Another complete pack keeps its pin.
    const other = structuredClone(p);
    other.library.full = { releaseId: "x", manifestSha256: "y" };
    expect(adoptCurrentLocks(other)).toBe(false);
  });
});

describe("browser loader", () => {
  const dir = fullLibraryDir();
  const served = (url: string) => {
    const path = new URL(url).pathname.replace(
      `/libraries/${fullLibraryLock.releaseId}/`,
      "",
    );
    return new Uint8Array(readFileSync(dir + path));
  };
  /** Minimal Cache Storage: one map shared by every open(). */
  const store = new Map<string, Uint8Array>();
  const cacheStorage = {
    open: async () => ({
      match: async (url: string) =>
        store.has(url) ? new Response(store.get(url)!) : undefined,
      put: async (url: string, res: Response) =>
        void store.set(url, new Uint8Array(await res.arrayBuffer())),
      delete: async (url: string) => store.delete(url),
    }),
  };
  let requests: string[] = [];
  beforeAll(() => {
    vi.stubGlobal("location", { href: "http://pack.test/" });
    vi.stubGlobal("caches", cacheStorage);
  });
  afterEach(() => vi.unstubAllGlobals());
  const online = (tamper?: (url: string, b: Uint8Array) => Uint8Array) => {
    vi.stubGlobal("location", { href: "http://pack.test/" });
    vi.stubGlobal("caches", cacheStorage);
    requests = [];
    vi.stubGlobal("fetch", async (url: string) => {
      requests.push(url);
      const b = served(url);
      return new Response((tamper ? tamper(url, b) : b) as BufferSource);
    });
  };
  const fresh = async () => {
    vi.resetModules();
    return {
      loader: await import("../../src/catalog/full-library-loader"),
      registry: await import("../../src/catalog/full-library"),
    };
  };

  it("fetches a model's parts and whole closure in one planned batch, verified and cached", async () => {
    store.clear();
    online();
    const { loader, registry } = await fresh();
    await loader.loadFullSources(outside);
    const index = registry.registeredFullLibrary()!.index;
    const planned = new Set(outside.flatMap((p) => index.parts[p][0]));
    // manifest + index + exactly the planned chunks.
    expect(requests.length).toBe(2 + planned.size);
    // The whole closure of every requested part is loaded or curated.
    const seen = new Set<string>();
    const visit = (name: string) => {
      if (seen.has(name) || registry.curatedHas(name)) return;
      seen.add(name);
      const text = registry.fullSource(name);
      expect(text, name).toBeTruthy();
      for (const ref of directReferences(text!)) visit(ref);
    };
    outside.forEach(visit);
    expect(seen.size).toBeGreaterThan(outside.length);
    // "~Moved to" redirect resolves through its target.
    expect(registry.fullSource("3861.dat")).toMatch(/3861c\.dat/);
    expect(registry.fullSource("3861c.dat")).toBeTruthy();
    expect(store.size).toBe(requests.length);
  });

  it("reloads offline from the cache and re-verifies cached bytes", async () => {
    vi.stubGlobal("location", { href: "http://pack.test/" });
    vi.stubGlobal("caches", cacheStorage);
    vi.stubGlobal("fetch", async () => {
      throw new TypeError("offline");
    });
    const { loader, registry } = await fresh();
    await loader.loadFullSources(outside);
    expect(registry.fullSource("86500.dat")).toBeTruthy();
    expect(loader.fullLibraryStats.requests).toBe(0);
    // A part never downloaded is reported as unavailable offline.
    await expect(loader.loadFullSources(["6108.dat"])).rejects.toThrow(
      /unavailable offline/,
    );
  });

  it("rejects tampered chunks and drops tampered cache entries", async () => {
    store.clear();
    const flip = (url: string, b: Uint8Array) => {
      if (!url.includes("/chunks/")) return b;
      const copy = b.slice();
      copy[copy.length - 9] ^= 1;
      return copy;
    };
    online(flip);
    let { loader, registry } = await fresh();
    await expect(loader.loadFullSources(["86500.dat"])).rejects.toThrow(
      /hash mismatch/,
    );
    expect(registry.fullSource("86500.dat")).toBeUndefined();
    // Refused definitions resolve as missing, not as half-loaded geometry.
    expect(registry.fullLibraryHas("86500.dat")).toBe(false);
    const project = importLDraw(fixture, "t.ldr");
    expect(await loader.prepareFullLibrary(project)).toMatch(/hash mismatch/);
    // A corrupted cache entry is discarded and fetched again.
    for (const [url, b] of store) store.set(url, flip(url, b));
    online();
    ({ loader, registry } = await fresh());
    await loader.loadFullSources(["86500.dat"]);
    expect(registry.fullSource("86500.dat")).toBeTruthy();
    expect(registry.fullLibraryHas("86500.dat")).toBe(true);
    // A tampered manifest never registers the index.
    store.clear();
    online((url, b) =>
      url.endsWith("manifest.json") ? new TextEncoder().encode(" ") : b,
    );
    ({ loader, registry } = await fresh());
    await expect(loader.loadFullLibraryIndex()).rejects.toThrow(
      /hash mismatch/,
    );
    expect(registry.registeredFullLibrary()).toBeUndefined();
  });
});

describe("complete-library search and import scan", () => {
  it("ranks official parts outside the catalogue and hides moved-to redirects", async () => {
    const { searchFullLibrary, displayTitle } = await import(
      "../../src/catalog/search"
    );
    const entries = JSON.parse(
      readFileSync(fullLibraryDir() + "catalog.json", "utf8"),
    );
    const hits = searchFullLibrary(entries, "86500");
    expect(hits[0][0]).toBe("86500.dat");
    expect(displayTitle(hits[0][1])).toBe("Dome 4 × 4 Smooth");
    const doors = searchFullLibrary(entries, "door 1x4x5");
    expect(doors.map((e) => e[0])).toContain("3861c.dat");
    expect(doors.map((e) => e[0])).not.toContain("3861.dat");
    const fences = searchFullLibrary(entries, "fence", {
      exclude: (id) => id === "6079.dat",
    });
    expect(fences.map((e) => e[0])).not.toContain("6079.dat");
  });
  it("only asks for the index when a source names a non-curated file", async () => {
    const { sourceNeedsFullLibrary } = await import(
      "../../src/catalog/full-library-loader"
    );
    const brick = "1 4 0 0 0 1 0 0 0 1 0 0 0 1 3001.dat";
    expect(sourceNeedsFullLibrary(brick)).toBe(false);
    expect(
      sourceNeedsFullLibrary(
        "0 FILE a.ldr\n1 4 0 0 0 1 0 0 0 1 0 0 0 1 room.ldr\n0 FILE room.ldr\n" +
          brick,
      ),
    ).toBe(false);
    expect(sourceNeedsFullLibrary(fixture)).toBe(true);
  });
});
