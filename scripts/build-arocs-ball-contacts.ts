/** Reproduce bounded source ball/socket simulation covers from pinned LDraw.
 * Library bytes and authored placements are never edited; no network access. */
import { readFileSync, writeFileSync } from "node:fs";
import { format } from "prettier";
import { Vector3 } from "three";
import { ConvexHull } from "three/examples/jsm/math/ConvexHull.js";
import { importLDraw } from "../src/ldraw/io";
import { occurrences } from "../src/core/document";
import { directReferences } from "../src/catalog/full-pack";
import {
  fullLibrarySources,
  registerFullLibraryFromDisk,
} from "./full-library-node";
import { memberLocalOf } from "../tests/helpers/play-dynamic-source";
import { reviewedGeometryDigest } from "../src/play/reviewed-geometry-binding";
import { surfaceCompoundLocal } from "../src/play/surface-compound";
import manifest from "../src/play/arocs-articulation-sources.json";
import type { Vec3 } from "../src/core/types";
if (!registerFullLibraryFromDisk()) throw Error("Pinned library unavailable");
const refs = ["6628.dat", "32005.dat"] as const,
  sources = fullLibrarySources([...refs]),
  project = importLDraw(
    readFileSync(
      "fixtures/play/official-cars/42043-ball-link-interfaces.ldr",
      "utf8",
    ),
  );
const packets = [];
for (const ref of refs) {
  const o = occurrences(project).find((o) => o.node.ref === ref)!;
  const mesh = await memberLocalOf(project, o.id, sources),
    skins = surfaceCompoundLocal(mesh, ref),
    points: Vec3[] = [];
  for (let i = 0; i < mesh.vertices.length; i += 3)
    points.push(Array.from(mesh.vertices.slice(i, i + 3)) as Vec3);
  const dependencies = new Set<string>(),
    pending: string[] = [ref];
  while (pending.length) {
    const name = pending.pop()!;
    if (dependencies.has(name)) continue;
    dependencies.add(name);
    pending.push(...directReferences(sources[name]));
  }
  const classes: Array<{ id: string; endpoint?: number; pieces: Vec3[][] }> =
    [];
  if (ref === "6628.dat") {
    const center: Vec3 = [-10, 0, 0],
      d = (p: Vec3) => Math.hypot(...p.map((v, k) => v - center[k]));
    const cloud = [
      ...new Map(
        points
          .filter((p) => Math.abs(d(p) - 8) < 0.001)
          .map((p) => [p.join(","), p]),
      ).values(),
    ];
    if (cloud.length !== 66) throw Error("Reviewed source ball facets changed");
    const hull = new ConvexHull().setFromPoints(
      cloud.map((p) => new Vector3(...p)),
    );
    const inside = (p: Vec3) =>
      hull.faces.every(
        (f) => f.normal.dot(new Vector3(...p)) - f.constant <= 1e-7,
      );
    classes.push(
      { id: "ball", endpoint: 0, pieces: [cloud] },
      { id: "neck", pieces: skins.filter((piece) => !piece.every(inside)) },
    );
  } else {
    const centers: Vec3[] = [
        [0, 0, 0],
        [0, 0, 100],
      ],
      remaining = new Set(skins);
    for (let endpoint = 0; endpoint < 2; endpoint++) {
      const c = centers[endpoint],
        core = skins.filter((piece) =>
          piece.every((p) => Math.hypot(...p.map((v, k) => v - c[k])) <= 12),
        );
      core.forEach((p) => remaining.delete(p));
      const circle = (r: number) =>
        [
          ...new Map(
            points
              .filter(
                (p) =>
                  Math.abs(p[1] - (c[1] - 6)) < 1e-7 &&
                  Math.abs(Math.hypot(p[0] - c[0], p[2] - c[2]) - r) < 0.001,
              )
              .map((p) => [[p[0], p[2]].join(","), p]),
          ).values(),
        ].sort(
          (a, b) =>
            Math.atan2(a[2] - c[2], a[0] - c[0]) -
            Math.atan2(b[2] - c[2], b[0] - c[0]),
        );
      const inner = circle(8),
        outer = circle(10);
      if (inner.length !== 16 || outer.length !== 16)
        throw Error("Reviewed socket facets changed");
      const ring: Vec3[][] = [];
      for (let k = 0; k < 16; k++)
        ring.push(
          [-6, 6].flatMap((y) =>
            [inner[k], outer[k], outer[(k + 1) % 16], inner[(k + 1) % 16]].map(
              (p) => [p[0], y + c[1], p[2]] as Vec3,
            ),
          ),
        );
      classes.push({ id: "socket", endpoint, pieces: [...core, ...ring] });
    }
    classes.push({ id: "exterior", pieces: [...remaining] });
  }
  packets.push({
    ref,
    canonicalSurfaceSha256: await reviewedGeometryDigest(mesh),
    closure: manifest[ref],
    dependencies: [...dependencies].sort(),
    sourceAttributions: [...dependencies].sort().map((name) => ({
      ref: name,
      headers: sources[name]
        .split("\n")
        .filter((l) => /^0 (Author:|!LICENSE|Name:)/.test(l))
        .map((l) => l.trimEnd()),
    })),
    sourceHeader: sources[ref]
      .split("\n")
      .filter((l) => /^0 (Author:|!LICENSE|Name:)/.test(l)),
    classes,
    childCount: classes.reduce((n, c) => n + c.pieces.length, 0),
  });
}
const path = "src/play/generated/arocs-ball-contacts.json",
  raw =
    JSON.stringify(
      {
        version: 1,
        derivation:
          "source-faceted-ball-and-inward-surface-skins-v1; source-positive-16-sector-socket-tubes",
        packets,
      },
      null,
      2,
    ) + "\n";
const text = await format(raw, { parser: "json" });
if (process.argv.includes("--check")) {
  if (readFileSync(path, "utf8") !== text)
    throw Error("Arocs contact packet changed");
} else writeFileSync(path, text);
console.log(
  packets.map((p) => ({
    ref: p.ref,
    childCount: p.childCount,
    classes: p.classes.map((c) => [c.id, c.endpoint, c.pieces.length]),
    digest: p.canonicalSurfaceSha256,
  })),
);
