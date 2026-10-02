# Independent critic: refinement round 6

> Generated evaluation outputs referenced below are retained locally, outside
> this PR. See the [artifact policy](README.md#local-artifacts).

Reviewer: independent critic agent, separate from implementation. Date: 2026-10-01. Audience: hobbyist builders. This desk review concerns actual `connected-bottom-up-v7` diagrams and narrow axle/bush planning. No physical build, insertion/force test, stability measurement or human usability study was performed.

## Scope and evidence

Only Technic 8832 changes substantively. An independent deep comparison of all seventeen generated plans found **sixteen identical plans after removing generation metadata**, including their steps, cameras, notes, targets and modules. All seventeen retain the same source hashes and unique introduced occurrence-ID sets as round 5, without duplicates. The sixteen include Galaxy, which remains unrenderable under strict colour checks.

The reused non-Technic PNG files byte-match round-5 captures: 664 files including main views and supporting insets. That file count includes unused retained capture files and is not a count of reviewed states. I reuse the independently reviewed **236 selected non-Technic main states** from the [round 5 review](round-5-critic.md), rather than claiming a fresh render or fresh full visual review of those models. The previously repaired Cafe caps, Hut cabinet clip and House/Lighthouse doors therefore retain the same actual evidence.

I inspected all four final fresh Technic sheets, containing **35 selected main states**, their trays, context/alternate views and operation legends. This covers all eighteen profiled operations, including unmatched bush 17 and lower axle/bush 29–30, with preceding and consecutive states. Combined with the 236 explicitly reused round-5 states, the collection evidence contains **271 selected main states**. Original evidence is under `.local/instruction-round6-final/renders`; the round 6 evaluation (local artifact) records the frozen plans. These are selected states, not every generated page. The fresh Technic page 2 (local artifact), page 3 (local artifact) and page 4 (local artifact) preserve the detailed operation evidence.

The rubric remains identification, placement/orientation, coherent batches, task/view continuity, connected construction/separate assemblies and honest uncertainty: **1 requires major reconstruction; 2 substantial editing; 3 is a useful editable draft; 4 is a plausible independent hobbyist guide after limited review; 5 requires polished instructions supported by builder testing.**

## Genuine ordering improvement

The receiving axle/collar issue is materially improved. For the upper transverse axle, round 5 introduced bushes `n47`/`n48` at 9, before axle `n45` at 31. Final v7 puts the axle at 33, followed on one end by `n47` at 38, `n48` at 40 and outer half-bush `n88` at 41. The other end proceeds `n49` at 34, `n50` at 43 and `n89` at 44. Every identified axial operation is a singleton, so its dependency cannot be concealed inside an unordered batch.

For the lower axle, `n57` now precedes half-bushes `n68`/`n71` at 29→30/39. Round 5 had put `n71` at 8, before that receiving axle at 28. The short axle `n17` likewise precedes its collar `n16`, at 35→37. These are concrete corrections, not a judgment inferred from a changed step count.

The original OMR authored sequence introduces `n45` in step 7, its four larger collars in 8 and its end half-bushes in 12; lower axle `n57` is in 9 and its half-bushes in 10. The generated sequence now respects those identified receiving relationships while choosing different global scheduling. OMR authored steps do not themselves prove an official LEGO physical operation or an executable insertion path.

## Evidence boundaries and presentation finding

I independently read the six pinned official LDraw sources and verified their recorded SHA-256 hashes. Axles 3705/3706/3707/3708 use their actual local X axes and source end spans; bushes 3713/4265a use their local Z axes. The implementation tests bind these profiles to the pinned source pack. This is a source-reviewed geometric family hint, not additional connector evidence.

The matching calculation looks for one coaxial axle containing the collar span, rejects ambiguous or conflicting/overlapping groups, and excludes locally shadowed or nonphysical scaled/mirrored candidates. It does not validate axle-hole compatibility, rotational alignment, collar access, insertion travel, fastening depth or holding/support. `R` names the receiving candidate; `1` identifies the new part; dashed `E/F` gives an alignment reference without a travel arrow. Those limitations are stated in the actual captions. A unique geometric match remains **UNKNOWN** as a physical fitting action.

The first actual v7 render exposed a presentation defect: Technic 34, 39 and 43 framed the whole vehicle for a tiny collar while `R/1/E/F` labels touched or overlapped. Within this round, the implementation replaced that framing with bounded fitting detail and separated labels using leaders without arrowheads. `R` identifies the named receiving axle in the whole-view locator when available. I independently re-opened final raw 34/39/43, locator 34/39 and all four final sheets: the collar bodies and separated labels are materially clearer. At 37 the collar is still partly concealed by hub structure; the alternate view and warning do not validate access. That remains a concrete visibility/fitting exception. No insertion travel direction is implied by the repaired leaders.

After that repair, the vehicle still needs a mechanism editor: receiving holes and roll are unknown, unmatched bushes need manual identification, wheels/tyres and toggle/hinge operations show insufficient physical action, and the whole generated hose still has unverified real identity/length and fastening. The hose's owned geometry and endpoints help locate it without supplying those missing facts.

## Scores across the collection

| Model                    | Round 5 → round 6 / 5 | Basis                                                                                                    |
| ------------------------ | --------------------- | -------------------------------------------------------------------------------------------------------- |
| House                    | 3 → 3                 | Identical plan and reused reviewed evidence; early door and roof workbench retain their limitations.     |
| Castle                   | 3 → 3                 | Identical wall/cap plan; fragmentation and unknown fittings remain.                                      |
| Car                      | 3 → 3                 | Identical body instructions; tyre/rim handling remains unresolved.                                       |
| Jeep                     | 3 → 3                 | Identical cockpit/wheel evidence; holder and tyre operations remain unresolved.                          |
| Windmill                 | 3 → 3                 | Identical glazing and sails build/join; loose grille handling and merge remain unknown.                  |
| Lighthouse               | 3 → 3                 | Identical visible early leaf and lamp module; fitting and glazing exceptions remain.                     |
| Cafe                     | 3 → 3                 | Identical open stair-cap sequence; the repaired hidden additions stay repaired.                          |
| Playground               | 3 → 3                 | Identical module evidence; handling/support remain unknown.                                              |
| Train                    | 3 → 3                 | Identical final-scene sequencing; separate vehicle/track placement remains absent.                       |
| 6350 Pizza To Go         | 2 → 2                 | Identical evidence; figure build/place action remains absent.                                            |
| 6361 Mobile Crane        | 2 → 2                 | Identical evidence; boom joints, holders and tyres still require operation editing.                      |
| 6450 Mobile Police Truck | 2 → 2                 | Identical evidence; figure and wheel fitting gaps remain.                                                |
| 8832 Technic Roadster    | 1 → 1                 | Real axle-before-collar improvement; remaining mechanism/action gaps still require major reconstruction. |
| 21034 London             | 1 → 1                 | Identical plan; flexible/mechanism uncertainty and disconnected construction remain.                     |
| 31025 Mountain Hut       | 3 → 3                 | Identical exposed cabinet clip sequence; bird/quad operations still need editing.                        |
| 31088 Deep Sea Creatures | 1 → 1                 | Identical evidence; head/jaw/tail joins and physical flips remain absent.                                |

Galaxy has no scored strict diagrams. Town (6,083), Cathedral (11,817) and Harbour (6,966 rendering occurrences) remain above the 5,000-occurrence budget and are unscored. London and Hut still exceed the 200-step publication limit. These unchanged limitations are separate from the Technic improvement.

## Export legibility

I independently extracted the actual three-part axle/bush HTML ZIP (local artifact), loaded it in Chromium and inspected all three rendered step sections. The axle, inner collar and outer collar appear in separate consecutive operations with pictured and named trays. New bodies, `R` candidate and `E/F` references are legible without clipping in the inspected desktop sections; alignment legends explicitly leave travel unknown. Long repeated uncertainty text remains visually heavy. This small fixture checks publication legibility, not real-model insertion feasibility or every viewport. I also inspected all seven pages of the actual PDF export (local artifact): cover, three main steps, two notes-continuation pages and final inventory. The main diagrams, trays and marker legends are legible and preserve the axle→inner→outer progression. The first PDF split “alignment” across main/continuation pages as “al”/“ignment”. A within-round export repair now wraps ordinary words intact; I re-opened regenerated pages 3–6 and verified the complete word starts each continuation page. The long repeated captions still create almost empty continuation pages. Shorter nonrepeated captions would reduce page turning and improve printed use. No missing inventory or cropped main operation was observed.

## Official-booklet comparison and diagnostics

I reopened the actual LEGO anchors: London p36 shows a compact ordinary base sequence and tray; Hut p71 step 77 uses five ordered bird operations followed by a placement arrow; Shark p26 step 23 provides ordered suboperations and an explicit physical flip. The new axle/collar dependency resembles useful operation sequencing, but a dashed final axis reference does not supply those booklets' physical placement/flip guidance. No primary LEGO 8832 booklet was acquired, so its comparison is to the OMR sequence and these LEGO operation exemplars, not a claimed page-by-page 8832 PDF comparison.

Technic grows from 39 to 49 steps, with 18 profiled singleton operations, nine uniquely coaxial bush candidates, two unmatched bushes and no detected conflicting groups. Connector-covered occurrences remain **24/145** and unanchored additions remain 72. Visibility-review flags fall 10→6 and authored pair agreement rises about 0.829→0.837; neither metric proves physical usability. The important evidence is the corrected actual axle/collar order, preserved inventory/source poses and legible local placement information.

The next work should identify real receiving holes and roll, then show ordered tyre/rim/holder, toggle/hinge and flexible fitting operations using supported part-family rules. Until those actions are validated, these remain editable heuristic drafts rather than certified physical building guides.
