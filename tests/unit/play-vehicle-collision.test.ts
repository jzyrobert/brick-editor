import RAPIER from "@dimforge/rapier3d-compat";
import { beforeAll, expect, it } from "vitest";
import {
  sweepDrivingBoxes,
  type DrivingBox,
  type DrivingObstacle,
} from "../../src/play/vehicle-collision";
beforeAll(async () => {
  await RAPIER.init();
});
const pose = { x: 0, y: 0, z: 0, yaw: 0 };
const boxes: DrivingBox[] = [
  { center: [0, 0.3, 0], halfExtents: [0.2, 0.1, 0.4] },
  // Explicit conservative boxes enclosing wheels, tangent at y=0.
  { center: [-0.25, 0.1, 0], halfExtents: [0.05, 0.1, 0.1] },
  { center: [0.25, 0.1, 0], halfExtents: [0.05, 0.1, 0.1] },
];
function obstacle(
  world: RAPIER.World,
  half: [number, number, number],
  at: [number, number, number],
  owner: DrivingObstacle["owner"] = { kind: "static" },
): DrivingObstacle {
  return {
    collider: world.createCollider(
      RAPIER.ColliderDesc.cuboid(...half).setTranslation(...at),
    ),
    owner,
  };
}
it("permits certified tangent wheel support but refuses floor penetration, curb and overhead beam", () => {
  const world = new RAPIER.World({ x: 0, y: 0, z: 0 });
  try {
    const floor = obstacle(world, [10, 0.1, 10], [0, -0.1, 0]);
    expect(
      sweepDrivingBoxes("car", boxes, pose, { ...pose, z: 3 }, [floor])
        .accepted,
    ).toBe(true);
    const sunk = { ...pose, y: -0.001 };
    expect(
      sweepDrivingBoxes("car", boxes, sunk, { ...sunk, z: 3 }, [floor])
        .accepted,
    ).toBe(false);
    const curb = obstacle(world, [1, 0.025, 0.01], [0, 0.025, 1]);
    expect(
      sweepDrivingBoxes("car", boxes, pose, { ...pose, z: 3 }, [floor, curb])
        .accepted,
    ).toBe(false);
    const beam = obstacle(world, [1, 0.02, 0.01], [0, 0.4, 1]);
    expect(
      sweepDrivingBoxes("car", boxes, pose, { ...pose, z: 3 }, [floor, beam])
        .accepted,
    ).toBe(false);
  } finally {
    world.free();
  }
});
it("continuous casts stop high-speed thin-wall crossing and include other rigs while excluding only own colliders", () => {
  const world = new RAPIER.World({ x: 0, y: 0, z: 0 });
  try {
    const wall = obstacle(world, [0.0001, 2, 2], [1, 1, 0]);
    const before = wall.collider.translation();
    expect(
      sweepDrivingBoxes("car", boxes, pose, { ...pose, x: 10 }, [wall])
        .accepted,
    ).toBe(false);
    expect(wall.collider.translation()).toEqual(before);
    const own = { ...wall, owner: { kind: "rig" as const, rigId: "car" } };
    expect(
      sweepDrivingBoxes("car", boxes, pose, { ...pose, x: 10 }, [own]).accepted,
    ).toBe(true);
    expect(
      sweepDrivingBoxes("car", boxes, pose, { ...pose, x: 10 }, [
        { ...own, owner: { kind: "rig", rigId: "other" } },
      ]).accepted,
    ).toBe(false);
  } finally {
    world.free();
  }
});
it("conservative rotation envelope catches a thin obstacle missed by both endpoint poses", () => {
  const world = new RAPIER.World({ x: 0, y: 0, z: 0 });
  try {
    const arm: DrivingBox[] = [
      { center: [0, 0.5, 0], halfExtents: [0.5, 0.1, 0.01] },
    ];
    const wall = obstacle(world, [0.003, 0.2, 0.003], [0.3, 0.5, -0.3]);
    expect(sweepDrivingBoxes("car", arm, pose, pose, [wall]).accepted).toBe(
      true,
    );
    const end = { ...pose, yaw: Math.PI / 2 };
    expect(sweepDrivingBoxes("car", arm, end, end, [wall]).accepted).toBe(true);
    const swept = sweepDrivingBoxes("car", arm, pose, end, [wall]);
    // 90deg may exceed the intentionally bounded per-tick turn envelope.
    expect(swept.accepted).toBe(false);
    const start = { ...pose, yaw: Math.PI / 4 - 0.1 };
    const finish = { ...pose, yaw: Math.PI / 4 + 0.1 };
    expect(sweepDrivingBoxes("car", arm, start, start, [wall]).accepted).toBe(
      true,
    );
    expect(sweepDrivingBoxes("car", arm, finish, finish, [wall]).accepted).toBe(
      true,
    );
    expect(sweepDrivingBoxes("car", arm, start, finish, [wall])).toMatchObject({
      accepted: false,
      reason: "contact",
    });
  } finally {
    world.free();
  }
});
it("refuses excessive sweep work before queries and rejects vertical travel", () => {
  const world = new RAPIER.World({ x: 0, y: 0, z: 0 });
  try {
    const wall = obstacle(world, [0.1, 1, 1], [10, 1, 0]);
    expect(
      sweepDrivingBoxes("car", boxes, pose, { ...pose, yaw: 100 }, [wall]),
    ).toMatchObject({ accepted: false, queries: 0, reason: "work-budget" });
    expect(() =>
      sweepDrivingBoxes("car", boxes, pose, { ...pose, y: 1 }, [wall]),
    ).toThrow(/planar/);
  } finally {
    world.free();
  }
});
it("certifies a flat triangle floor but never ignores a mixed floor-and-wall mesh", () => {
  const world = new RAPIER.World({ x: 0, y: 0, z: 0 });
  try {
    const floorVertices = [-10, 0, -10, 10, 0, -10, 10, 0, 10, -10, 0, 10];
    const floorIndices = [0, 2, 1, 0, 3, 2];
    const floor = {
      collider: world.createCollider(
        RAPIER.ColliderDesc.trimesh(
          new Float32Array(floorVertices),
          new Uint32Array(floorIndices),
        ),
      ),
      owner: { kind: "static" as const },
    };
    expect(
      sweepDrivingBoxes("car", boxes, pose, { ...pose, z: 3 }, [floor])
        .accepted,
    ).toBe(true);
    const mixed = {
      collider: world.createCollider(
        RAPIER.ColliderDesc.trimesh(
          new Float32Array([
            ...floorVertices,
            -1,
            0,
            1,
            1,
            0,
            1,
            1,
            1,
            1,
            -1,
            1,
            1,
          ]),
          new Uint32Array([...floorIndices, 4, 5, 6, 4, 6, 7]),
        ),
      ),
      owner: { kind: "static" as const },
    };
    expect(
      sweepDrivingBoxes("car", boxes, pose, { ...pose, z: 3 }, [mixed]),
    ).toMatchObject({ accepted: false, reason: "contact" });
  } finally {
    world.free();
  }
});
it("rejects overflowing casts, missing pose fields and out-of-domain obstacle bounds before queries", () => {
  const world = new RAPIER.World({ x: 0, y: 0, z: 0 });
  try {
    const wall = obstacle(world, [0.001, 1, 1], [1, 1, 0]);
    for (const x of [1e40, 1e308, NaN, Infinity])
      expect(() =>
        sweepDrivingBoxes("car", boxes, pose, { ...pose, x }, [wall]),
      ).toThrow(/bounded/);
    expect(() =>
      sweepDrivingBoxes(
        "car",
        boxes,
        pose,
        { y: 0, z: 0, yaw: 0 } as typeof pose,
        [wall],
      ),
    ).toThrow(/bounded/);
    wall.collider.setTranslation({ x: 1e40, y: 1, z: 0 });
    expect(() =>
      sweepDrivingBoxes("car", boxes, pose, { ...pose, x: 2 }, [wall]),
    ).toThrow(/domain/);
    // Stress the finite supported boundary with a wall near10km; no f32 overflow.
    wall.collider.setTranslation({ x: 9998, y: 1, z: 0 });
    expect(
      sweepDrivingBoxes(
        "car",
        boxes,
        { ...pose, x: 9997 },
        { ...pose, x: 9999 },
        [wall],
      ).accepted,
    ).toBe(false);
  } finally {
    world.free();
  }
});
