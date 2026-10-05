import RAPIER from "@dimforge/rapier3d-compat";
import { beforeAll, expect, it } from "vitest";
import { occurrences } from "../../src/core/document";
import type { Transform } from "../../src/core/types";
import { exportLDraw } from "../../src/ldraw/io";
import { partsList } from "../../src/inventory/parts-list";
import { axisRotation } from "../../src/mechanisms/kinematic";
import {
  prepareArocsBallRest,
  type PreparedArocsBallRest,
} from "../../src/play/arocs-ball-rest";
import {
  compileArocsBallRestCovers,
  readArocsBallNativeCover,
} from "../../src/play/arocs-ball-native-covers";
import {
  attachArocsBallNativeRest,
  createArocsBallRestJoint,
  type ArocsBallNativeAttachment,
} from "../../src/play/arocs-ball-native-bridge";
import { frameRotation, toPhysics } from "../../src/play/physics-frame";
import { arocsRestFixture } from "../helpers/arocs-ball-rest-source";
beforeAll(() => RAPIER.init());
function native(
  prepared: PreparedArocsBallRest,
  world: RAPIER.World,
  mobile = false,
) {
  const covers = compileArocsBallRestCovers(prepared, "world-rest");
  const body = (member: "ball" | "socket") => {
    const d = readArocsBallNativeCover(
        prepared,
        covers.find(
          (c) => readArocsBallNativeCover(prepared, c).member === member,
        )!,
      ),
      p = toPhysics(d.bodyRest.position),
      desc =
        member === "socket" && !mobile
          ? RAPIER.RigidBodyDesc.fixed()
          : RAPIER.RigidBodyDesc.dynamic()
              .setLinearDamping(0.05)
              .setAngularDamping(0.1)
              .setAdditionalSolverIterations(8)
              .setCcdEnabled(true);
    return world.createRigidBody(
      desc.setTranslation(p.x, p.y, p.z).setRotation(frameRotation(d.bodyRest)),
    );
  };
  const ball = body("ball"),
    socket = body("socket"),
    entries = covers.map((cover) => {
      const d = readArocsBallNativeCover(prepared, cover),
        collider = world.createCollider(
          new RAPIER.ColliderDesc(cover.shape)
            .setDensity(1000)
            .setFriction(0.7)
            .setActiveHooks(RAPIER.ActiveHooks.FILTER_CONTACT_PAIRS),
          d.member === "ball" ? ball : socket,
        );
      return { cover, collider };
    });
  ball.recomputeMassPropertiesFromColliders();
  socket.recomputeMassPropertiesFromColliders();
  return { ball, socket, covers: entries } satisfies ArocsBallNativeAttachment;
}
function step(
  world: RAPIER.World,
  events: RAPIER.EventQueue,
  c: ReturnType<typeof attachArocsBallNativeRest>,
  n = 240,
) {
  const hooks: RAPIER.PhysicsHooks = {
    filterIntersectionPair: () => true,
    filterContactPair: (a, b) =>
      c.contactAllowed(a, b) ? null : RAPIER.SolverFlags.COMPUTE_IMPULSE,
  };
  for (let i = 0; i < n; i++) {
    c.beforeStep();
    world.step(events, hooks);
    c.afterStep();
  }
}
const counts = (w: RAPIER.World) => [
  w.bodies.len(),
  w.colliders.len(),
  w.impulseJoints.len(),
];
const poses: Array<Transform | undefined> = [
  undefined,
  {
    position: [80, -60, 120],
    basis: axisRotation(
      [1 / Math.sqrt(3), 1 / Math.sqrt(3), 1 / Math.sqrt(3)],
      37,
    ),
  },
];
it.each(poses)(
  "attaches without duplicate carriers and certifies a clear ground plane at source pose%j",
  async (pose) => {
    const f = await arocsRestFixture(undefined, pose),
      before = JSON.stringify(f.project),
      text = exportLDraw(f.project),
      inventory = partsList(f.project, occurrences(f.project)),
      [prepared] = await prepareArocsBallRest(f.source);
    for (const mobile of [false, true]) {
      const world = new RAPIER.World({ x: 0, y: 0, z: 0 }),
        events = new RAPIER.EventQueue(false);
      world.timestep = 1 / 60;
      const a = native(prepared, world, mobile),
        ground = world.createCollider(
          new RAPIER.ColliderDesc(new RAPIER.HalfSpace({ x: 0, y: 1, z: 0 })),
        ),
        joint = createArocsBallRestJoint(prepared, world, a),
        beforeAttach = counts(world),
        c = attachArocsBallNativeRest(prepared, world, a, joint);
      try {
        expect(beforeAttach).toEqual([2, 6, 1]);
        expect(counts(world)).toEqual(beforeAttach);
        expect(a.ball.rotation()).toEqual({ x: 0, y: 0, z: 0, w: 1 });
        expect(
          c.contactAllowed(a.covers[0].collider.handle, ground.handle),
        ).toBe(false);
        expect(() => c.requireReady()).toThrow(/settle/);
        step(world, events, c);
        expect(c.snapshot().state).toBe("ready");
        expect(c.snapshot().gapLdu).toBeLessThan(0.01);
        expect(counts(world)).toEqual(beforeAttach);
        c.dispose();
        expect(counts(world)).toEqual(beforeAttach);
        expect(JSON.stringify(f.project)).toBe(before);
        expect(exportLDraw(f.project)).toBe(text);
        expect(partsList(f.project, occurrences(f.project))).toEqual(inventory);
      } finally {
        c.dispose();
        events.free();
        world.free();
      }
    }
  },
  30000,
);

it("rejects a genuinely penetrating half-space, including rotated planes, under the unchanged guard", async () => {
  const f = await arocsRestFixture(),
    before = JSON.stringify(f.project),
    [prepared] = await prepareArocsBallRest(f.source);
  for (const tilted of [false, true]) {
    const world = new RAPIER.World({ x: 0, y: 0, z: 0 }),
      events = new RAPIER.EventQueue(false);
    world.timestep = 1 / 60;
    const a = native(prepared, world),
      normal = tilted ? { x: 0.1, y: 1, z: 0 } : { x: 0, y: 1, z: 0 },
      plane = world.createCollider(
        new RAPIER.ColliderDesc(new RAPIER.HalfSpace(normal)).setTranslation(
          0,
          4,
          0,
        ),
      ),
      joint = createArocsBallRestJoint(prepared, world, a),
      c = attachArocsBallNativeRest(prepared, world, a, joint);
    try {
      expect(c.contactAllowed(a.covers[0].collider.handle, plane.handle)).toBe(
        false,
      );
      step(world, events, c);
      expect(c.snapshot().state).toBe("blocked");
      expect(() => c.requireReady()).toThrow();
      expect(JSON.stringify(f.project)).toBe(before);
    } finally {
      c.dispose();
      events.free();
      world.free();
    }
  }
}, 30000);

it("refuses swapped worlds, forged or changed covers, incomplete ownership and a fake constraint without allocating carriers", async () => {
  const f = await arocsRestFixture(),
    [prepared] = await prepareArocsBallRest(f.source),
    world = new RAPIER.World({ x: 0, y: 0, z: 0 }),
    foreign = new RAPIER.World({ x: 0, y: 0, z: 0 });
  world.timestep = foreign.timestep = 1 / 60;
  try {
    const a = native(prepared, world),
      b = native(prepared, foreign),
      initial = counts(world);
    expect(() =>
      createArocsBallRestJoint(prepared, world, { ...a, ball: b.ball }),
    ).toThrow(/exact existing source bodies/);
    expect(() =>
      createArocsBallRestJoint(prepared, world, {
        ...a,
        covers: a.covers.slice(1),
      }),
    ).toThrow(/every reviewed/);
    expect(() =>
      createArocsBallRestJoint(prepared, world, {
        ...a,
        covers: a.covers.map((e, i) =>
          i ? e : { ...e, cover: { ...e.cover } },
        ),
      }),
    ).toThrow(/cover identity/);
    const first = a.covers[0],
      shape = first.collider.shape;
    first.collider.setShape(new RAPIER.Ball(0.16));
    expect(() => createArocsBallRestJoint(prepared, world, a)).toThrow(
      /exact reviewed collider/,
    );
    first.collider.setShape(shape);
    expect(counts(world)).toEqual(initial);
    const ballAnchor = readArocsBallNativeCover(
        prepared,
        a.covers[0].cover,
      ).anchor,
      socketAnchor = readArocsBallNativeCover(
        prepared,
        a.covers[2].cover,
      ).anchor,
      fake = world.createImpulseJoint(
        RAPIER.JointData.fixed(
          ballAnchor,
          { x: 0, y: 0, z: 0, w: 1 },
          socketAnchor,
          { x: 0, y: 0, z: 0, w: 1 },
        ),
        a.ball,
        a.socket,
        true,
      );
    fake.setContactsEnabled(true);
    expect(() => attachArocsBallNativeRest(prepared, world, a, fake)).toThrow(
      /exact source-derived constraint/,
    );
    world.removeImpulseJoint(fake, true);
    const joint = createArocsBallRestJoint(prepared, world, a),
      c = attachArocsBallNativeRest(prepared, world, a, joint);
    expect(() => createArocsBallRestJoint(prepared, world, a)).toThrow(
      /already has/,
    );
    joint.setAnchor2({ x: 0, y: 0, z: 0 });
    expect(() => c.beforeStep()).toThrow(/constraint changed/);
    c.dispose();
    expect(counts(world)).toEqual([2, 5, 1]);
  } finally {
    world.free();
    foreign.free();
  }
}, 30000);
