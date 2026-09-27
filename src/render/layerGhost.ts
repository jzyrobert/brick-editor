import * as THREE from "three";
/** Temporary per-object materials. Shared prototype materials are never mutated. */
export class LayerGhost {
  private originals = new Map<
    THREE.Mesh,
    { material: THREE.Material | THREE.Material[]; shadow: boolean }
  >();
  private clones = new Map<THREE.Material, THREE.Material>();
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
        copy.opacity = material.opacity * 0.18;
        copy.depthWrite = false;
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
