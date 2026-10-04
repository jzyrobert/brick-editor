import RAPIER from "@dimforge/rapier3d-compat";
import { beforeAll, expect, it } from "vitest";
import { identity, compose } from "../../src/core/math";
import { occurrences } from "../../src/core/document";
import { importLDraw } from "../../src/ldraw/io";
import { axisRotation } from "../../src/mechanisms/kinematic";
import { technicFixture } from "../../src/mechanisms/technic-fixture";
import { DynamicRig } from "../../src/play/dynamics";
import { PlayMechanism } from "../../src/play/mechanism";
import {
  mechanicalSolids,
  MechanicalContactPolicy,
} from "../../src/play/mechanical-solids";
import {
  fullLibrarySources,
  registerFullLibraryFromDisk,
} from "../../scripts/full-library-node";
import { meshOf, playSources } from "../helpers/play-dynamic-source";
registerFullLibraryFromDisk();
beforeAll(async () => {
  await RAPIER.init();
});
it("admits canonical reviewed gears through an oblique frame without rebuilding native vertices in world space", async () => {
  const { project, proposal } = technicFixture(),
    definition = proposal.rig!,
    pose = {
      ...identity(),
      position: [80, -30, 25] as [number, number, number],
      basis: axisRotation(
        [1 / Math.sqrt(3), 1 / Math.sqrt(3), 1 / Math.sqrt(3)],
        37,
      ),
    };
  for (const node of project.models[project.rootModelId].nodes)
    node.transform = compose(pose, node.transform);
  const all = occurrences(project),
    lookup = new Map(all.map((o) => [o.id, o]));
  for (const group of definition.groups) {
    group.frame = compose(pose, group.frame);
    for (const id of group.occurrenceIds)
      group.restTransforms[id] = structuredClone(lookup.get(id)!.transform);
  }
  const official = fullLibrarySources(all.map((o) => o.node.ref)),
    { sources } = await playSources(project, [definition.id], official),
    source = sources[0];
  const locals: Record<string, any> = {};
  for (const o of all) {
    const canonical = importLDraw(
        `1 7 0 0 0 1 0 0 0 1 0 0 0 1 ${o.node.ref}\n`,
      ),
      geometry = await meshOf(
        canonical,
        [occurrences(canonical)[0].id],
        official,
      );
    locals[o.id] = {
      ...geometry,
      vertices: Float64Array.from(geometry.vertices),
      revision: project.revision,
      occurrenceId: o.id,
      namespace: o.namespace,
      frame: structuredClone(o.transform),
    };
  }
  const bound = Object.assign(source, { memberLocals: locals }),
    policy = new MechanicalContactPolicy(definition, bound),
    solids = mechanicalSolids(bound, policy);
  expect(solids.reduce((n, s) => n + s.childCount, 0)).toBeLessThanOrEqual(
    4096,
  );
  for (const solid of solids) {
    const raw = solid.shape.intoRaw();
    expect(raw).toBeTruthy();
    raw!.free();
    if (solid.shape instanceof RAPIER.Compound)
      expect(solid.shape.shapes.some((s) => s instanceof RAPIER.Compound)).toBe(
        false,
      );
  }
  const original = JSON.stringify(project),
    world = new RAPIER.World({ x: 0, y: 0, z: 0 }),
    mirror = new RAPIER.World({ x: 0, y: 0, z: 0 }),
    rig = new DynamicRig(world, mirror, bound, 0, project.revision, {
      solids,
      policy,
      stationary: [],
    });
  try {
    const input = definition.transmissions![0].jointA,
      output = definition.transmissions![0].jointB;
    rig.setJointTarget(input, 90, 180);
    for (let i = 0; i < 240; i++) {
      rig.beforeStep();
      rig.stepPhysics();
      rig.afterStep();
    }
    const report = rig.snapshot();
    expect(report.pose.jointPositions[input]).toBeCloseTo(90, 0);
    expect(report.pose.jointPositions[output]).toBeCloseTo(-30, 0);
    expect(report.jointTargets[input].status).toBe("complete");
    expect(JSON.stringify(project)).toBe(original);
  } finally {
    rig.dispose();
    world.free();
    mirror.free();
  }
  const kinematicWorld = new RAPIER.World({ x: 0, y: 0, z: 0 }),
    mechanism = new PlayMechanism(
      kinematicWorld,
      bound,
      () => ({ position: [200, 200, 200], walk: false }),
      true,
      { solids, policy, stationary: [] },
    );
  try {
    const input = definition.transmissions![0].jointA,
      output = definition.transmissions![0].jointB;
    mechanism.setJointTarget(input, 90, 180);
    for (let i = 0; i < 90; i++) mechanism.step();
    const report = mechanism.snapshot();
    expect(report.pose.jointPositions[input]).toBe(90);
    expect(report.pose.jointPositions[output]).toBe(-30);
    expect(report.jointTargets[input].status).toBe("complete");
    expect(JSON.stringify(project)).toBe(original);
  } finally {
    mechanism.dispose();
    kinematicWorld.free();
  }
}, 30000);
