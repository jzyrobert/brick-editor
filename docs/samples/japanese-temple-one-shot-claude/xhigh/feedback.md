I only saw attempt 1's output and its error in this session. I didn't write that script or run its 10 searches, so on those points my feedback is limited and I'll say so where it matters.

## 1. Prompt: unclear, missing, wasted

- **The irregular-parts rule is wrong as written.** The Geometry rules say "Leaves, branches and other irregular parts can reach past their footprint: keep a stud clear around them." Attempt 1 followed this exactly. The 6255 plant at z = −23 had one clear stud (z = −22) before the corridor wall at z = −21, and it still failed. The error shows the plant's box as z −24.5 to −20.5 and y 0 to 5.5. That is a reach of 1.5 studs on each side and half a plate above the listed 5-plate height. The rule should give real reach values or say "two studs".
- **The opening schema is incomplete.** `room.openings` is documented as `{side, at, width, y?, height?, fill?}`. The example and the script also use `door`, `frame`, `glass` and `opens`, which appear nowhere in the op reference. The full field list should be written out once.
- **Colour names are inconsistent across sections.** The Colours section uses "light bluish grey" and "trans-clear". The part list uses "Light grey" and "Clear". The script used "bright pink", which is in neither list, and was accepted. One canonical name table with aliases would remove the guessing.
- **Nothing helps estimate the part budget.** The 1,900–2,100 window is enforced, but nothing tells me how many parts a `box`, `room`, `floor` or `roof` produces. A rough rule would make the budget plannable. For example: "a 1-stud wall ≈ length/3 parts per brick course; a gable roof ≈ (w/2)·n slopes."
- **Wasted space for this request:** `track`, `railcar`, the Vehicles part group and `wheels` on 4600. These could be included only when relevant or moved to search. The "measured on 30 sets" statistics are useful, but they are long relative to how much they change a design.

## 2. Part list

The list was useful for colour availability and footprint axes. The "names don't tell you the axis" note is good. What it lacked:

- **True bounding boxes for irregular parts.** 6255 is listed as 1×1, 5 plates, but behaves as roughly 4×4×5.5. The same is probably true of 2417, 2423, 3470, 3471 and 2435.
- **How parts attach.** For example, can 2417 leaves sit on a 1×1 or 2×2 column? Does a cone on a round plate count as supported? The script relied on these and I couldn't verify them.
- **Non-common colours** such as bright pink for 2417 and 24866. The "+N other colours" note leaves this open.

## 3. Search

I didn't use it in this session, so I can't judge the results. On the protocol itself: a real tool call would be cleaner than "reply with only this JSON". The current design overloads the reply channel, so a malformed search could be mistaken for an answer, or the reverse. To be useful for the problem we hit, search results should include the same reach and bounding-box data asked for above.

## 4. Errors and repairs

The overlap message was very actionable. It named both parts, gave the exact intersection box and gave op paths (`sections[5].ops[39].ops[0]` and `ops[1]`), which pointed straight at the `repeat`. Two things would make it better:

- **List all pairs or the affected ops**, not just "5 pairs like this". I had to infer that every copy in both branches of the repeat was affected.
- **State the part's actual extent and offer a hint**, such as "6255 reaches 1.5 studs past its footprint; nearest clear z is −24, which leaves the baseplate". I worked this out myself. It is why I swapped the bush for 32607 (1 plate tall) instead of moving it: moving it to z = −24 would have pushed its leaves past the baseplate edge at −24. The fix compiled, but the front planting is now flat leaf plates instead of bushes. That is a visual downgrade.

## 5. Why the rejected attempt failed

Bushes were placed two studs in front of the corridor wall, trusting the listed 1×1×5 size and the "one stud clear" rule. The real leaves are about 4×4×5.5, so they ran into the corridor's columns and window glass at y 4–5.5. The fix to the rule or the part data described in sections 1 and 2 would have prevented this.

## 6. Hardest to reason about without compiling

- **Part counts.** There is no way to estimate them for massing ops.
- **Stacked hip roofs with holes.** In the pagoda, I can't tell whether the slope ring around each tier's hole is valid and whether the next tier's floor plate sits correctly on the slopes.
- **Whether things stand.** For example, leaves on columns, or columns placed on room-wall cells, where parts carve massing.
- **Long y-stacks.** Pagoda arithmetic up to about 90 plates is error-prone.
- **Some issues may have slipped through.** The main hall's eave `floor` is 22×17 (odd depth), and "bright pink" was accepted. Acceptance doesn't tell me whether these were fine or just not checked.

What would help most in one pass is a validate tool returning errors and a part count without a render. Short of that, a top-down text map of occupied cells per height band would help.

## 7. Three changes, most important first

1. **A validate/dry-compile call** usable before the final answer, returning errors and the part count. This would remove most wasted attempts.
2. **Accurate reach and bounding boxes** for irregular parts in the part list and search results, with the "keep a stud clear" rule corrected to match.
3. **One complete reference** for opening fields (`door`, `frame`, `glass`, `opens`, `fill`) and one canonical colour-name table. Trim request-irrelevant sections like trains and vehicles to pay for it.
