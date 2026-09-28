// Runtime access to the derived connector pack (src/catalog/connectors.json,
// built by scripts/build-connectors.ts; method in docs/CONNECTORS.md).
import pack from "./connectors.json";
import type { Vec3 } from "../core/types";
import data from "./data.json";
import {
  decodeConnectors,
  decodeOccupancy,
  type Connector,
  type Encoded,
  type OccupancyBox,
} from "./connector-pack";
export type { Connector, ConnectorKind, OccupancyBox } from "./connector-pack";

type PackPart = Encoded & {
  verified: boolean;
  rule?: string;
  reasons?: string[];
  occupancy?: number[];
};
const parts = pack.parts as unknown as Record<string, PackPart>;
export const connectorLock = data.connectorLock;
/** The pack applies only to the library release it was derived from. */
export const connectorPackMatchesLibrary =
  pack.library.manifestSha256 === data.libraryLock.manifestSha256;
export const connectorCoverage = {
  packId: pack.id,
  ...pack.coverage,
  families: pack.families,
};

const cache = new Map<string, Connector[]>();
/**
 * Verified connectors (studs, side studs, jumper studs, anti-studs) of an
 * official catalogue part in its own LDraw space, or null when the part has
 * no verified connector data.
 */
export function verifiedConnectors(ref: string): Connector[] | null {
  if (!connectorPackMatchesLibrary) return null;
  const entry = Object.hasOwn(parts, ref) ? parts[ref] : undefined;
  if (!entry?.verified) return null;
  let list = cache.get(ref);
  if (!list) {
    list = decodeConnectors(entry);
    cache.set(ref, list);
  }
  return list;
}
const occupancyCache = new Map<string, OccupancyBox[]>();
/**
 * Body occupancy boxes of a catalogue part (studs excluded) in its own LDraw
 * space, derived from its geometry whether or not its connectors are verified;
 * null for parts outside the pack.
 */
export function partOccupancy(ref: string): OccupancyBox[] | null {
  if (!connectorPackMatchesLibrary) return null;
  const entry = Object.hasOwn(parts, ref) ? parts[ref] : undefined;
  if (!entry?.occupancy?.length) return null;
  let boxes = occupancyCache.get(ref);
  if (!boxes) {
    boxes = decodeOccupancy(entry.occupancy);
    occupancyCache.set(ref, boxes);
  }
  return boxes;
}
/** A door or window pane's hinge, in its own LDraw space (docs/CONNECTORS.md). */
export type HingeLeaf = {
  /** Unit hinge axis (LDraw −Y, up). */
  axis: Vec3;
  /** A point on the axis, halfway between the pins: the pivot for opening. */
  pivot: Vec3;
  /** Where the upper and lower pins leave the leaf. */
  pins: [Vec3, Vec3];
  protrusion: number;
  radius: number;
};
/** A frame's hinge socket pair: openings on one upright axis. */
export type HingeSocketPair = { top: Vec3; bottom: Vec3; depth: number };
/**
 * Hinge data of a catalogue part: `hinge` for a verified hinged leaf (door or
 * window pane), `sockets` for a part with hinge sockets (door frames). Null
 * when it has neither.
 */
export function hingeData(
  ref: string,
): { hinge?: HingeLeaf; sockets?: HingeSocketPair[] } | null {
  if (!connectorPackMatchesLibrary) return null;
  const entry = (Object.hasOwn(parts, ref) ? parts[ref] : undefined) as
    | (PackPart & { hinge?: HingeLeaf; sockets?: HingeSocketPair[] })
    | undefined;
  if (!entry) return null;
  const hinge = entry.verified ? entry.hinge : undefined;
  if (!hinge && !entry.sockets) return null;
  return {
    ...(hinge ? { hinge } : {}),
    ...(entry.sockets ? { sockets: entry.sockets } : {}),
  };
}
/** Why a catalogue part has no verified connectors (for reports). */
export function connectorStatus(ref: string): {
  verified: boolean;
  rule?: string;
  reasons: string[];
} {
  const entry = Object.hasOwn(parts, ref) ? parts[ref] : undefined;
  if (!entry) return { verified: false, reasons: ["Not a catalogue part"] };
  if (!connectorPackMatchesLibrary)
    return {
      verified: false,
      reasons: ["Connector pack was derived from another library release"],
    };
  return {
    verified: entry.verified,
    ...(entry.rule ? { rule: entry.rule } : {}),
    reasons: entry.reasons ?? [],
  };
}
