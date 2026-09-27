import { expect, it, vi } from "vitest";
import * as THREE from "three";
import { Editor } from "../../src/core/commands";
import {
  occurrences,
  createProject,
  validateDocument,
} from "../../src/core/document";
import { copyFragment } from "../../src/core/fragments";
import { importLDraw, exportLDraw } from "../../src/ldraw/io";
import { uid } from "../../src/core/types";
import { encodeNative, decodeNative } from "../../src/persistence/native";
import { LayerGhost } from "../../src/render/layerGhost";
const command = (
  e: Editor,
  type: string,
  payload: Record<string, unknown> = {},
) =>
  e.dispatch({
    schemaVersion: 1,
    commandId: uid(),
    expectedRevision: e.project.revision,
    type,
    payload,
  });
const source = () =>
  importLDraw(`0 FILE main.ldr
0 !LICENSE CC0-1.0
1 4 10 0 20 -1 0.2 0 0 1 0 0 0 1 room.ldr
1 1 200 0 20 0 0 1 0 1 0 -1 0 0 room.ldr
0 FILE room.ldr
0 BFC CERTIFY CCW
1 16 0 0 0 1 0 0 0 1 0 0 0 1 custom.dat
1 16 40 0 0 1 0 0 0 1 0 0 0 1 3001.dat
0 FILE custom.dat
0 !LDRAW_ORG Unofficial_Part
0 !LICENSE CC0-1.0
0 BFC CERTIFY CCW
3 16 0 0 0 20 0 0 0 -20 0
0 NOFILE
`);
it("duplicates just the assigned occurrence subset preserving source, affine transforms and metadata as one undo", () => {
  const p = source(),
    selected = occurrences(p)[0];
  p.layers.extra = {
    id: "extra",
    name: "Custom",
    visible: true,
    locked: true,
    order: 1,
  };
  p.layerAssignments[selected.id] = "extra";
  p.groups.g = [selected.id];
  p.instructionPlans.plan = { name: "Plan", steps: [[selected.id]] };
  p.marketplace.overrides[selected.id] = {
    itemId: "custom",
    colorId: "4",
    acknowledged: true,
    substitution: true,
  };
  const e = new Editor(p),
    before = e.project;
  const result = command(e, "layers.duplicate", { layerId: "extra" }),
    id = result.addedIds[0],
    layer = result.addedLayerIds[0];
  expect(result.addedIds).toHaveLength(1);
  expect(result.copyMappings[selected.id]).toEqual([id]);
  const added = occurrences(e.project).find((o) => o.id === id)!;
  expect(added.transform).toEqual(selected.transform);
  expect(added.colorCode).toBe(selected.colorCode);
  expect(added.layerId).toBe(layer);
  expect(e.project.layers[layer].locked).toBe(false);
  expect(e.project.layers.extra).toEqual(before.layers.extra);
  expect(e.project.marketplace.overrides[id]).toEqual(
    p.marketplace.overrides[selected.id],
  );
  expect(Object.values(e.project.groups)).toContainEqual([id]);
  expect(
    Object.values(e.project.instructionPlans).some((x) => x.steps[0][0] === id),
  ).toBe(true);
  expect(exportLDraw(e.project)).toContain("3 16 0 0 0 20 0 0 0 -20 0");
  expect(occurrences(e.project).filter((o) => o.id !== id)).toEqual(
    occurrences(before),
  );
  command(e, "history.undo");
  expect({ ...e.project, revision: before.revision }).toEqual(before);
  command(e, "history.redo");
  expect(occurrences(e.project).map((o) => o.id)).toContain(id);
});
it("guards hidden scope, budgets and opaque source atomically; empty locked layers remain duplicable", () => {
  const e = new Editor(source()),
    layer = e.project.defaultLayerId;
  command(e, "layers.update", { layerId: layer, visible: false });
  const before = e.project;
  expect(() => command(e, "layers.duplicate", { layerId: layer })).toThrow(
    /hidden/,
  );
  expect(() =>
    command(e, "layers.duplicate", {
      layerId: layer,
      includeHidden: true,
      maxAdditions: 3,
    }),
  ).toThrow(/budget/);
  expect(e.project).toEqual(before);
  const result = command(e, "layers.duplicate", {
    layerId: layer,
    includeHidden: true,
    maxAdditions: 4,
  });
  expect(e.project.layers[result.addedLayerIds[0]].visible).toBe(false);
  const p = source();
  p.models[p.rootModelId].records.push({
    id: uid(),
    raw: "0 !CUSTOM opaque state",
  });
  const opaque = new Editor(p);
  expect(() =>
    command(opaque, "layers.duplicate", { layerId: p.defaultLayerId }),
  ).toThrow(/directive/);
  expect(opaque.project).toEqual(p);
  const empty = new Editor();
  command(empty, "layers.update", {
    layerId: empty.project.defaultLayerId,
    locked: true,
  });
  expect(
    command(empty, "layers.duplicate", {
      layerId: empty.project.defaultLayerId,
      maxAdditions: 0,
    }).addedLayerIds,
  ).toHaveLength(1);
});
it("organizes nested folders with cycle guards and explicit promotion that keeps geometry and supports undo", () => {
  const e = new Editor(source()),
    initial = occurrences(e.project);
  const a = command(e, "folders.add", { name: "Building" }).addedFolderIds[0];
  const b = command(e, "folders.add", { name: "Roof", parentFolderId: a })
    .addedFolderIds[0];
  command(e, "layers.folder", {
    layerId: e.project.defaultLayerId,
    parentFolderId: b,
  });
  const before = e.project;
  expect(() =>
    command(e, "folders.move", { folderId: a, parentFolderId: b }),
  ).toThrow(/cycle/);
  expect(e.project).toEqual(before);
  expect(() => command(e, "folders.remove", { folderId: b })).toThrow();
  command(e, "folders.remove", { folderId: b, mode: "promote-children" });
  expect(e.project.layers[e.project.defaultLayerId].parentFolderId).toBe(a);
  expect(occurrences(e.project)).toEqual(initial);
  command(e, "history.undo");
  expect({ ...e.project, revision: before.revision }).toEqual(before);
  command(e, "folders.remove", { folderId: a, mode: "promote-children" });
  expect(e.project.layerFolders![b].parentFolderId).toBeUndefined();
});
it("pastes layers across projects with remapped folder ancestry and rejects excessive nesting", () => {
  const p = source();
  p.layerFolders = {
    a: { id: "a", name: "A", order: 0 },
    b: { id: "b", name: "B", order: 1, parentFolderId: "a" },
  };
  p.layers[p.defaultLayerId].parentFolderId = "b";
  p.layers[p.defaultLayerId].name = "Imported layer";
  const fragment = copyFragment(p, { occurrenceIds: [occurrences(p)[0].id] }),
    e = new Editor(createProject());
  command(e, "clipboard.paste", { fragment });
  validateDocument(e.project);
  const layer = e.project.layers[occurrences(e.project)[0].layerId],
    folder = e.project.layerFolders![layer.parentFolderId!]!;
  expect(folder.name).toBe("B");
  expect(folder.id).not.toBe("b");
  expect(e.project.layerFolders![folder.parentFolderId!].name).toBe("A");
  const deep = createProject();
  deep.layerFolders = {};
  for (let i = 0; i < 33; i++)
    deep.layerFolders[String(i)] = {
      id: String(i),
      name: "Level",
      order: i,
      ...(i ? { parentFolderId: String(i - 1) } : {}),
    };
  expect(() => validateDocument(deep)).toThrow(/32/);
});
it("ghosts shared materials per object and restores shadows without mutating or leaking shared materials", () => {
  const material = new THREE.MeshStandardMaterial({ opacity: 0.8 }),
    originalDispose = vi.spyOn(material, "dispose"),
    geometry = new THREE.BoxGeometry();
  const a = new THREE.Mesh(geometry, material),
    b = new THREE.Mesh(geometry, material);
  a.castShadow = b.castShadow = true;
  const ga = new THREE.Group(),
    gb = new THREE.Group();
  ga.add(a);
  gb.add(b);
  const handles = new Map([
      ["a", ga],
      ["b", gb],
    ]),
    ghost = new LayerGhost();
  ghost.apply(handles, new Set(["b"]));
  const clone = b.material;
  const disposed = vi.spyOn(clone, "dispose");
  expect(a.material).toBe(material);
  expect(material.opacity).toBe(0.8);
  expect(clone.opacity).toBeCloseTo(0.144);
  expect(clone.depthWrite).toBe(false);
  expect(b.castShadow).toBe(false);
  ghost.apply(handles, new Set(["a"]));
  expect(disposed).toHaveBeenCalledOnce();
  expect(b.material).toBe(material);
  expect(b.castShadow).toBe(true);
  ghost.restore();
  expect(a.material).toBe(material);
  expect(a.castShadow).toBe(true);
  expect(originalDispose).not.toHaveBeenCalled();
  geometry.dispose();
  material.dispose();
});

it("persists folder ancestry and duplicated layers through native bundles", async () => {
  const e = new Editor(source());
  const f = command(e, "folders.add", { name: "Persisted" }).addedFolderIds[0];
  command(e, "layers.folder", {
    layerId: e.project.defaultLayerId,
    parentFolderId: f,
  });
  command(e, "layers.duplicate", { layerId: e.project.defaultLayerId });
  expect(await decodeNative(await encodeNative(e.project))).toEqual(e.project);
});
