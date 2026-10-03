import { readFileSync, writeFileSync } from "node:fs";
import { registerFullLibraryFromDisk } from "./full-library-node";
import { rackFixture } from "../src/mechanisms/rack-fixture";
import { exportLDraw } from "../src/ldraw/io";

const args = process.argv.slice(2);
if (args.length > 1 || args.some((arg) => arg !== "--check"))
  throw new Error("Usage: npx tsx scripts/build-rack-fixture.ts [--check]");
registerFullLibraryFromDisk();
const source = exportLDraw(rackFixture().project);
const file = new URL("../fixtures/ldraw/rack-motion.mpd", import.meta.url);
if (args.includes("--check")) {
  if (readFileSync(file, "utf8") !== source)
    throw new Error(
      "Rack fixture changed; regenerate with scripts/build-rack-fixture.ts",
    );
} else writeFileSync(file, source);
console.log(
  `Rack acceptance fixture ${args.includes("--check") ? "matches" : "generated"}: 8 parts`,
);
