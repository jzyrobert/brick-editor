import { readFileSync } from "node:fs";
import { Mesh, Vector3 } from "three";
import { directReferences } from "../../src/catalog/full-pack";
import {
  fullLibrarySources,
  registerFullLibraryFromDisk,
} from "../../scripts/full-library-node";
import { importLDraw } from "../../src/ldraw/io";
import { parseLDraw } from "../../src/render/part-compile-core";
import { normalizeBfcSource } from "../../src/render/bfc-source";
import { sourceHardwareIndex } from "../../src/mechanisms/source-hardware-index";
import type { Project } from "../../src/core/types";
export const CYLINDER_FIXTURE =
  "fixtures/play/mechanical-systems/42043-pneumatic-cylinder.mpd";
export const CYLINDER_REFS = [
  "42043 - 19466c01.dat",
  "42043 - 19467c01.dat",
] as const;
export function pneumaticCylinderSource() {
  registerFullLibraryFromDisk();
  const project = importLDraw(readFileSync(CYLINDER_FIXTURE, "utf8"));
  const needed = new Set<string>();
  for (const model of Object.values(project.models))
    for (const ref of directReferences(
      model.records.map((r) => r.raw).join("\n"),
    ))
      if (!project.models[ref]) needed.add(ref);
  return { project, sources: fullLibrarySources([...needed]) };
}
export async function compileCylinderMember(
  project: Project,
  sources: Record<string, string>,
  ref: string,
) {
  const blocks = Object.values(project.models)
    .filter((m) => m.id !== project.rootModelId)
    .map((m) => `0 FILE ${m.name}\n${m.records.map((r) => r.raw).join("\n")}`);
  const source = normalizeBfcSource(
    [
      "0 FILE __cylinder__.ldr",
      ...readFileSync(
        "public/libraries/catalogue-2026-09-29/LDConfig.ldr",
        "utf8",
      )
        .split(/\r?\n/)
        .filter((l) => l.startsWith("0 !COLOUR")),
      "0 BFC CERTIFY CCW",
      `1 7 0 0 0 1 0 0 0 1 0 0 0 1 ${ref}`,
      ...blocks,
      ...Object.entries(sources).map(([n, s]) => `0 FILE ${n}\n${s}`),
    ].join("\n"),
  );
  const { group } = await parseLDraw(source);
  group.updateMatrixWorld(true);
  const vertices: number[] = [],
    indices: number[] = [];
  group.traverse((o) => {
    if (!(o instanceof Mesh)) return;
    const p = o.geometry.getAttribute("position"),
      idx = o.geometry.index,
      offset = vertices.length / 3;
    for (let i = 0; i < p.count; i++) {
      const v = new Vector3()
        .fromBufferAttribute(p, i)
        .applyMatrix4(o.matrixWorld);
      vertices.push(v.x, v.y, v.z);
    }
    for (let i = 0; i < (idx?.count ?? p.count); i++)
      indices.push(offset + (idx ? idx.getX(i) : i));
  });
  return {
    vertices: new Float64Array(vertices),
    indices: new Uint32Array(indices),
  };
}
export async function pneumaticCylinderFixture() {
  const f = pneumaticCylinderSource(),
    index = sourceHardwareIndex(f.project);
  const members = await Promise.all(
    CYLINDER_REFS.map((ref) =>
      compileCylinderMember(f.project, f.sources, ref),
    ),
  );
  return { ...f, index, members };
}
