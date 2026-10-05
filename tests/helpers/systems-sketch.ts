import RAPIER from "@dimforge/rapier3d-compat";
import { Vector3 } from "three";
import { METRES_PER_LDU as S } from "../../src/play/physics-frame";

/**
 * Cost and behaviour sketches for docs/reviews/EFFICIENT-VEHICLE-AND-SYSTEMS-PHYSICS.md.
 * SYNTHETIC: box/point masses, no source geometry, no source evidence. They
 * only show what the cheap native models cost per tick on this Rapier build
 * and that they behave sensibly; they admit nothing to Play.
 */
const DT = 1 / 60;
const percentile = (v: number[], p: number) =>
  [...v].sort((a, b) => a - b)[
    Math.min(v.length - 1, Math.floor(v.length * p))
  ];
const boxMass = (
  body: RAPIER.RigidBody,
  mass: number,
  size: [number, number, number],
) => {
  const [x, y, z] = size.map((n) => n * S);
  body.setAdditionalMassProperties(
    mass,
    { x: 0, y: 0, z: 0 },
    {
      x: (mass * (y * y + z * z)) / 12,
      y: (mass * (x * x + z * z)) / 12,
      z: (mass * (x * x + y * y)) / 12,
    },
    { x: 0, y: 0, z: 0, w: 1 },
    true,
  );
};

/**
 * Winch: a drum on a revolute joint (motor = driving input, a one-way ratchet
 * = zero-velocity motor only while paying out), and a rope as a unilateral
 * soft distance constraint whose length follows the drum angle. Tension pulls
 * the load and back-drives the drum through r × T, so an unlocked drum pays
 * out under load. Two bodies, one joint, no rope bodies.
 */
export class WinchSketch {
  readonly world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  readonly drum: RAPIER.RigidBody;
  readonly load: RAPIER.RigidBody;
  private joint: RAPIER.RevoluteImpulseJoint;
  /** Wound angle, radians (positive winds in). */
  angle = 0;
  input = 0;
  ratchet = true;
  readonly radiusLdu = 8;
  private length0: number;
  maxTension = 0;
  constructor(
    readonly options: {
      loadKg?: number;
      ropeLdu?: number;
      torqueNm?: number;
      speedRadPerS?: number;
    } = {},
  ) {
    this.world.timestep = DT;
    const carrier = this.world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
    this.drum = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic().setTranslation(0, 0, 0),
    );
    boxMass(this.drum, 0.5, [16, 16, 16]);
    this.joint = this.world.createImpulseJoint(
      RAPIER.JointData.revolute(
        { x: 0, y: 0, z: 0 },
        { x: 0, y: 0, z: 0 },
        { x: 1, y: 0, z: 0 },
      ),
      carrier,
      this.drum,
      true,
    ) as RAPIER.RevoluteImpulseJoint;
    this.length0 = (options.ropeLdu ?? 200) * S;
    this.load = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(0, -this.length0, this.radiusLdu * S)
        .setLinearDamping(0.1),
    );
    boxMass(this.load, options.loadKg ?? 5, [20, 20, 20]);
  }
  ropeLength() {
    return this.length0 - this.angle * this.radiusLdu * S;
  }
  step() {
    // Positive X spin moves the tangent point (z = +r) down: paying out.
    const omega = this.drum.angvel().x;
    const torque = this.options.torqueNm ?? 50,
      speed = this.options.speedRadPerS ?? 2;
    if (this.input) {
      this.joint.configureMotorVelocity(-this.input * speed, 1e3);
      this.joint.setMotorMaxForce(torque);
    } else if (this.ratchet && omega >= 0) {
      // Pawl engaged: hold against paying out, never against winding in.
      this.joint.configureMotorVelocity(0, 1e4);
      this.joint.setMotorMaxForce(1e6);
    } else {
      this.joint.configureMotorVelocity(0, 0);
      this.joint.setMotorMaxForce(0);
    }
    // Unilateral soft rope from the drum's tangent exit point to the load.
    const exit = { x: 0, y: 0, z: this.radiusLdu * S },
      p = this.load.translation(),
      v = this.load.linvel(),
      d = { x: p.x - exit.x, y: p.y - exit.y, z: p.z - exit.z },
      dist = Math.hypot(d.x, d.y, d.z),
      u = { x: d.x / dist, y: d.y / dist, z: d.z / dist },
      stretch = dist - this.ropeLength(),
      rate = v.x * u.x + v.y * u.y + v.z * u.z,
      mass = this.load.mass(),
      k = mass * 400,
      c = mass * 2 * Math.sqrt(400) * 0.7;
    const tension = Math.max(0, k * stretch + c * rate);
    this.maxTension = Math.max(this.maxTension, tension);
    this.load.addForce(
      { x: -u.x * tension, y: -u.y * tension, z: -u.z * tension },
      true,
    );
    // r × T at the tangent point: (0,0,r) × (T·u) about X back-drives the drum.
    this.drum.addTorque(
      {
        x: -this.radiusLdu * S * u.y * tension,
        y: 0,
        z: 0,
      },
      true,
    );
    this.world.step();
    this.drum.resetForces(true);
    this.drum.resetTorques(true);
    this.load.resetForces(true);
    this.angle -= this.drum.angvel().x * DT;
  }
  loadHeightLdu() {
    return this.load.translation().y / S;
  }
  bench(ticks: number) {
    const times: number[] = [];
    for (let i = 0; i < ticks; i++) {
      const t = performance.now();
      this.step();
      times.push(performance.now() - t);
    }
    return {
      mean: times.reduce((a, b) => a + b, 0) / times.length,
      p95: percentile(times, 0.95),
    };
  }
}

/**
 * Pivoting cylinder: an arm hinged to a fixed base; a cylinder case pinned to
 * the base; its rod on a prismatic guide in the case; the rod eye pinned to
 * the arm (a closed loop). Pressure force acts along the current case axis on
 * rod and case. Three bodies and four joints per cylinder.
 */
export class PivotCylinderSketch {
  readonly world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  readonly arm: RAPIER.RigidBody;
  readonly case: RAPIER.RigidBody;
  readonly rod: RAPIER.RigidBody;
  force = 0;
  /** Base pivot A (case), arm pivot O, arm pin B, LDU. */
  readonly A = { y: 0, z: 0 };
  readonly O = { y: 0, z: 100 };
  readonly B = { y: 60, z: 160 };
  constructor() {
    this.world.timestep = DT;
    const P = (y: number, z: number) => ({ x: 0, y: y * S, z: z * S });
    const base = this.world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
    // Arm: 300 LDU beam from O along +Z (horizontal), B is on it raised 60.
    const armCentre = P(this.O.y + 30, this.O.z + 150);
    this.arm = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic().setTranslation(
        armCentre.x,
        armCentre.y,
        armCentre.z,
      ),
    );
    boxMass(this.arm, 20, [20, 60, 300]);
    const axis = { x: 1, y: 0, z: 0 };
    const rel = (
      b: RAPIER.RigidBody,
      p: { x: number; y: number; z: number },
    ) => {
      const t = b.translation();
      return { x: p.x - t.x, y: p.y - t.y, z: p.z - t.z };
    };
    this.world.createImpulseJoint(
      RAPIER.JointData.revolute(
        P(this.O.y, this.O.z),
        rel(this.arm, P(this.O.y, this.O.z)),
        axis,
      ),
      base,
      this.arm,
      true,
    );
    const a = P(this.A.y, this.A.z),
      b = P(this.B.y, this.B.z),
      d = { x: 0, y: b.y - a.y, z: b.z - a.z },
      len = Math.hypot(d.y, d.z),
      u = { x: 0, y: d.y / len, z: d.z / len };
    const caseCentre = {
        x: 0,
        y: a.y + u.y * len * 0.3,
        z: a.z + u.z * len * 0.3,
      },
      rodCentre = {
        x: 0,
        y: a.y + u.y * len * 0.75,
        z: a.z + u.z * len * 0.75,
      };
    this.case = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic().setTranslation(
        caseCentre.x,
        caseCentre.y,
        caseCentre.z,
      ),
    );
    boxMass(this.case, 1, [16, 16, 100]);
    this.rod = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic().setTranslation(
        rodCentre.x,
        rodCentre.y,
        rodCentre.z,
      ),
    );
    boxMass(this.rod, 0.5, [6, 6, 100]);
    this.world.createImpulseJoint(
      RAPIER.JointData.revolute(a, rel(this.case, a), axis),
      base,
      this.case,
      true,
    );
    const guide = this.world.createImpulseJoint(
      RAPIER.JointData.prismatic(
        { x: 0, y: 0, z: 0 },
        rel(this.rod, caseCentre),
        u,
      ),
      this.case,
      this.rod,
      true,
    ) as RAPIER.PrismaticImpulseJoint;
    guide.setLimits(-20 * S, 60 * S);
    this.eyeOnRod = rel(this.rod, b);
    this.pinOnArm = rel(this.arm, b);
    this.rest = this.extensionLdu();
    this.world.createImpulseJoint(
      RAPIER.JointData.revolute(this.eyeOnRod, this.pinOnArm, axis),
      this.rod,
      this.arm,
      true,
    );
  }
  private eyeOnRod!: { x: number; y: number; z: number };
  private pinOnArm!: { x: number; y: number; z: number };
  /** Rod-eye to arm-pin separation, LDU: the loop closure error. */
  closureErrorLdu() {
    const at = (
      body: RAPIER.RigidBody,
      local: { x: number; y: number; z: number },
    ) =>
      new Vector3(local.x, local.y, local.z)
        .applyQuaternion(body.rotation() as never)
        .add(body.translation() as never);
    return (
      at(this.rod, this.eyeOnRod).distanceTo(at(this.arm, this.pinOnArm)) / S
    );
  }
  /** Rod extension from the start, LDU. */
  extensionLdu() {
    const c = this.case.translation(),
      r = this.rod.translation();
    return Math.hypot(r.x - c.x, r.y - c.y, r.z - c.z) / S - this.rest;
  }
  private rest = 0;
  armAngleDegrees() {
    const q = this.arm.rotation();
    return (2 * Math.atan2(q.x, q.w) * 180) / Math.PI;
  }
  step() {
    const c = this.case.translation(),
      r = this.rod.translation(),
      d = { x: r.x - c.x, y: r.y - c.y, z: r.z - c.z },
      n = Math.hypot(d.x, d.y, d.z),
      f = {
        x: (d.x / n) * this.force,
        y: (d.y / n) * this.force,
        z: (d.z / n) * this.force,
      };
    this.rod.addForce(f, true);
    this.case.addForce({ x: -f.x, y: -f.y, z: -f.z }, true);
    this.world.step();
    this.rod.resetForces(true);
    this.case.resetForces(true);
  }
  bench(ticks: number) {
    const times: number[] = [];
    for (let i = 0; i < ticks; i++) {
      const t = performance.now();
      this.step();
      times.push(performance.now() - t);
    }
    return {
      mean: times.reduce((a, b) => a + b, 0) / times.length,
      p95: percentile(times, 0.95),
    };
  }
}
