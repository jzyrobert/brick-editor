import { describe, expect, it, vi } from "vitest";
import RAPIER from "@dimforge/rapier3d-compat";
import { occurrences } from "../../src/core/document";
import { importLDraw } from "../../src/ldraw/io";
import { physicalMotorFixture } from "../../src/mechanisms/motor-fixture";
import { proposeMechanicalRig } from "../../src/mechanisms/mechanical-proposals";
import { requirePhysicalPlay } from "../../src/mechanisms/physical-play";
import { effectiveMotor } from "../../src/play/motor-input";
import { PlaySession } from "../../src/play/session";
import {
  fullLibrarySources,
  registerFullLibraryFromDisk,
} from "../../scripts/full-library-node";
import { playSources } from "../helpers/play-dynamic-source";

registerFullLibraryFromDisk();

/** Two source-separated copies of the real stud-mounted PF M gearbox. Each
 * motor has its own carrier, keyed axle and reviewed bearing/gear engagement. */
function independentMotors() {
  const rows = physicalMotorFixture()
    .text.split("\n")
    .filter((l) => l.startsWith("1 "));
  const shifted = rows.map((line) => {
    const fields = line.split(/\s+/);
    fields[2] = String(Number(fields[2]) + 400);
    return fields.join(" ");
  });
  const project = importLDraw([...rows, ...shifted].join("\n"));
  const all = occurrences(project);
  for (let copy = 0; copy < 2; copy++) {
    const offset = copy * rows.length;
    const proposal = proposeMechanicalRig(project, {
      id: `motor-${copy + 1}`,
      name: `Mounted motor ${copy + 1}`,
      expectedRevision: project.revision,
      occurrenceIds: all.slice(offset, offset + rows.length).map((o) => o.id),
      frameOccurrenceIds: [0, 1, 10, 11, 12, 13, 14].map(
        (i) => all[offset + i].id,
      ),
      motors: {
        [all[offset + 2].id]: {
          mode: "velocity",
          target: 90,
          maxEffort: { value: 50, unit: "N*m" },
          binding: {
            occurrenceId: all[offset + 10].id,
            profile: "power-functions-motor-m-v1",
          },
        },
      },
    });
    expect(proposal.unresolved).toEqual([]);
    project.motionRigs[proposal.rig!.id] = proposal.rig!;
  }
  return project;
}

async function fixture(dynamic: boolean, positionPreset = false) {
  const project = positionPreset
    ? physicalMotorFixture().project
    : independentMotors();
  const rigs = Object.values(project.motionRigs);
  if (positionPreset)
    rigs[0].joints[0].motor = {
      ...rigs[0].joints[0].motor!,
      mode: "position",
      target: 90,
    };
  for (const rig of rigs) requirePhysicalPlay(project, rig);
  const original = JSON.stringify(project);
  const ids = rigs.map((r) => r.id);
  const { geometry, sources } = await playSources(
    project,
    ids,
    fullLibrarySources(occurrences(project).map((o) => o.node.ref)),
  );
  const play = await PlaySession.create(
    geometry,
    {
      rigIds: ids,
      ...(dynamic ? { dynamicRigIds: ids } : {}),
      position: [600, -0.3, 200],
    },
    sources,
  );
  const driver = (copy: number) => rigs[copy].transmissions![0].jointA;
  const set = (copy: number, input?: number, enabled = true, power?: number) =>
    play.setMotor({
      rigId: ids[copy],
      jointId: driver(copy),
      enabled,
      ...(input !== undefined ? { input } : {}),
      ...(power !== undefined ? { power } : {}),
    });
  const report = (copy: number) => play.snapshot().mechanisms![ids[copy]];
  const angle = (copy: number) =>
    report(copy).pose.jointPositions[driver(copy)];
  const phase = (copy: number) =>
    expect(
      report(copy).pose.jointPositions[rigs[copy].transmissions![0].jointB],
    ).toBeCloseTo(-angle(copy) / 3, 0);
  return {
    play,
    rigs,
    driver,
    set,
    report,
    angle,
    phase,
    unchanged: () => expect(JSON.stringify(project)).toBe(original),
  };
}

for (const dynamic of [false, true])
  describe(`${dynamic ? "native" : "kinematic"} mounted motor input`, () => {
    it("limits available effort independently of requested speed, validates power atomically and supplies no drive at zero power", async () => {
      const f = await fixture(dynamic);
      const nativeEffort = vi.spyOn(
        RAPIER.UnitImpulseJoint.prototype,
        "setMotorMaxForce",
      );
      try {
        f.set(0, 1, true, 0.25);
        f.set(1, 1, true, 1);
        f.play.stepTicks(1);
        for (const [copy, power] of [
          [0, 0.25],
          [1, 1],
        ] as const) {
          expect(f.report(copy).motors![f.driver(copy)]).toMatchObject({
            input: 1,
            target: 90,
            power,
          });
          expect(
            effectiveMotor(
              f.rigs[copy].joints.find((j) => j.id === f.driver(copy))!,
              1,
              Infinity,
              power,
            ).maxEffort.value,
          ).toBe(50 * power);
        }
        if (dynamic) {
          // The spy forwards to the real native setter; native response and all
          // actual part contacts remain active for both identical assemblies.
          expect(nativeEffort.mock.calls.map(([effort]) => effort)).toContain(
            12.5,
          );
          expect(nativeEffort.mock.calls.map(([effort]) => effort)).toContain(
            50,
          );
          expect(f.angle(0)).toBeGreaterThan(0);
          expect(f.angle(0)).toBeLessThan(f.angle(1));
        } else {
          expect(f.angle(0)).toBe(f.angle(1));
          expect(nativeEffort).not.toHaveBeenCalled();
        }
        for (const copy of [0, 1]) f.set(copy, 0, true, copy === 0 ? 0.25 : 1);
        f.play.stepTicks(60);
        expect(f.report(0).motors![f.driver(0)]).toMatchObject({
          target: 0,
          power: 0.25,
          status: "holding",
        });
        const stopped = f.angle(0);
        f.set(0, 1, true, 0);
        nativeEffort.mockClear();
        f.play.stepTicks(60);
        // An unpowered native mechanism can recoil/coast; it supplies no
        // commanded 90-degree travel. Rate-only Play stays exactly still.
        expect(Math.abs(f.angle(0) - stopped)).toBeLessThan(
          dynamic ? 1 : 1e-10,
        );
        expect(f.report(0).motors![f.driver(0)]).toMatchObject({
          input: 1,
          target: 90,
          enabled: true,
          power: 0,
          status: "stopped",
        });
        if (dynamic)
          expect(nativeEffort.mock.calls.map(([effort]) => effort)).toContain(
            0,
          );
        const before = f.play.snapshot();
        for (const power of [-0.01, 1.01, NaN, Infinity])
          expect(() => f.set(0, 1, true, power)).toThrow(/power/i);
        expect(f.play.snapshot()).toEqual(before);
        f.play.clearInput();
        f.play.stepTicks(1);
        expect(f.report(0).motors![f.driver(0)]).toMatchObject({
          input: 0,
          target: 0,
          power: 1,
          status: "holding",
        });
        f.set(0, 0.25);
        expect(f.report(0).motors![f.driver(0)]).toMatchObject({
          power: 1,
          target: 22.5,
        });
        f.play.stepTicks(60);
        expect(f.angle(0)).toBeGreaterThan(stopped + 20);
        f.unchanged();
      } finally {
        nativeEffort.mockRestore();
        f.play.dispose();
      }
    }, 60000);

    it("scales speed, continuously reverses past 90 degrees and brakes independent motors without changing their source", async () => {
      const f = await fixture(dynamic);
      try {
        f.set(0, 0.25);
        f.set(1, 1);
        f.play.stepTicks(120);
        expect(f.angle(0)).toBeGreaterThan(40);
        expect(f.angle(0)).toBeLessThan(50);
        expect(f.angle(1)).toBeGreaterThan(165);
        expect(f.angle(1)).toBeLessThan(185);
        for (const [copy, input, speed] of [
          [0, 0.25, 22.5],
          [1, 1, 90],
        ] as const) {
          expect(f.report(copy).motors![f.driver(copy)]).toMatchObject({
            enabled: true,
            input,
            mode: "velocity",
            target: speed,
            targetUnits: "degrees/s",
          });
          // Normalized input is a speed control, not a torque percentage.
          expect(
            effectiveMotor(
              f.rigs[copy].joints.find((j) => j.id === f.driver(copy))!,
              input,
            ).maxEffort,
          ).toEqual({ value: 50, unit: "N*m" });
          f.phase(copy);
        }
        f.set(1, 0);
        f.set(0, -1);
        f.play.stepTicks(240);
        expect(f.angle(0)).toBeLessThan(-290);
        expect(f.report(1).motors![f.driver(1)]).toMatchObject({
          input: 0,
          target: 0,
          status: "holding",
        });
        const second = f.angle(1);
        f.set(0, 0.25);
        f.play.stepTicks(60);
        expect(f.angle(1)).toBeCloseTo(second, 0);
        f.play.clearInput();
        f.play.stepTicks(60);
        const stopped = [f.angle(0), f.angle(1)];
        f.play.stepTicks(60);
        for (let copy = 0; copy < 2; copy++) {
          expect(f.angle(copy)).toBeCloseTo(stopped[copy], 0);
          expect(f.report(copy).motors![f.driver(copy)]).toMatchObject({
            input: 0,
            enabled: true,
            target: 0,
            status: "holding",
          });
          f.phase(copy);
        }
        f.set(0, undefined, false);
        expect(f.report(0).motors![f.driver(0)]).toMatchObject({
          enabled: false,
          status: "stopped",
        });
        f.set(1);
        const restored = f.angle(1);
        f.play.stepTicks(90);
        expect(f.angle(1)).toBeGreaterThan(restored + 120);
        expect(f.report(1).motors![f.driver(1)].input).toBeUndefined();
        f.unchanged();
      } finally {
        f.play.dispose();
      }
    }, 60000);

    it("overrides a saved 90-degree position preset with unlimited live direction and restores it explicitly", async () => {
      const f = await fixture(dynamic, true);
      const nativeEffort = vi.spyOn(
        RAPIER.UnitImpulseJoint.prototype,
        "setMotorMaxForce",
      );
      try {
        f.set(0, undefined, true, 0);
        f.play.stepTicks(30);
        expect(Math.abs(f.angle(0))).toBeLessThan(dynamic ? 1 : 1e-10);
        expect(f.report(0).motors![f.driver(0)]).toMatchObject({
          mode: "position",
          target: 90,
          power: 0,
          status: "stopped",
        });
        f.set(0, undefined, true, 0.25);
        nativeEffort.mockClear();
        f.play.stepTicks(1);
        expect(f.report(0).motors![f.driver(0)]).toMatchObject({
          mode: "position",
          target: 90,
          power: 0.25,
        });
        if (dynamic)
          expect(nativeEffort.mock.calls.map(([effort]) => effort)).toContain(
            12.5,
          );
        f.set(0, 1);
        f.play.stepTicks(150);
        expect(f.angle(0)).toBeGreaterThan(210);
        expect(f.report(0).motors![f.driver(0)]).toMatchObject({
          mode: "velocity",
          target: 90,
          input: 1,
        });
        f.set(0, -1);
        f.play.stepTicks(240);
        expect(f.angle(0)).toBeLessThan(-120);
        f.set(0);
        expect(f.report(0).motors![f.driver(0)]).toMatchObject({
          mode: "position",
          target: 90,
        });
        expect(f.report(0).motors![f.driver(0)].input).toBeUndefined();
        // Clearing held input does not disable a deliberately restored preset.
        f.play.clearInput();
        f.play.stepTicks(240);
        expect(f.angle(0)).toBeCloseTo(90, 0);
        expect(f.report(0).motors![f.driver(0)].status).toBe("holding");
        f.phase(0);
        f.unchanged();
      } finally {
        nativeEffort.mockRestore();
        f.play.dispose();
      }
    }, 60000);
  });
