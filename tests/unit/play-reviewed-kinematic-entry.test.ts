import { expect, it } from "vitest";
import { occurrences } from "../../src/core/document";
import { rackFixture } from "../../src/mechanisms/rack-fixture";
import {
  fullLibrarySources,
  registerFullLibraryFromDisk,
} from "../../scripts/full-library-node";
import { PlaySession } from "../../src/play/session";
import { playSources } from "../helpers/play-dynamic-source";

registerFullLibraryFromDisk();
it("enters and disposes a reviewed kinematic rack with ordinary fixed bearings without native composite children", async () => {
  const { project } = rackFixture(),
    before = JSON.stringify(project),
    { geometry, sources } = await playSources(
      project,
      ["rack-drive"],
      fullLibrarySources(occurrences(project).map((o) => o.node.ref)),
    );
  const session = await PlaySession.create(
    geometry,
    { rigIds: ["rack-drive"], position: [200, -0.3, 200] },
    sources,
  );
  try {
    expect(
      session.snapshot().mechanisms!["rack-drive"].pose.jointPositions,
    ).toEqual({ "joint-0": 0, "joint-1": 0 });
    expect(JSON.stringify(project)).toBe(before);
  } finally {
    session.dispose();
  }
  expect(JSON.stringify(project)).toBe(before);
}, 15000);
