import { expect, it } from "vitest";
import { Group, Mesh, Vector3 } from "three";
import { LDrawLoader } from "three/examples/jsm/loaders/LDrawLoader.js";
import { LDrawConditionalLineMaterial } from "three/examples/jsm/materials/LDrawConditionalLineMaterial.js";
import { mechanismFixture } from "../../src/mechanisms/fixtures";
import { scopedLDraw } from "../../src/ldraw/io";
import { occurrences } from "../../src/core/document";
import { PlaySession } from "../../src/play/session";
import type { CollisionSnapshot } from "../../src/play/types";
import { validate } from "../../src/core/validate";
async function source(rigId: string) {
  const project = mechanismFixture(),
    rig = project.motionRigs![rigId];
  const mesh = async (ids: string[]): Promise<CollisionSnapshot> => {
    const source = scopedLDraw(project, ids, true);
    const loader = new LDrawLoader().setConditionalLineMaterial(
      LDrawConditionalLineMaterial,
    );
    const group = await new Promise<Group>((ok, fail) =>
      (
        loader.parse as unknown as (
          s: string,
          o: (g: Group) => void,
          f: (e: unknown) => void,
        ) => void
      )(source, ok, fail),
    );
    group.updateMatrixWorld(true);
    const vertices: number[] = [],
      indices: number[] = [];
    group.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      const p = object.geometry.getAttribute("position"),
        offset = vertices.length / 3;
      for (let i = 0; i < p.count; i++) {
        const v = new Vector3()
          .fromBufferAttribute(p, i)
          .applyMatrix4(object.matrixWorld);
        vertices.push(v.x, v.y, v.z);
      }
      const idx = object.geometry.index;
      for (let i = 0; i < (idx?.count ?? p.count); i++)
        indices.push(offset + (idx ? idx.getX(i) : i));
      object.geometry.dispose();
      for (const m of Array.isArray(object.material)
        ? object.material
        : [object.material])
        m.dispose();
    });
    return {
      revision: project.revision,
      vertices: new Float32Array(vertices),
      indices: new Uint32Array(indices),
      bounds: { min: [-100, -110, -240], max: [100, 0, 50] },
    };
  };
  const ids = new Set(rig.groups.flatMap((g) => g.occurrenceIds));
  return {
    geometry: await mesh(
      occurrences(project)
        .filter((o) => !ids.has(o.id))
        .map((o) => o.id),
    ),
    mechanism: {
      project,
      rigId,
      groups: Object.fromEntries(
        await Promise.all(
          rig.groups.map(async (g) => [g.id, await mesh(g.occurrenceIds)]),
        ),
      ),
    },
  };
}
it("opens a real door collider, traverses the opening and refuses a swept closing pose across the actor", async () => {
  const s = await source("door"),
    original = JSON.stringify(s.mechanism.project);
  const play = await PlaySession.create(
    s.geometry,
    { rigId: "door", position: [20, -0.3, 45] },
    s.mechanism,
  );
  play.setInput({ moveZ: 1 });
  play.stepTicks(40);
  expect(play.snapshot().position[2]).toBeGreaterThan(9);
  play.clearInput();
  play.teleport({ position: [20, -0.3, 45] });
  const opened = play.setMechanismJoint("hinge", 90);
  expect(opened.mechanism!.blocked).toBe(false);
  play.setInput({ moveZ: 1 });
  play.stepTicks(27);
  play.clearInput();
  expect(Math.abs(play.snapshot().position[2])).toBeLessThan(3);
  const before = play.snapshot().mechanism!.pose;
  const blocked = play.setMechanismJoint("hinge", 0);
  expect(blocked.mechanism!.blocked).toBe(true);
  expect(blocked.mechanism!.pose).toEqual(before);
  // Both the final closed position and the initial open position are clear here,
  // but a rotating panel would cross this actor between those endpoints.
  play.teleport({ position: [20, -0.3, 45] });
  play.setMechanismJoint("hinge", 0);
  play.teleport({ position: [22, -0.3, -22] });
  expect(play.setMechanismJoint("hinge", 90).mechanism!.blocked).toBe(true);
  expect(play.snapshot().mechanism!.pose.jointPositions.hinge).toBe(0);
  expect(JSON.stringify(s.mechanism.project)).toBe(original);
  play.teleport({ position: [20, -0.3, 0], policy: "free-flight" });
  play.setMechanismJoint("hinge", 90);
  play.setMechanismJoint("hinge", 0);
  const recovered = play.setLocomotion("walk");
  expect(recovered.locomotion).toBe("walk");
  expect(Math.abs(recovered.position[2])).toBeGreaterThan(9);
  validate("playSnapshot", play.snapshot());
  play.dispose();
});
it("fixed tick vehicle replay moves collision surfaces, stops before the actor, and clearing input stops throttle", async () => {
  const s = await source("vehicle");
  const run = async () => {
    const play = await PlaySession.create(
      s.geometry,
      { rigId: "vehicle", position: [0, -0.3, -300] },
      s.mechanism,
    );
    play.setMechanismVehicleInput({ throttle: 1, steering: 0 });
    play.stepTicks(120);
    const blocked = play.snapshot();
    expect(blocked.mechanism!.blocked).toBe(true);
    expect(blocked.mechanism!.pose.vehicle!.position[2]).toBeGreaterThan(-70);
    expect(blocked.tick).toBe(120);
    expect(blocked.mechanism!.tick).toBe(120);
    const before = blocked.mechanism!.pose;
    play.clearInput();
    play.teleport({ position: [200, -0.3, -300] });
    play.stepTicks(60);
    expect(play.snapshot().mechanism!.pose).toEqual(before);
    play.dispose();
    return blocked;
  };
  expect(await run()).toEqual(await run());
});

it("refuses invalid moving geometry and stops excessive sweep work without aborting fixed ticks", async () => {
  const s = await source("vehicle"),
    rig = s.mechanism.project.motionRigs!.vehicle;
  rig.vehicle!.maxSpeed = 10000;
  for (const wheel of rig.vehicle!.wheels) wheel.radius = 0.1;
  const play = await PlaySession.create(
    s.geometry,
    { rigId: "vehicle", position: [200, -0.3, -200] },
    s.mechanism,
  );
  play.setMechanismVehicleInput({ throttle: 1, steering: 0 });
  const bounded = play.stepTicks(1);
  expect(bounded.mechanism!.blocked).toBe(true);
  expect(bounded.mechanism!.blockedReason).toContain("1,024");
  expect(bounded.mechanism!.pose.vehicle!.position).toEqual([0, 0, 0]);
  expect(() => play.stepTicks(5)).not.toThrow();
  play.dispose();
  s.mechanism.groups.chassis.indices = new Uint32Array([99999999, 1, 2]);
  await expect(
    PlaySession.create(s.geometry, { rigId: "vehicle" }, s.mechanism),
  ).rejects.toThrow("valid complete geometry");
});
