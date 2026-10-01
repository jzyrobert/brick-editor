import { colors } from "../catalog/catalog";
import colorNames from "../catalog/color-names.json";
import { partSpec } from "../catalog/extended";
import type { Occurrence, Project } from "../core/types";

/**
 * The parts list of a loaded model (docs/INSTRUCTIONS.md): every physical part
 * × colour with its count, for reading, searching and exporting. It is what
 * the model contains, not a purchasing list: the "Check your parts" dialog
 * (inventory/service.ts) maps parts to BrickLink items and writes the Wanted
 * List XML. One pass over the occurrences, so a 150,000-part model lists in
 * well under a second.
 */
export type PartsListRow = {
  ref: string;
  /** The part number without its file extension ("3001"). */
  number: string;
  name: string;
  category: string;
  colorCode: string;
  colorName: string;
  colorHex?: string;
  count: number;
  /** Defined in the model file itself or missing from the library. */
  custom: boolean;
};
export type PartsList = {
  rows: PartsListRow[];
  /** Physical parts (drawing primitives are not parts). */
  total: number;
  /** Loose drawing primitives, not counted as parts. */
  primitives: number;
};

const names = (
  colorNames as { colors: Record<string, { name: string; rb?: string }> }
).colors;
const palette = new Map(colors.map((c) => [c.code, c]));
/** Display name of an LDraw colour code. */
export function colorName(code: string) {
  if (/^0x2[0-9a-f]{6}$/i.test(code)) return "Direct colour #" + code.slice(3);
  return palette.get(code)?.name ?? names[code]?.name ?? "Colour " + code;
}
export const colorHex = (code: string) =>
  palette.get(code)?.hex ??
  (/^0x2[0-9a-f]{6}$/i.test(code) ? "#" + code.slice(3) : undefined);
/** Rebrickable colour id of an LDraw code, when one checked join exists. */
export const rebrickableColor = (code: string) => names[code]?.rb;

export const partNumber = (ref: string) => ref.replace(/\.dat$/i, "");

export function partsList(
  project: Pick<Project, "models">,
  all: readonly Occurrence[],
): PartsList {
  const lots = new Map<string, PartsListRow>();
  let total = 0,
    primitives = 0;
  const described = new Map<
    string,
    { name: string; category: string; custom: boolean }
  >();
  const describe = (o: Occurrence) => {
    let d = described.get(o.node.ref);
    if (d) return d;
    const model = project.models[o.node.ref];
    const spec = model ? undefined : partSpec(o.node.ref);
    d = spec
      ? { name: spec.name, category: spec.category || "Other", custom: false }
      : {
          name:
            model?.name.replace(/\.(ldr|dat)$/i, "") ?? partNumber(o.node.ref),
          category: model ? "Custom parts" : "Unknown parts",
          custom: true,
        };
    if (o.namespace === "missing") d = { ...d, custom: true };
    described.set(o.node.ref, d);
    return d;
  };
  for (const o of all) {
    if (o.node.kind !== "part") {
      primitives++;
      continue;
    }
    total++;
    const key = o.node.ref + "\u0000" + o.colorCode;
    const row = lots.get(key);
    if (row) {
      row.count++;
      continue;
    }
    const d = describe(o);
    lots.set(key, {
      ref: o.node.ref,
      number: partNumber(o.node.ref),
      name: d.name,
      category: d.category,
      colorCode: o.colorCode,
      colorName: colorName(o.colorCode),
      colorHex: colorHex(o.colorCode),
      count: 1,
      custom: d.custom,
    });
  }
  const rows = [...lots.values()].sort(
    (a, b) =>
      b.count - a.count ||
      a.number.localeCompare(b.number, "en", { numeric: true }) ||
      a.colorName.localeCompare(b.colorName),
  );
  return { rows, total, primitives };
}

export type PartsSort = "count" | "number" | "name" | "colour";
export type PartsGroup = "none" | "category" | "colour";

/** Rows matching every word of `query` (part number, name, colour, category). */
export function filterParts(rows: readonly PartsListRow[], query: string) {
  // "1 x 2" finds "1 × 2".
  const plain = (s: string) => s.toLowerCase().replace(/×/g, "x");
  const words = plain(query).split(/\s+/).filter(Boolean);
  if (!words.length) return rows.slice();
  return rows.filter((r) => {
    const text = plain(`${r.number} ${r.name} ${r.colorName} ${r.category}`);
    return words.every((w) => text.includes(w));
  });
}
export function sortParts(rows: PartsListRow[], sort: PartsSort) {
  const by: Record<PartsSort, (a: PartsListRow, b: PartsListRow) => number> = {
    count: (a, b) => b.count - a.count,
    number: (a, b) => a.number.localeCompare(b.number, "en", { numeric: true }),
    name: (a, b) => a.name.localeCompare(b.name),
    colour: (a, b) => a.colorName.localeCompare(b.colorName),
  };
  const tie = (a: PartsListRow, b: PartsListRow) =>
    a.number.localeCompare(b.number, "en", { numeric: true }) ||
    a.colorName.localeCompare(b.colorName);
  return rows.sort((a, b) => by[sort](a, b) || tie(a, b));
}
/** Sections in display order: category or colour, largest first. */
export function groupParts(rows: readonly PartsListRow[], group: PartsGroup) {
  if (group === "none") return [{ title: "", rows: [...rows], count: 0 }];
  const sections = new Map<string, PartsListRow[]>();
  for (const row of rows) {
    const title = group === "category" ? row.category : row.colorName;
    const list = sections.get(title);
    if (list) list.push(row);
    else sections.set(title, [row]);
  }
  return [...sections]
    .map(([title, list]) => ({
      title,
      rows: list,
      count: list.reduce((n, r) => n + r.count, 0),
    }))
    .sort((a, b) => b.count - a.count || a.title.localeCompare(b.title));
}

const csvCell = (v: string | number) => {
  const s = String(v);
  // Spreadsheet formula injection: a leading =, +, - or @ is quoted text.
  const safe = /^[=+\-@]/.test(s) ? "'" + s : s;
  return /[",\n\r]/.test(safe) || safe !== s
    ? '"' + safe.replace(/"/g, '""') + '"'
    : safe;
};
/** The parts list as CSV (UTF-8, one row per part and colour). */
export function partsListCSV(rows: readonly PartsListRow[]) {
  const lines = [
    ["Part", "Name", "Category", "LDraw colour", "Colour", "Quantity"].join(
      ",",
    ),
  ];
  for (const r of rows)
    lines.push(
      [r.number, r.name, r.category, r.colorCode, r.colorName, r.count]
        .map(csvCell)
        .join(","),
    );
  return lines.join("\r\n") + "\r\n";
}
/**
 * Rebrickable's parts-list CSV import ("Part,Color,Quantity" with Rebrickable
 * colour ids). Part numbers use Rebrickable's number when the colour
 * availability pack records one (`rebrickablePart`), else the LDraw number,
 * which Rebrickable also matches for most parts. Rows whose colour has no
 * checked Rebrickable id, and custom parts, are left out and reported.
 */
export function rebrickableCSV(
  rows: readonly PartsListRow[],
  rebrickablePart: (ref: string) => string | undefined = () => undefined,
) {
  const lines = ["Part,Color,Quantity"];
  const skipped: PartsListRow[] = [];
  for (const r of rows) {
    const color = rebrickableColor(r.colorCode);
    if (r.custom || color === undefined) {
      skipped.push(r);
      continue;
    }
    lines.push(
      [rebrickablePart(r.ref) ?? r.number, color, r.count]
        .map(csvCell)
        .join(","),
    );
  }
  return { csv: lines.join("\r\n") + "\r\n", skipped };
}
