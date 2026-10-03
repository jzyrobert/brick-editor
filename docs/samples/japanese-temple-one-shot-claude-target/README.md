# One-shot sample through Claude Code, target as a score: a Japanese Buddhist temple with Opus 5.5

The [fourth run](../japanese-temple-one-shot-target/README.md) of the temple brief, repeated with Claude Opus 5.5 through Claude Code. Opus had already built the temple [under run 3's rules](../japanese-temple-one-shot-claude/README.md); this run uses run 4's: no part range, the distance from 2,000 parts is the size score, with counting rules in the prompt, a size line in every repair and each irregular part's reach. Made on 3 October 2026:

```sh
npm run oneshot -- --runner claude --target-parts 2000 --brief "a japanese buddhist temple" \
  --model claude-opus-5-5 --efforts low,medium,high,xhigh,max --attempts 5 --parts-list on --search on
```

The [prompt](prompt.md) is run 4's with the one line added after it: `mirror` does not work around an `instance` (run 4's xhigh tripped on it). Claude Code ran as in the [first Opus run](../japanese-temple-one-shot-claude/README.md): `claude -p --effort <effort>` with every tool off and no user customisation, the 224-part list, parts search by reply, MineBench-style repairs, up to 5 attempts, warnings not sent back, renders afterwards in the Realistic look.

## Results

| effort            | parts (vs 2,000) | first reply    | attempts | wall time | output tokens (thinking) | cost   | searches | finds | part numbers (outside the list) | colour errors |
| ----------------- | ---------------- | -------------- | -------- | --------- | ------------------------ | ------ | -------- | ----- | ------------------------------- | ------------- |
| [low](#low)       | 1,358 (−32.1%)   | (accepted)     | **1**    | 2 min     | 10,663 (7,691)           | $0.43  | 0        | 0     | 6 (0)                           | 0             |
| [medium](#medium) | 1,871 (−6.4%)    | 1,757 (−12.1%) | 2        | 9 min     | 52,763 (40,279)          | $1.54  | 0        | 0     | 14 (0)                          | 0             |
| [high](#high)     | 1,999 (±0%)      | 2,009 (+0.5%)  | 2        | 12 min    | 77,417 (60,430)          | $2.05  | 0        | 0     | 13 (0)                          | 0             |
| [xhigh](#xhigh)   | 2,294 (+14.7%)   | (accepted)     | **1**    | 26 min    | 108,876 (100,211)        | $3.44  | 10       | 0     | 19 (2)                          | 0             |
| [max](#max)       | 1,668 (−16.6%)   | (accepted)     | **1**    | 34 min    | 221,532 (211,661)        | $10.46 | 10       | 0     | 13 (3)                          | 0             |

Every effort was accepted, three of them on their first reply, and every reply compiled. The two repairs were overlaps:

| effort | first reply                                                                                                                                                            |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| medium | a large pine and fruit trees flush against the compound wall and its coping                                                                                            |
| high   | Plant 1 × 1 Large Leaves (6255) three studs in front of a wall although its listed reach is 2.5 studs; a `scatter` of leaf plates up against the hall's masonry plinth |

Both repairs fixed everything at once. The reach notes did not stop these overlaps, but they made them easy to fix: high's error said "its body reaches x 0–5, z 1–5, past its footprint", and high explained the miss as a half-stud reach running into the next cell. Xhigh and max searched (bell, lantern, cherry blossom, fish, rock, round grille brick…) and used library parts they found: Cylinder 2 × 2 × 1.667 with Dome Top (30151a) as a hanging temple bell at both efforts, the grille round brick (92947), boulders (42291) and a fish (64648).

### How well Opus counted

| effort | GPT-6.1-Sol run 4: first reply → accepted | Opus run 4 rules: first reply → accepted |
| ------ | ----------------------------------------- | ---------------------------------------- |
| low    | 1,950 (−2.5%) → 2,088 (+4.4%)             | 1,358 (−32.1%), accepted                 |
| medium | 1,854 (−7.3%) → 2,007 (+0.4%)             | 1,757 (−12.1%) → 1,871 (−6.4%)           |
| high   | 2,116 (+5.8%) → 2,031 (+1.6%)             | 2,009 (+0.5%) → 1,999 (±0%)              |
| xhigh  | did not compile → 2,195 (+9.8%)           | 2,294 (+14.7%), accepted                 |
| max    | 2,060 (+3.0%), accepted                   | 1,668 (−16.6%), accepted                 |

- **Opus counted worse than GPT-6.1-Sol**: its accepted builds missed by 14% on average (0–32%), GPT's by 4% (0.4–9.8%). High landed one part off the target; low, xhigh and max missed by 15–32%, all accepted on a first reply, so no repair ever showed them a count.
- **It thought it was close.** Low's own tally was about 2,040 (built 1,358), xhigh's about 2,027 (2,294), max's 1,950–2,020 (1,668). Low and max blame openings, roofs with holes and the +15% massing allowance, which they found too generous for walls broken by many openings; xhigh blames ring roofs and walls cut up by pilasters, which went the other way.
- With the count only a score, a first reply that compiles is final. Under run 3's rules the same model needed 5 and 4 replies at low and medium to get inside ±5%.

## Against the earlier runs

One run each; treat differences of a step or two with care.

| effort | GPT-6.1-Sol, run 4 rules | Opus 5.5, run 3 rules (±5% range) | Opus 5.5, run 4 rules      |
| ------ | ------------------------ | --------------------------------- | -------------------------- |
| low    | +4.4% · 2 · 5 min · 11k  | in range · 5 · 4 min · 27k        | −32.1% · 1 · 2 min · 11k   |
| medium | +0.4% · 2 · 8 min · 15k  | in range · 4 · 13 min · 88k       | −6.4% · 2 · 9 min · 53k    |
| high   | +1.6% · 2 · 16 min · 31k | in range · 2 · 19 min · 118k      | ±0% · 2 · 12 min · 77k     |
| xhigh  | +9.8% · 2 · 29 min · 50k | in range · 2 · 42 min · 259k      | +14.7% · 1 · 26 min · 109k |
| max    | +3.0% · 1 · 31 min · 61k | in range · 2 · 51 min · 334k      | −16.6% · 1 · 34 min · 222k |

(size · attempts · wall time · output tokens, thinking included)

- Against Opus under run 3's rules: fewer attempts at every effort, less time, and a third to two thirds of the tokens. That is partly the gate being gone, and partly no overlaps at all from low, xhigh and max.
- Against GPT-6.1-Sol under the same rules: Opus finished first-time more often (3 against 1) and in similar time, but used 1–4 times the tokens and missed the target by much more.
- Opus searched at xhigh and max in both of its runs; GPT-6.1-Sol has never searched under these prompts.

### A runner fault, found and fixed in this run

Max's first attempt in this run filled the 128,000-token output cap partway through writing its JSON. Claude Code continued the reply in a new turn, but its `result` field keeps only the last turn, so the runner got the last 4.6 kB of a 17 kB script and refused it as invalid. Joined, the reply compiles cleanly at 1,744 parts (−12.8%): it would have been accepted first time. The runner now reads Claude Code's `stream-json` events and joins every assistant text (checked by forcing a split reply under a 600-token cap). The faulty run went on to a repair, accepted at 1,949 parts after 94 minutes and $18.25. Max was then rerun on its own with the fixed runner; the table shows that rerun. The faulty run's `result.json` and the joined first reply are in [max-runner-bug](max-runner-bug). The first Opus run is unaffected: its cap hits came during thinking, before any text.

## What the models said

As before, each final session was resumed and asked run 2's seven questions ([the script](../japanese-temple-one-shot-claude/interview.sh); answers: [low](low/feedback.md), [medium](medium/feedback.md), [high](high/feedback.md), [xhigh](xhigh/feedback.md), [max](max/feedback.md)). Three of them had no errors to judge, so the answers lean toward what was unclear. They agreed on:

1. **A count or check before answering.** All five asked for a dry run that returns per-section counts and errors without using an attempt. Xhigh and max also wanted the compile report after an accepted reply, to learn where their counts went wrong.
2. **The counting rules lean the wrong way for buildings full of openings and holed roofs.** Low, medium and max asked for worked costs for a textured room with openings and a hip roof with holes; xhigh for ring roofs and pilastered walls.
3. **A complete schema per op.** All five tripped over `room.openings` (`door`, `frame`, `glass`, `opens` are only in the example). Others asked about `box` lids and `interior`, `top: "tile"` (replaces the layer or adds one), the frame of `holes` in a `group`, `instance.at`, the axes of `stairs`, `scatter` density, and whether `repeat` may hold an `instance`.
4. **Turn and facing conventions:** which way a slope or curved slope faces at `turn: 0` and which way `turn: 90` turns (max placed its ridge ornaments "essentially on a coin flip"; xhigh hedged so either way would do). Also whether a part's top has studs, and whether a part hanging below a plate (both bells) counts as standing.
5. **Reach in cells:** high asked how a fractional reach maps to cells ("2.5 studs" touches the third cell) and for `scatter` to respect reach; medium found 3470 Fruit Tree listed with no reach although its canopy hit a wall.
6. **Search** should be a tool call and should rank building parts first: "lantern" returned Green Lantern torsos and "bell" returned bell-bottom trousers. Overlap ranges such as "z 5–5" mix cells and edges, and "(7 pairs like this)" hides pairs.

Files per effort: `build.json`, `result.json` (every attempt, with tokens and cost), `feedback.md` and three views.

## low

1,358 parts: a hip-roofed main hall with a veranda and railings, a five-storey dark-red pagoda in front, a red sanmon gate, a bell pavilion, stone lanterns, a pond, conifers and a stone wall.

![low, three-quarter view](low/iso.png)

| front                        | back three-quarter             |
| ---------------------------- | ------------------------------ |
| ![low, front](low/front.png) | ![low, back](low/iso-back.png) |

## medium

1,871 parts: a white-walled compound with a gate, a red-and-white hondō with two roofs and gold finials, a five-storey pagoda with a tall spire, a bell tower, a purification pavilion, a pond and red maples.

![medium, three-quarter view](medium/iso.png)

| front                              | back three-quarter                   |
| ---------------------------------- | ------------------------------------ |
| ![medium, front](medium/front.png) | ![medium, back](medium/iso-back.png) |

## high

1,999 parts: a five-storey pagoda with a gold spire, a two-roofed Kondō on a red-railed platform, a chūmon gate and front wall, a bell tower, a purification pavilion with a basin, and stone lanterns.

![high, three-quarter view](high/iso.png)

| front                          | back three-quarter               |
| ------------------------------ | -------------------------------- |
| ![high, front](high/front.png) | ![high, back](high/iso-back.png) |

## xhigh

2,294 parts: an open precinct on lawns: a five-storey pagoda, a two-roofed Kondō with ridge ornaments, a chūmon gate with walls, an open bell tower with a hanging bell, lanterns along a sand path, stepping stones, a lily pond and cherry trees.

![xhigh, three-quarter view](xhigh/iso.png)

| front                            | back three-quarter                 |
| -------------------------------- | ---------------------------------- |
| ![xhigh, front](xhigh/front.png) | ![xhigh, back](xhigh/iso-back.png) |

## max

1,668 parts: a tall five-storey red pagoda with a ringed gold spire, a two-tier Kondō with gold ridge ornaments, a two-storey sanmon gate in the temple wall, a bell tower, lanterns, an incense burner and fountain, a koi pond with a red bridge and cherry trees.

![max, three-quarter view](max/iso.png)

| front                        | back three-quarter             |
| ---------------------------- | ------------------------------ |
| ![max, front](max/front.png) | ![max, back](max/iso-back.png) |
