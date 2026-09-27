import type { Vec3 } from "../core/types";
/** Original CC0 room fixture: public LDU coordinates; no purchasing identity implied. */
export function explorationSource() {
  const lines = [
    "0 FILE exploration.ldr",
    "0 Exploration room — original CC0-1.0 geometry",
    "0 !LICENSE CC0-1.0",
    "0 BFC CERTIFY CCW",
    "0 !COLOUR Floor CODE 100 VALUE #9FB1A9 EDGE #43504A",
    "0 !COLOUR Wall CODE 101 VALUE #E7E4D9 EDGE #65675F",
    "0 !COLOUR Stairs CODE 102 VALUE #ED9851 EDGE #74471F",
    "0 !COLOUR Ceiling CODE 103 VALUE #DCE9EC EDGE #657B80",
  ];
  const box = (name: string, a: Vec3, b: Vec3, color: number) => {
    lines.push(`0 ${name}`);
    const p: Vec3[] = [
      [a[0], a[1], a[2]],
      [b[0], a[1], a[2]],
      [b[0], b[1], a[2]],
      [a[0], b[1], a[2]],
      [a[0], a[1], b[2]],
      [b[0], a[1], b[2]],
      [b[0], b[1], b[2]],
      [a[0], b[1], b[2]],
    ];
    for (const f of [
      [0, 3, 2, 1],
      [4, 5, 6, 7],
      [0, 1, 5, 4],
      [3, 7, 6, 2],
      [0, 4, 7, 3],
      [1, 2, 6, 5],
    ])
      lines.push(`4 ${color} ${f.flatMap((i) => p[i]).join(" ")}`);
  };
  box("Floor and outside approach", [-180, 0, -240], [180, 8, 260], 100);
  box("Left wall", [-188, -120, -208], [-180, 0, 168], 101);
  box("Right wall", [180, -120, -208], [188, 0, 168], 101);
  box("Back wall", [-180, -120, -208], [180, 0, -200], 101);
  box("Door left jamb", [-180, -120, 160], [-24, 0, 168], 101);
  box("Door right jamb", [24, -120, 160], [180, 0, 168], 101);
  box(
    "Door lintel, 48 wide by 96 high clear opening",
    [-24, -120, 160],
    [24, -96, 168],
    101,
  );
  box("Step 1, 8 LDU rise", [-40, -8, 50], [40, 0, 80], 102);
  box("Step 2, 8 LDU rise", [-40, -16, 20], [40, 0, 50], 102);
  box("Step 3, 8 LDU rise", [-40, -24, -10], [40, 0, 20], 102);
  box("Step 4 and landing", [-40, -32, -100], [40, 0, -10], 102);
  box(
    "Low ceiling alcove, cannot fit 72 LDU capsule",
    [80, -64, -120],
    [160, -56, 30],
    103,
  );
  // A narrow roof strip exercises camera/ceiling collision without obscuring the overview.
  box("Roof strip over door", [-180, -128, 120], [180, -120, 168], 103);
  lines.push("0 NOFILE");
  return lines.join("\n") + "\n";
}
