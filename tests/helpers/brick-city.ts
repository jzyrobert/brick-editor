/**
 * Deterministic generator for a large plain-brick city: the LDraw counterpart
 * of a Minebench build (docs/PERFORMANCE-MINEBENCH.md). It is made almost
 * entirely of plain bricks, plates and tiles (Minebench's cubes), stacked the
 * way real builds are: a baseplate layer of 2 × 4 plates, a solid two-course
 * foundation of 2 × 4 bricks (whose inner bricks are enclosed on every side),
 * houses with one-stud walls in running bond, plate floors and a tiled roof.
 * One city block is a submodel placed on a grid, so a 150,000-part city is a
 * small file. Nothing large is committed; the text is generated at test time.
 */

export type CityOptions = {
  /** Approximate expanded part count (rounded to whole blocks). */
  parts?: number;
  /** Wall courses per house. */
  courses?: number;
};
export type CityModel = {
  text: string;
  parts: number;
  blocks: number;
  /** Parts per block, by category. */
  perBlock: Record<string, number>;
  /** LDraw bounds of the whole city (for cameras). */
  bounds: { min: [number, number, number]; max: [number, number, number] };
};

const STUD = 20;
const BRICK = 24;
const PLATE = 8;
/** Studs per block side and the street between blocks. */
const BLOCK = 32;
const STREET = 4;
const WALL_COLOURS = ["15", "4", "1", "14", "71", "19", "2", "70"];
const ROOF_COLOURS = ["4", "72", "0", "320"];
const BASE_COLOUR = "72";
const FOUNDATION_COLOUR = "71";
const FLOOR_COLOUR = "19";

/** Rotation mapping part X onto world Z (a brick running along Z). */
const ALONG_Z = "0 0 1 0 1 0 -1 0 0";
const IDENTITY = "1 0 0 0 1 0 0 0 1";

function line(
  colour: string,
  x: number,
  y: number,
  z: number,
  basis: string,
  ref: string,
) {
  return `1 ${colour} ${x} ${y} ${z} ${basis} ${ref}`;
}

/** 1 × N wall bricks by length. */
const WALL_BRICK: Record<number, string> = {
  1: "3005.dat",
  2: "3004.dat",
  3: "3622.dat",
  4: "3010.dat",
  6: "3009.dat",
  8: "3008.dat",
};

/** Lengths (studs) filling a wall run of `length`, starting with a half
 * offset on odd courses (running bond). */
function run(length: number, offset: boolean) {
  const out: number[] = [];
  let left = length;
  if (offset && left >= 2) {
    out.push(2);
    left -= 2;
  }
  while (left >= 4) {
    const n = left >= 10 ? 6 : 4;
    out.push(n);
    left -= n;
  }
  while (left > 0) {
    const n = left >= 3 ? 3 : left;
    out.push(n);
    left -= n;
  }
  return out;
}

function blockLines(seed: number, courses: number) {
  let state = seed * 2654435761 + 1;
  const random = () => {
    state = (Math.imul(state ^ (state >>> 15), 2246822507) + 0x9e3779b9) >>> 0;
    return state / 2 ** 32;
  };
  const pick = <T>(list: readonly T[]) =>
    list[Math.floor(random() * list.length)];
  const lines: string[] = [];
  const count: Record<string, number> = {};
  const add = (category: string, text: string) => {
    lines.push(text);
    count[category] = (count[category] ?? 0) + 1;
  };
  // Baseplate layer: 2 × 4 plates (8 × 16 of them), top at y = 0.
  for (let i = 0; i < BLOCK; i += 4)
    for (let j = 0; j < BLOCK; j += 2)
      add(
        "base",
        line(
          BASE_COLOUR,
          (i + 2) * STUD,
          0,
          (j + 1) * STUD,
          IDENTITY,
          "3020.dat",
        ),
      );
  // Solid foundation: two courses of 2 × 4 bricks, the second rotated.
  let top = 0;
  for (let c = 0; c < 2; c++) {
    top -= BRICK;
    for (let i = 0; i < BLOCK; i += c ? 2 : 4)
      for (let j = 0; j < BLOCK; j += c ? 4 : 2)
        add(
          "foundation",
          c
            ? line(
                FOUNDATION_COLOUR,
                (i + 1) * STUD,
                top,
                (j + 2) * STUD,
                ALONG_Z,
                "3001.dat",
              )
            : line(
                FOUNDATION_COLOUR,
                (i + 2) * STUD,
                top,
                (j + 1) * STUD,
                IDENTITY,
                "3001.dat",
              ),
        );
  }
  const ground = top;
  // Four houses of 14 × 14 studs with one-stud walls.
  const SIZE = 14;
  for (const [hx, hz] of [
    [1, 1],
    [17, 1],
    [1, 17],
    [17, 17],
  ]) {
    const colour = pick(WALL_COLOURS);
    let y = ground;
    for (let c = 0; c < courses; c++) {
      y -= BRICK;
      const odd = c % 2 === 1;
      // Odd courses: X walls take the corners; even: Z walls do.
      const xLength = odd ? SIZE : SIZE - 2;
      const xStart = odd ? hx : hx + 1;
      const zLength = odd ? SIZE - 2 : SIZE;
      const zStart = odd ? hz + 1 : hz;
      for (const zRow of [hz, hz + SIZE - 1]) {
        let at = xStart;
        for (const n of run(xLength, odd)) {
          add(
            "wall",
            line(
              colour,
              (at + n / 2) * STUD,
              y,
              (zRow + 0.5) * STUD,
              IDENTITY,
              WALL_BRICK[n],
            ),
          );
          at += n;
        }
      }
      for (const xRow of [hx, hx + SIZE - 1]) {
        let at = zStart;
        for (const n of run(zLength, !odd)) {
          add(
            "wall",
            line(
              colour,
              (xRow + 0.5) * STUD,
              y,
              (at + n / 2) * STUD,
              ALONG_Z,
              WALL_BRICK[n],
            ),
          );
          at += n;
        }
      }
      // An upper floor of plates halfway up, inside the walls.
      if (c === Math.floor(courses / 2) - 1)
        for (let i = hx + 1; i + 2 <= hx + SIZE - 1; i += 2)
          for (let j = hz + 1; j + 4 <= hz + SIZE - 1; j += 4)
            add(
              "floor",
              line(
                FLOOR_COLOUR,
                (i + 1) * STUD,
                y,
                (j + 2) * STUD,
                ALONG_Z,
                "3020.dat",
              ),
            );
    }
    // Roof: a plate layer over the walls, then 2 × 2 tiles.
    y -= PLATE;
    for (let i = hx; i < hx + SIZE; i += 2)
      for (let j = hz; j < hz + SIZE; j += 2)
        add(
          "roof",
          line(
            pick(ROOF_COLOURS),
            (i + 1) * STUD,
            y,
            (j + 1) * STUD,
            IDENTITY,
            "3022.dat",
          ),
        );
    y -= PLATE;
    for (let i = hx; i < hx + SIZE; i += 2)
      for (let j = hz; j < hz + SIZE; j += 2)
        add(
          "roof",
          line(
            pick(ROOF_COLOURS),
            (i + 1) * STUD,
            y,
            (j + 1) * STUD,
            IDENTITY,
            "3068b.dat",
          ),
        );
  }
  return { lines, count, height: -top + courses * BRICK + 2 * PLATE };
}

export function brickCityModel(options: CityOptions = {}): CityModel {
  const courses = options.courses ?? 12;
  const block = blockLines(1, courses);
  const perBlockParts = block.lines.length;
  const blocks = Math.max(
    1,
    Math.round((options.parts ?? 150_000) / perBlockParts),
  );
  const side = Math.ceil(Math.sqrt(blocks));
  // A few distinct blocks (colour shuffles) placed round-robin.
  const kinds = Math.min(4, blocks);
  const submodels = Array.from({ length: kinds }, (_, k) => {
    const b = k === 0 ? block : blockLines(k + 1, courses);
    return [
      `0 FILE block-${k + 1}.ldr`,
      `0 City block ${k + 1}`,
      ...b.lines,
    ].join("\n");
  });
  const pitch = (BLOCK + STREET) * STUD;
  const main = ["0 FILE brick-city.ldr", "0 Brick city (generated)"];
  for (let n = 0; n < blocks; n++) {
    const x = (n % side) * pitch,
      z = Math.floor(n / side) * pitch;
    main.push(line("16", x, 0, z, IDENTITY, `block-${(n % kinds) + 1}.ldr`));
  }
  const rows = Math.ceil(blocks / side);
  return {
    text: [main.join("\n"), ...submodels].join("\n") + "\n",
    parts: blocks * perBlockParts,
    blocks,
    perBlock: block.count,
    bounds: {
      min: [0, -block.height, 0],
      max: [side * pitch, 0, rows * pitch],
    },
  };
}
