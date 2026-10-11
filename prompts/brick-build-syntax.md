# Experimental syntax-only reply example

Uses the default output contract verbatim, replacing only the example.

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

This minimal example demonstrates syntax and stacking coordinates only. It is not a suggested subject, scale, palette or composition.

```js
script({ title: "Syntax example" });
section("Example", [
  place({ part: "3003", at: [0, 0, 0], colour: "white" }),
  place({ part: "3022", at: [0, 3, 0], colour: "white" }),
]);
```
