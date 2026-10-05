/** Derive reviewed source-closure identities from the pinned local library.
 * No network access or library mutation. */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { directReferences } from "../src/catalog/full-pack";
import {
  fullLibrarySources,
  registerFullLibraryFromDisk,
} from "./full-library-node";
const refs = [
  "86652.dat",
  "32019.dat",
  "87083.dat",
  "59426.dat",
  "32123a.dat",
  "48989.dat",
  "32184.dat",
  "59443.dat",
  "4519.dat",
];
if (!registerFullLibraryFromDisk())
  throw new Error("Pinned complete library unavailable");
const sources = fullLibrarySources(refs);
const hash = (s: string) => createHash("sha256").update(s).digest("hex");
const manifest: Record<
  string,
  { files: number; rootSha256: string; closureSha256: string }
> = {};
for (const root of refs) {
  const seen = new Set<string>(),
    pending = [root];
  while (pending.length) {
    const ref = pending.pop()!;
    if (seen.has(ref)) continue;
    if (!sources[ref] || seen.size >= 1024)
      throw new Error("Incomplete/budgeted source closure: " + ref);
    seen.add(ref);
    pending.push(...directReferences(sources[ref]));
  }
  manifest[root] = {
    files: seen.size,
    rootSha256: hash(sources[root]),
    closureSha256: hash(
      JSON.stringify([...seen].sort().map((ref) => [ref, hash(sources[ref])])),
    ),
  };
}
const text = JSON.stringify(manifest, null, 2) + "\n",
  path = "src/play/arocs-wheel-sources.json";
if (process.argv.includes("--check")) {
  if (readFileSync(path, "utf8") !== text)
    throw new Error("Arocs wheel source manifest changed");
} else writeFileSync(path, text);
