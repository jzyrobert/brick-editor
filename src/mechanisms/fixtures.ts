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
    "1 4 20 -60 0 1 0 0 0 1 0 0 0 1 door.dat",
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
  // A two-stud doorway five bricks high: the Play minifig (104 LDU with its
  // hair) walks through it.
  begin("frame.dat");
  box([-8, -128, -4], [0, 0, 4]);
  box([40, -128, -4], [48, 0, 4]);
  box([0, -128, -4], [40, -120, 4]);
  begin("door.dat");
  box([-20, -60, -2], [20, 60, 2]);
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
        anchorA: [0, -60, 0],
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
    // The minifig's hips (9.3 LDU under its pelvis) rest on the cushion.
    pelvisPosition: [0, -22.5, 12],
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

/** Original CC0 physics playground: the door and car plus a loose crate and a motorised spinner. */
export function physicsFixtureSource() {
  const base = mechanismFixtureSource().replace(/\n0 NOFILE\n$/, "\n");
  const firstPart = base.indexOf("0 FILE frame.dat");
  const extraRefs = [
    "1 14 -120 -16 60 1 0 0 0 1 0 0 0 1 crate.dat",
    "1 7 160 0 60 1 0 0 0 1 0 0 0 1 post.dat",
    "1 2 160 -64 60 1 0 0 0 1 0 0 0 1 paddle.dat",
  ];
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
    return [
      [0, 3, 2, 1],
      [4, 5, 6, 7],
      [0, 1, 5, 4],
      [3, 7, 6, 2],
      [0, 4, 7, 3],
      [1, 2, 6, 5],
    ].map((f) => `4 16 ${f.flatMap((i) => p[i]).join(" ")}`);
  };
  const part = (name: string, lines: string[]) =>
    [
      `0 FILE ${name}`,
      "0 !LDRAW_ORG Unofficial_Part",
      "0 !LICENSE CC0-1.0",
      "0 BFC CERTIFY CCW",
      ...lines,
    ].join("\n");
  return (
    base.slice(0, firstPart) +
    extraRefs.join("\n") +
    "\n" +
    base.slice(firstPart) +
    [
      part("crate.dat", box([-16, -16, -16], [16, 16, 16])),
      part("post.dat", box([-4, -60, -4], [4, 0, 4])),
      part("paddle.dat", box([-40, -4, -2], [40, 4, 2])),
    ].join("\n") +
    "\n0 NOFILE\n"
  );
}
/**
 * Door, car, crate and spinner with optional dynamic settings. Everything is
 * kinematic until Play is entered with Dynamic physics.
 */
export function physicsFixture(): Project {
  const project = importLDraw(physicsFixtureSource(), "physics.mpd");
  project.title = "Physics playground";
  const all = occurrences(project);
  // Root order: frame, door, chassis, four wheels, crate, post, paddle.
  const order = [
    "frame",
    "door",
    "chassis",
    "wheel",
    "wheel",
    "wheel",
    "wheel",
  ];
  order.push("crate", "post", "paddle");
  const group = (id: string, ref: string, n = 0): RigidGroup => {
    const base = ref.replace(/\.dat$/, "");
    const index = order.findIndex(
      (name, i) =>
        name === base &&
        order.slice(0, i).filter((x) => x === base).length === n,
    );
    const o = all[index];
    return {
      id,
      occurrenceIds: [o.id],
      frame: structuredClone(o.transform),
      restTransforms: { [o.id]: structuredClone(o.transform) },
    };
  };
  const reference = mechanismFixture();
  const door = structuredClone(reference.motionRigs.door);
  const vehicle = structuredClone(reference.motionRigs.vehicle);
  door.groups = [group("frame", "frame.dat"), group("door", "door.dat")];
  vehicle.groups = [
    group("chassis", "chassis.dat"),
    ...["left-front", "left-back", "right-front", "right-back"].map((id, i) =>
      group(id, "wheel.dat", i),
    ),
  ];
  vehicle.dynamics = {
    suspension: { restLength: 6, travel: 5, stiffness: 40, damping: 4 },
  };
  const crate: MotionRig = {
    schemaVersion: 1,
    id: "crate",
    name: "Loose crate",
    mode: "kinematic",
    groups: [group("crate", "crate.dat")],
    joints: [],
    dynamics: { groups: { crate: { anchored: false, massKg: 8 } } },
  };
  const spinner: MotionRig = {
    schemaVersion: 1,
    id: "spinner",
    name: "Motorised spinner",
    mode: "kinematic",
    groups: [group("post", "post.dat"), group("paddle", "paddle.dat")],
    joints: [
      {
        id: "axle",
        kind: "revolute",
        bodyA: "post",
        bodyB: "paddle",
        anchorA: [0, -62, 0],
        anchorB: [0, 2, 0],
        axisA: [0, -1, 0],
        axisB: [0, -1, 0],
        motor: {
          mode: "velocity",
          target: 90,
          maxEffort: { value: 200, unit: "N*m" },
        },
      },
    ],
  };
  project.motionRigs = { door, vehicle, crate, spinner };
  return project;
}
