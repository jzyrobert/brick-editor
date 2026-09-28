import { expect, it } from "vitest";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { main } from "../../scripts/brick-cli";

it("CLI compare writes a structured occurrence change report", async () => {
  const dir = await mkdtemp(join(tmpdir(), "brick-compare-"));
  try {
    const before = join(dir, "before.ldr"),
      after = join(dir, "after.ldr"),
      output = join(dir, "report.json");
    await writeFile(
      before,
      "0 FILE a.ldr\n1 4 0 0 0 1 0 0 0 1 0 0 0 1 3001.dat\n1 1 40 0 0 1 0 0 0 1 0 0 0 1 3003.dat\n",
    );
    await writeFile(
      after,
      "0 FILE a.ldr\n1 2 0 -8 0 1 0 0 0 1 0 0 0 1 3001.dat\n1 1 40 0 0 1 0 0 0 1 0 0 0 1 3003.dat\n1 14 80 0 0 1 0 0 0 1 0 0 0 1 3005.dat\n",
    );
    await main([
      "compare",
      "--input",
      before,
      "--against",
      after,
      "--output",
      output,
    ]);
    const report = JSON.parse(await readFile(output, "utf8"));
    expect(report.schemaVersion).toBe(1);
    expect(report.counts).toMatchObject({
      added: 1,
      moved: 1,
      recoloured: 1,
      unchanged: 1,
    });
    await expect(main(["compare", "--input", before])).rejects.toThrow(
      /--against/,
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
