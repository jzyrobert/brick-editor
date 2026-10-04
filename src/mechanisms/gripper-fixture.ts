import { occurrences } from "../core/document";
import { compose, identity } from "../core/math";
import type { Transform, Vec3 } from "../core/types";
import { importLDraw } from "../ldraw/io";
import type { MotionRig } from "./types";

/** Original CC0 lift/grasp bench. Payload is a separate loose Dynamic rig; no
 * LEGO purchasing identity or automatic claw/socket recognition is claimed. */
export function gripperFixture(
  pose: Transform = identity(),
  payloadMassKg = 1,
  effortN = 1000,
) {
  const lines = [
    "0 FILE gripper.ldr",
    "0 Original CC0-1.0 reversible gripper lift",
    "0 !LICENSE CC0-1.0",
    "0 !COLOUR Grey CODE 7 VALUE #888888 EDGE #333333",
    "0 !COLOUR Yellow CODE 14 VALUE #F2CD37 EDGE #333333",
    "0 !COLOUR Blue CODE 1 VALUE #0055BF EDGE #333333",
    "1 7 -40 -100 0 1 0 0 0 1 0 0 0 1 grip-post.dat",
    "1 14 0 -100 0 1 0 0 0 1 0 0 0 1 grip-head.dat",
    "1 1 0 -76 0 1 0 0 0 1 0 0 0 1 grip-crate.dat",
    "1 7 0 -66 0 1 0 0 0 1 0 0 0 1 grip-table.dat",
    "1 14 0 -112 40 1 0 0 0 1 0 0 0 1 grip-carriage.dat",
  ];
  const box = (name: string, a: Vec3, b: Vec3) => {
    lines.push(
      `0 FILE ${name}`,
      "0 !LDRAW_ORG Unofficial_Part",
      "0 !LICENSE CC0-1.0",
      "0 BFC CERTIFY CCW",
    );
    const p = [
      [a[0], a[1], a[2]],
      [b[0], a[1], a[2]],
      [b[0], b[1], a[2]],
      [a[0], b[1], a[2]],
      [a[0], a[1], b[2]],
      [b[0], a[1], b[2]],
      [b[0], b[1], b[2]],
      [a[0], b[1], b[2]],
    ];
    for (const f of [
      [0, 3, 2, 1],
      [4, 5, 6, 7],
      [0, 1, 5, 4],
      [3, 7, 6, 2],
      [0, 4, 7, 3],
      [1, 2, 6, 5],
    ])
      lines.push(`4 16 ${f.flatMap((i) => p[i]).join(" ")}`);
  };
  box("grip-post.dat", [-3, -90, -4], [3, 10, 4]);
  box("grip-head.dat", [-12, -5, -8], [12, 5, 8]);
  box("grip-crate.dat", [-36, -8, -24], [36, 8, 24]);
  box("grip-table.dat", [-20, -2, -12], [20, 2, 12]);
  box("grip-carriage.dat", [-8, -3, -8], [8, 3, 8]);
  lines.push("0 NOFILE");
  const text = lines.join("\n") + "\n",
    project = importLDraw(text);
  for (const node of project.models[project.rootModelId].nodes)
    node.transform = compose(pose, node.transform);
  const all = occurrences(project),
    group = (i: number, id: string) => ({
      id,
      occurrenceIds: [all[i].id],
      frame: structuredClone(all[i].transform),
      restTransforms: { [all[i].id]: structuredClone(all[i].transform) },
    });
  const crane: MotionRig = {
    schemaVersion: 1,
    id: "crane",
    name: "Gripper lift",
    mode: "kinematic",
    groups: [
      (() => {
        const post = group(0, "post");
        post.occurrenceIds.push(all[3].id);
        post.restTransforms[all[3].id] = structuredClone(all[3].transform);
        return post;
      })(),
      group(4, "carriage"),
      group(1, "head"),
    ],
    joints: [
      {
        id: "carry",
        kind: "prismatic",
        bodyA: "post",
        bodyB: "carriage",
        anchorA: [40, -12, 40],
        anchorB: [0, 0, 0],
        axisA: [1, 0, 0],
        axisB: [1, 0, 0],
        limits: [0, 80],
        motor: {
          mode: "position",
          target: 0,
          maxEffort: { value: effortN, unit: "N" },
        },
      },
      {
        id: "lift",
        kind: "prismatic",
        bodyA: "carriage",
        bodyB: "head",
        anchorA: [0, 12, -40],
        anchorB: [0, 0, 0],
        axisA: [0, -1, 0],
        axisB: [0, -1, 0],
        limits: [0, 80],
        motor: {
          mode: "position",
          target: 0,
          maxEffort: { value: effortN, unit: "N" },
        },
      },
    ],
    grippers: [
      {
        id: "claw",
        groupId: "head",
        anchor: [0, 20, 0],
        captureRadiusLdu: 12,
        maxPayloadMassKg: 100,
      },
    ],
    dynamics: {
      startDynamic: true,
      groups: {
        post: { anchored: true },
        carriage: { massKg: 1 },
        head: { massKg: 1 },
      },
    },
  };
  const cargo: MotionRig = {
    schemaVersion: 1,
    id: "cargo",
    name: "Loose cargo",
    mode: "kinematic",
    groups: [group(2, "crate")],
    joints: [],
    dynamics: { groups: { crate: { anchored: false, massKg: payloadMassKg } } },
  };
  project.motionRigs = { crane, cargo };
  return { project, crane, cargo, text };
}
