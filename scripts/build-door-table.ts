// Maintainer-only: derives the hinge table for official LDraw hinged leaves
// (doors, window panes and shutters, gates, trapdoors) from the committed
// complete LDraw pack and its derived connector pack.
// Usage: npx tsx scripts/build-door-table.ts && npx prettier --write src/play/door-parts.json
// The runtime reads only src/play/door-parts.json; no LDraw geometry is
// copied into it, only derived axes and extents.
import { readFileSync, writeFileSync } from "node:fs";
import {
  deriveDoorHinge,
  doorCandidate,
  doorGeometry,
  type DoorExclusion,
  type DoorHinge,
} from "../src/play/door-derive";
import {
  fullLibraryDir,
  fullLibrarySources,
  registerFullLibraryFromDisk,
} from "./full-library-node";
import { registeredFullLibrary } from "../src/catalog/full-library";
import { fullConnectorEntry } from "../src/catalog/full-connectors";
import type { FullPackCatalogEntry } from "../src/catalog/full-pack";
import type { Vec3 } from "../src/core/types";

if (!registerFullLibraryFromDisk())
  throw new Error("The complete LDraw pack is not built (public/libraries)");
const { manifest } = registeredFullLibrary()!;
const catalog = JSON.parse(
  readFileSync(fullLibraryDir() + manifest.catalog.path, "utf8"),
) as FullPackCatalogEntry[];

const hinges: Record<string, DoorHinge> = {},
  excluded: Record<string, Omit<DoorExclusion, "part">> = {},
  moved: Record<string, string> = {};
const candidates = catalog.filter(([name, title, category]) => {
  const alias = /^~Moved to\s+(\S+)/i.exec(title);
  if (alias)
    moved[name.replace(/\.dat$/, "")] = alias[1]
      .toLowerCase()
      .replace(/\.dat$/, "");
  return doorCandidate(title, category);
});
const sources = fullLibrarySources(candidates.map(([name]) => name));
const read = (name: string) =>
  sources[name.toLowerCase().replaceAll("\\", "/")];
for (const [name, title] of candidates.sort(([a], [b]) => (a < b ? -1 : 1))) {
  const part = name.replace(/\.dat$/, "");
  const pack = fullConnectorEntry(name);
  const connector =
    pack?.verified && pack.hinge
      ? {
          axis: pack.hinge.axis as Vec3,
          pivot: pack.hinge.pivot as Vec3,
          pins: pack.hinge.pins as [Vec3, Vec3],
        }
      : undefined;
  const result = deriveDoorHinge(
    part,
    title,
    doorGeometry(read, name),
    connector,
  );
  if ("reason" in result)
    excluded[part] = { title: result.title, reason: result.reason };
  else hinges[part] = result;
}
const out = {
  schemaVersion: 1,
  description:
    "Hinge axes of official LDraw hinged leaves (doors, window panes and shutters, gates, trapdoors), derived from part geometry and the derived connector pack by src/play/door-derive.ts. Coordinates are part-local LDU, negative Y up. LDraw has no stop data: Play chooses the free swing direction from the surrounding build.",
  source: {
    library: "LDraw.org official library",
    releaseId: manifest.releaseId,
    completeZipSha256: manifest.source.sha256,
    licence: "Derived facts (axes and extents); no geometry is copied.",
  },
  hinges,
  excluded,
  /** Official "~Moved to" names that resolve to a hinged leaf. */
  aliases: Object.fromEntries(
    Object.entries(moved)
      .filter(([, target]) => hinges[target])
      .sort(([a], [b]) => (a < b ? -1 : 1)),
  ),
};
writeFileSync("src/play/door-parts.json", JSON.stringify(out, null, 2) + "\n");
console.log(
  `${Object.keys(hinges).length} hinged leaves, ${Object.keys(excluded).length} excluded, ${Object.keys(out.aliases).length} aliases`,
);
