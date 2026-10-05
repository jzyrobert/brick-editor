import { Mesh, Vector3 } from "three";
import { normalizeBfcSource } from "../render/bfc-source";
import { parseLDraw } from "../render/part-compile-core";
import { ensure, type Project } from "../core/types";
import type { PneumaticCylinderSurface } from "./pneumatic-cylinder-source";

/** Colour-independent stand-ins: compiled positions never depend on colour,
 * and every reviewed surface is compared by its exact geometry digest. */
const COLOURS = [
  "0 !COLOUR Main_Colour CODE 16 VALUE #808080 EDGE #333333",
  "0 !COLOUR Edge_Colour CODE 24 VALUE #333333 EDGE #000000",
];

/**
 * Compiles one reviewed pneumatic member exactly as the reviewed benches do:
 * the project's own embedded definitions plus hash-verified library texts,
 * through the renderer's LDraw parser, in part-local LDU. The caller must
 * still pass the result to the reviewed preparation, which refuses any
 * surface whose canonical digest differs from the reviewed manifest.
 */
export async function compileReviewedPneumaticSurface(
  project: Project,
  sources: Readonly<Record<string, string>>,
  ref: string,
): Promise<PneumaticCylinderSurface> {
  const blocks = Object.values(project.models)
    .filter((m) => m.id !== project.rootModelId)
    .map((m) => `0 FILE ${m.name}\n${m.records.map((r) => r.raw).join("\n")}`);
  const text = normalizeBfcSource(
    [
      "0 FILE __pneumatic_member__.ldr",
      ...COLOURS,
      "0 BFC CERTIFY CCW",
      `1 7 0 0 0 1 0 0 0 1 0 0 0 1 ${ref}`,
      ...blocks,
      ...Object.entries(sources).map(([n, s]) => `0 FILE ${n}\n${s}`),
    ].join("\n"),
  );
  ensure(
    text.length <= 8_000_000,
    "LIMIT_EXCEEDED",
    "The pneumatic source is too large to check safely",
  );
  const { group } = await parseLDraw(text);
  group.updateMatrixWorld(true);
  const vertices: number[] = [],
    indices: number[] = [];
  const v = new Vector3();
  group.traverse((o) => {
    if (!(o instanceof Mesh)) return;
    const p = o.geometry.getAttribute("position"),
      idx = o.geometry.index,
      offset = vertices.length / 3;
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i).applyMatrix4(o.matrixWorld);
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
