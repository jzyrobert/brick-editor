import { describe, expect, it } from "vitest";
import { connectorStatus } from "../../src/catalog/connectors";
import { existsSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import {
  adoptCurrentLocks,
  connectorLock,
  projectLibraryLock,
  catalog,
  catalogCategoryOrder,
  libraryLock,
  mappingLock,
  retiredLibraryLocks,
  retiredMappingLocks,
} from "../../src/catalog/catalog";
import installedBounds from "../../src/catalog/bounds.json";
import mappings from "../../src/catalog/mappings.json";
import { defaultWorkplane, placementOnPlane } from "../../src/edit/workplane";
import { transformBounds } from "../../src/core/spatial";
import { importLDraw } from "../../src/ldraw/io";
import type { Vec3 } from "../../src/core/types";

const parts = Object.values(catalog);
const root = `public/libraries/${libraryLock.releaseId}/`;
const manifest = JSON.parse(readFileSync(root + "manifest.json", "utf8")) as {
  files: { path: string; sha256: string }[];
  parts: string[];
};
const sha = (b: Buffer) => createHash("sha256").update(b).digest("hex");

describe("placeable catalogue integrity", () => {
  it("offers a broad curated catalogue in every palette category", () => {
    expect(parts.length).toBeGreaterThanOrEqual(150);
    expect(parts.length).toBeLessThanOrEqual(300);
    for (const category of catalogCategoryOrder)
      expect(
        parts.some((p) => p.category === category),
        category,
      ).toBe(true);
    for (const p of parts) {
      expect(catalogCategoryOrder).toContain(p.category);
      for (const tag of p.tags ?? [])
        expect(catalogCategoryOrder).toContain(tag);
    }
  });
  it("pins every part's geometry, bounds and thumbnail to the library pack", () => {
    for (const p of parts) {
      const file = manifest.files.find((f) => f.path === "parts/" + p.id);
      expect(file?.sha256, p.id).toBe(p.geometryHash);
      expect(sha(readFileSync(root + "parts/" + p.id))).toBe(p.geometryHash);
      expect(manifest.parts).toContain(p.id);
      const box = (
        installedBounds.bounds as Record<
          string,
          { min: number[]; max: number[] } | null
        >
      )[p.id];
      expect(box, p.id).toBeTruthy();
      for (const i of [0, 1, 2]) {
        expect(p.bounds.min[i]).toBeCloseTo(box!.min[i], 2);
        expect(p.bounds.max[i]).toBeCloseTo(box!.max[i], 2);
      }
      // Thumbnails are small static WebP renderings of this pack.
      expect(p.thumbnail).toBe(
        `thumbnails/${libraryLock.releaseId}/${p.id.replace(/\.dat$/, "")}.webp`,
      );
      const image = readFileSync("public/" + p.thumbnail);
      expect(image.subarray(8, 12).toString(), p.id).toBe("WEBP");
      expect(image.length).toBeLessThan(12 * 1024);
    }
  });
  it("derives placement data from the real geometry", () => {
    for (const p of parts) {
      expect(p.width % 20, p.id).toBe(0);
      expect(p.depth % 20, p.id).toBe(0);
      expect(p.width).toBeGreaterThan(0);
      expect(p.depth).toBeGreaterThan(0);
      expect(p.height, p.id).toBeCloseTo(p.bounds.max[1], 3);
      expect(
        p.align.every((a) => a === 0 || a === 10),
        p.id,
      ).toBe(true);
      expect(p.studded).toBe(Math.abs(p.bounds.min[1] + 4) < 0.01);
      // snapVerified mirrors the connector pack's verification result.
      expect(p.snapVerified, p.id).toBe(connectorStatus(p.id).verified);
    }
    expect(catalog["3001.dat"]).toMatchObject({ height: 24, studded: true });
    expect(catalog["3024.dat"]).toMatchObject({ height: 8, studded: true });
    expect(catalog["3070b.dat"]).toMatchObject({ height: 8, studded: false });
    expect(catalog["3040b.dat"]).toMatchObject({ width: 20, depth: 40 });
    // Plain rectangular bricks and plates are the fill set (≤ 32 per height).
    const fillable = parts.filter((p) => p.fillable);
    expect(
      fillable.every((p) => /^(Brick|Plate) \d+ × \d+$/.test(p.name)),
    ).toBe(true);
    for (const h of new Set(fillable.map((p) => p.height)))
      expect(fillable.filter((p) => p.height === h).length).toBeLessThanOrEqual(
        32,
      );
  });
  it("puts every rectangular body on the stud grid in any quarter turn", () => {
    const wp = defaultWorkplane();
    for (const p of parts.filter((q) => q.fillable || q.category === "Slopes"))
      for (const angle of [0, 90, 180, 270]) {
        const t = placementOnPlane([13, 0, -27], wp, p.height, angle, p.align);
        const box = transformBounds(
          { min: p.bounds.min as Vec3, max: p.bounds.max as Vec3 },
          t,
        );
        // The side of the box without protrusions sits on a 20 LDU cell line.
        const onGrid = (a: number, b: number) =>
          [a, b].some((v) => Math.abs(v / 20 - Math.round(v / 20)) < 1e-6);
        expect(onGrid(box.min[0], box.max[0]), `${p.id} @${angle}`).toBe(true);
        expect(onGrid(box.min[2], box.max[2]), `${p.id} @${angle}`).toBe(true);
        // The lowest point rests on the workplane.
        expect(box.max[1]).toBeCloseTo(0, 6);
      }
  });
  it("records a reviewed marketplace mapping or an explicit reason for each part", () => {
    const mapped = mappings.parts as Record<
      string,
      { itemId: string; verifiedColors: string[]; source: string }
    >;
    const unmapped = mappings.unmapped as Record<string, string>;
    for (const p of parts) {
      const key = "official:" + p.id;
      const rule = mapped[key];
      expect(!!rule !== Object.hasOwn(unmapped, key), p.id).toBe(true);
      if (rule) {
        expect(rule.itemId).toMatch(/^[\w.-]+$/);
        expect(rule.source).toContain("bricklink.com");
        for (const c of rule.verifiedColors)
          expect(Object.keys(mappings.colors)).toContain(c);
      } else expect(unmapped[key].length).toBeGreaterThan(10);
    }
    // LDraw Trans-Brown is BrickLink Trans-Black; Trans-Clear is 12.
    expect(mappings.colors).toMatchObject({ "40": "13", "47": "12" });
    expect(sha(readFileSync("src/catalog/mappings.json"))).toBe(
      mappingLock.mappingPackSha256,
    );
  });
  it("re-pins projects from a retired lock and records the previous one", () => {
    expect(retiredLibraryLocks.map((l) => l.releaseId)).toContain(
      "starter-2026-09-27",
    );
    const p = importLDraw("0 FILE a.ldr\n1 4 0 0 0 1 0 0 0 1 0 0 0 1 3001.dat");
    p.library = { ...retiredLibraryLocks[0] };
    p.marketplace = { ...p.marketplace, ...retiredMappingLocks[0] };
    expect(adoptCurrentLocks(p)).toBe(true);
    expect(p.library).toEqual(projectLibraryLock);
    expect(p.library).toMatchObject(libraryLock);
    expect(p.marketplace.mappingPackSha256).toBe(mappingLock.mappingPackSha256);
    expect(p.metadata.previousLocks).toEqual([
      {
        library: retiredLibraryLocks[0],
        marketplace: retiredMappingLocks[0],
      },
    ]);
    expect(adoptCurrentLocks(p)).toBe(false);
    // An unknown lock is never substituted.
    const q = importLDraw("0 FILE b.ldr\n1 4 0 0 0 1 0 0 0 1 0 0 0 1 3001.dat");
    q.library = { ...libraryLock, manifestSha256: "0".repeat(64) };
    expect(adoptCurrentLocks(q)).toBe(false);
    expect(q.library.manifestSha256).toBe("0".repeat(64));
  });
  it("records the connector pack in new projects and migrates older ones", () => {
    const fresh = importLDraw(
      "0 FILE c.ldr\n1 4 0 0 0 1 0 0 0 1 0 0 0 1 3001.dat",
    );
    expect(fresh.library).toEqual({ ...libraryLock, ...connectorLock });
    expect(fresh.library.connectorPackSha256).toMatch(/^[0-9a-f]{64}$/);
    expect(adoptCurrentLocks(fresh)).toBe(false);
    // Saved before connector packs were recorded: the lock is added and the
    // missing value is kept in previousLocks.
    const old = importLDraw(
      "0 FILE d.ldr\n1 4 0 0 0 1 0 0 0 1 0 0 0 1 3001.dat",
    );
    old.library = { ...libraryLock };
    expect(adoptCurrentLocks(old)).toBe(true);
    expect(old.library).toEqual(projectLibraryLock);
    expect(old.metadata.previousLocks).toEqual([{ connector: null }]);
    // An earlier pack of the same library is re-pinned and recorded.
    const earlier = {
      connectorPackId: "ldraw-derived-studs-1",
      connectorPackSha256:
        "985cf6fe062bb1982ff9eae80e5215f48cbd3293398b76e292351dc75982bc11",
    };
    old.library = { ...libraryLock, ...earlier };
    expect(adoptCurrentLocks(old)).toBe(true);
    expect(old.library.connectorPackSha256).toBe(
      connectorLock.connectorPackSha256,
    );
    expect(old.metadata.previousLocks).toEqual([
      { connector: null },
      { connector: earlier },
    ]);
    // Another library's project keeps its own lock untouched.
    const other = importLDraw(
      "0 FILE e.ldr\n1 4 0 0 0 1 0 0 0 1 0 0 0 1 3001.dat",
    );
    other.library = { ...libraryLock, manifestSha256: "1".repeat(64) };
    expect(adoptCurrentLocks(other)).toBe(false);
    expect(other.library.connectorPackSha256).toBeUndefined();
  });
  it("ships the retired starter pack unchanged inside the current pack", () => {
    for (const lock of retiredLibraryLocks) {
      const dir = `public/libraries/${lock.releaseId}/`;
      const raw = readFileSync(dir + "manifest.json");
      expect(sha(raw)).toBe(lock.manifestSha256);
      for (const f of JSON.parse(raw.toString()).files as {
        path: string;
        sha256: string;
      }[]) {
        expect(existsSync(root + f.path), f.path).toBe(true);
        expect(sha(readFileSync(root + f.path))).toBe(f.sha256);
      }
    }
  });
});
