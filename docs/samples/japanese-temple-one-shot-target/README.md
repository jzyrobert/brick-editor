# One-shot sample with a part target: a Japanese Buddhist temple

The fourth run of the temple brief, after acting on what the [third run's](../japanese-temple-one-shot-geometry/README.md) five models said in [interviews](../japanese-temple-one-shot-geometry/README.md#what-the-models-said-about-efficiency) about efficiency. Made on 3 October 2026:

```sh
npm run oneshot -- --target-parts 2000 --brief "a japanese buddhist temple" \
  --model gpt-6.1-sol --efforts low,medium,high,xhigh,max --attempts 5 --parts-list on --search on
```

What changed since the third run:

- **The target is guidance, not a pass mark.** The earlier runs refused anything outside 1,900–2,100 parts and sent it back for repair. Now any count is accepted, and how far the build lands from 2,000 is its size score. The [prompt](prompt.md) says the build is judged on that distance alongside how it looks.
- **Rules for counting parts** in the prompt's new "Counting parts" section, measured by compiling each op on its own:
  - placed parts are exact (multiply by repeats and component copies);
  - plain massing costs about 1 part per 6–10 studs of each brick course;
  - textures cost 1 part per 2 studs; tile tops cost the area ÷ 8; roofs cost the area ÷ 3;
  - add about 15% because parts cut massing into smaller bricks.
- **Repairs state the size every time**: "The script compiled to 1,854 parts (target 2,000: −146, −7.3%). Errors to fix: …".
- **Overlaps say where the script put each part and which copy collides**: `3941 Round Brick 2 × 2 placed at [13, 134, 35] and 4032b Round Plate 2 × 2 placed at [13, 134, 35] (repeat copy 1/5) … (5 pairs like this; repeat copies 1/5, 2/5, 3/5, 4/5, 5/5)`. "Placed at" is the script's `at`, no longer the part's bounding-box corner.
- **Irregular parts give their reach** in the part list and search results: "30176 Plant 1 × 1 Bamboo — 1×1 studs (x×z), 3 plates; its body reaches past that: 1 stud at −x, +x; 1.5 studs at −z, +z". This covers 19 curated parts and replaces the old advice to keep a stud clear.

Everything else is as before: GPT-6.1-Sol through `codex exec` with every Codex tool off, the 224-part list, parts search by reply, MineBench-style repairs (the whole prompt, the errors and the previous reply), up to 5 attempts, warnings not sent back, and renders made afterwards for this page only, in the Realistic look.

## Results

| effort            | parts (vs 2,000) | first reply     | attempts | wall time | output tokens (reasoning) | searches | finds | part numbers (outside the list) | colour errors |
| ----------------- | ---------------- | --------------- | -------- | --------- | ------------------------- | -------- | ----- | ------------------------------- | ------------- |
| [low](#low)       | 2,088 (+4.4%)    | 1,950 (−2.5%)   | 2        | 5 min     | 10,697 (1,214)            | 0        | 0     | 12 (0)                          | 0             |
| [medium](#medium) | 2,007 (+0.4%)    | 1,854 (−7.3%)   | 2        | 8 min     | 14,503 (4,211)            | 0        | 0     | 17 (0)                          | 0             |
| [high](#high)     | 2,031 (+1.6%)    | 2,116 (+5.8%)   | 2        | 16 min    | 31,179 (15,792)           | 0        | 0     | 16 (0)                          | 0             |
| [xhigh](#xhigh)   | 2,195 (+9.8%)    | did not compile | 2        | 29 min    | 50,291 (33,148)           | 0        | 0     | 22 (0)                          | 0             |
| [max](#max)       | 2,060 (+3.0%)    | (accepted)      | **1**    | 31 min    | 61,166 (50,861)           | 0        | 0     | 27 (0)                          | 0             |

Every effort was accepted. Max was accepted on its first reply, the first time in four runs that any effort managed that. What the other first replies got wrong:

| effort | first reply                                                                                                                                                                                                                                          |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| low    | overlaps: veranda posts into lattice fences and a panel; a pagoda finial plate into its round bricks (5 copies)                                                                                                                                      |
| medium | a closed balcony fence `[[0,0],[9,0],[9,9],[0,9],[0,0]]` whose last post landed on its first. **A compiler fault, not the model's: now fixed**, so this reply now compiles with no errors, at 1,848 parts (its three copies lose their doubled post) |
| high   | overlaps: inverted-slope gate brackets into a 1 × 16 lintel, veranda posts into the hall's roof slopes                                                                                                                                               |
| xhigh  | refused before compiling: `mirror` around a component `instance`, which the compiler does not support and the prompt did not say (it does now)                                                                                                       |

Each repair fixed everything in one go. Every build used bamboo (30176), and none of the overlaps involved it. In run 3, bamboo caused most of the overlaps that high, xhigh and max had to repair. Nobody searched.

### How well the models counted

The first reply that compiled is the model's own estimate; the repairs then moved toward or away from the target:

| effort | run 3 first reply | run 4 first reply | run 4 accepted |
| ------ | ----------------- | ----------------- | -------------- |
| low    | 2,137 (+6.9%)     | 1,950 (−2.5%)     | 2,088 (+4.4%)  |
| medium | 2,102 (+5.1%)     | 1,854 (−7.3%)     | 2,007 (+0.4%)  |
| high   | 2,419 (+21.0%)    | 2,116 (+5.8%)     | 2,031 (+1.6%)  |
| xhigh  | 2,570 (+28.5%)    | –                 | 2,195 (+9.8%)  |
| max    | 2,061 (+3.1%)     | 2,060 (+3.0%)     | 2,060 (+3.0%)  |

- **First replies.** In run 3 they missed by 13% on average (3–29%), with high and xhigh 21% and 29% over. Run 4's four that compiled missed by 5% on average (2.5–7.3%). The counting rules are the likely reason; it is one run each.
- **Repairs.** Repairs now see the size line. Medium used it to go from −7.3% to +0.4% while fixing its fence. Low drifted from −2.5% to +4.4%. Xhigh's +9.8% is the widest miss, and it never had a count to correct because its first reply did not compile.
- **Size score and attempts.** All five accepted builds landed within 10% of the target and three within 3%. Run 3 kept every build inside ±5%, but only by refusing the first replies that missed it.

## Four runs compared

The same brief, model and efforts; one run each, so treat differences of a step or two with care. Wall times were measured with five runs at once on a loaded shared VM.

| effort | 1: no list, no search         | 2: list, search, colour errors | 3: + geometry rules, located errors | 4: + target as a score, counting rules, reach |
| ------ | ----------------------------- | ------------------------------ | ----------------------------------- | --------------------------------------------- |
| low    | yes · 2 attempts · 4 min · 8k | yes · 5 · 14 min · 23k         | yes · 2 · 5 min · 9k                | yes · 2 · 5 min · 11k                         |
| medium | yes · 4 · 12 min · 23k        | yes · 3 · 13 min · 21k         | yes · 2 · 7 min · 13k               | yes · 2 · 8 min · 15k                         |
| high   | yes · 3 · 18 min · 36k        | yes · 4 · 47 min · 82k         | yes · 2 · 19 min · 34k              | yes · 2 · 16 min · 31k                        |
| xhigh  | yes · 2 · 27 min · 20k        | **no** · 5 · 93 min · 142k     | yes · 2 · 25 min · 42k              | yes · 2 · 29 min · 50k                        |
| max    | yes · 2 · 56 min · 73k        | yes · 3 · 112 min · 102k       | yes · 2 · 37 min · 46k              | yes · **1** · 31 min · 61k                    |

(accepted · attempts · wall time · output tokens)

Run 4 costs about the same as run 3. The counting rules and longer prompt add some reasoning (max spent 51k reasoning tokens in its single reply, against 24k across two in run 3). The repairs it needed were overlaps and one schema refusal, never the size. The repairs still resend the whole script: 4,600–9,200 output tokens each.

Files per effort: `build.json` (the accepted script), `result.json` (every attempt: outcome, errors sent back, parts, seconds, tokens, searches and part knowledge) and three views; [summary.md](summary.md) is the runner's own table.

## low

2,088 parts: a pagoda with dark-blue and red patterned walls rising beside the hall, a red-pillared hall under a broad hip roof, stone lanterns and a walled lawn with conifers and bamboo.

![low, three-quarter view](low/iso.png)

| front                        | back three-quarter             |
| ---------------------------- | ------------------------------ |
| ![low, front](low/front.png) | ![low, back](low/iso-back.png) |

## medium

2,007 parts: a four-roofed pagoda with dark-blue roofs and lattice balconies, a white-and-timber hall with a gabled porch, a pond, bamboo, lanterns and paved paths on tan ground.

![medium, three-quarter view](medium/iso.png)

| front                              | back three-quarter                   |
| ---------------------------------- | ------------------------------------ |
| ![medium, front](medium/front.png) | ![medium, back](medium/iso-back.png) |

## high

2,031 parts: a three-roofed pagoda over a white base with red quoins, a red-pillared hall with a porch and gold roof finials, a gate, a pond with a bridge and paired lanterns.

![high, three-quarter view](high/iso.png)

| front                          | back three-quarter               |
| ------------------------------ | -------------------------------- |
| ![high, front](high/front.png) | ![high, back](high/iso-back.png) |

## xhigh

2,195 parts: a three-storey dark-red pagoda on a timber veranda, a brown timber hall with a hip-and-gable roof, a red gate, a raked gravel garden with stones, conifers and bamboo.

![xhigh, three-quarter view](xhigh/iso.png)

| front                            | back three-quarter                 |
| -------------------------------- | ---------------------------------- |
| ![xhigh, front](xhigh/front.png) | ![xhigh, back](xhigh/iso-back.png) |

## max

2,060 parts, accepted first time: a three-storey pagoda with red columns, bracketed eaves and a ringed gold spire, a red-columned hall with flared hip corners, a gate pavilion, a pond, bamboo, trees and stone lanterns.

![max, three-quarter view](max/iso.png)

| front                        | back three-quarter             |
| ---------------------------- | ------------------------------ |
| ![max, front](max/front.png) | ![max, back](max/iso-back.png) |
