import * as THREE from "three";
import {
  BACKDROPS,
  DEFAULT_BACKDROP,
  requireBackdrop,
  type BackdropName,
} from "../core/scene";
import {
  grassTexture,
  horizonTexture,
  random,
  sandTexture,
  seaTexture,
  streetTexture,
  studioTexture,
  variationTexture,
  type HorizonKind,
} from "./environment-textures";

/**
 * Scene backdrops in three.js: a sky dome, a textured ground that follows the
 * camera (texture coordinates come from world position, so the pattern stays
 * put and the ground is effectively endless) and a band of horizon
 * silhouettes. The ground fades to the sky's horizon colour with distance
 * (in the material, not scene fog, so builds are never fogged).
 *
 * Composition with the render looks: the ground is an ordinary lit
 * MeshLambertMaterial that receives shadows, so the Realistic/Photo shadows and
 * screen-space AO land on it; the sky and horizon are unlit meshes drawn into
 * the same HDR frame, so the look pipeline's tone mapping applies to them too.
 * The environment owns no lights. Cost: three extra draw calls (sky, ground,
 * horizon), one or two small texture lookups per ground pixel.
 *
 * Units are LDU in renderer world space (Y up); the visible ground sits just
 * below Y=0, where Play's session-only ground collider is.
 */
type GroundSpec = {
  /** Texture drawn at `tile` LDU per repeat. */
  texture: () => HTMLCanvasElement;
  tile: number;
  /** World-space offset of the pattern, in tiles. */
  offset?: [number, number];
  /** Multiplies the texture (dims the night map). */
  tint?: string;
  /** Large-scale brightness variation that breaks up the repeat. */
  variation?: { tile: number; amount: number };
  /** A second surface outside a noisy circle round the origin (beach → sea). */
  outer?: {
    texture: () => HTMLCanvasElement;
    tile: number;
    radius: number;
    noise: number;
    foam: string;
    wet: string;
  };
};
type Preset = {
  ground: GroundSpec;
  /** The ground's colour for the Photo path tracer, which traces no textures. */
  traceColor: string;
  horizon?: HorizonKind;
  stars?: boolean;
};

/** Street map tile: 1024 px for 2560 LDU (2.5 LDU per pixel). Roads 300 LDU. */
const STREET_TILE = 2560;
/** Put the origin in a lane of the vertical road, between two junctions. */
const STREET_OFFSET: [number, number] = [-0.03, 0.25];

const PRESETS: Record<Exclude<BackdropName, "blank">, Preset> = {
  grass: {
    ground: {
      texture: () => grassTexture(),
      tile: 768,
      variation: { tile: 7200, amount: 0.22 },
    },
    traceColor: "#6b9651",
    horizon: "hills",
  },
  street: {
    ground: {
      texture: () => streetTexture(1024, false),
      tile: STREET_TILE,
      offset: STREET_OFFSET,
      variation: { tile: 9000, amount: 0.08 },
    },
    traceColor: "#7f8a7a",
    horizon: "town",
  },
  beach: {
    ground: {
      texture: () => sandTexture(),
      tile: 512,
      variation: { tile: 5000, amount: 0.12 },
      outer: {
        texture: () => seaTexture(),
        tile: 1536,
        radius: 2600,
        noise: 900,
        foam: "#f4fbff",
        wet: "#b99c63",
      },
    },
    traceColor: "#dcc592",
    horizon: "islands",
  },
  night: {
    ground: {
      texture: () => streetTexture(1024, true),
      tile: STREET_TILE,
      offset: STREET_OFFSET,
      tint: "#8e96b0",
    },
    traceColor: "#2a2f3a",
    horizon: "skyline",
    stars: true,
  },
  studio: {
    ground: {
      texture: () => studioTexture(),
      tile: 1600,
    },
    traceColor: "#dcdee0",
  },
};

const GROUND_Y = -0.6;
const HORIZON_HEIGHT = 1600;

const groundVertex = /* glsl */ `
varying vec2 vEnvXZ;
`;
const groundFragment = /* glsl */ `
varying vec2 vEnvXZ;
uniform sampler2D uGroundTex;
uniform vec2 uTileScale;
uniform vec2 uTileOffset;
uniform vec3 uHorizon;
uniform vec3 uEye;
uniform float uFadeNear;
uniform float uFadeFar;
#ifdef ENV_VARIATION
uniform sampler2D uVariation;
uniform float uVarScale;
uniform float uVarAmount;
#endif
#ifdef ENV_OUTER
uniform sampler2D uOuterTex;
uniform float uOuterScale;
uniform float uZoneRadius;
uniform float uZoneNoise;
uniform vec3 uFoam;
uniform vec3 uWet;
#endif
`;
const groundMapFragment = /* glsl */ `
vec3 envColor = texture2D(uGroundTex, vEnvXZ * uTileScale + uTileOffset).rgb;
#ifdef ENV_VARIATION
float envVar = texture2D(uVariation, vEnvXZ * uVarScale).r;
envColor *= mix(1.0 - uVarAmount, 1.0 + uVarAmount, envVar);
#endif
#ifdef ENV_OUTER
{
  float n = texture2D(uVariation, vEnvXZ * uVarScale * 3.0).r - 0.5;
  float r = length(vEnvXZ) + n * uZoneNoise;
  vec3 outer = texture2D(uOuterTex, vEnvXZ * uOuterScale).rgb;
  float wet = smoothstep(uZoneRadius - 260.0, uZoneRadius - 20.0, r);
  envColor = mix(envColor, uWet, wet * 0.55);
  float sea = smoothstep(uZoneRadius - 10.0, uZoneRadius + 30.0, r);
  envColor = mix(envColor, outer, sea);
  float foam = 1.0 - smoothstep(0.0, 45.0, abs(r - uZoneRadius - 30.0));
  envColor = mix(envColor, uFoam, foam * 0.85);
}
#endif
diffuseColor.rgb *= envColor;
`;
const groundFadeFragment = /* glsl */ `
{
  // uEye: the camera (three only feeds cameraPosition to some materials).
  // z < 0 marks an orthographic view, which is never faded.
  float envD = uEye.z < 0.0 ? 0.0 : length(vEnvXZ - uEye.xy);
  outgoingLight = mix(outgoingLight, uHorizon, smoothstep(uFadeNear, uFadeFar, envD));
}
#include <opaque_fragment>
`;

/**
 * A flat unit disc (Y up) in rings that double in radius from 1/1024 of the
 * edge. A plain fan of 64 huge triangles from under the camera to the far
 * edge is clipped at the near plane with poor depth precision on some GPUs
 * (SwiftShader drew it over the build); small inner rings keep every triangle
 * near the camera small. About 1,500 triangles.
 */
function polarGround(segments = 64) {
  const radii = [0];
  for (let r = 1 / 1024; r < 1; r *= 2) radii.push(r);
  radii.push(1);
  const positions: number[] = [],
    index: number[] = [];
  for (const r of radii)
    for (let s = 0; s < segments; s++) {
      const a = (s / segments) * Math.PI * 2;
      positions.push(Math.cos(a) * r, 0, -Math.sin(a) * r);
    }
  for (let i = 0; i < radii.length - 1; i++)
    for (let s = 0; s < segments; s++) {
      const a = i * segments + s,
        b = i * segments + ((s + 1) % segments),
        c = (i + 1) * segments + s,
        d = (i + 1) * segments + ((s + 1) % segments);
      index.push(a, c, b, b, c, d);
    }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3),
  );
  geometry.setAttribute(
    "normal",
    new THREE.Float32BufferAttribute(
      positions.map((_, i) => (i % 3 === 1 ? 1 : 0)),
      3,
    ),
  );
  geometry.setIndex(index);
  return geometry;
}

function linear(hex: string) {
  return new THREE.Color(hex); // three stores colours linear (sRGB input).
}

function texture(
  source: HTMLCanvasElement,
  anisotropy: number,
  repeat = true,
): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(source);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = repeat ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  t.wrapT = repeat ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.anisotropy = anisotropy;
  t.needsUpdate = true;
  return t;
}

export type EnvironmentStats = {
  name: BackdropName;
  drawn: boolean;
  objects: number;
  textures: Array<{ width: number; height: number }>;
  /** Approximate GPU bytes of the textures, mipmaps included. */
  textureBytes: number;
  /** Milliseconds spent drawing the textures when the backdrop was chosen. */
  buildMs: number;
};

/** The ground mesh moves in steps this large (its texture coordinates are
 * world-fixed, so the steps never show); a still camera keeps the Photo
 * tracer's cached scene. */
const GROUND_STEP = 4096;

export class SceneEnvironment {
  /** Sky, stars and horizon: drawn only by the raster looks. */
  readonly group = new THREE.Group();
  /** The ground, flagged `userData.photoStage`: the Photo path tracer traces
   * it (with `photoMaterial`) in place of its studio sweep. */
  readonly stage = new THREE.Group();
  private current: BackdropName = DEFAULT_BACKDROP;
  private textures: THREE.Texture[] = [];
  private disposables: Array<{ dispose(): void }> = [];
  private sky?: THREE.Mesh;
  private stars?: THREE.Points;
  private ground?: THREE.Mesh<THREE.BufferGeometry, THREE.MeshLambertMaterial>;
  private groundUniforms?: Record<string, THREE.IUniform>;
  private horizon?: THREE.Mesh;
  private buildMs = 0;
  private drawn = true;
  private mobile = false;
  constructor(private maxAnisotropy = 4) {
    this.group.name = "backdrop";
    this.stage.name = "backdrop stage";
    this.stage.userData.photoStage = true;
  }
  /** Phones sample with less anisotropy and a half-size horizon band. */
  private get anisotropy() {
    return Math.min(this.mobile ? 4 : 8, this.maxAnisotropy);
  }
  setMobile(mobile: boolean) {
    if (mobile === this.mobile) return false;
    this.mobile = mobile;
    const name = this.current;
    if (name === "blank") return false;
    this.clear();
    this.build(PRESETS[name], name);
    return true;
  }
  get name() {
    return this.current;
  }
  /** Whether a textured ground is drawn (the shadow-catcher plane then hides). */
  get hasGround() {
    return !!this.ground && this.drawn;
  }
  /** Fallback background colour for this backdrop. */
  get background() {
    return BACKDROPS[this.current].background;
  }
  set(name: BackdropName) {
    requireBackdrop(name);
    if (name === this.current) return false;
    this.clear();
    this.current = name;
    if (name !== "blank") this.build(PRESETS[name], name);
    return true;
  }
  /** Hide or show everything (transparent captures draw no backdrop). */
  setDrawn(drawn: boolean) {
    this.drawn = drawn;
    this.group.visible = drawn && this.current !== "blank";
    this.stage.visible = this.group.visible;
  }
  private build(preset: Preset, name: BackdropName) {
    const start = performance.now();
    const spec = BACKDROPS[name];
    const horizonColor = linear(spec.sky!.horizon),
      topColor = linear(spec.sky!.top);
    // Sky dome: vertex colours from horizon to zenith, drawn first and behind
    // everything (no depth), scaled to the camera's far plane each frame.
    const skyGeometry = new THREE.SphereGeometry(1, 32, 16);
    const colors: number[] = [];
    const position = skyGeometry.getAttribute("position");
    const color = new THREE.Color();
    for (let i = 0; i < position.count; i++) {
      const y = position.getY(i);
      const t = y <= 0 ? 0 : Math.pow(y, 0.55);
      color.copy(horizonColor).lerp(topColor, t);
      colors.push(color.r, color.g, color.b);
    }
    skyGeometry.setAttribute(
      "color",
      new THREE.Float32BufferAttribute(colors, 3),
    );
    const skyMaterial = new THREE.MeshBasicMaterial({
      vertexColors: true,
      side: THREE.BackSide,
      depthTest: false,
      depthWrite: false,
      fog: false,
    });
    this.sky = new THREE.Mesh(skyGeometry, skyMaterial);
    this.sky.name = "backdrop sky";
    this.sky.renderOrder = -1000;
    this.sky.frustumCulled = false;
    this.sky.raycast = () => {};
    this.group.add(this.sky);
    this.disposables.push(skyGeometry, skyMaterial);
    if (preset.stars) {
      const rand = random(23);
      const points: number[] = [];
      for (let i = 0; i < 420; i++) {
        const theta = rand() * Math.PI * 2,
          y = 0.08 + rand() * 0.92,
          r = Math.sqrt(1 - y * y);
        points.push(
          Math.cos(theta) * r * 0.98,
          y * 0.98,
          Math.sin(theta) * r * 0.98,
        );
      }
      const starGeometry = new THREE.BufferGeometry();
      starGeometry.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(points, 3),
      );
      const starMaterial = new THREE.PointsMaterial({
        color: 0xfdf6e0,
        size: 1.6,
        sizeAttenuation: false,
        depthTest: false,
        depthWrite: false,
        fog: false,
      });
      this.stars = new THREE.Points(starGeometry, starMaterial);
      this.stars.renderOrder = -999;
      this.stars.frustumCulled = false;
      this.stars.raycast = () => {};
      this.sky.add(this.stars);
      this.disposables.push(starGeometry, starMaterial);
    }
    // Ground.
    const g = preset.ground;
    const groundTexture = texture(g.texture(), this.anisotropy);
    this.textures.push(groundTexture);
    const uniforms: Record<string, THREE.IUniform> = {
      uGroundTex: { value: groundTexture },
      uTileScale: { value: new THREE.Vector2(1 / g.tile, -1 / g.tile) },
      uTileOffset: { value: new THREE.Vector2(...(g.offset ?? [0, 0])) },
      uHorizon: { value: horizonColor.clone() },
      uEye: { value: new THREE.Vector3() },
      uFadeNear: { value: 3000 },
      uFadeFar: { value: 10000 },
    };
    const defines: Record<string, string> = {};
    if (g.variation || g.outer) {
      const variation = texture(variationTexture(), this.anisotropy);
      this.textures.push(variation);
      uniforms.uVariation = { value: variation };
      uniforms.uVarScale = { value: 1 / (g.variation?.tile ?? 6000) };
      uniforms.uVarAmount = { value: g.variation?.amount ?? 0 };
      defines.ENV_VARIATION = "";
    }
    if (g.outer) {
      const outer = texture(g.outer.texture(), this.anisotropy);
      this.textures.push(outer);
      uniforms.uOuterTex = { value: outer };
      uniforms.uOuterScale = { value: 1 / g.outer.tile };
      uniforms.uZoneRadius = { value: g.outer.radius };
      uniforms.uZoneNoise = { value: g.outer.noise };
      uniforms.uFoam = { value: linear(g.outer.foam) };
      uniforms.uWet = { value: linear(g.outer.wet) };
      defines.ENV_OUTER = "";
    }
    const groundMaterial = new THREE.MeshLambertMaterial({
      color: g.tint ?? "#ffffff",
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 4,
      fog: false,
    });
    groundMaterial.defines = defines;
    groundMaterial.name = "backdrop ground";
    groundMaterial.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, uniforms);
      shader.vertexShader =
        groundVertex +
        shader.vertexShader.replace(
          "#include <fog_vertex>",
          "#include <fog_vertex>\nvEnvXZ = (modelMatrix * vec4(transformed, 1.0)).xz;",
        );
      shader.fragmentShader =
        groundFragment +
        shader.fragmentShader
          .replace("#include <map_fragment>", groundMapFragment)
          .replace("#include <opaque_fragment>", groundFadeFragment);
    };
    groundMaterial.customProgramCacheKey = () =>
      "backdrop-ground:" + Object.keys(defines).sort().join(",");
    const groundGeometry = polarGround();
    this.ground = new THREE.Mesh(groundGeometry, groundMaterial);
    this.ground.name = "backdrop ground";
    this.ground.position.y = GROUND_Y;
    this.ground.receiveShadow = true;
    this.ground.frustumCulled = false;
    this.ground.renderOrder = -500;
    this.ground.raycast = () => {};
    this.groundUniforms = uniforms;
    const traced = new THREE.MeshPhysicalMaterial({
      color: preset.traceColor,
      roughness: 0.9,
      metalness: 0,
    });
    groundMaterial.userData.photoMaterial = traced;
    this.stage.add(this.ground);
    this.disposables.push(traced);
    this.disposables.push(groundGeometry, groundMaterial);
    // Horizon silhouettes: an open cylinder round the camera.
    if (preset.horizon) {
      const horizonTex = texture(
        horizonTexture(
          preset.horizon,
          spec.sky!.horizon,
          this.mobile ? 1024 : 2048,
          this.mobile ? 128 : 256,
        ),
        this.anisotropy,
      );
      horizonTex.wrapT = THREE.ClampToEdgeWrapping;
      horizonTex.repeat.set(4, 1);
      this.textures.push(horizonTex);
      const horizonGeometry = new THREE.CylinderGeometry(1, 1, 1, 96, 1, true);
      horizonGeometry.translate(0, 0.5, 0);
      const horizonMaterial = new THREE.MeshBasicMaterial({
        map: horizonTex,
        transparent: true,
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
      });
      this.horizon = new THREE.Mesh(horizonGeometry, horizonMaterial);
      this.horizon.name = "backdrop horizon";
      this.horizon.frustumCulled = false;
      this.horizon.renderOrder = -900;
      this.horizon.raycast = () => {};
      this.group.add(this.horizon);
      this.disposables.push(horizonGeometry, horizonMaterial);
    }
    this.group.visible = this.drawn;
    this.stage.visible = this.drawn;
    this.buildMs = performance.now() - start;
  }
  /** Follow the camera: sky and horizon stay centred on it, the ground under it. */
  update(camera: THREE.Camera) {
    if (this.current === "blank" || !this.group.visible) return;
    const perspective = (camera as THREE.PerspectiveCamera).isPerspectiveCamera;
    const far = (camera as THREE.PerspectiveCamera).far || 50000;
    const p = camera.position;
    const horizonRadius = Math.min(12000, far * 0.6);
    if (this.sky) {
      this.sky.visible = !!perspective;
      this.sky.position.copy(p);
      this.sky.scale.setScalar(far * 0.9);
    }
    if (this.horizon) {
      this.horizon.visible = !!perspective;
      this.horizon.position.set(p.x, GROUND_Y - 10, p.z);
      this.horizon.scale.set(horizonRadius, HORIZON_HEIGHT, horizonRadius);
    }
    if (this.ground) {
      const radius = Math.min(far * 0.85, 30000);
      this.ground.position.set(
        Math.round(p.x / GROUND_STEP) * GROUND_STEP,
        GROUND_Y,
        Math.round(p.z / GROUND_STEP) * GROUND_STEP,
      );
      this.ground.scale.setScalar(radius);
      const u = this.groundUniforms!;
      (u.uEye.value as THREE.Vector3).set(p.x, p.z, perspective ? 1 : -1);
      u.uFadeFar.value = horizonRadius * 0.92;
      u.uFadeNear.value = Math.min(2600, horizonRadius * 0.25);
    }
    this.group.updateMatrixWorld(true);
    this.stage.updateMatrixWorld(true);
  }
  stats(): EnvironmentStats {
    const textures = this.textures.map((t) => {
      const image = t.image as { width: number; height: number };
      return { width: image.width, height: image.height };
    });
    return {
      name: this.current,
      drawn: this.drawn && this.current !== "blank",
      objects: this.group.children.length + this.stage.children.length,
      textures,
      textureBytes: Math.round(
        textures.reduce((sum, t) => sum + t.width * t.height * 4 * (4 / 3), 0),
      ),
      buildMs: Math.round(this.buildMs * 10) / 10,
    };
  }
  private clear() {
    for (const child of [...this.group.children]) this.group.remove(child);
    for (const child of [...this.stage.children]) this.stage.remove(child);
    for (const t of this.textures) t.dispose();
    for (const d of this.disposables) d.dispose();
    this.textures = [];
    this.disposables = [];
    this.sky = this.stars = this.ground = this.horizon = undefined;
    this.groundUniforms = undefined;
    this.buildMs = 0;
  }
  dispose() {
    this.clear();
    this.current = DEFAULT_BACKDROP;
  }
}
