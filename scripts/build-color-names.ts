// Writes src/catalog/color-names.json from the checked colour joins
// (scripts/color-joins.json): the LDConfig name of every LDraw colour and its
// Rebrickable colour id when exactly one joins. The parts list names colours
// and writes Rebrickable CSV with it. `tsx scripts/build-color-names.ts`.
import { readFileSync, writeFileSync } from "node:fs";

type Join = {
  code: string;
  name: string;
  rebrickable?: { id: string; rule: string }[];
};
export function colorNames(joins: { colors: Join[] }) {
  const colors: Record<string, { name: string; rb?: string }> = {};
  for (const c of joins.colors) {
    const rb = c.rebrickable ?? [];
    colors[c.code] = {
      name: c.name.replace(/_/g, " "),
      ...(rb.length === 1 ? { rb: rb[0].id } : {}),
    };
  }
  return {
    note: "LDConfig colour names and the single checked Rebrickable colour id of each LDraw code (scripts/build-color-names.ts from scripts/color-joins.json). Used by the parts list and its Rebrickable CSV.",
    colors,
  };
}
if (process.argv[1]?.endsWith("build-color-names.ts")) {
  const joins = JSON.parse(readFileSync("scripts/color-joins.json", "utf8"));
  writeFileSync(
    "src/catalog/color-names.json",
    JSON.stringify(colorNames(joins), null, 1) + "\n",
  );
}
