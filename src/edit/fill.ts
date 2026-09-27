import {
  type Project,
  type Vec3,
  type Basis,
  type Transform,
  ensure,
} from "../core/types";
import { catalog } from "../catalog/catalog";
import { occurrences } from "../core/document";
import { identity, mv, add, physical } from "../core/math";
export type FillRequest = {
  ref: string;
  colorCode: string;
  columns: number;
  rows: number;
  origin: Vec3;
  basis?: Basis;
  layerId: string;
  maxAdditions: number;
};
export function fillPreview(p: Project, r: FillRequest) {
  const part = catalog[r.ref];
  ensure(part, "INVALID_INPUT", "Fill requires an audited rectangular part");
  ensure(
    [r.columns, r.rows, r.maxAdditions].every(
      (n) => Number.isSafeInteger(n) && n > 0,
    ) && r.columns * r.rows <= Math.min(r.maxAdditions, 10000),
    "LIMIT_EXCEEDED",
    "Fill exceeds additions budget",
  );
  ensure(
    p.layers[r.layerId] && !p.layers[r.layerId].locked,
    "LAYER_LOCKED",
    "Fill layer is locked",
  );
  const basis = r.basis ?? identity().basis;
  ensure(
    r.origin.length === 3 &&
      r.origin.every((n) => Number.isFinite(n) && Math.abs(n) <= 1e7),
    "INVALID_INPUT",
    "Fill origin exceeds coordinate limits",
  );
  ensure(
    basis.length === 9 &&
      basis.every(Number.isFinite) &&
      physical({ position: r.origin, basis }),
    "INVALID_INPUT",
    "Fill basis must be a rigid rotation",
  );
  const bounds = (definition: typeof part, transform: Transform) => {
    const min: Vec3 = [Infinity, Infinity, Infinity],
      max: Vec3 = [-Infinity, -Infinity, -Infinity];
    for (const x of [-definition.width / 2, definition.width / 2])
      for (const y of [0, definition.height])
        for (const z of [-definition.depth / 2, definition.depth / 2]) {
          const v = add(transform.position, mv(transform.basis, [x, y, z]));
          for (let i = 0; i < 3; i++) {
            min[i] = Math.min(min[i], v[i]);
            max[i] = Math.max(max[i], v[i]);
          }
        }
    return { min, max };
  };
  const obstacles = occurrences(p).map((o) =>
    catalog[o.node.ref] ? bounds(catalog[o.node.ref], o.transform) : null,
  );
  const parts: {
      ref: string;
      colorCode: string;
      transform: ReturnType<typeof identity>;
    }[] = [],
    unresolvedCells: Vec3[] = [];
  for (let z = 0; z < r.rows; z++)
    for (let x = 0; x < r.columns; x++) {
      const position = add(
        r.origin,
        mv(basis, [x * part.width, 0, z * part.depth]),
      );
      const candidate = bounds(part, { position, basis });
      const blocked = obstacles.some(
        (other) =>
          !other ||
          [0, 1, 2].every(
            (i) =>
              candidate.min[i] < other.max[i] - 0.01 &&
              candidate.max[i] > other.min[i] + 0.01,
          ),
      );
      if (blocked) unresolvedCells.push(position);
      else
        parts.push({
          ref: r.ref,
          colorCode: r.colorCode,
          transform: { basis: [...basis] as Basis, position },
        });
    }
  return {
    revision: p.revision,
    parts,
    unresolvedCells,
    diagnostics: [
      "Conservative world AABB check of all transformed body corners; unknown obstacles block every cell; grid placement is not verified connectivity.",
    ],
  };
}
