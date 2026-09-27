import { expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { unzipSync, strFromU8 } from "fflate";
import { exportProfile } from "../../src/ldraw/export-profiles";
import { importLDraw, exportLDraw } from "../../src/ldraw/io";
import { occurrences } from "../../src/core/document";
import { template } from "../../src/catalog/templates";
import { InventoryService } from "../../src/inventory/service";
import { sha256 } from "../../src/core/hash";
import { decodeNative } from "../../src/persistence/native";
const readAsset = async (path: string) =>
  new Uint8Array(await readFile("public/" + path));
const fixture = async () =>
  importLDraw(await readFile("fixtures/ldraw/scoped-materials.mpd", "utf8"));
const semantic = (p: ReturnType<typeof importLDraw>) =>
  occurrences(p)
    .map((o) =>
      JSON.stringify([o.node.ref, o.colorCode, o.transform, o.namespace]),
    )
    .sort();
it("standard defaults retain full source; visible, selection and submodel scopes preserve source context and affine world transforms", async () => {
  const p = await fixture(),
    all = occurrences(p);
  p.layers.hidden = {
    id: "hidden",
    name: "Hidden",
    visible: false,
    locked: false,
    order: 1,
  };
  p.layerAssignments[all[0].id] = "hidden";
  const full = await exportProfile(p, {
    profile: "standard",
    scope: { kind: "all" },
  });
  expect(strFromU8(full.bytes)).toBe(exportLDraw(p));
  const visible = await exportProfile(p, {
    profile: "standard",
    scope: { kind: "visible" },
  });
  expect(semantic(importLDraw(strFromU8(visible.bytes)))).toEqual(
    semantic(p).filter(
      (s) =>
        s !==
        JSON.stringify([
          all[0].node.ref,
          all[0].colorCode,
          all[0].transform,
          all[0].namespace,
        ]),
    ),
  );
  const single = await exportProfile(p, {
    profile: "standard",
    scope: { kind: "selection", occurrenceIds: [all[1].id] },
  });
  expect(
    occurrences(importLDraw(strFromU8(single.bytes)))[0].transform,
  ).toEqual(all[1].transform);
  expect(strFromU8(single.bytes)).toContain("0 BFC NOCLIP");
  const sub = await exportProfile(p, {
    profile: "standard",
    scope: {
      kind: "submodel",
      occurrenceId: JSON.stringify(all[0].path.slice(0, 1)),
    },
  });
  expect(sub.manifest.occurrenceCount).toBe(2);
});
it("per-layer MPDs reassemble exact world geometry across shared submodels, retaining custom closure and manifest hashes", async () => {
  const p = await fixture(),
    all = occurrences(p);
  p.layers.second = {
    id: "second",
    name: "../Roof / 2",
    visible: false,
    locked: true,
    order: 1,
  };
  p.layerAssignments[all[1].id] = "second";
  p.layerAssignments[all[2].id] = "second";
  const result = await exportProfile(p, {
      profile: "layers",
      scope: { kind: "all" },
      includeCompleteModel: true,
    }),
    files = unzipSync(result.bytes),
    combined: string[] = [];
  expect(result.manifest.layers).toHaveLength(2);
  for (const layer of result.manifest.layers) {
    expect(layer.file).not.toContain("/");
    expect(await sha256(files[layer.file])).toBe(layer.sha256);
    combined.push(...semantic(importLDraw(strFromU8(files[layer.file]))));
  }
  expect(combined.sort()).toEqual(semantic(p));
  expect(semantic(importLDraw(strFromU8(files["complete-model.mpd"])))).toEqual(
    semantic(p),
  );
  expect(JSON.parse(strFromU8(files["manifest.json"])).recentered).toBe(false);
});
it("portable custom closure omits unreferenced definitions and native backup retains full authoring data", async () => {
  const p = await fixture();
  p.assets["reference.txt"] = "original asset";
  const portable = await exportProfile(p, {
    profile: "portable",
    scope: { kind: "all" },
  });
  expect(strFromU8(portable.bytes)).toContain("0 FILE custom.dat");
  expect(strFromU8(portable.bytes)).not.toContain("0 FILE unused.ldr");
  expect(semantic(importLDraw(strFromU8(portable.bytes)))).toEqual(semantic(p));
  const native = await exportProfile(p, {
    profile: "native",
    scope: { kind: "all" },
  });
  expect(await decodeNative(native.bytes)).toEqual(p);
  await expect(
    exportProfile(p, { profile: "native", scope: { kind: "visible" } }),
  ).rejects.toThrow(/complete/);
});
it("portable official ZIP keeps purchasing identity and packages exact licensed dependency bytes at standard library paths", async () => {
  const p = template("wall"),
    result = await exportProfile(
      p,
      { profile: "portable", scope: { kind: "all" }, includeOfficial: true },
      { readAsset },
    ),
    files = unzipSync(result.bytes),
    restored = importLDraw(strFromU8(files["model.mpd"]));
  expect(result.name).toMatch(/portable.zip$/);
  expect(semantic(restored)).toEqual(semantic(p));
  expect(result.manifest.officialFiles.length).toBeGreaterThan(2);
  for (const [path, hash] of Object.entries(result.manifest.files))
    expect(await sha256(files[path])).toBe(hash);
  expect(Object.keys(result.manifest.files).length).toBe(
    Object.keys(files).length - 1,
  );
  for (const f of result.manifest.officialFiles) {
    expect(await sha256(files["ldraw/" + f.path])).toBe(f.sha256);
    expect(files["ldraw/" + f.path]).toEqual(
      await readAsset("libraries/" + p.library.releaseId + "/" + f.path),
    );
    expect(f.license.some((l) => l.includes("CC BY 4.0"))).toBe(true);
  }
  expect(Object.keys(files).some((k) => k.startsWith("ldraw/parts/s/"))).toBe(
    true,
  );
  expect(Object.keys(files).some((k) => k.startsWith("ldraw/p/"))).toBe(true);
  expect(strFromU8(files["ldraw/CAreadme.txt"])).toContain(
    "https://creativecommons.org/licenses/by/4.0/",
  );
  const inventory = async (project: typeof p) =>
    (
      await new InventoryService().preview(project, {
        expectedRevision: project.revision,
        format: "bricklink-wanted-xml",
        scope: { kind: "all" },
      })
    ).rows.map((r) => [r.itemId, r.colorId, r.quantity]);
  expect(await inventory(restored)).toEqual(await inventory(p));
  // Resolve every type-1 dependency using the same standard parts/p search paths.
  for (const bytes of [
    files["model.mpd"],
    ...Object.entries(files)
      .filter(([k]) => k.endsWith(".dat"))
      .map(([, v]) => v),
  ])
    for (const line of strFromU8(bytes).split(/\r?\n/)) {
      const match = line.trim().match(/^1\s+\S+(?:\s+\S+){12}\s+(.+)$/);
      if (match) {
        const ref = match[1].replaceAll("\\", "/").toLowerCase();
        expect(
          files["ldraw/parts/" + ref] || files["ldraw/p/" + ref],
        ).toBeDefined();
      }
    }
});
it("rejects unavailable or tampered official closure and supports cancellation without mutating source", async () => {
  const p = template("wall"),
    before = structuredClone(p);
  await expect(
    exportProfile(
      p,
      { profile: "portable", scope: { kind: "all" }, includeOfficial: true },
      {
        readAsset: async (path) =>
          path.endsWith(".dat") ? new Uint8Array([1, 2, 3]) : readAsset(path),
      },
    ),
  ).rejects.toThrow(/hash/);
  const controller = new AbortController();
  await expect(
    exportProfile(
      p,
      { profile: "portable", scope: { kind: "all" }, includeOfficial: true },
      {
        readAsset,
        signal: controller.signal,
        progress: () => controller.abort(),
      },
    ),
  ).rejects.toThrow(/cancelled/);
  expect(p).toEqual(before);
  const missing = importLDraw("1 4 0 0 0 1 0 0 0 1 0 0 0 1 unavailable.dat");
  await expect(
    exportProfile(
      missing,
      { profile: "portable", scope: { kind: "all" }, includeOfficial: true },
      { readAsset },
    ),
  ).rejects.toThrow(/lacks dependency/);
});
