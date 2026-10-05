import { expect, it } from "vitest";
import { validate } from "../../src/core/validate";
import { exportLDraw } from "../../src/ldraw/io";
import { PlaySession } from "../../src/play/session";
import type { CollisionSnapshot } from "../../src/play/types";
import { arocsRestFixture } from "../helpers/arocs-ball-rest-source";

function scene(
  groups: Record<string, CollisionSnapshot>,
  revision: number,
): CollisionSnapshot {
  const vertices: number[] = [],
    indices: number[] = [];
  for (const mesh of Object.values(groups)) {
    const offset = vertices.length / 3;
    vertices.push(...mesh.vertices);
    indices.push(...Array.from(mesh.indices, (index) => index + offset));
  }
  const min: [number, number, number] = [Infinity, Infinity, Infinity],
    max: [number, number, number] = [-Infinity, -Infinity, -Infinity];
  vertices.forEach((value, i) => {
    min[i % 3] = Math.min(min[i % 3], value);
    max[i % 3] = Math.max(max[i % 3], value);
  });
  return {
    revision,
    // BrowserPlay excludes active rig members from its static-world snapshot;
    // their complete geometry is supplied separately through source.groups.
    vertices: new Float32Array(),
    indices: new Uint32Array(),
    bounds: { min, max },
  };
}

it("direct Play session prepares native source seating before allocation and publishes valid readiness reports", async () => {
  const f = await arocsRestFixture(),
    original = JSON.stringify(f.project),
    text = exportLDraw(f.project);
  expect(f.source.nativeRest).toBeUndefined();
  const session = await PlaySession.create(
    scene(f.source.groups, f.project.revision),
    {
      rigId: "seat",
      dynamicRigIds: ["seat"],
      position: [1000, -0.3, 1000],
      realtime: false,
    },
    [f.source],
  );
  try {
    expect(f.source.nativeRest).toHaveLength(1);
    const initial = session.snapshot();
    validate("playSnapshot", initial);
    expect(
      initial.mechanisms!.seat.dynamics!.restAssemblies!.bearing.state,
    ).toBe("seating");
    expect(() =>
      session.setJointTarget({
        rigId: "seat",
        jointId: "bearing",
        target: 1,
        speed: 1,
      }),
    ).toThrow(/settle/);
    session.stepTicks(240);
    const final = session.snapshot();
    validate("playSnapshot", final);
    expect(final.mechanisms!.seat.dynamics!.restAssemblies!.bearing.state).toBe(
      "ready",
    );
    expect(
      final.mechanisms!.seat.dynamics!.restAssemblies!.bearing.gapLdu,
    ).toBeLessThan(0.01);
    expect(JSON.stringify(f.project)).toBe(original);
    expect(exportLDraw(f.project)).toBe(text);
  } finally {
    session.dispose();
  }
}, 30_000);

it("direct Kinematic Play refuses a declared native-only assembly before binding source tokens", async () => {
  const f = await arocsRestFixture();
  await expect(
    PlaySession.create(
      scene(f.source.groups, f.project.revision),
      {
        rigId: "seat",
        dynamicRigIds: [],
        realtime: false,
      },
      [f.source],
    ),
  ).rejects.toThrow(/Dynamic Play/);
  expect(f.source.nativeRest).toBeUndefined();
}, 30_000);
