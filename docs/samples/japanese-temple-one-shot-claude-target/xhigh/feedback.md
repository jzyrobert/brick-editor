## 1. Prompt

It was mostly clear, and the "Counting parts" and "Geometry rules" sections did most of the work. These are the points where I had to guess:

- **Room openings.** The keys `door`, `frame`, `opens` and `fill` appear only in the example and in a half-sentence under "Openings in walls/rooms". I copied the example's `"door": "blue"` pattern and added `"frame": "red"` to door openings without knowing whether that key exists there. A one-line schema per opening type would fix this.
- **`top: "tile"` on a 1-layer `floor`.** I couldn't tell whether the tiles replace the plate layer (top at y = 1) or are added on it (top at y = 2). The "128 parts instead of 8" wording suggests replacement, but I placed the censer and lily pads at y = 1 hoping a part would win either way.
- **Support rules.** "Everything must stand: every part rests on something" reads as support from below only. My bell tower bell hangs from the ceiling plate (30151a + 3941 under the eave plate). I didn't know if that was allowed, a warning or an error. Please say explicitly whether connection from above counts.
- **Palette keys on parts.** Can `place`/`column` use palette keys like `"timber"`? I used literal colour names to be safe.
- **`group` holes.** I assumed `holes` inside a `group` are in the group's local frame. The rule says this for components, not groups.
- **Roof internals.** The roof rules explain courses and holes well. I couldn't tell whether the compiler fills under the stepped slopes, which matters both for count and for whether eaves on a cantilevered plate are legal.
- **Facade guidance.** "Look like a LEGO design" is written around European street facades (string courses, cornices, parapets). For a temple, most of it didn't apply. A sentence on non-Western or non-facade subjects (posts and beams, bracket rhythm, deep eaves) would help.

What I'd cut: the full colour-availability lines repeat "common colours except …" very verbosely. A compact matrix, or only the exceptions that matter (trans, pearl gold, dark brown), would save a lot of tokens.

## 2. Part list

Footprints and heights were essential and I relied on them constantly. Examples: 3943b at 4×4×6 for lantern roofs, 60474 for plinths, 87081 for the censer. The "reach" notes on 2435 let me clear trees from neighbours. The colour lines saved me from errors I would otherwise have made (3941 not in pearl gold; 30151a not in dark grey).

What it lacked:

- **Orientation at turn 0 for directional parts.** I placed inverted slopes 3665a as eave brackets and 15068 curved slopes as ridge ornaments without knowing which way the slope faces at turn 0, or which way turn 90 rotates. I hedged by making both orientations look acceptable. A note like "slope descends toward −z at turn 0; turn is clockwise seen from above" would remove that guess.
- **Top connection type.** Whether a part's top has studs (3043 ridge: none?) matters for whether something can sit on it. I put ornaments on top of roof ridges not knowing if that counts as resting.

## 3. Search

The reply protocol worked. A tool call would be cleaner, though, because I had to be sure my reply contained only JSON, and there was no way to state intent alongside it.

Results were mixed. Useful: 92947 (round brick 2×2 with grille, in pearl gold) and the "in bright pink: verified" flags for 2417/2423/24866. Noise: "lantern" and "bell" returned mostly minifig torsos, Duplo and printed tiles.

What would help:

- Exclude minifig, Duplo and printed parts by default.
- Rank curated parts first.
- Say whether a colour name (e.g. "bright pink") is accepted by the compiler, not just whether the part exists in it. I wasn't sure "bright pink" would parse, since it isn't in the Colours list.

## 4. Errors and repairs

I got no errors; attempt 1 was accepted. So I can't judge the error messages from experience. What I would have wanted in advance is a per-section part count in the acceptance report, because I landed at 2294 against an estimate of about 2027 and don't know which section ran over.

## 5. Failures

No attempt was rejected. The real miss is the count: 2294 is +14.7% against the 2,000 target.

I estimated each section with the prompt's rules but applied only about 10% extra to massing instead of the suggested 15%. I reasoned that I had already accounted for the cuts from columns and openings. My likely errors:

- **Two-course ring roofs** (the hall's skirt roof, the five pagoda roofs) cost more than "1 per 3 studs" because they are mostly corners and short runs.
- **Rooms cut by many columns** (the hall's front pilasters every 5 studs, sides, rings B and D) fragment every course into 4-stud bricks.

Per-op count feedback, or a rule specifically for ring roofs and heavily pilastered walls, would have prevented this.

## 6. Hardest to reason about without compiling

1. **Part count.** It is the scoring criterion, and my estimate was off by about 13% with no feedback loop.
2. **Roof geometry.** It was workable but laborious: which courses survive a hole, where the ridge lands in x and z, and the top height for placing ornaments. I derived each by hand, e.g. hall ridge x 42..53, z 47..48, y 67..70. A formula or worked example for "ridge cells of a hip roof" would help.
3. **Interaction between massing and parts.** Examples: columns passing through stacked rooms, brackets cutting a beam ring, posts standing on a tiled path. The "parts cut massing" rule made it tractable, but I still wasn't sure how colour and tiling resolve when two massing ops overlap (the gate plinth and the path). So I split the path into two pieces to avoid the overlap.

What would help most in one pass is a worked example with a pagoda-style stacked roof showing exact cells and the resulting part count.

## 7. Three changes, most important first

1. **A dry-run tool** that returns per-section part counts and any overlap or floating-part errors without rendering. It would turn my ±15% guess into a ±2% landing and catch geometry mistakes before submission.
2. **A precise op schema.** Document every op's keys, especially opening keys, `top: "tile"` layer semantics, group-local holes, and palette keys on parts. Add orientation conventions for directional parts (which way slopes face at turn 0, rotation sense of `turn`) and whether hanging connections count as support.
3. **Cleaner search results.** Filter out minifig, Duplo and printed parts by default, and confirm that a colour name is accepted by the compiler.
