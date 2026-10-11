import * as THREE from "three";
import { GTAOPass } from "three/addons/postprocessing/GTAOPass.js";
import { FullScreenQuad } from "three/addons/postprocessing/Pass.js";

export type PipelineFrame = {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera | THREE.OrthographicCamera;
  /** Draws the scene into the renderer's current render target. */
  draw: () => void;
  /** null draws to the canvas. */
  target: THREE.WebGLRenderTarget | null;
  width: number;
  height: number;
  ao: boolean;
  /** AO buffer resolution relative to the frame (0.5 = quarter the pixels). */
  aoScale: number;
  /** World-space box outside which AO fades out (avoids grazing-angle ground noise). */
  aoBox?: THREE.Box3;
  vignette: number;
  /** Index of this sample in a still accumulation; 0 restarts it. */
  sample: number;
  /** Accumulate into the running average instead of drawing a single frame. */
  accumulate: boolean;
  /** Multisampled HDR target; accumulation already anti-aliases through jitter. */
  msaa: number;
  /** Photographic colour grade after tone mapping (the photo look). */
  grade?: { contrast: number; saturation: number } | null;
};

const vertexShader = /* glsl */ `
  precision highp float;
  uniform mat4 modelViewMatrix;
  uniform mat4 projectionMatrix;
  attribute vec3 position;
  attribute vec2 uv;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }`;

/** Tone map the linear HDR frame, composite it over the background, apply AO and
 * vignette, then either output it or blend it into the running still average. The
 * average is kept premultiplied and display-linear so anti-aliased edges stay clean. */
const compositeShader = /* glsl */ `
  precision highp float;
  uniform sampler2D tColor;
  uniform sampler2D tAO;
  uniform sampler2D tPrevious;
  uniform float aoIntensity;
  uniform vec3 background;
  uniform float backgroundAlpha;
  uniform float vignette;
  uniform float weight;
  uniform float gradeContrast;
  uniform float gradeSaturation;
  uniform float denoise;
  uniform vec2 texel;
  varying vec2 vUv;
  #include <tonemapping_pars_fragment>
  #include <colorspace_pars_fragment>
  vec3 toneMap(vec4 hdr) {
    float a = clamp(hdr.a, 0.0, 1.0);
    vec3 rgb = a > 0.0 ? hdr.rgb / a : vec3(0.0);
    #if defined(ACES_FILMIC_TONE_MAPPING)
      rgb = ACESFilmicToneMapping(rgb);
    #elif defined(NEUTRAL_TONE_MAPPING)
      rgb = NeutralToneMapping(rgb);
    #elif defined(AGX_TONE_MAPPING)
      rgb = AgXToneMapping(rgb);
    #endif
    return rgb;
  }
  void main() {
    vec4 hdr = texture2D(tColor, vUv);
    float a = clamp(hdr.a, 0.0, 1.0);
    vec3 rgb = toneMap(hdr);
    #ifdef DENOISE
      // Edge-preserving (bilateral) smoothing of path-tracing noise on the
      // tone-mapped image: neighbours of similar colour are averaged, edges and
      // texture that differ by more than the noise level are kept.
      vec3 centre = sqrt(max(rgb, 0.0));
      vec3 sum = rgb;
      float total = 1.0;
      float range = 0.5 / max(denoise * denoise, 1e-6);
      for (int y = -2; y <= 2; y++) {
        for (int x = -2; x <= 2; x++) {
          if (x == 0 && y == 0) continue;
          vec3 neighbour = toneMap(texture2D(tColor, vUv + vec2(x, y) * texel));
          vec3 d = sqrt(max(neighbour, 0.0)) - centre;
          float w = exp(-float(x * x + y * y) / 4.5 - dot(d, d) * range);
          sum += neighbour * w;
          total += w;
        }
      }
      rgb = sum / total;
    #endif
    #ifdef PHOTO_GRADE
      // Photographic grade: a touch more saturation and a gentle S-curve in
      // perceptual space (display-linear in, display-linear out).
      float luma = dot(rgb, vec3(0.2126, 0.7152, 0.0722));
      rgb = max(mix(vec3(luma), rgb, gradeSaturation), 0.0);
      vec3 p = pow(clamp(rgb, 0.0, 1.0), vec3(1.0 / 2.2));
      p = mix(p, p * p * (3.0 - 2.0 * p), gradeContrast);
      rgb = pow(p, vec3(2.2));
    #endif
    vec3 color = rgb * a + background * backgroundAlpha * (1.0 - a);
    float alpha = a + backgroundAlpha * (1.0 - a);
    #ifdef USE_AO
      float ao = mix(1.0, texture2D(tAO, vUv).r, aoIntensity);
      color *= ao;
      // Over a transparent background AO becomes dark coverage (contact shadow).
      alpha += (1.0 - alpha) * (1.0 - ao);
    #endif
    vec2 corner = (vUv - 0.5) * 1.41421356;
    color *= 1.0 - vignette * smoothstep(0.35, 1.0, dot(corner, corner));
    vec4 premultiplied = vec4(color, alpha);
    #ifdef ACCUMULATE
      gl_FragColor = mix(texture2D(tPrevious, vUv), premultiplied, weight);
    #else
      gl_FragColor = premultiplied;
      #ifdef STRAIGHT_ALPHA
        gl_FragColor.rgb = alpha > 0.0 ? color / alpha : vec3(0.0);
      #endif
      #ifdef SRGB_TRANSFER
        gl_FragColor = sRGBTransferOETF(gl_FragColor);
      #endif
    #endif
  }`;

const presentShader = /* glsl */ `
  precision highp float;
  uniform sampler2D tColor;
  varying vec2 vUv;
  #include <colorspace_pars_fragment>
  void main() {
    gl_FragColor = texture2D(tColor, vUv);
    #ifdef STRAIGHT_ALPHA
      gl_FragColor.rgb = gl_FragColor.a > 0.0 ? gl_FragColor.rgb / gl_FragColor.a : vec3(0.0);
    #endif
    #ifdef SRGB_TRANSFER
      gl_FragColor = sRGBTransferOETF(gl_FragColor);
    #endif
  }`;

/** Halton(2,3) sub-pixel offsets in [-0.5, 0.5). Sample 0 is unjittered. */
export function jitterOffset(sample: number): [number, number] {
  if (sample <= 0) return [0, 0];
  const halton = (index: number, base: number) => {
    let result = 0,
      f = 1 / base,
      i = index;
    while (i > 0) {
      result += f * (i % base);
      i = Math.floor(i / base);
      f /= base;
    }
    return result;
  };
  return [halton(sample, 2) - 0.5, halton(sample, 3) - 0.5];
}

/**
 * Off-screen HDR pipeline for the realistic looks. Owns its render targets; three's
 * GTAO pass reads the resolved depth of the beauty pass, so AO costs no extra
 * geometry pass. All GPU memory is released by dispose().
 */
export class LookPipeline {
  private hdr?: THREE.WebGLRenderTarget;
  private accumulation: THREE.WebGLRenderTarget[] = [];
  private current = 0;
  private gtao?: GTAOPass;
  private aoBox: THREE.Box3 | null = null;
  private quad = new FullScreenQuad();
  private composite = new THREE.RawShaderMaterial({
    uniforms: {
      tColor: { value: null },
      tAO: { value: null },
      tPrevious: { value: null },
      aoIntensity: { value: 0.85 },
      background: { value: new THREE.Color() },
      backgroundAlpha: { value: 1 },
      vignette: { value: 0 },
      weight: { value: 1 },
      gradeContrast: { value: 0 },
      gradeSaturation: { value: 1 },
      denoise: { value: 0 },
      texel: { value: new THREE.Vector2() },
      toneMappingExposure: { value: 1 },
    },
    vertexShader,
    fragmentShader: compositeShader,
    depthTest: false,
    depthWrite: false,
    blending: THREE.NoBlending,
  });
  private present = new THREE.RawShaderMaterial({
    uniforms: { tColor: { value: null } },
    vertexShader,
    fragmentShader: presentShader,
    depthTest: false,
    depthWrite: false,
    blending: THREE.NoBlending,
  });
  private clearColor = new THREE.Color();
  /** Last frame's timings of the passes, for diagnostics. */
  lastPasses = 0;

  private ensureTargets(width: number, height: number, msaa: number) {
    if (
      !this.hdr ||
      this.hdr.width !== width ||
      this.hdr.height !== height ||
      this.hdr.samples !== msaa
    ) {
      this.hdr?.dispose();
      this.hdr = new THREE.WebGLRenderTarget(width, height, {
        type: THREE.HalfFloatType,
        samples: msaa,
        depthTexture: new THREE.DepthTexture(width, height),
      });
      this.hdr.texture.name = "look.hdr";
    }
    return this.hdr;
  }
  private ensureAccumulation(width: number, height: number) {
    if (
      this.accumulation.length !== 2 ||
      this.accumulation[0].width !== width ||
      this.accumulation[0].height !== height
    ) {
      this.accumulation.forEach((t) => t.dispose());
      this.accumulation = [0, 1].map(
        () =>
          new THREE.WebGLRenderTarget(width, height, {
            type: THREE.HalfFloatType,
            depthBuffer: false,
          }),
      );
    }
    return this.accumulation;
  }
  private ensureGtao(frame: PipelineFrame, hdr: THREE.WebGLRenderTarget) {
    const width = Math.max(1, Math.round(frame.width * frame.aoScale)),
      height = Math.max(1, Math.round(frame.height * frame.aoScale));
    if (!this.gtao) {
      this.gtao = new GTAOPass(frame.scene, frame.camera, width, height);
      // Distances in LDraw units: a stud is 8 LDU across, a plate 8 high.
      this.gtao.updateGtaoMaterial({
        radius: 14,
        distanceExponent: 1.4,
        thickness: 10,
        scale: 1.1,
        samples: 16,
      });
      this.gtao.updatePdMaterial({ radius: 6, samples: 12, rings: 2 });
      this.gtao.output = GTAOPass.OUTPUT.Off;
    }
    const gtao = this.gtao;
    // Reuse the beauty pass's resolved depth; normals are reconstructed from it.
    // (Set after construction: r174's constructor path for a supplied depth texture
    // dereferences its own normal target before creating it.)
    if (gtao.depthTexture !== hdr.depthTexture)
      gtao.setGBuffer(hdr.depthTexture!, undefined);
    gtao.scene = frame.scene;
    gtao.camera = frame.camera;
    const perspective = frame.camera instanceof THREE.PerspectiveCamera ? 1 : 0;
    if (gtao.gtaoMaterial.defines.PERSPECTIVE_CAMERA !== perspective) {
      gtao.gtaoMaterial.defines.PERSPECTIVE_CAMERA = perspective;
      gtao.gtaoMaterial.needsUpdate = true;
    }
    if (gtao.width !== width || gtao.height !== height)
      gtao.setSize(width, height);
    const box = frame.aoBox && !frame.aoBox.isEmpty() ? frame.aoBox : null;
    if (
      (box === null) !== (this.aoBox === null) ||
      (box && this.aoBox && !box.equals(this.aoBox))
    ) {
      // The typings omit null, which clears the box.
      gtao.setSceneClipBox(box as THREE.Box3);
      this.aoBox = box ? box.clone() : null;
    }
    return gtao;
  }
  private setDefines(
    material: THREE.RawShaderMaterial,
    defines: Record<string, boolean>,
  ) {
    const next: Record<string, string> = {};
    for (const [key, on] of Object.entries(defines)) if (on) next[key] = "";
    const previous = material.defines || {};
    if (
      Object.keys(next).length !== Object.keys(previous).length ||
      Object.keys(next).some((key) => !(key in previous))
    ) {
      material.defines = next;
      material.needsUpdate = true;
    }
  }
  render(frame: PipelineFrame) {
    const { renderer, scene } = frame;
    const hdr = this.ensureTargets(frame.width, frame.height, frame.msaa);
    const background = scene.background;
    const clearAlpha = renderer.getClearAlpha();
    renderer.getClearColor(this.clearColor);
    let passes = 1;
    try {
      scene.background = null;
      renderer.setClearColor(0x000000, 0);
      renderer.setRenderTarget(hdr);
      renderer.clear();
      frame.draw();
    } finally {
      scene.background = background;
      renderer.setClearColor(this.clearColor, clearAlpha);
    }
    const uniforms = this.composite.uniforms;
    if (frame.ao) {
      const gtao = this.ensureGtao(frame, hdr);
      gtao.render(renderer, hdr, hdr, 0, false);
      uniforms.tAO.value = gtao.gtaoMap;
      passes += 2;
    }
    uniforms.tColor.value = hdr.texture;
    const color = background instanceof THREE.Color ? background : null;
    uniforms.background.value.copy(color ?? new THREE.Color(0, 0, 0));
    uniforms.backgroundAlpha.value = color ? 1 : 0;
    uniforms.vignette.value = frame.vignette;
    uniforms.toneMappingExposure.value = renderer.toneMappingExposure;
    // The canvas expects premultiplied colour; a capture target is read back as
    // straight alpha. sRGB targets encode in hardware, so only the canvas and
    // linear targets receive the transfer function in the shader.
    const encode =
      frame.target === null ||
      frame.target.texture.colorSpace !== THREE.SRGBColorSpace;
    const straight = frame.target !== null;
    const tone = renderer.toneMapping;
    const toneDefines = {
      ACES_FILMIC_TONE_MAPPING: tone === THREE.ACESFilmicToneMapping,
      NEUTRAL_TONE_MAPPING: tone === THREE.NeutralToneMapping,
      AGX_TONE_MAPPING: tone === THREE.AgXToneMapping,
      PHOTO_GRADE: !!frame.grade,
      DENOISE: false,
    };
    uniforms.gradeContrast.value = frame.grade?.contrast ?? 0;
    uniforms.gradeSaturation.value = frame.grade?.saturation ?? 1;
    if (frame.accumulate) {
      const [a, b] = this.ensureAccumulation(frame.width, frame.height);
      if (frame.sample === 0) this.current = 0;
      const previous = this.current === 0 ? b : a,
        next = this.current === 0 ? a : b;
      this.current = 1 - this.current;
      uniforms.tPrevious.value = previous.texture;
      uniforms.weight.value = 1 / (frame.sample + 1);
      this.setDefines(this.composite, {
        ...toneDefines,
        USE_AO: frame.ao,
        ACCUMULATE: true,
      });
      renderer.setRenderTarget(next);
      this.quad.material = this.composite;
      this.quad.render(renderer);
      this.present.uniforms.tColor.value = next.texture;
      this.setDefines(this.present, {
        STRAIGHT_ALPHA: straight,
        SRGB_TRANSFER: encode,
      });
      renderer.setRenderTarget(frame.target);
      this.quad.material = this.present;
      this.quad.render(renderer);
      passes += 2;
    } else {
      this.setDefines(this.composite, {
        ...toneDefines,
        USE_AO: frame.ao,
        STRAIGHT_ALPHA: straight,
        SRGB_TRANSFER: encode,
      });
      renderer.setRenderTarget(frame.target);
      this.quad.material = this.composite;
      this.quad.render(renderer);
      passes += 1;
    }
    this.lastPasses = passes;
  }
  /**
   * Tone-map, grade and present an already rendered linear HDR image (a path-traced
   * still, premultiplied alpha) to the canvas or a capture target.
   */
  presentImage(frame: {
    renderer: THREE.WebGLRenderer;
    texture: THREE.Texture;
    target: THREE.WebGLRenderTarget | null;
    background: THREE.Color | null;
    vignette: number;
    grade: { contrast: number; saturation: number } | null;
    /** Noise level of the image in perceptual units (0 = no smoothing). */
    denoise?: number;
  }) {
    const { renderer } = frame;
    const uniforms = this.composite.uniforms;
    uniforms.tColor.value = frame.texture;
    uniforms.background.value.copy(
      frame.background ?? new THREE.Color(0, 0, 0),
    );
    uniforms.backgroundAlpha.value = frame.background ? 1 : 0;
    uniforms.vignette.value = frame.vignette;
    uniforms.toneMappingExposure.value = renderer.toneMappingExposure;
    uniforms.gradeContrast.value = frame.grade?.contrast ?? 0;
    uniforms.gradeSaturation.value = frame.grade?.saturation ?? 1;
    uniforms.denoise.value = frame.denoise ?? 0;
    const image = frame.texture.image as { width: number; height: number };
    uniforms.texel.value.set(1 / image.width, 1 / image.height);
    const tone = renderer.toneMapping;
    this.setDefines(this.composite, {
      DENOISE: (frame.denoise ?? 0) > 0,
      ACES_FILMIC_TONE_MAPPING: tone === THREE.ACESFilmicToneMapping,
      NEUTRAL_TONE_MAPPING: tone === THREE.NeutralToneMapping,
      AGX_TONE_MAPPING: tone === THREE.AgXToneMapping,
      PHOTO_GRADE: !!frame.grade,
      STRAIGHT_ALPHA: frame.target !== null,
      SRGB_TRANSFER:
        frame.target === null ||
        frame.target.texture.colorSpace !== THREE.SRGBColorSpace,
    });
    renderer.setRenderTarget(frame.target);
    this.quad.material = this.composite;
    this.quad.render(renderer);
    this.lastPasses = 1;
  }
  /** Release every GPU resource; the pipeline can be used again afterwards. */
  releaseTargets() {
    this.hdr?.dispose();
    this.hdr = undefined;
    this.accumulation.forEach((t) => t.dispose());
    this.accumulation = [];
    // r174's GTAOPass.dispose omits these two materials. In particular the
    // rendered AO material otherwise retains its WebGLProgram after every
    // Realistic -> Standard switch (and every temporary Realistic capture).
    this.gtao?.gtaoMaterial.dispose();
    this.gtao?.blendMaterial.dispose();
    this.gtao?.dispose();
    this.gtao = undefined;
    this.aoBox = null;
  }
  dispose() {
    this.releaseTargets();
    this.composite.dispose();
    this.present.dispose();
    this.quad.dispose();
  }
}

/** Procedural glitter/speckle flakes for LDConfig `MATERIAL GLITTER|SPECKLE` colours
 * (LDrawLoader ignores MATERIAL). World-space cells of `size` LDU take the flake
 * colour with probability `fraction`; glitter flakes are also mirror-like. */
export function applyFlakes(
  material: THREE.MeshStandardMaterial,
  spec: {
    kind: "glitter" | "speckle";
    color: string;
    fraction: number;
    size: number;
  },
) {
  material.userData.lookFlake = spec.kind;
  const color = new THREE.Color(spec.color);
  const glitter = spec.kind === "glitter";
  material.onBeforeCompile = (shader) => {
    shader.uniforms.flakeColor = { value: color };
    shader.uniforms.flakeFraction = { value: spec.fraction };
    shader.uniforms.flakeSize = { value: spec.size };
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        "#include <common>\nvarying vec3 vFlakePosition;",
      )
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
        vec4 flakePosition = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          flakePosition = instanceMatrix * flakePosition;
        #endif
        vFlakePosition = (modelMatrix * flakePosition).xyz;`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
        varying vec3 vFlakePosition;
        uniform vec3 flakeColor;
        uniform float flakeFraction;
        uniform float flakeSize;
        float flakeCell() {
          vec3 cell = floor(vFlakePosition / flakeSize);
          return fract(sin(dot(cell, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
        }`,
      )
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
        bool flake = flakeCell() < flakeFraction;
        if (flake) {
          diffuseColor.rgb = flakeColor;
          ${glitter ? "diffuseColor.a = max(diffuseColor.a, 0.85);" : ""}
        }`,
      )
      .replace(
        "#include <metalnessmap_fragment>",
        `#include <metalnessmap_fragment>
        ${glitter ? "if (flake) { metalnessFactor = 1.0; roughnessFactor = 0.12; }" : ""}`,
      );
  };
  material.customProgramCacheKey = () => "brick-flake-" + spec.kind;
  material.needsUpdate = true;
}
export function removeFlakes(material: THREE.MeshStandardMaterial) {
  delete material.userData.lookFlake;
  material.onBeforeCompile = THREE.Material.prototype.onBeforeCompile;
  material.customProgramCacheKey =
    THREE.Material.prototype.customProgramCacheKey;
  material.needsUpdate = true;
}
