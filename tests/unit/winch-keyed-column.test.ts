import { readFileSync } from "node:fs";
import { beforeAll, expect, it } from "vitest";
import { importLDraw } from "../../src/ldraw/io";
import { occurrences } from "../../src/core/document";
import {
  fullLibrarySources,
  registerFullLibraryFromDisk,
} from "../../scripts/full-library-node";
import { bindRetainedWinchSources } from "../../src/mechanisms/retained-winch";
import { winchKeyedBoreProfile } from "../../src/mechanisms/winch-convex";
import { certifyWinchKeyedColumn } from "../../src/mechanisms/winch-keyed-column";
import type { Vec3 } from "../../src/core/types";

let hole: readonly Readonly<Vec3>[];
beforeAll(async () => {
  registerFullLibraryFromDisk();
  const project = importLDraw(
      readFileSync("fixtures/ldraw/technic/42042-retained-winch.ldr", "utf8"),
    ),
    sources = fullLibrarySources(occurrences(project).map((o) => o.node.ref));
  hole = winchKeyedBoreProfile(
    await bindRetainedWinchSources(sources, project),
  );
});

it("checks complete keyed-column footprints rather than accepting only source vertices", () => {
  const triangle = [hole[0], hole[8], hole[16]];
  for (const p of triangle)
    expect(certifyWinchKeyedColumn([[p, p, p]], hole).maxEdgeGapFraction).toBe(
      0,
    );
  // Every vertex belongs to the literal source bore, but the triangular
  // interior bridges its real cross-key indentations. It must refuse.
  expect(() => certifyWinchKeyedColumn([triangle], hole)).toThrow(
    "crosses the keyed negative column",
  );
});

it("retains projected side-edge checks even when their triangle area is zero", () => {
  const a: Vec3 = [0, 0, 0],
    b: Vec3 = [20, 20, 0];
  expect(() => certifyWinchKeyedColumn([[a, b, b]], hole)).toThrow(
    "crosses the keyed negative column",
  );
  expect(certifyWinchKeyedColumn([[a, a, a]], hole).maxResidualAreaLdu2).toBe(
    0,
  );
});
