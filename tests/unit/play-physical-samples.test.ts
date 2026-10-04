import { loadReviewedMechanicalProxies } from "../../src/play/reviewed-mechanical-proxies";
import { beforeAll, expect, it } from "vitest";
import RAPIER from "@dimforge/rapier3d-compat";
import { motionSample } from "../../src/catalog/motion-samples";
import { occurrences } from "../../src/core/document";
import { PlayMechanism } from "../../src/play/mechanism";
import {
  registerFullLibraryFromDisk,
  fullLibrarySources,
} from "../../scripts/full-library-node";
import { playSources } from "../helpers/play-dynamic-source";

beforeAll(async () => {
  registerFullLibraryFromDisk();
  await RAPIER.init();
});
for (const name of ["motor-gears", "rack-drive"] as const)
  it(`${name} moves its real source-connected mechanism and preserves source`, async () => {
    const project = motionSample(name),
      before = JSON.stringify(project),
      rig = Object.values(project.motionRigs)[0],
      refs = occurrences(project).map((o) => o.node.ref),
      { sources } = await playSources(
        project,
        [rig.id],
        fullLibrarySources(refs),
      ),
      world = new RAPIER.World({ x: 0, y: 0, z: 0 });
    await loadReviewedMechanicalProxies(sources);
    const mechanism = new PlayMechanism(world, sources[0], () => ({
      position: [300, -100, 300],
      walk: false,
    }));
    try {
      const target = name === "motor-gears" ? 90 : -60;
      const moved = mechanism.setJointPosition(rig.joints[0].id, target);
      expect(moved.blocked, moved.blockedReason).toBe(false);
      expect(moved.pose.jointPositions[rig.joints[0].id]).toBeCloseTo(target);
      if (name === "motor-gears")
        expect(moved.pose.jointPositions[rig.joints[1].id]).toBeCloseTo(-30);
      expect(JSON.stringify(project)).toBe(before);
    } finally {
      mechanism.dispose();
      world.free();
    }
  }, 30000);
