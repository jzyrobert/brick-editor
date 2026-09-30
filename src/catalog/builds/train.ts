/**
 * "Railway station": an original CC0 train layout from official LDraw parts.
 *
 * An oval of 6-stud-wide plastic track (Train Track Straight 53401 and R40
 * Curves 53400) with a 9V left switch (75542-f1) on the near straight
 * leading to a siding inside the oval; a station with a platform, a small
 * station building, lampposts, benches and flowers on a 32 × 32 baseplate;
 * and a short train: a red locomotive with a cab front (2924bc01), a green
 * passenger coach and an open goods wagon, each on a Train Base 6 × 24
 * (92088) riding on two Train Wheel Bogies (2878c01).
 *
 * The track lies on the ground (its sleepers' undersides at y = 0), rail
 * tops at y = −24. The train stands on the near straight heading +X, the
 * locomotive in front; the station faces −Z (the editor's default camera).
 * Play runs the train (docs/PLAY-TRAINS.md): press Go, and throw the points
 * to send it into the siding.
 */
import type { Project, Vec3 } from "../../core/types";
import { importLDraw } from "../../ldraw/io";
import { placeTrackPiece, type TrackCursor } from "../../play/track";
import {
  BRICK_1,
  Model,
  basis,
  bond,
  gableRoof,
  glazed,
  lens,
  mpd,
  ringWall,
  straightWall,
  type Opening,
} from "./kit";

export const TRAIN_HINT =
  "Press Go to start the train, then switch the points!";

// Colours (LDraw codes).
const TRACK = 72, // dark bluish grey
  GRASS = 2,
  PLATFORM = 71, // light bluish grey
  EDGE = 14, // yellow
  WALL = 19, // tan
  BASE_COURSE = 72,
  FRAME = 15, // white
  ROOF = 320, // dark red
  DOOR = 288, // dark green
  LOCO = 4, // red
  COACH = 288,
  WAGON = 70, // reddish brown
  CHASSIS = 0,
  CAB_ROOF = 72,
  STRIPE = 14;

/** Rail tops: the track's sleepers stand on the ground (y = 0). */
export const RAIL_Y = -24;
/** Bogies ride 63 LDU below the underside of their train base. */
const BASE_BOTTOM = RAIL_Y - 63;

type Step = "S" | "L" | "R" | "W";
/**
 * Track plan: the near straight runs +X along z = 0 from x = −640 (two
 * straights, the switch, one straight), eight curves turn to the far
 * straight at z = 1600, five straights run back and eight curves close the
 * oval. The siding leaves the switch's diverging end, a curve brings it
 * parallel 16 studs in (z = 320), and one straight ends at x = 1280.
 */
export const TRACK_PLAN: { start: TrackCursor; oval: Step[]; siding: Step[] } =
  {
    start: { position: [-640, RAIL_Y, 0], direction: [1, 0] },
    oval: [
      "S",
      "S",
      "W",
      "S",
      ...Array<Step>(8).fill("L"),
      ...Array<Step>(5).fill("S"),
      ...Array<Step>(8).fill("L"),
    ],
    siding: ["R", "S"],
  };

function track() {
  const m = new Model("train-track.ldr", "Track and points");
  let cursor = TRACK_PLAN.start;
  let branch: TrackCursor | undefined;
  const lay = (step: Step, at: TrackCursor) => {
    const [ref, inEnd, outEnd] =
      step === "S"
        ? ["53401.dat", 0, 1]
        : step === "L"
          ? ["53400.dat", 1, 0]
          : step === "R"
            ? ["53400.dat", 0, 1]
            : ["75542-f1.dat", 0, 1];
    const placed = placeTrackPiece(ref, at, inEnd);
    // Six decimals: curves and switches join within a hundredth of an LDU.
    const f = (n: number) => {
      const r = Math.round(n * 1e6) / 1e6;
      return Object.is(r, -0) ? "0" : String(r);
    };
    m.lines.push(
      `1 ${TRACK} ${[...placed.transform.position, ...placed.transform.basis].map(f).join(" ")} ${ref}`,
    );
    if (step === "W") branch = placed.ends[2];
    return placed.ends[outEnd];
  };
  for (const step of TRACK_PLAN.oval) cursor = lay(step, cursor);
  let side = branch!;
  for (const step of TRACK_PLAN.siding) side = lay(step, side);
  return m;
}

// Station: a 32 × 32 baseplate over cells x −24..7, z −36..−5 (world
// x −480..160, z −720..−80); the platform along the track.
const PX0 = -20,
  PX1 = 7,
  PZ0 = -10,
  PZ1 = -5;
// Station building: cells x −16..−1, z −24..−15 (front wall at z −24).
const BX0 = -16,
  BX1 = -1,
  BZ0 = -24,
  BZ1 = -15,
  COURSES = 6;

function station() {
  const m = new Model("train-station.ldr", "Station");
  m.raw("3811.dat", GRASS, [-160, 0, -400]);
  // Platform: three plates high (the explorer steps straight up), 28 × 6.
  const plates = (level: number, lengths: number[]) => {
    let x = PX0;
    for (const len of lengths) {
      m.put(len === 8 ? "3036.dat" : "3033.dat", PLATFORM, x, PZ0, level);
      x += len;
    }
  };
  plates(0, [10, 10, 8]);
  plates(1, [8, 10, 10]);
  // Tiles, a yellow edge, and two benches on the back row's studs.
  const benches = [-12, -4];
  for (let x = PX0; x <= PX1 - 3; x += 4) {
    if (benches.includes(x)) m.put("2431.dat", PLATFORM, x, PZ0 + 1, 2);
    else m.put("87079.dat", PLATFORM, x, PZ0, 2);
    m.put("87079.dat", PLATFORM, x, PZ0 + 2, 2);
    m.put("2431.dat", PLATFORM, x, PZ0 + 4, 2);
    m.put("2431.dat", EDGE, x, PZ1, 2);
  }
  for (const x0 of benches) {
    for (const x of [x0, x0 + 3]) m.put("3005.dat", 70, x, PZ0, 2);
    m.put("3710.dat", 70, x0, PZ0, 5);
    m.put("2431.dat", 19, x0, PZ0, 6);
  }
  // Lampposts at the platform's ends.
  for (const x of [-15, 2]) m.raw("723.dat", 72, [x * 20 + 10, -24, -170]);
  // The station building: white-framed windows, a door to the forecourt and
  // an open doorway onto the platform side.
  const openings: Opening[] = [
    { side: "front", from: -10, to: -6, c0: 0, c1: 6 }, // door frame
    { side: "front", from: -14, to: -12, c0: 1, c1: 4 },
    { side: "front", from: -4, to: -2, c0: 1, c1: 4 },
    { side: "back", from: -10, to: -6, c0: 0, c1: 5 }, // doorway
    { side: "back", from: -14, to: -12, c0: 1, c1: 4 },
    { side: "back", from: -4, to: -2, c0: 1, c1: 4 },
  ];
  ringWall(m, {
    x0: BX0,
    x1: BX1,
    z0: BZ0,
    z1: BZ1,
    level: 0,
    courses: COURSES,
    openings,
    color: (c) => (c === 0 ? BASE_COURSE : WALL),
  });
  m.put("60596.dat", FRAME, -10, BZ0, 0, 180);
  const frame = m.lines[m.lines.length - 1].split(" ").map(Number);
  m.raw(
    "60616a.dat",
    DOOR,
    [frame[2] + 32, frame[3], frame[4] - 5],
    basis(180),
  );
  for (const x of [-14, -4]) {
    glazed(m, "60593.dat", FRAME, x, BZ0, 3, 0);
    glazed(m, "60593.dat", FRAME, x, BZ1, 3, 180);
  }
  // The doorway's lintel: the sixth course spans it.
  // Floor inside (x −15..−2, z −23..−16).
  m.put("3036.dat", 19, -15, -23, 0, 90);
  m.put("3036.dat", 19, -9, -23, 0, 90);
  m.put("3034.dat", 19, -3, -23, 0, 90);
  // A counter with a ticket window.
  for (const x of [-15, -14, -13]) m.put("3005.dat", 15, x, -19, 1);
  m.put("3623.dat", 70, -15, -19, 4);
  // Roof: a 45° gable over the building.
  gableRoof(m, {
    x0: BX0,
    x1: BX1,
    z0: BZ0,
    z1: BZ1,
    level: 3 * COURSES,
    roof: ROOF,
    gable: WALL,
  });
  // Forecourt: a path to the door, flower beds and trees.
  for (let z = -34; z < -24; z += 2) m.put("87079.dat", 19, -10, z, 0);
  const flowers = [14, 4, 15, 13, 5, 191];
  let bloom = 0;
  for (const x0 of [-15, -5]) {
    m.put("3020.dat", 70, x0, -27, 0);
    for (let x = x0; x < x0 + 4; x++)
      for (const z of [-27, -26])
        if ((x + z + 100) % 2 === 0)
          m.put("24866.dat", flowers[bloom++ % flowers.length], x, z, 1);
  }
  m.put("3470.dat", GRASS, -22, -32, 0);
  m.put("3471.dat", 288, 2, -33, 0);
  m.put("2435.dat", GRASS, -22, -20, 0);
  m.put("3470.dat", 10, 3, -22, 0);
  return m;
}

/** A car's parts, in car-local LDU: base underside y = 0, X forward. */
function carBase(m: Model) {
  m.put("92088.dat", CHASSIS, -12, -3, 0);
  for (const x of [-160, 160])
    m.raw("2878c01.dat", CHASSIS, [x, 0, 0], basis(90));
}
/** Base top: plate level 2 (y = −16) in car-local plate levels. */
const DECK = 2;

function loco(centre: number) {
  const m = new Model("train-loco.ldr", "Locomotive");
  m.placement = { position: [centre, BASE_BOTTOM, 0], basis: basis(0) };
  carBase(m);
  // Cab front with windows at the front end (cells x 9..10), headlights on
  // the last row either side of a grille.
  m.put("2924bc01.dat", LOCO, 9, -3, DECK, 90);
  for (const z of [-3, 2]) {
    m.put("4070.dat", 15, 11, z, DECK, 270);
    lens(m, 46);
  }
  m.put("3004.dat", STRIPE, 11, -1, DECK, 90);
  m.put("2412b.dat", 72, 11, -1, DECK + 3, 90);
  // Cab sides: windows between posts, x 3..8.
  for (const z of [-3, 2]) {
    m.put("3009.dat", LOCO, 3, z, DECK);
    for (const c of [0, 1, 2]) m.put("3005.dat", LOCO, 3, z, DECK + 3 + 3 * c);
    m.put("4033c01.dat", 15, 4, z, DECK + 3);
    for (const c of [0, 1, 2]) m.put("3005.dat", LOCO, 8, z, DECK + 3 + 3 * c);
    m.put("3009.dat", STRIPE, 3, z, DECK + 12);
    m.put("3666.dat", LOCO, 3, z, DECK + 15);
  }
  // Cab back wall with a window.
  m.put("3010.dat", LOCO, 3, -2, DECK, 90);
  for (const c of [0, 1, 2]) {
    m.put("3005.dat", LOCO, 3, -2, DECK + 3 + 3 * c);
    m.put("3005.dat", LOCO, 3, 1, DECK + 3 + 3 * c);
  }
  m.put("4035c01.dat", 15, 3, -1, DECK + 3, 90);
  m.put("3010.dat", LOCO, 3, -2, DECK + 12, 90);
  m.put("3710.dat", LOCO, 3, -2, DECK + 15, 90);
  // Cab roof over the cab and the front (x 3..10): an 8 × 6 plate, tiles.
  m.put("3036.dat", CAB_ROOF, 3, -3, DECK + 16);
  for (const x of [3, 7]) m.put("87079.dat", CAB_ROOF, x, -1, DECK + 17);
  // Hood behind the cab (x −11..2), four wide, two bricks high.
  for (const at of [-2, 0])
    straightWall(m, {
      alongX: true,
      at,
      from: -11,
      to: 3,
      level: DECK,
      courses: 2,
      thickness: 2,
      color: () => LOCO,
    });
  for (const [x, len] of [
    [-11, 4],
    [-7, 4],
    [-3, 4],
    [1, 2],
  ] as const)
    for (const z of [-2, 0])
      m.put(
        len === 4 ? "87079.dat" : "3068b.dat",
        z ? STRIPE : 72,
        x,
        z,
        DECK + 6,
      );
  // Walkways either side of the hood and a rear light.
  for (const z of [-3, 2]) {
    m.put("3666.dat", 72, -12, z, DECK);
    m.put("3666.dat", 72, -6, z, DECK);
    m.put("3623.dat", 72, 0, z, DECK);
  }
  m.put("3710.dat", 72, -12, -2, DECK, 90);
  m.put("3070b.dat", 36, -12, -1, DECK + 1);
  m.put("3070b.dat", 36, -12, 0, DECK + 1);
  return m;
}

function coach(centre: number) {
  const m = new Model("train-coach.ldr", "Passenger coach");
  m.placement = { position: [centre, BASE_BOTTOM, 0], basis: basis(0) };
  carBase(m);
  // Sides: a sill course, three windows between posts, a top course.
  for (const z of [-3, 2]) {
    let x = -12;
    for (const len of bond(24, [8, 6, 4], new Set())) {
      m.put(BRICK_1[len], COACH, x, z, DECK);
      x += len;
    }
    for (const [x0, len] of [
      [-12, 4],
      [-4, 2],
      [2, 2],
      [8, 4],
    ] as const)
      for (const c of [0, 1, 2])
        m.put(BRICK_1[len], COACH, x0, z, DECK + 3 + 3 * c);
    for (const x0 of [-8, -2, 4]) m.put("4033c01.dat", 15, x0, z, DECK + 3);
    let top = -12;
    for (const len of bond(24, [8, 6, 4], new Set([8, 16]))) {
      m.put(BRICK_1[len], STRIPE, top, z, DECK + 12);
      top += len;
    }
  }
  // Ends: four wide, five courses, a window in each.
  for (const x of [-12, 11]) {
    m.put("3010.dat", COACH, x, -2, DECK, 90);
    for (const c of [0, 1, 2]) {
      m.put("3005.dat", COACH, x, -2, DECK + 3 + 3 * c);
      m.put("3005.dat", COACH, x, 1, DECK + 3 + 3 * c);
    }
    m.put("4035c01.dat", 15, x, -1, DECK + 3, 90);
    m.put("3010.dat", COACH, x, -2, DECK + 12, 90);
  }
  // Seats inside: benches of 1 × 4 bricks with tile tops.
  for (const x of [-9, -3, 3]) {
    m.put("3010.dat", 70, x, -2, DECK, 90);
    m.put("2431.dat", 19, x, -2, DECK + 3, 90);
  }
  // Roof: three 6 × 8 plates and a row of tiles.
  for (const x of [-12, -4, 4]) m.put("3036.dat", 72, x, -3, DECK + 15);
  for (const x of [-12, -8, -4, 0, 4, 8])
    m.put("87079.dat", 71, x, -1, DECK + 16);
  return m;
}

function wagon(centre: number) {
  const m = new Model("train-wagon.ldr", "Goods wagon");
  m.placement = { position: [centre, BASE_BOTTOM, 0], basis: basis(0) };
  carBase(m);
  // Low sides and ends: two courses.
  for (const c of [0, 1]) {
    for (const z of [-3, 2]) {
      let x = -12;
      for (const len of bond(24, [8, 6, 4], c ? new Set([8, 16]) : new Set())) {
        m.put(BRICK_1[len], WAGON, x, z, DECK + 3 * c);
        x += len;
      }
    }
    for (const x of [-12, 11])
      m.put("3010.dat", WAGON, x, -2, DECK + 3 * c, 90);
  }
  // Cargo: crates and barrels.
  for (const [x, z, color] of [
    [-10, -2, 14],
    [-10, 0, 1],
    [-6, -1, 4],
  ] as const) {
    m.put("3003.dat", color, x, z, DECK);
    m.put("3068b.dat", color, x, z, DECK + 3);
  }
  for (const [x, z] of [
    [2, -2],
    [2, 0],
    [6, -1],
  ] as const) {
    m.put("3941.dat", 72, x, z, DECK);
    m.put("3941.dat", 72, x, z, DECK + 3);
    m.put("14769.dat", 0, x, z, DECK + 6);
  }
  return m;
}

/** Car centres along the near straight: loco, coach, wagon (16 LDU gaps). */
export const TRAIN_CARS: Vec3 = [700, 204, -292];

export function trainSource() {
  return mpd(
    "railway-station.mpd",
    "Railway station",
    [
      "Original template build; official LDraw parts only.",
      "Track sleepers stand on the ground (y = 0); rail tops at y = -24.",
      "Play runs the train along the rails (docs/PLAY-TRAINS.md).",
    ],
    [
      track(),
      station(),
      loco(TRAIN_CARS[0]),
      coach(TRAIN_CARS[1]),
      wagon(TRAIN_CARS[2]),
    ],
  );
}

export function trainProject(): Project {
  const project = importLDraw(trainSource(), "railway-station.mpd");
  project.title = "Railway station";
  project.scene = { playHint: TRAIN_HINT };
  return project;
}
