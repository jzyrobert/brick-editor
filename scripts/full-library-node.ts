// Node host for the complete official LDraw library pack: registers the built
// pack from disk (public/libraries/<releaseId>/), verified against the lock,
// so CLI imports resolve every official part without any network access.
import { existsSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import {
  fullLibraryLock,
  registerFullLibrary,
  registeredFullLibrary,
} from "../src/catalog/full-library";
import {
  type FullPackIndex,
  type FullPackManifest,
} from "../src/catalog/full-pack";
import { ensure } from "../src/core/types";

const hash = (b: Buffer) => createHash("sha256").update(b).digest("hex");
export const fullLibraryDir = (
  root = fileURLToPath(new URL("../public/", import.meta.url)),
) => `${root}libraries/${fullLibraryLock.releaseId}/`;

/** Registers the pack; returns false when it has not been built. Throws when
 * a present pack does not match its lock. */
export function registerFullLibraryFromDisk(dir = fullLibraryDir()) {
  if (registeredFullLibrary()) return true;
  if (!existsSync(dir + "manifest.json")) return false;
  const raw = readFileSync(dir + "manifest.json");
  ensure(
    hash(raw) === fullLibraryLock.manifestSha256,
    "INVALID_INPUT",
    "Full LDraw library manifest hash mismatch",
  );
  const manifest = JSON.parse(raw.toString()) as FullPackManifest;
  const index = readFileSync(dir + manifest.index.path);
  ensure(
    hash(index) === manifest.index.sha256,
    "INVALID_INPUT",
    "Full LDraw library index hash mismatch",
  );
  registerFullLibrary(manifest, JSON.parse(index.toString()) as FullPackIndex);
  return true;
}
