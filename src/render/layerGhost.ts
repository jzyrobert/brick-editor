import * as THREE from "three";
import { registerTreatment } from "./batching";
/** Temporary per-object materials. Shared prototype materials are never mutated. */
export class LayerGhost {
  constructor(private readonly opacity = 0.18) {}
  private originals = new Map<
    THREE.Mesh,
    { material: THREE.Material | THREE.Material[]; shadow: boolean }
  >();
  private clones = new Map<THREE.Material, THREE.Material>();
  /** Whether any object currently carries a temporary material. */
  get active() {
    return this.originals.size > 0;
  }
  restore() {
    for (const [object, original] of this.originals) {
      object.material = original.material;
      object.castShadow = original.shadow;
    }
    this.originals.clear();
    for (const material of this.clones.values()) material.dispose();
    this.clones.clear();
  }
  apply(handles: ReadonlyMap<string, THREE.Group>, ids: ReadonlySet<string>) {
    this.restore();
    const clone = (material: THREE.Material) => {
      let copy = this.clones.get(material);
      if (!copy) {
        copy = material.clone();
        copy.transparent = true;
        copy.opacity = material.opacity * this.opacity;
        copy.depthWrite = false;
        // Batches keep the base material's buckets and only refill them.
        registerTreatment(copy, material);
        this.clones.set(material, copy);
      }
      return copy;
    };
    for (const [id, group] of handles)
      if (ids.has(id))
        group.traverse((object) => {
          const mesh = object as THREE.Mesh;
          if (!mesh.material) return;
          this.originals.set(mesh, {
            material: mesh.material,
            shadow: mesh.castShadow,
          });
          mesh.material = Array.isArray(mesh.material)
            ? mesh.material.map(clone)
            : clone(mesh.material);
          mesh.castShadow = false;
        });
  }
}
