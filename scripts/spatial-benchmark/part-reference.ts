// Opt-in typed reference. The legacy agent-part-facts payload is untouched.
import { createHash } from "node:crypto";
import {
  localBounds,
  footprint,
  underside,
  basis,
  type Turn,
} from "../../src/catalog/builds/kit";
import { placement } from "../../src/build-script/part-list";
import {
  verifiedConnectors,
  connectorLock,
  partOccupancy,
  hingeData,
} from "../../src/catalog/connectors";
import pack from "../../src/catalog/connectors.json";
import { catalog } from "../../src/catalog/catalog";
import { fullLibraryLock } from "../../src/catalog/full-library";
import data from "../../src/catalog/data.json";
import {
  fullConnectorEntry,
  fullConnectorLock,
} from "../../src/catalog/full-connectors";
import { mateKind, type ConnectorKind } from "../../src/catalog/connector-pack";
import type { Vec3 } from "../../src/core/types";

export const FACT_VERSION = "spatial-part-facts/1";
export type FactField = "shape" | "connectors" | "capabilities";
export const hash = (s: string | Uint8Array) =>
  createHash("sha256").update(s).digest("hex");
export const json = (v: unknown) => JSON.stringify(v);
type Provenance = {
  method: "derived" | "curated" | "estimated";
  source: string;
  version: string;
};
type Fact<T> = { value: T | null; provenance: Provenance | null };
const derived = <T>(value: T, source: string, version: string): Fact<T> => ({
  value,
  provenance: { method: "derived", source, version },
});
const unknown = <T>(): Fact<T> => ({ value: null, provenance: null });
export type Box = { min: Vec3; max: Vec3 };
export type ShapeDescription = {
  contour: string;
  slopeHighEdge: "+z" | null;
  curvedSurface: string | null;
  handedness: "none" | null;
  opening: { min: Vec3; max: Vec3; guarantee: "conservative-clearance" } | null;
  recesses: string | null;
};
// Coordinates checked against pinned LDraw faces, not inferred from names.
// Opening describes a conservative clear rectangular subset, not its whole arch.
const descriptions: Record<string, ShapeDescription> = {
  "3039.dat": {
    contour:
      "Two-stud-wide planar slope; descends toward -z. The flat high row at z=30 LDU has two studs; the low row has none.",
    slopeHighEdge: "+z",
    curvedSurface: null,
    handedness: "none",
    opening: null,
    recesses: null,
  },
  "3659.dat": {
    contour:
      "One-stud-deep arch with two end supports; curved underside crosses the central opening.",
    slopeHighEdge: null,
    curvedSurface: "underside of central arch",
    handedness: "none",
    opening: {
      min: [25, -8, 1],
      max: [55, 0, 19],
      guarantee: "conservative-clearance",
    },
    recesses: null,
  },
  "3001.dat": {
    contour:
      "Rectangular brick body with a 4 by 2 array of studs on top and hollow underside.",
    slopeHighEdge: null,
    curvedSurface: null,
    handedness: "none",
    opening: null,
    recesses: "hollow underside; no claim about full interior clearance",
  },
  "3024.dat": {
    contour:
      "Square one-stud plate with one top stud and an underside receptor.",
    slopeHighEdge: null,
    curvedSurface: null,
    handedness: "none",
    opening: null,
    recesses: "underside receptor",
  },
  "3068b.dat": {
    contour:
      "Square two-by-two tile with a smooth top and underside receptors; no top studs.",
    slopeHighEdge: null,
    curvedSurface: null,
    handedness: "none",
    opening: null,
    recesses: "underside receptors",
  },
};
// Starter surface extents are independently pinned by triangle checks in tests.
// The legacy arch envelope extends to 33.412 LDU because it transforms a
// primitive's bounding box; the actual rendered surfaces stop at 24 LDU.
const surfaceBounds: Record<string, Box> = {
  "3039.dat": { min: [-20, -4, -30], max: [20, 24, 10] },
  "3659.dat": { min: [-40, -4, -10], max: [40, 24, 10] },
  "3001.dat": { min: [-40, -4, -20], max: [40, 24, 20] },
  "3024.dat": { min: [-10, -4, -10], max: [10, 8, 10] },
  "3068b.dat": { min: [-20, 0, -20], max: [20, 8, 20] },
};
export const STARTER_PALETTE = Object.keys(descriptions);
export const FIELD_GUIDES: Record<FactField, string> = {
  shape:
    "Shape facts v1: local frame is the minimum footprint anchor at turn 0 with positive Y up. All vectors and boxes use uniform LDU (20 per stud, 8 per plate). Physical bounds include studs; nominal stacking height excludes them. Occupancy is a conservative surface approximation, not solid volume. Null means unknown. Curated contours cover only the starter palette.",
  connectors:
    "Connector facts v1: points use the same minimum-footprint, Y-up local frame in uniform LDU; axes are physical unit vectors. IDs are stable for locked data. Opposing stud/antistud axes at the same point are connection evidence, not structural certification. Pagination is explicit. Missing data is unknown; known empty lists are distinct. No shortcut co-occurrence evidence is included.",
  capabilities:
    "Capabilities v1: independent evidence, language expressibility and validator coverage. The current language places only whole studs/plates and upright quarter-turns. Sideways/inverted poses, clip/bar, axle/pin fits, clutch strength, support and assembly order are unverified or unavailable.",
};

/** LDraw point -> actual minimum-footprint anchor at the selected upright turn. */
export function placementPoint(ref: string, point: Vec3, turn: Turn = 0): Vec3 {
  const f = footprint(ref, turn),
    b = basis(turn);
  return [
    b[0] * point[0] + b[2] * point[2] - f.minX,
    underside(ref) - point[1],
    b[6] * point[0] + b[8] * point[2] - f.minZ,
  ].map((v) => (Object.is(v, -0) ? 0 : v)) as Vec3;
}
export type PartReference = {
  version: typeof FACT_VERSION;
  part: string;
  nominal: Fact<{
    xStuds: number;
    zStuds: number;
    stackingPlates: number;
    ldu: Vec3;
  }>;
  shape?: {
    extentPrecision:
      | "pinned-surface-vertices"
      | "conservative-source-envelope"
      | "unknown";
    physicalBounds: Fact<Box>;
    physicalExtentLdu: Fact<Vec3>;
    projectionLdu: Fact<Box>;
    collisionOccupancy: Fact<{ representation: "surface-boxes"; boxes: Box[] }>;
    description: Fact<ShapeDescription>;
  };
  connectors?: {
    evidence: "known" | "unknown";
    data: "verified" | "derived-unverified" | "unavailable";
    total: number | null;
    offset: number;
    nextOffset: number | null;
    omitted: number | null;
    entries: {
      id: string;
      kind: ConnectorKind;
      atLdu: Vec3;
      axis: Vec3;
      dimensions: {
        radiusLdu: number | null;
        depthLdu: number | null;
        protrusionLdu: number | null;
      } | null;
      verification: "verified";
    }[];
    provenance: Provenance | null;
  };
  capabilities?: {
    interfacePose: Record<string, "yes" | "no" | "unknown">;
    propertyCoverage: Record<string, "yes" | "no" | "partially">;
    connectionEvidence: "known" | "unknown";
    languagePose: "yes" | "no" | "unknown";
    validator: "yes" | "no" | "partially";
    supportedPoses: Turn[];
    unsupportedInterfaces: string[];
    untestedProperties: string[];
  };
};
export function partReference(
  ref: string,
  fields: FactField[],
  offset = 0,
  limit = 16,
): PartReference {
  if (!/^[a-z0-9_-]+(?:\.dat)?$/i.test(ref)) throw new Error("Invalid part ID");
  ref = ref.endsWith(".dat") ? ref : ref + ".dat";
  if (
    !Number.isInteger(offset) ||
    offset < 0 ||
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > 64
  )
    throw new Error("Invalid connector page");
  if (
    new Set(fields).size !== fields.length ||
    fields.some((f) => !Object.hasOwn(FIELD_GUIDES, f))
  )
    throw new Error("Unknown or duplicate fact field");
  const geometryVersion = Object.hasOwn(catalog, ref)
    ? data.libraryLock.manifestSha256
    : fullLibraryLock.manifestSha256;
  let nominal: PartReference["nominal"] = unknown();
  let box: Box | null = null;
  try {
    const p = placement(ref),
      b = surfaceBounds[ref] ?? localBounds(ref);
    nominal = derived(
      {
        xStuds: p.x,
        zStuds: p.z,
        stackingPlates: p.plates,
        ldu: [20 * p.x, 8 * p.plates, 20 * p.z],
      },
      "placement/kit",
      geometryVersion,
    );
    box = {
      min: placementPoint(ref, [b.min[0], b.max[1], b.min[2]]),
      max: placementPoint(ref, [b.max[0], b.min[1], b.max[2]]),
    };
  } catch {
    /* unknown remains explicit */
  }
  const out: PartReference = { version: FACT_VERSION, part: ref, nominal };
  const sourceVersion = Object.hasOwn(pack.parts, ref)
    ? connectorLock.connectorPackSha256
    : fullConnectorLock.manifestSha256;
  const verified = verifiedConnectors(ref);
  if (fields.includes("shape")) {
    const occ = partOccupancy(ref);
    const boundsSource = surfaceBounds[ref]
      ? "pinned LDraw surface vertices; independently checked starter palette"
      : "conservative LDraw source envelope";
    const physical = <T>(v: T): Fact<T> => ({
      value: v,
      provenance: {
        method: surfaceBounds[ref] ? "derived" : "estimated",
        source: boundsSource,
        version: geometryVersion,
      },
    });
    out.shape = {
      extentPrecision: box
        ? surfaceBounds[ref]
          ? "pinned-surface-vertices"
          : "conservative-source-envelope"
        : "unknown",
      physicalBounds: box ? physical(box) : unknown(),
      physicalExtentLdu: box
        ? physical(box.max.map((v, i) => v - box!.min[i]) as Vec3)
        : unknown(),
      projectionLdu:
        box && nominal.value
          ? physical({
              min: box.min.map((v) => Math.min(0, v)) as Vec3,
              max: box.max.map((v, i) =>
                Math.max(0, v - nominal.value!.ldu[i]),
              ) as Vec3,
            })
          : unknown(),
      collisionOccupancy: occ
        ? derived(
            {
              representation: "surface-boxes",
              boxes: occ.map((b) => ({
                min: placementPoint(ref, [b.min[0], b.max[1], b.min[2]]),
                max: placementPoint(ref, [b.max[0], b.min[1], b.max[2]]),
              })),
            },
            "derived connector occupancy",
            sourceVersion,
          )
        : unknown(),
      description: descriptions[ref]
        ? {
            value: descriptions[ref],
            provenance: {
              method: "curated",
              source:
                "starter contours checked against pinned geometry; fixtures/spatial-benchmark/evaluator",
              version: FACT_VERSION,
            },
          }
        : unknown(),
    };
  }
  if (fields.includes("connectors")) {
    const hinge = hingeData(ref);
    const dimensions = (
      c: NonNullable<ReturnType<typeof verifiedConnectors>>[number],
    ) => {
      if (c.kind === "pin" && hinge?.hinge)
        return {
          radiusLdu: hinge.hinge.radius,
          depthLdu: null,
          protrusionLdu: hinge.hinge.protrusion,
        };
      if (c.kind === "socket") {
        const socket = hinge?.sockets?.find((s) =>
          [s.top, s.bottom].some((p) =>
            p.every((v, i) => Math.abs(v - c.p[i]) < 1e-6),
          ),
        );
        if (socket)
          return {
            radiusLdu: null,
            depthLdu: socket.depth,
            protrusionLdu: null,
          };
      }
      return null;
    };
    const entries = (verified ?? [])
      .map((c) => ({
        id: `${ref}:${sourceVersion}:${hash(json([c.kind, c.p, c.axis])).slice(0, 24)}`,
        kind: c.kind,
        atLdu: placementPoint(ref, c.p),
        axis: [c.axis[0], -c.axis[1], c.axis[2]] as Vec3,
        dimensions: dimensions(c),
        verification: "verified" as const,
      }))
      .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    out.connectors = {
      evidence: verified === null ? "unknown" : "known",
      data:
        verified !== null
          ? "verified"
          : Object.hasOwn(pack.parts, ref) || fullConnectorEntry(ref)
            ? "derived-unverified"
            : "unavailable",
      total: verified === null ? null : entries.length,
      offset,
      nextOffset: offset + limit < entries.length ? offset + limit : null,
      omitted:
        verified === null ? null : Math.max(0, entries.length - offset - limit),
      entries: entries.slice(offset, offset + limit),
      provenance:
        verified === null
          ? null
          : {
              method: "derived",
              source: "verified connector pack",
              version: sourceVersion,
            },
    };
  }
  if (fields.includes("capabilities"))
    out.capabilities = {
      interfacePose: {
        uprightStudStack: "yes",
        sideStudAttachment: "no",
        hingeSeat: "unknown",
        clipBar: "unknown",
        axlePin: "unknown",
      },
      propertyCoverage: {
        studMating: verified === null ? "partially" : "yes",
        collision: "partially",
        stability: "no",
        assemblyOrder: "no",
      },
      connectionEvidence: verified === null ? "unknown" : "known",
      languagePose: box ? "yes" : "unknown",
      validator: "partially",
      supportedPoses: [0, 90, 180, 270],
      unsupportedInterfaces: [
        "clip/bar",
        "Technic axle/pin",
        "side antistud",
        "arbitrary hinge articulation",
      ],
      untestedProperties: [
        "clutch strength",
        "structural support",
        "assembly order",
        "solid containment",
      ],
    };
  return out;
}

/** Independent registered stud/antistud test; pin/socket dimensional checks remain unknown. */
export function connectorRelation(
  a: NonNullable<PartReference["connectors"]>,
  b: NonNullable<PartReference["connectors"]>,
  aAt: Vec3,
  bAt: Vec3,
) {
  if (a.evidence === "unknown" || b.evidence === "unknown")
    return "unknown" as const;
  if (a.omitted || b.omitted || a.offset || b.offset)
    throw new Error("Relation requires complete connector lists");
  for (const x of a.entries)
    for (const y of b.entries) {
      if (!["stud", "antistud"].includes(x.kind) || mateKind(x.kind) !== y.kind)
        continue;
      if (
        x.atLdu.every(
          (v, i) => Math.abs(v + aAt[i] - y.atLdu[i] - bAt[i]) <= 0.5,
        ) &&
        x.axis.every((v, i) => Math.abs(v + y.axis[i]) < 1e-6)
      )
        return "verified" as const;
    }
  return "unknown" as const; // no positive evidence does not establish incompatibility
}
