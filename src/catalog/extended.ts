/**
 * Placement specs for official parts outside the curated catalogue, derived
 * from the complete pack's build-time bounds with the same rules the curated
 * catalogue uses (scripts/build-parts.ts). They carry no thumbnail, marketplace
 * mapping or verified connectors.
 */
import { catalog, type CatalogPart } from "./catalog";
import { fullCatalog, registeredFullLibrary } from "./full-library";
import { displayTitle } from "./search";

const studs = (extent: number) => Math.max(1, Math.round(extent / 20)) * 20;
const phase = (min: number, max: number) => {
  const off = (v: number) => Math.abs(v - Math.round(v / 10) * 10);
  const edge = off(max) < off(min) ? max : min;
  const r = (((-edge % 20) + 20) % 20) / 10;
  return Math.round(r) % 2 ? 10 : 0;
};
const specs = new Map<string, CatalogPart>();
let titles: Map<string, [string, string]> | undefined;

/** The curated entry, else a derived spec for any registered official part
 * with known bounds, else undefined. */
export function partSpec(id: string): CatalogPart | undefined {
  if (Object.hasOwn(catalog, id)) return catalog[id];
  const cached = specs.get(id);
  if (cached) return cached;
  const b = registeredFullLibrary()?.index.parts[id]?.[1];
  if (!b) return undefined;
  const entries = fullCatalog();
  if (entries && !titles)
    titles = new Map(entries.map((e) => [e[0], [displayTitle(e[1]), e[2]]]));
  const [name, category] = titles?.get(id) ?? [id.replace(/\.dat$/, ""), ""];
  const spec: CatalogPart = {
    id,
    name,
    width: studs(b[3] - b[0]),
    depth: studs(b[5] - b[2]),
    height: b[4],
    align: [phase(b[0], b[3]), phase(b[2], b[5])],
    category: category || "Other",
    studded: Math.abs(b[1] + 4) < 0.01,
    fillable: false,
    bounds: { min: b.slice(0, 3), max: b.slice(3) },
    geometryHash: "",
    dependencyHash: "",
    thumbnail: "",
    snapVerified: false,
    inventoryBoundary: true,
    source: "official",
    extended: true,
  };
  // Titles may arrive later; only cache once named.
  if (titles) specs.set(id, spec);
  return spec;
}
