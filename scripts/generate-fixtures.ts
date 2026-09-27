import { writeFileSync } from "node:fs";
import { template } from "../src/catalog/templates";
import { exportLDraw } from "../src/ldraw/io";
for (const [name, t] of [
  ["studio", "room"],
  ["wall", "wall"],
  ["200-parts", "200"],
] as const)
  writeFileSync("fixtures/ldraw/" + name + ".mpd", exportLDraw(template(t)));
