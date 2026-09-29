import * as THREE from "three";
import { LDrawLoader } from "./vendor/LDrawLoader.js";
import { LDrawConditionalLineMaterial } from "three/addons/materials/LDrawConditionalLineMaterial.js";
import { ensure } from "../core/types";

type Context = { source: string; forceDoubleSided: boolean };
type Palette = { loader: LDrawLoader; direct: Map<string, THREE.Material> };
const parse = (loader: LDrawLoader, source: string) =>
  new Promise<THREE.Group>((resolve, reject) =>
    (
      loader.parse as unknown as (
        s: string,
        done: (g: THREE.Group) => void,
        fail: (e: unknown) => void,
      ) => void
    )(source, resolve, reject),
  );

/**
 * The pinned loader emits a reversed twin for every non-certified (double-sided) face and
 * then smooths across the shared reversed edges, which cancels the pair's normals to zero or
 * to a normalized rounding residue. Such vertices render unlit black. Replace any vertex
 * normal that is degenerate or does not face its own triangle with that triangle's normal.
 */
export function repairFaceNormals(root: THREE.Object3D) {
  const a = new THREE.Vector3(),
    b = new THREE.Vector3(),
    c = new THREE.Vector3(),
    face = new THREE.Vector3(),
    n = new THREE.Vector3();
  root.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    const position = mesh.geometry.getAttribute("position");
    const normal = mesh.geometry.getAttribute("normal");
    if (!position || !normal || mesh.geometry.index) return;
    let changed = false;
    for (let i = 0; i + 2 < position.count; i += 3) {
      a.fromBufferAttribute(position, i);
      b.fromBufferAttribute(position, i + 1);
      c.fromBufferAttribute(position, i + 2);
      face.subVectors(b, a).cross(c.sub(b));
      if (face.lengthSq() === 0) continue;
      face.normalize();
      for (let v = i; v < i + 3; v++) {
        n.fromBufferAttribute(normal, v);
        if (n.lengthSq() > 0.25 && n.dot(face) > 0.1 * n.length()) continue;
        normal.setXYZ(v, face.x, face.y, face.z);
        changed = true;
      }
    }
    if (changed) normal.needsUpdate = true;
  });
  return root;
}

/** Uses the pinned loader for primitive winding, triangulation, edge and conditional-line semantics.
 * Shared materials belong to this compiler; occurrence prototypes own only their geometry.
 */
export class RawPrimitiveCompiler {
  private palettes = new Map<string, Promise<Palette>>();
  private contexts = new Map<string, Promise<Palette>>();
  private materials = new Set<THREE.Material>();
  private disposed = false;
  private doubleSided = new WeakMap<THREE.Material, THREE.Material>();
  constructor(private readonly baseColorText: string) {}
  get metrics() {
    return { palettes: this.palettes.size, materials: this.materials.size };
  }
  private remember(material: THREE.Material) {
    ensure(
      this.materials.has(material) || this.materials.size < 8192,
      "LIMIT_EXCEEDED",
      "Raw primitive palette exceeds 8,192 material objects.",
    );
    this.materials.add(material);
    material.userData.rawPrimitiveShared = true;
    return material;
  }
  private palette(context: string): Promise<Palette> {
    const contextCached = this.contexts.get(context);
    if (contextCached) return contextCached;
    const definitions = new Map<string, string>();
    for (const line of (this.baseColorText + "\n" + context).split(/\r?\n/)) {
      if (!/^0\s+!COLOUR\s/i.test(line)) continue;
      const code = line.match(/\sCODE\s+(\S+)/i)?.[1];
      if (code) definitions.set(code, line);
    }
    const entries = [...definitions].sort(([a], [b]) => a.localeCompare(b));
    const key = entries.map(([, line]) => line).join("\n");
    const cached = this.palettes.get(key);
    if (cached) {
      if (this.contexts.size < 2048) this.contexts.set(context, cached);
      return cached;
    }
    ensure(
      this.palettes.size < 256 && entries.length <= 1024,
      "LIMIT_EXCEEDED",
      "Raw primitive compilation supports at most 256 effective palettes and 1,024 colors per palette.",
    );
    const promise = (async () => {
      const manager = new THREE.LoadingManager();
      manager.setURLModifier(() => {
        throw new Error("Raw primitives cannot resolve external references");
      });
      const loader = new LDrawLoader(manager);
      // One isolated primitive has no neighbours to smooth with; smoothing would only pair a
      // non-certified face with its own reversed twin and cancel both normals.
      loader.smoothNormals = false;
      loader.setConditionalLineMaterial(LDrawConditionalLineMaterial);
      loader.setMaterials([]);
      const rememberLoaderMaterials = () => {
        const internal = loader as unknown as {
          edgeMaterialCache: WeakMap<THREE.Material, THREE.Material>;
          conditionalEdgeMaterialCache: WeakMap<THREE.Material, THREE.Material>;
          missingColorMaterial: THREE.Material;
          missingEdgeColorMaterial: THREE.Material;
          missingConditionalEdgeColorMaterial: THREE.Material;
        };
        for (const face of [
          ...loader.materials,
          internal.missingColorMaterial,
        ]) {
          this.remember(face);
          const edge = internal.edgeMaterialCache.get(face);
          if (edge) {
            this.remember(edge);
            const conditional = internal.conditionalEdgeMaterialCache.get(edge);
            if (conditional) this.remember(conditional);
          }
        }
        this.remember(internal.missingEdgeColorMaterial);
        this.remember(internal.missingConditionalEdgeColorMaterial);
      };
      rememberLoaderMaterials();
      // Parse definitions once through the loader, including its finish/alpha/color-space rules.
      // Seed one face per color to obtain the scoped materials, never source model geometry.
      const seed = await parse(
        loader,
        key +
          "\n0 BFC CERTIFY CCW\n" +
          entries.map(([code]) => `3 ${code} 0 0 0 1 0 0 0 1 0`).join("\n"),
      );
      const scoped = new Set<THREE.Material>();
      seed.traverse((object) => {
        const mesh = object as THREE.Mesh;
        if (mesh.material)
          for (const material of Array.isArray(mesh.material)
            ? mesh.material
            : [mesh.material])
            scoped.add(material);
        mesh.geometry?.dispose();
      });
      loader.setMaterials([...scoped]);
      rememberLoaderMaterials();
      return { loader, direct: new Map<string, THREE.Material>() };
    })();
    this.palettes.set(key, promise);
    if (this.contexts.size < 2048) this.contexts.set(context, promise);
    return promise;
  }
  async compile(
    raw: string,
    colorCode: string,
    context: Context,
  ): Promise<THREE.Group> {
    ensure(
      !this.disposed,
      "INVALID_ARGUMENT",
      "Raw primitive compiler is disposed.",
    );
    ensure(
      /^[2-5]\s/.test(raw.trim()) && !/[\r\n]/.test(raw),
      "INVALID_ARGUMENT",
      "Expected one raw LDraw primitive record.",
    );
    ensure(
      /^\S+$/.test(colorCode),
      "INVALID_ARGUMENT",
      "Expected one LDraw color token.",
    );
    const palette = await this.palette(context.source);
    const bfc = context.source
      .split(/\r?\n/)
      .filter((line) => /^0\s+BFC\s/.test(line))
      .join("\n");
    const line = raw.replace(/^(\s*[2-5])\s+\S+/, `$1 ${colorCode}`);
    const group = await parse(palette.loader, bfc + "\n" + line);
    if (this.disposed) {
      group.traverse((object) => (object as THREE.Mesh).geometry?.dispose());
      this.dispose();
      ensure(
        false,
        "INVALID_ARGUMENT",
        "Raw primitive compiler was disposed during compilation.",
      );
    }
    repairFaceNormals(group);
    group.userData.rawPrimitive = true;
    group.traverse((object) => {
      const drawable = object as THREE.Mesh;
      if (!drawable.material) return;
      const intern = (material: THREE.Material) => {
        const kind = (
          object as THREE.LineSegments & { isConditionalLine?: boolean }
        ).isConditionalLine
          ? "conditional"
          : (object as THREE.LineSegments).isLineSegments
            ? "line"
            : "face";
        // The loader creates a new direct-color material on each lookup; intern that exact color/type.
        const key = kind + ":" + colorCode + ":" + context.forceDoubleSided;
        if (colorCode.startsWith("0x2")) {
          const existing = palette.direct.get(key);
          if (existing) {
            material.dispose();
            return existing;
          }
        }
        if (context.forceDoubleSided) {
          let clone = this.doubleSided.get(material);
          if (!clone) {
            clone = material.clone();
            clone.side = THREE.DoubleSide;
            this.doubleSided.set(material, clone);
          }
          if (colorCode.startsWith("0x2")) material.dispose();
          material = clone;
        }
        if (colorCode.startsWith("0x2")) palette.direct.set(key, material);
        return this.remember(material);
      };
      drawable.material = Array.isArray(drawable.material)
        ? drawable.material.map(intern)
        : intern(drawable.material);
      drawable.castShadow = true;
      drawable.receiveShadow = true;
    });
    return group;
  }
  dispose() {
    this.disposed = true;
    for (const material of this.materials) material.dispose();
    this.materials.clear();
    this.palettes.clear();
    this.contexts.clear();
  }
}
