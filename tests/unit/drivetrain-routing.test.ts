import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import { Mesh, DoubleSide, Raycaster, Vector3 } from "three";
import { compileOfficialPart } from "../helpers/compile-part";
import {
  registerFullLibraryFromDisk,
  fullLibrarySources,
} from "../../scripts/full-library-node";
import { occurrences } from "../../src/core/document";
import { compose } from "../../src/core/math";
import { importLDraw } from "../../src/ldraw/io";
import type { Occurrence } from "../../src/core/types";
import { axisRotation } from "../../src/mechanisms/kinematic";
import {
  bindDrivetrainSources,
  drivetrainInterfaces,
  type DrivetrainSourceBinding,
} from "../../src/mechanisms/drivetrain-interfaces";
import {
  wormRouting,
  bevelRouting,
  differentialRouting,
} from "../../src/mechanisms/drivetrain-routing";
let binding: DrivetrainSourceBinding;
const refs = [
  "4716.dat",
  "10928.dat",
  "32270.dat",
  "6589.dat",
  "87407.dat",
  "62821.dat",
] as const;
beforeAll(async () => {
  registerFullLibraryFromDisk();
  binding = await bindDrivetrainSources(fullLibrarySources(refs), refs);
});
const fixture = (set: string) => {
  const project = importLDraw(
    readFileSync(`fixtures/ldraw/technic/${set}-routing.ldr`, "utf8"),
  );
  const all = occurrences(project);
  const iface = (o: Occurrence) => drivetrainInterfaces(o, binding)!;
  return { project, all, iface };
};
describe("source-seated drivetrain routing", () => {
  it("derives both actual crane worm reductions and preserves imported source/rest", () => {
    const f = fixture("42042"),
      before = JSON.stringify(f.project);
    const worms = f.all.filter((o) => o.node.ref === "4716.dat"),
      gears = f.all.filter((o) => o.node.ref === "10928.dat");
    expect(worms).toHaveLength(2);
    for (const worm of worms) {
      const gear = gears.find(
        (g) => g.transform.position[0] === worm.transform.position[0],
      )!;
      const relation = wormRouting(f.iface(worm), f.iface(gear));
      expect(relation.ratio).toBe(0.125);
      expect(relation.centerDistanceLdu).toBe(20);
      expect(Math.abs(relation.threadStationLdu)).toBe(10);
      expect(relation.requiresRetainedCarriers).toBe(true);
      const far = structuredClone(gear);
      far.transform.position[1] -= 1;
      expect(() => wormRouting(f.iface(worm), f.iface(far))).toThrow(
        "thread seat",
      );
    }
    expect(JSON.stringify(f.project)).toBe(before);
  });
  it("checks literal single-start helix lead and handedness rather than naming any cylinder a worm", () => {
    const s = fullLibrarySources(["4716.dat"]);
    const thread = s["s/4716s01.dat"];
    expect(thread).toContain("0 12.7 -2");
    expect(thread).toContain("-12.7 0 0");
    // The same crest advances Z2 over a positive quarter-turn; body repeats at8.
    const crest = [
      [0, 12.7, -2],
      [-4.8601, 11.7333, -1.5],
      [-8.9803, 8.9803, -1],
      [-11.7333, 4.8601, -0.5],
      [-12.7, 0, 0],
    ];
    for (const point of crest)
      expect(thread).toContain(
        point.map((x) => (x === -0.5 ? "-.5" : String(x))).join(" "),
      );
    const start = Math.atan2(crest[0][1], crest[0][0]),
      end = Math.atan2(crest[4][1], crest[4][0]);
    expect(((crest[4][2] - crest[0][2]) * 2 * Math.PI) / (end - start)).toBe(8);
    expect(s["s/4716s02.dat"]).toContain(
      "0 0 -12 -1 0 0 0 -1 0 0 0 1 s\\4716s01.dat",
    );
  });
  it("routes actual opposed twelve-tooth and 12:20 bevel faces, retaining rotated source placement", () => {
    const f = fixture("42043"),
      parts = f.all.filter((o) =>
        ["32270.dat", "87407.dat"].includes(o.node.ref),
      );
    let count = 0;
    for (const a of parts)
      for (const b of f.all.filter((o) => o.node.ref === "6589.dat")) {
        let relation;
        try {
          relation = bevelRouting(f.iface(a), f.iface(b));
        } catch (error) {
          if (
            !(error instanceof Error) ||
            !["apex seat", "orthogonal source axes"].some((message) =>
              error.message.includes(message),
            )
          )
            throw error;
          continue;
        }
        expect(Math.abs(relation.ratio)).toBe(
          a.node.ref === "87407.dat" ? 20 / 12 : 1,
        );
        expect(relation.sourceAxisGapLdu).toBeLessThan(0.05);
        expect(
          bevelRouting(f.iface(b), f.iface(a)).ratio * relation.ratio,
        ).toBeCloseTo(1, 12);
        count++;
      }
    expect(count).toBe(4);
    const a = parts.find((o) => o.node.ref === "32270.dat")!,
      b = f.all.find((o) => {
        if (o.node.ref !== "6589.dat") return false;
        try {
          bevelRouting(f.iface(a), f.iface(o));
          return true;
        } catch {
          return false;
        }
      })!;
    const world = {
      position: [300, -200, 75] as [number, number, number],
      basis: axisRotation([0, 1, 0], 37),
    };
    const posed = (o: Occurrence) => ({
      ...o,
      transform: compose(world, o.transform),
    });
    expect(
      bevelRouting(f.iface(posed(a)), f.iface(posed(b))).ratio,
    ).toBeCloseTo(bevelRouting(f.iface(a), f.iface(b)).ratio, 10);
    const wrong = structuredClone(b);
    wrong.transform = compose(wrong.transform, {
      position: [0, 0, 0],
      basis: axisRotation([1, 0, 0], 180),
    });
    expect(() => bevelRouting(f.iface(a), f.iface(wrong))).toThrow("apex seat");
  });
  it("independently checks the actual carrier spider pin inside the gear's keyed core", async () => {
    const prepare = async (ref: string) => {
      const group = await compileOfficialPart(ref);
      group.updateMatrixWorld(true);
      group.traverse((o) => {
        if (o instanceof Mesh)
          for (const material of Array.isArray(o.material)
            ? o.material
            : [o.material])
            material.side = DoubleSide;
      });
      return group;
    };
    const carrier = await prepare("62821.dat"),
      gear = await prepare("6589.dat");
    const pin = new Raycaster(
      new Vector3(0, -15, 0),
      new Vector3(1, 0, 0),
    ).intersectObject(carrier, true)[0];
    expect(pin.point.x).toBeCloseTo(3, 5);
    const bore = new Raycaster(
      new Vector3(0, 0, 3),
      new Vector3(Math.SQRT1_2, Math.SQRT1_2, 0),
    ).intersectObject(gear, true)[0];
    expect(bore.distance).toBeCloseTo(Math.sqrt(12.5), 5);
    expect(bore.distance - pin.point.x).toBeGreaterThan(0.5);
  });
  it("keeps both actual Arocs differentials as three-port constraints with an independently spinning spider", () => {
    const f = fixture("42043"),
      before = JSON.stringify(f.project),
      carriers = f.all.filter((o) => o.node.ref === "62821.dat");
    expect(carriers).toHaveLength(2);
    for (const carrier of carriers) {
      const gears = f.all.filter(
        (o) =>
          o.node.ref === "6589.dat" &&
          Math.abs(o.transform.position[2] - carrier.transform.position[2]) <
            0.1,
      );
      const r = differentialRouting(f.iface(carrier), gears.map(f.iface));
      expect(r.equation.terms.map((t) => t.coefficient)).toEqual([1, -1, -2]);
      expect(r.meshes.map((m) => m.ratio)).toEqual([-1, -1]);
      expect(r.requiresRetainedSideShafts).toBe(true);
      const sum = (a: number, b: number, c: number) =>
        r.equation.terms.reduce(
          (s, t, i) => s + t.coefficient * [a, b, c][i],
          0,
        );
      expect(sum(10, -10, 10)).toBe(0);
      expect(sum(4, -16, 10)).toBe(0);
      expect(sum(0, -20, 10)).toBe(0);
      const loose = structuredClone(gears);
      loose[0].transform.position[1] += 1;
      expect(() =>
        differentialRouting(f.iface(carrier), loose.map(f.iface)),
      ).toThrow("source seat");
      expect(() =>
        differentialRouting(f.iface(carrier), gears.slice(0, 2).map(f.iface)),
      ).toThrow("three bevel");
    }
    expect(JSON.stringify(f.project)).toBe(before);
  });
});
