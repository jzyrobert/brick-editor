# Separate wheel operations, v9

> Generated evaluation outputs referenced below are retained locally, outside
> this PR. See the [artifact policy](README.md#local-artifacts).

This continuing round addresses the critic's final-pose wheel ambiguity and synchronous generation. It does not complete the whole-corpus acceptance target. The independent [continuing critic](continuation-critic.md) retains the baseline whole-model scores pending further assembly and mechanism work.

## Source evidence and operation changes

Five source-reviewed rim/tyre pairs use local-Z axes and authored origins, including the -6 LDU tyre-origin offset for 6014b/56890. A bounded matcher rejects unsupported packs, custom shadows, scaled/reflected transforms, ambiguous pairings and receiver families that merely happen to be coaxial. Current curated/full pack locks bind eligibility; twelve source SHA-256 tests bind the reviewed geometry. Pinned LDraw texts and exact occurrence poses remain intact.

The corpus contains31 accepted pairs: Car4, Jeep5,6350four,6361six,6450four,8832four and Hut4. Every accepted pair receives an isolated rim build, tyre fitting and zero-new-part placement. Only30 have receiving candidates; Jeep's spare retains a specific unresolved mounting task. Car, Jeep,6361,6450 and Hut use4600 pin holders;6350 uses2441 chassis pins;8832 uses3749's one-sided axle ends. These hints never increase verified connector coverage or produce green CAD insertion arrows. Deformation, physical fit and fastening remain unknown.

Placement diagrams include the completed wheel, source destination J, named receiving body R and candidate feature P. A separate receiving-state detail removes the incoming wheel, leaving the pin/axle visible before installation. The editor and viewer expose before-placement and completed-placement controls using the same source poses. Their presentation cameras must fit the unobstructed canvas rectangle. Explicit guide notes scroll within a bounded panel; published supporting details expand to240px on phones.

## Responsiveness and publication

UI generation runs in a dedicated cancellable worker. Its snapshot contains only the planning document and already loaded pinned source/connector closure, with5000-occurrence and20-million-source-character bounds. The worker never fetches remote resources. A validated undoable install command rejects stale revisions/fingerprints and preserves prior plans. Cancellation terminates the worker without installing a partial draft. Automation/CLI generation retains its synchronous command.

CAD summaries and axial captions are shorter. Axial operations retain receiving, roll, seating and support tasks while avoiding a duplicate generic connector warning. PDF operation labels wrap by measured font width and preserve overflow in notes, rather than truncating instructions. Publication still states `assemblyValidated:false`.

## Evaluation and limitations

All17 supported source plans preserve source hashes and exact unique leaf introductions. The seven wheel models have206 fresh selected states, including every wheel triple and tracked prior failure windows. Ten unaffected models have identical source programme, camera, marker and checked-route inputs compared with v8; nine renderable galleries reuse those verified rasters with fresh v9 captions. Galaxy remains unrenderable under strict unresolved-colour checks. Fresh versus reused evidence is recorded separately.

During independent review, the first phone viewer captures revealed an opaque panel covering nearly the entire diagram, despite no horizontal overflow and44px controls. Alternate-view buttons also bypassed camera fitting. Those findings prompted bounded notes and fitted before/place cameras; superseded screenshots are not proof of the repair. The first concurrent final export retry failed at page startup; original PDFs remained available and were not relabelled as repaired output. Final evidence and check results are recorded in VERIFICATION after successful reruns.

Remaining feasible directions include nested vehicle/figure/bird assembly programmes, scene-placement semantics, receiving-hole and physical-flip actions, instruction-only approximate contact evidence for rounded authored transforms, flexible-item identity decisions and bounded publication chapters. These remain open. No physical builder trial or learned model has been performed.
