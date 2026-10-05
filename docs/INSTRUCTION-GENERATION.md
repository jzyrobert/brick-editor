# Heuristic build instructions

Instructions → **Make steps automatically** creates a new editable hobbyist draft for an existing model. Imported plans, source records and final part poses remain intact. Review the fit, access and visibility notes before building. Publication continues to state `assemblyValidated: false`.

The [research audit](reports/instruction-generation/research.md), [baseline evaluation](reports/instruction-generation/evaluation.md) and [six refinement rounds](reports/instruction-generation/refinement-rounds.md) record the investigation, review scope and independent critic findings. Generated plans, images, booklets and audit logs are local artifacts; see the [artifact policy](reports/instruction-generation/README.md#local-artifacts). The user's [additional theoretical report](reports/instruction-generation/lego_instruction_generation_heuristic.md) is preserved verbatim; its [assessment](reports/instruction-generation/additional-report-assessment.md) separates useful proposals from physical validation. The [collision investigation](reports/instruction-generation/collision-checks.md) records the subsequent bounded CAD approach checker.

```sh
npm run cli -- instructions --input model.mpd --method heuristic \
  --max-per-step 6 --output steps.json
npm run cli -- instructions --input model.mpd --method heuristic \
  --format html-zip --width 640 --height 480 --output instructions.zip
```

`--method layers` retains layer sequencing. Without a method, CLI behavior remains: use an imported plan if present, otherwise generate layer steps. `--plan-id` selects an existing plan and cannot be combined with generation options. Heuristic publication dims prior parts; `--dim-previous` enables this for other publications.

Automation uses the normal undoable command:

```js
const q = await api.query();
const result = await api.dispatch({
  schemaVersion: 1,
  commandId: "generate-build-steps",
  expectedRevision: q.revision,
  type: "instructions.generate",
  payload: { name: "Build draft", maxPerStep: 6 },
});
const planId = result.addedPlanIds[0];
```

Generation is deterministic for a given document and loaded library/connector pack. Wait for browser `api.ready()` so complete-library connectors have loaded; the UI does this automatically. CLI registers the committed packs from disk. Part names and thumbnails come from packaged or hash-verified same-origin assets, with explicit missing pictures offline. Loading presentation names does not change planning scores.

Version 9 adds separate rim → tyre → completed-wheel placement for five narrowly reviewed pairs: 4624/3641, 4624/4084, 6014b/56890, 3482/2346 and 93594/51011. Eligibility requires the current validated library locks; source tests independently check twelve pinned part texts. Authored-origin offsets, rigid transforms, reciprocal uniqueness and typed receiving families constrain matching. Pins on 4600/2441 and the one-sided axle end on 3749 are distinct candidates; the latter does not become a symmetric axle profile. A matched wheel has two singleton builds and a zero-new-part placement; its bare receiving view omits the incoming wheel and marks the candidate feature P. Tyre deformation, hole compatibility, seating, roll and fastening remain unknown. Jeep's spare has an explicit unresolved mounting task. See [wheel operation evidence](reports/instruction-generation/wheel-operations.md).

Version 11 adds narrowly reviewed source-owned figure procedures: keep obsolete
lower-body drawings together, preserve supplied torso/arm/hand assemblies, prepare
each arm before its hand and the head before headgear. Eligible complete figures
get separate candidate benches and zero-new-part scene placements. Known crossing
constraints retain the Hut figure in its scene; a labelled prior-member receiver
detail omits surrounding scenery without asserting physical access. Source poses,
raw inventory and UNKNOWN fitting outcomes remain intact. See
[figure procedure evidence](reports/instruction-generation/figure-procedures.md) and
[the critic review](reports/instruction-generation/figure-procedures-critic.md).

Version 12 adds narrowly source-reviewed road-sign, shutter and complete steering
procedures. Two-part source signs can build on separate benches before scene
placement; their main and incoming views face the prints. Shutters use separate
operations after their frame and before a matching covering cap. Steering seats
are associated with the actual raised studs in the specialised car base before
reviewed cab closures. Labelled bare receiver details mark both end regions or
studs. Atomic ordering rejects conflicts and incomplete budget-limited scans;
known crossing relationships keep signs in the cumulative scene. Source landmarks
and camera views leave physical fit, snapping, handling and support UNKNOWN.
See [procedure evidence](reports/instruction-generation/display-procedures.md) and
[the independent critic](reports/instruction-generation/display-procedures-critic.md).

Version 13 adds narrow control-lever and cup/radio hand-grip source procedures.
Controls identify their actual slot base with conditional intact supplied-assembly
guidance. Accessories match a finite reviewed handle to one hand, with source
offsets and angular differences disclosed. Before details expose the actual
prior slot or C-shaped grip; completed views retain the accessory orientation.
These are display associations with UNKNOWN fitting and retention. Exhausted
matching scans discard all candidates because an unexamined later part could
invalidate reciprocal uniqueness. See [interface evidence](reports/instruction-generation/interface-procedures.md)
and [the critic](reports/instruction-generation/interface-procedures-critic.md).

## Planning and operation replay

Version 16 adds a bounded **source-guided** path for eligible authored parent and
attachment sections. It uses existing hierarchy and STEP records as an ordering
prior, then schedules explicit child build/join and parent scene placement while
retaining every original support, host and access prerequisite. This prior is
reported as `sourceGuidance: "hierarchy-and-step-prior"`; it is not recovered from
unordered final geometry. `instructions.generate` accepts `useSourceSteps: false`
to disable it. Existing typed workbench programmes currently retain their earlier
planner instead of mixing the two scheduling modes.

The first reviewed transfer is Shark's 66-part head plus its 15-part jaw. A finite
48336 handle / two-clip 60470b association supplies separate bare-receiver,
incoming, completed-pair and context pictures. Proper near-rigid display frames
and bounded project-first custom geometry do not change raw source poses,
verified connector coverage or strict collision eligibility. Fit, retention,
support and permissible mechanism motion remain unknown. See
[source-guided evidence](reports/instruction-generation/source-guided-articulation.md).

For focused agent refinement of a fresh deterministic draft, use the local
[hybrid tools](HYBRID-INSTRUCTIONS.md) and
[prompt](../prompts/instruction-hybrid-agent.md). The refined plan has separate
baseline provenance; changed states/views do not inherit stale CAD checks.

Version 14 also admits compact isolated static source sections with one
contact/prerequisite planning component and no known crossing in either direction.
All actual-bench prerequisites and source ownership remain required. Complete
objects stay supported/set aside until the remaining in-place scene is prepared,
then receive a zero-new-part source-position placement. Narrow finite-face sticker
profiles require every panel spanning a seam before decoration, with actual bare
receiving views and UNKNOWN adhesion/fit. Neither planning connectivity nor
absence of crossings establishes physical independence. See
[static source evidence](reports/instruction-generation/static-workbenches.md) and
[the independent review](reports/instruction-generation/static-workbenches-critic.md).

Version 10 also admits isolated wheel-bearing source sections as parent
workbenches: build the vehicle, build and fit its wheels separately, join each
wheel into the actual receiving vehicle bench, then place the completed candidate
in the scene with no new parts or inferred mating connection. Eligibility rejects
any known contact/support/host/access edge crossing the boundary in either
direction, non-wheel or unresolved children, broad/generated/missing geometry,
and prerequisites not already assembled on the active or destination bench.
Candidates are limited to 300 leaves and 500 LDU X/Z or 650 LDU Y extent;
transform eligibility uses a 0.001 near-rigidity tolerance. A whole-root candidate
additionally requires a single internal contact/support/reviewed-wheel-host
component, and cannot bypass a rejected source vehicle. Failed candidates retain
their flat programme without dropping dependencies. Incomplete connector coverage
means absence of a known crossing is not proof of physical independence. Tyre
fitting now shows its actual preceding bare rim. See the
[automatic transfer](reports/instruction-generation/scene-workbenches.md) and
[independent review](reports/instruction-generation/scene-workbenches-critic.md).

Wheel-placement main views now face the outward axis of the narrowly reviewed
receiving feature, with near-axis candidates as well as outward diagonal views.
The actual bare pin/axle view remains available. Notes name the pictured receiver
and source reference, so they also work in live views without exported R/P labels.
This is a presentation refinement of v10; operation order, receiving profiles and
UNKNOWN fit checks stay intact. See [wheel presentation evidence](reports/instruction-generation/wheel-presentation.md).

1. Expand leaf occurrences with repeated-instance identity and full transforms. The general geometry planner does not use source STEP boundaries. Version 16's separately reported eligible source-guided path uses them as an authored prior.
2. Establish drawing ownership only from explicit LDCad generated-path/spring metadata or LSynth end/cross-section runs. Introduce each complete representation atomically, retaining every source leaf. Its inventory identity, length or part breakdown remains unverified. Incomplete runs are drawing-only. Custom prints and obsolete part names are not automatically classified as helpers.
3. Use verified connector contacts; vertical underside/stud seating and hinged leaf/socket frames become typed receiving prerequisites, independent of body-centre height. Other lower body-centre neighbours remain height prerequisites and lateral contacts attachment preferences. Missing connector coverage can use conservative touching body-box support for rigid ordinary parts. These estimates remain separate from verified connections.
4. Choose ready additions against the state **at the start of the step**. Preference combines foundation utility, prior attachment, region continuity and locality. Ready hosted glazing and overlapping-region work can interrupt continuity before more enclosure work. Small ordinary parts with verified downward vertical undersides gain cross-section closure precedences: an overlapping overhead body must wait for the interior part and its supports. A blocker must have Y extent at most both X/Z extents; pin leaves are excluded, preventing tall doors/walls from becoming false ceilings. The estimated vertical approach has a 12 LDU handling margin. Support cycles retain their prerequisites and report unresolved access. This bounded box hint cannot validate a hollow space, a hand or an insertion path.
5. Apply the narrow [source-reviewed axial profiles](reports/instruction-generation/axial-profiles.md): four straight axle references and two bush references. A unique coaxial candidate gains axle-before-bush and same-end inner-before-outer precedence. Conflicts retain the existing support/access requirements, and ambiguous matches remain unknown. Every profiled operation is a singleton. These family hints do not increase verified connector coverage or establish receiving holes, roll, travel or fit.
6. Batch at most the requested number of planning units, three part/colour lots, an 8.5 LDU height spread and a 120 LDU radius from the first addition. Whole generated representations each consume one planning unit; their many rendering leaves are not loose LEGO parts. Dependencies cannot be silently satisfied by another unordered addition in the same batch. A touching lateral pair without prior attachment is split into ordered held operations; its actual insertion direction remains unknown.
7. Consider compact direct source sections for a **candidate workbench programme**. They need 4–300 planning units, known body bounds, complete connector coverage and a single verified internal contact component, at most 500 LDU X/Z extent and 650 LDU height. Broad foundation pieces, generated owners, raw geometry and scattered sections are excluded. Verified contact topology does not establish detachable stability or safe handling.
8. Collapse accepted candidates into dependency tasks. Reject candidates whose contraction prevents a task order. Build each remaining candidate only after its external source support/host/access tasks are assembled, preserving its internal introduction order. A workbench shows only that candidate's earlier and new parts; replay also supports authored pauses/resumes. A separate zero-new-part join follows the complete build, showing the incoming candidate and its final location in the main assembly. The main assembly excludes unjoined candidates. Join feasibility is explicitly `unknown`; final source orientation is retained. This is not a verified physical flip or handling instruction.
9. Score eight diagonal views, including lower views, against the state actually displayed. Conservative sample rays estimate endpoint visibility. Local placement cameras include an outlined whole-state locator when needed. Concealed additions and flexible representations can have an alternate view. White/clear/hidden additions have approximate numbered destination marks in published/evaluation diagrams; A/B mark explicit source path endpoints when available. Marks are not insertion trajectories or verified connector locations. Axial operations retain a tight detail and whole-state locator: `1` marks the new body, `R` names the receiving candidate in the whole view, and a dashed `E/F` reference shows the final axis without a motion arrow. Crowded labels use leader lines.

Earlier geometry is opaque pale grey, retaining depth and edges; new parts keep their colours. Shared pictorial trays supply names, colours and quantities. Explicit official moved aliases use the target's name/picture while retaining the original source reference and inventory identity. The editor offers detail/context/alternate cameras and separate completed-candidate/join-destination views. Destination circles are composed into exported diagrams, not live renderer overlays.

Native plans also retain optional `insertionChecks` with `cad-surface-translation` scope, clear/blocked/unknown outcomes, full external-start/final-origin coordinates and blocker IDs. Editing geometry or structural step order invalidates saved checks in the guide/publication; regenerate to restore them. Camera edits clear the affected checks and derived marks. The fingerprint covers authored models, programme, both pinned source packs, checker policy and limits. Native plans retain optional `modules`, per-step `assembly` build/join actions, cameras, targets and an optional `axisReference` with feasibility `unknown`. Replay validates disjoint ownership, completed joins and single introduction. Publication JSON carries both coverage-cumulative IDs and actual display/highlight/incoming IDs; PNG ZIPs include supporting images, and HTML/PDF compose them. Structural step edits and occurrence remapping flatten the derived programme and remove its zero-part joins; camera/notes edits can retain it. Undo restores the original programme. Editing a camera clears its derived locator, alternate/incoming cameras and destination marks. Generation provenance is a generation-time snapshot, not a recomputed certification of an edited plan.

## Straight CAD approach checks

Version 8 reuses the full pinned LDraw triangle surfaces and Three.js BVHs, retaining studs, tubes and holes. It tries connector-derived underside seating directions for ordinary rigid parts, both directions of the six profiled axle/bush axes, and at most two candidate translations for a completed rigid workbench. Unsupported parts, flex, rotations, missing source dependencies and exhausted work are **unknown**. An endpoint match alone is insufficient: continuous separating-axis intervals test the entire segment from outside the full model bounds to the final pose, without sampled gaps.

Planning adds part-before-blocker dependencies only for a known blocked candidate with no uncertain obstacles and no prerequisite cycle. After workbench restructuring, checks replay the actual displayed state. Each unordered addition sees its peers at final positions as well as earlier parts, which is conservative for either within-step order; a join moves its entire completed candidate together. Future main-assembly parts are absent from detached build checks.

**Clear** means the tested straight CAD surface travel passed under the explicit contact policy. Parallel/coplanar grazing is allowed; intersections confined to the final 0.05 LDU are treated as endpoint contact. Verified stud/antistud pairs allow connector-local triangles within a 7 LDU radius and ±5 LDU depth during the final 6 LDU. For moving triangles, the whole triangle must remain in that region throughout its collision interval. Other receiver surfaces remain active. These allowances model intended CAD contacts, not manufactured clearance or forces.

**Blocked** identifies a CAD obstruction on the selected straight candidate, never every possible movement or physical impossibility. Tight fits, roll alignment and intended interference can produce CAD obstructions even for buildable LEGO connections; inspect the receiving part and contact policy. **Unknown** means no supported complete check established a route. Saved green arrows show a shortened clear approach in exported illustrations; `B1/B2` locate up to two blockers. Neither appears as a validated physical action. Generic viewer fly-in remains a presentation animation and does not follow the checked segment.

Per generation: 20 million source characters, 500,000 cached triangles, 50,000 triangles per part, two million broad-phase queries, 100,000 potentially intersecting pair queries, one million triangle tests and 8,000 LDU travel. Planning uses a quarter of the triangle-test budget; final replay gets the remainder. Outcomes left unfinished stay unknown. Source-local coordinates are limited to ±50,000 LDU and transformed/world bounds to ±1,000,000 LDU; the whole check returns unknown outside that domain. CAD surfaces need not be watertight and do not describe solid material, grip, support, flex or snapping. All publications retain `assemblyValidated: false`.

## Limits and practical gaps

Generation accepts 1–5,000 source leaves and 1–20 planning units per batch (default 6), at most 2,000 total operations and two million inferred-support comparisons. Closure search separately has a two-million-work budget; unfinished approaches remain unknown. The UI prepares a bounded snapshot after readiness and performs generation in a dedicated worker, with cancellation and revision checks before installation. CLI/API generation remains synchronous. Market town, cathedral and harbour exceed this limit; export a smaller section to obtain a draft.

Publication retains 200 operations, 5,000 leaves, four megapixels per main diagram, 64 megapixels of requested main/supporting captures, bounded occurrence metadata, 1,000 PDF pages and 100 MiB output. Joins count as operations. London and Mountain Hut still exceed the default step publication limit. Failures are explicit; steps and source geometry are never omitted to meet budgets.

Connections, conservative bounds, source hierarchy and visibility do not establish physical stability or collision-free installation. The bounded fixed-orientation CAD sweep described below checks a limited set of straight approaches. There is no force/centre-of-mass test, general motion search, hand-support model, validated physical merge, physical flip, verified flexible-part identification or learned model. Closure precedences model only an estimated vertical approach between different immediate source sections, with known upright connectors and squat covering bounds. They do not infer hollow space or lateral access; candidate joins can still follow enclosure and require editing. Workbench candidates can contain uncertain attachment or grounding, even after the geometric gates. A camera turn changes the explanation, not the model's physical pose.

Unknown or rounded source rotations retain their exact transforms and can fail strict connector coverage. A visibility warning can be conservative; absence of a warning is not proof that a builder can identify or install every part. Generated drawings count as unverified representations, not a certified shopping list. Complex Technic and articulated models still need substantial review.

## Reproduce the investigation

```sh
# Explicit opt-in: politely fetch eight models using the repo's OMR helpers.
npm run instructions:evaluate -- --fetch --render --output .local/instructions
# Repeat against the cached models; no downloads.
npm run instructions:evaluate -- --render --output .local/instructions
# Preserve tracked failure windows as sequence changes.
npm run instructions:evaluate -- --render --review --output .local/instruction-round4
```

For a separate output directory, cache the same model files under its `models/`. `--review` additionally uses the original `.local/instructions/plans/` and round-2 `.local/instruction-round2/plans/` snapshots for tracked occurrence windows. Default rendering needs neither snapshot. Review captures include every profiled axial operation and its neighbors. Bounded contact-sheet pages contain at most nine states; first-page aliases are previews. `--only=name,name` filters visual captures; every input still receives metrics. `--reuse-main` requires an exact source/library/prepared-step/composer signature and still captures supporting views.

Evaluation covers all twelve nonempty samples and eight varied official-set models. It checks exact coverage and unchanged source hashes, writes provenance and plans, compares a layer-order baseline and actual nested OMR STEP boundaries, and captures real shared publication diagrams. Review runs include consecutive middle/late windows and candidate build/join windows. Captures use software WebGL and balanced raster edges; timings reflect local CPU/load. Independent desk review is not physical builder testing.

OMR order agreement considers only pairs separated by authored STEP/ROTSTEP boundaries, including repeated instance paths; equal generated steps score 0.5. Sets without boundaries report no agreement. The lower-contact diagnostic uses LDraw origins and is a coarse comparison, not a stability score. LEGO PDF comparisons remain qualitative and separate from fan-authored OMR ordering metrics.
