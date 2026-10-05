import RAPIER from "@dimforge/rapier3d-compat";
import { beforeAll, expect, it } from "vitest";
import { occurrences } from "../../src/core/document";
import { partsList } from "../../src/inventory/parts-list";
import { exportLDraw } from "../../src/ldraw/io";
import { axisRotation } from "../../src/mechanisms/kinematic";
import { PlayDynamicsWorld } from "../../src/play/dynamics";
import {
  prepareArocsBallRest,
  requireArocsBallRestConstruction,
} from "../../src/play/arocs-ball-rest";
import { prepareMechanicalSources } from "../../src/play/mechanical-solids";
import { toPhysics } from "../../src/play/physics-frame";
import { arocsRestFixture } from "../helpers/arocs-ball-rest-source";
beforeAll(() => RAPIER.init());

it("refuses omitted, copied and stale construction tokens plus unreviewed attachments before native allocation", async () => {
  const f = await arocsRestFixture();
  expect(() => requireArocsBallRestConstruction(f.source)).toThrow(/preflight/);
  for (const change of [
    () => {
      f.project.motionRigs.seat.forceLinks = [];
      f.project.motionRigs.seat.forceLinks.push({
        id: "extra",
        kind: "rope",
        bodyA: "socket",
        bodyB: "ball",
        anchorA: [0, 0, 0],
        anchorB: [0, 0, 0],
        maxLengthLdu: 10,
      });
    },
    () => {
      f.project.motionRigs.seat.grippers = [
        {
          id: "extra",
          groupId: "ball",
          anchor: [0, 0, 0],
          reachLdu: 1,
        } as never,
      ];
    },
    () => {
      f.project.motionRigs.seat.vehicle = {} as never;
    },
    () => {
      f.project.motionRigs.seat.dynamics = {
        groups: { ball: { anchored: true }, socket: { anchored: true } },
      };
    },
  ]) {
    const rig = structuredClone(f.project.motionRigs.seat);
    change();
    await expect(prepareArocsBallRest(f.source)).rejects.toThrow(
      /reviewed source/,
    );
    f.project.motionRigs.seat = rig;
  }
  f.source.nativeRest = await prepareArocsBallRest(f.source);
  expect(() => requireArocsBallRestConstruction({ ...f.source })).toThrow(
    /exact checked source/,
  );
  const token = f.source.nativeRest[0];
  f.source.nativeRest = [{ ...token }];
  expect(() => requireArocsBallRestConstruction(f.source)).toThrow(/preflight/);
  f.source.nativeRest = [token];
  f.project.revision++;
  expect(() => requireArocsBallRestConstruction(f.source)).toThrow(
    /build changed/,
  );
}, 30000);

it.each([false, true])(
  "seats existing ordinary native bodies with real default ground, mobile=%s, preserving all source ownership",
  async (mobile) => {
    for (const rotated of [false, true]) {
      const pose = rotated
          ? {
              position: [0, 0, 0] as [number, number, number],
              basis: axisRotation([0, 1, 0], 37),
            }
          : undefined,
        f = await arocsRestFixture(undefined, pose);
      if (mobile)
        f.project.motionRigs.seat.dynamics = {
          groups: { socket: { anchored: false } },
        };
      f.source.nativeRest = await prepareArocsBallRest(f.source);
      const before = JSON.stringify(f.project),
        text = exportLDraw(f.project),
        inventory = partsList(f.project, occurrences(f.project)),
        prepared = prepareMechanicalSources([f.source]),
        character = new RAPIER.World({ x: 0, y: 0, z: 0 }),
        d = new PlayDynamicsWorld(
          undefined,
          true,
          character,
          [f.source],
          f.project.revision,
          prepared,
        ),
        rig = d.rig("seat")!;
      try {
        const counts = () => [
          d.world.bodies.len(),
          d.world.colliders.len(),
          d.world.impulseJoints.len(),
        ];
        expect(counts()).toEqual([3, 7, 1]);
        expect(rig.snapshot().dynamics!.restAssemblies!.bearing.state).toBe(
          "seating",
        );
        expect(() => rig.setJointTarget("bearing", 1, 1)).toThrow(/settle/);
        for (let tick = 0; tick < 240; tick++) d.step([1000, 0, 1000], false);
        const state = rig.snapshot().dynamics!.restAssemblies!.bearing;
        expect(state.state).toBe("ready");
        expect(state.gapLdu).toBeLessThan(0.01);
        expect(counts()).toEqual([3, 7, 1]);
        expect(rig.snapshot().dynamics!.bodies.ball.colliders).toBe(2);
        expect(rig.snapshot().dynamics!.bodies.socket.colliders).toBe(3);
        expect(rig.snapshot().blocked).toBe(false);
        // Move only the transient native ball: the original source remains exact,
        // while the current bearing witness and ready controls are revoked.
        const ballBody = [...rig.mirrorBodies().values()].find((b) =>
          b.isDynamic(),
        )!;
        const p = ballBody.translation();
        ballBody.setTranslation({ x: p.x + 0.1, y: p.y, z: p.z }, true);
        d.step([1000, 0, 1000], false);
        expect(rig.snapshot().dynamics!.restAssemblies!.bearing.state).toBe(
          "blocked",
        );
        expect(rig.snapshot().blocked).toBe(true);
        expect(JSON.stringify(f.project)).toBe(before);
        expect(exportLDraw(f.project)).toBe(text);
        expect(partsList(f.project, occurrences(f.project))).toEqual(inventory);
      } finally {
        d.dispose();
        character.free();
      }
    }
  },
  60000,
);

it.each([true, 4])(
  "keeps included foreign geometry or raised ground %s responding without publishing readiness",
  async (ground) => {
    const f = await arocsRestFixture();
    f.source.nativeRest = await prepareArocsBallRest(f.source);
    const before = JSON.stringify(f.project),
      character = new RAPIER.World({ x: 0, y: 0, z: 0 }),
      d = new PlayDynamicsWorld(
        undefined,
        ground,
        character,
        [f.source],
        f.project.revision,
      ),
      p = toPhysics(f.socket.transform.position),
      foreign =
        ground === true
          ? d.world.createCollider(
              RAPIER.ColliderDesc.cuboid(0.3, 0.3, 0.3).setTranslation(
                p.x,
                p.y,
                p.z,
              ),
            )
          : undefined;
    try {
      const rig = d.rig("seat")!;
      for (const handle of rig.mirrorBodies().keys())
        expect(handle).toBeDefined();
      for (let t = 0; t < 240; t++) d.step([1000, 0, 1000], false);
      expect(rig.snapshot().dynamics!.restAssemblies!.bearing.state).toBe(
        "blocked",
      );
      expect(rig.snapshot().blocked).toBe(true);
      if (foreign) expect(foreign.isValid()).toBe(true);
      expect(JSON.stringify(f.project)).toBe(before);
    } finally {
      d.dispose();
      character.free();
    }
  },
  30000,
);
