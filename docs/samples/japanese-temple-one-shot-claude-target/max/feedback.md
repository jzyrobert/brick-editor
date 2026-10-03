## 1. Prompt: unclear, missing, wasted

The geometry rules were the most valuable part. These included "massing yields to parts, whatever the op order", "ends are included", integer-only coordinates, and the roof formula `n = (d + 2o)/2 − 1` with the ridge at `at.y + 3n`. I designed every roof from that formula.

The gaps were mostly about op semantics I had to guess:

- **`box` interior.** The text says "hollow by default", but `interior` lists `empty|fill|solid`, and the template's `defaults: {"interior": "empty"}` is never explained. I couldn't tell whether a hollow box's lid sits inside `size` or on top of it. So I used `fill` for 1-brick bases (copying the example), `solid` for ridge blocks, and left the default on the 6-plate hall platform without knowing its top height.
- **`top: "tile"`.** For floors it seems to replace the layer. For boxes I couldn't tell if it adds a plate, so I avoided it and laid separate tile floors.
- **Holes.** "A hole leaves out every slope, ridge and hip-corner piece it touches" doesn't say whether slopes are packed before or after holes. If a 2×4 slope partly over a hole is dropped whole, gaps appear beyond the hole. That uncertainty is why I built ridges by holing the full ridge strip and rebuilding it with boxes, instead of a small hole for a ridge ornament. One worked table would remove the guesswork: which cells course k occupies, and what remains after a hole.
- **Openings schema.** The listed fields are `{side, at, width, y?, height?, fill?}`, but the example uses `frame`, `door` and `opens`. I also passed `glass`, and never learned whether it was honoured or silently ignored.
- **`instance.at`.** It doesn't say whether this is `[x,z]` or `[x,y,z]`; I assumed three values.
- **`stairs`.** It doesn't say whether `dir` is the ascent direction, or which axis `width` runs along.
- **Turn conventions.** There is no statement of which way a slope faces at `turn: 0`, or whether `turn: 90` is clockwise from above. The `reach` data for handles hinted that −z is the front, but I placed the gold curved slopes (11477) on the ridge ends essentially on a coin flip.
- **Support.** "Rests on something (y = the top of what is below)" leaves hanging parts ambiguous. My bell (30151a) attaches under a plate, and I still don't know if that was flagged.
- **Eaves.** `overhang: 0|1` is the biggest design limit for Asian roofs. I invented a pattern: an eave floor 2 studs wider than the walls, with the roof sized 1 inside it. Documenting that, or allowing `overhang: 2`, would help.
- **Colours.** The accepted-names list omits "bright pink", which search verified. Say whether any LDraw colour name works.

What I'd cut or shorten:

- The harness text about ultrareview, git and model IDs is noise for this task.
- `track`/`railcar` could move to a "specialised ops" appendix.
- Some "Look like a LEGO design" items are townhouse-specific, like string courses at every floor line.
- The small-part ratios (13 tiles per 100 parts) are hard to act on when the compiler chooses the bricks.

What I'd add: a second, larger example showing a multi-tier roof with holes, a component with `when` flags, and `scatter` with explicit density units. I avoided `scatter` because I didn't know what `density` means.

## 2. Part list

It helped a lot. The colour-exception data shaped real decisions. For example:

- Window glass: 60601 exists in dark green but 60602 doesn't, so I chose 2×6 windows wherever I wanted green lattice glass.
- Doors: 60623 exists in dark red while 60616a doesn't.
- Pearl gold: it confirmed which parts I could use for the spire rings and finials.

The footprint-at-turn-0 convention and the `reach` notes for plants were also useful.

What was missing:

- **Facing at turn 0** for asymmetric parts: slopes, curved slopes, arches, the fish.
- **Studs on top or not**: tiles, ridge pieces, dishes. This decides whether anything can stand on a part.
- **Connection points.** Does 3960 attach by one centre stud? Where does 2417 attach? Can a dome-top cylinder hang from the plate above?
- **Occupancy.** Is a part a full bounding box, or is the space under arch 6183 free?
- **Shape notes for ambiguous names.** "Dish 4×4 Inverted" needs a one-line note that the dome side faces up.

The long runs of plain bricks and plates could shrink to a compact table, since the compiler picks those itself.

## 3. Search

The protocol worked: two replies of five queries each. It found things I couldn't have guessed:

- 30151a as a temple bell
- 3688 as a pyramid cap
- 42291 as boulders
- verified bright pink for 2417 and 2423
- trans yellow for 3941

Ranking was noisy, though. "lantern" returned minifig torsos with Green Lantern logos and Duplo parts; "bell" returned bell-bottom trousers. Ranking curated and building-relevant parts first would fix that, as would a category filter that excludes minifig and sticker parts by default. The difference between "verified" and "derived" colour availability isn't explained, so I don't know whether "derived" is safe.

I'd prefer a real tool call. It's cleaner, there's no risk of a search reply being mistaken for the answer, and it wouldn't need the reply budget. The results also lacked the same things as the part list: facing, studs on top, and connection type.

## 4. Errors and repairs

I never saw an error message; the first attempt was accepted. I also never saw the compile report, and that is the real gap. I still don't know whether:

- `glass` was honoured
- the shibi faced the way I intended
- the hanging bell or the leaves resting on 1×1 trunks were flagged
- the hole strips left gaps
- what part substitutions `find` or the compiler made

Even on acceptance, a short report would let the agent learn: per-section counts, warnings, ignored keys, and substituted parts.

## 5. Shortfall

Nothing was rejected, but the part count missed: 1668 against a target of 2000, which is −16.6%. My own estimate was about 1950–2020.

I don't have a breakdown, so these are hypotheses:

- **Openings.** I assumed about 4 cut bricks per opening across roughly 50 openings. If the real figure is closer to 2, that alone is about 100 parts.
- **Ring hip roofs.** The compiler likely uses mostly 2×4 slopes, so it probably needs fewer pieces than my "1 per 3 studs of course length".
- **Massing allowance.** I added a +8–10% allowance (the prompt suggests about 15%, up to 45%) that apparently didn't materialise. Following the "1 per 3 studs of area" roof rule literally would have put my estimate even higher.

So for this kind of build the counting rules lean pessimistic. Any of these would have prevented the miss:

- a dry-run count
- calibrated per-op formulas, especially for openings, roofs with holes, and textured 2-thick walls
- a chance to adjust when the count is more than 10% off

## 6. Hardest to reason about blind

Coordinates and plate heights were manageable once I wrote them out.

The hard parts were:

- Roof cells around holes, and how slopes are packed next to them.
- Part orientation under turns.
- Box lid semantics.
- Support rules for hanging parts and parts resting on tiles.
- Above all, the part count, which is scored and where I was furthest off.

For a single pass, the most useful additions would be:

- an exact count model per op (bricks per course per stud length, and openings)
- a worked hip-roof-with-hole cell diagram
- a turn/facing table
- a few canonical patterns: deep eaves, stacked pagoda tiers, a custom ridge

## 7. Three changes, most important first

1. Add a count or dry-run tool, or return the compile report with per-section counts and warnings and allow one adjustment.
2. Publish a complete schema per op: openings keys, `instance.at` dimensionality, box interior and lid, `top: tile`, `stairs` axes. Add explicit roof-with-holes behaviour and turn/facing conventions, and allow `overhang: 2` or document the eave-plate pattern.
3. Add facing, studs-on-top and connection info to part-list and search results, rank building-relevant parts first, and offer search as a real tool call.
