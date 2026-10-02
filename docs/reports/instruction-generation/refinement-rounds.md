# Six deterministic refinement rounds

> Generated evaluation outputs referenced below are retained locally, outside
> this PR. See the [artifact policy](README.md#local-artifacts).

The user first requested four successive implementation, evaluation and independent critic cycles for hobbyist builders, keeping the LEGO booklet comparison. Two further requested rounds add conservative enclosure precedence and narrow mechanism sequencing. These rounds refine the existing heuristic; no learned model is trained and no physical build validation is claimed.

## Round 1 — placement readability (v2)

Added local orthographic placement views with an outlined whole-assembly locator, opaque pale prior surfaces that retain depth, and pictorial named/coloured part trays shared by publication and the evaluation renderer. The live editor has the same part pictures and lets the builder switch between detail and whole-assembly cameras. Changing a camera clears its derived locator.

The critic caught a reversed horizontal locator and missing curated-catalogue thumbnails during the first capture. Both were fixed and regenerated before the formal review. The locator now has a numerical test against the actual three.js camera projection, and real browser HTML publication verifies pictures and locator composition.

All 12 samples and eight cached OMR models were evaluated. Seventeen generated with exact occurrence coverage; three exceeded the unchanged 5,000-occurrence generation limit. All nine supported samples and seven renderable OMR models received 11 representative actual views. Galaxy Commander retained its strict unresolved-colour refusal. Step order and counts are identical to v1, intentionally isolating the presentation change.

Validation: production build; 25 relevant unit tests; seven relevant browser checks (desktop/phone generation, pale context, real HTML/PNG/PDF publication and cancellation); additional layout checks at 1440×1000, 1080×1800, 360×600, 411×685, 390×844 and 686×411, with trays present and no horizontal overflow. Software WebGL on the shared Linux ARM64 VM, not physical phone hardware.

Round 1 metrics (local artifact), actual contact sheets (local artifact), [independent review](round-1-critic.md). The complete private captures are reproducible with `npm run instructions:evaluate -- --render --output .local/instruction-round1` using the cached models.

## Round 2 — prior-state batching and region continuity (v3)

Additions must satisfy support and glazing-host prerequisites against the state at the start of a step; unordered additions within a step can no longer silently depend on one another. Batches stay in one region, ready regions continue before scattered cosmetics, and foundation ties use bounded downstream utility. Glazing hosts remain conservative body-box hints. Complete-library names and thumbnails load through verified same-origin assets; the critic exposed a CSP-incompatible thumbnail fetch, which was replaced with image decoding.

All 17 supported inputs retained exact coverage; the expanded visual review covered 183 actual views of nine samples and seven OMR sets. The critic found earlier house glazing and better separation of castle sections, but most scores stayed unchanged. Cafe regressed from 3/5 to 2/5: its interior staircase followed enclosing walls. Castle grew from 107 to 149 steps, with many singletons. These failures motivated round 3; improved authored-order agreement on some models was not treated as proof of usability.

Validation: production build, 27 relevant unit checks, three browser generation/publication checks, and real browser decoding of complete-pack thumbnails. Metrics (local artifact), contact sheets (local artifact), [independent review](round-2-critic.md). Expanded windows are reproducible with `--render --review`; cached images are reused only when a source/library/step capture signature matches.

## Round 3 — drawing ownership and access preferences (v4)

Explicit LDCad generated-path/spring metadata and paired LSynth runs establish whole drawing ownership, including repeated instance identity. Every owned source leaf is introduced in one operation; inventory counts a generated representation once and explicitly leaves its physical identity, length or breakdown unverified. Incomplete LSynth drawings have no physical quantity. Printed/custom parts remain ordinary references. Partial owner edits are permitted in preview as drawing-only and refused by publication until repaired. Source metadata is cached during ownership detection.

The referenced Technic hose's 62 leaves now make one operation; London's eight cable runs remain intact. The Technic file also defines a spring, but that definition is unreachable and is not falsely counted as an installed assembly. Access preferences let ready overlapping regions and hosted glazing interrupt region persistence. Their body-box estimates are not insertion proofs.

The critic reviewed 183 actual views, including tracked cafe stair and lighthouse lamp additions. Windmill panes now precede roof closure, cafe interior work moves to step 11 before enclosure, and the lighthouse lamp plate is visible earlier. Cafe stairs at 126–127 remain concealed, and some tower caps were incorrectly described as interior work. All coarse scores remain unchanged: samples 3/5 except cafe 2/5; simple official sets 2/5, Hut 3/5, complex sets 1/5. This motivates explicit action replay and better placement explanations in round 4.

Validation: production build; 30 relevant unit checks before the next-round action tests; real browser pictorial publication and whole-owner flexible inventory publication; generation/undo checks at desktop and phone. The first browser publication startup timed out while a build was still finishing; its isolated rerun on the completed build passed. Metrics (local artifact), contact sheets (local artifact), [independent review](round-3-critic.md). All 17 generated inputs have exact coverage and unchanged model-source hashes; the same three oversized samples and unresolved-colour refusal remain.

## Round 4 — explicit action replay and placement exceptions (v5)

Added separate workbench build states, completed-candidate join operations that introduce no new parts, numbered destination legends, flexible drawing endpoint locators, lower/alternate cameras and shared incoming-candidate diagrams. Ordinary official moved aliases obtain canonical names/pictures without replacing their source references. Plan validation, native persistence, editing, publication limits, the instruction editor and the follow-along viewer all understand the programme. Structural edits conservatively flatten derived actions and remove their stale cameras/marks while retaining part introductions.

The first pilot used compact source boxes as candidate evidence. The critic rejected a disconnected car body and joins that preceded their actual assembled supports. Within this fourth cycle, candidate acceptance was narrowed to sections with known bounds and one verified internal contact component. Accepted modules become whole dependency tasks; all external source support/host tasks must precede them. Contraction cycles fall back to cumulative construction. Eight candidates survive: house roof, windmill sails, lighthouse lamp, playground seesaw and swing frame, and three small London sections. Internal contact and dependency order do not establish detached stability or a feasible merge; those remain explicitly unknown.

The critic re-reviewed the repaired implementation and all sixteen model sheets, initially 201 selected actual views. After rebasing onto the new instruction viewer/renderer on `main`, all 17 plans were compared and remained identical. Fresh captures also include London's third accepted candidate. This is an integration check within round 4, not a fifth algorithm round. The [final critic report](round-4-critic.md) records its actual final inspection coverage and comparison with LEGO booklets. Final metrics (local artifact) and contact sheets (local artifact) retain source hashes and attribution.

Integration review exposed saved-camera cropping on phones and action captions hiding specific support notes. The viewer now fits the saved view direction into the panel-free rectangle and keeps the notes beside the caption, with scrolling for long explanations. Projection checks, actual viewport masks and six screen sizes verify that repair. Complete v5 PDF/HTML examples (local artifact) exercise pictorial trays, legends and zero-new-part joins in the exported content.

The lamp plate and sails now have visible workbench build/join states; jeep's far-side wheel is visible from below. Flexible elements retain one operation and gain endpoint diagrams. Cafe stairs 126–127 and Hut clip 170 remain hidden in both main and alternate views: a destination mark through opaque geometry is still a failed placement explanation. Verified insertion/fastening, physical flips and the booklet's bird, jaw and tail build/merge actions remain missing.

## Historical result after the first four rounds

The gains are concrete, but most coarse usability scores do not rise. These are editable drafts for hobbyists, with no physical build study or independent-build guarantee. Cafe regressed in round 2 and remains 2/5. More constrained prerequisites also increase step counts and sometimes tedious singletons; reduced warning counts and authored-order disagreement are not usability scores.

| Model or group                                 | Original → final / 5 | Principal outcome                                                                         |
| ---------------------------------------------- | -------------------- | ----------------------------------------------------------------------------------------- |
| House, castle, car, jeep, windmill, lighthouse | 3 → 3                | Clearer parts and placement; selected workbench tasks; unresolved handling/access         |
| Cafe                                           | 3 → 2                | Earlier visible interior work, but concealed stairs still require sequence editing        |
| Playground, train                              | 2 → 3                | Better part identification and placement; playground has separate build/join states       |
| Pizza To Go, Mobile Crane, Mobile Police Truck | 2 → 2                | Better trays and locators; vehicle/figure assembly still incomplete                       |
| Mountain Hut                                   | 3 → 3                | Ordinary growth readable; hidden clip and missing bird/quad actions                       |
| Technic Roadster, London, Deep Sea Creatures   | 1 → 1                | Ownership/endpoints or some small modules improve; major operation reconstruction remains |

All 17 supported models retain exact occurrence coverage and their source records/poses. Town, cathedral and harbour still exceed 5,000 source occurrences. Galaxy Commander generates 189 steps but strict rendering refuses unresolved body colours. London and Hut each have 225 steps, exceeding the unchanged 200-step publication budget. These four unscored inputs and two publication refusals are not treated as successful independent guides. Software checks for this historical checkpoint are recorded in [VERIFICATION](../../VERIFICATION.md).

## Round 5 — enclosure precedence and typed receiving parts (v6)

Interior operations with verified downward connectors precede estimated overlapping overhead closure. The bounded rule uses a 12 LDU handling margin and squat blockers across immediate source sections; it retains support prerequisites if the proposed order conflicts. It does not validate hand access or hollow space. Verified vertical seating and pin/socket frame relationships override misleading body-centre heights. Unanchored lateral mates become separate held operations.

The critic rejected two pilots: a London tile preceded its verified receiver, and a tall House door was treated as a ceiling and delayed behind its roof. Typed contacts and the narrower blocker gate repair both. Final House frame 23 precedes visible door 24; Lighthouse frame 58 precedes visible leaf 59. Exact Cafe stair caps move to 68–69 before ceiling 138, and Hut's cabinet clip follows receiver 179 at 181 before its covering plate 188 and roof slope 189. Cafe rises **2→3/5**; all other scores remain unchanged.

All seventeen plans preserve sources and unique introductions. Six workbench candidates remain; London's three become one through conservative contraction fallback. London hidden-view flags increase 15→21, despite fewer unanchored additions. This is not a monotonic readability improvement. The independent review covers 256 selected states across sixteen galleries using bounded page captures. Metrics (local artifact), pictures and attribution (local artifact), [critic](round-5-critic.md).

## Round 6 — axle/bush operations and readable axis details (v7)

Six [reviewed pinned LDraw profiles](axial-profiles.md) identify four straight axles and two bush references. A unique coaxial match gains axle-before-bush and same-end inner-before-outer order; incompatible/overlapping groups retain original prerequisites. Ambiguous/unmatched parts stay unknown, and every profiled operation is a singleton. Physical hole compatibility, roll, insertion travel and support remain unknown. These hints do not add verified connectors or modify source transforms.

Technic 8832 changes from 39 to 49 steps. Axle `n45` now appears at 33 before collars at 34/38/40/41/43/44; lower axle `n57` at 29 precedes bushes 30/39. Previously some bushes appeared before their axle. E/F is a dashed final-axis reference, 1 marks the addition, and R names the receiving candidate. The critic found initial whole-vehicle framing too small and labels overlapping: fitting details now retain locator context and separate labels with leader lines. Collar 37 remains partly obscured and needs review.

There are eighteen profiled singleton operations, nine matched bushes, two unmatched bushes and no detected group conflict. Connector coverage stays **24/145**; the 62 source hose leaves remain one whole owned representation. Sixteen other plans are identical to round 5 after generation metadata is removed. The critic inspected 35 fresh Technic states covering all eighteen operations, and retained the reviewed 236 unchanged non-Technic states without claiming a fresh full review. Metrics (local artifact), pictures and attribution (local artifact), [critic](round-6-critic.md), actual exports (local artifact).

## Result after six rounds

All nine supported samples score **3/5**, useful editable drafts; Cafe recovered from 2/5. The three simpler official models remain 2/5, Hut 3/5, and Technic/London/Shark 1/5. Mechanism ordering improves without lifting Technic's coarse score because receiving holes, tyres/holders, toggles, hinges and flexible fitting still require major operation editing. These are desk-review scores, not a physical builder study.

The same twenty inputs yield seventeen exact-coverage plans and three explicit oversized refusals. Galaxy's 188-step plan retains its strict unresolved-colour rendering refusal. London (235 steps) and Hut (247) exceed the unchanged 200-step publication limit. Further work should add reviewed physical operation families and executable receiving relationships rather than repeat broad scoring adjustments. [Verification](../../VERIFICATION.md) records software checks and limits.
