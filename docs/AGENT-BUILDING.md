# Building with agents: Build Scripts

A **build script** is a small JSON program that compiles into real LDraw parts. An agent (or a person) describes _what_ to build — walls with doors and windows, floors, roofs, towers, domes, stairs, repeated houses — and the compiler chooses and places the bricks: largest pieces first, joints staggered course to course, only piece sizes that exist in the chosen colour. Every compile is checked for overlapping parts, off-grid parts and floating (unconnected) parts, and the report names the op that caused each problem, so an agent can fix its script and compile again.

The ready-to-paste system prompt is [prompts/build-agent.md](../prompts/build-agent.md). The JSON Schema is [schemas/buildScript.v1.json](../schemas/buildScript.v1.json); `npm run cli -- build --reference` prints the op reference.

Why this shape: [MineBench](https://github.com/Ammaar-Alam/minebench) — an LLM benchmark of large voxel builds — gets builds of thousands to millions of blocks out of models by having them emit a few high-level primitives (boxes, lines, a JavaScript loop) instead of block-by-block lists, inside a bounded grid with a fixed palette, after planning the silhouette; judges then compare the builds from every camera angle. A build script is the brick version of that: boxes and walls instead of bricks, repeat/mirror/components instead of copy-paste, palettes instead of colour codes, and a report plus rendered views instead of guessing. A 5 KB script compiles to 4,000+ parts ([Santorini example](#worked-examples)).

## Quick start

```sh
# Compile, check and write an LDraw file (and a report next to it)
npm run cli -- build --script fixtures/build-scripts/house.json --output house.mpd
# … plus rendered review views (iso, front, back, left, right, top, iso-back)
npm run cli -- build --script house.json --output house.mpd \
  --render views/house.png --views iso,front,iso-back
# Find parts without knowing their numbers
npm run cli -- parts search "cheese slope" --colour red --available
npm run cli -- parts search --size 1x2 --category Tiles
```

In a browser with `?automation=1`:

```js
const api = window.brickEditor;
const check = await api.buildScript.validate(script); // {valid, issues}
const { report } = await api.buildScript.compile({ script }); // no change
const applied = await api.buildScript.apply({ script }); // replaces the project
const { results } = await api.parts.search({
  query: "1x2 tile",
  colour: "white",
});
```

In the app: **Project → Open file** accepts a build script (`.json`).

## Coordinates

- **x** and **z** are in **studs**; **y** is in **plates** (a brick is 3 plates). Any height may be written `"4b"` (4 bricks = 12 plates).
- **y = 0 is the ground** (the top of a baseplate). A part's `y` is the level its underside rests on.
- **The front faces −Z.** `facing: "front"` is −Z, `"back"` +Z, `"left"` −X, `"right"` +X.
- `at` is always the **minimum corner** (smallest x, y, z) of what an op fills; `size` is `[w, h, d]` (studs, plates, studs) or `[w, d]` for flat things.
- A 32 × 32 baseplate at `[-16, -16]` covers x −16…15 and z −16…15. The compiler emits LDraw units (1 stud = 20 LDU, 1 plate = 8 LDU, −Y up); you never need them.

## Script shape

```json
{
  "buildScript": 1,
  "title": "Harbour cottage",
  "palette": {
    "wall": "white",
    "roof": "dark red",
    "stone": { "mix": ["light bluish grey", "dark bluish grey"] }
  },
  "parts": { "lamp": { "find": "lamp post" } },
  "defaults": { "interior": "empty" },
  "components": { "kiosk": { "ops": [] } },
  "sections": [
    { "name": "Ground", "layer": "Landscape", "ops": [] },
    { "name": "Cottage", "ops": [] }
  ]
}
```

Each **section** becomes an LDraw submodel and a layer (`layer` groups several sections). Each **component** becomes one submodel placed by `instance` ops. Ops run in order.

## Ops

**Massing** — volumes that the compiler packs into bricks, plates and tiles:

| op         | what                                           | key fields                                                                      |
| ---------- | ---------------------------------------------- | ------------------------------------------------------------------------------- |
| `box`      | rectangular volume                             | `at [x,y,z]`, `size [w,h,d]`, `colour`, `interior`, `open`, `top`               |
| `wall`     | straight wall along X or Z, running bond       | `from [x,z]`, `to [x,z]`, `height`, `y`, `thickness` 1\|2, `facing`, `openings` |
| `room`     | four 1-stud walls, interlocking corners        | `at`, `size [w,h,d]`, `openings` (each with `side`), `floor`                    |
| `floor`    | plate/tile area: floors, paving, water         | `at`, `size [w,d]`, `layers`, `holes`, `top: "tile"`                            |
| `cylinder` | round massing (towers, tanks)                  | `at` (bounding square corner), `diameter`, `height`, `interior`                 |
| `dome`     | hemisphere shell (cupolas, Santorini domes)    | `at`, `diameter`                                                                |
| `stairs`   | flight of steps; `rise: 1` is walkable in Play | `at` (first step), `width`, `steps`, `dir` ±x\|±z, `rise`, `run`                |
| `line`     | 1-stud line between two cells (posts, beams)   | `from [x,y,z]`, `to [x,y,z]`                                                    |
| `carve`    | remove massing (later ops can refill)          | `at`, `size`                                                                    |

**Parts** — real components; they reserve their cells and **carve any massing there** (parts win):

| op          | what                                                   | key fields                                                                                                     |
| ----------- | ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| `window`    | frame + glass (1x2x2, 1x2x3, 1x4x3)                    | `at`, `facing`, `size`, `frame`, `glass`                                                                       |
| `door`      | 1x4x6 frame + hinged door (Play opens it)              | `at`, `facing`, `frame`, `colour`, `opens` in\|out                                                             |
| `roof`      | 45° `gable`, `hip` or `shed` (lean-to) slopes, `flat`  | `at` (y = wall top), `size [w,d]`, `ridge`, `overhang`, `ends`, `pitch`, `facing`, `gable`, `holes`, `parapet` |
| `place`     | any part                                               | `part`, `at`, `colour`, `turn`, `anchor`, `wheels`                                                             |
| `column`    | round bricks 1/2/4 studs across, cap cone/plate/tile   | `at`, `height`, `diameter`, `cap`                                                                              |
| `fence`     | fence/railing along a path, corners allowed            | `path [[x,z]...]`, `y`, `style` picket\|lattice\|lattice-low\|spindle\|panel                                   |
| `baseplate` | 16/32/48-stud baseplates tiled over an area, top y = 0 | `at [x,z]`, `size` (multiples of 16)                                                                           |
| `instance`  | a component (real submodel)                            | `component`, `at` (plot corner), `turn`, `palette`, `with`                                                     |
| `track`     | official train track, piece by piece (Play runs it)    | `at [x,y,z]` (grid point), `dir` ±x\|±z, `pieces` "SSLL…", `branch`, `colour`                                  |
| `railcar`   | a train car on the track: base, bogies, a body         | `at [x,y,z]` (car centre on the track), `dir`, `component`, `palette`, `with`                                  |

**Structure** — `repeat {count, step [dx,dy,dz], ops}`, `mirror {axis x|z, about, ops, keep}` (cell `x` maps to `2·about − 1 − x`; windows, slopes, shed roofs and left/right parts mirror correctly), `group {at, turn, ops}` (a local frame; `turn: 90` turns local front to face left).

**Components** (`components.name = {title, size, ops}`) compile once per variant into a real submodel:

- `size: [w, d]` is the component's plot, from `[0, 0]` in its own frame. `instance.at` places that rectangle, so an awning, bay window or ledge sticking out in front does not shift the building (without `size` the corner of everything it holds is placed — a 2-stud awning then moves the whole house back 2 studs).
- `instance.palette: {"wall": "sand blue", "roof": "dark red"}` recolours palette keys for one copy: one "house" component makes a street of houses in different colours (each colour set is its own submodel).
- `instance.with: ["left"]` sets flags: any op in the component with `"when": "left"` runs only in copies placed with that flag, `"when": "!left"` only without it. A corner house then has windows on whichever side is open, a tall variant an extra storey.

**Roof options** — `ends: 0` keeps the ridge ends flush (houses in a terrace, where an overhang would run into the neighbour; `overhang` stays on the eaves). `style: "shed"` is one slope, low along `facing`, high against a taller wall (aisles, lean-tos, porches); `mirror` flips it. `style: "hip", pitch: 75` makes a steep spire of 75° slopes (`4460b`, `3684a`, corners `3685`), a stud in per three bricks with a cone on top. Slope lengths that are not made in the roof's colour are left out (a sand green roof uses 2 × 4 and 2 × 2 slopes, not the 2 × 3).

**Parts options** — `place {..., anchor: "origin"}` puts the part's own origin on a grid point `[x, z]` at plate level `y`, for parts made to fit together round a shared origin (sails on a mast, a hull and its deck); it is not snapped to the stud grid. `place {part: "4600", wheels: "light bluish grey"}` adds two wheels (rims in that colour, black tyres) to a Plate 2 × 2 with Wheel Holders; with its underside 2 plates up they clear the ground by 1 LDU. A group of parts on such plates is a parked car: the checks set it aside like a train on its wheels.

**Trains** — `track {at, dir, pieces}` lays official plastic track (Straight 53401, Curve 53400; 9V points 75542/75541 with `W`/`V`) from a grid point, sleepers on level `y`: `"SSSS LLLLLLLL SSSS LLLLLLLL"` is an oval 64 + 80 studs long and 80 across, `branch` continues from the last points. The track holds the cells under its sleepers (massing is carved, parts on it are reported). `railcar {at, dir, component}` stands a Train Base 6 × 24 on two bogies with its centre on the track's centreline and the component on its deck (the component's frame: 24 long along +x with the front at x = 23, 6 wide, y = 0 the deck). Cars 26 studs apart are coupled; a car with a train front (2924bc01) leads. Play derives the train and runs it ([trains](PLAY-TRAINS.md)).

**Detail pass** — after everything else: `scatter {region, parts, colours, density, spacing, seed}` drops flowers/plants/props on exposed studded tops; `smooth {region}` turns exposed tops into tiles.

**Openings** in `wall`/`room`: `{side, at, width, y, height, fill}` — `at` counts studs from the wall's start (min x for front/back, min z for left/right), `y`/`height` in plates from the wall base. `fill: "auto"` (default) puts in a window when the opening is exactly 2×6, 2×9 or 4×9 (width × plates), a door when it is 4×18, and leaves anything else open. In a `room` with a `floor`, a door that opens inwards stands on the floor (`y` 1) so its leaf swings over the floor plate: leave the wall 19 plates or taller above it. The door leaf is the smooth door (60616a) unless that is not made in the colour (red, dark blue, dark green, …): then it is the door with panes (60623).

**Colours**: a palette key, a colour name (`"light bluish grey"`, `"dark tan"`, `"trans-clear"`, `"medium azure"` — BrickLink/LDraw names work) or an LDraw code. `{"mix": [...]}` picks per piece, deterministically — good for stone and rock. The compiler only uses brick/plate sizes that exist in the colour and warns (`colour-unavailable`) when a placed part is not known in it.

**Parts**: `"3001"`, `"3001.dat"`, `"@alias"` (from `parts`), `{"find": "1x2 tile"}` or just a phrase (`"window 1x2x3 with glass"`). Searches resolve deterministically at compile time and are listed in the report under `resolved`. Part search also answers `"pointed arch"`, `"spire"`, `"sail"`, `"clock"`, `"train base"`, `"bogie"`, `"train front"` and `"track"`, and "corner" matches "convex" (`"slope 75 corner"` finds the spire corner 3685). Check which way a library part faces before relying on `turn`: the Arch 1 × 3 × 3 Pointed (13965) runs along Z at `turn: 0`, the arches 1 × 4/1 × 6 (6182, 3307, 6183) along X.

## Unseen sections: interior fill

`box` and `cylinder` (and `defaults.interior` for the whole script) decide what happens inside volumes nobody will see:

- `"empty"` (default): a **hollow shell** — walls `thickness` studs thick and a two-plate roof of plates that spans the walls (so it holds together). Cheapest; use for cliffs, terraces, building cores, rock.
- `"fill"`: solid, the inside packed with the largest bricks in `defaults.interiorColour` (light bluish grey). Use when the inside may show through gaps.
- `"solid"`: solid in the op's own colour.
- `open: ["top", "front", ...]` leaves shell faces out (for rooms you look into).

On the Santorini example, switching the terraces from `fill` to `empty` removed ~2,100 parts without changing the view.

## Part cheat sheet

Curated parts (snap and count for connectivity). `npm run cli -- parts search "<words>"` finds anything else in the complete LDraw library.

| role             | parts                                                                                                                                                                                                            |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| walls            | massing (`wall`/`room`/`box`) — bricks 1×1…1×16, 2×2…2×10 chosen for you; masonry `98283`, log `30136`, grille `2877`                                                                                            |
| floors & paving  | `floor` — plates up to 8×16, tiles 1×1…2×4 with `top: "tile"`; baseplates `3867` 16², `3811` 32², `4186` 48²                                                                                                     |
| roofs            | `roof` op; slopes 45° `3040b` `3039` `3038` `3037`, ridge `3043`, hip corner `3045`, valley `3046`, 33° `3298` `4161`                                                                                            |
| windows & doors  | `window` (1x2x2 `60592`, 1x2x3 `60593`, 1x4x3 `60594` + glass), `door` (`60596` + `60616a`), shutters `60608`, arches `3659` `6182` `3307` `2339`                                                                |
| columns & towers | `column` (round bricks `3062b` `3941` `87081`, cones `4589` `3942c` `3943b`), `cylinder` for big towers, pillar `2453b`                                                                                          |
| detailing        | cheese slope `54200`, tiles `3070b` `3069b`, grille tile `2412b`, jumper `3794b`, SNOT `87087` `4070` `11211`, brackets `99781` `44728`, fences `33303` `3185` `3633`                                            |
| landscape        | trees `3470` `3471` `2435`, bush `6255`, leaves `2423`, flowers `24866` `33291`, water: `floor` in trans light blue/trans dark blue with `top: "tile"`, or a blue baseplate (`4186` and `3811` are made in blue) |
| vehicles         | wheel holder plate `4600` (`wheels`), mudguard `3788`, windscreen `3823`, seat `4079`, steering `3829c01`; train front `2924bc01`, windows `4033c01` `4035c01`                                                   |
| gothic           | pointed arch `13965` over a 1-wide slot of stained glass (a `box` of trans 1 × 1 bricks: `{"mix": ["trans red", "trans dark blue", "trans yellow"]}`), spires `pitch: 75`                                        |
| ships            | sails `u9494c01` `85651c01` (`anchor: "origin"`), masts from `column`, clock brick `3003p0b` (tan)                                                                                                               |

## Workflow

1. **Plan** (before writing ops): the subject's silhouette from the front, side and top; the grid size (e.g. a 64 × 48 stud site); the palette; the parts list of big masses. Decide which volumes are never seen (make them hollow).
2. **Massing**: baseplate, terrain, building bodies with `box`/`room`/`wall`, towers with `cylinder`/`column`. Compile. Check `bounds` and the part count.
3. **Openings**: doors, windows, arches (openings in walls, or `window`/`door`/`place` which carve).
4. **Roofs**: `roof` gable/hip/flat, domes, chimneys (roof `holes`).
5. **Details**: railings (`fence`), lamps, trees, props (`place`, `scatter`, `smooth`); repeat and mirror them.
6. **Validate** and read the report: fix every `error` (overlaps), then `floating` warnings (parts with nothing under them), then `colour-unavailable` warnings.
7. **Render** `--views iso,front,iso-back,top` and look: does it read as the subject from every side? Iterate.

Report (`--report file.json`, `buildScript.compile()`):

- `ok`: no errors. `stats`: parts, designs, lots, massing cells/parts, script bytes, parts per KB, compile and check time.
- `bounds.studs`: `[x, y, z]` min/max (y in plates) — check that things landed where planned.
- `parts`: the parts list (ref, name, colour, count). `heaviestOps`: the ops that produced most parts.
- `resolved`: what each `find` became. `check`: overlaps, off-grid, connected groups, health.
- `problems`: `{severity, code, message, ops}`; `ops` are paths such as `sections[2].ops[0].ops[3]` or `components.house.ops[1]`; a part inside a component names both, `sections[3].ops[1] > components.house.ops[4]`. `floating` also says where the first loose groups are: `e.g. 3710 at [48, 21, -1]` (studs, plate level).

Common fixes: `overlap` — two ops fill the same space (parts overlapping parts; massing never overlaps). `floating` — nothing under a part: check its `y` against the top of what should hold it (a flat roof at `y` is 1 plate; its parapet adds more). `opening-height` — the opening is taller than its wall. `opening-size` — no window fits; use 2×6, 2×9, 4×9 or 4×18. Gable/hip roofs need an even depth across the ridge (including overhang).

What the checks count as connected: baseplates laid side by side are one ground (the groups standing on them count as one); a train on its wheels and a parked car on its wheel holders stand apart by design. Stud-high bumps sitting in the part above (a window frame's end studs, its glass's pivots) are not overlaps.

Lessons from building the Market town, Cathedral and Harbour samples:

- Give every component a `size`, and compile a component alone before instancing it a dozen times.
- Houses back to back: leave 2 studs between the rows for the eaves (`overhang: 1` on both), or use `ends: 0`/`overhang: 0` where a roof meets a neighbour.
- Ledges and bands: a plate ring round a wall (`floor` with a hole the size of the room) holds when it is at most 3 studs wide on each side; the packer reaches back over the wall, but a ring on both sides of a thin wall (inside and out) needs 3-deep pieces. Hollow upper floors (`holes`) save parts and hold better than plates spanning a hollow room.
- Anything that sits on a part rather than on massing (a chimney on a roof, a tower top on a ring) needs massing under it: extend the massing, do not rely on slopes.
- Put Play doors on the floor they open over, and keep other parts out of the door's swing.
- Keep parts two studs clear of track curves: a curve's sleepers reach about 4 studs either side of the centreline (radius 36–44 studs from a curve's centre).

## Limits

Builds are bounded by the resource profile (docs/RESOURCE-LIMITS.md): desktop 200,000 parts, mobile 150,000 (`--resource-profile mobile`; `limits.maxParts` lowers it further). Massing is limited to 4 million cells and 200,000 ops after repeats. Coordinates stay within ±4096 studs. Everything is deterministic: the same script always compiles to the same file.

## Worked examples

Script sizes are minified JSON (what an agent emits); the files are laid out one op per line (`python3 scripts/format-build-script.py file.json`).

| script                                                         | parts  | script | LDraw  | notes                                                                                                       |
| -------------------------------------------------------------- | ------ | ------ | ------ | ----------------------------------------------------------------------------------------------------------- |
| [house.json](../fixtures/build-scripts/house.json)             | 263    | 5.0 KB | 13 KB  | the House sample (its TypeScript generator is 11 KB for 285 parts)                                          |
| [castle.json](../fixtures/build-scripts/castle.json)           | 255    | 4.5 KB | 12 KB  | the Small castle sample (generator 11.8 KB, 245 parts); the towers are one component                        |
| [santorini.json](../fixtures/build-scripts/santorini.json)     | 4,098  | 5.4 KB | 110 KB | from a one-paragraph brief: four hollow terraces, 30 houses from three components, chapel, harbour, boats   |
| [market-town.json](../fixtures/build-scripts/market-town.json) | 6,083  | 28 KB  | 280 KB | the Market town sample: 11 houses from 4 components in 11 palettes, town hall, oval of track, a train, cars |
| [cathedral.json](../fixtures/build-scripts/cathedral.json)     | 11,817 | 26 KB  | 540 KB | the Cathedral sample: mirrored towers and aisles, 75° spires, stained-glass lancets, interior with stairs   |
| [harbour.json](../fixtures/build-scripts/harbour.json)         | 6,966  | 19 KB  | 305 KB | the Harbour sample: 19 houses from one component with flags, warehouses, ships with sails, lighthouse       |

The Santorini script's first draft compiled to 6,213 parts with 5 overlaps, 3,745 floating parts and 2 colour warnings; the report named the ops (terraces a plate above the terrace below, a chimney above its roof, flowers with tabs against the chapel), one revision fixed them all, and hollow terraces saved about 2,100 parts with no visible change.

![Santorini village, three-quarter view](screenshots/build-scripts/santorini-iso.png)

Views from `--views iso,front,iso-back,top`: [front](screenshots/build-scripts/santorini-front.png), [back](screenshots/build-scripts/santorini-iso-back.png), [top](screenshots/build-scripts/santorini-top.png); [house](screenshots/build-scripts/house.png), [castle](screenshots/build-scripts/castle.png).

## Lessons from MineBench

[MineBench](https://github.com/Ammaar-Alam/minebench) (docs/architecture.md, docs/voxel-exec-raw-output.md, lib/ai/prompts.ts) asks models for Minecraft-style voxel builds and ranks them by blind human votes (Bradley–Terry / Elo):

- **Output format.** Either JSON `{version, boxes: [{x1..z2, type}], lines: [{from, to, type}], blocks: [{x, y, z, type}]}` or, by default, a `voxel.exec` tool call whose JavaScript calls `block()`, `box()`, `line()` and a seeded `rng()` in a sandbox with time and primitive limits. Models are told to use boxes for surfaces and lines for beams "to save tokens and prevent gaps".
- **Bounded world.** Integer grid `[0, N)` with N from 32 to 512 (larger for administrators), Y up, "centre around N/2", a fixed palette of 20–60 named blocks, minimum and maximum block counts.
- **Validation and repair.** Extract the first JSON object, schema-check it, expand boxes/lines, normalise block aliases, drop out-of-bounds and unknown blocks with warnings, de-duplicate, enforce limits; on failure the model gets the error and its previous output ("return ONLY a corrected JSON object"), up to 8 attempts.
- **Prompt.** Judging criteria (recognisability, true 3D structure rather than decorated boxes, proportions, detail placement, scene composition), common failure modes, a decomposition checklist per subject type, material logic, and "plan every part with coordinate bounds before writing code"; build primary → secondary → tertiary.
- **Rendering.** Source JSON stays the benchmark record; derived compact binary artifacts (packed palette indices, visible faces, ambient occlusion) are rendered in a worker; judges orbit the build.

What carries over to bricks, and what does not: voxels can overlap and float, bricks cannot, so the brick language keeps MineBench's high-level primitives and palettes but hands brick choice, bonding, openings and roofs to a compiler and returns a checked report instead of silently dropping bad blocks; components/repeat/mirror replace JavaScript loops (deterministic, and safe to run in the browser); rendered views from several sides replace the judge's orbit.

## Headless use

- CLI: [docs/CLI.md](CLI.md#build-scripts-and-part-search) — `build`, `parts search`, plus `health`, `connectors`, `render`, `play` on the output file.
- Browser automation: [docs/API.md](API.md#build-scripts-and-part-search) — `buildScript.validate/compile/apply`, `parts.search`, then `render.image` with `camera.set` for views.
- Rendering runs headless Chromium with software WebGL; a 4,000-part build takes about a minute per view on a small server.
