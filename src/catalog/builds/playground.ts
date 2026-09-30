/**
 * "Playground park": an original CC0 build from official LDraw parts that
 * shows dynamic physics in Play.
 *
 * On a 32 × 32 baseplate: a paved plaza with loose wooden crates and two
 * barrels, a see-saw on a pivot post, a roundabout on a round post, a swing
 * hanging from a frame, a small ramp, trees, flowers, a bench and a fence.
 * Fronts face −Z.
 *
 * Every moving thing is its own motion rig. The crates and barrels are
 * single-group rigs marked loose (`anchored: false`), so dynamic Play gives
 * them gravity and the explorer can push them; they stand on smooth tiles, so
 * they slide instead of catching on studs. The see-saw plank, the roundabout
 * and the swing seat turn on revolute joints about their posts. All rigs ask
 * Play to start with Dynamic physics (`dynamics.startDynamic`), and the
 * project carries a short Play hint. Kinematic Play still works: joints move
 * with the contextual action and the loose objects stay put.
 *
 * Budget: 9 dynamic rigs and 12 bodies, within Play's 14-rig, 64-body limits.
 */
import type { Basis, Project, Vec3 } from "../../core/types";
import { importLDraw } from "../../ldraw/io";
import { occurrences } from "../../core/document";
import type { MotionRig, RigDynamics } from "../../mechanisms/types";
import { Model, basis, mpd } from "./kit";

const GRASS = 2,
  PAVING = 19, // tan
  CRATE = 70, // reddish brown
  CRATE_TOP = 28, // dark tan
  POST = 71, // light bluish grey
  DARK = 72, // dark bluish grey
  PLANK = 1, // blue
  SEAT = 4, // red
  HANDLE = 14, // yellow
  WHITE = 15,
  WOOD = 70,
  LEAF = 2,
  BRIGHT_LEAF = 10;

/** The play hint shown as Play starts. */
export const PLAYGROUND_HINT = "Push the crates and barrels, then swing!";

/** Pivots (LDraw world coordinates). */
export const SEESAW_PIVOT: Vec3 = [120, -48, -180];
export const ROUNDABOUT_AXLE: Vec3 = [240, -24, -200];
export const SWING_PIVOT: Vec3 = [-180, -144, 170];

function grounds() {
  const m = new Model("playground-grounds.ldr", "Park");
  m.raw("3811.dat", GRASS, [0, 0, 0]);
  // Paved plaza for the loose crates and barrels (smooth tiles).
  for (let z = -16; z <= -4; z += 2)
    for (let x = -15; x <= -3; x += 4) m.put("87079.dat", PAVING, x, z, 0);
  // Ramp: up, a studded top, down (along +Z).
  for (const x of [4, 6]) {
    m.put("3298.dat", DARK, x, 2, 0);
    m.put("3001.dat", POST, x, 5, 0, 90);
    m.put("3298.dat", DARK, x, 9, 0, 180);
  }
  // Bench.
  m.put("3005.dat", WOOD, -3, 5, 0);
  m.put("3005.dat", WOOD, 0, 5, 0);
  m.put("3710.dat", WOOD, -3, 5, 3);
  // Trees, flowers and the back fence.
  m.put("3471.dat", LEAF, -16, 11, 0);
  m.put("3471.dat", LEAF, 12, 11, 0);
  m.put("3470.dat", BRIGHT_LEAF, 10, 2, 0);
  for (const [x, z] of [
    [2, 12],
    [-3, 12],
    [14, -3],
    [-15, 1],
  ] as const)
    m.put("4728.dat", 14, x, z, 0);
  for (let x = -12; x <= 8; x += 4) m.put("30055.dat", WHITE, x, 15, 0);
  return m;
}

/** A crate: two stacked bricks with a tile lid, standing on the plaza. */
function crate(n: number, x: number, z: number, long = false) {
  const m = new Model(`playground-crate-${n}.ldr`, `Crate ${n}`);
  const brick = long ? "3001.dat" : "3003.dat",
    lid = long ? "87079.dat" : "3068b.dat";
  m.put(brick, CRATE, x, z, 1);
  m.put(brick, CRATE, x, z, 4);
  m.put(lid, CRATE_TOP, x, z, 7);
  return m;
}

/** A barrel: two round bricks with a round tile lid. */
function barrel(n: number, x: number, z: number, color: number) {
  const m = new Model(`playground-barrel-${n}.ldr`, `Barrel ${n}`);
  m.put("3941.dat", color, x, z, 1);
  m.put("3941.dat", color, x, z, 4);
  m.put("14769.dat", DARK, x, z, 7);
  return m;
}

/** See-saw: a post and a plank (along Z) with seats and handles. */
function seesaw() {
  const post = new Model("playground-seesaw-post.ldr", "See-saw post");
  post.put("3003.dat", POST, 5, -10, 0);
  post.put("3003.dat", POST, 5, -10, 3);
  const plank = new Model("playground-seesaw.ldr", "See-saw plank");
  plank.put("3832.dat", PLANK, 5, -14, 6, 90);
  for (const z of [-14, -5]) plank.put("3004.dat", SEAT, 5, z, 7);
  for (const z of [-12, -7])
    for (const x of [5, 6]) plank.put("4589.dat", HANDLE, x, z, 7);
  return [post, plank];
}

/** Roundabout: a round post and a turning platform with handles. */
function roundabout() {
  const post = new Model("playground-roundabout-post.ldr", "Roundabout post");
  post.put("3941.dat", DARK, 11, -11, 0);
  const deck = new Model("playground-roundabout.ldr", "Roundabout");
  deck.put("3958.dat", SEAT, 9, -13, 3);
  for (const [x, z] of [
    [9, -13],
    [14, -13],
    [9, -8],
    [14, -8],
  ] as const) {
    deck.put("3062b.dat", WHITE, x, z, 4);
    deck.put("3062b.dat", WHITE, x, z, 7);
    deck.put("4589.dat", HANDLE, x, z, 10);
  }
  deck.put("3942c.dat", HANDLE, 11, -11, 4);
  return [post, deck];
}

/** Swing: two posts under a beam; the seat hangs on two bars. */
function swing() {
  const frame = new Model("playground-swing-frame.ldr", "Swing frame");
  for (const x of [-13, -6])
    for (let level = 0; level < 18; level += 3)
      frame.put("3062b.dat", SEAT, x, 8, level);
  frame.put("3460.dat", DARK, -13, 8, 18);
  frame.put("4162.dat", DARK, -13, 8, 19);
  const seat = new Model("playground-swing.ldr", "Swing seat");
  // Antennas upside down: their bases under the beam, their tips at the seat.
  const flip: Basis = [1, 0, 0, 0, -1, 0, 0, 0, -1];
  for (const x of [-210, -150])
    seat.raw("3957a.dat", 0, [x, SWING_PIVOT[1] + 8, SWING_PIVOT[2]], flip);
  seat.put("3710.dat", WOOD, -11, 8, 5);
  return [frame, seat];
}

export function playgroundSource() {
  return mpd(
    "playground-park.mpd",
    "Playground park",
    [
      "Original template build; official LDraw parts only.",
      "Fronts face -Z. Baseplate top is y = 0; one plate = 8 LDU.",
      "Loose crates and barrels, see-saw, roundabout and swing are rigs.",
    ],
    [
      grounds(),
      crate(1, -14, -14),
      crate(2, -9, -12, true),
      crate(3, -13, -8),
      crate(4, -5, -15),
      barrel(1, -7, -7, 1),
      barrel(2, -3, -10, 4),
      ...seesaw(),
      ...roundabout(),
      ...swing(),
    ],
  );
}

/** The park with its rigs; Play starts with Dynamic physics. */
export function playgroundProject(): Project {
  const project = importLDraw(playgroundSource(), "playground-park.mpd");
  project.title = "Playground park";
  const all = occurrences(project);
  const members = (model: string) => {
    const found = all.filter((o) => o.modelId === model);
    if (!found.length)
      throw new Error("Playground section not found: " + model);
    return found;
  };
  const group = (id: string, model: string, frame: Vec3) => {
    const list = members(model);
    return {
      id,
      occurrenceIds: list.map((o) => o.id),
      frame: { position: [...frame] as Vec3, basis: basis(0) },
      restTransforms: Object.fromEntries(
        list.map((o) => [o.id, structuredClone(o.transform)]),
      ),
    };
  };
  const dynamics = (groups: RigDynamics["groups"]): RigDynamics => ({
    groups,
    startDynamic: true,
  });
  /** Base centre of a section's parts (the frame of a loose object). */
  const base = (model: string): Vec3 => {
    const list = members(model);
    const xs = list.map((o) => o.transform.position[0]),
      zs = list.map((o) => o.transform.position[2]);
    return [
      (Math.min(...xs) + Math.max(...xs)) / 2,
      -8,
      (Math.min(...zs) + Math.max(...zs)) / 2,
    ];
  };
  const rigs: Record<string, MotionRig> = {};
  const loose = (id: string, name: string, model: string, massKg: number) => {
    rigs[id] = {
      schemaVersion: 1,
      id,
      name,
      mode: "kinematic",
      groups: [group("body", model, base(model))],
      joints: [],
      dynamics: dynamics({ body: { anchored: false, massKg } }),
    };
  };
  for (const n of [1, 2, 3, 4])
    loose(
      `crate-${n}`,
      `Crate ${n}`,
      `playground-crate-${n}.ldr`,
      n === 2 ? 8 : 5,
    );
  for (const n of [1, 2])
    loose(`barrel-${n}`, `Barrel ${n}`, `playground-barrel-${n}.ldr`, 4);
  const hinge = (
    id: string,
    name: string,
    fixed: string,
    moving: string,
    pivot: Vec3,
    axis: Vec3,
    limits: [number, number] | undefined,
    massKg: number,
  ): MotionRig => ({
    schemaVersion: 1,
    id,
    name,
    mode: "kinematic",
    groups: [group("post", fixed, pivot), group("moving", moving, pivot)],
    joints: [
      {
        id: "pivot",
        kind: "revolute",
        bodyA: "post",
        bodyB: "moving",
        anchorA: [0, 0, 0],
        anchorB: [0, 0, 0],
        axisA: axis,
        axisB: axis,
        ...(limits ? { limits } : {}),
      },
    ],
    dynamics: dynamics({ moving: { anchored: false, massKg } }),
  });
  rigs.seesaw = hinge(
    "seesaw",
    "See-saw",
    "playground-seesaw-post.ldr",
    "playground-seesaw.ldr",
    SEESAW_PIVOT,
    [1, 0, 0],
    [-15, 15],
    10,
  );
  rigs.roundabout = hinge(
    "roundabout",
    "Roundabout",
    "playground-roundabout-post.ldr",
    "playground-roundabout.ldr",
    ROUNDABOUT_AXLE,
    [0, -1, 0],
    undefined,
    20,
  );
  rigs.swing = hinge(
    "swing",
    "Swing",
    "playground-swing-frame.ldr",
    "playground-swing.ldr",
    SWING_PIVOT,
    [1, 0, 0],
    [-70, 70],
    5,
  );
  project.motionRigs = rigs;
  project.scene = { playHint: PLAYGROUND_HINT };
  return project;
}
