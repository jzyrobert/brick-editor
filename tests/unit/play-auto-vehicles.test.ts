import { beforeAll, describe, expect, it } from "vitest";
import { carProject, carSource } from "../../src/catalog/builds/car";
import { jeepProject } from "../../src/catalog/builds/jeep";
import { trainProject } from "../../src/catalog/builds/train";
import { occurrences } from "../../src/core/document";
import { compose, rotationY } from "../../src/core/math";
import type { Occurrence, Project } from "../../src/core/types";
import { exportLDraw, importLDraw } from "../../src/ldraw/io";
import { partsList } from "../../src/inventory/parts-list";
import { KinematicSession, validateRig } from "../../src/mechanisms/kinematic";
import {
  deriveVehicleRigs,
  checkAuthoredVehicleSource,
  AUTO_VEHICLE_LIMITS,
} from "../../src/play/auto-vehicles";
import { occurrenceBounds } from "../../src/play/trains";
import {
  registerFullLibraryFromDisk,
  fullLibrarySources,
} from "../../scripts/full-library-node";
import { meshOf } from "../helpers/play-dynamic-source";

beforeAll(() => expect(registerFullLibraryFromDisk()).toBe(true));
const unrigged = (factory = carProject) => {
  const p = factory();
  p.motionRigs = {};
  return p;
};
const derive = (
  p: Project,
  options: Partial<Parameters<typeof deriveVehicleRigs>[1]> = {},
) =>
  deriveVehicleRigs(p, {
    reserved: new Set(),
    maxRigs: 32,
    maxGroups: 128,
    ...options,
  });
const ref = (o: Occurrence) => o.node.ref.replace(/\.dat$/i, "");
const changed = (p: Project, mutate: (all: Occurrence[]) => void) => {
  const all = structuredClone(occurrences(p));
  mutate(all);
  return derive(p, { all });
};

describe("source-backed road vehicles", () => {
  for (const [name, factory, length] of [
    ["car", carProject, 160],
    ["jeep", jeepProject, 180],
  ] as const) {
    it(`derives an unrigged ${name} without changing source, rest poses or inventory`, () => {
      const p = unrigged(factory),
        source = exportLDraw(p),
        json = JSON.stringify(p),
        inventory = partsList(p, occurrences(p)),
        all = occurrences(p),
        result = derive(p);
      expect(result.skipped).toEqual([]);
      expect(result.vehicles).toHaveLength(1);
      const rig = Object.values(result.rigs)[0];
      expect(rig.joints).toEqual([]);
      expect(rig.groups).toHaveLength(5);
      expect(rig.vehicle?.driverSeat).toBeUndefined();
      expect(rig.vehicle?.wheelbase).toBe(length);
      const members = rig.groups.flatMap((g) => g.occurrenceIds);
      expect(new Set(members).size).toBe(members.length);
      expect([...members].sort()).toEqual(all.map((o) => o.id).sort());
      const ephemeral = { ...p, motionRigs: result.rigs };
      expect(() => validateRig(ephemeral, rig)).not.toThrow();
      const k = new KinematicSession(ephemeral, rig.id),
        rest = k.snapshot();
      for (const o of all) expect(rest.transforms[o.id]).toEqual(o.transform);
      k.setVehicleInput({ throttle: 1, steering: 0 });
      k.stepTicks(60);
      expect(k.snapshot().groupFrames.chassis.position[2]).toBeLessThan(
        rest.groupFrames.chassis.position[2] - 100,
      );
      expect(JSON.stringify(p)).toBe(json);
      expect(exportLDraw(p)).toBe(source);
      expect(partsList(p, occurrences(p))).toEqual(inventory);
      if (name === "jeep") {
        const spare = all.filter(
          (o) =>
            ["6014b", "56890"].includes(ref(o)) &&
            !result.vehicles[0].wheelOccurrenceIds.includes(o.id),
        );
        expect(spare).toHaveLength(2);
        expect(
          spare.every((o) => rig.groups[0].occurrenceIds.includes(o.id)),
        ).toBe(true);
      }
    });
  }
  it("keeps independent imported cars separate without claiming the whole world", () => {
    const source = `0 FILE fleet.ldr\n1 16 -180 0 0 1 0 0 0 1 0 0 0 1 roadster.mpd\n1 16 180 0 0 1 0 0 0 1 0 0 0 1 roadster.mpd\n1 16 0 0 300 1 0 0 0 1 0 0 0 1 3001.dat\n${carSource()}`;
    const p = importLDraw(source),
      r = derive(p);
    expect(r.vehicles).toHaveLength(2);
    const ids = r.vehicles.flatMap((v) => v.occurrenceIds);
    expect(new Set(ids).size).toBe(ids.length);
    const scenery = occurrences(p).find((o) => o.path.length === 1)!;
    expect(ids).not.toContain(scenery.id);
    expect(derive(p, { maxRigs: 1, maxGroups: 5 }).vehicles).toHaveLength(1);
  });
  it("keeps authored cars and their yaw, and leaves reserved members to their existing owner", () => {
    for (const factory of [carProject, jeepProject]) {
      const p = factory(),
        rig = Object.values(p.motionRigs)[0];
      expect(checkAuthoredVehicleSource(p, rig)).toEqual({ eligible: true });
      const all = occurrences(p),
        reserved = new Set(all.map((o) => o.id));
      expect(derive(p, { reserved })).toEqual({
        rigs: {},
        vehicles: [],
        skipped: [],
      });
      const turn = {
        position: [100, 0, 40] as [number, number, number],
        basis: rotationY(37),
      };
      const rotated = all.map((o) => ({
          ...o,
          transform: compose(turn, o.transform),
        })),
        authored = structuredClone(rig);
      for (const g of authored.groups) g.frame = compose(turn, g.frame);
      expect(checkAuthoredVehicleSource(p, authored, rotated)).toEqual({
        eligible: true,
      });
      expect(derive(p, { all: rotated }).vehicles).toHaveLength(0);
    }
  });
  it("encloses the radial vertices of the actual pinned tyres", async () => {
    for (const [part, radius] of [
      ["3641", 18.001],
      ["56890", 30.001],
    ] as const) {
      const p = importLDraw(`1 16 0 0 0 1 0 0 0 1 0 0 0 1 ${part}.dat`),
        m = await meshOf(
          p,
          occurrences(p).map((o) => o.id),
          fullLibrarySources([part + ".dat"]),
        );
      expect(m.vertices.length).toBeGreaterThan(100);
      for (let i = 0; i < m.vertices.length; i += 3)
        expect(
          Math.hypot(m.vertices[i], m.vertices[i + 1]),
        ).toBeLessThanOrEqual(radius);
    }
  });
  it("does not mistake trains or unrelated root scenery for a road chassis", () => {
    const train = trainProject();
    expect(derive(train).vehicles).toHaveLength(0);
    const p = unrigged(),
      all = occurrences(p),
      scenery = structuredClone(all.find((o) => ref(o) === "3031")!);
    scenery.id = "root-scenery";
    scenery.path = [scenery.id];
    scenery.transform.position = [120, -48, 0];
    const r = derive(p, { all: [...all, scenery] });
    expect(r.vehicles).toHaveLength(1);
    expect(r.vehicles[0].occurrenceIds).not.toContain(scenery.id);
  });
  it("refuses missing, overlapping, unmounted or borrowed-name wheels", () => {
    const p = unrigged();
    for (const mutate of [
      (all: Occurrence[]) => {
        all.splice(
          all.findIndex((o) => ref(o) === "3641"),
          1,
        );
      },
      (all: Occurrence[]) => {
        const t = structuredClone(all.find((o) => ref(o) === "3641")!);
        t.id += "duplicate";
        all.push(t);
      },
      (all: Occurrence[]) => {
        all.find((o) => ref(o) === "4624")!.transform.position[0] += 3;
      },
      (all: Occurrence[]) => {
        all.find((o) => ref(o) === "4624")!.namespace = "project";
      },
    ])
      expect(changed(p, mutate).vehicles).toHaveLength(0);
    const all = occurrences(p),
      blocked = all.find((o) => ref(o) === "4600")!;
    expect(
      derive(p, { reserved: new Set([blocked.id]) }).vehicles,
    ).toHaveLength(0);
    expect(
      derive(p, {
        included: new Set(
          all.filter((o) => ref(o) !== "3641").map((o) => o.id),
        ),
      }).vehicles,
    ).toHaveLength(0);
  });
  it("requires connected holders, stable parallel axles and a level supported wheelbase", () => {
    const p = unrigged();
    const disconnected = changed(p, (all) => {
      for (const o of all)
        if (!["4600", "4624", "3641"].includes(ref(o)))
          o.transform.position[1] -= 80;
    });
    expect(disconnected.vehicles).toHaveLength(0);
    expect(
      changed(p, (all) => {
        const rear = all.filter(
          (o) =>
            ["4600", "4624", "3641"].includes(ref(o)) &&
            o.transform.position[2] > 0,
        );
        for (const o of rear) o.transform.position[0] += 5;
      }).vehicles,
    ).toHaveLength(0);
    expect(
      changed(p, (all) => {
        all.find((o) => ref(o) === "4600")!.transform.basis = rotationY(15);
      }).vehicles,
    ).toHaveLength(0);
    const all = occurrences(p),
      bounds = occurrenceBounds(p),
      tyre = all.find((o) => ref(o) === "3641")!;
    expect(
      derive(p, {
        bounds: (o) => {
          const b = bounds(o);
          return o.id === tyre.id && b
            ? { min: [b.min[0], b.min[1] - 5, b.min[2]], max: b.max }
            : b;
        },
      }).vehicles,
    ).toHaveLength(0);
  });
  it("refuses incomplete source bounds, excess work and a chassis shared with other mechanisms", () => {
    const p = unrigged(),
      all = occurrences(p),
      bounds = occurrenceBounds(p),
      body = all.find((o) => ref(o) === "3031")!;
    expect(derive(p, { maxRigs: 0 }).vehicles).toHaveLength(0);
    expect(derive(p, { maxGroups: 4 }).vehicles).toHaveLength(0);
    expect(derive(p, { bounds: () => null }).vehicles).toHaveLength(0);
    expect(derive(p, { reserved: new Set([body.id]) }).vehicles).toHaveLength(
      0,
    );
    expect(
      derive(p, {
        bounds: (o) =>
          o.id === body.id
            ? { min: [-2000, -48, -2000], max: [2000, -40, 2000] }
            : bounds(o),
      }).vehicles,
    ).toHaveLength(0);
    const extras = Array.from(
      { length: AUTO_VEHICLE_LIMITS.wheelParts },
      (_, i) => ({
        ...structuredClone(all.find((o) => ref(o) === "3641")!),
        id: `extra-${i}`,
      }),
    );
    expect(derive(p, { all: [...all, ...extras] }).skipped[0].reason).toMatch(
      /Too many wheel parts/,
    );
  });
  it("does not grant authored drive permission to cylinders or unmatched wheel groups", () => {
    const p = carProject(),
      rig = structuredClone(Object.values(p.motionRigs)[0]),
      all = structuredClone(occurrences(p));
    for (const o of all)
      if (["4624", "3641"].includes(ref(o)))
        o.node.ref = "arbitrary-cylinder.dat";
    expect(checkAuthoredVehicleSource(p, rig, all).eligible).toBe(false);
    rig.groups
      .find((g) => g.id === rig.vehicle!.wheels[0].groupId)!
      .occurrenceIds.pop();
    expect(checkAuthoredVehicleSource(p, rig).eligible).toBe(false);
  });
});
