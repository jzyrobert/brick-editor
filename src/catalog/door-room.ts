/**
 * Original CC0 room built from official catalogue parts around a real LDraw
 * door: Door 1 x 4 x 6 Frame (60596) holding Door 1 x 4 x 6 Smooth (60616a)
 * on its left hinge pins. No rig is authored: Play hinges the door itself.
 * LDraw coordinates, negative Y up; the floor is Play's temporary ground.
 */
export function doorRoomSource() {
  const lines = [
    "0 Door room",
    "0 Name: door-room.ldr",
    "0 Author: Brick Editor contributors",
    "0 !LICENSE Licensed under CC0 1.0",
    "0 !HELP The door hinges on the frame's left pins (x = -32, z = 5).",
    "1 15 0 -144 0 1 0 0 0 1 0 0 0 1 60596.dat",
    "1 4 -32 -144 5 1 0 0 0 1 0 0 0 1 60616a.dat",
  ];
  const column = (part: string, x: number, z: number, turned = false) => {
    for (let level = 1; level <= 6; level++)
      lines.push(
        `1 ${level % 2 ? 71 : 72} ${x} ${-24 * level} ${z} ${
          turned ? "0 0 1 0 1 0 -1 0 0" : "1 0 0 0 1 0 0 0 1"
        } ${part}`,
      );
  };
  // Front wall either side of the frame: x -200..-40 and 40..200 at z = 0.
  column("3008.dat", -120, 0);
  column("3008.dat", 120, 0);
  // Back wall at z = -280 from x -200 to 200.
  column("3008.dat", -120, -280);
  column("3010.dat", 0, -280);
  column("3008.dat", 120, -280);
  // Side walls at x = +/-210 from z = -290 to 30.
  for (const x of [-210, 210]) {
    column("3008.dat", x, -50, true);
    column("3008.dat", x, -210, true);
  }
  return lines.join("\n") + "\n";
}
