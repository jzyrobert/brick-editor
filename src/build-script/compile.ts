/**
 * Deterministic Build Script compiler: script → LDraw MPD → project, plus a
 * structured report for agents (counts, bounds, part list, resolved part
 * searches, and problems that name the op that caused them).
 *
 * Model: ops run in document order. Massing ops (box, wall, room, floor,
 * cylinder, dome, stairs, line, carve and gable ends) write voxel cells of one
 * stud by one plate; part ops (window, door, place, column, fence, roof
 * slopes, instances) emit real parts and reserve the cells they fill, which
 * carves any massing there (parts win). Detail ops (scatter, smooth) run after
 * all others on the finished massing. Finally the massing is packed into
 * bricks, plates and tiles (pack.ts) and every part is checked for overlaps,
 * grid placement and verified connectivity (src/catalog/builds/check.ts).
 *
 * Output: one submodel per section (placed at the identity, so section
 * coordinates are world coordinates) and one per instanced component, as
 * ordinary LDraw; each section's parts go to a layer named after it.
 */
import { catalog } from "../catalog/catalog";
import { partSpec } from "../catalog/extended";
import {
  colorAvailabilityLoaded,
  colorExistence,
  madeIn,
} from "../catalog/color-availability";
import { fullConnectorEntry } from "../catalog/full-connectors";
import { decodeOccupancy } from "../catalog/connector-pack";
import { localOccupancy } from "../edit/snap";
import {
  Model,
  basis,
  footprint,
  underside,
  localBounds,
} from "../catalog/builds/kit";
import { checkBuild } from "../catalog/builds/check";
import { importLDraw } from "../ldraw/io";
import { encodePath as encode, occurrences } from "../core/document";
import {
  AppError,
  type Basis,
  type Project,
  type Vec3 as V3,
} from "../core/types";
import {
  resourceLimits,
  type ResourceProfileName,
} from "../core/resource-profile";
import { transformBounds, type Bounds } from "../core/spatial";
import {
  plates,
  validateBuildScript,
  type BuildScript,
  type Colour,
  type Facing,
  type Height,
  type Op,
  type Opening,
  type PartRef,
  type Turn,
  type ValidationIssue,
} from "./spec";
import { colourName, colourSuggestions, resolveColourName } from "./palette";
import {
  Grid,
  TEXTURES,
  cellKey,
  cellOf,
  hash01,
  packGrid,
  textureMadeIn,
  type Material,
} from "./pack";
import { roleParts, searchParts } from "./part-search";
import { LAYER_COMMENT, assignSectionLayers } from "./layers";
import { placeTrackPiece, type TrackCursor } from "../play/track";
import { partRange } from "./budget";

export type Problem = {
  severity: "error" | "warning" | "info";
  code: string;
  message: string;
  /** Source ops ("sections[1].ops[4]" or "components.lamp.ops[0]"). */
  ops?: string[];
};
export type CompileReport = {
  ok: boolean;
  buildScript: 1;
  title: string;
  stats: {
    parts: number;
    designs: number;
    lots: number;
    massingCells: number;
    massingParts: number;
    placedParts: number;
    sections: number;
    components: number;
    opsRun: number;
    scriptBytes: number;
    ldrawBytes: number;
    partsPerScriptKB: number;
    compileMs: number;
    checkMs: number;
  };
  bounds: {
    studs: { min: [number, number, number]; max: [number, number, number] };
    ldu: { min: V3; max: V3 };
  } | null;
  sections: { name: string; layer: string; parts: number }[];
  parts: {
    ref: string;
    name: string;
    colour: string;
    colourName: string;
    count: number;
  }[];
  /** The ops that produced the most parts (to see where parts go). */
  heaviestOps: { op: string; kind: string; parts: number }[];
  resolved: { op: string; find: string; ref: string; name: string }[];
  check: {
    overlaps: number;
    offGrid: number;
    groups: number;
    covered: number;
    uncovered: number;
    health: string;
  } | null;
  problems: Problem[];
};
export { partRange, outsideBudget } from "./budget";
export type CompileOptions = {
  profile?: ResourceProfileName;
  /** Run the build checks (default true). */
  check?: boolean;
  /** Occupancy boxes for parts whose derived data is not loaded (the CLI
   * derives them from the complete library on disk). */
  occupancyFor?: (refs: string[]) => Record<string, Bounds[]>;
  /** Part target: a build outside `targetParts` ± `leeway` percent still
   * compiles, with an `over-budget` or `under-budget` error saying by how
   * much; see outsideBudget(). The script's `limits.maxParts` is a hard cap on
   * top. */
  targetParts?: number;
  /** Percent either side of `targetParts` (default 10). */
  leeway?: number;
  /** Clock for timings (tests pass a fixed one). */
  now?: () => number;
};
export type CompileResult = {
  report: CompileReport;
  ldraw: string;
  project: Project | null;
};

// ---------------------------------------------------------------------------
// Frames: integer transforms of the stud grid (turns about Y and mirrors).

type Mat = [number, number, number, number]; // x' = a x + b z; z' = c x + d z
type Frame = { m: Mat; tx: number; ty: number; tz: number };
const IDENTITY: Frame = { m: [1, 0, 0, 1], tx: 0, ty: 0, tz: 0 };
const turnMat = (t: number): Mat => {
  const b = basis((((t % 360) + 360) % 360) as Turn);
  return [b[0], b[2], b[6], b[8]];
};
const mul = (p: Mat, q: Mat): Mat => [
  p[0] * q[0] + p[1] * q[2],
  p[0] * q[1] + p[1] * q[3],
  p[2] * q[0] + p[3] * q[2],
  p[2] * q[1] + p[3] * q[3],
];
const det = (m: Mat) => m[0] * m[3] - m[1] * m[2];
const same = (p: Mat, q: Mat) => p.every((v, i) => v === q[i]);
function turnOf(m: Mat): Turn {
  for (const t of [0, 90, 180, 270] as Turn[])
    if (same(turnMat(t), m)) return t;
  throw new Error("Not a turn");
}
const point = (f: Frame, x: number, z: number): [number, number] => [
  f.m[0] * x + f.m[1] * z + f.tx,
  f.m[2] * x + f.m[3] * z + f.tz,
];
/** World rectangle of a local cell rectangle. */
function rect(f: Frame, x: number, z: number, w: number, d: number) {
  const [ax, az] = point(f, x, z),
    [bx, bz] = point(f, x + w, z + d);
  return {
    x: Math.min(ax, bx),
    z: Math.min(az, bz),
    w: Math.abs(bx - ax),
    d: Math.abs(bz - az),
  };
}
/** f ∘ (translate(at) ∘ turn). */
function child(f: Frame, at: [number, number, number], turn = 0): Frame {
  const [x, z] = point(f, at[0], at[2]);
  return { m: mul(f.m, turnMat(turn)), tx: x, ty: f.ty + at[1], tz: z };
}
function mirrored(f: Frame, axis: "x" | "z", about: number): Frame {
  // Local reflection p → (2a − x, z) (or z), then f.
  const r: Mat = axis === "x" ? [-1, 0, 0, 1] : [1, 0, 0, -1];
  const [ox, oz] = point(
    f,
    axis === "x" ? 2 * about : 0,
    axis === "z" ? 2 * about : 0,
  );
  return { m: mul(f.m, r), tx: ox, ty: f.ty, tz: oz };
}
const FACING_TURN: Record<Facing, Turn> = {
  front: 0,
  left: 90,
  back: 180,
  right: 270,
};

// Parts whose mirror image is themselves across a diagonal (corner slopes).
const DIAGONAL = new Set(["3045.dat", "3046.dat", "3676.dat", "3685.dat"]);
let chiral: Map<string, string> | undefined;
/** Left ↔ right counterpart of a part, by name. */
function counterpart(ref: string) {
  if (!chiral) {
    chiral = new Map();
    const byName = new Map<string, string>();
    for (const p of Object.values(catalog)) byName.set(p.name, p.id);
    for (const [name, id] of byName) {
      const other = name.includes("Left")
        ? name.replace("Left", "Right")
        : name.includes("Right")
          ? name.replace("Right", "Left")
          : undefined;
      if (other && byName.has(other)) chiral.set(id, byName.get(other)!);
    }
  }
  return chiral.get(ref);
}

// ---------------------------------------------------------------------------

const GLASS: Record<string, string> = {
  "60592.dat": "60601.dat",
  "60593.dat": "60602.dat",
  "60594.dat": "60603.dat",
};
const WINDOWS: Record<string, string> = {
  "1x2x2": "60592.dat",
  "1x2x3": "60593.dat",
  "1x4x3": "60594.dat",
};
const FENCES: Record<string, { ref: string; h: number; two: string }> = {
  picket: { ref: "33303.dat", h: 6, two: "87552.dat" },
  lattice: { ref: "3185.dat", h: 6, two: "87552.dat" },
  "lattice-low": { ref: "3633.dat", h: 3, two: "4865b.dat" },
  spindle: { ref: "30055.dat", h: 6, two: "87552.dat" },
  panel: { ref: "4215b.dat", h: 9, two: "87544.dat" },
};
const ROUND: Record<
  number,
  { brick: string; plate: string; cone: string; tile: string }
> = {
  1: {
    brick: "3062b.dat",
    plate: "6141.dat",
    cone: "4589.dat",
    tile: "98138.dat",
  },
  2: {
    brick: "3941.dat",
    plate: "4032b.dat",
    cone: "3942c.dat",
    tile: "14769.dat",
  },
  4: {
    brick: "87081.dat",
    plate: "60474.dat",
    cone: "3943b.dat",
    tile: "60474.dat",
  },
};
const SLOPES_75: Record<number, string> = {
  1: "4460b.dat",
  2: "3684a.dat",
};
const SLOPES: Record<number, string> = {
  1: "3040b.dat",
  2: "3039.dat",
  3: "3038.dat",
  4: "3037.dat",
};

type Unit = {
  name: string;
  grid: Grid;
  /** Cells holding a part: key → index into `holders`. */
  reserved: Map<number, number>;
  holders: { op: number; ref: string }[];
  /** Detail ops, run after the main pass. */
  details: { op: Op; frame: Frame; path: number; section: number }[];
  models: Model[];
  /** Emission order per model: op index of each type-1 line. */
  origins: Map<Model, number[]>;
};

class Compiler {
  problems: Problem[] = [];
  resolved: CompileReport["resolved"] = [];
  opPaths: string[] = [];
  opKinds: string[] = [];
  materials: Material[] = [];
  materialIds = new Map<string, number>();
  palette = new Map<string, string[]>();
  partAliases = new Map<string, string>();
  components = new Map<
    string,
    {
      name: string;
      unit: Unit;
      model: Model;
      box: { x: number; z: number; w: number; d: number };
    }
  >();
  compiling = new Set<string>();
  opsRun = 0;
  partCount = 0;
  seed: number;
  maxParts: number;
  unavailable = new Map<string, { count: number; ops: Set<number> }>();
  constructor(
    public script: BuildScript,
    public slug: string,
    limit: number,
  ) {
    this.seed = script.defaults?.seed ?? 1;
    // The resource profile's ceiling, counted as parts are made (component
    // parts once, not per instance). The part budget is checked on the
    // finished build instead, where every instance counts.
    this.maxParts = limit;
    for (const [k, v] of Object.entries(script.palette ?? {})) {
      const list =
        typeof v === "object" ? (v as { mix: Colour[] }).mix : [v as Colour];
      this.palette.set(
        k.toLowerCase(),
        list.map((c) => this.colourCode(c, `$.palette.${k}`)),
      );
    }
  }
  problem(p: Problem) {
    const key = p.code + "|" + p.message + "|" + (p.ops ?? []).join(",");
    if (this.seen.has(key)) return;
    this.seen.add(key);
    if (this.problems.length < 200) this.problems.push(p);
  }
  seen = new Set<string>();
  fail(path: string, message: string): never {
    throw new AppError("INVALID_INPUT", `${path}: ${message}`, {
      problems: [
        { severity: "error", code: "invalid-op", message, ops: [path] },
      ],
    });
  }
  /** LDraw code of a colour name/code (palette keys are resolved first). */
  colourCode(c: Colour, path: string): string {
    const code = resolveColourName(c);
    if (code === undefined) {
      const hints = colourSuggestions(String(c));
      this.fail(
        path,
        `unknown colour ${JSON.stringify(c)}` +
          (hints.length ? ` (did you mean ${hints.join(", ")}?)` : ""),
      );
    }
    return code;
  }
  colours(c: Colour, path: string): string[] {
    if (typeof c === "string") {
      const key = c.toLowerCase();
      const hit = this.override?.get(key) ?? this.palette.get(key);
      if (hit) return hit;
    }
    return [this.colourCode(c, path)];
  }
  /** Palette entries an `instance` overrides for the component it places
   * (merged with the overrides of the component being compiled). */
  override: Map<string, string[]> | undefined;
  /** One colour for a part (a mix picks deterministically per position). */
  colour(c: Colour, path: string, ...at: number[]) {
    const list = this.colours(c, path);
    return list.length === 1
      ? list[0]
      : list[Math.floor(hash01(this.seed, ...at) * list.length)];
  }
  material(
    c: Colour,
    path: string,
    mode: Material["mode"] = "auto",
    look: { texture?: string; pattern?: Material["pattern"] } = {},
  ) {
    const colours = this.colours(c, path);
    let texture = look.texture ? TEXTURES[look.texture] : undefined;
    if (texture && !textureMadeIn(texture, colours)) {
      this.problem({
        severity: "warning",
        code: "texture-unavailable",
        message: `${look.texture} bricks (${texture}) are not made in ${colours.map(colourName).join(", ")}; plain bricks used`,
        ops: [path.replace(/\.[a-z]+$/i, "")],
      });
      texture = undefined;
    }
    const pattern = colours.length > 1 ? look.pattern : undefined;
    const key =
      colours.join(",") + "|" + mode + "|" + (texture ?? "") + (pattern ?? "");
    let id = this.materialIds.get(key);
    if (id === undefined) {
      id = this.materials.length;
      this.materials.push({
        colours,
        mode,
        ...(texture ? { texture } : {}),
        ...(pattern ? { pattern } : {}),
      });
      this.materialIds.set(key, id);
    }
    return id;
  }
  /** The texture/pattern fields of a massing op. */
  look(o: Record<string, any>) {
    return { texture: o.texture, pattern: o.pattern };
  }
  /** Part number of a reference: a number, @alias or {find}. */
  part(ref: PartRef, path: string, colourHint?: Colour): string {
    if (typeof ref === "string") {
      if (ref.startsWith("@")) {
        const name = ref.slice(1);
        const target = this.script.parts?.[name];
        if (target === undefined) this.fail(path, `unknown part alias ${ref}`);
        let resolved = this.partAliases.get(name);
        if (!resolved) {
          resolved = this.part(target, `$.parts.${name}`, colourHint);
          this.partAliases.set(name, resolved);
        }
        return resolved;
      }
      const id = /\.dat$/i.test(ref)
        ? ref.toLowerCase()
        : ref.toLowerCase() + ".dat";
      if (partSpec(id)) return id;
      // A plain phrase ("window 1x2x3") is a search.
      if (/\s/.test(ref)) return this.part({ find: ref }, path, colourHint);
      this.fail(
        path,
        `unknown part ${JSON.stringify(ref)} (use {"find": "..."} to search)`,
      );
    }
    const colour =
      ref.colour ??
      (colourHint !== undefined && this.isSingle(colourHint)
        ? colourHint
        : undefined);
    const code =
      colour === undefined ? undefined : this.colours(colour, path)[0];
    const role = roleParts(ref.find).find((id) => partSpec(id));
    let id = role;
    if (!id) {
      const hits = searchParts({
        query: ref.find,
        category: ref.category,
        ...(code
          ? { colour: code, availableInColour: colorAvailabilityLoaded() }
          : {}),
        limit: 1,
      });
      id = hits[0]?.id;
      if (!id && code)
        id = searchParts({
          query: ref.find,
          category: ref.category,
          limit: 1,
        })[0]?.id;
    }
    if (!id || !partSpec(id))
      this.fail(path, `no part matches ${JSON.stringify(ref.find)}`);
    if (!this.resolved.some((r) => r.op === path && r.find === ref.find))
      this.resolved.push({
        op: path,
        find: ref.find,
        ref: id,
        name: partSpec(id)!.name,
      });
    return id;
  }
  isSingle(c: Colour) {
    return typeof c !== "string" || this.colours(c, "").length <= 1;
  }
  opIndex(path: string, kind: string) {
    this.opPaths.push(path);
    this.opKinds.push(kind);
    return this.opPaths.length - 1;
  }

  // -- cells ----------------------------------------------------------------
  fill(
    u: Unit,
    f: Frame,
    section: number,
    op: number,
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    mat: number,
    keep?: (lx: number, ly: number, lz: number) => boolean,
    tileTop = false,
  ) {
    for (let i = 0; i < w; i++)
      for (let k = 0; k < d; k++)
        for (let j = 0; j < h; j++) {
          if (keep && !keep(i, j, k)) continue;
          this.cell(
            u,
            f,
            section,
            op,
            x + i,
            y + j,
            z + k,
            mat,
            tileTop && j === h - 1,
          );
        }
  }
  cell(
    u: Unit,
    f: Frame,
    section: number,
    op: number,
    x: number,
    y: number,
    z: number,
    mat: number,
    tile = false,
  ) {
    // The cell's world position: its local corner transformed, minus the
    // flip of a turned/mirrored unit square.
    const r = rect(f, x, z, 1, 1);
    const wy = f.ty + y;
    if (u.grid.cells.size > 4_000_000)
      throw new AppError("LIMIT_EXCEEDED", "Massing exceeds 4,000,000 cells", {
        problems: [
          {
            severity: "error",
            code: "limit",
            message: "Too many massing cells",
            ops: [this.opPaths[op]],
          },
        ],
      });
    u.grid.set(r.x, wy, r.z, { mat, section, op, tile });
  }
  carve(
    u: Unit,
    f: Frame,
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
  ) {
    const r = rect(f, x, z, w, d);
    for (let i = 0; i < r.w; i++)
      for (let k = 0; k < r.d; k++)
        for (let j = 0; j < h; j++)
          u.grid.delete(r.x + i, f.ty + y + j, r.z + k);
  }

  /**
   * Quoins: the corner columns of a room or box recoloured course by course,
   * the corner block reaching one stud further along the X faces on even
   * brick courses and along the Z faces on odd ones, so the blocks
   * interlock and the wall's joints beside them stagger. Only cells the op
   * itself filled change (openings carved later still cut them).
   */
  quoins(
    u: Unit,
    f: Frame,
    section: number,
    op: number,
    path: string,
    colour: Colour,
    [x, y, z]: [number, number, number],
    { w, h, d, t }: { w: number; h: number; d: number; t: number },
  ) {
    const mat = this.material(colour, path + ".quoins");
    for (let j = 0; j < h; j++) {
      const even = Math.floor(j / 3) % 2 === 0;
      for (let i = 0; i < w; i++)
        for (let k = 0; k < d; k++) {
          const ex = Math.min(i, w - 1 - i),
            ez = Math.min(k, d - 1 - k);
          const block = even ? ez < t && ex <= t : ex < t && ez <= t;
          if (!block) continue;
          const r = rect(f, x + i, z + k, 1, 1);
          if (u.grid.get(r.x, f.ty + y + j, r.z)?.op !== op) continue;
          this.cell(u, f, section, op, x + i, y + j, z + k, mat);
        }
    }
  }
  /** Whether core cell (i, k) of a hollow box holds a 2 × 2 support pier
   * (`supports: n`: piers every n studs across the hollow, clear of the far
   * walls). */
  pier(
    o: Record<string, any>,
    i: number,
    k: number,
    w: number,
    d: number,
    t: number,
  ) {
    const n = o.supports as number | undefined;
    if (!n) return false;
    const a = i - t,
      b = k - t;
    return (
      a % n >= n - 2 && b % n >= n - 2 && a < w - 2 * t - 2 && b < d - 2 * t - 2
    );
  }

  // -- parts ----------------------------------------------------------------
  countPart(path: string) {
    if (++this.partCount > this.maxParts)
      throw new AppError(
        "LIMIT_EXCEEDED",
        `Build exceeds ${this.maxParts} parts`,
        {
          problems: [
            {
              severity: "error",
              code: "limit",
              message: `More than ${this.maxParts} parts`,
              ops: [path],
            },
          ],
        },
      );
  }
  /** Height of a part body in plates (for reserving its cells). */
  partPlates(ref: string) {
    const spec = partSpec(ref);
    if (!spec) return 1;
    const b = localBounds(ref);
    const top = spec.studded ? b.min[1] + 4 : b.min[1];
    return Math.max(1, Math.round((underside(ref) - top) / 8));
  }
  /**
   * Places a part whose footprint corner is local cell (x, z) and whose
   * underside rests on local level y, turned `turn` in the local frame.
   */
  put(
    u: Unit,
    model: Model,
    f: Frame,
    op: number,
    ref: string,
    colour: string,
    x: number,
    y: number,
    z: number,
    turn: number,
    options: {
      reserve?: boolean;
      companion?: string;
      companionColour?: string;
    } = {},
  ) {
    const path = this.opPaths[op];
    this.countPart(path);
    let world = mul(f.m, turnMat(turn));
    if (det(world) < 0) {
      const swap = counterpart(ref);
      if (swap) ref = swap;
      world = mul(world, DIAGONAL.has(ref) ? [0, -1, -1, 0] : [-1, 0, 0, 1]);
    }
    const wt = turnOf(world);
    const local = footprint(ref, (((turn % 360) + 360) % 360) as Turn);
    const r = rect(f, x, z, local.width / 20, local.depth / 20);
    const wy = f.ty + y;
    model.put(ref, colour, r.x, r.z, wy, wt);
    this.origin(u, model, op);
    this.checkColour(ref, colour, op);
    if (options.companion) {
      const line = model.lines[model.lines.length - 1].split(" ");
      model.lines.push(
        [
          "1",
          options.companionColour ?? "47",
          ...line.slice(2, 14),
          options.companion,
        ].join(" "),
      );
      this.origin(u, model, op);
      this.countPart(path);
    }
    if (options.reserve !== false) {
      const h = this.partPlates(ref);
      const holder = u.holders.length;
      u.holders.push({ op, ref });
      const clashes = new Set<number>();
      for (let i = 0; i < r.w; i++)
        for (let k = 0; k < r.d; k++)
          for (let j = 0; j < h; j++) {
            const key = cellKey(r.x + i, wy + j, r.z + k);
            const prior = u.reserved.get(key);
            if (prior !== undefined && u.holders[prior].op !== op)
              clashes.add(prior);
            u.reserved.set(key, holder);
          }
      for (const prior of clashes)
        this.problem({
          severity: "warning",
          code: "part-clash",
          message: `${ref} is placed where ${u.holders[prior].ref} already is`,
          ops: [this.opPaths[u.holders[prior].op], path],
        });
    }
    return model.lines.length - (options.companion ? 2 : 1);
  }
  origin(u: Unit, model: Model, op: number) {
    let list = u.origins.get(model);
    if (!list) u.origins.set(model, (list = []));
    list.push(op);
  }
  checkColour(ref: string, colour: string, op: number) {
    const e = colorExistence(ref, colour);
    if (e === "not-produced" || e === "not-recorded") {
      const k = `${ref}|${colour}`;
      let hit = this.unavailable.get(k);
      if (!hit) this.unavailable.set(k, (hit = { count: 0, ops: new Set() }));
      hit.count++;
      hit.ops.add(op);
    }
  }

  // -- ops ------------------------------------------------------------------
  run(u: Unit, ops: Op[], f: Frame, section: number, path: string) {
    ops.forEach((op, i) => this.runOp(u, op, f, section, `${path}[${i}]`));
  }
  runOp(u: Unit, op: Op, f: Frame, section: number, path: string) {
    const o = op as Record<string, any>;
    if (typeof o.when === "string") {
      const negate = o.when.startsWith("!");
      if (this.flags.has(o.when.slice(negate ? 1 : 0)) === negate) return;
    }
    const id = this.opIndex(path, op.op);
    if (++this.opsRun > 200_000)
      throw new AppError(
        "LIMIT_EXCEEDED",
        "More than 200,000 ops after repeats",
        {
          problems: [
            {
              severity: "error",
              code: "limit",
              message: "Too many ops",
              ops: [path],
            },
          ],
        },
      );
    const model = u.models[section];
    const y3 = (v: [number, Height, number]) =>
      [v[0], plates(v[1]), v[2]] as [number, number, number];
    switch (op.op) {
      case "box":
      case "cylinder": {
        const [x, y, z] = y3(o.at);
        const [w, h, d] =
          op.op === "box"
            ? (y3(o.size) as number[])
            : [o.diameter, plates(o.height), o.diameter];
        const interior =
          o.interior ?? this.script.defaults?.interior ?? "empty";
        const t = o.thickness ?? 1;
        const open = new Set<string>(o.open ?? []);
        const mat = this.material(
          o.colour,
          path + ".colour",
          o.pieces === "plates" ? "plate" : "auto",
          this.look(o),
        );
        const inner =
          interior === "fill"
            ? this.material(
                this.script.defaults?.interiorColour ?? "light bluish grey",
                "$.defaults.interiorColour",
              )
            : mat;
        const round = op.op === "cylinder";
        const r = w / 2;
        const inside = (i: number, k: number, inset: number) => {
          if (round) {
            const dx = i + 0.5 - r,
              dz = k + 0.5 - r;
            return Math.hypot(dx, dz) <= r - inset + 0.01;
          }
          return i >= inset && k >= inset && i < w - inset && k < d - inset;
        };
        const cap = open.has("top") ? 0 : 2;
        const hollow = interior === "empty" && h > cap + 1;
        if (o.supports !== undefined && o.supports < 4)
          this.fail(path + ".supports", "supports must be at least 4 studs");
        const tileTop = o.top === "tile";
        const capMat = this.material(o.colour, path + ".colour", "plate");
        for (let i = 0; i < w; i++)
          for (let k = 0; k < d; k++) {
            if (!inside(i, k, 0)) continue;
            const core = inside(i, k, t);
            // A perimeter column is left out only when every face it
            // belongs to is open (corners keep supporting the other face).
            const faces = round
              ? []
              : [
                  i < t && "left",
                  i >= w - t && "right",
                  k < t && "front",
                  k >= d - t && "back",
                ].filter(Boolean);
            const skip =
              !core &&
              faces.length > 0 &&
              faces.every((face) => open.has(face as string));
            const pier =
              hollow && core && !round && this.pier(o, i, k, w, d, t);
            for (let j = 0; j < h; j++) {
              const top = j >= h - cap;
              if (core && !top) {
                if (hollow) {
                  // Support piers carry a wide shell's lid.
                  if (pier)
                    this.cell(u, f, section, id, x + i, y + j, z + k, mat);
                  continue;
                }
                this.cell(u, f, section, id, x + i, y + j, z + k, inner);
              } else if (!skip)
                // A hollow shell's roof is plates spanning walls and core,
                // so it rests on the walls and holds together.
                this.cell(
                  u,
                  f,
                  section,
                  id,
                  x + i,
                  y + j,
                  z + k,
                  (hollow || inner !== mat) && top ? capMat : mat,
                  tileTop && j === h - 1,
                );
            }
          }
        if (!round && o.quoins !== undefined)
          this.quoins(u, f, section, id, path, o.quoins, [x, y, z], {
            w,
            h: hollow || inner !== mat ? h - cap : h,
            d,
            t,
          });
        return;
      }
      case "wall": {
        const [fx, fz] = o.from as number[],
          [tx, tz] = o.to as number[];
        if (fx !== tx && fz !== tz)
          this.fail(
            path,
            "from and to must share x or z (walls run along X or Z)",
          );
        const alongX =
          fz === tz && fx !== tx ? true : fx === tx && fz !== tz ? false : true;
        const x0 = Math.min(fx, tx),
          z0 = Math.min(fz, tz);
        const len = alongX ? Math.abs(tx - fx) + 1 : Math.abs(tz - fz) + 1;
        const t = o.thickness ?? 1;
        const y = plates(o.y ?? 0),
          h = plates(o.height);
        const mat = this.material(
          o.colour,
          path + ".colour",
          "auto",
          this.look(o),
        );
        const [w, d] = alongX ? [len, t] : [t, len];
        this.fill(
          u,
          f,
          section,
          id,
          x0,
          y,
          z0,
          w,
          h,
          d,
          mat,
          undefined,
          o.top === "tile",
        );
        const facing: Facing = o.facing ?? (alongX ? "front" : "left");
        const outer = facing === "front" || facing === "left" ? 0 : t - 1;
        (o.openings ?? []).forEach((op2: Opening, n: number) =>
          this.opening(u, model, f, id, `${path}.openings[${n}]`, op2, {
            alongX,
            x0,
            z0,
            y,
            h,
            t,
            outer,
            facing,
            len,
          }),
        );
        return;
      }
      case "room": {
        const [x, y, z] = y3(o.at);
        const [w, h, d] = y3(o.size);
        if (w < 3 || d < 3) this.fail(path, "rooms need at least 3 × 3 studs");
        const mat = this.material(
          o.colour,
          path + ".colour",
          "auto",
          this.look(o),
        );
        this.fill(
          u,
          f,
          section,
          id,
          x,
          y,
          z,
          w,
          h,
          d,
          mat,
          (i, _j, k) => i === 0 || k === 0 || i === w - 1 || k === d - 1,
          o.top === "tile",
        );
        if (o.floor !== undefined)
          this.fill(
            u,
            f,
            section,
            id,
            x + 1,
            y,
            z + 1,
            w - 2,
            1,
            d - 2,
            this.material(o.floor, path + ".floor", "plate"),
          );
        if (o.quoins !== undefined)
          this.quoins(u, f, section, id, path, o.quoins, [x, y, z], {
            w,
            h,
            d,
            t: 1,
          });
        (o.openings ?? []).forEach((op: Opening, n: number) => {
          const side: Facing = op.side ?? "front";
          const alongX = side === "front" || side === "back";
          // A door opening inwards stands on the room's floor, so its leaf
          // swings over the floor plate instead of into it (Play opens it).
          const door =
            op.fill === "door" ||
            ((op.fill ?? "auto") === "auto" &&
              op.width === 4 &&
              op.height !== undefined &&
              plates(op.height) === 18);
          const op2 =
            door &&
            o.floor !== undefined &&
            op.y === undefined &&
            (op.opens ?? "in") === "in"
              ? { ...op, y: 1 }
              : op;
          this.opening(u, model, f, id, `${path}.openings[${n}]`, op2, {
            alongX,
            x0: side === "right" ? x + w - 1 : x,
            z0: side === "back" ? z + d - 1 : z,
            y,
            h,
            t: 1,
            outer: 0,
            facing: side,
            len: alongX ? w : d,
          });
        });
        return;
      }
      case "floor": {
        const [x, y, z] = y3(o.at);
        const [w, d] = o.size as number[];
        const layers = o.layers ?? 1;
        const holes: { at: number[]; size: number[] }[] = o.holes ?? [];
        const mat = this.material(o.colour, path + ".colour", "plate");
        this.fill(
          u,
          f,
          section,
          id,
          x,
          y,
          z,
          w,
          layers,
          d,
          mat,
          (i, _j, k) =>
            !holes.some(
              (hole) =>
                x + i >= hole.at[0] &&
                x + i < hole.at[0] + hole.size[0] &&
                z + k >= hole.at[1] &&
                z + k < hole.at[1] + hole.size[1],
            ),
          o.top === "tile",
        );
        return;
      }
      case "carve": {
        const [x, y, z] = y3(o.at);
        const [w, h, d] = y3(o.size);
        this.carve(u, f, x, y, z, w, h, d);
        return;
      }
      case "line": {
        const a = y3(o.from),
          b = y3(o.to);
        const mat = this.material(o.colour, path + ".colour");
        const n = Math.max(...[0, 1, 2].map((i) => Math.abs(b[i] - a[i])));
        for (let s = 0; s <= n; s++) {
          const p = [0, 1, 2].map((i) =>
            Math.round(a[i] + ((b[i] - a[i]) * s) / (n || 1)),
          );
          this.cell(u, f, section, id, p[0], p[1], p[2], mat);
        }
        return;
      }
      case "dome": {
        const [x, y, z] = y3(o.at);
        const dia = o.diameter as number;
        const R = dia * 10; // LDU
        const mat = this.material(o.colour, path + ".colour", "plate");
        const hollow = (o.interior ?? "empty") === "empty";
        const levels = Math.ceil(R / 8);
        const inSphere = (i: number, j: number, k: number, radius: number) => {
          const dx = (i + 0.5) * 20 - R,
            dz = (k + 0.5) * 20 - R,
            dy = j * 8 + 4;
          return dx * dx + dz * dz + dy * dy <= radius * radius;
        };
        for (let j = 0; j < levels; j++)
          for (let i = 0; i < dia; i++)
            for (let k = 0; k < dia; k++) {
              if (!inSphere(i, j, k, R)) continue;
              if (
                hollow &&
                inSphere(i, j, k, R - 20) &&
                inSphere(i, j + 1, k, R - 8)
              )
                continue;
              this.cell(u, f, section, id, x + i, y + j, z + k, mat);
            }
        return;
      }
      case "stairs": {
        const [x, y, z] = y3(o.at);
        const rise = plates(o.rise ?? 1),
          run = o.run ?? 1;
        const mat = this.material(o.colour, path + ".colour");
        for (let s = 0; s < o.steps; s++) {
          const along = s * run;
          const h = (s + 1) * rise;
          const dir = o.dir as string;
          const sx =
            dir === "+x" ? x + along : dir === "-x" ? x - along - run + 1 : x;
          const sz =
            dir === "+z" ? z + along : dir === "-z" ? z - along - run + 1 : z;
          const [w, d] = dir.endsWith("x") ? [run, o.width] : [o.width, run];
          this.fill(
            u,
            f,
            section,
            id,
            sx,
            y,
            sz,
            w,
            h,
            d,
            mat,
            undefined,
            o.top === "tile",
          );
        }
        return;
      }
      case "roof":
        return this.roof(u, model, f, section, id, path, o);
      case "window": {
        const [x, y, z] = y3(o.at);
        const frame = WINDOWS[o.size ?? "1x2x3"];
        this.put(
          u,
          model,
          f,
          id,
          frame,
          this.colour(o.frame, path + ".frame", x, y, z),
          x,
          y,
          z,
          FACING_TURN[o.facing as Facing],
          {
            companion: GLASS[frame],
            companionColour: this.colour(
              o.glass ?? "trans-clear",
              path + ".glass",
            ),
          },
        );
        return;
      }
      case "door": {
        const [x, y, z] = y3(o.at);
        this.door(
          u,
          model,
          f,
          id,
          path,
          x,
          y,
          z,
          o.facing,
          o.frame,
          o.colour ?? o.frame,
          o.opens ?? "in",
          o.style,
        );
        return;
      }
      case "place": {
        const [x, y, z] = y3(o.at);
        const ref = this.part(o.part, path + ".part", o.colour);
        const colour = this.colour(o.colour, path + ".colour", x, y, z);
        if (o.anchor === "origin") {
          // The part's own origin on a grid point at a plate level: parts
          // made to fit together share an origin (a boat hull and its deck).
          const [wx, wz] = point(f, x, z);
          const wt = turnOf(mul(f.m, turnMat(o.turn ?? 0)));
          this.countPart(path);
          model.raw(
            ref,
            colour,
            [wx * 20, -8 * (f.ty + y), wz * 20],
            basis(wt),
          );
          this.origin(u, model, id);
          this.checkColour(ref, colour, id);
          // Its cells: the placed bounds, rounded out to whole cells.
          const b = transformBounds(localBounds(ref) as Bounds, {
            position: [wx * 20, -8 * (f.ty + y), wz * 20],
            basis: basis(wt),
          });
          const holder = u.holders.length;
          u.holders.push({ op: id, ref });
          for (
            let cx = Math.floor(b.min[0] / 20);
            cx < Math.ceil(b.max[0] / 20);
            cx++
          )
            for (
              let cz = Math.floor(b.min[2] / 20);
              cz < Math.ceil(b.max[2] / 20);
              cz++
            )
              for (
                let cy = Math.floor(-b.max[1] / 8);
                cy < Math.ceil(-b.min[1] / 8);
                cy++
              )
                u.reserved.set(cellKey(cx, cy, cz), holder);
          return;
        }
        const line = this.put(
          u,
          model,
          f,
          id,
          ref,
          colour,
          x,
          y,
          z,
          o.turn ?? 0,
          GLASS[ref] ? { companion: GLASS[ref] } : {},
        );
        if (o.wheels !== undefined) {
          if (ref !== "4600.dat")
            this.fail(
              path + ".wheels",
              "wheels go on Plate 2 × 2 with Wheel Holders (4600)",
            );
          // Wheel Rims 6.4 × 8 (4624) with Tyres 6/50 × 8 (3641) on the two
          // pins, 30 LDU either side and 5 below the plate's origin, as on
          // the roadster; they clear the ground by 1 LDU when the plate's
          // underside is 2 plates up.
          const p = model.lines[line].split(" ");
          const pos = p.slice(2, 5).map(Number);
          const B = p.slice(5, 14).map(Number);
          const rim = this.colour(o.wheels, path + ".wheels");
          for (const side of [-1, 1]) {
            const W = basis(side < 0 ? 270 : 90);
            const m = [0, 1, 2].flatMap((r) =>
              [0, 1, 2].map((c) =>
                [0, 1, 2].reduce((s, k) => s + B[r * 3 + k] * W[k * 3 + c], 0),
              ),
            ) as unknown as Basis;
            const at: V3 = [0, 1, 2].map(
              (r) => pos[r] + B[r * 3] * 30 * side + B[r * 3 + 1] * 5,
            ) as V3;
            for (const [part, c] of [
              ["4624.dat", rim],
              ["3641.dat", "0"],
            ]) {
              this.countPart(path);
              model.raw(part, c, at, m);
              this.origin(u, model, id);
              this.checkColour(part, c, id);
            }
          }
        }
        return;
      }
      case "column": {
        const [x, y, z] = y3(o.at);
        const dia = o.diameter ?? 1;
        const set = ROUND[dia];
        const h = plates(o.height);
        const colour = this.colour(o.colour, path + ".colour", x, y, z);
        let level = y;
        for (let b = 0; b < Math.floor(h / 3); b++, level += 3)
          this.put(u, model, f, id, set.brick, colour, x, level, z, 0);
        for (let p = 0; p < h % 3; p++, level++)
          this.put(u, model, f, id, set.plate, colour, x, level, z, 0);
        const cap = o.cap ?? "none";
        if (cap !== "none")
          this.put(
            u,
            model,
            f,
            id,
            set[cap as "cone" | "plate" | "tile"],
            this.colour(o.capColour ?? o.colour, path + ".capColour"),
            x,
            level,
            z,
            0,
          );
        return;
      }
      case "fence":
        return this.fence(u, model, f, id, path, o);
      case "baseplate": {
        const [x0, z0] = o.at as number[],
          [w, d] = o.size as number[];
        if (w % 16 || d % 16)
          this.fail(path, "baseplate size must be multiples of 16 studs");
        const colour = this.colour(o.colour, path + ".colour");
        const covered = new Set<string>();
        for (let z = z0; z < z0 + d; z += 16)
          for (let x = x0; x < x0 + w; x += 16) {
            if (covered.has(x + "," + z)) continue;
            // Largest square/rectangle baseplate that fits here.
            const fits = (s: number, t: number) =>
              x + s <= x0 + w &&
              z + t <= z0 + d &&
              [...Array(s / 16)].every((_, i) =>
                [...Array(t / 16)].every(
                  (__, k) => !covered.has(x + 16 * i + "," + (z + 16 * k)),
                ),
              );
            const [s, t, ref, turn] = fits(48, 48)
              ? [48, 48, "4186.dat", 0]
              : fits(32, 32)
                ? [32, 32, "3811.dat", 0]
                : fits(32, 16)
                  ? [32, 16, "3857.dat", 0]
                  : fits(16, 32)
                    ? [16, 32, "3857.dat", 90]
                    : [16, 16, "3867.dat", 0];
            for (let i = 0; i < s; i += 16)
              for (let k = 0; k < t; k += 16)
                covered.add(x + i + "," + (z + k));
            const r = rect(f, x, z, s, t);
            const wt = turnOf(mul(f.m, turnMat(turn as number)));
            this.countPart(path);
            model.raw(
              ref as string,
              colour,
              [(r.x + r.w / 2) * 20, -8 * f.ty, (r.z + r.d / 2) * 20],
              basis(wt),
            );
            this.origin(u, model, id);
          }
        return;
      }
      case "repeat":
        for (let n = 0; n < o.count; n++) {
          const s = y3(o.step);
          this.run(
            u,
            o.ops,
            child(f, [s[0] * n, s[1] * n, s[2] * n]),
            section,
            path + ".ops",
          );
        }
        return;
      case "mirror":
        if (o.keep !== false) this.run(u, o.ops, f, section, path + ".ops");
        this.run(
          u,
          o.ops,
          mirrored(f, o.axis, o.about),
          section,
          path + ".ops",
        );
        return;
      case "group":
        this.run(
          u,
          o.ops,
          child(f, o.at ? y3(o.at) : [0, 0, 0], o.turn ?? 0),
          section,
          path + ".ops",
        );
        return;
      case "instance":
        return this.instance(u, model, f, id, path, o);
      case "track":
        return this.track(u, model, f, id, path, o);
      case "railcar":
        return this.railcar(u, model, f, id, path, o);
      case "scatter":
      case "smooth":
        u.details.push({ op, frame: f, path: id, section });
        return;
      default:
        this.fail(path, "unknown op " + op.op);
    }
  }

  opening(
    u: Unit,
    model: Model,
    f: Frame,
    id: number,
    path: string,
    o: Opening,
    w: {
      alongX: boolean;
      x0: number;
      z0: number;
      y: number;
      h: number;
      t: number;
      outer: number;
      facing: Facing;
      len: number;
    },
  ) {
    if (o.at < 0 || o.at + o.width > w.len)
      this.fail(
        path,
        `opening runs past the wall (wall is ${w.len} studs long)`,
      );
    const oy = plates(o.y ?? 0);
    const oh = o.height === undefined ? w.h - oy : plates(o.height);
    if (oy + oh > w.h)
      this.problem({
        severity: "warning",
        code: "opening-height",
        message: `The opening's top (${oy + oh} plates) is above the wall top (${w.h} plates): what fills it will poke out`,
        ops: [path],
      });
    const x = w.alongX ? w.x0 + o.at : w.x0,
      z = w.alongX ? w.z0 : w.z0 + o.at;
    const [cw, cd] = w.alongX ? [o.width, w.t] : [w.t, o.width];
    this.carve(u, f, x, w.y + oy, z, cw, oh, cd);
    let fill = o.fill ?? "auto";
    const window =
      o.width === 2 && oh === 6
        ? "1x2x2"
        : o.width === 2 && oh === 9
          ? "1x2x3"
          : o.width === 4 && oh === 9
            ? "1x4x3"
            : undefined;
    const doorFits = o.width === 4 && oh === 18;
    if (fill === "auto") fill = doorFits ? "door" : window ? "window" : "none";
    const px = w.alongX ? x : x + w.outer,
      pz = w.alongX ? z + w.outer : z;
    if (fill === "window") {
      if (!window)
        return this.problem({
          severity: "warning",
          code: "opening-size",
          message: `No window frame is ${o.width} wide × ${oh} plates high (windows: 2×6, 2×9, 4×9); left open`,
          ops: [path],
        });
      const frame = WINDOWS[window];
      this.put(
        u,
        model,
        f,
        id,
        frame,
        this.colour(o.frame ?? "white", path + ".frame"),
        px,
        w.y + oy,
        pz,
        FACING_TURN[w.facing],
        {
          companion: GLASS[frame],
          companionColour: this.colour(
            o.glass ?? "trans-clear",
            path + ".glass",
          ),
        },
      );
    } else if (fill === "door") {
      if (!doorFits)
        return this.problem({
          severity: "warning",
          code: "opening-size",
          message: `A door needs an opening 4 wide × 18 plates high (got ${o.width} × ${oh}); left open`,
          ops: [path],
        });
      this.door(
        u,
        model,
        f,
        id,
        path,
        px,
        w.y + oy,
        pz,
        w.facing,
        o.frame ?? "white",
        o.door ?? o.frame ?? "white",
        o.opens ?? "in",
      );
    }
  }

  door(
    u: Unit,
    model: Model,
    f: Frame,
    id: number,
    path: string,
    x: number,
    y: number,
    z: number,
    facing: Facing,
    frame: Colour,
    leaf: Colour,
    opens: string,
    style?: string,
  ) {
    // The leaf hangs on the frame's local +Z face: out → +Z faces outside.
    const turn = (FACING_TURN[facing] + (opens === "out" ? 180 : 0)) % 360;
    this.put(
      u,
      model,
      f,
      id,
      "60596.dat",
      this.colour(frame, path + ".frame"),
      x,
      y,
      z,
      turn,
    );
    const line = model.lines[model.lines.length - 1].split(" ").map(Number);
    const b = line.slice(5, 14) as Basis;
    const off = [-32, 0, 5];
    const pos: V3 = [
      line[2] + b[0] * off[0] + b[1] * off[1] + b[2] * off[2],
      line[3] + b[3] * off[0] + b[4] * off[1] + b[5] * off[2],
      line[4] + b[6] * off[0] + b[7] * off[1] + b[8] * off[2],
    ];
    this.countPart(path);
    const leafColour = this.colour(leaf, path + ".colour");
    // Without a style, the leaf that is made in the colour: the smooth door
    // (60616a) is not made in red, dark blue or dark green, the door with
    // panes (60623) is.
    const leafRef =
      style === "panes"
        ? "60623.dat"
        : style === "smooth" ||
            !colorAvailabilityLoaded() ||
            madeIn("60616a.dat", leafColour) ||
            !madeIn("60623.dat", leafColour)
          ? "60616a.dat"
          : "60623.dat";
    model.raw(leafRef, leafColour, pos, b);
    this.checkColour(leafRef, leafColour, id);
    this.origin(u, model, id);
  }

  fence(
    u: Unit,
    model: Model,
    f: Frame,
    id: number,
    path: string,
    o: Record<string, any>,
  ) {
    const style = FENCES[o.style ?? "lattice-low"];
    const y = plates(o.y ?? 0);
    const colour = this.colour(o.colour, path + ".colour");
    const pts = o.path as [number, number][];
    const cells: [number, number][] = [];
    for (let i = 1; i < pts.length; i++) {
      const [ax, az] = pts[i - 1],
        [bx, bz] = pts[i];
      if (ax !== bx && az !== bz)
        this.fail(`${path}.path[${i}]`, "fence segments must run along X or Z");
      const n = Math.max(Math.abs(bx - ax), Math.abs(bz - az));
      for (let s = i === 1 ? 0 : 1; s <= n; s++)
        cells.push([ax + Math.sign(bx - ax) * s, az + Math.sign(bz - az) * s]);
    }
    // Split into straight runs (a corner cell starts the next run).
    const runs: [number, number][][] = [];
    for (const c of cells) {
      const run = runs[runs.length - 1];
      if (
        run &&
        run.length &&
        (run.length < 2 ||
          (run[0][0] === run[1][0]) === (run[0][0] === c[0])) &&
        (run[run.length - 1][0] === c[0] || run[run.length - 1][1] === c[1]) &&
        Math.abs(run[run.length - 1][0] - c[0]) +
          Math.abs(run[run.length - 1][1] - c[1]) ===
          1 &&
        (run.length < 2 ||
          (run[1][0] - run[0][0] === c[0] - run[run.length - 1][0] &&
            run[1][1] - run[0][1] === c[1] - run[run.length - 1][1]))
      )
        run.push(c);
      else runs.push([c]);
    }
    for (const run of runs) {
      const alongX = run.length < 2 || run[0][1] === run[1][1];
      const xs = run.map((c) => c[0]),
        zs = run.map((c) => c[1]);
      let at = alongX ? Math.min(...xs) : Math.min(...zs);
      const end = at + run.length;
      const fixed = alongX ? zs[0] : xs[0];
      while (at < end) {
        const left = end - at;
        const len = left >= 4 ? 4 : left >= 2 ? 2 : 1;
        const [cx, cz] = alongX ? [at, fixed] : [fixed, at];
        if (len === 4)
          this.put(
            u,
            model,
            f,
            id,
            style.ref,
            colour,
            cx,
            y,
            cz,
            alongX ? 0 : 90,
          );
        else if (len === 2)
          this.put(
            u,
            model,
            f,
            id,
            style.two,
            colour,
            cx,
            y,
            cz,
            alongX ? 0 : 90,
          );
        else
          for (let b = 0; b < style.h / 3; b++)
            this.put(u, model, f, id, "3005.dat", colour, cx, y + 3 * b, cz, 0);
        at += len;
      }
    }
  }

  roof(
    u: Unit,
    model: Model,
    f: Frame,
    section: number,
    id: number,
    path: string,
    o: Record<string, any>,
  ) {
    const [x, y, z] = [o.at[0], plates(o.at[1]), o.at[2]] as number[];
    const [w, d] = o.size as number[];
    const oh = o.overhang ?? this.script.defaults?.overhang ?? 1;
    // Overhang past the ends of the ridge (gable ends, hip ends; for flat
    // roofs the sides the ridge would run into): 0 keeps a terrace of houses
    // clear of its neighbours.
    const ends = o.ends ?? oh;
    const ridgeX = (o.ridge ?? (w >= d ? "x" : "z")) === "x";
    const colour = this.colour(o.colour, path + ".colour");
    if (o.style === "flat") {
      const mat = this.material(o.colour, path + ".colour", "plate");
      const ox = ridgeX ? ends : oh,
        oz = ridgeX ? oh : ends;
      const W = w + 2 * ox,
        D = d + 2 * oz;
      this.fill(
        u,
        f,
        section,
        id,
        x - ox,
        y,
        z - oz,
        W,
        1,
        D,
        mat,
        undefined,
        !o.parapet,
      );
      if (o.parapet) {
        const ph = plates(o.parapet);
        const pm = this.material(o.gable ?? o.colour, path + ".gable");
        this.fill(
          u,
          f,
          section,
          id,
          x - ox,
          y + 1,
          z - oz,
          W,
          ph,
          D,
          pm,
          (i, _j, k) => i === 0 || k === 0 || i === W - 1 || k === D - 1,
          true,
        );
      }
      return;
    }
    // Work in a frame where the ridge runs along local X (a shed roof: its
    // low edge along local X at z = 0, rising towards +z).
    const shed = o.style === "shed";
    const facing: Facing = o.facing ?? "front";
    const lf = shed
      ? facing === "front"
        ? child(f, [x, y, z])
        : facing === "back"
          ? child(f, [x + w, y, z + d], 180)
          : facing === "left"
            ? child(f, [x, y, z + d], 90)
            : child(f, [x + w, y, z], 270)
      : ridgeX
        ? child(f, [x, y, z])
        : child(f, [x, y, z + d], 90);
    const across = shed ? facing === "front" || facing === "back" : ridgeX;
    const L = across ? w : d,
      D = shed ? (across ? d : w) + oh : (ridgeX ? d : w) + 2 * oh;
    if (!shed && D % 2)
      this.fail(
        path,
        `the roof's depth across the ridge (${D - 2 * oh} studs + overhang) must be even`,
      );
    const n = D / 2 - 1;
    const gable = this.material(o.gable ?? o.colour, path + ".gable");
    // Holes (chimneys, skylights) are left out of the slopes and ridge.
    const holes = ((o.holes ?? []) as { at: number[]; size: number[] }[]).map(
      (h) => rect(f, h.at[0], h.at[1], h.size[0], h.size[1]),
    );
    const blocked = (lx: number, lz: number, w: number, d: number) => {
      const r = rect(lf, lx, lz, w, d);
      return holes.some(
        (h) =>
          r.x < h.x + h.w &&
          h.x < r.x + r.w &&
          r.z < h.z + h.d &&
          h.z < r.z + r.d,
      );
    };
    const put = (
      ref: string,
      px: number,
      py: number,
      pz: number,
      turn: number,
    ) => {
      const fp = footprint(ref, turn as Turn);
      if (!blocked(px, pz, fp.width / 20, fp.depth / 20))
        this.put(u, model, lf, id, ref, colour, px, py, pz, turn);
    };
    // Slope lengths that are made in the roof's colour (1 × 2 always).
    // Pitch 75: steep spires of 75° slopes, a stud in per three bricks.
    const steep = o.pitch === 75;
    if (steep && o.style !== "hip")
      this.fail(path + ".pitch", "pitch 75 is for hip roofs (spires)");
    const table = steep ? SLOPES_75 : SLOPES;
    const lengths = (steep ? [2, 1] : [4, 3, 2, 1]).filter(
      (l) => l === 1 || !colorAvailabilityLoaded() || madeIn(table[l], colour),
    );
    const run = (
      from: number,
      to: number,
      lz: number,
      level: number,
      turn: number,
      offset: boolean,
    ) => {
      // Slope pieces from local x = from to to − 1 around any holes,
      // staggered course to course.
      let x = from;
      let firstSegment = true;
      while (x < to) {
        while (x < to && blocked(x, lz, 1, 2)) x++;
        let end = x;
        while (end < to && !blocked(end, lz, 1, 2)) end++;
        let at = x;
        const first = firstSegment && offset && end - x > 4 ? 2 : 0;
        firstSegment = false;
        if (first) {
          put(table[first], at, level, lz, turn);
          at += first;
        }
        while (at < end) {
          const len = lengths.find((l) => l <= end - at)!;
          put(table[len], at, level, lz, turn);
          at += len;
        }
        x = end;
      }
    };
    if (shed) {
      // One slope rising a stud per brick from the low edge to the high
      // side, walls under its two ends.
      for (let k = 0; k + 2 <= D; k++) {
        const level = 3 * k;
        run(-ends, L + ends, -oh + k, level, 0, k % 2 === 1);
        const g0 = Math.max(0, -oh + k + 2),
          g1 = D - oh - 1;
        if (g1 >= g0)
          for (const gx of [0, L - 1])
            this.fill(
              u,
              lf,
              section,
              id,
              gx,
              level,
              g0,
              1,
              3,
              g1 - g0 + 1,
              gable,
            );
      }
      return;
    }
    if (o.style === "gable") {
      for (let k = 0; k < n; k++) {
        const level = 3 * k;
        run(-ends, L + ends, -oh + k, level, 0, k % 2 === 1);
        run(-ends, L + ends, D - oh - 2 - k, level, 180, k % 2 === 1);
        // Gable ends inside the slopes.
        const g0 = -oh + k + 2,
          g1 = D - oh - 3 - k;
        if (g1 >= g0)
          for (const gx of [0, L - 1])
            this.fill(
              u,
              lf,
              section,
              id,
              gx,
              level,
              g0,
              1,
              3,
              g1 - g0 + 1,
              gable,
            );
      }
      const ridge = 3 * n;
      let at = -ends;
      while (at < L + ends) {
        if (L + ends - at >= 2 && !blocked(at, -oh + n, 2, 2)) {
          put("3043.dat", at, ridge, -oh + n, 0);
          at += 2;
        } else {
          put("3044b.dat", at, ridge, -oh + n, 0);
          at += 1;
        }
      }
      return;
    }
    // Hip: rings of slopes stepping in one stud per course, corner pieces.
    const W = L + 2 * ends;
    for (let k = 0; ; k++) {
      const x0 = -ends + k,
        z0 = -oh + k,
        wk = W - 2 * k,
        dk = D - 2 * k;
      const level = (steep ? 9 : 3) * k;
      if (steep && (wk <= 2 || dk <= 2)) {
        // The spire's tip: 2 × 2 cones along what is left.
        for (let i = 0; i + 2 <= Math.max(wk, 2); i += 2)
          for (let j = 0; j + 2 <= Math.max(dk, 2); j += 2)
            put("3942c.dat", x0 + i, level, z0 + j, 0);
        return;
      }
      if (wk <= 2 && dk > 2) {
        // Narrower than deep (ends overhang less than the eaves): the ridge
        // runs across, along local Z.
        let at = z0;
        while (at < z0 + dk) {
          if (z0 + dk - at >= 2) {
            put("3043.dat", x0, level, at, 90);
            at += 2;
          } else {
            put("3044b.dat", x0, level, at, 90);
            at += 1;
          }
        }
        return;
      }
      if (dk <= 2) {
        let at = x0;
        while (at < x0 + wk) {
          if (x0 + wk - at >= 2) {
            put("3043.dat", at, level, z0, 0);
            at += 2;
          } else {
            put("3044b.dat", at, level, z0, 0);
            at += 1;
          }
        }
        return;
      }
      const corner = steep ? "3685.dat" : "3045.dat";
      put(corner, x0 + wk - 2, level, z0, 0);
      put(corner, x0, level, z0, 90);
      put(corner, x0, level, z0 + dk - 2, 180);
      put(corner, x0 + wk - 2, level, z0 + dk - 2, 270);
      if (wk > 4) {
        run(x0 + 2, x0 + wk - 2, z0, level, 0, k % 2 === 1);
        run(x0 + 2, x0 + wk - 2, z0 + dk - 2, level, 180, k % 2 === 1);
      }
      if (dk > 4) {
        // Along local Z: in a frame turned 90° the run is along its X.
        const side = (lx: number, turn: number) => {
          let at = z0 + 2;
          const to = z0 + dk - 2;
          while (at < to) {
            const len = lengths.find((l) => l <= to - at)!;
            // Footprint corner at (lx, at): turned slopes are 2 wide in X.
            put(table[len], lx, level, at, turn);
            at += len;
          }
        };
        side(x0, 90);
        side(x0 + wk - 2, 270);
      }
      if (k > 200) return;
    }
  }

  /** World direction of a local "+x"/"-x"/"+z"/"-z" in frame f. */
  dirOf(f: Frame, dir: string): [number, number] {
    const v = { "+x": [1, 0], "-x": [-1, 0], "+z": [0, 1], "-z": [0, -1] }[
      dir
    ]!;
    return [f.m[0] * v[0] + f.m[1] * v[1], f.m[2] * v[0] + f.m[3] * v[1]];
  }
  track(
    u: Unit,
    model: Model,
    f: Frame,
    id: number,
    path: string,
    o: Record<string, any>,
  ) {
    const [x, z] = point(f, o.at[0], o.at[2]);
    const y = f.ty + plates(o.at[1]);
    const colour = this.colour(
      o.colour ?? "dark bluish grey",
      path + ".colour",
    );
    const flip = det(f.m) < 0;
    const steps = (text: string, field: string) => {
      const out = text.toUpperCase().replace(/[\s,]/g, "");
      if (!/^[SLRWV]*$/.test(out))
        this.fail(
          path + "." + field,
          "pieces are S (straight), L/R (curves) and W/V (points left/right)",
        );
      // A mirrored frame turns left curves and points into right ones.
      return flip
        ? [...out].map(
            (c) => ({ L: "R", R: "L", W: "V", V: "W" })[c as "L"] ?? c,
          )
        : [...out];
    };
    // Six decimals: curves and points join within a hundredth of an LDU.
    const fmt = (n: number) => {
      const r = Math.round(n * 1e6) / 1e6;
      return Object.is(r, -0) ? "0" : String(r);
    };
    let branch: TrackCursor | undefined;
    const lay = (step: string, at: TrackCursor) => {
      const [ref, inEnd, outEnd] =
        step === "S"
          ? ["53401.dat", 0, 1]
          : step === "L"
            ? ["53400.dat", 1, 0]
            : step === "R"
              ? ["53400.dat", 0, 1]
              : step === "W"
                ? ["75542-f1.dat", 0, 1]
                : ["75541-f1.dat", 0, 1];
      const placed = placeTrackPiece(ref, at, inEnd);
      this.countPart(path);
      model.lines.push(
        `1 ${colour} ${[...placed.transform.position, ...placed.transform.basis].map(fmt).join(" ")} ${ref}`,
      );
      this.origin(u, model, id);
      this.checkColour(ref, colour, id);
      // The track holds the cells under its sleepers (three plates high),
      // so massing is carved there and parts placed on it are reported.
      const holder = u.holders.length;
      u.holders.push({ op: id, ref });
      const from = at.position;
      for (const end of placed.ends) {
        if (end === placed.ends[inEnd]) continue;
        const to = end.position;
        // Band ±95 LDU round the chord (an R40 curve bows 15 LDU from it).
        const ax = from[0],
          az = from[2],
          dx = to[0] - ax,
          dz = to[2] - az;
        const len2 = dx * dx + dz * dz || 1;
        const x0 = Math.floor((Math.min(ax, to[0]) - 95) / 20),
          x1 = Math.ceil((Math.max(ax, to[0]) + 95) / 20),
          z0 = Math.floor((Math.min(az, to[2]) - 95) / 20),
          z1 = Math.ceil((Math.max(az, to[2]) + 95) / 20);
        for (let cx = x0; cx <= x1; cx++)
          for (let cz = z0; cz <= z1; cz++) {
            const px = cx * 20 + 10,
              pz = cz * 20 + 10;
            const t = Math.max(
              0,
              Math.min(1, ((px - ax) * dx + (pz - az) * dz) / len2),
            );
            if (Math.hypot(px - ax - t * dx, pz - az - t * dz) > 95) continue;
            for (let j = 0; j < 3; j++) {
              const key = cellKey(cx, y + j, cz);
              u.reserved.set(key, holder);
            }
          }
      }
      if (step === "W" || step === "V") branch = placed.ends[2];
      return placed.ends[outEnd];
    };
    let cursor: TrackCursor = {
      position: [x * 20, -8 * y - 24, z * 20],
      direction: this.dirOf(f, o.dir),
    };
    for (const step of steps(o.pieces, "pieces")) cursor = lay(step, cursor);
    if (o.branch) {
      if (!branch)
        this.fail(path + ".branch", "a branch needs points (W or V) in pieces");
      let side = branch;
      for (const step of steps(o.branch, "branch")) side = lay(step, side);
    }
  }
  railcar(
    u: Unit,
    model: Model,
    f: Frame,
    id: number,
    path: string,
    o: Record<string, any>,
  ) {
    const [x, z] = point(f, o.at[0], o.at[2]);
    const y = f.ty + plates(o.at[1]);
    const [dx, dz] = this.dirOf(f, o.dir);
    // The car's local +X (its front) turned onto the world direction.
    const turn = ([0, 90, 180, 270] as Turn[]).find((t) => {
      const m = turnMat(t);
      return m[0] === dx && m[2] === dz;
    })!;
    const colour = this.colour(o.colour ?? "black", path + ".colour");
    const n = ++this.railcars;
    const car = new Model(
      `${this.slug}-railcar-${n}.ldr`,
      o.component ? `Rail car: ${o.component}` : "Rail car",
    );
    this.countPart(path);
    car.put("92088.dat", colour, -12, -3, 0);
    this.checkColour("92088.dat", colour, id);
    for (const bx of [-160, 160]) {
      this.countPart(path);
      car.raw("2878c01.dat", colour, [bx, 0, 0], basis(90));
    }
    if (o.component) {
      let override = this.override;
      if (o.palette) {
        override = new Map(this.override);
        for (const [k, v] of Object.entries(
          o.palette as Record<string, Colour | { mix: Colour[] }>,
        ))
          override.set(
            k.toLowerCase(),
            typeof v === "object"
              ? v.mix.flatMap((c) => this.colours(c, `${path}.palette.${k}`))
              : this.colours(v, `${path}.palette.${k}`),
          );
      }
      const comp = this.component(o.component, path, override, o.with);
      this.countPart(path);
      // Deck top: two plates above the base's underside; footprint corner
      // at the car's rear left (-12, -3).
      car.raw(comp.model.name, "16", [-240, -16, -60], basis(0));
    }
    this.railcarModels.push(car);
    model.raw(car.name, "16", [x * 20, -8 * y - 24 - 63, z * 20], basis(turn));
    this.origin(u, model, id);
  }
  railcars = 0;
  railcarModels: Model[] = [];

  instance(
    u: Unit,
    model: Model,
    f: Frame,
    id: number,
    path: string,
    o: Record<string, any>,
  ) {
    const name = o.component as string;
    let override = this.override;
    if (o.palette) {
      override = new Map(this.override);
      for (const [k, v] of Object.entries(
        o.palette as Record<string, Colour | { mix: Colour[] }>,
      ))
        override.set(
          k.toLowerCase(),
          typeof v === "object"
            ? v.mix.flatMap((c) => this.colours(c, `${path}.palette.${k}`))
            : this.colours(v, `${path}.palette.${k}`),
        );
    }
    const comp = this.component(name, path, override, o.with);
    const turn = (o.turn ?? 0) as number;
    // Where the component's footprint corner lands after the turn.
    const tm = turnMat(turn);
    const b = comp.box;
    const corners = [
      [b.x, b.z],
      [b.x + b.w, b.z + b.d],
    ].map(([px, pz]) => [tm[0] * px + tm[1] * pz, tm[2] * px + tm[3] * pz]);
    const minX = Math.min(corners[0][0], corners[1][0]),
      minZ = Math.min(corners[0][1], corners[1][1]);
    const at = [o.at[0] - minX, plates(o.at[1]), o.at[2] - minZ] as [
      number,
      number,
      number,
    ];
    const cf = child(f, at, turn);
    if (det(cf.m) < 0)
      this.fail(path, "components cannot be mirrored; turn them instead");
    const wt = turnOf(cf.m);
    this.countPart(path);
    model.raw(
      comp.model.name,
      "16",
      [cf.tx * 20, -8 * cf.ty, cf.tz * 20],
      basis(wt),
    );
    this.origin(u, model, id);
    // Its cells carve the parent's massing like any part.
    const holder = u.holders.length;
    u.holders.push({ op: id, ref: name });
    const reserve = (lx: number, ly: number, lz: number) => {
      const [wx, wz] = point(cf, lx + 0.5, lz + 0.5);
      u.reserved.set(
        cellKey(Math.floor(wx), cf.ty + ly, Math.floor(wz)),
        holder,
      );
    };
    for (const key of comp.unit.grid.cells.keys()) {
      const [cx, cy, cz] = cellOf(key);
      reserve(cx, cy, cz);
    }
    for (const key of comp.unit.reserved.keys()) {
      const [cx, cy, cz] = cellOf(key);
      reserve(cx, cy, cz);
    }
  }
  /** Flags of the component copy being compiled (`instance.with`). */
  flags = new Set<string>();
  component(
    name: string,
    path: string,
    override?: Map<string, string[]>,
    withFlags: string[] = [],
  ) {
    // One submodel per component, palette variant and set of flags.
    const flags = [...new Set(withFlags)].sort();
    const variant =
      (override?.size
        ? [...override.entries()]
            .sort((a, b) => (a[0] < b[0] ? -1 : 1))
            .map(([k, v]) => k + "=" + v.join("+"))
            .join(";")
        : "") + (flags.length ? "|" + flags.join(",") : "");
    const key = name + "\u0000" + variant;
    const hit = this.components.get(key);
    if (hit) return hit;
    const spec = this.script.components?.[name];
    if (!spec) this.fail(path, `unknown component ${JSON.stringify(name)}`);
    if (this.compiling.has(name))
      this.fail(path, `component ${name} contains itself`);
    this.compiling.add(name);
    const n = [...this.components.values()].filter(
      (e) => e.name === name,
    ).length;
    const model = new Model(
      `${this.slug}-component-${slugify(name)}${n ? "-" + (n + 1) : ""}.ldr`,
      (spec.title ?? name) + (n ? ` (${n + 1})` : ""),
    );
    const unit = newUnit(name, [model]);
    const outer = this.override,
      outerFlags = this.flags;
    this.override = override;
    this.flags = new Set(flags);
    try {
      this.run(unit, spec.ops, IDENTITY, 0, `components.${name}.ops`);
      this.finish(unit, () => model);
    } finally {
      this.override = outer;
      this.flags = outerFlags;
    }
    this.compiling.delete(name);
    // Footprint of everything it holds (cells and reserved part cells).
    let x0 = Infinity,
      z0 = Infinity,
      x1 = -Infinity,
      z1 = -Infinity;
    for (const key of [...unit.grid.cells.keys(), ...unit.reserved.keys()]) {
      const [cx, , cz] = cellOf(key);
      x0 = Math.min(x0, cx);
      z0 = Math.min(z0, cz);
      x1 = Math.max(x1, cx + 1);
      z1 = Math.max(z1, cz + 1);
    }
    if (x0 === Infinity) (x0 = 0), (z0 = 0), (x1 = 0), (z1 = 0);
    const entry = {
      name,
      unit,
      model,
      box: spec.size
        ? { x: 0, z: 0, w: spec.size[0], d: spec.size[1] }
        : { x: x0, z: z0, w: x1 - x0, d: z1 - z0 },
    };
    this.components.set(key, entry);
    return entry;
  }

  /** Detail passes, carving by parts, then packing into pieces. */
  finish(u: Unit, modelOf: (section: number) => Model) {
    const scatters = u.details.filter((d) => d.op.op === "scatter");
    const smooths = u.details.filter((d) => d.op.op === "smooth");
    for (const d of scatters) this.scatter(u, d, modelOf(d.section));
    for (const key of u.reserved.keys()) u.grid.cells.delete(key);
    for (const d of smooths) {
      const o = d.op as Record<string, any>;
      const r = o.region
        ? rect(
            d.frame,
            o.region.at[0],
            o.region.at[1],
            o.region.size[0],
            o.region.size[1],
          )
        : undefined;
      for (const [key, cell] of u.grid.cells) {
        const [x, y, z] = cellOf(key);
        if (r && (x < r.x || z < r.z || x >= r.x + r.w || z >= r.z + r.d))
          continue;
        if (!u.grid.get(x, y + 1, z) && !u.reserved.has(cellKey(x, y + 1, z)))
          u.grid.cells.set(key, { ...cell, tile: true });
      }
    }
    const packed = packGrid(
      u.grid,
      this.materials,
      this.seed,
      (x, y, z) => u.reserved.has(cellKey(x, y, z)),
      (x, y, z) => {
        // Studded parts hold what rests on them; slopes only on their top
        // row, so they are not counted.
        const holder = u.reserved.get(cellKey(x, y, z));
        if (holder === undefined) return false;
        const spec = partSpec(u.holders[holder].ref);
        return !!spec?.studded && !/slope|roof|ridge/i.test(spec.name);
      },
    );
    for (const [k, n] of packed.unavailable) {
      const hit = this.unavailable.get(k) ?? {
        count: 0,
        ops: new Set<number>(),
      };
      hit.count += n;
      this.unavailable.set(k, hit);
    }
    for (const p of packed.pieces) {
      this.countPart(this.opPaths[p.op]);
      const model = modelOf(p.section);
      model.put(p.ref, p.colour, p.x, p.z, p.y, p.turn);
      this.origin(u, model, p.op);
    }
    return packed.pieces.length;
  }

  scatter(u: Unit, d: Unit["details"][number], model: Model) {
    const o = d.op as Record<string, any>;
    const path = this.opPaths[d.path];
    const r = rect(
      d.frame,
      o.region.at[0],
      o.region.at[1],
      o.region.size[0],
      o.region.size[1],
    );
    const refs = (o.parts as PartRef[]).map((p, i) =>
      this.part(p, `${path}.parts[${i}]`),
    );
    const colours = (o.colours as Colour[]).map((c, i) =>
      this.colour(c, `${path}.colours[${i}]`),
    );
    const density = Math.max(0, Math.min(1, o.density ?? 0.2));
    const seed = o.seed ?? this.seed;
    const tops = u.grid.tops(u.reserved.keys());
    const spacing = o.spacing ?? 1;
    const placed: [number, number][] = [];
    for (let x = r.x; x < r.x + r.w; x++)
      for (let z = r.z; z < r.z + r.d; z++) {
        if (hash01(seed, x, z, 7) >= density) continue;
        if (
          placed.some(
            ([px, pz]) => Math.abs(px - x) + Math.abs(pz - z) < spacing,
          )
        )
          continue;
        const top = u.grid.top(tops, x, z);
        const level = top === undefined ? 0 : top + 1;
        const ref = refs[Math.floor(hash01(seed, x, z, 11) * refs.length)];
        const fp = footprint(ref, 0);
        const w = fp.width / 20,
          dd = fp.depth / 20;
        let free = true;
        for (let i = 0; i < w && free; i++)
          for (let k = 0; k < dd && free; k++) {
            const t = u.grid.top(tops, x + i, z + k);
            free =
              (t === undefined ? 0 : t + 1) === level &&
              !u.reserved.has(cellKey(x + i, level, z + k));
            // Only on studs: not on tiles, trees or other smooth tops.
            const below = cellKey(x + i, level - 1, z + k);
            const holder = u.reserved.get(below);
            // Only on massing and the ground, never on parts: a part's cells
            // cover its whole body but its studs are only on some of them
            // (a roof's ridge row, one stud of a plant).
            if (holder !== undefined) free = false;
            if (u.grid.cells.get(below)?.tile) free = false;
          }
        if (!free) continue;
        placed.push([x, z]);
        this.put(
          u,
          model,
          IDENTITY,
          d.path,
          ref,
          colours[Math.floor(hash01(seed, x, z, 13) * colours.length)],
          x,
          level,
          z,
          0,
        );
      }
  }
}

function newUnit(name: string, models: Model[]): Unit {
  return {
    name,
    grid: new Grid(),
    reserved: new Map(),
    holders: [],
    details: [],
    models,
    origins: new Map(),
  };
}
export function slugify(s: string) {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40) || "build"
  );
}

/** Throws AppError INVALID_INPUT with every issue when the script is invalid. */
export function assertBuildScript(
  script: unknown,
): asserts script is BuildScript {
  const issues = validateBuildScript(script);
  if (issues.length)
    throw new AppError(
      "INVALID_INPUT",
      "Invalid build script: " +
        issues
          .slice(0, 5)
          .map((i) => `${i.path} ${i.message}`)
          .join("; ") +
        (issues.length > 5 ? ` (+${issues.length - 5} more)` : ""),
      { issues },
    );
}
export type { ValidationIssue };

/** Compiles a build script. Throws AppError on invalid input or limits. */
export function compileBuildScript(
  input: unknown,
  options: CompileOptions = {},
): CompileResult {
  const now = options.now ?? (() => performance.now());
  const started = now();
  assertBuildScript(input);
  const script = input;
  const range =
    options.targetParts === undefined
      ? undefined
      : partRange(options.targetParts, options.leeway);
  const slug = slugify(script.title);
  const limit = resourceLimits(options.profile).occurrences;
  const c = new Compiler(script, slug, limit);
  const models = script.sections.map(
    (s, i) =>
      new Model(
        `${slug}-${String(i + 1).padStart(2, "0")}-${slugify(s.name)}.ldr`,
        s.name,
      ),
  );
  const unit = newUnit("build", models);
  script.sections.forEach((s, i) =>
    c.run(unit, s.ops, IDENTITY, i, `sections[${i}].ops`),
  );
  const massingCells = unit.grid.cells.size;
  const massingParts = c.finish(unit, (i) => models[i]);
  const componentModels = [
    ...[...c.components.values()].map((e) => e.model),
    ...c.railcarModels,
  ];
  const header = [
    "Compiled from a Brick Editor build script (docs/AGENT-BUILDING.md).",
    "x/z studs, y plates; front faces -Z; y = 0 is the ground.",
  ];
  const ldraw = mpdText(
    slug + ".mpd",
    script.title,
    header,
    models,
    componentModels,
    script.author,
    script.sections.map((sec) => sec.layer ?? sec.name),
  );
  const compileMs = now() - started;

  // Unavailable colours.
  for (const [k, hit] of c.unavailable) {
    const [ref, colour] = k.split("|");
    c.problem({
      severity: "warning",
      code: "colour-unavailable",
      message: `${partSpec(ref)?.name ?? ref} (${ref}) is not known to be made in ${colourName(colour)} (${hit.count}×)`,
      ops: [...hit.ops].slice(0, 5).map((o) => c.opPaths[o]),
    });
  }
  if (!colorAvailabilityLoaded())
    c.problem({
      severity: "info",
      code: "colour-unchecked",
      message:
        "Colour availability data was not loaded; colours were not checked",
    });

  let project: Project | null = null;
  let check: CompileReport["check"] = null;
  const checkStarted = now();
  project = importLDraw(ldraw, slug + ".mpd", { profile: options.profile });
  project.title = script.title;
  project.metadata = {
    ...project.metadata,
    buildScript: { version: 1, title: script.title },
  };
  assignLayers(project, script, models);
  const all = occurrences(project);
  // Map every occurrence to the op that made it.
  const nodeIndex = new Map<string, number>();
  for (const m of Object.values(project.models))
    m.nodes.forEach((n, i) => nodeIndex.set(m.id + "\u0000" + n.id, i));
  const modelByName = new Map<string, Model>();
  for (const m of [...models, ...componentModels])
    modelByName.set(m.name.toLowerCase(), m);
  const byId = new Map(all.map((o) => [o.id, o]));
  const unitOfModel = new Map<Model, Unit>();
  for (const m of models) unitOfModel.set(m, unit);
  for (const e of c.components.values()) unitOfModel.set(e.model, e.unit);
  const opOf = (occurrenceId: string): string | undefined => {
    const o = byId.get(occurrenceId);
    if (!o) return undefined;
    const own = () => {
      const i = nodeIndex.get(o.modelId + "\u0000" + o.node.id);
      const m = modelByName.get(project!.models[o.modelId].name.toLowerCase());
      if (i === undefined || !m) return undefined;
      return c.opPaths[unitOfModel.get(m)?.origins.get(m)?.[i] ?? -1];
    };
    // Parts inside a component: the instance in its section, then the
    // component's own op ("sections[1].ops[3] > components.house.ops[2]").
    const top = project!.models[project!.rootModelId].nodes.find(
      (n) => n.id === o.path[0],
    );
    const sectionModelId = top?.ref;
    if (o.path.length > 2 && sectionModelId) {
      const i = nodeIndex.get(sectionModelId + "\u0000" + o.path[1]);
      const m = modelByName.get(
        project!.models[sectionModelId].name.toLowerCase(),
      );
      if (i !== undefined && m) {
        const outer = c.opPaths[unit.origins.get(m)?.[i] ?? -1];
        const inner = own();
        return outer && inner && inner !== outer
          ? `${outer} > ${inner}`
          : outer;
      }
    }
    return own();
  };
  if (options.check !== false) {
    const extra: Record<string, Bounds[]> = {};
    const missing = new Set<string>();
    for (const o of all)
      if (
        !missing.has(o.node.ref) &&
        !Object.hasOwn(extra, o.node.ref) &&
        !localOccupancy(o.node.ref)
      ) {
        const flat = fullConnectorEntry(o.node.ref)?.occupancy;
        if (flat?.length) extra[o.node.ref] = decodeOccupancy(flat);
        else missing.add(o.node.ref);
      }
    if (missing.size && options.occupancyFor)
      Object.assign(extra, options.occupancyFor([...missing]));
    const r = checkBuild(project, { occupancy: extra, occurrences: all });
    for (const [a, b] of r.overlaps.slice(0, 50)) {
      const oa = byId.get(a)!,
        ob = byId.get(b)!;
      c.problem({
        severity: "error",
        code: "overlap",
        message: `${oa.node.ref} and ${ob.node.ref} overlap`,
        ops: [...new Set([opOf(a), opOf(b)].filter(Boolean) as string[])],
      });
    }
    if (r.overlaps.length > 50)
      c.problem({
        severity: "error",
        code: "overlap",
        message: `${r.overlaps.length - 50} more overlaps`,
      });
    if (r.offGrid.length)
      c.problem({
        severity: "warning",
        code: "off-grid",
        message: `${r.offGrid.length} part(s) are off the stud grid`,
        ops: [
          ...new Set(
            r.offGrid.slice(0, 20).map(opOf).filter(Boolean) as string[],
          ),
        ],
      });
    if (r.groupMembers.length > 1) {
      const sorted = [...r.groupMembers].sort((a, b) => b.length - a.length);
      const loose = sorted.slice(1);
      const count = loose.reduce((n, g) => n + g.length, 0);
      const ops = new Map<string, number>();
      for (const g of loose)
        for (const idd of g) {
          const p = opOf(idd);
          if (p) ops.set(p, (ops.get(p) ?? 0) + 1);
        }
      // Where the first loose groups are, in script coordinates (studs,
      // plates): "3004 at [12, 21, -4]".
      const where = loose
        .slice(0, 6)
        .map((g) => {
          const o = byId.get(g[0]);
          if (!o) return "";
          const [px, py, pz] = o.transform.position;
          const b = partSpec(o.node.ref)?.bounds;
          const top = b ? -py - b.max[1] : -py;
          return `${o.node.ref.replace(/\.dat$/, "")} at [${Math.floor(px / 20)}, ${Math.round(top / 8)}, ${Math.floor(pz / 20)}]`;
        })
        .filter(Boolean);
      c.problem({
        severity: "warning",
        code: "floating",
        message:
          `${count} part(s) in ${loose.length} group(s) are not connected to the main structure (largest group: ${sorted[0].length} parts)` +
          (where.length ? `; e.g. ${where.join(", ")}` : ""),
        ops: [...ops.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 12)
          .map(([p]) => p),
      });
    }
    const connectivity = r.health.checks.find((h) => h.id === "connectivity");
    check = {
      overlaps: r.overlaps.length,
      offGrid: r.offGrid.length,
      groups: r.groups,
      covered: r.covered,
      uncovered: r.uncovered,
      health: connectivity
        ? `${connectivity.status}: ${connectivity.detail}`
        : r.health.checks.map((h) => h.status).join(","),
    };
  }
  const checkMs = now() - checkStarted;

  // Part list and statistics.
  const lots = new Map<
    string,
    { ref: string; colour: string; count: number }
  >();
  const byOp = new Map<string, number>();
  let min: V3 = [Infinity, Infinity, Infinity],
    max: V3 = [-Infinity, -Infinity, -Infinity];
  for (const o of all) {
    const k = o.node.ref + "|" + o.colorCode;
    const lot = lots.get(k) ?? {
      ref: o.node.ref,
      colour: o.colorCode,
      count: 0,
    };
    lot.count++;
    lots.set(k, lot);
    const b = partSpec(o.node.ref)?.bounds;
    if (b) {
      // The part's box, placed and turned.
      const w = transformBounds(b as Bounds, o.transform);
      for (let i = 0; i < 3; i++) {
        min[i] = Math.min(min[i], w.min[i]);
        max[i] = Math.max(max[i], w.max[i]);
      }
    }
  }
  for (const u of [unit, ...[...c.components.values()].map((e) => e.unit)])
    for (const list of u.origins.values())
      for (const op of list) {
        const p = c.opPaths[op];
        byOp.set(p, (byOp.get(p) ?? 0) + 1);
      }
  const bounds =
    min[0] === Infinity
      ? null
      : {
          studs: {
            min: [
              Math.floor(min[0] / 20),
              Math.floor(-max[1] / 8),
              Math.floor(min[2] / 20),
            ] as [number, number, number],
            max: [
              Math.ceil(max[0] / 20),
              Math.ceil(-min[1] / 8),
              Math.ceil(max[2] / 20),
            ] as [number, number, number],
          },
          ldu: {
            min: min.map((v) => Math.round(v)) as V3,
            max: max.map((v) => Math.round(v)) as V3,
          },
        };
  const scriptBytes = new TextEncoder().encode(JSON.stringify(script)).length;
  const parts = all.length;
  const sectionCounts = script.sections.map((s, i) => {
    const node = project!.models[project!.rootModelId].nodes[i];
    return {
      name: s.name,
      layer: s.layer ?? s.name,
      parts: node ? all.filter((o) => o.path[0] === node.id).length : 0,
    };
  });
  const heaviestOps = [...byOp.entries()]
    .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))
    .slice(0, 12)
    .map(([op, n]) => ({
      op,
      kind: c.opKinds[c.opPaths.indexOf(op)] ?? "",
      parts: n,
    }));
  const fmt = (n: number) => n.toLocaleString("en-US");
  const band = range
    ? ` (target ${fmt(range.target)} ± ${range.leeway}%: ${fmt(range.min)}–${fmt(range.max)})`
    : "";
  const budget = Math.min(
    range?.max ?? Infinity,
    script.limits?.maxParts ?? Infinity,
  );
  if (range && parts < range.min)
    c.problems.unshift({
      severity: "error",
      code: "under-budget",
      message: `${fmt(parts)} parts: ${fmt(range.min - parts)} under the minimum of ${fmt(range.min)}${band}: add more`,
    });
  else if (parts > budget) {
    // Every instance counts here, against the op in its section that made
    // it (a component instance, a repeat), unlike heaviestOps.
    const bySource = new Map<string, number>();
    for (const o of all) {
      const op = opOf(o.id)?.split(" > ")[0];
      if (op) bySource.set(op, (bySource.get(op) ?? 0) + 1);
    }
    const costliest = [...bySource.entries()]
      .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))
      .slice(0, 5);
    const largest = [...sectionCounts]
      .sort((a, b) => b.parts - a.parts)
      .slice(0, 3)
      .map((s) => `${s.name} ${s.parts.toLocaleString("en-US")}`);
    c.problems.unshift({
      severity: "error",
      code: "over-budget",
      message:
        `${fmt(parts)} parts: ${fmt(parts - budget)} over the maximum of ${fmt(budget)}${budget === range?.max ? band : ""}` +
        ` (largest sections: ${largest.join(", ")}; costliest ops: ${costliest.map(([op, n]) => `${op} ${fmt(n)}`).join(", ")})`,
      ops: costliest.map(([op]) => op),
    });
  }
  const problems = c.problems;
  const report: CompileReport = {
    ok: !problems.some((p) => p.severity === "error"),
    buildScript: 1,
    title: script.title,
    stats: {
      parts,
      designs: new Set(all.map((o) => o.node.ref)).size,
      lots: lots.size,
      massingCells,
      massingParts,
      placedParts: parts - massingParts,
      sections: script.sections.length,
      components: c.components.size,
      opsRun: c.opsRun,
      scriptBytes,
      ldrawBytes: new TextEncoder().encode(ldraw).length,
      partsPerScriptKB:
        Math.round((parts / Math.max(1, scriptBytes / 1024)) * 10) / 10,
      compileMs: Math.round(compileMs),
      checkMs: Math.round(checkMs),
    },
    bounds,
    sections: sectionCounts,
    parts: [...lots.values()]
      .sort((a, b) => b.count - a.count || (a.ref < b.ref ? -1 : 1))
      .map((l) => ({
        ref: l.ref,
        name: partSpec(l.ref)?.name ?? l.ref,
        colour: l.colour,
        colourName: colourName(l.colour),
        count: l.count,
      })),
    heaviestOps,
    resolved: c.resolved,
    check,
    problems,
  };
  return { report, ldraw, project };
}

function assignLayers(project: Project, script: BuildScript, models: Model[]) {
  assignSectionLayers(project, (i) =>
    models[i]
      ? (script.sections[i].layer ?? script.sections[i].name)
      : undefined,
  );
}

function mpdText(
  file: string,
  title: string,
  header: string[],
  sections: Model[],
  components: Model[],
  author?: string,
  layers: string[] = [],
) {
  const fmt = (n: number) => {
    const r = Math.round(n * 1000) / 1000;
    return Object.is(r, -0) ? "0" : String(r);
  };
  const out = [
    `0 FILE ${file}`,
    `0 ${title}`,
    `0 Name: ${file}`,
    `0 Author: ${author ?? "Brick Editor build script"}`,
    ...header.map((h) => "0 // " + h),
    ...sections.map(
      (s) =>
        `1 16 ${s.placement.position.map(fmt).join(" ")} ${s.placement.basis.map(fmt).join(" ")} ${s.name}`,
    ),
  ];
  [...sections, ...components].forEach((s, i) =>
    out.push(
      "",
      `0 FILE ${s.name}`,
      `0 ${s.title}`,
      `0 Name: ${s.name}`,
      // Read back by sectionLayers() when the file is opened again.
      ...(layers[i] !== undefined ? [LAYER_COMMENT + layers[i]] : []),
      ...s.lines,
    ),
  );
  return out.join("\n") + "\n";
}
