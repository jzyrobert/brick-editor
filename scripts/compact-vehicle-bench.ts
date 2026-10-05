/**
 * Engineering benchmark: one-body compact vehicle vs one body per source fixed
 * island. See docs/reviews/EFFICIENT-VEHICLE-AND-SYSTEMS-PHYSICS.md.
 *
 *   npx tsx scripts/compact-vehicle-bench.ts [model.ldr|mpd] [--only=a,b] [--trials=n]
 *
 * Defaults to the committed 5540 carrier-graph excerpt. The whole 5540 OMR
 * source stays private (gitignored .local/5540-1.mpd).
 */
import { readFileSync } from "node:fs";
import { cpus, loadavg } from "node:os";
import RAPIER from "@dimforge/rapier3d-compat";
import { registerFullLibraryFromDisk } from "./full-library-node";
import { importLDraw } from "../src/ldraw/io";
import { occurrences } from "../src/core/document";
import {
  benchRepresentation,
  memberGeometry,
  reviewSourceVehicle,
  type Representation,
} from "../tests/helpers/compact-vehicle-bench";
import type { HullMember } from "../src/play/compact-vehicle";

const args = process.argv.slice(2);
const file =
  args.find((a) => !a.startsWith("--")) ??
  "fixtures/play/official-cars/5540-carrier-graph.ldr";
const only = args
  .find((a) => a.startsWith("--only="))
  ?.slice(7)
  .split(",") as Representation[] | undefined;
const trials = Number(
  args.find((a) => a.startsWith("--trials="))?.slice(9) ?? 1,
);
const minFills = (args.find((a) => a.startsWith("--fill="))?.slice(7) ?? "0.5")
  .split(",")
  .map(Number);

registerFullLibraryFromDisk();
await RAPIER.init();
const project = importLDraw(readFileSync(file, "utf8"));
let t = performance.now();
const review = reviewSourceVehicle(project);
const reviewMs = performance.now() - t;
t = performance.now();
const { members, skipped } = await memberGeometry(
  project,
  review.assembly.occurrenceIds,
);
const geometryMs = performance.now() - t;
let triangles = 0,
  vertices = 0;
for (const m of members.values()) {
  triangles += m.indices.length / 3;
  vertices += m.vertices.length / 3;
}
const hullMembers = new Map<string, HullMember>();
t = performance.now();
for (const id of members.keys())
  hullMembers.set(
    id,
    (await import("../src/play/compact-vehicle")).hullMember(
      id,
      0,
      members.get(id)!.vertices,
    ),
  );
const hullMs = performance.now() - t;
console.log(
  JSON.stringify({
    file,
    host: { cpus: cpus().length, model: cpus()[0]?.model, load: loadavg() },
    occurrences: occurrences(project).length,
    attached: review.assembly.occurrenceIds.length,
    compiledMembers: members.size,
    skipped: skipped.length,
    fixedIslands: review.assembly.fixedIslands.length,
    boundaries: review.assembly.boundaries.length,
    tyres: review.stations.length,
    rotatingMembers: review.rotating.size,
    triangles,
    vertices,
    reviewMs,
    geometryMs,
    memberHullMs: hullMs,
  }),
);
const reps: Representation[] = only ?? [
  "chassis-island-hulls",
  "chassis-clustered",
  "chassis-member-hulls",
  "islands-member-hulls",
  "islands-trimesh",
];
for (const representation of reps)
  for (const minFill of representation === "chassis-clustered"
    ? minFills
    : [undefined])
    for (let trial = 0; trial < trials; trial++) {
      const result = benchRepresentation(review, members, representation, {
        hullMembers,
        ...(minFill !== undefined ? { minFill } : {}),
        compound: !args.includes("--separate"),
        groundMesh: args.includes("--mesh-ground"),
        memberMass: args.includes("--member-mass"),
      });
      console.log(JSON.stringify({ trial, minFill, ...result }));
    }
