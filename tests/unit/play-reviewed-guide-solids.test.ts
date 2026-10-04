import RAPIER from "@dimforge/rapier3d-compat";
import { beforeAll, expect, it } from "vitest";
import { occurrences } from "../../src/core/document";
import { identity, compose } from "../../src/core/math";
import { rackFixture } from "../../src/mechanisms/rack-fixture";
import { axisRotation } from "../../src/mechanisms/kinematic";
import { prepareMechanicalSources } from "../../src/play/mechanical-solids";
import { loadReviewedMechanicalProxies } from "../../src/play/reviewed-mechanical-proxies";
import { MechanicalQueryWorld } from "../../src/play/mechanical-query-world";
import { toPhysics } from "../../src/play/physics-frame";
import {
  registerFullLibraryFromDisk,
  fullLibrarySources,
} from "../../scripts/full-library-node";
import { playSources } from "../helpers/play-dynamic-source";
registerFullLibraryFromDisk();
beforeAll(() => RAPIER.init());
it("prepares the same hollow source-bound housing for fixed and mobile carriers and confines allowance to aligned outer guide planes", async () => {
  const { project, proposal } = rackFixture(),
    rig = proposal.rig!,
    all = occurrences(project),
    before = JSON.stringify(project),
    housing = all.find((o) => o.node.ref === "18940.dat")!,
    rack = all.find((o) => o.node.ref === "18942.dat")!;
  const { sources } = await playSources(
    project,
    [rig.id],
    fullLibrarySources(all.map((o) => o.node.ref)),
  );
  expect(() => prepareMechanicalSources(sources)).toThrow(
    /matching reviewed geometry|cannot move safely/,
  );
  await loadReviewedMechanicalProxies(sources);
  const prepared = prepareMechanicalSources(sources).get(rig.id)!,
    hs = prepared.stationary.filter((s) => s.memberId === housing.id),
    rs = prepared.solids.filter((s) => s.memberId === rack.id);
  expect(hs.map((s) => [s.reviewedPlaneClass, s.childCount])).toEqual([
    [-1, 96],
    [0, 310],
    [1, 96],
    [2, 425],
  ]);
  expect(hs.reduce((n, s) => n + s.childCount, 0)).toBe(927);
  expect(rs.reduce((n, s) => n + s.childCount, 0)).toBe(1245);
  expect(prepared.solids.reduce((n, s) => n + s.childCount, 0) + 927).toBe(
    3657,
  );
  const outer = hs.filter((s) => s.reviewedPlaneClass !== 0),
    core = hs.find((s) => s.reviewedPlaneClass === 0)!,
    policy = prepared.policy;
  expect(outer.every((s) => policy.allowed(rs[0], s))).toBe(true);
  expect(policy.allowed(rs[0], core)).toBe(false);
  const pinion = all.find((o) => o.node.ref === "3648b.dat")!,
    hub = prepared.solids.find(
      (s) => s.memberId === pinion.id && s.mating.has(rig.joints[0].id),
    )!;
  expect(hub).toBeDefined();
  for (const support of all.filter((o) => o.node.ref === "3701.dat"))
    expect(
      policy.allowed(hub, { groupId: rig.groups[0].id, memberId: support.id }),
    ).toBe(true);
  expect(policy.allowed(hub, hs[0])).toBe(false);

  expect(
    policy.allowed(rs[0], { ...outer[0], memberId: "foreign-housing" }),
  ).toBe(false);
  const frames = Object.fromEntries(rig.groups.map((g) => [g.id, g.frame])),
    rg = rig.groups.find((g) => g.occurrenceIds.includes(rack.id))!.id;
  for (const altered of [
    { ...identity(), position: [0, 0, 1] as [number, number, number] },
    { ...identity(), basis: axisRotation([0, 1, 0], 0.04) },
  ]) {
    policy.updateGuideFrames(frames, {
      ...frames,
      [rg]: compose(frames[rg], altered),
    });
    expect(outer.every((s) => !policy.allowed(rs[0], s))).toBe(true);
  }
  policy.updateGuideFrames(frames);
  const queries = new MechanicalQueryWorld();
  try {
    const fixed = hs.map((s) => queries.collider(s.shape)),
      rackCols = rs.map((s) => queries.collider(s.shape));
    // Housing group frame is its part frame in this fixture.
    expect(fixed.some((c) => c.containsPoint(toPhysics([0, -40, 12])))).toBe(
      true,
    );
    expect(fixed.some((c) => c.containsPoint(toPhysics([0, -40, 17])))).toBe(
      false,
    );
    expect(fixed.some((c) => c.containsPoint(toPhysics([115, -25, 0])))).toBe(
      false,
    );
    expect(fixed.some((c) => c.containsPoint(toPhysics([127, -15, 6])))).toBe(
      true,
    );
    // Rack part frame is its moving group frame in this fixture.
    expect(rackCols.some((c) => c.containsPoint(toPhysics([60, 0, 1])))).toBe(
      true,
    );
    expect(rackCols.some((c) => c.containsPoint(toPhysics([60, 0, 5])))).toBe(
      false,
    );
  } finally {
    queries.dispose();
  }
  expect(JSON.stringify(project)).toBe(before);
  rig.dynamics = { groups: { frame: { anchored: false } } };
  expect(() => prepareMechanicalSources([sources[0], sources[0]])).toThrow(
    /4,096/,
  );
  const mobileBefore = JSON.stringify(project),
    mobile = (
      await playSources(
        project,
        [rig.id],
        fullLibrarySources(all.map((o) => o.node.ref)),
      )
    ).sources;
  await loadReviewedMechanicalProxies(mobile);
  const m = prepareMechanicalSources(mobile).get(rig.id)!;
  expect(m.solids.reduce((n, s) => n + s.childCount, 0)).toBe(3917);
  expect(
    m.solids
      .filter((s) => s.memberId === housing.id)
      .reduce((n, s) => n + s.childCount, 0),
  ).toBe(927);
  expect(JSON.stringify(project)).toBe(mobileBefore);
}, 30000);
