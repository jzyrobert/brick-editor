# brick.build reply format

The one-shot runner (`npm run oneshot`) asks for builds as brick.build code instead of a build script JSON, after MineBench's `voxel.exec`. It swaps the sections below into [build-agent.md](build-agent.md) in place of its `## Output` and `## Example` sections; the rest of that prompt (ops, geometry, counting, parts) still describes the ops the code makes. Code runs in [scripts/brick-build.ts](../scripts/brick-build.ts); `brick-cli build --script build.js` compiles it too.

---

## Output

Reply with ONLY one JSON object (no markdown, no commentary) that calls the brick.build tool:

`{"tool": "brick.build", "input": {"code": "…", "seed": 1}}`

`code` is JavaScript that makes the Build Script: it runs once in a sandbox (no imports, no I/O, 10 seconds, at most 50,000 ops) and the compiler turns what it makes into real bricks. It is a JSON string, so escape its quotes and newlines.

- `script({title, description?, palette?, parts?, defaults?})` sets the script's title, palette (colour keys such as `"wall"`), part aliases (`"@lamp"`) and defaults.
- One function per op, named after it, takes the op's fields as one object and returns the op: `room({at, size, colour, openings})`, `roof({style: "hip", at, size, colour})`, `place({part, at, colour, turn})`, `repeat({count, step, ops: [...]})`, `group({at, turn, ops: [...]})`. The fields are the ones listed under Ops below.
- `section(name, ops)` adds a section; `component(name, {size, ops})` defines a component for `instance({component, at, turn?, palette?, with?})`. Nothing is built until an op is in a section or a component.
- Lists of ops may nest and may hold `null` or `false`, which are skipped: `range(5).map(tier)` and `hasDoor && door({...})` both work; `openings` and `holes` skip `null` and `false` too.
- `range(n)` or `range(from, to, step)`, `rng()` (seeded by `seed`; `Math.random` is the same), and plain JavaScript: `const`, functions, loops, arrays, spread, `Math`.
- Errors name the op and the line of your code that made it: `[sections[1].ops[4] (code line 12)]`.

Write a function for anything built more than once (a pagoda tier, a bay, a lantern), loop over its copies, and compute counts and coordinates from a few constants so sizes stay consistent. Every coordinate must still be a whole number: `Math.round` what you divide.

## Example

```js
script({
  title: "Fisherman's cottage",
  palette: {
    wall: "white",
    roof: "dark red",
    stone: { mix: ["light bluish grey", "dark bluish grey"] },
  },
});

section("Site", [
  baseplate({ at: [-16, -16], size: [32, 32], colour: "green" }),
  floor({
    at: [-16, 0, -16],
    size: [32, 6],
    colour: "trans light blue",
    top: "tile",
  }),
  fence({
    path: [
      [-14, -9],
      [14, -9],
    ],
    colour: "white",
    style: "picket",
  }),
]);

// Two front windows either side of the door.
const window2x9 = (at) => ({
  side: "front",
  at,
  width: 2,
  y: 6,
  height: 9,
  frame: "white",
});

section("Cottage", [
  box({
    at: [-7, 0, -4],
    size: [14, 3, 10],
    colour: "stone",
    texture: "masonry",
    interior: "fill",
  }),
  room({
    at: [-6, 3, -3],
    size: [12, "6b", 8],
    colour: "wall",
    floor: "tan",
    quoins: "light bluish grey",
    openings: [
      {
        side: "front",
        at: 4,
        width: 4,
        height: 18,
        door: "blue",
        opens: "out",
      },
      ...[1, 9].map(window2x9),
    ],
  }),
  roof({
    style: "gable",
    at: [-6, 21, -3],
    size: [12, 8],
    colour: "roof",
    gable: "wall",
    holes: [{ at: [2, 3], size: [2, 2] }],
  }),
  box({
    at: [2, 3, 3],
    size: [2, "11b", 2],
    colour: "stone",
    interior: "solid",
  }),
  place({ part: { find: "fruit tree" }, at: [-14, 0, 6], colour: "green" }),
]);
```
