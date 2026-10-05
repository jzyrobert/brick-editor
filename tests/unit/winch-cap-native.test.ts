import { readFileSync } from "node:fs";
import RAPIER from "@dimforge/rapier3d-compat";
import { Quaternion, Vector3 } from "three";
import { afterEach, beforeAll, expect, it } from "vitest";
import { occurrences } from "../../src/core/document";
import type { Project, Vec3 } from "../../src/core/types";
import { importLDraw } from "../../src/ldraw/io";
import { toPhysics, toPhysicsDirection } from "../../src/play/physics-frame";
import type { PlayMemberLocalGeometry } from "../../src/play/types";
import {
  prepareWinchCollision,
  type SourceBoundWinchCollision,
} from "../../src/mechanisms/winch-collision";
import { NativeWinchCapConstraints } from "../../src/mechanisms/winch-cap-native";
import {
  fullLibrarySources,
  registerFullLibraryFromDisk,
} from "../../scripts/full-library-node";
import { memberLocalOf } from "../helpers/play-dynamic-source";

const DT = 1 / 60,
  worlds: RAPIER.World[] = [];
let packet: SourceBoundWinchCollision, project: Project, original: string;
beforeAll(async () => {
  registerFullLibraryFromDisk();
  await RAPIER.init();
  project = importLDraw(
    readFileSync("fixtures/ldraw/technic/42042-mounted-winch.ldr", "utf8"),
  );
  original = JSON.stringify(project);
  const all = occurrences(project),
    sources = fullLibrarySources(all.map((o) => o.node.ref)),
    captures: Record<string, PlayMemberLocalGeometry> = {};
  for (const o of all)
    captures[o.id] = await memberLocalOf(project, o.id, sources);
  packet = await prepareWinchCollision(
    project,
    all.find((o) => o.node.ref === "4716.dat")!.id,
    sources,
    captures,
  );
}, 30_000);
afterEach(() => worlds.splice(0).forEach((w) => w.free()));
function native(geometry: boolean, mobile: boolean) {
  const world = new RAPIER.World({ x: 0, y: 0, z: 0 }),
    bodies = new Map<string, RAPIER.RigidBody>();
  world.timestep = DT;
  worlds.push(world);
  for (const owner of packet.owners) {
    const p = toPhysics(owner.frame.position),
      b = world.createRigidBody(
        (mobile ? RAPIER.RigidBodyDesc.dynamic() : RAPIER.RigidBodyDesc.fixed())
          .setTranslation(p.x, p.y, p.z)
          .setCanSleep(false),
      );
    if (mobile)
      b.setAdditionalMassProperties(
        0.05,
        { x: 0, y: 0, z: 0 },
        { x: 0.01, y: 0.01, z: 0.01 },
        { x: 0, y: 0, z: 0, w: 1 },
        true,
      );
    if (geometry)
      for (const r of owner.regions) {
        const v = Float32Array.from(
            r.points.flatMap((p) => Object.values(toPhysics(p as Vec3))),
          ),
          desc =
            r.kind === "source-trimesh"
              ? RAPIER.ColliderDesc.trimesh(v, new Uint32Array(r.triangles!))
              : RAPIER.ColliderDesc.convexHull(v)!;
        world.createCollider(desc.setMass(0), b);
      }
    b.recomputeMassPropertiesFromColliders();
    bodies.set(owner.occurrenceId, b);
  }
  return {
    world,
    bodies,
    caps: new NativeWinchCapConstraints(world, packet, bodies),
  };
}

it("keeps all 255 actual collision children while adding only four unilateral source-shoulder limits", () => {
  const { world, bodies, caps } = native(true, false);
  let work = 0;
  caps.beginStep(DT, (n) => {
    work += n;
  });
  const state = caps.snapshot();
  expect(state.caps).toHaveLength(4);
  expect(state.caps.every((c) => c.active)).toBe(true);
  expect(state.caps.every((c) => c.current!.halfspaceErrorLdu < 0.00002)).toBe(
    true,
  );
  expect(state.enumeratedPoints).toBe(work);
  expect(work).toBeGreaterThan(0);
  expect(work).toBeLessThan(200_000);
  expect(world.colliders.len()).toBe(255);
  expect(world.impulseJoints.len()).toBe(4);
  let lower = 0,
    upper = 0;
  world.impulseJoints.forEach((j) => {
    expect(j.contactsEnabled()).toBe(true);
    const limit = new RAPIER.PrismaticImpulseJoint(
      world.impulseJoints.raw,
      world.bodies,
      j.handle,
    );
    expect(limit.limitsEnabled()).toBe(true);
    if (limit.limitsMin() === 0) {
      lower++;
      expect(limit.limitsMax()).toBe(1_000_000);
    } else {
      upper++;
      expect(limit.limitsMin()).toBe(-1_000_000);
      expect(limit.limitsMax()).toBe(0);
    }
    const c = state.caps.find(
      (c) =>
        bodies.get(c.supportId) === j.body1() &&
        bodies.get(c.rotorId) === j.body2(),
    );
    expect(c).toBeDefined();
  });
  expect([lower, upper]).toEqual([2, 2]);
  expect(
    () => new NativeWinchCapConstraints(world, structuredClone(packet), bodies),
  ).toThrow();
  caps.dispose();
  expect(world.impulseJoints.len()).toBe(0);
  expect(world.colliders.len()).toBe(255);
  expect(JSON.stringify(project)).toBe(original);
});

it("returns each unilateral axial impulse to its actual mobile support without locking radial motion or rotor angle", () => {
  // Isolate the native limit law from collision response. Actual source packet
  // geometry is independently retained in the first check; this is not a full
  // winch-operation or mass-material claim.
  const { world, bodies, caps } = native(false, true),
    c = packet.rotorCaps[0],
    rotor = bodies.get(c.occurrenceId)!,
    axis = toPhysicsDirection(c.axis as Vec3),
    start = rotor.translation();
  const tangent = new Vector3(axis.x, axis.y, axis.z)
    .cross(new Vector3(0, 1, 0))
    .normalize();
  for (const sign of [-1, 1]) {
    rotor.setLinvel(
      {
        x: axis.x * sign * 0.001 + tangent.x * 0.0001,
        y: axis.y * sign * 0.001 + tangent.y * 0.0001,
        z: axis.z * sign * 0.001 + tangent.z * 0.0001,
      },
      true,
    );
    rotor.setAngvel(
      { x: axis.x * 0.02, y: axis.y * 0.02, z: axis.z * 0.02 },
      true,
    );
    const momentum = () => {
        const v = new Vector3();
        for (const b of bodies.values())
          v.addScaledVector(new Vector3().copy(b.linvel()), b.mass());
        return v;
      },
      before = momentum();
    caps.beginStep(DT, () => {});
    world.step();
    const after = momentum();
    expect(after.distanceTo(before)).toBeLessThan(1e-9);
    const support = bodies.get(c.supportIds[sign < 0 ? 0 : 1])!;
    expect(
      new Vector3()
        .copy(support.linvel())
        .dot(new Vector3(axis.x, axis.y, axis.z)) * sign,
    ).toBeGreaterThan(0.0001);
    expect(new Vector3().copy(rotor.linvel()).dot(tangent)).toBeCloseTo(
      0.0001,
      7,
    );
    expect(
      new Vector3()
        .copy(rotor.angvel())
        .dot(new Vector3(axis.x, axis.y, axis.z)),
    ).toBeCloseTo(0.02, 6);
  }
  expect(
    new Vector3()
      .copy(rotor.translation())
      .distanceTo(new Vector3().copy(start)),
  ).toBeGreaterThan(0);
});

it("refuses predicted misalignment and complete source-plane crossing, charging failed work and retaining contacts", () => {
  const { world, bodies, caps } = native(true, true),
    c = packet.rotorCaps[0],
    rotor = bodies.get(c.occurrenceId)!,
    originalPosition = rotor.translation(),
    axis = new Vector3().copy(toPhysicsDirection(c.axis as Vec3)),
    tangent = axis
      .clone()
      .cross(new Vector3(0, 1, 0))
      .normalize();
  caps.beginStep(DT, () => {});
  expect(caps.snapshot().caps.every((c) => c.active)).toBe(true);
  rotor.setLinvel(tangent.clone().multiplyScalar(1), true);
  caps.beginStep(DT, () => {});
  expect(
    caps
      .snapshot()
      .caps.filter((s) => s.rotorId === c.occurrenceId)
      .every((s) => !s.active),
  ).toBe(true);
  rotor.setLinvel({ x: 0, y: 0, z: 0 }, true);
  rotor.setRotation(new Quaternion().setFromAxisAngle(tangent, 0.003), true);
  caps.beginStep(DT, () => {});
  expect(
    caps
      .snapshot()
      .caps.filter((s) => s.rotorId === c.occurrenceId)
      .every((s) => !s.active),
  ).toBe(true);
  rotor.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
  rotor.setTranslation(
    new Vector3().copy(originalPosition).addScaledVector(axis, 0.02),
    true,
  );
  caps.beginStep(DT, () => {});
  expect(
    caps
      .snapshot()
      .caps.find((s) => s.rotorId === c.occurrenceId && s.side === 1)!.active,
  ).toBe(false);
  rotor.setTranslation(originalPosition, true);
  caps.beginStep(DT, () => {});
  let charged = 0;
  expect(() =>
    caps.beginStep(DT, (n) => {
      charged = n;
      throw new Error("enumeration exhausted");
    }),
  ).toThrow("enumeration exhausted");
  expect(charged).toBeGreaterThan(0);
  expect(world.impulseJoints.len()).toBe(0);
  expect(world.colliders.len()).toBe(255);
  expect(caps.snapshot().caps.every((c) => !c.active && !c.current)).toBe(true);
});
