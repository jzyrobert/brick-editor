import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import * as THREE from "three";
import {
  fullLibrarySources,
  registerFullLibraryFromDisk,
} from "../../scripts/full-library-node";
import { occurrences } from "../../src/core/document";
import { exportLDraw, importLDraw } from "../../src/ldraw/io";
import { normalizeBfcSource } from "../../src/render/bfc-source";
import {
  compilePartRecord,
  parseLDraw,
} from "../../src/render/part-compile-core";
import { indexPrototypeGeometry } from "../../src/render/geometry-index";
import { repairFaceNormals } from "../../src/render/raw-primitives";
import {
  cloneTree,
  drawableTemplates,
  OccurrenceHandles,
} from "../../src/render/occurrence-handles";
import { rebuildPart, type MaterialSlot } from "../../src/render/part-record";
import {
  bindMotorComponentSources,
  motorSourceComponentController,
  partitionMotorSourcePrototype,
  sourceComponentGeometrySignature,
} from "../../src/render/source-component-geometry";
import { LDrawConditionalLineMaterial } from "three/addons/materials/LDrawConditionalLineMaterial.js";

let sources: Record<string, string>,
  prototype: THREE.Group,
  compileSource: string;
const project = () =>
  importLDraw(`0 Original source motor component arrangement
1 16 70 -100 20 0 0 1 0 1 0 -1 0 0 99499.dat`);
beforeAll(async () => {
  expect(registerFullLibraryFromDisk()).toBe(true);
  sources = fullLibrarySources(["99499.dat"]);
  const colours = readFileSync(
    "public/libraries/catalogue-2026-09-29/LDConfig.ldr",
    "utf8",
  )
    .split(/\r?\n/)
    .filter((l) => l.startsWith("0 !COLOUR"))
    .join("\n");
  compileSource = normalizeBfcSource(
    "0 FILE __render__.ldr\n" +
      colours +
      "\n1 16 0 0 0 1 0 0 0 1 0 0 0 1 99499.dat\n" +
      Object.entries(sources)
        .map(([ref, text]) => "0 FILE " + ref + "\n" + text)
        .join("\n"),
  );
  prototype = (await parseLDraw(compileSource)).group;
  repairFaceNormals(prototype);
  indexPrototypeGeometry(prototype);
}, 20000);
describe("literal source motor render components", () => {
  it("covers every actual triangle and line exactly once while preserving one source/inventory occurrence", async () => {
    const p = project(),
      o = occurrences(p)[0],
      before = exportLDraw(p),
      binding = await bindMotorComponentSources(sources, p),
      partition = await partitionMotorSourcePrototype(p, o, prototype, binding);
    expect(partition.coverage).toMatchObject({
      triangles: 6192,
      componentTriangles: [5824, 368],
      drawables: drawableTemplates(prototype).length,
    });
    expect(partition.components.map((c) => c.sourcePath)).toEqual([
      ["99499.dat", "10089c01.dat"],
      ["99499.dat", "10095.dat"],
    ]);
    expect(
      partition.components.map((c) => c.geometry.parentOccurrenceId),
    ).toEqual([o.id, o.id]);
    expect(
      partition.components.every(
        (c) =>
          c.geometry.frame.position.join() === o.transform.position.join() &&
          c.geometry.frame.basis.join() === o.transform.basis.join(),
      ),
    ).toBe(true);
    expect(
      partition.components.reduce(
        (n, c) => n + c.geometry.indices.length / 3,
        0,
      ),
    ).toBe(6192);
    expect(occurrences(p)).toHaveLength(1);
    expect(exportLDraw(p)).toBe(before);
  });
  it("retains source branch coverage through actual worker-cache part records", async () => {
    const buffer = await compilePartRecord(compileSource);
    expect(buffer).toBeInstanceOf(ArrayBuffer);
    const materials = new Map<string, THREE.Material>();
    const rebuilt = rebuildPart(buffer!, (slot: MaterialSlot) => {
      const key = slot.code + ":" + slot.kind;
      if (!materials.has(key)) {
        const material =
          slot.kind === "face"
            ? new THREE.MeshStandardMaterial()
            : slot.kind === "conditional"
              ? new LDrawConditionalLineMaterial()
              : new THREE.LineBasicMaterial();
        material.userData.code = slot.code;
        materials.set(key, material);
      }
      return materials.get(key)!;
    });
    const p = project(),
      o = occurrences(p)[0],
      binding = await bindMotorComponentSources(sources, p);
    const partition = await partitionMotorSourcePrototype(
      p,
      o,
      rebuilt,
      binding,
    );
    expect(partition.coverage.componentTriangles).toEqual([5824, 368]);
  });
  it("moves only the materialized rotor from its rest phase while the case follows the carrier and other occurrences remain still", async () => {
    const p = project(),
      o = occurrences(p)[0],
      binding = await bindMotorComponentSources(sources, p),
      partition = await partitionMotorSourcePrototype(p, o, prototype, binding),
      handles = new OccurrenceHandles(new THREE.Group());
    const handle = handles.place(o.id, prototype),
      other = handles.place("other-motor", prototype);
    handles.materialize(handle);
    handles.materialize(other);
    const caseGroup = handle.object!.children[0].children[0],
      output = handle.object!.children[0].children[1],
      caseRest = caseGroup.matrix.clone(),
      outputRest = output.matrix.clone(),
      otherRest = other.object!.children[0].children[1].matrix.clone(),
      signature = await sourceComponentGeometrySignature(prototype),
      controller = motorSourceComponentController(handle, partition);
    handle.matrix.makeTranslation(80, -90, 30);
    handle.moved();
    controller.setOutputAngle(450);
    expect(caseGroup.matrix.equals(caseRest)).toBe(true);
    expect(output.matrix.equals(outputRest)).toBe(false);
    const actual = new THREE.Vector3(14, 0, 0).applyMatrix4(output.matrix);
    expect(actual.x).toBeCloseTo(0, 12);
    expect(actual.y).toBeCloseTo(14, 12);
    expect(handle.matrix.elements.slice(12, 15)).toEqual([80, -90, 30]);
    expect(other.object!.children[0].children[1].matrix.equals(otherRest)).toBe(
      true,
    );
    expect(await sourceComponentGeometrySignature(prototype)).toEqual(
      signature,
    );
    controller.reset();
    expect(output.matrix.equals(outputRest)).toBe(true);
    expect(caseGroup.matrix.equals(caseRest)).toBe(true);
    handles.release(handle);
    expect(() => controller.setOutputAngle(10)).toThrow(
      "no longer materialized",
    );
  });
  it("refuses omitted, duplicated, displaced and counterfeit source branches instead of cutting a replacement bounds mesh", async () => {
    const p = project(),
      o = occurrences(p)[0],
      binding = await bindMotorComponentSources(sources, p);
    const omitted = cloneTree(prototype);
    omitted.children[0].remove(omitted.children[0].children[1]);
    await expect(
      partitionMotorSourcePrototype(p, o, omitted, binding),
    ).rejects.toThrow("actual shortcut branches");
    const displaced = cloneTree(prototype);
    displaced.children[0].children[1].position.x = 2;
    await expect(
      partitionMotorSourcePrototype(p, o, displaced, binding),
    ).rejects.toThrow("geometry changed");
    const duplicate = cloneTree(prototype);
    duplicate.children[0].add(cloneTree(duplicate.children[0].children[1]));
    await expect(
      partitionMotorSourcePrototype(p, o, duplicate, binding),
    ).rejects.toThrow("actual shortcut branches");
    const wrong = cloneTree(prototype);
    const leaf = drawableTemplates(wrong).find((t) => t.mesh)!.object;
    leaf.geometry = leaf.geometry.clone();
    leaf.geometry.getAttribute("position").setX(0, 100);
    await expect(
      partitionMotorSourcePrototype(p, o, wrong, binding),
    ).rejects.toThrow("geometry changed");
  });
  it("refuses authoritative dependency shadows and stale or unrelated project bindings", async () => {
    const p = project(),
      o = occurrences(p)[0],
      binding = await bindMotorComponentSources(sources, p);
    await expect(
      partitionMotorSourcePrototype(project(), o, prototype, binding),
    ).rejects.toThrow("reviewed project");
    p.revision++;
    await expect(
      partitionMotorSourcePrototype(p, o, prototype, binding),
    ).rejects.toThrow("reviewed project");
    const shadow = project();
    shadow.models["axlehole.dat"] = {
      ...structuredClone(shadow.models[shadow.rootModelId]),
      id: "axlehole.dat",
      name: "axlehole.dat",
    };
    await expect(bindMotorComponentSources(sources, shadow)).rejects.toThrow(
      "Project shadows reviewed source",
    );
  });
});
