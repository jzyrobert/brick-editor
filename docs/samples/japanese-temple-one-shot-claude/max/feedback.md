A caveat first: I only have this session, which was the repair turn. I saw the system prompt, attempt 1's JSON and its three overlap errors. I made no searches and don't remember designing attempt 1, so anything I say about search or the original design is inferred from its output.

**1. Prompt**

The rule that caused the failure is under-specified. Geometry rules › Parts ends with "Leaves, branches and other irregular parts can reach past their footprint: keep a stud clear around them." It doesn't say which parts are irregular, how far they reach, or in which direction. The later Massing and parts bullet ("Every part … takes its cells out of massing, whatever the op order") also suggests a part clears its own space, but it only clears its footprint. I'd add "parts carve only their footprint; any reach beyond it collides with massing and other parts", plus a short table of irregular parts and their boxes.

Other gaps and contradictions I ran into while checking the script:

- **Room openings:** the `room` op lists openings as `{side, at, width, y?, height?, fill?}`, but the Example puts `door`, `opens` and `frame` inside openings.
- **Colour names:** the part list uses "Light grey", "Dark grey" and "Clear", while the Colours section uses "light bluish grey", "dark bluish grey" and "trans-clear". I had to assume they map.
- **Op footprints and defaults:** missing for:

  - `stairs`: which cells `at`, `width`, `dir`, `steps` and `run` cover.
  - `column`: the default diameter and what it compiles to.
  - `door.opens`: the default.
  - `floor` with `top: "tile"`: whether it replaces the top layer or adds one.

  I needed each of these to clear the relocated tree near the pagoda stairs at `[-23,0,-5]`. I also needed them to judge whether the incense burner (`sections[8].ops[21]`), sitting on tile-topped paving, counts as supported.

- **Enforced rules vs advice:** the prompt doesn't say which rules the compiler checks. Attempt 1 has a `30055` fence at [7,7,0], three studs in front of the Kondō door at [7,7,3]. It compiled, and I can't tell whether swing clearance isn't checked or doors open inward by default.

What I'd cut:

- **Harness boilerplate:** ultrareview, Claude Code surfaces, fast mode, model IDs and the security-testing policy are irrelevant to a build script.
- **Part cheat sheet:** it partly duplicates the full list; it could become role tags on the list entries.
- **Composition statistics:** the ratios in "Look like a LEGO design" (13 one-wide tiles per 100 parts, etc.) can't be acted on blind. Keep them only if the compiler reports the build's actual ratios back.

**2. Part list**

For the repair it was worth its space. The footprints (x × z at turn 0) let me decode the errors: the 3020 "Plate 2 × 4" overlapping on x 27–29 had to be laid turned. The colour lines let me confirm the tree instances' palette overrides were legal: 3062b in dark brown, 2423 in orange, and 4032b, 4740 and 3942c in pearl gold.

What it lacked:

- **True collision boxes for irregular parts.** "2435 Pine Tree Small — 3×3 studs (x×z), 12 plates" is exactly the line that let attempt 1 put two pines flush against massing. The compiler's box was 3×3, shifted half a stud toward −x/−z. The same data is needed for 3470, 3471, 2417, 2423, 6255 and the flowers.
- **The hidden colours.** "(+N other colours)" hides exactly the colours you can't check any other way. Attempt 1 used "bright pink" on 2417 and 2423, and unlisted parts 92947 and 30151a. I could only trust them because nothing complained. A "parts used" summary in the feedback (part, name, colour, count) would confirm them.
- **Connection notes.** For example, does 2417 really seat on a 1×1 round brick the way the `tree` component stacks it?

**3. Search**

I didn't use search in this session (attempt 1 used 10 searches), so I can't judge result quality. On the protocol: a search reply shares the channel and the "reply with only a JSON object" format with the final answer, which is fragile. A tool call would separate exploring from answering, allow parallel queries and show the remaining budget. The repair instruction ("Fix it by returning ONLY a corrected JSON object") also left it unclear whether search was still allowed.

In results I'd want:

- the collision box and origin;
- the connection type;
- the exact colour strings the compiler accepts for that part, including the hidden "+N".

**4. Errors and repairs**

The overlap messages were good:

- The op paths (`[sections[0].ops[3], sections[9].ops[11]]`) took me straight to the right ops.
- The ranges were precise enough to reverse-engineer the box. Error 2's "z -6.5–-3.5" showed 2435's box is exactly 3 deep, so it was shifted rather than enlarged. That told me how far to move each tree.

What was harder:

- **Unlabelled position:** the tree is printed "at [26.5, 0, -8.5]". That is its box minimum, not the `at` I wrote ([27, 0, -8]), and it isn't labelled. Print both, with the full box.
- **Y units:** the y-ranges don't line up with plate heights ("y 0–1.5" for a one-plate 3020), presumably because studs are included. Say so.
- **No part count:** the compiler had counted 1,989, but the message didn't include it or say whether the error list was complete. I hand-estimated the count before choosing between deleting and moving the trees. Always print the count and "N of M errors".
- **Untested messages:** I didn't hit schema, colour or count errors this run, so I can't judge those. For count errors I'd want per-section counts.
- **No fix hint:** a suggested nearest free placement, or a small ASCII top-down map around the conflict, would make checking a relocation trivial.

**5. Why attempt 1 failed**

Two `2435` pines had their footprints flush against massing:

- `[-30,0,-6]` sat against the face of the 2-stud outer wall (`sections[1].ops[0]`, cells x −32..−31).
- `[27,0,-8]` sat against the lawn floor ending at z −9 (`sections[0].ops[3]`).

Attempt 1 treated the listed 3×3 footprint as the whole part and didn't apply "keep a stud clear". In the repair I moved them to `[-29,0,-6]` and `[26,0,-7]`, which leaves a free stud on their −x/−z sides. I changed nothing else, so the count stayed at 1,989, and it was accepted.

Any of these would have prevented it:

- the real box in the part list;
- the clearance rule repeated next to the trees in the cheat sheet;
- a check tool;
- the compiler carving a decorative part's reach out of floors, or warning with a suggested shift.

**6. Hardest without compiling**

- **Real extents of irregular parts,** as above.
- **Roofs.** The prompt gives course count and ridge height ("about `at.y + 3n + 3`") but not which cells each course occupies. To confirm the right cloister roof (`sections[2].ops[9]`) and the Temizuya roof (`sections[7].ops[10]`) don't collide, I had to work out the course layout myself. Both use the z −17 row at x 2–9, one at y 10–13 and the other at y 13–16. A one-line rule would have saved that: "course k occupies studs k−1..k in from the eave, at y = at.y + 3(k−1)".
- **Part counts.** My hand estimate was about 2,175 against a real 1,989: off by 186, almost the whole 200-part window.
- **Neighbourhood checks across about 300 ops.** Clearing two tree spots meant hand-checking lanterns, tree-instance leaves, walls, floors and stairs across five sections.

If I still had to answer in one pass, the most useful help would be:

- exact boxes for irregular parts;
- explicit cell footprints for `stairs`, `column` and roof courses;
- per-op part-count rules of thumb (parts per course for hollow, masonry and solid boxes; per column; per roof course).

**7. Three changes, most important first**

1. **A dry-run check call** (overlaps, schema, colours, part count, optionally an ASCII top view) that doesn't use an attempt.
2. **Exact collision boxes for irregular parts** in the part list and search results. The compiler should either carve that reach out of massing or warn with a suggested shift. If the half-stud offset is a placement artefact rather than real geometry, fix it.
3. **Fuller error feedback:**
   - always the part count, and whether the error list is complete;
   - the written `at` next to the box;
   - documented units for the ranges.
