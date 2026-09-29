/**
 * Deterministic generator for a large architectural stress model built only from
 * official LDraw parts (the complete pack in public/libraries/ldraw-full-*). It is
 * generated at test/benchmark time; nothing large is committed.
 *
 * The model is a multi-part MPD: a main model placing one submodel per floor. Each
 * floor is a grid of houses with tiled floors, coursed walls, windows and doors with
 * frames, arches, fences, round parts, roof slopes and plants — the part mix of a
 * whitewashed hillside village, not a flat grid of one brick.
 */

type Category =
  | "wall"
  | "floor"
  | "opening"
  | "arch"
  | "roof"
  | "fence"
  | "round"
  | "plant";

type PartSpec = {
  ref: string;
  category: Category;
  /** Relative frequency of each colour variant. */
  weight: number;
  /** Footprint along local X in studs (walls), for spacing only. */
  length?: number;
  /** Height in LDU (brick 24, plate 8). */
  height: number;
  colors: string[];
};

const WALL = ["15", "19", "71", "1", "70"];
const WALL_ACCENT = ["15", "1", "72", "28"];
const FLOOR = ["15", "19", "71", "72", "70"];
const TRIM = ["15", "1", "71", "0"];
const GLASS = ["47", "43", "15", "1"];
const PLANT = ["2", "10", "6", "4", "14"];
const ROUND = ["15", "1", "19", "71", "4"];

/** Common architectural parts, all present in the complete official pack. */
export const STRESS_PARTS: readonly PartSpec[] = [
  // Walls: 1 × N bricks carry most of a building.
  {
    ref: "3005",
    category: "wall",
    weight: 6,
    length: 1,
    height: 24,
    colors: WALL,
  },
  {
    ref: "3004",
    category: "wall",
    weight: 10,
    length: 2,
    height: 24,
    colors: WALL,
  },
  {
    ref: "3622",
    category: "wall",
    weight: 8,
    length: 3,
    height: 24,
    colors: WALL,
  },
  {
    ref: "3010",
    category: "wall",
    weight: 10,
    length: 4,
    height: 24,
    colors: WALL,
  },
  {
    ref: "3009",
    category: "wall",
    weight: 6,
    length: 6,
    height: 24,
    colors: WALL,
  },
  {
    ref: "3008",
    category: "wall",
    weight: 4,
    length: 8,
    height: 24,
    colors: WALL,
  },
  {
    ref: "6111",
    category: "wall",
    weight: 2,
    length: 10,
    height: 24,
    colors: WALL_ACCENT,
  },
  {
    ref: "6112",
    category: "wall",
    weight: 2,
    length: 12,
    height: 24,
    colors: WALL_ACCENT,
  },
  {
    ref: "3003",
    category: "wall",
    weight: 3,
    length: 2,
    height: 24,
    colors: WALL,
  },
  {
    ref: "3001",
    category: "wall",
    weight: 3,
    length: 4,
    height: 24,
    colors: WALL,
  },
  {
    ref: "3002",
    category: "wall",
    weight: 2,
    length: 3,
    height: 24,
    colors: WALL_ACCENT,
  },
  {
    ref: "3245c",
    category: "wall",
    weight: 2,
    length: 2,
    height: 48,
    colors: WALL_ACCENT,
  },
  {
    ref: "2454b",
    category: "wall",
    weight: 2,
    length: 2,
    height: 120,
    colors: WALL_ACCENT,
  },
  {
    ref: "3754",
    category: "wall",
    weight: 1,
    length: 6,
    height: 120,
    colors: WALL_ACCENT,
  },
  {
    ref: "3700",
    category: "wall",
    weight: 1,
    length: 4,
    height: 24,
    colors: TRIM,
  },
  {
    ref: "3070b",
    category: "wall",
    weight: 3,
    length: 1,
    height: 8,
    colors: TRIM,
  },
  {
    ref: "3069b",
    category: "wall",
    weight: 3,
    length: 2,
    height: 8,
    colors: TRIM,
  },
  {
    ref: "63864",
    category: "wall",
    weight: 2,
    length: 3,
    height: 8,
    colors: TRIM,
  },
  {
    ref: "2431",
    category: "wall",
    weight: 2,
    length: 4,
    height: 8,
    colors: TRIM,
  },
  {
    ref: "3024",
    category: "wall",
    weight: 3,
    length: 1,
    height: 8,
    colors: WALL,
  },
  {
    ref: "3023b",
    category: "wall",
    weight: 4,
    length: 2,
    height: 8,
    colors: WALL,
  },
  {
    ref: "3623",
    category: "wall",
    weight: 3,
    length: 3,
    height: 8,
    colors: WALL,
  },
  {
    ref: "3710",
    category: "wall",
    weight: 4,
    length: 4,
    height: 8,
    colors: WALL,
  },
  {
    ref: "3666",
    category: "wall",
    weight: 3,
    length: 6,
    height: 8,
    colors: WALL,
  },
  {
    ref: "3460",
    category: "wall",
    weight: 2,
    length: 8,
    height: 8,
    colors: WALL,
  },
  // Floors: plates and tiles.
  { ref: "3022", category: "floor", weight: 4, height: 8, colors: FLOOR },
  { ref: "3020", category: "floor", weight: 5, height: 8, colors: FLOOR },
  { ref: "3021", category: "floor", weight: 3, height: 8, colors: FLOOR },
  { ref: "3795", category: "floor", weight: 3, height: 8, colors: FLOOR },
  { ref: "3031", category: "floor", weight: 3, height: 8, colors: FLOOR },
  { ref: "3032", category: "floor", weight: 2, height: 8, colors: FLOOR },
  { ref: "3035", category: "floor", weight: 2, height: 8, colors: FLOOR },
  { ref: "3068b", category: "floor", weight: 5, height: 8, colors: FLOOR },
  { ref: "87079", category: "floor", weight: 3, height: 8, colors: FLOOR },
  { ref: "6636", category: "floor", weight: 2, height: 8, colors: FLOOR },
  { ref: "3958", category: "floor", weight: 1, height: 8, colors: FLOOR },
  // Openings: windows, glass, doors and frames.
  {
    ref: "60592",
    category: "opening",
    weight: 3,
    length: 2,
    height: 48,
    colors: TRIM,
  },
  {
    ref: "60601",
    category: "opening",
    weight: 3,
    length: 2,
    height: 48,
    colors: GLASS,
  },
  {
    ref: "60593",
    category: "opening",
    weight: 2,
    length: 2,
    height: 72,
    colors: TRIM,
  },
  {
    ref: "60602",
    category: "opening",
    weight: 2,
    length: 2,
    height: 72,
    colors: GLASS,
  },
  {
    ref: "60594",
    category: "opening",
    weight: 1,
    length: 4,
    height: 72,
    colors: TRIM,
  },
  {
    ref: "57895",
    category: "opening",
    weight: 1,
    length: 4,
    height: 144,
    colors: GLASS,
  },
  {
    ref: "60596",
    category: "opening",
    weight: 1,
    length: 4,
    height: 144,
    colors: TRIM,
  },
  {
    ref: "60616a",
    category: "opening",
    weight: 1,
    length: 4,
    height: 144,
    colors: TRIM,
  },
  {
    ref: "60599",
    category: "opening",
    weight: 1,
    length: 4,
    height: 72,
    colors: TRIM,
  },
  {
    ref: "3581",
    category: "opening",
    weight: 1,
    length: 1,
    height: 72,
    colors: TRIM,
  },
  {
    ref: "3582",
    category: "opening",
    weight: 1,
    length: 1,
    height: 72,
    colors: TRIM,
  },
  {
    ref: "30044",
    category: "opening",
    weight: 1,
    length: 2,
    height: 64,
    colors: TRIM,
  },
  {
    ref: "30046",
    category: "opening",
    weight: 1,
    length: 2,
    height: 64,
    colors: GLASS,
  },
  {
    ref: "60623",
    category: "opening",
    weight: 1,
    length: 4,
    height: 144,
    colors: TRIM,
  },
  {
    ref: "4132",
    category: "opening",
    weight: 1,
    length: 4,
    height: 72,
    colors: TRIM,
  },
  {
    ref: "4133",
    category: "opening",
    weight: 1,
    length: 4,
    height: 72,
    colors: GLASS,
  },
  // Arches.
  {
    ref: "3659",
    category: "arch",
    weight: 2,
    length: 4,
    height: 24,
    colors: WALL,
  },
  {
    ref: "3455",
    category: "arch",
    weight: 1,
    length: 6,
    height: 48,
    colors: WALL,
  },
  {
    ref: "6005",
    category: "arch",
    weight: 1,
    length: 3,
    height: 72,
    colors: WALL,
  },
  {
    ref: "3307",
    category: "arch",
    weight: 1,
    length: 6,
    height: 48,
    colors: WALL,
  },
  {
    ref: "18653",
    category: "arch",
    weight: 1,
    length: 3,
    height: 48,
    colors: WALL,
  },
  // Roofs.
  {
    ref: "3040b",
    category: "roof",
    weight: 3,
    height: 24,
    colors: WALL_ACCENT,
  },
  { ref: "3039", category: "roof", weight: 3, height: 24, colors: WALL_ACCENT },
  { ref: "3038", category: "roof", weight: 1, height: 24, colors: WALL_ACCENT },
  { ref: "3037", category: "roof", weight: 1, height: 24, colors: WALL_ACCENT },
  {
    ref: "3665a",
    category: "roof",
    weight: 1,
    height: 24,
    colors: WALL_ACCENT,
  },
  {
    ref: "3044b",
    category: "roof",
    weight: 1,
    height: 24,
    colors: WALL_ACCENT,
  },
  // Fences and railings.
  {
    ref: "3185",
    category: "fence",
    weight: 2,
    length: 4,
    height: 48,
    colors: TRIM,
  },
  {
    ref: "30055",
    category: "fence",
    weight: 1,
    length: 4,
    height: 48,
    colors: TRIM,
  },
  {
    ref: "3633",
    category: "fence",
    weight: 1,
    length: 4,
    height: 24,
    colors: TRIM,
  },
  {
    ref: "2412b",
    category: "fence",
    weight: 1,
    length: 2,
    height: 8,
    colors: TRIM,
  },
  // Round parts: domes, columns, lamps.
  { ref: "3062b", category: "round", weight: 3, height: 24, colors: ROUND },
  { ref: "3941", category: "round", weight: 2, height: 24, colors: ROUND },
  { ref: "6141", category: "round", weight: 3, height: 8, colors: ROUND },
  { ref: "4589", category: "round", weight: 1, height: 24, colors: ROUND },
  { ref: "30367a", category: "round", weight: 1, height: 96, colors: ROUND },
  { ref: "3960", category: "round", weight: 1, height: 12, colors: ROUND },
  { ref: "4286", category: "round", weight: 1, height: 24, colors: ROUND },
  // Plants.
  { ref: "6064b", category: "plant", weight: 2, height: 56, colors: PLANT },
  { ref: "3741a", category: "plant", weight: 2, height: 24, colors: PLANT },
  { ref: "3742", category: "plant", weight: 2, height: 8, colors: PLANT },
  { ref: "2423", category: "plant", weight: 1, height: 8, colors: PLANT },
  { ref: "32607", category: "plant", weight: 1, height: 8, colors: PLANT },
  { ref: "33291", category: "plant", weight: 1, height: 8, colors: PLANT },
];

type Variant = PartSpec & { color: string };

/** Every part/colour pair, ordered so a prefix covers every category and part. */
export function stressVariants(): Variant[] {
  const out: Variant[] = [];
  const most = Math.max(...STRESS_PARTS.map((p) => p.colors.length));
  for (let c = 0; c < most; c++)
    for (const part of STRESS_PARTS)
      if (c < part.colors.length) out.push({ ...part, color: part.colors[c] });
  return out;
}

function mulberry32(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type StressOptions = {
  /** Physical part occurrences (exact). Default 20,000. */
  parts?: number;
  /** Distinct part/colour variants (exact, at most stressVariants().length). Default 300. */
  variants?: number;
  /** Floor submodels. Default 4. */
  floors?: number;
  seed?: number;
};
export type StressModel = {
  text: string;
  parts: number;
  variants: number;
  floors: number;
  /** Occurrences per part reference (for inventory checks). */
  counts: Record<string, number>;
};

const HOUSE = 16; // studs per house side
const STUD = 20;
const IDENTITY = "1 0 0 0 1 0 0 0 1";
const TURN = "0 0 1 0 1 0 -1 0 0"; // 90° about -Y: local X runs along Z

/**
 * Generates the model. Part counts and variant counts are exact; positions follow
 * each category's place in a house (walls on the perimeter in courses, floors
 * inside, openings in the walls, roofs on top) so bounds and density resemble a
 * real architectural model.
 */
export function architecturalStressModel(
  options: StressOptions = {},
): StressModel {
  const parts = options.parts ?? 20000;
  const floors = Math.max(1, options.floors ?? 4);
  const all = stressVariants();
  const variantCount = Math.min(options.variants ?? 300, all.length);
  if (variantCount > parts)
    throw new Error("Need at least one part per variant");
  const variants = all.slice(0, variantCount);
  const random = mulberry32(options.seed ?? 20260928);
  const totalWeight = variants.reduce((s, v) => s + v.weight, 0);
  const pick = () => {
    let r = random() * totalWeight;
    for (const v of variants) if ((r -= v.weight) < 0) return v;
    return variants[variants.length - 1];
  };
  // Assign variants: each at least once, the rest by weight.
  const chosen: Variant[] = [...variants];
  while (chosen.length < parts) chosen.push(pick());
  for (let i = chosen.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [chosen[i], chosen[j]] = [chosen[j], chosen[i]];
  }
  const perFloor = Math.ceil(parts / floors);
  // Roughly 220 parts per house; lay houses out on a square grid per floor.
  const houses = Math.max(1, Math.ceil(perFloor / 220));
  const side = Math.ceil(Math.sqrt(houses));
  const floorHeight = 6 * 24 + 8;
  const counts: Record<string, number> = {};
  const floorsText: string[] = [];
  for (let f = 0; f < floors; f++) {
    const slice = chosen.slice(f * perFloor, (f + 1) * perFloor);
    const lines = [
      `0 FILE floor-${f + 1}.ldr`,
      `0 Floor ${f + 1}`,
      `0 Name: floor-${f + 1}.ldr`,
      "0 Author: brick-editor stress generator",
      "0 BFC CERTIFY CCW",
    ];
    // Per-house, per-category placement cursors.
    const cursor = new Map<string, number>();
    slice.forEach((v, i) => {
      const house = i % houses;
      const hx = (house % side) * (HOUSE + 4) * STUD;
      const hz = Math.floor(house / side) * (HOUSE + 4) * STUD;
      const key = house + ":" + v.category;
      const n = cursor.get(key) ?? 0;
      cursor.set(key, n + 1);
      let x = 0,
        y = 0,
        z = 0,
        basis = IDENTITY;
      const perimeter = 4 * HOUSE;
      switch (v.category) {
        case "wall":
        case "opening":
        case "arch": {
          // Walk the perimeter; each lap is one course.
          const step = v.category === "wall" ? 3 : 7;
          const along =
            (n * step + (v.category === "wall" ? 0 : 3)) % perimeter;
          const course = Math.floor((n * step) / perimeter) % 6;
          const edge = Math.floor(along / HOUSE),
            t = (along % HOUSE) * STUD;
          y = -24 * (course + 1);
          if (edge === 0) (x = t), (z = 0);
          else if (edge === 1) (x = HOUSE * STUD), (z = t), (basis = TURN);
          else if (edge === 2) (x = HOUSE * STUD - t), (z = HOUSE * STUD);
          else (x = 0), (z = HOUSE * STUD - t), (basis = TURN);
          break;
        }
        case "floor": {
          const cell = n % 64;
          x = (cell % 8) * 2 * STUD + STUD;
          z = Math.floor(cell / 8) * 2 * STUD + STUD;
          y = -8 * (1 + Math.floor(n / 64));
          break;
        }
        case "roof": {
          const along = (n * 2) % perimeter;
          const edge = Math.floor(along / HOUSE),
            t = (along % HOUSE) * STUD;
          y = -6 * 24 - 8 - 24 * Math.floor((n * 2) / perimeter);
          if (edge === 0) (x = t), (z = STUD);
          else if (edge === 1)
            (x = HOUSE * STUD - STUD), (z = t), (basis = TURN);
          else if (edge === 2)
            (x = HOUSE * STUD - t), (z = HOUSE * STUD - STUD);
          else (x = STUD), (z = HOUSE * STUD - t), (basis = TURN);
          break;
        }
        default: {
          // Fences, round parts and plants: terraces and courtyards.
          const cell = n % 36;
          x = (cell % 6) * 2.5 * STUD + 2 * STUD;
          z = Math.floor(cell / 6) * 2.5 * STUD + 2 * STUD;
          y = -8 - 24 * Math.floor(n / 36);
        }
      }
      lines.push(`1 ${v.color} ${hx + x} ${y} ${hz + z} ${basis} ${v.ref}.dat`);
      counts[v.ref + ".dat"] = (counts[v.ref + ".dat"] ?? 0) + 1;
    });
    floorsText.push(lines.join("\n"));
  }
  const main = [
    "0 FILE stress-village.ldr",
    "0 Stress village (generated, official parts only)",
    "0 Name: stress-village.ldr",
    "0 Author: brick-editor stress generator",
    "0 BFC CERTIFY CCW",
    ...Array.from(
      { length: floors },
      (_, f) => `1 16 0 ${-f * floorHeight} 0 ${IDENTITY} floor-${f + 1}.ldr`,
    ),
  ].join("\n");
  return {
    text: [main, ...floorsText].join("\n") + "\n",
    parts,
    variants: variantCount,
    floors,
    counts,
  };
}
