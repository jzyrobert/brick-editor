/**
 * Surface look of build-script massing, from the design-language study of
 * official sets (docs/DESIGN-LANGUAGE.md): textured bricks, colour by
 * course, interlocking quoins and support piers under wide hollow lids.
 */
import { beforeAll, describe, expect, it } from "vitest";
import { validateBuildScript } from "../../src/build-script/spec";
import { compileBuildScript } from "../../src/build-script/compile";
import { madeIn } from "../../src/catalog/color-availability";
import { catalog } from "../../src/catalog/catalog";
import { occurrences } from "../../src/core/document";
import { registerFullLibraryFromDisk } from "../../scripts/full-library-node";
import { registerAgentData } from "../../scripts/build-script-cli";

beforeAll(() => {
  expect(registerFullLibraryFromDisk()).toBe(true);
  registerAgentData();
});

const script = (ops: unknown[], extra: Record<string, unknown> = {}) => ({
  buildScript: 1,
  title: "Look",
  ...extra,
  sections: [{ name: "Main", ops }],
});
/** Parts of a compiled script: ref, colour, plate level of the underside,
 * stud cell of the origin and whether the part is turned. */
function compile(s: unknown) {
  const r = compileBuildScript(s, { now: () => 0 });
  const list = occurrences(r.project!).map((o) => ({
    ref: o.node.ref,
    colour: o.colorCode,
    y: Math.round(
      (-o.transform.position[1] - (catalog[o.node.ref]?.height ?? 24)) / 8,
    ),
    x: o.transform.position[0] / 20,
    z: o.transform.position[2] / 20,
    turned: Math.abs(o.transform.basis[0]) < 0.5,
  }));
  return { ...r, list };
}
const clean = (r: ReturnType<typeof compile>) => {
  expect(r.report.problems.filter((p) => p.severity === "error")).toEqual([]);
  expect(r.report.check).toMatchObject({ overlaps: 0, offGrid: 0, groups: 1 });
};

describe("build script surface look", () => {
  it("lays textured bricks (masonry, log, grille) and plain 1 × 1s", () => {
    for (const [texture, ref] of [
      ["masonry", "98283.dat"],
      ["log", "30136.dat"],
      ["grille", "2877.dat"],
    ]) {
      const r = compile(
        script([
          {
            op: "wall",
            from: [0, 0],
            to: [12, 0],
            height: "5b",
            colour: "light bluish grey",
            texture,
          },
        ]),
      );
      clean(r);
      const bricks = r.list.filter((p) => p.ref !== "3005.dat");
      expect(bricks.length, texture).toBeGreaterThan(20);
      expect(new Set(bricks.map((p) => p.ref)), texture).toEqual(
        new Set([ref]),
      );
    }
    // Validated as an enum.
    expect(
      validateBuildScript(
        script([
          {
            op: "wall",
            from: [0, 0],
            to: [3, 0],
            height: 3,
            colour: "red",
            texture: "marble",
          },
        ]),
      ).map((i) => i.path),
    ).toContain("$.sections[0].ops[0].texture");
  });

  it("falls back to plain bricks, with a warning, where the texture is not made in the colour", () => {
    const colour = ["22", "26", "27", "29", "31", "30", "322", "323"].find(
      (c) => !madeIn("98283.dat", c) && madeIn("3004.dat", c),
    )!;
    expect(colour).toBeDefined();
    const r = compile(
      script([
        {
          op: "room",
          at: [0, 0, 0],
          size: [8, "3b", 6],
          colour,
          texture: "masonry",
        },
      ]),
    );
    clean(r);
    expect(r.list.some((p) => p.ref === "98283.dat")).toBe(false);
    const warning = r.report.problems.find(
      (p) => p.code === "texture-unavailable",
    );
    expect(warning?.ops).toEqual(["sections[0].ops[0]"]);
  });

  it("lays a mix course by course with pattern: courses", () => {
    const r = compile(
      script(
        [
          {
            op: "box",
            at: [0, 0, 0],
            size: [6, "6b", 6],
            colour: "stripes",
            pattern: "courses",
          },
        ],
        { palette: { stripes: { mix: ["red", "red", "white"] } } },
      ),
    );
    clean(r);
    const bricks = r.list.filter((p) => p.y < 16);
    expect(bricks.length).toBeGreaterThan(0);
    for (const p of bricks)
      expect(p.colour, `course at ${p.y}`).toBe(
        Math.floor(p.y / 3) % 3 === 2 ? "15" : "4",
      );
    // Without the pattern the mix is per piece, not per course.
    const mixed = compile(
      script(
        [
          {
            op: "box",
            at: [0, 0, 0],
            size: [6, "6b", 6],
            colour: "stripes",
          },
        ],
        { palette: { stripes: { mix: ["red", "red", "white"] } } },
      ),
    );
    const byCourse = new Map<number, Set<string>>();
    for (const p of mixed.list)
      byCourse.set(p.y, (byCourse.get(p.y) ?? new Set()).add(p.colour));
    expect([...byCourse.values()].some((s) => s.size > 1)).toBe(true);
  });

  it("interlocks quoins at the corners, alternating course by course", () => {
    const r = compile(
      script([
        {
          op: "room",
          at: [0, 0, 0],
          size: [10, "4b", 8],
          colour: "tan",
          quoins: "light bluish grey",
        },
      ]),
    );
    clean(r);
    const quoins = r.list.filter((p) => p.colour === "71");
    // Four corners, one 1 × 2 block each per brick course.
    expect(quoins.length).toBe(16);
    for (const q of quoins) {
      expect(q.ref).toBe("3004.dat");
      // Even courses run along X (the front and back faces), odd along Z.
      expect(q.turned, `course ${q.y}`).toBe(Math.floor(q.y / 3) % 2 === 1);
    }
    expect(r.list.some((p) => p.colour === "19")).toBe(true);
  });

  it("carries a wide hollow lid on support piers", () => {
    const box = (extra: Record<string, unknown>) =>
      compile(
        script([
          {
            op: "box",
            at: [0, 0, 0],
            size: [20, "3b", 16],
            colour: "dark bluish grey",
            ...extra,
          },
        ]),
      );
    const inside = (r: ReturnType<typeof compile>) =>
      r.list.filter(
        (p) => p.x > 1.5 && p.x < 18.5 && p.z > 1.5 && p.z < 14.5 && p.y < 7,
      );
    const plain = box({});
    expect(inside(plain)).toEqual([]);
    const piers = box({ supports: 6 });
    clean(piers);
    // Piers at core offsets 4-5 and 10-11 in x, 4-5 and 10-11 in z.
    expect(inside(piers).length).toBeGreaterThanOrEqual(4);
    expect(piers.list.length).toBeGreaterThan(plain.list.length);
    expect(() => box({ supports: 3 })).toThrow(/at least 4/);
  });
});
