// The curated parts as agents see them: a compact list for prompts
// ({{PARTS}} in prompts/build-agent.md, `brick-cli parts list`) and the
// colour line the parts search tool shows. Needs colour availability loaded.
import { catalog, catalogCategoryOrder } from "../catalog/catalog";
import { footprint, localBounds, underside } from "../catalog/builds/kit";
import { partSpec } from "../catalog/extended";
import { partAvailability } from "../catalog/color-availability";
import { COMMON_COLOURS, colourName } from "./palette";
import { parseSize, searchParts } from "./part-search";

/** A part's body height in plates, not counting studs on top: what the
 * compiler reserves above a placed part's \`at.y\`. */
export function partPlates(ref: string) {
  const spec = partSpec(ref);
  if (!spec) return 1;
  const b = localBounds(ref);
  const top = spec.studded ? b.min[1] + 4 : b.min[1];
  return Math.max(1, Math.round((underside(ref) - top) / 8));
}

/** Footprint at turn 0 (studs along x and z) and height in plates. */
export function placement(ref: string) {
  const f = footprint(ref, 0);
  const studs = (ldu: number) => Math.round((ldu / 20) * 2) / 2;
  return { x: studs(f.width), z: studs(f.depth), plates: partPlates(ref) };
}

/** "1×4 studs (x×z), 3 plates", as the part list and search show it. */
export function placementText(ref: string) {
  const p = placement(ref);
  return `${p.x}×${p.z} studs (x×z), ${p.plates} plate${p.plates === 1 ? "" : "s"}`;
}

/** Which common colours a part is made in, in as few words as possible. */
export function commonColours(ref: string) {
  const a = partAvailability(ref);
  if (a.status !== "known") return "colours not recorded";
  const made = COMMON_COLOURS.filter((c) => a.colors.has(c));
  const others = a.colors.size - made.length;
  const more = others > 0 ? ` (+${others} other colours)` : "";
  if (made.length === COMMON_COLOURS.length) return "all common colours" + more;
  if (made.length >= COMMON_COLOURS.length / 2)
    return (
      "common colours except " +
      COMMON_COLOURS.filter((c) => !a.colors.has(c))
        .map(colourName)
        .join(", ") +
      more
    );
  if (!made.length) return "none of the common colours" + more;
  return made.map(colourName).join(", ") + more;
}

/** Every curated part, by category: number, name and common colours. */
export function promptPartList() {
  const byCategory = new Map(
    catalogCategoryOrder.map((c) => [c, [] as (typeof catalog)[string][]]),
  );
  for (const p of Object.values(catalog)) {
    const list = byCategory.get(p.category) ?? [];
    list.push(p);
    byCategory.set(p.category, list);
  }
  const lines = [
    "Each part: number, name, footprint at turn 0 (studs along x × along z) and height in plates, then which common colours it is made in.",
    `Common colours: ${COMMON_COLOURS.map(colourName).join(", ")}.`,
  ];
  for (const [category, list] of byCategory) {
    if (!list.length) continue;
    lines.push("", `${category}:`);
    for (const p of list)
      lines.push(
        `- ${p.id.replace(/\.dat$/, "")} ${p.name} — ${placementText(p.id)} — ${commonColours(p.id)}`,
      );
  }
  return lines.join("\n");
}

function safePlacement(ref: string, size: { w: number; d: number; h: number }) {
  try {
    return placementText(ref);
  } catch {
    return `${size.w}×${size.d} studs, ${size.h} plates`;
  }
}

/** A parts search as an agent asks for it (snake_case, sizes as text). */
export type SearchArgs = {
  query?: string;
  size?: string;
  category?: string;
  colour?: string;
  available_in_colour?: boolean;
  limit?: number;
};

/** Search results as text for an agent: number, name, size, curated or
 * library, common colours (and existence in the colour asked about). */
export function searchForAgent(args: SearchArgs) {
  try {
    const results = searchParts({
      query: String(args.query ?? ""),
      category: args.category,
      ...(args.size ? { size: parseSize(String(args.size)) } : {}),
      ...(args.colour ? { colour: String(args.colour) } : {}),
      availableInColour: !!args.available_in_colour,
      limit: Math.min(50, Math.max(1, Number(args.limit) || 15)),
    });
    const text = results.length
      ? results
          .map(
            (r) =>
              `${r.id.replace(/\.dat$/, "")} | ${r.name} | ${safePlacement(r.id, r.size)} | ${r.curated ? "curated" : "library"} | ${commonColours(r.id)}${r.inColour ? ` | in ${args.colour}: ${r.inColour}` : ""}`,
          )
          .join("\n")
      : "No parts match.";
    return { text, ids: results.map((r) => r.id.replace(/\.dat$/, "")) };
  } catch (e) {
    return { text: `Search failed: ${(e as Error).message}`, ids: [] };
  }
}
