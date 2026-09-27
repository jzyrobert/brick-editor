import RAPIER from "@dimforge/rapier3d-compat";
import { ensure, type CameraSpec, type Vec3 } from "../core/types";
import {
  CHARACTER_PROFILE as P,
  type CollisionSnapshot,
  type PlayCameraMode,
  type PlayInput,
  type PlayLocomotion,
  type PlayRequest,
  type PlaySnapshotReport,
  type PlayTeleportRequest,
  type AvatarPose,
} from "./types";
const S = P.scaleMetresPerLdu,
  DT = 1 / 60;
const rot = { x: 0, y: 0, z: 0, w: 1 };
const physics = ([x, y, z]: Vec3) => ({ x: x * S, y: -y * S, z: -z * S });
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
function keys(o: object, allowed: string[]) {
  ensure(
    Object.keys(o).every((k) => allowed.includes(k)),
    "INVALID_INPUT",
    "Unknown Play request field.",
  );
}
/** Fixed-step isolated session. No authored project references or mutations. */
export class PlaySession {
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
  private jumpHeld = false;
  private disposed = false;
  private locomotion: PlayLocomotion = "walk";
  private cameraMode: PlayCameraMode = "first-person";
  private safe: Vec3 | undefined;
  private spawn: Vec3;
  private arm = 120;
  private phase = 0;
  private heading = 0;
  private amplitude = 0;
  private ready: boolean;
  private warnings: string[];
  private bounds: CollisionSnapshot["bounds"];
  private constructor(
    private revision: number,
    snapshot: CollisionSnapshot,
    request: PlayRequest,
  ) {
    this.world = new RAPIER.World({ x: 0, y: 0, z: 0 });
    this.world.timestep = DT;
    this.bounds = structuredClone(snapshot.bounds);
    this.warnings = [...(snapshot.warnings ?? [])];
    this.ready = !snapshot.unsupported;
    if (snapshot.indices.length > 3_000_000) {
      this.ready = false;
      this.warnings.push(
        "Collision exceeds the 1,000,000 triangle budget. Fly remains available.",
      );
    }
    if (this.ready && snapshot.indices.length) {
      const v = new Float32Array(snapshot.vertices.length);
      for (let i = 0; i < v.length; i += 3) {
        v[i] = snapshot.vertices[i] * S;
        v[i + 1] = -snapshot.vertices[i + 1] * S;
        v[i + 2] = -snapshot.vertices[i + 2] * S;
      }
      this.world.createCollider(
        RAPIER.ColliderDesc.trimesh(v, snapshot.indices),
      );
    }
    if (request.ground !== false)
      this.warnings.push(
        "Session-only ground is an infinite plane at Y=0; it is not an authored part.",
      );
    if (request.ground !== false)
      this.world.createCollider(
        new RAPIER.ColliderDesc(new RAPIER.HalfSpace({ x: 0, y: 1, z: 0 })),
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
    this.controller = this.world.createCharacterController(0.15 * S);
    this.controller.enableAutostep(P.stepHeight * S, 4 * S, false);
    this.controller.enableSnapToGround(3 * S);
    this.controller.setMaxSlopeClimbAngle((P.maxSlopeDegrees * Math.PI) / 180);
    this.controller.setMinSlopeSlideAngle((P.maxSlopeDegrees * Math.PI) / 180);
    this.world.step();
    this.yaw = request.yaw ?? 0;
    this.pitch = Math.max(-1.48, Math.min(1.48, request.pitch ?? 0));
    this.cameraMode = request.cameraMode ?? "first-person";
    const candidate = request.position ?? [
      (snapshot.bounds.min[0] + snapshot.bounds.max[0]) / 2,
      Math.min(0, snapshot.bounds.min[1]) - 2,
      snapshot.bounds.max[2] + P.radius * 3,
    ];
    const found = this.ready ? this.findSafe(candidate) : undefined;
    this.feet = found ?? candidate;
    this.previous = [...this.feet];
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
  }
  static async create(
    snapshot: CollisionSnapshot,
    request: PlayRequest = {},
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
    ]);
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
        snapshot.vertices.every(Number.isFinite) &&
        snapshot.indices.every((i) => i < snapshot.vertices.length / 3),
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
    await (initialization ??= RAPIER.init());
    return new PlaySession(snapshot.revision, snapshot, request);
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
        2000,
        true,
        undefined,
        undefined,
        this.collider,
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
    if (input.yaw !== undefined)
      this.yaw = ((input.yaw % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    if (input.pitch !== undefined)
      this.pitch = Math.max(-1.48, Math.min(1.48, input.pitch));
  }
  clearInput() {
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
    this.cameraMode = mode;
    this.updateArm(true);
    return this.snapshot();
  }
  setLocomotion(mode: PlayLocomotion) {
    this.alive();
    ensure(
      mode === "walk" || mode === "fly-noclip",
      "INVALID_INPUT",
      "Unknown movement mode.",
    );
    if (mode === "walk" && this.locomotion !== "walk") {
      ensure(
        this.ready,
        "UNSUPPORTED_RENDER_FEATURE",
        "Collision is unavailable; remain in Fly.",
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
    }
    this.locomotion = mode;
    this.velocity = [0, 0, 0];
    this.clearInput();
    this.syncCollider();
    this.world.step();
    return this.snapshot();
  }
  teleport(input: PlayTeleportRequest) {
    this.alive();
    keys(input, ["position", "policy", "yaw", "pitch"]);
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
      ensure(
        this.ready && this.clear(input.position),
        "INVALID_INPUT",
        "Teleport target intersects geometry or collision is unavailable.",
      );
    }
    this.feet = [...input.position];
    this.previous = [...this.feet];
    this.velocity = [0, 0, 0];
    this.grounded = false;
    this.setInput({ yaw: input.yaw, pitch: input.pitch });
    this.syncCollider();
    this.world.step();
    return this.snapshot();
  }
  respawn() {
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
  advance(seconds: number) {
    this.alive();
    ensure(
      finite(seconds) && seconds >= 0,
      "INVALID_INPUT",
      "Frame duration must be nonnegative.",
    );
    this.accumulator += Math.min(seconds, 0.1);
    let count = 0;
    while (this.accumulator >= DT && count++ < 6) {
      this.step();
      this.accumulator -= DT;
    }
    return this.snapshot();
  }
  private step() {
    this.previous = [...this.feet];
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
    let delta: Vec3 = [
      (x * Math.cos(this.yaw) + z * Math.sin(this.yaw) * cp) * speed * DT,
      -(y + z * sp) * speed * DT,
      (x * Math.sin(this.yaw) - z * Math.cos(this.yaw) * cp) * speed * DT,
    ];
    if (this.locomotion === "fly-noclip") {
      const length = Math.hypot(...delta),
        limit = speed * DT;
      if (length > limit)
        delta = delta.map((v) => (v * limit) / length) as Vec3;
    }
    if (this.locomotion === "walk") {
      if (i.jump && !this.jumpHeld && this.grounded)
        this.velocity[1] = -P.jumpSpeed;
      this.velocity[1] = Math.min(500, this.velocity[1] + P.gravity * DT);
      delta[1] = this.velocity[1] * DT;
      this.controller.computeColliderMovement(this.collider, physics(delta));
      delta = ldraw(this.controller.computedMovement());
      this.grounded = this.controller.computedGrounded();
      if (
        this.grounded ||
        Math.abs(delta[1]) < Math.abs(this.velocity[1] * DT) * 0.5
      )
        this.velocity[1] = 0;
    } else this.grounded = false;
    this.jumpHeld = i.jump;
    this.feet = this.feet.map((v, k) => v + delta[k]) as Vec3;
    this.velocity = [delta[0] / DT, delta[1] / DT, delta[2] / DT];
    this.syncCollider();
    this.world.step();
    const distance = Math.hypot(delta[0], delta[2]);
    this.phase =
      (this.phase + (2 * Math.PI * distance) / P.strideLength) % (Math.PI * 2);
    if (distance > 0.01) this.heading = Math.atan2(delta[0], -delta[2]);
    this.amplitude +=
      ((distance > 0.01 && this.grounded ? (i.run ? 0.65 : 0.45) : 0) -
        this.amplitude) *
      0.2;
    if (this.grounded && this.clear(this.feet)) this.safe = [...this.feet];
    if (
      this.feet[1] > Math.max(this.bounds.max[1], 0) + 3000 &&
      this.locomotion === "walk"
    ) {
      this.feet = [...(this.safe ?? this.spawn)];
      this.previous = [...this.feet];
      this.velocity = [0, 0, 0];
      this.syncCollider();
    }
    this.updateArm();
    this.tick++;
  }
  private avatar(): AvatarPose {
    let swing = Math.sin(this.phase) * this.amplitude;
    const airborne = !this.grounded && this.locomotion === "walk";
    if (airborne) swing = this.velocity[1] < 0 ? 0.2 : -0.15;
    return {
      state: airborne
        ? this.velocity[1] < 0
          ? "jump"
          : "fall"
        : this.amplitude < 0.03
          ? "idle"
          : this.input.run
            ? "run"
            : "walk",
      heading: this.heading,
      phase: this.phase,
      headYaw: Math.max(
        -0.7,
        Math.min(
          0.7,
          Math.atan2(
            Math.sin(this.yaw - this.heading),
            Math.cos(this.yaw - this.heading),
          ),
        ),
      ),
      leftHip: swing,
      rightHip: -swing,
      leftShoulder: -swing,
      rightShoulder: swing,
    };
  }
  private desiredArm(target: Vec3, look: Vec3) {
    const hit = this.world.castShape(
      physics(target),
      rot,
      physics(look.map((v) => -v * 120) as Vec3),
      new RAPIER.Ball(4 * S),
      0.1 * S,
      1,
      true,
      undefined,
      undefined,
      this.collider,
    );
    return hit ? Math.max(0, 120 * hit.time_of_impact - 1) : 120;
  }
  private currentArm() {
    const target: Vec3 = [
      this.feet[0],
      this.feet[1] - P.height * 0.7,
      this.feet[2],
    ];
    const look: Vec3 = [
      Math.sin(this.yaw) * Math.cos(this.pitch),
      -Math.sin(this.pitch),
      -Math.cos(this.yaw) * Math.cos(this.pitch),
    ];
    return Math.min(this.arm, this.desiredArm(target, look));
  }
  private updateArm(immediate = false) {
    const target: Vec3 = [
      this.feet[0],
      this.feet[1] - P.height * 0.7,
      this.feet[2],
    ];
    const look: Vec3 = [
      Math.sin(this.yaw) * Math.cos(this.pitch),
      -Math.sin(this.pitch),
      -Math.cos(this.yaw) * Math.cos(this.pitch),
    ];
    const desired = this.desiredArm(target, look);
    this.arm =
      desired < this.arm || immediate
        ? desired
        : this.arm + (desired - this.arm) * (1 - Math.exp(-8 * DT));
  }
  camera(interpolate = false): CameraSpec {
    this.alive();
    const alpha = interpolate ? this.accumulator / DT : 1;
    const feet = this.feet.map(
      (v, k) => this.previous[k] + (v - this.previous[k]) * alpha,
    ) as Vec3;
    const look: Vec3 = [
      Math.sin(this.yaw) * Math.cos(this.pitch),
      -Math.sin(this.pitch),
      -Math.cos(this.yaw) * Math.cos(this.pitch),
    ];
    const target: Vec3 = [
      feet[0],
      feet[1] -
        (this.cameraMode === "first-person" ? P.eyeHeight : P.height * 0.7),
      feet[2],
    ];
    let pos: Vec3 = [...target];
    if (this.cameraMode === "third-person") {
      const arm = Math.min(this.arm, this.desiredArm(target, look));
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
      up: [0, -1, 0],
      fovDeg: 65,
      near: 0.5,
      far: 100000,
    };
  }
  snapshot(): PlaySnapshotReport {
    this.alive();
    return {
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
        this.cameraMode === "third-person" && this.currentArm() > 24,
      profile: P,
      units: "LDU",
      simulationHz: 60,
      warnings: [...this.warnings],
      avatar: this.avatar(),
    };
  }
  dispose() {
    if (this.disposed) return;
    this.world.free();
    this.disposed = true;
  }
}
