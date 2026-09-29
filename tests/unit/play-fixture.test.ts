import { expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { Group, Mesh, Vector3 } from "three";
import { LDrawConditionalLineMaterial } from "three/examples/jsm/materials/LDrawConditionalLineMaterial.js";
import { LDrawLoader } from "three/examples/jsm/loaders/LDrawLoader.js";
import { PlaySession } from "../../src/play/session";
import { template } from "../../src/catalog/templates";
import { explorationSource } from "../../src/catalog/exploration";
import type { CollisionSnapshot } from "../../src/play/types";
it("walks the original LDraw room through its doorway and four stairs using the renderer geometry", async () => {
  const source = readFileSync("fixtures/ldraw/exploration.mpd", "utf8");
  expect(source).toBe(explorationSource());
  expect(template("explore").title).toBe("Exploration room");
  const group = await new Promise<Group>((resolve, reject) =>
    (
      new LDrawLoader().setConditionalLineMaterial(LDrawConditionalLineMaterial)
        .parse as unknown as (
        text: string,
        resolve: (g: Group) => void,
        reject: (e: unknown) => void,
      ) => void
    )(source, resolve, reject),
  );
  group.updateMatrixWorld(true);
  const vertices: number[] = [],
    indices: number[] = [];
  group.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    const geometry = object.geometry;
    const attr = geometry.getAttribute("position");
    const offset = vertices.length / 3;
    for (let i = 0; i < attr.count; i++) {
      const v = new Vector3()
        .fromBufferAttribute(attr, i)
        .applyMatrix4(object.matrixWorld);
      vertices.push(v.x, v.y, v.z);
    }
    if (geometry.index)
      indices.push(
        ...Array.from(
          geometry.index.array as ArrayLike<number>,
          (n) => n + offset,
        ),
      );
    else for (let i = 0; i < attr.count; i++) indices.push(offset + i);
  });
  expect(indices.length).toBeGreaterThan(400);
  const snapshot: CollisionSnapshot = {
    revision: 2,
    vertices: new Float32Array(vertices),
    indices: new Uint32Array(indices),
    bounds: { min: [-188, -128, -240], max: [188, 8, 260] },
  };
  const s = await PlaySession.create(snapshot, {
    position: [0, -0.3, 220],
    ground: false,
  });
  expect(s.snapshot().locomotion).toBe("walk");
  s.stepTicks(3);
  s.setInput({ moveZ: 1 });
  // Stairs are climbed without the old autostep "hop" (which also bounced
  // the walker over studs), so four 8-LDU steps take a few extra ticks.
  s.stepTicks(165);
  expect(s.snapshot().position[2]).toBeLessThan(-10);
  expect(s.snapshot().position[1]).toBeLessThan(-31);
  expect(s.snapshot().grounded).toBe(true);
  // Off-centre approach is blocked by jamb; do not turn the doorway into a filled bounding box.
  s.teleport({ position: [60, -0.3, 220] });
  s.setInput({ moveZ: 1 });
  s.stepTicks(90);
  expect(s.snapshot().position[2]).toBeGreaterThan(175);
  // The explicit low alcove cannot contain the declared capsule.
  expect(() => s.teleport({ position: [120, -0.3, -40] })).toThrow();
  s.dispose();
  group.traverse((o) => {
    if (o instanceof Mesh) {
      o.geometry.dispose();
      const materials = Array.isArray(o.material) ? o.material : [o.material];
      materials.forEach((m) => m.dispose());
    }
  });
});
