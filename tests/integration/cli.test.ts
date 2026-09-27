import { it, expect } from "vitest";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { main } from "../../scripts/brick-cli";
it("CLI and domain inventory agree offline, and blocked export retains a previous file", async () => {
  const dir = await mkdtemp(join(tmpdir(), "brick-cli-")),
    output = join(dir, "wanted.xml"),
    report = join(dir, "report.json");
  await main([
    "inventory",
    "--input",
    "fixtures/ldraw/nested.mpd",
    "--output",
    output,
    "--report",
    report,
  ]);
  expect(await readFile(output, "utf8")).toContain("<MINQTY>2</MINQTY>");
  expect(JSON.parse(await readFile(report, "utf8")).complete).toBe(true);
  const bad = join(dir, "missing.ldr");
  await writeFile(bad, "1 4 0 0 0 1 0 0 0 1 0 0 0 1 missing.dat");
  const before = await readFile(output, "utf8");
  await expect(
    main(["inventory", "--input", bad, "--output", output, "--report", report]),
  ).rejects.toThrow("Resolve inventory");
  expect(await readFile(output, "utf8")).toBe(before);
  expect(JSON.parse(await readFile(report, "utf8")).complete).toBe(false);
});
