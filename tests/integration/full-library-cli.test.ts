import { it, expect } from "vitest";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { main } from "../../scripts/brick-cli";
import { doorRoomSource } from "../../src/catalog/door-room";

const input = "fixtures/ldraw/full-library.ldr";

it("CLI resolves official parts outside the curated pack from the built complete pack", async () => {
  const dir = await mkdtemp(join(tmpdir(), "brick-cli-full-")),
    health = join(dir, "health.json"),
    query = join(dir, "query.json");
  try {
    await main(["health", "--input", input, "--output", health]);
    const report = JSON.parse(await readFile(health, "utf8"));
    const missing = report.checks.find(
      (c: { id: string }) => c.id === "missing-definitions",
    );
    expect(missing.status).toBe("ok");
    expect(report.parts).toBe(10);
    const request = join(dir, "request.json");
    await writeFile(request, JSON.stringify({ spatial: true }));
    await main([
      "query",
      "--input",
      input,
      "--request",
      request,
      "--output",
      query,
    ]);
    const q = JSON.parse(await readFile(query, "utf8"));
    expect(q.unresolvedReferences).toEqual([]);
    expect(q.spatial.complete).toBe(true);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

it("headless CLI render compiles every complete-pack part strictly, without network", async () => {
  const dir = await mkdtemp(join(tmpdir(), "brick-cli-full-render-")),
    camera = join(dir, "camera.json"),
    output = join(dir, "full.png");
  try {
    await writeFile(
      camera,
      JSON.stringify({
        space: "ldraw",
        projection: "perspective",
        position: [900, -300, 800],
        target: [900, -40, 0],
        up: [0, -1, 0],
        fovDeg: 50,
        near: 1,
        far: 20000,
      }),
    );
    // The CLI renders through a private local server over the built pack;
    // strict readiness refuses any unresolved part or missing definition.
    await main([
      "render",
      "--input",
      input,
      "--camera",
      camera,
      "--width",
      "640",
      "--height",
      "360",
      "--output",
      output,
    ]);
    const png = await readFile(output);
    expect(png.subarray(1, 4).toString()).toBe("PNG");
    expect(png.length).toBeGreaterThan(8000);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}, 180000);

it("Play hinges and opens a door resolved from the complete pack (60616b in frame 60596)", async () => {
  const dir = await mkdtemp(join(tmpdir(), "brick-cli-full-door-")),
    input = join(dir, "door-room-60616b.ldr");
  try {
    // The shipped door room with its catalogue door swapped for 60616b,
    // which only the complete official pack defines.
    const source = doorRoomSource();
    expect(source).toContain("60616a.dat");
    await writeFile(input, source.replace("60616a.dat", "60616b.dat"));
    const run = async (name: string, extra: string[] = []) => {
      const report = join(dir, name + ".json");
      await main([
        "play",
        "--input",
        input,
        "--output",
        join(dir, name + ".png"),
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
        ...extra,
      ]);
      return JSON.parse(await readFile(report, "utf8"));
    };
    const closed = await run("closed");
    expect(closed.playRun.initial.autoDoors.doors[0]).toMatchObject({
      rigId: "auto-door:0",
      part: "60616b",
    });
    // The closed leaf collides: the explorer stays outside the room.
    expect(closed.playRun.final.position[2]).toBeGreaterThan(10);
    const open = await run("open", ["--open-doors"]);
    expect(
      open.playRun.final.mechanisms["auto-door:0"].pose.jointPositions.door,
    ).toBe(90);
    expect(open.playRun.final.position[2]).toBeLessThan(-100);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}, 240000);
