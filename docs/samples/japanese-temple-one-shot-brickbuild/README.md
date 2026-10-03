# One-shot sample in brick.build code, with checks: a Japanese Buddhist temple

The fifth GPT-6.1-Sol run of the temple brief. The reply is now [brick.build](../../AGENT-BUILDING.md#brickbuild) code instead of a build script JSON, after MineBench's `voxel.exec`, and the model may compile up to three drafts before it answers. Made on 3 October 2026:

```sh
npm run oneshot -- --target-parts 2000 --brief "a japanese buddhist temple" \
  --model gpt-6.1-sol --efforts low,medium,high,xhigh,max --attempts 5 --parts-list on --search on --check on
```

What changed since the [fourth run](../japanese-temple-one-shot-target/README.md):

- **The reply is code.** `{"tool": "brick.build", "input": {"code": …}}`: JavaScript that calls one helper per op (`room({...})`, `roof({...})`, `place({...})`), `section`, `component` and `script`, run once in a sandbox. The [prompt](prompt.md)'s Output and Example sections are [brick-build.md](../../../prompts/brick-build.md)'s; the cottage example is the same build in code.
- **Checks.** Before answering the model may reply `{"check_build": {"code": …}}` up to 3 times per attempt and get back the count against the target, each section's count and every error with the code line that made it (`[sections[1].ops[30] (code line 6)]`).
- **Prompt facts the Opus interviews asked for**, checked against the compiler: which way parts face at `turn: 0` and which way `turn` turns; how parts stand (studs below, or hanging under a plate; nothing holds on a placed tile; only a slope's stud row); every opening field (`frame`, `glass`, `door`, `opens`) and the raised inward door; `box` lids and `interior`; `top: "tile"` replaces the top layer; `instance.at` is [x, y, z] and what may hold an `instance`; `stairs` and `scatter` in full.
- **Counting rules recalibrated** on the ten run-4 builds (GPT-6.1-Sol's and Opus 5.5's): openings in textured walls, one-brick textured podiums (solid all through), hip roofs with holes (1 part per 4.5 studs), parts set into walls and slabs; the blanket +15% is gone. On those ten builds the old rules missed by 15% on average and the new ones by about 3%, fitted to the same builds.
- **Parts:** reach is listed whenever the overlap check could see it (30 parts, trees included; 3470 and 3471 had none before), colours use the Colours section's names everywhere, and search puts building parts before minifigure, Duplo and printed parts ("lantern" no longer returns Green Lantern torsos).

Everything else is as in run 4: GPT-6.1-Sol through `codex exec` with every Codex tool off, the 224-part list, parts search by reply, the target as a score, MineBench-style repairs, up to 5 attempts, warnings not sent back, renders afterwards in the Realistic look. Three things changed at once (prompt, code replies, checks), so this run shows where they lead together, not which one did it.

## Results

| effort            | parts (vs 2,000) | attempts | checks: parts (errors)            | wall time | output tokens (reasoning) | code   | searches | part numbers (outside the list) | colour errors |
| ----------------- | ---------------- | -------- | --------------------------------- | --------- | ------------------------- | ------ | -------- | ------------------------------- | ------------- |
| [low](#low)       | 1,998 (−0.1%)    | **1**    | 1,884 (17)                        | 2 min     | 6,038 (502)               | 4.6 kB | 0        | 7 (0)                           | 0             |
| [medium](#medium) | 2,170 (+8.5%)    | **1**    | –                                 | 5 min     | 7,905 (3,050)             | 6.2 kB | 0        | 12 (0)                          | 0             |
| [high](#high)     | 2,066 (+3.3%)    | **1**    | 2,322 (10), 2,085 (0), 2,066 (0)  | 13 min    | 58,601 (30,573)           | 6.8 kB | 0        | 13 (0)                          | 0             |
| [xhigh](#xhigh)   | 2,039 (+2.0%)    | **1**    | 2,231 (14), 2,085 (0), 2,039 (0)  | 22 min    | 96,099 (59,588)           | 8.8 kB | 3        | 19 (1)                          | 0             |
| [max](#max)       | 2,000 (±0%)      | **1**    | did not run, 2,488 (0), 1,929 (0) | 45 min    | 168,981 (126,200)         | 11 kB  | 5        | 31 (1)                          | 0             |

Every effort was accepted on its first reply, for the first time in five runs; in run 4 only max was. The accepted builds missed the target by 2.8% on average (0–8.5%), against 3.8% in run 4 and 14% for [Opus 5.5 under run 4's rules](../japanese-temple-one-shot-claude-target/README.md).

- **Checks did the repairing.** High's and xhigh's first drafts had 10 and 14 errors and were 16% and 12% over; their second drafts were clean at +4.3%, and the third trimmed them to the counts they answered with. Max's first check did not run (below), its second was clean but 24% over and its third 1,929 (−3.5%); its answer, unchecked, landed on 2,000 exactly. Low checked once (17 errors: overlaps and a pearl-gold round brick, which is not made in that colour), then answered with every error fixed without checking again. Medium never checked and landed furthest off (+8.5%).
- **Errors** in the first drafts were again mostly reach (6255 leaves and 2435 pines into tiles and bricks) and colours; none reached an answer.
- **Max's first check did not run**: openings written as `cond && {…}` left `false` inside an `openings` list. brick.build dropped `null` and `false` from op lists only, so the schema refused it; max fixed it on the next check. It now drops them from `openings` and `holes` too.
- **Code is compact**: 4.6–11 kB of code made scripts of 37–78 kB. Most of it was written as long one-line functions (`function curledRoof(x,y,z,w,d,holes=[]){…}`), so a code line names a whole function rather than an op.
- **Searches**: xhigh and max looked for a bell, a statuette (90398, the minifigure statuette, as the Buddha) and roof ornaments; low to high did not search.
- **Tokens**: low and medium used fewer output tokens than in run 4 (6k and 8k against 11k and 15k); high to max used 2–3 times as many (59k–169k against 31k–61k), most of it reasoning around the checks.

## Against run 4

| effort | run 4: parts · attempts · time · tokens | run 5 (brick.build + checks): parts · attempts · time · tokens |
| ------ | --------------------------------------- | -------------------------------------------------------------- |
| low    | 2,088 (+4.4%) · 2 · 5 min · 11k         | 1,998 (−0.1%) · 1 · 2 min · 6k                                 |
| medium | 2,007 (+0.4%) · 2 · 8 min · 15k         | 2,170 (+8.5%) · 1 · 5 min · 8k                                 |
| high   | 2,031 (+1.6%) · 2 · 16 min · 31k        | 2,066 (+3.3%) · 1 · 13 min · 59k                               |
| xhigh  | 2,195 (+9.8%) · 2 · 29 min · 50k        | 2,039 (+2.0%) · 1 · 22 min · 96k                               |
| max    | 2,060 (+3.0%) · 1 · 31 min · 61k        | 2,000 (±0%) · 1 · 45 min · 169k                                |

The builds look more designed: helper functions for roof tiers, brackets and lanterns gave xhigh and max curled corner eaves (inverted slopes, a plate and a curved slope at each corner) and ringed spires, and max a raked gravel garden, cherry trees and a koi pond. One run each; treat single-effort differences with care.

Files per effort: `build.js` (the accepted code), `build.json` (the build script it made), `result.json` (every attempt and check: outcome, parts, errors, seconds, tokens, searches and part knowledge) and three views.

## low

1,998 parts: a three-storey pagoda in tan masonry with dark-red posts and a gold spire, a hip-roofed worship hall with yellow-lit windows, four stone lanterns along a paved path, raked gravel beds and a low wall.

![low, three-quarter view](low/iso.png)

| front                        | back three-quarter             |
| ---------------------------- | ------------------------------ |
| ![low, front](low/front.png) | ![low, back](low/iso-back.png) |

## medium

2,170 parts: a stone-walled precinct with a mountain gate, a vermilion hall with dark-brown posts on a stone terrace, a three-storey pagoda on a plinth with a nine-ring gold finial, stone lanterns and pines in gravel.

![medium, three-quarter view](medium/iso.png)

| front                              | back three-quarter                   |
| ---------------------------------- | ------------------------------------ |
| ![medium, front](medium/front.png) | ![medium, back](medium/iso-back.png) |

## high

2,066 parts: a five-storey pagoda with a gold spire, a gable-roofed prayer hall with a veranda of red posts, a roofed gate with stone lanterns, a bell pavilion, a pond and plants on a sand ground.

![high, three-quarter view](high/iso.png)

| front                          | back three-quarter               |
| ------------------------------ | -------------------------------- |
| ![high, front](high/front.png) | ![high, back](high/iso-back.png) |

## xhigh

2,039 parts: a tall five-storey pagoda with curled corner eaves, gold ornaments and a ringed sōrin, a double-roofed worship hall with red posts and white walls, a guardian gate, a lotus pond with a bridge and a walled lawn.

![xhigh, three-quarter view](xhigh/iso.png)

| front                            | back three-quarter                 |
| -------------------------------- | ---------------------------------- |
| ![xhigh, front](xhigh/front.png) | ![xhigh, back](xhigh/iso-back.png) |

## max

2,000 parts: a three-storey pagoda with curled eaves and a gold finial, a two-roofed Kondō in dark-brown timber with lattice railings, a red Sanmon gate, a raked Zen garden, cherry trees, a koi pond with a red bridge, bamboo and a stone lantern.

![max, three-quarter view](max/iso.png)

| front                        | back three-quarter             |
| ---------------------------- | ------------------------------ |
| ![max, front](max/front.png) | ![max, back](max/iso-back.png) |
