import RAPIER from "@dimforge/rapier3d-compat";
import { expect, it, vi } from "vitest";
import { occurrences } from "../../src/core/document";
import { KinematicSession } from "../../src/mechanisms/kinematic";
import { rackFixture } from "../../src/mechanisms/rack-fixture";
import type { PlayDynamicsWorld } from "../../src/play/dynamics";
import type { MechanicalSolid } from "../../src/play/mechanical-solids";
import { toPhysics } from "../../src/play/physics-frame";
import {
  loadReviewedMechanicalProxies,
  reviewedMechanicalMember,
} from "../../src/play/reviewed-mechanical-proxies";
import { PlaySession } from "../../src/play/session";
import {
  fullLibrarySources,
  registerFullLibraryFromDisk,
} from "../../scripts/full-library-node";
import { playSources } from "../helpers/play-dynamic-source";

registerFullLibraryFromDisk();
type Mode = "kinematic" | "dynamic";
const modes: Mode[] = ["kinematic", "dynamic"];
async function fixture(mode: Mode, scenario: "wall" | "stop" | 1 | 2) {
  const { project, proposal } = rackFixture(),
    rig = proposal.rig!;
  if (scenario === "stop") {
    // Deliberately allow travel past the reviewed +10 LDU safety margin so
    // this checks the physical end geometry, rather than coordinate clamping.
    rig.joints[0].limits = [-90, 180];
    rig.joints[1].limits = [-88, 25];
  } else if (typeof scenario === "number") {
    const rack = occurrences(project).find((o) => o.node.ref === "18942.dat")!,
      group = rig.groups.find((g) => g.occurrenceIds.includes(rack.id))!,
      joint = rig.joints[1];
    rack.node.transform.position[scenario] += 1;
    group.frame.position[scenario] += 1;
    group.restTransforms[rack.id].position[scenario] += 1;
    joint.anchorB[scenario] -= 1;
    // Keep the native joint rest anchors coincident: the refusal must concern
    // real guide alignment, not an invalid authored joint or stale geometry.
    expect(() => new KinematicSession(project, rig.id)).not.toThrow();
  }
  const before = JSON.stringify(project),
    all = occurrences(project),
    { geometry, sources } = await playSources(
      project,
      [rig.id],
      fullLibrarySources(all.map((o) => o.node.ref)),
    );
  await loadReviewedMechanicalProxies(sources);
  const packets = all
      .map((o) => reviewedMechanicalMember(sources[0], o.id))
      .filter((packet) => packet !== undefined),
    packetsBefore = JSON.stringify(packets),
    unchanged = () => {
      expect(JSON.stringify(project)).toBe(before);
      expect(JSON.stringify(packets)).toBe(packetsBefore);
    };
  expect(packets.length).toBe(2);
  return {
    unchanged,
    create: () =>
      PlaySession.create(
        geometry,
        {
          rigIds: [rig.id],
          dynamicRigIds: mode === "dynamic" ? [rig.id] : [],
          position: [200, -0.3, 200],
        },
        sources,
      ),
  };
}
const report = (session: PlaySession) =>
  session.snapshot().mechanisms!["rack-drive"];
const setTarget = (
  session: PlaySession,
  jointId: string,
  target: number,
  speed: number,
) => session.setJointTarget({ rigId: "rack-drive", jointId, target, speed });

it.each(modes)(
  "%s stops before a 0.1 LDU foreign wall and retries after its removal without changing source or either packet",
  async (mode) => {
    const { create, unchanged } = await fixture(mode, "wall"),
      session = await create(),
      internals = session as unknown as {
        world: RAPIER.World;
        dynamics: PlayDynamicsWorld;
      },
      world = mode === "dynamic" ? internals.dynamics.world : internals.world,
      p = toPhysics([-205, -180, 0]),
      wall = world.createCollider(
        RAPIER.ColliderDesc.cuboid(0.001, 0.24, 0.24).setTranslation(
          p.x,
          p.y,
          p.z,
        ),
      );
    try {
      setTarget(session, "joint-0", 150, 180);
      session.stepTicks(mode === "dynamic" ? 600 : 120);
      const blocked = report(session);
      expect(blocked.pose.jointPositions["joint-0"]).toBeGreaterThan(40);
      expect(blocked.pose.jointPositions["joint-0"]).toBeLessThan(60);
      expect(blocked.jointTargets["joint-0"].status).toBe("blocked");
      // The rack's exact source envelope starts at local X=-139. Its left
      // beam end stays on the near side, including the wall's 0.05 LDU half.
      expect(blocked.groupFrames["moving-2"].position[0] - 139).toBeGreaterThan(
        -205.05,
      );
      unchanged();
      world.removeCollider(wall, false);
      setTarget(session, "joint-0", 150, 180);
      session.stepTicks(mode === "dynamic" ? 900 : 120);
      const retried = report(session);
      expect(retried.pose.jointPositions["joint-0"]).toBeCloseTo(150, 0);
      expect(retried.jointTargets["joint-0"].status).toBe("complete");
      expect(
        Math.abs(
          retried.pose.jointPositions["joint-1"] +
            (retried.pose.jointPositions["joint-0"] * Math.PI) / 6,
        ),
      ).toBeLessThan(0.5);
      unchanged();
    } finally {
      session.dispose();
    }
    unchanged();
  },
  60000,
);

it.each(modes)(
  "%s retains the housing's physical end stop beyond authored safety limits and can reverse away",
  async (mode) => {
    const { create, unchanged } = await fixture(mode, "stop"),
      session = await create();
    try {
      setTarget(session, "joint-1", 20, 40);
      session.stepTicks(mode === "dynamic" ? 600 : 120);
      const stopped = report(session);
      expect(stopped.pose.jointPositions["joint-1"]).toBeGreaterThan(10);
      expect(stopped.pose.jointPositions["joint-1"]).toBeLessThan(12);
      expect(stopped.jointTargets["joint-1"].target).toBe(20);
      expect(stopped.jointTargets["joint-1"].status).toBe("blocked");
      unchanged();
      setTarget(session, "joint-1", 8, 40);
      session.stepTicks(mode === "dynamic" ? 900 : 120);
      const reverse = report(session);
      expect(reverse.pose.jointPositions["joint-1"]).toBeCloseTo(8, 0);
      expect(reverse.jointTargets["joint-1"].status).toBe("complete");
      unchanged();
    } finally {
      session.dispose();
    }
    unchanged();
  },
  60000,
);

it.each(modes.flatMap((mode) => [1, 2].map((axis) => [mode, axis] as const)))(
  "%s refuses a source-bound guide misaligned by 1 LDU on axis %i with valid rest joint anchors",
  async (mode, axis) => {
    const { create, unchanged } = await fixture(mode, axis as 1 | 2);
    await expect(create()).rejects.toThrow(
      /rack and housing need their reviewed guide alignment/,
    );
    unchanged();
  },
  15000,
);

it("restores responding native floor and cap pairs when the actual rack leaves the aligned guide envelope", async () => {
  const { create, unchanged } = await fixture("dynamic", "wall"),
    session = await create();
  try {
    const rig = (
        session as unknown as { dynamics: PlayDynamicsWorld }
      ).dynamics.rig("rack-drive")!,
      internals = rig as unknown as {
        contactSolids: Map<number, MechanicalSolid>;
        bodies: Map<string, { body: RAPIER.RigidBody }>;
      },
      entries = [...internals.contactSolids],
      rack = entries.find(([, solid]) => solid.groupId === "moving-2")![0],
      bearing = entries.filter(
        ([, solid]) =>
          solid.reviewedPlaneClass !== undefined &&
          solid.reviewedPlaneClass !== 0,
      ),
      body = internals.bodies.get("moving-2")!.body,
      rest = { ...body.translation() };
    expect(bearing.length).toBe(3);
    rig.beforeStep();
    expect(bearing.every(([handle]) => !rig.contactAllowed(handle, rack))).toBe(
      true,
    );
    for (const offset of [
      { ...rest, y: rest.y - 0.02 },
      { ...rest, z: rest.z + 0.02 },
    ]) {
      body.setTranslation(offset, true);
      rig.beforeStep();
      expect(
        bearing.every(([handle]) => rig.contactAllowed(handle, rack)),
      ).toBe(true);
    }
    body.setTranslation({ ...rest, y: rest.y - 0.02 }, true);
    const callback = vi.spyOn(rig, "contactAllowed");
    session.stepTicks(1);
    // Observe the real owned-event-queue native hook path, rather than just
    // checking the helper. Known floor/cap collider pairs now respond.
    expect(
      callback.mock.calls.some(
        ([a, b], k) =>
          (a === rack || b === rack) &&
          bearing.some(([handle]) => handle === a || handle === b) &&
          callback.mock.results[k].value === true,
      ),
    ).toBe(true);
    callback.mockRestore();
    unchanged();
  } finally {
    session.dispose();
  }
  unchanged();
}, 15000);
