import { deepStrictEqual } from "node:assert";
import { sourceBounds, sourceDependencies } from "../src/core/spatial";
import installedBounds from "../src/catalog/bounds.json";
import { readFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { libraryLock, mappingLock } from "../src/catalog/catalog";
const root = `public/libraries/${libraryLock.releaseId}/`,
  hash = (b: Buffer) => createHash("sha256").update(b).digest("hex"),
  raw = readFileSync(root + "manifest.json"),
  manifest = JSON.parse(raw.toString());
if (hash(raw) !== libraryLock.manifestSha256)
  throw new Error("Library lock mismatch");
const paths = new Set(manifest.files.map((f: any) => f.path));
for (const f of manifest.files) {
  const b = readFileSync(root + f.path);
  if (hash(b) !== f.sha256) throw new Error("Hash mismatch " + f.path);
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
if (
  hash(readFileSync("src/catalog/mappings.json")) !==
  mappingLock.mappingPackSha256
)
  throw new Error("Mapping lock mismatch");
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
    sourceBounds(boundsSources, ref),
    "Stale source bounds: " + ref,
  );
console.log(
  JSON.stringify(
    {
      valid: true,
      files: manifest.files.length,
      parts: manifest.parts.length,
      manifestSha256: libraryLock.manifestSha256,
      mappingPackSha256: mappingLock.mappingPackSha256,
    },
    null,
    2,
  ),
);
