import { expect, it } from "vitest";
import {
  registerFullLibraryFromDisk,
  fullLibrarySources,
} from "../../scripts/full-library-node";
import { importLDraw } from "../../src/ldraw/io";
import { occurrences } from "../../src/core/document";
import { MECHANICAL_PARTS } from "../../src/mechanisms/mechanical-pack";
import { meshOf } from "../helpers/play-dynamic-source";

registerFullLibraryFromDisk();
it("distinguishes the pinned 3673 pin's 8-LDU retaining collar from its 6-LDU shaft", async () => {
  const project = importLDraw("1 7 0 0 0 1 0 0 0 1 0 0 0 1 3673.dat");
  const mesh = await meshOf(
    project,
    [occurrences(project)[0].id],
    fullLibrarySources(["3673.dat"]),
  );
  let radius = 0;
  for (let i = 0; i < mesh.vertices.length; i += 3)
    radius = Math.max(
      radius,
      Math.hypot(mesh.vertices[i + 1], mesh.vertices[i + 2]),
    );
  const feature = MECHANICAL_PARTS["3673.dat"].features.find(
    (f) => f.kind === "pin",
  )!;
  expect(feature.kind).toBe("pin");
  if (feature.kind !== "pin") throw new Error("Missing reviewed pin");
  expect(feature.radius).toBe(6);
  expect(feature.stopRadius).toBe(8);
  expect(radius).toBeCloseTo(feature.stopRadius, 3);
});
