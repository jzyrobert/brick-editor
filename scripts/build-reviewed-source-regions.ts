/** Offline maintainer reconstruction of frozen, reviewed simulation regions.
 * This does not infer new solid semantics or approve new part revisions. */
import { createHash } from "node:crypto";
import {
  mkdtempSync,
  readFileSync,
  rmSync,
  mkdirSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { LDrawLoader } from "three/examples/jsm/loaders/LDrawLoader.js";
import { LDrawConditionalLineMaterial } from "three/examples/jsm/materials/LDrawConditionalLineMaterial.js";
import type { Group } from "three";
import { fullLibrarySources } from "./full-library-node";
import { normalizeBfcSource } from "../src/render/bfc-source";
import { PlayMemberGeometryCapture } from "../src/render/play-member-geometry";
import { OccurrenceHandle } from "../src/render/occurrence-handles";
import { reviewedGeometryDigest } from "../src/play/reviewed-geometry-binding";
import { importLDraw } from "../src/ldraw/io";
import { occurrences } from "../src/core/document";
import {
  housingCells,
  type HousingConstruction,
} from "./reviewed-play-proxies/housing-cells";
import { convexHousing } from "./reviewed-play-proxies/convex-housing";
import { rackSectionPieces } from "./reviewed-play-proxies/rack-regions";

const specDir = fileURLToPath(
  new URL("./reviewed-play-proxies/", import.meta.url),
);
const hash = (data: string) => createHash("sha256").update(data).digest("hex");
const provenance = JSON.parse(
  readFileSync(specDir + "provenance.json", "utf8"),
);

function construction(ref: string) {
  const { constructionFile, constructionSha256 } = provenance[ref];
  const raw = readFileSync(specDir + constructionFile, "utf8");
  if (hash(raw) !== constructionSha256)
    throw new Error(`${ref}: reviewed construction parameters changed`);
  return JSON.parse(raw);
}

async function verifySource(
  ref: string,
  source: {
    dependencies: Record<string, string>;
    canonicalSurfaceSha256: string;
  },
) {
  const texts = fullLibrarySources([ref]);
  if (Object.keys(texts).length !== Object.keys(source.dependencies).length)
    throw new Error(`${ref}: dependency closure changed`);
  for (const [name, expected] of Object.entries(source.dependencies))
    if (!texts[name] || hash(texts[name]) !== expected)
      throw new Error(`${ref}: pinned source hash mismatch: ${name}`);
  if (ref === "18940.dat") {
    const spec = construction(ref) as HousingConstruction;
    for (const plane of spec.planes)
      for (const path of plane.sourceFaces) {
        for (const [i, [name, line]] of path.entries()) {
          const record = texts[name]?.split(/\r?\n/)[line - 1];
          if (
            !record ||
            !(i < path.length - 1 ? /^1\s/ : /^[34]\s/).test(record)
          )
            throw new Error(`Invalid reviewed face ancestry: ${name}:${line}`);
          if (
            i < path.length - 1 &&
            record
              .trim()
              .split(/\s+/)
              .at(-1)
              ?.replaceAll("\\", "/")
              .toLowerCase() !== path[i + 1][0]
          )
            throw new Error(
              `Invalid reviewed dependency ancestry: ${name}:${line}`,
            );
        }
      }
  }
  const loader = new LDrawLoader().setConditionalLineMaterial(
    LDrawConditionalLineMaterial,
  );
  loader.setFileMap(
    Object.fromEntries(Object.keys(texts).map((name) => [name, name])),
  );
  (
    loader as unknown as {
      partsCache: {
        parseCache: { fetchData: (ref: string) => Promise<string> };
      };
    }
  ).partsCache.parseCache.fetchData = async (name) => {
    const text = texts[name.replaceAll("\\", "/").toLowerCase()];
    if (!text) throw new Error(`Missing pinned source: ${name}`);
    return text;
  };
  const instance = `1 7 0 0 0 1 0 0 0 1 0 0 0 1 ${ref}`;
  const input = normalizeBfcSource(
    [
      "0 FILE __canonical__.ldr",
      "0 !COLOUR TestGrey CODE 7 VALUE #888888 EDGE #333333",
      instance,
      ...Object.entries(texts).map(
        ([name, text]) => `0 FILE ${name}\n${text}\n0 NOFILE`,
      ),
    ].join("\n"),
  );
  const group = await new Promise<Group>((ok, fail) =>
    (
      loader.parse as unknown as (
        s: string,
        o: (g: Group) => void,
        f: (e: unknown) => void,
      ) => void
    )(input, ok, fail),
  );
  const project = importLDraw(instance),
    occurrence = occurrences(project)[0];
  const geometry = new PlayMemberGeometryCapture().capture(
    [occurrence.id],
    new Map([[occurrence.id, occurrence]]),
    new Map([[occurrence.id, new OccurrenceHandle(occurrence.id, group)]]),
    project.revision,
  )[occurrence.id];
  const digest = await reviewedGeometryDigest(geometry);
  if (digest !== source.canonicalSurfaceSha256)
    throw new Error(`${ref}: compiled canonical surface changed: ${digest}`);
  console.log(
    JSON.stringify({
      ref,
      files: Object.keys(texts).length,
      surfaceSha256: digest,
      triangles: geometry.indices.length / 3,
    }),
  );
}

async function main() {
  const outDir = process.argv[2];
  if (!outDir || process.argv.length !== 3)
    throw new Error(
      "Usage: npx tsx scripts/build-reviewed-source-regions.ts <output-directory>",
    );
  // Verify both actual pinned closures and canonical compilations before construction/output.
  for (const ref of ["18940.dat", "18942.dat"])
    await verifySource(ref, provenance[ref].source);
  const temporary = mkdtempSync(resolve(tmpdir(), "brick-reviewed-regions-"));
  try {
    const cells = housingCells(
      construction("18940.dat") as HousingConstruction,
    );
    if (cells.length !== 63081)
      throw new Error(`Housing cell count changed: ${cells.length}`);
    writeFileSync(temporary + "/cells.json", JSON.stringify(cells));
    execFileSync(
      "python3",
      [
        specDir + "coalesce-housing.py",
        temporary + "/cells.json",
        temporary + "/coalesced.json",
      ],
      { stdio: "inherit" },
    );
    const coalesced = JSON.parse(
      readFileSync(temporary + "/coalesced.json", "utf8"),
    );
    if (coalesced.length !== 2473)
      throw new Error("Housing coalesced count changed");
    const regionsByRef = {
      "18940.dat": convexHousing(coalesced),
      "18942.dat": rackSectionPieces(construction("18942.dat")),
    };
    for (const [ref, regions] of Object.entries(regionsByRef)) {
      const expected = provenance[ref],
        regionsSha256 = hash(JSON.stringify(regions));
      if (
        regions.length !== expected.regionCount ||
        regionsSha256 !== expected.regionsSha256
      )
        throw new Error(
          `${ref}: frozen region mismatch: ${regions.length}, ${regionsSha256}`,
        );
    }
    // No output is published until both frozen coordinate streams match exactly.
    for (const [ref, regions] of Object.entries(regionsByRef)) {
      const planeClasses = regions.map((points) =>
        ref === "18940.dat"
          ? Math.min(...points.map((p) => p[2])) >= 10
            ? 1
            : Math.max(...points.map((p) => p[2])) <= -10
              ? -1
              : 0
          : 0,
      );
      const target = resolve(outDir, ref + ".json");
      mkdirSync(dirname(target), { recursive: true });
      const data =
        JSON.stringify({
          source: provenance[ref].source,
          regions,
          planeClasses,
        }) + "\n";
      writeFileSync(target, data);
      console.log(
        JSON.stringify({
          ref,
          regions: regions.length,
          regionsSha256: hash(JSON.stringify(regions)),
          manifestSha256: hash(data),
          output: target,
        }),
      );
    }
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
