/**
 * Read-only probes for docs/PLAY-MOTION-ROADMAP.md (3 October 2026).
 * Run from the repo root: npx tsx scripts/audit-play-motion.ts
 * These report repaired contracts and remaining limitations at this checkpoint.
 * Uses committed CC0 fixture geometry and the pinned official pack; no network.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import RAPIER from "@dimforge/rapier3d-compat";
import { fullLibraryDir, fullLibrarySources } from "./full-library-node";
import { registeredFullLibrary } from "../src/catalog/full-library";
import { fullConnectorManifest } from "../src/catalog/full-connectors";
import { connectorStatus, verifiedConnectors } from "../src/catalog/connectors";
import { doorGeometry } from "../src/play/door-derive";
import { doorRoomSource } from "../src/catalog/door-room";
import { occurrences } from "../src/core/document";
import { importLDraw } from "../src/ldraw/io";
import { deriveDoorRigs } from "../src/play/auto-doors";
import { physicsFixture } from "../src/mechanisms/fixtures";
import { KinematicSession, validateRig } from "../src/mechanisms/kinematic";
import { DynamicRig, proxyPoints } from "../src/play/dynamics";
import { PlayMechanism } from "../src/play/mechanism";
import { METRES_PER_LDU as S, toPhysics } from "../src/play/physics-frame";
import type { CollisionSnapshot } from "../src/play/types";
import type { FullPackCatalogEntry } from "../src/catalog/full-pack";
import { playSources } from "../tests/helpers/play-dynamic-source";

const refs = [
  "3700.dat", // round bearing hole
  "3673.dat", // pin
  "2780.dat", // friction pin
  "3705.dat", // axle
  "3713.dat", // bush
  "3648b.dat", // 24-tooth gear
  "3743.dat", // rack
  "4716.dat", // worm
  "3712c01.dat", // universal joint assembly
  "30365.dat", // locking finger hinge
  "3315.dat", // finger hinge
  "3597.dat", // complementary finger hinge
  "4085c.dat", // clip plate
  "4623.dat", // bar plate
  "3001.dat", // ordinary brick control
];
const library = fullLibrarySources(refs);
const catalog = JSON.parse(
  readFileSync(
    fullLibraryDir() + registeredFullLibrary()!.manifest.catalog.path,
    "utf8",
  ),
) as FullPackCatalogEntry[];
const coverage = fullConnectorManifest()!.coverage;
const facts = {
  releaseId: registeredFullLibrary()!.manifest.releaseId,
  categories: Object.fromEntries(
    ["Technic", "Hinge", "Train"].map((category) => [
      category,
      {
        parts: catalog.filter(([, , c]) => c === category).length,
        connectorCoverage: coverage.byCategory[category],
      },
    ]),
  ),
  parts: Object.fromEntries(
    refs.map((ref) => [
      ref,
      {
        title: library[ref]?.split(/\r?\n/)[0].slice(2),
        ...connectorStatus(ref),
        connectorKinds: [
          ...new Set(verifiedConnectors(ref)?.map((c) => c.kind)),
        ],
      },
    ]),
  ),
};

// Mount-forest cycles stay rejected; authored loopClosures are a separate graph.
const cycleProject = physicsFixture();
const cycleRig = cycleProject.motionRigs.door;
const hinge = cycleRig.joints[0];
cycleRig.joints.push({
  id: "closure",
  kind: "fixed",
  bodyA: hinge.bodyB,
  bodyB: hinge.bodyA,
  anchorA: hinge.anchorB,
  anchorB: hinge.anchorA,
});
let cycleError = "";
try {
  validateRig(cycleProject, cycleRig);
} catch (error) {
  cycleError = (error as Error).message;
}
assert.match(cycleError, /cycle/i);

// The kinematic spherical joint accepts no orientation controls.
const ballProject = physicsFixture();
const ball = ballProject.motionRigs.door.joints[0];
ball.kind = "spherical";
delete ball.mating;
delete ball.axisA;
delete ball.axisB;
delete ball.limits;
const ballSession = new KinematicSession(ballProject, "door");
const ballRest = ballSession.snapshot().transforms;
ballSession.stepTicks(60);
assert.deepEqual(ballSession.snapshot().transforms, ballRest);
assert.throws(() => ballSession.setJointPosition("hinge", 30), /scalar/);

// Auto-door ownership is leaf-only; a separate accessory is not recruited.
// This added part does not claim a verified manufactured attachment.
const doorProject = importLDraw(
  doorRoomSource() + "1 0 20 -60 7 1 0 0 0 1 0 0 0 1 3024.dat\n",
  "door-with-extra-part.ldr",
);
const allDoors = occurrences(doorProject);
const derived = deriveDoorRigs(doorProject, {
  all: allDoors,
  reserved: new Set(),
  maxRigs: 32,
  maxGroups: 128,
});
assert.equal(derived.doors.length, 1);
const derivedRig = Object.values(derived.rigs)[0];
assert.equal(derivedRig.groups[1].occurrenceIds.length, 1);
assert(
  !derivedRig.groups.some((g) => g.occurrenceIds.includes(allDoors.at(-1)!.id)),
);

await RAPIER.init();

// A moving 3700 convex proxy fills its real round through-hole.
const points = doorGeometry((ref) => library[ref], "3700.dat").points;
const partMesh: CollisionSnapshot = {
  revision: 0,
  vertices: Float32Array.from(points.flat()),
  indices: new Uint32Array(),
  bounds: { min: [-20, -4, -10], max: [20, 24, 10] },
};
const hullWorld = new RAPIER.World({ x: 0, y: 0, z: 0 });
let hullFillsHole: boolean;
try {
  const hull = RAPIER.ColliderDesc.convexHull(proxyPoints(partMesh, [0, 0, 0]));
  assert(hull);
  hullFillsHole = hullWorld
    .createCollider(hull)
    .containsPoint(toPhysics([0, 10, 0]));
  assert(hullFillsHole);
} finally {
  hullWorld.free();
}

const project = physicsFixture();
delete project.motionRigs.door.joints[0].limits;
const { sources } = await playSources(project, ["door"]);
const source = sources[0];

// General joint motion now refuses the complete move across static geometry.
const walkingWorld = new RAPIER.World({ x: 0, y: 0, z: 0 });
let kinematicOverlap: boolean;
try {
  const obstacle = walkingWorld.createCollider(
    RAPIER.ColliderDesc.cuboid(4 * S, 40 * S, 4 * S).setTranslation(
      0,
      60 * S,
      20 * S,
    ),
  );
  const mechanism = new PlayMechanism(walkingWorld, source, () => ({
    walk: true,
    position: [300, -0.3, 300],
  }));
  try {
    const moved = mechanism.setJointPosition("hinge", 90);
    assert.equal(moved.pose.jointPositions.hinge, 0);
    assert.equal(moved.blocked, true);
    let overlap = false;
    walkingWorld.colliders.forEach((collider) => {
      if (collider.handle !== obstacle.handle)
        overlap ||= obstacle.intersectsShape(
          collider.shape,
          collider.translation(),
          collider.rotation(),
        );
    });
    kinematicOverlap = overlap;
    assert.equal(kinematicOverlap, false);
  } finally {
    mechanism.dispose();
  }
} finally {
  walkingWorld.free();
}

// Native contacts keep the door from completing a target through its own frame.
const dynamicWorld = new RAPIER.World({ x: 0, y: 0, z: 0 });
dynamicWorld.timestep = 1 / 60;
const mirrorWorld = new RAPIER.World({ x: 0, y: 0, z: 0 });
let dynamicFrameDistanceLdu = Infinity;
let dynamicAngle: number;
try {
  const rig = new DynamicRig(
    dynamicWorld,
    mirrorWorld,
    source,
    0,
    project.revision,
  );
  try {
    rig.setJointTarget("hinge", 180, 180);
    for (let tick = 0; tick < 240; tick++) {
      rig.beforeStep();
      rig.stepPhysics();
      rig.afterStep();
    }
    dynamicAngle = rig.snapshot().pose.jointPositions.hinge;
    assert(Math.abs(dynamicAngle) < 179);
    assert.equal(rig.snapshot().jointTargets.hinge.status, "blocked");
    const frames: RAPIER.Collider[] = [],
      leaves: RAPIER.Collider[] = [];
    dynamicWorld.colliders.forEach((c) => {
      if (c.parent()?.isFixed()) frames.push(c);
      else leaves.push(c);
    });
    assert(frames.length && leaves.length);
    for (const frame of frames)
      for (const leaf of leaves) {
        if (!rig.contactAllowed(frame.handle, leaf.handle)) continue;
        const contact = frame.contactCollider(leaf, S);
        if (contact)
          dynamicFrameDistanceLdu = Math.min(
            dynamicFrameDistanceLdu,
            contact.distance / S,
          );
        assert.notEqual(
          frame.collisionGroups() & (leaf.collisionGroups() >>> 16),
          0,
        );
      }
    assert(Number.isFinite(dynamicFrameDistanceLdu));
    assert(dynamicFrameDistanceLdu > -0.5);
  } finally {
    rig.dispose();
  }
} finally {
  dynamicWorld.free();
  mirrorWorld.free();
}

// Continuous velocity rotation works elsewhere; a multi-turn position target
// is a different contract. Guard the repaired accumulated-angle controller.
const turnsWorld = new RAPIER.World({ x: 0, y: 0, z: 0 });
turnsWorld.timestep = 1 / 60;
const turnsMirror = new RAPIER.World({ x: 0, y: 0, z: 0 });
// A free rotor has its own clear source geometry: a doorway has a real stop.
const turnsProject = physicsFixture(true);
delete turnsProject.motionRigs.door.joints[0].limits;
const { sources: turnsSources } = await playSources(turnsProject, ["door"]);
let multiTurnCurrent: number;
let multiTurnStatus: string;
try {
  const rig = new DynamicRig(
    turnsWorld,
    turnsMirror,
    turnsSources[0],
    0,
    turnsProject.revision,
  );
  try {
    rig.setJointTarget("hinge", 720, 180);
    for (let tick = 0; tick < 600; tick++) {
      rig.beforeStep();
      rig.stepPhysics();
      rig.afterStep();
    }
    const result = rig.snapshot();
    multiTurnCurrent = result.pose.jointPositions.hinge;
    multiTurnStatus = result.jointTargets.hinge.status;
    assert.equal(multiTurnStatus, "complete");
    assert(Math.abs(multiTurnCurrent - 720) < 1);
  } finally {
    rig.dispose();
  }
} finally {
  turnsWorld.free();
  turnsMirror.free();
}

// These APIs already exist in the pinned engine, outside Brick Editor's schema.
const engineWorld = new RAPIER.World({ x: 0, y: 0, z: 0 });
let sphericalRuntimeType: number;
let sphericalMotorAvailable: boolean;
try {
  const a = engineWorld.createRigidBody(RAPIER.RigidBodyDesc.fixed());
  const b = engineWorld.createRigidBody(RAPIER.RigidBodyDesc.dynamic());
  const zero = { x: 0, y: 0, z: 0 };
  const axis = { x: 1, y: 0, z: 0 };
  const ballJoint = engineWorld.createImpulseJoint(
    RAPIER.JointData.spherical(zero, zero),
    a,
    b,
    true,
  ) as RAPIER.SphericalImpulseJoint;
  sphericalRuntimeType = ballJoint.type();
  sphericalMotorAvailable =
    typeof ballJoint.configureMotorPosition === "function";
  assert.equal(sphericalRuntimeType, RAPIER.JointType.Generic);
  assert.equal(sphericalMotorAvailable, false);
  for (const data of [
    RAPIER.JointData.spring(1, 10, 1, zero, zero),
    RAPIER.JointData.rope(1, zero, zero),
    RAPIER.JointData.generic(
      zero,
      zero,
      axis,
      RAPIER.JointAxesMask.LinY |
        RAPIER.JointAxesMask.LinZ |
        RAPIER.JointAxesMask.AngY |
        RAPIER.JointAxesMask.AngZ,
    ),
    RAPIER.JointData.revolute(zero, zero, axis), // closes a graph already joined
  ])
    assert(engineWorld.createImpulseJoint(data, a, b, true).isValid());
  // Creation confirms API availability only; this redundant graph is not stepped.
} finally {
  engineWorld.free();
}

console.log(
  JSON.stringify(
    {
      ...facts,
      probes: {
        cycleError,
        kinematicSpherical: ballSession.snapshot().warnings,
        autoDoorMovingMembers: derivedRig.groups[1].occurrenceIds.length,
        separateDoorAttachmentRecruited: false,
        hullFillsTechnicHole: hullFillsHole,
        kinematicJointOverlapsStaticObstacle: kinematicOverlap,
        dynamicDoorDegrees: Number(dynamicAngle.toFixed(3)),
        dynamicDoorFrameContactDistanceLdu: Number(
          dynamicFrameDistanceLdu.toFixed(4),
        ),
        multiTurnTarget: {
          target: 720,
          ticks: 600,
          current: Number(multiTurnCurrent.toFixed(3)),
          status: multiTurnStatus,
        },
        sphericalRuntimeType,
        sphericalMotorAvailable,
        pinnedEngineCreation: [
          "spring",
          "rope",
          "cylindrical generic",
          "loop-closing impulse joint",
        ],
      },
    },
    null,
    2,
  ),
);
