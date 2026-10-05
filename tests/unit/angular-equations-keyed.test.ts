import RAPIER from "@dimforge/rapier3d-compat";
import { afterEach, beforeAll, expect, it, vi } from "vitest";
import { AngularEquationSolver } from "../../src/mechanisms/angular-equations";

const worlds: RAPIER.World[] = [];
beforeAll(async () => RAPIER.init());
afterEach(() => worlds.splice(0).forEach((world) => world.free()));
const DT = 1 / 60,
  RADIUS = 0.1;
const inertia = (mass: number) => (2 / 5) * mass * RADIUS ** 2;
function keyed(maxTorqueNm = 10) {
  const world = new RAPIER.World({ x: 0, y: 0, z: 0 });
  world.timestep = DT;
  worlds.push(world);
  const body = (mass: number, x: number) => {
    const body = world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic().setTranslation(x, 0, 0).setCanSleep(false),
    );
    world.createCollider(
      RAPIER.ColliderDesc.ball(RADIUS).setMass(mass).setCollisionGroups(0),
      body,
    );
    return body;
  };
  const shaft = body(1, 1),
    bore = body(4, 0);
  const solver = new AngularEquationSolver(
    [{ id: "key", body: shaft, carrier: bore, axisLocal: [0, 0, 1] }],
    [{ id: "seated", terms: [{ portId: "key", coefficient: 1 }], maxTorqueNm }],
  );
  return { world, shaft, bore, solver };
}

it("a single carrier-relative key port reacts on both native source owners with independent inertia", () => {
  const { shaft, bore, solver } = keyed();
  const pose = vi.spyOn(shaft, "setRotation"),
    velocity = vi.spyOn(shaft, "setAngvel");
  shaft.applyTorqueImpulse({ x: 0, y: 0, z: 0.03 }, true);
  const before = 0.03 ** 2 / (2 * inertia(1));
  solver.solve(DT);
  const commonSpeed = 0.03 / (inertia(1) + inertia(4));
  expect(shaft.angvel().z).toBeCloseTo(commonSpeed, 6);
  expect(bore.angvel().z).toBeCloseTo(commonSpeed, 6);
  expect(
    inertia(1) * shaft.angvel().z + inertia(4) * bore.angvel().z,
  ).toBeCloseTo(0.03, 8);
  expect(
    (inertia(1) * shaft.angvel().z ** 2 + inertia(4) * bore.angvel().z ** 2) /
      2,
  ).toBeLessThan(before);
  expect(pose).not.toHaveBeenCalled();
  expect(velocity).not.toHaveBeenCalled();
});

it("a bounded one-port key slips at its reaction cap and neutral applies no shaft or bore impulse", () => {
  const { shaft, bore, solver } = keyed(0.01);
  shaft.applyTorqueImpulse({ x: 0, y: 0, z: 0.03 }, true);
  solver.solve(DT);
  expect(solver.snapshot().equations.seated.reactionLimited).toBe(true);
  expect(
    Math.abs(solver.snapshot().equations.seated.impulseNmSeconds),
  ).toBeCloseTo(0.01 * DT, 10);
  expect(shaft.angvel().z - bore.angvel().z).toBeGreaterThan(7);
  const before = [shaft.angvel().z, bore.angvel().z];
  solver.setEnabled("seated", false);
  solver.solve(DT);
  expect([shaft.angvel().z, bore.angvel().z]).toEqual(before);
  expect(solver.snapshot().equations.seated.impulseNmSeconds).toBe(0);
});
