import { Group, Mesh, Vector3 } from "three";
import { LDrawLoader } from "three/examples/jsm/loaders/LDrawLoader.js";
import { LDrawConditionalLineMaterial } from "three/examples/jsm/materials/LDrawConditionalLineMaterial.js";
import { mechanismFixture } from "../../src/mechanisms/fixtures";
import { scopedLDraw } from "../../src/ldraw/io";
import { occurrences } from "../../src/core/document";
import type { CollisionSnapshot } from "../../src/play/types";
export async function movingSource(rigId: string) {
  const project = mechanismFixture(),
    rig = project.motionRigs![rigId];
  const mesh = async (ids: string[]): Promise<CollisionSnapshot> => {
    const source = scopedLDraw(project, ids, true);
    const loader = new LDrawLoader().setConditionalLineMaterial(
      LDrawConditionalLineMaterial,
    );
    const group = await new Promise<Group>((ok, fail) =>
      (
        loader.parse as unknown as (
          s: string,
          o: (g: Group) => void,
          f: (e: unknown) => void,
        ) => void
      )(source, ok, fail),
    );
    group.updateMatrixWorld(true);
    const vertices: number[] = [],
      indices: number[] = [];
    group.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      const p = object.geometry.getAttribute("position"),
        offset = vertices.length / 3;
      for (let i = 0; i < p.count; i++) {
        const v = new Vector3()
          .fromBufferAttribute(p, i)
          .applyMatrix4(object.matrixWorld);
        vertices.push(v.x, v.y, v.z);
      }
      const idx = object.geometry.index;
      for (let i = 0; i < (idx?.count ?? p.count); i++)
        indices.push(offset + (idx ? idx.getX(i) : i));
      object.geometry.dispose();
      for (const m of Array.isArray(object.material)
        ? object.material
        : [object.material])
        m.dispose();
    });
    return {
      revision: project.revision,
      vertices: new Float32Array(vertices),
      indices: new Uint32Array(indices),
      bounds: { min: [-100, -110, -240], max: [100, 0, 50] },
    };
  };
  const ids = new Set(rig.groups.flatMap((g) => g.occurrenceIds));
  return {
    geometry: await mesh(
      occurrences(project)
        .filter((o) => !ids.has(o.id))
        .map((o) => o.id),
    ),
    mechanism: {
      project,
      rigId,
      groups: Object.fromEntries(
        await Promise.all(
          rig.groups.map(async (g) => [g.id, await mesh(g.occurrenceIds)]),
        ),
      ),
    },
  };
}
