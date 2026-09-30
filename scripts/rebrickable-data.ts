// Pinned Rebrickable database downloads (scripts/rebrickable-snapshot.json),
// shared by the colour-availability build and the mapping review worklist.
// The CSVs are not committed: each is read from .cache/rebrickable/<retrieved>/
// or downloaded again, and must match the sha256 pinned in the snapshot.
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";

export const SNAPSHOT = "scripts/rebrickable-snapshot.json";
export const AGENT = "Mozilla/5.0 (brick-editor colour availability build)";
export type Snapshot = {
  retrieved: string;
  source: string;
  license: string;
  files: Record<string, { url: string; sha256: string; bytes: number }>;
};
const hash = (b: Uint8Array | string) =>
  createHash("sha256").update(b).digest("hex");

export async function download(url: string) {
  const res = await fetch(url, { headers: { "User-Agent": AGENT } });
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return new Uint8Array(await res.arrayBuffer());
}

/** Verified text of one snapshot file: cache, else the same URL (which must
 * still serve identical bytes; otherwise take a new snapshot with
 * `npm run library:colors -- --refresh-rebrickable`). */
export async function snapshotFile(snapshot: Snapshot, name: string) {
  const f = snapshot.files[name];
  if (!f)
    throw new Error(
      `${name}.csv.gz is not in the Rebrickable snapshot of ${snapshot.retrieved}; take a new one with --refresh-rebrickable`,
    );
  const dir = `.cache/rebrickable/${snapshot.retrieved}/`;
  const path = dir + name + ".csv.gz";
  let bytes = existsSync(path) ? new Uint8Array(readFileSync(path)) : undefined;
  if (!bytes || hash(bytes) !== f.sha256) {
    bytes = await download(f.url);
    if (hash(bytes) !== f.sha256)
      throw new Error(
        `${name}.csv.gz no longer matches the pinned snapshot of ${snapshot.retrieved}; take a new one with --refresh-rebrickable`,
      );
    mkdirSync(dir, { recursive: true });
    writeFileSync(path, bytes);
  }
  return gunzipSync(bytes).toString("utf8");
}

export const readSnapshot = (): Snapshot =>
  JSON.parse(readFileSync(SNAPSHOT, "utf8"));

/** Minimal RFC 4180 CSV reader (quoted fields, doubled quotes). */
export function* csv(text: string) {
  let header: string[] | undefined;
  let row: string[] = [],
    field = "",
    quoted = false;
  for (let i = 0; i <= text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else field += ch;
      continue;
    }
    if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === undefined) {
      if (ch === undefined && !field && !row.length) break;
      row.push(field.replace(/\r$/, ""));
      field = "";
      if (!header) header = row;
      else
        yield Object.fromEntries(header.map((h, j) => [h, row[j]])) as Record<
          string,
          string
        >;
      row = [];
    } else field += ch;
  }
}
