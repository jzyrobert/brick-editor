import { occurrences } from "../core/document";
import { compose, identity } from "../core/math";
import type { Transform, Vec3 } from "../core/types";
import { importLDraw } from "../ldraw/io";
import { axisRotation } from "./kinematic";
import { proposeMechanicalRig } from "./mechanical-proposals";

/** Original CC0 arrangement: two retained shafts, an 8:24 mesh and a pin arm.
 * Official geometry stays in the pinned library, with its original headers. */
export function technicFixture() {
  const pose = (position: Vec3 = [0, 0, 0], angle = 0): Transform => ({
    position,
    basis: axisRotation([0, 0, 1], angle),
  });
  const row = (ref: string, t = identity()) => {
    // Keep every moving part above Play's default ground, including the arm.
    const world = compose({ ...identity(), position: [0, -80, 0] }, t);
    return `1 7 ${[...world.position, ...world.basis].join(" ")} ${ref}`;
  };
  const shaft = (x: number, phase = 0) =>
    compose(pose([x, 0, 0], phase), {
      position: [0, 0, 0],
      basis: axisRotation([0, 1, 0], -90),
    });
  const project = importLDraw(
    [
      "0 Original CC0-1.0 Technic motion acceptance arrangement",
      row("3701.dat", pose([20, -10, -20])),
      row("3701.dat", pose([20, -10, 20])),
      row("3705.dat", shaft(0)),
      row("3647.dat"),
      row("4265a.dat", pose([0, 0, -35])),
      row("4265a.dat", pose([0, 0, 35])),
      row("3705.dat", shaft(40, 7.5)),
      row("3648b.dat", pose([40, 0, 0], 7.5)),
      row("4265a.dat", pose([40, 0, -35], 7.5)),
      row("4265a.dat", pose([40, 0, 35], 7.5)),
      row("3700.dat", pose([120, -10, -10])),
      row("3673.dat", shaft(120)),
      row("3701.dat", pose([140, -10, 10])),
    ].join("\n"),
  );
  const all = occurrences(project);
  const proposal = proposeMechanicalRig(project, {
    id: "technic-drive",
    name: "Technic 8:24 drive and pin arm",
    expectedRevision: project.revision,
    frameOccurrenceIds: [0, 1, 10].map((i) => all[i].id),
    motors: {
      [all[2].id]: {
        mode: "velocity",
        target: 90,
        maxEffort: { value: 50, unit: "N*m" },
      },
    },
  });
  project.motionRigs[proposal.rig!.id] = proposal.rig!;
  return { project, proposal };
}
