import type * as THREE from "three";
import type { ResourceProfileName } from "../core/resource-profile";
import type { LookControls } from "./look";

/**
 * Policy for the photo look's path-traced stills: when to path-trace or fall back
 * to the accumulated raster photo, how refinement is scheduled, the lens, and what
 * a traced still contains. Kept free of the tracer itself, which is loaded on
 * first use (photo-tracer.ts).
 */

/** How a still is refined, per resource profile. */
export type PhotoSchedule = {
  /** The frame is traced in tiles; one or more tiles per animation frame. */
  tiles: [number, number];
  /** Tiles traced in the first refinement frame (adapted to the frame rate). */
  tilesPerFrame: number;
  /** Samples before the traced image replaces the raster frame. */
  displaySamples: number;
  /** Path bounces (transmission bounces are separate). */
  bounces: number;
  transmissiveBounces: number;
  /** Interactive stills are traced at most this many pixels and upscaled
   * (captures are traced at their full size). */
  tracePixels: number;
  /** Captures larger than this are presented without the denoiser (its guide
   * and filter targets cost about 36 bytes per pixel). */
  denoisePixels: number;
  /** An interactive still stops refining once its estimated noise, after
   * denoising, is below `cleanNoise` (display levels 0–255, standard
   * deviation; see estimateNoise), but not
   * before `minSamples`. `pathSamples` stays the upper bound. */
  minSamples: number;
  cleanNoise: number;
};
export const PHOTO_SCHEDULE: Readonly<
  Record<ResourceProfileName, Readonly<PhotoSchedule>>
> = Object.freeze({
  desktop: Object.freeze({
    tiles: [2, 2] as [number, number],
    tilesPerFrame: 2,
    displaySamples: 2,
    bounces: 4,
    transmissiveBounces: 6,
    tracePixels: 1_600_000,
    denoisePixels: 4_200_000,
    minSamples: 8,
    cleanNoise: 1.5,
  }),
  mobile: Object.freeze({
    tiles: [2, 2] as [number, number],
    tilesPerFrame: 1,
    displaySamples: 2,
    bounces: 3,
    transmissiveBounces: 4,
    tracePixels: 480_000,
    denoisePixels: 2_100_000,
    minSamples: 8,
    cleanNoise: 2,
  }),
});

/** Size an interactive still is traced at: the drawing buffer, scaled down
 * uniformly to at most `maxPixels` (the denoised result is upscaled). */
export function traceSize(width: number, height: number, maxPixels: number) {
  const w = Math.max(1, Math.round(width)),
    h = Math.max(1, Math.round(height));
  const scale = Math.min(1, Math.sqrt(maxPixels / (w * h)));
  return {
    width: Math.max(1, Math.round(w * scale)),
    height: Math.max(1, Math.round(h * scale)),
    scale,
  };
}

/** Most samples traced in one animation frame, in whole samples. */
export const MAX_SAMPLES_PER_FRAME = 4;

/** Adapt the tiles traced per animation frame to the measured frame interval,
 * so refinement keeps the page responsive on slow GPUs and keeps fast GPUs
 * busy (several whole samples per frame). `frameMs` is the time since the
 * previous refinement frame, which includes waiting for the GPU. */
export function nextTilesPerFrame(
  current: number,
  frameMs: number,
  totalTiles: number,
) {
  if (!Number.isFinite(frameMs) || frameMs <= 0) return current;
  if (frameMs > 70 && current > 1) return Math.max(1, Math.floor(current / 2));
  const most = totalTiles * MAX_SAMPLES_PER_FRAME;
  // A frame at the display rate has spare GPU time: double; up to ~35 ms, step.
  if (frameMs < 22) return Math.min(most, current * 2);
  if (frameMs < 36) return Math.min(most, current + 1);
  return current;
}

/** Whether the still's noise is estimated at this sample count. */
export function isNoiseCheckpoint(samples: number) {
  return samples >= 4 && Number.isInteger(samples) && samples % 4 === 0;
}

/**
 * Residual noise of a denoised still, from two presentations of the same
 * still at sample counts `earlier` < `later` (the later one includes the
 * earlier samples). For averages of independent samples, the difference of
 * the two has variance σ²(1/earlier − 1/later), which gives the later image's
 * noise σ²/later without a reference image; the denoiser, close to linear in
 * its input, keeps the relation. The spread is measured robustly (median
 * absolute deviation): the filter also sharpens as the still converges, which
 * changes a few edge pixels between the two presentations, and those are not
 * noise. `a` and `b` are display values (0–255, RGBA with alpha skipped, or
 * RGB). Returns the noise of the later image as a standard deviation in
 * display levels.
 */
export function estimateNoise(
  a: ArrayLike<number>,
  b: ArrayLike<number>,
  earlier: number,
  later: number,
  channels = 4,
) {
  if (!(later > earlier && earlier > 0) || a.length !== b.length) return NaN;
  const differences: number[] = [];
  for (let i = 0; i < a.length; i++) {
    if (channels === 4 && i % 4 === 3) continue;
    differences.push(a[i] - b[i]);
  }
  if (!differences.length) return NaN;
  const median = (values: number[]) => {
    const sorted = Float64Array.from(values).sort();
    const middle = sorted.length >> 1;
    return sorted.length % 2
      ? sorted[middle]
      : (sorted[middle - 1] + sorted[middle]) / 2;
  };
  const centre = median(differences);
  const spread = 1.4826 * median(differences.map((d) => Math.abs(d - centre)));
  return spread * Math.sqrt(earlier / (later - earlier));
}

/** Samples a still is expected to need to reach `cleanNoise`, given its noise
 * at `samples` (noise falls as 1/√samples). */
export function samplesToClean(
  samples: number,
  noise: number,
  cleanNoise: number,
) {
  if (!Number.isFinite(noise) || noise <= 0) return samples;
  return Math.ceil(samples * (noise / cleanNoise) ** 2);
}

/** Whether an interactive still is done: clean enough, or at its sample cap. */
export function photoDone(input: {
  samples: number;
  noise: number;
  schedule: Pick<PhotoSchedule, "minSamples" | "cleanNoise">;
  maxSamples: number;
}) {
  if (input.samples >= input.maxSamples) return true;
  return (
    input.samples >= input.schedule.minSamples &&
    Number.isFinite(input.noise) &&
    input.noise <= input.schedule.cleanNoise
  );
}

/** Percentage shown in the "Refining photo…" toast: against the samples the
 * still is expected to need (from its noise), capped by `target`. */
export function photoProgress(
  samples: number,
  target: number,
  needed = target,
) {
  const goal = Math.max(1, Math.min(target, needed));
  if (target <= 0) return 100;
  return Math.max(0, Math.min(100, Math.floor((samples / goal) * 100)));
}

export type PhotoSupport = {
  /** EXT_color_buffer_float: the tracer accumulates in float targets. */
  floatRenderTargets: boolean;
  maxTextureSize: number;
};
export type PhotoRendererChoice = {
  renderer: "path" | "raster";
  /** Why the path tracer is not used (null when it is, or when raster was asked for). */
  reason: string | null;
};
const n = (value: number) => value.toLocaleString("en-US");

/** Path tracing or the accumulated raster fallback for a photo still. */
export function choosePhotoRenderer(input: {
  look: Pick<LookControls, "renderer">;
  support: PhotoSupport;
  /** Triangles the traced still would contain (visible model meshes). */
  triangles: number;
  /** The profile's path-tracing triangle budget (render-budget.ts). */
  triangleBudget: number;
  profile: ResourceProfileName;
  sectionCut?: boolean;
  play?: boolean;
}): PhotoRendererChoice {
  const raster = (reason: string | null): PhotoRendererChoice => ({
    renderer: "raster",
    reason,
  });
  if (input.look.renderer !== "path") return raster(null);
  if (input.play) return raster("Play draws live frames.");
  if (!input.support.floatRenderTargets)
    return raster(
      "This device cannot render to floating-point targets, so Photo uses the accumulated realistic renderer.",
    );
  if (input.sectionCut)
    return raster(
      "Section cuts are drawn by the accumulated realistic renderer.",
    );
  if (input.triangles > input.triangleBudget)
    return raster(
      `This view has ${n(input.triangles)} triangles; the ${input.profile === "mobile" ? "phone" : "desktop"} path tracer is limited to ${n(input.triangleBudget)}, so Photo uses the accumulated realistic renderer.`,
    );
  // Vertex attributes are stored in square float textures.
  const side = input.support.maxTextureSize;
  if (input.triangles * 3 > side * side)
    return raster(
      "This view is larger than the GPU's texture limit for path tracing.",
    );
  return { renderer: "path", reason: null };
}

/** Thin-lens depth of field: aperture radius and focus in world units (LDU). The
 * aperture scales with the focus distance, so a small model shot close and a
 * large one shot from afar blur alike relative to their size. */
export function photoLens(focusDistance: number, depthOfField: number) {
  const focus = Math.max(1, focusDistance);
  const aperture = Math.max(0, Math.min(1, depthOfField)) * 0.03 * focus;
  return { focusDistance: focus, apertureRadius: aperture };
}

/** Visible triangle meshes under the roots (lines and hidden drawables left out). */
export function traceMeshes(roots: Iterable<THREE.Object3D>) {
  const meshes: THREE.Mesh[] = [];
  let triangles = 0;
  for (const root of roots)
    root.traverseVisible((object) => {
      const mesh = object as THREE.Mesh;
      if (!mesh.isMesh || (mesh as unknown as THREE.Line).isLine) return;
      const geometry = mesh.geometry;
      const position = geometry?.getAttribute("position");
      if (!position) return;
      meshes.push(mesh);
      triangles += Math.floor(
        (geometry.index ? geometry.index.count : position.count) / 3,
      );
    });
  return { meshes, triangles };
}

/** Cheap signature of what a traced still contains: which meshes, with which
 * materials (treatments swap them), where. Any change rebuilds the BVH. */
export function traceSignature(meshes: readonly THREE.Mesh[]) {
  let h1 = 0x811c9dc5 | 0,
    h2 = 0x01000193 | 0;
  const mix = (value: number) => {
    h1 = Math.imul(h1 ^ value, 0x01000193);
    h2 = Math.imul(h2 ^ (value >>> 3), 0x5bd1e995) ^ (h2 >>> 13);
  };
  for (const mesh of meshes) {
    mix(mesh.id);
    mix(mesh.geometry.id);
    const materials = Array.isArray(mesh.material)
      ? mesh.material
      : [mesh.material];
    for (const material of materials) mix(material ? material.id : -1);
    for (const value of mesh.matrixWorld.elements)
      mix(Math.round(value * 1024));
  }
  return (
    meshes.length.toString(36) +
    ":" +
    (h1 >>> 0).toString(36) +
    (h2 >>> 0).toString(36)
  );
}
