import { AppError } from "../core/types";
export type QualityName = "fast" | "balanced" | "photo";
export type QualityControls = {
  edges: "none" | "ordinary" | "all";
  shadows: "off" | "soft";
  shadowMapSize: 512 | 1024 | 2048;
  pixelRatioCap: number;
  toneMapping: "aces" | "neutral";
  exposure: number;
};
export type RenderProfile = QualityControls & {
  schemaVersion: 1;
  name: QualityName;
  transparentMaterials: "reference-sorted";
  ambientEffects: "hemisphere-light";
  environment: "none";
};
const defaults: Record<QualityName, QualityControls> = {
  fast: {
    edges: "none",
    shadows: "off",
    shadowMapSize: 512,
    pixelRatioCap: 1,
    toneMapping: "neutral",
    exposure: 1,
  },
  balanced: {
    edges: "all",
    shadows: "off",
    shadowMapSize: 1024,
    pixelRatioCap: 2,
    toneMapping: "aces",
    exposure: 1.2,
  },
  photo: {
    edges: "all",
    shadows: "soft",
    shadowMapSize: 2048,
    pixelRatioCap: 2,
    toneMapping: "aces",
    exposure: 1.2,
  },
};
/** Bounded independent controls. Profiles never alter authored geometry or materials. */
export function resolveQuality(
  name: QualityName,
  overrides: Partial<QualityControls> = {},
): RenderProfile {
  if (!Object.hasOwn(defaults, name))
    throw new AppError("INVALID_INPUT", "Unknown render quality profile");
  const result = { ...defaults[name], ...overrides };
  if (
    Object.keys(overrides).some((key) => !Object.hasOwn(defaults[name], key)) ||
    !["none", "ordinary", "all"].includes(result.edges) ||
    !["off", "soft"].includes(result.shadows) ||
    ![512, 1024, 2048].includes(result.shadowMapSize) ||
    !["aces", "neutral"].includes(result.toneMapping) ||
    !Number.isFinite(result.pixelRatioCap) ||
    result.pixelRatioCap < 0.5 ||
    result.pixelRatioCap > 3 ||
    !Number.isFinite(result.exposure) ||
    result.exposure < 0.1 ||
    result.exposure > 4
  )
    throw new AppError(
      "INVALID_INPUT",
      "Render quality controls exceed supported bounds",
    );
  return {
    schemaVersion: 1,
    name,
    ...result,
    transparentMaterials: "reference-sorted",
    ambientEffects: "hemisphere-light",
    environment: "none",
  };
}
