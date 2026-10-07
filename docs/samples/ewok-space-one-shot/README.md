# Ewok Classic Space one-shots (Opus 5.5)

The brief "ewok inspired version of the classic 1970s lego space sets", run on 7 October 2026 with `npm run oneshot -- --runner claude --model claude-opus-5-5 --efforts high --attempts 5 --parts-list on --search on` (checks on). These were published to the gallery as `3b95f8e1f971` (1,000 parts) and `1570abb271a7` (3,000) and are now hidden there in favour of the [creative-prompt runs](../creative-prompt-comparison/README.md); `opus-1000-creative` was the first try of the creative prompt and was not published.

| Folder                                    | Prompt   | Target | Parts | Replies | Seconds | Output tokens | Searches | Title                                               |
| ----------------------------------------- | -------- | -----: | ----: | ------: | ------: | ------------: | -------: | --------------------------------------------------- |
| [opus-1000](opus-1000/)                   | current  |  1,000 | 1,000 |       1 |     366 |        36,820 |        0 | Endor Outpost: Ewok Star Base                       |
| [opus-3000](opus-3000/)                   | current  |  3,000 | 3,029 |       1 |     601 |        62,071 |        5 | Endor Outpost: Classic Space meets the Ewok Village |
| [opus-1000-creative](opus-1000-creative/) | creative |  1,000 | 1,008 |       1 |     592 |        57,081 |       15 | Endor Star Outpost                                  |

Both current-prompt builds read as the same idea at two sizes: treehouse huts on stilts, walkways, round tree tops and a boxy blue ship on a pad. The creative prompt's build searched for Classic Space parts (canopy, radar dish, crater baseplate, logo) and added a campfire, barrels, a stream and a ship with a trans-yellow canopy, but kept the treehouse layout and flat plate canopies.

Each folder holds `build.json`, the model's `build.js`, `result.json` and the three renders as WebP. One warning each (floating parts) and no errors.
