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
};
export const PHOTO_SCHEDULE: Readonly<
  Record<ResourceProfileName, Readonly<PhotoSchedule>>
> = Object.freeze({
  desktop: Object.freeze({
    tiles: [2, 2] as [number, number],
    tilesPerFrame: 2,
    displaySamples: 2,
    bounces: 5,
    transmissiveBounces: 6,
  }),
  mobile: Object.freeze({
    tiles: [3, 3] as [number, number],
    tilesPerFrame: 1,
    displaySamples: 2,
    bounces: 4,
    transmissiveBounces: 4,
  }),
});

/** Adapt the tiles traced per animation frame to the measured frame interval,
 * so refinement keeps the page responsive on slow GPUs and finishes sooner on
 * fast ones. `frameMs` is the time since the previous refinement frame. */
export function nextTilesPerFrame(
  current: number,
  frameMs: number,
  totalTiles: number,
) {
  if (!Number.isFinite(frameMs) || frameMs <= 0) return current;
  if (frameMs > 70 && current > 1) return Math.max(1, Math.floor(current / 2));
  if (frameMs < 28 && current < totalTiles) return current + 1;
  return current;
}

/** Strength of the edge-preserving smoothing applied when a traced still is
 * shown: path-tracing noise falls as 1/√samples, so the filter fades out as
 * the still converges (perceptual units; 0 = off). */
export function photoDenoise(samples: number) {
  if (samples <= 1) return 0.2;
  return Math.min(0.2, 0.6 / Math.sqrt(samples));
}

/** Percentage shown in the "Refining photo…" toast. */
export function photoProgress(samples: number, target: number) {
  if (target <= 0) return 100;
  return Math.max(0, Math.min(100, Math.floor((samples / target) * 100)));
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
