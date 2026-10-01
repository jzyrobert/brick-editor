import { afterEach, expect, it, vi } from "vitest";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { main } from "../../scripts/brick-cli";
import { decodeNative } from "../../src/persistence/native";

afterEach(() => vi.restoreAllMocks());
const captured = () => {
  const lines: string[] = [];
  vi.spyOn(console, "log").mockImplementation(
    (...a) => void lines.push(a.join(" ")),
  );
  return lines;
};

it("CLI builds a script into LDraw and native files with a report", async () => {
  const dir = await mkdtemp(join(tmpdir(), "brick-build-"));
  try {
    const out = join(dir, "castle.mpd"),
      report = join(dir, "castle.json"),
      native = join(dir, "castle.brickproj");
    const log = captured();
    await main([
      "build",
      "--script",
      "fixtures/build-scripts/castle.json",
      "--output",
      out,
      "--report",
      report,
    ]);
    const r = JSON.parse(await readFile(report, "utf8"));
    expect(r).toMatchObject({
      ok: true,
      check: { overlaps: 0, groups: 1 },
      output: out,
    });
    expect(r.stats.parts).toBeGreaterThan(200);
    expect(log.join("\n")).toMatch(/Small castle \(build script\): \d+ parts/);
    expect(
      (await readFile(out, "utf8")).startsWith(
        "0 FILE small-castle-build-script.mpd",
      ),
    ).toBe(true);
    // The output is ordinary LDraw: the other commands read it.
    await main([
      "health",
      "--input",
      out,
      "--output",
      join(dir, "health.json"),
    ]);
    const health = JSON.parse(await readFile(join(dir, "health.json"), "utf8"));
    expect(
      health.checks.find((c: { id: string }) => c.id === "connectivity").status,
    ).toBe("ok");
    await main([
      "build",
      "--script",
      "fixtures/build-scripts/castle.json",
      "--output",
      native,
    ]);
    const project = await decodeNative(new Uint8Array(await readFile(native)));
    expect(project.title).toBe("Small castle (build script)");
    expect(Object.values(project.layers).map((l) => l.name)).toContain(
      "Towers",
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}, 120000);

it("CLI reports invalid scripts by path and failed checks by exit code", async () => {
  const dir = await mkdtemp(join(tmpdir(), "brick-build-bad-"));
  try {
    const bad = join(dir, "bad.json");
    await writeFile(
      bad,
      JSON.stringify({
        buildScript: 1,
        title: "x",
        sections: [
          { name: "a", ops: [{ op: "box", at: [0, 0, 0], size: [2, 3, 2] }] },
        ],
      }),
    );
    await expect(main(["build", "--script", bad])).rejects.toThrow(
      /\$\.sections\[0\]\.ops\[0\]\.colour is required/,
    );
    await writeFile(join(dir, "broken.json"), "{");
    await expect(
      main(["build", "--script", join(dir, "broken.json")]),
    ).rejects.toThrow(/not valid JSON/);
    await expect(
      main(["build", "--script", bad, "--typo", "1"]),
    ).rejects.toThrow(/Unknown flag --typo/);
    const overlap = join(dir, "overlap.json");
    await writeFile(
      overlap,
      JSON.stringify({
        buildScript: 1,
        title: "Overlap",
        sections: [
          {
            name: "a",
            ops: [
              { op: "place", part: "3001", at: [0, 0, 0], colour: "red" },
              { op: "place", part: "3001", at: [1, 0, 0], colour: "red" },
            ],
          },
        ],
      }),
    );
    captured();
    process.exitCode = 0;
    await main(["build", "--script", overlap, "--report", join(dir, "o.json")]);
    expect(process.exitCode).toBe(2);
    process.exitCode = 0;
    const r = JSON.parse(await readFile(join(dir, "o.json"), "utf8"));
    expect(r.ok).toBe(false);
    expect(r.problems[1]).toMatchObject({
      code: "overlap",
      ops: ["sections[0].ops[0]", "sections[0].ops[1]"],
    });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}, 60000);

it("CLI prints the op reference and schema, and searches parts", async () => {
  const log = captured();
  await main(["build", "--reference"]);
  expect(log.pop()).toContain("stairs: A flight of steps");
  await main(["build", "--schema"]);
  expect(JSON.parse(log.pop()!).title).toBe("Brick Editor Build Script v1");
  await main(["parts", "search", "cheese", "slope", "--json", "--limit", "2"]);
  const results = JSON.parse(log.pop()!);
  expect(results.map((r: { id: string }) => r.id)).toEqual([
    "54200.dat",
    "85984.dat",
  ]);
  log.length = 0;
  await main([
    "parts",
    "search",
    "--size",
    "1x2x1",
    "--category",
    "Tiles",
    "--colour",
    "white",
    "--available",
    "--limit",
    "3",
  ]);
  expect(log[0]).toMatch(/^3069b\.dat\s+2x1x1p\s+curated\s+snaps/);
  await expect(
    main(["parts", "search", "brick", "--size", "big"]),
  ).rejects.toThrow(/Size must look like/);
});

it("CLI renders review views of a compiled script", async () => {
  const dir = await mkdtemp(join(tmpdir(), "brick-build-render-"));
  try {
    const script = join(dir, "hut.json");
    await writeFile(
      script,
      JSON.stringify({
        buildScript: 1,
        title: "Hut",
        sections: [
          {
            name: "a",
            ops: [
              {
                op: "baseplate",
                at: [-8, -8],
                size: [16, 16],
                colour: "green",
              },
              { op: "box", at: [-3, 0, -3], size: [6, 6, 6], colour: "white" },
            ],
          },
        ],
      }),
    );
    captured();
    const render = join(dir, "view.png");
    await main([
      "build",
      "--script",
      script,
      "--render",
      render,
      "--views",
      "iso,top",
      "--width",
      "320",
      "--height",
      "240",
      "--report",
      join(dir, "r.json"),
    ]);
    for (const v of ["iso", "top"])
      expect((await stat(join(dir, `view-${v}.png`))).size).toBeGreaterThan(
        1000,
      );
    const r = JSON.parse(await readFile(join(dir, "r.json"), "utf8"));
    expect(r.images).toEqual([
      join(dir, "view-iso.png"),
      join(dir, "view-top.png"),
    ]);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}, 240000);

it("CLI writes only the report for a build over --max-parts", async () => {
  const dir = await mkdtemp(join(tmpdir(), "brick-budget-"));
  try {
    const out = join(dir, "house.mpd");
    const build = (budget: number) =>
      main([
        "build",
        "--script",
        "fixtures/build-scripts/house.json",
        "--output",
        out,
        "--max-parts",
        String(budget),
        "--no-check",
      ]);
    captured();
    await build(100_000);
    const parts = JSON.parse(await readFile(out + ".report.json", "utf8")).stats
      .parts;
    const log = captured();
    process.exitCode = 0;
    await build(parts - 10);
    expect(process.exitCode).toBe(2);
    process.exitCode = 0;
    const r = JSON.parse(await readFile(out + ".report.json", "utf8"));
    expect(r.ok).toBe(false);
    expect(r.output).toBeUndefined();
    expect(r.problems[0].message).toMatch(
      new RegExp(`^${parts} parts: 10 over the budget of ${parts - 10} `),
    );
    // The model from the first build is gone, not left to be mistaken for this one.
    await expect(stat(out)).rejects.toThrow();
    expect(log.join("\n")).toContain("not written: " + out);
    await expect(
      main([
        "build",
        "--script",
        "fixtures/build-scripts/house.json",
        "--max-parts",
        "0",
      ]),
    ).rejects.toThrow(/--max-parts must be a positive integer/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}, 120000);
