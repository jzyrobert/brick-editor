import { afterEach, beforeAll, describe, expect, it } from "vitest";
import RAPIER from "@dimforge/rapier3d-compat";
import { loopFixture } from "../../src/mechanisms/loop-fixture";
import {
  axisRotation,
  KinematicSession,
  validateRig,
} from "../../src/mechanisms/kinematic";
import { rigAuthoringRequest } from "../../src/mechanisms/authoring";
import type { MotionRig } from "../../src/mechanisms/types";
import type { Transform, Vec3 } from "../../src/core/types";
import { add, mv } from "../../src/core/math";
import { DynamicRig } from "../../src/play/dynamics";
import { playSources } from "../helpers/play-dynamic-source";
import { decodeNative, encodeNative } from "../../src/persistence/native";
import { posedLDraw } from "../../src/mechanisms/posed-export";
import { importLDraw } from "../../src/ldraw/io";
import { occurrences } from "../../src/core/document";

beforeAll(async () => {
  await RAPIER.init();
});
const cleanup: Array<() => void> = [];
afterEach(() =>
  cleanup
    .splice(0)
    .reverse()
    .forEach((f) => f()),
);
async function fixture(pose?: Transform, bounded = true) {
  const { project, rig: definition } = loopFixture("four-bar", pose);
  definition.groups = definition.groups.slice(0, 2);
  // Keep the constraint probe clear throughout both axial stops. Layered loop
  // links are not a physical bearing housing, and may otherwise meet on travel.
  const fixed = definition.groups[0],
    moving = definition.groups[1];
  fixed.frame.position = add(
    moving.frame.position,
    mv(fixed.frame.basis, [0, 0, -40]),
  );
  fixed.restTransforms[fixed.occurrenceIds[0]] = structuredClone(fixed.frame);
  project.models[project.rootModelId].nodes[0].transform = structuredClone(
    fixed.frame,
  );
  delete definition.loopClosures;
  definition.dynamics = {
    groups: { frame: { anchored: true }, input: { massKg: 1 } },
  };
  definition.joints = [
    {
      id: "bearing",
      kind: "cylindrical",
      bodyA: "frame",
      bodyB: "input",
      anchorA: [0, 0, 40],
      anchorB: [0, 0, 0],
      axisA: [0, 0, 1],
      axisB: [0, 0, 1],
      ...(bounded
        ? { translationLimitsLdu: [-10, 20] as [number, number] }
        : {}),
    },
  ];
  validateRig(project, definition);
  const source = JSON.stringify(project),
    { sources } = await playSources(project, [definition.id]);
  const world = new RAPIER.World({ x: 0, y: 0, z: 0 }),
    mirror = new RAPIER.World({ x: 0, y: 0, z: 0 }),
    rig = new DynamicRig(world, mirror, sources[0], 0, project.revision);
  world.timestep = 1 / 60;
  const body = world.bodies.getAll()[1],
    axis = mv(definition.groups[0].frame.basis, [0, 0, 1]);
  const impulse = (linear: number, torque: number) => {
    body.applyImpulse(
      { x: axis[0] * linear, y: -axis[1] * linear, z: -axis[2] * linear },
      true,
    );
    body.applyTorqueImpulse(
      { x: axis[0] * torque, y: -axis[1] * torque, z: -axis[2] * torque },
      true,
    );
  };
  cleanup.push(() => {
    rig.dispose();
    world.free();
    mirror.free();
  });
  const step = (ticks: number) => {
    for (let n = 0; n < ticks; n++) {
      rig.beforeStep();
      rig.stepPhysics();
      rig.afterStep();
    }
    return rig.snapshot();
  };
  step(1);
  const geometry = () => {
    const frames = rig.snapshot().groupFrames,
      a = frames.frame,
      b = frames.input,
      axis = mv(a.basis, [0, 0, 1]),
      other = mv(b.basis, [0, 0, 1]);
    const delta = add(b.position, a.position.map((v) => -v) as Vec3),
      axial = delta.reduce((sum, v, k) => sum + v * axis[k], 0);
    return {
      radial: Math.hypot(...delta.map((v, k) => v - axial * axis[k])),
      align: axis.reduce((sum, v, k) => sum + v * other[k], 0),
    };
  };
  return {
    project,
    definition,
    source,
    world,
    rig,
    body,
    impulse,
    step,
    geometry,
  };
}
describe("free cylindrical bearings", () => {
  it("allows accumulated spin and axial travel while radial/tilt motion and both stops remain physical", async () => {
    const f = await fixture();
    f.impulse(0.5, 0.5);
    f.body.applyImpulse({ x: 0.2, y: 0.2, z: 0 }, true);
    f.body.applyTorqueImpulse({ x: 0.2, y: 0.2, z: 0 }, true);
    let report = f.step(240);
    expect(report.dynamics!.bearings!.bearing.translationLdu).toBeCloseTo(
      20,
      1,
    );
    expect(
      Math.abs(report.dynamics!.bearings!.bearing.angleDegrees),
    ).toBeGreaterThan(360);
    expect(f.geometry().radial).toBeLessThan(0.05);
    expect(f.geometry().align).toBeGreaterThan(0.9999);
    expect(report.pose.jointPositions).toEqual({});
    expect(report.jointTargets).toEqual({});
    expect(() => f.rig.setJointTarget("bearing", 5, 10)).toThrow();
    f.impulse(-1, 0);
    report = f.step(180);
    expect(report.dynamics!.bearings!.bearing.translationLdu).toBeCloseTo(
      -10,
      1,
    );
    expect(f.geometry().radial).toBeLessThan(0.05);
    expect(JSON.stringify(f.project)).toBe(f.source);
  });
  it("does not silently constrain the axial freedom when stops are omitted", async () => {
    const f = await fixture(undefined, false);
    f.impulse(0.5, 0.5);
    const report = f.step(180);
    expect(report.dynamics!.bearings!.bearing.translationLdu).toBeGreaterThan(
      50,
    );
    expect(f.geometry().radial).toBeLessThan(0.05);
    expect(f.geometry().align).toBeGreaterThan(0.9999);
  });
  it("preserves the same two freedoms on oblique axes and replays deterministically", async () => {
    const pose = {
        basis: axisRotation(
          [1 / Math.sqrt(3), 1 / Math.sqrt(3), 1 / Math.sqrt(3)],
          73,
        ),
        position: [300, -200, 100] as Vec3,
      },
      a = await fixture(pose),
      b = await fixture(pose);
    a.impulse(0.5, 0.5);
    b.impulse(0.5, 0.5);
    const report = a.step(180);
    expect(report).toEqual(b.step(180));
    expect(report.dynamics!.bearings!.bearing.translationLdu).toBeCloseTo(
      20,
      1,
    );
    expect(
      Math.abs(report.dynamics!.bearings!.bearing.angleDegrees),
    ).toBeGreaterThan(360);
    expect(a.geometry().radial).toBeLessThan(0.05);
    expect(a.geometry().align).toBeGreaterThan(0.9999);
  });
  it("keeps the kinematic rest preview explicit and refuses lossy scalar editing", async () => {
    const f = await fixture(),
      preview = new KinematicSession(f.project, f.definition.id);
    expect(preview.snapshot().warnings.join(" ")).toMatch(
      /Cylindrical.*Dynamic Play/,
    );
    expect(preview.snapshot().groupFrames.input).toEqual(
      f.definition.groups[1].frame,
    );
    expect(() => preview.setJointPosition("bearing", 10)).toThrow();
    expect(() => rigAuthoringRequest(f.project, f.definition.id)).toThrow(
      /without losing/,
    );
    expect(JSON.stringify(f.project)).toBe(f.source);
  });
  it("persists native bearing stops and exports actual placements without changing the authored rest pose", async () => {
    const f = await fixture();
    f.impulse(0.5, 0.5);
    const report = f.step(180);
    const saved = await decodeNative(await encodeNative(f.project));
    expect(saved.motionRigs).toEqual(f.project.motionRigs);
    const posed = posedLDraw(f.project, report.transforms),
      imported = occurrences(importLDraw(posed.text));
    expect(imported).toHaveLength(4);
    const originalIds = Object.keys(report.transforms);
    for (const [i, id] of originalIds.entries()) {
      report.transforms[id].position.forEach((v, k) =>
        expect(imported[i].transform.position[k]).toBeCloseTo(v, 4),
      );
      report.transforms[id].basis.forEach((v, k) =>
        expect(imported[i].transform.basis[k]).toBeCloseTo(v, 6),
      );
    }
    expect(JSON.stringify(f.project)).toBe(f.source);
  });
  it("rejects incompatible scalar motors, invalid stop ranges and non-bearing stop metadata", async () => {
    const f = await fixture(),
      reject = (edit: (r: MotionRig) => void) => {
        const r = structuredClone(f.definition);
        edit(r);
        expect(() => validateRig(f.project, r)).toThrow();
      };
    reject((r) => {
      r.joints[0].limits = [-10, 10];
    });
    reject((r) => {
      r.joints[0].motor = {
        mode: "velocity",
        target: 10,
        maxEffort: { value: 1, unit: "N*m" },
      };
    });
    reject((r) => {
      r.joints[0].translationLimitsLdu = [1, 20];
    });
    reject((r) => {
      r.joints[0].translationLimitsLdu = [-10001, 20];
    });
    reject((r) => {
      r.joints[0].axisB = [0, 1, 0];
    });
    reject((r) => {
      r.joints[0].kind = "revolute";
    });
    reject((r) => {
      r.joints[0].translationLimitsLdu = null as unknown as [number, number];
    });
  });
});
