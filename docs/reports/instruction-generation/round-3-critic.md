# Independent critic: refinement round 3

> Generated evaluation outputs referenced below are retained locally, outside
> this PR. See the [artifact policy](README.md#local-artifacts).

Reviewer: the independent critic agent, separate from implementation. Date: 2026-10-01. Audience: hobbyist builders. This is a desk review of the frozen `connected-bottom-up-v4` implementation and actual rendered evidence. No physical building, insertion/force testing, stability measurement or human usability study was performed.

## Evidence and method

I reviewed all sixteen model representations: nine repository samples and seven official-set models, with 183 selected views in the final sheets. Selection includes consecutive midpoint/late sequences and baseline problematic occurrence IDs after renumbering. The additional cafe steps 11, 126 and 127 and lighthouse step 92 were inspected at original PNG size. Evidence is saved in rounds/3 (local artifact) and its linked sheets; original PNGs/HTML are under `.local/instruction-round3/renders`. This is sampled review, not a page-by-page or physical validation.

I also read `components.ts`, `lots.ts` and the changed planning logic. The rubric and score meanings are unchanged from [round 2](round-2-critic.md): part identification, placement/orientation, coherent batches, task/view continuity, connected construction/separate assemblies and honest uncertainty. **1 requires major reconstruction; 2 substantial editing; 3 is a useful editable draft; 4 is a plausible independent hobbyist guide after limited review; 5 requires polished instructions supported by builder testing.** The [original review](../instruction-critic.md) retains the primary research and LEGO booklet comparison.

## What the actual evidence establishes

The generated-component ownership change repairs a real inventory defect. Classification uses explicit LDCad generated path/spring metadata or LSynth end/cross-section descriptions and keywords with paired-end run boundaries. It does not infer ownership from a filename, part number, `STEP` or a `~` prefix. This matters because 6350's obsolete minifigure leg/hip entries also carry `~` and remain ordinary components. Raw occurrence IDs and source poses remain present for rendering.

For 8832, the active referenced hose contains 62 rendering occurrences and now appears as one complete source drawing operation. The orphan spring definition is not an active occurrence and is not counted as an additional operation. For London, eight LSynth runs own groups of 41 or 52 rendering occurrences. The tracked tube cross sections are no longer offered one by one as separately installable LEGO pieces. Publication rejects partial ownership rather than silently duplicating a component across steps.

This is **representation ownership**, not verified physical inventory. The generated lots explicitly say to verify identity/length or part breakdown; incomplete runs remain drawing-only. One source operation may represent an assembly, and does not prove that the builder needs exactly one identified purchasable LEGO part. The coloured hose representation also contains contrasting helper geometry: its displayed “Black” label should not be taken as confirmation of a physical hose's colour or connector breakdown.

The actual instruction pictures still need work. Technic step 39 shows the whole hose installed, with an unverified-owner label; it does not show how to fit its ends or identify its physical length. London step 213 similarly presents a completed flexible shape in a relatively small overall view. Replacing segment counts with a whole operation avoids misleading inventory, but does not yet provide an executable attachment instruction.

Two access fixes are visually confirmed. Windmill frame step 11 is followed by glass at step 12 while the barn is open; tower frame 61, glass 62 and course 63 form another coherent local sequence. The previous “before closing” claim has been replaced by an estimated-destination note asking the builder to check fit/access. Lighthouse's previously concealed final black round plate is now installed at step 92, with its studs and destination clearly visible before the lamp closes.

Cafe's interior bricks move from the concealed round-2 step 119 to round-3 step 11. At original size, the dark red bricks and brown round part are clear within low open walls. However, the two problematic stair plates now at steps 126–127 remain completely concealed in the original PNGs: both views show an opaque exterior wall/door and upper roof. The access preference repairs some interior order, but not the stair sequence. Cafe's visibility flags fall from 34 to 20; its steps nevertheless rise from 155 to 170 and singleton steps from 52 to 69. Those statistics and one successful early interior placement do not remove the remaining critical failure.

The wall-envelope heuristic also overlabels ordinary exterior work. Castle tower caps/wall/battlement steps 114–116 receive “Complete this interior work” notes even though the pictured additions are exterior courses or caps. The note identifies an estimated priority, not a verified physical access requirement; its wording should be narrower. House glass and windmill white grilles still need visible destinations despite earlier placement or larger pictures.

## All nine sample scores

| Model                       | Round 2 → round 3 / 5 | Judgment from the actual views                                                                                                                                        |
| --------------------------- | --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| House (local artifact)      | 3 → 3                 | Earlier frame/glass work and local roof steps help. Two clear-pane destinations at 17 remain hard to identify; garden/fence work is readable.                         |
| Castle (local artifact)     | 3 → 3                 | Gate progression 76–78 and later wall courses are clear. The 151-step plan remains fragmented, and inferred interior notes are overbroad.                             |
| Car (local artifact)        | 3 → 3                 | Body additions remain readable. Detached chassis pictures and rim/tyre operations still lack internal action guidance; clear lights/windscreen contrast remains weak. |
| Jeep (local artifact)       | 3 → 3                 | Cockpit work 18–20 is now prioritised and readable; trays remain complete. Early separated wheel holders and final far-side wheel installation still require review.  |
| Windmill (local artifact)   | 3 → 3                 | Frame-to-glass timing is repaired before closure. White grille additions at 92–93 blend with pale reference geometry; clear-pane destinations remain indistinct.      |
| Lighthouse (local artifact) | 3 → 3                 | The formerly hidden black lamp plate is now clear at 92; final antenna placement is also visible. Glass and white course contrast still need exception review.        |
| Cafe (local artifact)       | 2 → 2                 | Interior step 11 is repaired, but stair plates 126–127 are still fully hidden behind enclosed geometry. Substantial sequence editing remains necessary.               |
| Playground (local artifact) | 3 → 3                 | Bench, paving and crate details are legible. The 67-step plan with 52 singletons is still tedious.                                                                    |
| Train (local artifact)      | 3 → 3                 | Coach and locomotive additions remain useful local drafts. Station/vehicles/track still lack explicit separate workbench and placement actions.                       |

Unchanged scores retain a coarse rubric; they do not deny the verified ownership, lamp, glazing and early-interior improvements. No model earns a higher score merely because the source-operation count falls or warnings decrease.

## Official-set scores and PDF comparison

| Representation                            | Round 2 → round 3 / 5 | Judgment                                                                                                                                                                                                                                                |
| ----------------------------------------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 6350 Pizza To Go (local artifact)         | 2 → 2                 | Pizzas and figure trays are useful; obsolete minifigure parts are correctly retained. Figure construction still floats at the final scene location without an independent workbench sequence.                                                           |
| 6361 Mobile Crane (local artifact)        | 2 → 2                 | Vehicle/boom pictures remain readable. The boom is shown installed without joint-action guidance, and container work remains in the final scene pose.                                                                                                   |
| 6450 Mobile Police Truck (local artifact) | 2 → 2                 | Vehicle-first ordering and pictorial identification remain useful. Wheel, sign and figure operations still need explicit suboperations or workbench semantics.                                                                                          |
| 8832 Technic Roadster (local artifact)    | 1 → 1                 | The hose-helper inventory failure is repaired as one unverified operation. Axle/bush/steering batches still show finished poses without insertion/access guidance; hose identity and end fitting remain unresolved.                                     |
| 21034 London (local artifact)             | 1 → 1                 | Atomic cable ownership removes segment-by-segment pseudo-parts. Detached final-pose pieces, unspecified cable fitting and uncertain physical identities still need major action/inventory reconstruction. Its 222-step plan exceeds publication limits. |
| 31025 Mountain Hut (local artifact)       | 3 → 3                 | Ordinary roof growth is readable. The hidden roof clip at 170 and the bird/quad need exception views and actual separate assembly actions. The 225-step plan exceeds publication limits.                                                                |
| 31088 Deep Sea Creatures (local artifact) | 1 → 1                 | Body/head/crab sections are more local, but underside additions remain concealed. No physical flip or actual jaw/head/midsection join is represented; verified connectivity is still absent.                                                            |

LEGO London p36's ordinary base construction remains a relevant successful comparison for the generated base views. Mountain Hut p71 builds the detached bird in five inset operations before joining it onto the mountain. Deep Sea Creatures p26 gives inset operations and a physical flip, p36 builds a separate jaw, and p63 shows a tail join/rotation. Source ownership and revised final-pose order do not supply those actions. A rotated camera is still distinct from turning a physical assembly over.

Galaxy Commander remains **unscored** because strict rendering refuses unresolved body colours. Its source hose is now owned as a whole operation and the plan falls to 189 steps, but count reduction does not create missing diagrams. Large town, cathedral and harbour templates remain **unscored** because generation rejects their documented budgets. Rendering-occurrence totals are not verified physical-part counts.

## Concrete fourth-round priorities

1. **Represent actual candidate workbench builds and distinct joins.** Isolate the active module's prior/new state; show a completed incoming module separately and its final destination. Joining an already built module introduces zero new inventory, so keep it a distinct action rather than duplicating its leaves. Clearly label resumed module work.
2. **Treat hierarchy as a candidate, not a feasibility proof.** Broad grounds/foundations, generated owners and scattered or foundation-dependent source sections must not automatically become detachable assemblies. Flag or gate unconfirmed candidates. Preserve UNKNOWN merge/access feasibility and avoid asking builders to set aside a structure whose independent construction has not been established.
3. **Repair actual placement exceptions with destination cues and alternate views.** Prioritise cafe's two stair plates, clear panes, windmill white grilles, Shark's underside and complete hose/cable ends. A visible final target is useful but does not validate an insertion path; schematic arrows should not imply validated motion.
4. **Preserve closure/access review through action replay.** Keeping v4's leaf order does not guarantee that a later module can enter an already closed assembly. Test joins/interior actions against the observed cafe failure and retain that limitation when unresolved. Narrow or reword exterior “interior work” notes.

A conservative workbench/action representation is useful next progress, particularly for wheels, the shark's genuine subbuilds and small mechanism groups. It should remain a reviewable heuristic with unique ownership and explicit unknowns. Round 3 repairs important representation and access defects, while the remaining failure cases justify continuing to describe the result as an editable draft.
