import { occurrences } from "../core/document";
import { compose, identity } from "../core/math";
import type { Transform, Vec3 } from "../core/types";
import { importLDraw } from "../ldraw/io";
import type { JointSpec, MotionRig, PlanarLoopClosure } from "./types";

/** Original CC0 bench mechanism: a bell crank, two tie rods and wheel knuckles.
 * These are explicit linkage geometry, not certified LEGO parts or vehicle tires.
 * Separate Z layers leave all ordinary contacts enabled. Bearings bridge layers.
 */
export function steeringFixture(
  pose: Transform = identity(),
  coldToggle = false,
) {
  const names = [
      "frame",
      "input",
      "leftTie",
      "leftSteer",
      "rightTie",
      "rightSteer",
    ],
    centers: Vec3[] = [
      [0, -120, -24],
      [0, -120, -12],
      [-20, -140, 0],
      [-100, -120, 12],
      [20, -140, 0],
      [100, -120, 12],
    ],
    leftEnd: Vec3 = coldToggle ? [40, -10, 0] : [20, -40, 0],
    rightEnd: Vec3 = [-leftEnd[0], leftEnd[1], 0],
    rodEnd: Vec3 = [leftEnd[0] - 80, leftEnd[1] + 20, 0],
    source = [
      "0 FILE steering.ldr",
      "0 Original CC0-1.0 twin-loop steering linkage",
      "0 !LICENSE CC0-1.0",
      "0 !COLOUR White CODE 15 VALUE #FFFFFF EDGE #333333",
      "0 !COLOUR Red CODE 4 VALUE #C91A09 EDGE #333333",
      "0 !COLOUR Yellow CODE 14 VALUE #F2CD37 EDGE #333333",
      "0 !COLOUR Blue CODE 1 VALUE #0055BF EDGE #333333",
      "0 !COLOUR Black CODE 0 VALUE #05131D EDGE #333333",
    ];
  centers.forEach((p, i) =>
    source.push(
      `1 ${[15, 4, 14, 1, 14, 1][i]} ${p.join(" ")} 1 0 0 0 1 0 0 0 1 steering-${names[i]}.dat`,
    ),
  );
  for (const i of [3, 5])
    source.push(
      `1 0 ${centers[i].join(" ")} 1 0 0 0 1 0 0 0 1 steering-wheel.dat`,
    );
  const part = (name: string, polygon: number[][], halfDepth = 2) => {
    source.push(
      `0 FILE steering-${name}.dat`,
      "0 !LDRAW_ORG Unofficial_Part",
      "0 !LICENSE CC0-1.0",
      "0 BFC CERTIFY CCW",
    );
    // Polygon is counterclockwise in XY; opposite cap winding closes the prism.
    source.push(
      `4 16 ${[...polygon]
        .reverse()
        .flatMap(([x, y]) => [x, y, -halfDepth])
        .join(" ")}`,
      `4 16 ${polygon.flatMap(([x, y]) => [x, y, halfDepth]).join(" ")}`,
    );
    polygon.forEach(([x, y], k) => {
      const [a, b] = polygon[(k + 1) % polygon.length];
      source.push(
        `4 16 ${[x, y, -halfDepth, a, b, -halfDepth, a, b, halfDepth, x, y, halfDepth].join(" ")}`,
      );
    });
  };
  const bar = (name: string, end: Vec3) => {
    const length = Math.hypot(end[0], end[1]),
      dx = (-end[1] * 2) / length,
      dy = (end[0] * 2) / length;
    part(name, [
      [-dx, -dy],
      [end[0] - dx, end[1] - dy],
      [end[0] + dx, end[1] + dy],
      [dx, dy],
    ]);
  };
  part("frame", [
    [-104, -3],
    [104, -3],
    [104, 3],
    [-104, 3],
  ]);
  part("input", [
    [-22, -22],
    [22, -22],
    [22, 2],
    [-22, 2],
  ]);
  bar("leftTie", rodEnd);
  bar("rightTie", [-rodEnd[0], rodEnd[1], 0]);
  bar("leftSteer", leftEnd);
  bar("rightSteer", rightEnd);
  part(
    "wheel",
    [
      [-8, 6],
      [8, 6],
      [8, 30],
      [-8, 30],
    ],
    4,
  );
  source.push("0 NOFILE");
  const text = source.join("\n") + "\n",
    project = importLDraw(text);
  for (const node of project.models[project.rootModelId].nodes)
    node.transform = compose(pose, node.transform);
  const all = occurrences(project),
    groups = names.map((id, i) => {
      const members = [
        all[i],
        ...(i === 3 ? [all[6]] : i === 5 ? [all[7]] : []),
      ];
      return {
        id,
        occurrenceIds: members.map((o) => o.id),
        frame: structuredClone(all[i].transform),
        restTransforms: Object.fromEntries(
          members.map((o) => [o.id, structuredClone(o.transform)]),
        ),
      };
    });
  const hinge = (
    id: string,
    bodyA: string,
    bodyB: string,
    a: Vec3,
    b: Vec3,
  ): JointSpec => ({
    id,
    kind: "revolute",
    bodyA,
    bodyB,
    anchorA: [a[0], a[1], 0 - centers[names.indexOf(bodyA)][2]],
    anchorB: [b[0], b[1], 0 - centers[names.indexOf(bodyB)][2]],
    axisA: [0, 0, 1],
    axisB: [0, 0, 1],
  });
  const drive = hinge("drive", "frame", "input", [0, 0, 0], [0, 0, 0]);
  drive.limits = [-25, 25];
  drive.motor = {
    mode: "position",
    target: 0,
    maxEffort: { value: 100, unit: "N*m" },
  };
  const joints = [
    drive,
    hinge("leftTie", "input", "leftTie", [-20, -20, 0], [0, 0, 0]),
    hinge("leftSteer", "frame", "leftSteer", [-100, 0, 0], [0, 0, 0]),
    hinge("rightTie", "input", "rightTie", [20, -20, 0], [0, 0, 0]),
    hinge("rightSteer", "frame", "rightSteer", [100, 0, 0], [0, 0, 0]),
  ];
  for (const j of joints.slice(1)) j.limits = [-50, 50];
  const closures: PlanarLoopClosure[] = [
    {
      ...hinge("leftClosure", "leftTie", "leftSteer", rodEnd, leftEnd),
      kind: "revolute",
      axisA: [0, 0, 1],
      axisB: [0, 0, 1],
      dependentJointIds: ["leftTie", "leftSteer"],
    },
    {
      ...hinge(
        "rightClosure",
        "rightTie",
        "rightSteer",
        [-rodEnd[0], rodEnd[1], 0],
        rightEnd,
      ),
      kind: "revolute",
      axisA: [0, 0, 1],
      axisB: [0, 0, 1],
      dependentJointIds: ["rightTie", "rightSteer"],
    },
  ];
  const rig: MotionRig = {
    schemaVersion: 1,
    id: "steering",
    name: "Twin-loop steering",
    mode: "kinematic",
    groups,
    joints,
    loopClosures: closures,
    dynamics: {
      groups: Object.fromEntries(
        names.map((id) => [
          id,
          id === "frame" ? { anchored: true } : { massKg: 1 },
        ]),
      ),
    },
  };
  project.motionRigs = { [rig.id]: rig };
  return { project, rig, text };
}
