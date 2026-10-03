I'll be candid. The script compiled first time, but it landed at 1,358 parts against a 2,000 target (−32%). My own tally said about 2,040, so the counting is where I most need help.

**1. Prompt**

What was unclear:

- **Hole coordinates.** The prompt says a hole's `at` is in the roof's frame, but `holes: [{at, size}]` takes two numbers while the roof's `at` is `[x, y, z]`. I inferred `[x, z]` absolute from the example (`[2, 3]` against a roof at `[-6, 21, -3]`). It reads as relative unless you study it. One explicit sentence would fix this: "hole `at` is `[x, z]` in the same absolute frame as the roof's x and z."
- **Nesting.** Whether `repeat` may contain `instance` is never stated. I relied on it for the pagoda tiers and only hoped.
- **Room opening fields.** `door`, `frame` and `opens` appear on room openings in the example but are missing from the `room` signature in the Ops list.
- **Roof ridge default.** Which axis the ridge runs along when you don't set it is never said.

What was missing:

- How `texture` interacts with `room` openings and with `quoins`.
- Whether a `box` is closed on top by default. "plus its lid" implies yes, but it should be stated.
- How `scatter` density translates into a part count.

What I'd cut or trim:

- The "Look like a LEGO design" statistics, such as "13 1-wide tiles per 100 parts". I can't act on them through massing ops, so they don't change what I write.
- Much of the cheat sheet repeats the part list.

**2. Part list**

Footprints, heights and colour availability were the most useful thing in the prompt. I checked several colours against it, for example pearl gold for 3062b and trans yellow for the lantern lights.

What it lacked:

- **Which faces carry studs.** Is the top of a cone studded? Can a 2×2 cone rest on two diagonal 1×1 round bricks?
- **Whether hanging parts are possible.** I wanted a bell in the bell tower and dropped it because I couldn't tell.
- **Temple-specific parts.** Nothing for Japanese roofs: curved eaves, ridge ornaments, a stone lantern. I should have searched; that one is on me.

**3. Search**

I used zero searches. Partly that was low effort, and partly the reply-only protocol makes searching feel costly: it uses up a whole reply and forces a multi-turn plan.

A tool call would lower that barrier. I'd also want each result to include whether the part has studs on top, so I know if I can stack on it.

**4. Errors and repairs**

I got none, so I can't judge the error messages. What would have helped most is a dry-run check before acceptance that reports the part count and lists any warnings: floating parts, overlaps, unsupported nesting.

**5. Why I missed the count**

No attempt was rejected, but the count miss is the real failure. My best guesses at where the parts went missing:

- **Textured walls.** I assumed texture rules applied to whole perimeters, but openings and columns cut those walls.
- **Roofs with holes.** I counted the lower hip roof as about 120 parts and the pagoda roofs at 16 each; the outer rings probably compiled to fewer.
- **Rooms.** These may pack larger bricks than the "1 per 6" rule suggests.
- **The +15% fudge.** I applied it to everything, but it may not apply to textured walls.

What would have prevented it:

- A per-op cost table that covers textured rooms with openings and hip roofs with holes.
- Better still, a way to get the compiler's count for a section without spending an attempt.

**6. Hardest to reason about**

- **Roofs.** Courses, overhang, where the ring left by a hole ends, and whether the upper room clears the lower roof's slopes. I worked the arithmetic by hand and still wasn't sure.
- **Part counts**, as above.
- **Component frames combined with `repeat` offsets.** Doable, but error-prone.

A worked example of a tiered roof with a hole and a core rising through it would help most. Pagodas, temples and towers all need this.

**7. Three changes, most important first**

1. **A count and validation preview** that returns per-section part counts and warnings without consuming an attempt.
2. **A precise schema reference for every op**, including room opening fields, the hole frame, ridge defaults, box lid defaults, and what may nest inside `repeat`, `group` and components.
3. **Search as a real tool call**, with results that include stud and connection information and suggested parts for common architectural styles (Japanese, gothic and so on).
