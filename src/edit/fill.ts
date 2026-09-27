import { type Project, type Vec3, ensure } from "../core/types";
import { catalog } from "../catalog/catalog";
import { occurrences } from "../core/document";
import { identity } from "../core/math";
export type FillRequest = {
  ref: string;
  colorCode: string;
  columns: number;
  rows: number;
  origin: Vec3;
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
  const obstacles = occurrences(p);
  const parts: {
      ref: string;
      colorCode: string;
      transform: ReturnType<typeof identity>;
    }[] = [],
    unresolvedCells: Vec3[] = [];
  for (let z = 0; z < r.rows; z++)
    for (let x = 0; x < r.columns; x++) {
      const position: Vec3 = [
        r.origin[0] + x * part.width,
        r.origin[1],
        r.origin[2] + z * part.depth,
      ];
      const blocked = obstacles.some((o) => {
        const other = catalog[o.node.ref];
        if (!other) return true;
        const b = o.transform.basis;
        const halfX =
          (Math.abs(b[0]) * other.width + Math.abs(b[2]) * other.depth) / 2;
        const halfZ =
          (Math.abs(b[6]) * other.width + Math.abs(b[8]) * other.depth) / 2;
        return (
          Math.abs(position[0] - o.transform.position[0]) <
            part.width / 2 + halfX - 0.01 &&
          Math.abs(position[2] - o.transform.position[2]) <
            part.depth / 2 + halfZ - 0.01 &&
          position[1] < o.transform.position[1] + other.height - 0.01 &&
          position[1] + part.height > o.transform.position[1] + 0.01
        );
      });
      if (blocked) unresolvedCells.push(position);
      else
        parts.push({
          ref: r.ref,
          colorCode: r.colorCode,
          transform: { ...identity(), position },
        });
    }
  return {
    revision: p.revision,
    parts,
    unresolvedCells,
    diagnostics: [
      "Conservative rectangular body overlap check; grid placement is not verified connectivity.",
    ],
  };
}
