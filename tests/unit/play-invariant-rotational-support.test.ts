import RAPIER from "@dimforge/rapier3d-compat";
import { beforeAll, expect, it } from "vitest";
import {
  invariantYRotationBounds,
  invariantYRotationEligible,
  invariantYLeafRotationEligible,
  invariantYRotationIntervalBounds,
} from "../../src/play/invariant-rotational-support";
import { MechanicalQueryWorld } from "../../src/play/mechanical-query-world";
import {
  DrivingObstacleSnapshot,
  type DrivingTriangleSource,
} from "../../src/play/vehicle-obstacles";
import type { MechanicalSolid } from "../../src/play/mechanical-solids";
import type { JointSpec, MechanismSnapshot } from "../../src/mechanisms/types";
import type { Transform } from "../../src/core/types";

beforeAll(async () => {
  await RAPIER.init();
});
const frame: Transform = {
  position: [80, -360, 100],
  basis: [1, 0, 0, 0, 1, 0, 0, 0, 1],
};
const points = Float32Array.from([
  -0.8, -0.00000610351571594947, -0.8, 0.8, -0.00000610351571594947, -0.8, -0.8,
  -0.00000610351571594947, 0.8, 0.8, -0.00000610351571594947, 0.8, -0.8, 0.24,
  -0.8, 0.8, 0.24, -0.8, -0.8, 0.24, 0.8, 0.8, 0.24, 0.8,
]);
const solid = (): MechanicalSolid => ({
  groupId: "lamp",
  shape: new RAPIER.ConvexPolyhedron(points),
  points,
  bounds: { min: [-0.8, -0.0000062, -0.8], max: [0.8, 0.24, 0.8] },
  childCount: 1,
  radius: 60,
  mating: new Set(),
});
const restFrames = { tower: frame, lamp: frame };
const joint: JointSpec = {
  id: "turn",
  bodyA: "tower",
  bodyB: "lamp",
  kind: "revolute",
  anchorA: [0, 0, 0],
  anchorB: [0, 0, 0],
  axisA: [0, -1, 0],
  axisB: [0, -1, 0],
};
function snapshots() {
  const before: MechanismSnapshot = {
    sourceRevision: 0,
    rigId: "lamp",
    tick: 0,
    simulationHz: 60,
    mode: "kinematic",
    units: "LDU",
    scaleMetresPerLdu: 0.02,
    transforms: {},
    warnings: [],
    groupFrames: {
      tower: structuredClone(frame),
      lamp: structuredClone(frame),
    },
    pose: { jointPositions: { turn: 0 } },
  };
  const after = structuredClone(before);
  after.groupFrames.lamp.basis = [0, 0, 1, 0, 1, 0, -1, 0, 0];
  after.pose.jointPositions.turn = 90;
  return { before, after };
}
function source(vertices: number[], indices: number[]): DrivingTriangleSource {
  return {
    sourceId: "static",
    units: "metres",
    up: "+Y",
    owner: { kind: "static" },
    vertices: Float32Array.from(vertices),
    indices: Uint32Array.from(indices),
  };
}
const floor = () =>
  source(
    [-10, 7.2, -10, 10, 7.2, -10, 10, 7.2, 10, -10, 7.2, 10],
    [0, 2, 1, 0, 3, 2],
  );

it("encloses native full-turn points including rounded pivot and nonunit rounded yaw", () => {
  const bounds = invariantYRotationBounds(points, frame),
    nativePivot = [Math.fround(1.6), Math.fround(7.2), -2];
  for (let degree = -720; degree <= 720; degree += 7) {
    const s = Math.fround(Math.sin((degree * Math.PI) / 360)),
      c = Math.fround(Math.cos((degree * Math.PI) / 360));
    for (let i = 0; i < points.length; i += 3) {
      const [x, y, z] = points.slice(i, i + 3);
      const p = [
        (1 - 2 * s * s) * x + 2 * s * c * z + nativePivot[0],
        y + nativePivot[1],
        -2 * s * c * x + (1 - 2 * s * s) * z + nativePivot[2],
      ];
      p.forEach((v, k) => {
        expect(v).toBeGreaterThanOrEqual(bounds.query[k]);
        expect(v).toBeLessThanOrEqual(bounds.query[k + 3]);
      });
    }
  }
  expect(bounds.minimum).toBeLessThanOrEqual(nativePivot[1] + points[1]);
  expect(bounds.maximum).toBeGreaterThanOrEqual(nativePivot[1] + points[13]);
});

it("requires the literal one-joint stationary Y path and matching direct native points", () => {
  const { before, after } = snapshots(),
    s = solid();
  expect(
    invariantYRotationEligible(s, [joint], before, after, restFrames),
  ).toBe(true);
  const scaled = structuredClone(restFrames);
  scaled.lamp.basis = [0, 0, 1.0000002, 0, 1, 0, -1.0000002, 0, 0];
  expect(invariantYRotationEligible(s, [joint], before, after, scaled)).toBe(
    false,
  );
  const eccentric = structuredClone(restFrames);
  eccentric.lamp = structuredClone(eccentric.lamp);
  eccentric.lamp.position[0] += 0.000001;
  expect(invariantYRotationEligible(s, [joint], before, after, eccentric)).toBe(
    false,
  );
  const moved = structuredClone(after);
  moved.groupFrames.tower.position[0]++;
  expect(
    invariantYRotationEligible(s, [joint], before, moved, restFrames),
  ).toBe(false);
  const shifted = structuredClone(after);
  shifted.groupFrames.lamp.position[1]++;
  expect(
    invariantYRotationEligible(s, [joint], before, shifted, restFrames),
  ).toBe(false);
  expect(
    invariantYRotationEligible(
      s,
      [{ ...joint, axisB: [1, 0, 0] }],
      before,
      after,
      restFrames,
    ),
  ).toBe(false);
  expect(
    invariantYRotationEligible(
      s,
      [
        {
          ...joint,
          axisA: [0, Math.SQRT1_2, Math.SQRT1_2],
          axisB: [0, Math.SQRT1_2, Math.SQRT1_2],
        },
      ],
      before,
      after,
      restFrames,
    ),
  ).toBe(false);
  expect(
    invariantYRotationEligible(
      s,
      [joint, { ...joint, id: "other" }],
      before,
      after,
      restFrames,
    ),
  ).toBe(false);
  expect(
    invariantYRotationEligible(
      { ...s, shape: new RAPIER.Cuboid(0.8, 0.12, 0.8) },
      [joint],
      before,
      after,
      restFrames,
    ),
  ).toBe(false);
  expect(
    invariantYRotationEligible(
      { ...s, points: Float32Array.from(points, (v) => v + 0.01) },
      [joint],
      before,
      after,
      restFrames,
    ),
  ).toBe(false);
});

it("certifies every candidate floor triangle but retains walls inside the whole sweep and work refusal", () => {
  const bounds = invariantYRotationBounds(points, frame),
    f = floor();
  const check = (mesh: DrivingTriangleSource, limit = 200000) =>
    new DrivingObstacleSnapshot([mesh]).certifyInvariantYSlab(
      bounds.query,
      bounds.minimum,
      bounds.maximum,
      bounds.guard,
      limit,
    );
  expect(check(f)).toMatchObject({ safe: true, candidates: 2 });
  const wall = source(
    [1.6, 7.1, -2.8, 1.6, 7.5, -2.8, 1.6, 7.5, -2.7],
    [0, 1, 2],
  );
  expect(check(wall)).toMatchObject({ safe: false, candidates: 1 });
  // One vertex crossing the invariant slab is enough to prevent exemption.
  expect(
    check(source([-10, 7.2, -10, 10, 7.2, -10, 0, 7.3, 0], [0, 1, 2])).safe,
  ).toBe(false);
  expect(() => check(f, 1)).toThrow(/work budget/);
  const snapshot = new DrivingObstacleSnapshot([wall]);
  wall.vertices.fill(999);
  expect(
    snapshot.certifyInvariantYSlab(
      bounds.query,
      bounds.minimum,
      bounds.maximum,
      bounds.guard,
      100,
    ).safe,
  ).toBe(false);
});

it("binds the complete source to one actual immutable collider, preserving foreign and changed-shape fallback", () => {
  const world = new RAPIER.World({ x: 0, y: 0, z: 0 }),
    queries = new MechanicalQueryWorld(),
    mesh = floor();
  try {
    const collider = world.createCollider(
        RAPIER.ColliderDesc.trimesh(mesh.vertices, mesh.indices),
      ),
      foreign = world.createCollider(
        RAPIER.ColliderDesc.trimesh(mesh.vertices, mesh.indices),
      ),
      b = invariantYRotationBounds(points, frame);
    queries.registerStaticSupport(collider, mesh);
    expect(
      queries.certifyStaticYSupport(
        collider,
        b.query,
        b.minimum,
        b.maximum,
        b.guard,
        100,
      )?.safe,
    ).toBe(true);
    expect(queries.hasStaticSupport(foreign)).toBe(false);
    collider.setTranslation({ x: 1, y: 0, z: 0 });
    expect(queries.hasStaticSupport(collider)).toBe(false);
    collider.setTranslation({ x: 0, y: 0, z: 0 });
    collider.setRotation({ x: 0, y: 1, z: 0, w: 0 });
    expect(queries.hasStaticSupport(collider)).toBe(false);
    collider.setRotation({ x: 0, y: 0, z: 0, w: 1 });
    collider.setShape(new RAPIER.Cuboid(1, 1, 1));
    expect(queries.hasStaticSupport(collider)).toBe(false);
    world.removeCollider(collider, true);
    expect(queries.hasStaticSupport(collider)).toBe(false);
  } finally {
    queries.dispose();
    world.free();
  }
});

it("certifies an independent anchored leaf with exact joint pivots and refuses incoming or descendant joints", () => {
  const { before, after } = snapshots(),
    s = solid(),
    axial = {
      ...joint,
      anchorA: [0, 70, 0] as [number, number, number],
      anchorB: [0, 70, 0] as [number, number, number],
    },
    joints = [axial, { ...axial, id: "other", bodyB: "otherLeaf" }];
  expect(invariantYRotationEligible(s, joints, before, after, restFrames)).toBe(
    false,
  );
  expect(
    invariantYLeafRotationEligible(s, joints, before, after, restFrames),
  ).toBe(true);
  const offsetRest = {
      tower: {
        ...structuredClone(frame),
        position: [0, -152, -770] as [number, number, number],
      },
      lamp: {
        ...structuredClone(frame),
        position: [-32, -152, -765] as [number, number, number],
      },
    },
    offsetBefore = structuredClone(before),
    offsetAfter = structuredClone(after),
    offsetJoint = {
      ...axial,
      anchorA: [-32, 70, 5] as [number, number, number],
    };
  offsetBefore.groupFrames = structuredClone(offsetRest);
  offsetAfter.groupFrames.tower = structuredClone(offsetRest.tower);
  offsetAfter.groupFrames.lamp.position = [...offsetRest.lamp.position];
  expect(
    invariantYLeafRotationEligible(
      s,
      [offsetJoint],
      offsetBefore,
      offsetAfter,
      offsetRest,
    ),
  ).toBe(true);
  const wrongPivot = structuredClone(offsetRest);
  wrongPivot.lamp.position[0] += 0.000001;
  expect(
    invariantYLeafRotationEligible(
      s,
      [offsetJoint],
      offsetBefore,
      offsetAfter,
      wrongPivot,
    ),
  ).toBe(false);
  expect(
    invariantYLeafRotationEligible(
      s,
      [...joints, { ...joint, bodyA: "upstream", bodyB: "tower" }],
      before,
      after,
      restFrames,
    ),
  ).toBe(false);
  expect(
    invariantYLeafRotationEligible(
      s,
      [...joints, { ...joint, bodyA: "lamp", bodyB: "descendant" }],
      before,
      after,
      restFrames,
    ),
  ).toBe(false);
  expect(
    invariantYLeafRotationEligible(
      s,
      [{ ...axial, anchorB: [0, 71, 0] }],
      before,
      after,
      restFrames,
    ),
  ).toBe(false);
  expect(
    invariantYLeafRotationEligible(
      s,
      [{ ...axial, anchorB: [1, 70, 0] }],
      before,
      after,
      restFrames,
    ),
  ).toBe(false);
});

it("keeps a remote jamb outside one interval while preserving blockers and full-turn travel", () => {
  const beam = Float32Array.from([
      0.2, 0, -0.01, 1, 0, -0.01, 0.2, 0, 0.01, 1, 0, 0.01, 0.2, 0.2, -0.01, 1,
      0.2, -0.01, 0.2, 0.2, 0.01, 1, 0.2, 0.01,
    ]),
    a: Transform = {
      position: [0, -50, 0],
      basis: [1, 0, 0, 0, 1, 0, 0, 0, 1],
    },
    angle = (10 * Math.PI) / 180,
    b: Transform = {
      ...a,
      basis: [
        Math.cos(angle),
        0,
        Math.sin(angle),
        0,
        1,
        0,
        -Math.sin(angle),
        0,
        Math.cos(angle),
      ],
    },
    interval = invariantYRotationIntervalBounds(beam, a, b, 10),
    full = invariantYRotationBounds(beam, a),
    floorAndJamb = source(
      [
        -10, 1, -10, 10, 1, -10, 10, 1, 10, -10, 1, 10, -0.5, 0.9, 0, -0.5, 1.3,
        0, -0.5, 1.3, 0.01,
      ],
      [0, 2, 1, 0, 3, 2, 4, 5, 6],
    ),
    snapshot = new DrivingObstacleSnapshot([floorAndJamb]),
    check = (box: typeof full) =>
      snapshot.certifyInvariantYSlab(
        box.query,
        box.minimum,
        box.maximum,
        box.guard,
        100,
      );
  expect(check(full)).toMatchObject({ safe: false, candidates: 3 });
  expect(check(interval)).toMatchObject({ safe: true, candidates: 2 });
  const blocker = new DrivingObstacleSnapshot([
    source([0.7, 0.9, 0.07, 0.7, 1.3, 0.07, 0.7, 1.3, 0.08], [0, 1, 2]),
  ]);
  expect(
    blocker.certifyInvariantYSlab(
      interval.query,
      interval.minimum,
      interval.maximum,
      interval.guard,
      100,
    ).safe,
  ).toBe(false);
  for (const delta of [10, -10, 170, 360, 720]) {
    const rad = (delta * Math.PI) / 180,
      end: Transform = {
        ...a,
        basis: [
          Math.cos(rad),
          0,
          Math.sin(rad),
          0,
          1,
          0,
          -Math.sin(rad),
          0,
          Math.cos(rad),
        ],
      },
      box = invariantYRotationIntervalBounds(beam, a, end, delta);
    for (let tick = 0; tick <= 100; tick++) {
      const s = Math.fround(-Math.sin((rad * tick) / 200)),
        c = Math.fround(Math.cos((rad * tick) / 200));
      for (let i = 0; i < beam.length; i += 3) {
        const x = beam[i],
          y = beam[i + 1],
          z = beam[i + 2],
          p = [
            (1 - 2 * s * s) * x + 2 * s * c * z,
            y + 1,
            -2 * s * c * x + (1 - 2 * s * s) * z,
          ];
        p.forEach((v, k) => {
          expect(v).toBeGreaterThanOrEqual(box.query[k]);
          expect(v).toBeLessThanOrEqual(box.query[k + 3]);
        });
      }
    }
  }
  expect(check(invariantYRotationIntervalBounds(beam, a, a, 360)).safe).toBe(
    false,
  );
});
