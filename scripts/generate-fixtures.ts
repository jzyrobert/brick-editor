import { writeFileSync } from "node:fs";
import { template } from "../src/catalog/templates";
import { exportLDraw } from "../src/ldraw/io";
import { doorRoomSource } from "../src/catalog/door-room";
for (const [name, t] of [
  ["studio", "room"],
  ["wall", "wall"],
  ["200-parts", "200"],
] as const)
  writeFileSync("fixtures/ldraw/" + name + ".mpd", exportLDraw(template(t)));
// Real official door and frame in a small room; Play hinges the door itself.
writeFileSync("fixtures/ldraw/door-room.ldr", doorRoomSource());
