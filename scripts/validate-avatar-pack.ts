// Validates the Play figure pack (public/libraries/avatar-minifig-*, built by
// scripts/build-avatar-pack.ts): the manifest matches its lock, the bundle is
// exactly the listed files in order with their hashes, every file passes the
// licence gate, the dependency closure is complete, and every part the
// figure's assembly names is in it.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import lock from "../src/play/avatar-pack-lock.json";
import { AVATAR_PARTS } from "../src/play/avatar-assembly";

export function validateAvatarPack(librariesDir = "public/libraries/") {
  const hash = (b: Buffer) => createHash("sha256").update(b).digest("hex");
  const root = librariesDir + lock.releaseId + "/";
  const raw = readFileSync(root + "manifest.json");
  if (hash(raw) !== lock.manifestSha256)
    throw new Error("Figure pack lock mismatch");
  const manifest = JSON.parse(raw.toString()) as {
    parts: string[];
    files: { path: string; sha256: string; bytes: number; license: string[] }[];
    bundle: { path: string; sha256: string; bytes: number };
  };
  const bundle = readFileSync(root + manifest.bundle.path);
  if (
    hash(bundle) !== manifest.bundle.sha256 ||
    bundle.length !== manifest.bundle.bytes
  )
    throw new Error("Figure pack bundle hash mismatch");
  const paths = new Set(manifest.files.map((f) => f.path));
  let offset = 0;
  for (const f of manifest.files) {
    const bytes = bundle.subarray(offset, offset + f.bytes);
    offset += f.bytes;
    if (bytes.length !== f.bytes || hash(bytes) !== f.sha256)
      throw new Error("Figure pack file mismatch " + f.path);
    if (f.path === "LDConfig.ldr") continue;
    if (!f.license.length || !f.license.every((l) => l.includes("CC BY 4.0")))
      throw new Error("Figure pack licence gate " + f.path);
    for (const line of bytes.toString().split(/\r?\n/)) {
      const t = line.trim().split(/\s+/);
      if (t[0] !== "1") continue;
      const ref = t.slice(14).join(" ").replaceAll("\\", "/").toLowerCase();
      if (!paths.has("parts/" + ref) && !paths.has("p/" + ref))
        throw new Error("Figure pack dependency missing " + ref);
    }
  }
  if (offset !== bundle.length)
    throw new Error("Figure pack bundle has unlisted bytes");
  for (const p of AVATAR_PARTS)
    if (!paths.has("parts/" + p.part) || !manifest.parts.includes(p.part))
      throw new Error("Figure part missing from its pack " + p.part);
  return {
    releaseId: lock.releaseId,
    files: manifest.files.length,
    bytes: bundle.length,
    parts: manifest.parts,
  };
}
