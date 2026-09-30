import { deepStrictEqual } from "node:assert";
import { sourceBounds, sourceDependencies } from "../src/core/spatial";
import installedBounds from "../src/catalog/bounds.json";
import { readFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import {
  catalog,
  libraryLock,
  mappingLock,
  retiredLibraryLocks,
  retiredMappingLocks,
  retiredFullLibraryLocks,
} from "../src/catalog/catalog";
import { fullLibraryLock } from "../src/catalog/full-library";
import { fullConnectorLock } from "../src/catalog/full-connectors";
import { validateFullConnectors } from "./validate-full-connectors";
import { validateFullTextures } from "./validate-full-textures";
import fullTexturesLock from "../src/catalog/full-textures-lock.json";
import mappings from "../src/catalog/mappings.json";
import { validateFullLibrary } from "./validate-full-library";
import { validateAvatarPack } from "./validate-avatar-pack";
import { validatePartThumbnails } from "./validate-part-thumbnails";
import { validateColorAvailability } from "./validate-color-availability";
import {
  connectorLock,
  connectorPackMatchesLibrary,
} from "../src/catalog/connectors";
const root = `public/libraries/${libraryLock.releaseId}/`,
  hash = (b: Buffer) => createHash("sha256").update(b).digest("hex"),
  raw = readFileSync(root + "manifest.json"),
  manifest = JSON.parse(raw.toString());
if (hash(raw) !== libraryLock.manifestSha256)
  throw new Error("Library lock mismatch");
if (hash(readFileSync(root + "LDConfig.ldr")) !== libraryLock.colorConfigSha256)
  throw new Error("Colour configuration lock mismatch");
const paths = new Set(manifest.files.map((f: any) => f.path));
const byPath = new Map<string, Buffer>();
for (const f of manifest.files) {
  const b = readFileSync(root + f.path);
  byPath.set(f.path, b);
  if (hash(b) !== f.sha256 || b.length !== f.bytes)
    throw new Error("Hash mismatch " + f.path);
  if (
    f.path !== "LDConfig.ldr" &&
    !f.license.every(
      (l: string) => l.includes("CC BY 4.0") || l.includes("Redistributable"),
    )
  )
    throw new Error("Licence gate " + f.path);
  for (const line of b.toString().split(/\r?\n/)) {
    const t = line.trim().split(/\s+/);
    if (t[0] === "1") {
      const ref = t.slice(14).join(" ").replaceAll("\\", "/").toLowerCase();
      if (!paths.has("parts/" + ref) && !paths.has("p/" + ref))
        throw new Error("Dependency missing " + ref);
    }
  }
}
// The single-request bundle must be exactly the listed files in order.
const bundle = readFileSync(root + manifest.bundle.path);
if (
  hash(bundle) !== manifest.bundle.sha256 ||
  bundle.length !== manifest.bundle.bytes ||
  !bundle.equals(
    Buffer.concat(manifest.files.map((f: any) => byPath.get(f.path)!)),
  )
)
  throw new Error("Library bundle does not match the manifest files");
// Every placeable part is a physical part file of this pack with its own hash.
for (const part of Object.values(catalog)) {
  const file = manifest.files.find((f: any) => f.path === "parts/" + part.id);
  if (!file || file.sha256 !== part.geometryHash)
    throw new Error("Catalogue geometry mismatch " + part.id);
  if (!manifest.parts.includes(part.id))
    throw new Error("Catalogue part missing from manifest " + part.id);
  if (!existsSync("public/" + part.thumbnail))
    throw new Error("Catalogue thumbnail missing " + part.id);
}
if (
  hash(readFileSync("src/catalog/mappings.json")) !==
  mappingLock.mappingPackSha256
)
  throw new Error("Mapping lock mismatch");
// The derived mapping table is pinned inside the locked mapping pack.
if (hash(readFileSync(mappings.derived.path)) !== mappings.derived.sha256)
  throw new Error("Derived mapping table does not match the mapping pack");
// The derived connector pack is locked and bound to this library release.
if (
  hash(readFileSync("src/catalog/connectors.json")) !==
    connectorLock.connectorPackSha256 ||
  !connectorPackMatchesLibrary
)
  throw new Error(
    "Connector pack lock mismatch; run npm run library:connectors",
  );
// Retired library locks stay satisfiable: the retired pack is still shipped
// unchanged and every one of its files is byte-identical in the current pack,
// so re-pinning such a project cannot change any definition it could resolve.
for (const lock of retiredLibraryLocks) {
  const oldRoot = `public/libraries/${lock.releaseId}/`,
    oldRaw = readFileSync(oldRoot + "manifest.json");
  if (hash(oldRaw) !== lock.manifestSha256)
    throw new Error("Retired library lock mismatch " + lock.releaseId);
  for (const f of JSON.parse(oldRaw.toString()).files) {
    const current = manifest.files.find((c: any) => c.path === f.path);
    if (
      !current ||
      current.sha256 !== f.sha256 ||
      hash(readFileSync(oldRoot + f.path)) !== f.sha256
    )
      throw new Error("Retired library file not preserved " + f.path);
  }
}
// Retired mapping packs: same item for every part they mapped.
for (const lock of retiredMappingLocks) {
  const file = `scripts/retired/mappings-${lock.mappingPackId}.json`,
    bytes = readFileSync(file);
  if (hash(bytes) !== lock.mappingPackSha256)
    throw new Error("Retired mapping lock mismatch " + lock.mappingPackId);
  for (const [key, rule] of Object.entries(
    JSON.parse(bytes.toString()).parts as Record<string, { itemId: string }>,
  ))
    if (
      (mappings.parts as Record<string, { itemId: string }>)[key]?.itemId !==
      rule.itemId
    )
      throw new Error("Retired mapping changed item " + key);
}
if (installedBounds.manifestSha256 !== libraryLock.manifestSha256)
  throw new Error("Bounds library lock mismatch");
const boundsSources = Object.fromEntries(
  manifest.files
    .filter((f: { path: string }) => f.path !== "LDConfig.ldr")
    .map((f: { path: string }) => [
      f.path.replace(/^(parts|p)\//, ""),
      readFileSync(root + f.path, "utf8"),
    ]),
);
deepStrictEqual(
  installedBounds.dependencies,
  JSON.parse(JSON.stringify(sourceDependencies(boundsSources))),
  "Stale source dependency metadata",
);
for (const ref of Object.keys(boundsSources))
  deepStrictEqual(
    installedBounds.bounds[ref as keyof typeof installedBounds.bounds],
    // JSON has no negative zero; compare what the build can store.
    JSON.parse(JSON.stringify(sourceBounds(boundsSources, ref))),
    "Stale source bounds: " + ref,
  );
// The complete official pack (on-demand parts beyond the curated catalogue).
const full = validateFullLibrary({
  root,
  files: manifest.files,
  colorConfigSha256: libraryLock.colorConfigSha256,
});
// Its derived connector pack (on-demand snapping, clash and health data).
const fullConnectors = validateFullConnectors({
  librariesDir: "public/libraries/",
  lock: fullConnectorLock,
  full: fullLibraryLock,
});
// Its texture pack (!TEXMAP images, loaded on demand like the geometry).
const fullTextures = validateFullTextures({
  librariesDir: "public/libraries/",
  lock: fullTexturesLock,
  full: fullLibraryLock,
});
// Retired complete-library locks record what changed since them.
for (const l of retiredFullLibraryLocks)
  if (l.releaseId === fullLibraryLock.releaseId)
    throw new Error(
      "A retired complete-library lock names the current release",
    );
// Sprite-sheet thumbnails of the complete library (hash-locked like the packs).
const partThumbnails = validatePartThumbnails();
// Colour availability (verified/derived part colours) and the palette.
const colorAvailability = validateColorAvailability();
// The Play figure's own pack of official minifig parts (not placeable).
const avatarPack = validateAvatarPack();
console.log(
  JSON.stringify(
    {
      valid: true,
      files: manifest.files.length,
      bytes: bundle.length,
      parts: manifest.parts.length,
      catalogue: Object.keys(catalog).length,
      manifestSha256: libraryLock.manifestSha256,
      mappingPackSha256: mappingLock.mappingPackSha256,
      retiredLibraryLocks: retiredLibraryLocks.map((l) => l.releaseId),
      retiredMappingLocks: retiredMappingLocks.map((l) => l.mappingPackId),
      full,
      fullConnectors,
      fullTextures,
      retiredFullLibraryLocks: retiredFullLibraryLocks.map((l) => l.releaseId),
      partThumbnails,
      colorAvailability,
      avatarPack,
    },
    null,
    2,
  ),
);
