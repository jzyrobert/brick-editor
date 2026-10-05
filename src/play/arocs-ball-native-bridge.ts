import RAPIER from "@dimforge/rapier3d-compat";
import { Vector3 } from "three";
import { ensure } from "../core/types";
import { frameRotation, toPhysics } from "./physics-frame";
import {
  AROCS_BALL_SEATING_LIMITS as LIMITS,
  readPreparedArocsBallRest,
  type PreparedArocsBallRest,
} from "./arocs-ball-rest";
import {
  readArocsBallNativeCover,
  type ArocsBallNativeCover,
} from "./arocs-ball-native-covers";

export type ArocsBallNativeAttachment = Readonly<{
  ball: RAPIER.RigidBody;
  socket: RAPIER.RigidBody;
  covers: readonly Readonly<{
    cover: ArocsBallNativeCover;
    collider: RAPIER.Collider;
  }>[];
}>;
type Verified = ReturnType<typeof verifyAttachment>;
const joints = new WeakMap<
  RAPIER.ImpulseJoint,
  {
    prepared: PreparedArocsBallRest;
    world: RAPIER.World;
    ball: RAPIER.RigidBody;
    socket: RAPIER.RigidBody;
  }
>();
const perWorld = new WeakMap<
  RAPIER.World,
  WeakMap<PreparedArocsBallRest, RAPIER.ImpulseJoint>
>();
// A physical source occurrence has one native owner in a world, including
// when distinct prepared endpoints share the same socket. Dead owners permit
// reconstruction; live owners may never be replaced by a duplicated part.
const memberOwners = new WeakMap<
  RAPIER.World,
  WeakMap<
    object,
    Map<
      string,
      {
        body: RAPIER.RigidBody;
        classes: ReadonlyMap<ArocsBallNativeCover, RAPIER.Collider>;
      }
    >
  >
>();
// Only verified controller closures are registered; a public state object or
// copied shape cannot exempt another assembly's contact from readiness checks.
const activePairs = new WeakMap<
  RAPIER.World,
  Set<(a: number, b: number) => boolean | undefined>
>();
const sameVector = (a: RAPIER.Vector, b: RAPIER.Vector) =>
  a.x === b.x && a.y === b.y && a.z === b.z;
function verifyAttachment(
  prepared: PreparedArocsBallRest,
  world: RAPIER.World,
  a: ArocsBallNativeAttachment,
  cold: boolean,
) {
  const seal = readPreparedArocsBallRest(prepared),
    roles = new Set<string>();
  ensure(
    a.ball !== a.socket &&
      world.getRigidBody(a.ball.handle) === a.ball &&
      world.getRigidBody(a.socket.handle) === a.socket &&
      (a.ball.isDynamic() || a.socket.isDynamic()) &&
      [a.ball, a.socket].every((b) => b.isDynamic() || b.isFixed()),
    "INVALID_INPUT",
    "Native seating needs the exact existing source bodies.",
  );
  const covers = a.covers.map((entry) => {
    const d = readArocsBallNativeCover(prepared, entry.cover),
      body = d.member === "ball" ? a.ball : a.socket,
      key = `${d.member}:${d.role}:${d.endpoint ?? ""}`;
    ensure(
      !roles.has(key),
      "INVALID_INPUT",
      "A source bearing class cannot be attached twice.",
    );
    roles.add(key);
    const c = entry.collider,
      p = c.translationWrtParent(),
      q = c.rotationWrtParent();
    ensure(
      world.getCollider(c.handle) === c &&
        c.parent() === body &&
        c.shape === entry.cover.shape &&
        c.isEnabled() &&
        !c.isSensor() &&
        !!(c.activeHooks() & RAPIER.ActiveHooks.FILTER_CONTACT_PAIRS) &&
        p &&
        sameVector(p, { x: 0, y: 0, z: 0 }) &&
        q &&
        q.x === 0 &&
        q.y === 0 &&
        q.z === 0 &&
        Math.abs(q.w) === 1,
      "INVALID_INPUT",
      "Native seating needs the exact reviewed collider and parent identity.",
    );
    if (cold) {
      const expected = toPhysics(d.bodyRest.position),
        actual = body.translation(),
        r = frameRotation(d.bodyRest),
        rotation = body.rotation();
      ensure(
        sameVector(actual, {
          x: Math.fround(expected.x),
          y: Math.fround(expected.y),
          z: Math.fround(expected.z),
        }) &&
          Math.abs(
            r.x * rotation.x +
              r.y * rotation.y +
              r.z * rotation.z +
              r.w * rotation.w,
          ) >=
            1 - 1e-7 &&
          sameVector(body.linvel(), { x: 0, y: 0, z: 0 }) &&
          sameVector(body.angvel(), { x: 0, y: 0, z: 0 }),
        "INVALID_INPUT",
        "Attach native seating before the source bodies move.",
        { expected, actual, linear: body.linvel(), angular: body.angvel() },
      );
    }
    return { entry, details: d, body };
  });
  const expected = [
    ...seal.ball.packet.classes.map(
      (c) => `ball:${c.id}:${"endpoint" in c ? c.endpoint : ""}`,
    ),
    ...seal.socket.packet.classes.map(
      (c) => `socket:${c.id}:${"endpoint" in c ? c.endpoint : ""}`,
    ),
  ];
  ensure(
    roles.size === expected.length &&
      expected.every((k) => roles.has(k)) &&
      a.covers.reduce((n, c) => n + c.cover.childCount, 0) ===
        prepared.childCount,
    "INVALID_INPUT",
    "Native seating requires every reviewed source collision class.",
  );
  for (const body of [a.ball, a.socket]) {
    const owned = a.covers.filter((c) => c.collider.parent() === body);
    ensure(
      body.numColliders() === owned.length,
      "INVALID_INPUT",
      "A seating body must retain its complete checked collision ownership.",
    );
  }
  const byMember = (member: "ball" | "socket") =>
      covers.filter((c) => c.details.member === member),
    ball = byMember("ball")[0].details,
    socket = byMember("socket")[0].details;
  for (const c of covers) {
    const first = c.details.member === "ball" ? ball : socket;
    ensure(
      JSON.stringify(c.details.bodyRest) === JSON.stringify(first.bodyRest) &&
        sameVector(c.details.anchor, first.anchor),
      "INVALID_INPUT",
      "Native source covers must share their actual body frame.",
    );
  }
  return { seal, covers, ball, socket };
}

/** Create only the actual declared constraint on existing verified bodies.
 * The sealed factory prevents a fixed/unrestricted fake joint from gaining
 * seating readiness through matching anchor numbers alone. */
export function createArocsBallRestJoint(
  prepared: PreparedArocsBallRest,
  world: RAPIER.World,
  a: ArocsBallNativeAttachment,
) {
  ensure(
    Math.abs(world.timestep - 1 / 60) < 1e-9,
    "INVALID_INPUT",
    "Native ball seating requires the bounded Play fixed step.",
  );
  const verified = verifyAttachment(prepared, world, a, true),
    existing = perWorld.get(world)?.get(prepared);
  ensure(
    !existing?.isValid(),
    "INVALID_INPUT",
    "This native source bearing already has its seating constraint.",
  );
  let sources = memberOwners.get(world);
  if (!sources) {
    sources = new WeakMap();
    memberOwners.set(world, sources);
  }
  let owners = sources.get(verified.seal.source);
  if (!owners) {
    owners = new Map();
    sources.set(verified.seal.source, owners);
  }
  const pending = [verified.seal.ball, verified.seal.socket].map((m) => {
    const body = m.id === verified.seal.ball.id ? a.ball : a.socket,
      owned = verified.covers.filter((c) => c.body === body),
      previous = owners.get(m.id);
    if (previous?.body.isValid())
      ensure(
        previous.body === body &&
          previous.classes.size === owned.length &&
          owned.every(
            (c) => previous.classes.get(c.entry.cover) === c.entry.collider,
          ),
        "INVALID_INPUT",
        "A source part must keep one native body and its exact collider classes.",
      );
    return {
      id: m.id,
      body,
      classes: new Map(owned.map((c) => [c.entry.cover, c.entry.collider])),
    };
  });
  const joint = world.createImpulseJoint(
    RAPIER.JointData.spherical(verified.ball.anchor, verified.socket.anchor),
    a.ball,
    a.socket,
    true,
  );
  joint.setContactsEnabled(true);
  for (const owner of pending) owners.set(owner.id, owner);
  joints.set(joint, { prepared, world, ball: a.ball, socket: a.socket });
  let map = perWorld.get(world);
  if (!map) {
    map = new WeakMap();
    perWorld.set(world, map);
  }
  map.set(prepared, joint);
  return joint;
}

/** State-only bridge: allocates/deletes no bodies, colliders or constraints. */
export function attachArocsBallNativeRest(
  prepared: PreparedArocsBallRest,
  world: RAPIER.World,
  a: ArocsBallNativeAttachment,
  joint: RAPIER.ImpulseJoint,
) {
  const v: Verified = verifyAttachment(prepared, world, a, true),
    bound = joints.get(joint);
  ensure(
    bound?.prepared === prepared &&
      bound.world === world &&
      bound.ball === a.ball &&
      bound.socket === a.socket &&
      world.getImpulseJoint(joint.handle) === joint &&
      joint.body1() === a.ball &&
      joint.body2() === a.socket &&
      sameVector(joint.anchor1(), v.ball.anchor) &&
      sameVector(joint.anchor2(), v.socket.anchor) &&
      joint.contactsEnabled(),
    "INVALID_INPUT",
    "Native seating needs its exact source-derived constraint.",
  );
  ensure(
    Math.abs(world.timestep - 1 / 60) < 1e-9,
    "INVALID_INPUT",
    "Native ball seating requires the bounded Play fixed step.",
  );
  const bodyList = [a.ball, a.socket],
    byHandle = new Map(v.covers.map((c) => [c.entry.collider.handle, c])),
    anchors = [v.ball.anchor, v.socket.anchor];
  let state: "seating" | "ready" | "blocked" = "seating",
    ticks = 0,
    stable = 0,
    disposed = false,
    reason: string | undefined;
  const pivots = () =>
    bodyList.map((b, i) =>
      new Vector3(...Object.values(anchors[i]))
        .applyQuaternion(b.rotation())
        .add(b.translation()),
    );
  const gap = () => {
    const p = pivots();
    return p[0].distanceTo(p[1]) / 0.02;
  };
  let currentGap = gap();
  const speed = () => {
    const p = pivots(),
      velocity = bodyList.map((b, i) =>
        new Vector3(...Object.values(b.angvel()))
          .cross(p[i].clone().sub(b.translation()))
          .add(b.linvel()),
      );
    return velocity[0].distanceTo(velocity[1]);
  };
  const assertLive = () => {
    ensure(
      !disposed,
      "INVALID_INPUT",
      "This native seating witness was disposed.",
    );
    verifyAttachment(prepared, world, a, false);
    ensure(
      world.getImpulseJoint(joint.handle) === joint &&
        sameVector(joint.anchor1(), v.ball.anchor) &&
        sameVector(joint.anchor2(), v.socket.anchor) &&
        joint.contactsEnabled(),
      "INVALID_INPUT",
      "The native source constraint changed after seating preflight.",
    );
  };
  const foreignSafe = () => {
    let checks = 0,
      points = 0,
      safe = true;
    world.colliders.forEach((foreign) => {
      if (
        !safe ||
        !foreign.isEnabled() ||
        foreign.isSensor() ||
        byHandle.has(foreign.handle)
      )
        return;
      if (foreign.shape instanceof RAPIER.HalfSpace) {
        const normal = new Vector3(...Object.values(foreign.shape.normal))
            .applyQuaternion(foreign.rotation())
            .normalize(),
          origin = foreign.translation();
        for (const c of v.covers) {
          const rotation = c.body.rotation(),
            translation = c.body.translation(),
            p = c.details.points;
          for (let k = 0; k < p.length; k += 3) {
            if (++points > 100000) {
              safe = false;
              return;
            }
            const point = new Vector3(p[k], p[k + 1], p[k + 2])
              .applyQuaternion(rotation)
              .add(translation);
            if (point.sub(origin).dot(normal) < -0.001 * 0.02) {
              safe = false;
              return;
            }
          }
        }
      } else
        for (const c of v.covers) {
          if (++checks > 1024) {
            safe = false;
            break;
          }
          if (
            [...(activePairs.get(world) ?? [])].some(
              (allowed) =>
                allowed(c.entry.collider.handle, foreign.handle) === true,
            )
          )
            continue;
          const contact = c.entry.collider.contactCollider(foreign, 0);
          if (contact && contact.distance < -0.001 * 0.02) {
            safe = false;
            break;
          }
        }
    });
    return safe;
  };
  const contactAllowed = (x: number, y: number): boolean | undefined => {
    const xClass = byHandle.get(x)?.details,
      yClass = byHandle.get(y)?.details;
    if (!xClass && !yClass) return;
    if (!xClass || !yClass || disposed || state === "blocked") return false;
    const ball =
        xClass.member === "ball"
          ? xClass
          : yClass.member === "ball"
            ? yClass
            : undefined,
      socket =
        xClass.member === "socket"
          ? xClass
          : yClass.member === "socket"
            ? yClass
            : undefined;
    return (
      !!ball &&
      !!socket &&
      ball.role === "ball" &&
      socket.role === "socket" &&
      socket.endpoint === v.seal.endpoint &&
      currentGap <=
        (state === "seating"
          ? prepared.initialGapLdu + LIMITS.ordinaryGapLdu
          : LIMITS.ordinaryGapLdu)
    );
  };
  let peers = activePairs.get(world);
  if (!peers) {
    peers = new Set();
    activePairs.set(world, peers);
  }
  peers.add(contactAllowed);
  return {
    contactAllowed,
    beforeStep() {
      assertLive();
      currentGap = gap();
    },
    afterStep() {
      assertLive();
      const g = gap();
      if (state === "ready" && g > LIMITS.ordinaryGapLdu) {
        state = "blocked";
        reason =
          "The seated ball joint moved outside its reviewed bearing region.";
      }
      if (state !== "seating") return;
      ticks++;
      const s = speed();
      if (
        !Number.isFinite(g + s) ||
        g > prepared.initialGapLdu + LIMITS.ordinaryGapLdu
      ) {
        state = "blocked";
        reason = "The source ball assembly moved outside its seating range.";
      } else {
        stable =
          g <= LIMITS.readyGapLdu &&
          s <= LIMITS.relativeSpeedMetres &&
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
        relativeSpeed: speed(),
        reason,
      });
    },
    dispose() {
      peers.delete(contactAllowed);
      disposed = true;
    },
  };
}
