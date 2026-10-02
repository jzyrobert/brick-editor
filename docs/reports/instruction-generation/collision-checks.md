# Bounded collision-aware instruction generation

> Generated evaluation outputs referenced below are retained locally, outside
> this PR. See the [artifact policy](README.md#local-artifacts).

This follows the six heuristic refinements. The added engine checks full pinned CAD triangle surfaces during fixed-orientation straight translations, identifies obstacles, adds acyclic precedence constraints, and replays the actual workbench/join programme. It does not determine physical buildability. The original research and additional theoretical report remain unchanged.

## Scope and implementation

The Three.js `MeshBVH` dependency and LDraw expansion already used by the renderer/Play are reused, but the Play omission callback is disabled: studs, underside tubes and nonconvex holes remain. Curated sources register only after bundle verification; complete-library source chunks are hash-verified. Missing dependencies, unsupported texture/flex branches, reflected/scaled moving parts and work limits cannot yield clear routes. Nearby raw project geometry is conservatively treated as an unknown obstacle.

Continuous triangle separating-axis intervals find crossings between endpoints. The entire moving group starts outside the full model AABB, preventing a wholly contained initial configuration from escaping detection merely because endpoints lack surface intersections. Parallel/coplanar grazing, 0.05 LDU endpoint contact and small verified stud-seating neighbourhoods are explicit permitted-contact conventions. CAD surfaces are not guaranteed watertight solids; neither this convention nor the outside start proves physical clearance, forces or holding.

Directions come from verified underside axes, six source-reviewed axle/bush profiles, or at most two member-derived rigid-group translation candidates. A clear route wins over an unknown candidate, which wins over a blocked candidate. A blocked candidate adds part-before-obstacle dependencies only when all obstacles were checked and existing support/access requirements remain acyclic. Construction replay includes same-step peers at final positions, conservatively permitting either ordering. Detached builds exclude future main assembly geometry; incoming joins are checked as whole rigid groups.

Results persist with occurrence IDs, an explicit CAD-only scope, full external-start/final-origin positions and up to sixteen obstacle IDs. Exported shortened green arrows appear only for clear routes, and up to two B marks locate obstructions. Fingerprints include model source/poses, programme, both pinned source packs, checker policy and budgets. Model/order changes downgrade published/viewer outcomes and remove routes; structural/camera edits clear affected derived metadata. The generic viewer fly-in remains a presentation animation.

## Corpus results

All seventeen supported inputs preserve their exact source hashes and introduce every original leaf once. Town (6,083), cathedral (11,817) and harbour (6,966) still exceed the 5,000-leaf generation limit. London/Hut still exceed the 200-operation publication limit; Galaxy's strict unresolved-colour refusal remains unscored. Counts below are planning operations, including rigid joins and whole drawing owners; they are not source-leaf counts or physical feasibility rates.

| Model      | Steps | CAD clear | CAD blocked | Unknown | Added precedences | Conflicts |
| ---------- | ----: | --------: | ----------: | ------: | ----------------: | --------: |
| house      |   132 |       237 |           4 |      41 |               204 |         1 |
| castle     |   153 |       102 |           3 |     132 |                77 |         0 |
| car        |    24 |        44 |           0 |      14 |               130 |         0 |
| jeep       |    35 |        61 |           0 |      19 |               164 |         0 |
| windmill   |   135 |       247 |          13 |      79 |               151 |         0 |
| lighthouse |   111 |       135 |           0 |     135 |               240 |         0 |
| cafe       |   180 |       159 |           9 |     190 |               154 |         0 |
| playground |    69 |        95 |           0 |      17 |                61 |         0 |
| train      |   178 |       171 |           7 |     237 |                77 |         0 |
| 6350-1     |    73 |        69 |           7 |      90 |               466 |         1 |
| 6361-1     |    59 |        97 |           8 |      65 |               422 |         2 |
| 6450-1     |    37 |        38 |           3 |      45 |               218 |         3 |
| 6980-1     |   188 |         4 |           8 |     461 |                 9 |         8 |
| 8832-1     |    49 |         9 |          33 |      42 |                56 |         0 |
| 21034-1    |   235 |        61 |          35 |     368 |                 0 |         0 |
| 31025-1    |   246 |       250 |          39 |     260 |               435 |         0 |
| 31088-1    |    84 |         0 |           0 |     230 |                 0 |         0 |

A two-million broad-phase cap bounds spatial comparisons, and source-local/world coordinate gates return unknown beyond ±50,000/±1,000,000 LDU. The full-model numeric guard runs before broad-phase queries and removes unusable bounds. An adversarial coincident-cube test retains blocked at the origin and returns unknown at 1e17, where floating-point precision previously caused false clearance.

The bounded search spends 250,000 triangle tests on planning and up to one million total on final replay. Earlier complex operations can consume that budget; later unknowns are not clearance failures. The first measured shared-VM generation run ranged from roughly 0.4 to 15.6 seconds for these supported models. Generation is synchronous and can visibly pause the editor; a worker/yielding implementation and fairer per-operation budgeting remain useful follow-ups.

The prior targeted repairs remain: Café cap supports precede cap64/68/69 and ceiling138; Hut receiver178→clip180 before cover187/roof188; House frame21→door22; Lighthouse leaf59; Technic axle33 before collars34/38/40/41/43/44. Existing approximate support/closure rules remain separate from these CAD results.

## Independent review

The critic independently passed the ten new focused tests and requested three fixes: include full-pack/checker provenance in invalidation, bound source expansion rather than queries alone, and bound moving contact allowances at actual collision-time positions. All three were implemented. Adversarial tests cover thin midpath obstacles, an enclosed part, a hollow versus filled receiving frame, tangency versus penetration, missing dependencies/texture/work budget, real stud seating with an extra receiver wall, a terminal obstacle just beyond the mating neighbourhood, native/edit invalidation and whole-candidate replay.

A separate pinned axle/bush example returns CAD blocked in both axial directions because the bush/receiving axle surfaces cross. The critic confirmed this independently and rejected blanket axial exemptions. The required axle must remain; review roll, CAD geometry, intended contact fit or another movement. Physical fit is not determined. A CAD obstruction is useful evidence, not a reason to call a real tight LEGO connection impossible.

## Visual review and publication

The independent [critic](collision-critic.md) reviewed all sixteen renderable model galleries across 270 selected states: 128 sample states, 27 small official states, 35 Technic, 30 London, 33 Hut and 17 Shark. All nine sample scores remain 3/5; small official sets remain 2/5, Hut 3/5, and Technic/London/Shark 1/5. Route diagnostics preserve useful earlier repairs; they do not supply missing physical flip, hinge, tyre/rim, flexible fitting or bird suboperations from LEGO manuals.

The final captions identify clear/crossing/unknown outcomes explicitly. Tight axial fit crossings name the required receiver and advise retaining prerequisites. A concise CAD badge sits above scrolling phone notes; all six viewport sizes retain no horizontal overflow and 44px navigation targets. On short landscape, the tray may require scrolling while the badge, geometry and navigation remain visible. This is software-layout evidence, not physical-device builder testing.

The frozen metrics (local artifact), plans (local artifact), raster equivalence audit (local artifact), bounded diagram pages and fresh label repairs retain reproducible evidence. Geometry/IDs/cameras/target locations/axes/checked paths were identical across all seventeen captured/final plans when captions and numerical policy provenance changed. Existing raw renders were reused only after that comparison, and affected crowded B-label illustrations were recaptured. Updated text was composed into every bounded page; these are actual renders, not hypothetical diagrams.

Real CLI stud-seating PDF (local artifact) and axle/bush PDF (local artifact), with corresponding HTML ZIPs, retain exact 2/3-part coverage and `assemblyValidated: false`. The clear example has two clear routes and a shortened green arrow. The axial example has one clear route and two CAD crossings; no blocked-route arrows are drawn, and B1 identifies the required axle. Long existing captions still create continuation pages: four pages for the two-step clear booklet and eight for the three-step axial booklet. Compact captions remain useful future work.

## Software verification

The integrated local run passed 904 unit/integration/CLI tests before the final numeric regression was added. The final focused run passed 46 relevant tests, including all ten collision tests; the critic independently reproduced origin/large-coordinate cases. Production build, schema regeneration, pinned library validation and formatting pass. Nineteen relevant production-browser cases passed, with the five generation/publication cases repeated after the outcome wording changed. Final phone capture results are retained in viewport results (local artifact). Full validation of the final commit is recorded in the PR CI run; software checks do not establish physical buildability.
