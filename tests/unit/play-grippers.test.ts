import RAPIER from "@dimforge/rapier3d-compat";
import { Quaternion } from "three";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { Editor } from "../../src/core/commands";
import { copyFragment, pasteFragment } from "../../src/core/fragments";
import { occurrences } from "../../src/core/document";
import { uid } from "../../src/core/types";
import { readFileSync } from "node:fs";
import { gripperFixture } from "../../src/mechanisms/gripper-fixture";
import {
  axisRotation,
  KinematicSession,
  rebaseRig,
  validateRig,
} from "../../src/mechanisms/kinematic";
import { rigAuthoringRequest } from "../../src/mechanisms/authoring";
import { compose, identity, inverse } from "../../src/core/math";
import { exportLDraw } from "../../src/ldraw/io";
import { decodeNative, encodeNative } from "../../src/persistence/native";
import { NativeGrippers, type NativeGripRig } from "../../src/play/grippers";
import { PlayDynamicsWorld } from "../../src/play/dynamics";
import { PlaySession } from "../../src/play/session";
import { frameRotation, toPhysics } from "../../src/play/physics-frame";
import { playSources } from "../helpers/play-dynamic-source";
import { validate } from "../../src/core/validate";
import { validateRequest } from "../../src/core/validate-request";
import type { Transform } from "../../src/core/types";

beforeAll(async () => {
  await RAPIER.init();
});
const cleanup: Array<() => void> = [];
afterEach(() =>
  cleanup
    .splice(0)
    .reverse()
    .forEach((f) => f()),
);
const request = { rigId: "crane", gripperId: "claw" },
  target = { rigId: "cargo", groupId: "crate" },
  grab = { ...request, target };
async function fixture(
  options: {
    massKg?: number;
    effortN?: number;
    pose?: Transform;
    edit?: (f: ReturnType<typeof gripperFixture>) => void;
  } = {},
) {
  const f = gripperFixture(options.pose, options.massKg, options.effortN);
  options.edit?.(f);
  const original = JSON.stringify(f.project),
    rest = exportLDraw(f.project),
    prepared = await playSources(f.project, ["crane", "cargo"]);
  const mirror = new RAPIER.World({ x: 0, y: 0, z: 0 }),
    world = new PlayDynamicsWorld(
      undefined,
      false,
      mirror,
      prepared.sources,
      f.project.revision,
    );
  cleanup.push(() => {
    world.dispose();
    mirror.free();
  });
  const holder = world
      .rig("crane")!
      .gripSource()
      .groups.find((g) => g.groupId === "head")!.body,
    payload = world.rig("cargo")!.gripSource().groups[0].body;
  const step = (ticks: number) => {
    for (let n = 0; n < ticks; n++) world.step([1000, 0, 1000], false);
    return world.rig("crane")!.snapshot();
  };
  const poses = () => ({
    holder: world.rig("crane")!.snapshot().groupFrames.head,
    payload: world.rig("cargo")!.snapshot().groupFrames.crate,
  });
  return {
    ...f,
    original,
    rest,
    prepared,
    world,
    holder,
    payload,
    step,
    poses,
  };
}
function velocity(body: RAPIER.RigidBody) {
  return { linear: { ...body.linvel() }, angular: { ...body.angvel() } };
}
function attachmentError(
  before: ReturnType<Awaited<ReturnType<typeof fixture>>["poses"]>,
  after: ReturnType<Awaited<ReturnType<typeof fixture>>["poses"]>,
) {
  const expected = compose(
    after.holder,
    compose(inverse(before.holder), before.payload),
  );
  return {
    position: Math.hypot(
      ...expected.position.map((v, k) => v - after.payload.position[k]),
    ),
    basis: Math.max(
      ...expected.basis.map((v, k) => Math.abs(v - after.payload.basis[k])),
    ),
  };
}

describe("native-session gripper attachments", () => {
  it("attaches at the actual current pose without changing either pose or velocity, carries a rotated payload and releases to ordinary physics", async () => {
    const f = await fixture();
    f.payload.setRotation(
      new Quaternion().setFromAxisAngle({ x: 0, y: 1, z: 0 }, Math.PI / 7),
      true,
    );
    f.payload.setLinvel({ x: 0.03, y: 0.01, z: 0.02 }, true);
    f.payload.setAngvel({ x: 0.01, y: 0.02, z: 0.03 }, true);
    const nativeBefore = {
        a: { ...f.holder.translation() },
        ar: { ...f.holder.rotation() },
        b: { ...f.payload.translation() },
        br: { ...f.payload.rotation() },
        va: velocity(f.holder),
        vb: velocity(f.payload),
      },
      before = f.poses();
    expect(f.world.grippers.report("crane").claw.state).toBe("ready");
    f.world.grippers.grab(grab);
    expect({
      a: { ...f.holder.translation() },
      ar: { ...f.holder.rotation() },
      b: { ...f.payload.translation() },
      br: { ...f.payload.rotation() },
      va: velocity(f.holder),
      vb: velocity(f.payload),
    }).toEqual(nativeBefore);
    expect(f.world.world.impulseJoints.len()).toBe(3);
    f.world.world.impulseJoints.forEach((j) =>
      expect(j.contactsEnabled()).toBe(true),
    );
    let maxPosition = 0,
      maxBasis = 0;
    for (const jointId of ["lift", "carry"]) {
      f.world.rig("crane")!.setJointTarget(jointId, 60, 60);
      for (let n = 0; n < 300; n++) {
        f.step(1);
        const error = attachmentError(before, f.poses());
        maxPosition = Math.max(maxPosition, error.position);
        maxBasis = Math.max(maxBasis, error.basis);
      }
    }
    expect(maxPosition).toBeLessThan(0.5);
    expect(maxBasis).toBeLessThan(0.01);
    const moved = f.poses();
    expect(moved.payload.position[0]).toBeGreaterThan(55);
    expect(moved.payload.position[1]).toBeLessThan(-130);
    expect(f.world.grippers.report("crane").claw).toMatchObject({
      state: "holding",
      held: { ...target, massKg: 1 },
    });
    const releasePosition = { ...f.payload.translation() },
      releaseVelocity = velocity(f.payload);
    f.world.grippers.release(request);
    expect(f.payload.translation()).toEqual(releasePosition);
    expect(velocity(f.payload)).toEqual(releaseVelocity);
    expect(f.payload.additionalSolverIterations()).toBe(0);
    expect(f.world.world.impulseJoints.len()).toBe(2);
    f.step(30);
    expect(f.poses().payload.position[1]).toBeGreaterThan(
      moved.payload.position[1] + 40,
    );
    expect(f.world.grippers.report("crane").claw.held).toBeUndefined();
    expect(JSON.stringify(f.project)).toBe(f.original);
    expect(exportLDraw(f.project)).toBe(f.rest);
  }, 15000);
  it("held mass reacts through the native attachment and stalls an effort-limited lift", async () => {
    const light = await fixture({ massKg: 1, effortN: 40 }),
      heavy = await fixture({ massKg: 40, effortN: 40 });
    for (const f of [light, heavy]) {
      f.world.grippers.grab(grab);
      f.world.rig("crane")!.setJointTarget("lift", 60, 60);
    }
    const a = light.step(900),
      b = heavy.step(900);
    expect(a.jointTargets.lift.status).toBe("complete");
    expect(a.pose.jointPositions.lift).toBeGreaterThan(59);
    expect(b.jointTargets.lift.status).toBe("blocked");
    expect(b.pose.jointPositions.lift).toBeLessThan(1);
    expect(heavy.world.grippers.report("crane").claw.held!.massKg).toBeCloseTo(
      40,
      4,
    );
    expect(heavy.payload.mass()).toBeCloseTo(40, 4);
    expect(heavy.holder.mass()).toBeCloseTo(1, 4);
    expect(JSON.stringify(heavy.project)).toBe(heavy.original);
  }, 15000);
  it("held payload contacts still stop its carrier against a world obstacle and recover after removal", async () => {
    const f = await fixture({ effortN: 100 });
    f.world.grippers.grab(grab);
    f.world.rig("crane")!.setJointTarget("lift", 60, 60);
    f.step(300);
    const p = toPhysics([58, -145, 0]),
      obstacle = f.world.world.createCollider(
        RAPIER.ColliderDesc.cuboid(0.04, 1, 0.8)
          .setTranslation(p.x, p.y, p.z)
          .setCollisionGroups(0x0001ffff),
      );
    f.world.rig("crane")!.setJointTarget("carry", 60, 60);
    const blocked = f.step(300);
    expect(blocked.jointTargets.carry.status).toBe("blocked");
    expect(blocked.pose.jointPositions.carry).toBeGreaterThan(10);
    expect(blocked.pose.jointPositions.carry).toBeLessThan(25);
    expect(f.world.grippers.report("crane").claw.state).toBe("holding");
    f.world.world.removeCollider(obstacle, true);
    const recovered = f.step(300);
    expect(recovered.jointTargets.carry.status).toBe("complete");
    expect(recovered.pose.jointPositions.carry).toBeCloseTo(60, 0);
  }, 15000);
  it("refuses a second owner, held replacement, remote/overweight/anchored/constrained or gripper-bearing targets atomically", async () => {
    const f = await fixture({
      edit: (f) =>
        f.crane.grippers!.push({
          id: "second",
          groupId: "carriage",
          anchor: [0, 36, -40],
          captureRadiusLdu: 12,
          maxPayloadMassKg: 100,
        }),
    });
    f.world.grippers.grab(grab);
    const native = f.world.world.impulseJoints.len(),
      before = f.world.grippers.report("crane");
    expect(() =>
      f.world.grippers.grab({ ...grab, gripperId: "second" }),
    ).toThrow(/nearby loose/);
    expect(() => f.world.grippers.grab(grab)).toThrow(/Release/);
    expect(f.world.world.impulseJoints.len()).toBe(native);
    expect(f.world.grippers.report("crane")).toEqual(before);
    f.world.grippers.release(request);
    f.world.grippers.grab({ ...grab, gripperId: "second" });
    f.world.grippers.release({ ...request, gripperId: "second" });
    for (const edit of [
      (f: ReturnType<typeof gripperFixture>) => {
        f.cargo.dynamics!.groups!.crate.anchored = true;
      },
      (f: ReturnType<typeof gripperFixture>) => {
        f.crane.grippers![0].maxPayloadMassKg = 0.5;
      },
      (f: ReturnType<typeof gripperFixture>) => {
        f.cargo.grippers = [
          {
            id: "nested",
            groupId: "crate",
            anchor: [0, 0, 0],
            captureRadiusLdu: 1,
            maxPayloadMassKg: 1,
          },
        ];
      },
    ]) {
      const blocked = await fixture({ edit }),
        prior = blocked.world.grippers.report("crane"),
        count = blocked.world.world.impulseJoints.len();
      expect(() => blocked.world.grippers.grab(grab)).toThrow(/nearby loose/);
      expect(blocked.world.grippers.report("crane")).toEqual(prior);
      expect(blocked.world.world.impulseJoints.len()).toBe(count);
    }
    const remote = await fixture();
    remote.payload.setTranslation(toPhysics([500, -76, 0]), true);
    remote.world.grippers.invalidate();
    expect(() => remote.world.grippers.grab(grab)).toThrow(/nearby loose/);
    expect(() =>
      remote.world.grippers.grab({
        ...grab,
        target: { rigId: "crane", groupId: "head" },
      }),
    ).toThrow(/nearby loose/);
    expect(() =>
      remote.world.grippers.grab({
        ...grab,
        target: { rigId: "crane", groupId: "carriage" },
      }),
    ).toThrow(/nearby loose/);
  }, 15000);
  it("preserves rotated group frames through attach, lift and release and disposes live attachments before bodies", async () => {
    const f = await fixture({
        pose: {
          basis: axisRotation(
            [1 / Math.sqrt(3), 1 / Math.sqrt(3), 1 / Math.sqrt(3)],
            31,
          ),
          position: [300, -200, 100],
        },
      }),
      before = f.poses();
    f.world.grippers.grab(grab);
    f.world.rig("crane")!.setJointTarget("lift", 60, 60);
    f.step(300);
    const error = attachmentError(before, f.poses());
    expect(error.position).toBeLessThan(0.5);
    expect(error.basis).toBeLessThan(0.01);
    f.world.grippers.dispose();
    f.world.grippers.dispose();
    expect(f.world.world.impulseJoints.len()).toBe(2);
    expect(() => f.world.grippers.grab(grab)).toThrow(/ended/);
  }, 15000);
  it("bounds active attachments at sixteen before allocation and restores capacity after release", () => {
    const world = new RAPIER.World({ x: 0, y: 0, z: 0 }),
      sources: NativeGripRig[] = [0, 1, 2].map((i) => ({
        rigId: `holders${i}`,
        definitions: [],
        groups: [],
      })),
      cargo: NativeGripRig = { rigId: "cargo", definitions: [], groups: [] };
    const requests: Array<{
      rigId: string;
      gripperId: string;
      target: { rigId: string; groupId: string };
    }> = [];
    for (let n = 0; n < 17; n++) {
      const source = sources[Math.floor(n / 8)],
        groupId = `holder${n}`,
        holder = world.createRigidBody(
          RAPIER.RigidBodyDesc.fixed().setTranslation(n * 2, 0, 0),
        ),
        payload = world.createRigidBody(
          RAPIER.RigidBodyDesc.dynamic()
            .setTranslation(n * 2 + 0.1, 0, 0)
            .setAdditionalMass(1),
        );
      world.createCollider(
        RAPIER.ColliderDesc.cuboid(0.01, 0.01, 0.01).setDensity(0),
        holder,
      );
      world.createCollider(
        RAPIER.ColliderDesc.cuboid(0.01, 0.01, 0.01).setDensity(0),
        payload,
      );
      payload.recomputeMassPropertiesFromColliders();
      (source.groups as Array<NativeGripRig["groups"][number]>).push({
        groupId,
        body: holder,
        rest: { ...identity(), position: [n * 100, 0, 0] },
        loose: false,
      });
      (source.definitions as Array<NativeGripRig["definitions"][number]>).push({
        id: groupId,
        groupId,
        anchor: [0, 0, 0],
        captureRadiusLdu: 16,
        maxPayloadMassKg: 5,
      });
      (cargo.groups as Array<NativeGripRig["groups"][number]>).push({
        groupId: `payload${n}`,
        body: payload,
        rest: { ...identity(), position: [n * 100 + 5, 0, 0] },
        loose: true,
      });
      requests.push({
        rigId: source.rigId,
        gripperId: groupId,
        target: { rigId: "cargo", groupId: `payload${n}` },
      });
    }
    const grips = new NativeGrippers(world, [...sources, cargo]);
    cleanup.push(() => {
      grips.dispose();
      world.free();
    });
    for (const request of requests.slice(0, 16)) grips.grab(request);
    expect(world.impulseJoints.len()).toBe(16);
    expect(() => grips.grab(requests[16])).toThrow(/sixteen/);
    expect(world.impulseJoints.len()).toBe(16);
    grips.release(requests[0]);
    grips.grab(requests[16]);
    expect(world.impulseJoints.len()).toBe(16);
    grips.dispose();
    expect(world.impulseJoints.len()).toBe(0);
  });
  it("keeps grippers in native save/restore and posed rebase, and refuses basic editing that would discard them", async () => {
    const f = gripperFixture();
    expect(
      readFileSync(
        new URL("../../fixtures/ldraw/gripper-lift.mpd", import.meta.url),
        "utf8",
      ),
    ).toBe(f.text);
    validate("motionRig", f.crane);
    validateRequest("playGrabRequest", grab);
    validateRequest("playGripRequest", request);
    const restored = await decodeNative(await encodeNative(f.project));
    expect(restored.motionRigs).toEqual(f.project.motionRigs);
    expect(() => rigAuthoringRequest(restored, "crane")).toThrow(/grippers/);
    const preview = new KinematicSession(f.project, "crane"),
      pose = preview.setJointPosition("lift", 60),
      rebased = rebaseRig(f.crane, pose);
    expect(rebased.grippers).toEqual(f.crane.grippers);
    expect(JSON.stringify(restored)).not.toContain('"held"');
    const invalid = structuredClone(f.crane);
    invalid.grippers![0].captureRadiusLdu = 33;
    expect(() => validateRig(f.project, invalid)).toThrow(/radius/);
  });
  it("applies and undoes poses without dropping capture zones and refuses clipboard remapping atomically", () => {
    const f = gripperFixture(),
      editor = new Editor(f.project),
      source = structuredClone(editor.project);
    const pose = new KinematicSession(editor.project, "crane").setJointPosition(
      "lift",
      60,
    );
    editor.dispatch({
      schemaVersion: 1,
      commandId: uid(),
      expectedRevision: editor.project.revision,
      type: "rigs.applyPose",
      payload: {
        rigId: "crane",
        sourceRevision: editor.project.revision,
        pose: pose.pose,
      },
    });
    expect(editor.project.motionRigs.crane.grippers).toEqual(f.crane.grippers);
    validateRig(editor.project, editor.project.motionRigs.crane);
    editor.dispatch({
      schemaVersion: 1,
      commandId: uid(),
      expectedRevision: editor.project.revision,
      type: "history.undo",
      payload: {},
    });
    expect(editor.project.motionRigs).toEqual(source.motionRigs);
    expect(() =>
      copyFragment(editor.project, {
        occurrenceIds: occurrences(editor.project).map((o) => o.id),
      }),
    ).toThrow(/motion rigs/);
    const target = structuredClone(editor.project);
    target.motionRigs = {};
    const before = structuredClone(target);
    expect(() =>
      pasteFragment(target, { schemaVersion: 1, project: editor.project }, [
        identity(),
      ]),
    ).toThrow(/motion rigs/);
    expect(target).toEqual(before);
  });
  it("refuses an interpenetrating grasp without creating a joint or changing any body state", async () => {
    const f = await fixture();
    f.payload.setTranslation(toPhysics([0, -89, 0]), true);
    f.world.world.propagateModifiedBodyPositionsToColliders();
    f.world.grippers.invalidate();
    const count = f.world.world.impulseJoints.len(),
      before = {
        p: { ...f.payload.translation() },
        r: { ...f.payload.rotation() },
        v: velocity(f.payload),
      };
    expect(() => f.world.grippers.grab(grab)).toThrow(/clear/);
    expect(f.world.world.impulseJoints.len()).toBe(count);
    expect({
      p: { ...f.payload.translation() },
      r: { ...f.payload.rotation() },
      v: velocity(f.payload),
    }).toEqual(before);
  });
  it("exposes only Dynamic candidates in a real session and leaves no attachment state after exit/re-entry", async () => {
    const f = gripperFixture(),
      source = JSON.stringify(f.project),
      prepared = await playSources(f.project, ["crane", "cargo"]);
    const run = async (dynamic: boolean) => {
      const session = await PlaySession.create(
        prepared.geometry,
        {
          rigIds: ["crane", "cargo"],
          dynamicRigIds: dynamic ? ["crane", "cargo"] : [],
          position: [300, -0.3, 300],
        },
        prepared.sources,
      );
      try {
        if (!dynamic) {
          expect(session.snapshot().mechanisms!.crane.grippers).toBeUndefined();
          expect(() => session.grab(grab)).toThrow(/Dynamic Play/);
        } else {
          expect(
            session.snapshot().mechanisms!.crane.grippers!.claw.state,
          ).toBe("ready");
          const report = session.grab(grab);
          validate("playSnapshot", report);
          expect(report.mechanisms!.crane.grippers!.claw.state).toBe("holding");
          expect(() =>
            session.grab({ ...grab, unexpected: true } as typeof grab),
          ).toThrow(/Unknown/);
        }
      } finally {
        session.dispose();
        session.dispose();
      }
      expect(() => session.release(request)).toThrow(/ended/);
    };
    await run(false);
    await run(true);
    await run(true);
    expect(JSON.stringify(f.project)).toBe(source);
  }, 15000);
});
