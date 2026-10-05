import { beforeAll, afterEach, expect, it, vi } from "vitest";
import * as THREE from "three";
import {
  registerFullLibraryFromDisk,
  fullLibrarySources,
} from "../../scripts/full-library-node";
import { physicalPfLargeMotorFixture } from "../../src/mechanisms/pf-large-motor-fixture";
import { SceneAdapter } from "../../src/render/adapter";
import { OccurrenceHandles } from "../../src/render/occurrence-handles";
import { PlayMemberGeometryCapture } from "../../src/render/play-member-geometry";
import { BrowserPlay } from "../../src/play/browser";
import { compileOfficialPart } from "../helpers/compile-part";
import { addFullSources } from "../../src/catalog/full-library";
import { exportLDraw } from "../../src/ldraw/io";
import { physicalPlayEligibility } from "../../src/mechanisms/physical-play";

vi.mock("../../src/play/avatar", async (original) => ({
  ...(await original<typeof import("../../src/play/avatar")>()),
  loadAvatarGeometry: async () =>
    new Error("No avatar draw in the headless adapter seam"),
}));
beforeAll(() => {
  expect(registerFullLibraryFromDisk()).toBe(true);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** All motor source captures, native/session entry, live handle materialization
 * and reset use production methods. Only GPU drawing/camera and avatar asset
 * loading are replaced in Node. */
async function setup() {
  vi.stubGlobal("document", { pointerLockElement: null });
  vi.stubGlobal("cancelAnimationFrame", () => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  const { project, rig, all } = physicalPfLargeMotorFixture(undefined, 23);
  addFullSources(
    new Map(Object.entries(fullLibrarySources(all.map((o) => o.node.ref)))),
  );
  const root = new THREE.Group();
  root.rotation.x = Math.PI;
  const handles = new OccurrenceHandles(root);
  for (const o of all) {
    const prototype = (await compileOfficialPart(o.node.ref)).clone();
    (
      SceneAdapter.prototype as unknown as {
        finishPrototype(
          group: THREE.Group,
          double: boolean,
          ref: string,
        ): THREE.Group;
      }
    ).finishPrototype(prototype, false, o.node.ref);
    const h = handles.place(o.id, prototype);
    const p = o.transform.position,
      b = o.transform.basis;
    h.matrix.set(
      b[0],
      b[1],
      b[2],
      p[0],
      b[3],
      b[4],
      b[5],
      p[1],
      b[6],
      b[7],
      b[8],
      p[2],
      0,
      0,
      0,
      1,
    );
  }
  const adapter = Object.create(SceneAdapter.prototype) as SceneAdapter;
  const batches = {
    dynamicIds: new Set<string>(),
    setDynamic(next: Set<string>) {
      const changed =
        next.size !== this.dynamicIds.size ||
        [...next].some((id) => !this.dynamicIds.has(id));
      this.dynamicIds = next;
      return changed;
    },
    refresh: vi.fn(),
  };
  Object.assign(adapter, {
    project,
    revision: project.revision,
    root,
    handles,
    batches,
    batchingEnabled: true,
    scene: new THREE.Scene(),
    renderer: { domElement: { clientWidth: 800, clientHeight: 600 } },
    libraryBlocks: new Map(
      Object.entries(fullLibrarySources(["99499.dat"])).map(([ref, text]) => [
        ref,
        "0 FILE " + ref + "\n" + text,
      ]),
    ),
    memberGeometry: new PlayMemberGeometryCapture(),
    ready: async () => {},
    update: async () => {},
    invalidate: vi.fn(),
    playCamera: vi.fn(),
    beginPlayView: () => () => {},
  });
  const play = new BrowserPlay(
    () => adapter,
    () => project.revision,
    () => {},
    () => project,
  );
  return { adapter, handles, project, rig, all, play, batches };
}
it("refuses a cancelled same-revision capture before it can replace a live replacement controller", async () => {
  const { adapter, handles, project, rig, all, play } = await setup();
  let release!: () => void, entered!: () => void;
  const gate = new Promise<void>((r) => {
      release = r;
    }),
    started = new Promise<void>((r) => {
      entered = r;
    });
  const digest = crypto.subtle.digest.bind(crypto.subtle);
  const original = adapter.playMotorComponentGeometry.bind(adapter);
  let first = true;
  vi.spyOn(adapter, "playMotorComponentGeometry").mockImplementation(
    async (...args) => {
      if (first) {
        first = false;
        vi.spyOn(crypto.subtle, "digest").mockImplementationOnce(
          async (...input) => {
            entered();
            await gate;
            return digest(...input);
          },
        );
      }
      return original(...args);
    },
  );
  const request = {
    rigId: rig.id,
    autoDoors: false,
    trains: false,
    ground: false,
    locomotion: "fly-noclip" as const,
    position: [300, -200, 400] as [number, number, number],
  };
  const revision = project.revision;
  const entering = play.enter(request);
  // Attach rejection immediately so cancellation cannot create an unhandled rejection.
  const cancelled = expect(entering).rejects.toThrow("cancelled");
  try {
    await started;
    play.exit();
    await play.enter(request);
    play.stepTicks(10);
    const live = handles.get(all[0].id)!.object!,
      output = live.children[0].children[1],
      matrix = output.matrix.clone();
    const state = play.snapshot();
    release();
    await cancelled;
    expect(project.revision).toBe(revision);
    expect(play.getState().active).toBe(true);
    expect(handles.get(all[0].id)!.object).toBe(live);
    expect(output.matrix.equals(matrix)).toBe(true);
    expect(play.snapshot().mechanism!.pose).toEqual(state.mechanism!.pose);
    play.stepTicks(5);
    expect(output.matrix.equals(matrix)).toBe(false);
  } finally {
    release();
    play.dispose();
  }
}, 60000);
it("enters actual PF-L through Browser capture, renders only its rotor and restores original parents and inventory", async () => {
  const { adapter, handles, project, rig, all, play, batches } = await setup();
  const before = exportLDraw(project),
    id = all[0].id,
    parent = handles.get(id)!;
  const rest = parent.matrix.clone();
  try {
    expect(physicalPlayEligibility(project, rig, all).eligible).toBe(false);
    const capture = vi.spyOn(adapter, "playMotorComponentGeometry");
    expect(await play.reviewMotorConnections(project, [rig])).toEqual({});
    expect(physicalPlayEligibility(project, rig, all).eligible).toBe(true);
    expect(capture).not.toHaveBeenCalled();
    expect(play.getState().active).toBe(false);
    expect(exportLDraw(project)).toBe(before);
    await play.enter({
      rigId: rig.id,
      autoDoors: false,
      trains: false,
      ground: false,
      locomotion: "fly-noclip",
      position: [300, -200, 400],
    });
    const live = parent.object!,
      casing = live.children[0].children[0],
      output = live.children[0].children[1];
    const caseRest = casing.matrix.clone();
    expect(output.matrix.elements[1]).toBeCloseTo(
      Math.sin((23 * Math.PI) / 180),
      6,
    );
    play.setMotor({
      rigId: rig.id,
      jointId: "motor-output",
      enabled: true,
      input: 1,
    });
    const moved = play.stepTicks(20).mechanism!;
    expect(moved.pose.jointPositions["motor-output"]).toBeGreaterThan(20);
    expect(parent.object).toBe(live);
    expect(parent.matrix.equals(rest)).toBe(true);
    expect(casing.matrix.equals(caseRest)).toBe(true);
    const angle =
      ((23 + moved.pose.jointPositions["motor-output"]) * Math.PI) / 180;
    expect(output.matrix.elements[1]).toBeCloseTo(Math.sin(angle), 6);
    expect(
      (await adapter.playMemberGeometry([id]))[id].indices.length / 3,
    ).toBe(6080);
    expect(exportLDraw(project)).toBe(before);
    play.exit();
    expect(parent.matrix.equals(rest)).toBe(true);
    expect(parent.object).toBeNull();
    expect(output.matrix.equals(new THREE.Matrix4())).toBe(true);
    expect(batches.dynamicIds.size).toBe(0);
    expect(() => adapter.applyTransientMotorOutputs({ [id]: 90 })).toThrow(
      "Prepare motor components",
    );
  } finally {
    play.dispose();
  }
}, 60000);
