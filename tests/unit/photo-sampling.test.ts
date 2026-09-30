import { describe, expect, it } from "vitest";
import { PhysicalPathTracingMaterial } from "three-gpu-pathtracer/src/materials/pathtracing/PhysicalPathTracingMaterial.js";
import {
  PhotoSampler,
  SAMPLE_BLOCK,
  decorrelatePixels,
  highestTupleIndex,
  r2,
  tupleTextureSize,
} from "../../src/render/photo-sampling";
import {
  ATROUS_PASSES,
  atrousKernel,
  edgeWeight,
} from "../../src/render/photo-denoise";

describe("photo sampling", () => {
  it("stratifies every dimension from the first samples on, repeatably", () => {
    const tuples = 30;
    const sampler = new PhotoSampler(new Float32Array(tuples * 4));
    const take = (count: number) => {
      const out: number[][] = [];
      for (let i = 0; i < count; i++) out.push(Array.from(sampler.next()));
      return out;
    };
    const first = take(32);
    sampler.reset();
    expect(take(32)).toEqual(first);
    for (const value of first.flat()) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
    // Within one block, each of the four dimensions of each tuple visits every
    // quarter of [0, 1) (the library's sampler kept the third and fourth
    // dimension in the first eighth for 64 and 512 samples).
    const block = first.slice(SAMPLE_BLOCK - 1, 2 * SAMPLE_BLOCK - 1);
    for (let t = 0; t < tuples; t++)
      for (let d = 0; d < 4; d++) {
        const quarters = new Set(
          block.map((s) => Math.floor(s[t * 4 + d] * 4)),
        );
        expect(quarters.size).toBe(4);
      }
    // Tuples (bounces, lobes) are not copies of each other.
    expect(first[5].slice(0, 4)).not.toEqual(first[5].slice(4, 8));
    // R2: consecutive points are spread out.
    const [x0, y0] = r2(0, 0.1, 0.2),
      [x1, y1] = r2(1, 0.1, 0.2);
    expect(Math.hypot(x1 - x0, y1 - y0)).toBeGreaterThan(0.3);
  });

  it("patches the tracer so every pixel rotates each sample dimension on its own", () => {
    const material = new PhysicalPathTracingMaterial();
    const patched = decorrelatePixels(material.fragmentShader);
    expect(patched).not.toBe(material.fragmentShader);
    expect(patched).toContain("fract( stratifiedSample + pixelSeed )");
    expect(patched).not.toContain("pixelSeed.r");
    // Every tuple the shader reads fits the tuple texture: the library sizes
    // it bounces + transmission bounces + 5 wide, too narrow for 4 + 6 (15)
    // and for the phone's 4 + 4 (13), while the shader reads up to tuple 16.
    const highest = highestTupleIndex(material.fragmentShader);
    expect(highest).toBe(16);
    for (const [bounces, transmissive] of [
      [4, 6],
      [3, 4],
      [5, 6],
    ]) {
      const size = tupleTextureSize(
        { count: 20, depth: bounces + transmissive + 5 },
        highest,
        bounces + transmissive,
      );
      expect(size.depth).toBeGreaterThan(highest);
      expect(size.count).toBeGreaterThan(bounces + transmissive);
    }
    // An unexpected shader (another library version) is left alone.
    expect(decorrelatePixels("void main() {}")).toBe("void main() {}");
    material.dispose();
  });
});

describe("photo denoiser weights", () => {
  const surface = {
    normal: [0, 0, 1] as [number, number, number],
    depth: 500,
    gradient: 1,
    luminance: 0.5,
    noise: 0.01,
  };
  it("averages noise on one surface and stops at geometric edges", () => {
    let total = 0;
    for (let y = -1; y <= 1; y++)
      for (let x = -1; x <= 1; x++) total += atrousKernel(x, y);
    expect(total).toBeCloseTo(1);
    expect(ATROUS_PASSES).toBe(5);
    // Same surface, luminance within the noise: nearly full weight.
    expect(
      edgeWeight(surface, { ...surface, luminance: 0.52 }, 1),
    ).toBeGreaterThan(0.5);
    // A crease (normals 90° apart), a depth step, or background: no weight.
    expect(
      edgeWeight(surface, { ...surface, normal: [1, 0, 0] }, 1),
    ).toBeLessThan(1e-6);
    expect(edgeWeight(surface, { ...surface, depth: 540 }, 1)).toBeLessThan(
      1e-6,
    );
    expect(edgeWeight(surface, { ...surface, depth: 0 }, 1)).toBe(0);
    // A slanted surface (steep depth gradient) is not an edge.
    expect(
      edgeWeight({ ...surface, gradient: 8 }, { ...surface, depth: 516 }, 2),
    ).toBeGreaterThan(0.2);
  });

  it("backs off as the still converges (luminance weight scales with noise)", () => {
    const tap = { ...surface, luminance: 0.6 };
    const noisy = edgeWeight({ ...surface, noise: 0.01 }, tap, 1);
    const clean = edgeWeight({ ...surface, noise: 1e-6 }, tap, 1);
    expect(noisy).toBeGreaterThan(0.05);
    expect(clean).toBeLessThan(1e-3);
    expect(edgeWeight({ ...surface, noise: 0 }, tap, 1)).toBe(0);
  });
});
