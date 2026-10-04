import { beforeAll, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { template } from "../../src/catalog/templates";
import { jeepSource, JEEP_AXLES } from "../../src/catalog/builds/jeep";
import { CAR_PELVIS } from "../../src/catalog/builds/car";
import { windmillSource } from "../../src/catalog/builds/windmill";
import { lighthouseSource } from "../../src/catalog/builds/lighthouse";
import { cafeSource } from "../../src/catalog/builds/cafe";
import {
  PLAYGROUND_HINT,
  playgroundSource,
} from "../../src/catalog/builds/playground";
import { checkBuild } from "../../src/catalog/builds/check";
import {
  FIXTURE_TEMPLATES,
  SHOWCASE_TEMPLATE,
  TEMPLATE_CARDS,
  TEMPLATE_NAMES,
} from "../../src/catalog/template-names";
import { curatedHas } from "../../src/catalog/full-library";
import { occurrences } from "../../src/core/document";
import { compose, inverse } from "../../src/core/math";
import { partsList } from "../../src/inventory/parts-list";
import { modelHealth } from "../../src/core/health";
import { KinematicSession, validateRig } from "../../src/mechanisms/kinematic";
import { deriveDoorRigs } from "../../src/play/auto-doors";
import { PlaySession } from "../../src/play/session";
import { validate } from "../../src/core/validate";
import {
  fullLibraryOccupancy,
  registerFullLibraryFromDisk,
} from "../../scripts/full-library-node";
import { officialSources } from "../helpers/official-geometry";
import type { Project, Vec3 } from "../../src/core/types";

beforeAll(() => {
  expect(registerFullLibraryFromDisk()).toBe(true);
});

const report = (project: Project) =>
  checkBuild(project, {
    occupancy: fullLibraryOccupancy(
      occurrences(project)
        .map((o) => o.node.ref)
        .filter((ref) => !curatedHas(ref)),
    ),
  });
const outside = (project: Project) =>
  [
    ...new Set(
      occurrences(project)
        .map((o) => o.node.ref)
        .filter((ref) => !curatedHas(ref)),
    ),
  ].sort();
const doors = (project: Project) =>
  deriveDoorRigs(project, {
    all: occurrences(project),
    reserved: new Set(),
    maxRigs: 32,
    maxGroups: 128,
  });
/** A Play session with the build's authored rigs and its derived doors. */
async function play(
  project: Project,
  request: { position: [number, number, number]; yaw: number },
  bounds: { min: Vec3; max: Vec3 } = {
    min: [-340, -520, -340],
    max: [340, 0, 340],
  },
) {
  const derived = doors(project);
  const rigs = { ...project.motionRigs, ...derived.rigs };
  const { geometry, sources } = await officialSources(project, rigs, {
    min: bounds.min,
    max: bounds.max,
  });
  return PlaySession.create(
    geometry,
    { ...request, rigIds: Object.keys(rigs) },
    sources,
    derived,
  );
}
/** Opens every derived door fully (towards its free side). */
function openDoors(session: PlaySession) {
  for (const door of session.snapshot().autoDoors?.doors ?? [])
    session.setJointTarget({
      rigId: door.rigId,
      jointId: door.jointId,
      target: door.swing === "negative" ? -90 : 90,
      speed: 180,
    });
  session.stepTicks(40);
}

describe("sample builds", () => {
  it("offer the new samples and Blank in the chooser; the old starts stay as fixtures", () => {
    expect(TEMPLATE_CARDS.map((c) => c.name).sort()).toEqual(
      [
        "blank",
        "cafe",
        "car",
        "castle",
        "house",
        "jeep",
        "lighthouse",
        "playground",
        "train",
        "windmill",
        "town",
        "cathedral",
        "harbour",
        "motor-gears",
        "rack-drive",
      ].sort(),
    );
    expect(SHOWCASE_TEMPLATE).toBe("cafe");
    for (const name of FIXTURE_TEMPLATES) {
      expect(TEMPLATE_NAMES).toContain(name);
      expect(TEMPLATE_CARDS.map((c) => c.name)).not.toContain(name);
      // Automation keeps loading them (tests use them as fixtures).
      validate("importRequest", { format: "template", template: name });
    }
    for (const [file, source] of [
      ["off-road-jeep.mpd", jeepSource],
      ["windmill-farm.mpd", windmillSource],
      ["lighthouse.mpd", lighthouseSource],
      ["corner-cafe.mpd", cafeSource],
    ] as const)
      expect(
        readFileSync("fixtures/ldraw/templates/" + file, "utf8"),
        file,
      ).toBe(source());
  });

  for (const [name, title, parts, extra] of [
    [
      "jeep",
      "Off-road jeep",
      80,
      ["4176.dat", "50745.dat", "56890.dat", "6014b.dat"],
    ],
    [
      "windmill",
      "Windmill farm",
      338,
      ["64452p01.dat", "64452p02.dat", "87621p01.dat", "95342.dat"],
    ],
    ["lighthouse", "Lighthouse", 269, ["2551.dat"]],
    [
      "cafe",
      "Corner café",
      358,
      ["2454adfa.dat", "3010p20.dat", "3068bp25.dat", "4719c01.dat", "723.dat"],
    ],
  ] as const)
    it(`${name}: on the grid, no overlaps, one connected build`, () => {
      const project = template(name);
      expect(project.title).toBe(title);
      const r = report(project);
      expect(r.parts).toBe(parts);
      expect(outside(project)).toEqual([...extra].sort());
      expect(r.overlaps).toEqual([]);
      expect(r.offGrid).toEqual([]);
      expect(r.groups).toBe(1);
      const health = Object.fromEntries(
        modelHealth(project).checks.map((c) => [c.id, c.status]),
      );
      expect(health["missing-definitions"]).toBe("ok");
      expect(health.connectivity).toBe("ok");
      for (const rig of Object.values(project.motionRigs))
        validateRig(project, rig);
    });

  it("jeep: a valid four-wheel rig with a driver seat between the axles", () => {
    const project = template("jeep");
    const rig = project.motionRigs.jeep;
    expect(rig.vehicle!.wheels.map((w) => w.steering)).toEqual([
      true,
      true,
      false,
      false,
    ]);
    expect(rig.vehicle!.wheelbase).toBe(JEEP_AXLES[1] - JEEP_AXLES[0]);
    const grouped = rig.groups.flatMap((g) => g.occurrenceIds);
    expect(new Set(grouped).size).toBe(occurrences(project).length);
    expect(rig.vehicle!.driverSeat!.id).toBe("driver");
    const session = new KinematicSession(project, "jeep");
    session.setVehicleInput({ throttle: 1, steering: 0 });
    const s = session.stepTicks(60);
    expect(s.pose.vehicle!.position[2]).toBeLessThan(-150);
  });

  it(
    "jeep: a figure climbs into the driver seat, drives off and gets out",
    { timeout: 120000 },
    async () => {
      const project = template("jeep");
      const { geometry, sources } = await officialSources(
        project,
        project.motionRigs,
        { min: [-400, -300, -400], max: [400, 0, 400] },
      );
      const session = await PlaySession.create(
        geometry,
        { rigIds: ["jeep"], position: [-110, -0.3, -20], yaw: Math.PI / 2 },
        sources,
      );
      try {
        const request = { rigId: "jeep", seatId: "driver" };
        expect(session.vehicleSeatEligibility(request).reason).toBeUndefined();
        const seated = session.enterVehicle(request);
        expect(seated.occupancy).toMatchObject({ rigId: "jeep" });
        session.setInput({ moveZ: 1 });
        const moved = session.stepTicks(60);
        expect(moved.mechanisms!.jeep.pose.vehicle!.position[2]).toBeLessThan(
          -100,
        );
        session.setInput({});
        const out = session.exitVehicle();
        expect(out.occupancy).toBeUndefined();
      } finally {
        session.dispose();
      }
    },
  );

  it(
    "jeep: turning while driving round full circles never stops on a collision work budget",
    { timeout: 180000 },
    async () => {
      // Regression: the seated rider's yaw is read back from its frame and
      // wraps at ±180°, which asked for a 358° sweep in one tick and stopped
      // the jeep with "Body transfer exceeds collision work budget".
      const project = template("jeep");
      const { geometry, sources } = await officialSources(
        project,
        project.motionRigs,
        { min: [-400, -300, -400], max: [400, 0, 400] },
      );
      for (const [seated, moveX, moveZ] of [
        [true, 1, 1],
        [true, -1, 1],
        [true, 1, -1],
        [false, -1, -1],
      ] as const) {
        const session = await PlaySession.create(
          geometry,
          { rigIds: ["jeep"], position: [-110, -0.3, -20], yaw: Math.PI / 2 },
          sources,
        );
        try {
          if (seated) {
            session.enterVehicle({ rigId: "jeep", seatId: "driver" });
            session.setInput({ moveX, moveZ });
          } else
            session.setMechanismVehicleInput({
              throttle: moveZ,
              steering: -moveX,
            });
          const stops: string[] = [];
          for (let t = 0; t < 900; t++) {
            const jeep = session.stepTicks(1).mechanisms!.jeep;
            if (jeep.blockedReason) stops.push(jeep.blockedReason);
            expect(jeep.vehicleCollision!.status).toBe("ready");
          }
          expect(stops).toEqual([]);
          // Well past ±180°: through the wrap at least once.
          expect(
            Math.abs(
              session.snapshot().mechanisms!.jeep.pose.vehicle!.headingDegrees,
            ),
          ).toBeGreaterThan(360);
        } finally {
          session.dispose();
        }
      }
    },
  );

  it(
    "roadster: a figure climbs into the driver seat, drives and turns, and gets out",
    { timeout: 120000 },
    async () => {
      const project = template("car");
      expect(project.motionRigs.car.vehicle!.driverSeat!.id).toBe("driver");
      const { geometry, sources } = await officialSources(
        project,
        project.motionRigs,
        { min: [-400, -300, -400], max: [400, 0, 400] },
      );
      const session = await PlaySession.create(
        geometry,
        { rigIds: ["car"], position: [-90, -0.3, 40], yaw: Math.PI / 2 },
        sources,
      );
      try {
        const request = { rigId: "car", seatId: "driver" };
        expect(session.vehicleSeatEligibility(request)).toEqual({
          ...request,
          eligible: true,
        });
        const seated = session.enterVehicle(request);
        expect(seated.occupancy).toMatchObject({
          rigId: "car",
          pelvisWorldLdu: CAR_PELVIS,
        });
        session.setInput({ moveZ: 1 });
        const moved = session.stepTicks(60);
        expect(moved.mechanisms!.car.pose.vehicle!.position[2]).toBeLessThan(
          -100,
        );
        session.setInput({ moveZ: 1, moveX: 1 });
        const turned = session.stepTicks(240);
        expect(turned.mechanisms!.car.blockedReason).toBeUndefined();
        expect(
          Math.abs(turned.mechanisms!.car.pose.vehicle!.headingDegrees),
        ).toBeGreaterThan(90);
        session.setInput({});
        const out = session.exitVehicle();
        expect(out.occupancy).toBeUndefined();
        expect(out.positionAnchor).toBe("standing-feet");
      } finally {
        session.dispose();
      }
    },
  );

  it(
    "windmill: the sails turn on their motor and the barn doors open for a walk inside",
    { timeout: 180000 },
    async () => {
      const project = template("windmill");
      const derived = doors(project);
      expect(derived.skipped).toEqual([]);
      expect(derived.doors).toHaveLength(3);
      const session = await play(project, {
        position: [140, -8.3, -30],
        yaw: Math.PI,
      });
      try {
        for (const door of session.snapshot().autoDoors!.doors)
          expect(door.swing).not.toBe("blocked");
        const s = session.stepTicks(60);
        const sails = s.mechanisms!.windmill;
        expect(sails.pose.jointPositions.axle).toBeGreaterThan(25);
        expect(sails.motors!.axle.status).toBe("running");
        openDoors(session);
        session.setInput({ moveZ: 1, yaw: Math.PI });
        session.stepTicks(120);
        // Past the barn's front wall (z 20..40), on the baseplate.
        expect(session.snapshot().position[2]).toBeGreaterThan(60);
      } finally {
        session.dispose();
      }
    },
  );

  it(
    "lighthouse: the lamp turns and the explorer climbs from the beach to the top",
    { timeout: 180000 },
    async () => {
      const project = template("lighthouse");
      const derived = doors(project);
      expect(derived.skipped).toEqual([]);
      expect(derived.doors).toHaveLength(1);
      const session = await play(
        project,
        { position: [0, -8.3, -130], yaw: Math.PI },
        { min: [-340, -620, -340], max: [340, 0, 340] },
      );
      try {
        expect(session.snapshot().autoDoors!.doors[0].swing).not.toBe(
          "blocked",
        );
        const s = session.stepTicks(30);
        expect(
          s.mechanisms!.lighthouse.pose.jointPositions.turn,
        ).toBeGreaterThan(25);
        session.setInput({ moveZ: 1, yaw: Math.PI });
        session.stepTicks(150);
        const top = session.snapshot().position;
        // On the grassy top (plate level 10 = y −80).
        expect(top[2]).toBeGreaterThan(0);
        expect(top[1]).toBeLessThan(-78);
      } finally {
        session.dispose();
      }
    },
  );

  it(
    "cafe: in through the door, then up the stairs to the room over the café",
    { timeout: 180000 },
    async () => {
      const project = template("cafe");
      const derived = doors(project);
      expect(derived.skipped).toEqual([]);
      expect(derived.doors).toHaveLength(2);
      const session = await play(project, {
        position: [-60, -0.3, -180],
        yaw: Math.PI,
      });
      try {
        for (const door of session.snapshot().autoDoors!.doors)
          expect(door.swing).not.toBe("blocked");
        openDoors(session);
        session.setInput({ moveZ: 1, yaw: Math.PI });
        session.stepTicks(90);
        // Inside: past the front wall (z −80..−60), on the floor (y −8).
        const inside = session.snapshot().position;
        expect(inside[2]).toBeGreaterThan(-40);
        expect(inside[1]).toBeLessThan(-7);
        // From the foot of the stairs (x 40, rows 5..6), climb towards −X.
        session.teleport({ position: [40, -12.3, 120], yaw: -Math.PI / 2 });
        session.setInput({ moveZ: 1, yaw: -Math.PI / 2 });
        session.stepTicks(300);
        const up = session.snapshot().position;
        // On the landing (x −220..−200) at the slab's top (level 22).
        expect(up[0]).toBeLessThan(-190);
        expect(up[1]).toBeLessThan(-170);
      } finally {
        session.dispose();
      }
    },
  );

  it("playground: every moving thing is a rig, loose objects are checked as loose", () => {
    const project = template("playground");
    expect(project.title).toBe("Playground park");
    expect(project.scene).toEqual({
      backdrop: "grass",
      playHint: PLAYGROUND_HINT,
    });
    const r = report(project);
    expect(r.overlaps).toEqual([]);
    expect(r.offGrid).toEqual([]);
    expect(r.groups).toBe(1);
    const rigs = Object.values(project.motionRigs);
    expect(rigs.map((rig) => rig.id).sort()).toEqual(
      [
        "barrel-1",
        "barrel-2",
        "crate-1",
        "crate-2",
        "crate-3",
        "crate-4",
        "roundabout",
        "seesaw",
        "swing",
      ].sort(),
    );
    // Within dynamic Play's limits (14 rigs, 64 bodies).
    expect(rigs.length).toBeLessThanOrEqual(14);
    expect(rigs.reduce((n, rig) => n + rig.groups.length, 0)).toBeLessThan(64);
    for (const rig of rigs) {
      validateRig(project, rig);
      validate("motionRig", rig);
      expect(rig.dynamics?.startDynamic).toBe(true);
    }
    const health = modelHealth(project).checks.find(
      (c) => c.id === "connectivity",
    )!;
    expect(health.status).toBe("ok");
    expect(health.detail).toMatch(/7 loose objects/);
    expect(
      readFileSync("fixtures/ldraw/templates/playground-park.mpd", "utf8"),
    ).toBe(playgroundSource());
  });

  it(
    "playground: in dynamic Play the explorer pushes a crate and the swing swings",
    { timeout: 180000 },
    async () => {
      const project = template("playground");
      const ids = Object.keys(project.motionRigs);
      const { geometry, sources } = await officialSources(
        project,
        project.motionRigs,
        { min: [-340, -200, -340], max: [340, 0, 340] },
      );
      const original = JSON.stringify(project),
        inventory = partsList(project, occurrences(project)),
        crateMesh = sources.find((s) => s.rigId === "crate-3")!.groups.body,
        rest = project.motionRigs["crate-3"].groups[0].frame;
      const create = (dynamic: boolean, position: Vec3, yaw = 0) =>
        PlaySession.create(
          geometry,
          {
            rigIds: ids,
            ...(dynamic ? { dynamicRigIds: ids } : {}),
            position,
            yaw,
          },
          sources,
        );
      // Crate 3 stands on the plaza at x -260..-220, z -160..-120.
      for (const dynamic of [false, true]) {
        const session = await create(dynamic, [-240, -8.3, -70]);
        try {
          session.stepTicks(30);
          const crate = () =>
            session.snapshot().mechanisms!["crate-3"].groupFrames.body.position;
          const before = crate();
          const lowestSourceY = () => {
            const frame =
                session.snapshot().mechanisms!["crate-3"].groupFrames.body,
              delta = compose(frame, inverse(rest));
            let lowest = -Infinity;
            for (let k = 0; k < crateMesh.vertices.length; k += 3)
              lowest = Math.max(
                lowest,
                delta.position[1] +
                  delta.basis[3] * crateMesh.vertices[k] +
                  delta.basis[4] * crateMesh.vertices[k + 1] +
                  delta.basis[5] * crateMesh.vertices[k + 2],
              );
            return lowest;
          };
          // Push it a little way across the plaza (not off its edge).
          session.setInput({ moveZ: 1 });
          for (let tick = 0; tick < 40; tick++) {
            session.stepTicks(1);
            if (dynamic) {
              // The frame origin is the centre of the crate's base. Rocking
              // raises it while a corner stays supported, so check the actual
              // source envelope against the tile top at Y=-8 instead.
              expect(lowestSourceY()).toBeGreaterThan(-11);
              expect(lowestSourceY()).toBeLessThan(-7.5);
            }
          }
          const after = crate();
          if (dynamic) {
            expect(session.snapshot().mechanisms!["crate-3"].mode).toBe(
              "dynamic",
            );
            expect(after[2]).toBeLessThan(before[2] - 20);
            // After the explorer stops pushing and moves clear, the crate
            // settles on the same plaza without persistent flight or jitter.
            session.setInput({ moveZ: 0 });
            session.teleport({ position: [-240, -8.3, -70] });
            session.stepTicks(180);
            expect(lowestSourceY()).toBeCloseTo(-8, 1);
            const settled =
              session.snapshot().mechanisms!["crate-3"].dynamics!.bodies.body;
            expect(Math.hypot(...settled.linearVelocity)).toBeLessThan(0.01);
            expect(settled.angularSpeed).toBeLessThan(0.01);
          } else expect(after).toEqual(before);
          expect(JSON.stringify(project)).toBe(original);
        } finally {
          session.dispose();
        }
      }
      // Walk into the swing seat (x -220..-140, z 160..180, 40-48 up).
      const session = await create(true, [-180, -0.3, 60], Math.PI);
      try {
        session.setInput({ moveZ: 1, yaw: Math.PI });
        session.stepTicks(90);
        const swing = session.snapshot().mechanisms!.swing;
        expect(Math.abs(swing.pose.jointPositions.pivot)).toBeGreaterThan(3);
        expect(JSON.stringify(project)).toBe(original);
      } finally {
        session.dispose();
      }
      expect(partsList(project, occurrences(project))).toEqual(inventory);
    },
  );
});
