# Sol 6.1 high: prompt directions, variance and reply examples

This experiment compares three separate changes against the retained independent E and diorama baselines. All six original briefs run in both styles for each change: **36 new builds**, plus **24 exact-input baseline repetitions and 12 syntax-only-example builds** requested in parallel (72 total). Every case starts with its original brief, a new native session and an empty directory. Models receive no source builds, images, reviewer comments or other cases. This is an exploratory single sample per condition; differences may include generation variance.

## Results and recommendation

All 72 new cases are complete and reviewed across four views. The preview includes the twelve retained baselines: 84 builds and 336 images.

**Keep E's design guidance. Richer part information is the strongest experimental arm, but is not yet a reliable general quality improvement.** It improves six retained samples, ties five and weakens one; several of those improvements also occur in unchanged-prompt repetitions. The useful outcome is an optional, build-agnostic reference facility, not more prescriptive subject-specific design rules.

| Condition                                  | Better / tied / worse than retained baseline | Subjective total / 240 |
| ------------------------------------------ | -------------------------------------------- | ---------------------- |
| Commercial Lego scale / open diorama scale | 4 / 1 / 7                                    | 168                    |
| Design anti-patterns                       | 4 / 3 / 5                                    | 170                    |
| Richer part information                    | 6 / 5 / 1                                    | 183                    |
| Unchanged prompts, repeat 2                | 5 / 5 / 2                                    | 182                    |
| Unchanged prompts, repeat 3                | 5 / 3 / 4                                    | 175                    |
| Syntax-only reply example                  | 4 / 3 / 5                                    | 172                    |
| Retained E / diorama                       | —                                            | 172                    |

These are unblinded editorial scores across five 0–4 axes, not statistical evidence or physical certification. Exposed studs and intentional angular/pixel forms are not inherently failures. Per-case explanations and the range of unchanged-prompt samples are in the [assessment](assessment.json) and expandable preview notes.

The sizing arm chooses **fewer parts in all twelve cases**. It produces useful compact Piplup, dragon and Ewok-spacecraft alternatives, but both Destroyers lose the broad wedge. The Ewok brief asks for an Ewok-inspired version of classic 1970s Space sets; a treehouse village is not required, so a freestanding spacecraft is a valid interpretation. Open-size dioramas remain compact rather than expanding into huge scenes.

| Brief                | Lego-style parts | Diorama parts |
| -------------------- | ---------------: | ------------: |
| Pelican              |              249 |           359 |
| Piplup               |              252 |           384 |
| Temple               |              800 |         1,492 |
| Dragon               |              284 |           613 |
| Destroyer            |              530 |           819 |
| Ewok / Classic Space |              187 |         1,111 |

Anti-pattern guidance helps one pixel-like Piplup and a diorama Destroyer, but often returns to coarse stepped bodies, slab foliage and large studded surfaces. Its mean search use is also lower: 3.8 queries per build. That is an observed behavioural difference, not proof that search count caused the weaker finish.

The richer-data arm adds conservative physical extents, anchor-relative connector coordinates and official shortcut assembly evidence to searches. It does not solve placement or guarantee compatibility. Its Piplup and diorama dragon are promising; its architectural scenes are no better than the stronger unchanged controls. Part-data replies are substantially longer, so a narrower physical-dimensions-versus-connection-evidence comparison is a better next experiment than adding more prose.

The parallel controls show why single examples are misleading. Unchanged E fixes detached dragon wings, produces both strong and weak Destroyer silhouettes, and switches from Ewok treehouses to wooden spacecraft. The syntax-only example also produces occasional better samples, but similar or stronger results occur with the original example.

The completed unchanged-prompt sets score **182/240 and 175/240**, compared with 172/240 for the earlier retained set. Richer data's 183/240 is only one point above the stronger repeat. Only two richer-data samples exceed the observed three-sample range: diorama Piplup and diorama dragon. These are candidates for replication, not a demonstrated general advantage. The anti-pattern arm has no sample above that range; the size arm has one and five below it.

No combined prompt is being promoted or generated from this batch: there is no second independently convincing improvement to pair with the modest data signal. The authorized next step was to combine promising independent changes; the evidence does not justify bundling the weaker sizing/anti-pattern/example conditions. The experimental controls remain available, while E and the existing diorama prompt remain unchanged.

## Conditions and reproduction

| Variation     | Design guidance                                                                  | Requested size                                                        | Additional part information                                                              |
| ------------- | -------------------------------------------------------------------------------- | --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Baseline      | Retained E / diorama                                                             | Original target                                                       | Existing footprints, heights, overreach, colours                                         |
| Sizing        | Retained E / diorama, with size-related instructions adjusted                    | Lego: plausible commercial set size; diorama: no requested size limit | Existing information                                                                     |
| Anti-patterns | A short design anti-pattern list; technical reference and reply example retained | Original target                                                       | Existing information                                                                     |
| Part facts    | Retained E / diorama                                                             | Original target                                                       | Physical extents, verified connector positions, official shortcut assembly relationships |

The rejected bundled loop-1 prompts are not the baseline. The extra geometry and connection information is generic part reference data, not a solver, assembly recipe tailored to a brief, or visual feedback. It is supplied on part searches. The unchanged curated list remains in every prompt. Existing checks still return counts and errors; construction warnings are not added to model feedback.

“No requested size limit” removes numeric targets from the prompt, checks, repair messages and size scoring. It does not remove execution limits: the code sandbox remains 10 seconds and 50,000 ops, and the compiler/application resource limits still apply. Counts are reported informationally. No count is used as a hidden pass/fail target.

Part geometry comes from the pinned local LDraw pack. Bounds are conservative extents, including studs, expressed relative to the actual placement anchor. Physical extents also use the same unit on every axis, with 1 stud = 2.5 plates. Verified stud/anti-stud and hinge coordinates come from the existing derived connector pack. Wheel pins, Technic axle/pin, bar and clip connections are not verified by that checker. Unknown is reported explicitly. Co-occurrence in an official LDraw shortcut is assembly evidence, not a claim that every child directly mates. The existing generic `4600` wheel macro is documented; no new assembly macro or transform is introduced.

The [protocol](protocol.json) freezes prompts, runner hashes and conditions. [run.py](run.py) reproduces the batch from the repository root; [package.py](package.py) archives accepted submissions without edits and audits native model/effort, empty working directories, tool use, and input images. Native session logs remain private under `.local/` and Codex's session store. Generated sources and compiler reports remain exact.

Additional comparisons run in parallel with the primary batch:

- Two additional repetitions of each unchanged original prompt, with independent starts, give three samples per brief/style including the retained baseline. They estimate ordinary variation before interpreting small differences. This is still a small sample, and the retained baseline ran earlier.
- Replace only the architectural reply example with a two-part syntax/stacking example, holding every other input fixed, to test example anchoring. Both styles receive the same syntax example. The output contract still uses the exact default wording.

A possible subsequent test would split physical extent data from connector/assembly data if the combined information arm helps, to learn which information earns its extra context.
Promising independent changes can be combined after inspecting the comparisons and the observed baseline variance.

The [portable preview](index.html) and [recorded assessments](assessment.json) contain all 72 reviewed cases. No default prompt or published gallery was changed.

My favourite individual results include the unchanged-prompt repeat-2 Lego Destroyer, repeat-3 Lego temple, the richer-data diorama Piplup, and the syntax-example Lego Ewok/Space mech. The mech is a creative alternative, not evidence that the example change generally wins. For a compact character, the 252-part commercial-scale Piplup is also successful.

## Verification and provenance

All 72 exact filled inputs reconstruct, accepted source equals each native final submission, and final compiles have zero errors. All sessions use Sol 6.1 high in empty directories without images, other-build sources or executed native tools. Five attempted native calls were blocked by the disabled host and are recorded rather than discarded. Construction warnings remain; acceptance and visual review do not certify physical buildability. The standalone preview audit covers seven pages, 336 embedded images, four views, both styles and six viewport sizes without external requests.

The enriched search payload required stdin transport instead of command-line arguments before the first richer-data run. The protocol records both runner versions; model-visible text is unchanged. After all generation finished, the part-facts source received formatting only. Its exact executed bytes are retained in `executed-agent-part-facts.ts.txt`; protocol hashes and identical minified TypeScript transforms verify equivalence.
