import { expect, it } from "vitest";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { unzipSync, strFromU8 } from "fflate";
import { main } from "../../scripts/brick-cli";
it("CLI exports a licensed portable dependency package without launching a renderer", async () => {
  const directory = await mkdtemp(join(tmpdir(), "brick-profile-"));
  try {
    const input = join(directory, "source.ldr"),
      output = join(directory, "portable.zip");
    await writeFile(input, "1 4 80 -24 20 1 0 0 0 1 0 0 0 1 3001.dat");
    await main([
      "export-profile",
      "--input",
      input,
      "--profile",
      "portable",
      "--include-official",
      "--output",
      output,
    ]);
    const files = unzipSync(await readFile(output));
    expect(strFromU8(files["model.mpd"])).toContain("80 -24 20");
    expect(files["ldraw/parts/3001.dat"]).toBeDefined();
    expect(
      JSON.parse(await readFile(output + ".report.json", "utf8"))
        .occurrenceCount,
    ).toBe(1);
    await expect(
      main([
        "export-profile",
        "--input",
        input,
        "--profile",
        "standard",
        "--output",
        input,
      ]),
    ).rejects.toThrow(/differ/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
