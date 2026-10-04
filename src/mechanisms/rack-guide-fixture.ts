import { occurrences } from "../core/document";
import { compose, identity } from "../core/math";
import type { Transform, Vec3 } from "../core/types";
import { importLDraw } from "../ldraw/io";
import { proposeMechanicalRig } from "./mechanical-proposals";

/** Original CC0 arrangement of the actual nested outrigger housing and rack.
 * The source guide supplies manual travel; no unattached pinion or motor. */
export function manualRackFixture(worldPose: Transform = identity()) {
  const row = (ref: string, position: Vec3) => {
    const w = compose(worldPose, { ...identity(), position });
    return `1 7 ${[...w.position, ...w.basis].join(" ")} ${ref}`;
  };
  const project = importLDraw(
    [
      "0 Original CC0-1.0 manually guided Technic outrigger rack",
      row("18940.dat", [0, -9, 0]),
      row("18942.dat", [-40, -29, 0]),
    ].join("\n"),
  );
  const all = occurrences(project);
  const proposal = proposeMechanicalRig(project, {
    id: "rack-drive",
    name: "Rack guide",
    expectedRevision: project.revision,
    frameOccurrenceIds: [all[0].id],
  });
  if (proposal.rig) project.motionRigs[proposal.rig.id] = proposal.rig;
  return { project, proposal };
}
