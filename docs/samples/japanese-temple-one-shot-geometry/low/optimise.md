The biggest opportunity is to make part counts predictable before submission and repairs much shorter. The geometry information helped: the reported locations let me fix the collisions without redesigning the temple.

1. **Where the effort went.** According to your measurements, most output tokens went into writing the complete script twice: 4,903 tokens initially and 4,410 for the repair. I can inspect the repair reasoning in this session, but cannot reliably reconstruct the first attempt’s internal effort.

   The repair required two concrete calculations: removing gravel rows around the lantern bases, and replacing the tops of the veranda columns with bracket assemblies that reached the same beam height. Removing 64 gravel tiles and making a net reduction of 16 column/bracket parts brought 2,137 down to 2,057. Those calculations were manageable; retransmitting all the unchanged sections was avoidable.

2. **What could leave the prompt.** For this temple, I did not need `track`, `railcar`, vehicle parts, wheel handling, most hinges and brackets, or the full window-and-door catalogue. The house-oriented guidance on upper-storey proportions, window bands, dormers and differing house colours was also largely unused.

   Keep the coordinate conventions, overlap rules, roof formula, component frames, supported construction rules and compact operation schemas in the main prompt. Move the extensive part catalogue and specialised operations into searchable references. Retain a small core catalogue of common bricks, plates, tiles, slopes, round parts and plants.

3. **The single most useful missing rule.** “Explicit parts do not merge or replace each other: when adding a bracket to a column, shorten the column to the bracket’s underside; exclude decorative tiles from component footprints.”

   The existing **“Massing and parts”** paragraph technically covered this, but a concrete example would have made it harder to miss. That would address the overlap failures. It would not independently fix the budget failure; first-reply acceptance also needed a count estimate or more headroom.

4. **Why I did not search.** The supplied catalogue already contained every part used, with sufficient footprints, heights and colours. Searching would have added a round trip without resolving the actual problems.

   Keep search available, but make it valuable for specialised details: temple roof ornaments, bells, lattice panels or curved eaves. Results that include a small, supported assembly recipe would be more useful here than additional individual parts. Search was unnecessary for this particular repair.

5. **The repair format.** The errors were useful: part IDs, coordinates, overlap intervals, repeated-pair counts and operation paths identified both causes precisely. The section totals and costliest operations also exposed easy budget savings.

   Prefer repairs in the same session, followed by a compact diagnostic message. Repeating the whole prompt adds reading overhead. Allow a patch response that replaces named components or operations, with stable IDs instead of paths such as `sections[2].ops[4].ops[2]`, which change when an operation is inserted. Include the current total and required reduction.

6. **Changes to the process.** Keep the accepted range, but provide a count-only and geometry-validation stage before requiring the final complete script. Compiler-selected massing makes exact counts difficult to infer from dimensions; explicit repeats are much easier to count.

   Reusable, validated recipes would also help: a column-and-eave bracket, stone lantern, raised veranda and roof assembly with stated connection heights and approximate costs. An outline step is useful only if it returns actionable feedback—estimated counts and footprint conflicts. An outline with no validation would mostly add another exchange.

   Acceptance establishes that the script passes the compiler. Assessing whether it is a _good-looking_ temple would still benefit from a rendered preview.

7. **Top three optimisations, in order:**

   1. **Provide pre-submission count and collision validation**, with per-operation costs.
   2. **Accept targeted patches in the same session**, so repairs do not require reproducing the entire JSON.
   3. **Replace much of the catalogue with validated assembly recipes and on-demand references**, keeping the essential geometry rules prominent.
