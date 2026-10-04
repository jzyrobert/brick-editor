import { afterAll, beforeAll, describe, expect, it } from "vitest";
import RAPIER from "@dimforge/rapier3d-compat";
import { occurrences } from "../../src/core/document";
import { add, compose, inverse, mv } from "../../src/core/math";
import type { Transform, Vec3 } from "../../src/core/types";
import { rackFixture } from "../../src/mechanisms/rack-fixture";
import { MECHANICAL_PARTS } from "../../src/mechanisms/mechanical-pack";
import { prepareMechanicalSources } from "../../src/play/mechanical-solids";
import { MechanicalQueryWorld } from "../../src/play/mechanical-query-world";
import { loadReviewedMechanicalProxies } from "../../src/play/reviewed-mechanical-proxies";
import { anchoredGroup } from "../../src/mechanisms/dynamics-settings";
import { toPhysics } from "../../src/play/physics-frame";
import {
  fullLibrarySources,
  registerFullLibraryFromDisk,
} from "../../scripts/full-library-node";
import { playSources } from "../helpers/play-dynamic-source";
import {
  HOUSING_CONTROL_SOURCE_SHA256,
  HOUSING_MATERIAL_CONTROLS,
} from "../helpers/housing-material-controls";

// Independently calibrated against the pinned Philo CC BY 4.0 source.
// See docs/reviews/RACK-SOURCE-REVIEW.md; these sample controls do not replace
// complete section/volume coverage or loaded native acceptance.
const controls: Array<[string, Vec3, boolean]> = [
  ["round core", [-10, 0, 1], false],
  ["round core wall", [-10, 7, 1], true],
  ["round mouth", [-10, 7, 9], false],
  ["round mouth wall", [-10, 8.5, 9], true],
  ["key center", [90, 0, 1], false],
  ["key open throat", [97, 0, 1], false],
  ["key adjacent recess", [100, 0, 1], false],
  ["key reentrant material", [93.5, 3.5, 1], true],
  ["key arm wall", [90, 7, 1], true],
  ["side pocket central web", [60, 0, 1], true],
  ["side pocket", [60, 0, 5], false],
  ["side pocket end", [81.5, 5.8, 5], false],
  ["side pocket end wall", [83, 5.8, 5], true],
  ["narrow pocket web", [0, 0, 1], true],
  ["narrow pocket", [0, 0, 5], false],
  ["left vertical pocket web", [-130, -10, 1], true],
  ["left vertical pocket", [-130, -10, 5], false],
  ["root strip", [0, -21, 5], true],
  ["slim web", [0, -14, 1], true],
  ["outside slim web", [0, -14, 5], false],
  ["tooth", [0, -26, 5], true],
  ["tooth gap", [4, -26, 5], false],
  ["last tooth", [136, -26, 5], true],
  ["last tooth gap", [132, -26, 5], false],
  ["left leg round hole", [-130, -20, 1], false],
  ["left leg ring", [-130, -28, 1], true],
  ["right rounded beam", [136, 5, 5], true],
  ["outside rounded beam", [138, 8, 5], false],
];
registerFullLibraryFromDisk();
const queries = new MechanicalQueryWorld();
const parts = new Map<
  string,
  { colliders: RAPIER.Collider[]; partToGroup: Transform }
>();
beforeAll(async () => {
  await RAPIER.init();
  const { project } = rackFixture(),
    rig = project.motionRigs["rack-drive"],
    all = occurrences(project),
    before = JSON.stringify(project);
  const { sources } = await playSources(
    project,
    [rig.id],
    fullLibrarySources(all.map((o) => o.node.ref)),
  );
  await loadReviewedMechanicalProxies(sources);
  const prepared = prepareMechanicalSources(sources).get(rig.id)!;
  for (const ref of ["18942.dat", "18940.dat"]) {
    const occurrence = all.find((o) => o.node.ref === ref)!,
      group = rig.groups.find((g) => g.occurrenceIds.includes(occurrence.id))!,
      colliders = (
        anchoredGroup(rig, group.id) ? prepared.stationary : prepared.solids
      )
        .filter((s) => s.memberId === occurrence.id)
        .map((s) => queries.collider(s.shape));
    expect(colliders.length).toBeGreaterThan(0);
    parts.set(ref, {
      colliders,
      partToGroup: compose(inverse(group.frame), occurrence.transform),
    });
  }
  expect(JSON.stringify(project)).toBe(before);
}, 30000);
afterAll(() => queries.dispose());
const contains = (p: Vec3, ref = "18942.dat") => {
  const { colliders, partToGroup } = parts.get(ref)!;
  const local = add(partToGroup.position, mv(partToGroup.basis, p));
  return colliders.some((c) => c.containsPoint(toPhysics(local)));
};

describe("reviewed rack volume preserves material and usable openings", () => {
  it.each(controls)("preserves %s", (_name, point, material) => {
    expect(contains(point)).toBe(material);
  });
  it("retains every one of the 32 teeth and its following gap", () => {
    for (let c = -112; c <= 136; c += 8) {
      expect(contains([c, -26, 5]), `tooth at ${c}`).toBe(true);
      expect(contains([c + 4, -26, 5]), `gap after ${c}`).toBe(false);
    }
  });
});

describe("reviewed housing preserves guide material and source openings", () => {
  it("pins the independent controls to the reviewed source", () => {
    expect(MECHANICAL_PARTS["18940.dat"].sourceSha256).toBe(
      HOUSING_CONTROL_SOURCE_SHA256,
    );
  });
  it.each(HOUSING_MATERIAL_CONTROLS)(
    "preserves %s at %j",
    (_feature, point, material) => {
      expect(contains(point, "18940.dat")).toBe(material);
    },
  );
});
