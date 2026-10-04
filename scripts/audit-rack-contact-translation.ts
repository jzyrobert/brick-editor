/**
 * Reproduce translation-sensitive native housing/rack contact without Play hooks.
 * Run: npx tsx scripts/audit-rack-contact-translation.ts
 * This characterizes the pinned engine; it does not accept a rack proxy.
 * The housing is compiled from the unchanged pinned official LDraw closure.
 * The small rack prism is derived from Philippe Hurbain's 18942.dat (CC BY 4.0).
 * Source attribution, hashes and section derivation: docs/reviews/RACK-SOURCE-REVIEW.md.
 */
import { createHash } from "node:crypto";
import RAPIER from "@dimforge/rapier3d-compat";
import { occurrences } from "../src/core/document";
import type { Vec3 } from "../src/core/types";
import { rackFixture } from "../src/mechanisms/rack-fixture";
import { toPhysics } from "../src/play/physics-frame";
import { meshOf } from "../tests/helpers/play-dynamic-source";
import {
  fullLibrarySources,
  registerFullLibraryFromDisk,
} from "./full-library-node";

// Closed section region 1126 of the independently reviewed private candidate.
// Its source-local Z band touches the housing window wall at Z=-10.
const rackPrism: Vec3[] = [
  [122.37024, -5.09821, -10],
  [122.37024, -5.09821, -8],
  [122.48, -5.68015, -10],
  [122.48, -5.68015, -8],
  [130, -6, -10],
  [130, -6, -8],
  [128, -5.60229, -10],
  [128, -5.60229, -8],
];

registerFullLibraryFromDisk();
await RAPIER.init();
const { project } = rackFixture(),
  housing = occurrences(project).find((o) => o.node.ref === "18940.dat")!,
  official = fullLibrarySources([housing.node.ref]),
  mesh = await meshOf(project, [housing.id], official),
  vertices = new Float32Array(mesh.vertices.length);
for (let i = 0; i < mesh.vertices.length; i += 3) {
  const p = toPhysics(
    [0, 1, 2].map(
      (axis) => mesh.vertices[i + axis] - housing.transform.position[axis],
    ) as Vec3,
  );
  vertices.set([p.x, p.y, p.z], i);
}
const points = Float32Array.from(
  rackPrism.flatMap((p) => {
    const v = toPhysics(p);
    return [v.x, v.y, v.z];
  }),
);
const hash = (data: ArrayBufferView) =>
  createHash("sha256")
    .update(Buffer.from(data.buffer, data.byteOffset, data.byteLength))
    .digest("hex");
const geometry = {
  housingVertices: hash(vertices),
  housingIndices: hash(mesh.indices),
  rackPoints: hash(points),
  housingTriangles: mesh.indices.length / 3,
};

for (const shiftYMetres of [0, 3.2]) {
  const world = new RAPIER.World({ x: 0, y: 0, z: 0 }),
    events = new RAPIER.EventQueue(true);
  try {
    world.timestep = 1 / 60;
    const frame = world.createRigidBody(
        RAPIER.RigidBodyDesc.fixed().setTranslation(0, shiftYMetres, 0),
      ),
      moving = world.createRigidBody(
        RAPIER.RigidBodyDesc.dynamic().setTranslation(
          -0.8,
          shiftYMetres + 0.4,
          0,
        ),
      ),
      a = world.createCollider(
        RAPIER.ColliderDesc.trimesh(vertices, mesh.indices.slice())
          .setActiveEvents(RAPIER.ActiveEvents.CONTACT_FORCE_EVENTS)
          .setContactForceEventThreshold(0),
        frame,
      ),
      b = world.createCollider(
        RAPIER.ColliderDesc.convexHull(points)!
          .setMass(1)
          .setActiveEvents(RAPIER.ActiveEvents.CONTACT_FORCE_EVENTS)
          .setContactForceEventThreshold(0),
        moving,
      ),
      joint = world.createImpulseJoint(
        RAPIER.JointData.prismatic(
          { x: -0.8, y: 0.4, z: 0 },
          { x: 0, y: 0, z: 0 },
          { x: 1, y: 0, z: 0 },
        ),
        frame,
        moving,
        true,
      );
    joint.setContactsEnabled(true);
    if (!(joint instanceof RAPIER.PrismaticImpulseJoint))
      throw new Error("Native prismatic joint wrapper unavailable");
    joint.configureMotorVelocity(0.2, 10);
    const initialRelativeY = moving.translation().y - frame.translation().y,
      ticks: unknown[] = [];
    for (let tick = 0; tick < 5; tick++) {
      world.step(events);
      let maxForceN = 0;
      events.drainContactForceEvents((event) => {
        maxForceN = Math.max(maxForceN, event.maxForceMagnitude());
      });
      let deepestDistanceLdu: number | null = null,
        solverContacts = 0,
        contactImpulse = 0;
      world.contactPair(a, b, (manifold) => {
        solverContacts += manifold.numSolverContacts();
        for (let k = 0; k < manifold.numContacts(); k++) {
          const distance = manifold.contactDist(k) / 0.02;
          deepestDistanceLdu =
            deepestDistanceLdu === null
              ? distance
              : Math.min(deepestDistanceLdu, distance);
          contactImpulse += manifold.contactImpulse(k);
        }
      });
      ticks.push({
        tick,
        maxForceN,
        deepestDistanceLdu,
        solverContacts,
        contactImpulse,
        position: moving.translation(),
        velocity: moving.linvel(),
      });
    }
    process.stdout.write(
      JSON.stringify({
        engine: RAPIER.version(),
        shiftYMetres,
        initialRelativeY,
        geometry,
        settings: { gravity: 0, ccd: false, massKg: 1, ticks: 5 },
        ticks,
      }) + "\n",
    );
  } finally {
    events.free();
    world.free();
  }
}
