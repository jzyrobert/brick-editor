import RAPIER from "@dimforge/rapier3d-compat";
import { Quaternion, Vector3 } from "three";
import type { Vec3 } from "../core/types";
import type { RigidGroup } from "../mechanisms/types";
import type { PlayMechanismSource } from "./mechanism";
import type { MechanicalSolid } from "./mechanical-solids";
import { frameRotation, METRES_PER_LDU } from "./physics-frame";
import {
  requireArocsBallRestConstruction,
  readPreparedArocsBallRest,
  type PreparedArocsBallRest,
} from "./arocs-ball-rest";
import {
  compileArocsBallRestCovers,
  readArocsBallNativeCover,
  type ArocsBallNativeCover,
} from "./arocs-ball-native-covers";

const compiled = new WeakMap<
  PreparedArocsBallRest,
  readonly ArocsBallNativeCover[]
>();
const bindings = new WeakMap<object, ArocsBallNativeCover>();
/** Group-local queries and identity-rest native bodies use separate poses of
 * the same canonical children. Only the sealed native cover is attached to a
 * native seating body; inverse/re-forward rotation never recreates its hull. */
export function arocsBallRestMemberSolids(
  source: PlayMechanismSource,
  group: RigidGroup,
  id: string,
): MechanicalSolid[] | undefined {
  const tokens = requireArocsBallRestConstruction(source);
  for (const token of tokens) {
    const seal = readPreparedArocsBallRest(token),
      member = [seal.ball, seal.socket].find(
        (m) => m.id === id && m.groupId === group.id,
      );
    if (!member) continue;
    let covers = compiled.get(token);
    if (!covers) {
      covers = compileArocsBallRestCovers(token);
      compiled.set(token, covers);
    }
    const inverseQ = frameRotation(group.frame).conjugate().normalize();
    return covers.flatMap((cover) => {
      const d = readArocsBallNativeCover(token, cover);
      if ((d.member === "ball" ? seal.ball.id : seal.socket.id) !== id)
        return [];
      const points: number[] = [],
        bounds = {
          min: [Infinity, Infinity, Infinity] as Vec3,
          max: [-Infinity, -Infinity, -Infinity] as Vec3,
        };
      let radius = 0;
      for (let k = 0; k < d.points.length; k += 3) {
        const p = new Vector3(
          d.points[k],
          d.points[k + 1],
          d.points[k + 2],
        ).applyQuaternion(inverseQ);
        radius = Math.max(radius, p.length());
        const values = [p.x, p.y, p.z];
        points.push(...values);
        values.forEach((v, axis) => {
          bounds.min[axis] = Math.min(bounds.min[axis], v);
          bounds.max[axis] = Math.max(bounds.max[axis], v);
        });
      }
      const solid: MechanicalSolid = {
        groupId: group.id,
        memberId: id,
        shape: new RAPIER.Compound(
          cover.shape.shapes,
          cover.shape.positions.map((p) =>
            new Vector3(p.x, p.y, p.z).applyQuaternion(inverseQ),
          ),
          cover.shape.rotations.map((q) =>
            inverseQ.clone().multiply(new Quaternion(q.x, q.y, q.z, q.w)),
          ),
        ),
        points: Float32Array.from(points),
        bounds,
        radius: radius / METRES_PER_LDU,
        childCount: cover.childCount,
        mating: new Set(),
      };
      bindings.set(solid, cover);
      return [solid];
    });
  }
}
export const isArocsBallRestSolid = (solid: object) => bindings.has(solid);
export const arocsBallRestNativeCover = (solid: object) => bindings.get(solid);
