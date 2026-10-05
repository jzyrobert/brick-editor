import { readFileSync } from "node:fs";
import { beforeAll, expect, it } from "vitest";
import {
  BufferAttribute,
  BufferGeometry,
  DoubleSide,
  Mesh,
  MeshBasicMaterial,
  Raycaster,
  Vector3,
} from "three";
import { importLDraw } from "../../src/ldraw/io";
import { occurrences } from "../../src/core/document";
import { add, compose, mv } from "../../src/core/math";
import { axisRotation } from "../../src/mechanisms/kinematic";
import {
  fullLibrarySources,
  registerFullLibraryFromDisk,
} from "../../scripts/full-library-node";
import {
  bindWinchCarrierSources,
  winchCarrierPlan,
  isWinchCarrierPlan,
} from "../../src/mechanisms/winch-carrier";
import { memberLocalOf } from "../helpers/play-dynamic-source";
const project = () =>
  importLDraw(
    readFileSync("fixtures/ldraw/technic/42042-mounted-winch.ldr", "utf8"),
  );
beforeAll(() => registerFullLibraryFromDisk());

it("keeps the real mounted carrier, six shafts and all neighbouring hardware separate", async () => {
  const p = project(),
    before = JSON.stringify(p),
    all = occurrences(p),
    binding = await bindWinchCarrierSources(
      fullLibrarySources(all.map((o) => o.node.ref)),
      p,
    ),
    worm = all.find((o) => o.node.ref === "4716.dat")!,
    plan = winchCarrierPlan(worm, all, binding);
  expect(plan.bodies).toHaveLength(29);
  expect(plan.mountHolderIds).toHaveLength(2);
  expect(plan.bearings).toHaveLength(38);
  expect(plan.bearings.filter((c) => c.kind === "keyed")).toHaveLength(20);
  expect(plan.keyRows).toHaveLength(20);
  expect(
    plan.bearings.every((c) => c.axialFreedom && c.engagementLdu > 0),
  ).toBe(true);
  expect(plan.heads).toHaveLength(3);
  expect(plan.heads.every((h) => h.lowerLdu === 0 && h.upperLdu === null)).toBe(
    true,
  );
  expect(plan.ordinaryAdmission).toBe(false);
  expect(isWinchCarrierPlan(plan)).toBe(true);
  expect(isWinchCarrierPlan(structuredClone(plan))).toBe(false);
  const inputPin = plan.bearings.filter((c) =>
    c.shaft.feature.startsWith("2780"),
  );
  expect(inputPin.map((c) => c.engagementLdu)).toEqual([10, 10, 20]);
  const roots = plan.bearings.filter((c) =>
    plan.mountHolderIds.includes(c.bore.occurrenceId),
  );
  expect(roots).toHaveLength(2);
  expect(roots.every((c) => c.engagementLdu === 20 && c.frictionFit)).toBe(
    true,
  );
  const frames = new Map(plan.bodies.map((b) => [b.occurrenceId, b.frame])),
    reached = new Set(plan.mountHolderIds);
  for (let i = 0; i < 29; i++)
    for (const b of plan.bearings)
      if (
        reached.has(b.shaft.occurrenceId) ||
        reached.has(b.bore.occurrenceId)
      ) {
        reached.add(b.shaft.occurrenceId);
        reached.add(b.bore.occurrenceId);
      }
  expect(reached.size).toBe(29);
  for (const b of plan.bearings) {
    const a = frames.get(b.native.bodyA)!,
      c = frames.get(b.native.bodyB)!,
      pa = add(a.position, mv(a.basis, b.native.anchorA)),
      pb = add(c.position, mv(c.basis, b.native.anchorB));
    expect(Math.hypot(...pa.map((n, i) => n - pb[i]))).toBeLessThan(1e-9);
    expect(b.native.kind).toBe("cylindrical");
  }
  const irrelevant = Array.from({ length: 600 }, (_, i) => ({
    ...all[0],
    id: "foreign" + i,
    node: { ...all[0].node, ref: "3001.dat" },
  }));
  expect(
    winchCarrierPlan(worm, [...all, ...irrelevant], binding).bodies,
  ).toHaveLength(29);
  expect(JSON.stringify(p)).toBe(before);
});

it("independently measures real pin catch/collar seats and the carrier's unilateral axle heads", async () => {
  const surface = async (ref: string) => {
      const p = importLDraw(
          `0 Source contact witness\n0 !COLOUR TestGrey CODE 71 VALUE #888888 EDGE #333333\n1 71 0 0 0 1 0 0 0 1 0 0 0 1 ${ref}\n`,
        ),
        local = await memberLocalOf(
          p,
          occurrences(p)[0].id,
          fullLibrarySources([ref]),
        ),
        geometry = new BufferGeometry().setAttribute(
          "position",
          new BufferAttribute(local.vertices, 3),
        );
      geometry.setIndex(new BufferAttribute(local.indices, 1));
      return new Mesh(geometry, new MeshBasicMaterial({ side: DoubleSide }));
    },
    pin = await surface("2780.dat"),
    stop = await surface("87083.dat"),
    thin = await surface("32449.dat"),
    thick = await surface("32525.dat"),
    cast = (mesh: Mesh, origin: number[], direction: number[]) =>
      new Raycaster(
        new Vector3(...origin),
        new Vector3(...direction),
      ).intersectObject(mesh)[0]?.point;
  try {
    const r = 6.4 / Math.SQRT2,
      c = 7 / Math.SQRT2;
    expect(cast(pin, [3, r, r], [1, 0, 0])?.x).toBeCloseTo(18, 5);
    expect(cast(pin, [-3, r, r], [-1, 0, 0])?.x).toBeCloseTo(-18, 5);
    expect(cast(pin, [0, c, c], [1, 0, 0])?.x).toBeCloseTo(2, 5);
    expect(cast(pin, [0, c, c], [-1, 0, 0])?.x).toBeCloseTo(-2, 5);
    expect(cast(stop, [0, c, c], [1, 0, 0])?.x).toBeCloseTo(38, 5);
    // Peg-end negatives preserve the actual2-LDU counterbore lips. Two
    // adjacent thin holes span the same20-LDU pin half as one thick hole.
    expect(cast(thin, [7, 0, -10], [0, 1, 0])?.y).toBeCloseTo(3, 5);
    expect(cast(thick, [7, 0, 0], [0, 1, 0])?.y).toBeCloseTo(8, 5);
  } finally {
    for (const mesh of [pin, stop, thin, thick]) {
      mesh.geometry.dispose();
      (mesh.material as MeshBasicMaterial).dispose();
    }
  }
});

it("requires actual coaxial source mount holes, immutable closures and unambiguous holders", async () => {
  const p = project(),
    all = occurrences(p),
    sources = fullLibrarySources(all.map((o) => o.node.ref)),
    binding = await bindWinchCarrierSources(sources, p),
    worm = all.find((o) => o.node.ref === "4716.dat")!,
    root = all.find((o) => o.node.ref === "40490.dat")!;
  expect(() =>
    winchCarrierPlan(
      worm,
      all.filter((o) => o.id !== root.id),
      binding,
    ),
  ).toThrow("mounted winch source seat");
  const wrong = structuredClone(all);
  wrong.find((o) => o.id === root.id)!.transform.position[0] += 1;
  expect(() => winchCarrierPlan(worm, wrong, binding)).toThrow(
    "mounted winch source seat",
  );
  expect(() =>
    winchCarrierPlan(
      worm,
      [...all, { ...root, id: "duplicate-root" }],
      binding,
    ),
  ).toThrow("ambiguous");
  const frame = {
      position: [31, -8, 14] as [number, number, number],
      basis: axisRotation([0, 1, 0], 37),
    },
    rotated = all.map((o) => ({
      ...o,
      transform: compose(frame, o.transform),
    }));
  expect(
    winchCarrierPlan(rotated.find((o) => o.id === worm.id)!, rotated, binding)
      .bodies,
  ).toHaveLength(29);
  await expect(
    bindWinchCarrierSources(
      {
        ...sources,
        "beamhole.dat": sources["beamhole.dat"] + "\n3 16 0 0 0 1 0 0 0 1 0",
      },
      p,
    ),
  ).rejects.toThrow("geometry changed");
  const shadow = importLDraw(
    "0 FILE mounted.ldr\n" +
      readFileSync("fixtures/ldraw/technic/42042-mounted-winch.ldr", "utf8") +
      "\n0 NOFILE\n0 FILE beamhole.dat\n0 Unverified embedded copied bore\n0 NOFILE\n",
  );
  await expect(bindWinchCarrierSources(sources, shadow)).rejects.toThrow(
    "shadows",
  );
});
