import installedBounds from "../catalog/bounds.json";
import { catalog, colors } from "../catalog/catalog";
import {
  projectBounds,
  transformBounds,
  unionBounds,
  type Bounds,
} from "../core/spatial";
import type { Basis, Occurrence, Project } from "../core/types";

/** A batch property: one shared value, or "mixed" (never an arbitrary member's value). */
export type Mixed<T> = { mixed: true } | { mixed: false; value: T };
function shared<T>(values: T[], key: (v: T) => string = String): Mixed<T> {
  if (!values.length) return { mixed: true };
  const first = key(values[0]);
  return values.every((v) => key(v) === first)
    ? { mixed: false, value: values[0] }
    : { mixed: true };
}

export type SourceKind = "official" | "project" | "geometry" | "missing";
export const sourceLabels: Record<SourceKind, string> = {
  official: "Official LDraw library",
  project: "Project definition",
  geometry: "Raw source geometry",
  missing: "Missing definition",
};
const round = (n: number) => Math.round(n * 1e4) / 1e4;

/** Human-readable orientation of a placement basis (row-major, LDraw axes). */
export function describeOrientation(b: Basis): string {
  const det =
    b[0] * (b[4] * b[8] - b[5] * b[7]) -
    b[1] * (b[3] * b[8] - b[5] * b[6]) +
    b[2] * (b[3] * b[7] - b[4] * b[6]);
  const col = (i: number) => [b[i], b[3 + i], b[6 + i]];
  const dot = (a: number[], c: number[]) =>
    a[0] * c[0] + a[1] * c[1] + a[2] * c[2];
  const orthonormal =
    [0, 1, 2].every((i) => Math.abs(dot(col(i), col(i)) - 1) < 1e-6) &&
    Math.abs(dot(col(0), col(1))) < 1e-6 &&
    Math.abs(dot(col(0), col(2))) < 1e-6 &&
    Math.abs(dot(col(1), col(2))) < 1e-6;
  if (!orthonormal) return "Scaled or sheared (custom matrix)";
  if (det < 0) return "Mirrored";
  // Rotation purely about the vertical (LDraw −Y up) axis.
  if (
    Math.abs(b[4] - 1) < 1e-6 &&
    Math.abs(b[1]) < 1e-6 &&
    Math.abs(b[3]) < 1e-6 &&
    Math.abs(b[5]) < 1e-6 &&
    Math.abs(b[7]) < 1e-6
  ) {
    const degrees =
      (Math.round((Math.atan2(b[2], b[0]) * 180) / Math.PI) + 360) % 360;
    return degrees === 0
      ? "Upright, not rotated"
      : `Upright, turned ${degrees}°`;
  }
  return "Tilted rotation";
}

export type Dimensions = {
  ldu: [number, number, number];
  /** Width/depth in studs (20 LDU) and height in plates (8 LDU). */
  studs: [number, number];
  plates: number;
};
function dimensions(b: Bounds): Dimensions {
  const size = [0, 1, 2].map((i) => round(b.max[i] - b.min[i])) as [
    number,
    number,
    number,
  ];
  return {
    ldu: size,
    studs: [round(size[0] / 20), round(size[2] / 20)],
    plates: round(size[1] / 8),
  };
}

export type Inspection = ReturnType<typeof inspectSelection>;
export function inspectSelection(project: Project, selected: Occurrence[]) {
  const source = (o: Occurrence): SourceKind =>
    o.node.kind === "geometry"
      ? "geometry"
      : o.namespace === "missing"
        ? "missing"
        : o.namespace;
  const bounds = projectBounds(
    project,
    installedBounds.bounds as unknown as Record<string, Bounds | null>,
    installedBounds.dependencies.transitive,
  );
  const records = new Map<string, Map<string, string>>();
  let box: Bounds | null = null,
    unknownSize = false;
  for (const o of selected) {
    let local: Bounds | null = null;
    try {
      if (o.node.kind === "geometry") {
        let map = records.get(o.modelId);
        if (!map) {
          map = new Map(
            project.models[o.modelId]?.records.map((r) => [r.id, r.raw]) ?? [],
          );
          records.set(o.modelId, map);
        }
        local = bounds.primitive(map.get(o.node.sourceRecordId ?? "") ?? "");
      } else local = bounds.model(o.node.ref);
    } catch {
      local = null;
    }
    if (!local) unknownSize = true;
    else box = unionBounds(box, transformBounds(local, o.transform));
  }
  const issues: string[] = [];
  const ids = new Set(selected.map((o) => o.id));
  const missing = selected.filter((o) => o.namespace === "missing").length;
  if (missing)
    issues.push(
      `${missing === selected.length ? "Part definition" : missing + " part definitions"} missing from the library and project`,
    );
  const locked = selected.filter(
    (o) => project.layers[o.layerId]?.locked,
  ).length;
  if (locked) issues.push(`${locked} on a locked layer`);
  const hidden = selected.filter((o) => !o.visible).length;
  if (hidden) issues.push(`${hidden} hidden`);
  for (const d of project.diagnostics)
    if (
      d.code !== "REFERENCE_MISSING" &&
      d.occurrenceIds?.some((id) => ids.has(id))
    )
      issues.push(d.message);
  if (unknownSize && !missing)
    issues.push("Size unknown for parts outside the pinned library");
  return {
    count: selected.length,
    part: shared(
      selected.map((o) => ({
        ref: o.node.kind === "geometry" ? "Raw primitive" : o.node.ref,
        name:
          o.node.kind === "geometry"
            ? "Raw geometry face"
            : o.namespace === "project"
              ? (project.models[o.node.ref]?.name ?? o.node.ref)
              : (catalog[o.node.ref]?.name ?? o.node.ref),
      })),
      (p) => p.ref + "\n" + p.name,
    ),
    source: shared(selected.map(source)),
    color: shared(
      selected.map((o) => ({
        code: o.colorCode,
        name:
          colors.find((c) => c.code === o.colorCode)?.name ??
          (o.colorCode === "16" ? "Inherited" : "Colour " + o.colorCode),
      })),
      (c) => c.code,
    ),
    layer: shared(
      selected.map((o) => ({
        id: o.layerId,
        name: project.layers[o.layerId]?.name ?? o.layerId,
      })),
      (l) => l.id,
    ),
    parent: shared(
      selected.map((o) => ({
        id: o.modelId,
        name: project.models[o.modelId]?.name ?? o.modelId,
        root: o.modelId === project.rootModelId,
      })),
      (m) => m.id,
    ),
    position: [0, 1, 2].map((i) =>
      shared(selected.map((o) => round(o.transform.position[i]))),
    ) as [Mixed<number>, Mixed<number>, Mixed<number>],
    orientation: shared(
      selected.map((o) => describeOrientation(o.transform.basis)),
    ),
    /** Single part size, or the selection's combined world box. */
    dimensions: box && !unknownSize ? dimensions(box) : null,
    matrix:
      selected.length === 1
        ? {
            position: selected[0].transform.position.map(round),
            basis: selected[0].transform.basis.map(round),
          }
        : null,
    issues,
  };
}
