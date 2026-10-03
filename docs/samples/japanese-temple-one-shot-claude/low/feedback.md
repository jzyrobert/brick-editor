I only remember the final session, so for attempts 1–4 I'm working from your log and the attempt-4 script, not recollection.

**1. Prompt**

- **Most important gap: how many parts an op costs.** Nothing tells me what an op produces in parts. Examples of what I needed:

  - a `room` 24×24 plates×18 is roughly 600 parts;
  - a `box` with `texture: "masonry"` costs more than a plain one;
  - a `hip` roof 24×18 is roughly 80 parts;
  - a `lantern` instance is about 7.

  Without this, the 1,900–2,100 band is a guessing game. A short table of typical op costs, or "about 1 part per 2 wall studs per brick course," would have saved most of my attempts.

- **Contradictory "how to build well" guidance.** "Avoid `interior: fill`" and "1-stud walls, hollow interiors" push counts down. The budget pushes them up. The prompt never says which lever to use when under budget. The answer seems to be "add buildings and detail, not solid fill," and saying so would help.
- **Wasted space.** The opening "Searching for parts" section is fine. The long "Look like a LEGO design" statistics (13 tiles per 100 parts, etc.) are hard to turn into ops; I mostly ignored them. Per-op recipes would be more useful, e.g. "string course = this `floor` op."
- **Unclear points:**
  - In `room.openings`, the example uses `door`, `opens` and `frame`, but the op spec lists `fill` and doesn't mention `door`.
  - Whether `column` with `cap` adds parts.
  - Whether `top: "tile"` on a `box` tiles the whole top or only the rim.

**2. Part list**

- Footprints and colour availability were useful. I never hit a colour error after attempt 1, which was a 6255 in White.
- **Missing: physical reach.** Trees overhang their footprint, and that caused the attempt-1 overlap between the pine and the plant. The prompt says "keep a stud clear," but a per-part "reach" field would be precise.
- **Other wants:** which slopes the `roof` op picks, and how many parts it typically uses.
- For a temple, the list lacked anything thematic: curved eaves, roof tiles, bells, incense burners. That's where search should have come in, and I didn't use it.

**3. Search**

- I made zero searches. At low effort I treated the list plus `{"find": …}` as enough. That was a failure in my process.
- Partly, the protocol caused it. Replying with a bare JSON message feels like spending a turn, and it's easy to skip. As a real tool call, I'd probably have used it for "bell," "curved roof," and "torii."
- I can't judge result quality since I didn't see any.

**4. Errors and repairs**

- **Most actionable message:** the under-budget message with a per-section breakdown. Knowing "Main hall 828, Site 273…" let me see where parts went and how much to add.
- **What it lacks:** suggested remedies, e.g. "a lantern instance ≈ 7 parts, a 6×12 room ≈ 200." I had to infer costs by diffing attempts.
- **The overlap message** gave coordinates with half-studs ("[2.5, 0, 13.5]"). That's the part centre, not the `at` I wrote. Reporting the source op index and its `at` would map back to my script faster.
- **The colour message** was perfect: it gave the colours the part does come in.

**5. Why my attempts failed**

- **Every rejection was under-budget**, plus one colour error and one overlap in attempt 1. I underestimated badly at first (822 parts). Then I crept up in increments: +534, +271, +237, +50.
- Each time I added roughly what the error asked, not a margin. In attempt 5 I added 10 lanterns, estimating ~70 parts, and landed at 1,914, barely inside the band.
- The right move was to aim for the 2,000 target with a safety margin from the start. Per-op cost guidance, or a dry-run count, would have prevented four of the five attempts.

**6. Hardest to reason about without compiling**

- **Part counts, by far.**
- **Second: overlaps** between instances and other parts. I hand-checked lantern rectangles against tree footprints and fences, which is error-prone.
- **Third: roof heights.** Stacked pagoda roofs at 9-plate intervals needed me to trust that the roof's top (≈ `at.y + 3n + 3`) cleared the next tier.
- **What would help most in one pass:**
  - a cost formula per op;
  - a worked example annotated with the part count per op;
  - an explicit "occupied rectangles" checklist habit.

**7. Three changes, most important first**

1. **A count-only preflight tool**, or failing that, a per-op part-cost table in the prompt, with the advice "aim for the target, not the floor."
2. **Make `parts_search` a real tool call** and nudge its use for themed details, so builds aren't just generic boxes.
3. **Error messages that point back to the script:** op path plus my original `at` for overlaps, and for budget errors a suggested fix sized to the gap.
