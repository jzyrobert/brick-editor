import { zipSync, strToU8, strFromU8, Unzip, UnzipInflate } from "fflate";
import { type Project, ensure } from "../core/types";
import { canonical } from "../ldraw/path";
import { validate } from "../core/validate";
import { validateDocument } from "../core/document";
import { sha256 } from "../core/hash";
export async function encodeNative(p: Project) {
  const json = JSON.stringify(p);
  return zipSync({
    "project.json": strToU8(json),
    "manifest.json": strToU8(
      JSON.stringify({
        schemaVersion: 1,
        projectSha256: await sha256(json),
        library: p.library,
        mapping: p.marketplace.mappingPackId,
      }),
    ),
    "NOTICES.txt": strToU8(
      "Official geometry is referenced by its pinned library lock. See distributed public/notices/LDRAW.txt. User sources retain their original notices in project.json.\n",
    ),
  });
}
export function boundedUnzip(bytes: Uint8Array) {
  ensure(
    bytes.length <= 25 * 1024 * 1024,
    "LIMIT_EXCEEDED",
    "Archive exceeds 25 MiB",
  );
  const files: Record<string, Uint8Array> = Object.create(null);
  const names = new Set<string>();
  let total = 0,
    count = 0;
  let error: unknown;
  const unzip = new Unzip((file) => {
    try {
      const name = canonical(file.name);
      ensure(
        name === file.name.toLowerCase() && !names.has(name),
        "INVALID_INPUT",
        "Unsafe or duplicate archive path",
      );
      names.add(name);
      ensure(++count <= 10000, "LIMIT_EXCEEDED", "Too many archive entries");
      const chunks: Uint8Array[] = [];
      let size = 0;
      file.ondata = (err, data, final) => {
        try {
          if (err) throw err;
          total += data.length;
          size += data.length;
          ensure(
            total <= 100 * 1024 * 1024,
            "LIMIT_EXCEEDED",
            "Decompressed archive exceeds 100 MiB",
          );
          chunks.push(data);
          if (final) {
            const result = new Uint8Array(size);
            let offset = 0;
            for (const c of chunks) {
              result.set(c, offset);
              offset += c.length;
            }
            files[name] = result;
          }
        } catch (e) {
          error = e;
          file.terminate();
        }
      };
      file.start();
    } catch (e) {
      error = e;
    }
  });
  unzip.register(UnzipInflate);
  for (let i = 0; i < bytes.length; i += 16384) {
    unzip.push(bytes.subarray(i, i + 16384), i + 16384 >= bytes.length);
    if (error) throw error;
  }
  return files;
}
export async function decodeNative(bytes: Uint8Array) {
  const files = boundedUnzip(bytes);
  ensure(
    files["project.json"] && files["manifest.json"],
    "INVALID_INPUT",
    "Not a native project bundle",
  );
  const json = strFromU8(files["project.json"]);
  const manifest = JSON.parse(strFromU8(files["manifest.json"]));
  ensure(
    (await sha256(json)) === manifest.projectSha256,
    "INVALID_INPUT",
    "Native bundle checksum mismatch",
  );
  const p = JSON.parse(json) as Project;
  validate("project", p);
  validateDocument(p);
  return p;
}
