// The complete-library update path (scripts/library-update.ts) on a
// synthetic pair of official archives: a new release ID, new complete and
// connector packs with their locks, the previous release retired with the
// files a change affects, and re-pinning decided by those files.
import { describe, expect, it } from "vitest";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { strToU8, zipSync } from "fflate";
import {
  buildFullLibrary,
  type FullLibraryConfig,
} from "../../scripts/build-full-library";
import {
  affectedFiles,
  packFiles,
  updateFullLibrary,
  type UpdatePaths,
} from "../../scripts/library-update";
import { validateFullConnectors } from "../../scripts/validate-full-connectors";
import { buildFullConnectors } from "../../scripts/build-full-connectors";
import { fullLockUnaffected } from "../../src/catalog/catalog";
import { importLDraw } from "../../src/ldraw/io";

const header = (name: string, title: string, kind = "Part") =>
  `0 ${title}\n0 Name: ${name}\n0 Author: Test Author\n0 !LDRAW_ORG ${kind} UPDATE 2026-01\n0 !LICENSE Licensed under CC BY 4.0 : see CAreadme.txt\n\n0 BFC CERTIFY CCW\n`;
/** A box of 20 × 24 × 20 LDU (one 1 × 1 brick body) as quads. */
const box = (x0: number, x1: number) =>
  [
    `4 16 ${x0} 0 -10 ${x1} 0 -10 ${x1} 0 10 ${x0} 0 10`,
    `4 16 ${x0} 24 10 ${x1} 24 10 ${x1} 24 -10 ${x0} 24 -10`,
    `4 16 ${x0} 0 -10 ${x0} 24 -10 ${x1} 24 -10 ${x1} 0 -10`,
    `4 16 ${x1} 0 10 ${x1} 24 10 ${x0} 24 10 ${x0} 0 10`,
  ].join("\n") + "\n";
function archive(variant: "a" | "b") {
  const files: Record<string, string> = {
    "ldraw/LDConfig.ldr": "0 LDraw.org Configuration File\n",
    "ldraw/CAreadme.txt": "Synthetic CA readme\n",
    "ldraw/CAlicense4.txt": "Synthetic CC BY 4.0\n",
    "ldraw/CAlicense.txt": "Synthetic CC BY 2.0\n",
    "ldraw/p/stud.dat":
      header("stud.dat", "Stud", "Primitive") + "3 16 0 -4 0 6 -4 0 0 -4 6\n",
    "ldraw/parts/9001.dat":
      header("9001.dat", "Brick  1 x  1 Test") +
      box(-10, 10) +
      "1 16 0 0 0 1 0 0 0 1 0 0 0 1 stud.dat\n",
    "ldraw/parts/9002.dat":
      header("9002.dat", "Brick  1 x  2 Test") +
      "1 16 0 0 0 1 0 0 0 1 0 0 0 1 s/9002s01.dat\n",
    "ldraw/parts/s/9002s01.dat":
      header("s\\9002s01.dat", "~Brick  1 x  2 Test Body", "Subpart") +
      box(-20, variant === "a" ? 20 : 22),
    "ldraw/parts/9003.dat":
      header("9003.dat", "Plate  1 x  1 Test") + box(-10, 10),
  };
  if (variant === "b")
    files["ldraw/parts/9004.dat"] =
      header("9004.dat", "Tile  1 x  1 Test") + box(-10, 10);
  return zipSync(
    Object.fromEntries(Object.entries(files).map(([k, v]) => [k, strToU8(v)])),
  );
}
const sha = (b: Uint8Array) => createHash("sha256").update(b).digest("hex");

describe("complete-library update path", () => {
  const root = mkdtempSync(join(tmpdir(), "brick-update-"));
  const paths: UpdatePaths = {
    librariesDir: root + "/libraries/",
    configPath: root + "/full-library.json",
    lockPath: root + "/full-library-lock.json",
    connectorLockPath: root + "/full-connectors-lock.json",
    retiredPath: root + "/full-library-retired.json",
  };
  mkdirSync(paths.librariesDir, { recursive: true });
  const zipA = root + "/a.zip",
    zipB = root + "/b.zip";
  writeFileSync(zipA, archive("a"));
  writeFileSync(zipB, archive("b"));
  const configA: FullLibraryConfig = {
    releaseId: "ldraw-full-2026-01-01",
    retrieved: "2026-01-01",
    archive: {
      url: "https://library.ldraw.org/library/updates/complete.zip",
      sha256: sha(readFileSync(zipA)),
      bytes: readFileSync(zipA).length,
    },
    chunkTargetBytes: 4096,
    primitiveChunkTargetBytes: 4096,
  };
  const first = buildFullLibrary({
    config: configA,
    zipPath: zipA,
    librariesDir: paths.librariesDir,
  });
  writeFileSync(paths.configPath, JSON.stringify(configA));
  writeFileSync(paths.lockPath, JSON.stringify(first.lock));

  it("builds a new release, its connector pack and locks, and retires the old one", async () => {
    // The current release has its connector pack, as in the app.
    const before = await buildFullConnectors({
      libraryDir: `${paths.librariesDir}${configA.releaseId}/`,
      manifestSha256: first.lock.manifestSha256,
      outRoot: paths.librariesDir,
      workers: 0,
    });
    expect(before.manifest.coverage.parts).toBe(3);
    const r = await updateFullLibrary({
      zipPath: zipB,
      retrieved: "2026-02-01",
      workers: 0,
      paths,
    });
    if (!r.changed) throw new Error("expected a change");
    expect(r.releaseId).toBe("ldraw-full-2026-02-01");
    // Locks and pinned archive now name the new release.
    const config = JSON.parse(readFileSync(paths.configPath, "utf8"));
    expect(config).toMatchObject({
      releaseId: r.releaseId,
      archive: { sha256: sha(readFileSync(zipB)) },
    });
    const lock = JSON.parse(readFileSync(paths.lockPath, "utf8"));
    expect(lock).toEqual(r.lock);
    expect(
      sha(readFileSync(`${paths.librariesDir}${r.releaseId}/manifest.json`)),
    ).toBe(lock.manifestSha256);
    // The connector pack is derived from, and bound to, the new release.
    const connectorLock = JSON.parse(
      readFileSync(paths.connectorLockPath, "utf8"),
    );
    expect(connectorLock.connectorPackId).toBe("connectors-" + r.releaseId);
    const v = validateFullConnectors({
      librariesDir: paths.librariesDir,
      lock: connectorLock,
      full: lock,
      samples: ["9001.dat", "9004.dat"],
    });
    expect(v.parts).toBe(4);
    // The old release is a retired lock naming exactly what changed: the
    // edited subpart and the part using it; the new part is not "affected"
    // (nothing pinned to the old release can use it).
    const retired = JSON.parse(readFileSync(paths.retiredPath, "utf8"));
    expect(retired).toEqual([
      {
        releaseId: "ldraw-full-2026-01-01",
        manifestSha256: first.lock.manifestSha256,
        affected: ["9002.dat", "s/9002s01.dat"],
      },
    ]);
    // Its files are removed by default (deployment file limit).
    expect(r.removed).toEqual([
      "ldraw-full-2026-01-01",
      "connectors-ldraw-full-2026-01-01",
    ]);
    expect(existsSync(paths.librariesDir + "ldraw-full-2026-01-01")).toBe(
      false,
    );
    // A project using only unaffected parts is re-pinned; one using the
    // changed part keeps its pin.
    const uses = (ref: string) =>
      importLDraw(`0 FILE t.ldr\n1 4 0 0 0 1 0 0 0 1 0 0 0 1 ${ref}\n`);
    expect(fullLockUnaffected(uses("9001.dat"), retired[0].affected)).toBe(
      true,
    );
    expect(fullLockUnaffected(uses("9002.dat"), retired[0].affected)).toBe(
      false,
    );
    expect(fullLockUnaffected(uses("9001.dat"), null)).toBe(false);
  }, 60000);

  it("treats the same archive again as a no-op and refuses a reused release ID", async () => {
    const same = await updateFullLibrary({
      zipPath: zipB,
      workers: 0,
      paths,
    });
    expect(same.changed).toBe(false);
    await expect(
      updateFullLibrary({
        zipPath: zipA,
        releaseId: "ldraw-full-2026-01-01",
        workers: 0,
        paths,
      }),
    ).rejects.toThrow(/already used/);
  });

  it("propagates a change through every file that reaches it", () => {
    const f = (sha: string, refs: string[] = []) => ({ sha, refs });
    const before = new Map([
      ["stud.dat", f("1")],
      ["a.dat", f("2", ["stud.dat"])],
      ["b.dat", f("3", ["s/b.dat"])],
      ["s/b.dat", f("4")],
    ]);
    const after = new Map([
      ["stud.dat", f("1b")],
      ["a.dat", f("2", ["stud.dat"])],
      ["b.dat", f("3", ["s/b.dat"])],
      ["s/b.dat", f("4")],
    ]);
    expect(affectedFiles(before, after)).toEqual(["a.dat", "stud.dat"]);
    expect(affectedFiles(before, after, 1)).toBeNull();
    // Removing a file affects its users too.
    const removed = new Map(before);
    removed.delete("s/b.dat");
    expect(affectedFiles(before, removed)).toEqual(["b.dat", "s/b.dat"]);
    expect(packFiles).toBeTypeOf("function");
  });
});
