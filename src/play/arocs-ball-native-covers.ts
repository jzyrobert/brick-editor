import RAPIER from "@dimforge/rapier3d-compat";
import { Quaternion, Vector3 } from "three";
import { identity, mv } from "../core/math";
import { ensure, type Transform, type Vec3 } from "../core/types";
import { frameRotation, toPhysics } from "./physics-frame";
import {
  readPreparedArocsBallRest,
  type PreparedArocsBallRest,
} from "./arocs-ball-rest";

export type ArocsBallNativeCover = Readonly<{
  shape: RAPIER.Compound;
  childCount: number;
}>;
type Details = Readonly<{
  prepared: PreparedArocsBallRest;
  member: "ball" | "socket";
  role: string;
  endpoint?: number;
  bodyRest: Transform;
  anchor: RAPIER.Vector;
  points: readonly number[];
}>;
const covers = new WeakMap<ArocsBallNativeCover, Details>();
/** Canonical native shape handoff. World-rest bodies match DynamicRig's
 * identity quaternion convention; source basis is baked into child poses. */
export function compileArocsBallRestCovers(
  prepared: PreparedArocsBallRest,
  convention: "member" | "world-rest" = "world-rest",
): readonly ArocsBallNativeCover[] {
  const sealed = readPreparedArocsBallRest(prepared),
    result: ArocsBallNativeCover[] = [];
  for (const [i, m] of [sealed.ball, sealed.socket].entries()) {
    const group = sealed.source.project.motionRigs[
        sealed.source.rigId
      ].groups.find((g) => g.id === m.groupId)!,
      bodyRest: Transform =
        convention === "member"
          ? structuredClone(m.frame)
          : { position: [...group.frame.position], basis: identity().basis },
      bodyQ = frameRotation(bodyRest).normalize(),
      sourceQ = frameRotation(m.frame).normalize(),
      q = bodyQ.clone().conjugate().multiply(sourceQ).normalize(),
      offset = new Vector3(...Object.values(toPhysics(m.frame.position)))
        .sub(toPhysics(bodyRest.position))
        .applyQuaternion(bodyQ.clone().conjugate()),
      joint = sealed.source.project.motionRigs[sealed.source.rigId].joints.find(
        (j) => j.id === prepared.jointId,
      )!,
      groupAnchor = joint.bodyA === group.id ? joint.anchorA : joint.anchorB,
      anchor =
        convention === "member"
          ? toPhysics(m.anchor)
          : toPhysics(mv(group.frame.basis, groupAnchor));
    for (const c of m.packet.classes) {
      const shapes: RAPIER.Shape[] = [],
        positions: RAPIER.Vector[] = [],
        points: number[] = [];
      for (const raw of c.pieces) {
        const piece = raw as unknown as Vec3[],
          center = [0, 1, 2].map(
            (k) => piece.reduce((s, p) => s + p[k], 0) / piece.length,
          ) as Vec3,
          vertices = Float32Array.from(
            piece.flatMap((p) =>
              Object.values(toPhysics(p.map((n, k) => n - center[k]) as Vec3)),
            ),
          ),
          desc = RAPIER.ColliderDesc.convexHull(vertices);
        ensure(
          desc,
          "INVALID_INPUT",
          "A source ball seating cover could not be checked safely.",
        );
        const position = new Vector3(...Object.values(toPhysics(center)))
            .applyQuaternion(q)
            .add(offset),
          nativePosition = {
            x: Math.fround(position.x),
            y: Math.fround(position.y),
            z: Math.fround(position.z),
          },
          nativeQ = new Quaternion(
            Math.fround(q.x),
            Math.fround(q.y),
            Math.fround(q.z),
            Math.fround(q.w),
          );
        shapes.push(desc.shape);
        positions.push(nativePosition);
        for (let k = 0; k < vertices.length; k += 3) {
          const p = new Vector3(vertices[k], vertices[k + 1], vertices[k + 2])
            .applyQuaternion(nativeQ)
            .add(nativePosition);
          points.push(p.x, p.y, p.z);
        }
      }
      const shape = new RAPIER.Compound(
          shapes,
          positions,
          shapes.map(() => q),
        ),
        cover = Object.freeze({ shape, childCount: shapes.length });
      Object.freeze(bodyRest.position);
      Object.freeze(bodyRest.basis);
      Object.freeze(bodyRest);
      covers.set(
        cover,
        Object.freeze({
          prepared,
          member: i ? "socket" : "ball",
          role: c.id,
          endpoint: "endpoint" in c ? c.endpoint : undefined,
          bodyRest,
          anchor: Object.freeze({
            x: Math.fround(anchor.x),
            y: Math.fround(anchor.y),
            z: Math.fround(anchor.z),
          }),
          points: Object.freeze(points),
        }),
      );
      result.push(cover);
    }
  }
  ensure(
    result.reduce((n, c) => n + c.childCount, 0) === prepared.childCount,
    "INVALID_INPUT",
    "Native seating requires every reviewed source child.",
  );
  return Object.freeze(result);
}

/** Only compiler-created cover identities can describe a native bearing class. */
export function readArocsBallNativeCover(
  prepared: PreparedArocsBallRest,
  cover: ArocsBallNativeCover,
): Details {
  const d = covers.get(cover);
  ensure(
    d?.prepared === prepared,
    "INVALID_INPUT",
    "Native seating needs the exact reviewed cover identity.",
  );
  readPreparedArocsBallRest(prepared);
  return d;
}
