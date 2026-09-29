import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Group, Mesh, Vector3 } from "three";
import { LDrawLoader } from "three/examples/jsm/loaders/LDrawLoader.js";
import { LDrawConditionalLineMaterial } from "three/examples/jsm/materials/LDrawConditionalLineMaterial.js";
import { scopedLDraw } from "../../src/ldraw/io";
import { occurrences } from "../../src/core/document";
import type { Project } from "../../src/core/types";
import type { CollisionSnapshot } from "../../src/play/types";
import type { DynamicRigSource } from "../../src/play/dynamics";
import type { Bounds } from "../../src/core/spatial";
import { fullLibrarySources } from "../../scripts/full-library-node";

export const PACK = "public/libraries/catalogue-2026-09-29";
/** Read one pinned pack file by LDraw reference (parts/, parts/s, p/, p/48). */
export function readPack(name: string) {
  const n = name.toLowerCase().replaceAll("\\", "/");
  for (const dir of ["parts", "p"]) {
    const file = join(PACK, dir, n);
    if (existsSync(file)) return readFileSync(file, "utf8");
  }
  return undefined;
}
/** `0 FILE` blocks for the official dependency closure of `text`. */
function closure(text: string, local: Set<string>) {
  const blocks = new Map<string, string>();
  const visit = (source: string) => {
    for (const m of source.matchAll(/^\s*1\s+(?:\S+\s+){13}(.+?)\s*$/gm)) {
      const name = m[1].toLowerCase().replaceAll("\\", "/");
      if (local.has(name) || blocks.has(name)) continue;
      // Parts outside the pinned pack come from the complete library pack.
      const body = readPack(name) ?? fullLibrarySources([name])[name];
      if (body === undefined) continue;
      blocks.set(name, `0 FILE ${name}\n${body}`);
      visit(body);
    }
  };
  visit(text);
  return [...blocks.values()].join("\n");
}
/** Renderer-equivalent collision triangles for occurrences using official parts. */
export async function officialMesh(
  project: Project,
  ids: string[],
  bounds: Bounds = { min: [-400, -300, -500], max: [400, 0, 300] },
): Promise<CollisionSnapshot> {
  const vertices: number[] = [],
    indices: number[] = [];
  if (ids.length) {
    const scoped = scopedLDraw(project, ids, true).replace(
      /\n0 NOFILE\s*$/,
      "",
    );
    const local = new Set(
      [...scoped.matchAll(/^0 FILE (.+)$/gm)].map((m) =>
        m[1].toLowerCase().trim(),
      ),
    );
    const text = scoped + "\n" + closure(scoped, local);
    const loader = new LDrawLoader().setConditionalLineMaterial(
      LDrawConditionalLineMaterial,
    );
    loader.setFileMap(
      Object.fromEntries(
        [...text.matchAll(/^0 FILE (.+)$/gm)].map((m) => [m[1], m[1]]),
      ),
    );
    const group = await new Promise<Group>((ok, fail) =>
      (
        loader.parse as unknown as (
          s: string,
          o: (g: Group) => void,
          f: (e: unknown) => void,
        ) => void
      )(text, ok, fail),
    );
    group.updateMatrixWorld(true);
    group.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      const p = object.geometry.getAttribute("position"),
        offset = vertices.length / 3;
      for (let i = 0; i < p.count; i++) {
        const v = new Vector3()
          .fromBufferAttribute(p, i)
          .applyMatrix4(object.matrixWorld);
        // The loader keeps LDraw axes; only the app's scene root flips them.
        vertices.push(v.x, v.y, v.z);
      }
      const idx = object.geometry.index;
      for (let i = 0; i < (idx?.count ?? p.count); i++)
        indices.push(offset + (idx ? idx.getX(i) : i));
    });
  }
  return {
    revision: project.revision,
    vertices: new Float32Array(vertices),
    indices: new Uint32Array(indices),
    bounds,
  };
}
/** Static world minus the given rigs, plus each rig's group/member meshes. */
export async function officialSources(
  project: Project,
  rigs: Project["motionRigs"],
  /** World bounds reported with the static geometry (default: the door room's). */
  bounds?: Bounds,
) {
  const withRigs = {
    ...project,
    motionRigs: { ...project.motionRigs, ...rigs },
  };
  const members = new Set(
    Object.values(rigs).flatMap((rig) =>
      rig.groups.flatMap((g) => g.occurrenceIds),
    ),
  );
  const geometry = await officialMesh(
    project,
    occurrences(project)
      .filter((o) => !members.has(o.id))
      .map((o) => o.id),
    bounds,
  );
  const sources: DynamicRigSource[] = [];
  for (const rig of Object.values(rigs)) {
    const groups: DynamicRigSource["groups"] = {},
      memberMeshes: DynamicRigSource["members"] = {};
    for (const g of rig.groups) {
      groups[g.id] = await officialMesh(project, g.occurrenceIds);
      for (const id of g.occurrenceIds)
        memberMeshes[id] = await officialMesh(project, [id]);
    }
    sources.push({
      project: withRigs,
      rigId: rig.id,
      groups,
      members: memberMeshes,
    });
  }
  return { geometry, sources };
}
