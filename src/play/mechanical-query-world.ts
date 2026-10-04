import RAPIER from "@dimforge/rapier3d-compat";
import { ensure } from "../core/types";
import { MECHANICAL_CONTACT_LIMITS } from "./mechanical-solids";

/** One bounded private query world shared by all kinematic rigs in Play. */
export class MechanicalQueryWorld {
  private queryWorld?: RAPIER.World;
  private queryColliders = new WeakMap<RAPIER.Shape, RAPIER.Collider>();
  private queryUsage = { colliders: 0, vertices: 0, triangles: 0 };
  collider(shape: RAPIER.Shape) {
    const old = this.queryColliders.get(shape);
    if (old) return old;
    const count = (
      s: RAPIER.Shape,
    ): { vertices: number; triangles: number } => {
      if (s instanceof RAPIER.Compound)
        return s.shapes.reduce(
          (n, c) => {
            const v = count(c);
            return {
              vertices: n.vertices + v.vertices,
              triangles: n.triangles + v.triangles,
            };
          },
          { vertices: 0, triangles: 0 },
        );
      if (s instanceof RAPIER.TriMesh)
        return {
          vertices: s.vertices.length / 3,
          triangles: s.indices.length / 3,
        };
      if (s instanceof RAPIER.ConvexPolyhedron)
        return {
          vertices: s.vertices.length / 3,
          triangles: s.indices ? s.indices.length / 3 : 0,
        };
      if (s instanceof RAPIER.Triangle) return { vertices: 3, triangles: 1 };
      if (s instanceof RAPIER.Segment) return { vertices: 2, triangles: 0 };
      return { vertices: 0, triangles: 0 };
    };
    const usage = count(shape);
    ensure(
      this.queryUsage.colliders + 1 <=
        MECHANICAL_CONTACT_LIMITS.queryColliders &&
        this.queryUsage.vertices + usage.vertices <=
          MECHANICAL_CONTACT_LIMITS.queryVertices &&
        this.queryUsage.triangles + usage.triangles <=
          MECHANICAL_CONTACT_LIMITS.queryTriangles,
      "LIMIT_EXCEEDED",
      "This mechanism is too complex to check safely. Try fewer moving parts.",
      {
        limit: "queryWorld",
        maximum: MECHANICAL_CONTACT_LIMITS,
        actual: { ...this.queryUsage, next: usage },
      },
    );
    this.queryWorld ??= new RAPIER.World({ x: 0, y: 0, z: 0 });
    const collider = this.queryWorld.createCollider(
      new RAPIER.ColliderDesc(shape),
    );
    this.queryUsage.colliders++;
    this.queryUsage.vertices += usage.vertices;
    this.queryUsage.triangles += usage.triangles;
    this.queryColliders.set(shape, collider);
    return collider;
  }
  dispose() {
    this.queryWorld?.free();
    this.queryWorld = undefined;
    this.queryColliders = new WeakMap();
    this.queryUsage = { colliders: 0, vertices: 0, triangles: 0 };
  }
}
