import { expect, it } from "vitest";
import { mechanismHeldView } from "../../src/play/mechanism-view";
import type { PlayMechanismReport } from "../../src/play/types";
import { identity } from "../../src/core/math";
import type { Vec3 } from "../../src/core/types";

it("includes only the held foreign group, keeps colliding group IDs distinct and drops its bounds on release", () => {
  const corner: Vec3 = [1, 2, 3],
    geometries = {
      crane: { shared: [corner] },
      cargo: {
        shared: [[5, 6, 7] as Vec3],
        unrelated: [[10000, 0, 0] as Vec3],
      },
    };
  const reports = {
    crane: {
      groupFrames: { shared: identity() },
      grippers: {
        claw: {
          groupId: "shared",
          anchorWorldLdu: [0, 0, 0],
          state: "holding",
          candidates: [],
          held: { rigId: "cargo", groupId: "shared", massKg: 1 },
        },
      },
    },
    cargo: {
      groupFrames: {
        shared: { ...identity(), position: [60, -60, 0] },
        unrelated: identity(),
      },
    },
  } as unknown as Record<string, PlayMechanismReport>;
  const holding = mechanismHeldView("crane", geometries, reports);
  expect(Object.keys(holding.geometry)).toEqual([
    JSON.stringify(["crane", "shared"]),
    JSON.stringify(["cargo", "shared"]),
  ]);
  expect(Object.values(holding.groupFrames)[1].position).toEqual([60, -60, 0]);
  expect(Object.values(holding.geometry)).not.toContain(
    geometries.cargo.unrelated,
  );
  delete reports.crane.grippers!.claw.held;
  reports.crane.grippers!.claw.state = "empty";
  const released = mechanismHeldView("crane", geometries, reports);
  expect(Object.values(released.geometry)).toEqual([[corner]]);
  expect(Object.keys(released.groupFrames)).toHaveLength(1);
});
