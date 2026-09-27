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
      expect(fixed).toHaveLength(2); // rigid torso and pelvis.
      const matrices = fixed.map((mesh) => mesh.matrix.clone());
      const meshes: Mesh[] = [];
      avatar.group.traverse((o) => {
        if (o instanceof Mesh) meshes.push(o);
      });
      const vertices = meshes.map((mesh) =>
        Array.from(mesh.geometry.getAttribute("position").array),
      );
      const shoulder = joints.find((g) =>
        g.position.equals(new Vector3(-15, 51, 0)),
      )!;
      const centreBefore = shoulder.children[0].getWorldPosition(new Vector3());
      const pose: PlaySnapshotReport = {
        ...rest,
        pitch: 1.2,
        avatar: {
          ...rest.avatar,
          headYaw: 0.3,
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
        const joint = joints.find((g) =>
          g.position.equals(new Vector3(...definition.pivot)),
        )!;
        expect(joint).toBeDefined();
        expect(joint.rotation.z).toBe(0);
        if (name === "head") {
          expect(joint.rotation.x).toBe(0);
          expect(joint.rotation.y).toBe(0.3);
        } else {
          expect(joint.rotation.y).toBe(0);
          expect(joint.rotation.x).toBe(pose.avatar[name as "leftHip"]);
        }
      }
      const centreAfter = shoulder.children[0].getWorldPosition(new Vector3()),
        pivot = shoulder.getWorldPosition(new Vector3());
      expect(centreAfter.distanceTo(centreBefore)).toBeGreaterThan(1);
      expect(centreAfter.distanceTo(pivot)).toBeCloseTo(11, 10);
      expect(avatar.group.position.toArray()).toEqual([
        pose.position[0],
        -pose.position[1],
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
      expect(moving.avatar.leftShoulder).toBeCloseTo(
        -moving.avatar.leftHip,
        10,
      );
      expect(moving.avatar.rightShoulder).toBeCloseTo(
        -moving.avatar.rightHip,
        10,
      );
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
      for (const value of [
        still.avatar.leftHip,
        still.avatar.rightHip,
        still.avatar.leftShoulder,
        still.avatar.rightShoulder,
      ])
        expect(Math.abs(value)).toBeLessThan(0.01); // <0.25 LDU at a 25-LDU limb tip.
    } finally {
      play.dispose();
    }
  });
  it("backward travel turns the rigid root toward actual movement and camera switching preserves the player pose", async () => {
    const play = await session();
    try {
      play.stepTicks(3);
      play.setInput({ moveZ: -1, pitch: 1.2 });
      play.stepTicks(12);
      const moved = play.snapshot();
      expect(moved.position[2]).toBeGreaterThan(15);
      expect(Math.abs(moved.avatar.heading)).toBeCloseTo(Math.PI, 8);
      expect(moved.avatar.phase).toBeGreaterThan(0);
      expect(Math.abs(moved.avatar.headYaw)).toBeLessThanOrEqual(0.7);
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
