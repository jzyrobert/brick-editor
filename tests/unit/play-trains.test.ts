import { beforeAll, describe, expect, it } from "vitest";
import { registerFullLibraryFromDisk } from "../../scripts/full-library-node";
import { registeredFullLibrary } from "../../src/catalog/full-library";
import { transformBounds } from "../../src/core/spatial";
import { compose, rotationY } from "../../src/core/math";
import type { Occurrence, Transform, Vec3 } from "../../src/core/types";
import {
  TRAIN_LIMITS,
  TrainWorld,
  deriveTrains,
  type DerivedTrains,
} from "../../src/play/trains";
import {
  placeTrackPiece,
  projectOnTrack,
  type TrackCursor,
} from "../../src/play/track";

beforeAll(() => {
  expect(registerFullLibraryFromDisk()).toBe(true);
});
const bounds = (o: Occurrence) => {
  const b = registeredFullLibrary()!.index.parts[o.node.ref]?.[1];
  return b
    ? transformBounds(
        { min: [b[0], b[1], b[2]], max: [b[3], b[4], b[5]] },
        o.transform,
      )
    : null;
};
let serial = 0;
const occ = (ref: string, transform: Transform): Occurrence => {
  const id = `o${++serial}`;
  return {
    id,
    path: [id],
    node: { id, kind: "part", ref, colorCode: "16", transform },
    modelId: "main",
    transform,
    colorCode: "16",
    layerId: "default",
    namespace: "official",
    visible: true,
  } as unknown as Occurrence;
};
/** Lay pieces from a cursor: S straight, L/R curves, W+/W- a right switch
 * (straight or branch onward). Returns occurrences and the open cursors. */
function lay(start: TrackCursor, plan: string[], world: Transform) {
  const out: Occurrence[] = [];
  const open: TrackCursor[] = [];
  let cursor = start;
  for (const step of plan) {
    const [ref, inEnd, outEnd] =
      step === "S"
        ? ["53401", 0, 1]
        : step === "L"
          ? ["53400", 1, 0]
          : step === "R"
            ? ["53400", 0, 1]
            : step === "W+"
              ? ["75541-f1", 0, 1]
              : ["75541-f2", 0, 2];
    const placed = placeTrackPiece(ref, cursor, inEnd);
    out.push(occ(ref + ".dat", compose(world, placed.transform)));
    if (ref.startsWith("75541")) open.push(placed.ends[outEnd === 1 ? 2 : 1]);
    cursor = placed.ends[outEnd];
  }
  return { out, cursor, open };
}
const RAIL_Y = -24;
/** A car along +X centred at x, on rails at RAIL_Y: base, two bogies. */
function car(
  x: number,
  base: string,
  half: number,
  world: Transform,
  front = false,
) {
  const baseY = RAIL_Y - 79;
  const parts = [
    occ(
      base + ".dat",
      compose(world, {
        position: [x, baseY, 0],
        basis: [1, 0, 0, 0, 1, 0, 0, 0, 1],
      }),
    ),
    ...[-1, 1].map((s) =>
      occ(
        "2878c01.dat",
        compose(world, {
          position: [x + s * (half - 80), baseY + 16, 0],
          basis: rotationY(90),
        }),
      ),
    ),
  ];
  if (front)
    parts.push(
      occ(
        "2917.dat",
        compose(world, {
          position: [x + half - 60, baseY - 80, 0],
          basis: rotationY(-90),
        }),
      ),
    );
  return parts;
}
const identity: Transform = {
  position: [0, 0, 0],
  basis: [1, 0, 0, 0, 1, 0, 0, 0, 1],
};
/**
 * An oval (4 straights each side, 8 curves each end) and a two-car train on
 * the near straight heading +X; optional world transform.
 */
function ovalWorld(
  world = identity,
  extra: (w: Transform) => Occurrence[] = () => [],
) {
  serial = 0;
  const start: TrackCursor = { position: [0, RAIL_Y, 0], direction: [1, 0] };
  const plan = [
    "S",
    "S",
    "S",
    "S",
    ...Array(8).fill("L"),
    "S",
    "S",
    "S",
    "S",
    ...Array(8).fill("L"),
  ];
  const track = lay(start, plan, world);
  const train = [
    ...car(980, "92339", 280, world, true),
    ...car(450, "92088", 240, world),
  ];
  return [...track.out, ...train, ...extra(world)];
}
const derive = (all: Occurrence[]) =>
  deriveTrains({ all, reserved: new Set(), bounds });

describe("train derivation", () => {
  it("finds a locomotive and a wagon on an oval", () => {
    const d = derive(ovalWorld());
    expect(d.graph.pieces).toHaveLength(24);
    expect(d.graph.gaps).toEqual([]);
    expect(d.graph.deadEnds).toEqual([]);
    expect(d.skipped).toEqual([]);
    expect(d.trains).toHaveLength(1);
    const [t] = d.trains;
    expect(t.name).toBe("Train 1");
    expect(t.cars.map((c) => c.locomotive)).toEqual([true, false]);
    expect(t.cars.map((c) => c.bogies.length)).toEqual([2, 2]);
    // Pivots: bogie centres 400 and 320 apart, the wagon's front pivot
    // 10 + 80 + 80 = 170 behind the loco's rear pivot.
    const [loco, wagon] = t.cars;
    expect(loco.pivots[0]).toBeCloseTo(0, 6);
    expect(loco.pivots[1]).toBeCloseTo(400, 6);
    expect(wagon.pivots[0]).toBeCloseTo(570, 6);
    expect(wagon.pivots[1]).toBeCloseTo(890, 6);
    // The sloping front reaches 100 LDU past the front bogie.
    expect(t.frontOverhang).toBeCloseTo(100, 6);
    expect(t.rearOverhang).toBeCloseTo(80, 6);
    expect(d.occurrenceIds).toHaveLength(7);
  });
  it("ignores wheels that are not on the rails", () => {
    const all = ovalWorld(identity, (w) =>
      car(
        0,
        "92339",
        280,
        compose(w, { position: [0, 0, 600], basis: identity.basis }),
      ),
    );
    const d = derive(all);
    expect(d.trains).toHaveLength(1);
    expect(d.trains[0].cars).toHaveLength(2);
  });
});

function run(
  d: DerivedTrains,
  ticks: number,
  throttle = 1,
  each?: (w: TrainWorld) => void,
) {
  const w = new TrainWorld(d);
  w.setThrottle(throttle);
  for (let i = 0; i < ticks; i++) {
    w.step();
    each?.(w);
  }
  return w;
}

describe("running trains", () => {
  it("keeps every bogie on the centreline and the cars coupled", () => {
    const d = derive(ovalWorld());
    const bogieIds = d.trains[0].cars.flatMap((c) =>
      c.bogies.map((b) => b.occurrenceIds[0]),
    );
    let worst = 0,
      spacing: number[] = [];
    const w = run(d, 1200, 1, (w) => {
      const t = w.transforms();
      const points = bogieIds.map((id) => {
        // The bogie's wheel centre over the rails: its origin, down to the rail top.
        const p = t[id].position;
        return [p[0], RAIL_Y, p[2]] as Vec3;
      });
      for (const p of points)
        worst = Math.max(worst, projectOnTrack(d.graph, p, 80)!.lateral);
      spacing.push(
        Math.hypot(points[1][0] - points[2][0], points[1][2] - points[2][2]),
      );
    });
    const report = w.report().trains[0];
    // Bogies turn on their pivots: each stays on the centreline (a bogie's
    // origin is its axle centre, on the rails).
    expect(worst).toBeLessThan(0.01);
    // Couplers hold: the chord between the loco's rear and the wagon's front
    // pivots only shortens a little on curves (170 LDU of track).
    expect(Math.max(...spacing)).toBeCloseTo(170, 3);
    expect(Math.min(...spacing)).toBeGreaterThan(169);
    expect(report.status).toBe("running");
    expect(report.speed).toBe(TRAIN_LIMITS.maxSpeed);
    // 20 s: accelerate for 480/180 s, then full speed.
    const accel = TRAIN_LIMITS.maxSpeed / TRAIN_LIMITS.acceleration;
    expect(report.odometer).toBeCloseTo(
      TRAIN_LIMITS.maxSpeed * (20 - accel) +
        (TRAIN_LIMITS.maxSpeed * accel) / 2,
      -1,
    );
  });
  it("is deterministic and follows rotated track", () => {
    const a = run(derive(ovalWorld()), 900).report();
    const b = run(derive(ovalWorld()), 900).report();
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    const world: Transform = { position: [123, 0, -456], basis: rotationY(33) };
    const c = run(derive(ovalWorld(world)), 900).report();
    expect(c.trains[0].odometer).toBeCloseTo(a.trains[0].odometer, 6);
    expect(c.trains[0].status).toBe("running");
  });
  it("reverses and brakes", () => {
    const d = derive(ovalWorld());
    const w = run(d, 120, 1);
    w.setThrottle(-1);
    for (let i = 0; i < 600; i++) w.step();
    const r = w.report().trains[0];
    expect(r.speed).toBe(-TRAIN_LIMITS.maxSpeed);
    w.setThrottle(0);
    for (let i = 0; i < 120; i++) w.step();
    expect(w.report().trains[0].speed).toBe(0);
    expect(w.report().trains[0].status).toBe("stopped");
  });
  it("stops at the end of the track", () => {
    serial = 0;
    const track = lay(
      { position: [0, RAIL_Y, 0], direction: [1, 0] },
      ["S", "S", "S", "S", "S"],
      identity,
    );
    const d = derive([...track.out, ...car(980, "92339", 280, identity, true)]);
    expect(d.graph.deadEnds).toHaveLength(2);
    const w = run(d, 600);
    const r = w.report().trains[0];
    expect(r.status).toBe("end-of-track");
    expect(r.speed).toBe(0);
    // The front overhang (80) stops at the last sleeper, x = 1600 − 160.
    expect(r.position[0]).toBeCloseTo(1600 - 100, 3);
  });
  it("takes the branch of a switch set to branch, and trails back through it", () => {
    serial = 0;
    const start: TrackCursor = { position: [0, RAIL_Y, 0], direction: [1, 0] };
    const main = lay(
      start,
      ["S", "S", "S", "S", "W-", "R", "S", "S"],
      identity,
    );
    const d = derive([...main.out, ...car(980, "92339", 280, identity, true)]);
    const sw = d.graph.pieces.find((p) => p.def.kind === "switch")!;
    expect(sw.def.defaultRoute).toBe(1);
    const w = run(d, 500);
    const r = w.report();
    expect(r.trains[0].status).toBe("end-of-track");
    // It ran onto the branch: the curve after the diverging end.
    expect(r.trains[0].position[2]).toBeLessThan(-259);
    // Refused while the train stands on the points.
    w.setThrottle(-1);
    for (let i = 0; i < 700; i++) w.step();
    expect(w.report().trains[0].position[0]).toBeLessThan(1000);
    w.setPoints(sw.occurrenceId, 0);
    expect(w.report().switches[0].route).toBe("straight");
  });
  it("refuses to throw points under a train", () => {
    serial = 0;
    const main = lay(
      { position: [0, RAIL_Y, 0], direction: [1, 0] },
      ["S", "S", "W+", "S", "S"],
      identity,
    );
    const d = derive([...main.out, ...car(820, "92339", 280, identity, true)]);
    const w = new TrainWorld(d);
    expect(() => w.setPoints(d.graph.pieces[2].occurrenceId)).toThrow(
      /train is on these points/,
    );
  });
  it("stops behind another train", () => {
    const d = derive(
      ovalWorld(identity, (w) =>
        car(
          600,
          "92088",
          240,
          compose(w, { position: [0, 0, 1600], basis: identity.basis }),
        ),
      ),
    );
    expect(d.trains).toHaveLength(2);
    const w = new TrainWorld(d);
    w.setThrottle(1, "train:1");
    for (let i = 0; i < 600; i++) w.step();
    const r = w.report().trains[0];
    expect(r.status).toBe("blocked");
    expect(r.reason).toMatch(/in the way/);
  });
  it("waits for the guard (the explorer on the track)", () => {
    const d = derive(ovalWorld());
    const w = new TrainWorld(d);
    w.setThrottle(1);
    for (let i = 0; i < 30; i++)
      w.step(() => "Waiting for you to step off the track");
    const r = w.report().trains[0];
    expect(r.status).toBe("waiting");
    expect(r.odometer).toBe(0);
    for (let i = 0; i < 30; i++) w.step();
    expect(w.report().trains[0].odometer).toBeGreaterThan(0);
  });
});

describe("the driver's lever (W/S while riding)", () => {
  it("accelerates while held, holds speed when released, brakes into reverse", () => {
    const w = new TrainWorld(derive(ovalWorld()));
    const report = () => w.report().trains[0];
    w.setDrive(1);
    for (let i = 0; i < 60; i++) w.step();
    // One second of acceleration; the notch tracks the speed.
    expect(report().speed).toBeCloseTo(TRAIN_LIMITS.acceleration, -1);
    expect(
      Math.abs(report().throttle * TRAIN_LIMITS.maxSpeed - report().speed),
    ).toBeLessThan(5);
    // Released: the notch stays, so the train holds its speed.
    w.setDrive(0);
    for (let i = 0; i < 10; i++) w.step();
    const held = report().speed;
    for (let i = 0; i < 120; i++) w.step();
    expect(report().speed).toBeCloseTo(held, 6);
    expect(report().status).toBe("running");
    // Held to full: never beyond top speed.
    w.setDrive(1);
    for (let i = 0; i < 600; i++) w.step();
    expect(report().speed).toBe(TRAIN_LIMITS.maxSpeed);
    expect(report().throttle).toBe(1);
    // Backward: brakes to a stop at the braking rate, then reverses.
    w.setDrive(-1);
    const stopTicks = Math.floor(
      (TRAIN_LIMITS.maxSpeed / TRAIN_LIMITS.braking) * 60,
    );
    for (let i = 0; i < stopTicks - 3; i++) w.step();
    expect(report().speed).toBeGreaterThan(0);
    for (let i = 0; i < 60; i++) w.step();
    expect(report().speed).toBeLessThan(0);
    w.setDrive(0);
    for (let i = 0; i < 10; i++) w.step();
    const back = report().speed;
    for (let i = 0; i < 60; i++) w.step();
    expect(report().speed).toBeCloseTo(back, 6);
    // The emergency brake stops at once.
    w.stop();
    expect(report().speed).toBe(0);
    expect(report().throttle).toBe(0);
  });
});
