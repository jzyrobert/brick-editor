import { occurrences } from "../core/document";
import { compose, identity } from "../core/math";
import type { Transform, Vec3 } from "../core/types";
import { importLDraw } from "../ldraw/io";
import { axisRotation } from "./kinematic";
import { proposeMechanicalRig } from "./mechanical-proposals";

/** Original CC0 rack acceptance arrangement. Library geometry is referenced,
 * never copied: a retained 8-tooth pinion drives the reviewed outrigger rack. */
export function rackFixture() {
  const pose = (position: Vec3): Transform => ({ ...identity(), position });
  const row = (ref: string, t: Transform) => {
    const w = compose(pose([0, -160, 0]), t);
    return `1 7 ${[...w.position, ...w.basis].join(" ")} ${ref}`;
  };
  const project = importLDraw(
    [
      "0 Original CC0-1.0 guided Technic rack acceptance arrangement",
      row("18940.dat", identity()),
      row("3701.dat", pose([24, -51, -20])),
      row("3701.dat", pose([24, -51, 20])),
      row("3705.dat", {
        position: [4, -41, 0],
        basis: axisRotation([0, 1, 0], -90),
      }),
      row("3647.dat", pose([4, -41, 0])),
      row("4265a.dat", pose([4, -41, -35])),
      row("4265a.dat", pose([4, -41, 35])),
      row("18942.dat", pose([0, -6, 0])),
    ].join("\n"),
  );
  const all = occurrences(project);
  const proposal = proposeMechanicalRig(project, {
    id: "rack-drive",
    name: "Guided Technic rack drive",
    expectedRevision: project.revision,
    frameOccurrenceIds: [0, 1, 2].map((i) => all[i].id),
    motors: {
      [all[3].id]: {
        mode: "velocity",
        target: 90,
        maxEffort: { value: 50, unit: "N*m" },
      },
    },
  });
  if (proposal.rig) project.motionRigs[proposal.rig.id] = proposal.rig;
  return { project, proposal };
}
