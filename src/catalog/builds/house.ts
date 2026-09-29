/**
 * "House with garden": an original CC0 build from official catalogue parts.
 *
 * A 14 × 10 stud, one-and-a-half storey house on a 32 × 32 baseplate: brick
 * walls in running bond with interlocking corners, framed and glazed windows,
 * a real door in a door frame (Play swings it open), floor plates, a 45°
 * gable roof with a ridge and a chimney, and a fenced garden with a path,
 * flower beds, trees, a pond, a bench and a mailbox. The front faces −Z,
 * towards the editor's default camera.
 *
 * Play fit: the door opening is 68 LDU wide and 128 LDU high; the Play figure
 * is 16 LDU across and 72 LDU tall. The floor and path are one plate (8 LDU)
 * above the baseplate, which is the figure's step height.
 */
import {
  BRICK_1,
  Model,
  basis,
  bond,
  joints,
  mpd,
  ringWall,
  type Opening,
  type Turn,
} from "./kit";

// Colours (LDraw codes).
const WALL = 15, // white
  FOUNDATION = 72, // dark bluish grey
  TRIM = 19, // tan
  FRAME = 272, // dark blue
  GLASS = 47, // trans-clear
  DOOR = 4, // red
  ROOF = 320, // dark red
  CHIMNEY = 70, // reddish brown
  FLOOR = 84, // medium nougat
  PATH = 19, // tan
  SOIL = 70, // reddish brown
  FENCE = 15,
  LEAF = 2, // green
  BRIGHT_LEAF = 10,
  WATER = 43; // trans-light blue

// Footprint: x −9..4, z −2..7 (front wall at z = −2 faces −Z).
const X0 = -9,
  X1 = 4,
  Z0 = -2,
  Z1 = 7;
const GROUND_COURSES = 6,
  UPPER_COURSES = 4;
const SLAB = 3 * GROUND_COURSES; // plate level of the first-floor slab
const UPPER = SLAB + 1;
const ATTIC = UPPER + 3 * UPPER_COURSES;
const ROOF_BASE = ATTIC + 1;

function window(
  m: Model,
  frame: string,
  glass: string,
  x: number,
  z: number,
  level: number,
  turn: Turn,
) {
  m.put(frame, FRAME, x, z, level, turn);
  // The glass shares the frame's origin (as in the official set inventories).
  const line = m.lines[m.lines.length - 1].split(" ");
  m.lines.push(["1", String(GLASS), ...line.slice(2, 14), glass].join(" "));
}

function floorPlates(m: Model, level: number, color: number) {
  // 14 × 10: two 6 × 10 plates and a 2 × 10 plate, running along Z.
  m.put("3033.dat", color, X0, Z0, level, 90);
  m.put("3033.dat", color, X0 + 6, Z0, level, 90);
  m.put("3832.dat", color, X0 + 12, Z0, level, 90);
}

function groundFloor() {
  const m = new Model("house-ground-floor.ldr", "Ground floor");
  const openings: Opening[] = [
    { side: "front", from: -4, to: 0, c0: 0, c1: 6 }, // door
    { side: "front", from: -7, to: -5, c0: 1, c1: 4 },
    { side: "front", from: 1, to: 3, c0: 1, c1: 4 },
    { side: "back", from: -7, to: -5, c0: 1, c1: 4 },
    { side: "back", from: 1, to: 3, c0: 1, c1: 4 },
    { side: "left", from: 2, to: 4, c0: 1, c1: 4 },
    { side: "right", from: 2, to: 4, c0: 1, c1: 4 },
  ];
  ringWall(m, {
    x0: X0,
    x1: X1,
    z0: Z0,
    z1: Z1,
    level: 0,
    courses: GROUND_COURSES,
    openings,
    color: (c) => (c === 0 ? FOUNDATION : WALL),
  });
  // Door frame turned to face the garden, with the door hanging on its
  // hinge pins on the outer side (60596 + 60616a): the frame stops it
  // swinging in, so it opens outwards over the lawn.
  m.put("60596.dat", WALL, -4, Z0, 0, 180);
  const frame = m.lines[m.lines.length - 1].split(" ").map(Number);
  m.raw(
    "60616a.dat",
    DOOR,
    [frame[2] + 32, frame[3], frame[4] - 5],
    basis(180),
  );
  for (const x of [-7, 1]) window(m, "60593.dat", "60602.dat", x, Z0, 3, 0);
  for (const x of [-7, 1]) window(m, "60593.dat", "60602.dat", x, Z1, 3, 180);
  window(m, "60593.dat", "60602.dat", X0, 2, 3, 90);
  window(m, "60593.dat", "60602.dat", X1, 2, 3, 270);
  // Floor inside the walls (x −8..3, z −1..6): two 6 × 8 plates.
  m.put("3036.dat", FLOOR, -8, -1, 0, 90);
  m.put("3036.dat", FLOOR, -2, -1, 0, 90);
  // A little furniture: rug, table and a kitchen counter with a tap.
  m.put("87079.dat", 1, -3, 1, 1); // rug 2 × 4
  m.put("3941.dat", 70, -7, 3, 1); // table leg
  m.put("3031.dat", 70, -8, 2, 4); // table top 4 × 4
  m.put("3068b.dat", 15, -7, 3, 5); // tablecloth
  for (const z of [0, 2, 4]) m.put("3003.dat", 71, 2, z, 1); // counter
  for (const z of [0, 4]) m.put("3068b.dat", 72, 2, z, 4);
  m.put("3022.dat", 72, 2, 2, 4);
  m.put("4599b.dat", 71, 2, 3, 5, 90);
  return m;
}

function upperFloor() {
  const m = new Model("house-upper-floor.ldr", "First floor");
  floorPlates(m, SLAB, TRIM);
  const openings: Opening[] = [
    { side: "front", from: -7, to: -5, c0: 1, c1: 3 },
    { side: "front", from: -3, to: -1, c0: 1, c1: 3 },
    { side: "front", from: 1, to: 3, c0: 1, c1: 3 },
    { side: "back", from: -7, to: -5, c0: 1, c1: 3 },
    { side: "back", from: 1, to: 3, c0: 1, c1: 3 },
    { side: "left", from: 2, to: 4, c0: 1, c1: 3 },
    { side: "right", from: 2, to: 4, c0: 1, c1: 3 },
  ];
  ringWall(m, {
    x0: X0,
    x1: X1,
    z0: Z0,
    z1: Z1,
    level: UPPER,
    courses: UPPER_COURSES,
    openings,
    color: () => WALL,
  });
  for (const x of [-7, -3, 1])
    window(m, "60592.dat", "60601.dat", x, Z0, UPPER + 3, 0);
  for (const x of [-7, 1])
    window(m, "60592.dat", "60601.dat", x, Z1, UPPER + 3, 180);
  window(m, "60592.dat", "60601.dat", X0, 2, UPPER + 3, 90);
  window(m, "60592.dat", "60601.dat", X1, 2, UPPER + 3, 270);
  return m;
}

const SLOPE: Record<number, string> = {
  1: "3040b.dat",
  2: "3039.dat",
  3: "3038.dat",
  4: "3037.dat",
};

function roof() {
  const m = new Model("house-roof.ldr", "Roof and chimney");
  floorPlates(m, ATTIC, TRIM);
  // Roof runs x −10..5 (a stud of overhang past each gable) and z −3..8.
  const RX0 = X0 - 1,
    RX1 = X1 + 1;
  const chimney = { x0: 1, x1: 2, z0: 4, z1: 5 };
  const lengths = Object.keys(SLOPE).map(Number);
  // Five stepped layers per side; each slope clutches the stud row below.
  for (const side of ["front", "back"] as const) {
    let below = new Set<number>();
    for (let k = 0; k < 5; k++) {
      const level = ROOF_BASE + 3 * k;
      // Front slopes face −Z (turn 0); back slopes are turned round.
      const zMin = side === "front" ? Z0 - 1 + k : Z1 - k;
      const cells = side === "front" ? [zMin, zMin + 1] : [zMin, zMin + 1];
      const cut = cells.some((z) => z >= chimney.z0 && z <= chimney.z1);
      const runs: [number, number][] = cut
        ? [
            [RX0, chimney.x0],
            [chimney.x1 + 1, RX1 + 1],
          ]
        : [[RX0, RX1 + 1]];
      const next = new Set<number>();
      for (const [s, e] of runs) {
        const local = new Set(
          [...below].filter((p) => p > s && p < e).map((p) => p - s),
        );
        // Alternate the joints course to course (running bond).
        if (k % 2) local.add(4);
        const pieces = bond(e - s, lengths, local);
        let at = s;
        for (const len of pieces) {
          m.put(SLOPE[len], ROOF, at, zMin, level, side === "front" ? 0 : 180);
          at += len;
        }
        for (const j of joints(pieces, s)) next.add(j);
        next.add(s).add(e);
      }
      below = next;
    }
  }
  // Gable end walls fill between the slope layers at x = X0 and X1.
  for (let k = 0; k < 4; k++) {
    const z0 = Z0 + 1 + k,
      z1 = Z1 - 1 - k;
    for (const x of [X0, X1]) {
      let at = z0;
      for (const len of bond(z1 - z0 + 1, [1, 2, 3, 4, 6, 8], new Set())) {
        m.put(BRICK_1[len], WALL, x, at, ROOF_BASE + 3 * k, 90);
        at += len;
      }
    }
  }
  // Ridge: 2 × 2 double slopes over the two top stud rows (z 2..3).
  for (let x = RX0; x <= RX1; x += 2)
    m.put("3043.dat", ROOF, x, Z0 + 4, ROOF_BASE + 15);
  // Chimney: 2 × 2 bricks from the attic floor through the back slope.
  for (let c = 0; c < 7; c++)
    m.put(
      "3003.dat",
      c % 2 ? CHIMNEY : CHIMNEY,
      chimney.x0,
      chimney.z0,
      ROOF_BASE + 3 * c,
    );
  m.put("3022.dat", 72, chimney.x0, chimney.z0, ROOF_BASE + 21);
  m.put("3068b.dat", 0, chimney.x0, chimney.z0, ROOF_BASE + 22);
  return m;
}

function garden() {
  const m = new Model("house-garden.ldr", "Garden");
  m.raw("3811.dat", 2, [0, 0, 0]); // baseplate top at y = 0
  // Path from the garden gate towards the door: 2 × 4 tiles. It stops short
  // of the door's swing (a 67 LDU leaf opening outwards over the lawn), so
  // Play can open the door; potted flowers stand either side of the step.
  for (let z = -16; z < -6; z += 2) m.put("87079.dat", PATH, -4, z, 0);
  for (const [x, color] of [
    [-5, 14],
    [0, 13],
  ] as const) {
    m.put("3062b.dat", 70, x, -3, 0);
    m.put("24866.dat", color, x, -3, 3);
  }
  // Picket fence along the front with a gate gap for the path.
  for (const x of [-16, -12, -8]) m.put("33303.dat", FENCE, x, -16, 0);
  for (const x of [0, 4, 8, 12]) m.put("33303.dat", FENCE, x, -16, 0);
  for (const x of [-16, 15])
    for (const z of [-15, -11, -7]) m.put("33303.dat", FENCE, x, z, 0, 90);
  // Gate posts.
  for (const x of [-5, 0]) m.put("3062b.dat", FENCE, x, -15, 0);
  // Flower beds along the front wall.
  const flowers = [5, 14, 4, 15, 13, 191];
  let bloom = 0;
  for (const x0 of [-10, 0]) {
    m.put("3020.dat", SOIL, x0, -5, 0);
    for (let x = x0; x < x0 + 4; x++)
      for (const z of [-5, -4])
        if ((x + z + 100) % 2 === 0)
          m.put("24866.dat", flowers[bloom++ % flowers.length], x, z, 1);
  }
  // Side garden: fruit tree, a round pond with lily pads, a bench and plants.
  m.put("3470.dat", LEAF, 8, -13, 0);
  m.put("24866.dat", 13, 13, -13, 0);
  m.put("24866.dat", 14, 7, -9, 0);
  m.put("24866.dat", 5, 14, -11, 0);
  m.put("60474.dat", WATER, 8, -4, 0);
  m.put("98138.dat", BRIGHT_LEAF, 9, -3, 1);
  m.put("98138.dat", BRIGHT_LEAF, 10, -2, 1);
  m.put("6255.dat", BRIGHT_LEAF, 7, 3, 0);
  m.put("30176.dat", LEAF, 6, 9, 0);
  // Bench: 2 × 4 seat on four 1 × 1 legs, with a lattice backrest.
  for (const [x, z] of [
    [9, -8],
    [12, -8],
    [9, -7],
    [12, -7],
  ] as const)
    m.put("3005.dat", 70, x, z, 0);
  m.put("3020.dat", 70, 9, -8, 3);
  m.put("2431.dat", 19, 9, -8, 4);
  m.put("3633.dat", 70, 9, -7, 4);
  // Mailbox by the gate: a post, a box and a curved lid.
  m.put("3062b.dat", 70, 2, -15, 0);
  m.put("3062b.dat", 70, 2, -15, 3);
  m.put("3004.dat", 1, 2, -15, 6, 90);
  m.put("11477.dat", 1, 2, -15, 9, 90);
  // Vegetable patch on the left: rows of lettuces.
  m.put("3032.dat", SOIL, -15, -12, 0, 90);
  for (let x = -15; x < -11; x++)
    for (let z = -12; z < -6; z++)
      if ((x + z + 100) % 2 === 0) m.put("33291.dat", BRIGHT_LEAF, x, z, 1);
  // Back garden trees.
  m.put("3471.dat", 288, -15, 9, 0);
  m.put("2435.dat", 288, 9, 10, 0);
  m.put("2435.dat", LEAF, 12, 5, 0);
  m.put("3470.dat", BRIGHT_LEAF, -15, 1, 0);
  return m;
}

export function houseSource() {
  return mpd(
    "house-with-garden.mpd",
    "House with garden",
    [
      "Original template build; official LDraw parts only.",
      "Front faces -Z. Baseplate top is y = 0; one plate = 8 LDU.",
    ],
    [garden(), groundFloor(), upperFloor(), roof()],
  );
}
