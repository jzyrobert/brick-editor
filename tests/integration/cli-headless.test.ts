import { it, expect } from "vitest";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PDFDocument } from "pdf-lib";
import { main } from "../../scripts/brick-cli";

it("CLI rejects unknown/missing flags and invalid bounded Play input before writing output", async () => {
  const dir = await mkdtemp(join(tmpdir(), "brick-cli-flags-")),
    output = join(dir, "keep.png");
  try {
    await writeFile(output, "keep");
    await expect(
      main([
        "play",
        "--input",
        "fixtures/ldraw/nested.mpd",
        "--output",
        output,
        "--ticks",
        "NaN",
      ]),
    ).rejects.toThrow(/ticks/);
    await expect(
      main([
        "play",
        "--input",
        "fixtures/ldraw/nested.mpd",
        "--output",
        output,
        "--move-forward",
        "2",
      ]),
    ).rejects.toThrow(/move-forward/);
    await expect(
      main([
        "play",
        "--input",
        "fixtures/ldraw/nested.mpd",
        "--output",
        output,
        "--typo",
        "1",
      ]),
    ).rejects.toThrow(/Unknown flag/);
    await expect(main(["play", "--input"])).rejects.toThrow(/Missing value/);
    expect(await readFile(output, "utf8")).toBe("keep");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
it("headless CLI captures fixed ticks and publishes a real instruction PDF locally", async () => {
  const dir = await mkdtemp(join(tmpdir(), "brick-cli-headless-")),
    input = join(dir, "two.mpd"),
    output = join(dir, "play.png"),
    report = join(dir, "play.json"),
    pdf = join(dir, "steps.pdf"),
    pdfReport = join(dir, "steps.json");
  const source =
    "0 FILE two.ldr\n0 Two\n1 4 0 0 -600 1 0 0 0 1 0 0 0 1 3001.dat\n0 STEP\n1 1 80 0 -600 1 0 0 0 1 0 0 0 1 3003.dat";
  try {
    await writeFile(input, source);
    await main([
      "play",
      "--input",
      input,
      "--output",
      output,
      "--report",
      report,
      "--ticks",
      "120",
      "--move-forward",
      "1",
      "--locomotion",
      "fly-noclip",
      "--position",
      "[0,-100,0]",
      "--width",
      "128",
      "--height",
      "96",
    ]);
    const png = await readFile(output),
      data = JSON.parse(await readFile(report, "utf8"));
    expect(png.subarray(1, 4).toString()).toBe("PNG");
    expect(png.readUInt32BE(16)).toBe(128);
    expect(png.readUInt32BE(20)).toBe(96);
    expect(data.playRun.initial.tick).toBe(0);
    expect(data.playRun.final.tick).toBe(120);
    expect(data.playRun.final.cameraMode).toBe("first-person");
    expect(data.playRun.final.avatarVisible).toBe(false);
    expect(data.playRun.final.position[2]).toBeLessThan(
      data.playRun.initial.position[2] - 300,
    );
    expect(data.playRun.final.sourceRevision).toBe(data.revision);
    expect(data.play.tick).toBe(120);
    expect(data.stats.triangles).toBeGreaterThan(0);
    await main([
      "instructions",
      "--input",
      input,
      "--format",
      "pdf",
      "--output",
      pdf,
      "--report",
      pdfReport,
      "--width",
      "128",
      "--height",
      "96",
    ]);
    expect((await PDFDocument.load(await readFile(pdf))).getPageCount()).toBe(
      4,
    );
    expect(JSON.parse(await readFile(pdfReport, "utf8")).coverage).toEqual({
      intended: 2,
      introduced: 2,
      complete: true,
    });
    expect(await readFile(input, "utf8")).toBe(source);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}, 90000);
