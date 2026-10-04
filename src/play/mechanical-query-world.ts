import RAPIER from "@dimforge/rapier3d-compat";
import { ensure } from "../core/types";
import { MECHANICAL_CONTACT_LIMITS } from "./mechanical-solids";
import {
  DrivingObstacleSnapshot,
  type DrivingTriangleSource,
} from "./vehicle-obstacles";

/** One bounded private query world shared by all kinematic rigs in Play. */
export class MechanicalQueryWorld {
  private queryWorld?: RAPIER.World;
  private queryColliders = new WeakMap<RAPIER.Shape, RAPIER.Collider>();
  private queryUsage = { colliders: 0, vertices: 0, triangles: 0 };
  private staticSupport?: {
    collider: RAPIER.Collider;
    shape: RAPIER.Shape;
    triangles: DrivingObstacleSnapshot;
  };
  /** Register only the session's immutable aggregate static mesh. Build once
   * during source preparation, under the existing complete-world triangle cap. */
  registerStaticSupport(
    collider: RAPIER.Collider,
    source: DrivingTriangleSource,
  ) {
    ensure(
      collider.isValid(),
      "INVALID_INPUT",
      "Static support requires a live collider",
    );
    const p = collider.translation(),
      q = collider.rotation();
    ensure(
      p.x === 0 &&
        p.y === 0 &&
        p.z === 0 &&
        q.x === 0 &&
        q.y === 0 &&
        q.z === 0 &&
        q.w === 1,
      "INVALID_INPUT",
      "Static support source requires its original world-space pose",
    );
    const shape = collider.shape;
    ensure(
      shape instanceof RAPIER.TriMesh &&
        shape.vertices.length === source.vertices.length &&
        shape.indices.length === source.indices.length &&
        shape.vertices.every((v, k) => v === source.vertices[k]) &&
        shape.indices.every((v, k) => v === source.indices[k]),
      "INVALID_INPUT",
      "Static support must match the actual complete native mesh",
    );
    this.staticSupport = {
      collider,
      shape,
      triangles: new DrivingObstacleSnapshot([source], 1000000),
    };
  }
  hasStaticSupport(collider: RAPIER.Collider) {
    if (
      !collider.isValid() ||
      this.staticSupport?.collider !== collider ||
      this.staticSupport.shape !== collider.shape
    )
      return false;
    const p = collider.translation(),
      q = collider.rotation();
    return (
      p.x === 0 &&
      p.y === 0 &&
      p.z === 0 &&
      q.x === 0 &&
      q.y === 0 &&
      q.z === 0 &&
      q.w === 1
    );
  }
  certifyStaticYSupport(
    collider: RAPIER.Collider,
    query: [number, number, number, number, number, number],
    minimum: number,
    maximum: number,
    guard: number,
    workLimit: number,
  ) {
    const support = this.staticSupport;
    if (!support || !this.hasStaticSupport(collider)) return undefined;
    return support.triangles.certifyInvariantYSlab(
      query,
      minimum,
      maximum,
      guard,
      workLimit,
    );
  }
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
    this.staticSupport = undefined;
    this.queryWorld?.free();
    this.queryWorld = undefined;
    this.queryColliders = new WeakMap();
    this.queryUsage = { colliders: 0, vertices: 0, triangles: 0 };
  }
}
