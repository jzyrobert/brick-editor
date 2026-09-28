// Derives connectors (studs, side studs, jumper studs, anti-studs) and body
// occupancy for every catalogue part from the pinned LDraw geometry, verifies
// each part with the whole-part rules in src/catalog/connector-extract.ts,
// writes the connector pack (src/catalog/connectors.json) and records its lock
// and each part's snapVerified flag in src/catalog/data.json.
// Run after build-parts.ts and `npm run library:bounds`:
//   npm run library:connectors
// Method and limits: docs/CONNECTORS.md.
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import {
  extractConnectors,
  verifyConnectors,
  OCCUPANCY,
  RECEPTOR,
  STUD_PRIMITIVES,
  STUD_ROOM,
  TUBE_PRIMITIVES,
  type RawConnector,
} from "../src/catalog/connector-extract";
import {
  CONNECTOR_PACK_ID,
  encodeConnectors,
  encodeOccupancy,
} from "../src/catalog/connector-pack";

const data = JSON.parse(readFileSync("src/catalog/data.json", "utf8"));
const lock = data.libraryLock;
const root = `public/libraries/${lock.releaseId}/`;
const digest = (s: string | Buffer) =>
  createHash("sha256").update(s).digest("hex");
if (digest(readFileSync(root + "manifest.json")) !== lock.manifestSha256)
  throw new Error("Library manifest does not match data.json's lock");
const manifest = JSON.parse(readFileSync(root + "manifest.json", "utf8"));
const sources: Record<string, string> = {};
for (const f of manifest.files)
  if (f.path !== "LDConfig.ldr")
    sources[f.path.replace(/^(parts|p)\//, "")] = readFileSync(
      root + f.path,
      "utf8",
    );

const parts: Record<string, unknown> = {};
const byRule: Record<string, number> = {};
let verified = 0;
for (const [id, part] of Object.entries(
  data.catalog as Record<
    string,
    {
      name: string;
      width: number;
      depth: number;
      align: number[];
      category: string;
      bounds: { min: number[]; max: number[] };
      snapVerified: boolean;
    }
  >,
)) {
  const e = extractConnectors(sources, id, part.bounds, part.align);
  const v = verifyConnectors(part, e);
  part.snapVerified = v.verified;
  if (v.verified) {
    verified++;
    byRule[v.rule!] = (byRule[v.rule!] ?? 0) + 1;
  }
  // A hinged leaf's verified connection is its hinge; handle studs on it are
  // not validated and stay out of its connector list.
  const connectors = (e.connectors as RawConnector[]).filter(
    (c) => v.rule !== "hinge-leaf" || c.kind === "pin",
  );
  parts[id] = {
    verified: v.verified,
    ...(v.rule ? { rule: v.rule } : {}),
    ...encodeConnectors(connectors),
    tubes: e.tubes,
    ...(e.pins
      ? {
          hinge: {
            axis: e.pins.axis,
            pivot: e.pins.top.map((n, i) =>
              i === 1 ? (n + e.pins!.bottom[1]) / 2 : n,
            ),
            pins: [e.pins.top, e.pins.bottom],
            protrusion: e.pins.protrusion,
            radius: e.pins.radius,
          },
        }
      : {}),
    ...(e.sockets.length ? { sockets: e.sockets } : {}),
    occupancy: encodeOccupancy(e.occupancy),
    ...(v.reasons.length ? { reasons: v.reasons } : {}),
  };
}

const pack = {
  id: CONNECTOR_PACK_ID,
  schemaVersion: 2,
  library: {
    releaseId: lock.releaseId,
    manifestSha256: lock.manifestSha256,
  },
  licence:
    "Derived by an automated pipeline from the official LDraw parts library geometry (CC BY 4.0, see public/notices/LDRAW.txt); the derived positions and occupancy boxes are distributed under the same licence with that attribution. No LDCad shadow-library data is used.",
  method: {
    studs:
      "Official stud primitives (" +
      [...STUD_PRIMITIVES].join(", ") +
      `) found through the subfile tree, with BFC winding; position = the stud's top less 4 LDU along its axis (the primitive origin unless stretched), axis = transformed local −Y. Each stud is seated when at least half of 8 rays around it (radius 9) meet the body within 1 LDU, and exposed when a ${2 * STUD_ROOM.half} × ${2 * STUD_ROOM.half} LDU cell ${STUD_ROOM.height} LDU high above it holds none of the body.`,
    antistuds: `Each stud-lattice cell of the body's lowest plane is tested against the flattened triangles: a stud cylinder (radius ${RECEPTOR.radius}, depth ${RECEPTOR.depth} LDU) must be free of geometry, the part must close over it and walls/tubes must surround it. Tube primitives (${[...TUBE_PRIMITIVES].join(", ")}) are counted as corroborating evidence only.`,
    occupancy: `Body triangles (stud primitives excluded) clipped to cells of ${OCCUPANCY.cell} LDU (the part's stud lattice) by ${OCCUPANCY.slab} LDU; each cell keeps the tight box of what lies in it (faces on a cell boundary count for the side their BFC winding puts the material on), thin faces widened to ${OCCUPANCY.minThickness} LDU within their cell, rounded outward to ${OCCUPANCY.step} LDU and merged. Stored flat as [minX, minY, minZ, maxX, maxY, maxZ, …] in the part's LDraw space.`,
    verification:
      "full-underside: every footprint cell is a receptor, the lattice matches the catalogue footprint and the name's stud dimensions, and every stud stands over a receptor. matched-outline: receptors sit exactly under the studs and no cell is obstructed (round and shaped parts). solid-base: no cavity, full stud grid (baseplates). jumper: one seated, exposed stud centred half a stud off the lattice over a full underside. side-studs: full-underside for the top studs, and every side stud points straight out of a face, sits on a stud cell 10 LDU below the top studs, stands on the body at most 4 LDU inside the face, is seated and exposed, and their number matches the name. partial-underside (slopes and arches): footprint matches the name, no cell obstructed, at least one receptor, every stud seated and exposed on a whole number of plates above the base. All rules also require a 4 LDU base grid and no unrecognised stud-sized cylinders; brackets and hinges are excluded.",
  },
  families: {
    supported: [
      "stud",
      "antistud",
      "side stud (side-stud and headlight bricks)",
      "jumper stud",
      "body occupancy",
    ],
    recordedNotValidated: [
      "side studs of brackets, doors and clips (recorded, part unverified)",
    ],
    unsupported: [
      "clips and bars",
      "hinges",
      "Technic pins and axles",
      "side anti-studs",
    ],
  },
  coverage: {
    parts: Object.keys(parts).length,
    verified,
    unverified: Object.keys(parts).length - verified,
    byRule,
  },
  parts,
};
writeFileSync(
  "src/catalog/connectors.json",
  JSON.stringify(pack, null, 1) + "\n",
);
data.connectorLock = {
  connectorPackId: pack.id,
  connectorPackSha256: digest(readFileSync("src/catalog/connectors.json")),
};
writeFileSync("src/catalog/data.json", JSON.stringify(data, null, 2) + "\n");
console.log(JSON.stringify(pack.coverage));
