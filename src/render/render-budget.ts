import { AppError } from "../core/types";
import {
  RESOURCE_PROFILES,
  type ResourceProfileName,
} from "../core/resource-profile";

/**
 * Renderer budgets per resource profile (spec §13, §21.2). A model inside the
 * document's occurrence limit can still be refused here: part/colour variants
 * each compile their own prototype geometry, and scene triangles set the draw
 * cost of every frame. A refused model is never drawn partially; the document,
 * source exports and inventory remain available (see docs/RESOURCE-LIMITS.md).
 */
export type RenderBudget = {
  /** Physical part occurrences drawn (the profile's expanded-occurrence limit). */
  partOccurrences: number;
  /** Raw-geometry (type 2–5 source record) occurrences. */
  rawOccurrences: number;
  /** Distinct compiled part/material variants. */
  variants: number;
  /** Triangles across all distinct compiled geometry (GPU and CPU geometry
   * memory: about 72 bytes per non-indexed triangle with normals). Colour
   * variants of one part share one geometry. */
  prototypeTriangles: number;
  /** Triangles across every drawn occurrence (per-frame draw cost). */
  sceneTriangles: number;
  /** Unused compiled prototypes kept for undo/redo and colour toggles. */
  retainedUnusedPrototypes: number;
  /** Above this many scene triangles, interactive views draw without
   * conditional edge lines and at no more than 1.5× pixel density (a visible,
   * reported degradation; captures keep full quality). */
  reducedQualityTriangles: number;
};

export const RENDER_BUDGETS: Readonly<
  Record<ResourceProfileName, Readonly<RenderBudget>>
> = Object.freeze({
  desktop: Object.freeze({
    partOccurrences: RESOURCE_PROFILES.desktop.occurrences,
    rawOccurrences: RESOURCE_PROFILES.desktop.occurrences,
    variants: 2048,
    prototypeTriangles: 2_000_000,
    sceneTriangles: 60_000_000,
    retainedUnusedPrototypes: 256,
    reducedQualityTriangles: 60_000_000,
  }),
  mobile: Object.freeze({
    partOccurrences: RESOURCE_PROFILES.mobile.occurrences,
    rawOccurrences: RESOURCE_PROFILES.mobile.occurrences,
    variants: 768,
    prototypeTriangles: 600_000,
    sceneTriangles: 16_000_000,
    retainedUnusedPrototypes: 64,
    reducedQualityTriangles: 4_000_000,
  }),
});

export function renderBudget(profile: ResourceProfileName): RenderBudget {
  return { ...(RENDER_BUDGETS[profile] ?? RENDER_BUDGETS.desktop) };
}

const PROFILE_LABEL: Record<ResourceProfileName, string> = {
  desktop: "desktop",
  mobile: "phone",
};
const n = (value: number) => value.toLocaleString("en-US");

/** Throws a terminal LIMIT_EXCEEDED naming the resource, its measured size and
 * the profile's budget. Nothing is drawn for a refused model. */
export function checkRenderBudget(
  profile: ResourceProfileName,
  usage: Partial<Record<keyof RenderBudget, number>>,
) {
  const budget = renderBudget(profile);
  const label = PROFILE_LABEL[profile] ?? profile;
  const names: Array<[keyof RenderBudget, string]> = [
    ["partOccurrences", "part occurrences"],
    ["rawOccurrences", "raw-geometry source occurrences"],
    ["variants", "distinct part/colour variants"],
    ["prototypeTriangles", "unique part triangles"],
    ["sceneTriangles", "scene triangles"],
  ];
  for (const [key, name] of names) {
    const used = usage[key];
    if (used !== undefined && used > budget[key])
      throw new AppError(
        "LIMIT_EXCEEDED",
        `This model has ${n(used)} ${name}; the ${label} renderer budget is ${n(budget[key])}. ` +
          "Nothing was drawn. The document, source exports and inventory remain available." +
          (profile === "mobile"
            ? " Desktop limits (Project → Device limits) allow more."
            : ""),
        { resource: key, used, budget: budget[key], profile },
      );
  }
}
