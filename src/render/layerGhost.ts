import * as THREE from "three";
import { registerTreatment } from "./batching";
import type {
  Materials,
  OccurrenceHandle,
  Treatment,
} from "./occurrence-handles";
/**
 * A see-through view treatment (ghosted layers or floors, dimmed instruction
 * steps) of chosen occurrences. It marks their handles; the batches and any
 * materialized tree draw them with transparent clones of their materials.
 * Shared prototype materials are never mutated. Treatments nest: a handle
 * treated twice draws a clone of the first treatment's clone.
 */
export class LayerGhost implements Treatment {
  constructor(
    private readonly opacity = 0.18,
    private readonly pale = false,
  ) {}
  private treated: OccurrenceHandle[] = [];
  private clones = new Map<THREE.Material, THREE.Material>();
  /** Whether any occurrence is currently treated. */
  get active() {
    return this.treated.length > 0;
  }
  /** Whether this treatment applies to a handle. */
  treats(handle: OccurrenceHandle) {
    return !!handle.treatments?.includes(this);
  }
  private clone(material: THREE.Material) {
    let copy = this.clones.get(material);
    if (!copy) {
      copy = material.clone();
      copy.transparent = !this.pale;
      copy.opacity = this.pale ? 1 : material.opacity * this.opacity;
      copy.depthWrite = this.pale;
      if (this.pale) {
        const styled = copy as THREE.Material & {
          color?: THREE.Color;
          map?: THREE.Texture | null;
          uniforms?: Record<string, { value: unknown }>;
        };
        const edge =
          material.type.includes("Line") || material.type === "ShaderMaterial";
        const color = new THREE.Color(edge ? "#727b84" : "#d1d5d9");
        styled.color?.copy(color);
        if (styled.uniforms?.diffuse?.value instanceof THREE.Color)
          styled.uniforms.diffuse.value.copy(color);
        if ("map" in styled) styled.map = null;
      }
      // Batches keep the base material's buckets and only refill them.
      registerTreatment(copy, material);
      this.clones.set(material, copy);
    }
    return copy;
  }
  treat(materials: Materials): Materials {
    return Array.isArray(materials)
      ? materials.map((m) => this.clone(m))
      : this.clone(materials);
  }
  restore() {
    for (const handle of this.treated) {
      const list = handle.treatments?.filter((t) => t !== this);
      handle.treatments = list?.length ? list : null;
      handle.restyle();
    }
    this.treated = [];
    for (const material of this.clones.values()) material.dispose();
    this.clones.clear();
  }
  apply(
    handles: ReadonlyMap<string, OccurrenceHandle>,
    ids: ReadonlySet<string>,
  ) {
    this.restore();
    for (const id of ids) {
      const handle = handles.get(id);
      if (!handle) continue;
      (handle.treatments ??= []).push(this);
      this.treated.push(handle);
      handle.restyle();
    }
  }
}
