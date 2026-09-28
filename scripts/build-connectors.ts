// Derives stud / anti-stud connectors for every catalogue part from the pinned
// LDraw geometry, verifies each part with the whole-part rules in
// src/catalog/connector-extract.ts, writes the connector pack
// (src/catalog/connectors.json) and records its lock and each part's
// snapVerified flag in src/catalog/data.json.
// Run after build-parts.ts and `npm run library:bounds`:
//   npm run library:connectors
// Method and limits: docs/CONNECTORS.md.
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import {
  extractConnectors,
  verifyConnectors,
  RECEPTOR,
  STUD_PRIMITIVES,
  TUBE_PRIMITIVES,
  type RawConnector,
} from "../src/catalog/connector-extract";
import { encodeConnectors } from "../src/catalog/connector-pack";

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
  parts[id] = {
    verified: v.verified,
    ...(v.rule ? { rule: v.rule } : {}),
    ...encodeConnectors(e.connectors as RawConnector[]),
    tubes: e.tubes,
    ...(v.reasons.length ? { reasons: v.reasons } : {}),
  };
}

const pack = {
  id: "ldraw-derived-studs-1",
  schemaVersion: 1,
  library: {
    releaseId: lock.releaseId,
    manifestSha256: lock.manifestSha256,
  },
  licence:
    "Derived by an automated pipeline from the official LDraw parts library geometry (CC BY 4.0, see public/notices/LDRAW.txt); the derived positions are distributed under the same licence with that attribution. No LDCad shadow-library data is used.",
  method: {
    studs:
      "Official stud primitives (" +
      [...STUD_PRIMITIVES].join(", ") +
      ") found through the subfile tree; position = primitive origin (stud base), axis = transformed local −Y.",
    antistuds: `Each stud-lattice cell of the part's lowest plane is tested against the flattened triangles: a stud cylinder (radius ${RECEPTOR.radius}, depth ${RECEPTOR.depth} LDU) must be free of geometry, the part must close over it and walls/tubes must surround it. Tube primitives (${[...TUBE_PRIMITIVES].join(", ")}) are counted as corroborating evidence only.`,
    verification:
      "full-underside: every footprint cell is a receptor, the lattice matches the catalogue footprint and the name's stud dimensions, and every stud stands over a receptor. matched-outline: receptors sit exactly under the studs and no cell is obstructed (round and shaped parts). solid-base: no cavity, full stud grid (baseplates). All rules also require upright studs on one level, a 4 LDU base grid and no unrecognised stud-sized cylinders.",
  },
  families: {
    supported: ["stud", "antistud"],
    recordedNotValidated: ["side studs (studs not pointing up)"],
    unsupported: [
      "clips and bars",
      "hinges",
      "Technic pins and axles",
      "jumper (half-offset) studs",
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
