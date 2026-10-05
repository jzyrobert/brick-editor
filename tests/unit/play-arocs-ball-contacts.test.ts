import RAPIER from "@dimforge/rapier3d-compat";
import { Quaternion, Vector3 } from "three";
import { beforeAll, expect, it } from "vitest";
import { registerFullLibraryFromDisk } from "../../scripts/full-library-node";
import { exportLDraw } from "../../src/ldraw/io";
import { occurrences } from "../../src/core/document";

import type { Transform, Vec3 } from "../../src/core/types";
import { partsList } from "../../src/inventory/parts-list";
import { physicalPlayEligibility } from "../../src/mechanisms/physical-play";
import { axisRotation } from "../../src/mechanisms/kinematic";
import {
  loadArocsBallContacts,
  arocsBallMemberSolids,
  arocsBallContactAllowed,
  arocsBallJointIds,
} from "../../src/play/arocs-ball-contacts";
import {
  frameRotation,
  toPhysics,
  fromPhysics,
  basisFromRotation,
} from "../../src/play/physics-frame";
import type { MechanicalSolid } from "../../src/play/mechanical-solids";
import { arocsBallFixture as fixture } from "../helpers/arocs-ball-source";
registerFullLibraryFromDisk();
beforeAll(() => RAPIER.init());
it("binds exact occurrence geometry and retains both source socket ends without phantom mating", async () => {
  const f = await fixture(),
    before = JSON.stringify(f.project),
    sourceText = exportLDraw(f.project),
    inventory = partsList(f.project, occurrences(f.project));
  expect(() => arocsBallMemberSolids(f.source, f.groups[0], f.ball.id)).toThrow(
    "matching reviewed",
  );
  await loadArocsBallContacts([f.source]);
  expect(arocsBallJointIds(f.source)).toEqual(["bearing"]);
  const b = arocsBallMemberSolids(f.source, f.groups[0], f.ball.id)!,
    s = arocsBallMemberSolids(f.source, f.groups[1], f.socket.id)!;
  expect(b.map((c) => c.childCount)).toEqual([1, 329]);
  expect(s.map((c) => c.childCount)).toEqual([129, 132, 16]);
  const frames = Object.fromEntries(f.groups.map((g) => [g.id, g.frame]));
  expect(
    arocsBallContactAllowed(f.source, b[0], s[0], [
      frames,
      structuredClone(frames),
    ]),
  ).toBe(true);
  expect(arocsBallContactAllowed(f.source, b[1], s[0], [frames])).toBe(false);
  expect(arocsBallContactAllowed(f.source, b[0], s[1], [frames])).toBe(false);
  expect(
    arocsBallContactAllowed(f.source, b[0], { groupId: "foreign" }, [frames]),
  ).toBe(false);
  const next = structuredClone(frames);
  next.ball.position[2] += 0.051;
  expect(arocsBallContactAllowed(f.source, b[0], s[0], [frames, next])).toBe(
    false,
  );
  expect(arocsBallContactAllowed(f.source, b[0], s[0], [next, frames])).toBe(
    false,
  );
  expect(JSON.stringify(f.project)).toBe(before);
  expect(exportLDraw(f.project)).toBe(sourceText);
  expect(partsList(f.project, occurrences(f.project))).toEqual(inventory);
});
it("refuses edited canonical surfaces and project-shadowed dependencies before native construction", async () => {
  const f = await fixture();
  f.source.memberLocals![f.ball.id] = {
    ...f.source.memberLocals![f.ball.id],
    vertices: f.source.memberLocals![f.ball.id].vertices.slice(),
  };
  f.source.memberLocals![f.ball.id].vertices[0] += 0.001;
  await expect(loadArocsBallContacts([f.source])).rejects.toThrow(
    "matching reviewed",
  );
  const g = await fixture();
  g.project.models.shadow = {
    ...structuredClone(g.project.models[g.project.rootModelId]),
    name: "8-8sphe.dat",
  };
  await expect(loadArocsBallContacts([g.source])).rejects.toThrow("replace");
});
it("refuses aggregate child exhaustion without publishing partially checked bearings", async () => {
  const f = await fixture();
  const sources = Array.from({ length: 7 }, () => ({ ...f.source }));
  await expect(loadArocsBallContacts(sources)).rejects.toThrow("too complex");
  expect(sources.every((s) => arocsBallJointIds(s).length === 0)).toBe(true);
  const one = await fixture();
  await loadArocsBallContacts([one.source]);
  one.source.memberLocals![one.ball.id] = {
    ...one.source.memberLocals![one.ball.id],
    vertices: one.source.memberLocals![one.ball.id].vertices.slice(),
  };
  expect(() =>
    arocsBallMemberSolids(one.source, one.groups[0], one.ball.id),
  ).toThrow("changed");
});
it("rejects moving-joint edits during async binding without publishing a stale contact pair", async () => {
  const f = await fixture(),
    pending = loadArocsBallContacts([f.source]);
  f.project.motionRigs.ball.joints[0].anchorB[0] += 0.01;
  await expect(pending).rejects.toThrow("changed");
  expect(arocsBallJointIds(f.source)).toEqual([]);
});
it("requires the exact preflight source for ordinary ball entry and refuses disconnected compound ownership", async () => {
  const f = await fixture(),
    rig = f.project.motionRigs.ball,
    all = occurrences(f.project);
  expect(physicalPlayEligibility(f.project, rig, all).eligible).toBe(false);
  expect(physicalPlayEligibility(f.project, rig, all, f.source).eligible).toBe(
    false,
  );
  await loadArocsBallContacts([f.source]);
  expect(physicalPlayEligibility(f.project, rig, all, f.source).eligible).toBe(
    true,
  );
  expect(
    physicalPlayEligibility(f.project, rig, all, { ...f.source }).eligible,
  ).toBe(false);
  const clone = structuredClone(f.project);
  expect(
    physicalPlayEligibility(
      clone,
      clone.motionRigs.ball,
      occurrences(clone),
      f.source,
    ).eligible,
  ).toBe(false);
  const g = await fixture(),
    extra = occurrences(g.project).find((o) => o.node.ref === "2736.dat")!;
  g.groups[0].occurrenceIds.push(extra.id);
  g.groups[0].restTransforms[extra.id] = structuredClone(extra.transform);
  await loadArocsBallContacts([g.source]);
  expect(
    physicalPlayEligibility(
      g.project,
      g.project.motionRigs.ball,
      occurrences(g.project),
      g.source,
    ).eligible,
  ).toBe(false);
}, 15000);
it.each([
  undefined,
  {
    position: [80, -60, 120],
    basis: axisRotation(
      [1 / Math.sqrt(3), 1 / Math.sqrt(3), 1 / Math.sqrt(3)],
      37,
    ),
  },
] as Array<Transform | undefined>)(
  "retains source-faceted native neck stops, reversal and foreign blocker/retry at pose%j",
  async (pose) => {
    const f = await fixture(pose),
      before = JSON.stringify(f.project),
      inventory = partsList(f.project, occurrences(f.project));
    await loadArocsBallContacts([f.source]);
    const world = new RAPIER.World({ x: 0, y: 0, z: 0 }),
      events = new RAPIER.EventQueue(true);
    world.timestep = 1 / 60;
    const solids = f.groups.flatMap(
        (g) => arocsBallMemberSolids(f.source, g, g.occurrenceIds[0])!,
      ),
      mapped = new Map<number, MechanicalSolid>();
    const bodies = f.groups.map((g, i) => {
      const p = toPhysics(g.frame.position),
        body = world.createRigidBody(
          (i
            ? RAPIER.RigidBodyDesc.fixed()
            : RAPIER.RigidBodyDesc.dynamic().setCcdEnabled(true)
          )
            .setTranslation(p.x, p.y, p.z)
            .setRotation(frameRotation(g.frame)),
        );
      for (const solid of solids.filter((s) => s.groupId === g.id)) {
        const c = world.createCollider(
          new RAPIER.ColliderDesc(solid.shape).setActiveHooks(
            RAPIER.ActiveHooks.FILTER_CONTACT_PAIRS,
          ),
          body,
        );
        mapped.set(c.handle, solid);
      }
      return body;
    });
    const [ball, socket] = bodies,
      joint = world.createImpulseJoint(
        RAPIER.JointData.spherical(
          toPhysics([0, 0, 0]),
          toPhysics([-10, 0, 0]),
        ),
        socket,
        ball,
        true,
      );
    joint.setContactsEnabled(true);
    ball.recomputeMassPropertiesFromColliders();
    const rest = frameRotation(f.groups[0].frame),
      axis = new Vector3(0, 0, 1).applyQuaternion(rest);
    let frames: Record<string, Transform> = {},
      maxDrift = 0,
      hookHits = 0;
    const hooks = {
      filterIntersectionPair: () => true,
      filterContactPair: (a: number, b: number) => {
        hookHits++;
        const sa = mapped.get(a),
          sb = mapped.get(b);
        return sa && sb && arocsBallContactAllowed(f.source, sa, sb, [frames])
          ? null
          : RAPIER.SolverFlags.COMPUTE_IMPULSE;
      },
    };
    const actualFrames = () =>
      Object.fromEntries(
        bodies.map((b, i) => [
          f.groups[i].id,
          {
            position: fromPhysics(b.translation()),
            basis: basisFromRotation(b.rotation()),
          },
        ]),
      );
    const pivot = (body: RAPIER.RigidBody, p: Vec3) =>
      new Vector3(...Object.values(toPhysics(p)))
        .applyQuaternion(body.rotation() as Quaternion)
        .add(body.translation() as Vector3);
    const step = (torque: number, ticks: number) => {
      for (let i = 0; i < ticks; i++) {
        frames = actualFrames();
        maxDrift = Math.max(
          maxDrift,
          pivot(ball, [-10, 0, 0]).distanceTo(pivot(socket, [0, 0, 0])),
        );
        ball.resetTorques(false);
        ball.addTorque(
          { x: axis.x * torque, y: axis.y * torque, z: axis.z * torque },
          true,
        );
        world.step(events, hooks);
      }
      const q = new Quaternion()
        .copy(ball.rotation() as Quaternion)
        .premultiply(rest.clone().invert());
      return (2 * Math.atan2(q.z, q.w) * 180) / Math.PI;
    };
    try {
      const forward = step(0.0002, 360);
      step(0, 120);
      expect(forward).toBeGreaterThan(24);
      expect(forward).toBeLessThan(32);
      expect(Math.hypot(...Object.values(ball.angvel()))).toBeLessThan(0.001);
      const reverse = step(-0.0002, 720);
      step(0, 120);
      expect(reverse).toBeLessThan(-24);
      expect(reverse).toBeGreaterThan(-32);
      ball.setTranslation(toPhysics(f.groups[0].frame.position), true);
      ball.setRotation(rest, true);
      ball.setLinvel({ x: 0, y: 0, z: 0 }, true);
      ball.setAngvel({ x: 0, y: 0, z: 0 }, true);
      ball.resetTorques(false);
      const base = new Vector3(0.8, 2.6612, 4.848);
      if (pose)
        base
          .applyQuaternion(frameRotation(pose))
          .add(new Vector3(...Object.values(toPhysics(pose.position))));
      const blocker = world.createCollider(
        RAPIER.ColliderDesc.cuboid(0.04, 0.02, 0.04)
          .setTranslation(base.x, base.y, base.z)
          .setRotation(pose ? frameRotation(pose) : { x: 0, y: 0, z: 0, w: 1 }),
      );
      const blocked = step(0.0002, 360);
      expect(blocked).toBeGreaterThan(8);
      expect(blocked).toBeLessThan(20);
      world.removeCollider(blocker, true);
      expect(step(0.0002, 360)).toBeGreaterThan(blocked + 8);
      step(0, 120);
      expect(hookHits).toBeGreaterThan(100);
      expect(maxDrift).toBeLessThan(0.001);
      expect(JSON.stringify(f.project)).toBe(before);
      expect(partsList(f.project, occurrences(f.project))).toEqual(inventory);
    } finally {
      world.free();
      events.free();
    }
  },
  30000,
);
