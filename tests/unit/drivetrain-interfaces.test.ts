import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import { DoubleSide, Mesh, Raycaster, Vector3 } from "three";
import {
  registerFullLibraryFromDisk,
  fullLibrarySources,
} from "../../scripts/full-library-node";
import { occurrences } from "../../src/core/document";
import { compose } from "../../src/core/math";
import type { Occurrence } from "../../src/core/types";
import { importLDraw } from "../../src/ldraw/io";
import { axisRotation } from "../../src/mechanisms/kinematic";
import {
  bindDrivetrainSources,
  drivetrainInterfaces,
  pfLargeMotorContacts,
  clutchSelectorState,
  type DrivetrainSourceBinding,
} from "../../src/mechanisms/drivetrain-interfaces";
import { DRIVETRAIN_SOURCES } from "../../src/mechanisms/drivetrain-sources";
import { compileOfficialPart } from "../helpers/compile-part";
let binding: DrivetrainSourceBinding;
const refs = [
  "99499.dat",
  "48989.dat",
  "2780.dat",
  "3705.dat",
  "3707.dat",
  "18946.dat",
  "18947.dat",
  "18948.dat",
] as const;
beforeAll(async () => {
  expect(registerFullLibraryFromDisk()).toBe(true);
  binding = await bindDrivetrainSources(fullLibrarySources(refs), refs);
});
const fixture = (set: string) => {
  const project = importLDraw(
    readFileSync(`fixtures/ldraw/technic/${set}-drivetrain.ldr`, "utf8"),
  );
  const all = occurrences(project);
  const part = (ref: string) =>
    all.find((o) => o.node.kind === "part" && o.node.ref === ref)!;
  const iface = (o: Occurrence) => drivetrainInterfaces(o, binding)!;
  return { project, all, part, iface };
};
describe("source-bound PF-L and selector interfaces", () => {
  it("binds the complete pinned dependency closure, refusing altered subparts and spoofed identities", async () => {
    const sources = fullLibrarySources(["99499.dat"]);
    expect(DRIVETRAIN_SOURCES["99499.dat"].files).toBe(76);
    await expect(
      bindDrivetrainSources(
        { ...sources, "10095.dat": sources["10095.dat"] + "\n0 changed" },
        ["99499.dat"],
      ),
    ).rejects.toThrow("geometry changed");
    const f = fixture("42042"),
      o = f.part("99499.dat");
    expect(
      drivetrainInterfaces({ ...o, namespace: "project" }, binding),
    ).toBeUndefined();
    expect(drivetrainInterfaces(o, { refs: ["99499.dat"] })).toBeUndefined();
    expect(Object.isFrozen(f.iface(o).socket!.center)).toBe(true);
  });
  it.each(["42042", "42043"])(
    "proves actual %s motor pin seats and inserted axle without changing source",
    (set) => {
      const f = fixture(set),
        before = JSON.stringify(f.project),
        motor = f.iface(f.part("99499.dat"));
      const supports = f.all
        .filter(
          (o) =>
            o.node.kind === "part" &&
            ["2780.dat", "48989.dat"].includes(o.node.ref),
        )
        .map(f.iface);
      const shaft = f.iface(f.part(set === "42042" ? "3705.dat" : "3707.dat"));
      const proof = pfLargeMotorContacts(motor, supports, shaft);
      expect(proof.mounts).toHaveLength(set === "42042" ? 2 : 4);
      expect(proof.engagementLdu).toBe(20);
      expect(Math.abs(proof.rotorRestPhaseDegrees)).toBeCloseTo(
        set === "42042" ? 8 : 15.01,
        2,
      );
      expect(motor.components).toEqual([
        {
          id: "case",
          sourcePath: ["99499.dat", "10089c01.dat"],
          rotates: false,
        },
        { id: "output", sourcePath: ["99499.dat", "10095.dat"], rotates: true },
      ]);
      expect(JSON.stringify(f.project)).toBe(before);
    },
  );
  it("refuses floating, partially inserted, off-axis and closed-back-crossing motor witnesses", () => {
    const f = fixture("42042"),
      motor = f.iface(f.part("99499.dat")),
      block = f.iface(f.part("48989.dat")),
      o = f.part("3705.dat");
    expect(() => pfLargeMotorContacts(motor, [], f.iface(o))).toThrow(
      "two distinct",
    );
    for (const [delta, message] of [
      [[1, 0, 0], "off-axis"],
      [[0, 0, 15], "closed back"],
      [[0, 0, -3], "closed back"],
    ] as const) {
      const changed = structuredClone(o);
      changed.transform.position = changed.transform.position.map(
        (x, i) => x + delta[i],
      ) as typeof changed.transform.position;
      expect(() =>
        pfLargeMotorContacts(motor, [block], f.iface(changed)),
      ).toThrow(message);
    }
    expect(() =>
      pfLargeMotorContacts({ ...motor }, [block], f.iface(o)),
    ).toThrow("actual source");
  });
  it("independently ray-checks the actual output cap and front pin-bore cylinders", async () => {
    const prepare = async (ref: string) => {
      const g = await compileOfficialPart(ref);
      g.updateMatrixWorld(true);
      g.traverse((o) => {
        if (o instanceof Mesh)
          for (const m of Array.isArray(o.material) ? o.material : [o.material])
            m.side = DoubleSide;
      });
      return g;
    };
    const hub = await prepare("10095.dat");
    const hits = new Raycaster(
      new Vector3(0, 0, -1),
      new Vector3(0, 0, 1),
    ).intersectObject(hub, true);
    //Usable keyed channel0..20; the literal closed hub cap starts at22.
    expect(hits[0].point.z).toBeCloseTo(22, 4);
    const front = await prepare("10090.dat");
    for (const z of [3, 10, 17]) {
      const hit = new Raycaster(
        new Vector3(20, 0, z),
        new Vector3(1, 0, 0),
      ).intersectObject(front, true)[0];
      expect(hit.point.x).toBeCloseTo(26, 4);
    }
  });
  it("checks literal engaged dog footprints and the independent compiled pocket shoulders", async () => {
    const sources = fullLibrarySources(["18947.dat", "18946.dat"]);
    const faces = (text: string) =>
      text.split(/\r?\n/).flatMap((line) => {
        const fields = line.trim().split(/\s+/);
        if (!["3", "4"].includes(fields[0])) return [];
        const coords = fields.slice(2).map(Number);
        return [
          Array.from({ length: coords.length / 3 }, (_, i) =>
            coords.slice(i * 3, i * 3 + 3),
          ),
        ];
      });
    // Clip every literal positive-end dog polygon at Z20: the complete
    // source overlap with the positive gear at centre Z40, ring travel10.
    const clip = (poly: number[][]) =>
      poly.flatMap((a, i) => {
        const b = poly[(i + 1) % poly.length],
          result: number[][] = [];
        if (a[2] >= 20) result.push(a);
        if (a[2] < 20 !== b[2] < 20) {
          const t = (20 - a[2]) / (b[2] - a[2]);
          result.push(a.map((x, j) => x + t * (b[j] - x)));
        }
        return result;
      });
    const dogPolygons = faces(sources["18947.dat"])
      .map(clip)
      .filter((poly) => poly.some((p) => Math.hypot(p[0], p[1]) > 11.8751));
    for (const polygon of dogPolygons)
      for (const i of [0, 1])
        expect(
          polygon.every((p) => Math.sign(p[i]) === Math.sign(polygon[0][i])),
        ).toBe(true);
    const dogs = dogPolygons.flat();
    expect(dogs.length).toBeGreaterThan(40);
    const maxRadius = Math.max(...dogs.map((p) => Math.hypot(p[0], p[1])));
    const minTransverse = Math.min(
      ...dogs.map((p) => Math.min(Math.abs(p[0]), Math.abs(p[1]))),
    );
    expect(maxRadius).toBeLessThan(13.584);
    expect(minTransverse).toBeGreaterThan(7.125);
    const nubPolygons = faces(sources["18946.dat"]).filter((poly) =>
      poly.some(
        (p) =>
          Math.abs(p[2]) > 2 &&
          Math.abs(p[2]) < 10 &&
          Math.min(Math.abs(p[0]), Math.abs(p[1])) <= 1.5 &&
          Math.hypot(p[0], p[1]) > 13,
      ),
    );
    expect(nubPolygons).toHaveLength(56);
    for (const polygon of nubPolygons) {
      const transverse =
        Math.abs(polygon[0][0]) < Math.abs(polygon[0][1]) ? 0 : 1;
      expect(
        polygon.every(
          (p) =>
            Math.abs(p[transverse]) <= 1.5 &&
            Math.abs(p[1 - transverse]) >= 13.218,
        ),
      ).toBe(true);
    }
    // All polygon interiors obey these convex coordinate/radius bounds.
    // Even at the admitted .5 degree phase, they clear the gear's axis dogs
    // (transverse +/-1.5) and its 48-sided pocket core at radius14.7171.
    const e = Math.PI / 360;
    expect(
      minTransverse * Math.cos(e) - maxRadius * Math.sin(e),
    ).toBeGreaterThan(1.5);
    expect(maxRadius).toBeLessThan(14.7171 * Math.cos(Math.PI / 48));
    const radialHits = async (ref: string, angle: number) => {
      const g = await compileOfficialPart(ref);
      g.updateMatrixWorld(true);
      g.traverse((o) => {
        if (o instanceof Mesh)
          for (const m of Array.isArray(o.material) ? o.material : [o.material])
            m.side = DoubleSide;
      });
      const a = (angle * Math.PI) / 180;
      return new Raycaster(
        new Vector3(13 * Math.cos(a), 13 * Math.sin(a), -50),
        new Vector3(0, 0, 1),
      )
        .intersectObject(g, true)
        .map((h) => h.point.z);
    };
    expect(
      (await radialHits("18946.dat", 45)).map((z) => Math.round(z)),
    ).toEqual([-2, 2]);
    expect((await radialHits("18946.dat", 0)).some((z) => z < -8)).toBe(true);
    expect((await radialHits("18947.dat", 45)).some((z) => z > 26)).toBe(true);
    expect((await radialHits("18947.dat", 0)).some((z) => z > 20)).toBe(false);
  });
  it.each(["42042", "42043"])(
    "keeps actual %s neutral clutch gears free and derives pocket-limited engagement",
    (set) => {
      const f = fixture(set),
        ring = f.part("18947.dat"),
        coupler = f.iface(f.part("18948.dat")),
        gears = f.all.filter(
          (o) => o.node.kind === "part" && o.node.ref === "18946.dat",
        );
      const before = JSON.stringify(f.project),
        neutral = clutchSelectorState(
          f.iface(ring),
          coupler,
          gears.map(f.iface),
        );
      expect(neutral.state).toBe("neutral");
      expect(neutral.relations).toEqual([]);
      expect(neutral.ringCoupling.kind).toBe("keyed-slide");
      expect(neutral.limits).toEqual(set === "42042" ? [-10, 10] : [-9.5, 9.5]);
      const moved = structuredClone(ring),
        axis = coupler.shaft!.axis;
      moved.transform.position = moved.transform.position.map(
        (x, i) => x + (neutral.limits[1] - neutral.travel) * axis[i],
      ) as typeof moved.transform.position;
      //The original freely rotating gear phase is preserved; only seated aligned dogs couple.
      const target = gears.find(
        (g) =>
          g.transform.position.reduce(
            (sum, x, i) => sum + (x - coupler.shaft!.center[i]) * axis[i],
            0,
          ) > 0,
      )!;
      const aligned = structuredClone(target);
      const ringKey = f.iface(moved).selector!.axis.keyDirection!,
        gearKey = f.iface(target).clutch!.axis.keyDirection!,
        gearAxis = f.iface(target).clutch!.axis.axis;
      const cross = [
        gearKey[1] * ringKey[2] - gearKey[2] * ringKey[1],
        gearKey[2] * ringKey[0] - gearKey[0] * ringKey[2],
        gearKey[0] * ringKey[1] - gearKey[1] * ringKey[0],
      ];
      const angle =
        (Math.atan2(
          cross.reduce((s, x, i) => s + x * gearAxis[i], 0),
          gearKey.reduce((s, x, i) => s + x * ringKey[i], 0),
        ) *
          180) /
        Math.PI;
      aligned.transform = compose(aligned.transform, {
        position: [0, 0, 0],
        basis: axisRotation([0, 0, 1], angle),
      });
      const selected = clutchSelectorState(
        f.iface(moved),
        coupler,
        gears.map((g) => f.iface(g.id === target.id ? aligned : g)),
      );
      expect(selected.state).toBe("engaged");
      expect(selected.relations).toHaveLength(1);
      expect(selected.relations[0].b).toBe(target.id);
      const wrongPhase = structuredClone(aligned);
      wrongPhase.transform = compose(wrongPhase.transform, {
        position: [0, 0, 0],
        basis: axisRotation([0, 0, 1], 45),
      });
      const blocked = clutchSelectorState(
        f.iface(moved),
        coupler,
        gears.map((g) => f.iface(g.id === target.id ? wrongPhase : g)),
      );
      expect(blocked.state).toBe("blocked-phase");
      expect(blocked.relations).toEqual([]);
      const entering = structuredClone(moved);
      entering.transform.position = entering.transform.position.map(
        (x, i) => x - 5 * axis[i],
      ) as typeof entering.transform.position;
      const partial = clutchSelectorState(
        f.iface(entering),
        coupler,
        gears.map((g) => f.iface(g.id === target.id ? aligned : g)),
      );
      expect(partial.state).toBe("entering");
      expect(partial.relations).toEqual([]);
      moved.transform.position = moved.transform.position.map(
        (x, i) => x + 0.001 * axis[i],
      ) as typeof moved.transform.position;
      expect(() =>
        clutchSelectorState(f.iface(moved), coupler, gears.map(f.iface)),
      ).toThrow("shoulder");
      expect(JSON.stringify(f.project)).toBe(before);
    },
  );
});
