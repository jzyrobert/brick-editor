import { zipSync, strToU8, strFromU8, Unzip, UnzipInflate } from "fflate";
import { type Project, ensure } from "../core/types";
import { canonical } from "../ldraw/path";
import { validate } from "../core/validate";
import { validateSourceDocument } from "../core/document";
import { sha256, stable } from "../core/hash";
import { exportLDraw } from "../ldraw/io";
import { resourceLimits, type ResourceLimits } from "../core/resource-profile";
export async function encodeNative(p: Project) {
  p = structuredClone(p);
  validate("project", p);
  validateSourceDocument(p);
  const json = JSON.stringify(p);
  const files: Record<string, Uint8Array> = {
    "project.json": strToU8(json),
    "sources/project.mpd": strToU8(exportLDraw(p)),
    "notices.txt": strToU8(
      "Official geometry is referenced by its pinned library lock. See distributed public/notices/LDRAW.txt. Imported sources and custom geometry are in sources/project.mpd. Original source records, notices and asset identifiers are retained in project.json. Asset files contain the exact source strings (including data URI encoding where supplied).\n",
    ),
  };
  const assetFiles: Record<string, string> = {};
  for (const [name, value] of Object.entries(p.assets)) {
    const path = "assets/" + (await sha256(name)) + ".txt";
    files[path] = strToU8(value);
    assetFiles[name] = path;
  }
  const entries: Record<string, string> = {};
  for (const [path, bytes] of Object.entries(files))
    entries[path] = await sha256(bytes);
  files["manifest.json"] = strToU8(
    JSON.stringify({
      schemaVersion: 1,
      projectSha256: await sha256(json),
      library: p.library,
      mapping: p.marketplace.mappingPackId,
      entries,
      assetFiles,
    }),
  );
  ensure(
    Object.values(files).reduce((sum, b) => sum + b.length, 0) <=
      100 * 1024 * 1024,
    "LIMIT_EXCEEDED",
    "Native bundle exceeds 100 MiB expanded budget",
  );
  const archive = zipSync(files);
  ensure(
    archive.length <= 25 * 1024 * 1024,
    "LIMIT_EXCEEDED",
    "Native bundle exceeds 25 MiB compressed budget",
  );
  return archive;
}
export function boundedUnzip(
  bytes: Uint8Array,
  limits: ResourceLimits = resourceLimits(),
) {
  ensure(
    bytes.length <= limits.importBytes,
    "LIMIT_EXCEEDED",
    `Archive exceeds ${limits.importBytes / 1024 / 1024} MiB`,
    { resource: "importBytes", limit: limits.importBytes },
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
      ensure(
        ++count <= limits.embeddedFiles,
        "LIMIT_EXCEEDED",
        "Too many archive entries",
      );
      const chunks: Uint8Array[] = [];
      let size = 0;
      file.ondata = (err, data, final) => {
        try {
          if (err) throw err;
          total += data.length;
          size += data.length;
          ensure(
            total <= limits.decompressedBytes,
            "LIMIT_EXCEEDED",
            `Decompressed archive exceeds ${limits.decompressedBytes / 1024 / 1024} MiB`,
            { resource: "decompressedBytes", limit: limits.decompressedBytes },
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
export async function decodeNative(
  bytes: Uint8Array,
  limits: ResourceLimits = resourceLimits(),
) {
  const files = boundedUnzip(bytes, limits);
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
  ensure(
    manifest.schemaVersion === 1,
    "INVALID_INPUT",
    "Unsupported native manifest version",
  );
  const packaged =
    Object.hasOwn(manifest, "entries") ||
    Object.hasOwn(manifest, "assetFiles") ||
    Object.keys(files).some(
      (path) => path.startsWith("sources/") || path.startsWith("assets/"),
    );
  if (packaged) {
    ensure(
      manifest.entries &&
        typeof manifest.entries === "object" &&
        !Array.isArray(manifest.entries),
      "INVALID_INPUT",
      "Invalid native manifest entries",
    );
    for (const [path, hash] of Object.entries(manifest.entries)) {
      ensure(
        files[path] &&
          typeof hash === "string" &&
          (await sha256(files[path])) === hash,
        "INVALID_INPUT",
        "Native entry checksum mismatch: " + path,
      );
    }
    ensure(
      Object.keys(files).every(
        (path) =>
          path === "manifest.json" || Object.hasOwn(manifest.entries, path),
      ),
      "INVALID_INPUT",
      "Native bundle contains an unlisted entry",
    );
  }
  if (!packaged)
    ensure(
      Object.keys(files).every((path) =>
        ["project.json", "manifest.json", "notices.txt"].includes(path),
      ),
      "INVALID_INPUT",
      "Unknown legacy native bundle entry",
    );
  const p = JSON.parse(json) as Project;
  validate("project", p);
  validateSourceDocument(p);
  ensure(
    stable(manifest.library) === stable(p.library) &&
      manifest.mapping === p.marketplace.mappingPackId,
    "INVALID_INPUT",
    "Native library or mapping lock mismatch",
  );
  if (packaged) {
    ensure(
      ["project.json", "sources/project.mpd", "notices.txt"].every((path) =>
        Object.hasOwn(manifest.entries, path),
      ),
      "INVALID_INPUT",
      "Native bundle is missing a required source or notices entry",
    );
    ensure(
      strFromU8(files["sources/project.mpd"]) === exportLDraw(p),
      "INVALID_INPUT",
      "Native source file differs from authoritative project",
    );
    ensure(
      manifest.assetFiles &&
        typeof manifest.assetFiles === "object" &&
        !Array.isArray(manifest.assetFiles) &&
        Object.keys(manifest.assetFiles).length ===
          Object.keys(p.assets).length,
      "INVALID_INPUT",
      "Native asset index mismatch",
    );
    for (const [name, value] of Object.entries(p.assets)) {
      const path = "assets/" + (await sha256(name)) + ".txt";
      ensure(
        manifest.assetFiles[name] === path &&
          files[path] &&
          strFromU8(files[path]) === value,
        "INVALID_INPUT",
        "Native embedded asset mismatch",
      );
    }
  }
  return p;
}
