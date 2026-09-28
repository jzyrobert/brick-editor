// Fails when the built site would exceed Cloudflare Pages limits: 20,000 files
// per deployment and 25 MiB per file. Run after `npm run build`.
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const MAX_FILES = 20000,
  MAX_BYTES = 25 * 1024 * 1024;
const files: { path: string; bytes: number }[] = [];
const walk = (dir: string) => {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, e.name);
    if (e.isDirectory()) walk(path);
    else files.push({ path, bytes: statSync(path).size });
  }
};
walk(process.argv[2] ?? "dist");
const largest = files.reduce((a, b) => (b.bytes > a.bytes ? b : a));
const total = files.reduce((n, f) => n + f.bytes, 0);
console.log(
  JSON.stringify({
    files: files.length,
    maxFiles: MAX_FILES,
    totalBytes: total,
    largest: largest.path,
    largestBytes: largest.bytes,
    maxFileBytes: MAX_BYTES,
  }),
);
if (files.length > MAX_FILES)
  throw new Error(`Deployment has ${files.length} files (limit ${MAX_FILES})`);
if (largest.bytes > MAX_BYTES)
  throw new Error(`${largest.path} is ${largest.bytes} bytes (limit 25 MiB)`);
