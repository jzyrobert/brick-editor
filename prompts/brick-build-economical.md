# brick.build reply format

Reply format for the text-only economical construction experiment.

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

Write a function for anything built more than once (a repeated assembly or connection), loop over its copies, and compute counts and coordinates from a few constants so sizes stay consistent. Every coordinate must still be a whole number: `Math.round` what you divide.

## Example

This small example demonstrates syntax and coordinate reasoning only. It is not a suggested subject, palette, support footprint or way to spend the target.

```js
script({ title: "Syntax example" });
const moduleWidth = 2;
component("module", {
  size: [moduleWidth, 2],
  ops: [
    box({ at: [0, 0, 0], size: [moduleWidth, 3, 2], colour: "white" }),
    floor({
      at: [0, 3, 0],
      size: [moduleWidth, 2],
      colour: "white",
      top: "tile",
    }),
  ],
});
section("Assemblies", [
  range(2).map((i) =>
    instance({ component: "module", at: [i * (moduleWidth + 2), 0, 0] }),
  ),
]);
```
