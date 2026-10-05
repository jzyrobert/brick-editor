import RAPIER from "@dimforge/rapier3d-compat";
import { Vector3 } from "three";
import { add, compose, inverse, mv, orthonormalized } from "../core/math";
import { ensure, type Transform, type Vec3 } from "../core/types";
import type { RigidGroup } from "../mechanisms/types";
import type { PlayMechanismSource } from "./mechanism";
import type { MechanicalSolid } from "./mechanical-solids";
import { frameRotation, toPhysics, METRES_PER_LDU } from "./physics-frame";
import {
  boundArocsBallMember,
  boundArocsBallPairs,
} from "./arocs-ball-binding";
export { loadArocsBallContacts, arocsBallJointIds } from "./arocs-ball-binding";
const metadata = new WeakMap<
  MechanicalSolid,
  { memberId: string; role: string; endpoint?: number }
>();
const point = (f: Transform, p: Vec3) => add(f.position, mv(f.basis, p));
const gap = (a: Vec3, b: Vec3) => Math.hypot(...a.map((v, k) => v - b[k]));
/** Flat native compounds preserve canonical child geometry through member poses. */
export function arocsBallMemberSolids(
  source: PlayMechanismSource,
  group: RigidGroup,
  id: string,
): MechanicalSolid[] | undefined {
  const member = boundArocsBallMember(source, group, id);
  if (!member) return;
  const local = member.local;
  const relative = compose(inverse(group.frame), orthonormalized(local.frame)),
    q = frameRotation(relative).normalize(),
    t = toPhysics(relative.position);
  const out: MechanicalSolid[] = [];
  for (const c of member.packet.classes) {
    if (!c.pieces.length) continue;
    const shapes: RAPIER.Shape[] = [],
      positions: RAPIER.Vector[] = [],
      points: number[] = [];
    for (const piece of c.pieces) {
      ensure(
        piece.length >= 4 &&
          piece.length <= 256 &&
          piece.every((p) => p.every(Number.isFinite)),
        "INVALID_INPUT",
        "Invalid reviewed ball-joint cover.",
      );
      const center = piece[0].map(
        (_, k) => piece.reduce((s, p) => s + p[k], 0) / piece.length,
      ) as Vec3;
      const vertices = Float32Array.from(
        piece.flatMap((p) => {
          const v = toPhysics(p.map((v, k) => v - center[k]) as Vec3);
          return [v.x, v.y, v.z];
        }),
      );
      const desc = RAPIER.ColliderDesc.convexHull(vertices);
      ensure(
        desc,
        "INVALID_INPUT",
        "A ball-joint cover could not be checked safely.",
      );
      shapes.push(desc.shape);
      const cp = new Vector3(
        ...Object.values(toPhysics(center)),
      ).applyQuaternion(q);
      positions.push({ x: cp.x + t.x, y: cp.y + t.y, z: cp.z + t.z });
      for (const p of piece) {
        const v = new Vector3(...Object.values(toPhysics(p))).applyQuaternion(
          q,
        );
        points.push(v.x + t.x, v.y + t.y, v.z + t.z);
      }
    }
    const bounds = {
      min: [Infinity, Infinity, Infinity] as Vec3,
      max: [-Infinity, -Infinity, -Infinity] as Vec3,
    };
    for (let i = 0; i < points.length; i++) {
      const k = i % 3;
      bounds.min[k] = Math.min(bounds.min[k], points[i]);
      bounds.max[k] = Math.max(bounds.max[k], points[i]);
    }
    const solid: MechanicalSolid = {
      groupId: group.id,
      memberId: id,
      shape: new RAPIER.Compound(
        shapes,
        positions,
        shapes.map(() => q),
      ),
      points: Float32Array.from(points),
      bounds,
      childCount: shapes.length,
      radius:
        Math.max(
          ...Array.from({ length: points.length / 3 }, (_, i) =>
            Math.hypot(...points.slice(i * 3, i * 3 + 3)),
          ),
        ) / METRES_PER_LDU,
      mating: new Set(),
    };
    metadata.set(solid, { memberId: id, role: c.id, endpoint: c.endpoint });
    out.push(solid);
  }
  return out;
}
export const isArocsBallSolid = (solid: object) =>
  metadata.has(solid as MechanicalSolid);
/** True exempts only paired ball/socket bearing cores. Neck, other sockets and
 * foreign geometry respond. Drift is checked on BOTH current and predicted poses. */
export function arocsBallContactAllowed(
  source: PlayMechanismSource,
  a: object,
  b: object,
  frames: readonly Record<string, Transform>[],
): boolean | undefined {
  const ma = metadata.get(a as MechanicalSolid),
    mb = metadata.get(b as MechanicalSolid);
  if (!ma && !mb) return;
  if (!ma || !mb || !frames.length) return false;
  const ball = ma.role === "ball" ? ma : mb.role === "ball" ? mb : undefined,
    socket = ma.role === "socket" ? ma : mb.role === "socket" ? mb : undefined;
  if (!ball || !socket) return false;
  const pair = boundArocsBallPairs(source).find(
    (p) =>
      p.ball === ball.memberId &&
      p.socket === socket.memberId &&
      p.endpoint === socket.endpoint,
  );
  return (
    !!pair &&
    frames.every((f) => {
      const bf = f[pair.ballGroup],
        sf = f[pair.socketGroup];
      return (
        !!bf &&
        !!sf &&
        gap(point(bf, pair.ballAnchor), point(sf, pair.socketAnchor)) <= 0.05
      );
    })
  );
}
