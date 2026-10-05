import RAPIER from "@dimforge/rapier3d-compat";
import { Vector3 } from "three";
import { ensure, type Vec3 } from "../core/types";
import { frameRotation, toPhysics } from "./physics-frame";
import {
  AROCS_BALL_SEATING_LIMITS as LIMITS,
  readPreparedArocsBallRest,
  type PreparedArocsBallRest,
} from "./arocs-ball-rest";

/** Native-only seating witness. It never rewrites source placements, grants
 * ordinary Play eligibility, or enables user controls before stable seating. */
export function createArocsBallNativeRest(
  prepared: PreparedArocsBallRest,
  world: RAPIER.World,
  options: { ballAnchored?: boolean; socketAnchored?: boolean } = {},
) {
  const seal = readPreparedArocsBallRest(prepared);
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
  const bodies: RAPIER.RigidBody[] = [],
    colliderRoles = new Map<number, { role: string; endpoint?: number }>();
  // Compile every child before mutating the native world.
  const covers = [seal.ball, seal.socket].map((m) =>
    m.packet.classes.map((c) => {
      const shapes: RAPIER.Shape[] = [],
        positions: RAPIER.Vector[] = [];
      for (const raw of c.pieces) {
        const piece = raw as unknown as Vec3[],
          center = [0, 1, 2].map(
            (k) => piece.reduce((s, p) => s + p[k], 0) / piece.length,
          ) as Vec3,
          desc = RAPIER.ColliderDesc.convexHull(
            Float32Array.from(
              piece.flatMap((p) => {
                const v = toPhysics(p.map((n, k) => n - center[k]) as Vec3);
                return [v.x, v.y, v.z];
              }),
            ),
          );
        ensure(
          desc,
          "INVALID_INPUT",
          "A source ball seating cover could not be checked safely.",
        );
        shapes.push(desc.shape);
        positions.push(toPhysics(center));
      }
      return {
        role: c.id,
        endpoint: "endpoint" in c ? c.endpoint : undefined,
        shape: new RAPIER.Compound(
          shapes,
          positions,
          shapes.map(() => ({ x: 0, y: 0, z: 0, w: 1 })),
        ),
      };
    }),
  );
  const colliders: RAPIER.Collider[] = [];
  let joint: RAPIER.ImpulseJoint | undefined;
  try {
    for (const [i, m] of [seal.ball, seal.socket].entries()) {
      const anchored = i === 0 ? options.ballAnchored : options.socketAnchored,
        d = anchored
          ? RAPIER.RigidBodyDesc.fixed()
          : RAPIER.RigidBodyDesc.dynamic()
              .setLinearDamping(0.05)
              .setAngularDamping(0.1)
              .setAdditionalSolverIterations(8)
              .setCcdEnabled(true),
        p = toPhysics(m.frame.position),
        body = world.createRigidBody(
          d.setTranslation(p.x, p.y, p.z).setRotation(frameRotation(m.frame)),
        );
      bodies.push(body);
      for (const c of covers[i]) {
        const collider = world.createCollider(
          new RAPIER.ColliderDesc(c.shape)
            .setDensity(1000)
            .setFriction(0.7)
            .setActiveHooks(RAPIER.ActiveHooks.FILTER_CONTACT_PAIRS),
          body,
        );
        colliders.push(collider);
        colliderRoles.set(collider.handle, c);
      }
      body.recomputeMassPropertiesFromColliders();
    }
    joint = world.createImpulseJoint(
      RAPIER.JointData.spherical(
        toPhysics(seal.ball.anchor),
        toPhysics(seal.socket.anchor),
      ),
      bodies[0],
      bodies[1],
      true,
    );
    joint.setContactsEnabled(true);
  } catch (error) {
    for (const body of bodies) world.removeRigidBody(body);
    throw error;
  }
  let state: "seating" | "ready" | "blocked" = "seating",
    ticks = 0,
    stable = 0,
    reason: string | undefined,
    disposed = false;
  const pivots = () =>
    [seal.ball, seal.socket].map((m, i) =>
      new Vector3(...Object.values(toPhysics(m.anchor)))
        .applyQuaternion(bodies[i].rotation())
        .add(bodies[i].translation()),
    );
  const gap = () => {
    const p = pivots();
    return p[0].distanceTo(p[1]) / 0.02;
  };
  // Hooks run while the native world is borrowed. Cache outside world.step;
  // reading bodies from a filter callback would poison the native borrow.
  let currentGap = gap();
  const relativeSpeed = () => {
    const p = pivots(),
      v = bodies.map((b, i) => {
        const offset = p[i].clone().sub(b.translation());
        return new Vector3(...Object.values(b.angvel()))
          .cross(offset)
          .add(b.linvel());
      });
    return v[0].distanceTo(v[1]);
  };
  const assertLive = () => {
    ensure(
      !disposed,
      "INVALID_INPUT",
      "This native seating witness was disposed.",
    );
    readPreparedArocsBallRest(prepared);
  };
  const foreignSafe = () => {
    let checks = 0,
      safe = true;
    world.colliders.forEach((foreign) => {
      if (!safe || colliderRoles.has(foreign.handle)) return;
      for (const own of colliders) {
        if (++checks > 1024) {
          safe = false;
          break;
        }
        const contact = own.contactCollider(foreign, 0);
        if (contact && contact.distance < -0.001 * 0.02) {
          safe = false;
          break;
        }
      }
    });
    return safe;
  };
  return {
    bodies: Object.freeze(bodies),
    colliderHandles: Object.freeze(colliders.map((c) => c.handle)),
    joint,
    /** Hook only for this declared ball core and its actual socket endpoint. */
    contactAllowed(a: number, b: number): boolean | undefined {
      const ra = colliderRoles.get(a),
        rb = colliderRoles.get(b);
      if (!ra && !rb) return;
      if (!ra || !rb) return false;
      const core =
        (ra.role === "ball" &&
          rb.role === "socket" &&
          rb.endpoint === seal.endpoint) ||
        (rb.role === "ball" &&
          ra.role === "socket" &&
          ra.endpoint === seal.endpoint);
      if (!core || disposed || state === "blocked") return false;
      return (
        currentGap <=
        (state === "seating"
          ? prepared.initialGapLdu + LIMITS.ordinaryGapLdu
          : LIMITS.ordinaryGapLdu)
      );
    },
    beforeStep() {
      assertLive();
      currentGap = gap();
    },
    afterStep() {
      assertLive();
      if (state === "ready" && gap() > LIMITS.ordinaryGapLdu) {
        state = "blocked";
        reason =
          "The seated ball joint moved outside its reviewed bearing region.";
      }
      if (state !== "seating") return;
      ticks++;
      const g = gap(),
        speed = relativeSpeed();
      if (
        !Number.isFinite(g + speed) ||
        g > prepared.initialGapLdu + LIMITS.ordinaryGapLdu
      ) {
        state = "blocked";
        reason = "The source ball assembly moved outside its seating range.";
      } else {
        stable =
          g <= LIMITS.readyGapLdu &&
          speed <= LIMITS.relativeSpeedMetres &&
          foreignSafe()
            ? stable + 1
            : 0;
        if (stable >= LIMITS.stableTicks) state = "ready";
        else if (ticks >= LIMITS.ticks) {
          state = "blocked";
          reason = "The source ball assembly could not settle safely.";
        }
      }
    },
    requireReady() {
      assertLive();
      ensure(
        state === "ready" && gap() <= LIMITS.ordinaryGapLdu,
        "INVALID_INPUT",
        reason ??
          "Wait for the source ball assembly to settle before moving it.",
      );
    },
    snapshot() {
      assertLive();
      return Object.freeze({
        state,
        ticks,
        stableTicks: stable,
        gapLdu: gap(),
        relativeSpeed: relativeSpeed(),
        reason,
      });
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const body of bodies) world.removeRigidBody(body);
    },
  };
}
