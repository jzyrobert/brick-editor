import { importLDraw } from "../ldraw/io";
import { occurrences } from "../core/document";
import type { Project, Vec3 } from "../core/types";
import type { MotionRig, RigidGroup } from "./types";
/** Original CC0 demonstration geometry; custom parts have no marketplace mapping. */
export function mechanismFixtureSource(openBench = false) {
  const out = [
    "0 FILE mechanisms.ldr",
    "0 Original CC0-1.0 hinged door and planar vehicle test",
    "0 !LICENSE CC0-1.0",
    "1 15 0 0 0 1 0 0 0 1 0 0 0 1 frame.dat",
    "1 4 20 -48 0 1 0 0 0 1 0 0 0 1 door.dat",
    "1 1 0 -24 -200 1 0 0 0 1 0 0 0 1 chassis.dat",
  ];
  for (const x of [-40, 40])
    for (const z of [-220, -180])
      out.push(`1 0 ${x} -12 ${z} 1 0 0 0 1 0 0 0 1 wheel.dat`);
  const begin = (name: string) =>
    out.push(
      `0 FILE ${name}`,
      "0 !LDRAW_ORG Unofficial_Part",
      "0 !LICENSE CC0-1.0",
      "0 BFC CERTIFY CCW",
    );
  const box = (a: Vec3, b: Vec3) => {
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
      out.push(`4 16 ${f.flatMap((i) => p[i]).join(" ")}`);
  };
  begin("frame.dat");
  box([-8, -104, -4], [0, 0, 4]);
  box([40, -104, -4], [48, 0, 4]);
  box([0, -104, -4], [40, -96, 4]);
  begin("door.dat");
  box([-20, -48, -2], [20, 48, 2]);
  begin("chassis.dat");
  box([-36, -8, -32], [36, 8, 32]);
  if (openBench) {
    // Original open seat: cushion below pelvis, backrest behind straight legs.
    box([-14, -13, 13], [14, -8, 24]);
    box([-20, -46, 34], [20, -8, 38]);
  }
  begin("wheel.dat");
  for (let i = 0; i < 16; i++) {
    const a = (i * Math.PI) / 8,
      b = ((i + 1) * Math.PI) / 8,
      y1 = 12 * Math.cos(a),
      z1 = 12 * Math.sin(a),
      y2 = 12 * Math.cos(b),
      z2 = 12 * Math.sin(b);
    out.push(
      `4 16 -4 ${y1} ${z1} 4 ${y1} ${z1} 4 ${y2} ${z2} -4 ${y2} ${z2}`,
      `3 16 -4 0 0 -4 ${y1} ${z1} -4 ${y2} ${z2}`,
      `3 16 4 0 0 4 ${y2} ${z2} 4 ${y1} ${z1}`,
    );
  }
  return out.join("\n") + "\n0 NOFILE\n";
}
export function mechanismFixture(openBench = false): Project {
  const project = importLDraw(
    mechanismFixtureSource(openBench),
    "mechanisms.mpd",
  );
  project.title = "Door and kinematic vehicle";
  const all = occurrences(project);
  const group = (id: string, index: number): RigidGroup => ({
    id,
    occurrenceIds: [all[index].id],
    frame: structuredClone(all[index].transform),
    restTransforms: { [all[index].id]: structuredClone(all[index].transform) },
  });
  const door: MotionRig = {
    schemaVersion: 1,
    id: "door",
    name: "Original hinged door",
    mode: "kinematic",
    groups: [group("frame", 0), group("door", 1)],
    joints: [
      {
        id: "hinge",
        kind: "revolute",
        bodyA: "frame",
        bodyB: "door",
        anchorA: [0, -48, 0],
        anchorB: [-20, 0, 0],
        axisA: [0, 1, 0],
        axisB: [0, 1, 0],
        limits: [0, 110],
      },
    ],
  };
  const vehicle: MotionRig = {
    schemaVersion: 1,
    id: "vehicle",
    name: "Original planar car",
    mode: "kinematic",
    groups: [
      group("chassis", 2),
      ...["left-front", "left-back", "right-front", "right-back"].map((id, i) =>
        group(id, i + 3),
      ),
    ],
    joints: [],
    vehicle: {
      chassisGroup: "chassis",
      wheelbase: 40,
      maxSpeed: 100,
      maxSteerDegrees: 35,
      wheels: ["left-front", "left-back", "right-front", "right-back"].map(
        (id) => ({
          groupId: id,
          axis: [1, 0, 0],
          radius: 12,
          steering: id.endsWith("front"),
        }),
      ),
    },
  };
  project.motionRigs = { door, vehicle };
  return project;
}

/** Original CC0 open-bench example. Existing mechanism template remains seat-free. */
export function openBenchFixture(): Project {
  const project = mechanismFixture(true);
  project.title = "Open-bench driver seat";
  const rig = project.motionRigs!.vehicle;
  rig.name = "Open-bench vehicle";
  rig.vehicle!.driverSeat = {
    id: "driver",
    profile: "brick-figure-open-seat-v1",
    pelvisPosition: [0, -17, 12],
    yawDegrees: 0,
    accessPoint: [45, -6, 12],
    approachPosition: [80, 23.7, 12],
    exits: [
      { position: [80, 23.7, 12], yawDegrees: 0 },
      { position: [-80, 23.7, 12], yawDegrees: 0 },
    ],
  };
  return project;
}
