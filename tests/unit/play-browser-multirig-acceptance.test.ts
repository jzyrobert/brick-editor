import { movingSource } from "../helpers/play-moving-source";
import { afterEach, expect, it, vi } from "vitest";
import { Group, PerspectiveCamera, Vector3 } from "three";
import { conversion } from "../../src/core/math";
import { BrowserPlay } from "../../src/play/browser";
import { mechanismFixture } from "../../src/mechanisms/fixtures";
import type { SceneAdapter } from "../../src/render/adapter";
import type { CameraSpec } from "../../src/core/types";
import type { CollisionSnapshot } from "../../src/play/types";
afterEach(() => vi.unstubAllGlobals());
function setup() {
  vi.stubGlobal("document", { pointerLockElement: null });
  vi.stubGlobal("cancelAnimationFrame", () => {});
  const project = mechanismFixture();
  let busy = false;
  const restores = { pose: 0, view: 0 };
  const renderer = {
    scene: new Group(),
    renderer: {
      domElement: {
        clientWidth: 1200,
        clientHeight: 800,
        getBoundingClientRect: () => ({
          left: 0,
          top: 0,
          width: 1200,
          height: 800,
        }),
      },
    },
    playGeometry: async (): Promise<CollisionSnapshot> => ({
      revision: project.revision,
      vertices: new Float32Array(),
      indices: new Uint32Array(),
      bounds: { min: [-100, -100, -300], max: [100, 0, 100] },
    }),
    beginTransientPose: () => () => {
      restores.pose++;
    },
    beginPlayView: () => () => {
      restores.view++;
    },
    applyTransientPose: () => {
      if (busy) throw Error("Capture busy");
    },
    playCamera: (_spec: CameraSpec) => {},
    invalidate: () => {},
  };
  const play = new BrowserPlay(
    () => renderer as unknown as SceneAdapter,
    () => project.revision,
    () => {},
    () => structuredClone(project),
  );
  return {
    play,
    project,
    renderer,
    restores,
    busy: (value: boolean) => {
      busy = value;
    },
  };
}
it("refuses multi-rig joint and tick mutations during capture before changing the physics snapshot", async () => {
  const h = setup();
  await h.play.enter({ rigIds: ["door", "vehicle"], position: [200, -0.3, 0] });
  const before = h.play.snapshot(),
    restore = h.play.prepareCapture(1);
  h.busy(true);
  try {
    expect(() => h.play.setMechanismJoint("hinge", 90, "door")).toThrow();
    expect(h.play.snapshot().mechanisms!.door.pose).toEqual(
      before.mechanisms!.door.pose,
    );
    expect(() => h.play.stepTicks(10)).toThrow();
    expect(h.play.snapshot().tick).toBe(before.tick);
  } finally {
    h.busy(false);
    restore();
    h.play.dispose();
  }
  expect(h.restores).toEqual({ pose: 1, view: 1 });
});
it("cancels an entry awaiting geometry without installing a transient pose or replacing a later session", async () => {
  const h = setup(),
    original = h.renderer.playGeometry;
  let release!: () => void;
  h.renderer.playGeometry = async () => {
    await new Promise<void>((r) => {
      release = r;
    });
    return original();
  };
  const entering = h.play.enter({ rigIds: ["door", "vehicle"] });
  await Promise.resolve();
  h.play.exit();
  h.renderer.playGeometry = original;
  const replacement = await h.play.enter({
    rigId: "door",
    position: [200, -0.3, 0],
  });
  release();
  await expect(entering).rejects.toThrow("cancelled");
  expect(h.play.snapshot().mechanism!.rigId).toBe(replacement.mechanism!.rigId);
  expect(h.restores).toEqual({ pose: 0, view: 0 });
  h.play.dispose();
  expect(h.restores).toEqual({ pose: 1, view: 1 });
});
it("rejects overlapping captures and entry/exit mutations, but rolls back a failed capture camera preparation", async () => {
  const h = setup();
  await h.play.enter({ rigIds: ["door", "vehicle"], position: [200, -0.3, 0] });
  const before = h.play.snapshot();
  const camera = h.play.camera();
  h.renderer.playCamera = () => {
    throw Error("camera failed");
  };
  expect(() => h.play.prepareCapture(4)).toThrow("camera failed");
  expect(h.play.camera()).toEqual(camera);
  expect(h.play.snapshot()).toEqual(before);
  h.renderer.playCamera = () => {};
  const restore = h.play.prepareCapture(1);
  expect(() => h.play.prepareCapture(3)).toThrow("capture");
  await expect(h.play.enter({ rigId: "door" })).rejects.toThrow("capture");
  expect(() => h.play.exit()).toThrow("capture");
  expect(() => h.play.setInput({ moveZ: 1 })).toThrow("capture");
  expect(() =>
    h.play.setMechanismVehicleInput({ throttle: 1, steering: 0 }, "vehicle"),
  ).toThrow("capture");
  expect(() => h.play.teleport({ position: [0, -0.3, 100] })).toThrow(
    "capture",
  );
  expect(() => h.play.clearInput()).not.toThrow();
  const pauseRevision = h.play.pauseRevision;
  expect(() => h.play.pause(true)).not.toThrow();
  expect(h.play.pauseRevision).toBe(pauseRevision + 1);
  expect(h.play.getState().paused).toBe(true);
  restore();
  restore();
  expect(h.play.snapshot()).toEqual(before);
  h.play.setMechanismJoint("hinge", 90, "door");
  expect(h.play.snapshot().mechanisms!.door.pose.jointPositions.hinge).toBe(90);
  h.play.dispose();
});
it("source replacement and disposal invalidate a captured session without restoring over its successor", async () => {
  const h = setup();
  await h.play.enter({ rigIds: ["door", "vehicle"] });
  const restore = h.play.prepareCapture(1);
  h.project.revision++;
  h.play.sourceChanged();
  expect(h.play.getState().active).toBe(false);
  await h.play.enter({ rigId: "door" });
  const before = h.play.snapshot();
  restore();
  expect(h.play.snapshot()).toEqual(before);
  const other = h.play.prepareCapture(2);
  h.play.dispose();
  expect(() => other()).not.toThrow();
  expect(h.restores).toEqual({ pose: 2, view: 2 });
});

it("vehicle keyboard/joystick left and right steer toward the corresponding projected camera side", async () => {
  const source = await movingSource("vehicle");
  for (const moveX of [-1, 1]) {
    const h = setup();
    h.renderer.playGeometry = async (options?: {
      include?: string[];
      exclude?: string[];
    }) => {
      if (options?.include && !options.exclude) {
        const group = source.mechanism.project.motionRigs.vehicle.groups.find(
          (group) =>
            group.occurrenceIds.length === options.include!.length &&
            group.occurrenceIds.every((id) => options.include!.includes(id)),
        );
        if (group) return source.mechanism.groups[group.id];
      }
      return source.geometry;
    };
    await h.play.enter({
      rigId: "vehicle",
      position: [80, -0.3, -200],
      yaw: 0,
    });
    h.play.interact();
    expect(h.play.getState().vehicleControl).toBe("vehicle");
    const spec = h.play.camera(),
      camera = new PerspectiveCamera(spec.fovDeg, 1, spec.near, spec.far);
    camera.position.fromArray(conversion(spec.position));
    camera.up.fromArray(conversion(spec.up));
    camera.lookAt(...conversion(spec.target));
    camera.updateMatrixWorld(true);
    h.play.setInput({ moveZ: 1, moveX });
    const driven = h.play.stepTicks(12),
      pose = driven.mechanism!.pose.vehicle!;
    // Compare against the straight-ahead point at identical forward depth so
    // perspective cannot confuse lateral steering with approaching the camera.
    const centre = new Vector3(
      ...conversion([0, -24, -200 + pose.position[2]]),
    ).project(camera);
    const steered = new Vector3(
      ...conversion([pose.position[0], -24, -200 + pose.position[2]]),
    ).project(camera);
    expect(Math.sign(steered.x - centre.x)).toBe(moveX);
    expect(Math.sign(pose.headingDegrees)).toBe(-moveX);
    expect(driven.position[0]).toBeCloseTo(80);
    expect(driven.position[2]).toBeCloseTo(-200);
    h.play.dispose();
  }
});

it("orbits and fits a whole active mechanism without moving the explorer, and restores the explorer view on leaving", async () => {
  const { play, project } = setup();
  const original = JSON.stringify(project);
  try {
    await play.enter({
      rigIds: ["door", "vehicle"],
      position: [200, -0.3, 0],
      locomotion: "fly-noclip",
    });
    play.stepTicks(60);
    const before = play.snapshot(),
      camera = play.camera();
    play.focusMechanism("door", { x: 850, y: 80, width: 340, height: 600 });
    const overview = play.camera();
    expect(overview).not.toEqual(camera);
    expect(play.getState().mechanismOverview).toBe("door");
    play.setInput({ moveZ: 1 });
    play.stepTicks(60);
    expect(play.snapshot().position).toEqual(before.position);
    expect(() => play.setInput({ moveZ: 2 })).toThrow();
    play.look(100, 40);
    expect(play.camera()).not.toEqual(overview);
    expect(play.snapshot().yaw).toBe(before.yaw);
    expect(play.snapshot().pitch).toBe(before.pitch);
    const orbited = play.camera();
    play.zoom(2);
    expect(
      new Vector3(...play.camera().position).distanceTo(
        new Vector3(...play.camera().target),
      ),
    ).toBeCloseTo(
      new Vector3(...orbited.position).distanceTo(
        new Vector3(...orbited.target),
      ) * 2,
      8,
    );
    play.fitMechanism();
    expect(play.camera()).toEqual(orbited);
    play.pause(true);
    expect(play.getState().mechanismOverview).toBe("door");
    play.focusMechanism();
    expect(play.camera()).toEqual(camera);
    expect(play.getState().mechanismOverview).toBeUndefined();
    expect(JSON.stringify(project)).toBe(original);
  } finally {
    play.dispose();
  }
});

it("captures the whole mechanism without reserving sheet space and restores its live overview", async () => {
  const { play, renderer } = setup();
  const cameras: CameraSpec[] = [];
  renderer.playCamera = (spec) => cameras.push(structuredClone(spec));
  try {
    await play.enter({ rigId: "door", position: [200, -0.3, 0] });
    play.focusMechanism("door", { x: 850, y: 80, width: 340, height: 600 });
    const live = play.camera(),
      snapshot = play.snapshot();
    const restore = play.prepareCapture(1);
    const captured = cameras.at(-1)!;
    expect(captured.target).not.toEqual(live.target);
    expect(play.snapshot().mechanisms).toEqual(snapshot.mechanisms);
    expect(play.snapshot().position).toEqual(snapshot.position);
    expect(play.snapshot().tick).toEqual(snapshot.tick);
    expect(() => play.focusMechanism("vehicle")).toThrow(/capture/);
    restore();
    expect(play.snapshot()).toEqual(snapshot);
    expect(cameras.at(-1)).toEqual(live);
    expect(play.getState().mechanismOverview).toBe("door");
  } finally {
    play.dispose();
  }
});

it("keeps overview and vehicle input on failed transitions, and leaves overview on successful remote driving", async () => {
  const h = setup(),
    source = await movingSource("vehicle");
  h.renderer.playGeometry = async (options?: {
    include?: string[];
    exclude?: string[];
  }) => {
    if (options?.include && !options.exclude) {
      const group = source.mechanism.project.motionRigs.vehicle.groups.find(
        (g) =>
          g.occurrenceIds.length === options.include!.length &&
          g.occurrenceIds.every((id) => options.include!.includes(id)),
      );
      if (group) return source.mechanism.groups[group.id];
    }
    return source.geometry;
  };
  const { play } = h;
  try {
    await play.enter({ rigIds: ["door", "vehicle"], position: [200, -0.3, 0] });
    play.focusMechanism("door");
    const overview = play.camera();
    expect(() => play.controlVehicle("missing")).toThrow();
    expect(() => play.rideTrain({ trainId: "missing" })).toThrow();
    expect(play.getState().mechanismOverview).toBe("door");
    expect(play.camera()).toEqual(overview);
    play.controlVehicle("vehicle");
    expect(play.getState().mechanismOverview).toBeUndefined();
    expect(play.getState().vehicleControl).toBe("vehicle");
    play.setInput({ moveZ: 1 });
    const driving = play.snapshot();
    expect(() => play.rideTrain({ trainId: "missing" })).toThrow();
    expect(play.getState().vehicleControl).toBe("vehicle");
    expect(play.snapshot()).toEqual(driving);
    play.stepTicks(10);
    expect(
      play.snapshot().mechanisms!.vehicle.pose.vehicle!.position,
    ).not.toEqual(driving.mechanisms!.vehicle.pose.vehicle!.position);
  } finally {
    play.dispose();
  }
});
