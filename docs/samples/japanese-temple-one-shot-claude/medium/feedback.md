I only see the last repair in this session (attempt 3 to 4). What I say about attempts 1–2 comes from your summary, not memory.

**1. Prompt**

The biggest gap is cost. Nothing tells me roughly how many parts an op produces, and the budget is a hard ±5% window. Over three attempts my part count went 1804, 2238, 2111, 2015, which is what estimating blind looks like. It would help to have a short table of approximate costs:

- a `column` of height h and diameter 1 is about h/3 parts;
- a `box` shell is roughly its perimeter × courses ÷ 2.5;
- a roof costs about so many parts per square stud.

The error message did itemise the costliest ops (`sections[4].ops[0] 213`, `sections[3].ops[6] 180`), but only after the fact.

Things I'd cut or tighten:

- **Colour list.** "Common colours" is repeated in every part line. One legend would save a lot of tokens.
- **"Look like a LEGO design."** It is useful, but in the Bands bullet the `floor` ring with `holes` reads ambiguously next to the rule "a hole's `at` is in the same coordinates".
- **Contradictory openings syntax.** The example uses `door: "blue"` and `frame` inside `room.openings`, but the openings spec lists `{side, at, width, y?, height?, fill?}` and doesn't mention `door`, `frame` or `opens`. I copied the example's style; the spec should list those fields.

Things I'd add:

- what `stairs` does with `rise`/`run`;
- whether `column` cuts into massing at the corners of a `box` (I relied on "parts take cells from massing", but it was a guess).

**2. Part list**

Footprints and heights were the most useful part. Colour availability was fine. What it lacked:

- **Reach.** Attempt 1 failed on an overlap between 6255 (plant) and a wall: the plant's reach goes beyond its 1×1 footprint, and the list doesn't say by how much. A reach column for irregular parts (plants, trees, flags, antennas) would have prevented that.
- **Connection behaviour.** Whether a 3941 round brick on a 3022 plate at an offset is legal; whether a 3031 at [-1, 10, -1] hanging over a 2-wide lantern body is supported. I just assumed.

**3. Search**

I made zero searches in every attempt. Everything I needed seemed to be in the list, and a search reply costs a turn. A tool call would lower that barrier. I'd have used one to check a stone lantern, bell or torii part if I hadn't had to give up a turn to do it.

**4. Errors and repairs**

The over and under budget messages were the most actionable. They give the exact deficit, a per-section breakdown and the costliest ops by index. That let me fix attempt 3 by thinning repeat counts on the perimeter columns (back wall 15→8, sides 14→7) for a predicted 40–45 part saving, and it landed at 2015.

Two things would make them better:

- a per-op cost for repeats (e.g. "repeat of 15 columns = 30 parts"), so I can trim surgically;
- for the overlap message, the plant's reach box, a suggested clearance, and why a plant at y=1 hit a brick at y=3 (the plant's reach was evidently taller and wider than its listed 5 plates).

**5. Why my attempts failed**

- **Attempt 1:** under budget, plus a decoration placed too close to the back wall.
- **Attempt 2:** overcorrected by about 230 parts, probably by roofing and columning the whole perimeter wall at once (Perimeter wall went 307→732).
- **Attempt 3:** still 11 over.

The root cause was having no way to estimate part counts before submitting. A per-op cost guide, or a cheap "count only" dry run, would have prevented all three. The overlap would have been prevented by reach data or a stated clearance rule for plants specifically (the "keep a stud clear" rule exists, but I evidently placed it within reach of the wall).

**6. Hardest to reason about**

1. **Part counts:** by far the hardest.
2. **Roofs:** where a hip roof's slopes actually land relative to columns and walls. I put timber columns at x=11 and x=36 just outside the hall room, under a 28-wide hip with overhang. Whether they collide with eaves depends on the course formula, which I didn't fully work through.
3. **Nested pagoda tiers:** whether each tier's `holes` covered the next tier's box and columns exactly.

For one-pass work, the most useful additions would be a worked roof example with numbers (eave extents and course footprints) and a cost table.

**7. Three changes, most important first**

1. **Part-count estimate.** Either a dry-run/count tool, or a per-op cost formula table in the prompt. This alone would have saved three of my four attempts.
2. **Reach and clearance data.** Add it for irregular parts (plants, trees, flags), and report it in overlap errors along with a suggested fix.
3. **Make search a real tool call, and consolidate the prompt.** That means one colour legend instead of per-part repetition, and openings syntax that matches the example (`door`, `frame`, `opens`).
