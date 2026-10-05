import { readFileSync } from "node:fs";
import RAPIER from "@dimforge/rapier3d-compat";
import { beforeAll, expect, it } from "vitest";
import { occurrences } from "../../src/core/document";
import { orthonormalized } from "../../src/core/math";
import { importLDraw, exportLDraw } from "../../src/ldraw/io";
import type { JointSpec } from "../../src/mechanisms/types";
import { physicalPlayEligibility } from "../../src/mechanisms/physical-play";
import { partsList } from "../../src/inventory/parts-list";
import {
  fullLibrarySources,
  registerFullLibraryFromDisk,
} from "../../scripts/full-library-node";
import { playSources } from "../helpers/play-dynamic-source";
import { createArocsBallNativeRest } from "../../src/play/arocs-ball-native-rest";
import {
  prepareArocsBallRest,
  readPreparedArocsBallRest,
} from "../../src/play/arocs-ball-rest";
import { frameRotation, toPhysics } from "../../src/play/physics-frame";

registerFullLibraryFromDisk();
beforeAll(() => RAPIER.init());
const fits = [
  {
    ball: '["n55"]',
    socket: '["n77"]',
    endpoint: 1 as const,
    gap: 1.9804892215,
  },
  {
    ball: '["n53"]',
    socket: '["n79"]',
    endpoint: 0 as const,
    gap: 1.9803807715,
  },
  {
    ball: '["n75"]',
    socket: '["n79"]',
    endpoint: 1 as const,
    gap: 0.0199962344,
  },
];
async function fixture(fit = fits[0]) {
  const project = importLDraw(
      readFileSync(
        "fixtures/play/official-cars/42043-ball-link-interfaces.ldr",
        "utf8",
      ),
    ),
    all = occurrences(project),
    ball = all.find((o) => o.id === fit.ball)!,
    socket = all.find((o) => o.id === fit.socket)!,
    groups = [ball, socket].map((o, i) => ({
      id: i ? "socket" : "ball",
      occurrenceIds: [o.id],
      frame: orthonormalized(o.transform),
      restTransforms: { [o.id]: structuredClone(o.transform) },
    }));
  project.motionRigs.seat = {
    schemaVersion: 1,
    id: "seat",
    name: "Actual noncoincident source bearing",
    mode: "kinematic",
    groups,
    joints: [
      {
        id: "bearing",
        kind: "spherical",
        bodyA: "socket",
        bodyB: "ball",
        anchorA: [0, 0, fit.endpoint * 100],
        anchorB: [-10, 0, 0],
        restAssembly: {
          profile: "arocs-ball-native-seat-v1",
          ballOccurrenceId: ball.id,
          socketOccurrenceId: socket.id,
          socketEndpoint: fit.endpoint,
        },
      } as unknown as JointSpec,
    ],
  };
  const { sources } = await playSources(
    project,
    ["seat"],
    fullLibrarySources(all.map((o) => o.node.ref)),
  );
  return { project, source: sources[0], ball, socket };
}
const step = (
  world: RAPIER.World,
  events: RAPIER.EventQueue,
  seat: ReturnType<typeof createArocsBallNativeRest>,
  ticks: number,
) => {
  const hooks: RAPIER.PhysicsHooks = {
    filterIntersectionPair: () => true,
    filterContactPair: (a, b) =>
      seat.contactAllowed(a, b) ? null : RAPIER.SolverFlags.COMPUTE_IMPULSE,
  };
  for (let i = 0; i < ticks; i++) {
    seat.beforeStep();
    world.step(events, hooks);
    seat.afterStep();
  }
};

it.each(fits)(
  "settles actual distinct source anchors %j without source repair or early controls",
  async (fit) => {
    const f = await fixture(fit),
      before = JSON.stringify(f.project),
      text = exportLDraw(f.project),
      inventory = partsList(f.project, occurrences(f.project)),
      [prepared] = await prepareArocsBallRest(f.source);
    expect(prepared.initialGapLdu).toBeCloseTo(fit.gap, 7);
    expect(prepared.childCount).toBe(607);
    expect(
      physicalPlayEligibility(
        f.project,
        f.project.motionRigs.seat,
        occurrences(f.project),
        f.source,
      ).eligible,
    ).toBe(false);
    for (const mobile of [false, true]) {
      const world = new RAPIER.World({ x: 0, y: 0, z: 0 }),
        events = new RAPIER.EventQueue(false);
      world.timestep = 1 / 60;
      const seat = createArocsBallNativeRest(prepared, world, {
        socketAnchored: !mobile,
      });
      try {
        expect(seat.snapshot().state).toBe("seating");
        expect(() => seat.requireReady()).toThrow(/settle/);
        for (const [i, o] of [f.ball, f.socket].entries()) {
          const p = toPhysics(o.transform.position),
            q = frameRotation(orthonormalized(o.transform));
          expect(seat.bodies[i].translation().x).toBeCloseTo(p.x, 6);
          expect(Math.abs(seat.bodies[i].rotation().w)).toBeCloseTo(
            Math.abs(q.w),
            6,
          );
        }
        step(world, events, seat, 240);
        expect(seat.snapshot().state).toBe("ready");
        expect(seat.snapshot().gapLdu).toBeLessThan(0.01);
        expect(() => seat.requireReady()).not.toThrow();
        expect(seat.bodies[0].mass()).toBeGreaterThan(0.1);
        expect(
          seat.contactAllowed(
            seat.colliderHandles[0],
            seat.colliderHandles[2 + fit.endpoint],
          ),
        ).toBe(true);
        // A hypothetical native drift immediately revokes the core allowance;
        // this negative does not rewrite the authored source placements.
        const p = seat.bodies[0].translation();
        seat.bodies[0].setTranslation({ x: p.x + 0.004, y: p.y, z: p.z }, true);
        seat.beforeStep();
        expect(
          seat.contactAllowed(
            seat.colliderHandles[0],
            seat.colliderHandles[2 + fit.endpoint],
          ),
        ).toBe(false);
        expect(() => seat.requireReady()).toThrow();
        expect(JSON.stringify(f.project)).toBe(before);
        expect(exportLDraw(f.project)).toBe(text);
        expect(partsList(f.project, occurrences(f.project))).toEqual(inventory);
      } finally {
        seat.dispose();
        events.free();
        world.free();
      }
    }
  },
  30000,
);

it("refuses forged, stale, changed-buffer and wrong-anchor assembly preflight before native creation", async () => {
  const f = await fixture();
  expect(() =>
    readPreparedArocsBallRest({
      jointId: "bearing",
      initialGapLdu: 1,
      childCount: 607,
    }),
  ).toThrow(/preflight/);
  const [prepared] = await prepareArocsBallRest(f.source);
  expect(() => readPreparedArocsBallRest({ ...prepared })).toThrow(/preflight/);
  const original = f.source.memberLocals![f.ball.id];
  f.source.memberLocals![f.ball.id] = {
    ...original,
    vertices: original.vertices.slice(),
  };
  expect(() => readPreparedArocsBallRest(prepared)).toThrow(/geometry changed/);
  f.source.memberLocals![f.ball.id] = original;
  f.project.motionRigs.seat.joints[0].anchorB = [0, 0, 0];
  await expect(prepareArocsBallRest(f.source)).rejects.toThrow(
    /actual source anchors/,
  );
  expect(() => readPreparedArocsBallRest(prepared)).toThrow(/build changed/);
  f.project.motionRigs.seat.joints[0].anchorB = [-10, 0, 0];
  f.project.motionRigs.seat.groups.push({
    ...f.project.motionRigs.seat.groups[0],
    id: "unowned-extra",
  });
  await expect(prepareArocsBallRest(f.source)).rejects.toThrow(
    /reviewed source parts/,
  );
  f.project.motionRigs.seat.groups.pop();
  const pending = prepareArocsBallRest(f.source);
  f.project.revision++;
  await expect(pending).rejects.toThrow(/build changed/);
}, 30000);

it("keeps foreign obstruction responding during seating and never publishes early ready", async () => {
  const f = await fixture(),
    before = JSON.stringify(f.project),
    [prepared] = await prepareArocsBallRest(f.source),
    world = new RAPIER.World({ x: 0, y: 0, z: 0 }),
    events = new RAPIER.EventQueue(false);
  world.timestep = 1 / 60;
  const seat = createArocsBallNativeRest(prepared, world, {
      socketAnchored: true,
    }),
    native = toPhysics(f.socket.transform.position),
    obstruction = world.createCollider(
      RAPIER.ColliderDesc.cuboid(0.3, 0.3, 0.3).setTranslation(
        native.x,
        native.y,
        native.z,
      ),
    );
  try {
    expect(
      seat.contactAllowed(seat.colliderHandles[0], obstruction.handle),
    ).toBe(false);
    step(world, events, seat, 240);
    expect(seat.snapshot().state).toBe("blocked");
    expect(() => seat.requireReady()).toThrow();
    expect(JSON.stringify(f.project)).toBe(before);
    seat.dispose();
    world.removeCollider(obstruction, true);
    const retry = createArocsBallNativeRest(prepared, world, {
      socketAnchored: true,
    });
    try {
      step(world, events, retry, 240);
      expect(retry.snapshot().state).toBe("ready");
      expect(() => retry.requireReady()).not.toThrow();
      expect(JSON.stringify(f.project)).toBe(before);
    } finally {
      retry.dispose();
    }
  } finally {
    seat.dispose();
    events.free();
    world.free();
  }
}, 30000);
