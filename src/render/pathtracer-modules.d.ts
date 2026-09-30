// Minimal typings for the deep imports of three-gpu-pathtracer and three-mesh-bvh
// that the photo look uses (their published typings omit these classes).
declare module "three-gpu-pathtracer/src/core/PathTracingRenderer.js" {
  import type * as THREE from "three";
  export class PathTracingRenderer {
    constructor(renderer: THREE.WebGLRenderer);
    material: import("three-gpu-pathtracer/src/materials/pathtracing/PhysicalPathTracingMaterial.js").PhysicalPathTracingMaterial;
    camera: THREE.Camera | null;
    tiles: THREE.Vector2;
    stableNoise: boolean;
    stableTiles: boolean;
    samples: number;
    alpha: boolean;
    readonly target: THREE.WebGLRenderTarget;
    readonly isCompiling: boolean;
    setCamera(camera: THREE.Camera): void;
    setSize(width: number, height: number): void;
    getSize(target: THREE.Vector2): void;
    reset(): void;
    update(): void;
    dispose(): void;
  }
}
declare module "three-gpu-pathtracer/src/materials/pathtracing/PhysicalPathTracingMaterial.js" {
  import type * as THREE from "three";
  export class PhysicalPathTracingMaterial extends THREE.ShaderMaterial {
    bounces: number;
    transmissiveBounces: number;
    filterGlossyFactor: number;
    environmentIntensity: number;
    environmentRotation: THREE.Matrix4;
    backgroundMap: THREE.Texture | null;
    backgroundAlpha: number;
    backgroundIntensity: number;
    backgroundBlur: number;
    physicalCamera: {
      bokehSize: number;
      apertureBlades: number;
      apertureRotation: number;
      focusDistance: number;
      anamorphicRatio: number;
    };
    bvh: { updateFrom(bvh: unknown): void; dispose?(): void };
    attributesArray: THREE.DataArrayTexture & {
      updateFrom(
        normal: THREE.BufferAttribute,
        tangent: THREE.BufferAttribute,
        uv: THREE.BufferAttribute,
        color: THREE.BufferAttribute,
      ): void;
    };
    materialIndexAttribute: THREE.DataTexture & {
      updateFrom(attribute: THREE.BufferAttribute): void;
    };
    materials: THREE.DataTexture & {
      updateFrom(materials: THREE.Material[], textures: THREE.Texture[]): void;
    };
    envMapInfo: {
      updateFrom(map: THREE.DataTexture): void;
      dispose(): void;
    };
    lights: { updateFrom(lights: unknown, iesTextures?: unknown[]): void };
    setDefine(name: string, value?: number | string): void;
  }
}
declare module "three-mesh-bvh/src/workers/GenerateMeshBVHWorker.js" {
  import type * as THREE from "three";
  import type { MeshBVH } from "three-mesh-bvh";
  export class GenerateMeshBVHWorker {
    running: boolean;
    generate(
      geometry: THREE.BufferGeometry,
      options?: Record<string, unknown>,
    ): Promise<MeshBVH>;
    dispose(): void;
  }
}
