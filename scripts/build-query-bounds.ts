import { readFileSync, writeFileSync } from "node:fs";
import { sourceBounds, sourceDependencies } from "../src/core/spatial";
import { libraryLock } from "../src/catalog/catalog";
const root = `public/libraries/${libraryLock.releaseId}/`;
const manifest = JSON.parse(readFileSync(root + "manifest.json", "utf8"));
const sources = Object.fromEntries(
  manifest.files
    .filter((f: { path: string }) => f.path !== "LDConfig.ldr")
    .map((f: { path: string }) => [
      f.path.replace(/^(parts|p)\//, ""),
      readFileSync(root + f.path, "utf8"),
    ]),
);
writeFileSync(
  "src/catalog/bounds.json",
  JSON.stringify(
    {
      manifestSha256: libraryLock.manifestSha256,
      dependencies: sourceDependencies(sources),
      bounds: Object.fromEntries(
        Object.keys(sources).map((ref) => [ref, sourceBounds(sources, ref)]),
      ),
    },
    null,
    2,
  ) + "\n",
);
