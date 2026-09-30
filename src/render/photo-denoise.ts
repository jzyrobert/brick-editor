import * as THREE from "three";
import { FullScreenQuad } from "three/addons/postprocessing/Pass.js";

/**
 * Edge-aware denoiser for path-traced photo stills (docs/RENDERING.md, "Photo:
 * denoising"). A spatial SVGF-style filter: five à-trous wavelet passes over
 * the traced image, demodulated by surface albedo so colour edges between
 * bricks stay sharp, with edge-stopping weights from guide buffers (normal,
 * view depth, albedo) rasterised from the traced geometry itself, and a
 * luminance weight scaled by the per-pixel noise. The noise is measured, not
 * guessed: the difference between the accumulation now and a snapshot at an
 * earlier sample count is pure noise (no signal), so the filter backs off by
 * itself as the still converges. Filtering the variance alongside the image
 * (SVGF) keeps later passes from over-blurring.
 */

/** Guide flags per material slot (albedo texture alpha). */
export const GUIDE_OPAQUE = 0;
/** Seen only from the front (the studio sweep: a camera outside sees through). */
export const GUIDE_FRONT_ONLY = 1;
/** Not in the guides (glass, ghosted parts): what is behind guides the filter. */
export const GUIDE_SKIP = 2;

export type GuideSlot = { color: THREE.Color; flag: number };

/** Number of à-trous passes (step sizes 1, 2, 4, 8, 16 pixels). */
export const ATROUS_PASSES = 5;
/** Edge-stopping parameters (SVGF's defaults, tuned for LDraw parts). */
export const DENOISE_SIGMA = { luminance: 4, normal: 64, depth: 1.5 };
/** Albedo below this is not divided out (dark parts would amplify noise and
 * anti-aliased edges against lighter neighbours). */
export const DENOISE_ALBEDO_FLOOR = 0.06;

/** B3-spline-like 3×3 à-trous kernel weight of a tap (−1, 0, 1). */
export function atrousKernel(x: number, y: number) {
  const k = [0.25, 0.5, 0.25];
  return k[x + 1] * k[y + 1];
}

/**
 * Edge-stopping weight between a centre pixel p and a tap q (the same maths as
 * the shader, for tests). Depth uses the centre's screen-space depth gradient
 * so slanted surfaces are not treated as edges.
 */
export function edgeWeight(
  p: {
    normal: [number, number, number];
    depth: number;
    gradient: number;
    luminance: number;
    noise: number;
  },
  q: { normal: [number, number, number]; depth: number; luminance: number },
  distance: number,
  sigma = DENOISE_SIGMA,
) {
  const hasP = p.depth > 0,
    hasQ = q.depth > 0;
  if (hasP !== hasQ) return 0;
  let geometry = 1;
  if (hasP) {
    const dot = Math.max(
      0,
      p.normal[0] * q.normal[0] +
        p.normal[1] * q.normal[1] +
        p.normal[2] * q.normal[2],
    );
    const wn = dot ** sigma.normal;
    const wz = Math.exp(
      -Math.abs(p.depth - q.depth) /
        (sigma.depth * Math.max(p.gradient, 1e-3 * p.depth) * distance + 1e-4),
    );
    geometry = wn * wz;
  }
  const wl = Math.exp(
    -Math.abs(p.luminance - q.luminance) /
      (sigma.luminance * Math.sqrt(Math.max(p.noise, 0)) + 1e-6),
  );
  return geometry * wl;
}

const quadVertex = /* glsl */ `
  out vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }`;

/** Guide packing: one float RGBA texel per pixel holds the normal (octahedral,
 * 2×12 bits), the view depth, the albedo (√albedo, 3×8 bits) and the depth
 * gradient; integers below 2²⁴ are exact in a 32-bit float. */
const packing = /* glsl */ `
  vec2 signs(vec2 v) { return vec2(v.x >= 0.0 ? 1.0 : -1.0, v.y >= 0.0 ? 1.0 : -1.0); }
  float packNormal(vec3 n) {
    n /= abs(n.x) + abs(n.y) + abs(n.z);
    vec2 e = n.z >= 0.0 ? n.xy : (1.0 - abs(n.yx)) * signs(n.xy);
    vec2 q = floor(clamp(e * 0.5 + 0.5, 0.0, 1.0) * 4095.0 + 0.5);
    return q.x * 4096.0 + q.y;
  }
  vec3 unpackNormal(float v) {
    float x = floor(v / 4096.0);
    vec2 e = vec2(x, v - x * 4096.0) / 4095.0 * 2.0 - 1.0;
    vec3 n = vec3(e, 1.0 - abs(e.x) - abs(e.y));
    if (n.z < 0.0) n.xy = (1.0 - abs(n.yx)) * signs(n.xy);
    return normalize(n);
  }
  float packAlbedo(vec3 c) {
    vec3 q = floor(sqrt(clamp(c, 0.0, 1.0)) * 255.0 + 0.5);
    return q.r * 65536.0 + q.g * 256.0 + q.b;
  }
  vec3 unpackAlbedo(float v) {
    float r = floor(v / 65536.0);
    float g = floor((v - r * 65536.0) / 256.0);
    vec3 c = vec3(r, g, v - r * 65536.0 - g * 256.0) / 255.0;
    return c * c;
  }`;

/** Shared GLSL: guide lookups and the edge-stopping weight. */
const guideFunctions = /* glsl */ `
  uniform sampler2D tGuide;
  uniform float focusDistance; // thin-lens focus (world units)
  uniform float cocScale;      // blur radius in pixels = cocScale |z - f| / z
  const float LUMA_EPS = 1e-6;
  const float KERNEL[3] = float[3](0.25, 0.5, 0.25);
  ${packing}
  // relax: how far out of focus the pixel is (0 sharp, 1 blurred by the lens
  // beyond ~2.5 px): the sharp guides then no longer mark its edges, and it
  // is filtered without demodulation.
  struct Guide { vec3 normal; float depth; vec3 albedo; float gradient; float relax; };
  Guide readGuide(ivec2 p) {
    vec4 g = texelFetch(tGuide, p, 0);
    Guide r;
    r.depth = g.y;
    r.gradient = g.w;
    r.normal = g.y > 0.0 ? unpackNormal(g.x) : vec3(0.0);
    float coc = g.y > 0.0 ? cocScale * abs(g.y - focusDistance) / g.y : cocScale;
    r.relax = smoothstep(0.75, 2.5, coc);
    vec3 albedo = g.y > 0.0 ? max(unpackAlbedo(g.z), vec3(ALBEDO_FLOOR)) : vec3(1.0);
    r.albedo = mix(albedo, vec3(1.0), r.relax);
    return r;
  }
  float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
  float geometryWeight(Guide p, Guide q, float dist) {
    float relax = max(p.relax, q.relax);
    bool hp = p.depth > 0.0, hq = q.depth > 0.0;
    if (hp != hq) return relax;
    if (!hp) return 1.0;
    float wn = pow(max(0.0, dot(p.normal, q.normal)), SIGMA_N);
    float wz = exp(-abs(p.depth - q.depth) /
      (SIGMA_Z * max(p.gradient, 1e-3 * p.depth) * dist + 1e-4));
    return mix(wn * wz, 1.0, relax);
  }`;

/** Demodulate the traced image and estimate its per-pixel noise variance. */
const prepareFragment = /* glsl */ `
  precision highp float;
  uniform sampler2D tColor;
  uniform sampler2D tEarlier;
  uniform float noiseScale;   // earlier / (later - earlier); 0 = no snapshot
  uniform float spatialScale; // weight of the spatial fallback estimate
  ${guideFunctions}
  in vec2 vUv;
  layout(location = 0) out vec4 outColor;
  void main() {
    ivec2 p = ivec2(gl_FragCoord.xy);
    ivec2 size = textureSize(tColor, 0);
    Guide gp = readGuide(p);
    vec3 centre = texelFetch(tColor, p, 0).rgb / gp.albedo;
    // Noise: mean squared difference to the earlier snapshot (pure noise), or
    // the spatial variance of luminance when there is no snapshot yet; both
    // over the 3×3 neighbours on the same surface.
    float sum = 0.0, sumSq = 0.0, total = 0.0, diffSq = 0.0;
    for (int y = -1; y <= 1; y++)
      for (int x = -1; x <= 1; x++) {
        ivec2 q = clamp(p + ivec2(x, y), ivec2(0), size - 1);
        Guide gq = readGuide(q);
        float w = (x == 0 && y == 0) ? 1.0 : geometryWeight(gp, gq, 1.0);
        if (w < 0.05) continue;
        float l = luma(texelFetch(tColor, q, 0).rgb / gq.albedo);
        sum += l; sumSq += l * l; total += 1.0;
        if (noiseScale > 0.0) {
          float e = luma(texelFetch(tEarlier, q, 0).rgb / gq.albedo);
          diffSq += (l - e) * (l - e);
        }
      }
    float mean = sum / total;
    float variance = noiseScale > 0.0
      ? noiseScale * diffSq / total
      : spatialScale * max(0.0, sumSq / total - mean * mean);
    outColor = vec4(centre, variance);
  }`;

/** One à-trous pass over (demodulated colour, variance). */
const atrousFragment = /* glsl */ `
  precision highp float;
  uniform sampler2D tInput;
  uniform sampler2D tColor;
  uniform int stepSize;
  uniform bool finalPass;
  ${guideFunctions}
  in vec2 vUv;
  layout(location = 0) out vec4 outColor;
  void main() {
    ivec2 p = ivec2(gl_FragCoord.xy);
    ivec2 size = textureSize(tInput, 0);
    Guide gp = readGuide(p);
    vec4 cp = texelFetch(tInput, p, 0);
    float lp = luma(cp.rgb);
    // Gaussian-blurred variance at p steers the luminance weight (SVGF).
    float blurred = 0.0;
    for (int y = -1; y <= 1; y++)
      for (int x = -1; x <= 1; x++) {
        ivec2 q = clamp(p + ivec2(x, y), ivec2(0), size - 1);
        blurred += texelFetch(tInput, q, 0).a * KERNEL[x + 1] * KERNEL[y + 1];
      }
    float lumaScale = SIGMA_L * sqrt(max(blurred, 0.0)) + LUMA_EPS;
    vec3 sum = vec3(0.0);
    float variance = 0.0, total = 0.0;
    for (int y = -1; y <= 1; y++)
      for (int x = -1; x <= 1; x++) {
        ivec2 q = p + ivec2(x, y) * stepSize;
        if (any(lessThan(q, ivec2(0))) || any(greaterThanEqual(q, size))) continue;
        float h = KERNEL[x + 1] * KERNEL[y + 1];
        vec4 cq = texelFetch(tInput, q, 0);
        float w = h;
        if (x != 0 || y != 0) {
          float dist = float(stepSize) * length(vec2(x, y));
          w *= geometryWeight(gp, readGuide(q), dist);
          w *= exp(-abs(lp - luma(cq.rgb)) / lumaScale);
        }
        sum += cq.rgb * w;
        variance += cq.a * w * w;
        total += w;
      }
    vec3 filtered = sum / total;
    variance /= total * total;
    if (finalPass) outColor = vec4(filtered * gp.albedo, texelFetch(tColor, p, 0).a);
    else outColor = vec4(filtered, variance);
  }`;

/** Tone-mapped display values (0–255, unquantised) of an image on a sparse grid (noise estimates). */
const probeFragment = /* glsl */ `
  precision highp float;
  uniform sampler2D tColor;
  uniform vec2 stride;
  #include <tonemapping_pars_fragment>
  in vec2 vUv;
  layout(location = 0) out vec4 outColor;
  void main() {
    ivec2 p = ivec2(floor(gl_FragCoord.xy * stride));
    vec4 hdr = texelFetch(tColor, p, 0);
    float a = clamp(hdr.a, 0.0, 1.0);
    vec3 rgb = a > 0.0 ? hdr.rgb / a : vec3(0.0);
    #if defined(NEUTRAL_TONE_MAPPING)
      rgb = NeutralToneMapping(rgb);
    #elif defined(AGX_TONE_MAPPING)
      rgb = AgXToneMapping(rgb);
    #elif defined(ACES_FILMIC_TONE_MAPPING)
      rgb = ACESFilmicToneMapping(rgb);
    #endif
    // Display levels (0–255), unquantised.
    outColor = sRGBTransferOETF(vec4(rgb * a, 1.0)) * 255.0;
  }`;

const copyFragment = /* glsl */ `
  precision highp float;
  uniform sampler2D tColor;
  in vec2 vUv;
  layout(location = 0) out vec4 outColor;
  void main() { outColor = texelFetch(tColor, ivec2(gl_FragCoord.xy), 0); }`;

const guideVertex = /* glsl */ `
  in float slot;
  out vec3 vNormal;
  out vec3 vView;
  flat out int vSlot;
  void main() {
    vec4 view = modelViewMatrix * vec4(position, 1.0);
    vView = view.xyz;
    vNormal = normalize(normalMatrix * normal);
    vSlot = int(slot + 0.5);
    gl_Position = projectionMatrix * view;
  }`;
const guideFragment = /* glsl */ `
  precision highp float;
  uniform sampler2D slots;
  in vec3 vNormal;
  in vec3 vView;
  flat in int vSlot;
  layout(location = 0) out vec4 gGuide;
  ${packing}
  void main() {
    vec4 slot = texelFetch(slots, ivec2(vSlot, 0), 0);
    int flag = int(slot.a + 0.5);
    if (flag == ${GUIDE_SKIP} || (flag == ${GUIDE_FRONT_ONLY} && !gl_FrontFacing)) discard;
    vec3 n = normalize(vNormal);
    vec3 toCamera = isOrthographic ? vec3(0.0, 0.0, 1.0) : -vView;
    if (dot(n, toCamera) < 0.0) n = -n;
    float depth = -vView.z;
    gGuide = vec4(packNormal(n), depth, packAlbedo(slot.rgb),
      max(abs(dFdx(depth)), abs(dFdy(depth))));
  }`;

type Target = THREE.WebGLRenderTarget;
const floatTarget = (
  width: number,
  height: number,
  type: THREE.TextureDataType,
  filter: THREE.MagnificationTextureFilter = THREE.NearestFilter,
  withDepth = false,
) =>
  new THREE.WebGLRenderTarget(width, height, {
    type,
    format: THREE.RGBAFormat,
    magFilter: filter,
    minFilter: filter,
    depthBuffer: withDepth,
  });

/** Grid the noise probe samples (about this many pixels). */
const PROBE_PIXELS = 24_000;

export class PhotoDenoiser {
  private quad = new FullScreenQuad();
  private guideScene = new THREE.Scene();
  private guideMesh?: THREE.Mesh;
  private slotTexture?: THREE.DataTexture;
  private guideMaterial = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    uniforms: { slots: { value: null } },
    vertexShader: guideVertex,
    fragmentShader: guideFragment,
    side: THREE.DoubleSide,
    toneMapped: false,
  });
  private lens = {
    focusDistance: { value: 1 },
    cocScale: { value: 0 },
  };
  private defines = {
    ALBEDO_FLOOR: DENOISE_ALBEDO_FLOOR.toFixed(3),
    SIGMA_N: DENOISE_SIGMA.normal.toFixed(1),
    SIGMA_Z: DENOISE_SIGMA.depth.toFixed(2),
    SIGMA_L: DENOISE_SIGMA.luminance.toFixed(2),
  };
  private prepare = this.pass(prepareFragment, {
    tColor: { value: null },
    tEarlier: { value: null },
    noiseScale: { value: 0 },
    spatialScale: { value: 1 },
  });
  private atrous = this.pass(atrousFragment, {
    tInput: { value: null },
    tColor: { value: null },
    stepSize: { value: 1 },
    finalPass: { value: false },
  });
  private probeMaterial = this.pass(probeFragment, {
    tColor: { value: null },
    stride: { value: new THREE.Vector2(1, 1) },
    toneMappingExposure: { value: 1 },
  });
  private copy = this.pass(copyFragment, { tColor: { value: null } });
  private guides?: Target;
  private work: Target[] = [];
  private snapshots: Array<{ target: Target; samples: number }> = [];
  private probeTarget?: Target;
  private probePixels = new Float32Array(0);
  private width = 0;
  private height = 0;
  constructor(private renderer: THREE.WebGLRenderer) {}
  private pass(
    fragmentShader: string,
    uniforms: Record<string, THREE.IUniform>,
  ) {
    return new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      uniforms: {
        tGuide: { value: null },
        focusDistance: this.lens.focusDistance,
        cocScale: this.lens.cocScale,
        ...uniforms,
      },
      defines: { ...this.defines },
      vertexShader: quadVertex,
      fragmentShader,
      depthTest: false,
      depthWrite: false,
      blending: THREE.NoBlending,
      toneMapped: false,
    });
  }
  /**
   * The traced geometry (world space; position, normal and a per-vertex
   * `materialIndex`) and its material slots. The guide pass keeps GPU copies
   * only.
   */
  setGeometry(geometry: THREE.BufferGeometry, slots: readonly GuideSlot[]) {
    this.clearGeometry();
    const guide = new THREE.BufferGeometry();
    guide.setAttribute("position", geometry.getAttribute("position"));
    guide.setAttribute("normal", geometry.getAttribute("normal"));
    const index = geometry.getAttribute("materialIndex");
    const slot = new Float32Array(index.count);
    for (let i = 0; i < index.count; i++) slot[i] = index.getX(i);
    guide.setAttribute("slot", new THREE.BufferAttribute(slot, 1));
    guide.setIndex(geometry.index);
    // The GPU copies suffice once uploaded (the tracer keeps its own arrays of
    // positions and indices).
    for (const name of ["normal", "slot"])
      (guide.getAttribute(name) as THREE.BufferAttribute).onUpload(
        function (this: { array: unknown }) {
          this.array = null;
        },
      );
    const data = new Float32Array(Math.max(1, slots.length) * 4);
    slots.forEach((s, i) =>
      data.set([s.color.r, s.color.g, s.color.b, s.flag], i * 4),
    );
    this.slotTexture = new THREE.DataTexture(
      data,
      Math.max(1, slots.length),
      1,
      THREE.RGBAFormat,
      THREE.FloatType,
    );
    this.slotTexture.needsUpdate = true;
    this.guideMaterial.uniforms.slots.value = this.slotTexture;
    this.guideMesh = new THREE.Mesh(guide, this.guideMaterial);
    this.guideMesh.frustumCulled = false;
    this.guideMesh.matrixAutoUpdate = false;
    this.guideScene.add(this.guideMesh);
  }
  /** Change one slot (the stage's colour follows the background). */
  setSlot(index: number, slot: GuideSlot) {
    const texture = this.slotTexture;
    if (!texture || index >= texture.image.width) return;
    const data = texture.image.data as Float32Array;
    data.set([slot.color.r, slot.color.g, slot.color.b, slot.flag], index * 4);
    texture.needsUpdate = true;
  }
  private clearGeometry() {
    if (this.guideMesh) {
      this.guideScene.remove(this.guideMesh);
      // The position, normal and index attributes belong to the tracer's copy.
      this.guideMesh.geometry.dispose();
      this.guideMesh = undefined;
    }
    this.slotTexture?.dispose();
    this.slotTexture = undefined;
  }
  /** Allocate targets for an image of this size (keeps them when unchanged). */
  setSize(width: number, height: number) {
    if (width === this.width && height === this.height && this.guides) return;
    this.releaseTargets();
    this.width = width;
    this.height = height;
    this.guides = floatTarget(
      width,
      height,
      THREE.FloatType,
      THREE.NearestFilter,
      true,
    );
    const half = THREE.HalfFloatType;
    this.work = [
      floatTarget(width, height, half),
      floatTarget(width, height, half),
      floatTarget(width, height, half, THREE.LinearFilter),
    ];
  }
  /** Rasterise the guides (normal, depth, albedo) for a view. */
  renderGuides(camera: THREE.Camera) {
    if (!this.guides || !this.guideMesh) return;
    const renderer = this.renderer;
    const target = renderer.getRenderTarget();
    const clear = renderer.getClearColor(new THREE.Color());
    const clearAlpha = renderer.getClearAlpha();
    const autoClear = renderer.autoClear;
    const background = this.guideScene.background;
    try {
      renderer.setRenderTarget(this.guides);
      // Cleared to "no surface" (depth 0).
      renderer.setClearColor(0x000000, 0);
      renderer.clear(true, true, false);
      renderer.autoClear = false;
      renderer.render(this.guideScene, camera);
    } finally {
      this.guideScene.background = background;
      renderer.autoClear = autoClear;
      renderer.setClearColor(clear, clearAlpha);
      renderer.setRenderTarget(target);
    }
  }
  /**
   * The lens of the traced view: out-of-focus pixels (thin-lens blur circle
   * over about a pixel) are filtered across the sharp guides' edges.
   * `cocScale` is the blur radius in pixels of a point at infinity.
   */
  setLens(focusDistance: number, cocScale: number) {
    this.lens.focusDistance.value = focusDistance;
    this.lens.cocScale.value = cocScale;
  }
  /** Forget the noise snapshots (the still restarted). */
  reset() {
    for (const s of this.snapshots) s.target.dispose();
    this.snapshots = [];
  }
  /**
   * Keep a copy of the accumulation at `samples` whole samples: later noise is
   * measured against it. Two are kept, so the one in use is at most half the
   * current count (its difference then averages at least as many samples).
   */
  snapshot(texture: THREE.Texture, samples: number) {
    if (!this.guides) return;
    const last = this.snapshots[this.snapshots.length - 1];
    if (last && last.samples >= samples) return;
    let entry: { target: Target; samples: number };
    if (this.snapshots.length >= 2) entry = this.snapshots.shift()!;
    else
      entry = {
        target: floatTarget(this.width, this.height, THREE.HalfFloatType),
        samples: 0,
      };
    entry.samples = samples;
    this.copy.uniforms.tColor.value = texture;
    this.draw(this.copy, entry.target);
    this.snapshots.push(entry);
  }
  /** Whether a snapshot should be taken at this sample count (powers of two). */
  wantsSnapshot(samples: number) {
    if (!Number.isInteger(samples) || samples < 1) return false;
    if ((samples & (samples - 1)) !== 0) return false;
    const last = this.snapshots[this.snapshots.length - 1];
    return !last || last.samples < samples;
  }
  private earlier(samples: number) {
    let best: { target: Target; samples: number } | undefined;
    for (const s of this.snapshots)
      if (s.samples * 2 <= samples && (!best || s.samples > best.samples))
        best = s;
    return best;
  }
  /** Denoise the traced image at `samples` samples; returns the result
   * (premultiplied linear HDR, bilinear-filtered for upscaling). */
  denoise(texture: THREE.Texture, samples: number): THREE.Texture {
    if (!this.guides) return texture;
    const [a, b, output] = this.work;
    for (const material of [this.prepare, this.atrous])
      material.uniforms.tGuide.value = this.guides.texture;
    const earlier = this.earlier(samples);
    const prepare = this.prepare.uniforms;
    prepare.tColor.value = texture;
    prepare.tEarlier.value = earlier?.target.texture ?? null;
    prepare.noiseScale.value = earlier
      ? earlier.samples / (samples - earlier.samples)
      : 0;
    // Without a snapshot, the spatial variance also holds signal: count half.
    prepare.spatialScale.value = 0.5;
    this.draw(this.prepare, a);
    let source = a,
      next = b;
    for (let i = 0; i < ATROUS_PASSES; i++) {
      const last = i === ATROUS_PASSES - 1;
      const uniforms = this.atrous.uniforms;
      uniforms.tInput.value = source.texture;
      uniforms.tColor.value = texture;
      uniforms.stepSize.value = 1 << i;
      uniforms.finalPass.value = last;
      const target = last ? output : next;
      this.draw(this.atrous, target);
      next = source;
      source = target;
    }
    return output.texture;
  }
  /**
   * Tone-mapped display values of `texture` on a sparse grid, for comparing
   * presentations at two sample counts (estimateNoise).
   */
  probe(
    texture: THREE.Texture,
    toneMapping: THREE.ToneMapping,
    exposure: number,
  ) {
    const width = this.width,
      height = this.height;
    const stride = Math.max(1, Math.sqrt((width * height) / PROBE_PIXELS));
    const pw = Math.max(1, Math.floor(width / stride)),
      ph = Math.max(1, Math.floor(height / stride));
    if (
      !this.probeTarget ||
      this.probeTarget.width !== pw ||
      this.probeTarget.height !== ph
    ) {
      this.probeTarget?.dispose();
      this.probeTarget = new THREE.WebGLRenderTarget(pw, ph, {
        type: THREE.FloatType,
        depthBuffer: false,
      });
      this.probePixels = new Float32Array(pw * ph * 4);
    }
    const material = this.probeMaterial;
    material.uniforms.tColor.value = texture;
    material.uniforms.stride.value.set(width / pw, height / ph);
    material.uniforms.toneMappingExposure.value = exposure;
    const defines = material.defines as Record<string, unknown>;
    const want = {
      NEUTRAL_TONE_MAPPING: toneMapping === THREE.NeutralToneMapping,
      AGX_TONE_MAPPING: toneMapping === THREE.AgXToneMapping,
      ACES_FILMIC_TONE_MAPPING: toneMapping === THREE.ACESFilmicToneMapping,
    };
    let changed = false;
    for (const [key, on] of Object.entries(want)) {
      if (on && !(key in defines)) {
        defines[key] = "";
        changed = true;
      } else if (!on && key in defines) {
        delete defines[key];
        changed = true;
      }
    }
    if (changed) material.needsUpdate = true;
    this.draw(material, this.probeTarget);
    this.renderer.readRenderTargetPixels(
      this.probeTarget,
      0,
      0,
      pw,
      ph,
      this.probePixels,
    );
    return this.probePixels.slice();
  }
  private draw(material: THREE.Material, target: Target) {
    const renderer = this.renderer;
    const previous = renderer.getRenderTarget();
    this.quad.material = material;
    renderer.setRenderTarget(target);
    this.quad.render(renderer);
    renderer.setRenderTarget(previous);
  }
  /** Free the image-sized targets (kept: shaders and the guide geometry). */
  releaseTargets() {
    this.guides?.dispose();
    this.guides = undefined;
    this.work.forEach((t) => t.dispose());
    this.work = [];
    this.reset();
    this.probeTarget?.dispose();
    this.probeTarget = undefined;
    this.width = this.height = 0;
  }
  dispose() {
    this.releaseTargets();
    this.clearGeometry();
    for (const m of [
      this.guideMaterial,
      this.prepare,
      this.atrous,
      this.probeMaterial,
      this.copy,
    ])
      m.dispose();
    this.quad.dispose();
  }
}
