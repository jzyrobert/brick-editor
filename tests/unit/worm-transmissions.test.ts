import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import RAPIER from "@dimforge/rapier3d-compat";
import { DynamicRig } from "../../src/play/dynamics";
import { toPhysicsDirection } from "../../src/play/physics-frame";
import { occurrences } from "../../src/core/document";
import { identity } from "../../src/core/math";
import { importLDraw, exportLDraw } from "../../src/ldraw/io";
import { KinematicSession, validateRig } from "../../src/mechanisms/kinematic";
import { physicalPlayEligibility } from "../../src/mechanisms/physical-play";
import {
  transmissionMap,
  transmissionSpeedLimit,
} from "../../src/mechanisms/transmissions";
import {
  bindRetainedWinchSources,
  retainedWinch,
} from "../../src/mechanisms/retained-winch";
import type { MotionRig } from "../../src/mechanisms/types";
import { decodeNative, encodeNative } from "../../src/persistence/native";
import {
  registerFullLibraryFromDisk,
  fullLibrarySources,
} from "../../scripts/full-library-node";
beforeAll(async () => {
  registerFullLibraryFromDisk();
  await RAPIER.init();
});
async function fixture() {
  const project = importLDraw(
    readFileSync("fixtures/ldraw/technic/42042-retained-winch.ldr", "utf8"),
  );
  const all = occurrences(project),
    source = fullLibrarySources(all.map((o) => o.node.ref));
  const binding = await bindRetainedWinchSources(source, project);
  const witness = retainedWinch(
    all.find((o) => o.node.ref === "4716.dat")!,
    all,
    binding,
  );
  const rig: MotionRig = {
    schemaVersion: 1,
    id: "winch",
    name: "Retained worm winch",
    mode: "kinematic",
    groups: [
      ["carrier", witness.carrierMembers],
      ["input", witness.inputMembers],
      ["output", witness.outputMembers],
    ].map(([name, members]) => {
      const ids = members as readonly string[];
      return {
        id: name as string,
        occurrenceIds: [...ids],
        frame: identity(),
        restTransforms: Object.fromEntries(
          all
            .filter((o) => ids.includes(o.id))
            .map((o) => [o.id, structuredClone(o.transform)]),
        ),
      };
    }),
    joints: [witness.input, witness.output].map((port, i) => ({
      id: i ? "wheel" : "worm",
      kind: "revolute",
      bodyA: "carrier",
      bodyB: i ? "output" : "input",
      anchorA: [...port.center],
      anchorB: [...port.center],
      axisA: [...port.axis],
      axisB: [...port.axis],
    })),
    transmissions: [
      {
        id: "worm-drive",
        kind: "worm",
        jointA: "worm",
        jointB: "wheel",
        starts: 1,
        teeth: 8,
        direction: 1,
      },
    ],
  };
  project.motionRigs[rig.id] = rig;
  return { project, rig };
}
describe("orthogonal retained worm transmission coordinates", () => {
  it.each([1, -1] as const)(
    "dispatches signed native worm coordinates (%s) through the real DynamicRig equation methods",
    async (direction) => {
      const { project, rig } = await fixture();
      if (rig.transmissions![0].kind === "worm")
        rig.transmissions![0].direction = direction;
      const source = JSON.stringify(project);
      // Native equation dispatch bench only. Physical source solids/admission
      // are verified separately by the retained source packet, never bypassed here.
      const world = new RAPIER.World({ x: 0, y: 0, z: 0 });
      try {
        const body = (mass: number, fixed = false) => {
          const result = world.createRigidBody(
            fixed
              ? RAPIER.RigidBodyDesc.fixed()
              : RAPIER.RigidBodyDesc.dynamic(),
          );
          world.createCollider(
            RAPIER.ColliderDesc.ball(0.05).setMass(mass).setCollisionGroups(0),
            result,
          );
          return result;
        };
        const carrier = body(4, true),
          input = body(1),
          output = body(2);
        const dynamic = Object.create(DynamicRig.prototype) as {
          createAngularEquations: () => void;
          solveTransmissions: () => void;
        };
        Object.assign(dynamic, {
          rig,
          bodies: new Map([
            ["carrier", { body: carrier }],
            ["input", { body: input }],
            ["output", { body: output }],
          ]),
          joints: new Map(
            rig.joints.map((spec) => [
              spec.id,
              { spec, axis: toPhysicsDirection(spec.axisA!) },
            ]),
          ),
        });
        dynamic.createAngularEquations();
        const ia = 0.4 * 1 * 0.05 ** 2,
          ib = 0.4 * 2 * 0.05 ** 2,
          ratio = direction / 8;
        const outAxis = toPhysicsDirection(rig.joints[1].axisA!),
          inAxis = toPhysicsDirection(rig.joints[0].axisA!);
        output.applyTorqueImpulse(
          { x: outAxis.x * 0.005, y: outAxis.y * 0.005, z: outAxis.z * 0.005 },
          true,
        );
        const lambda = -(0.005 / ib) / (ratio ** 2 / ia + 1 / ib);
        dynamic.solveTransmissions();
        const coordinateVelocity = (b: RAPIER.RigidBody, a: RAPIER.Vector) => {
          const w = b.angvel();
          return w.x * a.x + w.y * a.y + w.z * a.z;
        };
        expect(coordinateVelocity(input, inAxis)).toBeCloseTo(
          (-ratio * lambda) / ia,
          5,
        );
        expect(coordinateVelocity(output, outAxis)).toBeCloseTo(
          0.005 / ib + lambda / ib,
          5,
        );
        expect(coordinateVelocity(output, outAxis)).toBeCloseTo(
          ratio * coordinateVelocity(input, inAxis),
          6,
        );
        expect(JSON.stringify(project)).toBe(source);
      } finally {
        world.free();
      }
    },
  );
  it("keeps signed multi-turn phase from either shaft and leaves every source occurrence unchanged", async () => {
    const { project, rig } = await fixture(),
      before = JSON.stringify(project),
      session = new KinematicSession(project, rig.id);
    for (const turns of [-1080, 720, 4320]) {
      expect(
        session.setJointPosition("worm", turns).pose.jointPositions.wheel,
      ).toBe(turns / 8);
      expect(
        session.setJointPosition("wheel", turns).pose.jointPositions.worm,
      ).toBe(turns * 8);
    }
    expect(JSON.stringify(project)).toBe(before);
    // Ratio data alone still grants no ordinary tooth/bearing collision admission.
    expect(physicalPlayEligibility(project, rig).eligible).toBe(false);
  });
  it("reflects real output travel bounds atomically and retains existing speed limits", async () => {
    const { project, rig } = await fixture();
    rig.joints[1].limits = [-10, 20];
    const session = new KinematicSession(project, rig.id),
      map = transmissionMap(rig);
    expect(session.jointLimits("worm")).toEqual([-80, 160]);
    expect(transmissionSpeedLimit(map, "wheel")).toBe(450);
    session.setJointPosition("worm", 160);
    const before = session.snapshot();
    expect(() => session.setJointPosition("worm", 161)).toThrow(/limits/);
    expect(session.snapshot()).toEqual(before);
  });
  it("preserves the honest worm relation and source through native save/restore", async () => {
    const { project, rig } = await fixture(),
      ldraw = exportLDraw(project);
    const restored = await decodeNative(await encodeNative(project));
    validateRig(restored, restored.motionRigs[rig.id]);
    expect(restored.motionRigs[rig.id].transmissions).toEqual(
      rig.transmissions,
    );
    expect(exportLDraw(restored)).toBe(ldraw);
    expect(
      new KinematicSession(restored, rig.id).setJointPosition("worm", 720).pose
        .jointPositions.wheel,
    ).toBe(90);
  });
  it("rejects parallel/nonorthogonal shafts, invented starts, mixed mesh fields and contradictory loops", async () => {
    const { rig } = await fixture();
    for (const mutate of [
      (r: MotionRig) => {
        r.joints[1].axisA = [...r.joints[0].axisA!];
      },
      (r: MotionRig) => {
        r.joints[1].bodyA = "another-carrier";
      },
      (r: MotionRig) => {
        if (r.transmissions![0].kind === "worm") r.transmissions![0].starts = 0;
      },
      (r: MotionRig) => {
        Object.assign(r.transmissions![0], { axisSign: 1 });
      },
      (r: MotionRig) => {
        r.transmissions!.push({
          id: "reverse",
          kind: "worm",
          jointA: "wheel",
          jointB: "worm",
          starts: 1,
          teeth: 8,
          direction: -1,
        });
      },
    ]) {
      const bad = structuredClone(rig);
      mutate(bad);
      expect(() => transmissionMap(bad)).toThrow();
    }
  });
});
