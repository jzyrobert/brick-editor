import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { registerFullLibraryFromDisk } from "../../scripts/full-library-node";
import { carProject } from "../../src/catalog/builds/car";
import { jeepProject } from "../../src/catalog/builds/jeep";
import { occurrences } from "../../src/core/document";
import { add, mv } from "../../src/core/math";
import type { Project } from "../../src/core/types";
import type { MotionRig } from "../../src/mechanisms/types";
import { exportLDraw, importLDraw } from "../../src/ldraw/io";
import { deriveVehicleRigs } from "../../src/play/auto-vehicles";
import { guessDriverSeat } from "../../src/play/driver-seat-guess";
import { occurrenceBounds } from "../../src/play/trains";
import { admitSourceRideAlong } from "../../src/play/source-vehicle-ride-along";
import { memberGeometry } from "../helpers/compact-vehicle-bench";

registerFullLibraryFromDisk();
const guess = (p: Project, rig: MotionRig) =>
  guessDriverSeat({
    rig,
    lookup: new Map(occurrences(p).map((o) => [o.id, o])),
    bounds: occurrenceBounds(p),
  });
const derived = (p: Project) =>
  Object.values(
    deriveVehicleRigs(p, { reserved: new Set(), maxRigs: 8, maxGroups: 128 })
      .rigs,
  )[0];
const official = (n: string) =>
  importLDraw(readFileSync(`fixtures/play/official-cars/${n}-car.mpd`, "utf8"));

describe("driver's seat heuristic for cars without an authored seat", () => {
  for (const [name, make] of [
    ["Roadster", carProject],
    ["Jeep", jeepProject],
  ] as const)
    it(`finds the ${name}'s seat part and its steering wheel where the authored seat is`, () => {
      const p = make(),
        rig = Object.values(p.motionRigs)[0],
        authored = rig.vehicle!.driverSeat!,
        chassis = rig.groups.find((g) => g.id === rig.vehicle!.chassisGroup)!,
        // Ignore the authored seat: the heuristic must find it on its own.
        bare = {
          ...rig,
          vehicle: { ...rig.vehicle!, driverSeat: undefined },
        } as MotionRig,
        result = guess(p, bare);
      expect(result.chosen).toMatchObject({
        kind: "seat-part",
        seat: { ref: "4079.dat" },
        steering: { ref: "3829c01.dat" },
      });
      const expected = add(
        chassis.frame.position,
        mv(chassis.frame.basis, authored.pelvisPosition),
      );
      result.chosen!.pelvis.forEach((v, k) =>
        expect(v).toBeCloseTo(expected[k], 6),
      );
    });

  it("picks the Jeep driver's seat, the one behind the steering wheel, over the passenger's", () => {
    const p = jeepProject(),
      result = guess(p, Object.values(p.motionRigs)[0]);
    expect(result.candidates).toHaveLength(2);
    expect(result.candidates[1].steering).toBeUndefined();
  });

  it("finds an empty cockpit behind the 6503 Sprint Racer's steering wheel", () => {
    const p = official("6503"),
      before = exportLDraw(p),
      result = guess(p, derived(p));
    expect(result.chosen).toMatchObject({
      kind: "cockpit-gap",
      steering: { ref: "3829c01.dat" },
    });
    expect(result.chosen!.reason).toContain("Empty cockpit gap");
    expect(exportLDraw(p)).toBe(before);
  });

  it("finds an open cockpit gap in the 31027 Blue Racer", () => {
    const p = official("31027"),
      result = guess(p, derived(p));
    expect(result.chosen?.kind).toBe("cockpit-gap");
  });

  it("refuses the 30572 Race Car with a plain reason", () => {
    const p = official("30572"),
      result = guess(p, derived(p));
    expect(result.chosen).toBeUndefined();
    expect(result.reason).toMatch(/^No seat part, and no space/);
  });

  it.skipIf(!existsSync(".local/5540-1.mpd"))(
    "refuses the whole 5540 once its cover rides along: no seated figure fits its cockpit",
    async () => {
      const p = importLDraw(readFileSync(".local/5540-1.mpd", "utf8")),
        d = deriveVehicleRigs(p, {
          reserved: new Set(),
          maxRigs: 8,
          maxGroups: 128,
        });
      await admitSourceRideAlong({
        project: p,
        derived: d,
        all: occurrences(p),
        bounds: occurrenceBounds(p),
        surfaces: async (ids) => {
          const { members } = await memberGeometry(p, ids);
          return Object.fromEntries(
            [...members].map(([id, m]) => [
              id,
              {
                revision: p.revision,
                vertices: m.vertices,
                indices: m.indices,
                bounds: { min: [0, 0, 0], max: [0, 0, 0] },
              },
            ]),
          );
        },
      });
      const a = d.vehicles[0].articulation!,
        result = guessDriverSeat({
          rig: Object.values(d.rigs)[0],
          lookup: new Map(occurrences(p).map((o) => [o.id, o])),
          bounds: occurrenceBounds(p),
          steeringIds: a.rideAlong
            .filter((r) => r.kind === "steering-wheel")
            .flatMap((r) => r.occurrenceIds),
        });
      expect(result.chosen).toBeUndefined();
      expect(result.reason).toMatch(/^No seat part, and no space/);
    },
    300000,
  );
});
