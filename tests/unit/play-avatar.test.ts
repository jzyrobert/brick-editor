import { describe, expect, it } from "vitest";
import { BoxGeometry, Group, Mesh, Vector3 } from "three";
import { BrickAvatar, JOINTS } from "../../src/play/avatar";
import {
  AVATAR_PARTS,
  FEET_T,
  JOINT_ORDER,
} from "../../src/play/avatar-assembly";
import { PlaySession } from "../../src/play/session";
import {
  CHARACTER_PROFILE,
  type CollisionSnapshot,
  type PlaySnapshotReport,
} from "../../src/play/types";
import { avatarGeometryFromDisk } from "../helpers/avatar-pack";
import { wrapAngle } from "../../src/play/avatar-motion";
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
const worldVertices = (mesh: Mesh) => {
  const p = mesh.geometry.getAttribute("position");
  return Array.from({ length: p.count }, (_, i) =>
    new Vector3().fromBufferAttribute(p, i).applyMatrix4(mesh.matrixWorld),
  );
};
describe("LDraw minifig figure assembly", () => {
  it("is made of the official minifig parts with the standard assembly offsets", () => {
    expect(AVATAR_PARTS.map((p) => p.part)).toEqual([
      "973.dat",
      "3815b.dat",
      "3626cp01.dat",
      "3901.dat",
      "3818.dat",
      "3819.dat",
      "3820.dat",
      "3820.dat",
      "3816c.dat",
      "3817c.dat",
    ]);
    // Torso origin (the neck) at 72 LDU: hips 32 and legs 12 + 28 below it.
    expect(FEET_T).toBe(72);
    expect(JOINTS.head.pivot).toEqual([0, 72, 0]);
    expect(JOINTS.rightHip.pivot).toEqual([0, 28, 0]);
    expect(JOINTS.leftHip.pivot).toEqual([0, 28, 0]);
    // 973c01: arms at (∓15.552, 9, 0) below the neck, rolled about 9.8°.
    expect(JOINTS.rightShoulder.pivot).toEqual([15.552, 63, 0]);
    expect(JOINTS.leftShoulder.pivot).toEqual([-15.552, 63, 0]);
    expect(JOINTS.rightShoulder.restEuler[2]).toBeCloseTo(0.1709, 3);
    expect(JOINTS.leftShoulder.restEuler[2]).toBeCloseTo(-0.1709, 3);
    // 973c01's hands, relative to their arm: 5 out, 18.9 down, 9.9 forward,
    // tilted 45°.
    for (const [side, sign] of [
      ["rightWrist", 1],
      ["leftWrist", -1],
    ] as const) {
      const w = JOINTS[side];
      expect(w.pivot[0]).toBeCloseTo(4.995 * sign, 1);
      expect(w.pivot[1]).toBeCloseTo(-18.891, 1);
      expect(w.pivot[2]).toBeCloseTo(-9.898, 1);
      expect(w.restEuler[0]).toBeCloseTo(-Math.PI / 4, 3);
    }
    // Every joint has a unit axis and ordered limits.
    for (const name of JOINT_ORDER) {
      const j = JOINTS[name];
      expect(Math.hypot(...j.axis)).toBeCloseTo(1, 12);
      expect(j.limits[0]).toBeLessThan(j.limits[1]);
    }
  });
  it("compiles one outward-facing, vertex-coloured mesh per node, face print in front", async () => {
    const geometry = await avatarGeometryFromDisk();
    expect([...geometry.keys()].sort()).toEqual(
      ["body", ...JOINT_ORDER].sort(),
    );
    for (const [node, g] of geometry) {
      const p = g.getAttribute("position");
      expect(g.getAttribute("color").count, node).toBe(p.count);
      // Closed parts wind outward (mirrored 3819 and 3816c included): the
      // area-weighted flux of the face normals away from the centre is positive.
      const centre = g.boundingBox!.getCenter(new Vector3());
      let flux = 0;
      const a = new Vector3(),
        b = new Vector3(),
        c = new Vector3();
      for (let i = 0; i < p.count; i += 3) {
        a.fromBufferAttribute(p, i);
        b.fromBufferAttribute(p, i + 1);
        c.fromBufferAttribute(p, i + 2);
        const n = b.clone().sub(a).cross(c.clone().sub(a));
        flux += a.add(b).add(c).divideScalar(3).sub(centre).dot(n);
      }
      expect(flux, node).toBeGreaterThan(0);
    }
    // The printed grin (black) is on the front of the head (−Z).
    const head = geometry.get("head")!;
    const colour = head.getAttribute("color"),
      position = head.getAttribute("position");
    const black: number[] = [];
    for (let i = 0; i < colour.count; i++)
      if (colour.getX(i) + colour.getY(i) + colour.getZ(i) < 0.1)
        black.push(position.getZ(i));
    expect(black.length).toBeGreaterThan(20);
    expect(Math.max(...black)).toBeLessThan(-8);
  });
  it("rotates rigid limbs about declared pivots, preserves the fixed torso and vertices, and hides every figure mesh in first person", async () => {
    const play = await session(),
      avatar = new BrickAvatar(await avatarGeometryFromDisk());
    try {
      play.stepTicks(3);
      const rest = play.snapshot();
      avatar.update(rest);
      avatar.group.updateMatrixWorld(true);
      const joints = avatar.group.children.filter(
        (o): o is Group => o instanceof Group,
      );
      // Neck, two shoulders and two hips on the root; the wrists hang from
      // the shoulders. No elbow or knee groups.
      expect(joints.map((g) => g.name).sort()).toEqual(
        ["head", "leftHip", "leftShoulder", "rightHip", "rightShoulder"].sort(),
      );
      expect(avatar.joint("leftWrist").parent).toBe(
        avatar.joint("leftShoulder"),
      );
      expect(avatar.joint("rightWrist").parent).toBe(
        avatar.joint("rightShoulder"),
      );
      const fixed = avatar.group.children.filter(
        (o): o is Mesh => o instanceof Mesh,
      );
      expect(fixed).toHaveLength(1); // rigid torso and hips, one mesh.
      const matrices = fixed.map((mesh) => mesh.matrix.clone());
      const meshes: Mesh[] = [];
      avatar.group.traverse((o) => {
        if (o instanceof Mesh) meshes.push(o);
      });
      // Cheap on phones: eight draw calls sharing one material, a few
      // thousand triangles.
      expect(meshes).toHaveLength(8);
      expect(new Set(meshes.map((m) => m.material)).size).toBe(1);
      expect(
        meshes.reduce(
          (sum, m) => sum + m.geometry.getAttribute("position").count / 3,
          0,
        ),
      ).toBeLessThan(6000);
      const vertices = meshes.map((mesh) =>
        Array.from(mesh.geometry.getAttribute("position").array),
      );
      // An arm vertex, before and after the shoulder turns.
      const shoulder = avatar.joint("leftShoulder");
      expect(shoulder.position.toArray()).toEqual([
        ...JOINTS.leftShoulder.pivot,
      ]);
      const arm = shoulder.children.find((o) => o instanceof Mesh) as Mesh;
      const tip = () => worldVertices(arm)[0];
      const tipBefore = tip();
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
          leftWrist: 0.4,
          rightWrist: -0.4,
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
      for (const name of JOINT_ORDER) {
        const definition = JOINTS[name],
          joint = avatar.joint(name);
        expect(joint.position.toArray()).toEqual([...definition.pivot]);
        if (name === "head") {
          expect(joint.rotation.y).toBe(0.3);
          expect(joint.rotation.x).toBe(0.2);
        } else if (name.endsWith("Wrist")) {
          // Rest tilt about X, the pose turns the hand about its grip axis.
          expect(joint.rotation.x).toBe(definition.restEuler[0]);
          expect(joint.rotation.z).toBe(pose.avatar[name]);
        } else {
          // Rest roll about Z (shoulders), the pose swings about X.
          expect(joint.rotation.z).toBe(definition.restEuler[2]);
          expect(joint.rotation.y).toBe(0);
          expect(joint.rotation.x).toBe(pose.avatar[name]);
        }
      }
      // Rigid rotation about the declared pivot: the arm moves but keeps its
      // distance from the shoulder pivot.
      const tipAfter = tip(),
        pivot = shoulder.getWorldPosition(new Vector3());
      expect(tipAfter.distanceTo(tipBefore)).toBeGreaterThan(1);
      expect(tipAfter.distanceTo(pivot)).toBeCloseTo(
        tipBefore.distanceTo(pivot),
        8,
      );
      // Feet anchor: the soles sit at the collider's feet position, and the
      // hair top is just under the collider's height.
      let lowest = Infinity,
        highest = -Infinity;
      avatar.update(rest);
      avatar.group.updateMatrixWorld(true);
      for (const mesh of meshes)
        for (const v of worldVertices(mesh)) {
          lowest = Math.min(lowest, v.y);
          highest = Math.max(highest, v.y);
        }
      expect(lowest).toBeCloseTo(-rest.position[1], 6);
      expect(highest - lowest).toBeLessThanOrEqual(CHARACTER_PROFILE.height);
      expect(highest - lowest).toBeGreaterThan(CHARACTER_PROFILE.height - 2);
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
      // Pressing into the wall at the minifig run speed creeps by contact
      // corrections of a few thousandths of an LDU, no more.
      expect(Math.abs(still.position[2] - blocked.position[2])).toBeLessThan(
        0.005,
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
  it("first person: backward travel keeps facing the look direction (Minecraft policy)", async () => {
    const play = await session();
    try {
      play.setCameraMode("first-person");
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
    } finally {
      play.dispose();
    }
  });
  it("third person: walking towards the camera turns the figure round to face it; camera switching preserves the player pose", async () => {
    const play = await session();
    try {
      play.stepTicks(3);
      play.setInput({ moveZ: -1, pitch: 0.3 });
      play.stepTicks(40);
      const moved = play.snapshot();
      expect(moved.position[2]).toBeGreaterThan(50);
      // Look yaw 0 (camera behind, looking along −Z); travel is +Z.
      expect(moved.yaw).toBe(0);
      expect(Math.abs(wrapAngle(moved.avatar.heading - Math.PI))).toBeLessThan(
        1e-3,
      );
      // The camera sees the face: the head is straight, not twisted round.
      expect(moved.avatar.headYaw).toBeCloseTo(0, 6);
      expect(moved.avatar.headPitch).toBeCloseTo(0, 6);
      play.setCameraMode("first-person");
      const first = play.snapshot();
      play.setCameraMode("third-person");
      const third = play.snapshot();
      for (const report of [first, third]) {
        expect(report.position).toEqual(moved.position);
        expect(report.velocity).toEqual(moved.velocity);
        expect(report.avatar.heading).toBe(moved.avatar.heading);
        expect(report.avatar.leftHip).toBe(moved.avatar.leftHip);
      }
      expect(third.avatar).toEqual(moved.avatar);
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
