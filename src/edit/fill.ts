import {
  type Project,
  type Vec3,
  type Basis,
  type Transform,
  ensure,
} from "../core/types";
import { catalog, type CatalogPart } from "../catalog/catalog";
import { occurrences } from "../core/document";
import { RESOURCE_PROFILES } from "../core/resource-profile";
import { identity, mv, add, physical, compose, rotationY } from "../core/math";
type CommonFill = {
  colorCode: string;
  columns: number;
  rows: number;
  origin: Vec3;
  basis?: Basis;
  layerId: string;
  maxAdditions: number;
};
export type FillRequest = CommonFill &
  (
    | { ref: string; allowedRefs?: never; orientations?: never; mask?: never }
    | {
        ref?: never;
        allowedRefs: string[];
        orientations?: number[];
        mask?: boolean[];
      }
  );
type Bounds = { min: Vec3; max: Vec3 };
function bounds(part: CatalogPart, transform: Transform): Bounds {
  const min: Vec3 = [Infinity, Infinity, Infinity],
    max: Vec3 = [-Infinity, -Infinity, -Infinity];
  // Audited starter bodies are centred in X/Z, with body extending +Y.
  for (const x of [-part.width / 2, part.width / 2])
    for (const y of [0, part.height])
      for (const z of [-part.depth / 2, part.depth / 2]) {
        const v = add(transform.position, mv(transform.basis, [x, y, z]));
        for (let i = 0; i < 3; i++) {
          min[i] = Math.min(min[i], v[i]);
          max[i] = Math.max(max[i], v[i]);
        }
      }
  return { min, max };
}
export function fillPreview(p: Project, r: FillRequest) {
  ensure(
    r &&
      typeof r === "object" &&
      Object.keys(r).every((k) =>
        [
          "ref",
          "allowedRefs",
          "orientations",
          "mask",
          "colorCode",
          "columns",
          "rows",
          "origin",
          "basis",
          "layerId",
          "maxAdditions",
        ].includes(k),
      ),
    "INVALID_INPUT",
    "Unknown fill setting",
  );
  const setMode = r.allowedRefs !== undefined;
  ensure(
    setMode
      ? r.ref === undefined &&
          Array.isArray(r.allowedRefs) &&
          r.allowedRefs.length > 0 &&
          r.allowedRefs.length <= 32 &&
          new Set(r.allowedRefs).size === r.allowedRefs.length
      : typeof r.ref === "string" &&
          r.orientations === undefined &&
          r.mask === undefined,
    "INVALID_INPUT",
    "Choose one part or a unique allowed part set",
  );
  const refs = setMode ? r.allowedRefs! : [r.ref!];
  ensure(
    refs.every(
      (ref) => Object.hasOwn(catalog, ref) && !Object.hasOwn(p.models, ref),
    ),
    "INVALID_INPUT",
    "Fill requires audited rectangular parts",
  );
  ensure(
    typeof r.colorCode === "string" &&
      /^(?:[0-9]+|0x2[0-9a-fA-F]{6})$/.test(r.colorCode),
    "INVALID_INPUT",
    "Invalid fill colour",
  );
  ensure(
    [r.columns, r.rows, r.maxAdditions].every(
      (n) => Number.isSafeInteger(n) && n > 0 && n <= 10000,
    ) &&
      r.columns * r.rows <= 10000 &&
      (setMode || r.columns * r.rows <= r.maxAdditions),
    "LIMIT_EXCEEDED",
    "Fill exceeds cell/additions budget",
  );
  ensure(
    p.layers[r.layerId] && !p.layers[r.layerId].locked,
    "LAYER_LOCKED",
    "Fill layer is locked",
  );
  const basis = r.basis ?? identity().basis;
  ensure(
    Array.isArray(r.origin) &&
      r.origin.length === 3 &&
      r.origin.every((n) => Number.isFinite(n) && Math.abs(n) <= 1e7),
    "INVALID_INPUT",
    "Fill origin exceeds coordinate limits",
  );
  ensure(
    Array.isArray(basis) &&
      basis.length === 9 &&
      basis.every(Number.isFinite) &&
      physical({ position: r.origin, basis }),
    "INVALID_INPUT",
    "Fill basis must be a rigid rotation",
  );
  const orientations = setMode ? (r.orientations ?? [0, 90]) : [0];
  ensure(
    Array.isArray(orientations) &&
      orientations.length > 0 &&
      orientations.length <= 4 &&
      new Set(orientations).size === orientations.length &&
      orientations.every((d) => [0, 90, 180, 270].includes(d)),
    "INVALID_INPUT",
    "Fill orientations must be unique quarter turns",
  );
  const mask = setMode ? r.mask : undefined;
  ensure(
    mask === undefined ||
      (Array.isArray(mask) &&
        mask.length === r.columns * r.rows &&
        mask.every((v) => typeof v === "boolean")),
    "INVALID_INPUT",
    "Fill mask must contain one boolean per cell in row order",
  );
  const first = catalog[refs[0]];
  if (setMode)
    ensure(
      refs.every((ref) => catalog[ref].height === first.height),
      "INVALID_INPUT",
      "Allowed parts must have the same body height; choose bricks or plates separately",
    );
  const candidates = refs
    .flatMap((ref) =>
      orientations.map((degrees) => {
        const part = catalog[ref],
          turned = degrees === 90 || degrees === 270;
        return {
          ref,
          part,
          degrees,
          width: setMode ? (turned ? part.depth : part.width) / 20 : 1,
          depth: setMode ? (turned ? part.width : part.depth) / 20 : 1,
          basis:
            degrees === 0
              ? basis
              : compose(
                  { position: [0, 0, 0], basis },
                  { position: [0, 0, 0], basis: rotationY(degrees) },
                ).basis,
        };
      }),
    )
    .sort(
      (a, b) =>
        b.width * b.depth - a.width * a.depth ||
        (a.ref < b.ref ? -1 : a.ref > b.ref ? 1 : 0) ||
        a.degrees - b.degrees,
    );
  ensure(
    candidates.every(
      (c) =>
        Number.isSafeInteger(c.width) &&
        c.width > 0 &&
        Number.isSafeInteger(c.depth) &&
        c.depth > 0,
    ),
    "INVALID_INPUT",
    "Allowed footprint must cover whole stud cells",
  );
  const existing = occurrences(p),
    obstacles = existing.map((o) =>
      Object.hasOwn(catalog, o.node.ref) && !Object.hasOwn(p.models, o.node.ref)
        ? bounds(catalog[o.node.ref], o.transform)
        : null,
    ),
    unknown = obstacles.some((o) => !o);
  const parts: { ref: string; colorCode: string; transform: Transform }[] = [],
    unresolvedCells: Vec3[] = [],
    covered = new Uint8Array(r.columns * r.rows);
  const maxParts = Math.min(
    r.maxAdditions,
    Math.max(0, RESOURCE_PROFILES.desktop.occurrences - existing.length),
  );
  let work = 0,
    budgetGaps = 0;
  const charge = () =>
    ensure(
      ++work <= 2000000,
      "LIMIT_EXCEEDED",
      "Fill exceeds bounded search work; reduce the region or part set",
    );
  const point = (x: number, z: number) =>
    add(
      r.origin,
      mv(basis, [
        x * (setMode ? 20 : first.width),
        0,
        z * (setMode ? 20 : first.depth),
      ]),
    );
  for (let z = 0; z < r.rows; z++)
    for (let x = 0; x < r.columns; x++) {
      const index = z * r.columns + x;
      if (covered[index] || mask?.[index] === false) continue;
      let placed = false;
      if (parts.length < maxParts && !unknown)
        for (const c of candidates) {
          charge();
          if (x + c.width > r.columns || z + c.depth > r.rows) continue;
          let fits = true;
          for (let dz = 0; dz < c.depth && fits; dz++)
            for (let dx = 0; dx < c.width; dx++) {
              charge();
              const i = (z + dz) * r.columns + x + dx;
              if (covered[i] || mask?.[i] === false) {
                fits = false;
                break;
              }
            }
          if (!fits) continue;
          const position = point(x + (c.width - 1) / 2, z + (c.depth - 1) / 2),
            transform = { position, basis: [...c.basis] as Basis },
            candidate = bounds(c.part, transform);
          ensure(
            position.every((n) => Math.abs(n) <= 1e7),
            "LIMIT_EXCEEDED",
            "Fill extends beyond coordinate limits",
          );
          const blocked = obstacles.some((other) => {
            charge();
            return [0, 1, 2].every(
              (i) =>
                candidate.min[i] < other!.max[i] - 0.01 &&
                candidate.max[i] > other!.min[i] + 0.01,
            );
          });
          if (blocked) continue;
          parts.push({ ref: c.ref, colorCode: r.colorCode, transform });
          for (let dz = 0; dz < c.depth; dz++)
            for (let dx = 0; dx < c.width; dx++)
              covered[(z + dz) * r.columns + x + dx] = 1;
          placed = true;
          break;
        }
      if (!placed) {
        unresolvedCells.push(point(x, z));
        if (parts.length >= maxParts) budgetGaps++;
      }
    }
  return {
    revision: p.revision,
    layerId: r.layerId,
    parts,
    unresolvedCells,
    coveredCells: covered.reduce((a, b) => a + b, 0),
    eligibleCells: mask ? mask.filter(Boolean).length : r.columns * r.rows,
    algorithm: setMode ? "row-major-largest-fit" : "single-part-grid",
    diagnostics: [
      "Collision checks use enclosing boxes and may leave extra gaps around rotated parts. Unknown shapes prevent filling. Grid placement does not verify physical connections.",
      ...(setMode
        ? [
            "Stud cells are 20 LDU. Origin is the first cell centre. Stable largest-area, part-ID and angle ordering is deterministic, not globally optimal.",
          ]
        : []),
      ...(unknown ? ["Unverified obstacle geometry blocks this preview."] : []),
      ...(budgetGaps
        ? [
            `${budgetGaps} cells remain unresolved because the additions or total-model budget was reached.`,
          ]
        : []),
    ],
  };
}
