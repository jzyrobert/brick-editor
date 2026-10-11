import { expect, it, vi } from "vitest";
import * as THREE from "three";
import {
  LookPipeline,
  type PipelineFrame,
} from "../../src/render/look-pipeline";
import type { GTAOPass } from "three/addons/postprocessing/GTAOPass.js";

it("releases every AO material when leaving the HDR pipeline", () => {
  const pipeline = new LookPipeline();
  // Allocation needs no WebGL context; render itself is covered in the browser.
  const allocate = pipeline as unknown as {
    ensureGtao(
      frame: Partial<PipelineFrame>,
      target: THREE.WebGLRenderTarget,
    ): GTAOPass;
  };
  const target = new THREE.WebGLRenderTarget(32, 32, {
    depthTexture: new THREE.DepthTexture(32, 32),
  });
  for (let cycle = 0; cycle < 3; cycle++) {
    const pass = allocate.ensureGtao(
      {
        scene: new THREE.Scene(),
        camera: new THREE.PerspectiveCamera(),
        width: 32,
        height: 32,
        aoScale: 0.5,
      },
      target,
    );
    const materials = [
      pass.gtaoMaterial,
      pass.blendMaterial,
      pass.normalMaterial,
      pass.pdMaterial,
      pass.copyMaterial,
      pass.depthRenderMaterial,
    ];
    const disposed = materials.map((material) => {
      const listener = vi.fn();
      material.addEventListener("dispose", listener);
      return listener;
    });
    pipeline.releaseTargets();
    pipeline.releaseTargets();
    for (const listener of disposed) expect(listener).toHaveBeenCalledTimes(1);
  }
  pipeline.dispose();
  target.dispose();
});
