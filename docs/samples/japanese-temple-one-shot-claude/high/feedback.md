I only have this session's context: the failed first script and the repair turn. I can't see the reasoning behind attempt 1, so some of what follows is reconstruction, and I'll flag where.

## 1. Prompt

**What was unclear:**

- The prompt never says how massing becomes parts, so I couldn't estimate part counts.
- The single number that would have helped most is "masonry costs roughly N× a plain wall."
- In the repair I guessed that removing masonry from the Kondo platform (176 parts) and the pagoda base would save about 100 and 30 parts. Total savings came to about 245 instead of my estimated 145, and I landed at 1,921, close to the lower edge.

**Wasted space:** "Look like a LEGO design" is useful, but it is long. The per-100-parts statistics (13 one-wide tiles, 4 SNOT bricks) are hard to act on when the compiler picks most of the bricks.

**What I'd add:**

- A short cost table, giving approximate parts per op type:
  - box per stud of perimeter per brick course, with and without texture
  - roof per stud of eave
  - column per brick of height
  - fence per 4 studs
  - floor per 16 square studs
- A statement of what "parts reach past footprint" means numerically for the plant parts listed in the cheat sheet.

## 2. Part list

**What helped:** Footprints and heights were enough for stacking the lanterns, the pagoda finial and the matsu trees.

**What was missing: reach.** 6255 (Plant 1 × 1 Large Leaves) is listed as 1×1 and 5 plates tall, but the compiler treats it as reaching about 1.5 studs past that footprint.

- The generic warning about leaves "keep a stud clear" understates this, since 1.5 studs means 2 clear studs in practice.
- Both overlaps in attempt 1 came from this.
- A "reach" field on irregular parts (e.g. "6255: 4×4 envelope centred on the stud") would have prevented them.

## 3. Search

I made zero searches in either attempt. The curated list covered everything I wanted, and in the repair turn I had no reason to look anything up.

The text-reply protocol is workable, but as a tool call it would feel less like spending a turn. I'd also use it more if it could answer "what is this part's real envelope," not just "which part is called X."

## 4. Errors and repairs

**Over-budget message: good.** Giving the exact overshoot, the largest sections and the costliest ops with paths (`sections[3].ops[0].ops[0] 176`) told me exactly where to cut. It would be better still if it suggested _how much_ each change saves, e.g. "texture: masonry on this op accounts for ~X parts."

**Overlap messages: actionable but confusing.**

- The plant was reported "at [-15, 0, -16.5]", but I had placed it at [-13, 0, -15]. The message gives the reach envelope's corner rather than my `at`, so at first the position didn't match anything I wrote.
- I had to trust the op path (`sections[7].ops[27]`) and count ops by hand to find it.

Suggested fix: echo the op as written (`place 6255 at [-13,0,-15]`) alongside the computed envelope. It would also help to say explicitly "its leaves reach 1.5 studs beyond its footprint."

## 5. Why attempt 1 failed

**Budget:** Without a cost model, I (or my earlier self) underestimated how expensive textured masonry boxes, five full pagoda storeys and two large hip roofs on the Kondo are. The result was 8% over budget.

**Overlaps:** I placed decorative plants 1 stud from a wall and from a lantern, treating them as 1×1 because the list says 1×1.

A reach field and a cost table would each have prevented one class of error.

## 6. Hardest to reason about without compiling

1. **Part counts.** This was by far the hardest, because I have no model of how the packer splits volumes, especially with colour mixes and textures.
2. **Overlaps from irregular parts and from parts inside components** (the lantern's 4×4 cap sits at offset -1, so it reaches outside the component's 2×2 plot).
3. **Roof heights.** The formula in the prompt helped; I could compute ridge heights.

If I still had to answer in one pass, the most useful addition would be a per-op estimated part count I could compute by hand, or a dry-run "count only" reply that doesn't use up an attempt.

## 7. Three changes, most important first

1. **A part-count estimate tool or table.** Ideally a `{"estimate": …}` reply that returns per-op counts without compiling the full build. Failing that, a cost-per-op table in the prompt.
2. **Reach and envelope data for irregular parts** (plants, trees, cones and dishes with offsets) in the part list. Overlap messages should also echo the op as written next to the computed envelope.
3. **Savings hints in the over-budget message**, e.g. "removing texture from sections[3].ops[0].ops[0] saves ~120; dropping one pagoda storey saves ~100." That way repairs can land near the target of 2,000 instead of anywhere in the accepted range.
