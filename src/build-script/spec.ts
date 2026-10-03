/**
 * Build Script v1: the declarative, agent-friendly build language
 * (docs/AGENT-BUILDING.md). This module is the single source of truth for
 * its shape: the TypeScript types, the validator with path-precise messages,
 * the generated JSON Schema (schemas/buildScript.v1.json) and the compact op
 * reference printed by `brick-cli build --reference` all derive from the
 * descriptor tables below.
 *
 * Units: x and z in studs, y (heights, levels) in plates; a brick is three
 * plates, and any height may be written "4b" (four bricks = 12 plates).
 * y = 0 is the top of the ground (baseplate). The front of a build faces −Z.
 */

export const BUILD_SCRIPT_VERSION = 1;

/** A height in plates, or "<n>b" for n bricks. */
export type Height = number | string;
export type Colour = string | number;
export type Vec2 = [number, number];
export type Vec3 = [number, Height, number];
export type Facing = "front" | "back" | "left" | "right";
export type Turn = 0 | 90 | 180 | 270;
export type PartRef =
  | string
  | { find: string; category?: string; colour?: Colour };
export type Region = { at: Vec2; size: Vec2 };
export type Opening = {
  side?: Facing;
  at: number;
  width: number;
  y?: Height;
  height?: Height;
  fill?: "auto" | "none" | "window" | "door";
  frame?: Colour;
  glass?: Colour;
  door?: Colour;
  opens?: "in" | "out";
};
export type Op = { op: string; [key: string]: unknown };
export type Section = { name: string; layer?: string; ops: Op[] };
export type BuildScript = {
  buildScript: 1;
  title: string;
  description?: string;
  author?: string;
  palette?: Record<string, Colour | { mix: Colour[] }>;
  parts?: Record<string, PartRef>;
  defaults?: {
    interior?: "empty" | "fill" | "solid";
    interiorColour?: Colour;
    overhang?: number;
    seed?: number;
  };
  components?: Record<string, { title?: string; size?: Vec2; ops: Op[] }>;
  sections: Section[];
  limits?: { maxParts?: number };
};

type T =
  | "int"
  | "num"
  | "posint"
  | "str"
  | "bool"
  | "height"
  | "colour"
  | "swatch"
  | "part"
  | "turn"
  | "facing"
  | "vec2"
  | "vec3"
  | "size2"
  | "size3"
  | "ops"
  | { enum: readonly (string | number)[] }
  | { array: T; min?: number; max?: number }
  | { object: Fields }
  | { record: T };
type Field = { t: T; req?: boolean; doc: string };
type Fields = Record<string, Field>;
type OpSpec = { doc: string; fields: Fields; example: Op };

const colour = (doc = "Colour: palette key, colour name or LDraw code") => ({
  t: "colour" as const,
  req: true,
  doc,
});
const opt = (t: T, doc: string): Field => ({ t, doc });
const req = (t: T, doc: string): Field => ({ t, req: true, doc });
const INTERIOR = { enum: ["empty", "fill", "solid"] } as const;
const region: T = {
  object: {
    at: req("vec2", "[x, z] minimum corner"),
    size: req("size2", "[w, d] studs"),
  },
};
const opening: T = {
  object: {
    side: opt("facing", "Wall side (room only): front|back|left|right"),
    at: req("int", "Offset along the wall from its start (studs)"),
    width: req("posint", "Width in studs"),
    y: opt("height", "Bottom above the wall base (plates, default 0)"),
    height: opt("height", "Height (plates; default: to the wall top)"),
    fill: opt(
      { enum: ["auto", "none", "window", "door"] },
      "What goes in: auto picks a window or door that fits exactly (default)",
    ),
    frame: opt("colour", "Window/door frame colour"),
    glass: opt("colour", "Window glass colour (default trans-clear)"),
    door: opt("colour", "Door leaf colour"),
    opens: opt({ enum: ["in", "out"] }, "Door swing (default in)"),
  },
};
/** Surface look of massing bricks (textured bricks, colour by course). */
const look = {
  texture: opt(
    { enum: ["masonry", "log", "grille"] },
    "Textured 1 × 2 bricks instead of plain ones: masonry (98283), log (30136) or grille (2877); plain bricks where the colour lacks them",
  ),
  pattern: opt(
    { enum: ["mix", "courses"] },
    "With a {mix} colour: mix picks per piece (default); courses lays the colours course by course (a brick course = 3 plates), for stripes and bands",
  ),
};
const quoins = opt(
  "colour",
  "Corner blocks in this colour, interlocking course by course (2 studs along one face, 1 along the other)",
);
const massing = {
  ...look,
  interior: opt(
    INTERIOR,
    "Unseen inside: empty (hollow shell), fill (cheap large bricks in the interior colour) or solid",
  ),
  thickness: opt("posint", "Shell wall thickness in studs when hollow"),
  open: opt(
    { array: { enum: ["top", "front", "back", "left", "right"] } },
    "Faces of a hollow shell to leave out",
  ),
  top: opt(
    { enum: ["studs", "tile"] },
    "Top surface: studs (default) or smooth tiles",
  ),
  pieces: opt(
    { enum: ["auto", "plates"] },
    "auto: bricks where 3 plates fit, else plates",
  ),
};

export const OPS: Record<string, OpSpec> = {
  box: {
    doc: "Rectangular volume packed into bricks/plates (greedy, staggered joints)",
    fields: {
      at: req("vec3", "[x, y, z] minimum corner"),
      size: req("size3", "[w, h, d]: studs, plates, studs"),
      colour: colour(),
      ...massing,
      quoins,
      supports: opt(
        "posint",
        "Hollow boxes: a 2 × 2 pier every this many studs (at least 4) under the lid of a wide shell",
      ),
    },
    example: {
      op: "box",
      at: [0, 0, 0],
      size: [8, "4b", 6],
      colour: "wall",
      interior: "empty",
    },
  },
  wall: {
    doc: "Straight wall along X or Z in running bond, with openings",
    fields: {
      from: req("vec2", "[x, z] first cell"),
      to: req("vec2", "[x, z] last cell (same x or same z as from)"),
      y: opt("height", "Base level (plates, default 0)"),
      height: req("height", "Height (plates or 'nb')"),
      colour: colour(),
      thickness: opt(
        { enum: [1, 2] },
        "Studs, grows towards +z (X walls) or +x (Z walls)",
      ),
      facing: opt("facing", "Outside of the wall, for windows and doors"),
      openings: opt({ array: opening }, "Door/window/plain openings"),
      top: massing.top,
      ...look,
    },
    example: {
      op: "wall",
      from: [0, 0],
      to: [11, 0],
      height: "6b",
      colour: "wall",
      facing: "front",
      openings: [{ at: 4, width: 4, height: 18, fill: "door" }],
    },
  },
  room: {
    doc: "Four 1-stud walls around a footprint with interlocking corners",
    fields: {
      at: req("vec3", "[x, y, z] outer minimum corner"),
      size: req("size3", "[w, h, d] outer size"),
      colour: colour(),
      openings: opt({ array: opening }, "Openings; each names its side"),
      floor: opt("colour", "Floor plate colour inside the walls"),
      top: massing.top,
      ...look,
      quoins,
    },
    example: {
      op: "room",
      at: [0, 0, 0],
      size: [12, "6b", 10],
      colour: "wall",
      floor: "tan",
      openings: [
        { side: "front", at: 4, width: 4, height: 18, fill: "door" },
        { side: "left", at: 3, width: 2, y: 3, height: 9 },
      ],
    },
  },
  floor: {
    doc: "Plate or tile area (floors, slabs, paving, water)",
    fields: {
      at: req("vec3", "[x, y, z] minimum corner"),
      size: req("size2", "[w, d] studs"),
      colour: colour(),
      layers: opt("posint", "Plates thick (default 1)"),
      top: massing.top,
      holes: opt({ array: region }, "Rectangles to leave open"),
    },
    example: {
      op: "floor",
      at: [0, 6, 0],
      size: [12, 10],
      colour: "tan",
      top: "tile",
    },
  },
  carve: {
    doc: "Remove massing in a volume (later ops can fill it again)",
    fields: {
      at: req("vec3", "[x, y, z] minimum corner"),
      size: req("size3", "[w, h, d]"),
    },
    example: { op: "carve", at: [4, 3, 0], size: [2, 9, 1] },
  },
  line: {
    doc: "One-stud line of massing between two cells (beams, posts)",
    fields: {
      from: req("vec3", "[x, y, z]"),
      to: req("vec3", "[x, y, z]"),
      colour: colour(),
    },
    example: {
      op: "line",
      from: [0, 0, 0],
      to: [0, "5b", 0],
      colour: "wood",
    },
  },
  cylinder: {
    doc: "Round massing (towers, tanks): a stud disc per level",
    fields: {
      at: req("vec3", "[x, y, z] minimum corner of the bounding square"),
      diameter: req("posint", "Studs"),
      height: req("height", "Plates or 'nb'"),
      colour: colour(),
      ...massing,
    },
    example: {
      op: "cylinder",
      at: [0, 0, 0],
      diameter: 8,
      height: "10b",
      colour: "stone",
      interior: "empty",
    },
  },
  dome: {
    doc: "Hemispherical massing (Santorini domes, cupolas), 1-stud shell",
    fields: {
      at: req("vec3", "[x, y, z] minimum corner of the base square"),
      diameter: req("posint", "Studs"),
      colour: colour(),
      interior: massing.interior,
    },
    example: {
      op: "dome",
      at: [0, 18, 0],
      diameter: 8,
      colour: "blue",
    },
  },
  stairs: {
    doc: "A flight of steps (massing); rise 1 plate is Play-walkable",
    fields: {
      at: req(
        "vec3",
        "[x, y, z] of the first step: its minimum corner climbing +x/+z; climbing -x/-z the first step ends at at (it covers at - run + 1 .. at)",
      ),
      width: req("posint", "Studs across"),
      steps: req("posint", "Number of steps"),
      dir: req({ enum: ["+x", "-x", "+z", "-z"] }, "Climbing direction"),
      rise: opt("height", "Plates per step (default 1)"),
      run: opt("posint", "Studs per step (default 1)"),
      colour: colour(),
      top: massing.top,
    },
    example: {
      op: "stairs",
      at: [0, 0, -4],
      width: 3,
      steps: 6,
      dir: "+z",
      colour: "stone",
      top: "tile",
    },
  },
  roof: {
    doc: "Roof over a footprint: 45° gable, hip or shed (lean-to) slopes, or flat",
    fields: {
      style: req(
        { enum: ["gable", "hip", "flat", "shed"] },
        "Roof shape (shed: one slope, a lean-to against a higher wall)",
      ),
      facing: opt(
        "facing",
        "Shed roofs: the side the slope faces (its low edge; default front)",
      ),
      at: req("vec3", "[x, y, z]: footprint corner; y = wall top"),
      size: req("size2", "[w, d] footprint (walls' outer size)"),
      colour: colour(),
      ridge: opt(
        { enum: ["x", "z"] },
        "Ridge direction (default: along the longer side)",
      ),
      overhang: opt({ enum: [0, 1] }, "Eave overhang in studs (default 1)"),
      pitch: opt(
        { enum: [45, 75] },
        "Hip roofs: 75 makes a steep spire of 75° slopes (a stud in per three bricks, a cone on top); default 45",
      ),
      ends: opt(
        { enum: [0, 1] },
        "Overhang past the ends of the ridge (default: overhang); 0 for houses in a terrace",
      ),
      gable: opt("colour", "Gable-end wall colour (default roof colour)"),
      parapet: opt("height", "Flat roofs: parapet height (plates)"),
      holes: opt(
        { array: region },
        "Cells left out of the slopes (chimneys): [{at: [x, z], size: [w, d]}]",
      ),
    },
    example: {
      op: "roof",
      style: "gable",
      at: [0, 18, 0],
      size: [12, 10],
      colour: "roof",
      gable: "wall",
    },
  },
  window: {
    doc: "Framed, glazed window; carves its opening",
    fields: {
      at: req("vec3", "[x, y, z] footprint corner"),
      facing: req("facing", "Outside direction"),
      size: opt(
        { enum: ["1x2x2", "1x2x3", "1x4x3"] },
        "Frame size (default 1x2x3)",
      ),
      frame: colour("Frame colour"),
      glass: opt("colour", "Glass colour (default trans-clear)"),
    },
    example: {
      op: "window",
      at: [2, 3, 0],
      facing: "front",
      size: "1x2x3",
      frame: "white",
    },
  },
  door: {
    doc: "Door frame 1x4x6 with a hinged door (Play opens it)",
    fields: {
      at: req("vec3", "[x, y, z] footprint corner"),
      facing: req("facing", "Outside direction"),
      frame: colour("Frame colour"),
      colour: opt("colour", "Door colour (default frame colour)"),
      opens: opt({ enum: ["in", "out"] }, "Swing (default in)"),
      style: opt({ enum: ["smooth", "panes"] }, "Door leaf"),
    },
    example: {
      op: "door",
      at: [4, 0, 0],
      facing: "front",
      frame: "white",
      colour: "red",
    },
  },
  place: {
    doc: "One part at a stud cell (window frames get their glass)",
    fields: {
      part: req("part", "Part number, @alias or {find: 'text'}"),
      at: req("vec3", "[x, y, z] footprint corner; y = underside level"),
      colour: colour(),
      turn: opt("turn", "Degrees about Y: 0 90 180 270"),
      anchor: opt(
        { enum: ["footprint", "origin"] },
        "footprint (default): at is the footprint's corner cell and y its underside; origin: at is the grid point (x, z) and plate level (y) of the part's own origin, for parts made to fit together (a boat hull and its deck share one)",
      ),
      wheels: opt(
        "colour",
        "Plate 2 × 2 with Wheel Holders (4600) only: rim colour; adds two wheels with black tyres (place the plate's underside 2 plates up so they reach the ground)",
      ),
    },
    example: {
      op: "place",
      part: { find: "lamp post" },
      at: [2, 0, -3],
      colour: "black",
    },
  },
  column: {
    doc: "Round column of round bricks (1, 2 or 4 studs) with a cap",
    fields: {
      at: req("vec3", "[x, y, z] footprint corner"),
      height: req("height", "Plates or 'nb'"),
      diameter: opt({ enum: [1, 2, 4] }, "Studs (default 1)"),
      colour: colour(),
      cap: opt(
        { enum: ["none", "cone", "plate", "tile"] },
        "Top (default none)",
      ),
      capColour: opt("colour", "Cap colour (default column colour)"),
    },
    example: {
      op: "column",
      at: [0, 0, 0],
      height: "4b",
      diameter: 2,
      colour: "white",
    },
  },
  fence: {
    doc: "Fence or railing along an axis-aligned path",
    fields: {
      path: req({ array: "vec2", min: 2 }, "[[x, z], ...] cells, corners"),
      y: opt("height", "Base level (default 0)"),
      colour: colour(),
      style: opt(
        { enum: ["picket", "lattice", "lattice-low", "spindle", "panel"] },
        "Fence style (default lattice-low: 1 brick high)",
      ),
    },
    example: {
      op: "fence",
      path: [
        [0, 0],
        [15, 0],
        [15, 8],
      ],
      colour: "white",
      style: "picket",
    },
  },
  baseplate: {
    doc: "Ground baseplates tiled over an area (top at y = 0)",
    fields: {
      at: req("vec2", "[x, z] minimum corner"),
      size: req("size2", "[w, d]: multiples of 16 studs"),
      colour: colour(),
    },
    example: {
      op: "baseplate",
      at: [-24, -24],
      size: [48, 48],
      colour: "green",
    },
  },
  track: {
    doc: "Official train track laid piece by piece (Play runs trains on it)",
    fields: {
      at: req(
        "vec3",
        "[x, y, z]: the grid point where the track starts (between studs); y = level the sleepers stand on",
      ),
      dir: req({ enum: ["+x", "-x", "+z", "-z"] }, "Direction it leaves in"),
      pieces: req(
        "str",
        "S straight (16 studs), L/R curve 22.5° (R40: 16 make a circle), W/V 9V points left/right; e.g. 'SSSS LLLLLLLL SSSS LLLLLLLL' is an oval 64 + 80 studs long, 80 across",
      ),
      branch: opt(
        "str",
        "Pieces laid from the last points' diverging end (a siding)",
      ),
      colour: opt("colour", "Track colour (default dark bluish grey)"),
    },
    example: {
      op: "track",
      at: [-32, 0, -40],
      dir: "+x",
      pieces: "SSSS LLLLLLLL SSSS LLLLLLLL",
    },
  },
  railcar: {
    doc: "A rail vehicle on the track: train base 6 x 24 on two bogies with a component as its body",
    fields: {
      at: req(
        "vec3",
        "[x, y, z]: the car's centre, a grid point on the track's centreline; y = the track's level",
      ),
      dir: req(
        { enum: ["+x", "-x", "+z", "-z"] },
        "Direction the car's front faces",
      ),
      component: opt(
        "str",
        "Body built on the deck: its frame is 24 long along +x (front at x = 23), 6 wide along z, y = 0 the deck top",
      ),
      colour: opt("colour", "Base and bogie colour (default black)"),
      palette: opt(
        { record: "swatch" },
        "Palette overrides for the body component",
      ),
      with: opt({ array: "str" }, "Flags for the body component"),
    },
    example: {
      op: "railcar",
      at: [0, 0, -40],
      dir: "+x",
      component: "loco",
    },
  },
  repeat: {
    doc: "Repeat ops count times, offset by step each time",
    fields: {
      count: req("posint", "Copies (including the first)"),
      step: req("vec3", "[dx, dy, dz] per copy"),
      ops: req("ops", "Ops to repeat"),
    },
    example: {
      op: "repeat",
      count: 4,
      step: [3, 0, 0],
      ops: [
        {
          op: "window",
          at: [1, 3, 0],
          facing: "front",
          frame: "white",
        },
      ],
    },
  },
  mirror: {
    doc: "Ops and their mirror image across x = about or z = about",
    fields: {
      axis: req({ enum: ["x", "z"] }, "Coordinate that is mirrored"),
      about: req("num", "Mirror plane (studs; 10 maps cell 9 to 10)"),
      ops: req("ops", "Ops"),
      keep: opt("bool", "Keep the original too (default true)"),
    },
    example: {
      op: "mirror",
      axis: "x",
      about: 10,
      ops: [{ op: "column", at: [2, 0, 0], height: "4b", colour: "white" }],
    },
  },
  group: {
    doc: "Ops in a local frame: offset, then turned about the frame origin",
    fields: {
      at: opt("vec3", "[x, y, z] offset of the local origin"),
      turn: opt("turn", "Degrees about Y"),
      ops: req("ops", "Ops in local coordinates"),
    },
    example: {
      op: "group",
      at: [20, 0, 0],
      turn: 90,
      ops: [{ op: "box", at: [0, 0, 0], size: [4, 3, 2], colour: "wall" }],
    },
  },
  instance: {
    doc: "A component (a real LDraw submodel) placed at a stud cell",
    fields: {
      component: req("str", "Name in components"),
      at: req("vec3", "[x, y, z] where its footprint corner goes"),
      turn: opt("turn", "Degrees about Y"),
      palette: opt(
        { record: "swatch" },
        'Palette keys recoloured for this copy: {"wall": "sand green"} (each variant is its own submodel)',
      ),
      with: opt(
        { array: "str" },
        'Flags for this copy: the component ops with "when": "flag" run, those with "when": "!flag" do not',
      ),
    },
    example: {
      op: "instance",
      component: "lamp",
      at: [4, 0, -2],
    },
  },
  scatter: {
    doc: "Detail pass: parts dropped on exposed tops in a region (seeded)",
    fields: {
      region: req(region, "{at: [x, z], size: [w, d]}"),
      parts: req({ array: "part", min: 1 }, "Parts to choose from"),
      colours: req({ array: "colour", min: 1 }, "Colours to choose from"),
      density: opt("num", "0..1 share of free cells (default 0.2)"),
      spacing: opt(
        "posint",
        "Minimum distance between parts in studs, |dx|+|dz| (default 1)",
      ),
      seed: opt("int", "Random seed (default 1)"),
    },
    example: {
      op: "scatter",
      region: { at: [-20, -20], size: [10, 6] },
      parts: [{ find: "plate 1x1 flower" }],
      colours: ["yellow", "red", "white"],
      density: 0.3,
    },
  },
  smooth: {
    doc: "Detail pass: exposed tops in a region become tiles",
    fields: { region: opt(region, "Region (default: everywhere)") },
    example: { op: "smooth", region: { at: [0, 0], size: [12, 10] } },
  },
};

export type ValidationIssue = { path: string; message: string };

const HEIGHT_RE = /^(\d+)b$/;
/** Plates from a height ("3b" → 9). */
export function plates(h: Height): number {
  if (typeof h === "number") return h;
  const m = HEIGHT_RE.exec(h.trim());
  if (!m) throw new Error("Invalid height " + JSON.stringify(h));
  return 3 * Number(m[1]);
}

const isInt = (v: unknown) => typeof v === "number" && Number.isInteger(v);
const isHeight = (v: unknown) =>
  isInt(v) || (typeof v === "string" && HEIGHT_RE.test(v.trim()));
const COORD = 100000;

function check(t: T, v: unknown, path: string, out: ValidationIssue[]) {
  const bad = (message: string) => out.push({ path, message });
  if (typeof t === "object") {
    if ("enum" in t) {
      if (!t.enum.includes(v as string))
        bad(
          `must be one of ${t.enum.map((e) => JSON.stringify(e)).join(", ")}`,
        );
    } else if ("array" in t) {
      if (!Array.isArray(v)) return bad("must be an array");
      if (t.min !== undefined && v.length < t.min)
        bad(`needs at least ${t.min} items`);
      if (v.length > (t.max ?? 100000)) bad("has too many items");
      v.forEach((item, i) => check(t.array, item, `${path}[${i}]`, out));
    } else if ("object" in t) {
      checkFields(t.object, v, path, out);
    } else if ("record" in t) {
      if (!v || typeof v !== "object" || Array.isArray(v))
        return bad("must be an object");
      for (const [k, item] of Object.entries(v))
        check(t.record, item, `${path}.${k}`, out);
    }
    return;
  }
  switch (t) {
    case "int":
      if (!isInt(v) || Math.abs(v as number) > COORD) bad("must be an integer");
      return;
    case "posint":
      if (!isInt(v) || (v as number) < 1 || (v as number) > COORD)
        bad("must be a positive integer");
      return;
    case "num":
      if (typeof v !== "number" || !Number.isFinite(v)) bad("must be a number");
      return;
    case "str":
      if (typeof v !== "string" || !v) bad("must be a non-empty string");
      return;
    case "bool":
      if (typeof v !== "boolean") bad("must be true or false");
      return;
    case "height":
      if (!isHeight(v))
        bad('must be an integer number of plates or "<n>b" (bricks)');
      return;
    case "colour":
      if (typeof v !== "number" && (typeof v !== "string" || !v))
        bad("must be a palette key, colour name or LDraw colour code");
      return;
    case "swatch": {
      const mix = (v as { mix?: unknown } | null)?.mix;
      if (v && typeof v === "object" && !Array.isArray(v)) {
        if (
          !Array.isArray(mix) ||
          !mix.length ||
          mix.some(
            (c) => typeof c !== "number" && (typeof c !== "string" || !c),
          )
        )
          bad('must be a colour or {"mix": [colours...]}');
      } else if (typeof v !== "number" && (typeof v !== "string" || !v))
        bad('must be a colour or {"mix": [colours...]}');
      return;
    }
    case "part":
      if (typeof v === "string") {
        if (!v) bad("must name a part");
        return;
      }
      if (
        !v ||
        typeof v !== "object" ||
        typeof (v as { find?: unknown }).find !== "string"
      )
        return bad('must be a part number, "@alias" or {"find": "text"}');
      checkFields(
        {
          find: req("str", ""),
          category: opt("str", ""),
          colour: opt("colour", ""),
        },
        v,
        path,
        out,
      );
      return;
    case "turn":
      if (![0, 90, 180, 270].includes(v as number))
        bad("must be 0, 90, 180 or 270");
      return;
    case "facing":
      if (!["front", "back", "left", "right"].includes(v as string))
        bad("must be front, back, left or right");
      return;
    case "vec2":
    case "size2":
      if (
        !Array.isArray(v) ||
        v.length !== 2 ||
        !v.every(isInt) ||
        (t === "size2" && !v.every((n) => n >= 1))
      )
        bad(
          t === "vec2"
            ? "must be [x, z] integers (studs)"
            : "must be [w, d] positive integers (studs)",
        );
      return;
    case "vec3":
    case "size3":
      if (
        !Array.isArray(v) ||
        v.length !== 3 ||
        !isInt(v[0]) ||
        !isInt(v[2]) ||
        !isHeight(v[1]) ||
        (t === "size3" &&
          ((v[0] as number) < 1 ||
            (v[2] as number) < 1 ||
            plates(v[1] as Height) < 1))
      )
        bad(
          t === "vec3"
            ? '[x, y, z]: integer studs, y in plates or "<n>b"'
            : '[w, h, d]: positive studs, h in plates or "<n>b"',
        );
      return;
    case "ops":
      if (!Array.isArray(v)) return bad("must be an array of ops");
      v.forEach((op, i) => checkOp(op, `${path}[${i}]`, out));
      return;
  }
}
function checkFields(
  fields: Fields,
  v: unknown,
  path: string,
  out: ValidationIssue[],
  extra: string[] = [],
) {
  if (!v || typeof v !== "object" || Array.isArray(v))
    return out.push({ path, message: "must be an object" });
  const o = v as Record<string, unknown>;
  for (const [k, f] of Object.entries(fields)) {
    if (o[k] === undefined) {
      if (f.req) out.push({ path: `${path}.${k}`, message: "is required" });
    } else check(f.t, o[k], `${path}.${k}`, out);
  }
  for (const k of Object.keys(o))
    if (!Object.hasOwn(fields, k) && !extra.includes(k))
      out.push({
        path: `${path}.${k}`,
        message: `unknown field (allowed: ${Object.keys(fields).join(", ")})`,
      });
}
function checkOp(op: unknown, path: string, out: ValidationIssue[]) {
  const name = (op as { op?: unknown })?.op;
  if (typeof name !== "string" || !Object.hasOwn(OPS, name))
    return out.push({
      path: path + ".op",
      message: `unknown op ${JSON.stringify(name)} (ops: ${Object.keys(OPS).join(", ")})`,
    });
  checkFields(OPS[name].fields, op, path, out, ["op", "note", "when"]);
  const when = (op as { when?: unknown }).when;
  if (
    when !== undefined &&
    (typeof when !== "string" || !/^!?[\w-]+$/.test(when))
  )
    out.push({
      path: path + ".when",
      message: 'must be a flag name, or "!name" (run when the flag is not set)',
    });
}

const TOP: Fields = {
  buildScript: req({ enum: [1] }, "Language version (1)"),
  title: req("str", "Build title"),
  description: opt("str", "What is being built"),
  author: opt("str", "Author"),
  palette: opt(
    { record: "colour" },
    'Named colours: {"wall": "white", "stone": {"mix": ["light bluish grey", "dark bluish grey"]}}',
  ),
  parts: opt(
    { record: "part" },
    'Named parts: {"lamp": {"find": "lamp post"}}',
  ),
  defaults: opt(
    {
      object: {
        interior: opt(INTERIOR, "Default interior of box/cylinder (empty)"),
        interiorColour: opt("colour", "Colour of filled interiors"),
        overhang: opt({ enum: [0, 1] }, "Default roof overhang"),
        seed: opt("int", "Seed for colour mixes and scatter"),
      },
    },
    "Defaults",
  ),
  components: opt(
    {
      record: {
        object: {
          title: opt("str", "Title"),
          size: opt(
            "size2",
            "[w, d]: its plot, from [0, 0] in its own frame; instance places this rectangle, so awnings, bays and ledges sticking out do not shift it (default: everything it holds)",
          ),
          ops: req("ops", "Ops in the component's own frame"),
        },
      },
    },
    "Reusable submodels (placed with instance)",
  ),
  sections: req(
    {
      array: {
        object: {
          name: req("str", "Section (submodel) name"),
          layer: opt("str", "Layer name (default: the section name)"),
          ops: req("ops", "Ops"),
        },
      },
      min: 1,
    },
    "Sections, compiled in order",
  ),
  limits: opt(
    { object: { maxParts: opt("posint", "Refuse builds larger than this") } },
    "Limits",
  ),
};

/** Structural validation with path-precise messages (empty: valid). */
export function validateBuildScript(script: unknown): ValidationIssue[] {
  const out: ValidationIssue[] = [];
  checkFields(TOP, script, "$", out, ["$schema"]);
  // Palette values may be {mix: [...]}; re-check them precisely.
  const palette = (script as BuildScript | undefined)?.palette;
  if (palette && typeof palette === "object") {
    for (let i = out.length - 1; i >= 0; i--)
      if (out[i].path.startsWith("$.palette.")) out.splice(i, 1);
    for (const [k, v] of Object.entries(palette)) {
      if (v && typeof v === "object" && !Array.isArray(v)) {
        const mix = (v as { mix?: unknown }).mix;
        if (
          !Array.isArray(mix) ||
          !mix.length ||
          mix.some((c) => typeof c !== "number" && typeof c !== "string")
        )
          out.push({
            path: `$.palette.${k}`,
            message: 'must be a colour or {"mix": [colours...]}',
          });
      } else check("colour", v, `$.palette.${k}`, out);
    }
  }
  return out.slice(0, 100);
}

// JSON Schema (draft-07) generated from the same tables.
const HEIGHT_SCHEMA = {
  anyOf: [{ type: "integer" }, { type: "string", pattern: "^[0-9]+b$" }],
  description: 'Plates, or "<n>b" for n bricks',
};
function schemaOf(t: T): unknown {
  if (typeof t === "object") {
    if ("enum" in t) return { enum: t.enum };
    if ("array" in t)
      return {
        type: "array",
        items: schemaOf(t.array),
        ...(t.min ? { minItems: t.min } : {}),
      };
    if ("object" in t) return objectSchema(t.object);
    return { type: "object", additionalProperties: schemaOf(t.record) };
  }
  switch (t) {
    case "int":
      return { type: "integer" };
    case "posint":
      return { type: "integer", minimum: 1 };
    case "num":
      return { type: "number" };
    case "str":
      return { type: "string", minLength: 1 };
    case "bool":
      return { type: "boolean" };
    case "height":
      return HEIGHT_SCHEMA;
    case "colour":
      return { $ref: "#/definitions/colour" };
    case "swatch":
      return {
        anyOf: [
          { $ref: "#/definitions/colour" },
          {
            type: "object",
            properties: {
              mix: {
                type: "array",
                items: { $ref: "#/definitions/colour" },
                minItems: 1,
              },
            },
            required: ["mix"],
            additionalProperties: false,
          },
        ],
      };
    case "part":
      return { $ref: "#/definitions/part" };
    case "turn":
      return { enum: [0, 90, 180, 270] };
    case "facing":
      return { enum: ["front", "back", "left", "right"] };
    case "vec2":
    case "size2":
      return {
        type: "array",
        items: { type: "integer", ...(t === "size2" ? { minimum: 1 } : {}) },
        minItems: 2,
        maxItems: 2,
      };
    case "vec3":
    case "size3":
      return {
        type: "array",
        items: [{ type: "integer" }, HEIGHT_SCHEMA, { type: "integer" }],
        minItems: 3,
        maxItems: 3,
      };
    case "ops":
      return { type: "array", items: { $ref: "#/definitions/op" } };
  }
}
function objectSchema(fields: Fields, extra: Record<string, unknown> = {}) {
  return {
    type: "object",
    properties: {
      ...extra,
      ...Object.fromEntries(
        Object.entries(fields).map(([k, f]) => [
          k,
          { ...(schemaOf(f.t) as object), description: f.doc || undefined },
        ]),
      ),
    },
    required: Object.entries(fields)
      .filter(([, f]) => f.req)
      .map(([k]) => k),
    additionalProperties: false,
  };
}
export function buildScriptJsonSchema() {
  const top = objectSchema(TOP, { $schema: { type: "string" } });
  (top.properties as Record<string, unknown>).palette = {
    type: "object",
    additionalProperties: {
      anyOf: [
        { $ref: "#/definitions/colour" },
        {
          type: "object",
          properties: {
            mix: {
              type: "array",
              items: { $ref: "#/definitions/colour" },
              minItems: 1,
            },
          },
          required: ["mix"],
          additionalProperties: false,
        },
      ],
    },
    description: TOP.palette.doc,
  };
  return {
    title: "Brick Editor Build Script v1",
    description:
      'Declarative build language compiled to LDraw parts (docs/AGENT-BUILDING.md). x/z in studs, y in plates ("4b" = 4 bricks); y = 0 is the ground; the front faces -Z.',
    ...top,
    definitions: {
      colour: {
        anyOf: [
          { type: "integer", minimum: 0 },
          { type: "string", minLength: 1 },
        ],
        description:
          "Palette key, colour name (e.g. 'light bluish grey') or LDraw code",
      },
      part: {
        anyOf: [
          { type: "string", minLength: 1 },
          objectSchema({
            find: req("str", "Search text, e.g. '1x2 tile'"),
            category: opt("str", "Category filter"),
            colour: opt("colour", "Prefer parts made in this colour"),
          }),
        ],
        description: "Part number ('3001'), @alias, or {find: 'text'}",
      },
      op: {
        type: "object",
        required: ["op"],
        properties: { op: { enum: Object.keys(OPS) } },
        allOf: Object.entries(OPS).map(([name, spec]) => ({
          if: { properties: { op: { const: name } } },
          then: {
            ...objectSchema(spec.fields, {
              op: { const: name },
              note: { type: "string" },
              when: {
                type: "string",
                pattern: "^!?[\\w-]+$",
                description:
                  "Run only in component copies placed with this flag in `with` ('!flag': only without it)",
              },
            }),
            description: spec.doc,
          },
        })),
      },
    },
  };
}

/** Compact op reference (brick-cli build --reference). */
export function opReference() {
  const lines = [
    "Build Script v1 ops. Units: x,z studs; y plates ('4b' = 4 bricks); y=0 ground; front faces -Z.",
  ];
  for (const [name, spec] of Object.entries(OPS)) {
    lines.push("", `${name}: ${spec.doc}`);
    for (const [k, f] of Object.entries(spec.fields))
      lines.push(`  ${f.req ? "*" : " "}${k}: ${f.doc}`);
    lines.push("  e.g. " + JSON.stringify(spec.example));
  }
  return lines.join("\n");
}
