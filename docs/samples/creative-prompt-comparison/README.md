# Creative prompt comparison: four briefs, two prompts, two models

Run on 7 October 2026 with `npm run oneshot` (`--efforts high --attempts 5 --parts-list on --search on`, checks on), Claude Opus 5.5 through Claude Code (`--runner claude --model claude-opus-5-5`) and GPT-6.1-Sol through Codex (`--model gpt-6.1-sol`), each with the current prompt ([`prompts/build-agent.md`](../../../prompts/build-agent.md), "standard") and the creative variant ([`prompts/build-agent-creative.md`](../../../prompts/build-agent-creative.md), `--prompt build-agent-creative.md`). The temple and ewok briefs were then run with the creative prompt only. The twelve creative builds are the ones [the gallery](../../GALLERY.md#what-is-published) shows.

The creative variant borrows from MineBench's system prompt (`lib/ai/prompts.ts` in [Minebench](https://github.com/Ammaar-Alam/minebench)): it tells the model that people compare its build with another model's and vote, lists the judging criteria (idea, recognisability, fidelity, 3D form, scene and story, detail, playability) and the patterns that lose (the first idea, visible primitives, building every subject as a house, a subject on its own, symmetry everywhere, uniform detail), and asks for three concepts, a story, a parts plan and a failure check before any code. It also turns the part target into a ±15% range, searches for the theme's signature parts first, and limits the townhouse facade guidance to buildings. It drops MineBench's threat to shut the losing model down.

Each folder holds the accepted `build.json`, the model's `build.js` (its brick.build code), `result.json` (attempts, tokens, searches, checks) and the three renders as WebP.

| Folder                                                                    | Target | Parts | Replies | Seconds | Output tokens | Searches | Checks | Title                                               |
| ------------------------------------------------------------------------- | -----: | ----: | ------: | ------: | ------------: | -------: | -----: | --------------------------------------------------- |
| [opus-pelican-bicycle-800-standard](opus-pelican-bicycle-800-standard/)   |    800 |   813 |       1 |     489 |        49,867 |        0 |      2 | Pelican Riding a Bicycle                            |
| [opus-pelican-bicycle-800-creative](opus-pelican-bicycle-800-creative/)   |    800 |   760 |       1 |     941 |        91,379 |        5 |      3 | Pelican Express: the fish courier of Pier 7         |
| [sol-pelican-bicycle-800-standard](sol-pelican-bicycle-800-standard/)     |    800 |   807 |       1 |     527 |        31,216 |        0 |      2 | Pelican Pedal Parade                                |
| [sol-pelican-bicycle-800-creative](sol-pelican-bicycle-800-creative/)     |    800 |   852 |       1 |     648 |        55,862 |       10 |      3 | The Fish Pedal Express                              |
| [opus-star-destroyer-5000-standard](opus-star-destroyer-5000-standard/)   |  5,000 | 7,888 |       2 |     411 |        39,220 |        4 |      0 | Imperial Star Destroyer                             |
| [opus-star-destroyer-5000-creative](opus-star-destroyer-5000-creative/)   |  5,000 | 4,813 |       1 |   1,235 |        83,744 |        5 |      2 | Imperial Star Destroyer: Launch Day at Kuat Drydock |
| [sol-star-destroyer-5000-standard](sol-star-destroyer-5000-standard/)     |  5,000 | 4,947 |       1 |     389 |        37,598 |        0 |      2 | Imperial Star Destroyer — Devastator                |
| [sol-star-destroyer-5000-creative](sol-star-destroyer-5000-creative/)     |  5,000 | 4,844 |       1 |     927 |        78,934 |       10 |      3 | Devastator — The Capture of Tantive IV              |
| [opus-dragon-1000-standard](opus-dragon-1000-standard/)                   |  1,000 |   994 |       1 |     354 |        35,085 |        5 |      2 | Red Dragon Guarding its Hoard                       |
| [opus-dragon-1000-creative](opus-dragon-1000-creative/)                   |  1,000 | 1,064 |       3 |     823 |        88,241 |        0 |      0 | Ember Peak: The Hoard Awakens                       |
| [sol-dragon-1000-standard](sol-dragon-1000-standard/)                     |  1,000 | 1,051 |       1 |     560 |        52,182 |        3 |      3 | The Embercrest Dragon                               |
| [sol-dragon-1000-creative](sol-dragon-1000-creative/)                     |  1,000 | 1,138 |       1 |   1,047 |        81,234 |       10 |      3 | Cinderkeeper — The Last Egg                         |
| [opus-piplup-1000-standard](opus-piplup-1000-standard/)                   |  1,000 |   540 |       2 |     279 |        28,075 |        0 |      0 | Piplup                                              |
| [opus-piplup-1000-creative](opus-piplup-1000-creative/)                   |  1,000 |   936 |       1 |     831 |        81,764 |        5 |      1 | Piplup's Big Catch at Lake Acuity                   |
| [sol-piplup-1000-standard](sol-piplup-1000-standard/)                     |  1,000 | 1,000 |       1 |     572 |        40,716 |        0 |      3 | Piplup on an ice floe                               |
| [sol-piplup-1000-creative](sol-piplup-1000-creative/)                     |  1,000 | 1,056 |       1 |     658 |        55,987 |        3 |      3 | Piplup's Bubble-Berg                                |
| [opus-japanese-temple-2000-creative](opus-japanese-temple-2000-creative/) |  2,000 | 1,819 |       1 |     995 |       101,981 |       10 |      2 | Kiyomizu Stage in Autumn                            |
| [sol-japanese-temple-2000-creative](sol-japanese-temple-2000-creative/)   |  2,000 | 2,195 |       1 |     734 |        90,941 |        5 |      3 | Moonwater Temple — The Evening Bell                 |
| [opus-ewok-space-3000-creative](opus-ewok-space-3000-creative/)           |  3,000 | 2,680 |       1 |     936 |        67,348 |       15 |      3 | Endor Outpost LL-918: the Ewok Galaxy Explorer      |
| [sol-ewok-space-3000-creative](sol-ewok-space-3000-creative/)             |  3,000 | 3,294 |       1 |     830 |       103,558 |       10 |      3 | Yub-Nub 1978: Moonwood Space Village                |

Briefs: "a pelican riding a bicycle", "imperial star destroyer", "a dragon", "piplup", "a japanese buddhist temple", "ewok inspired version of the classic 1970s lego space sets". All twenty were accepted with no errors; the compiler's warnings are floating parts (20), parts off the stud grid (10) and parts that clash with a neighbour's shape (4).

## What changed

One run per cell, judged by eye, so this is a signal rather than a result.

- **Every creative build is a scene with a story**: the pelican is a fish courier on a pier, the Star Destroyer is captured mid-boarding with TIE fighters around it or launched from a drydock, the dragon guards an egg or a hoard, Piplup is fishing with a Poké Ball and a sled. With the current prompt most builds were the subject on a base, titled plainly ("Piplup", "Imperial Star Destroyer").
- **The models searched for theme parts.** GPT-6.1-Sol searched 3–10 times a build instead of 0–3; Opus's ewok build searched for a windscreen canopy, radar dish, crater baseplate and Classic Space logo and used them.
- **Opus's counts steadied.** Its two large misses (+58% on the Star Destroyer, −46% on Piplup) were with the current prompt; with the creative prompt every build of both models landed within ±11% (the range is now ±15%).
- **It costs about twice as much**: 1.5–3× the time and 1.5–2.6× the output tokens; every run finished in under 21 minutes.
- **The scene can upstage the subject.** Opus's Star Destroyer sits in a drydock whose gantries hide its wedge, and Sol's dragon reads as a dark tower in a lava lair; Sol's current-prompt green dragon is the most recognisable dragon of the four.
- **Organic subjects stay blocky.** The pelicans, dragons and Piplups are as stepped as before: asking to avoid visible primitives does not give the model curved shapes or a way to see its own draft.

The earlier Ewok Classic Space runs (Opus 5.5 at 1,000 and 3,000 parts) are in [ewok-space-one-shot](../ewok-space-one-shot/README.md).
