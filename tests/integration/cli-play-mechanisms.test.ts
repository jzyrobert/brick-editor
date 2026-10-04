import { it, expect } from "vitest";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { main } from "../../scripts/brick-cli";
import { encodeNative } from "../../src/persistence/native";
import { template } from "../../src/catalog/templates";

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
    await writeFile(input, await encodeNative(template("physics")));
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
      '[{"rigId":"spinner","jointId":"axle","enabled":true}]',
      "--joint-targets",
      '[{"rigId":"door","jointId":"hinge","target":90,"speed":90}]',
      "--ticks",
      String(ticks),
      "--width",
      "96",
      "--height",
      "64",
    ];
    await main(args(true));
    const dynamic = JSON.parse(await readFile(report, "utf8")).playRun.final;
    expect(Object.keys(dynamic.mechanisms).sort()).toEqual([
      "crate",
      "door",
      "spinner",
      "vehicle",
    ]);
    expect(dynamic.mechanisms.vehicle.mode).toBe("dynamic");
    expect(dynamic.mechanisms.vehicle.pose.vehicle.position[2]).toBeLessThan(
      -60,
    );
    expect(dynamic.mechanisms.spinner.motors.axle.simulation).toBe(
      "dynamic-motor",
    );
    // Completion requires a settled body, not just crossing the angle tolerance.
    // Keep the original 90-tick run: the door is close but still rotating.
    expect(dynamic.tick).toBe(90);
    const movingDoor = dynamic.mechanisms.door;
    expect(
      Math.abs(movingDoor.pose.jointPositions.hinge - 90),
    ).toBeLessThanOrEqual(1);
    expect(movingDoor.dynamics.bodies.door.angularSpeed).toBeGreaterThan(2);
    expect(movingDoor.jointTargets.hinge.status).toBe("moving");
    expect(movingDoor.blocked).toBe(false);
    await main(args(false));
    const kinematic = JSON.parse(await readFile(report, "utf8")).playRun.final;
    expect(kinematic.mechanisms.vehicle.mode).toBe("kinematic");
    expect(kinematic.mechanisms.spinner.pose.jointPositions.axle).toBeCloseTo(
      135,
      6,
    );
    // Independently verify the CLI's final report after a bounded settling hold,
    // retaining the native 1-degree position and 2-degrees/s speed thresholds.
    await main(args(true, 120));
    const settled = JSON.parse(await readFile(report, "utf8")).playRun.final;
    expect(settled.tick).toBe(120);
    const settledDoor = settled.mechanisms.door;
    expect(
      Math.abs(settledDoor.pose.jointPositions.hinge - 90),
    ).toBeLessThanOrEqual(1);
    expect(settledDoor.dynamics.bodies.door.angularSpeed).toBeLessThanOrEqual(
      2,
    );
    expect(settledDoor.jointTargets.hinge.status).toBe("complete");
    expect(settledDoor.blocked).toBe(false);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}, 240000);
