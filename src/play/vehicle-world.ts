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
/** Session-owned static BVH plus foreign-rig BVHs cached by accepted geometry
 * identity. No authored mutation and no retained Rapier query worlds. */
export class PlayVehicleWorld {
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
    private ground: boolean,
    private acceptedGeometry: (
      excludeRigId: string,
    ) => Array<{ rigId: string; sources: readonly DrivingTriangleSource[] }>,
    unavailable?: string,
  ) {
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
  check(rigId: string, before: MechanismSnapshot, after: MechanismSnapshot) {
    const report = this.reports.get(rigId);
    if (!report) return undefined;
    if (!report.supported) return this.report(rigId);
    const profile = this.profiles.get(rigId)!;
    const from = drivingPose(profile, before),
      to = drivingPose(profile, after);
    try {
      if (
        this.ground &&
        profile.boxes.some(
          (box) => to.y + box.center[1] - box.halfExtents[1] < -0.00001,
        )
      )
        throw new AppError(
          "INVALID_INPUT",
          "Vehicle proxy penetrates the session-only ground plane",
        );
      const snapshots = [this.staticWorld!];
      for (const foreign of this.acceptedGeometry(rigId)) {
        if (foreign.rigId === rigId) continue;
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
      let queries = 0,
        candidates = 0;
      for (const snapshot of snapshots) {
        const result = snapshot.sweep(rigId, profile.boxes, from, to, {
          queries: 16384 - queries,
          candidates: 512 - candidates,
        });
        queries += result.queries;
        candidates += result.candidateTriangles;
        if (!result.accepted || queries > 16384 || candidates > 512) {
          report.status = "blocked";
          report.reason =
            result.reason === "contact"
              ? "Vehicle stopped before intersecting included world or another rig"
              : "Vehicle sweep exceeds the complete collision work budget";
          report.obstacle = result.obstacle;
          return this.report(rigId);
        }
      }
      report.status = "ready";
      delete report.reason;
      delete report.obstacle;
    } catch (error) {
      report.status = "blocked";
      report.reason = reason(error);
      delete report.obstacle;
    }
    return this.report(rigId);
  }
  dispose() {
    this.profiles.clear();
    this.reports.clear();
    this.foreign.clear();
    this.staticWorld = undefined;
  }
}
