import { occurrences } from "../core/document";
import { identity, compose } from "../core/math";
import type { Transform, Vec3 } from "../core/types";
import { importLDraw } from "../ldraw/io";
import type { JointSpec, MotionRig } from "./types";

/** Original CC0 linkage geometry, independent of library/network availability. */
export function loopFixture(
  kind: "four-bar" | "slider-crank" = "four-bar",
  pose: Transform = identity(),
) {
  const points: Vec3[] =
    kind === "four-bar"
      ? [
          [0, -100, 0],
          [0, -100, 0],
          [0, -140, 0],
          [100, -140, 0],
        ]
      : [
          [0, -100, 0],
          [0, -100, 0],
          [20, -120, 0],
          [80, -100, 0],
        ];
  const sizes: Array<[Vec3, Vec3]> =
    kind === "four-bar"
      ? [
          [
            [-4, -4, -4],
            [104, 4, 4],
          ],
          [
            [-3, -40, -3],
            [3, 0, 3],
          ],
          [
            [0, -3, -3],
            [100, 3, 3],
          ],
          [
            [-3, 0, -3],
            [3, 40, 3],
          ],
        ]
      : [
          [
            [-4, -4, -4],
            [104, 4, 4],
          ],
          [
            [0, -20, -3],
            [20, 0, 3],
          ],
          [
            [0, 0, -3],
            [60, 20, 3],
          ],
          [
            [-5, -5, -5],
            [5, 5, 5],
          ],
        ];
  const source = [
    "0 FILE linkage.ldr",
    "0 Original CC0-1.0 closed linkage",
    "0 !LICENSE CC0-1.0",
    "0 !COLOUR White CODE 15 VALUE #FFFFFF EDGE #333333",
    "0 !COLOUR Red CODE 4 VALUE #C91A09 EDGE #333333",
    "0 !COLOUR Yellow CODE 14 VALUE #F2CD37 EDGE #333333",
    "0 !COLOUR Blue CODE 1 VALUE #0055BF EDGE #333333",
    ...points.map(
      (p, i) =>
        `1 ${[15, 4, 14, 1][i]} ${p.join(" ")} 1 0 0 0 1 0 0 0 1 link${i}.dat`,
    ),
  ];
  sizes.forEach(([a, b], i) => {
    source.push(
      `0 FILE link${i}.dat`,
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
      source.push(`4 16 ${f.flatMap((k) => p[k]).join(" ")}`);
  });
  const project = importLDraw(source.join("\n") + "\n");
  for (const node of project.models[project.rootModelId].nodes)
    node.transform = compose(pose, node.transform);
  const all = occurrences(project),
    names = ["frame", "input", "rod", "output"];
  const groups = all.map((o, i) => ({
    id: names[i],
    occurrenceIds: [o.id],
    frame: structuredClone(o.transform),
    restTransforms: { [o.id]: structuredClone(o.transform) },
  }));
  const hinge = (
    id: string,
    bodyA: string,
    bodyB: string,
    anchorA: Vec3,
    anchorB: Vec3,
  ): JointSpec => ({
    id,
    kind: "revolute",
    bodyA,
    bodyB,
    anchorA,
    anchorB,
    axisA: [0, 0, 1],
    axisB: [0, 0, 1],
  });
  const joints: JointSpec[] =
    kind === "four-bar"
      ? [
          hinge("drive", "frame", "input", [0, 0, 0], [0, 0, 0]),
          hinge("rod", "input", "rod", [0, -40, 0], [0, 0, 0]),
          hinge("output", "rod", "output", [100, 0, 0], [0, 0, 0]),
        ]
      : [
          hinge("drive", "frame", "input", [0, 0, 0], [0, 0, 0]),
          hinge("rod", "input", "rod", [20, -20, 0], [0, 0, 0]),
          {
            id: "output",
            kind: "prismatic",
            bodyA: "frame",
            bodyB: "output",
            anchorA: [80, 0, 0],
            anchorB: [0, 0, 0],
            axisA: [1, 0, 0],
            axisB: [1, 0, 0],
            limits: [-70, 20],
          },
        ];
  joints[0].motor = {
    mode: "velocity",
    target: 30,
    maxEffort: { value: 100, unit: "N*m" },
  };
  const rig: MotionRig = {
    schemaVersion: 1,
    id: kind,
    name: kind === "four-bar" ? "Closed four-bar" : "Closed slider-crank",
    mode: "kinematic",
    groups,
    joints,
    loopClosures: [
      {
        ...hinge(
          "closure",
          kind === "four-bar" ? "frame" : "rod",
          "output",
          kind === "four-bar" ? [100, 0, 0] : [60, 20, 0],
          kind === "four-bar" ? [0, 40, 0] : [0, 0, 0],
        ),
        kind: "revolute",
        axisA: [0, 0, 1],
        axisB: [0, 0, 1],
        dependentJointIds: ["rod", "output"],
      },
    ],
    dynamics: {
      groups: {
        frame: { anchored: true },
        input: { massKg: 1 },
        rod: { massKg: 1 },
        output: { massKg: 1 },
      },
    },
  };
  project.motionRigs = { [kind]: rig };
  return { project, rig };
}
