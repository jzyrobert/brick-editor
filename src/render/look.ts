import { AppError } from "../core/types";
import type { ResourceProfileName } from "../core/resource-profile";

/**
 * Shading style, independent of the resource-oriented quality profile. "standard" is the
 * original editor look (flat hemisphere/sun lighting with LDraw edge lines). "realistic"
 * adds image-based lighting, tuned ABS/finish materials, fitted soft shadows on a
 * shadow-catcher ground and screen-space ambient occlusion. "photo" is realistic plus
 * progressive refinement: a still view accumulates jittered frames (anti-aliasing and
 * area-light soft shadows), and captures accumulate the same samples.
 */
export type LookName = "standard" | "realistic" | "photo";
export const LOOK_NAMES: readonly LookName[] = [
  "standard",
  "realistic",
  "photo",
];
export type LookControls = {
  /** Image-based lighting generated from three's RoomEnvironment (no external asset). */
  environment: "none" | "room";
  /** "ldraw" keeps LDrawLoader's finish materials; "plastic" tunes them for IBL. */
  materials: "ldraw" | "plastic";
  /** Screen-space ground-truth ambient occlusion. */
  ambientOcclusion: "off" | "gtao";
  /** "quality" follows the quality profile; "hidden" drops the black LDraw outlines. */
  edges: "quality" | "hidden";
  /** "quality" follows the quality profile; "soft" forces fitted soft shadows. */
  shadows: "quality" | "soft";
  /** "shadow" adds a transparent ground plane that only receives shadows and AO. */
  ground: "grid" | "shadow";
  /** Accumulated jittered frames for a still view and for captures (1 = off). */
  samples: number;
  /** Darkening at the frame corners, 0..0.5. */
  vignette: number;
  /** "neutral" (Khronos PBR Neutral) keeps LEGO colours saturated in bright light,
   * where ACES bleaches sunlit tops; "quality" follows the quality profile. */
  toneMapping: "quality" | "neutral";
  /** Multiplies the quality profile's exposure. */
  exposureScale: number;
};
export type RenderLook = LookControls & {
  schemaVersion: 1;
  name: LookName;
  /** Resource profile the defaults were degraded for. */
  resourceProfile: ResourceProfileName;
};
const defaults: Record<LookName, LookControls> = {
  standard: {
    environment: "none",
    materials: "ldraw",
    ambientOcclusion: "off",
    edges: "quality",
    shadows: "quality",
    ground: "grid",
    samples: 1,
    vignette: 0,
    toneMapping: "quality",
    exposureScale: 1,
  },
  realistic: {
    environment: "room",
    materials: "plastic",
    ambientOcclusion: "gtao",
    edges: "hidden",
    shadows: "soft",
    ground: "shadow",
    samples: 1,
    vignette: 0.12,
    toneMapping: "neutral",
    exposureScale: 0.85,
  },
  photo: {
    environment: "room",
    materials: "plastic",
    ambientOcclusion: "gtao",
    edges: "hidden",
    shadows: "soft",
    ground: "shadow",
    samples: 32,
    vignette: 0.12,
    toneMapping: "neutral",
    exposureScale: 0.85,
  },
};
/** Phones keep the cheap parts of the look (IBL, materials, shadows) and drop the
 * full-screen passes that cost fill rate on every interactive frame. */
const mobile: Partial<Record<LookName, Partial<LookControls>>> = {
  realistic: { ambientOcclusion: "off", vignette: 0 },
  photo: { samples: 12 },
};
export const MAX_LOOK_SAMPLES = 64;

export function isLookName(value: unknown): value is LookName {
  return typeof value === "string" && LOOK_NAMES.includes(value as LookName);
}

export function resolveLook(
  name: LookName,
  overrides: Partial<LookControls> = {},
  resourceProfile: ResourceProfileName = "desktop",
): RenderLook {
  if (!isLookName(name))
    throw new AppError("INVALID_INPUT", "Unknown render look");
  if (resourceProfile !== "desktop" && resourceProfile !== "mobile")
    throw new AppError("INVALID_INPUT", "Unknown resource profile");
  const result: LookControls = {
    ...defaults[name],
    ...(resourceProfile === "mobile" ? mobile[name] : {}),
    ...overrides,
  };
  if (
    Object.keys(overrides).some((key) => !Object.hasOwn(defaults[name], key)) ||
    !["none", "room"].includes(result.environment) ||
    !["ldraw", "plastic"].includes(result.materials) ||
    !["off", "gtao"].includes(result.ambientOcclusion) ||
    !["quality", "hidden"].includes(result.edges) ||
    !["quality", "soft"].includes(result.shadows) ||
    !["grid", "shadow"].includes(result.ground) ||
    !Number.isInteger(result.samples) ||
    result.samples < 1 ||
    result.samples > MAX_LOOK_SAMPLES ||
    !Number.isFinite(result.vignette) ||
    result.vignette < 0 ||
    result.vignette > 0.5 ||
    !["quality", "neutral"].includes(result.toneMapping) ||
    !Number.isFinite(result.exposureScale) ||
    result.exposureScale < 0.25 ||
    result.exposureScale > 4
  )
    throw new AppError(
      "INVALID_INPUT",
      "Render look controls exceed supported bounds",
    );
  return { schemaVersion: 1, name, resourceProfile, ...result };
}

/** The controls of a resolved look, to request the same look again (e.g. a capture). */
export function lookControls(look: RenderLook): LookControls {
  const { schemaVersion, name, resourceProfile, ...controls } = look;
  void schemaVersion, void name, void resourceProfile;
  return controls;
}

/** Whether the look needs the off-screen HDR pipeline instead of a direct draw. */
export function lookUsesPipeline(look: LookControls, accumulate = true) {
  return (
    look.ambientOcclusion !== "off" ||
    look.vignette > 0 ||
    (accumulate && look.samples > 1)
  );
}

/** Light levels when image-based lighting is on; the room environment supplies most
 * of the fill that the standard look's bright hemisphere light fakes. */
export const LOOK_LIGHTING = {
  environment: 0.45,
  hemisphere: 0.25,
  key: 2,
  fill: 0.2,
};

export type Finish =
  | "plastic"
  | "transparent"
  | "chrome"
  | "pearlescent"
  | "rubber"
  | "matte-metallic"
  | "metal"
  | "glitter"
  | "speckle"
  | "luminous";
/** Physically based parameters per LDraw finish. ABS is a dielectric (F0 ≈ 0.04) with a
 * glossy moulded surface; transparent parts are smoother, rubber much rougher. */
export const FINISH_PARAMETERS: Record<
  Finish,
  { roughness: number; metalness: number; envMapIntensity: number }
> = {
  plastic: { roughness: 0.24, metalness: 0, envMapIntensity: 1 },
  transparent: { roughness: 0.04, metalness: 0, envMapIntensity: 1.6 },
  chrome: { roughness: 0.06, metalness: 1, envMapIntensity: 1.2 },
  pearlescent: { roughness: 0.32, metalness: 0.55, envMapIntensity: 1.1 },
  rubber: { roughness: 0.82, metalness: 0, envMapIntensity: 0.55 },
  "matte-metallic": { roughness: 0.48, metalness: 0.7, envMapIntensity: 1 },
  metal: { roughness: 0.28, metalness: 0.9, envMapIntensity: 1.1 },
  glitter: { roughness: 0.06, metalness: 0, envMapIntensity: 1.6 },
  speckle: { roughness: 0.3, metalness: 0, envMapIntensity: 1 },
  luminous: { roughness: 0.3, metalness: 0, envMapIntensity: 0.6 },
};

/** Classify a LDrawLoader material from its LDConfig name and loader finish values. */
export function classifyFinish(material: {
  name: string;
  roughness: number;
  metalness: number;
  transparent: boolean;
  emissiveIntensity?: number;
  emissive?: { r: number; g: number; b: number };
}): Finish {
  const name = material.name.toLowerCase();
  if (name.startsWith("glitter_")) return "glitter";
  if (name.startsWith("speckle_")) return "speckle";
  const { roughness: r, metalness: m } = material;
  // LDrawLoader finish table (three r174): chrome 0/1, pearl 0.3/0.25, rubber 0.9/0,
  // matte metallic 0.8/0.4, metal 0.2/0.85, default 0.3/0.
  if (m >= 0.99 && r <= 0.01) return "chrome";
  if (Math.abs(m - 0.85) < 0.01 && Math.abs(r - 0.2) < 0.01) return "metal";
  if (Math.abs(m - 0.4) < 0.01 && Math.abs(r - 0.8) < 0.01)
    return "matte-metallic";
  if (Math.abs(m - 0.25) < 0.01) return "pearlescent";
  if (r >= 0.89 && m < 0.01) return "rubber";
  const e = material.emissive;
  if (e && e.r + e.g + e.b > 0) return "luminous";
  if (material.transparent) return "transparent";
  return "plastic";
}

/** Flake parameters from an LDConfig `MATERIAL GLITTER|SPECKLE` line. */
export type FlakeSpec = {
  kind: "glitter" | "speckle";
  color: string;
  fraction: number;
  size: number;
};
export function parseFlakeMaterials(colorText: string) {
  const specs = new Map<string, FlakeSpec>();
  for (const line of colorText.split(/\r?\n/)) {
    const match = line.match(
      /^0 !COLOUR\s+(\S+).*\bMATERIAL\s+(GLITTER|SPECKLE)\s+VALUE\s+(#[0-9a-fA-F]{6})(.*)$/,
    );
    if (!match) continue;
    const rest = match[4];
    const number = (key: string) => {
      const value = rest.match(new RegExp("\\b" + key + "\\s+([0-9.]+)"));
      return value ? Number(value[1]) : undefined;
    };
    const size =
      number("SIZE") ??
      ((number("MINSIZE") ?? 1) + (number("MAXSIZE") ?? 1)) / 2;
    specs.set(match[1].toLowerCase(), {
      kind: match[2] === "GLITTER" ? "glitter" : "speckle",
      color: match[3],
      // Speckle cells are whole world-space cubes, which read as noise at the stated
      // density; thin them and enlarge them slightly.
      fraction: Math.min(
        1,
        Math.max(0, number("FRACTION") ?? 0.2) *
          (match[2] === "SPECKLE" ? 0.5 : 1),
      ),
      size: Math.min(
        8,
        Math.max(0.5, size * (match[2] === "SPECKLE" ? 1.2 : 1)),
      ),
    });
  }
  return specs;
}
