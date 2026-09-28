import sources from "./bounds.json";
import data from "./data.json";
import type { Project } from "../core/types";
import { curatedHas, fullLibraryHas, fullLibraryLock } from "./full-library";
export const libraryLock = data.libraryLock;
export const mappingLock = data.mappingLock;
/** Derived connector pack bound to the current library (see docs/CONNECTORS.md). */
export const connectorLock = data.connectorLock;
/** What a project records as its library lock: curated geometry, connector
 * pack and the complete official pack (`full`) that resolves every other
 * official part on demand. */
export const projectLibraryLock: Project["library"] = {
  ...libraryLock,
  ...connectorLock,
  full: { ...fullLibraryLock },
};
/** Locks of superseded library releases whose every file is byte-identical in
 * the current pack (checked by `npm run library:validate`). */
export const retiredLibraryLocks: Project["library"][] =
  data.retiredLibraryLocks;
/** Superseded mapping packs whose item identities the current pack keeps. */
export const retiredMappingLocks: (typeof mappingLock)[] =
  data.retiredMappingLocks;
export type CatalogPart = {
  id: string;
  name: string;
  /** Stud footprint along local x and z, in LDU (multiples of 20). */
  width: number;
  depth: number;
  /** Distance from the origin down to the part's lowest point (LDU). */
  height: number;
  category: string;
  /** Further palette categories the part is listed under. */
  tags?: string[];
  keywords?: string;
  /** Marketplace numbers that differ from the LDraw number. */
  aliases?: string[];
  /** A stud row stands 4 LDU above the body top at the origin. */
  studded: boolean;
  /** Plain rectangular brick or plate usable by allowed-part fills. */
  fillable: boolean;
  /** Transparent glazing; thumbnails and suggestions use clear. */
  glass?: boolean;
  /** Local x/z origin phase (0 or 10 LDU) that keeps the body on the stud grid. */
  align: number[];
  /** Conservative source box including studs (LDraw axes, −Y up). */
  bounds: { min: number[]; max: number[] };
  geometryHash: string;
  dependencyHash: string;
  /** Static rendering of the pinned geometry, relative to the app base. */
  thumbnail: string;
  snapVerified: boolean;
  inventoryBoundary: boolean;
  source: string;
  /** Official part from the complete pack, outside the curated catalogue
   * (derived spec, no thumbnail; see extended.ts). */
  extended?: boolean;
};
export const catalog: Record<string, CatalogPart> = data.catalog;
/** Palette order of categories for filter chips and grouped browsing. */
export const catalogCategoryOrder: readonly string[] = data.categories;
export const colors = [
  { code: "4", name: "Red", hex: "#c91a09" },
  { code: "1", name: "Blue", hex: "#0055bf" },
  { code: "14", name: "Yellow", hex: "#f2cd37" },
  { code: "15", name: "White", hex: "#ffffff" },
  { code: "0", name: "Black", hex: "#1b2a34" },
  { code: "71", name: "Light grey", hex: "#a0a5a9" },
  { code: "2", name: "Green", hex: "#237841" },
  { code: "19", name: "Tan", hex: "#e4cd9e" },
  { code: "47", name: "Clear", hex: "#eef3f5" },
];

/** Installed source definitions include primitives; purchasing identities
 * remain in catalog. Beyond the curated pack, any file of the complete official
 * pack counts once its index is registered (full-library.ts). */
export function installedSource(ref: string) {
  return (
    (sources.manifestSha256 === libraryLock.manifestSha256 &&
      curatedHas(ref)) ||
    fullLibraryHas(ref)
  );
}

/**
 * Re-pins a loaded project from a retired library or mapping lock to the current
 * one. Only locks listed as retired qualify: every file of a retired library is
 * byte-identical in the current pack, so no definition the project could resolve
 * changes. The previous locks are kept in `metadata.previousLocks` so the change
 * is visible and reversible. Returns true when the project was changed.
 *
 * A project on the current library also records the current connector pack
 * (spec §5 `connectorPackSha256`). Projects saved before connector packs were
 * recorded, or with an earlier pack, are re-pinned; the pack is derived data
 * that never changes geometry, only snapping and connectivity reports, and the
 * previous value (null when none was recorded) goes to `previousLocks`.
 */
export function adoptCurrentLocks(p: Project): boolean {
  const previous: Record<string, unknown> = {};
  const lib = p.library;
  if (
    lib.manifestSha256 !== libraryLock.manifestSha256 &&
    retiredLibraryLocks.some(
      (l) =>
        l.releaseId === lib.releaseId &&
        l.manifestSha256 === lib.manifestSha256 &&
        l.colorConfigSha256 === lib.colorConfigSha256,
    )
  ) {
    previous.library = { ...lib };
    p.library = { ...projectLibraryLock };
  }
  if (
    p.library.manifestSha256 === libraryLock.manifestSha256 &&
    p.library.connectorPackSha256 !== connectorLock.connectorPackSha256
  ) {
    previous.connector = p.library.connectorPackSha256
      ? {
          connectorPackId: p.library.connectorPackId,
          connectorPackSha256: p.library.connectorPackSha256,
        }
      : null;
    p.library = { ...p.library, ...connectorLock };
  }
  // A project saved before the complete official pack existed: recording it
  // changes no definition that resolved before; it only resolves previously
  // missing official parts. A project pinned to another complete pack keeps it.
  if (
    p.library.manifestSha256 === libraryLock.manifestSha256 &&
    !p.library.full
  ) {
    previous.full = null;
    p.library = { ...p.library, full: { ...fullLibraryLock } };
  }
  const market = p.marketplace;
  if (
    market.mappingPackSha256 !== mappingLock.mappingPackSha256 &&
    retiredMappingLocks.some(
      (l) =>
        l.mappingPackId === market.mappingPackId &&
        l.mappingPackSha256 === market.mappingPackSha256,
    )
  ) {
    previous.marketplace = {
      mappingPackId: market.mappingPackId,
      mappingPackSha256: market.mappingPackSha256,
    };
    p.marketplace = { ...market, ...mappingLock };
  }
  if (!Object.keys(previous).length) return false;
  const history = Array.isArray(p.metadata.previousLocks)
    ? p.metadata.previousLocks
    : [];
  p.metadata = {
    ...p.metadata,
    previousLocks: [...history, previous].slice(-8),
  };
  return true;
}
