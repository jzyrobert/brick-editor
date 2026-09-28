// Runtime access to the derived connector pack (src/catalog/connectors.json,
// built by scripts/build-connectors.ts; method in docs/CONNECTORS.md).
import pack from "./connectors.json";
import data from "./data.json";
import {
  decodeConnectors,
  type Connector,
  type Encoded,
} from "./connector-pack";
export type { Connector, ConnectorKind } from "./connector-pack";

type PackPart = Encoded & {
  verified: boolean;
  rule?: string;
  reasons?: string[];
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
 * Verified stud/anti-stud connectors of an official catalogue part in its own
 * LDraw space, or null when the part has no verified connector data.
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
