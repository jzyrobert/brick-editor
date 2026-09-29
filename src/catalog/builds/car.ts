/**
 * "Car": an original CC0 four-wide open roadster from official LDraw parts,
 * rigged as a drivable kinematic vehicle (rig "car").
 *
 * Chassis: two Plate 2 × 2 with 2 Wheel Pins (4600) under Car Mudguards
 * 2 × 4 (3788), joined by plates; Wheel Rims 6.4 × 8 (4624) with Tyres
 * 6/50 × 8 (3641). Body: headlight bricks with clear lenses, a grille,
 * curved slopes and tiles on the bonnet and boot, a windscreen, two seats, a
 * steering wheel and tail lights. The car faces −Z (Play drives it that way).
 *
 * The chassis, wheels, mudguards, windscreen, seats and steering wheel come
 * from the complete official library (they are not in the curated catalogue);
 * the body uses curated parts. Ground is y = 0, just under the tyres.
 */
import type { Basis, Project, Transform, Vec3 } from "../../core/types";
import { importLDraw } from "../../ldraw/io";
import { occurrences } from "../../core/document";
import type { MotionRig } from "../../mechanisms/types";
import { Model, basis, mpd } from "./kit";
import { compose } from "../../core/math";

const BODY = 4, // red
  CHASSIS = 0, // black
  TRIM = 71, // light bluish grey
  SEAT = 0,
  GLASS = 47,
  TAIL = 36, // trans-red
  RIM = 71,
  TYRE = 0;

// Axles: front at z = −80, rear at z = 60 (wheelbase 140 LDU = 7 studs).
export const AXLES = [-80, 60];
// The tyres (radius 18; their tread vertices reach 18.0008) clear the ground
// by 1 LDU, which puts the whole chassis on the plate grid.
const AXLE_Y = -19;
const WHEEL_X = 30;
/** Plate level of the mudguards' underside (the wheel holders' top). */
const BASE = 3;

const Rx90: Basis = [1, 0, 0, 0, 0, -1, 0, 1, 0];
/** A 1 × 1 round tile on a headlight brick's recessed side stud. */
function lens(m: Model, color: number) {
  const brick = m.lines[m.lines.length - 1].split(" ").map(Number);
  const t: Transform = {
    position: [brick[2], brick[3], brick[4]],
    basis: brick.slice(5, 14) as Basis,
  };
  const local: Transform = { position: [0, 10, -14], basis: Rx90 };
  const w = compose(t, local);
  m.raw("98138.dat", color, w.position, w.basis);
}

function chassis() {
  const m = new Model("car-chassis.ldr", "Chassis");
  for (const z of AXLES) {
    m.raw("4600.dat", CHASSIS, [0, AXLE_Y - 5, z]);
    m.put("3788.dat", BODY, -2, z / 20 - 1, BASE);
  }
  const L0 = BASE + 1; // level of the mudguards' centre top (one plate up)
  // Base layer between and beyond the mudguards (flush with their centres).
  m.put("3710.dat", TRIM, -2, -6, BASE); // front bumper
  m.put("3031.dat", CHASSIS, -2, -3, BASE);
  m.put("3710.dat", CHASSIS, -2, 1, BASE);
  m.put("3710.dat", TRIM, -2, 5, BASE); // rear bumper
  // Spine over everything: a 2 × 12 plate down the middle, side plates
  // between the mudguard ends.
  m.put("2445.dat", CHASSIS, -1, -6, L0, 90);
  for (const x of [-2, 1]) {
    m.put("3024.dat", CHASSIS, x, -6, L0);
    m.put("3623.dat", CHASSIS, x, -3, L0, 90);
    m.put("3023b.dat", CHASSIS, x, 0, L0, 90);
    m.put("3024.dat", CHASSIS, x, 5, L0);
  }
  return m;
}

function body() {
  const m = new Model("car-body.ldr", "Body");
  const L = BASE + 2; // top of the chassis
  // Nose: headlight bricks with clear lenses either side of a grille.
  m.put("4070.dat", TRIM, -2, -6, L);
  lens(m, GLASS);
  m.put("4070.dat", TRIM, 1, -6, L);
  lens(m, GLASS);
  m.put("2877.dat", TRIM, -1, -6, L);
  // Bonnet: a brick course, curved slopes over the nose, and a plate and a
  // tile behind them, flush with the top of the curve.
  m.put("3001.dat", BODY, -2, -5, L);
  m.put("15068.dat", BODY, -2, -6, L + 3);
  m.put("15068.dat", BODY, 0, -6, L + 3);
  m.put("3710.dat", BODY, -2, -4, L + 3);
  m.put("2431.dat", BODY, -2, -4, L + 4);
  // Windscreen behind the bonnet.
  m.put("3823.dat", GLASS, -2, -3, L);
  // Cockpit: steering wheel, a single seat (its backrest leans 5 LDU past
  // its 2 × 2 base, so the row behind it is left open) and body sides.
  m.put("3829c01.dat", TRIM, -1, -1, L);
  m.raw("4079.dat", SEAT, [0, -8 * L - 8, 20]);
  for (const x of [-2, 1]) {
    m.put("3010.dat", BODY, x, -1, L, 90);
    m.put("2431.dat", TRIM, x, -1, L + 3, 90);
  }
  // Boot: bricks, tail lights, and curved slopes down to the tail.
  m.put("3001.dat", BODY, -2, 3, L);
  m.put("4070.dat", TRIM, -2, 5, L, 180);
  lens(m, TAIL);
  m.put("4070.dat", TRIM, 1, 5, L, 180);
  lens(m, TAIL);
  m.put("3004.dat", BODY, -1, 5, L);
  m.put("3710.dat", BODY, -2, 3, L + 3);
  m.put("2431.dat", BODY, -2, 3, L + 4);
  m.put("15068.dat", BODY, -2, 4, L + 3, 180);
  m.put("15068.dat", BODY, 0, 4, L + 3, 180);
  return m;
}

function wheel(name: string, x: number, z: number) {
  const m = new Model(name, "Wheel");
  const turn = x < 0 ? 270 : 90;
  const p: Vec3 = [x, AXLE_Y, z];
  m.raw("4624.dat", RIM, p, basis(turn));
  m.raw("3641.dat", TYRE, p, basis(turn));
  return m;
}

const WHEELS = [
  ["left-front", -WHEEL_X, AXLES[0]],
  ["right-front", WHEEL_X, AXLES[0]],
  ["left-rear", -WHEEL_X, AXLES[1]],
  ["right-rear", WHEEL_X, AXLES[1]],
] as const;

export function carSource() {
  return mpd(
    "roadster.mpd",
    "Roadster",
    [
      "Original template build; official LDraw parts only.",
      "Faces -Z. Tyres just clear y = 0. Rig: chassis + four wheel groups.",
    ],
    [
      chassis(),
      body(),
      ...WHEELS.map(([id, x, z]) => wheel(`car-wheel-${id}.ldr`, x, z)),
    ],
  );
}

/** The roadster with its drivable kinematic vehicle rig. */
export function carProject(): Project {
  const project = importLDraw(carSource(), "roadster.mpd");
  project.title = "Roadster";
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
  const chassis = all.filter((o) => !o.modelId.includes("car-wheel"));
  const rig: MotionRig = {
    schemaVersion: 1,
    id: "car",
    name: "Roadster",
    mode: "kinematic",
    groups: [
      group("chassis", chassis, [0, AXLE_Y, (AXLES[0] + AXLES[1]) / 2]),
      ...WHEELS.map(([id, x, z]) =>
        group(id, inModel(`car-wheel-${id}`), [x, AXLE_Y, z]),
      ),
    ],
    joints: [],
    vehicle: {
      chassisGroup: "chassis",
      wheelbase: AXLES[1] - AXLES[0],
      maxSpeed: 160,
      maxSteerDegrees: 30,
      wheels: WHEELS.map(([id]) => ({
        groupId: id,
        axis: [1, 0, 0] as Vec3,
        radius: 18,
        steering: id.endsWith("front"),
      })),
    },
  };
  project.motionRigs = { car: rig };
  return project;
}
