// Maintainer-only: derives the hinge table for official LDraw door leaves.
// Usage: npx tsx scripts/build-door-table.ts <ldraw-dir> [archive-sha256]
// <ldraw-dir> contains parts/ and p/ (for example the official complete.zip
// extracted). The runtime reads only src/play/door-parts.json; no LDraw
// geometry beyond the pinned library pack is redistributed by this table.
import { readdirSync, readFileSync, existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  deriveDoorHinge,
  doorGeometry,
  type DoorExclusion,
  type DoorHinge,
} from "../src/play/door-derive";

const root = process.argv[2] ?? "public/libraries/catalogue-2026-09-29";
const archive = process.argv[3];
const read = (name: string) => {
  const n = name.toLowerCase().replaceAll("\\", "/");
  for (const dir of ["parts", "p", "parts/s", "p/48"]) {
    const file = join(root, dir, n);
    if (existsSync(file)) return readFileSync(file, "utf8");
  }
  return undefined;
};
const TITLE = /\bdoor\b/i;
const NOT_A_LEAF =
  /frame|glass for|sticker|tile|plate|brick|window|wall|counterweight|sound|rail|outline|doorbell|block|hinge plate|^~moved to/i;
const hinges: Record<string, DoorHinge> = {},
  excluded: Record<string, Omit<DoorExclusion, "part">> = {},
  moved: Record<string, string> = {};
for (const file of readdirSync(join(root, "parts")).sort()) {
  if (!file.toLowerCase().endsWith(".dat")) continue;
  const text = readFileSync(join(root, "parts", file), "utf8");
  const title = text.split(/\r?\n/, 1)[0].replace(/^0\s*/, "").trim();
  const alias = /^~Moved to\s+(\S+)/i.exec(title);
  if (alias)
    moved[file.toLowerCase().replace(/\.dat$/, "")] = alias[1]
      .toLowerCase()
      .replace(/\.dat$/, "");
  if (!TITLE.test(title) || NOT_A_LEAF.test(title)) continue;
  const part = file.toLowerCase().replace(/\.dat$/, "");
  const result = deriveDoorHinge(part, title, doorGeometry(read, file));
  if ("reason" in result)
    excluded[part] = { title: result.title, reason: result.reason };
  else hinges[part] = result;
}
const out = {
  schemaVersion: 1,
  description:
    "Hinge axes of official LDraw door leaves, derived from part geometry by src/play/door-derive.ts. Coordinates are part-local LDU, negative Y up. LDraw has no stop data: Play chooses the free swing direction from the surrounding build.",
  source: {
    library: "LDraw.org official library",
    ...(archive ? { completeZipSha256: archive } : {}),
    licence: "Derived facts (axes and extents); no geometry is copied.",
  },
  hinges,
  excluded,
  /** Official "~Moved to" names that resolve to a hinged door. */
  aliases: Object.fromEntries(
    Object.entries(moved)
      .filter(([, target]) => hinges[target])
      .sort(([a], [b]) => (a < b ? -1 : 1)),
  ),
};
writeFileSync("src/play/door-parts.json", JSON.stringify(out, null, 2) + "\n");
console.log(
  `${Object.keys(hinges).length} hinged doors, ${Object.keys(excluded).length} excluded`,
);
