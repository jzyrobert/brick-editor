import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import {
  fullLibrarySources,
  registerFullLibraryFromDisk,
} from "../../scripts/full-library-node";
import { carProject } from "../../src/catalog/builds/car";
import { jeepProject } from "../../src/catalog/builds/jeep";
import { occurrences } from "../../src/core/document";
import { mv } from "../../src/core/math";
import { exportLDraw, importLDraw } from "../../src/ldraw/io";
import { partsList } from "../../src/inventory/parts-list";
import { requirePhysicalPlay } from "../../src/mechanisms/physical-play";
import { deriveVehicleRigs } from "../../src/play/auto-vehicles";
import { PlaySession } from "../../src/play/session";
import { sessionGroundY } from "../../src/play/session-ground";
import type { CollisionSnapshot } from "../../src/play/types";
import { playSources } from "../helpers/play-dynamic-source";

registerFullLibraryFromDisk();
async function prepared(project: ReturnType<typeof importLDraw>) {
  const ids = Object.keys(project.motionRigs);
  for (const id of ids) requirePhysicalPlay(project, project.motionRigs[id]);
  return playSources(
    project,
    ids,
    fullLibrarySources(occurrences(project).map((o) => o.node.ref)),
  );
}

for (const [number, bottom] of [
  ["6503", 23],
  ["31027", 24],
] as const)
  for (const dynamic of [false, true])
    it(`${number} drives at its original below-origin tyre height with shared ${dynamic ? "native" : "kinematic"} ground and walking support`, async () => {
      const project = importLDraw(
        readFileSync(`fixtures/play/official-cars/${number}-car.mpd`, "utf8"),
      );
      const original = JSON.stringify(project),
        source = exportLDraw(project),
        inventory = partsList(project, occurrences(project));
      const inferred = deriveVehicleRigs(project, {
        reserved: new Set(),
        maxRigs: 32,
        maxGroups: 128,
      });
      expect(inferred.vehicles).toHaveLength(1);
      const ephemeral = { ...project, motionRigs: inferred.rigs };
      const { geometry, sources } = await prepared(ephemeral);
      const id = Object.keys(inferred.rigs)[0];
      const ground = sessionGroundY(geometry, sources);
      expect(ground).toBeGreaterThanOrEqual(bottom);
      expect(ground).toBeLessThan(bottom + 0.01);
      const tilted = structuredClone(ephemeral);
      tilted.motionRigs[id].vehicle!.wheels[0].axis = [0, 1, 0];
      expect(
        sessionGroundY(
          geometry,
          sources.map((s) => ({ ...s, project: tilted })),
        ),
      ).toBe(0);
      // Broad diagnostic bounds cannot change the actual source support plane.
      expect(
        sessionGroundY(
          {
            ...geometry,
            bounds: { min: [-1e6, -1e6, -1e6], max: [1e6, 1e6, 1e6] },
          },
          sources,
        ),
      ).toBe(ground);
      const play = await PlaySession.create(
        geometry,
        {
          rigIds: [id],
          ...(dynamic ? { dynamicRigIds: [id] } : {}),
          position: [400, -0.3, 0],
        },
        sources,
      );
      try {
        const start = play.snapshot();
        expect(start.locomotion).toBe("walk");
        expect(start.position[1]).toBeCloseTo(ground - 0.2, 1);
        expect(start.warnings).toContain(
          `Session-only ground is an infinite plane at Y=${ground}; it is not an authored part.`,
        );
        play.setMechanismVehicleInput({ throttle: 1, steering: 0 }, id);
        const driven = play.stepTicks(90).mechanisms![id];
        if (dynamic)
          expect(
            Object.values(driven.dynamics!.wheels!).filter((w) => w.contact)
              .length,
          ).toBeGreaterThanOrEqual(2);
        else
          expect(driven.vehicleCollision).toMatchObject({
            supported: true,
            status: "ready",
          });
        expect(Math.hypot(...driven.pose.vehicle!.position)).toBeGreaterThan(
          40,
        );
        if (!dynamic) {
          const forward = mv(
            inferred.rigs[id].groups[0].frame.basis,
            [0, 0, -240],
          );
          for (let k = 0; k < 3; k++)
            expect(driven.pose.vehicle!.position[k]).toBeCloseTo(forward[k], 4);
        }
        expect(() =>
          play.teleport({ position: [400, ground + 2, 0] }),
        ).toThrow();
        play.teleport({ position: [400, ground - 0.3, 0] });
        expect(play.stepTicks(3).grounded).toBe(true);
        expect(JSON.stringify(project)).toBe(original);
        expect(exportLDraw(project)).toBe(source);
        expect(partsList(project, occurrences(project))).toEqual(inventory);
      } finally {
        play.dispose();
      }
      const withoutGround = await PlaySession.create(
        geometry,
        { rigIds: [id], ground: false, position: [400, -0.3, 0] },
        sources,
      );
      try {
        expect(
          withoutGround
            .snapshot()
            .warnings.some((w) => w.startsWith("Session-only ground")),
        ).toBe(false);
        expect(withoutGround.snapshot().locomotion).toBe("fly-noclip");
      } finally {
        withoutGround.dispose();
      }
    }, 60000);

it("keeps normal Roadster and Jeep support at zero, and never moves a nonvehicle world's ground to diagnostic or source bounds", async () => {
  for (const project of [carProject(), jeepProject()]) {
    const before = JSON.stringify(project),
      { geometry, sources } = await prepared(project);
    expect(sessionGroundY(geometry, sources)).toBeCloseTo(0, 3);
    expect(JSON.stringify(project)).toBe(before);
  }
  const source: CollisionSnapshot = {
    revision: 0,
    vertices: new Float32Array([0, 200, 0, 1, 200, 0, 0, 200, 1]),
    indices: new Uint32Array([0, 1, 2]),
    bounds: { min: [-100, -100, -100], max: [100, 500, 100] },
  };
  expect(sessionGroundY(source, [])).toBe(0);
}, 30000);

it("keeps a real included floor and thin foreign wall active after lowering only temporary vehicle ground", async () => {
  const project = carProject(),
    rig = project.motionRigs.car;
  for (const node of project.models[project.rootModelId].nodes)
    node.transform.position[1] += 24;
  for (const group of rig.groups) {
    group.frame.position[1] += 24;
    for (const rest of Object.values(group.restTransforms))
      rest.position[1] += 24;
  }
  const before = JSON.stringify(project),
    { geometry, sources } = await prepared(project);
  // A real floor at Y=24 and wall retain their own collision geometry. The
  // foreign triangle at Y=40 cannot move the shared plane below this vehicle.
  geometry.vertices = new Float32Array([
    -500, 24, -500, 500, 24, -500, 500, 24, 500, -500, 24, 500, -100, -80, -220,
    100, -80, -220, 100, 24, -220, -100, 24, -220, 400, 40, 400, 410, 40, 400,
    400, 40, 410,
  ]);
  geometry.indices = new Uint32Array([
    0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7, 8, 9, 10,
  ]);
  const groundY = sessionGroundY(geometry, sources);
  expect(groundY).toBeGreaterThan(22);
  expect(groundY).toBeLessThan(24);
  const play = await PlaySession.create(
    geometry,
    { rigId: "car", position: [300, 23.7, 0] },
    sources,
  );
  try {
    expect(play.snapshot().position[1]).toBeCloseTo(groundY - 0.2, 1);
    play.setMechanismVehicleInput({ throttle: 1, steering: 0 }, "car");
    const stopped = play.stepTicks(120).mechanism!;
    expect(stopped.vehicleCollision).toMatchObject({
      status: "blocked",
      obstacle: { sourceId: "included-static-world" },
    });
    expect(stopped.pose.vehicle!.position[2]).toBeLessThan(-20);
    expect(stopped.pose.vehicle!.position[2]).toBeGreaterThan(-220);
    expect(play.stepTicks(30).mechanism!.pose).toEqual(stopped.pose);
    play.setMechanismVehicleInput({ throttle: -1, steering: 0 }, "car");
    expect(
      play.stepTicks(10).mechanism!.pose.vehicle!.position[2],
    ).toBeGreaterThan(stopped.pose.vehicle!.position[2]);
    expect(() => play.teleport({ position: [300, 26, 0] })).toThrow();
    expect(JSON.stringify(project)).toBe(before);
  } finally {
    play.dispose();
  }
  const onActualFloor = await PlaySession.create(
    geometry,
    { rigId: "car", ground: false, position: [300, 23.7, 0] },
    sources,
  );
  try {
    expect(onActualFloor.snapshot().locomotion).toBe("walk");
    expect(onActualFloor.snapshot().position[1]).toBeCloseTo(23.8, 1);
    onActualFloor.setMechanismVehicleInput({ throttle: 1, steering: 0 }, "car");
    expect(
      onActualFloor.stepTicks(120).mechanism!.vehicleCollision,
    ).toMatchObject({
      status: "blocked",
      obstacle: { sourceId: "included-static-world" },
    });
    expect(JSON.stringify(project)).toBe(before);
  } finally {
    onActualFloor.dispose();
  }
}, 30000);

it("finds a bounded far-offset vehicle ground beyond the previous origin-centred spawn sweep without respawn loops", async () => {
  const project = carProject(),
    rig = project.motionRigs.car;
  for (const node of project.models[project.rootModelId].nodes)
    node.transform.position[1] += 5000;
  for (const group of rig.groups) {
    group.frame.position[1] += 5000;
    for (const rest of Object.values(group.restTransforms))
      rest.position[1] += 5000;
  }
  const before = JSON.stringify(project),
    { geometry, sources } = await prepared(project);
  const ground = sessionGroundY(geometry, sources);
  expect(ground).toBeGreaterThan(4998);
  const play = await PlaySession.create(
    geometry,
    { rigId: "car", position: [400, -0.3, 0] },
    sources,
  );
  try {
    expect(play.snapshot().locomotion).toBe("walk");
    expect(play.snapshot().position[1]).toBeCloseTo(ground - 0.2, 1);
    expect(play.stepTicks(5).position[1]).toBeCloseTo(ground - 0.2, 1);
    play.setMechanismVehicleInput({ throttle: 1, steering: 0 }, "car");
    expect(play.stepTicks(30).mechanism!.vehicleCollision!.status).toBe(
      "ready",
    );
    expect(JSON.stringify(project)).toBe(before);
  } finally {
    play.dispose();
  }
}, 30000);

it("below-origin foreign bricks keep Roadster ground at zero, allow boarding and retain blocked exits until reversing clear", async () => {
  const project = carProject();
  for (const x of [-90, 90])
    project.models[project.rootModelId].nodes.push({
      id: `seat-exit-wall-${x}`,
      kind: "part",
      ref: "3005.dat",
      colorCode: "14",
      transform: { position: [x, 0, -40], basis: [1, 0, 0, 0, 1, 0, 0, 0, 1] },
    });
  const before = JSON.stringify(project),
    source = exportLDraw(project),
    inventory = partsList(project, occurrences(project)),
    { geometry, sources } = await prepared(project);
  expect(
    Math.max(...Array.from(geometry.vertices).filter((_, i) => i % 3 === 1)),
  ).toBe(24);
  expect(sessionGroundY(geometry, sources)).toBe(0);
  const play = await PlaySession.create(
    geometry,
    {
      rigId: "car",
      position: [-90, -0.3, 40],
      yaw: Math.PI / 2,
    },
    sources,
  );
  try {
    const seat = { rigId: "car", seatId: "driver" };
    expect(play.snapshot().position[1]).toBeCloseTo(-0.2, 1);
    expect(play.vehicleSeatEligibility(seat)).toMatchObject({ eligible: true });
    play.enterVehicle(seat);
    play.setInput({ moveZ: 1 });
    play.stepTicks(30);
    play.setInput({});
    expect(() => play.exitVehicle()).toThrow(/Exit blocked/);
    expect(play.snapshot().occupancy?.seatId).toBe("driver");
    play.setInput({ moveZ: -1 });
    play.stepTicks(30);
    play.setInput({});
    expect(play.exitVehicle().occupancy).toBeUndefined();
    expect(JSON.stringify(project)).toBe(before);
    expect(exportLDraw(project)).toBe(source);
    expect(partsList(project, occurrences(project))).toEqual(inventory);
  } finally {
    play.dispose();
  }
}, 30000);
