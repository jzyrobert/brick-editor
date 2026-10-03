import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  isBrickBuild,
  runBrickBuild,
  withLine,
} from "../../scripts/brick-build";
import { validateBuildScript } from "../../src/build-script/spec";

/** A fenced block of a prompt file after its heading. */
function block(file: string, heading: string, lang: string) {
  const text = readFileSync(
    new URL(`../../prompts/${file}`, import.meta.url),
    "utf8",
  );
  const at = text.indexOf(`## ${heading}`);
  const start = text.indexOf("```" + lang + "\n", at) + lang.length + 4;
  return text.slice(start, text.indexOf("```", start));
}

describe("brick.build", () => {
  it("recognises the call", () => {
    expect(isBrickBuild({ tool: "brick.build", input: { code: "x" } })).toBe(
      true,
    );
    expect(isBrickBuild({ buildScript: 1, sections: [] })).toBe(false);
    expect(isBrickBuild({ tool: "brick.build", input: {} })).toBe(false);
  });

  it("makes the same script as the JSON example from the code example", () => {
    const code = block("brick-build.md", "Example", "js");
    const json = JSON.parse(block("build-agent.md", "Example", "json"));
    const { script } = runBrickBuild(code);
    expect(script).toEqual(json);
    expect(validateBuildScript(script)).toEqual([]);
  });

  it("builds loops, components and nested op lists, with code lines", () => {
    const { script, lines } = runBrickBuild(
      [
        'script({ title: "Pagoda" });',
        'component("lantern", { size: [2, 2], ops: [',
        '  place({ part: "3941", at: [0, 0, 0], colour: "light bluish grey" }),',
        "] });",
        "const tier = (i) => [",
        '  room({ at: [i, i * 9, i], size: [12 - 2 * i, 6, 12 - 2 * i], colour: "red" }),',
        '  i < 2 && roof({ style: "hip", at: [i, i * 9 + 6, i], size: [12 - 2 * i, 12 - 2 * i], colour: "dark bluish grey" }),',
        "];",
        'section("Pagoda", range(3).map(tier));',
        'section("Lanterns", [repeat({ count: 3, step: [4, 0, 0], ops: [instance({ component: "lantern", at: [0, 0, -6] })] })]);',
      ].join("\n"),
    );
    expect(script.sections[0].ops.map((o) => (o as { op: string }).op)).toEqual(
      ["room", "roof", "room", "roof", "room"],
    );
    expect(lines).toMatchObject({
      "sections[0].ops[0]": 6,
      "sections[0].ops[1]": 7,
      "sections[1].ops[0]": 10,
      "sections[1].ops[0].ops[0]": 10,
      "components.lantern.ops[0]": 3,
    });
    expect(
      withLine("sections[1].ops[0] > components.lantern.ops[0]", lines),
    ).toBe("sections[1].ops[0] > components.lantern.ops[0] (code line 3)");
  });

  it("drops null and false from openings and holes", () => {
    const { script } = runBrickBuild(
      'section("a", [room({ at: [0, 0, 0], size: [8, 9, 6], colour: "white", openings: [false && { side: "front", at: 1, width: 2 }, { side: "back", at: 2, width: 2, y: 3, height: 6 }] }), floor({ at: [0, 9, 0], size: [8, 6], colour: "tan", holes: [null, { at: [2, 2], size: [2, 2] }] })]);',
    );
    const [room, floor] = script.sections[0].ops as {
      openings?: unknown[];
      holes?: unknown[];
    }[];
    expect(room.openings).toHaveLength(1);
    expect(floor.holes).toHaveLength(1);
  });

  it("repeats exactly for a seed", () => {
    const code =
      'section("s", range(5).map((i) => place({ part: "3005", at: [Math.floor(rng() * 100), 0, Math.floor(Math.random() * 100)], colour: "red" })));';
    const at = (seed: number) =>
      JSON.stringify(runBrickBuild(code, { seed }).script);
    expect(at(7)).toBe(at(7));
    expect(at(7)).not.toBe(at(8));
  });

  it("names the line of errors and stops runaway or escaping code", () => {
    const fails = (code: string) => {
      try {
        runBrickBuild(code, { timeoutMs: 300 });
      } catch (e) {
        return (e as Error).message;
      }
      return "no error";
    };
    expect(fails('section("a", []);\nfoo.bar;')).toBe(
      "ReferenceError: foo is not defined (code line 2)",
    );
    expect(fails('section("a", [\n  box([1, 2])]);')).toBe(
      "box() takes one object of fields (code line 2)",
    );
    expect(fails("while (true) {}")).toBe("The code ran for more than 0.3 s");
    expect(fails("const x = 1;")).toMatch(/made no sections/);
    // No host objects: the Function constructor of a helper is the context's,
    // and the context cannot compile strings.
    expect(fails("section.constructor('return process')()")).toMatch(
      /Code generation from strings disallowed/,
    );
    expect(fails("this.constructor.constructor('return process')()")).toMatch(
      /Code generation from strings disallowed/,
    );
    expect(
      fails(
        "typeof require === 'undefined' && typeof process === 'undefined' ? section('a', []) : null; throw new Error(String(typeof process))",
      ),
    ).toBe("Error: undefined (code line 1)");
  });
});
