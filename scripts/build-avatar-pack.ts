// Maintainer-only: builds the Play figure pack from the official LDraw
// complete.zip that the complete-library pack was built from.
//
//   npx tsx scripts/build-avatar-pack.ts <complete.zip>
//
// The pack holds the unmodified official minifig part files the Play figure is
// assembled from (src/play/avatar-assembly.ts) plus their full transitive
// dependency closure, as one byte-exact bundle (every file's bytes concatenated
// in manifest order) and a manifest with each file's hash, size, source,
// licence and authors. It is not placeable (the parts are not catalogue
// entries); it only feeds the avatar. The archive must be the one pinned by the
// complete-library manifest, so the figure matches the library release.
// Writes public/libraries/<release>/{manifest.json,bundle.txt},
// public/notices/LDRAW-AVATAR.txt and src/play/avatar-pack-lock.json.
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { unzipSync } from "fflate";
import { fullLibraryLock } from "../src/catalog/full-library";
import { AVATAR_PARTS } from "../src/play/avatar-assembly";

const release = "avatar-minifig-2026-09-29";
const zipPath = process.argv[2];
if (!zipPath) throw new Error("Usage: build-avatar-pack.ts <complete.zip>");
const digest = (b: Uint8Array | string) =>
  createHash("sha256").update(b).digest("hex");
const zip = readFileSync(zipPath);
const full = JSON.parse(
  readFileSync(
    `public/libraries/${fullLibraryLock.releaseId}/manifest.json`,
    "utf8",
  ),
);
if (digest(zip) !== full.source.sha256)
  throw new Error("Archive is not the complete.zip pinned by the full library");
const entries = unzipSync(zip, {
  filter: (f) =>
    /^ldraw\/(parts|p)\/.+\.dat$/i.test(f.name) ||
    f.name === "ldraw/LDConfig.ldr",
});
const archive = new Map(
  Object.entries(entries).map(([name, bytes]) => [
    name.slice("ldraw/".length).toLowerCase(),
    bytes,
  ]),
);
/** Library search order (as scripts/fetch-library.py). */
const candidates = (ref: string) =>
  ref.startsWith("s/")
    ? ["parts/" + ref]
    : /^(8|48)\//.test(ref)
      ? ["p/" + ref]
      : /^\d/.test(ref) && !/^\d+-\d+/.test(ref)
        ? ["parts/" + ref, "p/" + ref]
        : ["p/" + ref, "parts/" + ref];
const seen = new Map<string, Uint8Array>();
const decode = (b: Uint8Array) => new TextDecoder().decode(b).replace(/^﻿/, "");
const pending = [...new Set(AVATAR_PARTS.map((p) => p.part))];
for (const root of pending)
  if (!archive.has("parts/" + root)) throw new Error("Not a part: " + root);
while (pending.length) {
  const ref = pending.pop()!;
  if (candidates(ref).some((c) => seen.has(c))) continue;
  const path = candidates(ref).find((c) => archive.has(c));
  if (!path) throw new Error("Missing from the official archive: " + ref);
  const bytes = archive.get(path)!;
  seen.set(path, bytes);
  for (const line of decode(bytes).split(/\r?\n/)) {
    const t = line.trim().split(/\s+/);
    if (t[0] === "1" && t.length >= 15)
      pending.push(t.slice(14).join(" ").replaceAll("\\", "/").toLowerCase());
  }
}
// The colour table first (as in the catalogue pack), then the closure.
seen.set("LDConfig.ldr", archive.get("ldconfig.ldr")!);
const files = [
  "LDConfig.ldr",
  ...[...seen.keys()].filter((p) => p !== "LDConfig.ldr").sort(),
].map((path) => {
  const bytes = seen.get(path)!,
    text = decode(bytes);
  if (path === "LDConfig.ldr")
    return {
      path,
      sha256: digest(bytes),
      bytes: bytes.length,
      source: "https://library.ldraw.org/library/official/LDConfig.ldr",
      license: [] as string[],
      authors: ["LDraw.org"],
    };
  const license = [...text.matchAll(/^0 !LICENSE (.+)$/gm)].map((m) =>
    m[1].trim(),
  );
  if (!license.length || !license.every((l) => l.includes("CC BY 4.0")))
    throw new Error("Licence gate " + path);
  const kind = /^0 !LDRAW_ORG (\S+)/m.exec(text)?.[1];
  if (!kind || kind.startsWith("Unofficial"))
    throw new Error("Not an official library file: " + path);
  if (/logo/i.test(path)) throw new Error("Brand logo primitive: " + path);
  return {
    path,
    sha256: digest(bytes),
    bytes: bytes.length,
    source: "https://library.ldraw.org/library/official/" + path,
    license,
    authors: [...text.matchAll(/^0 Author: (.+)$/gm)].map((m) => m[1].trim()),
  };
});
const bundle = Buffer.concat(files.map((f) => Buffer.from(seen.get(f.path)!)));
const dir = `public/libraries/${release}/`;
mkdirSync(dir, { recursive: true });
writeFileSync(dir + "bundle.txt", bundle);
const manifest = {
  format: "brick-editor-avatar-pack/1",
  releaseId: release,
  purpose:
    "Unmodified official LDraw minifig parts for the Play figure; not placeable catalogue parts.",
  retrievedFrom: `https://library.ldraw.org/library/updates/complete.zip (sha256 ${full.source.sha256}, latest update ${full.source.latestUpdate})`,
  license:
    "CC BY 4.0; every file keeps its own author and licence header (see public/notices/LDRAW-AVATAR.txt and LDRAW-CAreadme.txt)",
  parts: [...new Set(AVATAR_PARTS.map((p) => p.part))],
  files,
  bundle: {
    path: "bundle.txt",
    sha256: digest(bundle),
    bytes: bundle.length,
    layout: "Concatenation of every file's exact bytes in manifest order",
  },
};
const manifestText = JSON.stringify(manifest, null, 2) + "\n";
writeFileSync(dir + "manifest.json", manifestText);
writeFileSync(
  "src/play/avatar-pack-lock.json",
  JSON.stringify(
    { releaseId: release, manifestSha256: digest(manifestText) },
    null,
    2,
  ) + "\n",
);
writeFileSync(
  "public/notices/LDRAW-AVATAR.txt",
  `Play figure parts (${release}): unmodified official LDraw library files; originals retain author and licence headers.\nCC BY 4.0: https://creativecommons.org/licenses/by/4.0/\nLDraw.org Parts Library agreement: see LDRAW-CAreadme.txt\nSource: ${manifest.retrievedFrom}\nNo geometry modifications. The Play figure places these parts with the standard minifig assembly offsets and colours them; see the pack manifest for hashes.\n` +
    files
      .map(
        (f) => `${f.path}: ${f.authors.join("; ")} — ${f.license.join("; ")}`,
      )
      .join("\n") +
    "\n",
);
console.log(
  JSON.stringify({ release, files: files.length, bundleBytes: bundle.length }),
);
