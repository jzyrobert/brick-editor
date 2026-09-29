/**
 * "Off-road jeep": an original CC0 six-wide open jeep from official LDraw
 * parts, rigged as a drivable kinematic vehicle with a driver seat (rig
 * "jeep").
 *
 * Built to minifigure proportions: two Minifig Seats 2 × 2 side by side in a
 * doorless cockpit (the sills stay two plates above the floor, below a seated
 * figure's arms), a steering wheel two studs ahead of the driver (clear of a
 * seated figure's legs), a windscreen, a load bed with cargo, a roll bar at
 * its front (behind the seats' row, so nothing is over a figure climbing in)
 * and a spare wheel on the tailgate. Chassis: two Plate 2 × 2 with Wheel
 * Holders (4600) under a plate spine, Car Mudguards 4 × 2.5 × 2 (50745) over
 * Wheel Rims 12 × 11 (6014b) with balloon Tyres 12/61 × 11 (56890). The jeep
 * faces −Z (Play drives it that way).
 *
 * The windscreen, mudguards, rims and tyres come from the complete official
 * library; every other part is in the curated catalogue. Ground is y = 0,
 * just under the tyres.
 */
import type { Project, Vec3 } from "../../core/types";
import { importLDraw } from "../../ldraw/io";
import { occurrences } from "../../core/document";
import type { MotionRig } from "../../mechanisms/types";
import { Model, basis, lens, mpd, type Turn } from "./kit";

const BODY = 25, // orange
  CHASSIS = 0, // black
  TRIM = 72, // dark bluish grey
  LIGHT = 71, // light bluish grey
  SEAT = 0,
  GLASS = 40, // trans-black
  LENS = 47, // trans-clear
  TAIL = 36, // trans-red
  RIM = 71,
  TYRE = 0,
  CARGO = 19; // tan

// Axles: front at z = −100, rear at z = 80 (wheelbase 180 LDU = 9 studs).
export const JEEP_AXLES = [-100, 80];
/** Tyre radius (56890 balloon tyre: 32.11 LDU). */
export const JEEP_WHEEL_RADIUS = 32.11;
// The tyres clear the ground by 2.9 LDU; the wheel holders' top is then
// plate level 5 and the whole body sits on the plate grid.
const AXLE_Y = -35;
/** Plate level of the wheel holders' top (the chassis spine rests on it). */
const BASE = 5;
/** The rim's inner (hub) face against the holder's pin boss. */
const HUB_X = 25;
const FLOOR = BASE + 2; // top of the cockpit floor plates
/**
 * The driver's hips: 18 LDU above the seat's cushion (FLOOR + 1), so the
 * seated minifigure's hips and legs clear the seat's front studs and arms,
 * over the middle of the driver's seat (x −2..−1, rows −2..−1).
 */
export const JEEP_PELVIS: Vec3 = [-20, -8 * (FLOOR + 1) - 18, -20];

function chassis() {
  const m = new Model("jeep-chassis.ldr", "Chassis and mudguards");
  for (const z of JEEP_AXLES) m.raw("4600.dat", CHASSIS, [0, AXLE_Y - 5, z]);
  // Spine along the middle, on the wheel holders.
  m.put("2445.dat", CHASSIS, -1, -8, BASE, 90); // rows −8..3
  m.put("3021.dat", CHASSIS, -1, 4, BASE, 90); // rows 4..6
  // Mudguards: 2 studs on the body, half a stud of arch outboard.
  for (const z of JEEP_AXLES)
    for (const side of [-1, 1] as const)
      m.raw(
        "50745.dat",
        BODY,
        [side * 40, -8 * BASE - 40, z],
        basis(side < 0 ? 90 : 270),
      );
  // Cockpit sides beside the spine (rows −3..1), tied by the floor above.
  for (const x of [-3, 1]) {
    m.put("3020.dat", CHASSIS, x, -3, BASE, 90); // rows −3..0
    m.put("3023b.dat", CHASSIS, x, 1, BASE); // row 1
  }
  return m;
}

function body() {
  const m = new Model("jeep-body.ldr", "Bonnet, lights and tail");
  // Front: bumper, then a brick course of headlights and grille.
  m.put("3666.dat", LIGHT, -3, -8, BASE + 1);
  m.put("4070.dat", LIGHT, -3, -8, BASE + 2);
  lens(m, LENS);
  m.put("4070.dat", LIGHT, 2, -8, BASE + 2);
  lens(m, LENS);
  m.put("3005.dat", BODY, -2, -8, BASE + 2);
  m.put("3005.dat", BODY, 1, -8, BASE + 2);
  m.put("2877.dat", TRIM, -1, -8, BASE + 2);
  // Engine block between the front mudguards (rows −7..−5).
  m.put("3002.dat", BODY, -1, -7, BASE + 1, 90);
  m.put("3021.dat", TRIM, -1, -7, BASE + 4, 90);
  // Bonnet over the mudguards and the nose, the windscreen behind it and
  // a dashboard row with the steering wheel over the front axle's back.
  m.put("3666.dat", BODY, -3, -8, BASE + 5); // row −8
  m.put("3032.dat", BODY, -3, -7, BASE + 5); // rows −7..−4
  m.put("87079.dat", BODY, -2, -8, BASE + 6);
  m.put("3069b.dat", TRIM, -3, -8, BASE + 6, 90);
  m.put("3069b.dat", TRIM, 2, -8, BASE + 6, 90);
  m.put("4176.dat", GLASS, -3, -6, BASE + 6, 180);
  m.put("3829c01.dat", CHASSIS, -2, -4, BASE + 6);
  m.put("3070b.dat", TRIM, -3, -4, BASE + 6);
  m.put("63864.dat", TRIM, 0, -4, BASE + 6);
  // Rear: spine block and a tail course with lights.
  m.put("3001.dat", BODY, -1, 2, BASE + 1, 90);
  m.put("3020.dat", TRIM, -1, 2, BASE + 4, 90);
  m.put("3666.dat", LIGHT, -3, 6, BASE + 1);
  m.put("4070.dat", LIGHT, -3, 6, BASE + 2, 180);
  lens(m, TAIL);
  m.put("4070.dat", LIGHT, 2, 6, BASE + 2, 180);
  lens(m, TAIL);
  m.put("3622.dat", BODY, -2, 6, BASE + 2);
  m.put("3005.dat", BODY, 1, 6, BASE + 2);
  return m;
}

/** Floor, seats, steering wheel, sills and the roll bar (rows −3..1). */
function cockpit() {
  const m = new Model("jeep-cockpit.ldr", "Cockpit");
  m.put("3032.dat", TRIM, -3, -3, BASE + 1); // floor 6 × 4, rows −3..0
  m.put("3666.dat", TRIM, -3, 1, BASE + 1); // row 1
  // Two seats a stud apart (a seated minifigure's arms reach past its
  // seat); the driver sits on the left, the passenger against the right side.
  m.put("4079.dat", SEAT, -2, -2, FLOOR);
  m.put("4079.dat", SEAT, 1, -2, FLOOR);
  m.put("3069b.dat", 0, 0, -2, FLOOR, 90); // console between them
  // Sills two plates above the floor: the whole left side, and the right
  // side in front of and behind the passenger seat.
  m.put("3710.dat", BODY, -3, -3, FLOOR, 90);
  m.put("2431.dat", TRIM, -3, -3, FLOOR + 1, 90);
  m.put("3024.dat", BODY, -3, 1, FLOOR);
  m.put("3070b.dat", TRIM, -3, 1, FLOOR + 1);
  m.put("3024.dat", BODY, 2, -3, FLOOR);
  m.put("3070b.dat", TRIM, 2, -3, FLOOR + 1);
  m.put("3024.dat", BODY, 2, 1, FLOOR);
  m.put("3070b.dat", TRIM, 2, 1, FLOOR + 1);
  return m;
}

/**
 * Load bed over the rear mudguards, with low sides, a roll bar at its front
 * and a spare wheel. The roll bar stands a stud behind the seat backs, so a
 * figure climbing into the seat from the side passes under nothing.
 */
function bed() {
  const m = new Model("jeep-bed.ldr", "Load bed and roll bar");
  const L = BASE + 5;
  m.put("3032.dat", CARGO, -3, 2, L); // rows 2..5
  m.put("3666.dat", CARGO, -3, 6, L); // row 6
  for (const x of [-3, 2]) m.put("3622.dat", BODY, x, 3, L + 1, 90);
  m.put("3009.dat", BODY, -3, 6, L + 1);
  for (const x of [-3, 2]) m.put("63864.dat", TRIM, x, 3, L + 4, 90);
  m.put("6636.dat", TRIM, -3, 6, L + 4);
  // Roll bar: two posts on the bed's front corners and a bar across.
  for (const x of [-3, 2])
    for (let c = 0; c < 2; c++) m.put("3062b.dat", TRIM, x, 2, L + 1 + 3 * c);
  m.put("3666.dat", TRIM, -3, 2, L + 7);
  m.put("6636.dat", CHASSIS, -3, 2, L + 8);
  // Cargo: a crate and a toolbox in the bed.
  m.put("4345b.dat", 2, -2, 3, L + 1);
  m.put("3003.dat", CHASSIS, 0, 4, L + 1);
  m.put("3068b.dat", 4, 0, 4, L + 4);
  // Spare wheel on the tailgate, its hub against the tail course.
  m.raw("56890.dat", TYRE, [0, -100, 154], basis(180));
  m.raw("6014b.dat", RIM, [0, -100, 148], basis(180));
  return m;
}

function wheel(name: string, side: -1 | 1, z: number) {
  const m = new Model(name, "Wheel");
  const turn: Turn = side < 0 ? 90 : 270;
  m.raw("6014b.dat", RIM, [side * (HUB_X + 8), AXLE_Y, z], basis(turn));
  m.raw("56890.dat", TYRE, [side * (HUB_X + 14), AXLE_Y, z], basis(turn));
  return m;
}

const WHEELS = [
  ["left-front", -1, JEEP_AXLES[0]],
  ["right-front", 1, JEEP_AXLES[0]],
  ["left-rear", -1, JEEP_AXLES[1]],
  ["right-rear", 1, JEEP_AXLES[1]],
] as const;

export function jeepSource() {
  return mpd(
    "off-road-jeep.mpd",
    "Off-road jeep",
    [
      "Original template build; official LDraw parts only.",
      "Faces -Z. Tyres just clear y = 0. Rig: chassis + four wheel groups.",
    ],
    [
      chassis(),
      body(),
      cockpit(),
      bed(),
      ...WHEELS.map(([id, side, z]) => wheel(`jeep-wheel-${id}.ldr`, side, z)),
    ],
  );
}

/** The jeep with its drivable kinematic vehicle rig and driver seat. */
export function jeepProject(): Project {
  const project = importLDraw(jeepSource(), "off-road-jeep.mpd");
  project.title = "Off-road jeep";
  const all = occurrences(project);
  const inModel = (name: string) => all.filter((o) => o.modelId.includes(name));
  const group = (id: string, members: typeof all, position: Vec3) => ({
    id,
    occurrenceIds: members.map((o) => o.id),
    frame: { position, basis: basis(0) },
    restTransforms: Object.fromEntries(
      members.map((o) => [o.id, structuredClone(o.transform)]),
    ),
  });
  const origin: Vec3 = [0, AXLE_Y, (JEEP_AXLES[0] + JEEP_AXLES[1]) / 2];
  const local = (p: Vec3): Vec3 => [
    p[0] - origin[0],
    p[1] - origin[1],
    p[2] - origin[2],
  ];
  const chassisParts = all.filter((o) => !o.modelId.includes("jeep-wheel"));
  const stand: Vec3 = [-110, -0.3, JEEP_PELVIS[2]];
  const rig: MotionRig = {
    schemaVersion: 1,
    id: "jeep",
    name: "Off-road jeep",
    mode: "kinematic",
    groups: [
      group("chassis", chassisParts, origin),
      ...WHEELS.map(([id, side, z]) =>
        group(id, inModel(`jeep-wheel-${id}`), [
          side * (HUB_X + 14),
          AXLE_Y,
          z,
        ]),
      ),
    ],
    joints: [],
    vehicle: {
      chassisGroup: "chassis",
      wheelbase: JEEP_AXLES[1] - JEEP_AXLES[0],
      maxSpeed: 160,
      maxSteerDegrees: 30,
      wheels: WHEELS.map(([id]) => ({
        groupId: id,
        axis: [1, 0, 0] as Vec3,
        radius: JEEP_WHEEL_RADIUS,
        steering: id.endsWith("front"),
      })),
      driverSeat: {
        id: "driver",
        profile: "brick-figure-open-seat-v1",
        pelvisPosition: local(JEEP_PELVIS),
        yawDegrees: 0,
        accessPoint: local([-74, -60, JEEP_PELVIS[2]]),
        approachPosition: local(stand),
        exits: [
          { position: local(stand), yawDegrees: 0 },
          { position: local([110, -0.3, JEEP_PELVIS[2]]), yawDegrees: 0 },
        ],
      },
    },
  };
  project.motionRigs = { jeep: rig };
  return project;
}
