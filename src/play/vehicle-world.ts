import { Vector3 } from "three";
import { toPhysics, frameRotation } from "./physics-frame";
import type { Vec3 } from "../core/types";
import type { SeatedPlacement } from "./seated-profile";
import type { DrivingBox, DrivingPose } from "./vehicle-collision";
import { AppError } from "../core/types";
import type { MechanismSnapshot } from "../mechanisms/types";
import type { PlayMechanismSource } from "./mechanism";
import {
  certifyDrivingProfile,
  drivingPose,
  type DrivingProfile,
} from "./vehicle-profile";
import {
  DrivingObstacleSnapshot,
  type DrivingTriangleSource,
} from "./vehicle-obstacles";
import type { PlayVehicleCollisionReport } from "./types";
const reason = (error: unknown) =>
  error instanceof Error
    ? error.message
    : "Driving collision preparation failed";
const TAU = Math.PI * 2;
const wrap = (angle: number) =>
  angle - TAU * Math.floor((angle + Math.PI) / TAU);
/** Angular segments one query may take (vehicle-collision's bound) and the
 * 5 mm envelope each segment covers. */
const SEGMENTS_PER_QUERY = 128,
  ANGULAR_ENVELOPE = 0.005,
  /** A single tick's move may split into at most this many sub-sweeps. */
  MAX_SUBSTEPS = 16;
/**
 * The same rotation expressed continuously: yaw read back from a frame wraps
 * at ±π, so a vehicle or seated rider turning through due south (+179° to
 * −179°) would otherwise ask for a 358° sweep in one tick. `from` is reduced
 * to [−π, π) and `to` is the shortest turn from it (a single tick never turns
 * half a revolution).
 */
export function continuousPoses(
  from: DrivingPose,
  to: DrivingPose,
): [DrivingPose, DrivingPose] {
  const start = wrap(from.yaw);
  return [
    { ...from, yaw: start },
    { ...to, yaw: start + wrap(to.yaw - from.yaw) },
  ];
}
/** Sub-sweeps needed so every piece stays within one query's angular
 * segments (adaptive substeps for fast turns). */
export function drivingSubsteps(boxes: readonly DrivingBox[], angle: number) {
  let radius = 0;
  for (const box of boxes)
    radius = Math.max(
      radius,
      Math.hypot(
        Math.abs(box.center[0]) + box.halfExtents[0],
        Math.abs(box.center[2]) + box.halfExtents[2],
      ),
    );
  const segments = Math.ceil((Math.abs(angle) * radius) / ANGULAR_ENVELOPE);
  return Math.max(1, Math.ceil(segments / SEGMENTS_PER_QUERY));
}
type SweepOutcome = {
  accepted: boolean;
  reason?: "contact" | "work-budget";
  obstacle?: { sourceId: string; triangleIndex: number };
};
/** What a vehicle check means for this tick. `hold` refuses only this tick's
 * motion (a work budget was reached): the pose stays, input is kept and no
 * stop is reported, so the next tick simply tries again. */
export type VehicleCheck = {
  report?: PlayVehicleCollisionReport;
  hold?: boolean;
};
/** Session-owned static BVH plus foreign-rig BVHs cached by accepted geometry
 * identity. No authored mutation and no retained Rapier query worlds. */
export class PlayVehicleWorld {
  private groundHeight?: number;
  private profiles = new Map<string, DrivingProfile>();
  private reports = new Map<string, PlayVehicleCollisionReport>();
  private staticWorld?: DrivingObstacleSnapshot;
  private foreign = new Map<
    string,
    {
      sources: readonly DrivingTriangleSource[];
      snapshot: DrivingObstacleSnapshot;
    }
  >();
  constructor(
    sources: PlayMechanismSource[],
    staticSource: DrivingTriangleSource | undefined,
    ground: boolean | number,
    private acceptedGeometry: (
      excludeRigId: string,
    ) => Array<{ rigId: string; sources: readonly DrivingTriangleSource[] }>,
    unavailable?: string,
  ) {
    this.groundHeight =
      ground === false ? undefined : typeof ground === "number" ? ground : 0;
    let staticFailure = unavailable;
    try {
      if (!staticFailure)
        this.staticWorld = new DrivingObstacleSnapshot(
          staticSource ? [staticSource] : [],
          1000000,
        );
    } catch (error) {
      staticFailure = reason(error);
    }
    for (const source of sources)
      if (source.project.motionRigs[source.rigId].vehicle) {
        const report: PlayVehicleCollisionReport = {
          profile: "source-boxes-v1",
          units: "metres",
          supported: false,
          status: "unsupported",
        };
        try {
          if (staticFailure) throw new AppError("INVALID_INPUT", staticFailure);
          this.profiles.set(source.rigId, certifyDrivingProfile(source));
          report.supported = true;
          report.status = "ready";
        } catch (error) {
          report.reason = reason(error);
        }
        this.reports.set(source.rigId, report);
      }
  }
  report(rigId: string) {
    const report = this.reports.get(rigId);
    return report ? structuredClone(report) : undefined;
  }
  private snapshots(excludeRigId: string) {
    const snapshots = [this.staticWorld!];
    for (const foreign of this.acceptedGeometry(excludeRigId)) {
      if (foreign.rigId === excludeRigId) continue;
      let cache = this.foreign.get(foreign.rigId);
      if (!cache || cache.sources !== foreign.sources) {
        cache = {
          sources: foreign.sources,
          snapshot: new DrivingObstacleSnapshot(foreign.sources, 200000),
        };
        this.foreign.set(foreign.rigId, cache);
      }
      snapshots.push(cache.snapshot);
    }
    return snapshots;
  }
  /** Sweeps the whole move against every snapshot, split into adaptive
   * substeps when a fast turn needs more angular segments than one query. */
  private sweepAll(
    rigId: string,
    boxes: DrivingBox[],
    start: DrivingPose,
    end: DrivingPose,
    allowVertical: boolean,
  ): SweepOutcome {
    const [from, to] = continuousPoses(start, end);
    const pieces = drivingSubsteps(boxes, to.yaw - from.yaw);
    if (pieces > MAX_SUBSTEPS)
      return { accepted: false, reason: "work-budget" };
    const snapshots = this.snapshots(rigId);
    const at = (t: number): DrivingPose => ({
      x: from.x + (to.x - from.x) * t,
      y: from.y + (to.y - from.y) * t,
      z: from.z + (to.z - from.z) * t,
      yaw: from.yaw + (to.yaw - from.yaw) * t,
    });
    for (let piece = 0; piece < pieces; piece++) {
      const a = piece ? at(piece / pieces) : from,
        b = piece === pieces - 1 ? to : at((piece + 1) / pieces);
      if (!allowVertical) b.y = a.y;
      for (const snapshot of snapshots) {
        const result = snapshot.sweep(rigId, boxes, a, b, { allowVertical });
        if (!result.accepted)
          return {
            accepted: false,
            reason: result.reason,
            obstacle: result.obstacle,
          };
      }
    }
    return { accepted: true };
  }
  check(
    rigId: string,
    before: MechanismSnapshot,
    after: MechanismSnapshot,
  ): VehicleCheck {
    const report = this.reports.get(rigId);
    if (!report) return {};
    if (!report.supported) return { report: this.report(rigId) };
    const profile = this.profiles.get(rigId)!;
    const from = drivingPose(profile, before),
      to = drivingPose(profile, after);
    try {
      if (
        this.groundHeight !== undefined &&
        profile.boxes.some(
          (box) =>
            to.y + box.center[1] - box.halfExtents[1] <
            this.groundHeight! - 0.00001,
        )
      )
        throw new AppError(
          "INVALID_INPUT",
          "Vehicle proxy penetrates the session-only ground plane",
        );
      const result = this.sweepAll(rigId, profile.boxes, from, to, false);
      if (result.reason === "work-budget")
        return { report: this.report(rigId), hold: true };
      if (!result.accepted) {
        report.status = "blocked";
        report.reason =
          "Vehicle stopped before intersecting included world or another rig";
        report.obstacle = result.obstacle;
        return { report: this.report(rigId) };
      }
      report.status = "ready";
      delete report.reason;
      delete report.obstacle;
    } catch (error) {
      report.status = "blocked";
      report.reason = reason(error);
      delete report.obstacle;
    }
    return { report: this.report(rigId) };
  }
  sweepSeatedBody(placement: SeatedPlacement, from: Vec3, to: Vec3) {
    if (!this.staticWorld)
      return {
        accepted: false,
        reason: "Complete collision geometry is unavailable",
      };
    const origin = placement.pelvisFrame.position;
    const boxes = placement.envelopes.map((box) => ({
      center: toPhysics(
        box.frame.position.map((v, i) => v + from[i] - origin[i]) as Vec3,
      ),
      halfExtents: box.halfExtents.map((n) => n * 0.02) as Vec3,
      rotation: frameRotation(box.frame),
    }));
    const delta = toPhysics(to.map((v, i) => v - from[i]) as Vec3);
    if (this.groundHeight !== undefined)
      for (const box of boxes) {
        const q = box.rotation;
        const low =
          box.center.y -
          Math.abs(new Vector3(1, 0, 0).applyQuaternion(q).y) *
            box.halfExtents[0] -
          Math.abs(new Vector3(0, 1, 0).applyQuaternion(q).y) *
            box.halfExtents[1] -
          Math.abs(new Vector3(0, 0, 1).applyQuaternion(q).y) *
            box.halfExtents[2];
        if (Math.min(low, low + delta.y) < this.groundHeight - 0.00001)
          return {
            accepted: false,
            reason: "Body transfer intersects session ground",
          };
      }
    try {
      for (const snapshot of this.snapshots("")) {
        const result = snapshot.sweepRigidBoxes(boxes, delta);
        if (!result.accepted) return result;
      }
      return { accepted: true };
    } catch (error) {
      return { accepted: false, reason: reason(error) };
    }
  }
  /** Body queries include own-vehicle geometry unless the attachment invariant
   * has already been certified. Caller supplies no opaque visibility filters.
   * `hold` marks a refusal that is only a work budget, not a contact. */
  sweepBody(
    boxes: DrivingBox[],
    from: DrivingPose,
    to: DrivingPose,
    excludeRigId?: string,
  ): { accepted: boolean; reason?: string; hold?: boolean } {
    if (!this.staticWorld)
      return {
        accepted: false,
        reason: "Complete collision geometry is unavailable",
      };
    if (
      this.groundHeight !== undefined &&
      boxes.some(
        (box) =>
          Math.min(from.y, to.y) + box.center[1] - box.halfExtents[1] <
          this.groundHeight! - 0.00001,
      )
    )
      return {
        accepted: false,
        reason: "Body transfer intersects session ground",
      };
    try {
      const result = this.sweepAll(excludeRigId ?? "", boxes, from, to, true);
      if (result.accepted) return { accepted: true };
      return result.reason === "work-budget"
        ? {
            accepted: false,
            hold: true,
            reason: "Too much nearby geometry to check this move",
          }
        : {
            accepted: false,
            reason: "Body transfer intersects included geometry",
          };
    } catch (error) {
      return { accepted: false, reason: reason(error) };
    }
  }
  dispose() {
    this.profiles.clear();
    this.reports.clear();
    this.foreign.clear();
    this.staticWorld = undefined;
  }
}
