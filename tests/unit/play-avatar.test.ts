import { describe, expect, it } from "vitest";
import { BoxGeometry, Group, Mesh, Vector3 } from "three";
import { BrickAvatar, JOINTS } from "../../src/play/avatar";
import { PlaySession } from "../../src/play/session";
import type {
  CollisionSnapshot,
  PlaySnapshotReport,
} from "../../src/play/types";
const empty: CollisionSnapshot = {
  revision: 1,
  vertices: new Float32Array(),
  indices: new Uint32Array(),
  bounds: { min: [-100, 0, -100], max: [100, 0, 100] },
};
async function session(world = empty) {
  return PlaySession.create(world, {
    position: [0, -0.3, 0],
    cameraMode: "third-person",
  });
}
function wall() {
  const geometry = new BoxGeometry(200, 120, 2).toNonIndexed();
  geometry.translate(0, -60, -40);
  const vertices = new Float32Array(geometry.getAttribute("position").array);
  const indices = Uint32Array.from(
    { length: vertices.length / 3 },
    (_, i) => i,
  );
  geometry.dispose();
  return { ...empty, vertices, indices };
}
describe("PL04/05 actual rigid avatar and corrected-travel animation", () => {
  it("rotates rigid limbs about declared pivots, preserves the fixed torso and vertices, and hides every figure mesh in first person", async () => {
    const play = await session(),
      avatar = new BrickAvatar();
    try {
      play.stepTicks(3);
      const rest = play.snapshot();
      avatar.update(rest);
      avatar.group.updateMatrixWorld(true);
      const joints = avatar.group.children.filter(
        (o): o is Group => o instanceof Group,
      );
      expect(joints).toHaveLength(5); // neck, two shoulders and two hips; no elbow/knee groups.
      expect(
        joints.every((g) => g.children.every((child) => child instanceof Mesh)),
      ).toBe(true);
      const fixed = avatar.group.children.filter(
        (o): o is Mesh => o instanceof Mesh,
      );
      expect(fixed).toHaveLength(2); // rigid torso and hip block (one mesh per colour).
      const matrices = fixed.map((mesh) => mesh.matrix.clone());
      const meshes: Mesh[] = [];
      avatar.group.traverse((o) => {
        if (o instanceof Mesh) meshes.push(o);
      });
      // Small enough for phones: a dozen draw calls, a few thousand triangles.
      expect(meshes.length).toBeLessThanOrEqual(12);
      expect(
        meshes.reduce(
          (sum, m) => sum + m.geometry.getAttribute("position").count / 3,
          0,
        ),
      ).toBeLessThan(6000);
      const vertices = meshes.map((mesh) =>
        Array.from(mesh.geometry.getAttribute("position").array),
      );
      // A hand vertex, before and after the shoulder turns.
      const shoulder = avatar.joint("leftShoulder");
      expect(shoulder.position.toArray()).toEqual([
        ...JOINTS.leftShoulder.pivot,
      ]);
      const tip = (g: Group) => {
        const mesh = g.children[g.children.length - 1] as Mesh;
        const p = mesh.geometry.getAttribute("position");
        return new Vector3()
          .fromBufferAttribute(p, 0)
          .applyMatrix4(mesh.matrixWorld);
      };
      const tipBefore = tip(shoulder);
      const pose: PlaySnapshotReport = {
        ...rest,
        pitch: 1.2,
        avatar: {
          ...rest.avatar,
          headYaw: 0.3,
          headPitch: 0.2,
          leftShoulder: 0.7,
          rightShoulder: -0.7,
          leftHip: -0.5,
          rightHip: 0.5,
        },
      };
      avatar.update(pose);
      avatar.group.updateMatrixWorld(true);
      expect(fixed.map((mesh) => mesh.matrix.toArray())).toEqual(
        matrices.map((matrix) => matrix.toArray()),
      );
      expect(
        meshes.map((mesh) =>
          Array.from(mesh.geometry.getAttribute("position").array),
        ),
      ).toEqual(vertices);
      for (const [name, definition] of Object.entries(JOINTS)) {
        const joint = avatar.joint(name as keyof typeof JOINTS);
        expect(joint.position.toArray()).toEqual([...definition.pivot]);
        expect(joint.rotation.z).toBe(0);
        if (name === "head") {
          expect(joint.rotation.y).toBe(0.3);
          expect(joint.rotation.x).toBe(0.2);
        } else {
          expect(joint.rotation.y).toBe(0);
          expect(joint.rotation.x).toBe(pose.avatar[name as "leftHip"]);
        }
      }
      // Rigid rotation about the declared pivot: the hand moves but keeps its
      // distance from the shoulder pivot.
      const tipAfter = tip(shoulder),
        pivot = shoulder.getWorldPosition(new Vector3());
      expect(tipAfter.distanceTo(tipBefore)).toBeGreaterThan(1);
      expect(tipAfter.distanceTo(pivot)).toBeCloseTo(
        tipBefore.distanceTo(pivot),
        8,
      );
      // Feet anchor: the soles sit at the collider's feet position.
      let lowest = Infinity;
      avatar.update(rest);
      avatar.group.updateMatrixWorld(true);
      for (const mesh of meshes) {
        const p = mesh.geometry.getAttribute("position");
        for (let i = 0; i < p.count; i++)
          lowest = Math.min(
            lowest,
            new Vector3()
              .fromBufferAttribute(p, i)
              .applyMatrix4(mesh.matrixWorld).y,
          );
      }
      expect(lowest).toBeCloseTo(-rest.position[1], 6);
      avatar.update(pose);
      expect(avatar.group.position.toArray()).toEqual([
        pose.position[0],
        -pose.position[1] + pose.avatar.bob,
        -pose.position[2],
      ]);
      avatar.update({
        ...pose,
        cameraMode: "first-person",
        avatarVisible: false,
      });
      const visible: Mesh[] = [];
      avatar.group.traverseVisible((o) => {
        if (o instanceof Mesh) visible.push(o);
      });
      expect(visible).toHaveLength(0);
      expect(meshes.every((mesh) => !mesh.castShadow)).toBe(true);
    } finally {
      avatar.dispose();
      play.dispose();
    }
  });
  it("gait advances by corrected distance and decays to neutral against a wall despite held run input", async () => {
    const play = await session(wall());
    try {
      play.stepTicks(3);
      const start = play.snapshot();
      play.setInput({ moveZ: 1, run: true });
      play.stepTicks(6);
      const moving = play.snapshot(),
        distance = Math.hypot(
          moving.position[0] - start.position[0],
          moving.position[2] - start.position[2],
        );
      expect(moving.avatar.state).toBe("run");
      expect(moving.avatar.phase).toBeCloseTo(
        (2 * Math.PI * distance) / moving.profile.strideLength,
        8,
      );
      expect(moving.avatar.leftHip).toBeCloseTo(-moving.avatar.rightHip, 10);
      // Arms swing opposite their legs at 1/1.4 of the leg amplitude (plus a
      // small idle sway that moves the arms in opposite directions).
      expect(
        moving.avatar.leftShoulder + moving.avatar.rightShoulder,
      ).toBeCloseTo(0, 10);
      expect(
        Math.abs(moving.avatar.leftShoulder + moving.avatar.leftHip / 1.4),
      ).toBeLessThanOrEqual(0.05 + 1e-9);
      play.stepTicks(120);
      const blocked = play.snapshot();
      play.stepTicks(60);
      const still = play.snapshot();
      expect(still.position[2]).toBeGreaterThan(-33);
      expect(Math.abs(still.position[2] - blocked.position[2])).toBeLessThan(
        0.001,
      );
      // Contact corrections can advance the distance-based phase slightly.
      // The visible gait must still settle to neutral while movement stays blocked.
      expect(Math.abs(still.avatar.phase - blocked.avatar.phase)).toBeLessThan(
        0.02,
      );
      expect(still.avatar.state).toBe("idle");
      for (const value of [still.avatar.leftHip, still.avatar.rightHip])
        expect(Math.abs(value)).toBeLessThan(0.01); // <0.25 LDU at a 26-LDU leg tip.
      // Only the subtle idle sway remains on the arms.
      for (const value of [
        still.avatar.leftShoulder,
        still.avatar.rightShoulder,
      ])
        expect(Math.abs(value)).toBeLessThan(0.06);
    } finally {
      play.dispose();
    }
  });
  it("backward travel keeps facing the look direction (Minecraft policy) and camera switching preserves the player pose", async () => {
    const play = await session();
    try {
      play.stepTicks(3);
      play.setInput({ moveZ: -1, pitch: 1.2 });
      play.stepTicks(12);
      const moved = play.snapshot();
      expect(moved.position[2]).toBeGreaterThan(15);
      expect(Math.abs(moved.avatar.heading)).toBeLessThan(1e-6);
      expect(moved.avatar.phase).toBeGreaterThan(0);
      expect(moved.avatar.swing).toBeGreaterThan(0.2);
      expect(Math.abs(moved.avatar.headYaw)).toBeLessThanOrEqual(0.873);
      // The head pitches with the view, within its declared neck limit.
      expect(moved.avatar.headPitch).toBeCloseTo(0.45, 10);
      play.setCameraMode("first-person");
      const first = play.snapshot();
      play.setCameraMode("third-person");
      const third = play.snapshot();
      for (const report of [first, third]) {
        expect(report.position).toEqual(moved.position);
        expect(report.velocity).toEqual(moved.velocity);
        expect(report.avatar).toEqual(moved.avatar);
      }
    } finally {
      play.dispose();
    }
  });
  it("uses bounded jump/fall presentation and returns to idle without repeated held-key jumps", async () => {
    const play = await session();
    try {
      play.stepTicks(3);
      play.setInput({ jump: true });
      play.stepTicks(6);
      const rising = play.snapshot();
      expect(rising.avatar.state).toBe("jump");
      play.stepTicks(25);
      const falling = play.snapshot();
      expect(falling.avatar.state).toBe("fall");
      for (const report of [rising, falling]) {
        expect(report.grounded).toBe(false);
        expect(Math.abs(report.avatar.leftHip)).toBeLessThanOrEqual(0.9);
        expect(Math.abs(report.avatar.rightHip)).toBeLessThanOrEqual(0.9);
        expect(Math.abs(report.avatar.leftShoulder)).toBeLessThanOrEqual(1.1);
        expect(Math.abs(report.avatar.rightShoulder)).toBeLessThanOrEqual(1.1);
      }
      play.stepTicks(60);
      const landed = play.snapshot();
      expect(landed.grounded).toBe(true);
      expect(landed.avatar.state).toBe("idle");
    } finally {
      play.dispose();
    }
  });
});
