import { it, expect } from "vitest";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { main } from "../../scripts/brick-cli";
import { decodeNative, encodeNative } from "../../src/persistence/native";
import { occurrences } from "../../src/core/document";
import { exportLDraw } from "../../src/ldraw/io";
import { identity } from "../../src/core/math";
import { physicalMotorFixture } from "../../src/mechanisms/motor-fixture";
import { registerFullLibraryFromDisk } from "../../scripts/full-library-node";
import { realMechanismsFixture } from "../browser/helpers/real-mechanisms";

it("CLI play opens official doors, reproduces tick runs and writes a posed snapshot", async () => {
  const dir = await mkdtemp(join(tmpdir(), "brick-cli-doors-"));
  try {
    const run = async (name: string, extra: string[] = []) => {
      const output = join(dir, name + ".png"),
        report = join(dir, name + ".json"),
        posed = join(dir, name + ".ldr");
      await main([
        "play",
        "--input",
        "fixtures/ldraw/door-room.ldr",
        "--output",
        output,
        "--report",
        report,
        "--position",
        "[0,-0.3,220]",
        "--move-forward",
        "1",
        "--ticks",
        "240",
        "--width",
        "96",
        "--height",
        "64",
        "--posed-output",
        posed,
        ...extra,
      ]);
      return {
        report: JSON.parse(await readFile(report, "utf8")),
        posed: await readFile(posed, "utf8"),
      };
    };
    const closed = await run("closed");
    expect(closed.report.playRun.initial.autoDoors.doors[0]).toMatchObject({
      rigId: "auto-door:0",
      part: "60616a",
      swing: "positive",
    });
    // The closed door stops the explorer outside the room.
    expect(closed.report.playRun.final.position[2]).toBeGreaterThan(10);
    const open = await run("open", ["--open-doors"]);
    expect(open.report.playRun.openDoors).toBe(true);
    expect(
      open.report.playRun.final.mechanisms["auto-door:0"].pose.jointPositions
        .door,
    ).toBe(90);
    expect(open.report.playRun.final.position[2]).toBeLessThan(-100);
    expect(open.posed).toMatch(
      /^1 4 -32 -144 5 0 0 -1 0 1 0 1 0 0 60616a\.dat$/m,
    );
    expect(closed.posed).toMatch(
      /^1 4 -32 -144 5 1 0 0 0 1 0 0 0 1 60616a\.dat$/m,
    );
    const again = await run("again", ["--open-doors"]);
    expect(again.report.playRun.final.position).toEqual(
      open.report.playRun.final.position,
    );
    const noDoors = await run("static", ["--no-auto-doors", "--open-doors"]);
    expect(noDoors.report.playRun.initial.autoDoors).toBeUndefined();
    await expect(
      main([
        "play",
        "--input",
        "fixtures/ldraw/door-room.ldr",
        "--output",
        join(dir, "bad.png"),
        "--joint-targets",
        "{nope",
      ]),
    ).rejects.toThrow(/joint-targets must be JSON/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}, 240000);

it("CLI play simulates dynamic rigs with motors and vehicle input from a native project", async () => {
  const dir = await mkdtemp(join(tmpdir(), "brick-cli-physics-")),
    input = join(dir, "physics.brickproj"),
    output = join(dir, "physics.png"),
    report = join(dir, "physics.json");
  try {
    registerFullLibraryFromDisk();
    const project = await decodeNative(
      new Uint8Array(realMechanismsFixture().bytes),
    );
    const motor = physicalMotorFixture({
      ...identity(),
      position: [400, 0, 0],
    });
    expect(motor.proposal.unresolved).toEqual([]);
    const originalIds = occurrences(motor.project).map((o) => o.id);
    const rig = structuredClone(motor.proposal.rig!);
    const nodes = motor.project.models[motor.project.rootModelId].nodes;
    for (const node of nodes) {
      node.id = `cli-motor-${node.id}`;
      delete node.sourceRecordId;
    }
    const renamed = occurrences(motor.project).map((o) => o.id);
    const ids = new Map(originalIds.map((id, i) => [id, renamed[i]]));
    // Rewrite occurrence values AND rest-transform keys after copying root parts.
    const remap = (value: unknown): unknown => {
      if (typeof value === "string") return ids.get(value) ?? value;
      if (Array.isArray(value)) return value.map(remap);
      if (value && typeof value === "object")
        return Object.fromEntries(
          Object.entries(value).map(([key, v]) => [
            ids.get(key) ?? key,
            remap(v),
          ]),
        );
      return value;
    };
    project.models[project.rootModelId].nodes.push(...nodes);
    project.motionRigs[rig.id] = remap(rig) as typeof rig;
    const relation = rig.transmissions![0],
      inputJoint = relation.jointA,
      doorBody = project.motionRigs.door.joints[0].bodyB;
    const authored = await encodeNative(project);
    await writeFile(input, authored);
    const args = (dynamic: boolean, ticks = 90) => [
      "play",
      "--input",
      input,
      "--output",
      output,
      "--report",
      report,
      "--rigs",
      "all",
      ...(dynamic ? ["--dynamic-rigs", "all"] : []),
      "--position",
      "[300,-0.3,300]",
      "--vehicle",
      '{"rigId":"vehicle","throttle":1,"steering":0}',
      "--motors",
      JSON.stringify([{ rigId: rig.id, jointId: inputJoint, enabled: true }]),
      "--joint-targets",
      '[{"rigId":"door","jointId":"hinge","target":90,"speed":90}]',
      "--posed-output",
      join(dir, "physics-posed.ldr"),
      "--ticks",
      String(ticks),
      "--width",
      "96",
      "--height",
      "64",
    ];
    await main(args(true));
    expect(new Uint8Array(await readFile(input))).toEqual(authored);
    expect(await readFile(join(dir, "physics-posed.ldr"), "utf8")).not.toEqual(
      exportLDraw(project),
    );
    const dynamic = JSON.parse(await readFile(report, "utf8")).playRun.final;
    expect(Object.keys(dynamic.mechanisms).sort()).toEqual([
      "door",
      "technic-drive",
      "vehicle",
    ]);
    expect(dynamic.mechanisms.vehicle.mode).toBe("dynamic");
    expect(dynamic.mechanisms.vehicle.pose.vehicle.position[2]).toBeLessThan(
      -60,
    );
    expect(dynamic.mechanisms[rig.id].motors[inputJoint].simulation).toBe(
      "dynamic-motor",
    );
    expect(
      dynamic.mechanisms[rig.id].pose.jointPositions[inputJoint],
    ).toBeGreaterThan(90);
    expect(
      dynamic.mechanisms[rig.id].pose.jointPositions[relation.jointB],
    ).toBeCloseTo(
      -dynamic.mechanisms[rig.id].pose.jointPositions[inputJoint] / 3,
      0,
    );
    // Keep the 90-tick intermediate report. This actual source door has different
    // mass/inertia from the old block fixture and is still rotating toward rest.
    // The separate settling hold retains the 1-degree/2-degrees/s contract.
    expect(dynamic.tick).toBe(90);
    const movingDoor = dynamic.mechanisms.door;
    expect(Math.abs(movingDoor.pose.jointPositions.hinge)).toBeGreaterThan(45);
    expect(movingDoor.dynamics.bodies[doorBody].angularSpeed).toBeGreaterThan(
      2,
    );
    expect(movingDoor.jointTargets.hinge.status).toBe("moving");
    expect(movingDoor.blocked).toBe(false);
    await main(args(false));
    const kinematic = JSON.parse(await readFile(report, "utf8")).playRun.final;
    expect(kinematic.mechanisms.vehicle.mode).toBe("kinematic");
    expect(
      kinematic.mechanisms[rig.id].pose.jointPositions[inputJoint],
    ).toBeCloseTo(135, 6);
    expect(
      kinematic.mechanisms[rig.id].pose.jointPositions[relation.jointB],
    ).toBeCloseTo(-45, 6);
    // Independently verify the CLI's final report after a bounded settling hold,
    // retaining the native 1-degree position and 2-degrees/s speed thresholds.
    await main(args(true, 120));
    const settled = JSON.parse(await readFile(report, "utf8")).playRun.final;
    expect(settled.tick).toBe(120);
    const settledDoor = settled.mechanisms.door;
    expect(
      Math.abs(settledDoor.pose.jointPositions.hinge - 90),
    ).toBeLessThanOrEqual(1);
    expect(
      settledDoor.dynamics.bodies[doorBody].angularSpeed,
    ).toBeLessThanOrEqual(2);
    expect(settledDoor.jointTargets.hinge.status).toBe("complete");
    expect(settledDoor.blocked).toBe(false);
    expect(new Uint8Array(await readFile(input))).toEqual(authored);
    expect(
      exportLDraw(await decodeNative(new Uint8Array(await readFile(input)))),
    ).toEqual(exportLDraw(project));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}, 240000);
