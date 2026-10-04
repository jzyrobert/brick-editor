import { occurrences } from "../core/document";
import { compose, identity } from "../core/math";
import type { Transform, Vec3 } from "../core/types";
import { importLDraw } from "../ldraw/io";
import { axisRotation } from "./kinematic";
import { proposeMechanicalRig } from "./mechanical-proposals";

/** Original CC0 twin drive table: a three-shaft reduction and a separate
 * direct drive share a real stud-connected frame and two mounted PF-M motors.
 * Each source gear is captured between the actual bearing mouths. */
export function twinDriveFixture(worldPose: Transform = identity()) {
  const frame: number[] = [],
    inputs: number[] = [],
    motors: number[] = [],
    lines = [
      "0 Original CC0-1.0 twin Power Functions drive table",
      "0 !LICENSE CC0-1.0",
    ];
  let count = 0;
  const pose = (position: Vec3, phase = 0): Transform => ({
      position,
      basis: axisRotation([0, 0, 1], phase),
    }),
    place = (ref: string, t: Transform, color = 7, fixed = false) => {
      const index = count++,
        w = compose(worldPose, t);
      lines.push(`1 ${color} ${[...w.position, ...w.basis].join(" ")} ${ref}`);
      if (fixed) frame.push(index);
      return index;
    },
    shaft = (x: number, phase: number, powered: boolean) => {
      const index = place(
        powered ? "3706.dat" : "3705.dat",
        compose(pose([x, -54, 0], phase), {
          ...identity(),
          basis: axisRotation([0, 1, 0], -90),
        }),
        x < 100 ? 4 : 1,
      );
      if (powered) inputs.push(index);
      place(
        x === 60 ? "3648b.dat" : "3647.dat",
        pose([x, -54, 0], phase),
        x < 100 ? 4 : 1,
      );
      for (const z of [-35, 35]) place("4265a.dat", pose([x, -54, z], phase));
    };
  // Common plate carries both lane bases on its real top studs. All bases,
  // bearing supports and motor feet remain at ordinary plate/brick heights.
  place(
    "3027.dat",
    {
      position: [100, -8, 50],
      basis: axisRotation([0, 1, 0], 90),
    },
    14,
    true,
  );
  for (const offset of [0, 160]) {
    const center = offset + 20;
    place(
      "3030.dat",
      {
        position: [center, -16, 70],
        basis: axisRotation([0, 1, 0], 90),
      },
      14,
      true,
    );
    for (const z of [-20, 20]) {
      place("3010.dat", pose([center, -40, z]), 7, true);
      place(
        offset === 0 ? "3702.dat" : "3701.dat",
        pose([center, -64, z]),
        7,
        true,
      );
    }
    shaft(offset, 0, true);
    shaft(offset + 20, 22.5, false);
    if (offset === 0) shaft(60, 0, false);
    motors.push(place("58120.dat", pose([offset, -54, 50]), 72, true));
    place(
      "3795.dat",
      {
        position: [offset, -24, 110],
        basis: axisRotation([0, 1, 0], 90),
      },
      7,
      true,
    );
  }
  const text = lines.join("\n") + "\n",
    project = importLDraw(text, "twin-drive.mpd"),
    all = occurrences(project),
    proposal = proposeMechanicalRig(project, {
      id: "twin-drive",
      name: "Twin motor table",
      expectedRevision: project.revision,
      frameOccurrenceIds: frame.map((i) => all[i].id),
      motors: Object.fromEntries(
        inputs.map((index, lane) => [
          all[index].id,
          {
            mode: "velocity" as const,
            target: 90,
            maxEffort: { value: 50, unit: "N*m" as const },
            binding: {
              occurrenceId: all[motors[lane]].id,
              profile: "power-functions-motor-m-v1" as const,
            },
          },
        ]),
      ),
    });
  if (proposal.rig) project.motionRigs[proposal.rig.id] = proposal.rig;
  return {
    project,
    proposal,
    text,
    inputOccurrenceIds: inputs.map((i) => all[i].id),
  };
}
