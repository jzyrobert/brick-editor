import RAPIER from "@dimforge/rapier3d-compat";
import { Quaternion, Vector3 } from "three";
import { ensure, type Vec3 } from "../core/types";
import { orthonormalized } from "../core/math";
import type { NativePneumaticPump } from "../mechanisms/pneumatic-circuit";
import { frameRotation, toPhysics } from "./physics-frame";
import {
  readPreparedPneumaticPump,
  type PreparedPneumaticPump,
} from "./pneumatic-pump-source";
import { sourcePumpGuide, sourcePumpShaftFits } from "./pneumatic-pump-guide";
const live = new WeakMap<RAPIER.World, WeakMap<object, Set<string>>>();
/** Source-faithful four-owner pump bench. One factory case owns three fixed
 * components. The rod, visible gasket stub and every pin bore retain collision.
 * The omitted sealing piston/check valves are explicit functional assumptions. */
export function createSourcePneumaticPump(
  token: PreparedPneumaticPump,
  world: RAPIER.World,
  options: {
    bodyAnchored?: boolean;
    massKg?: number;
    maxForceN?: number;
    pressureReactionLimitN?: number;
  } = {},
) {
  ensure(
    world.bodies.len() + 2 <= 64 && world.colliders.len() + 4 <= 512,
    "LIMIT_EXCEEDED",
    "The source pump exceeds existing native actor budgets",
  );
  const seal = readPreparedPneumaticPump(token),
    mass = options.massKg ?? 1,
    maxForce = options.maxForceN ?? 25,
    reactionLimit = options.pressureReactionLimitN ?? 1000;
  ensure(
    Number.isFinite(mass) &&
      mass > 0 &&
      mass <= 100 &&
      Number.isFinite(maxForce) &&
      maxForce > 0 &&
      maxForce <= 1000 &&
      Number.isFinite(reactionLimit) &&
      reactionLimit >= maxForce &&
      reactionLimit <= 100000,
    "INVALID_INPUT",
    "Choose bounded pump simulation mass and effort",
  );
  let projects = live.get(world);
  if (!projects) {
    projects = new WeakMap();
    live.set(world, projects);
  }
  let owners = projects.get(seal.project);
  if (!owners) {
    owners = new Set();
    projects.set(seal.project, owners);
  }
  ensure(
    token.occurrenceIds.every((id) => !owners!.has(id)),
    "INVALID_INPUT",
    "A pump source actor already has a native owner",
  );
  const vertices: number[] = [],
    indices: number[] = [];
  for (let j = 0; j < 3; j++) {
    const { surface: s, relative } = seal.members[j],
      offset = vertices.length / 3;
    for (let i = 0; i < s.vertices.length; i++)
      vertices.push(
        (s.vertices[i] + relative[i % 3]) * 0.02 * (i % 3 === 0 ? 1 : -1),
      );
    indices.push(...Array.from(s.indices, (i) => i + offset));
  }
  const surface = seal.members[3].surface,
    rv = Float32Array.from(
      surface.vertices,
      (v, i) => v * 0.02 * (i % 3 === 0 ? 1 : -1),
    ),
    head: number[] = [],
    shaft: number[] = [],
    gasket: number[] = [];
  for (let i = 0; i < surface.indices.length; i += 3) {
    const ids = Array.from(surface.indices.subarray(i, i + 3));
    if (ids.some((j) => surface.vertices[3 * j + 1] > 56)) gasket.push(...ids);
    else if (ids.some((j) => surface.vertices[3 * j + 1] > 10))
      shaft.push(...ids);
    else head.push(...ids);
  }
  const sv = Float32Array.from(
      [...new Set(shaft)].flatMap((j) =>
        Array.from(rv.subarray(3 * j, 3 * j + 3)),
      ),
    ),
    shaftDesc = RAPIER.ColliderDesc.convexHull(sv);
  ensure(
    shaftDesc,
    "INVALID_INPUT",
    "The actual pump shaft could not be checked safely",
  );
  const points = [
    ...new Map(
      Array.from({ length: sv.length / 3 }, (_, i) => {
        const p = new Vector3(sv[i * 3], sv[i * 3 + 1], sv[i * 3 + 2]);
        return [p.toArray().join(","), p] as const;
      }),
    ).values(),
  ];
  const relative = seal.members.map((m) => {
    const p = toPhysics(m.relative);
    return new Vector3(p.x, p.y, p.z);
  });
  const guide = sourcePumpGuide(
    seal.members[1].surface,
    seal.members[2].surface,
    relative[1],
    relative[2],
  );
  ensure(
    sourcePumpShaftFits(
      points.map((p) => p.clone().add(relative[3])),
      guide,
    ),
    "INVALID_INPUT",
    "The actual pump shaft does not fit its reviewed source seal",
  );
  const flags =
    RAPIER.TriMeshFlags.MERGE_DUPLICATE_VERTICES |
    RAPIER.TriMeshFlags.FIX_INTERNAL_EDGES_TWO_SIDED;
  const descs = [
    RAPIER.ColliderDesc.trimesh(
      Float32Array.from(vertices),
      Uint32Array.from(indices),
      flags,
    ),
    RAPIER.ColliderDesc.trimesh(rv, Uint32Array.from(head), flags),
    shaftDesc,
    RAPIER.ColliderDesc.trimesh(rv, Uint32Array.from(gasket), flags),
  ];
  const created: RAPIER.RigidBody[] = [];
  let disposed = false;
  try {
    const make = (index: number, fixed: boolean) => {
      const f = orthonormalized(seal.members[index].frame),
        p = toPhysics(f.position),
        q = frameRotation(f),
        desc = (
          fixed ? RAPIER.RigidBodyDesc.fixed() : RAPIER.RigidBodyDesc.dynamic()
        )
          .setTranslation(p.x, p.y, p.z)
          .setRotation(q)
          .setCanSleep(false)
          .setAdditionalSolverIterations(8);
      if (!fixed)
        desc.setAdditionalMassProperties(
          mass,
          { x: 0, y: 0, z: 0 },
          { x: 0.5, y: 0.5, z: 0.1 },
          { x: 0, y: 0, z: 0, w: 1 },
        );
      const b = world.createRigidBody(desc);
      created.push(b);
      return b;
    };
    const body = make(0, options.bodyAnchored ?? true),
      rod = make(3, false),
      colliders = descs.map((d, i) =>
        world.createCollider(
          d
            .setDensity(0)
            .setFriction(0.7)
            .setActiveHooks(RAPIER.ActiveHooks.FILTER_CONTACT_PAIRS),
          i === 0 ? body : rod,
        ),
      );
    const initial = relative[3],
      data = RAPIER.JointData.prismatic(
        { x: 0, y: 0, z: 0 },
        { x: -initial.x, y: -initial.y, z: -initial.z },
        { x: 0, y: 1, z: 0 },
      );
    data.limitsEnabled = true;
    data.limits = [2.01 - initial.y, 2.79 - initial.y];
    const joint = world.createImpulseJoint(data, body, rod, true);
    joint.setContactsEnabled(true);
    body.recomputeMassPropertiesFromColliders();
    rod.recomputeMassPropertiesFromColliders();
    for (const id of token.occurrenceIds) owners.add(id);
    let input = 0,
      allowed = false;
    const events = new RAPIER.EventQueue(false);
    const assertLive = (exact: PreparedPneumaticPump = token) => {
      ensure(
        exact === token &&
          !disposed &&
          body.isValid() &&
          rod.isValid() &&
          joint.isValid() &&
          colliders.every((c) => c.isValid()),
        "INVALID_INPUT",
        "The exact native pump actors are no longer available",
      );
      readPreparedPneumaticPump(exact);
    };
    const projected = (b: RAPIER.RigidBody, dt: number) => {
      const p = new Vector3().copy(b.translation()),
        q = new Quaternion().copy(b.rotation()),
        v = b.linvel(),
        w = b.angvel(),
        angle = Math.hypot(w.x, w.y, w.z) * dt;
      p.addScaledVector(new Vector3(v.x, v.y, v.z), dt);
      if (angle > 0)
        q.premultiply(
          new Quaternion().setFromAxisAngle(
            new Vector3(w.x, w.y, w.z).normalize(),
            angle,
          ),
        );
      return { p, q };
    };
    const beforeStep = (dt: number) => {
      assertLive();
      ensure(
        Number.isFinite(dt) && dt >= 1 / 240 && dt <= 1 / 30,
        "INVALID_INPUT",
        "Use the bounded native pump timestep",
      );
      allowed = [0, dt].every((time) => {
        const a = projected(body, time),
          b = projected(rod, time),
          inv = a.q.clone().conjugate();
        return sourcePumpShaftFits(
          points.map((p) =>
            p
              .clone()
              .applyQuaternion(b.q)
              .add(b.p)
              .sub(a.p)
              .applyQuaternion(inv),
          ),
          guide,
        );
      });
    };
    const contactAllowed = (a: number, b: number) =>
      !(
        allowed &&
        ((a === colliders[0].handle && b === colliders[2].handle) ||
          (b === colliders[0].handle && a === colliders[2].handle))
      );
    const hooks: RAPIER.PhysicsHooks = {
      filterIntersectionPair() {
        return true;
      },
      filterContactPair(a, b) {
        return contactAllowed(a, b) ? RAPIER.SolverFlags.COMPUTE_IMPULSE : null;
      },
    };
    const pump = (
      id: string,
      chamber: string,
      outlet: string,
    ): NativePneumaticPump => ({
      id,
      chamber,
      outlet,
      body,
      rod,
      anchorBody: [initial.x, 2.8, initial.z],
      anchorRod: [0, 0, 0],
      axisBody: [0, -1, 0],
      restSeparationM: 0,
      strokeM: 0.8,
      maxForceN: reactionLimit,
      requireUnclippedReaction: true,
      areaM2: 8 * 8 ** 2 * Math.sin(Math.PI / 8) * 0.02 ** 2,
    });
    return {
      body,
      rod,
      joint,
      colliders,
      pump,
      assertLive,
      beforeStep,
      contactAllowed,
      assertPressureEnvelope(pressurePa: number, atmospherePa = 101325) {
        assertLive();
        ensure(
          Number.isFinite(pressurePa) &&
            Number.isFinite(atmospherePa) &&
            pressurePa > 0 &&
            atmospherePa > 0 &&
            Math.abs(
              (pressurePa - atmospherePa) *
                (8 * 8 ** 2 * Math.sin(Math.PI / 8) * 0.02 ** 2),
            ) <= reactionLimit,
          "LIMIT_EXCEEDED",
          "The pump pressure exceeds its supported native reaction. Release pressure before pumping again.",
        );
      },
      setManualInput(value: number) {
        assertLive();
        ensure(
          Number.isFinite(value) && value >= -1 && value <= 1,
          "INVALID_INPUT",
          "Pump input must be between minus one and one",
        );
        input = value;
      },
      applyManualForce(dt: number) {
        assertLive();
        ensure(
          Number.isFinite(dt) && dt >= 1 / 240 && dt <= 1 / 30,
          "INVALID_INPUT",
          "Use the bounded native pump timestep",
        );
        const axis = new Vector3(0, -1, 0)
          .applyQuaternion(new Quaternion().copy(body.rotation()))
          .multiplyScalar(input * maxForce * dt);
        const point = rod.translation();
        rod.applyImpulseAtPoint(axis, point, true);
        body.applyImpulseAtPoint(axis.clone().negate(), point, true);
      },
      stepWorld(dt: number = 1 / 60) {
        beforeStep(dt);
        world.timestep = dt;
        world.step(events, hooks);
      },
      dispose() {
        if (disposed) return;
        disposed = true;
        events.free();
        for (const b of created) if (b.isValid()) world.removeRigidBody(b);
        for (const id of token.occurrenceIds) owners!.delete(id);
      },
    };
  } catch (error) {
    for (const b of created) if (b.isValid()) world.removeRigidBody(b);
    throw error;
  }
}
