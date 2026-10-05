import { beforeAll, describe, expect, it } from "vitest";
import RAPIER from "@dimforge/rapier3d-compat";
import { exportLDraw } from "../../src/ldraw/io";
import { PlaySession } from "../../src/play/session";
import type { PlaySnapshotReport } from "../../src/play/types";
import { airPumpPlay, airPumpProject } from "../helpers/air-pump-source";
import { airPumpSampleSource } from "../../scripts/pneumatic-sample-node";
import { readFileSync } from "node:fs";
import { derivePneumaticPlay } from "../../src/play/pneumatic-play-source";
import {
  AIR_PUMP_SAMPLE,
  registerAirPumpSource,
} from "../../src/catalog/air-pump-sample";
import { template } from "../../src/catalog/templates";

/** The sample's crate is a Dynamic rig in Play; without its rig it would be
 * a static obstacle, so the stroke tests leave it out. */
const withoutCrate = () =>
  airPumpSampleSource().replace(/^1 16 .* air-pump - crate\.ldr\n/m, "");
let fixture: Awaited<ReturnType<typeof airPumpPlay>>;
beforeAll(async () => {
  await RAPIER.init();
  fixture = await airPumpPlay(airPumpProject(withoutCrate()));
}, 120_000);

const bounds = (v: Float32Array) => {
  const min = [Infinity, Infinity, Infinity],
    max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < v.length; i++) {
    min[i % 3] = Math.min(min[i % 3], v[i]);
    max[i % 3] = Math.max(max[i % 3], v[i]);
  }
  return { min, max } as never;
};
async function session(f = fixture) {
  return PlaySession.create(
    { ...f.world, bounds: bounds(f.world.vertices) },
    { position: [0, -200, -300], locomotion: "fly-noclip" },
    undefined,
    undefined,
    undefined,
    f.pneumatics,
  );
}
const air = (s: PlaySnapshotReport) => s.mechanisms!["pneumatic:0"].pneumatic!;

describe("air pump sample", () => {
  it("derives one reviewed circuit with moving rods only", () => {
    const { derived, prepared } = fixture;
    expect(derived.skipped).toEqual([]);
    expect(derived.systems).toHaveLength(1);
    const rig = derived.systems[0].rig;
    expect(rig.id).toBe("pneumatic:0");
    expect(rig.name).toBe("Air pump");
    expect(rig.joints).toEqual([]);
    expect(rig.groups.map((g) => g.id)).toEqual([
      "pump-1-case",
      "pump-1-rod",
      "cylinder-1-body",
      "cylinder-1-rod",
    ]);
    expect(prepared!.topology.hoses).toHaveLength(3);
    expect(prepared!.topology.ports).toHaveLength(6);
    expect(prepared!.valves).toHaveLength(1);
    // The sample routes work port B to the base chamber: "out" is retract.
    expect(prepared!.valves[0].out).toBe("retract");
    expect(prepared!.pumps[0].token.triangles).toBe(1533);
    expect(prepared!.cylinders[0].token.triangles).toBe(2263);
  });

  it("pumps air by hand, pushes the rod out, holds it and pulls it back in", async () => {
    const original = JSON.stringify(fixture.project),
      exported = exportLDraw(fixture.project);
    const s = await session();
    try {
      let report = s.snapshot();
      const valve = air(report).valves[0].id,
        rodLeaf = fixture.prepared!.candidate.rig.groups.find(
          (g) => g.id === "cylinder-1-rod",
        )!.occurrenceIds[0];
      expect(air(report).cylinders[0].extension).toBeLessThan(0.05);
      expect(
        report.mechanisms!["pneumatic:0"].transforms[rodLeaf],
      ).toBeTruthy();
      const start =
        report.mechanisms!["pneumatic:0"].transforms[rodLeaf].position[0];

      // With the valve closed, pumping only fills the short supply tube:
      // the hand soon meets full pressure and the pump reports a stall.
      s.setPneumatic({ pumping: true });
      s.stepTicks(240);
      report = s.snapshot();
      expect(air(report).pumps[0].status).toBe("stalled");
      expect(air(report).pressure.level).toBe(1);
      expect(air(report).cylinders[0].extension).toBeLessThan(0.05);

      s.setPneumatic({ valves: { [valve]: "out" } });
      s.stepTicks(1500);
      report = s.snapshot();
      expect(air(report).valves[0].position).toBe("out");
      const out = air(report).cylinders[0].extension;
      expect(out).toBeGreaterThan(0.8);
      // The rod's rendered leaves move with the native body, along +X.
      const moved =
        report.mechanisms!["pneumatic:0"].transforms[rodLeaf].position[0] -
        start;
      expect(moved).toBeGreaterThan(100);
      expect(moved).toBeLessThan(130);

      // Hold: let go of the pump and close the valve; the rod stays.
      s.setPneumatic({ pumping: false, valves: { [valve]: "hold" } });
      s.stepTicks(300);
      const held = air(s.snapshot()).cylinders[0].extension;
      expect(Math.abs(held - out)).toBeLessThan(0.05);

      s.setPneumatic({ pumping: true, valves: { [valve]: "in" } });
      s.stepTicks(1500);
      report = s.snapshot();
      expect(air(report).cylinders[0].extension).toBeLessThan(0.1);
      expect(report.mechanisms!["pneumatic:0"].blocked).toBe(false);
      expect(JSON.stringify(fixture.project)).toBe(original);
      expect(exportLDraw(fixture.project)).toBe(exported);
    } finally {
      s.dispose();
    }
  }, 180_000);

  it("stops the rod at a solid obstacle while the hand meets full pressure", async () => {
    const blocked = await airPumpPlay(airPumpProject());
    const s = await session(blocked);
    try {
      const valve = air(s.snapshot()).valves[0].id;
      s.setPneumatic({ pumping: true, valves: { [valve]: "out" } });
      s.stepTicks(1500);
      const first = air(s.snapshot());
      // The static crate (x 170..210) stops the rod eye (x −70 + 10 + 230)
      // after 30 of its 130 LDU stroke.
      expect(first.cylinders[0].extension).toBeGreaterThan(0.18);
      expect(first.cylinders[0].extension).toBeLessThan(0.28);
      s.stepTicks(600);
      const later = air(s.snapshot());
      expect(
        Math.abs(later.cylinders[0].extension - first.cylinders[0].extension),
      ).toBeLessThan(0.02);
      expect(later.pressure.level).toBeGreaterThan(0.9);
      expect(s.snapshot().mechanisms!["pneumatic:0"].blocked).toBe(false);
    } finally {
      s.dispose();
    }
  }, 180_000);

  it("refuses incomplete circuits with a reason and leaves the parts still", async () => {
    // Remove one tube: its two ports are open.
    const text = airPumpSampleSource().replace(
      /^1 0 0 0 0 1 0 0 0 1 0 0 0 1 air-pump - cap hose\.ldr\n/m,
      "",
    );
    const open = await airPumpPlay(airPumpProject(text)).catch((e: Error) => e);
    expect(open).toBeInstanceOf(Error);
    expect((open as Error).message).toMatch(/open or unsupported hose ports/);
  }, 120_000);

  it("explains why unsupported or incomplete pneumatic builds stay still", () => {
    const base = airPumpSampleSource();
    const reasons = (text: string) => {
      const derived = derivePneumaticPlay(airPumpProject(text));
      expect(derived.systems).toEqual([]);
      return [...new Set(derived.skipped.map((s) => s.reason))];
    };
    // An unreviewed cylinder type in the circuit keeps all of it still.
    expect(
      reasons(
        base.replace(
          /^(0 FILE air-pump\.ldr\n)/m,
          "$11 14 0 -24 -100 1 0 0 0 1 0 0 0 1 2947.dat\n",
        ),
      ),
    ).toEqual([
      "This 1 × 5 pneumatic cylinder has no reviewed moving rod yet, so the air circuit stays still.",
    ]);
    // No pump: nothing supplies air.
    expect(
      reasons(base.replace(/^1 1 .* 42043 - 2943-v2\.dat\n/m, "")),
    ).toEqual(["No reviewed pump feeds these cylinders, so they stay still."]);
    // A rod outside its reviewed guide.
    expect(
      reasons(
        base.replace(
          /^1 0 135 -24 -10 (.*) 42043 - 19467c01\.dat$/m,
          "1 0 120 -24 -10 $1 42043 - 19467c01.dat",
        ),
      ),
    ).toEqual([
      "This cylinder's rod is not inside its reviewed guide, so the air circuit stays still.",
    ]);
    // A pump missing its rod.
    expect(reasons(base.replace(/^1 0 .* 2944\.dat\n/m, ""))).toEqual([
      "This pump is missing its barrel, cap or rod in a reviewed position, so the air circuit stays still.",
    ]);
    // Builds without pneumatic parts never pay for the source index.
    expect(
      derivePneumaticPlay(
        airPumpProject(
          "0 FILE plain.ldr\n1 4 0 0 0 1 0 0 0 1 0 0 0 1 3001.dat\n",
        ),
      ),
    ).toEqual({ systems: [], skipped: [] });
  });

  it("commits the generated sample and opens it with its crate rig", () => {
    const text = airPumpSampleSource();
    expect(readFileSync("fixtures/ldraw/templates/air-pump.mpd", "utf8")).toBe(
      text,
    );
    registerAirPumpSource(text);
    const project = template("air-pump");
    expect(project.title).toBe("Air pump & cylinder");
    expect(project.scene).toMatchObject({
      backdrop: "studio",
      playHint: AIR_PUMP_SAMPLE.hint,
    });
    expect(Object.keys(project.motionRigs)).toEqual(["crate"]);
    expect(project.motionRigs.crate.dynamics).toEqual({
      groups: { body: { anchored: false, massKg: 5 } },
      startDynamic: true,
    });
    // Original CC0 arrangement; embedded 42043 definitions keep CCAL headers.
    expect(text).toMatch(/OMR source SHA256: 6264ccf8/);
    expect(
      text.match(/^0 !LICENSE Redistributable under CCAL version 2\.0/gm)!
        .length,
    ).toBeGreaterThanOrEqual(12);
  });
});
