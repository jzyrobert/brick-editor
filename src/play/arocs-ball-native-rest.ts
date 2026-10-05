import RAPIER from "@dimforge/rapier3d-compat";
import { ensure } from "../core/types";
import { frameRotation, toPhysics } from "./physics-frame";
import {
  readPreparedArocsBallRest,
  type PreparedArocsBallRest,
} from "./arocs-ball-rest";
import {
  compileArocsBallRestCovers,
  readArocsBallNativeCover,
} from "./arocs-ball-native-covers";
import {
  attachArocsBallNativeRest,
  createArocsBallRestJoint,
} from "./arocs-ball-native-bridge";

/** Standalone construction bench; ordinary runtime integration attaches the
 * same state controller to already-owned native bodies instead. */
export function createArocsBallNativeRest(
  prepared: PreparedArocsBallRest,
  world: RAPIER.World,
  options: { ballAnchored?: boolean; socketAnchored?: boolean } = {},
) {
  readPreparedArocsBallRest(prepared);
  ensure(
    !(options.ballAnchored && options.socketAnchored),
    "INVALID_INPUT",
    "A native seating assembly needs a body that can settle.",
  );
  ensure(
    Math.abs(world.timestep - 1 / 60) < 1e-9,
    "INVALID_INPUT",
    "Native ball seating requires the bounded Play fixed step.",
  );
  const covers = compileArocsBallRestCovers(prepared, "member"),
    bodies: RAPIER.RigidBody[] = [];
  try {
    for (const member of ["ball", "socket"] as const) {
      const cover = covers.find(
          (c) => readArocsBallNativeCover(prepared, c).member === member,
        )!,
        details = readArocsBallNativeCover(prepared, cover),
        anchored =
          member === "ball" ? options.ballAnchored : options.socketAnchored,
        desc = anchored
          ? RAPIER.RigidBodyDesc.fixed()
          : RAPIER.RigidBodyDesc.dynamic()
              .setLinearDamping(0.05)
              .setAngularDamping(0.1)
              .setAdditionalSolverIterations(8)
              .setCcdEnabled(true),
        p = toPhysics(details.bodyRest.position);
      bodies.push(
        world.createRigidBody(
          desc
            .setTranslation(p.x, p.y, p.z)
            .setRotation(frameRotation(details.bodyRest)),
        ),
      );
    }
    const entries = covers.map((cover) => {
      const details = readArocsBallNativeCover(prepared, cover),
        body = details.member === "ball" ? bodies[0] : bodies[1],
        collider = world.createCollider(
          new RAPIER.ColliderDesc(cover.shape)
            .setDensity(1000)
            .setFriction(0.7)
            .setActiveHooks(RAPIER.ActiveHooks.FILTER_CONTACT_PAIRS),
          body,
        );
      return { cover, collider };
    });
    for (const body of bodies) body.recomputeMassPropertiesFromColliders();
    const attachment = { ball: bodies[0], socket: bodies[1], covers: entries },
      joint = createArocsBallRestJoint(prepared, world, attachment),
      controller = attachArocsBallNativeRest(
        prepared,
        world,
        attachment,
        joint,
      );
    let disposed = false;
    return {
      ...controller,
      bodies: Object.freeze(bodies),
      colliderHandles: Object.freeze(entries.map((e) => e.collider.handle)),
      joint,
      dispose() {
        if (disposed) return;
        disposed = true;
        controller.dispose();
        for (const body of bodies) world.removeRigidBody(body);
      },
    };
  } catch (error) {
    for (const body of bodies) world.removeRigidBody(body);
    throw error;
  }
}
