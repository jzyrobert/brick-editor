import { expect, it } from "vitest";
import { Mesh, Vector3, Group } from "three";
import { BrickAvatar, JOINTS } from "../../src/play/avatar";
import { identity, rotationY, mv, add } from "../../src/core/math";
import {
  SEATED_BODY_PROFILE as body,
  SEATED_VISUAL_POSE as pose,
  seatedPlacement,
} from "../../src/play/seated-profile";
import { avatarGeometryFromDisk } from "../helpers/avatar-pack";

it(
  "independent fixed body envelopes contain the actual minifig seated hierarchy across supported head yaw and pitch",
  { timeout: 60000 },
  async () => {
    const avatar = new BrickAvatar(await avatarGeometryFromDisk()),
      originalHipLimits = [...JOINTS.leftHip.limits];
    try {
      const vertices = new Map<Mesh, number[]>();
      avatar.group.traverse((object) => {
        if (object instanceof Mesh)
          vertices.set(
            object,
            Array.from(object.geometry.getAttribute("position").array),
          );
      });
      for (const object of avatar.group.children)
        if (object instanceof Group) {
          const entry = Object.entries(JOINTS).find(([, joint]) =>
            object.position.equals(new Vector3(...joint.pivot)),
          )!;
          if (entry[0] === "head") object.rotation.x = pose.headPitch;
          else object.rotation.x = pose[entry[0] as "leftHip"];
        }
      // The geometry's own local forward is -Z. Compare it to pelvis-local LDU
      // without renderer scene conversion; only Y changes sign about the hip
      // axle (pelvis) at y 28.
      for (const [yaw, pitch] of [-0.7, -0.35, 0, 0.35, 0.7].flatMap((yaw) =>
        [pose.headPitchLimits[0], pose.headPitchLimits[0] / 2, 0].map(
          (pitch) => [yaw, pitch],
        ),
      )) {
        const head = avatar.joint("head");
        head.rotation.y = yaw;
        head.rotation.x = pitch;
        avatar.group.updateMatrixWorld(true);
        avatar.group.traverse((object) => {
          if (!(object instanceof Mesh)) return;
          expect(
            Array.from(object.geometry.getAttribute("position").array),
          ).toEqual(vertices.get(object));
          expect(object.scale.toArray()).toEqual([1, 1, 1]);
          const positions = object.geometry.getAttribute("position");
          for (let index = 0; index < positions.count; index++) {
            const v = new Vector3()
              .fromBufferAttribute(positions, index)
              .applyMatrix4(object.matrixWorld);
            const local = [v.x, 28 - v.y, v.z];
            expect(
              body.envelopes.some((box) =>
                local.every(
                  (value, k) =>
                    Math.abs(value - box.center[k]) <=
                    box.halfExtents[k] + 1e-8,
                ),
              ),
            ).toBe(true);
          }
        });
      }
      expect(JOINTS.leftHip.limits).toEqual(originalHipLimits);
      expect(JOINTS.leftHip.limits[1]).toBe(1.4);
      expect(pose.leftHip).toBe(Math.PI / 2);
      // Exactly five hinge groups on the root (the wrists hang from the
      // shoulders): no invented elbow/knee hierarchy.
      expect(
        avatar.group.children.filter((child) => child instanceof Group),
      ).toHaveLength(5);
      // The seated leg turns about the hip axle at the pelvis (28 LDU) and
      // reaches forward (-Z) by its 28 LDU length.
      const leftHip = avatar.joint("leftHip");
      expect(leftHip.getWorldPosition(new Vector3()).y).toBeCloseTo(28, 10);
      let reach = 0;
      leftHip.traverse((object) => {
        if (!(object instanceof Mesh)) return;
        const p = object.geometry.getAttribute("position");
        for (let i = 0; i < p.count; i++)
          reach = Math.min(
            reach,
            new Vector3()
              .fromBufferAttribute(p, i)
              .applyMatrix4(object.matrixWorld).z,
          );
      });
      expect(reach).toBeCloseTo(-28, 6);
    } finally {
      avatar.dispose();
    }
  },
);
it("transforms authored pelvis, virtual root, eye and body frames through the current chassis pose", () => {
  const chassis = {
    position: [100, -20, 200] as [number, number, number],
    basis: rotationY(-90),
  };
  const anchor = {
    position: [10, -30, 5] as [number, number, number],
    yawDegrees: 90,
  };
  const placed = seatedPlacement(chassis, anchor);
  expect(placed.pelvisFrame.position).toEqual(
    add(chassis.position, mv(chassis.basis, anchor.position)),
  );
  expect(placed.avatarRoot[1] - placed.pelvisFrame.position[1]).toBe(28);
  expect(placed.eye[1] - placed.pelvisFrame.position[1]).toBe(-58);
  expect(placed.eye[1] - placed.avatarRoot[1]).toBe(-86);
  const forward = mv(placed.pelvisFrame.basis, [0, 0, -1]);
  expect(forward[2]).toBeCloseTo(1, 10);
  expect(placed.envelopes[0].halfExtents).toEqual([29, 31.75, 26.25]);
  placed.envelopes[0].halfExtents[0] = 999;
  expect(body.envelopes[0].halfExtents[0]).toBe(29);
  expect(chassis.position).toEqual([100, -20, 200]);
  expect(anchor.position).toEqual([10, -30, 5]);
});
it("rejects tilted/reflected/nonfinite seat frames and protects immutable profile constants", () => {
  const anchor = {
    position: [0, 0, 0] as [number, number, number],
    yawDegrees: 0,
  };
  const tilt = identity();
  tilt.basis = [1, 0, 0, 0, 0, -1, 0, 1, 0];
  expect(() => seatedPlacement(tilt, anchor)).toThrow(/upright/);
  const reflected = identity();
  reflected.basis[0] = -1;
  expect(() => seatedPlacement(reflected, anchor)).toThrow(/proper/);
  expect(() =>
    seatedPlacement(identity(), { ...anchor, yawDegrees: Infinity }),
  ).toThrow(/bounded/);
  expect(() =>
    seatedPlacement(identity(), { ...anchor, position: [1e40, 0, 0] }),
  ).toThrow(/bounded/);
  expect(Object.isFrozen(body.envelopes)).toBe(true);
  expect(Object.isFrozen(body.envelopes[0].center)).toBe(true);
  expect(Object.isFrozen(pose)).toBe(true);
});
