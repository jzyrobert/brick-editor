import { deflateSync, Inflate, strToU8, strFromU8 } from "fflate";
import { ensure, type Project } from "../core/types";
import { sha256 } from "../core/hash";
import { exportLDraw, importLDraw } from "../ldraw/io";
import { libraryLock } from "../catalog/catalog";
export const SHARE_LIMITS = {
  soft: 8192,
  hard: 32768,
  decompressed: 4 * 1024 * 1024,
};
function base64url(bytes: Uint8Array) {
  let text = "";
  for (const b of bytes) text += String.fromCharCode(b);
  return btoa(text).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
export async function createShare(project: Project, base: string) {
  ensure(
    Object.keys(project.assets).length === 0,
    "INVALID_INPUT",
    "This project has separate embedded assets. Download a native file to preserve them.",
  );
  const source = exportLDraw(project),
    bytes = strToU8(source);
  ensure(
    bytes.length <= SHARE_LIMITS.decompressed,
    "LIMIT_EXCEEDED",
    "This model is too large for a share link. Download a portable file instead.",
  );
  const url = new URL(base);
  ensure(
    ["http:", "https:"].includes(url.protocol),
    "INVALID_INPUT",
    "Share links require an HTTP(S) application URL",
  );
  url.search = "";
  url.hash = new URLSearchParams({
    v: "1",
    codec: "deflate",
    format: "mpd",
    library: project.library.releaseId,
    libraryHash: project.library.manifestSha256,
    sha256: await sha256(bytes),
    data: base64url(deflateSync(bytes, { level: 9 })),
  }).toString();
  const value = url.toString(),
    length = strToU8(value).length;
  ensure(
    length <= SHARE_LIMITS.hard,
    "LIMIT_EXCEEDED",
    "The generated link exceeds 32 KiB. Download a portable file instead.",
  );
  return {
    url: value,
    bytes: length,
    warning:
      length > SHARE_LIMITS.soft
        ? "This link exceeds 8 KiB and may not work in every messaging app."
        : undefined,
    includes:
      "LDraw model, embedded custom geometry, source metadata and library version. Editor layers, bookmarks, inventory overrides, history and local storage are not included.",
  };
}
export async function previewShare(fragment: string) {
  ensure(
    fragment.length <= SHARE_LIMITS.hard,
    "LIMIT_EXCEEDED",
    "Share fragment exceeds 32 KiB",
  );
  const params = new URLSearchParams(fragment.replace(/^#/, "")),
    allowed = [
      "v",
      "codec",
      "format",
      "library",
      "libraryHash",
      "sha256",
      "data",
    ];
  ensure(
    [...params.keys()].length === allowed.length &&
      allowed.every((k) => params.getAll(k).length === 1),
    "INVALID_INPUT",
    "Invalid share envelope",
  );
  ensure(
    params.get("v") === "1" &&
      params.get("codec") === "deflate" &&
      params.get("format") === "mpd",
    "INVALID_INPUT",
    "Unsupported share version or codec",
  );
  ensure(
    params.get("library") === libraryLock.releaseId &&
      params.get("libraryHash") === libraryLock.manifestSha256,
    "REFERENCE_MISSING",
    "This link requires an unavailable library version",
  );
  const payload = params.get("data")!;
  ensure(
    /^[a-zA-Z0-9_-]+$/.test(payload) && payload.length % 4 !== 1,
    "INVALID_INPUT",
    "Invalid share encoding",
  );
  const compressed = Uint8Array.from(
    atob(payload.replace(/-/g, "+").replace(/_/g, "/")),
    (c) => c.charCodeAt(0),
  );
  const chunks: Uint8Array[] = [];
  let size = 0;
  const inflater = new Inflate((data) => {
    size += data.length;
    ensure(
      size <= SHARE_LIMITS.decompressed,
      "LIMIT_EXCEEDED",
      "Shared model expands beyond 4 MiB",
    );
    chunks.push(data);
  });
  for (let i = 0; i < compressed.length; i += 256)
    inflater.push(
      compressed.subarray(i, i + 256),
      i + 256 >= compressed.length,
    );
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  ensure(
    (await sha256(bytes)) === params.get("sha256"),
    "INVALID_INPUT",
    "Share checksum mismatch",
  );
  const project = importLDraw(strFromU8(bytes), "Shared model");
  return { project, sourceBytes: size };
}
