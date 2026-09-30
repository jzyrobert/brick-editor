// Ingests a new official LDraw complete.zip as a new complete-library release:
//
//   npm run library:update -- path/to/complete.zip [--release-id ldraw-full-YYYY-MM-DD]
//                             [--retrieved YYYY-MM-DD] [--keep-old] [--dry-run]
//
// 1. Pins the archive (sha256, size) in scripts/full-library.json under a new
//    release ID (default ldraw-full-<retrieved>); an unchanged archive is a no-op.
// 2. Builds the new complete pack (scripts/build-full-library.ts) next to the
//    current one, its derived connector/occupancy pack
//    (scripts/build-full-connectors.ts) and its texture pack (the !TEXMAP
//    images; scripts/build-full-textures.ts), and writes the three locks.
// 3. Retires the previous release: its lock is appended to
//    src/catalog/full-library-retired.json with `affected`, every file whose
//    bytes or dependency closure differ between the two releases. Projects
//    pinned to it are re-pinned on load (src/catalog/catalog.ts) with the old
//    lock kept in metadata.previousLocks, unless a part they use is affected;
//    those keep their pin and report the changed parts. The previous pack's
//    files are removed unless --keep-old (deployments have a file limit).
// 4. Rebuilds the mapping pack (scripts/build-parts.ts; its derived table
//    comes from the new release's part keywords, the previous pack is retired).
// 5. Checks that every curated catalogue file is byte-identical in the new
//    release (otherwise a catalogue release is needed first: see
//    docs/STATUS.md "Complete-library update path"), validates the libraries
//    (npm run library:validate) and checks the deployment file limits.
import {
  existsSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { gunzipSync } from "node:zlib";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildFullLibrary, type FullLibraryConfig } from "./build-full-library";
import {
  buildFullConnectors,
  connectorPackIdFor,
} from "./build-full-connectors";
import { buildFullTextures } from "./build-full-textures";
import { texturePackIdFor } from "../src/catalog/full-texture-pack";
import {
  chunkPath,
  directReferences,
  type FullPackIndex,
  type FullPackManifest,
} from "../src/catalog/full-pack";

const digest = (b: Uint8Array | string) =>
  createHash("sha256").update(b).digest("hex");

/** Above this many affected files, the retired lock records null (never
 * re-pinned automatically) instead of a list. */
export const MAX_AFFECTED = 5000;

/** Every file's sha256 and direct references in a built complete pack. */
export function packFiles(dir: string) {
  const manifest = JSON.parse(
    readFileSync(dir + "manifest.json", "utf8"),
  ) as FullPackManifest;
  const index = JSON.parse(
    readFileSync(dir + manifest.index.path, "utf8"),
  ) as FullPackIndex;
  const files = new Map<string, { sha: string; refs: string[] }>();
  for (const [sha, , names, lengths] of index.chunks) {
    const body = gunzipSync(readFileSync(dir + chunkPath(sha)));
    let offset = 0;
    names.forEach((name, i) => {
      const bytes = body.subarray(offset, offset + lengths[i]);
      offset += lengths[i];
      files.set(name, {
        sha: digest(bytes),
        refs: directReferences(bytes.toString()),
      });
    });
  }
  return files;
}

/**
 * Files whose meaning differs between two releases: changed or removed
 * files, and every file that reaches one through its references in either
 * release (unchanged bytes mean unchanged references, so an unaffected
 * file's closure is identical in both). Null when more than `max`.
 */
export function affectedFiles(
  before: Map<string, { sha: string; refs: string[] }>,
  after: Map<string, { sha: string; refs: string[] }>,
  max = MAX_AFFECTED,
): string[] | null {
  const users = new Map<string, Set<string>>();
  for (const files of [before, after])
    for (const [name, f] of files)
      for (const r of f.refs) {
        let set = users.get(r);
        if (!set) users.set(r, (set = new Set()));
        set.add(name);
      }
  const affected = new Set<string>();
  const queue: string[] = [];
  for (const [name, f] of before)
    if (after.get(name)?.sha !== f.sha) queue.push(name);
  while (queue.length) {
    const name = queue.pop()!;
    if (affected.has(name)) continue;
    affected.add(name);
    for (const u of users.get(name) ?? []) queue.push(u);
  }
  if (affected.size > max) return null;
  return [...affected].sort((a, b) =>
    a.localeCompare(b, "en", { numeric: true }),
  );
}

export type UpdatePaths = {
  /** public/libraries/ */
  librariesDir: string;
  /** scripts/full-library.json */
  configPath: string;
  /** src/catalog/full-library-lock.json */
  lockPath: string;
  /** src/catalog/full-connectors-lock.json */
  connectorLockPath: string;
  /** src/catalog/full-textures-lock.json */
  textureLockPath: string;
  /** src/catalog/full-library-retired.json */
  retiredPath: string;
};
export const DEFAULT_PATHS: UpdatePaths = {
  librariesDir: "public/libraries/",
  configPath: "scripts/full-library.json",
  lockPath: "src/catalog/full-library-lock.json",
  connectorLockPath: "src/catalog/full-connectors-lock.json",
  textureLockPath: "src/catalog/full-textures-lock.json",
  retiredPath: "src/catalog/full-library-retired.json",
};

/**
 * Steps 1–3 (packs, locks, retired lock). Returns what changed; the CLI then
 * rebuilds mappings and validates.
 */
export async function updateFullLibrary(options: {
  zipPath: string;
  releaseId?: string;
  retrieved?: string;
  keepOld?: boolean;
  workers?: number;
  paths?: UpdatePaths;
  log?: (line: string) => void;
}) {
  const paths = options.paths ?? DEFAULT_PATHS;
  const log = options.log ?? (() => {});
  const previous = JSON.parse(
    readFileSync(paths.configPath, "utf8"),
  ) as FullLibraryConfig;
  const previousLock = JSON.parse(readFileSync(paths.lockPath, "utf8")) as {
    releaseId: string;
    manifestSha256: string;
  };
  const archive = readFileSync(options.zipPath);
  const sha256 = digest(archive);
  if (sha256 === previous.archive.sha256)
    return { changed: false as const, releaseId: previous.releaseId };
  const retrieved = options.retrieved ?? new Date().toISOString().slice(0, 10);
  const releaseId = options.releaseId ?? "ldraw-full-" + retrieved;
  if (!/^ldraw-full-[\w.-]+$/.test(releaseId))
    throw new Error("Release IDs start with ldraw-full-: " + releaseId);
  const retired = existsSync(paths.retiredPath)
    ? (JSON.parse(readFileSync(paths.retiredPath, "utf8")) as {
        releaseId: string;
        manifestSha256: string;
        affected: string[] | null;
      }[])
    : [];
  if (
    releaseId === previous.releaseId ||
    retired.some((r) => r.releaseId === releaseId)
  )
    throw new Error(
      "Release ID already used: " + releaseId + " (pass --release-id)",
    );
  const config: FullLibraryConfig = {
    ...previous,
    releaseId,
    retrieved,
    archive: { ...previous.archive, sha256, bytes: archive.length },
  };
  log(`Building ${releaseId} from ${options.zipPath} (sha256 ${sha256})`);
  const built = buildFullLibrary({
    config,
    zipPath: options.zipPath,
    librariesDir: paths.librariesDir,
  });
  log("Deriving connectors and occupancy");
  const connectors = await buildFullConnectors({
    libraryDir: `${paths.librariesDir}${releaseId}/`,
    manifestSha256: built.lock.manifestSha256,
    outRoot: paths.librariesDir,
    workers: options.workers,
    log,
  });
  log("Packing textures");
  const textures = buildFullTextures({
    config,
    zipPath: options.zipPath,
    librariesDir: paths.librariesDir,
  });
  log("Comparing with " + previous.releaseId);
  const oldDir = `${paths.librariesDir}${previous.releaseId}/`;
  const affected = affectedFiles(
    packFiles(oldDir),
    packFiles(`${paths.librariesDir}${releaseId}/`),
  );
  const retiredLock = {
    releaseId: previousLock.releaseId,
    manifestSha256: previousLock.manifestSha256,
    affected,
  };
  writeFileSync(paths.configPath, JSON.stringify(config, null, 2) + "\n");
  writeFileSync(paths.lockPath, JSON.stringify(built.lock, null, 2) + "\n");
  writeFileSync(
    paths.connectorLockPath,
    JSON.stringify(connectors.lock, null, 2) + "\n",
  );
  writeFileSync(
    paths.textureLockPath,
    JSON.stringify(textures.lock, null, 2) + "\n",
  );
  writeFileSync(
    paths.retiredPath,
    JSON.stringify(
      [
        ...retired.filter((r) => r.releaseId !== retiredLock.releaseId),
        retiredLock,
      ],
      null,
      1,
    ) + "\n",
  );
  const removed: string[] = [];
  if (!options.keepOld)
    for (const dir of [
      previous.releaseId,
      connectorPackIdFor(previous.releaseId),
      texturePackIdFor(previous.releaseId),
    ])
      if (existsSync(paths.librariesDir + dir)) {
        rmSync(paths.librariesDir + dir, { recursive: true });
        removed.push(dir);
      }
  return {
    changed: true as const,
    releaseId,
    lock: built.lock,
    connectorLock: connectors.lock,
    textureLock: textures.lock,
    retired: retiredLock,
    summary: built.summary,
    coverage: connectors.manifest.coverage,
    removed,
  };
}

/** Curated catalogue files that differ in (or are missing from) a release. */
export function curatedDrift(curatedRoot: string, fullDir: string) {
  const curated = JSON.parse(
    readFileSync(curatedRoot + "manifest.json", "utf8"),
  ) as { files: { path: string; sha256: string }[] };
  const files = packFiles(fullDir);
  return curated.files
    .filter((f) => f.path !== "LDConfig.ldr")
    .filter(
      (f) => files.get(f.path.replace(/^(parts|p)\//, ""))?.sha !== f.sha256,
    )
    .map((f) => f.path);
}

/** Files and largest file under a directory (deployment limit estimate). */
export function deploySize(dir: string) {
  let files = 0,
    largest = 0;
  const walk = (d: string) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name);
      if (e.isDirectory()) walk(p);
      else {
        files++;
        largest = Math.max(largest, statSync(p).size);
      }
    }
  };
  walk(dir);
  return { files, largest };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const flag = (name: string) => {
    const i = args.indexOf("--" + name);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const zipPath = args.find(
    (a, i) => !a.startsWith("--") && !args[i - 1]?.startsWith("--"),
  );
  if (!zipPath)
    throw new Error(
      "Usage: npm run library:update -- path/to/complete.zip [--release-id ID] [--retrieved YYYY-MM-DD] [--keep-old]",
    );
  const result = await updateFullLibrary({
    zipPath,
    releaseId: flag("release-id"),
    retrieved: flag("retrieved"),
    keepOld: args.includes("--keep-old"),
    workers: flag("workers") ? Number(flag("workers")) : undefined,
    log: console.log,
  });
  if (!result.changed) {
    console.log(
      `Archive already pinned as ${result.releaseId}; nothing to do.`,
    );
    process.exit(0);
  }
  const data = JSON.parse(readFileSync("src/catalog/data.json", "utf8"));
  const drift = curatedDrift(
    `public/libraries/${data.libraryLock.releaseId}/`,
    `public/libraries/${result.releaseId}/`,
  );
  if (drift.length)
    throw new Error(
      `${drift.length} curated catalogue file(s) differ in ${result.releaseId} (${drift.slice(0, 5).join(", ")}…). Cut a new catalogue release first (fetch-library.py, build-parts.ts, library:bounds, library:connectors, thumbnails; docs/STATUS.md).`,
    );
  const run = (script: string, ...rest: string[]) =>
    execFileSync("npx", ["tsx", script, ...rest], { stdio: "inherit" });
  // Mapping pack: the derived table follows the new release's keywords.
  run("scripts/build-parts.ts");
  run("scripts/build-query-bounds.ts");
  run("scripts/build-connectors.ts");
  run("scripts/validate-library.ts");
  const size = deploySize("public");
  // The built app adds its own assets (well under 200 files) to public/.
  if (size.files + 200 > 20000 || size.largest > 25 * 1024 * 1024)
    throw new Error(
      `Deployment limits exceeded: ${size.files} public files, largest ${size.largest} bytes`,
    );
  console.log(
    JSON.stringify(
      {
        releaseId: result.releaseId,
        lock: result.lock,
        connectorLock: result.connectorLock,
        retired: {
          ...result.retired,
          affected:
            result.retired.affected === null
              ? null
              : result.retired.affected.length,
        },
        removed: result.removed,
        verified: result.coverage.verified,
        publicFiles: size.files,
      },
      null,
      2,
    ),
  );
  console.log(
    "Next: npm run templates -- --check, npm test, npm run build, npm run deploy:check; update docs/STATUS.md with the new release.",
  );
}
