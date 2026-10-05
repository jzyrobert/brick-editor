import { occurrences } from "../core/document";
import { compose, identity } from "../core/math";
import type { Transform, Vec3 } from "../core/types";
import { importLDraw } from "../ldraw/io";
import { axisRotation } from "./kinematic";
import type { MotionRig } from "./types";
import { PF_LARGE_MOTOR_PROFILE } from "./pf-large-motor-binding";

/** Original CC0 PF-L test assembly: two actual opposed pin seats secure the
 * source case to a stud-connected brick frame; two actual collars capture its
 * output axle at the rear bearing. No anonymous rotor/case geometry is added. */
export function physicalPfLargeMotorFixture(
  worldPose: Transform = identity(),
  phaseDegrees = 0,
) {
  const origin: Transform = {
    ...worldPose,
    position: compose(worldPose, { ...identity(), position: [0, -70, 0] })
      .position,
  };
  const pose = (position: Vec3, basis = identity().basis): Transform =>
    compose(origin, { position, basis });
  const shaftBasis = compose(
    { ...identity(), basis: axisRotation([0, 0, 1], phaseDegrees) },
    { ...identity(), basis: axisRotation([0, 1, 0], -90) },
  ).basis;
  const rows: [string, Transform, number][] = [
    ["99499.dat", pose([0, 0, 0]), 72],
    ["3701.dat", pose([0, -10, -10]), 7],
    ["3700.dat", pose([0, -10, -50]), 7],
    ["3010.dat", pose([0, 14, -10]), 7],
    ["3010.dat", pose([0, 38, -10]), 7],
    ["3010.dat", pose([0, 14, -50]), 7],
    ["3010.dat", pose([0, 38, -50]), 7],
    ["3035.dat", pose([0, 62, -20]), 14],
    ["2780.dat", pose([-20, 0, 0], axisRotation([0, 1, 0], -90)), 0],
    ["2780.dat", pose([20, 0, 0], axisRotation([0, 1, 0], -90)), 0],
    ["3707.dat", pose([0, 0, -60], shaftBasis), 4],
    ["4265a.dat", pose([0, 0, -65], axisRotation([0, 0, 1], phaseDegrees)), 7],
    ["4265a.dat", pose([0, 0, -35], axisRotation([0, 0, 1], phaseDegrees)), 7],
  ];
  const text =
    [
      "0 Original CC0-1.0 pin-mounted PF-L case and retained output axle",
      "0 !LICENSE CC0-1.0",
      ...rows.map(
        ([ref, t, colour]) =>
          `1 ${colour} ${[...t.position, ...t.basis].join(" ")} ${ref}`,
      ),
    ].join("\n") + "\n";
  const project = importLDraw(text),
    all = occurrences(project),
    group = (id: string, indexes: number[]) => ({
      id,
      occurrenceIds: indexes.map((i) => all[i].id),
      frame: origin,
      restTransforms: Object.fromEntries(
        indexes.map((i) => [all[i].id, structuredClone(all[i].transform)]),
      ),
    });
  const rig: MotionRig = {
    schemaVersion: 1,
    id: "pf-large-drive",
    name: "Pin-mounted Power Functions L motor",
    mode: "kinematic",
    groups: [
      group("carrier", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]),
      group("output", [10, 11, 12]),
    ],
    joints: [
      {
        id: "motor-output",
        kind: "revolute",
        bodyA: "carrier",
        bodyB: "output",
        anchorA: [0, 0, 0],
        anchorB: [0, 0, 0],
        axisA: [0, 0, 1],
        axisB: [0, 0, 1],
        motor: {
          mode: "velocity",
          target: 90,
          // Simulation cap for the source bench, not measured motor torque.
          maxEffort: { value: 20, unit: "N*m" },
          binding: { occurrenceId: all[0].id, profile: PF_LARGE_MOTOR_PROFILE },
        },
      },
    ],
  };
  project.motionRigs[rig.id] = rig;
  return { project, rig, all, text };
}
