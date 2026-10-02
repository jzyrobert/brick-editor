# One-shot sample: a Japanese Buddhist temple

Five [one-shot runs](../../AGENT-BUILDING.md#one-shot-runs) of the same brief, one per reasoning effort of GPT-6.1-Sol, made on 1–2 October 2026 with:

```sh
npm run oneshot -- --target-parts 2000 --leeway 5 --brief "a japanese buddhist temple" \
  --model gpt-6.1-sol --efforts low,medium,high,xhigh,max --attempts 5
```

- **Brief:** "a japanese buddhist temple". **Part range:** 1,900–2,100 (target 2,000 ± 5%).
- **One pass, no tools.** The model got the [prompt](prompt.md) (the build-agent prompt without its tools section) and had to answer with the build script alone, through `codex exec` (codex-cli 0.159.0) with every tool off, a read-only sandbox and an empty folder. It could not compile, search parts or see a render.
- **Repairs.** A reply that did not compile cleanly in range went back with its errors and the reply itself ("return ONLY a corrected JSON object"), up to 5 attempts. Only errors count: overlaps, `over-budget`, `under-budget`, invalid scripts. Warnings (floating parts, unavailable colours, part clashes) were accepted, as MineBench accepts its warnings.
- **Renders** were made afterwards, for this page only.
- **Rules at the time.** These runs predate the part list in the prompt, parts search and two compiler changes made afterwards: a part in a colour it is not made in became an error (every build here has 1–4 such parts: pearl-gold Round Brick 2 × 2, dark-brown lattice fences, dark-green Pine Tree Large…), and old numbers such as 4032 and 4073 are now built as 4032a and 6141. Recompiled today, these scripts fail on colour. The [rerun with the part list and search](../japanese-temple-one-shot-search/README.md) uses the new rules.

## Results

| effort            | accepted | parts | attempts | wall time | output tokens (reasoning) | distinct parts | script  | height    |
| ----------------- | -------- | ----- | -------- | --------- | ------------------------- | -------------- | ------- | --------- |
| [low](#low)       | yes      | 1,954 | 2        | 4 min     | 8,159 (823)               | 48             | 5.5 KB  | 78 plates |
| [medium](#medium) | yes      | 1,979 | 4        | 12 min    | 23,444 (3,403)            | 62             | 8.9 KB  | 107       |
| [high](#high)     | yes      | 1,984 | 3        | 18 min    | 35,893 (12,106)           | 63             | 13.5 KB | 142       |
| [xhigh](#xhigh)   | yes      | 1,955 | 2        | 27 min    | 19,833 (3,017)            | 73             | 14.9 KB | 71        |
| [max](#max)       | yes      | 1,985 | 2        | 56 min    | 73,150 (50,166)           | 74             | 21.1 KB | 129       |

Every effort ended with an accepted build in range, and **no first reply was accepted**: each one overlapped parts, missed the range, or both. Tokens are Codex's own counts summed over the attempts; output includes the JSON. Wall times were measured with all five running at once on a shared, loaded 4-core VM, so compare them with care. No run made a tool call.

| effort | attempt 1                        | attempt 2                 | attempt 3           | attempt 4           |
| ------ | -------------------------------- | ------------------------- | ------------------- | ------------------- |
| low    | 2,176 parts: 76 over             | **accepted**, 1,954       |                     |                     |
| medium | 1,552 parts: 348 under; overlaps | 1,817: 83 under; overlaps | 1,996: one overlap  | **accepted**, 1,979 |
| high   | 1,724 parts: 176 under; overlaps | 2,051: overlaps           | **accepted**, 1,984 |                     |
| xhigh  | 1,999 parts: overlaps            | **accepted**, 1,955       |                     |                     |
| max    | 1,889 parts: 11 under; overlap   | **accepted**, 1,985       |                     |                     |

What stands out in the renders:

- Every build reads as a Japanese temple: a hip-roofed main hall on a raised platform, a roofed _sanmon_ gate on the approach, stone lanterns. Roofs are straight 45° slopes throughout (the compiler has no curved roofs yet).
- **medium, high and max** add a three-storey pagoda with a gold _sorin_ spire; **low and xhigh** do not.
- **high** has the richest colour (vermilion and white walls, red gate pillars, a lotus pond); **xhigh** has the most temple-like single hall (an _irimoya_ hip-and-gable roof with upturned eave ornaments) but leaves the most loose detail (82 connected groups, 17 part clashes); **max** has the most planting and the longest script.
- Every accepted build still carries a `floating` warning, and connected groups range from 6 (medium) to 82 (xhigh): one pass gets the size and the overlaps right after a repair, but not everything resting on something.

Files per effort: `build.json` (the accepted script; `npm run cli -- build --script docs/samples/japanese-temple-one-shot/max/build.json --output temple.mpd` rebuilds it), `result.json` (every attempt with outcome, the errors sent back, parts, seconds and tokens) and three views. [summary.json](summary.json) has all five.

## low

_Temple of the Quiet Mountain_ — 1,954 parts. Sections: walled temple garden, sanmon entrance gate, raised stone platform and veranda, main worship hall, broad tiled temple roof.

![low, three-quarter view](low/iso.png)

| front                        | back three-quarter             |
| ---------------------------- | ------------------------------ |
| ![low, front](low/front.png) | ![low, back](low/iso-back.png) |

## medium

_Temple of the Three Bells_ — 1,979 parts. Sections: courtyard mosaic and garden, timber entrance gate, raised stone terrace, main worship hall, three-storey pagoda.

![medium, three-quarter view](medium/iso.png)

| front                              | back three-quarter                   |
| ---------------------------------- | ------------------------------------ |
| ![medium, front](medium/front.png) | ![medium, back](medium/iso-back.png) |

## high

_Temple of the Threefold Light_ — 1,984 parts. Sections: temple grounds and lotus pond, roofed sanmon entrance, main worship hall and stone terrace, then the pagoda in three tiers up to its golden sorin.

![high, three-quarter view](high/iso.png)

| front                          | back three-quarter               |
| ------------------------------ | -------------------------------- |
| ![high, front](high/front.png) | ![high, back](high/iso-back.png) |

## xhigh

_Komorebi-ji Japanese Buddhist Temple_ — 1,955 parts. Sections: grounds and approach, stone dais and veranda, prayer hall and timber frame, golden Buddha altar, layered irimoya roof, sweeping ceramic eaves, sanmon gate, white courtyard walls, stone lanterns and gardens.

![xhigh, three-quarter view](xhigh/iso.png)

| front                            | back three-quarter                 |
| -------------------------------- | ---------------------------------- |
| ![xhigh, front](xhigh/front.png) | ![xhigh, back](xhigh/iso-back.png) |

## max

_Lotus Mountain Buddhist Temple_ — 1,985 parts. Sections: grounds and stone approaches, hondo main hall and veranda, three-storey pagoda, sanmon gate, stone lanterns, votive candles and garden planting.

![max, three-quarter view](max/iso.png)

| front                        | back three-quarter             |
| ---------------------------- | ------------------------------ |
| ![max, front](max/front.png) | ![max, back](max/iso-back.png) |
