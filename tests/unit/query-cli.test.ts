import { expect, it } from "vitest";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { main } from "../../scripts/brick-cli";
it("CLI queries source bounds and refuses to overwrite input/request files", async () => {
  const dir = await mkdtemp(join(tmpdir(), "brick-query-"));
  const input = join(dir, "source.ldr"),
    request = join(dir, "query.json"),
    output = join(dir, "result.json");
  try {
    const source = "1 4 0 0 0 1 0 0 0 1 0 0 0 1 3001.dat";
    await writeFile(input, source);
    await writeFile(request, JSON.stringify({ spatial: true }));
    await main([
      "query",
      "--input",
      input,
      "--request",
      request,
      "--output",
      output,
    ]);
    const result = JSON.parse(await readFile(output, "utf8"));
    expect(result.count).toBe(1);
    expect(result.spatial.bounds).toEqual({
      min: [-40, -4, -20],
      max: [40, 24, 20],
    });
    await expect(
      main([
        "query",
        "--input",
        input,
        "--request",
        request,
        "--output",
        input,
      ]),
    ).rejects.toThrow(/must differ/);
    await expect(
      main([
        "query",
        "--input",
        input,
        "--request",
        request,
        "--output",
        request,
      ]),
    ).rejects.toThrow(/must differ/);
    expect(await readFile(input, "utf8")).toBe(source);
    await writeFile(request, JSON.stringify({ selection: true }));
    await expect(
      main([
        "query",
        "--input",
        input,
        "--request",
        request,
        "--output",
        output,
      ]),
    ).rejects.toThrow(/selection is unavailable/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
