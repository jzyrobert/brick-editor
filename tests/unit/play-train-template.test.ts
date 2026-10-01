import { beforeAll, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { template } from "../../src/catalog/templates";
import { TRAIN_HINT, trainSource } from "../../src/catalog/builds/train";
import { checkBuild } from "../../src/catalog/builds/check";
import { curatedHas } from "../../src/catalog/full-library";
import { occurrences } from "../../src/core/document";
import { modelHealth } from "../../src/core/health";
import {
  deriveTrains,
  occurrenceBounds,
  type DerivedTrains,
} from "../../src/play/trains";
import { PlaySession } from "../../src/play/session";
import { validate } from "../../src/core/validate";
import {
  fullLibraryOccupancy,
  registerFullLibraryFromDisk,
} from "../../scripts/full-library-node";
import { officialMesh } from "../helpers/official-geometry";
import type { Project } from "../../src/core/types";
import type { CollisionSnapshot } from "../../src/play/types";

beforeAll(() => {
  expect(registerFullLibraryFromDisk()).toBe(true);
});
const derive = (project: Project) =>
  deriveTrains({
    all: occurrences(project),
    reserved: new Set(),
    bounds: occurrenceBounds(project),
  });
const BOUNDS = {
  min: [-1560, -300, -760] as [number, number, number],
  max: [1880, 0, 1720] as [number, number, number],
};
/** Car meshes, compiled once (the static world is the session's ground). */
let meshCache: Record<string, CollisionSnapshot> | undefined;
async function session(project: Project, derived: DerivedTrains) {
  const geometry: CollisionSnapshot = {
    revision: project.revision,
    vertices: new Float32Array(),
    indices: new Uint32Array(),
    bounds: BOUNDS,
  };
  if (meshCache) return create(geometry, derived, meshCache);
  const meshes: Record<string, CollisionSnapshot> = {};
  for (const train of derived.trains)
    for (const [i, car] of train.cars.entries())
      meshes[`${train.id}/${i}`] = await officialMesh(project, [
        ...car.occurrenceIds,
        ...car.bogies.flatMap((b) => b.occurrenceIds),
      ]);
  meshCache = meshes;
  return create(geometry, derived, meshes);
}
function create(
  geometry: CollisionSnapshot,
  derived: DerivedTrains,
  meshes: Record<string, CollisionSnapshot>,
) {
  return PlaySession.create(
    geometry,
    // In front of the station, looking at it.
    { position: [-160, -0.3, -760], yaw: Math.PI },
    [],
    undefined,
    { derived, meshes },
  );
}

describe("railway station sample", () => {
  it("is a clean build with a train on an oval, a switch and a siding", () => {
    const project = template("train");
    expect(project.title).toBe("Railway station");
    expect(project.scene).toEqual({ backdrop: "grass", playHint: TRAIN_HINT });
    const r = checkBuild(project, {
      occupancy: fullLibraryOccupancy(
        occurrences(project)
          .map((o) => o.node.ref)
          .filter((ref) => !curatedHas(ref)),
      ),
    });
    expect(r.overlaps).toEqual([]);
    expect(r.offGrid).toEqual([]);
    expect(r.groups).toBe(1);
    const health = modelHealth(project).checks.find(
      (c) => c.id === "connectivity",
    )!;
    expect(health.status).toBe("ok");
    expect(health.detail).toMatch(/3 rail vehicles stand on their wheels/);
    expect(
      readFileSync("fixtures/ldraw/templates/railway-station.mpd", "utf8"),
    ).toBe(trainSource());
    const d = derive(project);
    expect(d.graph.pieces).toHaveLength(27);
    expect(d.graph.gaps).toEqual([]);
    // The siding's buffer end is the only free end.
    expect(d.graph.deadEnds).toHaveLength(1);
    expect(d.skipped).toEqual([]);
    expect(d.trains).toHaveLength(1);
    const [train] = d.trains;
    expect(train.name).toBe("Train 1");
    expect(train.cars.map((c) => c.locomotive)).toEqual([true, false, false]);
    expect(train.cars.map((c) => c.bogies.length)).toEqual([2, 2, 2]);
  });

  it(
    "runs round the oval, into the siding when the points are set, and waits for the explorer",
    { timeout: 300000 },
    async () => {
      const project = template("train");
      const derived = derive(project);
      const play = await session(project, derived);
      try {
        const snap = play.snapshot();
        validate("playSnapshot", JSON.parse(JSON.stringify(snap)));
        const trains = snap.trains!;
        expect(trains.trains[0].status).toBe("stopped");
        expect(trains.switches).toHaveLength(1);
        const points = trains.switches[0];
        expect(points.route).toBe("straight");
        // The train stands on the points: they cannot be thrown yet.
        expect(points.occupied).toBe(true);
        expect(() =>
          play.setPoints({ occurrenceId: points.occurrenceId }),
        ).toThrow(/train is on these points/);
        play.setTrainThrottle({ throttle: 1 });
        play.stepTicks(600);
        let t = play.snapshot().trains!.trains[0];
        expect(t.status).toBe("running");
        expect(t.odometer).toBeGreaterThan(3500);
        // Every car part moves with the train.
        const moved = play.trainTransforms();
        expect(Object.keys(moved).sort()).toEqual(
          [...derived.occurrenceIds].sort(),
        );
        // Off the points now: send the train into the siding.
        expect(play.snapshot().trains!.switches[0].occupied).toBe(false);
        play.setPoints({ occurrenceId: points.occurrenceId, route: "branch" });
        expect(play.snapshot().trains!.switches[0].route).toBe("branch");
        for (let i = 0; i < 20; i++) {
          play.stepTicks(120);
          t = play.snapshot().trains!.trains[0];
          if (t.status === "end-of-track") break;
        }
        expect(t.status).toBe("end-of-track");
        // Stopped with its front at the siding's end (x = 1280, z = 320).
        expect(t.position[2]).toBeCloseTo(320, 3);
        expect(t.position[0]).toBeGreaterThan(1100);
        expect(t.position[0]).toBeLessThan(1280);
        // Back out, set the points straight, and run again.
        play.setTrainThrottle({ throttle: -0.5 });
        play.stepTicks(400);
        expect(play.snapshot().trains!.trains[0].status).toBe("running");
      } finally {
        play.dispose();
      }
      // The explorer standing on the track stops the train in front of them.
      const blocked = await session(project, derived);
      try {
        blocked.teleport({ position: [1300, -0.3, 0], policy: "free-flight" });
        blocked.setLocomotion("walk");
        blocked.stepTicks(10);
        blocked.setTrainThrottle({ throttle: 1 });
        blocked.stepTicks(300);
        const t = blocked.snapshot().trains!.trains[0];
        expect(t.status).toBe("waiting");
        expect(t.reason).toMatch(/step off the track/);
        expect(t.position[0]).toBeLessThan(1300);
      } finally {
        blocked.dispose();
      }
    },
  );

  it(
    "puts the driver in the cab, drives with the lever and sets them down beside the track",
    { timeout: 300000 },
    async () => {
      const project = template("train");
      const derived = derive(project);
      const play = await session(project, derived);
      try {
        const start = play.snapshot();
        expect(start.locomotion).toBe("walk");
        let s = play.rideTrain({});
        expect(s.trains!.riding).toBe(derived.trains[0].id);
        /** The feet relative to the head pivot, in the train's frame. */
        const local = (snap: typeof s) => {
          const t = snap.trains!.trains[0],
            [hx, , hz] = t.heading,
            d = snap.position.map((v, k) => v - t.position[k]);
          return {
            back: -(d[0] * hx + d[2] * hz),
            side: d[0] * -hz + d[2] * hx,
            up: -(snap.position[1] - t.position[1]),
          };
        };
        // In the locomotive's cab: on the centreline, behind the front,
        // on the deck above the bogies, facing forward.
        const cab = local(s);
        expect(Math.abs(cab.side)).toBeLessThan(1);
        expect(cab.back).toBeGreaterThan(0);
        expect(cab.back).toBeLessThan(240);
        expect(cab.up).toBeGreaterThan(63);
        expect(cab.up).toBeLessThan(120);
        // Facing forward: +X is look yaw π/2.
        expect(Math.sin(s.avatar.heading)).toBeCloseTo(1, 3);
        // W: the lever accelerates the train; the figure rides with it.
        play.setInput({ moveZ: 1 });
        s = play.stepTicks(90);
        let t = s.trains!.trains[0];
        expect(t.status).toBe("running");
        expect(t.speed).toBeGreaterThan(200);
        expect(t.throttle).toBeGreaterThan(0.4);
        const moved = local(s);
        expect(Math.abs(moved.side - cab.side)).toBeLessThan(2);
        expect(Math.abs(moved.back - cab.back)).toBeLessThan(2);
        expect(Math.abs(moved.up - cab.up)).toBeLessThan(1);
        expect(Math.hypot(...s.velocity)).toBeCloseTo(Math.abs(t.speed), -1);
        // Released: the train holds its speed.
        play.setInput({});
        play.stepTicks(5);
        const held = play.snapshot().trains!.trains[0].speed;
        s = play.stepTicks(60);
        expect(s.trains!.trains[0].speed).toBeCloseTo(held, 3);
        // S brakes, then runs backwards.
        play.setInput({ moveZ: -1 });
        s = play.stepTicks(120);
        expect(s.trains!.trains[0].speed).toBeLessThan(0);
        // Jump (Space) is the brake.
        play.setInput({ jump: true });
        s = play.stepTicks(1);
        expect(s.trains!.trains[0].speed).toBe(0);
        expect(s.trains!.trains[0].throttle).toBe(0);
        play.setInput({});
        // Walking input never moves the rider off the cab.
        const still = [...s.position];
        play.setInput({ moveX: 1 });
        s = play.stepTicks(30);
        expect(s.position).toEqual(still);
        play.setInput({});
        // Getting off: beside the train, on walkable ground.
        s = play.rideTrain({ trainId: null });
        expect(s.trains!.riding).toBeUndefined();
        s = play.stepTicks(30);
        expect(s.grounded).toBe(true);
        const off = local(s);
        expect(Math.abs(off.side)).toBeGreaterThan(60 + 12);
        expect(Math.abs(off.side)).toBeLessThan(400);
        expect(off.up).toBeLessThan(40);
      } finally {
        play.dispose();
      }
    },
  );
});
