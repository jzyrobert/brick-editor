import { readFileSync, writeFileSync } from "node:fs";
import { registerFullLibraryFromDisk } from "./full-library-node";
import { technicFixture } from "../src/mechanisms/technic-fixture";
import { exportLDraw } from "../src/ldraw/io";

const args = process.argv.slice(2);
if (args.length > 1 || args.some((arg) => arg !== "--check"))
  throw new Error("Usage: npx tsx scripts/build-technic-fixture.ts [--check]");
registerFullLibraryFromDisk();
const source = exportLDraw(technicFixture().project);
const file = new URL("../fixtures/ldraw/technic-motion.mpd", import.meta.url);
if (args.includes("--check")) {
  if (readFileSync(file, "utf8") !== source)
    throw new Error(
      "Technic fixture changed; regenerate with scripts/build-technic-fixture.ts",
    );
} else writeFileSync(file, source);
console.log(
  `Technic acceptance fixture ${args.includes("--check") ? "matches" : "generated"}: 13 parts`,
);
