# One-shot sample through Claude Code: a Japanese Buddhist temple with Opus 5.5

The [third run](../japanese-temple-one-shot-geometry/README.md) of the temple brief repeated with Claude Opus 5.5 through Claude Code instead of GPT-6.1-Sol through Codex. Made on 3 October 2026 with the same prompt (byte for byte: [prompt.md](prompt.md)), part range, attempts and checks:

```sh
npm run oneshot -- --runner claude --target-parts 2000 --leeway 5 --brief "a japanese buddhist temple" \
  --model claude-opus-5-5 --efforts low,medium,high,xhigh,max --attempts 5 --parts-list on --search on
```

How Claude Code was run: `claude -p --model claude-opus-5-5 --effort <effort> --tools "" --safe-mode --strict-mcp-config --disable-slash-commands --output-format json`, from an empty folder per effort. That is Claude Code's own system prompt with every tool off and no user customisation (CLAUDE.md, memory, skills, plugins, hooks, MCP servers). Messages go in on stdin; search replies are answered in the same session (`--resume`), as with `codex exec resume`. `CLAUDE_CODE_MAX_OUTPUT_TOKENS` is raised to 128,000, the model's limit. Each attempt still starts a fresh session with MineBench's repair prompt; warnings are not sent back; renders were made afterwards, for this page only, with the Realistic look.

**Rules at the time.** This run used run 3's rules (commit c004c82), where a count outside 1,900–2,100 was an error sent back for repair. The [fourth run](../japanese-temple-one-shot-target/README.md), made the same day, made the target a score instead of a gate, added counting rules and per-op costs to the prompt, and gave irregular parts their reach in the part list and overlap messages. It also removed `--leeway`, so the command above now runs without it and under the new rules. Several of the requests below are already answered by run 4.

## Results

| effort            | accepted | parts | attempts | wall time | output tokens (thinking) | cost   | searches | finds | part numbers (outside the list) | colour errors |
| ----------------- | -------- | ----- | -------- | --------- | ------------------------ | ------ | -------- | ----- | ------------------------------- | ------------- |
| [low](#low)       | yes      | 1,914 | 5        | 4 min     | 26,924 (10,091)          | $1.66  | 0        | 0     | 6 (0)                           | 1             |
| [medium](#medium) | yes      | 2,015 | 4        | 13 min    | 87,745 (51,650)          | $2.79  | 0        | 0     | 15 (0)                          | 0             |
| [high](#high)     | yes      | 1,921 | 2        | 19 min    | 117,537 (97,485)         | $2.84  | 0        | 0     | 24 (0)                          | 0             |
| [xhigh](#xhigh)   | yes      | 2,015 | 2        | 42 min    | 258,870 (237,711)        | $6.36  | 10       | 0     | 19 (0)                          | 0             |
| [max](#max)       | yes      | 1,989 | 2        | 51 min    | 334,484 (310,447)        | $13.18 | 10       | 0     | 18 (2)                          | 0             |

Cost is what Claude Code reports at list prices (about $27 for the run); wall time is the model's time, five efforts at once on the shared VM.

Every effort was accepted and every reply compiled: no schema errors. What the rejected replies got wrong:

| effort | rejected replies                                                                                                                                                                                                  |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| low    | 822 parts (1,078 under), a white Plant 1 × 1 Large Leaves (not made in white), plants into a pine and each other; then 1,356, 1,627 and 1,864 parts, each still under: it added about what was missing, no margin |
| medium | 1,804 parts (96 under) and plants into a wall; then 2,238 (138 over) and 2,111 (11 over)                                                                                                                          |
| high   | 2,166 parts (66 over); plants into a wall and a lantern                                                                                                                                                           |
| xhigh  | in range (2,015); plants in front of the cloister into its posts and windows                                                                                                                                      |
| max    | in range (1,989); two pines flush against a wall and a lawn                                                                                                                                                       |

- **Part counts** were Opus's main failing at low and medium: 6 of the 7 rejected low and medium replies were out of range. High was over by 66; xhigh and max landed in range first time.
- **Overlaps** came from one gap, the same one run 3 found with bamboo: irregular parts list their attachment footprint, not their reach. Plant 1 × 1 Large Leaves (6255) is listed as 1 × 1 studs and 5 plates; the compiler's box is about 4 × 4 studs and 5½ plates. Four of the five efforts hit it, xhigh after following "keep a stud clear around them" to the letter. Max's pines (listed 3 × 3) sit half a stud off their `at`.
- **Searching:** xhigh and max each made two rounds of five searches before their first build (stone lantern, bell, cherry blossom, bonsai, pearl-gold dish, rock, grille brick…). Max used two library parts it found that way, Brick 2 × 2 Round with Grille (92947) and Cylinder 2 × 2 × 1.667 with Dome Top (30151a); both built bright-pink cherry trees from 2417 and 2423. Low to high did not search.
- **The output cap.** At xhigh and max the first build reply ran out at 128,000 output tokens while still thinking. Claude Code then sent its own continuation ("Output token limit hit. Resume directly…") and the model answered in a second turn; the runner logs this as `turns:2`. So those two replies were not strictly single requests, and their thinking (232,800 and 173,265 tokens in the build turn) exceeded what one reply allows.
- **Thinking scales with effort** far more than GPT-6.1-Sol's reasoning did: 10k at low to 310k at max, against 1k–28k. Repairs were cheap at every effort (0.2k–40k thinking).

## Against GPT-6.1-Sol (run 3)

The same prompt, part range and efforts; one run each, so treat differences of a step or two with care.

| effort | GPT-6.1-Sol via Codex (run 3) | Opus 5.5 via Claude Code |
| ------ | ----------------------------- | ------------------------ |
| low    | yes · 2 · 5 min · 9k          | yes · 5 · 4 min · 27k    |
| medium | yes · 2 · 7 min · 13k         | yes · 4 · 13 min · 88k   |
| high   | yes · 2 · 19 min · 34k        | yes · 2 · 19 min · 118k  |
| xhigh  | yes · 2 · 25 min · 42k        | yes · 2 · 42 min · 259k  |
| max    | yes · 2 · 37 min · 46k        | yes · 2 · 51 min · 334k  |

(accepted · attempts · wall time · output tokens, thinking included)

- Both models were accepted at every effort with no schema errors: the geometry rules and located errors carry over to a second model family.
- GPT-6.1-Sol needed two replies at every effort; Opus needed more at low and medium, where it under- and overshot the part range, and two from high up.
- Opus used 3–7 times the output tokens, nearly all of it thinking, and searched at xhigh and max where GPT-6.1-Sol (bar one `find`) did not.
- Both runs' rejected replies at high and above failed only on irregular parts' reach (bamboo for GPT-6.1-Sol, plants and pines for Opus).
- Opus's builds are more compound-like: walled precincts with cloisters, gates, a pagoda and a main hall, and from high up a five-storey pagoda modelled on Hōryū-ji.

## What the models said

After the run each effort's final session was resumed (same model, effort and settings) and asked run 2's seven questions ([the script](interview.sh); answers: [low](low/feedback.md), [medium](medium/feedback.md), [high](high/feedback.md), [xhigh](xhigh/feedback.md), [max](max/feedback.md)). Each remembers only its last attempt; the rest came from our summary. They agreed on:

1. **Part counts can't be estimated:** nothing says what an op costs in parts. All five asked for a dry-run count (or check) that does not use an attempt, or failing that a cost table per op; low and medium say it would have saved most of their rejected replies.
2. **Irregular parts need their real box:** 6255, 2435, 2417, 2423, 3470, 3471 and the flowers, in the part list and search results; "keep a stud clear" is too vague (6255 reaches 1½ studs).
3. **Overlap messages print the box corner, not the `at` written** ("at [26.5, 0, -8.5]" for a pine placed at [27, 0, -8]): print both. Max also wanted the part count and "N of M errors" with every error list; xhigh wanted every pair listed, not "5 pairs like this".
4. **The prompt contradicts itself on openings:** `room.openings` lists `{side, at, width, y?, height?, fill?}`, but the example uses `door`, `frame`, `glass` and `opens` (four of five noticed).
5. **Colour names differ** between the part list ("Light grey", "Clear") and the Colours section ("light bluish grey", "trans-clear"); "+N other colours" hides exactly what can't otherwise be checked.
6. Search would be used more as a tool call (low and medium skipped it as "spending a turn"). Max noted the Claude Code system prompt (ultrareview, fast mode, model IDs) is noise for this task; xhigh would trim the train and vehicle sections.

Files per effort: `build.json` (the accepted script), `result.json` (every attempt: outcome, errors sent back, parts, seconds, tokens with cost, searches and part knowledge), `feedback.md` and three views.

## low

1,914 parts: a hip-roofed main hall with dark-red posts and white panels, a five-tier pagoda, a side hall and rear corridor, a torii, rows of stone lanterns, a pond, conifers and a stone wall.

![low, three-quarter view](low/iso.png)

| front                        | back three-quarter             |
| ---------------------------- | ------------------------------ |
| ![low, front](low/front.png) | ![low, back](low/iso-back.png) |

## medium

2,015 parts: a walled precinct with a white-and-red perimeter wall, a sanmon gate, a hip-roofed main hall with a red gable porch, a three-storey pagoda with a gold finial, a bell tower, a purification fountain and lanterns.

![medium, three-quarter view](medium/iso.png)

| front                              | back three-quarter                   |
| ---------------------------------- | ------------------------------------ |
| ![medium, front](medium/front.png) | ![medium, back](medium/iso-back.png) |

## high

1,921 parts: a Hōryū-ji-style compound: a five-storey pagoda with a ringed spire, a two-roofed Kondō hall in red and white, a chūmon gate, a bell tower, a purification fountain, lanterns, red maples and pines.

![high, three-quarter view](high/iso.png)

| front                          | back three-quarter               |
| ------------------------------ | -------------------------------- |
| ![high, front](high/front.png) | ![high, back](high/iso-back.png) |

## xhigh

2,015 parts: a five-storey pagoda, a two-roofed hondō with timber-framed walls, a sanmon gate and roofed corridors round a paved courtyard with a bell pavilion and lanterns, and pink cherry trees.

![xhigh, three-quarter view](xhigh/iso.png)

| front                            | back three-quarter                 |
| -------------------------------- | ---------------------------------- |
| ![xhigh, front](xhigh/front.png) | ![xhigh, back](xhigh/iso-back.png) |

## max

1,989 parts: a Hōryū-style precinct: a tall five-storey pagoda, a long Kondō with red posts, a two-storey chūmon gate and cloisters, a bell tower, a temizuya, lanterns, an incense burner and a stupa, cherry and autumn trees.

![max, three-quarter view](max/iso.png)

| front                        | back three-quarter             |
| ---------------------------- | ------------------------------ |
| ![max, front](max/front.png) | ![max, back](max/iso-back.png) |
