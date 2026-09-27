import { describe, expect, it } from "vitest";
import { strFromU8, strToU8, zipSync } from "fflate";
import {
  LocalProjects,
  type StorageAdapter,
} from "../../src/persistence/storage";
import {
  boundedUnzip,
  decodeNative,
  encodeNative,
} from "../../src/persistence/native";
import { createProject } from "../../src/core/document";
import { sha256 } from "../../src/core/hash";
class Memory implements StorageAdapter {
  data = new Map<string, string>();
  get length() {
    return this.data.size;
  }
  key(i: number) {
    return [...this.data.keys()][i] ?? null;
  }
  getItem(key: string) {
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.data.set(key, value);
  }
  removeItem(key: string) {
    this.data.delete(key);
  }
}
describe("saved project namespace and revision regression", () => {
  it("lists recoverable projects, ignores corrupt/foreign keys, and deletes only the exact checked namespace", async () => {
    const memory = new Memory(),
      store = new LocalProjects(memory),
      a = createProject("Alpha"),
      b = createProject("Beta");
    a.id = "same:prefix/%";
    b.id = "same";
    await store.save(a, null);
    await store.save(b, null);
    memory.setItem("other-app:same:head", "keep");
    memory.setItem("brick-editor:%broken:head", "bad");
    memory.setItem("brick-editor:orphan:head", "missing");
    const rows = await store.list();
    expect(
      rows.map((x) => ({ id: x.id, title: x.title, revision: x.revision })),
    ).toEqual([
      { id: a.id, title: "Alpha", revision: 0 },
      { id: b.id, title: "Beta", revision: 0 },
    ]);
    expect(rows.every((x) => x.approximateBytes > 0)).toBe(true);
    const before = new Map(memory.data);
    await expect(store.delete(a.id, 9)).rejects.toThrow(/changed/);
    expect(memory.data).toEqual(before);
    await store.delete(a.id, 0);
    expect(await store.load(a.id)).toBeNull();
    expect(await store.load(b.id)).toEqual(b);
    expect(memory.getItem("other-app:same:head")).toBe("keep");
    await expect(store.delete(a.id, 0)).rejects.toThrow();
  });
  it("rejects invalid saved documents without changing the recoverable head and isolates a fork", async () => {
    const memory = new Memory(),
      store = new LocalProjects(memory),
      p = createProject("Original");
    await store.save(p, null);
    const before = new Map(memory.data),
      broken = structuredClone(p);
    broken.revision = 1;
    broken.rootModelId = "missing";
    await expect(store.save(broken, 0)).rejects.toThrow();
    expect(memory.data).toEqual(before);
    expect(await store.load(p.id)).toEqual(p);
    const fork = structuredClone(p);
    fork.id = "fork:" + p.id;
    fork.title = "Fork";
    fork.revision = 2;
    await store.save(fork, null);
    expect(await store.load(p.id)).toEqual(p);
    expect(await store.load(fork.id)).toEqual(fork);
    await store.delete(p.id, 0);
    expect(await store.load(fork.id)).toEqual(fork);
  });
  it("freezes the save argument before asynchronous checksum work", async () => {
    const memory = new Memory(),
      store = new LocalProjects(memory),
      p = createProject("Before");
    const promise = store.save(p, null);
    p.title = "After";
    p.revision = 20;
    await promise;
    expect((await store.load(p.id))?.title).toBe("Before");
    expect((await store.load(p.id))?.revision).toBe(0);
  });
});
describe("native source and asset manifest integrity", () => {
  async function original() {
    const p = createProject("Portable");
    p.assets["original/image"] = "data:image/png;base64,b3JpZ2luYWw=";
    const files = boundedUnzip(await encodeNative(p));
    return {
      p,
      files,
      manifest: JSON.parse(strFromU8(files["manifest.json"])),
    };
  }
  const pack = (files: Record<string, Uint8Array>, manifest: unknown) =>
    zipSync({ ...files, "manifest.json": strToU8(JSON.stringify(manifest)) });
  it("rejects removed source and asset entries even when remaining hashes are valid", async () => {
    const a = await original();
    delete a.files["sources/project.mpd"];
    delete a.manifest.entries["sources/project.mpd"];
    await expect(decodeNative(pack(a.files, a.manifest))).rejects.toThrow();
    const b = await original(),
      path = b.manifest.assetFiles["original/image"];
    delete b.files[path];
    delete b.manifest.entries[path];
    await expect(decodeNative(pack(b.files, b.manifest))).rejects.toThrow();
  });
  it("rejects source or asset substitution even when its entry hash is recomputed", async () => {
    const a = await original();
    a.files["sources/project.mpd"] = strToU8("0 Another model\n");
    a.manifest.entries["sources/project.mpd"] = await sha256(
      a.files["sources/project.mpd"],
    );
    await expect(decodeNative(pack(a.files, a.manifest))).rejects.toThrow(
      /source/,
    );
    const b = await original(),
      path = b.manifest.assetFiles["original/image"];
    b.files[path] = strToU8("different bytes");
    b.manifest.entries[path] = await sha256(b.files[path]);
    await expect(decodeNative(pack(b.files, b.manifest))).rejects.toThrow(
      /asset/,
    );
    const c = await original();
    c.manifest.assetFiles["original/image"] = "project.json";
    await expect(decodeNative(pack(c.files, c.manifest))).rejects.toThrow(
      /asset/,
    );
  });
  it("rejects lock mismatches and new-format checksum downgrades while retaining genuine legacy bundles", async () => {
    const a = await original();
    a.manifest.library.releaseId = "other-release";
    await expect(decodeNative(pack(a.files, a.manifest))).rejects.toThrow(
      /lock/,
    );
    const b = await original();
    b.manifest.entries = null;
    await expect(decodeNative(pack(b.files, b.manifest))).rejects.toThrow();
    const c = await original();
    const json = strFromU8(c.files["project.json"]);
    const legacy = {
      schemaVersion: 1,
      projectSha256: await sha256(json),
      library: c.p.library,
      mapping: c.p.marketplace.mappingPackId,
    };
    expect(
      await decodeNative(
        pack({ "project.json": c.files["project.json"] }, legacy),
      ),
    ).toEqual(c.p);
  });
});
it("rejects forged native preambles containing geometry, boundaries, or embedded lines", async () => {
  for (const preamble of [
    ["0 FILE unexpected.ldr"],
    ["1 4 0 0 0 1 0 0 0 1 0 0 0 1 3001.dat"],
    ["0 comment\n0 FILE injected.ldr"],
    ["0 comment\0injected"],
    "not an array",
  ]) {
    const p = createProject("Injected");
    p.metadata.preamble = preamble;
    const json = JSON.stringify(p),
      manifest = {
        schemaVersion: 1,
        projectSha256: await sha256(json),
        library: p.library,
        mapping: p.marketplace.mappingPackId,
      };
    await expect(
      decodeNative(
        zipSync({
          "project.json": strToU8(json),
          "manifest.json": strToU8(JSON.stringify(manifest)),
        }),
      ),
    ).rejects.toThrow(/preamble/);
    await expect(encodeNative(p)).rejects.toThrow(/preamble/);
  }
});
it("all checked-in LDraw fixtures satisfy preamble and source validation", async () => {
  const { readdir, readFile } = await import("node:fs/promises");
  const { importLDraw } = await import("../../src/ldraw/io");
  const { validateDocument } = await import("../../src/core/document");
  for (const file of await readdir("fixtures/ldraw"))
    if (file.endsWith(".mpd")) {
      const source = await readFile("fixtures/ldraw/" + file, "utf8");
      expect(() => validateDocument(importLDraw(source, file))).not.toThrow();
    }
});
