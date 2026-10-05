import RAPIER from "@dimforge/rapier3d-compat";
import { beforeAll, expect, it } from "vitest";
import { occurrences } from "../../src/core/document";
import { partsList } from "../../src/inventory/parts-list";
import { exportLDraw } from "../../src/ldraw/io";
import { axisRotation } from "../../src/mechanisms/kinematic";
import { prepareArocsBallRest } from "../../src/play/arocs-ball-rest";
import {
  compileArocsBallRestCovers,
  readArocsBallNativeCover,
} from "../../src/play/arocs-ball-native-covers";
import { prepareMechanicalSources } from "../../src/play/mechanical-solids";
import { createArocsBallNativeRest } from "../../src/play/arocs-ball-native-rest";
import { PlayDynamicsWorld } from "../../src/play/dynamics";
import { toPhysics } from "../../src/play/physics-frame";
import { arocsBallLinkFixture } from "../helpers/arocs-ball-link-source";
beforeAll(() => RAPIER.init());

it("seals both actual endpoints to ONE physical socket roster and refuses duplicated or copied ownership", async () => {
  const f = await arocsBallLinkFixture();
  f.source.nativeRest = await prepareArocsBallRest(f.source);
  const [a, b] = f.source.nativeRest,
    ca = compileArocsBallRestCovers(a),
    cb = compileArocsBallRestCovers(b),
    sa = ca.filter((c) => readArocsBallNativeCover(a, c).member === "socket"),
    sb = cb.filter((c) => readArocsBallNativeCover(b, c).member === "socket");
  expect(sa.length).toBe(3);
  expect(sb.length).toBe(3);
  sa.forEach((c, i) => expect(c).toBe(sb[i]));
  expect(readArocsBallNativeCover(a, sa[0]).anchor).not.toEqual(
    readArocsBallNativeCover(b, sa[0]).anchor,
  );
  expect(() => readArocsBallNativeCover(b, { ...sa[0] })).toThrow(
    /exact reviewed cover/,
  );
  const unrelated = ca.find(
    (c) => readArocsBallNativeCover(a, c).member === "ball",
  )!;
  expect(() => readArocsBallNativeCover(b, unrelated)).toThrow(/cover context/);
  const prepared = prepareMechanicalSources([f.source]).get("seat")!;
  expect(
    [
      ...prepared.solids,
      ...prepared.stationary.filter((s) => s.groupId === "socket"),
    ].reduce((n, s) => n + s.childCount, 0),
  ).toBe(937);
  const rig = f.project.motionRigs.seat,
    original = structuredClone(rig);
  rig.dynamics = {
    groups: { socket: { anchored: true }, ball0: { anchored: true } },
  };
  await expect(prepareArocsBallRest(f.source)).rejects.toThrow(
    /reviewed source/,
  );
  rig.dynamics = original.dynamics;
  rig.joints[1].restAssembly!.socketEndpoint = 0;
  await expect(prepareArocsBallRest(f.source)).rejects.toThrow(
    /reviewed source/,
  );
  f.project.motionRigs.seat = structuredClone(original);
  f.project.motionRigs.seat.joints[1].restAssembly!.ballOccurrenceId =
    original.joints[0].restAssembly!.ballOccurrenceId;
  await expect(prepareArocsBallRest(f.source)).rejects.toThrow(
    /reviewed source/,
  );
  f.project.motionRigs.seat = structuredClone(original);
  f.project.motionRigs.seat.groups[0].occurrenceIds.push(f.balls[0].id);
  await expect(prepareArocsBallRest(f.source)).rejects.toThrow(
    /reviewed source/,
  );
}, 30000);

it.each([
  { mobile: false, yaw: 0 },
  { mobile: true, yaw: 0 },
  { mobile: true, yaw: 37 },
])(
  "seats and carries both actual ends with a shared source socket %j, default gravity and real ground",
  async ({ mobile, yaw }) => {
    const f = await arocsBallLinkFixture(
      mobile,
      yaw
        ? { position: [0, 0, 0], basis: axisRotation([0, 1, 0], yaw) }
        : undefined,
    );
    f.source.nativeRest = await prepareArocsBallRest(f.source);
    const before = JSON.stringify(f.project),
      text = exportLDraw(f.project),
      inventory = partsList(f.project, occurrences(f.project)),
      character = new RAPIER.World({ x: 0, y: 0, z: 0 }),
      d = new PlayDynamicsWorld(
        undefined,
        true,
        character,
        [f.source],
        f.project.revision,
      ),
      rig = d.rig("seat")!;
    try {
      const counts = () => [
        d.world.bodies.len(),
        d.world.colliders.len(),
        d.world.impulseJoints.len(),
      ];
      expect(counts()).toEqual([4, 9, 2]);
      expect(
        Object.values(rig.snapshot().dynamics!.restAssemblies!).every(
          (r) => r.state === "seating",
        ),
      ).toBe(true);
      expect(() => rig.setJointTarget("bearing0", 1, 1)).toThrow(/settle/);
      for (let t = 0; t < 240; t++) d.step([1000, 0, 1000], false);
      const report = rig.snapshot();
      expect(
        Object.values(report.dynamics!.restAssemblies!).map((r) => r.state),
      ).toEqual(["ready", "ready"]);
      for (const state of Object.values(report.dynamics!.restAssemblies!))
        expect(state.gapLdu).toBeLessThan(0.01);
      expect(counts()).toEqual([4, 9, 2]);
      expect(
        Object.values(report.dynamics!.bodies)
          .map((b) => b.colliders)
          .sort(),
      ).toEqual([2, 2, 3]);
      // Give the shared physical link a real transient impulse. Both original
      // native constraints remain; the source is never used as a pose reset.
      if (mobile) {
        const socket = [...rig.mirrorBodies().values()].find(
          (b) => b.numColliders() === 3,
        )!;
        socket.applyImpulse({ x: 0.01, y: 0, z: 0 }, true);
        for (let t = 0; t < 30; t++) d.step([1000, 0, 1000], false);
        expect(
          Object.values(rig.snapshot().dynamics!.restAssemblies!).every(
            (r) => r.state === "ready",
          ),
        ).toBe(true);
        expect(counts()).toEqual([4, 9, 2]);
      }
      const ball1 = [...rig.mirrorBodies()].find(
          ([handle]) => rig.supportFrame(handle)?.groupId === "ball1",
        )![1],
        native = ball1.translation();
      ball1.setTranslation(
        { x: native.x + 0.1, y: native.y, z: native.z },
        true,
      );
      d.step([1000, 0, 1000], false);
      expect(
        Object.values(rig.snapshot().dynamics!.restAssemblies!).some(
          (r) => r.state === "blocked",
        ),
      ).toBe(true);
      expect(() => rig.setJointTarget("bearing0", 1, 1)).toThrow();
      expect(counts()).toEqual([4, 9, 2]);
      expect(JSON.stringify(f.project)).toBe(before);
      expect(exportLDraw(f.project)).toBe(text);
      expect(partsList(f.project, occurrences(f.project))).toEqual(inventory);
    } finally {
      d.dispose();
      character.free();
    }
  },
  60000,
);

it("keeps foreign obstruction responding at either end and never admits both ends as ready", async () => {
  const f = await arocsBallLinkFixture();
  f.source.nativeRest = await prepareArocsBallRest(f.source);
  const before = JSON.stringify(f.project),
    character = new RAPIER.World({ x: 0, y: 0, z: 0 }),
    d = new PlayDynamicsWorld(
      undefined,
      true,
      character,
      [f.source],
      f.project.revision,
    ),
    rig = d.rig("seat")!,
    p = toPhysics(f.balls[1].transform.position),
    foreign = d.world.createCollider(
      RAPIER.ColliderDesc.cuboid(0.3, 0.3, 0.3).setTranslation(p.x, p.y, p.z),
    );
  try {
    for (let t = 0; t < 240; t++) d.step([1000, 0, 1000], false);
    expect(
      Object.values(rig.snapshot().dynamics!.restAssemblies!).some(
        (r) => r.state === "blocked",
      ),
    ).toBe(true);
    expect(rig.snapshot().blocked).toBe(true);
    expect(() => rig.setJointTarget("bearing0", 1, 1)).toThrow();
    const ball1 = [...rig.mirrorBodies()].find(
      ([handle]) => rig.supportFrame(handle)?.groupId === "ball1",
    )![1];
    expect(rig.contactAllowed(ball1.collider(0).handle, foreign.handle)).toBe(
      true,
    );
    expect(foreign.isValid()).toBe(true);
    expect(JSON.stringify(f.project)).toBe(before);
  } finally {
    d.dispose();
    character.free();
  }
}, 30000);

it("refuses a duplicated live socket through the standalone factory and permits reconstruction only after removal", async () => {
  const f = await arocsBallLinkFixture(),
    tokens = await prepareArocsBallRest(f.source),
    before = JSON.stringify(f.project),
    world = new RAPIER.World({ x: 0, y: 0, z: 0 });
  const first = createArocsBallNativeRest(tokens[0], world, {
    socketAnchored: true,
  });
  try {
    const counts = () => [
      world.bodies.len(),
      world.colliders.len(),
      world.impulseJoints.len(),
    ];
    expect(counts()).toEqual([2, 5, 1]);
    expect(() =>
      createArocsBallNativeRest(tokens[1], world, { socketAnchored: true }),
    ).toThrow(/one native body/);
    expect(counts()).toEqual([2, 5, 1]);
    first.dispose();
    expect(counts()).toEqual([0, 0, 0]);
    const retry = createArocsBallNativeRest(tokens[1], world, {
      socketAnchored: true,
    });
    try {
      expect(counts()).toEqual([2, 5, 1]);
      expect(JSON.stringify(f.project)).toBe(before);
    } finally {
      retry.dispose();
    }
  } finally {
    first.dispose();
    world.free();
  }
}, 30000);
