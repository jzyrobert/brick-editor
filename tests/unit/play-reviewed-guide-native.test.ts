import RAPIER from "@dimforge/rapier3d-compat";
import { beforeAll, expect, it } from "vitest";
import { occurrences } from "../../src/core/document";
import { identity } from "../../src/core/math";
import type { Transform } from "../../src/core/types";
import { axisRotation } from "../../src/mechanisms/kinematic";
import { rackFixture } from "../../src/mechanisms/rack-fixture";
import { DynamicRig } from "../../src/play/dynamics";
import { prepareMechanicalSources } from "../../src/play/mechanical-solids";
import {
  loadReviewedMechanicalProxies,
  reviewedMechanicalMember,
} from "../../src/play/reviewed-mechanical-proxies";
import { reviewedHousingGuideClass } from "../../src/play/reviewed-guide-alignment";
import {
  registerFullLibraryFromDisk,
  fullLibrarySources,
} from "../../scripts/full-library-node";
import { playSources } from "../helpers/play-dynamic-source";
registerFullLibraryFromDisk();
beforeAll(() => RAPIER.init());
it.each([
  ["straight", identity()],
  [
    "oblique",
    {
      position: [80, -60, 120],
      basis: axisRotation(
        [1 / Math.sqrt(3), 1 / Math.sqrt(3), 1 / Math.sqrt(3)],
        37,
      ),
    },
  ],
] satisfies Array<[string, Transform]>)(
  "retains default-effort mobile forward/reverse and carrier reaction with the %s reviewed guide",
  async (_name, pose) => {
    const { project, proposal } = rackFixture(pose),
      definition = proposal.rig!;
    definition.dynamics = { groups: { frame: { anchored: false } } };
    const source = JSON.stringify(project),
      all = occurrences(project),
      housing = all.find((o) => o.node.ref === "18940.dat")!;
    const { sources } = await playSources(
      project,
      [definition.id],
      fullLibrarySources(all.map((o) => o.node.ref)),
    );
    await loadReviewedMechanicalProxies(sources);
    const packet = reviewedMechanicalMember(sources[0], housing.id)!,
      packetBefore = JSON.stringify(packet),
      floor = packet.regions.filter((r) => reviewedHousingGuideClass(r) === 2);
    expect(floor.length).toBe(414);
    expect(
      floor.reduce(
        (n, r) => n + (r.rank === 2 ? r.triangles.length / 3 : 1),
        0,
      ),
    ).toBe(425);
    expect(
      floor.every(
        (r) =>
          r.planeClass === 0 &&
          r.vertices.every(
            (v, k) =>
              k % 3 !== 1 || r.position[1] + v <= Math.fround(11 * 0.02),
          ),
      ),
    ).toBe(true);
    const prepared = prepareMechanicalSources(sources).get(definition.id)!,
      hs = prepared.solids.filter((s) => s.memberId === housing.id);
    expect(hs.map((s) => [s.reviewedPlaneClass, s.childCount])).toEqual([
      [-1, 96],
      [0, 310],
      [1, 96],
      [2, 425],
    ]);
    expect(
      prepared.solids.reduce((n, s) => n + s.childCount, 0),
    ).toBeLessThanOrEqual(4096);
    const world = new RAPIER.World({ x: 0, y: 0, z: 0 }),
      mirror = new RAPIER.World({ x: 0, y: 0, z: 0 });
    world.timestep = 1 / 60;
    let rig: DynamicRig | undefined;
    try {
      rig = new DynamicRig(
        world,
        mirror,
        sources[0],
        0,
        project.revision,
        prepared,
      );
      const step = (n: number) => {
        for (let i = 0; i < n; i++) {
          rig!.beforeStep();
          rig!.stepPhysics();
          rig!.afterStep();
        }
        return rig!.snapshot();
      };
      world.forEachCollider((c) => expect(c.friction()).toBeCloseTo(0.7, 5));
      const rest = rig.snapshot().groupFrames.frame;
      rig.setJointTarget("joint-0", 150, 180);
      const forward = step(900);
      expect(forward.pose.jointPositions["joint-0"]).toBeCloseTo(150, 0);
      expect(
        Math.abs(
          forward.pose.jointPositions["joint-1"] +
            (forward.pose.jointPositions["joint-0"] * Math.PI) / 6,
        ),
      ).toBeLessThan(0.5);
      expect(forward.jointTargets["joint-0"].status).toBe("complete");
      expect(
        Math.max(
          ...forward.groupFrames.frame.basis.map((v, k) =>
            Math.abs(v - rest.basis[k]),
          ),
        ),
      ).toBeGreaterThan(1e-6);
      rig.setJointTarget("joint-1", 8, 40);
      const reverse = step(900);
      expect(reverse.pose.jointPositions["joint-1"]).toBeCloseTo(8, 0);
      expect(
        Math.abs(
          reverse.pose.jointPositions["joint-1"] +
            (reverse.pose.jointPositions["joint-0"] * Math.PI) / 6,
        ),
      ).toBeLessThan(0.5);
      expect(reverse.jointTargets["joint-1"].status).toBe("complete");
      expect(JSON.stringify(project)).toBe(source);
      expect(JSON.stringify(packet)).toBe(packetBefore);
    } finally {
      rig?.dispose();
      world.free();
      mirror.free();
    }
  },
  60000,
);
