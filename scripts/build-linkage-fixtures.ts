import { readFileSync, writeFileSync } from "node:fs";
import { loopFixture } from "../src/mechanisms/loop-fixture";
import { exportLDraw } from "../src/ldraw/io";
const check = process.argv.includes("--check");
if (process.argv.slice(2).some((a) => a !== "--check"))
  throw new Error("Usage: npx tsx scripts/build-linkage-fixtures.ts [--check]");
for (const kind of ["four-bar", "slider-crank"] as const) {
  const text = exportLDraw(loopFixture(kind).project),
    path = `fixtures/ldraw/${kind}.mpd`;
  if (check) {
    if (readFileSync(path, "utf8") !== text)
      throw new Error(`Regenerate ${path}`);
  } else writeFileSync(path, text);
}
