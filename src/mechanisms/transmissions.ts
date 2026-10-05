import { ensure } from "../core/types";
import type { MotionRig, Transmission } from "./types";

/** For each coordinate, coupled displacement per driver unit (degrees or LDU). */
export type TransmissionMap = Map<string, Map<string, number>>;
/** Keep every coordinate under 60 units per fixed tick; shaft unwrapping stays reliable. */
export const TRANSMISSION_MAX_SPEED = 3600;
/** Increment relation only: source seating/contact admission is separate. */
export function transmissionRatio(t: Transmission) {
  if (t.kind === "spur") return (-t.axisSign * t.teethA) / t.teethB;
  if (t.kind === "worm") return (t.direction * t.starts) / t.teeth;
  return (t.pitchRadiusLdu * Math.PI) / 180;
}
export function transmissionSpeedLimit(map: TransmissionMap, id: string) {
  return (
    TRANSMISSION_MAX_SPEED /
    Math.max(1, ...[...(map.get(id)?.values() ?? [1])].map(Math.abs))
  );
}

export function transmissionMap(rig: MotionRig): TransmissionMap {
  const result: TransmissionMap = new Map();
  const graph = new Map<string, Array<[string, number]>>();
  const ids = new Set<string>();
  const transmissions = rig.transmissions ?? [];
  ensure(
    Array.isArray(transmissions) && transmissions.length <= 100,
    "LIMIT_EXCEEDED",
    "A rig supports at most 100 transmissions.",
  );
  for (const t of transmissions) {
    ensure(
      t &&
        Object.keys(t).every((k) =>
          [
            "id",
            "kind",
            "jointA",
            "jointB",
            "teethA",
            "teethB",
            "axisSign",
            "pitchRadiusLdu",
            "starts",
            "teeth",
            "direction",
          ].includes(k),
        ) &&
        typeof t.id === "string" &&
        t.id.length > 0 &&
        t.id.length <= 128 &&
        !["__proto__", "prototype", "constructor"].includes(t.id) &&
        !ids.has(t.id) &&
        ((t.kind === "spur" &&
          [t.teethA, t.teethB].every(
            (n) => Number.isInteger(n) && n >= 4 && n <= 256,
          ) &&
          (t.axisSign === 1 || t.axisSign === -1) &&
          !["pitchRadiusLdu", "starts", "teeth", "direction"].some(
            (k) => k in t,
          )) ||
          (t.kind === "worm" &&
            Number.isInteger(t.starts) &&
            t.starts >= 1 &&
            t.starts <= 16 &&
            Number.isInteger(t.teeth) &&
            t.teeth >= 4 &&
            t.teeth <= 256 &&
            (t.direction === 1 || t.direction === -1) &&
            !["teethA", "teethB", "axisSign", "pitchRadiusLdu"].some(
              (k) => k in t,
            )) ||
          (t.kind === "rack" &&
            Number.isFinite(t.pitchRadiusLdu) &&
            Math.abs(t.pitchRadiusLdu) >= 0.1 &&
            Math.abs(t.pitchRadiusLdu) <= 10000 &&
            ![
              "teethA",
              "teethB",
              "axisSign",
              "starts",
              "teeth",
              "direction",
            ].some((k) => k in t))),
      "INVALID_INPUT",
      "Invalid or duplicate transmission.",
    );
    ids.add(t.id);
    const a = rig.joints.find((j) => j.id === t.jointA);
    const b = rig.joints.find((j) => j.id === t.jointB);
    ensure(
      a &&
        b &&
        a !== b &&
        a.kind === "revolute" &&
        a.bodyA === b.bodyA &&
        (t.kind === "spur"
          ? b.kind === "revolute" &&
            Math.abs(
              a.axisA!.reduce((s, x, i) => s + x * b.axisA![i], 0) - t.axisSign,
            ) < 1e-5
          : t.kind === "worm"
            ? b.kind === "revolute" &&
              Math.abs(a.axisA!.reduce((s, x, i) => s + x * b.axisA![i], 0)) <
                1e-5
            : b.kind === "prismatic" &&
              !!b.limits &&
              Math.abs(a.axisA!.reduce((s, x, i) => s + x * b.axisA![i], 0)) <
                1e-5),
      "INVALID_INPUT",
      "Transmissions need a shared carrier with parallel spur shafts, orthogonal worm shafts, or a perpendicular limited rack guide.",
    );
    const ratio = transmissionRatio(t);
    if (!graph.has(a.id)) graph.set(a.id, []);
    if (!graph.has(b.id)) graph.set(b.id, []);
    graph.get(a.id)!.push([b.id, ratio]);
    graph.get(b.id)!.push([a.id, 1 / ratio]);
  }
  for (const driver of graph.keys()) {
    const component = new Map<string, number>([[driver, 1]]);
    const queue = [driver];
    for (let i = 0; i < queue.length; i++) {
      const id = queue[i];
      for (const [other, ratio] of graph.get(id)!) {
        const value = component.get(id)! * ratio;
        ensure(
          Math.abs(value) >= 1e-6 && Math.abs(value) <= 1e6,
          "LIMIT_EXCEEDED",
          "Transmission ratio chain exceeds supported precision.",
        );
        if (component.has(other)) {
          ensure(
            Math.abs(component.get(other)! - value) <=
              1e-8 * Math.max(1, Math.abs(value)),
            "INVALID_INPUT",
            "Transmission loop has contradictory ratios.",
          );
        } else {
          component.set(other, value);
          queue.push(other);
        }
      }
    }
    ensure(
      rig.joints.filter((j) => component.has(j.id) && j.motor).length <= 1,
      "INVALID_INPUT",
      "A coupled transmission component supports one authored motor.",
    );
    result.set(driver, component);
  }
  for (const joint of rig.joints)
    if (result.has(joint.id) && joint.motor?.mode === "velocity")
      ensure(
        Math.abs(joint.motor.target) <=
          transmissionSpeedLimit(result, joint.id),
        "INVALID_INPUT",
        "Transmission motor speed would exceed the supported speed of a coupled shaft.",
      );
  return result;
}

export function validateTransmissionPose(
  map: TransmissionMap,
  positions: Record<string, number>,
) {
  for (const [driver, component] of map)
    for (const [id, ratio] of component) {
      const expected = positions[driver] * ratio;
      ensure(
        Math.abs(positions[id] - expected) <= 1e-6,
        "INVALID_INPUT",
        "Pose violates an authored transmission ratio.",
      );
    }
}
