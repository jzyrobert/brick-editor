import { expect, it } from "vitest";
import { compose, identity } from "../../src/core/math";
import { occurrences } from "../../src/core/document";
import { axisRotation } from "../../src/mechanisms/kinematic";
import { rackFixture } from "../../src/mechanisms/rack-fixture";
import { reviewedGuideAlignment } from "../../src/play/reviewed-guide-alignment";
import {
  fullLibrarySources,
  registerFullLibraryFromDisk,
} from "../../scripts/full-library-node";
import { memberLocalOf } from "../helpers/play-dynamic-source";
registerFullLibraryFromDisk();
it("keeps reviewed cap allowance carrier-relative and restores contacts for endpoint rotation or offset", async () => {
  const { project } = rackFixture(),
    all = occurrences(project),
    carrier = all.find((o) => o.node.ref === "18940.dat")!,
    rack = all.find((o) => o.node.ref === "18942.dat")!,
    geometry = await memberLocalOf(
      project,
      rack.id,
      fullLibrarySources([rack.node.ref]),
    ),
    original = JSON.stringify(project);
  const pose = {
      ...identity(),
      position: [80, -30, 25] as [number, number, number],
      basis: axisRotation(
        [1 / Math.sqrt(3), 1 / Math.sqrt(3), 1 / Math.sqrt(3)],
        37,
      ),
    },
    movedCarrier = compose(pose, carrier.transform),
    movedRack = compose(pose, rack.transform);
  expect(
    reviewedGuideAlignment(
      movedCarrier,
      movedRack,
      geometry.bounds,
      identity().basis,
    ).allowed,
  ).toBe(true);
  const outside = compose(movedRack, { ...identity(), position: [0, 0, 1] });
  expect(
    reviewedGuideAlignment(
      movedCarrier,
      outside,
      geometry.bounds,
      identity().basis,
    ).allowed,
  ).toBe(false);
  // Small relative angle satisfies the rotation threshold but its long rack
  // endpoint exceeds the cap corridor. A centre-only test misses this.
  const tipped = compose(movedRack, {
      ...identity(),
      basis: axisRotation([0, 1, 0], 0.04),
    }),
    result = reviewedGuideAlignment(
      movedCarrier,
      tipped,
      geometry.bounds,
      identity().basis,
    );
  expect(result.rotationError).toBeLessThan(0.002);
  expect(result.capExcessLdu).toBeGreaterThan(0.05);
  expect(result.allowed).toBe(false);
  for (const x of [-88, 10])
    expect(
      reviewedGuideAlignment(
        movedCarrier,
        compose(movedRack, { ...identity(), position: [x, 0, 0] }),
        geometry.bounds,
        identity().basis,
      ).allowed,
    ).toBe(true);
  expect(JSON.stringify(project)).toBe(original);
});
