import { occurrences } from "../core/document";
import { compose, identity } from "../core/math";
import type { Transform, Vec3 } from "../core/types";
import { importLDraw } from "../ldraw/io";
import { axisRotation } from "./kinematic";
import { proposeMechanicalRig } from "./mechanical-proposals";
import type { MotorBinding } from "./motor-binding";

/** Original CC0 physical PF-M mount and retained 8:24 gearbox. Every visible
 * member is an actual official part; the motor casing stays on the frame. */
export function physicalMotorFixture(worldPose: Transform = identity()) {
  const pose = (position: Vec3, angle = 0): Transform => ({
      position,
      basis: axisRotation([0, 0, 1], angle),
    }),
    shaft = (x: number, phase = 0) =>
      compose(pose([x, -80, 0], phase), {
        ...identity(),
        basis: axisRotation([0, 1, 0], -90),
      }),
    row = (ref: string, t: Transform, color = 7) => {
      const w = compose(
        worldPose,
        compose({ ...identity(), position: [0, 34, 0] }, t),
      );
      return `1 ${color} ${[...w.position, ...w.basis].join(" ")} ${ref}`;
    };
  const text =
      [
        "0 Original CC0-1.0 physically mounted Power Functions M motor and 8:24 gears",
        "0 !LICENSE CC0-1.0",
        row("3701.dat", pose([20, -90, -20])),
        row("3701.dat", pose([20, -90, 20])),
        row("3706.dat", shaft(0), 4),
        row("3647.dat", pose([0, -80, 0]), 4),
        row("4265a.dat", pose([0, -80, -35])),
        row("4265a.dat", pose([0, -80, 35])),
        row("3705.dat", shaft(40, 7.5), 1),
        row("3648b.dat", pose([40, -80, 0], 7.5), 1),
        row("4265a.dat", pose([40, -80, -35], 7.5)),
        row("4265a.dat", pose([40, -80, 35], 7.5)),
        row("58120.dat", pose([0, -80, 50]), 72),
        row("3795.dat", {
          position: [0, -50, 110],
          basis: axisRotation([0, 1, 0], 90),
        }),
        row(
          "3030.dat",
          { position: [20, -42, 70], basis: axisRotation([0, 1, 0], 90) },
          14,
        ),
        row("3010.dat", pose([20, -66, -20])),
        row("3010.dat", pose([20, -66, 20])),
      ].join("\n") + "\n",
    project = importLDraw(text, "motor-gears.mpd"),
    all = occurrences(project),
    binding: MotorBinding = {
      occurrenceId: all[10].id,
      profile: "power-functions-motor-m-v1",
    };
  const proposal = proposeMechanicalRig(project, {
    id: "technic-drive",
    name: "Power Functions motor & gears",
    expectedRevision: project.revision,
    frameOccurrenceIds: [0, 1, 10, 11, 12, 13, 14].map((i) => all[i].id),
    motors: {
      [all[2].id]: {
        mode: "velocity",
        target: 90,
        maxEffort: { value: 50, unit: "N*m" },
        binding,
      },
    },
  });
  if (proposal.rig) project.motionRigs[proposal.rig.id] = proposal.rig;
  return { project, proposal, binding, text };
}
