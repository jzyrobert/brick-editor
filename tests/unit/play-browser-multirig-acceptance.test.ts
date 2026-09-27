import { afterEach, expect, it, vi } from "vitest";
import { Group } from "three";
import { BrowserPlay } from "../../src/play/browser";
import { mechanismFixture } from "../../src/mechanisms/fixtures";
import type { SceneAdapter } from "../../src/render/adapter";
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
    renderer: { domElement: { clientWidth: 1200, clientHeight: 800 } },
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
    playCamera: () => {},
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
