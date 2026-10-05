import { MechanicalQueryWorld } from "./mechanical-query-world";
import { prepareMechanicalSources } from "./mechanical-solids";
import { loadReviewedMechanicalProxies } from "./reviewed-mechanical-proxies";
import { add, mv } from "../core/math";
import type { DriverSeatSpec } from "../mechanisms/types";
import {
  seatPoint,
  seatYaw,
  seatPlacement,
  seatBodyBoxes,
  seatBodyPose,
  verifyWheelAttachment,
  validateSeatTransfer,
} from "./vehicle-seat";
import { SEATED_VISUAL_POSE, type SeatedPlacement } from "./seated-profile";
import type {
  PlaySeatRequest,
  PlaySeatEligibility,
  PlayOccupancy,
} from "./types";
import { PlayVehicleWorld } from "./vehicle-world";
import { sessionGroundY } from "./session-ground";
import {
  mechanismViewGeometry,
  mechanismOverviewCamera,
  type MechanismViewGeometry,
} from "./mechanism-view";
import { vehicleExitCandidates } from "./vehicle-possession";
import {
  compactCollisionMesh,
  type CompactCollisionMesh,
} from "./collision-mesh";
import type { DrivingTriangleSource } from "./vehicle-obstacles";
import { isOccurrenceId } from "../core/occurrence-id";
import { RESOURCE_PROFILES } from "../core/resource-profile";
import { validatePlayWorldProfile } from "./world-profile";
import { resolvePlayCameraSettings, playCameraSafety } from "./camera-settings";
import {
  PlayMechanism,
  validatePlayMechanismSources,
  type PlayMechanismSource,
} from "./mechanism";
import type { AutoDoor, AutoDoorSkip } from "./auto-doors";
import { TrainWorld, type CarPose, type DerivedTrains } from "./trains";
import { alightPoints, trainCab, type TrainCab } from "./train-cab";
import { frameRotation, basisFromRotation } from "./physics-frame";
import { inverse } from "../core/math";
import {
  PlayDynamicsWorld,
  validateDynamicRigSources,
  type DynamicRigSource,
} from "./dynamics";
import RAPIER from "@dimforge/rapier3d-compat";
import {
  AVATAR_MOTION,
  advanceMotion,
  flyBob,
  RIDE_SMOOTH_TIME,
  smoothDamp,
  headAngles,
  orbitHead,
  initialMotion,
  lerpMotion,
  limbAngles,
  wrapAngle,
  type AvatarMotionState,
} from "./avatar-motion";
import {
  ensure,
  type CameraSpec,
  type Transform,
  type Vec3,
} from "../core/types";
import {
  CHARACTER_PROFILE as P,
  PLAY_ZOOM_LIMITS,
  type CollisionSnapshot,
  type PlayCameraMode,
  type PlayInput,
  type PlayJointTargetRequest,
  type PlayMotorRequest,
  type PlayGrabRequest,
  type PlayGripRequest,
  type PlayAutoDoorSwing,
  type PlayLocomotion,
  type PlayRequest,
  type PlaySnapshotReport,
  type PlayTeleportRequest,
  type AvatarPose,
  type PlayCameraSettings,
  type PlaySpawnRequest,
  type PlaySpawn,
  type ResolvedPlayWorldProfile,
} from "./types";
const S = P.scaleMetresPerLdu,
  DT = 1 / 60;
const rot = { x: 0, y: 0, z: 0, w: 1 };
const physics = ([x, y, z]: Vec3) => ({ x: x * S, y: -y * S, z: -z * S });
const physicsDirection = ([x, y, z]: Vec3) => ({ x, y: -y, z: -z });
const ldraw = ({ x, y, z }: { x: number; y: number; z: number }): Vec3 => [
  x / S,
  -y / S,
  -z / S,
];
let initialization: Promise<void> | undefined;
const finite = (x: unknown): x is number =>
  typeof x === "number" && Number.isFinite(x);
function point(p: unknown): asserts p is Vec3 {
  ensure(
    Array.isArray(p) &&
      p.length === 3 &&
      p.every((x) => finite(x) && Math.abs(x) <= 1e7),
    "INVALID_INPUT",
    "Play position must contain three finite LDU coordinates.",
  );
}
function validMesh(vertices: ArrayLike<number>, indices: ArrayLike<number>) {
  for (let i = 0; i < vertices.length; i++)
    if (!Number.isFinite(vertices[i])) return false;
  const corners = vertices.length / 3;
  for (let i = 0; i < indices.length; i++)
    if (!(indices[i] < corners)) return false;
  return true;
}
function keys(o: object, allowed: string[]) {
  ensure(
    Object.keys(o).every((k) => allowed.includes(k)),
    "INVALID_INPUT",
    "Unknown Play request field.",
  );
}
/** Fixed-step isolated session. No authored project references or mutations. */
/** Moving triangles all trains may collide with (their own budget). */
export const TRAIN_TRIANGLE_BUDGET = 300000;
/** Derived trains and each car's collision mesh (keyed `trainId/carIndex`). */
export type PlayTrainSource = {
  derived: DerivedTrains;
  meshes: Record<string, CollisionSnapshot>;
};
export class PlaySession {
  private mechanisms = new Map<string, PlayMechanism>();
  private trains?: TrainWorld;
  private trainProxies = new Map<
    string,
    { collider: RAPIER.Collider; radius: number; rest: Transform }
  >();
  private trainPosed = "";
  /**
   * Riding a train: the explorer stands in the locomotive's cab and moves
   * with it. `boarded` is where they got on (a fallback place to get off).
   */
  private riding?: {
    trainId: string;
    reference: number;
    cab: TrainCab;
    boarded: Vec3;
  };
  /** Each train's lead car mesh in its pivot frame (LDraw), for the cab. */
  private leadMeshes = new Map<
    string,
    { vertices: Float32Array; indices: Uint32Array }
  >();
  /** The driver's lever while riding (forward/backward keys) and brake. */
  private driveLever: -1 | 0 | 1 = 0;
  private brakeHeld = false;
  /** Optional dynamic rigid-body world; absent unless dynamic rigs were requested. */
  private dynamics?: PlayDynamicsWorld;
  private vehicleWorld?: PlayVehicleWorld;
  private seatSources = new Map<
    string,
    { source: PlayMechanismSource; seat: DriverSeatSpec; chassisGroup: string }
  >();
  private occupied?: {
    request: PlaySeatRequest;
    placement: SeatedPlacement;
    localLookYaw: number;
    localLookPitch: number;
    previousCamera: PlayCameraMode;
  };
  private controlledVehicle?: {
    rigId: string;
    chassisGroup: string;
    geometry: MechanismViewGeometry;
    previousCamera: PlayCameraMode;
    previousPitch: number;
    heading: number;
    zoom: number;
  };
  private vehicleViews = new Map<
    string,
    { chassisGroup: string; geometry: MechanismViewGeometry }
  >();
  private seatedColliders: RAPIER.Collider[] = [];
  private seatEligibilityCache?: { key: string; result: PlaySeatEligibility };
  private world: RAPIER.World;
  private collider: RAPIER.Collider;
  private controller: RAPIER.KinematicCharacterController;
  private capsule: RAPIER.Capsule;
  private feet: Vec3 = [0, 0, 0];
  private previous: Vec3 = [0, 0, 0];
  private velocity: Vec3 = [0, 0, 0];
  private input: Required<Omit<PlayInput, "yaw" | "pitch">> = {
    moveX: 0,
    moveZ: 0,
    vertical: 0,
    run: false,
    jump: false,
  };
  private yaw = 0;
  private pitch = 0;
  private tick = 0;
  private accumulator = 0;
  private grounded = false;
  private groundY = 0;
  /** Feet expressed in the supporting group's frame, refreshed after walking. */
  private support?: {
    handle: number;
    rigId: string;
    groupId: string;
    local: Vec3;
    frame: Transform;
    pointVelocity: Vec3;
  };
  private inheritedVelocity: Vec3 = [0, 0, 0];
  private jumpHeld = false;
  private disposed = false;
  private locomotion: PlayLocomotion = "walk";
  private cameraMode: PlayCameraMode = "first-person";
  private safe: Vec3 | undefined;
  private spawn: Vec3;
  private selectedSpawn?: PlaySpawn;
  private cameraSettings: PlayCameraSettings;
  private worldProfile: ResolvedPlayWorldProfile;
  private aspectRatio = 1;
  private arm = 120;
  /** Figure motion after the latest tick and before it (render interpolation). */
  private motion: AvatarMotionState = initialMotion();
  private previousMotion: AvatarMotionState = initialMotion();
  private get heading() {
    return this.motion.body;
  }
  /**
   * Presentation heights of the feet: each follows the collider's feet
   * through a critically damped spring while walking on the ground, so the
   * view and the figure glide over studs and up steps instead of bobbing
   * with every contact correction (a capsule's round base dips into the gaps
   * between studs). The camera may lag one and a half steps (a smoothed rise,
   * even climbing brick-high stairs briskly); the figure at most a stud's
   * height, so it never sinks into a step. Snapshots, collision and the API
   * report the exact feet.
   */
  private ride = {
    camera: { y: 0, previous: 0, velocity: 0, lag: P.stepHeight * 1.5 },
    figure: { y: 0, previous: 0, velocity: 0, lag: 4 },
  };
  /** Why walking collision is unavailable, when it is. */
  private collisionIssue?: string;
  private ready: boolean;
  private warnings: string[];
  private contactQueries = new MechanicalQueryWorld();
  private bounds: CollisionSnapshot["bounds"];
  private staticStats?: CompactCollisionMesh["stats"];
  private constructor(
    private revision: number,
    snapshot: CollisionSnapshot,
    request: PlayRequest,
    mechanismSource?: PlayMechanismSource | PlayMechanismSource[],
    autoDoors?: { doors: AutoDoor[]; skipped: AutoDoorSkip[] },
    trains?: PlayTrainSource,
  ) {
    this.worldProfile = {
      ...validatePlayWorldProfile(
        snapshot.worldProfile
          ? { excludedLayerIds: snapshot.worldProfile.excludedLayerIds }
          : undefined,
      ),
      includedOccurrenceIds: [
        ...(snapshot.worldProfile?.includedOccurrenceIds ?? []),
      ],
    };
    // Session inclusion is immutable; animation snapshots share it without
    // copying the entire authored occurrence list on every fixed tick/frame.
    Object.freeze(this.worldProfile.excludedLayerIds);
    Object.freeze(this.worldProfile.includedOccurrenceIds);
    Object.freeze(this.worldProfile);
    this.cameraSettings = resolvePlayCameraSettings(request.cameraSettings);
    this.arm = this.cameraSettings.followDistance;
    const preparedContacts = prepareMechanicalSources(
      Array.isArray(mechanismSource)
        ? mechanismSource
        : mechanismSource
          ? [mechanismSource]
          : [],
    );
    const allSources = Array.isArray(mechanismSource)
      ? mechanismSource
      : mechanismSource
        ? [mechanismSource]
        : [];
    const groundY =
      request.ground === false ? 0 : sessionGroundY(snapshot, allSources);
    this.groundY = groundY;
    const groundHeight = -groundY * S;
    this.world = new RAPIER.World({ x: 0, y: 0, z: 0 });
    this.world.timestep = DT;
    this.bounds = structuredClone(snapshot.bounds);
    this.warnings = [...(snapshot.warnings ?? [])];
    this.ready = !snapshot.unsupported;
    if (snapshot.unsupported)
      this.collisionIssue =
        (snapshot.warnings ?? [])
          .filter((w) => !w.startsWith("Session-only ground"))
          .join(" ") || "The build's collision geometry could not be prepared.";
    if (snapshot.indices.length > 3_000_000) {
      this.ready = false;
      this.collisionIssue =
        "This world has more than 1,000,000 collision triangles, which is too many to walk on.";
      this.warnings.push(
        "Collision exceeds the 1,000,000 triangle budget. Fly remains available.",
      );
    }
    let drivingStatic: DrivingTriangleSource | undefined;
    if (this.ready && snapshot.indices.length) {
      // One static trimesh (Rapier builds its BVH once). Compaction is lossless for
      // two-sided queries and removes the reversed twins of double-sided faces.
      const compact = compactCollisionMesh(snapshot.vertices, snapshot.indices);
      this.staticStats = compact.stats;
      const v = compact.vertices;
      for (let i = 0; i < v.length; i += 3) {
        v[i] = v[i] * S;
        v[i + 1] = -v[i + 1] * S;
        v[i + 2] = -v[i + 2] * S;
      }
      const staticCollider = this.world.createCollider(
        RAPIER.ColliderDesc.trimesh(v, compact.indices),
      );
      drivingStatic = {
        sourceId: "included-static-world",
        units: "metres",
        up: "+Y",
        owner: { kind: "static" },
        vertices: v,
        indices: compact.indices,
      };
      const sources = Array.isArray(mechanismSource)
        ? mechanismSource
        : mechanismSource
          ? [mechanismSource]
          : [];
      if (
        sources.some((s) =>
          s.project.motionRigs[s.rigId].joints.some(
            (j) =>
              j.kind === "revolute" &&
              j.anchorB[0] === 0 &&
              j.anchorB[2] === 0 &&
              j.axisA?.[0] === 0 &&
              Math.abs(j.axisA[1]) === 1 &&
              j.axisA[2] === 0 &&
              j.axisB?.[0] === 0 &&
              Math.abs(j.axisB[1]) === 1 &&
              j.axisB[2] === 0,
          ),
        )
      )
        this.contactQueries.registerStaticSupport(
          staticCollider,
          drivingStatic,
        );
    }
    if (request.ground !== false)
      this.warnings.push(
        `Session-only ground is an infinite plane at Y=${groundY}; it is not an authored part.`,
      );
    if (request.ground !== false)
      this.world.createCollider(
        new RAPIER.ColliderDesc(
          new RAPIER.HalfSpace({ x: 0, y: 1, z: 0 }),
        ).setTranslation(0, groundHeight, 0),
      );
    this.capsule = new RAPIER.Capsule(
      (P.height / 2 - P.radius) * S,
      P.radius * S,
    );
    this.collider = this.world.createCollider(
      RAPIER.ColliderDesc.capsule(
        (P.height / 2 - P.radius) * S,
        P.radius * S,
      ).setSensor(true),
    );
    const dynamicIds = new Set(request.dynamicRigIds ?? []);
    try {
      const dynamicSources = allSources.filter((source) =>
        dynamicIds.has(source.rigId),
      ) as DynamicRigSource[];
      if (dynamicSources.length) {
        ensure(
          this.ready,
          "INVALID_INPUT",
          "Dynamic physics needs complete included collision geometry. Use kinematic physics for this build.",
        );
        this.dynamics = new PlayDynamicsWorld(
          drivingStatic
            ? {
                vertices: drivingStatic.vertices,
                indices: drivingStatic.indices,
              }
            : undefined,
          request.ground === false ? false : groundHeight,
          this.world,
          dynamicSources,
          revision,
          preparedContacts,
        );
      }
      for (const source of allSources.filter(
        (source) => !dynamicIds.has(source.rigId),
      ))
        this.mechanisms.set(
          source.rigId,
          new PlayMechanism(
            this.world,
            source,
            () => ({
              position: this.feet,
              walk: this.locomotion === "walk" && !this.controlledVehicle,
              ...(this.support ? { support: this.support } : {}),
              ...(this.occupied
                ? {
                    seat: {
                      rigId: this.occupied.request.rigId,
                      envelopes: this.occupied.placement.envelopes,
                    },
                  }
                : {}),
            }),
            this.ready,
            preparedContacts.get(source.rigId),
            this.contactQueries,
          ),
        );
      for (const [id, mechanism] of this.mechanisms)
        mechanism.setSupportGuard((before, after) => {
          if (this.support?.rigId !== id) return undefined;
          return this.supportTransferClear(
            before.groupFrames[this.support.groupId],
            after.groupFrames[this.support.groupId],
          )
            ? undefined
            : "Moving support stopped before carrying the explorer into geometry";
        });
      const sources = allSources.filter(
        (source) => !dynamicIds.has(source.rigId),
      );
      if (this.dynamics)
        for (const [id, mechanism] of this.mechanisms) {
          this.dynamics.addKinematicRig(id, mechanism.movingShapes());
          this.dynamics.syncKinematicRig(id, mechanism.groupFrames(), true);
        }
      if (
        allSources.some(
          (source) => source.project.motionRigs[source.rigId].vehicle,
        )
      ) {
        this.vehicleWorld = new PlayVehicleWorld(
          allSources,
          drivingStatic,
          request.ground === false ? false : groundHeight,
          (exclude) => [
            ...[...this.mechanisms]
              .filter(([id]) => id !== exclude)
              .map(([rigId, mechanism]) => ({
                rigId,
                sources: mechanism.collisionSources(),
              })),
            ...(this.dynamics?.rigIds() ?? []).map((rigId) => ({
              rigId,
              sources: this.dynamics!.rig(rigId)!.collisionSources(),
            })),
          ],
          this.ready
            ? undefined
            : "Complete included collision geometry is unavailable",
        );
        for (const [id, mechanism] of this.mechanisms)
          mechanism.setVehicleWorld(
            (before, after) => this.vehicleWorld!.check(id, before, after),
            this.vehicleWorld.report(id),
          );
        for (const source of allSources) {
          const vehicle = source.project.motionRigs[source.rigId].vehicle;
          if (vehicle)
            this.vehicleViews.set(source.rigId, {
              chassisGroup: vehicle.chassisGroup,
              geometry: mechanismViewGeometry(
                source.project.motionRigs[source.rigId],
                source.groups,
              ),
            });
          if (vehicle?.driverSeat)
            this.seatSources.set(source.rigId, {
              source,
              seat: structuredClone(vehicle.driverSeat),
              chassisGroup: vehicle.chassisGroup,
            });
          this.mechanisms.get(source.rigId)?.setRiderGuard((before, after) => {
            if (this.occupied?.request.rigId !== source.rigId) return undefined;
            const info = this.seatSources.get(source.rigId)!;
            const old = seatPlacement(
                before.groupFrames[info.chassisGroup],
                info.seat,
              ),
              next = seatPlacement(
                after.groupFrames[info.chassisGroup],
                info.seat,
              );
            const result = this.vehicleWorld!.sweepBody(
              seatBodyBoxes(),
              seatBodyPose(old),
              seatBodyPose(next),
              source.rigId,
            );
            return result.accepted
              ? undefined
              : result.hold
                ? { hold: true as const }
                : (result.reason ?? "Seated body motion is blocked");
          });
        }
      }
    } catch (error) {
      for (const mechanism of this.mechanisms.values()) mechanism.dispose();
      this.contactQueries.dispose();
      this.dynamics?.dispose();
      this.contactQueries.dispose();
      this.world.free();
      throw error;
    }
    if (trains?.derived.trains.length) {
      this.trains = new TrainWorld(trains.derived);
      // Each car collides as one moving trimesh in its rest pivot frame.
      for (const train of trains.derived.trains) {
        const shapes: Array<{
          id: string;
          vertices: Float32Array;
          indices: Uint32Array;
        }> = [];
        this.trains.carFrames(train.id).forEach(({ rest }, i) => {
          const mesh = trains.meshes[`${train.id}/${i}`];
          if (!mesh?.indices.length) return;
          const inv = inverse(rest),
            b = inv.basis,
            vertices = new Float32Array(mesh.vertices.length);
          let radius = 0;
          const local =
            i === 0 ? new Float32Array(mesh.vertices.length) : undefined;
          for (let v = 0; v < vertices.length; v += 3) {
            const x = mesh.vertices[v],
              y = mesh.vertices[v + 1],
              z = mesh.vertices[v + 2];
            const l: Vec3 = [
              inv.position[0] + b[0] * x + b[1] * y + b[2] * z,
              inv.position[1] + b[3] * x + b[4] * y + b[5] * z,
              inv.position[2] + b[6] * x + b[7] * y + b[8] * z,
            ];
            radius = Math.max(radius, Math.hypot(...l));
            if (local) local.set(l, v);
            vertices[v] = l[0] * S;
            vertices[v + 1] = -l[1] * S;
            vertices[v + 2] = -l[2] * S;
          }
          const collider = this.world.createCollider(
            RAPIER.ColliderDesc.trimesh(vertices, mesh.indices),
          );
          collider.setTranslation(physics(rest.position));
          collider.setRotation(frameRotation(rest));
          if (local)
            this.leadMeshes.set(train.id, {
              vertices: local,
              indices: mesh.indices,
            });
          this.trainProxies.set(`${train.id}/${i}`, {
            collider,
            radius,
            rest,
          });
          shapes.push({ id: String(i), vertices, indices: mesh.indices });
        });
        if (this.dynamics) {
          this.dynamics.addKinematicRig(train.id, shapes);
          this.syncTrainDynamics(train.id, true);
        }
      }
    }
    this.controller = this.world.createCharacterController(0.15 * S);
    // Rapier's own autostep handles plate-height ledges; taller risers up
    // to the profile's step height use stepUp() (large autostep heights
    // overshoot and launch the character).
    this.controller.enableAutostep(8.5 * S, 4 * S, false);
    this.controller.enableSnapToGround(3 * S);
    this.controller.setMaxSlopeClimbAngle((P.maxSlopeDegrees * Math.PI) / 180);
    this.controller.setMinSlopeSlideAngle((P.maxSlopeDegrees * Math.PI) / 180);
    this.world.step();
    // Without a requested position the explorer starts in front of the
    // build: LDraw models face −Z, so the spawn is beyond the world's −Z
    // bounds, facing +Z (yaw π) towards it, with the third-person camera
    // behind the explorer. A requested position keeps yaw 0 by default.
    this.yaw = request.yaw ?? (request.position ? 0 : Math.PI);
    this.pitch = this.clampPitch(request.pitch ?? 0);
    this.cameraMode = request.cameraMode ?? "first-person";
    const candidate = request.position ?? [
      (snapshot.bounds.min[0] + snapshot.bounds.max[0]) / 2,
      Math.min(0, snapshot.bounds.min[1]) - 2,
      snapshot.bounds.min[2] - P.radius * 3,
    ];
    const found = this.ready ? this.findSafe(candidate) : undefined;
    this.feet = found ?? candidate;
    this.previous = [...this.feet];
    this.motion = this.previousMotion = initialMotion(this.yaw);
    this.settle();
    this.spawn = [...this.feet];
    this.locomotion =
      request.locomotion === "fly-noclip" || !found ? "fly-noclip" : "walk";
    if (found) this.safe = [...found];
    if (!found)
      this.warnings.push(
        "No safe walk spawn was found. Fly / pass through walls is active; choose a clear spawn to walk.",
      );
    this.syncCollider();
    this.world.step();
    this.refreshSupport(this.locomotion === "walk");
    if (autoDoors) {
      const groups = new Map(
        allSources.map((source) => [source.rigId, source.groups] as const),
      );
      this.autoDoors = {
        doors: autoDoors.doors.map((door) => {
          const mechanism = this.mechanisms.get(door.rigId);
          const leafGroup = `leaf-${door.jointId === "door" ? 1 : door.jointId.slice(5)}`;
          const mesh = groups.get(door.rigId)?.[leafGroup];
          const { swing, limits } =
            mechanism && mesh
              ? this.chooseDoorSwing(
                  door,
                  mesh,
                  mechanism.proxyCollider(leafGroup),
                  mechanism.shutterSwingReach(door.jointId),
                )
              : {
                  swing: "blocked" as const,
                  limits: [0, 0] as [number, number],
                };
          mechanism?.restrictJointLimits(door.jointId, limits);
          return { ...structuredClone(door), swing };
        }),
        skipped: structuredClone(autoDoors.skipped),
      };
    }
  }
  private autoDoors?: {
    doors: Array<AutoDoor & { swing: PlayAutoDoorSwing }>;
    skipped: AutoDoorSkip[];
  };
  /**
   * LDraw has no door-stop data. Sweep an inset convex proxy of the leaf
   * both ways around the hinge against the rest of the Play world (frame,
   * walls, other rigs): a direction is free when the leaf clears 15-90 degrees.
   */
  private chooseDoorSwing(
    door: AutoDoor,
    mesh: CollisionSnapshot,
    own: RAPIER.Collider | undefined,
    sourceReach?: [number, number],
  ): { swing: PlayAutoDoorSwing; limits: [number, number] } {
    if (sourceReach) {
      const [negative, positive] = sourceReach;
      return {
        limits: sourceReach,
        swing:
          negative && positive
            ? "both"
            : negative
              ? "negative"
              : positive
                ? "positive"
                : "blocked",
      };
    }
    const v = mesh.vertices;
    if (!v.length) return { swing: "blocked", limits: [0, 0] };
    const min = [Infinity, Infinity, Infinity],
      max = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < v.length; i++) {
      min[i % 3] = Math.min(min[i % 3], v[i]);
      max[i % 3] = Math.max(max[i % 3], v[i]);
    }
    const center = min.map((m, k) => (m + max[k]) / 2),
      shrink = min.map((m, k) => {
        const half = (max[k] - m) / 2;
        return half > 2.5 ? (half - 2) / half : 0.2;
      });
    const seen = new Set<string>(),
      points: number[] = [];
    for (let i = 0; i < v.length; i += 3) {
      const q = [0, 1, 2].map(
        (k) => center[k] + (v[i + k] - center[k]) * shrink[k] - door.pivot[k],
      ) as Vec3;
      const key = q.map((n) => Math.round(n)).join(",");
      if (seen.has(key)) continue;
      seen.add(key);
      const m = physics(q);
      points.push(m.x, m.y, m.z);
    }
    const shape = new RAPIER.ConvexPolyhedron(new Float32Array(points), null);
    const axis = physicsDirection(door.axis);
    const blocked = (degrees: number) => {
      const half = (degrees * Math.PI) / 360,
        s = Math.sin(half);
      return !!this.world.intersectionWithShape(
        physics(door.pivot),
        { x: axis.x * s, y: axis.y * s, z: axis.z * s, w: Math.cos(half) },
        shape,
        RAPIER.QueryFilterFlags.EXCLUDE_SENSORS,
        undefined,
        own,
      );
    };
    if (blocked(0)) return { swing: "both", limits: [-90, 90] };
    // How far the leaf turns each way before it meets the build, in 5°
    // steps. A door authored ajar (common in official models) can close
    // until it meets its frame as well as open; under 15° is a stop.
    const reach = (sign: number) => {
      let free = 0;
      for (let angle = 5; angle <= 90; angle += 5) {
        if (blocked(sign * angle)) break;
        free = angle;
      }
      return free >= 15 ? free : 0;
    };
    const positive = reach(1),
      negative = reach(-1);
    return {
      swing:
        positive && negative
          ? "both"
          : positive
            ? "positive"
            : negative
              ? "negative"
              : "blocked",
      limits: [negative ? -negative : 0, positive],
    };
  }
  static async create(
    snapshot: CollisionSnapshot,
    request: PlayRequest = {},
    mechanismSource?: PlayMechanismSource | PlayMechanismSource[],
    autoDoors?: { doors: AutoDoor[]; skipped: AutoDoorSkip[] },
    trains?: PlayTrainSource,
  ): Promise<PlaySession> {
    ensure(
      request && typeof request === "object",
      "INVALID_INPUT",
      "Play request must be an object.",
    );
    keys(request, [
      "position",
      "yaw",
      "pitch",
      "locomotion",
      "cameraMode",
      "ground",
      "realtime",
      "rigId",
      "rigIds",
      "dynamicRigIds",
      "autoDoors",
      "cameraSettings",
      "worldProfile",
      "trains",
    ]);
    const requestedWorld = validatePlayWorldProfile(request.worldProfile);
    const resolvedWorld = validatePlayWorldProfile(
      snapshot.worldProfile
        ? { excludedLayerIds: snapshot.worldProfile.excludedLayerIds }
        : undefined,
    );
    ensure(
      JSON.stringify(requestedWorld) === JSON.stringify(resolvedWorld),
      "INVALID_INPUT",
      "Play geometry must be extracted using the requested layer profile",
    );
    if (snapshot.worldProfile)
      ensure(
        Array.isArray(snapshot.worldProfile.includedOccurrenceIds) &&
          snapshot.worldProfile.includedOccurrenceIds.length <=
            RESOURCE_PROFILES.desktop.occurrences &&
          snapshot.worldProfile.includedOccurrenceIds.every(isOccurrenceId) &&
          new Set(snapshot.worldProfile.includedOccurrenceIds).size ===
            snapshot.worldProfile.includedOccurrenceIds.length,
        "INVALID_INPUT",
        "Invalid resolved Play occurrence profile",
      );
    resolvePlayCameraSettings(request.cameraSettings);
    if (request.position) point(request.position);
    for (const k of ["yaw", "pitch"] as const)
      if (request[k] !== undefined)
        ensure(
          finite(request[k]),
          "INVALID_INPUT",
          "Look angles must be finite radians.",
        );
    if (request.locomotion !== undefined)
      ensure(
        ["walk", "fly-noclip"].includes(request.locomotion),
        "INVALID_INPUT",
        "Unknown movement mode.",
      );
    if (request.cameraMode !== undefined)
      ensure(
        ["first-person", "third-person"].includes(request.cameraMode),
        "INVALID_INPUT",
        "Unknown camera mode.",
      );
    for (const k of ["ground", "realtime"] as const)
      if (request[k] !== undefined)
        ensure(
          typeof request[k] === "boolean",
          "INVALID_INPUT",
          `${k} must be boolean.`,
        );
    ensure(
      snapshot.vertices.length % 3 === 0 &&
        snapshot.indices.length % 3 === 0 &&
        validMesh(snapshot.vertices, snapshot.indices),
      "INVALID_INPUT",
      "Invalid collision mesh.",
    );
    point(snapshot.bounds.min);
    point(snapshot.bounds.max);
    ensure(
      Number.isSafeInteger(snapshot.revision) && snapshot.revision >= 0,
      "INVALID_INPUT",
      "Invalid snapshot revision.",
    );
    ensure(
      request.rigId === undefined || request.rigIds === undefined,
      "INVALID_INPUT",
      "Choose rigId or rigIds, not both",
    );
    if (request.rigIds !== undefined)
      ensure(
        Array.isArray(request.rigIds) &&
          request.rigIds.length <= 32 &&
          request.rigIds.every(
            (id) => typeof id === "string" && id.length > 0 && id.length <= 128,
          ) &&
          new Set(request.rigIds).size === request.rigIds.length,
        "INVALID_INPUT",
        "Play rigIds must contain at most 32 distinct rig IDs",
      );
    const sources = Array.isArray(mechanismSource)
      ? mechanismSource
      : mechanismSource
        ? [mechanismSource]
        : [];
    const requested =
      request.rigIds ??
      (request.rigId === undefined ? undefined : [request.rigId]);
    ensure(
      requested === undefined ||
        (requested.length === sources.length &&
          requested.every((id) =>
            sources.some((source) => source.rigId === id),
          )),
      "INVALID_INPUT",
      "Requested Play rigs require matching geometry from the same source revision",
    );
    validatePlayMechanismSources(sources, snapshot.revision, {
      deferReviewedContacts: true,
    });
    if (request.dynamicRigIds !== undefined) {
      ensure(
        Array.isArray(request.dynamicRigIds) &&
          new Set(request.dynamicRigIds).size ===
            request.dynamicRigIds.length &&
          request.dynamicRigIds.every((id) =>
            sources.some((source) => source.rigId === id),
          ),
        "INVALID_INPUT",
        "dynamicRigIds must be distinct active Play rigs",
      );
      validateDynamicRigSources(
        sources.filter((source) =>
          request.dynamicRigIds!.includes(source.rigId),
        ) as DynamicRigSource[],
        snapshot.revision,
      );
    }
    // Bind lazy source-reviewed proxies before native initialization or any
    // world/event allocation. The synchronous constructor consumes this exact
    // source identity; missing or changed canonical geometry cannot fall back.
    await loadReviewedMechanicalProxies(sources);
    validatePlayMechanismSources(sources, snapshot.revision);
    await (initialization ??= RAPIER.init());
    if (autoDoors)
      ensure(
        autoDoors.doors.every((door) =>
          (Array.isArray(mechanismSource) ? mechanismSource : []).some(
            (source) =>
              source.rigId === door.rigId &&
              !request.dynamicRigIds?.includes(door.rigId),
          ),
        ),
        "INVALID_INPUT",
        "Automatic doors need their derived kinematic rig sources",
      );
    if (trains) {
      let triangles = 0;
      for (const train of trains.derived.trains)
        train.cars.forEach((_, i) => {
          const mesh = trains.meshes[`${train.id}/${i}`];
          ensure(
            mesh &&
              mesh.revision === snapshot.revision &&
              !mesh.unsupported &&
              validMesh(mesh.vertices, mesh.indices),
            "INVALID_INPUT",
            "Train cars require valid complete geometry from the source revision",
          );
          triangles += mesh.indices.length / 3;
        });
      ensure(
        triangles <= TRAIN_TRIANGLE_BUDGET,
        "LIMIT_EXCEEDED",
        `Trains exceed ${TRAIN_TRIANGLE_BUDGET.toLocaleString("en")} moving triangles`,
      );
    }
    return new PlaySession(
      snapshot.revision,
      snapshot,
      request,
      mechanismSource,
      autoDoors,
      trains,
    );
  }
  private alive() {
    ensure(!this.disposed, "INVALID_INPUT", "Play session has ended.");
  }
  private center(p: Vec3) {
    return physics([p[0], p[1] - P.height / 2, p[2]]);
  }
  private syncCollider() {
    this.collider.setTranslation(this.center(this.feet));
  }
  private clear(p: Vec3) {
    return !this.world.intersectionWithShape(
      this.center(p),
      rot,
      this.capsule,
      undefined,
      undefined,
      this.collider,
      undefined,
      (c) => !this.seatedColliders.some((body) => body.handle === c.handle),
    );
  }
  private findSafe(candidate: Vec3): Vec3 | undefined {
    // Downward capsule sweep chooses a supported pose, preserving openings.
    for (const [dx, dz] of [
      [0, 0],
      [24, 0],
      [-24, 0],
      [0, 24],
      [0, -24],
      [48, 0],
      [-48, 0],
      [0, 48],
      [0, -48],
    ]) {
      const start: Vec3 = [
        candidate[0] + dx,
        candidate[1] - P.stepHeight - 1,
        candidate[2] + dz,
      ];
      if (!this.clear(start)) continue;
      const hit = this.world.castShape(
        this.center(start),
        rot,
        { x: 0, y: -S, z: 0 },
        this.capsule,
        0,
        // Far enough to reach the ground from above the tallest build
        // (the default spawn starts over its highest point).
        Math.max(2000, this.groundY - start[1] + 400),
        true,
        undefined,
        undefined,
        this.collider,
        undefined,
        (c) => !this.seatedColliders.some((body) => body.handle === c.handle),
      );
      if (
        hit &&
        hit.normal1.y >= Math.cos((P.maxSlopeDegrees * Math.PI) / 180)
      ) {
        const p: Vec3 = [
          start[0],
          start[1] + hit.time_of_impact - 0.2,
          start[2],
        ];
        if (this.clear(p)) return p;
      }
    }
    return undefined;
  }
  /** Actionable reason walking is refused because collision is unavailable. */
  private walkUnavailableMessage() {
    return (
      "Walking is off for this world, so you stay in Fly. " +
      (this.collisionIssue ?? "Collision geometry is unavailable.")
    );
  }
  private requireOnFoot() {
    ensure(
      !this.occupied && !this.controlledVehicle,
      "INVALID_INPUT",
      "Exit vehicle first",
    );
  }
  /** Possess a certified vehicle without inventing a physical seat attachment. */
  controlVehicle(rigId: string) {
    this.alive();
    this.requireOnFoot();
    ensure(!this.riding, "INVALID_INPUT", "Get off the train first");
    const target = this.rigTarget(rigId);
    const state = target.rig.snapshot();
    const view = this.vehicleViews.get(rigId);
    ensure(
      view && state.pose.vehicle && this.vehicleWorld?.report(rigId)?.supported,
      "INVALID_INPUT",
      state.vehicleCollision?.reason ?? "Unknown supported active vehicle",
    );
    this.clearInput();
    const heading = seatYaw(state.groupFrames[view.chassisGroup]);
    this.controlledVehicle = {
      rigId,
      ...view,
      previousCamera: this.cameraMode,
      previousPitch: this.pitch,
      heading,
      zoom: 1,
    };
    this.cameraMode = "third-person";
    this.yaw = heading + Math.PI / 5;
    this.pitch = Math.PI / 7;
    this.support = undefined;
    this.inheritedVelocity = [0, 0, 0];
    this.collider.setEnabled(false);
    this.dynamics?.setActorSolid(false);
    this.updateControlledVehicle();
    this.previous = [...this.feet];
    this.settle();
    return this.snapshot();
  }
  releaseVehicle() {
    this.alive();
    if (!this.controlledVehicle) return this.snapshot();
    const control = this.controlledVehicle;
    this.clearInput();
    const state = this.rigTarget(control.rigId).rig.snapshot();
    const frame = state.groupFrames[control.chassisGroup];
    let chosen: Vec3 | undefined;
    for (const candidate of vehicleExitCandidates(
      control.geometry,
      state.groupFrames,
      frame,
    )) {
      try {
        const position = this.seatStandingPoint(candidate, true);
        this.validateSpawn({ position });
        chosen = position;
        break;
      } catch {
        // Failed candidates preserve possession and the hidden player.
      }
    }
    ensure(
      chosen,
      "INVALID_INPUT",
      "Exit blocked — move the vehicle to a clear space",
    );
    this.controlledVehicle = undefined;
    this.cameraMode = control.previousCamera;
    this.pitch = control.previousPitch;
    this.locomotion = "walk";
    this.feet = [...chosen];
    this.previous = [...chosen];
    this.velocity = [0, 0, 0];
    this.grounded = true;
    this.motion = initialMotion(this.yaw);
    this.collider.setEnabled(true);
    this.syncCollider();
    this.world.step();
    this.dynamics?.setActorSolid(true, this.feet);
    this.settle();
    this.updateArm(true);
    return this.snapshot();
  }
  private updateControlledVehicle() {
    const control = this.controlledVehicle;
    if (!control) return;
    const frame = this.rigTarget(control.rigId).rig.snapshot().groupFrames[
      control.chassisGroup
    ];
    const heading = seatYaw(frame);
    this.yaw += wrapAngle(heading - control.heading);
    control.heading = heading;
    this.feet = [...frame.position];
    this.velocity = [0, 0, 0];
    this.grounded = false;
  }
  private sweepStanding(a: Vec3, b: Vec3) {
    if (!this.clear(a) || !this.clear(b)) return false;
    const hit = this.world.castShape(
      this.center(a),
      rot,
      physics(b.map((v, i) => v - a[i]) as Vec3),
      this.capsule,
      0,
      1,
      true,
      undefined,
      undefined,
      this.collider,
      undefined,
      (c) => !this.seatedColliders.some((body) => body.handle === c.handle),
    );
    return !hit;
  }
  private validateSeatRequest(request: PlaySeatRequest) {
    ensure(
      request && typeof request === "object" && !Array.isArray(request),
      "INVALID_INPUT",
      "Seat request must be an object",
    );
    keys(request, ["rigId", "seatId"]);
    ensure(
      [request.rigId, request.seatId].every(
        (id) =>
          typeof id === "string" && id.length > 0 && [...id].length <= 1024,
      ),
      "INVALID_INPUT",
      "Seat request needs bounded rig and seat IDs",
    );
  }
  private seatStandingPoint(position: Vec3, dynamic: boolean) {
    if (!dynamic) return position;
    const start: Vec3 = [position[0], position[1] - P.stepHeight, position[2]];
    const hit = this.world.castShape(
      this.center(start),
      rot,
      { x: 0, y: -S, z: 0 },
      this.capsule,
      0,
      P.stepHeight * 2,
      true,
      undefined,
      undefined,
      this.collider,
      undefined,
      (c) => !c.isSensor(),
    );
    ensure(
      hit && hit.normal1.y >= Math.cos((P.maxSlopeDegrees * Math.PI) / 180),
      "INVALID_INPUT",
      "Driver seat approach or exit needs nearby walkable support",
    );
    return [
      position[0],
      start[1] + hit.time_of_impact - 0.2,
      position[2],
    ] as Vec3;
  }
  private seatEntry(request: PlaySeatRequest, fullTransfer = true) {
    this.validateSeatRequest(request);
    this.alive();
    this.requireOnFoot();
    ensure(
      this.locomotion === "walk" && this.ready,
      "INVALID_INPUT",
      "Driver seat entry requires Walk with complete collision",
    );
    const info = this.seatSources.get(request.rigId);
    ensure(
      info && info.seat.id === request.seatId,
      "INVALID_INPUT",
      "Unknown active driver seat",
    );
    const mechanism = this.rigTarget(request.rigId).rig,
      state = mechanism.snapshot();
    ensure(
      state.mode === "dynamic"
        ? this.vehicleWorld?.report(request.rigId)?.supported
        : state.vehicleCollision?.supported,
      "INVALID_INPUT",
      state.vehicleCollision?.reason ??
        "Vehicle does not support protected driving",
    );
    const frame = state.groupFrames[info.chassisGroup],
      access = seatPoint(frame, info.seat.accessPoint);
    ensure(
      Math.hypot(...access.map((v, i) => v - this.feet[i])) <= 96,
      "INVALID_INPUT",
      "Move closer to the driver's seat",
    );
    const eye: Vec3 = [
        this.feet[0],
        this.feet[1] - this.cameraSettings.eyeHeight,
        this.feet[2],
      ],
      delta = access.map((v, i) => v - eye[i]) as Vec3;
    const ray = new RAPIER.Ray(physics(eye), physics(delta));
    const obstruction = this.world.castRay(
      ray,
      1,
      true,
      undefined,
      undefined,
      this.collider,
    );
    ensure(
      !obstruction || obstruction.timeOfImpact >= 0.999,
      "INVALID_INPUT",
      "Driver seat access is obstructed",
    );
    const approach = this.seatStandingPoint(
        seatPoint(frame, info.seat.approachPosition),
        state.mode === "dynamic",
      ),
      placement = seatPlacement(frame, info.seat, state.mode === "dynamic");
    verifyWheelAttachment(info.source, state, placement);
    // Eligibility is a preliminary access/profile hint. Only explicit entry
    // performs every standing and staged-body transfer query against this tick.
    if (!fullTransfer) return { info, placement };
    this.validateSpawn({ position: approach });
    ensure(
      this.sweepStanding(this.feet, approach),
      "INVALID_INPUT",
      "Driver seat approach is blocked",
    );
    validateSeatTransfer(
      this.vehicleWorld!,
      approach,
      placement,
      false,
      (a, b) => this.sweepStanding(a, b),
      state.mode === "dynamic",
    );
    return { info, placement };
  }
  seatInteractionHint(request: PlaySeatRequest): PlaySeatEligibility {
    this.validateSeatRequest(request);
    this.alive();
    try {
      this.seatEntry(request, false);
      return { ...request, eligible: true };
    } catch (error) {
      return {
        ...request,
        eligible: false,
        reason:
          error instanceof Error ? error.message : "Driver seat is unavailable",
      };
    }
  }
  vehicleSeatEligibility(request: PlaySeatRequest): PlaySeatEligibility {
    this.validateSeatRequest(request);
    this.alive();
    const key = JSON.stringify([
      request,
      this.feet,
      this.locomotion,
      this.cameraSettings.eyeHeight,
      this.occupied?.request,
      this.snapshot().mechanisms,
    ]);
    if (this.seatEligibilityCache?.key === key)
      return { ...this.seatEligibilityCache.result };
    let result: PlaySeatEligibility;
    try {
      this.seatEntry(request);
      result = { ...request, eligible: true };
    } catch (error) {
      result = {
        ...request,
        eligible: false,
        reason:
          error instanceof Error ? error.message : "Driver seat is unavailable",
      };
    }
    this.seatEligibilityCache = { key, result };
    return { ...result };
  }
  enterVehicle(request: PlaySeatRequest) {
    const { placement } = this.seatEntry(request);
    this.clearInput();
    this.occupied = {
      request: { ...request },
      placement,
      localLookYaw: 0,
      localLookPitch: this.pitch,
      previousCamera: this.cameraMode,
    };
    this.cameraMode = "third-person";
    this.support = undefined;
    this.inheritedVelocity = [0, 0, 0];
    this.dynamics?.rig(request.rigId)?.setRider(placement);
    this.collider.setEnabled(false);
    for (const box of placement.envelopes)
      this.seatedColliders.push(
        this.world.createCollider(
          RAPIER.ColliderDesc.cuboid(
            ...(box.halfExtents.map((n) => n * S) as Vec3),
          ).setSensor(true),
        ),
      );
    this.updateOccupant();
    this.previous = [...this.feet];
    this.settle();
    this.world.step();
    this.updateArm(true);
    return this.snapshot();
  }
  exitVehicle(input: { exitIndex?: number } = {}) {
    this.alive();
    ensure(this.occupied, "INVALID_INPUT", "Enter a driver seat first");
    ensure(
      input && typeof input === "object" && !Array.isArray(input),
      "INVALID_INPUT",
      "Exit request must be an object",
    );
    keys(input, ["exitIndex"]);
    const info = this.seatSources.get(this.occupied.request.rigId)!,
      frame = this.rigTarget(this.occupied.request.rigId).rig.snapshot()
        .groupFrames[info.chassisGroup];
    ensure(
      input.exitIndex === undefined ||
        (Number.isInteger(input.exitIndex) &&
          input.exitIndex >= 0 &&
          input.exitIndex < info.seat.exits.length),
      "INVALID_INPUT",
      "Unknown driver seat exit",
    );
    this.clearInput();
    let chosen: { position: Vec3; yaw: number } | undefined;
    for (const index of input.exitIndex === undefined
      ? info.seat.exits.map((_, i) => i)
      : [input.exitIndex]) {
      const exit = info.seat.exits[index],
        yaw = seatYaw(frame) + (exit.yawDegrees * Math.PI) / 180;
      try {
        const position = this.seatStandingPoint(
          seatPoint(frame, exit.position),
          !!this.dynamics?.rig(this.occupied.request.rigId),
        );
        this.validateSpawn({ position });
        validateSeatTransfer(
          this.vehicleWorld!,
          position,
          this.occupied.placement,
          true,
          (a, b) => this.sweepStanding(a, b),
          !!this.dynamics?.rig(this.occupied.request.rigId),
        );
        chosen = { position, yaw };
        break;
      } catch {
        /* Test the next explicitly authored exit, never invent a teleport. */
      }
    }
    ensure(
      chosen,
      "INVALID_INPUT",
      "Exit blocked — move the vehicle to a clear space",
    );
    this.dynamics?.rig(this.occupied.request.rigId)?.setRider();
    for (const collider of this.seatedColliders)
      this.world.removeCollider(collider, true);
    this.seatedColliders = [];
    this.cameraMode = this.occupied.previousCamera;
    this.occupied = undefined;
    this.collider.setEnabled(true);
    this.feet = [...chosen.position];
    this.previous = [...this.feet];
    this.settle();
    this.yaw = chosen.yaw;
    this.motion = {
      ...this.motion,
      body: wrapAngle(chosen.yaw),
      bodyVelocity: 0,
    };
    this.settle();
    this.velocity = [0, 0, 0];
    this.support = undefined;
    this.inheritedVelocity = [0, 0, 0];
    this.grounded = false;
    this.syncCollider();
    this.world.step();
    this.updateArm(true);
    return this.snapshot();
  }
  private updateOccupant() {
    if (!this.occupied) return;
    const info = this.seatSources.get(this.occupied.request.rigId)!,
      frame = this.rigTarget(this.occupied.request.rigId).rig.snapshot()
        .groupFrames[info.chassisGroup];
    this.occupied.placement = seatPlacement(
      frame,
      info.seat,
      !!this.dynamics?.rig(this.occupied.request.rigId),
    );
    this.feet = [...this.occupied.placement.avatarRoot];
    this.velocity = [0, 0, 0];
    this.grounded = true;
    this.motion = {
      ...this.motion,
      body: wrapAngle(seatYaw(this.occupied.placement.pelvisFrame)),
      bodyVelocity: 0,
    };
    this.yaw = this.heading + this.occupied.localLookYaw;
    this.pitch = this.occupied.localLookPitch;
    this.occupied.placement.envelopes.forEach((box, i) => {
      this.seatedColliders[i].setTranslation(physics(box.frame.position));
      this.seatedColliders[i].setRotation(frameRotation(box.frame));
    });
  }
  setInput(input: PlayInput) {
    this.alive();
    ensure(
      input && typeof input === "object",
      "INVALID_INPUT",
      "Play input must be an object.",
    );
    keys(input, ["moveX", "moveZ", "vertical", "run", "jump", "yaw", "pitch"]);
    for (const k of ["moveX", "moveZ", "vertical"] as const)
      if (input[k] !== undefined)
        ensure(
          finite(input[k]) && Math.abs(input[k]!) <= 1,
          "INVALID_INPUT",
          "Movement inputs must be between -1 and 1.",
        );
    for (const k of ["run", "jump"] as const)
      if (input[k] !== undefined)
        ensure(
          typeof input[k] === "boolean",
          "INVALID_INPUT",
          "Action inputs must be boolean.",
        );
    for (const k of ["yaw", "pitch"] as const)
      if (input[k] !== undefined)
        ensure(
          finite(input[k]),
          "INVALID_INPUT",
          "Look angles must be finite radians.",
        );
    this.input = {
      moveX: input.moveX ?? 0,
      moveZ: input.moveZ ?? 0,
      vertical: input.vertical ?? 0,
      run: input.run ?? false,
      jump: input.jump ?? false,
    };
    // Riding a train: the explorer stands in the cab and only the look
    // turns. Forward/backward work the train's lever (released, the train
    // holds its speed) and jump is the brake.
    if (this.riding) {
      const lever = Math.sign(this.input.moveZ) as -1 | 0 | 1;
      if (lever !== this.driveLever) {
        this.driveLever = lever;
        this.trains?.setDrive(lever, this.riding.trainId);
      }
      if (this.input.jump && !this.brakeHeld)
        this.trains?.stop(this.riding.trainId);
      this.brakeHeld = this.input.jump;
      this.input = {
        ...this.input,
        moveX: 0,
        moveZ: 0,
        vertical: 0,
        jump: false,
      };
    }
    if (input.yaw !== undefined)
      this.yaw = ((input.yaw % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    if (input.pitch !== undefined) this.pitch = this.clampPitch(input.pitch);
    if (this.controlledVehicle) {
      this.rigTarget(this.controlledVehicle.rigId).rig.setVehicleInput({
        throttle: input.moveZ ?? 0,
        steering: -(input.moveX ?? 0),
      });
      this.input = {
        ...this.input,
        moveX: 0,
        moveZ: 0,
        vertical: 0,
        jump: false,
      };
    }
    if (this.occupied) {
      this.occupied.localLookYaw = Math.atan2(
        Math.sin(this.yaw - this.heading),
        Math.cos(this.yaw - this.heading),
      );
      this.occupied.localLookPitch = this.pitch;
      this.rigTarget(this.occupied.request.rigId).rig.setVehicleInput({
        throttle: input.moveZ ?? 0,
        steering: -(input.moveX ?? 0),
      });
    }
  }
  clearInput() {
    for (const mechanism of this.mechanisms.values()) mechanism.clearInput();
    for (const id of this.dynamics?.rigIds() ?? [])
      this.dynamics!.rig(id)!.clearInput();
    this.setInput({});
    this.accumulator = 0;
    this.jumpHeld = false;
  }
  setCameraMode(mode: PlayCameraMode) {
    this.alive();
    ensure(
      mode === "first-person" || mode === "third-person",
      "INVALID_INPUT",
      "Unknown camera mode.",
    );
    ensure(
      !this.controlledVehicle || mode === "third-person",
      "INVALID_INPUT",
      "Exit vehicle first to use first person",
    );
    this.cameraMode = mode;
    this.updateArm(true);
    return this.snapshot();
  }
  setLocomotion(mode: PlayLocomotion) {
    this.requireOnFoot();
    this.alive();
    ensure(!this.riding, "INVALID_INPUT", "Get off the train first");
    ensure(
      mode === "walk" || mode === "fly-noclip",
      "INVALID_INPUT",
      "Unknown movement mode.",
    );
    if (mode === "walk" && this.locomotion !== "walk") {
      ensure(
        this.ready,
        "UNSUPPORTED_RENDER_FEATURE",
        this.walkUnavailableMessage(),
      );
      const safe =
        this.findSafe(this.feet) ??
        (this.safe && this.clear(this.safe) ? this.safe : undefined);
      ensure(
        safe,
        "INVALID_INPUT",
        "Cannot enter Walk inside geometry or without a supporting surface. Choose a clear spawn.",
      );
      this.feet = [...safe];
      this.previous = [...safe];
      this.settle();
    }
    this.locomotion = mode;
    this.support = undefined;
    this.inheritedVelocity = [0, 0, 0];
    this.velocity = [0, 0, 0];
    this.clearInput();
    this.syncCollider();
    this.world.step();
    return this.snapshot();
  }
  teleport(input: PlayTeleportRequest) {
    this.requireOnFoot();
    this.alive();
    keys(input, ["position", "policy", "yaw", "pitch"]);
    // Teleporting (and respawning) leaves the train.
    if (this.riding) {
      this.releaseLever();
      this.riding = undefined;
    }
    point(input.position);
    ensure(
      input.policy === undefined ||
        input.policy === "safe" ||
        input.policy === "free-flight",
      "INVALID_INPUT",
      "Unknown teleport policy.",
    );
    for (const k of ["yaw", "pitch"] as const)
      if (input[k] !== undefined)
        ensure(
          finite(input[k]),
          "INVALID_INPUT",
          "Look angles must be finite.",
        );
    if (input.policy === "free-flight") this.locomotion = "fly-noclip";
    else {
      ensure(this.ready, "INVALID_INPUT", this.walkUnavailableMessage());
      ensure(
        this.clear(input.position),
        "INVALID_INPUT",
        "Teleport target intersects geometry.",
      );
    }
    this.feet = [...input.position];
    this.previous = [...this.feet];
    this.settle();
    this.velocity = [0, 0, 0];
    this.support = undefined;
    this.inheritedVelocity = [0, 0, 0];
    this.grounded = false;
    this.setInput({ yaw: input.yaw, pitch: input.pitch });
    this.syncCollider();
    this.world.step();
    return this.snapshot();
  }
  respawn() {
    this.requireOnFoot();
    return this.teleport({
      position: this.safe ?? this.spawn,
      policy: this.ready ? "safe" : "free-flight",
    });
  }
  stepTicks(count: number) {
    this.alive();
    ensure(
      Number.isInteger(count) && count >= 0 && count <= 3600,
      "INVALID_INPUT",
      "stepTicks requires 0–3600 ticks.",
    );
    for (let i = 0; i < count; i++) this.step();
    return this.snapshot();
  }
  /**
   * Realtime catch-up. Each fixed tick is unchanged; only how many run per frame is
   * bounded. When catch-up ticks exceed `budgetMs` of wall time, the whole-tick backlog
   * is dropped (the world briefly runs slower than realtime) instead of making every
   * following frame slower still. Returns the number of ticks run.
   */
  advance(seconds: number, budgetMs = Infinity) {
    this.alive();
    ensure(
      finite(seconds) && seconds >= 0,
      "INVALID_INPUT",
      "Frame duration must be nonnegative.",
    );
    ensure(
      budgetMs > 0,
      "INVALID_INPUT",
      "Frame tick budget must be positive.",
    );
    this.accumulator += Math.min(seconds, 0.1);
    const start = performance.now();
    let count = 0;
    while (this.accumulator >= DT && count < 6) {
      this.step();
      this.accumulator -= DT;
      count++;
      if (performance.now() - start >= budgetMs) {
        this.accumulator %= DT;
        break;
      }
    }
    return count;
  }
  private supportFrame(handle: number) {
    for (const mechanism of this.mechanisms.values()) {
      const found = mechanism.supportFrame(handle);
      if (found) return found;
    }
    return this.dynamics?.supportFrame(handle);
  }
  private supportTransferClear(from: Transform, to: Transform) {
    const support = this.support;
    if (!support) return true;
    const angle = frameRotation(from).angleTo(frameRotation(to));
    const distance =
      Math.hypot(...to.position.map((v, i) => v - from.position[i])) +
      Math.hypot(...support.local) * angle;
    const steps = Math.max(1, Math.ceil(distance / 0.5));
    if (steps > 128) return false;
    // Interpolate the rigid point's arc, retaining an upright standing capsule.
    const qa = frameRotation(from),
      qb = frameRotation(to);
    let previous = [...this.feet] as Vec3;
    for (let n = 1; n <= steps; n++) {
      const q = qa.clone().slerp(qb, n / steps);
      const basis = basisFromRotation(q);
      const frame: Transform = {
        basis,
        position: from.position.map(
          (v, i) => v + ((to.position[i] - v) * n) / steps,
        ) as Vec3,
      };
      const next = seatPoint(frame, support.local);
      const hit = this.world.castShape(
        this.center(previous),
        rot,
        physics(next.map((v, i) => v - previous[i]) as Vec3),
        this.capsule,
        0,
        1,
        true,
        undefined,
        undefined,
        this.collider,
        undefined,
        (c) => c.handle !== support.handle && !c.isSensor(),
      );
      if (hit && hit.time_of_impact < 0.999) return false;
      previous = next;
    }
    return true;
  }
  private transferSupport() {
    const support = this.support;
    if (!support) return;
    const current = this.supportFrame(support.handle);
    if (!current || !this.supportTransferClear(support.frame, current.frame)) {
      this.support = undefined;
      this.grounded = false;
      this.inheritedVelocity = [...support.pointVelocity];
      return;
    }
    const next = seatPoint(current.frame, support.local);
    support.pointVelocity = next.map((v, i) => (v - this.feet[i]) / DT) as Vec3;
    const requested = next.map((v, i) => v - this.feet[i]) as Vec3;
    const moved = this.moveCharacter(requested, support.handle);
    this.feet = this.feet.map((v, i) => v + moved[i]) as Vec3;
    if (Math.hypot(...moved.map((v, i) => v - requested[i])) > 0.05) {
      this.support = undefined;
      this.grounded = false;
      this.inheritedVelocity = [...support.pointVelocity];
      this.syncCollider();
      return;
    }
    // An upright capsule follows platform yaw, never its roll/pitch.
    const turn = wrapAngle(seatYaw(current.frame) - seatYaw(support.frame));
    this.yaw += turn;
    this.motion = { ...this.motion, body: wrapAngle(this.motion.body + turn) };
    support.frame = current.frame;
    this.syncCollider();
  }
  private refreshSupport(supported = this.grounded) {
    if (!supported || this.locomotion !== "walk") {
      if (this.support && this.locomotion === "walk") {
        this.inheritedVelocity = [...this.support.pointVelocity];
        this.velocity[1] += this.inheritedVelocity[1];
        this.inheritedVelocity[1] = 0;
      }
      this.support = undefined;
      return;
    }
    const hit = this.world.castShape(
      this.center([this.feet[0], this.feet[1] - 0.5, this.feet[2]]),
      rot,
      { x: 0, y: -S, z: 0 },
      this.capsule,
      0,
      3,
      true,
      RAPIER.QueryFilterFlags.EXCLUDE_SENSORS,
      undefined,
      this.collider,
    );
    const found =
      hit && hit.normal1.y >= Math.cos((P.maxSlopeDegrees * Math.PI) / 180)
        ? this.supportFrame(hit.collider.handle)
        : undefined;
    if (!found) {
      if (this.support)
        this.inheritedVelocity = [...this.support.pointVelocity];
      this.support = undefined;
      return;
    }
    const pointVelocity =
      this.support?.handle === hit!.collider.handle
        ? this.support.pointVelocity
        : ([0, 0, 0] as Vec3);
    this.support = {
      handle: hit!.collider.handle,
      ...found,
      local: seatPoint(inverse(found.frame), this.feet),
      pointVelocity,
    };
  }
  private step() {
    this.previousMotion = this.motion;
    for (const id of [...this.mechanisms.keys()].sort()) {
      this.mechanisms.get(id)!.step();
      if (this.occupied?.request.rigId === id) this.updateOccupant();
    }
    if (this.trains) this.stepTrains();
    if (this.dynamics) {
      for (const [id, mechanism] of this.mechanisms)
        this.dynamics.syncKinematicRig(id, mechanism.groupFrames());
      for (const id of this.trains?.ids ?? []) this.syncTrainDynamics(id);
      this.dynamics.step(
        this.feet,
        this.locomotion === "walk" &&
          !this.occupied &&
          !this.controlledVehicle &&
          !this.riding,
        this.support &&
          this.supportTransferClear(
            this.support.frame,
            this.dynamics.supportNextFrame(this.support.handle) ??
              this.support.frame,
          )
          ? this.support.handle
          : undefined,
      );
    }
    if (this.controlledVehicle) {
      this.previous = [...this.feet];
      this.updateControlledVehicle();
      this.world.step();
      this.settle();
      this.tick++;
      return;
    }
    if (this.riding) {
      // Standing at the controls: the feet move with the cab.
      if (this.mechanisms.size || this.dynamics || this.trainProxies.size)
        this.world.step();
      this.previous = [...this.feet];
      this.placeRider();
      this.velocity = this.feet.map(
        (v, k) => (v - this.previous[k]) / DT,
      ) as Vec3;
      this.updateRide();
      this.tick++;
      return;
    }
    if (this.occupied) {
      this.previous = [...this.feet];
      this.updateOccupant();
      this.world.step();
      this.settle();
      this.updateArm();
      this.tick++;
      return;
    }
    if (this.mechanisms.size || this.dynamics || this.trainProxies.size)
      this.world.step();
    this.previous = [...this.feet];
    this.transferSupport();
    const i = this.input;
    let x = i.moveX,
      z = i.moveZ,
      y = this.locomotion === "fly-noclip" ? i.vertical : 0;
    const n = Math.max(1, Math.hypot(x, z, y));
    x /= n;
    z /= n;
    y /= n;
    const speed =
      this.locomotion === "walk"
        ? i.run
          ? P.runSpeed
          : P.walkSpeed
        : P.flySpeed * (i.run ? 1.7 : 1);
    const cp = this.locomotion === "walk" ? 1 : Math.cos(this.pitch),
      sp = this.locomotion === "walk" ? 0 : Math.sin(this.pitch);
    // LDraw up is -Y: camera-right = forward × up = [-cos(yaw), 0, -sin(yaw)].
    let delta: Vec3 = [
      (-x * Math.cos(this.yaw) + z * Math.sin(this.yaw) * cp) * speed * DT,
      -(y + z * sp) * speed * DT,
      (-x * Math.sin(this.yaw) - z * Math.cos(this.yaw) * cp) * speed * DT,
    ];
    // The intended (camera-relative) travel, before any collision: an orbit
    // camera turns the figure to face it.
    const wishX = delta[0],
      wishZ = delta[2];
    if (this.locomotion === "fly-noclip") {
      const length = Math.hypot(...delta),
        limit = speed * DT;
      if (length > limit)
        delta = delta.map((v) => (v * limit) / length) as Vec3;
    }
    let stopped = false;
    if (this.locomotion === "walk") {
      if (i.jump && !this.jumpHeld && this.grounded) {
        this.inheritedVelocity = this.support
          ? [...this.support.pointVelocity]
          : [0, 0, 0];
        this.support = undefined;
        this.grounded = false;
        this.velocity[1] = -P.jumpSpeed + this.inheritedVelocity[1];
        this.inheritedVelocity[1] = 0;
      }
      delta[0] += this.inheritedVelocity[0] * DT;
      delta[2] += this.inheritedVelocity[2] * DT;
      this.velocity[1] = Math.min(500, this.velocity[1] + P.gravity * DT);
      // While standing, the controller is asked only for horizontal travel;
      // snap-to-ground keeps the feet on the floor. Adding gravity's small
      // downward step to every grounded sweep aimed it into the floor, where
      // it caught the internal edges between coplanar triangles and stalled
      // for a tick every few steps: the stop-start judder seen walking
      // diagonally across plates or sliding along a wall. Standing still (and
      // airborne) still sweeps with gravity, so a floor that moves away is felt.
      const gravitySweep =
        !this.grounded ||
        this.velocity[1] < 0 ||
        Math.hypot(delta[0], delta[2]) < 1e-6;
      delta[1] = gravitySweep ? this.velocity[1] * DT : 0;
      const desired = delta,
        wasGrounded = this.grounded;
      delta = this.moveCharacter(desired);
      // Rising under a jump is never grounded. Rapier reports ground for a
      // capsule jumping up along a riser taller than its autostep (seen with
      // the minifig's 12 LDU radius), which zeroed the jump mid-air.
      this.grounded =
        this.controller.computedGrounded() &&
        !(this.velocity[1] < 0 && delta[1] < -1e-3);
      const want = Math.hypot(desired[0], desired[2]),
        got = Math.hypot(delta[0], delta[2]);
      if (
        wasGrounded &&
        this.velocity[1] >= 0 &&
        want > 1e-6 &&
        got < want * 0.9
      ) {
        const stepped = this.stepUp([desired[0], 0, desired[2]], got);
        if (stepped) {
          delta = stepped;
          this.grounded = true;
        }
      }
      stopped =
        this.grounded ||
        (gravitySweep && Math.abs(delta[1]) < Math.abs(desired[1]) * 0.5);
    } else this.grounded = false;
    this.jumpHeld = i.jump;
    this.feet = this.feet.map((v, k) => v + delta[k]) as Vec3;
    // A step-up or ground snap lifts the feet without being a launch: on
    // ground (or under a ceiling) the vertical speed restarts from zero.
    // Deriving it from the corrected displacement turned every autostep onto
    // a stud into a small hop, bouncing the character up to 16 LDU.
    this.velocity = [delta[0] / DT, stopped ? 0 : delta[1] / DT, delta[2] / DT];
    this.syncCollider();
    this.world.step();
    this.refreshSupport();
    if (this.grounded) this.inheritedVelocity = [0, 0, 0];
    this.motion = advanceMotion(this.motion, {
      dx: delta[0],
      dz: delta[2],
      vy: this.velocity[1],
      grounded: this.grounded,
      flying: this.locomotion === "fly-noclip",
      nearGround:
        this.locomotion === "fly-noclip" &&
        Math.hypot(delta[0], delta[2]) > 0.01 &&
        this.surfaceBelow(6),
      lookYaw: this.yaw,
      dt: DT,
      orbit: this.cameraMode === "third-person",
      wishX,
      wishZ,
    });
    if (this.grounded && this.clear(this.feet)) this.safe = [...this.feet];
    if (
      this.feet[1] > Math.max(this.bounds.max[1], this.groundY) + 3000 &&
      this.locomotion === "walk"
    ) {
      this.feet = [...(this.safe ?? this.spawn)];
      this.previous = [...this.feet];
      this.settle();
      this.velocity = [0, 0, 0];
      this.syncCollider();
    }
    this.updateRide();
    this.updateArm();
    this.tick++;
  }
  private cast(from: Vec3, direction: Vec3, maxToi: number) {
    return this.world.castShape(
      this.center(from),
      rot,
      physics(direction),
      this.capsule,
      0,
      maxToi,
      true,
      undefined,
      undefined,
      this.collider,
      undefined,
      (c) => !this.seatedColliders.some((body) => body.handle === c.handle),
    );
  }
  /**
   * Step up a riser of up to the profile's step height (one brick) when
   * walking is blocked. Probes one body radius ahead above the riser for a
   * walkable top with headroom (swept casts), then lifts the feet onto that
   * level and moves on as far as is clear. The camera and figure rise
   * smoothly through the ride tracks. Returns the displacement, or nothing
   * when there is no step to take.
   */
  private stepUp(horizontal: Vec3, progress: number): Vec3 | undefined {
    const start = this.feet,
      length = Math.hypot(horizontal[0], horizontal[2]);
    const up = this.cast(start, [0, -1, 0], P.stepHeight + 0.5);
    const headroom = up ? up.time_of_impact - 0.2 : P.stepHeight + 0.5;
    if (headroom < 1) return;
    const raised: Vec3 = [start[0], start[1] - headroom, start[2]];
    // Look one radius (plus this tick's travel) ahead for the step's top.
    const reach = (P.radius + length) / length;
    const ahead = this.cast(raised, horizontal, reach);
    const fraction = ahead
      ? Math.max(0, ahead.time_of_impact - 0.1 / length)
      : reach;
    if (length * fraction < P.radius * 0.75) return;
    const probe: Vec3 = [
      raised[0] + horizontal[0] * fraction,
      raised[1],
      raised[2] + horizontal[2] * fraction,
    ];
    const down = this.cast(probe, [0, 1, 0], headroom + 1);
    if (!down || down.normal1.y < Math.cos((P.maxSlopeDegrees * Math.PI) / 180))
      return;
    const top = probe[1] + down.time_of_impact - 0.2;
    // Only a real riser: the top must be above the feet and within reach.
    if (start[1] - top < 1 || start[1] - top > P.stepHeight + 0.5) return;
    const lifted: Vec3 = [start[0], top, start[2]];
    if (!this.clear(lifted)) return;
    // Continue this tick's travel from the lifted height where it is clear.
    const onward = this.cast(lifted, horizontal, 1);
    const travel = onward
      ? Math.max(0, onward.time_of_impact - 0.1 / length)
      : 1;
    const landed: Vec3 = [
      lifted[0] + horizontal[0] * travel,
      top,
      lifted[2] + horizontal[2] * travel,
    ];
    const end = this.clear(landed) ? landed : lifted;
    if (Math.hypot(end[0] - start[0], end[2] - start[2]) + 0.05 < progress)
      return;
    return end.map((v, k) => v - start[k]) as Vec3;
  }
  /** Ends render interpolation and ride smoothing after a discontinuity. */
  private settle() {
    this.previousMotion = this.motion;
    for (const track of Object.values(this.ride)) {
      track.y = track.previous = this.feet[1];
      track.velocity = 0;
    }
  }
  private updateRide() {
    // A capsule wider than a plate-high riser rides over its edge and leaves
    // the ground for a tick or two; that still counts as walking, as it does
    // for the figure's pose (AVATAR_MOTION.airDelayTicks).
    const walking =
      this.locomotion === "walk" &&
      !this.occupied &&
      (this.grounded || this.motion.airTicks <= AVATAR_MOTION.airDelayTicks);
    for (const track of Object.values(this.ride)) {
      track.previous = track.y;
      const before = Math.abs(track.y - this.feet[1]);
      // Snap only on a discontinuity: more than a step beyond the lag a track
      // may keep (climbing brick-high stairs briskly reaches the camera's).
      if (before > track.lag + P.stepHeight + 4) {
        track.y = this.feet[1];
        track.velocity = 0;
        continue;
      }
      // Walking on the ground glides; in the air or flying any remaining lag
      // closes quickly and never grows (physics motion there is smooth).
      [track.y, track.velocity] = smoothDamp(
        track.y,
        this.feet[1],
        track.velocity,
        walking ? RIDE_SMOOTH_TIME : RIDE_SMOOTH_TIME / 4,
        DT,
      );
      const lag = track.y - this.feet[1],
        limit = walking ? track.lag : Math.min(track.lag, before);
      if (Math.abs(lag) > limit) {
        track.y = this.feet[1] + Math.sign(lag) * limit;
        if (!walking) track.velocity = 0;
      }
    }
  }
  /** Interpolated presentation feet (render frames between fixed ticks). */
  private presentedFeet(alpha: number, track: "camera" | "figure"): Vec3 {
    const { y, previous } = this.ride[track];
    return [
      this.previous[0] + (this.feet[0] - this.previous[0]) * alpha,
      previous + (y - previous) * alpha,
      this.previous[2] + (this.feet[2] - this.previous[2]) * alpha,
    ];
  }
  /** One character-controller pass from the collider's current position;
   * returns the corrected LDraw displacement and reports dynamic pushes. */
  private moveCharacter(desired: Vec3, excludeHandle?: number): Vec3 {
    // A zero request is skipped: Rapier's controller answers it against a
    // half-space with a spurious lift instead of no motion.
    if (Math.hypot(...desired) < 1e-9) return [0, 0, 0];
    this.controller.computeColliderMovement(
      this.collider,
      physics(desired),
      undefined,
      undefined,
      excludeHandle === undefined
        ? undefined
        : (c) => c.handle !== excludeHandle,
    );
    const moved = ldraw(this.controller.computedMovement());
    if (this.dynamics) {
      const hits = [];
      for (let n = 0; n < this.controller.numComputedCollisions(); n++) {
        const hit = this.controller.computedCollision(n);
        if (
          hit?.collider &&
          hit.collider.handle !== this.support?.handle &&
          this.dynamics.isMirror(hit.collider.handle)
        )
          hits.push({
            handle: hit.collider.handle,
            point: hit.witness1,
            remaining: hit.translationDeltaRemaining,
          });
      }
      this.dynamics.push(hits);
    }
    return moved;
  }
  /** Whether solid collision lies within `distance` LDU below the feet. */
  private surfaceBelow(distance: number) {
    const hit = this.world.castRay(
      new RAPIER.Ray(physics([this.feet[0], this.feet[1] - 1, this.feet[2]]), {
        x: 0,
        y: -1,
        z: 0,
      }),
      (distance + 1) * S,
      true,
      RAPIER.QueryFilterFlags.EXCLUDE_SENSORS,
    );
    return !!hit;
  }
  private avatar(motion: AvatarMotionState = this.motion): AvatarPose {
    const orbit = this.cameraMode === "third-person";
    const head = headAngles(motion, this.yaw, this.pitch, orbit);
    if (this.occupied)
      return {
        state: "seated",
        heading: motion.body,
        basis: [...this.occupied.placement.pelvisFrame.basis],
        phase: motion.phase,
        swing: 0,
        // The seated head follows the look like the standing one, within
        // the seated limits (it may nod forward, never back into a backrest).
        ...orbitHead(
          this.occupied.localLookYaw,
          this.occupied.localLookPitch,
          SEATED_VISUAL_POSE.headYawLimits[1],
          SEATED_VISUAL_POSE.headPitchLimits,
        ),
        bob: 0,
        leftHip: SEATED_VISUAL_POSE.leftHip,
        rightHip: SEATED_VISUAL_POSE.rightHip,
        leftShoulder: SEATED_VISUAL_POSE.leftShoulder,
        rightShoulder: SEATED_VISUAL_POSE.rightShoulder,
        leftWrist: SEATED_VISUAL_POSE.leftWrist,
        rightWrist: SEATED_VISUAL_POSE.rightWrist,
      };
    const airborne = !this.grounded && this.locomotion === "walk";
    return {
      state: airborne
        ? this.velocity[1] < 0
          ? "jump"
          : "fall"
        : this.locomotion === "fly-noclip" && motion.amount < 0.03
          ? "fly"
          : motion.amount < 0.03
            ? "idle"
            : this.input.run
              ? "run"
              : "walk",
      heading: motion.body,
      phase: motion.phase,
      swing: motion.amount,
      ...head,
      bob: flyBob(motion),
      ...limbAngles(motion),
    };
  }
  /**
   * Render-frame view of the figure: the root and pose interpolated between
   * the last two fixed ticks with the same factor camera(true) uses, so the
   * figure and camera move together instead of juddering at the tick rate.
   */
  presentation(interpolate = false): {
    position: Vec3;
    avatar: AvatarPose;
    /** Simulated seconds at the presented instant. */
    time: number;
  } {
    this.alive();
    // A rider is drawn where the (uninterpolated) train is, in its cab.
    const alpha = interpolate && !this.riding ? this.accumulator / DT : 1;
    return {
      time: (this.tick - 1 + alpha) * DT,
      position: this.presentedFeet(alpha, "figure"),
      avatar: this.avatar(
        alpha === 1
          ? this.motion
          : lerpMotion(this.previousMotion, this.motion, alpha),
      ),
    };
  }
  private clampPitch(pitch: number) {
    return Math.max(
      this.cameraSettings.minPitch,
      Math.min(this.cameraSettings.maxPitch, pitch),
    );
  }
  private cameraSafety() {
    return playCameraSafety(this.cameraSettings, this.aspectRatio);
  }
  configureCamera(input: Partial<PlayCameraSettings>) {
    this.alive();
    ensure(
      !this.occupied ||
        input.eyeHeight === undefined ||
        input.eyeHeight === this.cameraSettings.eyeHeight,
      "INVALID_INPUT",
      "Exit vehicle first to change standing eye height",
    );
    const settings = resolvePlayCameraSettings(input, this.cameraSettings);
    this.cameraSettings = settings;
    this.pitch = this.clampPitch(this.pitch);
    if (this.occupied) this.occupied.localLookPitch = this.pitch;
    this.updateArm(true);
    return this.snapshot();
  }
  setViewportAspect(aspectRatio: number) {
    this.alive();
    playCameraSafety(this.cameraSettings, aspectRatio);
    if (this.aspectRatio !== aspectRatio) {
      this.aspectRatio = aspectRatio;
      this.updateArm();
    }
  }
  beginCameraCapture(aspectRatio: number) {
    this.alive();
    const previousAspect = this.aspectRatio,
      previousArm = this.arm;
    this.setViewportAspect(aspectRatio);
    return () => {
      this.aspectRatio = previousAspect;
      this.arm = previousArm;
    };
  }
  private validateSpawn(input: PlaySpawnRequest): PlaySpawn {
    ensure(
      input && typeof input === "object",
      "INVALID_INPUT",
      "Spawn must be an object",
    );
    keys(input, ["position", "yaw", "pitch"]);
    point(input.position);
    const yaw = input.yaw ?? this.yaw,
      pitch = input.pitch ?? this.pitch;
    ensure(
      finite(yaw) &&
        finite(pitch) &&
        pitch >= this.cameraSettings.minPitch &&
        pitch <= this.cameraSettings.maxPitch,
      "INVALID_INPUT",
      "Spawn look must be finite and within the configured pitch limits",
    );
    ensure(this.ready, "INVALID_INPUT", this.walkUnavailableMessage());
    ensure(
      this.clear(input.position),
      "INVALID_INPUT",
      "Spawn intersects geometry. Move to a clear spot first.",
    );
    const hit = this.world.castShape(
      this.center(input.position),
      rot,
      { x: 0, y: -S, z: 0 },
      this.capsule,
      0,
      3,
      true,
      undefined,
      undefined,
      this.collider,
      undefined,
      (c) => !this.seatedColliders.some((body) => body.handle === c.handle),
    );
    ensure(
      hit && hit.normal1.y >= Math.cos((P.maxSlopeDegrees * Math.PI) / 180),
      "INVALID_INPUT",
      "Spawn needs a walkable supporting surface within 3 LDU below its feet",
    );
    return { position: [...input.position], yaw, pitch };
  }
  chooseSpawn(input: PlaySpawnRequest) {
    this.requireOnFoot();
    this.alive();
    const spawn = this.validateSpawn(input);
    this.selectedSpawn = spawn;
    return this.snapshot();
  }
  useSpawn() {
    this.requireOnFoot();
    this.alive();
    ensure(
      this.selectedSpawn,
      "INVALID_INPUT",
      "Choose a validated session spawn first",
    );
    const spawn = this.validateSpawn(this.selectedSpawn);
    this.clearInput();
    this.locomotion = "walk";
    return this.teleport(spawn);
  }
  private desiredArm(target: Vec3, look: Vec3) {
    const hit = this.world.castShape(
      physics(target),
      rot,
      physics(look.map((v) => -v * this.cameraSettings.followDistance) as Vec3),
      new RAPIER.Ball(this.cameraSafety().collisionRadius * S),
      0.1 * S,
      1,
      true,
      undefined,
      undefined,
      this.collider,
      undefined,
      (c) => !this.seatedColliders.some((body) => body.handle === c.handle),
    );
    return hit
      ? Math.max(0, this.cameraSettings.followDistance * hit.time_of_impact - 1)
      : this.cameraSettings.followDistance;
  }
  private followRig(feet: Vec3 = this.feet) {
    // Seated chase framing is a presentation offset only. It keeps its target
    // above the bench and looks down past a shoulder; own-rig camera collision
    // remains active. The first-person eye and stored look intent are unchanged.
    const target: Vec3 = this.occupied
      ? seatPoint(this.occupied.placement.pelvisFrame, [0, -30, -10])
      : [feet[0], feet[1] - P.height * 0.7, feet[2]];
    const yaw = this.yaw + (this.occupied ? 0.35 : 0);
    const pitch = this.occupied
      ? Math.max(-1.35, Math.min(1.1, this.pitch - 0.65))
      : this.pitch;
    const look: Vec3 = [
      Math.sin(yaw) * Math.cos(pitch),
      -Math.sin(pitch),
      -Math.cos(yaw) * Math.cos(pitch),
    ];
    return { target, look };
  }
  private currentArm() {
    const { target, look } = this.followRig();
    return Math.min(this.arm, this.desiredArm(target, look));
  }
  private updateArm(immediate = false) {
    const { target, look } = this.followRig();
    const desired = this.desiredArm(target, look);
    // Geometry between the figure and the camera pulls it in at once; a
    // zoom (a new follow distance) and clearing geometry ease it both ways.
    const blocked = desired < this.cameraSettings.followDistance;
    this.arm =
      immediate || (blocked && desired < this.arm)
        ? desired
        : this.arm + (desired - this.arm) * (1 - Math.exp(-8 * DT));
  }
  /** Consecutive zoom-in beyond the closest distance (log units). */
  private zoomPastNear = 0;
  /**
   * Scroll-wheel / pinch zoom: scales the third-person follow distance by
   * `factor` (below 1 zooms in) between PLAY_ZOOM_LIMITS; the camera eases to
   * it. Zooming in past the closest distance switches to first person, and
   * zooming out from first person returns to third person at that distance.
   */
  zoomCamera(factor: number) {
    this.alive();
    ensure(
      finite(factor) && factor > 0 && factor <= 100,
      "INVALID_INPUT",
      "Zoom factor must be a positive number.",
    );
    if (this.controlledVehicle) {
      this.controlledVehicle.zoom = Math.max(
        0.25,
        Math.min(16, this.controlledVehicle.zoom * factor),
      );
      return this.snapshot();
    }
    const { min, max } = PLAY_ZOOM_LIMITS;
    if (this.cameraMode === "first-person") {
      this.zoomPastNear = 0;
      if (factor <= 1) return this.snapshot();
      this.cameraMode = "third-person";
      this.cameraSettings = { ...this.cameraSettings, followDistance: min };
      this.arm = 0;
      return this.snapshot();
    }
    const current = this.cameraSettings.followDistance;
    if (factor < 1 && current <= min) {
      this.zoomPastNear -= Math.log(factor);
      // About one more wheel notch at the closest distance.
      if (this.zoomPastNear >= Math.log(1.2)) {
        this.zoomPastNear = 0;
        this.cameraMode = "first-person";
        this.updateArm(true);
      }
      return this.snapshot();
    }
    this.zoomPastNear = 0;
    this.cameraSettings = {
      ...this.cameraSettings,
      followDistance: Math.max(min, Math.min(max, current * factor)),
    };
    return this.snapshot();
  }
  camera(interpolate = false): CameraSpec {
    this.alive();
    if (this.controlledVehicle) {
      const control = this.controlledVehicle;
      const state = this.rigTarget(control.rigId).rig.snapshot();
      return mechanismOverviewCamera(
        control.geometry,
        state,
        { width: this.aspectRatio, height: 1 },
        { x: 0, y: 0, width: this.aspectRatio, height: 1 },
        { yaw: this.yaw, pitch: this.pitch, zoom: control.zoom },
        this.cameraSettings.fovDeg,
      );
    }
    if (this.riding && this.trains) {
      const { target, look, arm } = this.rideCamera();
      const pos = target.map((v, k) => v - look[k] * arm) as Vec3;
      return {
        space: "ldraw",
        projection: "perspective",
        position: pos,
        target: arm
          ? target
          : (target.map((v, k) => v + look[k] * 100) as Vec3),
        up: [0, -1, 0],
        fovDeg: this.cameraSettings.fovDeg,
        near: this.cameraSafety().effectiveNear,
        far: 100000,
      };
    }
    const alpha = interpolate ? this.accumulator / DT : 1;
    const feet = this.presentedFeet(alpha, "camera");
    const follow = this.followRig(feet);
    const look: Vec3 =
      this.cameraMode === "third-person"
        ? follow.look
        : this.occupied
          ? mv(this.occupied.placement.pelvisFrame.basis, [
              Math.sin(this.occupied.localLookYaw) * Math.cos(this.pitch),
              -Math.sin(this.pitch),
              -Math.cos(this.occupied.localLookYaw) * Math.cos(this.pitch),
            ])
          : [
              Math.sin(this.yaw) * Math.cos(this.pitch),
              -Math.sin(this.pitch),
              -Math.cos(this.yaw) * Math.cos(this.pitch),
            ];
    const target: Vec3 =
      this.cameraMode === "third-person"
        ? follow.target
        : this.occupied
          ? [...this.occupied.placement.eye]
          : [feet[0], feet[1] - this.cameraSettings.eyeHeight, feet[2]];
    let pos: Vec3 = [...target];
    if (this.cameraMode === "third-person") {
      // Unobstructed, the arm eases to the follow distance (smooth zoom);
      // geometry in the way always wins.
      const desired = this.desiredArm(target, look);
      const arm =
        desired < this.cameraSettings.followDistance
          ? Math.min(this.arm, desired)
          : this.arm;
      pos = target.map((v, k) => v - look[k] * arm) as Vec3;
    }
    return {
      space: "ldraw",
      projection: "perspective",
      position: pos,
      target:
        this.cameraMode === "first-person" ||
        Math.hypot(...pos.map((v, k) => v - target[k])) < 0.01
          ? (pos.map((v, k) => v + look[k] * 100) as Vec3)
          : target,
      up:
        this.occupied && this.cameraMode === "first-person"
          ? mv(this.occupied.placement.pelvisFrame.basis, [0, -1, 0])
          : [0, -1, 0],
      fovDeg: this.cameraSettings.fovDeg,
      near: this.cameraSafety().effectiveNear,
      far: 100000,
    };
  }
  private rigTarget(rigId?: string) {
    const dynamicIds = this.dynamics?.rigIds() ?? [];
    const count = this.mechanisms.size + dynamicIds.length;
    ensure(count > 0, "INVALID_INPUT", "Enter Play with an authored rig first");
    ensure(
      rigId !== undefined || count === 1,
      "INVALID_INPUT",
      "Specify rigId when multiple Play rigs are active",
    );
    const id = rigId ?? [...this.mechanisms.keys(), ...dynamicIds][0];
    const dynamic = this.dynamics?.rig(id),
      kinematic = this.mechanisms.get(id);
    ensure(dynamic || kinematic, "INVALID_INPUT", "Unknown active Play rig");
    return dynamic
      ? ({ kind: "dynamic", rig: dynamic } as const)
      : ({ kind: "kinematic", rig: kinematic! } as const);
  }
  private mechanismTarget(rigId?: string) {
    const target = this.rigTarget(rigId);
    ensure(
      target.kind === "kinematic",
      "INVALID_INPUT",
      "This rig is simulated dynamically; its joints move through motors. Use an animated joint target instead.",
    );
    return target.rig;
  }
  setJointTarget(input: PlayJointTargetRequest) {
    this.alive();
    keys(input, ["rigId", "jointId", "target", "speed"]);
    this.rigTarget(input.rigId).rig.setJointTarget(
      input.jointId,
      input.target,
      input.speed,
    );
    return this.snapshot();
  }
  /** Enable or stop an authored joint motor on a kinematic or dynamic rig. */
  setMotor(input: PlayMotorRequest) {
    this.alive();
    ensure(
      input && typeof input === "object" && !Array.isArray(input),
      "INVALID_INPUT",
      "Motor request must be an object",
    );
    keys(input, ["rigId", "jointId", "enabled", "input", "power"]);
    ensure(
      typeof input.jointId === "string",
      "INVALID_INPUT",
      "Motor request needs a joint ID",
    );
    this.rigTarget(input.rigId).rig.setMotor(
      input.jointId,
      input.enabled,
      input.input,
      input.power,
    );
    return this.snapshot();
  }
  grab(input: PlayGrabRequest) {
    this.alive();
    ensure(
      input && typeof input === "object" && !Array.isArray(input),
      "INVALID_INPUT",
      "Grab request must be an object",
    );
    keys(input, ["rigId", "gripperId", "target"]);
    ensure(
      input.target &&
        typeof input.target === "object" &&
        !Array.isArray(input.target),
      "INVALID_INPUT",
      "Grab requires a target group",
    );
    keys(input.target, ["rigId", "groupId"]);
    ensure(this.dynamics, "INVALID_INPUT", "Grabbing requires Dynamic Play");
    this.dynamics.grippers.grab(input);
    return this.snapshot();
  }
  release(input: PlayGripRequest) {
    this.alive();
    ensure(
      input && typeof input === "object" && !Array.isArray(input),
      "INVALID_INPUT",
      "Release request must be an object",
    );
    keys(input, ["rigId", "gripperId"]);
    ensure(this.dynamics, "INVALID_INPUT", "Releasing requires Dynamic Play");
    this.dynamics.grippers.release(input);
    return this.snapshot();
  }
  setMechanismJoint(id: string, value: number, rigId?: string) {
    this.alive();
    this.mechanismTarget(rigId).setJointPosition(id, value);
    this.world.step();
    return this.snapshot();
  }
  setMechanismVehicleInput(
    input: { throttle: number; steering: number },
    rigId?: string,
  ) {
    this.alive();
    const target = this.rigTarget(rigId);
    target.rig.setVehicleInput(input);
    if (target.kind === "kinematic") this.world.step();
    return this.snapshot();
  }
  // ---- Trains ----------------------------------------------------------------
  /**
   * A car may not sweep into the walking explorer: its collider, inflated by
   * how far any of its points can move this tick, must stay clear of the
   * capsule (the same conservative test moving mechanisms use).
   */
  private trainGuard = (
    trainId: string,
    before: CarPose[],
    after: CarPose[],
  ): string | undefined => {
    // A rider stands in a cab, not in the way.
    if (this.locomotion !== "walk" || this.occupied || this.riding)
      return undefined;
    for (let i = 0; i < after.length; i++) {
      const proxy = this.trainProxies.get(`${trainId}/${i}`);
      if (!proxy) continue;
      const a = before[i].frame,
        b = after[i].frame;
      const angle = frameRotation(a).angleTo(frameRotation(b));
      const distance =
        Math.hypot(...a.position.map((v, k) => v - b.position[k])) +
        proxy.radius * angle;
      if (distance < 1e-8) continue;
      const inflated = new RAPIER.Capsule(
        (P.height / 2 - P.radius) * S,
        (P.radius + distance + 0.05) * S,
      );
      if (
        proxy.collider.intersectsShape(
          inflated,
          physics([this.feet[0], this.feet[1] - P.height / 2, this.feet[2]]),
          rot,
        )
      )
        return "Waiting for you to step off the track";
    }
    return undefined;
  };
  private stepTrains() {
    const trains = this.trains!;
    trains.step(this.trainGuard, DT);
    // Move the colliders only when a car moved.
    const posed = JSON.stringify(
      trains.ids.map((id) => trains.carFrames(id).map((f) => f.now.position)),
    );
    if (posed === this.trainPosed) return;
    this.trainPosed = posed;
    for (const id of trains.ids)
      trains.carFrames(id).forEach(({ now }, i) => {
        const proxy = this.trainProxies.get(`${id}/${i}`);
        if (!proxy) return;
        proxy.collider.setTranslation(physics(now.position));
        proxy.collider.setRotation(frameRotation(now));
      });
  }
  private syncTrainDynamics(trainId: string, immediate = false) {
    const frames: Record<string, Transform> = {};
    this.trains!.carFrames(trainId).forEach(({ now }, i) => {
      frames[String(i)] = now;
    });
    this.dynamics!.syncKinematicRig(trainId, frames, immediate);
  }
  private requireTrains() {
    this.alive();
    ensure(this.trains, "INVALID_INPUT", "No running train in this world");
    return this.trains;
  }
  /** World transforms of every moving train occurrence (for rendering). */
  trainTransforms(): Record<string, Transform> {
    return this.trains?.transforms() ?? {};
  }
  /** Throttle −1..1 of full speed (negative backwards); 0 coasts to a stop. */
  setTrainThrottle(input: { trainId?: string; throttle: number }) {
    const trains = this.requireTrains();
    ensure(
      input && typeof input === "object",
      "INVALID_INPUT",
      "Train input must be an object",
    );
    keys(input, ["trainId", "throttle"]);
    ensure(
      finite(input.throttle) && Math.abs(input.throttle) <= 1,
      "INVALID_INPUT",
      "Throttle must be between -1 and 1",
    );
    trains.setThrottle(input.throttle, input.trainId);
    return this.snapshot();
  }
  stopTrain(input: { trainId?: string } = {}) {
    const trains = this.requireTrains();
    keys(input, ["trainId"]);
    trains.stop(input.trainId);
    return this.snapshot();
  }
  /** Set (or toggle) a switch's route. Refused while a train stands on it. */
  setPoints(input: { occurrenceId: string; route?: "straight" | "branch" }) {
    const trains = this.requireTrains();
    ensure(
      input &&
        typeof input === "object" &&
        typeof input.occurrenceId === "string",
      "INVALID_INPUT",
      "Points need a track occurrenceId",
    );
    keys(input, ["occurrenceId", "route"]);
    ensure(
      input.route === undefined ||
        input.route === "straight" ||
        input.route === "branch",
      "INVALID_INPUT",
      'Points route is "straight" or "branch"',
    );
    trains.setPoints(
      input.occurrenceId,
      input.route === undefined ? undefined : input.route === "branch" ? 1 : 0,
    );
    return this.snapshot();
  }
  /**
   * Ride along: the camera follows a train (chase view in third person,
   * the cab in first person). The explorer stays where it stood; its
   * movement input is ignored until the ride ends.
   */
  rideTrain(input: { trainId?: string | null } = {}) {
    const trains = this.requireTrains();
    keys(input, ["trainId"]);
    if (input.trainId === null) {
      this.alight();
      return this.snapshot();
    }
    const id =
      input.trainId ?? (trains.ids.length === 1 ? trains.ids[0] : undefined);
    ensure(
      id && trains.ids.includes(id),
      "INVALID_INPUT",
      id ? "Unknown train " + id : "Specify trainId when several trains run",
    );
    this.requireOnFoot();
    const yaw = this.trainYaw(id);
    const boarded = this.riding?.boarded ?? ([...this.feet] as Vec3);
    if (this.riding && this.riding.trainId !== id) this.releaseLever();
    const lead = this.leadMeshes.get(id);
    this.riding = {
      trainId: id,
      reference: yaw,
      cab: lead
        ? trainCab(lead.vertices, lead.indices)
        : trainCab(new Float32Array(), new Uint32Array()),
      boarded,
    };
    // Step aboard: the figure stands at the controls facing forward.
    this.placeRider();
    this.previous = [...this.feet];
    this.velocity = [0, 0, 0];
    this.grounded = true;
    this.motion = initialMotion(yaw);
    this.settle();
    this.yaw = ((yaw % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    // Looking a little down on the train (LDraw −Y is up: negative pitch).
    this.pitch = this.clampPitch(
      this.cameraMode === "first-person" ? 0 : -0.35,
    );
    this.input = { ...this.input, moveX: 0, moveZ: 0, vertical: 0 };
    return this.snapshot();
  }
  /** Puts the feet at the ridden locomotive's controls, facing forward. */
  private placeRider() {
    const { trainId, cab } = this.riding!;
    const lead = this.trains!.carFrames(trainId)[0].now;
    this.feet = add(lead.position, mv(lead.basis, cab.feet));
    this.grounded = true;
    this.motion = {
      ...initialMotion(this.trainYaw(trainId)),
      time: this.motion.time + DT,
    };
    this.syncCollider();
  }
  /** Lets go of the driver's lever (the train holds its speed) and brake. */
  private releaseLever() {
    if (this.riding && this.driveLever)
      this.trains?.setDrive(0, this.riding.trainId);
    this.driveLever = 0;
    this.brakeHeld = false;
  }
  /**
   * Gets off the ridden train: onto walkable ground beside the locomotive
   * (either side of the cab first, then along the car), else back where
   * the explorer got on, else the last safe place.
   */
  private alight() {
    if (!this.riding) return;
    const { trainId, cab, boarded } = this.riding;
    this.releaseLever();
    this.riding = undefined;
    const lead = this.trains!.carFrames(trainId)[0].now,
      b = lead.basis;
    const lateral = (p: Vec3) =>
      Math.abs(
        (p[0] - lead.position[0]) * b[2] +
          (p[1] - lead.position[1]) * b[5] +
          (p[2] - lead.position[2]) * b[8],
      );
    const beside = alightPoints(cab).map((local) =>
      add(lead.position, mv(b, local)),
    );
    let spot: Vec3 | undefined;
    if (this.locomotion === "walk" && this.ready) {
      for (const p of beside) {
        // From a figure's height above the rails down to the ground.
        const found = this.findSafe([p[0], p[1] - P.height, p[2]]);
        if (found && lateral(found) >= cab.extent.halfWidth + P.radius) {
          spot = found;
          break;
        }
      }
      spot ??= this.clear(boarded)
        ? boarded
        : this.safe && this.clear(this.safe)
          ? this.safe
          : undefined;
      spot ??= this.findSafe(this.spawn) ?? this.spawn;
    } else spot = beside[0];
    this.feet = [...spot];
    this.previous = [...this.feet];
    this.velocity = [0, 0, 0];
    this.support = undefined;
    this.inheritedVelocity = [0, 0, 0];
    this.grounded = false;
    this.motion = initialMotion(this.trainYaw(trainId));
    this.settle();
    this.syncCollider();
    this.world.step();
    this.updateArm(true);
  }
  private trainYaw(id: string) {
    const lead = this.trains!.carFrames(id)[0].now.basis;
    // Look yaw convention: forward = (sin yaw, ·, −cos yaw).
    return Math.atan2(lead[0], -lead[6]);
  }
  private rideCamera(): { target: Vec3; look: Vec3; arm: number } {
    const id = this.riding!.trainId,
      frames = this.trains!.carFrames(id),
      lead = frames[0].now;
    const turn = this.trainYaw(id) - this.riding!.reference;
    const yaw = this.yaw + turn,
      pitch = this.pitch;
    const look: Vec3 = [
      Math.sin(yaw) * Math.cos(pitch),
      -Math.sin(pitch),
      -Math.cos(yaw) * Math.cos(pitch),
    ];
    if (this.cameraMode === "first-person") {
      // The cab: the eyes of the figure standing at the controls.
      return {
        target: [
          this.feet[0],
          this.feet[1] - this.cameraSettings.eyeHeight,
          this.feet[2],
        ],
        look,
        arm: 0,
      };
    }
    const mid = frames[Math.floor((frames.length - 1) / 2)].now.position;
    return {
      target: [
        (lead.position[0] + mid[0]) / 2,
        lead.position[1] - 90,
        (lead.position[2] + mid[2]) / 2,
      ],
      look,
      arm: 520 + 80 * Math.min(frames.length, 6),
    };
  }
  snapshot(): PlaySnapshotReport {
    this.alive();
    const mechanisms = Object.fromEntries(
      [
        ...[...this.mechanisms].map(
          ([id, mechanism]) => [id, mechanism.snapshot()] as const,
        ),
        ...(this.dynamics?.rigIds() ?? []).map((id) => {
          const grippers = this.dynamics!.grippers.report(id);
          return [
            id,
            {
              ...this.dynamics!.rig(id)!.snapshot(),
              ...(Object.keys(grippers).length ? { grippers } : {}),
            },
          ] as const;
        }),
      ].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
    );
    const rigCount = Object.keys(mechanisms).length;
    return {
      ...(this.autoDoors ? { autoDoors: structuredClone(this.autoDoors) } : {}),
      ...(this.trains
        ? {
            trains: {
              ...this.trains.report(),
              ...(this.riding ? { riding: this.riding.trainId } : {}),
            },
          }
        : {}),
      ...(rigCount ? { mechanisms } : {}),
      ...(rigCount === 1 ? { mechanism: Object.values(mechanisms)[0] } : {}),
      positionAnchor: this.controlledVehicle
        ? "vehicle-reference"
        : this.occupied
          ? "seated-avatar-root"
          : "standing-feet",
      ...(this.controlledVehicle
        ? { vehicleControl: { rigId: this.controlledVehicle.rigId } }
        : {}),
      ...(this.occupied
        ? {
            occupancy: {
              ...this.occupied.request,
              profile: "brick-figure-open-seat-v1" as const,
              pelvisWorldLdu: [
                ...this.occupied.placement.pelvisFrame.position,
              ] as Vec3,
              avatarRootWorldLdu: [...this.feet] as Vec3,
              effectiveEyeWorldLdu: [...this.occupied.placement.eye] as Vec3,
              localLookYaw: this.occupied.localLookYaw,
              localLookPitch: this.occupied.localLookPitch,
            },
          }
        : {}),
      worldProfile: this.worldProfile,
      cameraSettings: { ...this.cameraSettings },
      cameraSafety: this.cameraSafety(),
      ...(this.selectedSpawn
        ? { spawn: structuredClone(this.selectedSpawn) }
        : {}),
      sourceRevision: this.revision,
      tick: this.tick,
      position: [...this.feet],
      velocity: [...this.velocity],
      yaw: this.yaw,
      pitch: this.pitch,
      grounded: this.grounded,
      locomotion: this.locomotion,
      cameraMode: this.cameraMode,
      collisionReady: this.ready,
      avatarReady: true,
      avatarVisible:
        !this.controlledVehicle &&
        !this.occupied &&
        this.cameraMode === "third-person" &&
        (!!this.riding || this.currentArm() > 24),
      profile: P,
      units: "LDU",
      simulationHz: 60,
      warnings: [...this.warnings],
      avatar: this.avatar(),
    };
  }
  /** Diagnostics for budgets and regression tests; not part of the snapshot contract. */
  collisionStats() {
    this.alive();
    return {
      colliders: this.world.colliders.len(),
      static: this.staticStats ? { ...this.staticStats } : undefined,
    };
  }
  dispose() {
    if (this.disposed) return;
    for (const mechanism of this.mechanisms.values()) mechanism.dispose();
    this.contactQueries.dispose();
    this.mechanisms.clear();
    this.dynamics?.dispose();
    this.dynamics = undefined;
    this.seatSources.clear();
    this.occupied = undefined;
    this.controlledVehicle = undefined;
    this.vehicleViews.clear();
    this.seatedColliders = [];
    this.vehicleWorld?.dispose();
    this.vehicleWorld = undefined;
    this.trainProxies.clear();
    this.trains = undefined;
    this.riding = undefined;
    this.world.free();
    this.disposed = true;
  }
}
