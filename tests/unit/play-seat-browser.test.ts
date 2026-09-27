import { afterEach, expect, it, vi } from "vitest";
import { Group } from "three";
import { BrowserPlay } from "../../src/play/browser";
import { openBenchFixture } from "../../src/mechanisms/fixtures";
import { movingSource } from "../helpers/play-moving-source";
import type { SceneAdapter } from "../../src/render/adapter";
afterEach(() => vi.unstubAllGlobals());
it("occupied capture rejects seat/controller mutations atomically and pause retains occupancy while stopping throttle", async () => {
  vi.stubGlobal("document", { pointerLockElement: null });
  vi.stubGlobal("cancelAnimationFrame", () => {});
  const project = openBenchFixture(),
    source = await movingSource("vehicle", project),
    rig = project.motionRigs.vehicle;
  let cameraFails = false;
  const renderer = {
    scene: new Group(),
    renderer: { domElement: { clientWidth: 1200, clientHeight: 800 } },
    playGeometry: async (options: { include?: string[]; exclude?: string[] }) =>
      structuredClone(
        options.exclude
          ? source.geometry
          : source.mechanism.groups[
              rig.groups.find(
                (g) =>
                  JSON.stringify(g.occurrenceIds) ===
                  JSON.stringify(options.include),
              )!.id
            ],
      ),
    beginTransientPose: () => () => {},
    beginPlayView: () => () => {},
    applyTransientPose: () => {},
    playCamera: () => {
      if (cameraFails) throw Error("camera failure");
    },
    invalidate: () => {},
  };
  const play = new BrowserPlay(
    () => renderer as unknown as SceneAdapter,
    () => project.revision,
    () => {},
    () => project,
  );
  const request = { rigId: "vehicle", seatId: rig.vehicle!.driverSeat!.id };
  try {
    await play.enter({ rigId: "vehicle", position: [80, -0.3, -188] });
    play.enterVehicle(request);
    play.setInput({ moveZ: 1 });
    play.stepTicks(3);
    const before = play.snapshot(),
      restore = play.prepareCapture(1.5);
    for (const action of [
      () => play.exitVehicle(),
      () => play.enterVehicle(request),
      () => play.controlVehicle("vehicle"),
      () => play.setInput({ moveZ: -1 }),
      () => play.stepTicks(1),
    ])
      expect(action).toThrow(/capture/i);
    expect(play.snapshot().occupancy).toEqual(before.occupancy);
    expect(play.snapshot().mechanism!.pose).toEqual(before.mechanism!.pose);
    expect(play.snapshot().tick).toBe(before.tick);
    play.pause(true);
    restore();
    expect(play.snapshot().occupancy).toEqual(before.occupancy);
    const stopped = play.snapshot().mechanism!.pose;
    play.stepTicks(5);
    expect(play.snapshot().mechanism!.pose).toEqual(stopped);
    cameraFails = true;
    expect(() => play.prepareCapture(2)).toThrow(/camera failure/);
    cameraFails = false;
    expect(play.snapshot().occupancy).toEqual(before.occupancy);
    play.exitVehicle();
    expect(play.snapshot().occupancy).toBeUndefined();
    play.enterVehicle(request);
    project.revision++;
    play.sourceChanged();
    expect(play.getState().active).toBe(false);
  } finally {
    play.dispose();
  }
});
