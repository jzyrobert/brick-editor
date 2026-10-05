import { expect, it } from "vitest";
import { movingSource } from "../helpers/play-moving-source";
import { PlaySession } from "../../src/play/session";
import type { CollisionSnapshot } from "../../src/play/types";
import { carProject } from "../../src/catalog/builds/car";
import { playSources } from "../helpers/play-dynamic-source";
import { occurrences } from "../../src/core/document";
import {
  fullLibrarySources,
  registerFullLibraryFromDisk,
} from "../../scripts/full-library-node";
import { validate } from "../../src/core/validate";

const empty: CollisionSnapshot = {
  revision: 0,
  vertices: new Float32Array(),
  indices: new Uint32Array(),
  bounds: { min: [-1000, -100, -1000], max: [1000, 0, 1000] },
};

it("removes the native explorer collider while driving through its old location and restores it beside the actual source car", async () => {
  registerFullLibraryFromDisk();
  const project = carProject();
  const prepared = await playSources(
    project,
    ["car"],
    fullLibrarySources(occurrences(project).map((o) => o.node.ref)),
  );
  // The shared engine helper uses deliberately broad test bounds. Camera/exit
  // tests need the complete compiled source's actual group bounds.
  for (const source of prepared.sources)
    for (const mesh of Object.values(source.groups)) {
      const min: [number, number, number] = [Infinity, Infinity, Infinity];
      const max: [number, number, number] = [-Infinity, -Infinity, -Infinity];
      for (let i = 0; i < mesh.vertices.length; i++) {
        min[i % 3] = Math.min(min[i % 3], mesh.vertices[i]);
        max[i % 3] = Math.max(max[i % 3], mesh.vertices[i]);
      }
      mesh.bounds = { min, max };
    }
  const play = await PlaySession.create(
    prepared.geometry,
    { rigId: "car", dynamicRigIds: ["car"], position: [0, -0.3, -200] },
    prepared.sources,
  );
  const original = JSON.stringify(project);
  try {
    play.stepTicks(60);
    const entered = play.controlVehicle("car");
    validate("playSnapshot", entered);
    expect(entered.avatarVisible).toBe(false);
    play.setInput({ moveZ: 1 });
    const driven = play.stepTicks(180);
    expect(driven.position[2]).toBeLessThan(-250);
    expect(driven.avatarVisible).toBe(false);
    expect(
      Object.values(driven.mechanism!.dynamics!.wheels!).filter(
        (w) => w.contact,
      ).length,
    ).toBeGreaterThanOrEqual(2);
    const exited = play.releaseVehicle();
    validate("playSnapshot", exited);
    expect(exited.position[2]).toBeLessThan(-250);
    expect(exited.position[1]).toBeCloseTo(-0.2, 2);
    expect(exited.vehicleControl).toBeUndefined();
    expect(JSON.stringify(project)).toBe(original);
  } finally {
    play.dispose();
  }
}, 20_000);

it("possesses a certified vehicle, follows its whole geometry and exits beside its current location without changing the build", async () => {
  const source = await movingSource("vehicle");
  const original = JSON.stringify(source.mechanism.project);
  const play = await PlaySession.create(
    empty,
    { rigId: "vehicle", position: [400, -0.3, 400] },
    source.mechanism,
  );
  try {
    const entered = play.controlVehicle("vehicle");
    expect(entered.vehicleControl).toEqual({ rigId: "vehicle" });
    expect(entered.occupancy).toBeUndefined();
    expect(entered.positionAnchor).toBe("vehicle-reference");
    expect(entered.cameraMode).toBe("third-person");
    expect(entered.avatarVisible).toBe(false);
    expect(() => play.teleport({ position: [0, 0, 0] })).toThrow(
      /Exit vehicle/,
    );
    expect(() => play.setCameraMode("first-person")).toThrow(/Exit vehicle/);
    const camera = play.camera();
    play.setMechanismVehicleInput({ throttle: 1, steering: 0 });
    const driven = play.stepTicks(90);
    expect(driven.position[2]).toBeLessThan(entered.position[2] - 100);
    expect(driven.avatarVisible).toBe(false);
    expect(play.camera().target[2]).toBeLessThan(camera.target[2] - 100);
    const restore = play.beginCameraCapture(0.6);
    expect(play.snapshot().avatarVisible).toBe(false);
    restore();
    const exited = play.releaseVehicle();
    expect(exited.vehicleControl).toBeUndefined();
    expect(exited.positionAnchor).toBe("standing-feet");
    expect(exited.grounded).toBe(true);
    expect(
      Math.hypot(
        exited.position[0] - driven.position[0],
        exited.position[2] - driven.position[2],
      ),
    ).toBeLessThan(300);
    expect(exited.position[2]).toBeLessThan(-100);
    expect(JSON.stringify(source.mechanism.project)).toBe(original);
  } finally {
    play.dispose();
  }
});

it("keeps possession and the hidden avatar when there is no supported place to get out", async () => {
  const source = await movingSource("vehicle");
  const play = await PlaySession.create(
    empty,
    {
      rigId: "vehicle",
      ground: false,
      locomotion: "fly-noclip",
      position: [400, 0, 400],
    },
    source.mechanism,
  );
  try {
    expect(() => play.controlVehicle("missing")).toThrow();
    expect(play.snapshot().vehicleControl).toBeUndefined();
    play.controlVehicle("vehicle");
    play.setMechanismVehicleInput({ throttle: 1, steering: 0 });
    expect(() => play.releaseVehicle()).toThrow(/Exit blocked/);
    expect(play.snapshot().vehicleControl).toEqual({ rigId: "vehicle" });
    expect(play.snapshot().avatarVisible).toBe(false);
    const position = play.snapshot().mechanism!.pose.vehicle!.position;
    expect(play.stepTicks(10).mechanism!.pose.vehicle!.position).toEqual(
      position,
    );
  } finally {
    play.dispose();
  }
});
