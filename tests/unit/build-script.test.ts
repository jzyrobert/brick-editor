import { beforeAll, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import Ajv from "ajv";
import {
  buildScriptJsonSchema,
  opReference,
  OPS,
  plates,
  validateBuildScript,
} from "../../src/build-script/spec";
import {
  compileBuildScript,
  outsideBudget,
  targetMiss,
} from "../../src/build-script/compile";
import { targetText } from "../../src/build-script/budget";
import { overreach, placementText } from "../../src/build-script/part-list";
import { Grid, packGrid } from "../../src/build-script/pack";
import { catalog } from "../../src/catalog/catalog";
import { madeIn } from "../../src/catalog/color-availability";
import { occurrences } from "../../src/core/document";
import { registerFullLibraryFromDisk } from "../../scripts/full-library-node";
import { registerAgentData } from "../../scripts/build-script-cli";

beforeAll(() => {
  expect(registerFullLibraryFromDisk()).toBe(true);
  registerAgentData();
});

const script = (ops: unknown[], extra: Record<string, unknown> = {}) => ({
  buildScript: 1,
  title: "Test",
  ...extra,
  sections: [{ name: "Main", ops }],
});
/** Parts of a compiled script: ref, colour, world origin (LDU). */
function parts(s: unknown) {
  const r = compileBuildScript(s, { now: () => 0 });
  const list = occurrences(r.project!).map((o) => ({
    ref: o.node.ref,
    colour: o.colorCode,
    p: o.transform.position,
    b: o.transform.basis,
  }));
  return { ...r, list };
}
const refCount = (list: { ref: string }[], ref: string) =>
  list.filter((p) => p.ref === ref).length;

describe("build script schema", () => {
  it("accepts the examples and reports precise paths for mistakes", () => {
    for (const [name, spec] of Object.entries(OPS))
      expect(validateBuildScript(script([spec.example])), name).toEqual([]);
    const issues = validateBuildScript({
      buildScript: 1,
      title: "x",
      sections: [
        {
          name: "a",
          ops: [
            { op: "box", at: [0, 0], size: [1, "2x", 1], colour: "red" },
            { op: "tower", at: [0, 0, 0] },
            {
              op: "wall",
              from: [0, 0],
              to: [3, 0],
              colour: 4,
              height: 3,
              color: 1,
            },
            {
              op: "repeat",
              count: 2,
              step: [1, 0, 0],
              ops: [{ op: "place", at: [0, 0, 0] }],
            },
          ],
        },
      ],
    });
    const paths = issues.map((i) => i.path);
    expect(paths).toContain("$.sections[0].ops[0].at");
    expect(paths).toContain("$.sections[0].ops[0].size");
    expect(paths).toContain("$.sections[0].ops[1].op");
    expect(paths).toContain("$.sections[0].ops[2].color");
    expect(paths).toContain("$.sections[0].ops[3].ops[0].part");
    expect(paths).toContain("$.sections[0].ops[3].ops[0].colour");
    expect(validateBuildScript({ buildScript: 2 }).map((i) => i.path)).toEqual(
      expect.arrayContaining(["$.buildScript", "$.title", "$.sections"]),
    );
    expect(() => compileBuildScript({ buildScript: 1 })).toThrow(
      /Invalid build script/,
    );
    expect(plates("4b")).toBe(12);
    expect(opReference()).toContain("wall: Straight wall");
  });

  it("publishes a JSON Schema that agrees with the validator", () => {
    const schema = buildScriptJsonSchema();
    expect(
      JSON.parse(readFileSync("schemas/buildScript.v1.json", "utf8")),
    ).toMatchObject({
      $id: "buildScript",
      title: schema.title,
    });
    const ajv = new Ajv({ allErrors: true, strict: false });
    const check = ajv.compile(schema);
    for (const f of ["house", "castle", "santorini", "townhouse"]) {
      const s = JSON.parse(
        readFileSync(`fixtures/build-scripts/${f}.json`, "utf8"),
      );
      expect(check(s), f + JSON.stringify(check.errors)).toBe(true);
      expect(validateBuildScript(s), f).toEqual([]);
    }
    const bad = script([{ op: "box", at: [0, 0, 0], size: [1, 1, 1] }]);
    expect(check(bad)).toBe(false);
    expect(validateBuildScript(bad).length).toBeGreaterThan(0);
  });
});

describe("massing packer", () => {
  const pack = (cells: [number, number, number][], colour = "15") => {
    const grid = new Grid();
    for (const [x, y, z] of cells)
      grid.set(x, y, z, { mat: 0, section: 0, op: 0, tile: false });
    return packGrid(grid, [{ colours: [colour], mode: "auto" }], 1, () => false)
      .pieces;
  };
  const along = (ref: string, turn: number) => {
    const p = catalog[ref];
    return (turn === 0 ? p.width : p.depth) / 20;
  };

  it("lays a straight wall in running bond: no joint over a joint", () => {
    const cells: [number, number, number][] = [];
    for (let x = 0; x < 14; x++)
      for (let y = 0; y < 15; y++) cells.push([x, y, 0]);
    const pieces = pack(cells);
    const courses = new Map<number, number[]>();
    for (const p of pieces) {
      expect(catalog[p.ref].height, p.ref).toBe(24); // bricks only
      const joints = courses.get(p.y) ?? [];
      const end = p.x + along(p.ref, p.turn);
      if (end < 14) joints.push(end);
      courses.set(p.y, joints);
    }
    expect([...courses.keys()].sort((a, b) => a - b)).toEqual([0, 3, 6, 9, 12]);
    for (const y of [3, 6, 9, 12]) {
      const below = new Set(courses.get(y - 3));
      for (const j of courses.get(y)!)
        expect(below.has(j), `course ${y} joint ${j}`).toBe(false);
    }
  });

  it("fills volumes with the largest pieces and plates where bricks do not fit", () => {
    const cells: [number, number, number][] = [];
    for (let x = 0; x < 8; x++)
      for (let z = 0; z < 6; z++)
        for (let y = 0; y < 4; y++) cells.push([x, y, z]);
    const pieces = pack(cells);
    const bricks = pieces.filter((p) => p.y === 0);
    // 8 × 6 of bricks: three 2 × 8 bricks, then one plate layer (a 6 × 8).
    expect(bricks.map((p) => p.ref)).toEqual([
      "3007.dat",
      "3007.dat",
      "3007.dat",
    ]);
    expect(pieces.filter((p) => p.y === 3).map((p) => p.ref)).toEqual([
      "3036.dat",
    ]);
  });

  it("only uses piece sizes made in the colour", () => {
    // Brick 1 × 16 (2465) is made in white but not in every colour: a
    // 16-long course in such a colour uses shorter bricks.
    const cells: [number, number, number][] = [];
    for (let x = 0; x < 16; x++)
      for (let y = 0; y < 3; y++) cells.push([x, y, 0]);
    expect(pack(cells, "15").map((p) => p.ref)).toEqual(["2465.dat"]);
    const missing = ["28", "320", "378", "84", "19"].find(
      (c) => !madeIn("2465.dat", c) && madeIn("3008.dat", c),
    )!;
    expect(missing).toBeDefined();
    const pieces = pack(cells, missing).map((p) => p.ref);
    expect(pieces).not.toContain("2465.dat");
    for (const ref of pieces) expect(madeIn(ref, missing), ref).toBe(true);
  });
});

describe("build script ops", () => {
  it("puts windows and doors into openings and keeps bricks out of them", () => {
    const { list, report } = parts(
      script([
        {
          op: "wall",
          from: [0, 0],
          to: [11, 0],
          height: "6b",
          colour: "white",
          openings: [
            { at: 1, width: 4, height: 18, fill: "door", door: "red" },
            { at: 7, width: 2, y: 3, height: 9, frame: "white" },
            { at: 10, width: 2, y: 6, height: 6, fill: "none" },
          ],
        },
      ]),
    );
    expect(report.problems.filter((p) => p.severity === "error")).toEqual([]);
    expect(refCount(list, "60596.dat")).toBe(1);
    // The smooth door is not made in red: the door with panes is.
    expect(refCount(list, "60623.dat")).toBe(1);
    expect(refCount(list, "60593.dat")).toBe(1);
    expect(refCount(list, "60602.dat")).toBe(1);
    // The open hole (x 10..11, levels 6..11) holds nothing.
    for (const p of list)
      if (catalog[p.ref]?.category === "Bricks") {
        const y = -p.p[1] / 8;
        const inHole = p.p[0] > 200 && y > 6 && y < 12;
        expect(inHole, JSON.stringify(p)).toBe(false);
      }
    expect(report.check?.overlaps).toBe(0);
  });

  it("steps gable and hip roof slopes one stud in per course", () => {
    const gable = parts(
      script([
        {
          op: "roof",
          style: "gable",
          at: [0, 0, 0],
          size: [12, 8],
          colour: "dark red",
        },
      ]),
    );
    const slopes = gable.list.filter((p) =>
      ["3037.dat", "3038.dat", "3039.dat", "3040b.dat"].includes(p.ref),
    );
    // Four courses (depth 8 + 2 overhang = 10: 10 / 2 − 1), undersides at
    // levels 0, 3, 6 and 9; the ridge (3043) at level 12.
    const level = (p: { p: number[] }) => Math.round((-p.p[1] - 24) / 8);
    const levels = [...new Set(slopes.map(level))].sort((a, b) => a - b);
    expect(levels).toEqual([0, 3, 6, 9]);
    const ridge = gable.list.filter((p) => p.ref === "3043.dat");
    expect(ridge.length).toBe(7);
    // Each course's front row is one stud further in (z of the front slopes).
    const front = (at: number) =>
      Math.min(...slopes.filter((p) => level(p) === at).map((p) => p.p[2]));
    expect(front(3) - front(0)).toBe(20);
    expect(front(9) - front(6)).toBe(20);
    const hip = parts(
      script([
        {
          op: "roof",
          style: "hip",
          at: [0, 0, 0],
          size: [10, 6],
          colour: "dark red",
        },
      ]),
    );
    expect(refCount(hip.list, "3045.dat")).toBe(12); // four corners on 3 courses
    expect(hip.report.check?.overlaps).toBe(0);
    expect(() =>
      compileBuildScript(
        script([
          {
            op: "roof",
            style: "gable",
            at: [0, 0, 0],
            size: [6, 7],
            colour: 4,
            ridge: "x",
          },
        ]),
      ),
    ).toThrow(/sections\[0\]\.ops\[0\].*even/);
  });

  it("repeats, mirrors and turns ops (mirrored windows face the other way)", () => {
    const { list } = parts(
      script([
        {
          op: "repeat",
          count: 3,
          step: [4, 0, 0],
          ops: [{ op: "place", part: "3001", at: [0, 0, 0], colour: "red" }],
        },
        {
          op: "mirror",
          axis: "x",
          about: 20,
          ops: [
            {
              op: "window",
              at: [10, 0, 10],
              facing: "left",
              size: "1x2x2",
              frame: "white",
            },
            { op: "place", part: "41769a", at: [12, 0, 20], colour: "white" },
          ],
        },
      ]),
    );
    expect(list.filter((p) => p.ref === "3001.dat").map((p) => p.p[0])).toEqual(
      [40, 120, 200],
    );
    const windows = list.filter((p) => p.ref === "60592.dat");
    expect(windows.length).toBe(2);
    // Facing left (turn 90) mirrored across x = 20 faces right (turn 270).
    expect(windows.map((w) => w.b[2]).sort()).toEqual([-1, 1]);
    expect(windows.map((w) => w.p[0]).sort((a, b) => a - b)).toEqual([
      210, 590,
    ]);
    // Wedge plate right ↔ left.
    expect(refCount(list, "41769a.dat")).toBe(1);
    expect(refCount(list, "41770a.dat")).toBe(1);
  });

  it("leaves unseen interiors hollow, or fills them with cheap bricks", () => {
    const box = (interior: string) =>
      parts(
        script([
          {
            op: "box",
            at: [0, 0, 0],
            size: [12, "6b", 12],
            colour: "tan",
            interior,
          },
        ]),
      );
    const empty = box("empty"),
      fill = box("fill"),
      solid = box("solid");
    expect(empty.list.length).toBeLessThan(fill.list.length);
    expect(fill.list.some((p) => p.colour === "71")).toBe(true);
    expect(solid.list.every((p) => p.colour === "19")).toBe(true);
    // Hollow: nothing inside x 1..10, z 1..10 below the two-plate roof.
    for (const p of empty.list) {
      const y = -p.p[1] / 8;
      const inside =
        p.p[0] > 30 && p.p[0] < 210 && p.p[2] > 30 && p.p[2] < 210 && y < 15;
      expect(inside, JSON.stringify(p)).toBe(false);
    }
    for (const r of [empty, fill, solid]) {
      expect(r.report.check?.overlaps).toBe(0);
      expect(r.report.check?.groups).toBe(1);
    }
  });

  it("refuses colours a placed part is not made in, naming ones it is", () => {
    const { report } = parts(
      script([{ op: "place", part: "60593", at: [0, 0, 0], colour: "blue" }]),
    );
    expect(report.ok).toBe(false);
    const problem = report.problems.find(
      (p) => p.code === "colour-unavailable",
    )!;
    expect(problem).toMatchObject({
      severity: "error",
      ops: ["sections[0].ops[0]"],
    });
    expect(problem.message).toMatch(
      /\(60593\) is not made in Blue \(1×\); it comes in White/,
    );
    expect(() =>
      compileBuildScript(
        script([
          { op: "box", at: [0, 0, 0], size: [1, 1, 1], colour: "blurple" },
        ]),
      ),
    ).toThrow(/sections\[0\]\.ops\[0\]\.colour: unknown colour/);
  });

  it("reports overlaps and floating parts with the ops that made them", () => {
    const { report } = parts(
      script([
        { op: "baseplate", at: [0, 0], size: [16, 16], colour: "green" },
        { op: "place", part: "3001", at: [0, 0, 0], colour: "red" },
        { op: "place", part: "3001", at: [2, 0, 0], colour: "red" },
        { op: "place", part: "3003", at: [10, 6, 10], colour: "red" },
      ]),
    );
    expect(report.ok).toBe(false);
    expect(report.problems).toContainEqual(
      expect.objectContaining({
        code: "overlap",
        ops: ["sections[0].ops[1]", "sections[0].ops[2]"],
      }),
    );
    expect(report.problems).toContainEqual(
      expect.objectContaining({
        code: "floating",
        ops: ["sections[0].ops[3]"],
      }),
    );
  });

  it("instances components as real submodels", () => {
    const r = parts(
      script(
        [
          { op: "baseplate", at: [0, 0], size: [16, 16], colour: "green" },
          { op: "instance", component: "hut", at: [1, 0, 1] },
          { op: "instance", component: "hut", at: [8, 0, 8], turn: 90 },
        ],
        {
          components: {
            hut: {
              ops: [
                {
                  op: "box",
                  at: [0, 0, 0],
                  size: [4, 6, 2],
                  colour: "white",
                  interior: "solid",
                },
              ],
            },
          },
        },
      ),
    );
    expect(
      Object.values(r.project!.models).filter((m) =>
        m.name.includes("component-hut"),
      ),
    ).toHaveLength(1);
    expect(r.report.check?.overlaps).toBe(0);
    expect(r.report.check?.groups).toBe(1);
    expect(r.report.stats.components).toBe(1);
  });

  it("is deterministic and records part searches", () => {
    const s = script(
      [
        {
          op: "place",
          part: { find: "1x2 tile" },
          at: [0, 0, 0],
          colour: "white",
        },
        { op: "place", part: "cheese slope", at: [2, 0, 0], colour: "red" },
        { op: "place", part: "@light", at: [4, 0, 0], colour: "yellow" },
        { op: "box", at: [0, 3, 0], size: [6, 6, 4], colour: "stone" },
        {
          op: "scatter",
          region: { at: [0, 0], size: [6, 4] },
          parts: ["24866"],
          colours: ["red", "yellow"],
          density: 0.5,
        },
      ],
      {
        palette: { stone: { mix: ["light bluish grey", "dark bluish grey"] } },
        parts: { light: { find: "headlight brick" } },
      },
    );
    const a = compileBuildScript(s, { now: () => 0 }),
      b = compileBuildScript(structuredClone(s), { now: () => 0 });
    expect(a.ldraw).toBe(b.ldraw);
    expect(a.report).toEqual(b.report);
    expect(a.report.resolved).toEqual([
      {
        op: "sections[0].ops[0].part",
        find: "1x2 tile",
        ref: "3069b.dat",
        name: "Tile 1 × 2",
      },
      {
        op: "sections[0].ops[1].part",
        find: "cheese slope",
        ref: "54200.dat",
        name: "Slope 30° 1 × 1 × ⅔",
      },
      {
        op: "$.parts.light",
        find: "headlight brick",
        ref: "4070.dat",
        name: "Brick 1 × 1 Headlight",
      },
    ]);
    // Mixed colours: both greys appear.
    const colours = new Set(occurrences(a.project!).map((o) => o.colorCode));
    expect(colours.has("71") && colours.has("72")).toBe(true);
  });

  it("assigns sections to layers and enforces part limits", () => {
    const r = compileBuildScript(
      {
        buildScript: 1,
        title: "Layers",
        sections: [
          {
            name: "Walls",
            ops: [
              {
                op: "box",
                at: [0, 0, 0],
                size: [4, 3, 2],
                colour: "red",
                interior: "solid",
              },
            ],
          },
          {
            name: "Roof",
            layer: "Top",
            ops: [{ op: "floor", at: [0, 3, 0], size: [4, 2], colour: "blue" }],
          },
        ],
      },
      { now: () => 0 },
    );
    const names = occurrences(r.project!).map(
      (o) => r.project!.layers[o.layerId].name,
    );
    expect(new Set(names)).toEqual(new Set(["Walls", "Top"]));
  });

  it("reports a build against its part target without refusing it", () => {
    const row = (extra: Record<string, unknown> = {}) =>
      script(
        [
          {
            op: "repeat",
            count: 50,
            step: [1, 0, 0],
            ops: [{ op: "place", part: "3005", at: [0, 0, 0], colour: 4 }],
          },
        ],
        extra,
      );
    const first = (
      options: Parameters<typeof compileBuildScript>[1],
      extra = {},
    ) => compileBuildScript(row(extra), options).report;
    // Far over or under the target: still compiled and accepted, with how
    // far it landed and the ops that made the most parts.
    for (const target of [10, 40, 50, 60, 500]) {
      const r = first({ targetParts: target });
      expect(r.ok, String(target)).toBe(true);
      expect(outsideBudget(r)).toBe(false);
      expect(r.problems.filter((p) => p.severity === "error")).toEqual([]);
      expect(r.target).toEqual(targetMiss(50, target));
    }
    expect(first({ targetParts: 40 }).target).toEqual({
      target: 40,
      parts: 50,
      difference: 10,
      percent: 25,
    });
    expect(first({ targetParts: 40 }).costliestOps).toEqual([
      { op: "sections[0].ops[0].ops[0]", parts: 50 },
    ]);
    expect(first({}).target).toBeUndefined();
    // The script's own limit is the one hard cap.
    const capped = first({ targetParts: 50 }, { limits: { maxParts: 45 } });
    expect(capped.ok).toBe(false);
    expect(outsideBudget(capped)).toBe(true);
    expect(capped.problems[0]).toMatchObject({
      severity: "error",
      code: "over-budget",
      ops: ["sections[0].ops[0].ops[0]"],
    });
    expect(capped.problems[0].message).toMatch(
      /^50 parts: 5 over the script's limit of 45 \(largest sections: Main 50; costliest ops: sections\[0\]\.ops\[0\]\.ops\[0\] 50\)$/,
    );
    expect(() => first({ targetParts: 0 })).toThrow(/positive integer/);
  });

  it("states a count against its target", () => {
    expect(targetText(2137, 2000)).toBe(
      "2,137 parts (target 2,000: +137, +6.9%)",
    );
    expect(targetText(1900, 2000)).toBe(
      "1,900 parts (target 2,000: −100, −5%)",
    );
    expect(targetText(2000, 2000)).toBe("2,000 parts (target 2,000: ±0, ±0%)");
    expect(targetText(12)).toBe("12 parts");
    expect(targetMiss(1994, 2000)).toEqual({
      target: 2000,
      parts: 1994,
      difference: -6,
      percent: -0.3,
    });
  });

  it("groups alike overlaps and says where they are", () => {
    const { report } = compileBuildScript(
      script([
        {
          op: "repeat",
          count: 3,
          step: [2, 0, 0],
          ops: [{ op: "place", part: "3001", at: [0, 0, 0], colour: "red" }],
        },
        {
          op: "repeat",
          count: 3,
          step: [2, 0, 0],
          ops: [{ op: "place", part: "3001", at: [1, 0, 0], colour: "blue" }],
        },
      ]),
    );
    const overlaps = report.problems.filter((p) => p.code === "overlap");
    expect(report.check!.overlaps).toBeGreaterThan(overlaps.length);
    // Where the script put each part and which repeat copies collide.
    expect(overlaps[0].message).toMatch(
      /^3001 Brick 2 × 4 placed at \[\d+, 0, 0\] \(repeat copy \d\/3\) and 3001 Brick 2 × 4 placed at \[\d+, 0, 0\] \(repeat copy \d\/3\) overlap where their bodies meet: x [\d.]+–[\d.]+, y 0–3, z 0–2 \(\d+ pairs like this; repeat copies \d\/3 with \d\/3, /,
    );
  });

  it("closes a fence round a square without a doubled corner", () => {
    // The fourth temple run's medium reply: a balcony rail round 10 × 10.
    const { report } = compileBuildScript(
      script([
        {
          op: "fence",
          path: [
            [0, 0],
            [9, 0],
            [9, 9],
            [0, 9],
            [0, 0],
          ],
          colour: "white",
          style: "lattice",
        },
      ]),
    );
    expect(report.problems.filter((p) => p.code === "overlap")).toEqual([]);
    expect(report.check!.overlaps).toBe(0);
  });

  it("says where an irregular part's body reaches past its footprint", () => {
    // Bamboo is listed as 1 × 1, but its leaves reach 1–1.5 studs further.
    const { report } = compileBuildScript(
      script([
        { op: "place", part: "30176", at: [6, 0, 6], colour: "green" },
        { op: "place", part: "3005", at: [6, 0, 8], colour: "red" },
      ]),
    );
    const [overlap] = report.problems.filter((p) => p.code === "overlap");
    expect(overlap.message).toBe(
      "30176 Plant 1 × 1 Bamboo placed at [6, 0, 6] (its body reaches x 5–8, z 4.5–8.5, past its footprint) and 3005 Brick 1 × 1 placed at [6, 0, 8] overlap where their bodies meet: x 6–7, y 0–3, z 8–8.5",
    );
    expect(overreach("30176.dat")).toEqual({
      "-x": 1,
      "+x": 1,
      "-z": 1.5,
      "+z": 1.5,
    });
    expect(overreach("3005.dat")).toEqual({});
    expect(placementText("30176.dat")).toBe(
      "1×1 studs (x×z), 3 plates; its body reaches past that: 1 stud at −x, +x; 1.5 studs at −z, +z",
    );
  });

  it("names the rejected value in schema errors", () => {
    expect(() =>
      compileBuildScript(
        script([
          {
            op: "box",
            at: [0.5, 0, 0],
            size: [2, 3, 2],
            colour: "red",
            open: ["bottom"],
          },
        ]),
      ),
    ).toThrow(
      /\(got \[0\.5,0,0\]\).*\(got "bottom"\)|\(got "bottom"\).*\(got \[0\.5,0,0\]\)/,
    );
  });

  it("builds an old part number with the part it moved to", () => {
    const { report, project } = compileBuildScript(
      script([
        { op: "baseplate", at: [0, 0], size: [16, 16], colour: "green" },
        { op: "place", part: "4073", at: [1, 0, 1], colour: "red" },
        { op: "place", part: { find: "4073" }, at: [3, 0, 1], colour: "red" },
      ]),
    );
    expect(
      occurrences(project!).filter((o) => o.node.ref === "6141.dat"),
    ).toHaveLength(2);
    expect(report.problems).toContainEqual(
      expect.objectContaining({
        severity: "info",
        code: "part-moved",
        message: "4073 is an old number: built with 6141 (Round Plate 1 × 1)",
      }),
    );
    expect(report.ok).toBe(true);
  });

  it("counts every component instance against the target and the limit", () => {
    const huts = (count: number) =>
      script(
        [
          { op: "baseplate", at: [0, 0], size: [32, 32], colour: "green" },
          ...Array.from({ length: count }, (_, i) => ({
            op: "instance",
            component: "hut",
            at: [1 + 6 * i, 0, 1],
          })),
        ],
        {
          components: {
            hut: {
              ops: [
                {
                  op: "box",
                  at: [0, 0, 0],
                  size: [4, 6, 2],
                  colour: "white",
                  interior: "solid",
                },
              ],
            },
          },
        },
      );
    const one = compileBuildScript(huts(1)).report.stats.parts;
    const four = compileBuildScript(huts(4), { targetParts: one * 2 }).report;
    expect(four.stats.parts).toBe(1 + 4 * (one - 1));
    expect(four.target!.difference).toBe(four.stats.parts - one * 2);
    // Each instance op is charged with every part of its copy.
    expect(four.costliestOps).toContainEqual({
      op: "sections[0].ops[1]",
      parts: one - 1,
    });
    const capped = compileBuildScript({
      ...huts(4),
      limits: { maxParts: one * 2 },
    }).report;
    const over = capped.problems.find((p) => p.code === "over-budget")!;
    expect(over.message).toContain(
      `${four.stats.parts - one * 2} over the script's limit of ${one * 2}`,
    );
    // Named by the instance op, which made every copy.
    expect(over.ops).toContain("sections[0].ops[1]");
  });
});

describe("example build scripts", () => {
  for (const name of ["house", "castle", "santorini", "townhouse"])
    it(`${name} compiles without problems`, () => {
      const s = JSON.parse(
        readFileSync(`fixtures/build-scripts/${name}.json`, "utf8"),
      );
      const { report } = compileBuildScript(s);
      expect(report.problems.filter((p) => p.severity !== "info")).toEqual([]);
      expect(report.check).toMatchObject({
        overlaps: 0,
        offGrid: 0,
        groups: 1,
      });
      if (name === "santorini")
        expect(report.stats.parts).toBeGreaterThan(3000);
    }, 60000);

  it("the system prompt's example compiles cleanly", () => {
    const text = readFileSync("prompts/build-agent.md", "utf8");
    const blocks = [...text.matchAll(/```json\n([\s\S]*?)```/g)].map(
      (m) => m[1],
    );
    const { report } = compileBuildScript(JSON.parse(blocks.at(-1)!));
    expect(report.problems.filter((p) => p.severity !== "info")).toEqual([]);
    expect(report.check?.groups).toBe(1);
  });
});
