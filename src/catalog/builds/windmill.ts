/**
 * "Windmill farm": an original CC0 build from official LDraw parts.
 *
 * A stone-and-white windmill whose sails turn on a motorised axle (rig
 * "windmill": a revolute joint with a velocity motor, so the sails turn as
 * soon as Play starts), a red barn with two doors that open inwards, a
 * fenced pasture with cows and a pig, a vegetable field, chickens, hay and
 * trees on a 32 × 32 baseplate. Fronts face −Z, towards the default camera.
 *
 * The sails are built flat in their own section and stood up in front of the
 * mill's cap: the section's studs face −Z. Its hub (a 2 × 2 round plate) sits
 * on the side stud of a 1 × 1 brick at the end of the cap's shaft, so the
 * whole windmill is one stud-connected build.
 *
 * Play: walk through the mill's door and the barn's doors (E or tap opens
 * them); the sails turn at 30 degrees a second and stop if they would hit
 * the explorer.
 */
import type { Basis, Project, Vec3 } from "../../core/types";
import { importLDraw } from "../../ldraw/io";
import { occurrences } from "../../core/document";
import type { MotionRig } from "../../mechanisms/types";
import { Model, basis, door, gableRoof, glazed, mpd, ringWall } from "./kit";

const GRASS = 2,
  STONE = 71,
  DARK_STONE = 72,
  MILL = 15, // white
  CAP = 320, // dark red
  SPAR = 70, // reddish brown
  SAIL = 15,
  BARN = 4, // red
  BARN_TRIM = 15,
  ROOF = 72,
  WOOD = 70,
  PATH = 19,
  SOIL = 70,
  HAY = 191, // bright light orange
  FENCE = 70,
  LEAF = 2,
  BRIGHT_LEAF = 10;

// Windmill: 8 × 8 stone base x −11..−4, z 3..10; 6 × 6 upper tower.
const MX0 = -11,
  MX1 = -4,
  MZ0 = 3,
  MZ1 = 10;
const BASE_COURSES = 6,
  UPPER_COURSES = 5;
const UPPER = 3 * BASE_COURSES + 1; // upper tower's first course level
const CAP_LEVEL = UPPER + 3 * UPPER_COURSES; // cap plate level
/**
 * Axle: the centre of the sails' 2 × 2 hub. The hub's lower row of
 * anti-studs sits on the two side studs of a 1 × 2 brick at the tip of the
 * shaft (they are 10 LDU below that brick's top), so the centre is level
 * with the brick's top, on its front face.
 */
export const WINDMILL_HUB: Vec3 = [
  (MX0 + MX1 + 1) * 10,
  -8 * CAP_LEVEL - 24,
  (MZ0 - 1) * 20,
];

function mill() {
  const m = new Model("windmill-tower.ldr", "Windmill tower");
  ringWall(m, {
    x0: MX0,
    x1: MX1,
    z0: MZ0,
    z1: MZ1,
    level: 0,
    courses: BASE_COURSES,
    openings: [
      { side: "front", from: -9, to: -5, c0: 0, c1: 6 },
      { side: "left", from: 6, to: 8, c0: 2, c1: 4 },
      { side: "right", from: 6, to: 8, c0: 2, c1: 4 },
    ],
    color: (c, side) =>
      (c * 5 + side.length * 3) % 7 === 0 || c === 0 ? DARK_STONE : STONE,
  });
  door(m, {
    x: -9,
    z: MZ0,
    level: 0,
    frame: WOOD,
    door: SPAR,
    inside: true,
  });
  glazed(m, "60592.dat", WOOD, MX0, 6, 6, 90);
  glazed(m, "60592.dat", WOOD, MX1, 6, 6, 270);
  // First floor: an 8 × 8 plate on the stone base.
  m.put("41539.dat", DARK_STONE, MX0, MZ0, 3 * BASE_COURSES);
  ringWall(m, {
    x0: MX0 + 1,
    x1: MX1 - 1,
    z0: MZ0 + 1,
    z1: MZ1 - 1,
    level: UPPER,
    courses: UPPER_COURSES,
    openings: [
      // The shaft runs out through the top course.
      { side: "front", from: -8, to: -6, c0: 4, c1: 5 },
      { side: "front", from: -8, to: -6, c0: 1, c1: 3 },
      { side: "back", from: -8, to: -6, c0: 1, c1: 3 },
    ],
    color: () => MILL,
  });
  glazed(m, "60592.dat", SPAR, -8, MZ0 + 1, UPPER + 3, 0);
  glazed(m, "60592.dat", SPAR, -8, MZ1 - 1, UPPER + 3, 180);
  // Shaft: a 2 × 4 brick through the top course, two studs proud of the
  // wall, and the side-stud brick for the hub at its tip.
  m.put("3001.dat", SPAR, -8, MZ0 - 1, CAP_LEVEL - 3, 90);
  m.put("3958.dat", CAP, MX0 + 1, MZ0 + 1, CAP_LEVEL);
  m.put("11211.dat", DARK_STONE, -8, MZ0 - 1, CAP_LEVEL);
  gableRoof(m, {
    x0: MX0 + 1,
    x1: MX1 - 1,
    z0: MZ0 + 1,
    z1: MZ1 - 1,
    level: CAP_LEVEL + 1,
    roof: CAP,
    gable: MILL,
  });
  return m;
}

/**
 * The sails, built flat (studs up) around the hub at the origin and stood up
 * by the section's placement: local X stays X, local −Y (studs) faces −Z and
 * local +Z points up.
 */
function sails() {
  const m = new Model("windmill-sails.ldr", "Sails");
  const Rx90: Basis = [1, 0, 0, 0, 0, -1, 0, 1, 0];
  m.placement = { position: WINDMILL_HUB, basis: Rx90 };
  m.put("4032b.dat", 0, -1, -1, 0); // hub, on the brick's side stud
  m.put("4282.dat", SPAR, -8, -1, 1); // spar across
  m.put("4282.dat", SPAR, -1, -8, 2, 90); // spar up and down
  m.put("14769.dat", DARK_STONE, -1, -1, 3); // hub cap
  // Four sails, a pinwheel: each trails its spar by a quarter turn. A sail
  // is a 4 × 6 frame plate covered in grille tiles (the lattice).
  const sail = (x: number, z: number, level: number, along: "x" | "z") => {
    m.put("3032.dat", SPAR, x, z, level, along === "x" ? 0 : 90);
    for (let i = 0; i < 4; i++)
      for (let j = 0; j < 6; j += 2)
        if (along === "x") m.put("2412b.dat", SAIL, x + j, z + i, level + 1);
        else m.put("2412b.dat", SAIL, x + i, z + j, level + 1, 90);
  };
  sail(2, -4, 2, "x"); // right arm, sail above it
  sail(-8, 0, 2, "x"); // left arm, sail below it
  sail(-4, -8, 3, "z"); // top arm, sail to its left
  sail(0, 2, 3, "z"); // bottom arm, sail to its right
  return m;
}

function barn() {
  const m = new Model("windmill-barn.ldr", "Barn");
  const X0 = 3,
    X1 = 14,
    Z0 = 1,
    Z1 = 10;
  ringWall(m, {
    x0: X0,
    x1: X1,
    z0: Z0,
    z1: Z1,
    level: 0,
    courses: 6,
    openings: [
      { side: "front", from: 5, to: 13, c0: 0, c1: 6 },
      { side: "left", from: 4, to: 6, c0: 2, c1: 4 },
      { side: "right", from: 4, to: 6, c0: 2, c1: 4 },
      { side: "back", from: 5, to: 7, c0: 2, c1: 4 },
      { side: "back", from: 10, to: 12, c0: 2, c1: 4 },
    ],
    color: (c) => (c === 0 ? DARK_STONE : BARN),
  });
  for (const x of [5, 9])
    door(m, { x, z: Z0, level: 0, frame: BARN_TRIM, door: WOOD, inside: true });
  glazed(m, "60592.dat", BARN_TRIM, X0, 4, 6, 90);
  glazed(m, "60592.dat", BARN_TRIM, X1, 4, 6, 270);
  glazed(m, "60592.dat", BARN_TRIM, 5, Z1, 6, 180);
  glazed(m, "60592.dat", BARN_TRIM, 10, Z1, 6, 180);
  // Loft floor, white trim course and the roof.
  m.put("3033.dat", BARN_TRIM, X0, Z0, 18, 90);
  m.put("3033.dat", BARN_TRIM, X0 + 6, Z0, 18, 90);
  gableRoof(m, {
    x0: X0,
    x1: X1,
    z0: Z0,
    z1: Z1,
    level: 19,
    roof: ROOF,
    gable: BARN,
  });
  // Hay bales inside, clear of the doors' swing.
  for (const [x, z, level] of [
    [4, 6, 0],
    [4, 6, 3],
    [6, 6, 0],
    [11, 6, 0],
  ] as const)
    m.put("3001.dat", HAY, x, z, level, 90);
  return m;
}

function grounds() {
  const m = new Model("windmill-grounds.ldr", "Farmyard");
  m.raw("3811.dat", GRASS, [0, 0, 0]);
  // Paths: from the front edge up the middle, then along the buildings.
  for (let z = -16; z < -5; z += 4) m.put("87079.dat", PATH, -1, z, 0, 90);
  m.put("3068b.dat", PATH, -1, -4, 0);
  for (let x = -9; x < 11; x += 4) m.put("87079.dat", PATH, x, -2, 0);
  m.put("3068b.dat", PATH, 11, -2, 0);
  for (const x of [-9, -7]) m.put("3068b.dat", PATH, x, 0, 0);
  // Vegetable field on the left: soil beds with lettuce and carrot rows.
  for (const z of [-15, -12, -9]) {
    m.put("3034.dat", SOIL, -15, z, 0);
    for (let x = -15; x < -7; x++) {
      const row = z + ((x + 100) % 2);
      if (z === -12) m.put("4589.dat", 25, x, row, 1);
      else m.put("33291.dat", BRIGHT_LEAF, x, row, 1);
    }
  }
  // Pasture on the right (x 2..15, z −15..−6): a spindled fence with a gate
  // gap facing the path, cows, a pig and a water trough.
  for (const [x, z] of [
    [2, -15],
    [15, -15],
    [2, -6],
    [15, -6],
  ] as const)
    m.put("3062b.dat", FENCE, x, z, 0);
  for (let x = 3; x < 15; x += 4) m.put("30055.dat", FENCE, x, -15, 0);
  for (const x of [3, 11]) m.put("30055.dat", FENCE, x, -6, 0);
  for (const z of [-14, -10]) {
    m.put("30055.dat", FENCE, 2, z, 0, 90);
    m.put("30055.dat", FENCE, 15, z, 0, 90);
  }
  m.put("3003.dat", WOOD, 13, -14, 0);
  m.put("3068b.dat", 33, 13, -14, 3);
  m.raw("64452p02.dat", 15, [170, -48, -250], basis(90));
  m.raw("64452p01.dat", 70, [190, -48, -180], basis(270));
  m.raw("87621p01.dat", 13, [90, -40, -160], basis(0));
  // Chickens by the barn.
  m.raw("95342.dat", 15, [280, -4, -20], basis(90));
  m.raw("95342.dat", 15, [300, -4, 0], basis(270));
  // Trees and bushes round the edge.
  m.put("3471.dat", LEAF, -15, 11, 0);
  m.put("3470.dat", BRIGHT_LEAF, -1, 11, 0);
  m.put("3471.dat", 288, -16, -3, 0);
  m.put("6255.dat", BRIGHT_LEAF, -1, 9, 0);
  // Hay stack by the mill.
  m.put("3001.dat", HAY, -3, 1, 0, 90);
  m.put("3003.dat", HAY, -3, 2, 3);
  return m;
}

export function windmillSource() {
  return mpd(
    "windmill-farm.mpd",
    "Windmill farm",
    [
      "Original template build; official LDraw parts only.",
      "Fronts face -Z. Baseplate top is y = 0; one plate = 8 LDU.",
      "Sails: built flat, stood up round the hub (rig windmill).",
    ],
    [grounds(), mill(), sails(), barn()],
  );
}

/** The farm with its motorised sails (they turn as Play starts). */
export function windmillProject(): Project {
  const project = importLDraw(windmillSource(), "windmill-farm.mpd");
  project.title = "Windmill farm";
  const all = occurrences(project);
  const hub = all.find(
    (o) => o.modelId.includes("windmill-tower") && o.node.ref === "11211.dat",
  );
  const blades = all.filter((o) => o.modelId.includes("windmill-sails"));
  if (!hub || !blades.length) throw new Error("Windmill rig parts not found");
  const group = (id: string, members: typeof all) => ({
    id,
    occurrenceIds: members.map((o) => o.id),
    frame: { position: [...WINDMILL_HUB] as Vec3, basis: basis(0) },
    restTransforms: Object.fromEntries(
      members.map((o) => [o.id, structuredClone(o.transform)]),
    ),
  });
  const rig: MotionRig = {
    schemaVersion: 1,
    id: "windmill",
    name: "Windmill sails",
    mode: "kinematic",
    groups: [group("tower", [hub]), group("sails", blades)],
    joints: [
      {
        id: "axle",
        kind: "revolute",
        bodyA: "tower",
        bodyB: "sails",
        anchorA: [0, 0, 0],
        anchorB: [0, 0, 0],
        axisA: [0, 0, 1],
        axisB: [0, 0, 1],
        motor: {
          mode: "velocity",
          target: 30,
          maxEffort: { value: 50, unit: "N*m" },
        },
      },
    ],
  };
  project.motionRigs = { windmill: rig };
  return project;
}
