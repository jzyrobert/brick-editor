The biggest gap was knowing what geometry and part counts each op would actually produce. I can inspect attempts 2 and 3 here; my comments on attempt 1 and the five searches rely on your summary.

1. **Prompt.** The “Coordinates” section specified units but never explicitly required integer x/z coordinates. That requirement appeared only in the rejection. Also, “Parts … cut into massing” needs precise rules: which ops cut which volumes, whether order matters, and whether floors and roofs participate. `roof.holes` and `floor.holes` need explicit coordinate conventions and rules for parts crossing hole boundaries. `open?: [faces]` needs an enum. The example’s room-opening fields `door`, `opens`, and `frame` should appear in the schema.

   I would shorten the street-specific façade advice and move much of the long inventory into search. I would use that space for transformation rules, roof cross-sections, and tested examples of interacting ops.

2. **Part list.** It helped substantially with legitimate IDs and colours: I used `3039`, `3660b`, `3941`, `4032b`, and `2412b` directly. However, catalogue names are insufficient construction specifications. “3665a Inverted Slope 45° 2 × 1” does not establish its x/z footprint at `turn: 0`, its attachment locations, or its orientation after rotation.

   The most useful additions would be canonical dimensions in studs/plates, stud and underside connection maps, placement origin, and a small orientation diagram. Round-part centring especially needs a legal construction example: a 1×1 stem above a 2×2 plate introduces placement questions that colour availability cannot answer.

3. **Search.** The reply protocol was understandable, but I would strongly prefer a tool call. Search currently uses the same response channel and JSON-shaped output as the finished deliverable. A tool would give a clearer request/result boundary.

   I cannot assess the actual five results because they are absent from this context. The stated size-and-colour results address availability, but I also needed orientation, connection geometry, exact height, and placement offsets. Search results should distinguish a confirmed ID match from a fuzzy recommendation.

4. **Errors and repairs.** The budget report was excellent: “2,138 parts,” the exact 38-part excess, section totals, and costly op paths made reductions concrete. It showed that `sections[2].ops[0]` alone cost 203 parts.

   The overlap paths also helped. The tree at `[43, 0, 43]` in `sections[7].ops[20]` intersected the hall platform and railing; that was readily actionable. The `shojiPanel.ops[0]` floor versus `timberPier.ops[1]` column reports exposed a component clearance problem.

   “59 more overlaps” was much harder to repair responsibly. I wanted the complete list, expanded repeat indices, world coordinates, human-readable part names, and intersection bounds. For roof collisions, identifying whether the intersecting geometry was a slope, ridge, or support would help considerably.

   The non-integer errors identified the relevant paths, but should also show the supplied value and failing axis. I have no reported colour or open-face rejection to assess.

5. **My failures.** Attempt 1 failed the coordinate constraint, according to your report. Explicit integer requirements and a centring example would have prevented that.

   Attempt 2 combined an unreliable count estimate with layout mistakes. I treated nominal component footprints and roof openings as sufficient clearance guarantees. The original `shojiPanel` declared a `[4, 1]` plot while its base floor extended outside that plot. I also put the rear pine into occupied platform space—an avoidable mistake without any additional tooling.

   The main hip roof and upper gable intersected despite the specified hole. I lacked enough geometry information to diagnose that confidently, so the repair replaced the assembly with one hip roof. The final 2,001 count was an observed compiler result; I did not predict it exactly.

6. **Hardest without compiling or rendering.** Interactions between generated parts were hardest: roof slopes crossing nominal boundaries, columns passing through floor layers, and rotated components containing projecting geometry. Plate arithmetic itself was manageable.

   Part counts were the other major uncertainty. There was no documented cost model connecting a room or roof’s dimensions to the compiler’s packing choices. In the final repair, `roofRing14/12/10/8/6` made the pagoda’s clearances explicit, but required substantial extra JSON.

   For a mandatory one-pass answer, tested assemblies with known clearances and count bounds would help most: a bracketed bay, a roof around a structural core, and a rotated component example.

7. **Three changes, most important first.**

   1. Add a preflight tool returning schema failures, per-op counts or useful bounds, and complete collision diagnostics with world coordinates.
   2. Make parts search a normal tool and return construction metadata: canonical dimensions, heights, origins, orientations, and connection points.
   3. Publish an exact DSL contract covering integer coordinates, component rotation, hole boundaries, subtraction behaviour, and roof profiles, with small tested examples.