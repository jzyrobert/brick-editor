import { describe, expect, it } from "vitest";
import * as THREE from "three";
import {
  RenderBatches,
  registerTreatment,
  VARIANT_MIN_SAVING,
} from "../../src/render/batching";
import {
  HiddenGeometryView,
  registerPartPrototype,
} from "../../src/render/hidden-view";
import {
  OccurrenceHandles,
  type Treatment,
} from "../../src/render/occurrence-handles";
import { compileOfficialPart } from "../helpers/compile-part";

/** Triangles the batches' mesh draws submit (instances × index triangles). */
function drawnTriangles(batches: RenderBatches) {
  let total = 0;
  for (const child of batches.root.children) {
    const mesh = child as THREE.InstancedMesh;
    if (!mesh.isMesh || !child.visible) continue;
    const g = mesh.geometry;
    const per = (g.index?.count ?? g.getAttribute("position").count) / 3;
    total += per * (mesh.isInstancedMesh ? mesh.count : 1);
  }
  return total;
}

async function scene(variantMinSaving = 0) {
  const prototype = await compileOfficialPart("3001.dat");
  registerPartPrototype(prototype, "3001.dat");
  const root = new THREE.Group();
  const three = new THREE.Scene();
  three.add(root);
  const handles = new OccurrenceHandles(root);
  // Two 2 × 4 bricks stacked (LDraw: −Y up), and one beside them.
  handles.place("low", prototype).matrix.makeTranslation(0, 0, 0);
  handles.place("high", prototype).matrix.makeTranslation(0, -24, 0);
  handles.place("side", prototype).matrix.makeTranslation(200, 0, 0);
  // Tiny scene: keep every substitute however few parts use it.
  const batches = new RenderBatches({ variantMinSaving });
  root.add(batches.root);
  batches.setVariantProvider(new HiddenGeometryView());
  batches.rebuild(handles);
  const camera = new THREE.PerspectiveCamera();
  const look = (y: number) => {
    camera.position.set(300, y, 300);
    camera.lookAt(0, 0, 0);
  };
  const draw = () => {
    batches.render({ render: () => {} }, three, camera);
    return drawnTriangles(batches);
  };
  return { prototype, handles, batches, camera, look, draw };
}

describe("hidden-geometry culling in the render batches", () => {
  it("draws only what can be seen in the plain view, by eye side", async () => {
    const { batches, look, draw } = await scene();
    // A 2 × 4 brick: 700 triangles, 384 in its studs, 298 in its cavity.
    // Eye above every part (LDraw −Y): no cavity can be seen. The low brick
    // keeps its box (18), the high and side bricks their studs and box (402).
    look(-500);
    expect(draw()).toBe(18 + 402 + 402);
    expect(batches.stats().plainView).toBe(true);
    // Eye below the parts: the open cavities of the low and side bricks show;
    // the high brick's cavity stays hidden (it rests on the low brick).
    look(500);
    expect(draw()).toBe(316 + 402 + 700);
    expect(batches.stats().fills).toBeGreaterThan(1);
    expect(batches.stats().structures).toBe(1);
  });
  it("falls back to exact geometry when a neighbour is hidden, treated, moved or cut", async () => {
    const { batches, handles, look, draw } = await scene();
    look(-500);
    expect(draw()).toBe(18 + 402 + 402);
    // Hidden neighbour: the low brick's studs show again; only cavities that
    // cannot be seen from above stay out (neighbour-independent).
    handles.get("high")!.visible = false;
    expect(draw()).toBe(402 + 402);
    expect(batches.stats().plainView).toBe(false);
    handles.get("high")!.visible = true;
    expect(draw()).toBe(18 + 402 + 402);
    // A ghosted (see-through) neighbour.
    const ghost = new THREE.MeshStandardMaterial({ transparent: true });
    const base = handles.get("high")!.drawables[0].object
      .material as THREE.Material;
    registerTreatment(ghost, base);
    const treatment: Treatment = {
      treat: (m) => (Array.isArray(m) ? m.map(() => ghost) : ghost),
    };
    handles.get("high")!.treatments = [treatment];
    batches.refresh();
    expect(draw()).toBe(402 + 700 + 402);
    handles.get("high")!.treatments = null;
    batches.refresh();
    expect(draw()).toBe(18 + 402 + 402);
    // Explode lifts a part: nothing neighbour-dependent applies.
    handles.get("high")!.matrix.makeTranslation(0, -64, 0);
    batches.refresh();
    expect(draw()).toBe(402 + 700 + 402);
    handles.get("high")!.matrix.makeTranslation(0, -24, 0);
    batches.refresh();
    expect(draw()).toBe(18 + 402 + 402);
    // A section plane exposes insides: everything is drawn in full.
    batches.setClipPlane(new THREE.Plane(new THREE.Vector3(1, 0, 0), 1000));
    expect(draw()).toBe(700 * 3);
    batches.setClipPlane(null);
    expect(draw()).toBe(18 + 402 + 402);
    expect(batches.stats().structures).toBe(1);
  });
  it("keeps selection sources and stats per occurrence", async () => {
    const { batches, look, draw } = await scene();
    look(-500);
    draw();
    const ids = batches
      .idSources(() => false)
      .flatMap((s) =>
        s.kind === "single" ? [s.occurrenceId] : s.occurrenceIds,
      )
      .sort();
    expect(ids).toEqual(["high", "low", "side"]);
    expect(batches.stats().culled).toBeGreaterThan(0);
  });
  it("drops substitutes that save less than an extra draw costs", async () => {
    // Default threshold: three bricks save 682 triangles at most, far below
    // VARIANT_MIN_SAVING, so no substitute draw is created.
    const { batches, look, draw } = await scene(VARIANT_MIN_SAVING);
    look(-500);
    expect(draw()).toBe(700 * 3);
    expect(batches.stats().culled).toBe(0);
  });
});
