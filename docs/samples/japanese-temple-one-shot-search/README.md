# One-shot sample with parts list and search: a Japanese Buddhist temple

The [first temple sample](../japanese-temple-one-shot/README.md) run again with the model given better knowledge of the parts, made on 2 October 2026:

```sh
npm run oneshot -- --target-parts 2000 --leeway 5 --brief "a japanese buddhist temple" \
  --model gpt-6.1-sol --efforts low,medium,high,xhigh,max --attempts 5 --parts-list on --search on
```

What changed since the first run:

- **Part list in the prompt.** The [prompt](prompt.md) lists all 224 curated parts with which of 24 common colours each comes in (about 7,600 tokens).
- **Parts search.** Before answering, the model may reply with only `{"parts_search": [...]}`; the runner answers in the same Codex session (up to 5 searches a reply, 10 rounds an attempt). It still cannot compile, render or run anything.
- **Stricter compiler.** A part in a colour it is not made in is now an error (sent back like any other), and old numbers such as 4032 are built as the part they moved to.
- **Provider retries.** The first xhigh and max runs were lost to the provider's "Selected model is at capacity" after 15 searches and 50–65 minutes; the runner now waits and retries such errors, and both were run again ([their results](xhigh/capacity-failure-result.json), [max](max/capacity-failure-result.json)).

Everything else is as before: GPT-6.1-Sol through `codex exec` with every Codex tool off, 1,900–2,100 parts (2,000 ± 5%), repairs with the errors and the previous reply, warnings not sent back, renders made afterwards for this page only.

## Results

| effort            | accepted                 | parts | attempts | wall time | output tokens (reasoning) | searches | finds | part numbers (outside the list) | colour errors | provider retries |
| ----------------- | ------------------------ | ----- | -------- | --------- | ------------------------- | -------- | ----- | ------------------------------- | ------------- | ---------------- |
| [low](#low)       | yes                      | 1,974 | 5        | 14 min    | 23,226 (2,028)            | 0        | 0     | 10 (0)                          | 0             | 0                |
| [medium](#medium) | yes                      | 2,009 | 3        | 13 min    | 21,393 (3,501)            | 0        | 0     | 10 (0)                          | 1             | 0                |
| [high](#high)     | yes                      | 1,918 | 4        | 47 min    | 82,100 (49,489)           | 22       | 0     | 24 (0)                          | 0             | 0                |
| [xhigh](#xhigh)   | **no** (2 overlaps left) | 2,018 | 5        | 93 min    | 141,575 (87,199)          | 10       | 1     | 30 (0)                          | 0             | 1                |
| [max](#max)       | yes                      | 2,001 | 3        | 112 min   | 102,182 (62,548)          | 5        | 1     | 22 (0)                          | 0             | 1                |

Searches, finds and colour errors are summed over attempts; part numbers are those named in the final script. Wall times include search rounds and provider waits and were measured with up to five runs at once on a loaded shared VM.

| effort | attempt 1                       | 2                 | 3                      | 4                                 | 5                   |
| ------ | ------------------------------- | ----------------- | ---------------------- | --------------------------------- | ------------------- |
| low    | 1,810: 90 under; overlaps       | invalid script    | 1,735: under; overlaps | 1,988: overlaps                   | **accepted**, 1,974 |
| medium | 1,887: 13 under; a colour error | 2,002: an overlap | **accepted**, 2,009    |                                   |                     |
| high   | invalid script (12 searches)    | 1,990: overlaps   | 1,920: overlaps        | **accepted**, 1,918 (10 searches) |                     |
| xhigh  | invalid script (10 searches)    | 1,592: 308 under  | invalid script         | 2,018: 2 overlaps                 | 2,018: 2 overlaps   |
| max    | invalid script (5 searches)     | 2,138: 38 over    | **accepted**, 2,001    |                                   |                     |

"Invalid script" means the schema refused it before compiling: a face name not allowed in a box's `open` list (low, high) or a non-integer `at` (xhigh, max). That happened to 5 of the 20 replies, including the first reply of high, xhigh and max; none of the first run's 13 replies was invalid.

### How they used the parts knowledge

- **The list was used; search was used at high effort and above.** The final scripts name 10–30 distinct parts, all from the prompt's list; the only number from outside it in any reply was 90398 (a minifig statuette for the altar Buddha, found by search), written by number in high's and max's early replies and as a `find` phrase later. Low and medium never searched. High, xhigh and max searched in their first attempt (high also in its last): first for things the list lacks (a bell, a statuette, a lattice window pane, curved slopes, gold bars and round plates for the spire), then by number for parts from the list, to check their colours.
- **`find` was nearly unused.** One phrase in the final scripts, "minifigure statuette" (resolved to 90398 Minifig Statuette, for the Buddha in xhigh and max).
- **Colours were right.** One colour error in 20 replies (medium's first: a Round Brick 2 × 2 in a colour it is not made in), fixed by the repair.

### Compared with the first run (no list, no search)

| effort | first run: accepted, parts, attempts, time | this run                 | first run: part numbers (outside the list) | this run |
| ------ | ------------------------------------------ | ------------------------ | ------------------------------------------ | -------- |
| low    | yes, 1,954, 2, 4 min                       | yes, 1,974, 5, 14 min    | 3 (0)                                      | 10 (0)   |
| medium | yes, 1,979, 4, 12 min                      | yes, 2,009, 3, 13 min    | 5 (1: 4032)                                | 10 (0)   |
| high   | yes, 1,984, 3, 18 min                      | yes, 1,918, 4, 47 min    | 9 (1: 4032)                                | 24 (0)   |
| xhigh  | yes, 1,955, 2, 27 min                      | **no**, 2,018, 5, 93 min | 14 (2: 4032, 4073)                         | 30 (0)   |
| max    | yes, 1,985, 2, 56 min                      | yes, 2,001, 3, 112 min   | 12 (1: 4032)                               | 22 (0)   |

- **Part knowledge improved.** Every first-run build put 1–4 parts in colours they are not made in (accepted then, errors now); every accepted build here has none. The scripts use two to three times as many distinct parts, and no old or unlisted numbers.
- **Getting a script accepted got harder.** 5 of 20 replies failed the schema (none of 13 did in the first run), attempts rose at every effort but medium, and xhigh ran out of attempts two overlaps short. The colour rule adds a way to fail, the longer prompt may cost attention, and search rounds add time; this one run cannot tell those apart.
- **It costs more.** Output tokens rose at every effort (low 8k → 23k, max 73k → 102k), and every reply carries the ~7,600-token list.
- **The builds look richer to us**: slate and dark-red palettes at most efforts, stone lanterns with cone caps, raked gravel gardens, ringed spires. Judge from the renders below and [the first run's](../japanese-temple-one-shot/README.md).

Files per effort: `build.json` (the accepted script; xhigh has `final-attempt.json`, its last, unaccepted reply), `result.json` (every attempt: outcome, errors sent back, parts, seconds, tokens, each search and what it returned, and part knowledge) and three views.

## low

1,974 parts: hip-roofed hall with dark-red posts and white wall bands, a red-pillared gate, a side pavilion, a stone lantern, plants on a sand ground. 0 searches.

![low, three-quarter view](low/iso.png)

| front                        | back three-quarter             |
| ---------------------------- | ------------------------------ |
| ![low, front](low/front.png) | ![low, back](low/iso-back.png) |

## medium

2,009 parts: hall and three-storey pagoda with slate roofs and dark-brown timber, gate, lantern, pond, fences, conifers. 0 searches.

![medium, three-quarter view](medium/iso.png)

| front                              | back three-quarter                   |
| ---------------------------------- | ------------------------------------ |
| ![medium, front](medium/front.png) | ![medium, back](medium/iso-back.png) |

## high

1,918 parts: dark-red three-storey pagoda with a tall stepped spire, a gable-roofed hall, a red gate, cone-capped stone lanterns and a striped raked-gravel garden. 22 searches.

![high, three-quarter view](high/iso.png)

| front                          | back three-quarter               |
| ------------------------------ | -------------------------------- |
| ![high, front](high/front.png) | ![high, back](high/iso-back.png) |

## xhigh

**Not accepted**: its fifth and last reply, 2,018 parts, still had two overlaps (a hip corner slope against a pagoda post). Rendered anyway: slate roofs with red trim and raised eave ends, dark-red posts, a gold spire, a walled compound with a raked garden and a pond. 10 searches.

![xhigh, three-quarter view (not accepted)](xhigh/iso.png)

| front                            | back three-quarter                 |
| -------------------------------- | ---------------------------------- |
| ![xhigh, front](xhigh/front.png) | ![xhigh, back](xhigh/iso-back.png) |

## max

2,001 parts: brown timber pagoda with stepped eaves and a tall ringed gold _sorin_, a hall, a gate, a pond, conifers and a raked garden. 5 searches.

![max, three-quarter view](max/iso.png)

| front                        | back three-quarter             |
| ---------------------------- | ------------------------------ |
| ![max, front](max/front.png) | ![max, back](max/iso-back.png) |
