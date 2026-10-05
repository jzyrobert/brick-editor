import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import {
  fullLibrarySources,
  registerFullLibraryFromDisk,
} from "../../scripts/full-library-node";
import { occurrences } from "../../src/core/document";
import type { Project } from "../../src/core/types";
import { exportLDraw, importLDraw } from "../../src/ldraw/io";
import { SceneAdapter } from "../../src/render/adapter";
import { normalizeBfcSource } from "../../src/render/bfc-source";
import { indexPrototypeGeometry } from "../../src/render/geometry-index";
import { OccurrenceHandles } from "../../src/render/occurrence-handles";
import { parseLDraw } from "../../src/render/part-compile-core";
import { PlayMemberGeometryCapture } from "../../src/render/play-member-geometry";
import { repairFaceNormals } from "../../src/render/raw-primitives";
import { sourceComponentGeometrySignature } from "../../src/render/source-component-geometry";

let sources: Record<string, string>, prototype: THREE.Group;
beforeAll(async () => {
  expect(registerFullLibraryFromDisk()).toBe(true);
  sources = fullLibrarySources(["99499.dat"]);
  const colours = readFileSync(
    "public/libraries/catalogue-2026-09-29/LDConfig.ldr",
    "utf8",
  )
    .split(/\r?\n/)
    .filter((line) => line.startsWith("0 !COLOUR"))
    .join("\n");
  prototype = (
    await parseLDraw(
      normalizeBfcSource(
        "0 FILE __render__.ldr\n" +
          colours +
          "\n1 16 0 0 0 1 0 0 0 1 0 0 0 1 99499.dat\n" +
          Object.entries(sources)
            .map(([ref, text]) => "0 FILE " + ref + "\n" + text)
            .join("\n"),
      ),
    )
  ).group;
  repairFaceNormals(prototype);
  indexPrototypeGeometry(prototype);
}, 20000);

/** Exercise real adapter methods and real occurrence materialization without a
 * WebGL constructor. Only readiness, invalidation and batch draw submission are
 * replaced; source capture, transient poses, dynamic membership and reset run
 * through the production adapter prototype. */
function harness() {
  const project = importLDraw(`0 Original two motor carrier arrangement
1 16 70 -100 20 0 0 1 0 1 0 -1 0 0 99499.dat
1 16 -80 -100 20 1 0 0 0 1 0 0 0 1 99499.dat`);
  const root = new THREE.Group(),
    handles = new OccurrenceHandles(root);
  const all = occurrences(project);
  for (const o of all) {
    const h = handles.place(o.id, prototype),
      b = o.transform.basis,
      p = o.transform.position;
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
  const state = adapter as unknown as {
    project: Project;
    revision: number;
    motorComponents?: unknown;
  };
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
    libraryBlocks: new Map(
      Object.entries(sources).map(([ref, text]) => [
        ref,
        "0 FILE " + ref + "\n" + text,
      ]),
    ),
    memberGeometry: new PlayMemberGeometryCapture(),
    ready: async () => {},
    invalidate: vi.fn(),
  });
  return { adapter, state, project, handles, batches, all };
}
describe("source motor adapter lifecycle", () => {
  it("updates steady rotor ticks without refilling the static batch arrays", async () => {
    const { adapter, handles, batches, all } = harness(),
      id = all[0].id;
    await adapter.playMotorComponentGeometry([id]);
    adapter.applyTransientMotorOutputs({ [id]: 0 });
    const live = handles.get(id)!.object!,
      refreshes = batches.refresh.mock.calls.length;
    for (const angle of [10, 20, 90, 180, 450])
      adapter.applyTransientMotorOutputs({ [id]: angle });
    expect(handles.get(id)!.object).toBe(live);
    expect(batches.refresh).toHaveBeenCalledTimes(refreshes);
    expect(batches.dynamicIds).toEqual(new Set([id]));
    expect(live.children[0].children[1].matrix.elements[1]).toBeCloseTo(1);
  });

  it("keeps carrier and case poses independent from the source rotor, captures canonical surfaces and restores the same live copy", async () => {
    const { adapter, project, handles, batches, all } = harness();
    const id = all[0].id,
      otherId = all[1].id;
    const originalExport = exportLDraw(project),
      signature = await sourceComponentGeometrySignature(prototype);
    const restore = adapter.beginTransientPose();
    const initial = handles.get(id)!.matrix.clone();
    const geometry = await adapter.playMotorComponentGeometry([id]);
    expect(geometry[id].case.indices.length / 3).toBe(5824);
    expect(geometry[id].output.indices.length / 3).toBe(368);
    const canonicalOutput = Array.from(geometry[id].output.vertices);
    adapter.applyTransientPose({ [otherId]: all[1].transform });
    const other = handles.get(otherId)!,
      otherCarrier = other.matrix.clone(),
      otherOutput = other.object!.children[0].children[1].matrix.clone();
    adapter.applyTransientPose({
      [id]: { position: [10, -50, 90], basis: [0, 0, 1, 0, 1, 0, -1, 0, 0] },
    });
    const handle = handles.get(id)!,
      live = handle.object!;
    const motor = live.children[0],
      casePart = motor.children[0],
      output = motor.children[1];
    const caseRest = casePart.matrix.clone(),
      outputRest = output.matrix.clone(),
      carrier = handle.matrix.clone();
    adapter.applyTransientMotorOutputs({ [id]: 450 });
    expect(handle.object).toBe(live);
    expect(handle.matrix.equals(carrier)).toBe(true);
    expect(casePart.matrix.equals(caseRest)).toBe(true);
    expect(output.matrix.equals(outputRest)).toBe(false);
    live.updateMatrixWorld(true);
    const local = new THREE.Vector3(14, 0, 0);
    const actual = local.clone().applyMatrix4(output.matrixWorld);
    const expected = local
      .clone()
      .applyMatrix4(new THREE.Matrix4().makeRotationZ(Math.PI / 2))
      .applyMatrix4(carrier);
    expect(actual.distanceTo(expected)).toBeLessThan(1e-9);
    expect(other.matrix.equals(otherCarrier)).toBe(true);
    expect(
      other.object!.children[0].children[1].matrix.equals(otherOutput),
    ).toBe(true);
    expect(Array.from(geometry[id].output.vertices)).toEqual(canonicalOutput);
    expect(
      (await adapter.playMemberGeometry([id]))[id].indices.length / 3,
    ).toBe(6192);
    restore();
    expect(output.matrix.equals(outputRest)).toBe(true);
    expect(casePart.matrix.equals(caseRest)).toBe(true);
    expect(handle.matrix.equals(initial)).toBe(true);
    expect(handle.object).toBeNull();
    expect(batches.dynamicIds.size).toBe(0);
    expect(() => adapter.applyTransientMotorOutputs({ [id]: 20 })).toThrow(
      "Prepare motor components",
    );
    expect(await sourceComponentGeometrySignature(prototype)).toEqual(
      signature,
    );
    expect(exportLDraw(project)).toBe(originalExport);
    expect(occurrences(project)).toHaveLength(2);
  });

  it("resets before recapture and creates a fresh controller for a rematerialized source occurrence", async () => {
    const { adapter, handles, all } = harness(),
      id = all[0].id;
    await adapter.playMotorComponentGeometry([id]);
    adapter.applyTransientMotorOutputs({ [id]: 35 });
    const oldCopy = handles.get(id)!.object!,
      oldOutput = oldCopy.children[0].children[1];
    await adapter.playMotorComponentGeometry([id]);
    expect(oldOutput.matrix.equals(new THREE.Matrix4())).toBe(true);
    adapter.applyTransientMotorOutputs({ [id]: 20 });
    handles.release(handles.get(id)!);
    adapter.applyTransientMotorOutputs({ [id]: -90 });
    expect(handles.get(id)!.object).not.toBe(oldCopy);
    expect(oldOutput.matrix.equals(new THREE.Matrix4())).toBe(true);
    expect(
      handles.get(id)!.object!.children[0].children[1].matrix.elements[1],
    ).toBeCloseTo(-1);
  });

  it("refuses primitive project shadows and leaves an existing live controller unchanged", async () => {
    const { adapter, project, state, handles, all } = harness(),
      id = all[0].id;
    await adapter.playMotorComponentGeometry([id]);
    adapter.applyTransientMotorOutputs({ [id]: 30 });
    const existing = state.motorComponents,
      output = handles.get(id)!.object!.children[0].children[1],
      pose = output.matrix.clone();
    project.models["axlehole.dat"] = {
      ...structuredClone(project.models[project.rootModelId]),
      id: "axlehole.dat",
      name: "axlehole.dat",
    };
    await expect(adapter.playMotorComponentGeometry([id])).rejects.toThrow(
      "Project shadows reviewed source",
    );
    expect(state.motorComponents).toBe(existing);
    expect(output.matrix.equals(pose)).toBe(true);
  });

  it("does not publish stale asynchronous captures or reset the live controller when a new project arrives", async () => {
    const { adapter, state, handles, all } = harness(),
      id = all[0].id;
    await adapter.playMotorComponentGeometry([id]);
    adapter.applyTransientMotorOutputs({ [id]: 30 });
    const existing = state.motorComponents,
      output = handles.get(id)!.object!.children[0].children[1],
      pose = output.matrix.clone();
    let release!: () => void, entered!: () => void;
    const gate = new Promise<void>((resolve) => {
        release = resolve;
      }),
      started = new Promise<void>((resolve) => {
        entered = resolve;
      });
    const digest = crypto.subtle.digest.bind(crypto.subtle);
    const spy = vi
      .spyOn(crypto.subtle, "digest")
      .mockImplementationOnce(async (...args) => {
        entered();
        await gate;
        return digest(...args);
      });
    try {
      const capture = adapter.playMotorComponentGeometry([id]);
      await started;
      state.project = importLDraw(
        "0 A different project\n1 16 0 0 0 1 0 0 0 1 0 0 0 1 3024.dat",
      );
      state.revision++;
      release();
      await expect(capture).rejects.toThrow("build changed");
      expect(state.motorComponents).toBe(existing);
      expect(output.matrix.equals(pose)).toBe(true);
      expect(() => adapter.applyTransientMotorOutputs({ [id]: 50 })).toThrow(
        "Prepare motor components",
      );
    } finally {
      release();
      spy.mockRestore();
    }
  });
});
