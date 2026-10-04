import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import {
  registerFullLibraryFromDisk,
  fullLibrarySources,
} from "../../scripts/full-library-node";
import { occurrences } from "../../src/core/document";
import { mv, rotationY } from "../../src/core/math";
import { importLDraw, exportLDraw } from "../../src/ldraw/io";
import { partsList } from "../../src/inventory/parts-list";
import { KinematicSession } from "../../src/mechanisms/kinematic";
import {
  deriveVehicleRigs,
  checkAuthoredVehicleSource,
} from "../../src/play/auto-vehicles";
import { meshOf } from "../helpers/play-dynamic-source";

beforeAll(() => expect(registerFullLibraryFromDisk()).toBe(true));
const source = (number: string) =>
  readFileSync(`fixtures/play/official-cars/${number}-car.mpd`, "utf8");
const derive = (p: ReturnType<typeof importLDraw>) =>
  deriveVehicleRigs(p, { reserved: new Set(), maxRigs: 32, maxGroups: 128 });

describe("reviewed official road-car source mounts", () => {
  for (const [number, holder, rim, tyre] of [
    ["6503", "2441", "4624", "3641"],
    ["31027", "6157", "93593", "50951"],
    ["30572", "6157", "93595", "50951"],
  ]) {
    for (const yaw of [0, 37, 90]) {
      it(`${number} uses its real ${holder} mounts at ${yaw} degrees without changing the document`, () => {
        const text = source(number),
          root = /^0 FILE (.+)$/m.exec(text)![1].trim(),
          basis = rotationY(yaw);
        const p = importLDraw(
            `0 FILE rotated.ldr\n1 16 0 0 0 ${basis.join(" ")} ${root}\n${text}`,
          ),
          all = occurrences(p),
          original = JSON.stringify(p),
          exported = exportLDraw(p),
          inventory = partsList(p, all),
          result = derive(p);
        expect(result.skipped).toEqual([]);
        expect(result.vehicles).toHaveLength(1);
        const rig = Object.values(result.rigs)[0],
          ephemeral = { ...p, motionRigs: result.rigs },
          session = new KinematicSession(ephemeral, rig.id),
          rest = session.snapshot();
        expect(checkAuthoredVehicleSource(ephemeral, rig)).toEqual({
          eligible: true,
        });
        expect(rig.vehicle?.wheelbase).toBeCloseTo(
          number === "30572" ? 120 : 100,
          8,
        );
        expect(rig.vehicle?.driverSeat).toBeUndefined();
        expect(Object.keys(rest.transforms).sort()).toEqual(
          all.map((o) => o.id).sort(),
        );
        for (const o of all) {
          const group = rig.groups.find((g) => g.occurrenceIds.includes(o.id))!;
          expect(group.restTransforms[o.id]).toEqual(o.transform);
          for (let k = 0; k < 3; k++)
            expect(rest.transforms[o.id].position[k]).toBeCloseTo(
              o.transform.position[k],
              9,
            );
          for (let k = 0; k < 9; k++)
            expect(rest.transforms[o.id].basis[k]).toBeCloseTo(
              o.transform.basis[k],
              9,
            );
        }
        expect(
          rig.groups
            .filter((g) => g.id !== "chassis")
            .every((g) => g.occurrenceIds.length === 2),
        ).toBe(true);
        expect(all.filter((o) => o.node.ref === holder + ".dat")).toHaveLength(
          number === "6503" ? 1 : 2,
        );
        expect(
          all.filter((o) => [rim + ".dat", tyre + ".dat"].includes(o.node.ref)),
        ).toHaveLength(8);
        session.setVehicleInput({ throttle: 1, steering: 0 });
        const forward = session.stepTicks(60),
          expected = mv(rig.groups[0].frame.basis, [0, 0, -160]);
        for (let k = 0; k < 3; k++)
          expect(forward.pose.vehicle!.position[k]).toBeCloseTo(expected[k], 8);
        expect(forward.pose.vehicle!.headingDegrees).toBe(0);
        session.setVehicleInput({ throttle: 0, steering: 0 });
        expect(session.stepTicks(30).pose.vehicle).toEqual(
          forward.pose.vehicle,
        );
        session.setVehicleInput({ throttle: -1, steering: 0 });
        const returned = session.stepTicks(60);
        for (const v of returned.pose.vehicle!.position)
          expect(v).toBeCloseTo(0, 8);
        session.setVehicleInput({ throttle: 1, steering: 1 });
        expect(
          Math.abs(session.stepTicks(30).pose.vehicle!.headingDegrees),
        ).toBeGreaterThan(20);
        expect(JSON.stringify(p)).toBe(original);
        expect(exportLDraw(p)).toBe(exported);
        expect(partsList(p, occurrences(p))).toEqual(inventory);
      });
    }
    it(`${number} rejects a floating wheel, copied wheel identity and nonhorizontal axle`, () => {
      for (const change of ["float", "copy", "tilt"]) {
        const p = importLDraw(source(number)),
          wheel = occurrences(p).find((o) => o.node.ref === rim + ".dat")!;
        if (change === "float") wheel.node.transform.position[1] += 3;
        if (change === "copy") {
          // A project-local borrowed official filename cannot get a wheel exception.
          const all = occurrences(p).map((o) =>
            o.id === wheel.id ? { ...o, namespace: "project" as const } : o,
          );
          expect(
            deriveVehicleRigs(p, {
              all,
              reserved: new Set(),
              maxRigs: 32,
              maxGroups: 128,
            }).vehicles,
          ).toHaveLength(0);
          continue;
        }
        if (change === "tilt")
          wheel.node.transform.basis = [1, 0, 0, 0, 0, -1, 0, 1, 0];
        expect(derive(p).vehicles).toHaveLength(0);
      }
    });
  }
  it("never joins separated holders through a shared model name or nearby body", () => {
    const p = importLDraw(source("31027"));
    for (const o of occurrences(p))
      if (o.node.ref === "6157.dat") o.node.transform.position[1] += 3;
    // Keep the wheel seats valid while disconnecting the holder/body interface.
    const wheelFile = Object.values(p.models).find(
      (f) => f.name === "31027 - Wheel.ldr",
    );
    expect(wheelFile).toBeDefined();
    for (const file of Object.values(p.models))
      for (const node of file.nodes)
        if (node.kind === "submodel" && node.ref === "31027 - Wheel.ldr")
          node.transform.position[1] += 3;
    expect(derive(p).vehicles).toHaveLength(0);
  });
  it("keeps foreign root scenery out of the connected vehicle", () => {
    const text = source("31027"),
      root = /^0 FILE (.+)$/m.exec(text)![1].trim(),
      p = importLDraw(
        `0 FILE street.ldr\n1 16 0 0 0 1 0 0 0 1 0 0 0 1 ${root}\n1 4 100 0 0 1 0 0 0 1 0 0 0 1 3001.dat\n${text}`,
      ),
      r = derive(p),
      all = occurrences(p),
      scenery = all.find((o) => o.path.length === 1)!;
    expect(r.vehicles).toHaveLength(1);
    expect(r.vehicles[0].occurrenceIds).not.toContain(scenery.id);
  });
  it("binds the alternate spokes to the identical source hub and tyre envelope", async () => {
    const sources = fullLibrarySources(["93593.dat", "93595.dat"]);
    for (const rim of ["93593", "93595"]) {
      expect(sources[rim + ".dat"]).toMatch(
        /1 16 0 0 0 1 0 0 0 1 0 0 0 1 s[\\/]93593s01\.dat/,
      );
      const p = importLDraw(`1 16 0 0 0 1 0 0 0 1 0 0 0 1 ${rim}.dat`),
        m = await meshOf(
          p,
          occurrences(p).map((o) => o.id),
          sources,
        );
      for (let i = 0; i < m.vertices.length; i += 3)
        expect(Math.hypot(m.vertices[i], m.vertices[i + 1])).toBeLessThan(
          19.001,
        );
    }
  });
  it("measures the complete new tyre radius from source vertices", async () => {
    const p = importLDraw("1 16 0 0 0 1 0 0 0 1 0 0 0 1 50951.dat"),
      m = await meshOf(
        p,
        occurrences(p).map((o) => o.id),
        fullLibrarySources(["50951.dat"]),
      );
    let maximum = 0;
    for (let i = 0; i < m.vertices.length; i += 3)
      maximum = Math.max(maximum, Math.hypot(m.vertices[i], m.vertices[i + 1]));
    expect(maximum).toBeGreaterThan(18.99);
    expect(maximum).toBeLessThanOrEqual(19.001);
  });
});
