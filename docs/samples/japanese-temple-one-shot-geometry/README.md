# One-shot sample with geometry rules: a Japanese Buddhist temple

The third run of the temple brief, after acting on what the second run's five models said in [interviews](../japanese-temple-one-shot-search/README.md#what-the-models-said) about the prompt and tooling. Made on 2 October 2026 with the same command as the [second run](../japanese-temple-one-shot-search/README.md):

```sh
npm run oneshot -- --target-parts 2000 --leeway 5 --brief "a japanese buddhist temple" \
  --model gpt-6.1-sol --efforts low,medium,high,xhigh,max --attempts 5 --parts-list on --search on
```

What changed since the second run:

- **Geometry rules in the [prompt](prompt.md):** whole-number coordinates; one frame for every `at`, holes included; part footprints and how a turn swaps them; inclusive wall and fence ends; the `open` faces; how massing and parts share space; roof course and ridge heights and what a hole removes; what a component's `size` means.
- **Placement data:** every entry in the part list and every search result gives the footprint at `turn: 0` (studs along x × z) and the height in plates, from the compiler's own helpers ("61678 Curved Slope 4 × 1 — 1×4 studs (x×z), 3 plates").
- **Errors that say where:** overlaps are grouped by their two source ops and parts, each with both positions and where their boxes meet ("3045 … at [9, 37, 31] and 2453b … at [10, 38, 31] overlap where their boxes meet: x 10–11, y 38–40.5, z 31–32 (4 pairs like this)"); schema errors show the rejected value; under-budget errors list each section's parts.

Everything else is as before: GPT-6.1-Sol through `codex exec` with every Codex tool off, the 224-part list, parts search by reply, colour errors, 1,900–2,100 parts (2,000 ± 5%), up to 5 attempts, warnings not sent back, renders made afterwards for this page only with the Realistic look.

## Results

| effort            | accepted | parts | attempts | wall time | output tokens (reasoning) | searches | finds | part numbers (outside the list) | colour errors |
| ----------------- | -------- | ----- | -------- | --------- | ------------------------- | -------- | ----- | ------------------------------- | ------------- |
| [low](#low)       | yes      | 2,057 | 2        | 5 min     | 9,313 (1,415)             | 0        | 0     | 14 (0)                          | 0             |
| [medium](#medium) | yes      | 2,098 | 2        | 7 min     | 13,119 (3,413)            | 0        | 0     | 11 (0)                          | 1             |
| [high](#high)     | yes      | 1,965 | 2        | 19 min    | 33,642 (16,975)           | 0        | 0     | 13 (0)                          | 0             |
| [xhigh](#xhigh)   | yes      | 1,997 | 2        | 25 min    | 42,103 (28,269)           | 0        | 0     | 19 (0)                          | 0             |
| [max](#max)       | yes      | 2,061 | 2        | 37 min    | 46,254 (23,623)           | 0        | 1     | 20 (0)                          | 0             |

Every effort was accepted on its second reply, and every first reply compiled: no schema errors this time. What the first replies got wrong:

| effort | first reply                                                                                                                    |
| ------ | ------------------------------------------------------------------------------------------------------------------------------ |
| low    | 2,137 parts, 37 over; overlaps: paving tiles under lantern bases, eave-bracket stacks into round-brick posts                   |
| medium | 2,102 parts, 2 over; a pearl-gold Round Brick 2 × 2 (not made in that colour); paving under lantern bases, a pine, a roof tile |
| high   | 2,419 parts, 319 over; bamboo into a wall, window frames into eave brackets                                                    |
| xhigh  | 2,570 parts, 470 over; bamboo copies into each other                                                                           |
| max    | in range (2,061); one overlap: a round tile under a bamboo plant                                                               |

Each repair fixed everything in one go. Nobody searched: with footprints and heights in the list, no model asked for anything beyond it, and the only `find` was max's "minifigure statuette" (90398) for the altar Buddha.

**What is still missing:** irregular parts. Bamboo (30176) is listed as 1 × 1 studs, its attachment footprint, but its leaves span three to four studs, and that caused most of the overlaps high, xhigh and max had to repair. The list should give such parts' reach as well.

## Three runs compared

The same brief, model, part range and efforts; one run each, so treat differences of a step or two with care. Wall times were measured with five runs at once on a loaded shared VM.

| effort | 1: no list, no search         | 2: list, search, colour errors | 3: + geometry rules, footprints, located errors |
| ------ | ----------------------------- | ------------------------------ | ----------------------------------------------- |
| low    | yes · 2 attempts · 4 min · 8k | yes · 5 · 14 min · 23k         | yes · 2 · 5 min · 9k                            |
| medium | yes · 4 · 12 min · 23k        | yes · 3 · 13 min · 21k         | yes · 2 · 7 min · 13k                           |
| high   | yes · 3 · 18 min · 36k        | yes · 4 · 47 min · 82k         | yes · 2 · 19 min · 34k                          |
| xhigh  | yes · 2 · 27 min · 20k        | **no** · 5 · 93 min · 142k     | yes · 2 · 25 min · 42k                          |
| max    | yes · 2 · 56 min · 73k        | yes · 3 · 112 min · 102k       | yes · 2 · 37 min · 46k                          |

(accepted · attempts · wall time · output tokens)

- **Run 1** was quick but its builds were judged under looser rules: every one put 1–4 parts in colours they are not made in, and two used old part numbers.
- **Run 2** fixed the part knowledge (only listed parts, one colour error in 20 replies) but paid for it: 5 of 20 replies failed the schema, attempts and tokens rose, and xhigh never got accepted.
- **Run 3** keeps run 2's part knowledge and gets every effort accepted in two replies, with no schema errors, in less time and fewer tokens than run 2 at every effort, and less than run 1 at max. The geometry rules took away the schema failures (every run-2 schema error was a rule now stated) and the located errors let each repair land first time.

Files per effort: `build.json` (the accepted script) and `result.json` (every attempt: outcome, errors sent back, parts, seconds, tokens, searches and part knowledge), and three views.

## low

2,057 parts: a single hall with a deep hip roof on dark-brown timber posts and white panels, eaves on brackets, a gate, a stone lantern, conifers and low walls.

![low, three-quarter view](low/iso.png)

| front                        | back three-quarter             |
| ---------------------------- | ------------------------------ |
| ![low, front](low/front.png) | ![low, back](low/iso-back.png) |

## medium

2,098 parts: a dark-red three-storey pagoda with slate roofs and a ringed gold spire, a red-trimmed hall, and a walled lawn with stone lanterns, conifers and a red gate.

![medium, three-quarter view](medium/iso.png)

| front                              | back three-quarter                   |
| ---------------------------------- | ------------------------------------ |
| ![medium, front](medium/front.png) | ![medium, back](medium/iso-back.png) |

## high

1,965 parts: a red-and-white pagoda with a gold finial, a gable-roofed hall with a porch and stone steps, a raked rock garden and a lantern.

![high, three-quarter view](high/iso.png)

| front                          | back three-quarter               |
| ------------------------------ | -------------------------------- |
| ![high, front](high/front.png) | ![high, back](high/iso-back.png) |

## xhigh

1,997 parts: a three-storey pagoda with rows of eave brackets and a ringed spire, a hip-and-gable (_irimoya_) hall with red posts and white walls, a raked gravel garden with rocks, stone lanterns and bamboo.

![xhigh, three-quarter view](xhigh/iso.png)

| front                            | back three-quarter                 |
| -------------------------------- | ---------------------------------- |
| ![xhigh, front](xhigh/front.png) | ![xhigh, back](xhigh/iso-back.png) |

## max

2,061 parts: a slate three-storey pagoda with a ringed spire, an _irimoya_ hall with gold ridge ornaments, a two-storey gate, a bell pavilion with its bell, stone lanterns, bamboo and conifers.

![max, three-quarter view](max/iso.png)

| front                        | back three-quarter             |
| ---------------------------- | ------------------------------ |
| ![max, front](max/front.png) | ![max, back](max/iso-back.png) |
