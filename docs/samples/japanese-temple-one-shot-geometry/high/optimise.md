1. The main cost was predicting what the compiler would produce.

   Your figures put about 75% of the elapsed time and 73% of the output tokens in the first attempt. I cannot precisely attribute that attempt’s reasoning from the visible record, but the script shows the expensive decisions: coordinating a worship hall, a three-tier pagoda, overlapping cornice layers, roof holes, repeated brackets, and landscaping while estimating their combined part count.

   The biggest avoidable uncertainty was the budget. A compact `room` or `roof` operation can generate hundreds of parts: the main hall’s `room` cost 202, its roof 159, and the garden’s tiled border 80. Script length gave little indication of cost. The repair then required estimating how removing explicit parts would change the massing that replaced them.

   Geometry also consumed effort because nominal footprints did not fully describe collision bounds. The bamboo reached into the stair, and the nominal nine-plate window extended above the clearance I had allowed.

2. I would shorten the reference material, while retaining the geometry rules.

   For this build, the train, railcar, track, vehicle, wheel, hinge, and most bracket entries were unnecessary. The complete colour lists attached to those entries were also unnecessary. Move those families into an on-demand reference.

   Keep these in the initial prompt:

   - Coordinates, inclusive wall endpoints, component transforms, and roof geometry.
   - Massing-versus-part collision behaviour.
   - Core operations and a small architectural parts shortlist.
   - Structural support and opening rules.

   The “Look like a LEGO design” section could become a shorter priority list: silhouette, facade rhythm, restrained palette, supported overhangs, and concentrated details. Its numerical small-part ratios were difficult to apply without a compiler-generated inventory.

   The example should demonstrate roof holes in the same format the rules recommend. Its two-coordinate hole `at` alongside three-coordinate building positions adds interpretation work.

3. The most useful single addition would be a **compiler-derived cost table for common assemblies, with their dimensions and options**.

   For example: approximate counts for a `room`, tiled platform, hip roof, and repeated bracket assembly at several sizes. A rule saying “reserve 15% for details” would help less because I still lacked reliable costs for the main masses.

   This would most likely have prevented the substantial budget failure. It would not independently guarantee collision-free geometry; those errors need actual occupied bounds or validation.

4. I did not search because the supplied list already contained the parts needed to represent the temple.

   The uncertainty was mostly about assemblies and compiler behaviour, rather than finding a missing part. Searching for another slope would not resolve how many bricks a roof generated.

   Search becomes worthwhile if it adds information beyond the prompt: actual collision bounds, irregular overreach, connection positions, or a tested assembly. For `30176`, the useful result would explicitly show its foliage reaching beyond the nominal footprint. For `60593`, it would show the full occupied height used by collision checking.

   Keep search, but shorten the initial catalogue and make these richer results available. Then searching has a clear purpose.

5. The error format was useful; the repair context could be much smaller.

   The overlap messages named both parts, their coordinates, intersection intervals, and originating operations. That made removing the bamboo and lowering the third-tier windows straightforward. The budget report’s largest sections and costliest operations were especially valuable.

   Prefer repairs in the same session, with:

   - Errors and current total.
   - Counts for every section and affected operation.
   - The affected operations and referenced components.
   - Permission to return a patch against the previous script.

   Repeating the entire prompt and requiring the entire JSON again increased reading and output cost. If a fresh session is necessary, provide the current script once, a short rules reference, and diagnostics. Use stable operation IDs instead of paths such as `sections[1].ops[27]`, which change after deletions.

6. I would introduce a cheap draft validation stage and support incremental edits.

   The first submission could contain the base, platforms, rooms, roofs, and named detail allowances. A count-and-collision pass would establish whether the composition fits before adding dozens of repeated details. An outline alone would be less useful unless it receives a meaningful cost estimate.

   Tested recipes would also help: a pagoda tier with a clear central core, a supported temple eave, a stone lantern, and an entrance stair. Each should specify dimensions, clearance requirements, and expected count.

   Keep the accepted 1,900–2,100 range, but expose the count before final submission. Let repairs change operations without retransmitting everything. Compact JSON formatting would further reduce output tokens.

   Budget trimming should preserve design priorities. This repair reached 1,965 parts by removing landscaping and reducing brackets; an earlier estimate could have preserved more of that detail through better initial proportions.

7. My top three optimisations, in order:

   1. **Provide an early count-and-collision preview**, including per-operation costs and actual occupied bounds. This addresses the two observed failure classes directly.
   2. **Use persistent-session repairs with stable IDs and patch output.** Keep the useful diagnostics; eliminate repeated instructions and full-script retransmission.
   3. **Replace the broad initial catalogue with a concise architectural reference and tested recipes.** Put uncommon parts and detailed geometry behind search.
