import { ensure, type Transform, type Vec3 } from "../core/types";
import { add, compose, inverse, mv } from "../core/math";
import { axisRotation } from "./kinematic";
import type { MotionRig } from "./types";

export const LOOP_LIMITS = Object.freeze({
  closures: 8,
  dependentJoints: 16,
  iterations: 48,
  toleranceLdu: 0.001,
});
const point = (f: Transform, p: Vec3) => add(f.position, mv(f.basis, p));
/** Tree evaluation remains acyclic; explicit closure edges never enter traversal. */
export function loopFrames(rig: MotionRig, positions: Record<string, number>) {
  const frames: Record<string, Transform> = {};
  const groups = new Map(rig.groups.map((g) => [g.id, g]));
  const parents = new Map(rig.joints.map((j) => [j.bodyB, j]));
  const frame = (id: string): Transform => {
    if (frames[id]) return frames[id];
    const g = groups.get(id)!,
      j = parents.get(id);
    let result = structuredClone(g.frame);
    if (j) {
      const a = groups.get(j.bodyA)!,
        f = frame(a.id);
      result = compose(compose(f, inverse(a.frame)), result);
      const v = positions[j.id] ?? 0;
      if (j.kind === "revolute") {
        const pivot = point(f, j.anchorA),
          basis = axisRotation(mv(f.basis, j.axisA!), v);
        result = compose(
          {
            basis,
            position: add(pivot, mv(basis, pivot).map((x) => -x) as Vec3),
          },
          result,
        );
      } else if (j.kind === "prismatic")
        result.position = add(
          result.position,
          mv(f.basis, j.axisA!).map((x) => x * v) as Vec3,
        );
    }
    return (frames[id] = result);
  };
  for (const g of rig.groups) frame(g.id);
  return frames;
}
export function closureResidual(
  rig: MotionRig,
  positions: Record<string, number>,
) {
  const frames = loopFrames(rig, positions);
  return (rig.loopClosures ?? []).flatMap((c) => {
    const a = frames[c.bodyA],
      b = frames[c.bodyB],
      pa = point(a, c.anchorA),
      pb = point(b, c.anchorB);
    // Planar revolute closures preserve parallel axes through the tree. Include
    // axis error so a malformed/out-of-plane pose cannot silently open a hinge.
    const aa = mv(a.basis, c.axisA),
      ab = mv(b.basis, c.axisB);
    return [
      ...pa.map((v, k) => v - pb[k]),
      ...aa.map((v, k) => (v - ab[k]) * 20),
    ];
  });
}
export function validateClosurePose(
  rig: MotionRig,
  positions: Record<string, number>,
) {
  ensure(
    closureResidual(rig, positions).every(
      (v) => Math.abs(v) <= LOOP_LIMITS.toleranceLdu,
    ),
    "INVALID_INPUT",
    "Pose does not close every mechanism loop.",
  );
}
/** Bounded damped least-squares continuation; never changes independent inputs. */
export function closeLoopPose(rig: MotionRig, seed: Record<string, number>) {
  if (!rig.loopClosures?.length) return { ...seed };
  const values = { ...seed },
    ids = [...new Set(rig.loopClosures.flatMap((c) => c.dependentJointIds))];
  const joints = new Map(rig.joints.map((j) => [j.id, j]));
  for (const id of ids) {
    const joint = joints.get(id)!;
    values[id] = Math.max(
      joint.limits?.[0] ?? -1e9,
      Math.min(joint.limits?.[1] ?? 1e9, values[id]),
    );
  }
  let damping = 1e-5;
  const norm = (r: number[]) => r.reduce((s, v) => s + v * v, 0);
  for (let iteration = 0; iteration < LOOP_LIMITS.iterations; iteration++) {
    const r = closureResidual(rig, values);
    if (r.every((v) => Math.abs(v) <= 1e-8)) return values;
    const columns = ids.map((id) => {
      const shifted = { ...values, [id]: values[id] + 0.001 };
      return closureResidual(rig, shifted).map((v, k) => (v - r[k]) / 0.001);
    });
    const matrix = columns.map((a, i) => [
      ...columns.map(
        (b, j) =>
          a.reduce((s, v, k) => s + v * b[k], 0) + (i === j ? damping : 0),
      ),
      -a.reduce((s, v, k) => s + v * r[k], 0),
    ]);
    // Small dense normal system, at most 16 coordinates. Pivoting and damping
    // make singular/dead-center requests bounded failures instead of NaNs.
    for (let i = 0; i < ids.length; i++) {
      let best = i;
      for (let k = i + 1; k < ids.length; k++)
        if (Math.abs(matrix[k][i]) > Math.abs(matrix[best][i])) best = k;
      [matrix[i], matrix[best]] = [matrix[best], matrix[i]];
      const divisor = matrix[i][i];
      for (let j = i; j <= ids.length; j++) matrix[i][j] /= divisor;
      for (let k = 0; k < ids.length; k++)
        if (k !== i) {
          const factor = matrix[k][i];
          for (let j = i; j <= ids.length; j++)
            matrix[k][j] -= factor * matrix[i][j];
        }
    }
    let accepted = false;
    for (const fraction of [1, 0.5, 0.25, 0.125]) {
      const candidate = { ...values };
      ids.forEach((id, i) => {
        const joint = joints.get(id)!,
          limit = joint.kind === "revolute" ? 30 : 20;
        const step =
          Math.max(-limit, Math.min(limit, matrix[i][ids.length])) * fraction;
        candidate[id] = Math.max(
          joint.limits?.[0] ?? -1e9,
          Math.min(joint.limits?.[1] ?? 1e9, values[id] + step),
        );
      });
      if (norm(closureResidual(rig, candidate)) < norm(r)) {
        Object.assign(values, candidate);
        damping = Math.max(1e-8, damping / 2);
        accepted = true;
        break;
      }
    }
    if (!accepted) damping = Math.min(1e6, damping * 10);
  }
  ensure(
    false,
    "INVALID_INPUT",
    "Mechanism loop cannot close at this input within limits; the previous pose is retained.",
  );
  return values;
}

/** A cold pose at a toggle has no unique continuation branch. */
export function loopSingular(
  rig: MotionRig,
  positions: Record<string, number>,
) {
  const ids = [
    ...new Set(rig.loopClosures?.flatMap((c) => c.dependentJointIds) ?? []),
  ];
  if (!ids.length) return false;
  const residual = closureResidual(rig, positions);
  const columns = ids.map((id) =>
    closureResidual(rig, { ...positions, [id]: positions[id] + 0.0001 }).map(
      (v, k) => (v - residual[k]) / 0.0001,
    ),
  );
  const norms = columns.map((c) => Math.hypot(...c));
  if (norms.some((n) => n < 1e-10)) return true;
  const matrix = columns.map((a, i) =>
    columns.map(
      (b, j) =>
        a.reduce((sum, v, k) => sum + v * b[k], 0) / (norms[i] * norms[j]),
    ),
  );
  for (let i = 0; i < ids.length; i++) {
    let best = i;
    for (let k = i + 1; k < ids.length; k++)
      if (Math.abs(matrix[k][i]) > Math.abs(matrix[best][i])) best = k;
    [matrix[i], matrix[best]] = [matrix[best], matrix[i]];
    if (Math.abs(matrix[i][i]) < 1e-8) return true;
    for (let k = i + 1; k < ids.length; k++) {
      const factor = matrix[k][i] / matrix[i][i];
      for (let j = i; j < ids.length; j++)
        matrix[k][j] -= factor * matrix[i][j];
    }
  }
  return false;
}
