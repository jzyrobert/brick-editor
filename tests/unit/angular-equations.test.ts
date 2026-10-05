import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import RAPIER from "@dimforge/rapier3d-compat";
import {
  AngularEquationSolver,
  ANGULAR_EQUATION_LIMITS,
  type AngularPort,
} from "../../src/mechanisms/angular-equations";
import {
  registerFullLibraryFromDisk,
  fullLibrarySources,
} from "../../scripts/full-library-node";
import {
  bindDrivetrainSources,
  drivetrainInterfaces,
} from "../../src/mechanisms/drivetrain-interfaces";
import {
  wormRouting,
  bevelRouting,
} from "../../src/mechanisms/drivetrain-routing";
import { occurrences } from "../../src/core/document";
import { importLDraw } from "../../src/ldraw/io";
import { readFileSync } from "node:fs";
const DT = 1 / 60,
  RADIUS = 0.1;
const worlds: RAPIER.World[] = [];
beforeAll(async () => {
  registerFullLibraryFromDisk();
  await RAPIER.init();
});
afterEach(() => {
  worlds.splice(0).forEach((world) => world.free());
});
function bench(mobile = false) {
  const world = new RAPIER.World({ x: 0, y: 0, z: 0 });
  world.timestep = DT;
  worlds.push(world);
  const body = (mass: number, x: number, fixed = false) => {
    const b = world.createRigidBody(
      (fixed ? RAPIER.RigidBodyDesc.fixed() : RAPIER.RigidBodyDesc.dynamic())
        .setTranslation(x, 0, 0)
        .setCanSleep(false),
    );
    world.createCollider(
      RAPIER.ColliderDesc.ball(RADIUS).setMass(mass).setCollisionGroups(0),
      b,
    );
    return b;
  };
  const carrier = body(4, 0, !mobile),
    a = body(1, 1),
    b = body(3, 2),
    c = body(2, 3);
  const port = (
    id: string,
    b: RAPIER.RigidBody,
    axis: AngularPort["axisLocal"] = [0, 0, 1],
  ) => ({ id, body: b, carrier, axisLocal: axis });
  return { world, a, b, c, carrier, port };
}
const inertia = (mass: number) => 0.4 * mass * RADIUS * RADIUS;
const energy = (body: RAPIER.RigidBody, mass: number) => {
  const w = body.angvel();
  return 0.5 * inertia(mass) * (w.x * w.x + w.y * w.y + w.z * w.z);
};
const momentum = (entries: [RAPIER.RigidBody, number][]) =>
  entries.reduce(
    (sum, [body, mass]) => {
      const w = body.angvel();
      return sum.map((x, i) => x + [w.x, w.y, w.z][i] * inertia(mass));
    },
    [0, 0, 0],
  );
const step = (
  solver: AngularEquationSolver,
  world: RAPIER.World,
  ticks: number,
  drive?: () => void,
) => {
  for (let i = 0; i < ticks; i++) {
    drive?.();
    solver.solve(DT);
    world.step();
  }
  solver.solve(DT);
};
describe("native signed angular equation kernel", () => {
  it("transfers a real output impulse backward with independently computed inertia/energy, without setting pose or velocity", () => {
    const { a, b, carrier, port } = bench(),
      ratio = -1 / 3;
    const solver = new AngularEquationSolver(
      [port("a", a), port("b", b)],
      [
        {
          id: "gear",
          terms: [
            { portId: "a", coefficient: -ratio },
            { portId: "b", coefficient: 1 },
          ],
        },
      ],
    );
    const setRotation = vi.spyOn(a, "setRotation"),
      setAngvel = vi.spyOn(a, "setAngvel");
    b.applyTorqueImpulse({ x: 0, y: 0, z: 0.03 }, true);
    const before = energy(a, 1) + energy(b, 3),
      wa = 0,
      wb = 0.03 / inertia(3);
    const lambda =
      -(wb - ratio * wa) / ((ratio * ratio) / inertia(1) + 1 / inertia(3));
    const expectedA = wa - (ratio * lambda) / inertia(1),
      expectedB = wb + lambda / inertia(3);
    solver.solve(DT);
    expect(a.angvel().z).toBeCloseTo(expectedA, 5);
    expect(b.angvel().z).toBeCloseTo(expectedB, 5);
    expect(b.angvel().z - ratio * a.angvel().z).toBeCloseTo(0, 6);
    expect(energy(a, 1) + energy(b, 3)).toBeLessThan(before);
    expect(setRotation).not.toHaveBeenCalled();
    expect(setAngvel).not.toHaveBeenCalled();
    expect(carrier.isFixed()).toBe(true);
  });
  it("propagates sustained load and stall to a torque-limited input, then releases and tracks multi-turn native motion", () => {
    const { a, b, world, port } = bench();
    const solver = new AngularEquationSolver(
      [port("a", a), port("b", b)],
      [
        {
          id: "shaft",
          terms: [
            { portId: "a", coefficient: 1 },
            { portId: "b", coefficient: 1 / 3 },
          ],
        },
      ],
    );
    b.lockRotations(true, true);
    step(solver, world, 90, () =>
      a.applyTorqueImpulse({ x: 0, y: 0, z: 0.01 * DT }, true),
    );
    expect(Math.abs(a.angvel().z)).toBeLessThan(1e-6);
    expect(Math.abs(solver.snapshot().ports.a.radians)).toBeLessThan(1e-6);
    b.lockRotations(false, true);
    step(solver, world, 600, () =>
      a.applyTorqueImpulse({ x: 0, y: 0, z: 0.006 * DT }, true),
    );
    const report = solver.snapshot();
    expect(Math.abs(report.ports.b.radians)).toBeGreaterThan(2 * Math.PI);
    expect(report.ports.a.radians + report.ports.b.radians / 3).toBeCloseTo(
      0,
      3,
    );
    expect(
      report.ports.a.speedRadiansPerSecond +
        report.ports.b.speedRadiansPerSecond / 3,
    ).toBeCloseTo(0, 4);
    const loadedSpeed = Math.abs(a.angvel().z);
    solver.setEnabled("shaft", false);
    step(solver, world, 60, () =>
      a.applyTorqueImpulse({ x: 0, y: 0, z: 0.006 * DT }, true),
    );
    expect(Math.abs(a.angvel().z)).toBeGreaterThan(loadedSpeed);
  });
  it("returns orthogonal bevel reactions to a mobile carrier and conserves native total angular momentum", () => {
    const { a, b, carrier, port } = bench(true);
    const solver = new AngularEquationSolver(
      [port("a", a, [1, 0, 0]), port("b", b, [0, 1, 0])],
      [
        {
          id: "bevel",
          terms: [
            { portId: "a", coefficient: -0.6 },
            { portId: "b", coefficient: 1 },
          ],
        },
      ],
    );
    a.applyTorqueImpulse({ x: 0.04, y: 0, z: 0 }, true);
    const bodies: [RAPIER.RigidBody, number][] = [
        [a, 1],
        [b, 3],
        [carrier, 4],
      ],
      before = momentum(bodies),
      beforeEnergy = energy(a, 1) + energy(b, 3) + energy(carrier, 4);
    solver.solve(DT);
    const after = momentum(bodies),
      report = solver.snapshot();
    after.forEach((x, i) => expect(x).toBeCloseTo(before[i], 7));
    expect(Math.hypot(carrier.angvel().x, carrier.angvel().y)).toBeGreaterThan(
      0.1,
    );
    expect(
      report.ports.b.speedRadiansPerSecond -
        0.6 * report.ports.a.speedRadiansPerSecond,
    ).toBeCloseTo(0, 6);
    expect(energy(a, 1) + energy(b, 3) + energy(carrier, 4)).toBeLessThan(
      beforeEnergy,
    );
  });
  it("solves an independently loaded three-port differential, preserves its free split and merges repeated carrier Jacobians", () => {
    const { a, b, c, carrier, port } = bench(true);
    const solver = new AngularEquationSolver(
      [port("left", a), port("right", b), port("case", c)],
      [
        {
          id: "diff",
          terms: [
            { portId: "left", coefficient: 1 },
            { portId: "right", coefficient: 1 },
            { portId: "case", coefficient: -2 },
          ],
        },
      ],
    );
    a.applyTorqueImpulse({ x: 0, y: 0, z: 0.03 }, true);
    const entries: [RAPIER.RigidBody, number][] = [
        [a, 1],
        [b, 3],
        [c, 2],
        [carrier, 4],
      ],
      before = momentum(entries);
    solver.solve(DT);
    const p = solver.snapshot().ports;
    expect(
      p.left.speedRadiansPerSecond +
        p.right.speedRadiansPerSecond -
        2 * p.case.speedRadiansPerSecond,
    ).toBeCloseTo(0, 6);
    expect(
      Math.abs(p.left.speedRadiansPerSecond - p.right.speedRadiansPerSecond),
    ).toBeGreaterThan(1);
    expect(Math.abs(carrier.angvel().z)).toBeLessThan(1e-8);
    momentum(entries).forEach((x, i) => expect(x).toBeCloseTo(before[i], 7));
    // A fresh stationary pair represents externally blocked outputs; locking a
    // previously moving body alone does not clear its existing Rapier velocity.
    const stalled = bench(true);
    const stalledSolver = new AngularEquationSolver(
      [
        stalled.port("left", stalled.a),
        stalled.port("right", stalled.b),
        stalled.port("case", stalled.c),
      ],
      [
        {
          id: "diff",
          terms: [
            { portId: "left", coefficient: 1 },
            { portId: "right", coefficient: 1 },
            { portId: "case", coefficient: -2 },
          ],
        },
      ],
    );
    stalled.a.lockRotations(true, true);
    stalled.b.lockRotations(true, true);
    stalled.c.applyTorqueImpulse({ x: 0, y: 0, z: 0.03 }, true);
    stalledSolver.solve(DT);
    expect(Math.abs(stalled.c.angvel().z)).toBeLessThan(1e-6);
  });
  it("leaves neutral independent, enables a reviewed phase with impulses only, and respects the per-body reaction cap", () => {
    const { a, b, world, port } = bench();
    const solver = new AngularEquationSolver(
      [port("a", a), port("b", b)],
      [
        {
          id: "clutch",
          enabled: false,
          maxTorqueNm: 0.01,
          terms: [
            { portId: "a", coefficient: 1 },
            { portId: "b", coefficient: -1 },
          ],
        },
      ],
    );
    a.applyTorqueImpulse({ x: 0, y: 0, z: 0.02 }, true);
    step(solver, world, 10);
    expect(b.angvel().z).toBe(0);
    const phase = solver.snapshot().equations.clutch.currentPhaseRadians;
    const pose = { ...a.rotation() },
      before = a.angvel().z;
    solver.setEnabled("clutch", true, phase);
    solver.solve(DT);
    expect(a.rotation()).toEqual(pose);
    expect(Math.abs(a.angvel().z - before) * inertia(1)).toBeLessThanOrEqual(
      0.01 * DT + 1e-8,
    );
    expect(solver.snapshot().equations.clutch.reactionLimited).toBe(true);
    solver.setEnabled("clutch", false);
    const free = b.angvel().z;
    solver.solve(DT);
    expect(b.angvel().z).toBe(free);
  });
  it("applies actual source-derived worm and bevel signs in pinned native impulse response", async () => {
    const refs = ["4716.dat", "10928.dat", "32270.dat", "6589.dat"] as const,
      binding = await bindDrivetrainSources(fullLibrarySources(refs), refs);
    const crane = occurrences(
        importLDraw(
          readFileSync("fixtures/ldraw/technic/42042-routing.ldr", "utf8"),
        ),
      ),
      arocs = occurrences(
        importLDraw(
          readFileSync("fixtures/ldraw/technic/42043-routing.ldr", "utf8"),
        ),
      );
    const iface = (o: (typeof crane)[number]) =>
      drivetrainInterfaces(o, binding)!;
    const worm = crane.find((o) => o.node.ref === "4716.dat")!,
      wheel = crane.find(
        (o) =>
          o.node.ref === "10928.dat" &&
          o.transform.position[0] === worm.transform.position[0],
      )!,
      wa = wormRouting(iface(worm), iface(wheel));
    const a = arocs.find((o) => o.node.ref === "32270.dat")!,
      b = arocs.find((o) => {
        if (o.node.ref !== "6589.dat") return false;
        try {
          bevelRouting(iface(a), iface(o));
          return true;
        } catch {
          return false;
        }
      })!,
      ba = bevelRouting(iface(a), iface(b));
    for (const relation of [wa, ba]) {
      const benchResult = bench();
      const toNative = (axis: readonly number[]) =>
        [axis[0], -axis[1], -axis[2]] as [number, number, number];
      const axisA = toNative(relation.axisA.axis),
        axisB = toNative(relation.axisB.axis);
      const solver = new AngularEquationSolver(
        [
          benchResult.port("a", benchResult.a, axisA),
          benchResult.port("b", benchResult.b, axisB),
        ],
        [
          {
            id: "actual",
            terms: [
              { portId: "a", coefficient: -relation.ratio },
              { portId: "b", coefficient: 1 },
            ],
          },
        ],
      );
      benchResult.b.applyTorqueImpulse(
        { x: 0.01 * axisB[0], y: 0.01 * axisB[1], z: 0.01 * axisB[2] },
        true,
      );
      solver.solve(DT);
      const p = solver.snapshot().ports;
      expect(p.b.speedRadiansPerSecond / relation.ratio).toBeCloseTo(
        p.a.speedRadiansPerSecond,
        5,
      );
      expect(Math.abs(p.a.speedRadiansPerSecond)).toBeGreaterThan(0.01);
    }
  });
  it("interleaves existing external equations in the declared eight-pass order", () => {
    const { a, b, c, world, port } = bench();
    const solver = new AngularEquationSolver(
      [port("a", a), port("b", b), port("c", c)],
      [
        {
          id: "ab",
          terms: [
            { portId: "a", coefficient: 1 },
            { portId: "b", coefficient: -1 },
          ],
        },
        {
          id: "bc",
          terms: [
            { portId: "b", coefficient: 1 },
            { portId: "c", coefficient: -1 },
          ],
        },
      ],
    );
    a.applyTorqueImpulse({ x: 0, y: 0, z: 0.02 }, true);
    solver.beginStep(world.timestep);
    for (let pass = 0; pass < 8; pass++) {
      solver.solveEquation("ab");
      // Real external angular response at the position of an interleaved rack row.
      if (pass === 0) b.applyTorqueImpulse({ x: 0, y: 0, z: 0.004 }, true);
      solver.solveEquation("bc");
    }
    const expected = (0.02 + 0.004) / (inertia(1) + inertia(3) + inertia(2));
    for (const body of [a, b, c])
      expect(body.angvel().z).toBeCloseTo(expected, 5);
    expect(() => solver.solveEquation("ab")).toThrow("pass budget");
    solver.setEnabled("ab", false);
    expect(() => solver.solveEquation("bc")).toThrow("Begin");
  });
  it("measures actual carrier-relative coordinates while the entire native assembly turns", () => {
    const { a, b, carrier, world, port } = bench(true);
    const solver = new AngularEquationSolver(
      [port("a", a), port("b", b)],
      [
        {
          id: "gears",
          terms: [
            { portId: "a", coefficient: 1 },
            { portId: "b", coefficient: 1 },
          ],
        },
      ],
    );
    for (const [body, mass] of [
      [a, 1],
      [b, 3],
      [carrier, 4],
    ] as const)
      body.applyTorqueImpulse({ x: 0, y: 0, z: inertia(mass) }, true);
    step(solver, world, 120);
    const p = solver.snapshot().ports;
    expect(Math.abs(p.a.radians)).toBeLessThan(1e-5);
    expect(Math.abs(p.b.radians)).toBeLessThan(1e-5);
    // A near-identity product of two F32 unit quaternions has at most this
    // conservative twist roundoff. Baumgarte feedback converts it to speed.
    const quaternionRoundoff = 8 * 2 ** -23;
    const speedRoundoff = quaternionRoundoff * (0.8 / DT + 1);
    expect(Math.abs(p.a.speedRadiansPerSecond)).toBeLessThan(speedRoundoff);
    expect(Math.abs(p.b.speedRadiansPerSecond)).toBeLessThan(speedRoundoff);
    expect(Math.abs(carrier.rotation().z)).toBeGreaterThan(0.5);
  });
  it("refuses equation/work overflow and unsupported coordinate jumps without silently dropping a port", () => {
    const { a, b, port, world } = bench();
    expect(
      () =>
        new AngularEquationSolver(
          Array(ANGULAR_EQUATION_LIMITS.ports + 1).fill(port("a", a)),
          [],
        ),
    ).toThrow("budget");
    expect(
      () =>
        new AngularEquationSolver(
          [port("a", a), port("b", b)],
          [
            {
              id: "bad",
              terms: [
                { portId: "a", coefficient: 1 },
                { portId: "b", coefficient: NaN },
              ],
            },
          ],
        ),
    ).toThrow("signed angular");
    const solver = new AngularEquationSolver([port("a", a), port("b", b)], []);
    a.setAngvel({ x: 0, y: 0, z: 30 }, true);
    for (let i = 0; i < 4; i++) world.step();
    expect(() => solver.solve(DT)).toThrow("60 degree");
  });
});
