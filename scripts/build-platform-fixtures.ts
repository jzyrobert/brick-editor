import { readFileSync, writeFileSync } from "node:fs";
import { exportLDraw } from "../src/ldraw/io";
import { movingPlatformFixture } from "../src/mechanisms/platform-fixture";
const project = movingPlatformFixture();
const path = "fixtures/ldraw/moving-platform.mpd",
  text = exportLDraw(project);
if (process.argv.includes("--check")) {
  if (readFileSync(path, "utf8") !== text)
    throw new Error("Moving platform fixture is stale");
} else writeFileSync(path, text);
