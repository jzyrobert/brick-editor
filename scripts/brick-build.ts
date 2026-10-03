// brick.build: build scripts written as JavaScript, after MineBench's
// `voxel.exec`. The model replies {"tool": "brick.build", "input": {"code"}};
// the code runs once in a Node `vm` context with a time and op limit and
// calls one helper per op (`room({...})`, `roof({...})`, `place({...})`…),
// `section`, `component` and `script`, which produce an ordinary build
// script for the compiler. Every op remembers the code line that made it, so
// compile problems can name the line.
//
// The helpers are defined inside the context and only a JSON string comes
// out, so no host object is reachable from the code. `vm` is still not a
// security boundary: run it in a child process (brick-cli does) and only on
// code you would run anyway. Node only: never bundled for the browser (the
// app's CSP has no `unsafe-eval`). docs/AGENT-BUILDING.md#brickbuild
import { Script, createContext } from "node:vm";
import { BUILD_SCRIPT_VERSION, OPS } from "../src/build-script/spec";

export const BRICK_BUILD = "brick.build";

export type BrickBuildCall = {
  tool: typeof BRICK_BUILD;
  input: { code: string; seed?: number };
};

export function isBrickBuild(v: unknown): v is BrickBuildCall {
  const o = v as BrickBuildCall | undefined;
  return (
    !!o &&
    typeof o === "object" &&
    o.tool === BRICK_BUILD &&
    typeof o.input?.code === "string"
  );
}

export class BrickBuildError extends Error {
  constructor(
    message: string,
    readonly line?: number,
  ) {
    super(line ? `${message} (code line ${line})` : message);
  }
}

const FILE = "brick.build.js";
export const BRICK_BUILD_LIMITS = {
  timeoutMs: 10_000,
  maxOps: 50_000,
  codeBytes: 200_000,
};

// Runs inside the context. __OPS and __LIMIT are set before it; the result
// is read back with __result() as a JSON string.
const PRELUDE = `
"use strict";
(() => {
  const FILE = ${JSON.stringify(FILE)};
  const lineOf = new WeakMap();
  const header = {};
  const sections = [];
  const components = {};
  let made = 0;
  class BrickBuildError extends Error {}
  const fail = (message, line) => {
    const e = new BrickBuildError(message);
    e.brickLine = line;
    throw e;
  };
  const callerLine = (stack) => {
    for (const l of String(stack || "").split("\\n").slice(1)) {
      const at = l.indexOf(FILE + ":");
      if (at >= 0) return parseInt(l.slice(at + FILE.length + 1), 10) || undefined;
    }
    return undefined;
  };
  const here = () => callerLine(new Error().stack);
  const opList = (v, where) => {
    if (v === undefined) return [];
    if (!Array.isArray(v)) fail(where + " must be an array of ops", here());
    return v.flat(Infinity).filter((x) => x !== null && x !== false && x !== undefined);
  };
  // Mulberry32: seeded, so a run repeats exactly.
  let seed = __SEED >>> 0;
  const rng = () => {
    seed = (seed + 0x6d2b79f5) >>> 0;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  Math.random = rng;
  const g = globalThis;
  g.rng = rng;
  g.range = (a, b, step = 1) => {
    const [from, to] = b === undefined ? [0, a] : [a, b];
    if (!(step > 0) && !(step < 0)) fail("range() needs a non-zero step", here());
    const out = [];
    for (let i = from; step > 0 ? i < to : i > to; i += step) {
      out.push(i);
      if (out.length > __LIMIT) fail("range() is longer than " + __LIMIT, here());
    }
    return out;
  };
  g.script = (fields) => {
    if (!fields || typeof fields !== "object") fail("script() takes an object", here());
    if (fields.sections || fields.components)
      fail("script() takes title, description, palette, parts, defaults; add sections with section() and components with component()", here());
    Object.assign(header, fields);
  };
  g.section = (name, ops, extra) => {
    if (typeof name !== "string") fail("section(name, ops) needs a name", here());
    const s = { name, ops: opList(ops, 'section("' + name + '")') };
    if (extra && extra.layer) s.layer = extra.layer;
    sections.push(s);
  };
  g.component = (name, def) => {
    if (typeof name !== "string" || !def || typeof def !== "object")
      fail("component(name, {size, ops}) needs a name and an object", here());
    if (components[name]) fail('component "' + name + '" is defined twice', here());
    components[name] = Object.assign({}, def, { ops: opList(def.ops, 'component("' + name + '")') });
  };
  for (const name of __OPS)
    g[name] = (fields = {}) => {
      if (++made > __LIMIT) fail("more than " + __LIMIT + " ops were made", here());
      if (!fields || typeof fields !== "object" || Array.isArray(fields))
        fail(name + "() takes one object of fields", here());
      const op = Object.assign({ op: name }, fields);
      if ("ops" in fields) op.ops = opList(fields.ops, name + "().ops");
      // Conditional openings and holes ({...cond && {...}}) drop out too.
      for (const key of ["openings", "holes"])
        if (Array.isArray(fields[key]))
          op[key] = fields[key].filter((x) => x !== null && x !== false && x !== undefined);
      const line = here();
      if (line) lineOf.set(op, line);
      return op;
    };
  g.__result = () => {
    const lines = {};
    const walk = (ops, path) =>
      ops.forEach((op, i) => {
        const p = path + "[" + i + "]";
        const line = op && typeof op === "object" ? lineOf.get(op) : undefined;
        if (line) lines[p] = line;
        if (op && Array.isArray(op.ops)) walk(op.ops, p + ".ops");
      });
    sections.forEach((s, i) => walk(s.ops, "sections[" + i + "].ops"));
    for (const name of Object.keys(components))
      walk(components[name].ops, "components." + name + ".ops");
    return JSON.stringify({ header, sections, components, lines });
  };
})();
`;

/**
 * Runs brick.build code and returns the build script it describes, with the
 * code line of every op by its path (`sections[1].ops[4]`,
 * `components.tower.ops[1].ops[0]`). Throws BrickBuildError, with the line
 * where it can tell.
 */
export function runBrickBuild(
  code: string,
  {
    seed = 1,
    ...limits
  }: { seed?: number } & Partial<typeof BRICK_BUILD_LIMITS> = {},
) {
  const { timeoutMs, maxOps, codeBytes } = { ...BRICK_BUILD_LIMITS, ...limits };
  if (typeof code !== "string" || !code.trim())
    throw new BrickBuildError("input.code is empty");
  if (Buffer.byteLength(code) > codeBytes)
    throw new BrickBuildError(`The code is over ${codeBytes} bytes`);
  const context = createContext(Object.create(null), {
    codeGeneration: { strings: false, wasm: false },
  });
  const opNames = JSON.stringify(Object.keys(OPS));
  new Script(
    `const __OPS = ${opNames}, __LIMIT = ${maxOps}, __SEED = ${Number(seed) | 0};${PRELUDE}`,
  ).runInContext(context);
  try {
    new Script(code, { filename: FILE }).runInContext(context, {
      timeout: timeoutMs,
    });
  } catch (e) {
    const err = e as { message?: string; name?: string; brickLine?: number };
    const timedOut = /timed out/i.test(String(err?.message));
    if (timedOut)
      throw new BrickBuildError(
        `The code ran for more than ${timeoutMs / 1000} s`,
      );
    const line =
      err?.brickLine ??
      (() => {
        const stack = String((e as Error)?.stack ?? "");
        const at = stack.indexOf(`${FILE}:`);
        return at >= 0
          ? parseInt(stack.slice(at + FILE.length + 1), 10) || undefined
          : undefined;
      })();
    throw new BrickBuildError(
      err?.brickLine !== undefined || err?.name === "BrickBuildError"
        ? String(err.message)
        : `${err?.name ?? "Error"}: ${err?.message ?? String(e)}`,
      line,
    );
  }
  const out = JSON.parse(
    new Script("__result()").runInContext(context, { timeout: timeoutMs }),
  ) as {
    header: Record<string, unknown>;
    sections: { name: string; ops: unknown[] }[];
    components: Record<string, unknown>;
    lines: Record<string, number>;
  };
  if (!out.sections.length)
    throw new BrickBuildError(
      "The code made no sections: call section(name, [ops])",
    );
  const script = {
    buildScript: BUILD_SCRIPT_VERSION,
    title: "Untitled",
    ...out.header,
    ...(Object.keys(out.components).length
      ? { components: out.components }
      : {}),
    sections: out.sections,
  };
  return { script, lines: out.lines };
}

/** `sections[1].ops[4] (code line 12)`: an op path with the line that made
 * it; for a nested path (`… > components.house.ops[2]`), the innermost line
 * found. */
export function withLine(path: string, lines: Record<string, number>) {
  const line = path
    .split(" > ")
    .reverse()
    .map((p) => lines[p])
    .find((l) => l !== undefined);
  return line ? `${path} (code line ${line})` : path;
}
