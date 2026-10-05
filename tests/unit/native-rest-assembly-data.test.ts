import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { occurrences } from "../../src/core/document";
import {
  add,
  identity,
  inverse,
  mv,
  orthonormalized,
} from "../../src/core/math";
import { validate } from "../../src/core/validate";
import { importLDraw, exportLDraw } from "../../src/ldraw/io";
import {
  KinematicSession,
  rebaseRig,
  validateRig,
} from "../../src/mechanisms/kinematic";
import { physicalPlayEligibility } from "../../src/mechanisms/physical-play";
import type { MotionRig } from "../../src/mechanisms/types";
import { decodeNative, encodeNative } from "../../src/persistence/native";

const fits = [
  { ball: '["n55"]', socket: '["n77"]', endpoint: 1 as const },
  { ball: '["n53"]', socket: '["n79"]', endpoint: 0 as const },
  { ball: '["n75"]', socket: '["n79"]', endpoint: 1 as const },
];
function fixture(fit = fits[0]) {
  const project = importLDraw(
    readFileSync(
      "fixtures/play/official-cars/42043-ball-link-interfaces.ldr",
      "utf8",
    ),
  );
  const all = occurrences(project),
    members = [
      all.find((o) => o.id === fit.socket)!,
      all.find((o) => o.id === fit.ball)!,
    ];
  const rig: MotionRig = {
    schemaVersion: 1,
    id: "seat",
    name: "Original ball assembly",
    mode: "kinematic",
    groups: members.map((o, i) => ({
      id: i ? "ball" : "socket",
      occurrenceIds: [o.id],
      frame: orthonormalized(o.transform),
      restTransforms: { [o.id]: structuredClone(o.transform) },
    })),
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
          ballOccurrenceId: fit.ball,
          socketOccurrenceId: fit.socket,
          socketEndpoint: fit.endpoint,
        },
      },
    ],
  };
  project.motionRigs.seat = rig;
  return { project, rig, all };
}

it("persists all three unchanged source fits without replacing either anchor", async () => {
  for (const fit of fits) {
    const { project, rig } = fixture(fit),
      original = JSON.stringify(project),
      text = exportLDraw(project);
    validate("motionRig", rig);
    validateRig(project, rig);
    const restored = await decodeNative(await encodeNative(project));
    expect(restored.motionRigs.seat).toEqual(rig);
    validateRig(restored, restored.motionRigs.seat);
    expect(JSON.stringify(project)).toBe(original);
    expect(exportLDraw(restored)).toBe(text);
  }
});

it("keeps undeclared coincidence strict and bounds declared construction by Euclidean distance", () => {
  const { project, rig } = fixture();
  const ordinary = structuredClone(rig);
  delete ordinary.joints[0].restAssembly;
  expect(() => validateRig(project, ordinary)).toThrow(/coincide/);
  const excessive = structuredClone(rig);
  excessive.joints[0].anchorB[0] += 10;
  expect(() => validateRig(project, excessive)).toThrow(/envelope/);
});

it("refuses forged membership, invalid endpoint and non-spherical declarations", () => {
  const { project, rig } = fixture();
  for (const change of [
    (r: MotionRig) => {
      r.joints[0].restAssembly!.ballOccurrenceId =
        r.joints[0].restAssembly!.socketOccurrenceId;
    },
    (r: MotionRig) => {
      r.joints[0].restAssembly!.socketOccurrenceId = '["missing"]';
    },
    (r: MotionRig) => {
      Object.assign(r.joints[0].restAssembly!, { socketEndpoint: 2 });
    },
    (r: MotionRig) => {
      r.joints[0].kind = "fixed";
    },
    (r: MotionRig) => {
      Object.assign(r.joints[0].restAssembly!, { ready: true });
    },
  ]) {
    const bad = structuredClone(rig);
    change(bad);
    expect(() => validateRig(project, bad)).toThrow();
  }
  for (const incompatible of [
    { axisA: [0, 1, 0] },
    { limits: [0, 90] },
    { mating: { radiusLdu: 4, halfLengthLdu: 4 } },
    {
      motor: {
        mode: "velocity",
        target: 90,
        maxEffort: { value: 1, unit: "N*m" },
      },
    },
  ]) {
    const bad = structuredClone(rig);
    Object.assign(bad.joints[0], incompatible);
    expect(() => validate("motionRig", bad)).toThrow();
    expect(() => validateRig(project, bad)).toThrow();
  }
});

it("keeps a mixed kinematic assembly at source rest and rejects movement and anchor rebasing atomically", () => {
  const { project, rig, all } = fixture();
  const third = all.find(
    (o) => !rig.groups.some((g) => g.occurrenceIds.includes(o.id)),
  )!;
  rig.groups.push({
    id: "manual",
    frame: identity(),
    occurrenceIds: [third.id],
    restTransforms: { [third.id]: structuredClone(third.transform) },
  });
  const socket = rig.groups[0].frame;
  rig.joints.push({
    id: "manual-turn",
    kind: "revolute",
    bodyA: "socket",
    bodyB: "manual",
    anchorA: [0, 0, 0],
    anchorB: [...socket.position],
    axisA: [0, 1, 0],
    axisB: mv(socket.basis, [0, 1, 0]),
    limits: [-45, 45],
  });
  const session = new KinematicSession(project, rig.id),
    before = session.snapshot();
  session.stepTicks(360);
  expect(session.snapshot().transforms).toEqual(before.transforms);
  expect(session.snapshot().warnings.join(" ")).toMatch(/native seating/);
  expect(() => session.setJointPosition("manual-turn", 10)).toThrow(/settle/);
  expect(() =>
    session.setPose({ jointPositions: { "manual-turn": 10 } }),
  ).toThrow(/settle/);
  expect(session.snapshot().pose).toEqual(before.pose);
  expect(() => rebaseRig(rig, before)).toThrow(/source anchors/);
  session.setPose(before.pose);
});

it("a declaration cannot grant ordinary control eligibility even with coincident anchors", () => {
  const { project, rig, all } = fixture();
  const [socket, ball] = rig.groups,
    inv = inverse(ball.frame);
  const world = add(
    socket.frame.position,
    mv(socket.frame.basis, rig.joints[0].anchorA),
  );
  rig.joints[0].anchorB = add(inv.position, mv(inv.basis, world));
  validateRig(project, rig);
  expect(physicalPlayEligibility(project, rig, all)).toEqual({
    eligible: false,
    reason:
      "This source assembly must finish native seating before its controls are available.",
  });
});
