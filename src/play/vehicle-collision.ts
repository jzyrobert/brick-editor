import RAPIER from "@dimforge/rapier3d-compat";
import { Quaternion, Vector3 } from "three";
import { ensure } from "../core/types";

/** Prototype only. Rapier metres, +Y up; yaw rotates around +Y.
 * Boxes are explicit conservative proxies, NOT inferred from part names.
 * A wheel cylinder with local X axle can use [halfWidth,radius,radius].
 * Geometry containment/provenance must be certified before runtime integration. */
export type DrivingBox = {
  center: [number, number, number];
  halfExtents: [number, number, number];
};
export type DrivingPose = { x: number; y: number; z: number; yaw: number };
export type DrivingObstacle = {
  collider: RAPIER.Collider;
  owner: { kind: "static" | "actor" } | { kind: "rig"; rigId: string };
};
export type DrivingSweep = {
  accepted: boolean;
  queries: number;
  segments: number;
  reason?: "contact" | "work-budget";
  colliderHandle?: number;
  /** World-space point of the first contact (obstacle provenance lookup). */
  point?: { x: number; y: number; z: number };
};
/** Deliberately bounded f32 query domain; values outside it are unsupported,
 * never clamped or written back to authored data. */
export const DRIVING_QUERY_DOMAIN = Object.freeze({
  maxCoordinateMetres: 10000,
  maxExtentMetres: 1000,
  maxTranslationMetres: 100,
  maxAbsYawRadians: 10000,
});
export const drivingCoordinate = (n: number) =>
  Number.isFinite(n) && Math.abs(n) <= DRIVING_QUERY_DOMAIN.maxCoordinateMetres;
const zero = { x: 0, y: 0, z: 0 };
const skin = 0.00001; // 0.0005 LDU at the current gameplay scale of 0.02 m/LDU.
const maxAngularEnvelope = 0.005; // 5 mm conservative horizontal inflation.
const maxSegments = 128;
const maxQueries = 16384;
const maxBoxes = 32;
const maxObstacles = 512;
const yawRotation = (yaw: number) => ({
  x: 0,
  y: Math.sin(yaw / 2),
  z: 0,
  w: Math.cos(yaw / 2),
});

/** A certified upper bound from actual collider geometry, never caller labels.
 * Mixed floor/wall meshes retain their wall height and cannot be exempted.
 * Unsupported shape families return undefined and receive ordinary casts. */
function upperBound(
  collider: RAPIER.Collider,
  budget: { vertices: number },
): number | undefined {
  const rotation = new Quaternion().copy(collider.rotation());
  const translation = collider.translation();
  ensure(
    [translation.x, translation.y, translation.z].every(drivingCoordinate) &&
      [rotation.x, rotation.y, rotation.z, rotation.w].every(Number.isFinite) &&
      Math.abs(rotation.lengthSq() - 1) < 0.00001,
    "INVALID_INPUT",
    "Driving obstacle pose exceeds the supported metre domain",
  );
  if (collider.shapeType() === RAPIER.ShapeType.Cuboid) {
    const e = collider.halfExtents()!;
    const x = new Vector3(e.x, 0, 0).applyQuaternion(rotation);
    const y = new Vector3(0, e.y, 0).applyQuaternion(rotation);
    const z = new Vector3(0, 0, e.z).applyQuaternion(rotation);
    ensure(
      [e.x, e.y, e.z].every(
        (n) =>
          Number.isFinite(n) &&
          n > 0 &&
          n <= DRIVING_QUERY_DOMAIN.maxExtentMetres,
      ),
      "INVALID_INPUT",
      "Driving obstacle extents exceed the supported metre domain",
    );
    for (const axis of ["x", "y", "z"] as const)
      ensure(
        Math.abs(translation[axis]) +
          Math.abs(x[axis]) +
          Math.abs(y[axis]) +
          Math.abs(z[axis]) <=
          DRIVING_QUERY_DOMAIN.maxCoordinateMetres,
        "INVALID_INPUT",
        "Driving obstacle bounds exceed the supported metre domain",
      );
    return translation.y + Math.abs(x.y) + Math.abs(y.y) + Math.abs(z.y);
  }
  if (collider.shapeType() === RAPIER.ShapeType.TriMesh) {
    const vertices = collider.vertices();
    // Bounded prototype: large source meshes need cached bounds/BVH integration.
    ensure(
      vertices.length <= 60000,
      "LIMIT_EXCEEDED",
      "Driving prototype obstacle exceeds 20,000 vertices",
    );
    budget.vertices += vertices.length / 3;
    ensure(
      budget.vertices <= 200000,
      "LIMIT_EXCEEDED",
      "Driving prototype obstacle bounds exceed 200,000 vertices",
    );
    let top = -Infinity;
    const point = new Vector3();
    for (let i = 0; i < vertices.length; i += 3) {
      point
        .set(vertices[i], vertices[i + 1], vertices[i + 2])
        .applyQuaternion(rotation);
      ensure(
        [
          point.x + translation.x,
          point.y + translation.y,
          point.z + translation.z,
        ].every(drivingCoordinate),
        "INVALID_INPUT",
        "Driving obstacle vertices exceed the supported metre domain",
      );
      top = Math.max(top, point.y + translation.y);
    }
    return top;
  }
  ensure(
    false,
    "INVALID_INPUT",
    "Driving queries currently support only bounded cuboid and triangle-mesh obstacles",
  );
}

/** Pure query: commits no collider/body/vehicle state. The caller must atomically
 * commit vehicle + rider only after their separate clearance checks succeed.
 * Conservative envelopes cover all yaw angles, including between sample poses;
 * endpoint-only overlap tests would miss thin obstacles during turns.
 * Initial non-support contact refuses movement, including uncertified tangency.
 * This intentionally favors false blocks over an ignored mixed-mesh wall. */
export function sweepDrivingBoxes(
  rigId: string,
  boxes: readonly DrivingBox[],
  from: DrivingPose,
  to: DrivingPose,
  obstacles: readonly DrivingObstacle[],
  allowVertical = false,
): DrivingSweep {
  ensure(
    boxes.length > 0 &&
      boxes.length <= maxBoxes &&
      obstacles.length <= maxObstacles,
    "LIMIT_EXCEEDED",
    "Driving prototype supports 1–32 boxes and at most 512 obstacle candidates",
  );
  ensure(
    [from.x, from.y, from.z, to.x, to.y, to.z].every(drivingCoordinate) &&
      [from.yaw, to.yaw].every(
        (n) =>
          Number.isFinite(n) &&
          Math.abs(n) <= DRIVING_QUERY_DOMAIN.maxAbsYawRadians,
      ) &&
      Math.hypot(to.x - from.x, to.y - from.y, to.z - from.z) <=
        DRIVING_QUERY_DOMAIN.maxTranslationMetres &&
      (allowVertical || from.y === to.y),
    "INVALID_INPUT",
    "Driving sweep requires bounded finite planar poses at constant height",
  );
  let radius = 0;
  for (const box of boxes) {
    ensure(
      box.center.length === 3 &&
        box.halfExtents.length === 3 &&
        box.center.every(drivingCoordinate) &&
        box.halfExtents.every(
          (n) =>
            Number.isFinite(n) &&
            n > 0 &&
            n <= DRIVING_QUERY_DOMAIN.maxExtentMetres,
        ),
      "INVALID_INPUT",
      "Driving boxes require finite centers and positive extents",
    );
    radius = Math.max(
      radius,
      Math.hypot(
        Math.abs(box.center[0]) + box.halfExtents[0],
        Math.abs(box.center[2]) + box.halfExtents[2],
      ),
    );
  }
  ensure(
    [from, to].every(
      (pose) =>
        Math.abs(pose.x) + radius + 0.008 <=
          DRIVING_QUERY_DOMAIN.maxCoordinateMetres &&
        Math.abs(pose.z) + radius + 0.008 <=
          DRIVING_QUERY_DOMAIN.maxCoordinateMetres &&
        boxes.every(
          (box) =>
            Math.abs(pose.y + box.center[1]) + box.halfExtents[1] <=
            DRIVING_QUERY_DOMAIN.maxCoordinateMetres,
        ),
    ),
    "INVALID_INPUT",
    "Driving swept bounds exceed the supported metre domain",
  );
  const angle = to.yaw - from.yaw;
  const segments = Math.max(
    1,
    Math.ceil((Math.abs(angle) * radius) / maxAngularEnvelope),
  );
  const foreign = obstacles.filter(
    (o) => o.owner.kind !== "rig" || o.owner.rigId !== rigId,
  );
  // Reserve contact+cast for every pair; refuse before any query or mutation.
  if (
    !Number.isFinite(segments) ||
    segments > maxSegments ||
    segments * boxes.length * foreign.length * 2 > maxQueries
  )
    return { accepted: false, queries: 0, segments, reason: "work-budget" };
  const boundsBudget = { vertices: 0 };
  const tops = foreign.map((o) => upperBound(o.collider, boundsBudget));
  let queries = 0;
  for (let step = 0; step < segments; step++) {
    const fraction = step / segments;
    const yaw = from.yaw + angle * fraction;
    const rot = yawRotation(yaw);
    const velocity = {
      x: (to.x - from.x) / segments,
      y: (to.y - from.y) / segments,
      z: (to.z - from.z) / segments,
    };
    const margin = radius * Math.abs(angle / segments);
    for (const box of boxes) {
      const center = new Vector3(...box.center).applyQuaternion(
        new Quaternion().copy(rot),
      );
      const position = {
        x: from.x + (to.x - from.x) * fraction + center.x,
        y: from.y + (to.y - from.y) * fraction + center.y,
        z: from.z + (to.z - from.z) * fraction + center.z,
      };
      const shape = new RAPIER.Cuboid(
        box.halfExtents[0] + margin,
        box.halfExtents[1],
        box.halfExtents[2] + margin,
      );
      const bottom =
        Math.min(position.y, position.y + velocity.y) - box.halfExtents[1];
      for (let i = 0; i < foreign.length; i++) {
        const collider = foreign[i].collider;
        // Every point of this collider lies below the proxy throughout planar
        // travel. Up to skin numerical penetration is the only support tolerance.
        if (tops[i] !== undefined && tops[i]! <= bottom + skin) continue;
        queries++;
        const contact = collider.contactShape(shape, position, rot, 0);
        if (contact && contact.distance <= 0)
          return {
            accepted: false,
            queries,
            segments,
            reason: "contact",
            colliderHandle: collider.handle,
            point: { ...contact.point1 },
          };
        queries++;
        const hit = collider.castShape(
          zero,
          shape,
          position,
          rot,
          velocity,
          0,
          1,
          true,
        );
        if (hit) {
          // The witness is in the obstacle collider's local space.
          const t = collider.translation(),
            w = new Vector3(hit.witness1.x, hit.witness1.y, hit.witness1.z)
              .applyQuaternion(new Quaternion().copy(collider.rotation()))
              .add(new Vector3(t.x, t.y, t.z));
          return {
            accepted: false,
            queries,
            segments,
            reason: "contact",
            colliderHandle: collider.handle,
            point: { x: w.x, y: w.y, z: w.z },
          };
        }
      }
    }
  }
  return { accepted: true, queries, segments };
}
