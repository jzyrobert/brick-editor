import * as THREE from "three";

/**
 * The procedural studio shared by the Realistic look (raster image-based light)
 * and the Photo look (path tracer): a key softbox, a dim fill, two rim strips
 * and an overhead soft light, built as an equirectangular HDR image on the CPU
 * from light panels. No asset is fetched. See docs/RENDERING.md.
 *
 * The studio is fixed in the world, turned so that from the camera the editor
 * frames a model with (fit(): the camera sits towards +X +Y +Z) the key is
 * above camera left. It no longer turns with the camera, so the raster frames
 * Photo draws while the view moves and the traced still agree, and the raster
 * key light that casts the shadows stays put (its shadow map is cached).
 */

export type StudioPanel = {
  /** Direction from the subject towards the light (+Z = towards the camera). */
  direction: [number, number, number];
  /** Half extents on the plane one unit away along `direction`. */
  halfWidth: number;
  halfHeight: number;
  /** Width of the smoothstep fall-off at the panel's edges. */
  softness: number;
  /** Linear radiance. */
  radiance: [number, number, number];
};

/** Studio panels in the camera frame of the framing view: a large key softbox
 * above camera left, a dimmer fill to the right, two strip lights behind for
 * rim highlights, and an overhead soft light. The wide key spreads its
 * reflection across curved ABS without raising the key's irradiance; broad
 * rim strips remain readable after PMREM filtering on rougher finishes. */
export const STUDIO_PANELS: readonly StudioPanel[] = [
  {
    direction: [-0.62, 0.7, 0.36],
    halfWidth: 0.4,
    halfHeight: 0.3,
    softness: 0.08,
    radiance: [7.54, 7.42, 7.2],
  },
  {
    direction: [0.85, 0.3, 0.42],
    halfWidth: 0.5,
    halfHeight: 0.36,
    softness: 0.2,
    radiance: [0.9, 0.95, 1.05],
  },
  {
    direction: [0.72, 0.42, -0.55],
    halfWidth: 0.14,
    halfHeight: 0.5,
    softness: 0.06,
    radiance: [4, 4, 4],
  },
  {
    direction: [-0.78, 0.36, -0.52],
    halfWidth: 0.12,
    halfHeight: 0.5,
    softness: 0.06,
    radiance: [3.2, 3.2, 3.3],
  },
  {
    direction: [0, 1, 0],
    halfWidth: 0.6,
    halfHeight: 0.6,
    softness: 0.3,
    radiance: [0.7, 0.7, 0.7],
  },
];
/** Index of the key softbox in STUDIO_PANELS. */
const KEY = 0;

/** World azimuth (about +Y, from +Z towards +X) of the camera fit() places:
 * the studio's camera frame is turned to it. */
export const STUDIO_AZIMUTH = Math.atan2(0.8, 0.9);

/** The panels turned from the framing camera's frame into the world. */
export function studioPanelsInWorld(
  panels: readonly StudioPanel[] = STUDIO_PANELS,
  azimuth = STUDIO_AZIMUTH,
): StudioPanel[] {
  const turn = new THREE.Matrix4().makeRotationY(azimuth);
  return panels.map((panel) => ({
    ...panel,
    direction: new THREE.Vector3(...panel.direction)
      .applyMatrix4(turn)
      .toArray() as [number, number, number],
  }));
}

/**
 * Raster Realistic draws the key softbox's light mostly with a directional
 * light, so it casts the (cached, fitted) shadow map; the environment keeps
 * the rest, enough for the softbox's reflection in glossy plastic. The path
 * tracer needs no split: its area lights shadow themselves.
 */
export const STUDIO_KEY_SHARE = 0.8;

/** Irradiance a surface facing a panel receives from it (linear RGB): the
 * panel's radiance integrated over its extent on the tangent plane, weighted
 * by the solid angle and the cosine, (1 + x² + z²)⁻². */
export function panelIrradiance(panel: StudioPanel, steps = 96) {
  const reachX = panel.halfWidth + panel.softness,
    reachZ = panel.halfHeight + panel.softness;
  let sum = 0;
  for (let i = 0; i < steps; i++) {
    const x = -reachX + ((i + 0.5) / steps) * 2 * reachX;
    for (let j = 0; j < steps; j++) {
      const z = -reachZ + ((j + 0.5) / steps) * 2 * reachZ;
      const weight =
        edge(x, panel.halfWidth, panel.softness) *
        edge(z, panel.halfHeight, panel.softness);
      sum += weight / (1 + x * x + z * z) ** 2;
    }
  }
  const area = ((2 * reachX) / steps) * ((2 * reachZ) / steps);
  return panel.radiance.map((r) => r * sum * area) as [number, number, number];
}

function edge(value: number, half: number, soft: number) {
  const t = (half - Math.abs(value)) / Math.max(1e-6, soft) + 0.5;
  const s = Math.max(0, Math.min(1, t));
  return s * s * (3 - 2 * s);
}

export type StudioOptions = {
  /** Scale of the key softbox's radiance (raster: 1 − STUDIO_KEY_SHARE). */
  keyScale?: number;
  /** Radiance below the horizon (linear RGB): the light a studio floor bounces
   * back up. Unset: dark studio walls (the path tracer traces its own floor). */
  floor?: [number, number, number];
};

/** Equirectangular studio radiance (linear RGBA float, row 0 = straight down),
 * in three's convention (also the path tracer's): u = atan(z, x) / 2π + 0.5,
 * v = 1 − acos(y) / π. Panels are in world directions. */
export function studioEnvironmentData(
  width = 512,
  height = 256,
  panels: readonly StudioPanel[] = studioPanelsInWorld(),
  options: StudioOptions = {},
) {
  const data = new Float32Array(width * height * 4);
  const frames = panels.map((panel, index) => {
    const c = new THREE.Vector3(...panel.direction).normalize();
    const up =
      Math.abs(c.y) > 0.99
        ? new THREE.Vector3(0, 0, 1)
        : new THREE.Vector3(0, 1, 0);
    const right = new THREE.Vector3().crossVectors(up, c).normalize();
    const upward = new THREE.Vector3().crossVectors(c, right).normalize();
    const scale = index === KEY ? (options.keyScale ?? 1) : 1;
    return { panel, c, right, upward, scale };
  });
  const d = new THREE.Vector3();
  const floor = options.floor;
  for (let row = 0; row < height; row++) {
    const v = (row + 0.5) / height;
    const phi = (1 - v) * Math.PI;
    for (let column = 0; column < width; column++) {
      const u = (column + 0.5) / width;
      const theta = (u - 0.5) * 2 * Math.PI;
      d.set(
        Math.sin(phi) * Math.cos(theta),
        Math.cos(phi),
        Math.sin(phi) * Math.sin(theta),
      );
      // Neutral studio walls: brighter towards the ceiling, dark below.
      const y = d.y;
      const wall = y >= 0 ? 0.07 + 0.1 * y : 0.03 + 0.04 * (1 + y);
      let r = wall,
        g = wall,
        b = wall * 1.02;
      if (floor && y < 0) {
        // A lit floor, fading into the walls towards the horizon.
        const t = Math.min(1, -y / 0.25);
        const k = t * t * (3 - 2 * t);
        r += (floor[0] - r) * k;
        g += (floor[1] - g) * k;
        b += (floor[2] - b) * k;
      }
      for (const { panel, c, right, upward, scale } of frames) {
        const facing = d.dot(c);
        if (facing <= 0.05 || scale <= 0) continue;
        const x = d.dot(right) / facing,
          z = d.dot(upward) / facing;
        const weight =
          edge(x, panel.halfWidth, panel.softness) *
          edge(z, panel.halfHeight, panel.softness);
        if (weight <= 0) continue;
        r += panel.radiance[0] * weight * scale;
        g += panel.radiance[1] * weight * scale;
        b += panel.radiance[2] * weight * scale;
      }
      const i = (row * width + column) * 4;
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = 1;
    }
  }
  return data;
}

/** Irradiance on an upward-facing surface from the studio's upper hemisphere
 * (linear RGB), integrated over an equirectangular image. */
export function upwardIrradiance(
  data: Float32Array,
  width: number,
  height: number,
) {
  const sum = [0, 0, 0];
  const dTheta = (2 * Math.PI) / width,
    dPhi = Math.PI / height;
  for (let row = 0; row < height; row++) {
    const phi = (1 - (row + 0.5) / height) * Math.PI;
    const cos = Math.cos(phi);
    if (cos <= 0) continue;
    const weight = cos * Math.sin(phi) * dTheta * dPhi;
    for (let column = 0; column < width; column++) {
      const i = (row * width + column) * 4;
      sum[0] += data[i] * weight;
      sum[1] += data[i + 1] * weight;
      sum[2] += data[i + 2] * weight;
    }
  }
  return sum as [number, number, number];
}

export const STUDIO_WIDTH = 512;
export const STUDIO_HEIGHT = 256;
/** Share of a floor's bounce that reaches the model: the floor next to the
 * model is partly in its shadow, and a traced floor is finite. */
const FLOOR_BOUNCE = 0.6;
/** Linear albedo of Photo's studio sweep on the Blank backdrop (its light
 * background lerped towards grey, see PhotoTracer.setBackground). */
export const STUDIO_FLOOR_ALBEDO: [number, number, number] = [0.75, 0.77, 0.77];

let traced: Float32Array | undefined;
/** The path tracer's studio: every panel at full strength, dark below the
 * horizon (the tracer traces the floor itself). Generated once per page. */
export function tracedStudio() {
  return (traced ??= studioEnvironmentData(STUDIO_WIDTH, STUDIO_HEIGHT));
}

export type RasterStudioLight = {
  /** World direction towards the key softbox: the directional key light. */
  keyDirection: THREE.Vector3;
  keyColor: THREE.Color;
  /** Directional key light intensity (the key's irradiance share). */
  keyIntensity: number;
};
let light: RasterStudioLight | undefined;
/** The raster key light: along the key softbox, carrying STUDIO_KEY_SHARE of
 * its irradiance. */
export function rasterStudioLight(): RasterStudioLight {
  if (light) return light;
  const key = studioPanelsInWorld()[KEY];
  const irradiance = panelIrradiance(key);
  const peak = Math.max(...irradiance);
  light = {
    keyDirection: new THREE.Vector3(...key.direction).normalize(),
    keyColor: new THREE.Color(
      irradiance[0] / peak,
      irradiance[1] / peak,
      irradiance[2] / peak,
    ),
    keyIntensity: STUDIO_KEY_SHARE * peak,
  };
  return light;
}

/**
 * The raster studio's radiance: the same panels, the key softbox kept at
 * 1 − STUDIO_KEY_SHARE (its reflection; the key light draws the rest), and a
 * lit floor of `albedo` below the horizon standing in for the light the
 * traced floor bounces (Photo's sweep, or a backdrop's ground).
 */
export function rasterStudioData(
  albedo: readonly [number, number, number] = STUDIO_FLOOR_ALBEDO,
) {
  const lit = upwardIrradiance(tracedStudio(), STUDIO_WIDTH, STUDIO_HEIGHT);
  const floor = lit.map((e, i) => (FLOOR_BOUNCE * albedo[i] * e) / Math.PI) as [
    number,
    number,
    number,
  ];
  return studioEnvironmentData(
    STUDIO_WIDTH,
    STUDIO_HEIGHT,
    studioPanelsInWorld(),
    { keyScale: 1 - STUDIO_KEY_SHARE, floor },
  );
}

let sky: [number, number, number] | undefined;
/** Irradiance the raster studio's upper hemisphere gives an upward-facing
 * surface (linear RGB): image-based light for a backdrop's Lambert ground,
 * which IBL does not reach (see SceneEnvironment.setSkyLight). Without it the
 * ground in the key light's shadow is lit by the faint hemisphere light alone
 * and turns black, where Photo's traced ground stays a soft grey. */
export function rasterStudioSkyLight() {
  // The upper hemisphere does not depend on the floor; a coarse image is
  // enough for an integral (it costs a few milliseconds, not a full image).
  return (sky ??= upwardIrradiance(
    studioEnvironmentData(128, 64, studioPanelsInWorld(), {
      keyScale: 1 - STUDIO_KEY_SHARE,
    }),
    128,
    64,
  ));
}

/** A half-float equirectangular texture of the raster studio, for PMREM
 * (half floats filter linearly on every WebGL2 device; 32-bit floats need
 * OES_texture_float_linear, which many phones lack). */
export function rasterStudioTexture(
  albedo: readonly [number, number, number] = STUDIO_FLOOR_ALBEDO,
) {
  const data = rasterStudioData(albedo);
  const half = new Uint16Array(data.length);
  for (let i = 0; i < half.length; i++)
    half[i] = THREE.DataUtils.toHalfFloat(data[i]);
  const texture = new THREE.DataTexture(
    half,
    STUDIO_WIDTH,
    STUDIO_HEIGHT,
    THREE.RGBAFormat,
    THREE.HalfFloatType,
  );
  texture.mapping = THREE.EquirectangularReflectionMapping;
  texture.colorSpace = THREE.LinearSRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
}
