import * as THREE from "three";
import type { Diagnostic } from "../core/types";
import type { ResourceProfileName } from "../core/resource-profile";
import { renderBudget } from "./render-budget";

/**
 * Main-thread side of LDraw `!TEXMAP` rendering (docs/RENDERING.md "Textured
 * parts"). Compile workers emit a textured part's geometry as separate
 * objects tagged `userData.texmap = { t, m }` (vendor/LDrawLoader.js): `t` the
 * texture mapping it (the object has a `uv` attribute) and `m` when it is
 * drawn: `T` only with textures (`0 !:` geometry), `F` only without (the
 * FALLBACK section), `B` both. `resolve` turns a compiled prototype into its
 * textured form when every texture it names is available, else into its
 * fallback form, and reports why.
 *
 * Textures are decoded once per image (as ImageBitmaps, downscaled to the
 * profile's size limit) and shared by every part, colour and occurrence that
 * uses them; textured materials are shared per (colour material, texture), so
 * instancing and batching treat them like any other material.
 */
export type TexmapBudget = {
  /** Decoded texture memory (RGBA with mipmaps) the renderer may hold. */
  bytes: number;
  /** Longest side a texture is decoded at (larger images are downscaled). */
  size: number;
  anisotropy: number;
};
export type TexmapImage = { bytes: Uint8Array; width: number; height: number };
export type TexmapOutcome = {
  textures: string[];
  /** Every texture was available: the part is drawn textured. */
  textured: boolean;
  /** Textures that were not available, and why. */
  missing: { texture: string; reason: string }[];
};
type Entry =
  | { texture: THREE.Texture; bytes: number; width: number; height: number }
  | { error: string };

/** The texture budget of a resource profile (render-budget.ts). */
export function texmapBudget(profile: ResourceProfileName): TexmapBudget {
  const budget = renderBudget(profile);
  return {
    bytes: budget.textureBytes,
    size: budget.textureSize,
    anisotropy: profile === "mobile" ? 4 : 8,
  };
}

/** Decoded size of an RGBA texture with a full mip chain. */
export const textureBytes = (width: number, height: number) =>
  Math.ceil(width * height * 4 * (4 / 3));

/** Size a texture is decoded at: the image scaled so its longer side is at
 * most `limit` (never enlarged). */
export function decodedSize(width: number, height: number, limit: number) {
  const scale = Math.min(1, limit / Math.max(width, height, 1));
  return [
    Math.max(1, Math.round(width * scale)),
    Math.max(1, Math.round(height * scale)),
  ] as const;
}

/**
 * The part colour's material with a texture blended over it as the TEXMAP
 * spec asks: the image's alpha lets the part colour show through, and outside
 * the texture's extent (texture coordinates beyond 0…1) the face is the plain
 * part colour. Opaque printing on a transparent part is drawn opaque.
 */
export class TexmapMaterial extends THREE.MeshStandardMaterial {
  readonly isTexmapMaterial = true;
  constructor(parameters?: THREE.MeshStandardMaterialParameters) {
    super(parameters);
    this.onBeforeCompile = (shader) => {
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <map_fragment>",
        [
          "#ifdef USE_MAP",
          "  vec4 texmapTexel = texture2D( map, vMapUv );",
          "  vec2 texmapInside = step( vec2( 0.0 ), vMapUv ) * step( vMapUv, vec2( 1.0 ) );",
          "  float texmapAlpha = texmapTexel.a * texmapInside.x * texmapInside.y;",
          "  diffuseColor.rgb = mix( diffuseColor.rgb, texmapTexel.rgb, texmapAlpha );",
          "  diffuseColor.a = mix( diffuseColor.a, 1.0, texmapAlpha );",
          "#endif",
        ].join("\n"),
      );
    };
  }
  customProgramCacheKey() {
    return "ldraw-texmap-1";
  }
}

/** Decodes PNG bytes at (at most) `width` × `height`. */
async function decode(
  image: TexmapImage,
  width: number,
  height: number,
): Promise<ImageBitmap | HTMLCanvasElement> {
  const blob = new Blob([image.bytes as BlobPart], { type: "image/png" });
  if (typeof createImageBitmap === "function") {
    const options: ImageBitmapOptions = {
      premultiplyAlpha: "none",
      colorSpaceConversion: "none",
      imageOrientation: "from-image",
    };
    if (width !== image.width || height !== image.height)
      Object.assign(options, {
        resizeWidth: width,
        resizeHeight: height,
        resizeQuality: "high",
      });
    return createImageBitmap(blob, options);
  }
  // Older browsers: an image element drawn to a canvas of the decoded size.
  const url = URL.createObjectURL(blob);
  try {
    const element = new Image();
    element.src = url;
    await element.decode();
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    canvas.getContext("2d")!.drawImage(element, 0, 0, width, height);
    return canvas;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export class TexmapTextures {
  private entries = new Map<string, Promise<Entry>>();
  private materials = new WeakMap<
    THREE.Material,
    Map<string, THREE.Material>
  >();
  /** Decoded texture memory held (bytes, mipmaps included). */
  decodedBytes = 0;
  loaded = 0;
  failed = 0;
  private disposed = false;
  constructor(
    private readonly options: {
      /** Verified image bytes, undefined when the library has no such image. */
      load: (name: string) => Promise<TexmapImage | undefined>;
      budget: () => TexmapBudget;
      /** Decoder (tests replace it). */
      decode?: typeof decode;
    },
  ) {}

  /** Texture names a compiled prototype maps (none for untextured parts). */
  static texturesOf(group: THREE.Object3D) {
    const names = new Set<string>();
    let tagged = false;
    group.traverse((object) => {
      const tag = object.userData.texmap as { t: string | null } | undefined;
      if (!tag) return;
      tagged = true;
      if (tag.t) names.add(tag.t);
    });
    return tagged ? [...names] : undefined;
  }

  private texture(name: string): Promise<Entry> {
    const { size, anisotropy } = this.options.budget();
    const key = name + "@" + size;
    let entry = this.entries.get(key);
    if (!entry) {
      entry = (async (): Promise<Entry> => {
        let image: TexmapImage | undefined;
        try {
          image = await this.options.load(name);
        } catch (e) {
          return { error: e instanceof Error ? e.message : String(e) };
        }
        if (!image)
          return { error: "the official library has no image " + name };
        const [width, height] = decodedSize(image.width, image.height, size);
        const bytes = textureBytes(width, height);
        const budget = this.options.budget().bytes;
        if (this.decodedBytes + bytes > budget)
          return {
            error: `decoded textures would exceed the renderer budget of ${Math.round(budget / 2 ** 20)} MiB`,
          };
        this.decodedBytes += bytes;
        try {
          const source = await (this.options.decode ?? decode)(
            image,
            width,
            height,
          );
          const texture = new THREE.Texture(source as ImageBitmap);
          texture.name = name;
          texture.colorSpace = THREE.SRGBColorSpace;
          // Texture coordinates are image space (v = 0 is the first row);
          // ImageBitmaps are never flipped on upload anyway.
          texture.flipY = false;
          texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
          texture.anisotropy = anisotropy;
          texture.needsUpdate = true;
          if (this.disposed) {
            texture.dispose();
            (source as ImageBitmap).close?.();
            this.decodedBytes -= bytes;
            return { error: "the renderer was closed" };
          }
          this.loaded++;
          return { texture, bytes, width, height };
        } catch (e) {
          this.decodedBytes -= bytes;
          return {
            error:
              "the image could not be decoded (" +
              (e instanceof Error ? e.message : String(e)) +
              ")",
          };
        }
      })();
      // Failures are retried on the next load (e.g. back online).
      entry.then((e) => {
        if ("error" in e) {
          this.failed++;
          if (this.entries.get(key) === entry) this.entries.delete(key);
        }
      });
      this.entries.set(key, entry);
    }
    return entry;
  }

  /** The shared textured variant of a part-colour face material. */
  materialFor(base: THREE.Material, name: string, texture: THREE.Texture) {
    let byTexture = this.materials.get(base);
    if (!byTexture) this.materials.set(base, (byTexture = new Map()));
    let material = byTexture.get(name);
    if (!material) {
      const textured = new TexmapMaterial();
      textured.copy(base as THREE.MeshStandardMaterial);
      textured.map = texture;
      textured.name = (base.name || "") + " + " + name;
      textured.userData = { ...base.userData, texmap: name };
      byTexture.set(name, (material = textured));
    }
    return material;
  }

  /**
   * Resolves a compiled prototype in place: its textured form when every
   * texture it names loads, else its fallback form. Undefined for untextured
   * parts (nothing to do).
   */
  async resolve(
    group: THREE.Object3D,
    ref?: string,
  ): Promise<TexmapOutcome | undefined> {
    const names = TexmapTextures.texturesOf(group);
    if (!names) return undefined;
    const outcome = await this.apply(group, names);
    if (ref !== undefined) this.outcomes.set(ref, outcome);
    return outcome;
  }
  /** What each textured part (reference name) last resolved to. */
  readonly outcomes = new Map<string, TexmapOutcome>();
  /** Whether any textured part last resolved to its fallback. */
  hasFallback() {
    for (const outcome of this.outcomes.values())
      if (!outcome.textured) return true;
    return false;
  }
  /**
   * Render diagnostics for these occurrences: one warning naming the textured
   * parts drawn with fallback geometry because a texture was unavailable.
   * Parts drawn textured report nothing.
   */
  diagnostics(
    list: readonly { id: string; node: { kind: string; ref: string } }[],
  ): Diagnostic[] {
    const byRef = new Map<string, string[]>();
    for (const o of list) {
      if (o.node.kind === "geometry") continue;
      const outcome = this.outcomes.get(o.node.ref);
      if (!outcome || outcome.textured) continue;
      const ids = byRef.get(o.node.ref);
      if (ids) ids.push(o.id);
      else byRef.set(o.node.ref, [o.id]);
    }
    if (!byRef.size) return [];
    const refs = [...byRef.keys()];
    const first = this.outcomes.get(refs[0])!.missing[0];
    return [
      {
        code: "UNSUPPORTED_RENDER_FEATURE",
        severity: "warning",
        message:
          `${refs.length} textured part${refs.length === 1 ? " is" : "s are"} drawn without ${refs.length === 1 ? "its" : "their"} printed texture (${refs.slice(0, 3).join(", ")}${refs.length > 3 ? ", …" : ""}): ` +
          `${first.texture}: ${first.reason}. The part's untextured fallback geometry is shown.`,
        occurrenceIds: [...byRef.values()].flat(),
        details: {
          textures: Object.fromEntries(
            refs.map((r) => [r, this.outcomes.get(r)!.missing]),
          ),
        },
      },
    ];
  }
  private async apply(
    group: THREE.Object3D,
    names: string[],
  ): Promise<TexmapOutcome> {
    const entries = await Promise.all(names.map((n) => this.texture(n)));
    const loaded = new Map<string, THREE.Texture>();
    const missing: TexmapOutcome["missing"] = [];
    entries.forEach((entry, i) => {
      if ("error" in entry)
        missing.push({ texture: names[i], reason: entry.error });
      else loaded.set(names[i], entry.texture);
    });
    const textured = missing.length === 0;
    const remove: THREE.Object3D[] = [];
    group.traverse((object) => {
      const tag = object.userData.texmap as
        | { t: string | null; m: "T" | "F" | "B" }
        | undefined;
      if (!tag) return;
      if (tag.m === (textured ? "F" : "T")) {
        remove.push(object);
        return;
      }
      const texture = textured && tag.t ? loaded.get(tag.t) : undefined;
      const mesh = object as THREE.Mesh;
      if (!texture || !mesh.isMesh) return;
      mesh.material = Array.isArray(mesh.material)
        ? mesh.material.map((m) => this.materialFor(m, tag.t!, texture))
        : this.materialFor(mesh.material, tag.t!, texture);
    });
    for (const object of remove) object.removeFromParent();
    return { textures: names, textured, missing };
  }

  stats() {
    const budget = this.options.budget();
    return {
      textures: this.loaded,
      decodedBytes: this.decodedBytes,
      budgetBytes: budget.bytes,
      maxSize: budget.size,
      failed: this.failed,
      textured: [...this.outcomes.values()].filter((o) => o.textured).length,
      fallback: [...this.outcomes.values()].filter((o) => !o.textured).length,
    };
  }

  dispose() {
    this.disposed = true;
    for (const entry of this.entries.values())
      void entry.then((e) => {
        if ("texture" in e) {
          (e.texture.image as ImageBitmap | undefined)?.close?.();
          e.texture.dispose();
        }
      });
    this.entries.clear();
    this.decodedBytes = 0;
  }
}
