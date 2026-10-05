import { Quaternion, Vector3 } from "three";
import {
  pneumaticGuidePlanes,
  pneumaticShaftFits,
} from "./pneumatic-cylinder-guide";
import RAPIER from "@dimforge/rapier3d-compat";
import { ensure, type Vec3 } from "../core/types";
import { orthonormalized } from "../core/math";
import type { NativePneumaticCylinder } from "../mechanisms/pneumatic-circuit";
import { frameRotation, toPhysics } from "./physics-frame";
import {
  readPreparedPneumaticCylinder,
  type PreparedPneumaticCylinder,
  type PneumaticCylinderSurface,
} from "./pneumatic-cylinder-source";
const live = new WeakMap<RAPIER.World, WeakMap<object, Set<string>>>();
function triangles(
  s: PneumaticCylinderSurface,
  filter?: (ids: number[]) => boolean,
) {
  const indices: number[] = [];
  for (let i = 0; i < s.indices.length; i += 3) {
    const ids = Array.from(s.indices.subarray(i, i + 3));
    if (!filter || filter(ids)) indices.push(...ids);
  }
  return RAPIER.ColliderDesc.trimesh(
    Float32Array.from(s.vertices, (v, i) => v * 0.02 * (i % 3 === 0 ? 1 : -1)),
    Uint32Array.from(indices),
    RAPIER.TriMeshFlags.MERGE_DUPLICATE_VERTICES |
      RAPIER.TriMeshFlags.FIX_INTERNAL_EDGES_TWO_SIDED,
  );
}
/** Native component bench/handoff. Ideal omitted seal and retained stops are
 * explicit; the complete visible source barrel/cap/eye/shaft remains collision.
 * Simulation masses/inertias are declared, not measured LEGO hardware weights. */
export function createSourcePneumaticCylinder(
  token: PreparedPneumaticCylinder,
  world: RAPIER.World,
  options: { bodyAnchored?: boolean; massKg?: number; maxForceN?: number } = {},
) {
  ensure(
    world.bodies.len() + 2 <= 64 && world.colliders.len() + 3 <= 512,
    "LIMIT_EXCEEDED",
    "The pneumatic actors exceed the existing native body or collider budget",
  );
  const seal = readPreparedPneumaticCylinder(token),
    mass = options.massKg ?? 1,
    maxForce = options.maxForceN ?? 25;
  ensure(
    Number.isFinite(mass) &&
      mass > 0 &&
      mass <= 100 &&
      Number.isFinite(maxForce) &&
      maxForce > 0 &&
      maxForce <= 1000,
    "INVALID_INPUT",
    "Choose bounded pneumatic simulation mass and effort",
  );
  let sources = live.get(world);
  if (!sources) {
    sources = new WeakMap();
    live.set(world, sources);
  }
  let owners = sources.get(seal.project);
  if (!owners) {
    owners = new Set();
    sources.set(seal.project, owners);
  }
  ensure(
    !owners.has(token.bodyOccurrenceId) && !owners.has(token.rodOccurrenceId),
    "INVALID_INPUT",
    "A pneumatic source actor already has a native owner",
  );
  const shaftIds: number[] = [];
  for (let i = 0; i < seal.rod.surface.indices.length; i += 3) {
    const ids = Array.from(seal.rod.surface.indices.subarray(i, i + 3));
    if (ids.some((j) => seal.rod.surface.vertices[3 * j + 1] > 19))
      shaftIds.push(...ids);
  }
  const vertices = Float32Array.from(
      [...new Set(shaftIds)].flatMap((i) =>
        Object.values(
          toPhysics(
            Array.from(
              seal.rod.surface.vertices.subarray(3 * i, 3 * i + 3),
            ) as Vec3,
          ),
        ),
      ),
    ),
    shaft = RAPIER.ColliderDesc.convexHull(vertices);
  ensure(
    shaft,
    "INVALID_INPUT",
    "The actual pneumatic rod shaft could not be checked safely",
  );
  const shaftPoints = [
      ...new Map(
        Array.from({ length: vertices.length / 3 }, (_, i) => {
          const p = new Vector3(
            vertices[3 * i],
            vertices[3 * i + 1],
            vertices[3 * i + 2],
          );
          return [p.toArray().join(","), p] as const;
        }),
      ).values(),
    ],
    capPlanes = pneumaticGuidePlanes(seal.body.surface, -178, 6),
    chamberPlanes = pneumaticGuidePlanes(seal.body.surface, -28, 15);
  const bodyDesc = triangles(seal.body.surface),
    headDesc = triangles(
      seal.rod.surface,
      (ids) => !ids.some((j) => seal.rod.surface.vertices[3 * j + 1] > 19),
    );
  const created: RAPIER.RigidBody[] = [];
  let disposed = false;
  try {
    const make = (frame: typeof seal.body.frame, fixed: boolean) => {
      const f = orthonormalized(frame),
        q = frameRotation(f).normalize(),
        p = toPhysics(f.position),
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
    const body = make(seal.body.frame, options.bodyAnchored ?? true),
      rod = make(seal.rod.frame, false),
      colliders = [
        world.createCollider(
          bodyDesc
            .setDensity(0)
            .setFriction(0.7)
            .setActiveHooks(RAPIER.ActiveHooks.FILTER_CONTACT_PAIRS),
          body,
        ),
        world.createCollider(headDesc.setDensity(0).setFriction(0.7), rod),
        world.createCollider(
          shaft
            .setDensity(0)
            .setFriction(0.7)
            .setActiveHooks(RAPIER.ActiveHooks.FILTER_CONTACT_PAIRS),
          rod,
        ),
      ];
    const initial = token.initialSeparationLdu * 0.02,
      data = RAPIER.JointData.prismatic(
        { x: 0, y: 0, z: 0 },
        { x: 0, y: -initial, z: 0 },
        { x: 0, y: 1, z: 0 },
      );
    data.limitsEnabled = true;
    data.limits = [4.01 - initial, 6.59 - initial];
    const joint = world.createImpulseJoint(data, body, rod, true);
    joint.setContactsEnabled(true);
    body.recomputeMassPropertiesFromColliders();
    rod.recomputeMassPropertiesFromColliders();
    owners.add(token.bodyOccurrenceId);
    owners.add(token.rodOccurrenceId);
    const areaBaseM2 = 8 * 15 ** 2 * Math.sin(Math.PI / 8) * 0.02 ** 2,
      areaRodM2 = 8 * 6 ** 2 * Math.sin(Math.PI / 8) * 0.02 ** 2;
    // Only the real shaft is an ideal lubricated axial bearing. The head,
    // source body and all foreign colliders keep their native contact response.
    // The omitted internal seal supplies retention through this prismatic
    // constraint; the source has zero CAD clearance at its R6 cap bore.
    let guideAllowed = false;
    const events = new RAPIER.EventQueue(false);
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
      ensure(
        Number.isFinite(dt) && dt >= 1 / 240 && dt <= 1 / 30,
        "INVALID_INPUT",
        "Use the bounded native pneumatic timestep",
      );
      ensure(
        !disposed &&
          body.isValid() &&
          rod.isValid() &&
          joint.isValid() &&
          colliders.every((c) => c.isValid()),
        "INVALID_INPUT",
        "The exact native pneumatic actors are no longer available",
      );
      readPreparedPneumaticCylinder(token);
      guideAllowed = [0, dt].every((time) => {
        const a = projected(body, time),
          b = projected(rod, time),
          inverse = a.q.clone().conjugate();
        const points = shaftPoints.map((p) =>
          p
            .clone()
            .applyQuaternion(b.q)
            .add(b.p)
            .sub(a.p)
            .applyQuaternion(inverse),
        );
        return pneumaticShaftFits(points, capPlanes, chamberPlanes);
      });
    };
    const contactAllowed = (a: number, b: number) =>
      !(
        guideAllowed &&
        ((a === colliders[0].handle && b === colliders[2].handle) ||
          (b === colliders[0].handle && a === colliders[2].handle))
      );
    const hooks: RAPIER.PhysicsHooks = {
      filterContactPair(a, b) {
        return contactAllowed(a, b) ? RAPIER.SolverFlags.COMPUTE_IMPULSE : null;
      },
      filterIntersectionPair() {
        return true;
      },
    };
    const cylinder = (
      id: string,
      base: string,
      cap: string,
    ): NativePneumaticCylinder => ({
      id,
      base,
      cap,
      body,
      rod,
      anchorBody: [0, 0, 0],
      anchorRod: [0, 0, 0],
      axisBody: [0, 1, 0],
      restSeparationM: 4,
      strokeM: 2.6,
      maxForceN: maxForce,
      areaBaseM2,
      areaCapM2: areaBaseM2 - areaRodM2,
    });
    return {
      assertLive(exact: PreparedPneumaticCylinder) {
        ensure(
          exact === token &&
            !disposed &&
            body.isValid() &&
            rod.isValid() &&
            joint.isValid() &&
            colliders.every((c) => c.isValid()),
          "INVALID_INPUT",
          "The exact native pneumatic actors are no longer available",
        );
        readPreparedPneumaticCylinder(exact);
      },
      beforeStep,
      contactAllowed,
      stepWorld(dt: number = 1 / 60) {
        beforeStep(dt);
        world.timestep = dt;
        world.step(events, hooks);
      },
      body,
      rod,
      joint,
      colliders,
      cylinder,
      dispose() {
        if (disposed) return;
        disposed = true;
        events.free();
        for (const b of created) if (b.isValid()) world.removeRigidBody(b);
        owners!.delete(token.bodyOccurrenceId);
        owners!.delete(token.rodOccurrenceId);
      },
    };
  } catch (error) {
    for (const b of created) if (b.isValid()) world.removeRigidBody(b);
    throw error;
  }
}
