/**
 * Format of the texture pack of the complete official LDraw library
 * (scripts/build-full-textures.ts): the `!TEXMAP` images (PNG) the official
 * archive ships in `parts/textures/`, stored unmodified and content addressed.
 *
 * Trust chain: the build pins manifest.json by sha256
 * (src/catalog/full-textures-lock.json); the manifest pins every image by the
 * sha256 of its bytes and names the complete pack it belongs to. It is a
 * separate pack so the complete pack's manifest, and every lock derived from
 * it (projects, connectors, thumbnails), is unchanged.
 */
import { parseTexmapCommand } from "../render/texmap";

export const FULL_TEXTURE_FORMAT = "brick-editor-ldraw-full-textures/1";

/** [sha256, bytes, width, height] of one PNG. */
export type FullTextureEntry = [string, number, number, number];
export type FullTextureManifest = {
  format: typeof FULL_TEXTURE_FORMAT;
  id: string;
  library: { releaseId: string; manifestSha256: string };
  source: { url: string; sha256: string };
  licence: string;
  counts: {
    textures: number;
    bytes: number;
    /** Decoded pixels of every image at full size. */
    pixels: number;
    /** Library files with `!TEXMAP` commands. */
    files: number;
    /** Top-level parts whose closure maps a texture. */
    parts: number;
  };
  /** Texture reference name (lower case, as `!TEXMAP` names it) → image. */
  textures: Record<string, FullTextureEntry>;
  /** Library file (reference name) → textures its own commands name. */
  files: Record<string, string[]>;
  /** Top-level part → textures its closure (texture-mapped references
   * included) maps. */
  parts: Record<string, string[]>;
  /** Textures a file names that the archive does not contain. */
  unresolved: { from: string; texture: string }[];
};

export const texturePackIdFor = (releaseId: string) => "textures-" + releaseId;
export const texturePath = (sha256: string) => `textures/${sha256}.png`;

/** Width and height from a PNG's IHDR chunk, or undefined if not a PNG. */
export function pngSize(bytes: Uint8Array): [number, number] | undefined {
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (bytes.length < 24 || signature.some((b, i) => bytes[i] !== b))
    return undefined;
  if (String.fromCharCode(...bytes.subarray(12, 16)) !== "IHDR")
    return undefined;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return [view.getUint32(16), view.getUint32(20)];
}

/** Texture names (images and gloss maps) a file's `!TEXMAP START|NEXT`
 * commands reference. */
export function texmapTextures(text: string): string[] {
  const out = new Set<string>();
  for (const m of text.matchAll(/^\s*0\s+!TEXMAP\s+(.+?)\s*$/gm)) {
    const command = parseTexmapCommand(m[1]);
    if (command && "texmap" in command) {
      out.add(command.texmap.texture);
      if (command.texmap.glossmap) out.add(command.texmap.glossmap);
    }
  }
  return [...out];
}
