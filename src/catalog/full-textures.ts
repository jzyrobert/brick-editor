/**
 * Browser loader for the texture pack of the complete official library
 * (full-texture-pack.ts). Images are fetched only when a textured part is
 * drawn, verified against the hash chain rooted in the build's lock (lock →
 * manifest → image), and kept in the complete pack's Cache Storage cache, so
 * a textured part that rendered once keeps its texture offline.
 */
import lock from "./full-textures-lock.json";
import { fullLibraryLock } from "./full-library";
import { verified } from "./full-library-loader";
import {
  FULL_TEXTURE_FORMAT,
  texturePath,
  type FullTextureManifest,
} from "./full-texture-pack";
import { ensure } from "../core/types";

export const fullTextureLock: {
  texturePackId: string;
  manifestSha256: string;
} = lock;

const base = () =>
  new URL(
    import.meta.env.BASE_URL +
      "libraries/" +
      fullTextureLock.texturePackId +
      "/",
    location.href,
  ).href;

let manifestLoad: Promise<FullTextureManifest> | undefined;
/** The verified texture manifest (one small request, cached offline). */
export function loadTextureManifest(): Promise<FullTextureManifest> {
  return (manifestLoad ??= (async () => {
    const m = JSON.parse(
      new TextDecoder().decode(
        await verified(
          "manifest.json",
          fullTextureLock.manifestSha256,
          undefined,
          base(),
        ),
      ),
    ) as FullTextureManifest;
    ensure(
      m.format === FULL_TEXTURE_FORMAT &&
        m.id === fullTextureLock.texturePackId &&
        m.library.releaseId === fullLibraryLock.releaseId &&
        m.library.manifestSha256 === fullLibraryLock.manifestSha256,
      "INVALID_INPUT",
      "Texture pack does not match the complete library lock",
    );
    return m;
  })().catch((e) => {
    manifestLoad = undefined;
    throw e;
  }));
}

/** Verified PNG bytes and size of one texture reference name, or undefined
 * when the official library has no such image. Rejects when it cannot be
 * fetched (offline and never cached) or fails its pin. */
export async function loadTextureImage(
  name: string,
): Promise<{ bytes: Uint8Array; width: number; height: number } | undefined> {
  const m = await loadTextureManifest();
  // Search path (spec): textures/<name>, then <name>.
  const key = name.replace(/^textures\//, "");
  const entry = Object.hasOwn(m.textures, key) ? m.textures[key] : undefined;
  if (!entry) return undefined;
  const [sha, bytes, width, height] = entry;
  return {
    bytes: await verified(texturePath(sha), sha, bytes, base()),
    width,
    height,
  };
}
