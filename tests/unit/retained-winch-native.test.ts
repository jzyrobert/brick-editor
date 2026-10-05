import RAPIER from "@dimforge/rapier3d-compat";
import { beforeAll, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { Matrix3, Vector3 } from "three";
import { importLDraw } from "../../src/ldraw/io";
import { occurrences } from "../../src/core/document";
import {
  fullLibrarySources,
  registerFullLibraryFromDisk,
} from "../../scripts/full-library-node";
import {
  prepareRetainedWinchNative,
  RetainedWinchNative,
  isPreparedRetainedWinchPacket,
  retainedWinchContactKind,
  type ReviewedRetainedWinchPacket,
} from "../../src/mechanisms/winch-native";
import { memberLocalOf } from "../helpers/play-dynamic-source";
const DT = 1 / 60;
const project = importLDraw(
  readFileSync("fixtures/ldraw/technic/42042-retained-winch.ldr", "utf8"),
);
let packet: ReviewedRetainedWinchPacket;
beforeAll(async () => {
  await RAPIER.init();
  registerFullLibraryFromDisk();
  const all = occurrences(project),
    sources = fullLibrarySources(all.map((o) => o.node.ref));
  packet = await prepareRetainedWinchNative(
    project,
    all.find((o) => o.node.ref === "4716.dat")!.id,
    sources,
  );
});
function run(
  fn: (
    native: RetainedWinchNative,
    world: RAPIER.World,
    step: (ticks: number, torque?: number) => void,
  ) => void,
) {
  const world = new RAPIER.World({ x: 0, y: 0, z: 0 }),
    events = new RAPIER.EventQueue(true);
  world.timestep = DT;
  try {
    const native = new RetainedWinchNative(world, packet);
    fn(native, world, (ticks, torque = 0) => {
      for (let i = 0; i < ticks; i++) {
        native.applyManualTorque(torque, DT);
        native.beginStep(DT);
        for (let j = 0; j < 8; j++) native.solvePass();
        world.step(events, native.hooks);
      }
      native.beginStep(DT);
    });
  } finally {
    events.free();
    world.free();
  }
}
describe("actual retained native crane winch", () => {
  it("retains all12 source members/8660 reference triangles within239 native children and refuses forged packets", () => {
    expect(packet.sourceTriangles).toBe(8660);
    expect(packet.childCount).toBe(239);
    expect(packet.capPlaneRoundoffLdu).toBe(0);
    expect(packet.shaftOwnership).toBe("axially-free-keyed");
    expect(packet.inputStop.lowerLdu).toBe(0);
    expect(packet.inputStop.positiveHardStop).toBeNull();
    for (const proof of Object.values(packet.keyColumnCertificates)) {
      expect(proof.maxResidualAreaLdu2).toBe(0);
      expect(proof.maxEdgeGapFraction).toBe(0);
      expect(proof.normalPlaneEnvelopeLdu).toBe(1e-6);
    }
    expect(packet.carrier).toHaveLength(8);
    expect(packet.captureBinding).toBe("source-constructor-only");
    expect(isPreparedRetainedWinchPacket(packet)).toBe(true);
    expect(isPreparedRetainedWinchPacket(structuredClone(packet))).toBe(false);
    expect(Object.isFrozen(packet.input[0].points[0])).toBe(true);
    expect(Object.isFrozen(packet.output)).toBe(true);
  });
  it("binds the actual renderer canonical context before ordinary session consumption", async () => {
    const all = occurrences(project),
      sources = fullLibrarySources(all.map((o) => o.node.ref));
    const captures = Object.fromEntries(
      await Promise.all(
        all.map(async (o) => [
          o.id,
          await memberLocalOf(project, o.id, sources),
        ]),
      ),
    );
    const wormId = all.find((o) => o.node.ref === "4716.dat")!.id;
    const matched = await prepareRetainedWinchNative(
      project,
      wormId,
      sources,
      captures,
    );
    expect(matched.captureBinding).toBe("matched-canonical");
    const id = all[0].id,
      changed = {
        ...captures,
        [id]: { ...captures[id], vertices: captures[id].vertices.slice() },
      };
    changed[id].vertices[0] += 1;
    await expect(
      prepareRetainedWinchNative(project, wormId, sources, changed),
    ).rejects.toThrow("canonical winch geometry differs");
    const wrongFrame = {
      ...captures,
      [id]: { ...captures[id], frame: structuredClone(captures[id].frame) },
    };
    wrongFrame[id].frame.position[0] += 1;
    await expect(
      prepareRetainedWinchNative(project, wormId, sources, wrongFrame),
    ).rejects.toThrow("canonical winch context");
  });
  it("turns the actual keyed shafts forward/reverse with source contacts enabled and restores rest source/inventory", () => {
    const before = JSON.stringify(project);
    run((native, _world, step) => {
      step(300, 0.002);
      const first = native.solver.snapshot().ports;
      expect(first.input.radians).toBeGreaterThan(5);
      expect(first.output.radians).toBeGreaterThan(0.6);
      expect(first.output.radians - first.input.radians / 8).toBeCloseTo(0, 5);
      expect(native.aligned()).toBe(true);
      step(600, -0.003);
      const reverse = native.solver.snapshot().ports;
      expect(reverse.input.radians).toBeLessThan(0);
      expect(reverse.output.radians - reverse.input.radians / 8).toBeCloseTo(
        0,
        4,
      );
    });
    expect(JSON.stringify(project)).toBe(before);
  }, 20_000);
  it("returns real output load/stall to the input, releases and backdrives without setting a pose", () => {
    run((native, _world, step) => {
      native.output.lockRotations(true, true);
      step(90, 0.002);
      const stall = native.solver.snapshot().ports;
      expect(Math.abs(stall.input.radians)).toBeLessThan(0.001);
      expect(Math.abs(stall.input.speedRadiansPerSecond)).toBeLessThan(0.001);
      native.output.lockRotations(false, true);
      step(120, 0.002);
      expect(native.solver.snapshot().ports.input.radians).toBeGreaterThan(0.7);
    });
    run((native, _world, step) => {
      const inputInertia =
        1 / native.input.effectiveWorldInvInertia().m33 +
        1 / native.inputShaft.effectiveWorldInvInertia().m33;
      const outputInertia =
        1 / native.output.effectiveWorldInvInertia().m11 +
        1 / native.outputShaft.effectiveWorldInvInertia().m11;
      const outputImpulse = 0.003,
        ratio = 1 / 8;
      // Independently computed generalized momentum: the orthogonal input
      // receives ratio*Lout, with reflected inertiaIa+ratio²Ib.
      const expectedInputSpeed =
        (ratio * outputImpulse) /
        (inputInertia + ratio * ratio * outputInertia);
      native.output.applyTorqueImpulse({ x: outputImpulse, y: 0, z: 0 }, true);
      step(60);
      const report = native.solver.snapshot().ports;
      expect(report.input.radians).toBeCloseTo(expectedInputSpeed * 60 * DT, 5);
      expect(report.input.radians).toBeGreaterThan(0);
      expect(report.output.radians - report.input.radians / 8).toBeCloseTo(
        0,
        5,
      );
    });
  });

  it("returns manual input reaction to the actual mobile carrier and preserves native momentum", () => {
    const world = new RAPIER.World({ x: 0, y: 0, z: 0 }),
      events = new RAPIER.EventQueue(true);
    world.timestep = DT;
    try {
      const native = new RetainedWinchNative(world, packet, true);
      const rest = { ...native.carrier.rotation() };
      for (let i = 0; i < 180; i++) {
        native.applyManualTorque(0.002, DT);
        native.beginStep(DT);
        for (let j = 0; j < 8; j++) native.solvePass();
        world.step(events, native.hooks);
      }
      native.beginStep(DT);
      const p = native.solver.snapshot().ports;
      expect(p.input.radians).toBeGreaterThan(0.5);
      expect(p.output.radians - p.input.radians / 8).toBeCloseTo(0, 4);
      expect(native.carrier.rotation()).not.toEqual(rest);
      const linear = new Vector3(),
        angular = new Vector3();
      for (const b of [
        native.input,
        native.output,
        native.inputShaft,
        native.outputShaft,
        native.carrier,
      ]) {
        const v = b.linvel(),
          omega = b.angvel(),
          com = b.worldCom(),
          inv = b.effectiveWorldInvInertia();
        const momentum = new Vector3(v.x, v.y, v.z).multiplyScalar(b.mass());
        linear.add(momentum);
        const inertia = new Matrix3()
          .set(
            inv.m11,
            inv.m12,
            inv.m13,
            inv.m21,
            inv.m22,
            inv.m23,
            inv.m31,
            inv.m32,
            inv.m33,
          )
          .invert();
        angular.add(
          new Vector3(omega.x, omega.y, omega.z).applyMatrix3(inertia),
        );
        angular.add(new Vector3(com.x, com.y, com.z).cross(momentum));
      }
      expect(linear.length()).toBeLessThan(1e-6);
      expect(angular.length()).toBeLessThan(1e-5);
    } finally {
      events.free();
      world.free();
    }
  });
  it("retains both plain-shaft axial directions, the actual one-sided head stop and withdrawal isolation", () => {
    for (const sign of [-1, 1])
      run((native, _world, step) => {
        const rest = { ...native.outputShaft.translation() };
        native.outputShaft.applyImpulse({ x: sign * 0.001, y: 0, z: 0 }, true);
        step(30);
        expect(
          (sign * (native.outputShaft.translation().x - rest.x)) / 0.02,
        ).toBeGreaterThan(0.2);
        expect(Math.abs(native.output.translation().x - rest.x)).toBeLessThan(
          1e-6,
        );
      });
    run((native, _world, step) => {
      const rest = { ...native.inputShaft.translation() };
      native.inputShaft.applyImpulse({ x: 0, y: 0, z: 0.001 }, true);
      step(30);
      expect(
        (native.inputShaft.translation().z - rest.z) / 0.02,
      ).toBeGreaterThan(0.2);
    });
    run((native, _world, step) => {
      const rest = { ...native.inputShaft.translation() };
      native.inputShaft.applyImpulse({ x: 0, y: 0, z: -0.001 }, true);
      step(30);
      expect(
        (native.inputShaft.translation().z - rest.z) / 0.02,
      ).toBeGreaterThan(-0.05);
      expect(Math.abs(native.inputShaft.linvel().z)).toBeLessThan(1e-5);
    });
    run((native, _world, step) => {
      const p = native.outputShaft.translation();
      native.outputShaft.setTranslation({ x: p.x + 1, y: p.y, z: p.z }, true);
      native.beginStep(DT);
      expect(native.solver.snapshot().equations["output-key"].enabled).toBe(
        false,
      );
      native.outputShaft.applyTorqueImpulse({ x: 0.003, y: 0, z: 0 }, true);
      step(10);
      expect(
        Math.abs(native.solver.snapshot().ports.output.radians),
      ).toBeLessThan(1e-5);
      expect(
        Math.abs(native.solver.snapshot().ports["output-shaft"].radians),
      ).toBeGreaterThan(0.1);
    });
  });
  it("closes key contact handling on predicted phase or withdrawal while preserving a seated angular reaction", () => {
    const responseForOutputKey = (native: RetainedWinchNative) => {
      const entries = [...native.metadata],
        shaft = entries.find(([, r]) => r.keyed && packet.output.includes(r))!,
        gear = entries.find(
          ([, r]) => r.memberId === packet.witness.output.occurrenceId,
        )!;
      expect(retainedWinchContactKind(packet, shaft[1], gear[1])).toBe("key");
      return native.hooks.filterContactPair(shaft[0], gear[0], 0, 0);
    };
    run((native) => {
      native.outputShaft.setAngvel({ x: 0.2, y: 0, z: 0 }, true);
      native.beginStep(DT);
      expect(native.solver.snapshot().equations["output-key"].enabled).toBe(
        true,
      );
      expect(responseForOutputKey(native)).toBe(
        RAPIER.SolverFlags.COMPUTE_IMPULSE,
      );
      for (let i = 0; i < 8; i++) native.solvePass();
      expect(responseForOutputKey(native)).toBeNull();
    });
    run((native) => {
      const p = native.outputShaft.translation();
      // Only .01 LDU of the source constant key remains inside the gear.
      // Its actual next axial motion withdraws it: no angular weld survives.
      native.outputShaft.setTranslation({ ...p, x: p.x + 37.49 * 0.02 }, true);
      native.outputShaft.setLinvel({ x: 0.1, y: 0, z: 0 }, true);
      native.beginStep(DT);
      expect(native.solver.snapshot().equations["output-key"].enabled).toBe(
        false,
      );
      expect(responseForOutputKey(native)).toBe(
        RAPIER.SolverFlags.COMPUTE_IMPULSE,
      );
    });
    run((native) => {
      native.outputShaft.setRotation(
        { x: Math.sin(0.005), y: 0, z: 0, w: Math.cos(0.005) },
        true,
      );
      native.beginStep(DT);
      expect(native.solver.snapshot().equations["output-key"].enabled).toBe(
        false,
      );
      expect(responseForOutputKey(native)).toBe(
        RAPIER.SolverFlags.COMPUTE_IMPULSE,
      );
    });
  });
  it("returns the one-sided head impulse directly to a mobile source carrier", () => {
    const world = new RAPIER.World({ x: 0, y: 0, z: 0 }),
      events = new RAPIER.EventQueue(true);
    world.timestep = DT;
    try {
      const native = new RetainedWinchNative(world, packet, true),
        rest =
          native.inputShaft.translation().z - native.carrier.translation().z;
      native.inputShaft.applyImpulse({ x: 0, y: 0, z: -0.001 }, true);
      for (let i = 0; i < 30; i++) {
        native.beginStep(DT);
        for (let j = 0; j < 8; j++) native.solvePass();
        world.step(events, native.hooks);
      }
      expect(native.carrier.linvel().z).toBeLessThan(-1e-4);
      expect(
        (native.inputShaft.translation().z -
          native.carrier.translation().z -
          rest) /
          0.02,
      ).toBeGreaterThan(-0.05);
      const momentum = new Vector3();
      for (const body of [
        native.carrier,
        native.input,
        native.output,
        native.inputShaft,
        native.outputShaft,
      ]) {
        const v = body.linvel();
        momentum.add(new Vector3(v.x, v.y, v.z).multiplyScalar(body.mass()));
      }
      expect(momentum.distanceTo(new Vector3(0, 0, -0.001))).toBeLessThan(1e-6);
    } finally {
      events.free();
      world.free();
    }
  });
  it("keeps a real foreign thin blocker responding and closes every source allowance on misalignment", () => {
    run((native, world, step) => {
      const p = native.output.translation();
      const wall = world.createCollider(
        RAPIER.ColliderDesc.cuboid(0.04, 0.005, 0.005).setTranslation(
          p.x + 0.4,
          p.y + 0.076,
          p.z + 0.076,
        ),
      );
      let foreign = 0;
      const real = native.hooks.filterContactPair;
      native.hooks.filterContactPair = (a, b, c, d) => {
        const response = real(a, b, c, d);
        if (
          (a === wall.handle || b === wall.handle) &&
          response === RAPIER.SolverFlags.COMPUTE_IMPULSE
        )
          foreign++;
        return response;
      };
      step(300, 0.002);
      expect(foreign).toBeGreaterThan(0);
      expect(
        Math.abs(native.solver.snapshot().ports.output.radians),
      ).toBeLessThan(0.5);
      native.input.setTranslation(
        {
          x: native.input.translation().x + 0.02,
          y: native.input.translation().y,
          z: native.input.translation().z,
        },
        true,
      );
      native.prepareContacts();
      expect(native.aligned()).toBe(false);
      const toothA = [...native.metadata].find(
        ([, r]) => r.tooth && r.memberId === packet.witness.input.occurrenceId,
      )![0];
      const toothB = [...native.metadata].find(
        ([, r]) => r.tooth && r.memberId === packet.witness.output.occurrenceId,
      )![0];
      expect(
        real(toothA, toothB, native.input.handle, native.output.handle),
      ).toBe(RAPIER.SolverFlags.COMPUTE_IMPULSE);
    });
  });
});
