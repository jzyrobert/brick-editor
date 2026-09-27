# Mobile UX audit

Independent critic review, 2026-09-27. Scores are subjective usability judgments from rendered browser evidence, not accessibility certification or physical-device research. Acceptance requested by the user: **strictly greater than 8.5/10** after a separate worker addresses findings.

## Round 1 — 6.8/10

Reviewed the existing production preview at localhost:4173 in Chromium with touch emulation, at 1080 × 1800 and 360 × 800 CSS pixels. Followed initial part selection, placement, native save, inventory preview, template loading, Layers and Inspector. Screenshots are captured under `.local/ux-audit/` (local review evidence, not committed). No implementation files were changed by the critic.

| Criterion                               | Weight | Score |
| --------------------------------------- | -----: | ----: |
| Task clarity and first-use guidance     |    20% |   6.5 |
| Canvas visibility and responsive layout |    25% |   6.0 |
| Touch controls and readability          |    20% |   6.0 |
| State feedback and navigation           |    15% |   7.5 |
| Export and recovery flow clarity        |    10% |   8.5 |
| Visual consistency                      |    10% |   8.0 |

Weighted score: 6.775, rounded to **6.8**. The editor has a cohesive appearance, legible primary actions, a useful export preview and explicit placement confirmation. The compact layout makes the core building task unnecessarily difficult.

### Required improvements

1. **Remove introductory copy when placement starts.** The huge empty-state heading overlays the translucent brick at 360 × 800, obscuring the precise preview the user needs. The template action also overlaps the ghost at 1080 × 1800.
2. **Make part selection lead clearly to placement.** Choosing a part leaves the sheet open and requires manually finding Close. Dismiss it after choosing, or provide an unmistakable sticky continuation action.
3. **Reclaim compact-screen canvas space.** Header, modes, project row, toolbars and camera controls occupy much of the upper 335 pixels; the placement card consumes another 170. Compress secondary information and remove repeated sheet headings/tabs. Keep the model and placement target visible.
4. **Improve touch size and typography.** Several toolbar, camera, mode and close buttons have measured widths of 32–39 pixels. Aim for at least 44 × 44 targets. Metadata, camera labels and muted hints are frequently tiny and faint; prioritize readable action labels and stronger contrast.
5. **Make Parts browsing efficient on short screens.** The initial 360-pixel sheet reveals only two of six parts. Colour controls require substantial scrolling and disappear during placement. Use an efficient grid and persistent sheet controls or a reachable colour affordance.
6. **Correct navigation feedback.** Inspector is displayed while Layers remains highlighted in bottom navigation. Active state must match the visible panel.
7. **Fit the template to the viewport.** Loading Courtyard studio on the compact viewport crops both sides of the model. Provide a discoverable fit action and sensible initial framing.
8. **Clarify panel actions and scrolling.** Some layer icons resemble empty boxes. Use recognizable icons or visible text. Export contents scroll, but the bottom clipping provides weak indication; ensure the close control and primary action remain reachable.

Findings were sent to the separate UX worker for implementation. Re-review must inspect the actual revised screenshots and interactions, including Play when available, before assigning a passing score.

## Round 2 — 8.1/10, not yet accepted

Reviewed the revised development app at localhost:4176 in the same two touch viewports. The worker removed placement-onboarding overlap, exposed all six starter parts on compact screens, added a sticky placement continuation, increased touch targets, improved contrast and reduced duplicated sheet controls. The ghost is now unobstructed and placement actions are substantially clearer. The captured export control measurements no longer include sub-40-pixel targets.

Provisional weighted scores: task clarity 8.5, canvas/layout 8.0, touch/readability 8.0, state/navigation 7.5, export/recovery 8.5, visual consistency 8.5, yielding **8.1/10**. This does not pass the requested threshold.

Remaining review items sent to the worker: expose the selected colour and convenient colour access while placing; correct ambiguous bottom-navigation highlighting after switching Layers to Inspector; fit the studio model to the compact viewport. Final review also needs the actual Play interface and its touch interactions once integrated.

## Round 3 — functional issues found, acceptance withheld

The revised production UI has correct Inspector navigation highlighting, visible selected-colour labels and improved portrait framing. Play entry, pause/resume, fly/walk and camera controls are visually clear at both requested viewport sizes, with no horizontal overflow. Actual touch interaction testing exposed two issues that screenshots alone missed:

- Switching directly from the initial Parts sheet to Play left the sheet over the entry button, preventing entry.
- A first-animation-frame timing race raised `Frame duration must be nonnegative` and stopped movement. Drag-to-look and mode switching still worked, but a held joystick did not move the character.

Both findings were sent to the implementation owner. No passing score was assigned pending a fresh production rerun. The pause screen also exposed technical ground-plane diagnostics; the requested correction is plain-language guidance and hiding the look hint while paused.

## Round 4 — 8.7/10, accepted

Re-reviewed the rebuilt production app at localhost:4173 after the worker fixes. Both 1080 × 1800 and 360 × 800 touch layouts were rendered and inspected again. This score **exceeds 8.5**, completing the requested critique/fix/review loop for the reviewed mobile flows.

| Criterion                               | Weight | Final score |
| --------------------------------------- | -----: | ----------: |
| Task clarity and first-use guidance     |    20% |         9.0 |
| Canvas visibility and responsive layout |    25% |         8.5 |
| Touch controls and readability          |    20% |         8.5 |
| State feedback and navigation           |    15% |         9.0 |
| Export and recovery flow clarity        |    10% |         8.5 |
| Visual consistency                      |    10% |         9.0 |

Weighted score: **8.725**, rounded to **8.7/10**. The two blocking issues from round 3 are resolved in the actual production browser. Fresh initial page → Play closes Parts and exposes Enter Play. A real emulated touch on the joystick for approximately 450 ms moved the character about 41 LDU; a drag changed look direction from yaw 0 to 6.043 radians. Fly and third-person switching, pause, resume and exit all completed with **zero page errors**. Both viewport sizes had no horizontal page overflow. Inspector now has the correct active bottom-navigation background. The complete studio fits the compact canvas. The pause screen uses plain-language temporary-floor guidance and hides the look hint.

Evidence:

- [Before: compact initial view](screenshots/ux/before-360.png)
- [After: compact studio framing](screenshots/ux/build-360.png)
- [Play at 360 × 800](screenshots/ux/play-360.png)
- [Play at 1080 × 1800](screenshots/ux/play-1080.png)
- [Compact pause controls](screenshots/ux/pause-360.png)

Remaining polish opportunities, without blocking the reviewed flows: the compact top chrome still consumes substantial space; colour choices require Parts-sheet scrolling even though the selected colour remains visible; the third-person avatar could have a more refined silhouette; and a physical-device accessibility/usability study may reveal issues that emulation does not. This score assesses mobile usability of the inspected flows, not completion of the whole product specification or certification of physics correctness.

## Integrated-feature checkpoint — 8.4/10, refinements requested

After publishing, sharing, saved projects, offline tools, quality controls, clipboard and mechanisms were integrated, the critic rebuilt a separate production preview on port 4182 and inspected both touch sizes again. Existing Play entry remained accessible. The expanded Photo/Project flows introduced a compact-screen usability regression: a 360 × 800 viewport allotted only 364 pixels to a scrolling mode card while retaining Build tools, camera controls, fill and Build panel navigation. Project content occupied 1,063 pixels. The quality disclosure also lacked a comfortable touch-height target, and mobile Layers/Inspector repeated their headings.

Provisional score **8.4/10**: the prior 8.7 score applies to the earlier reviewed build; this expanded checkpoint requires refinement. Concrete requests were sent to the separate UX worker: reclaim irrelevant Build chrome for mode tasks, enlarge disclosure targets, remove duplicate sheet headings and clarify the layer-add affordance. Re-review is required before recording acceptance for this integrated build.

## Integrated-feature re-review — 8.7/10, accepted

The separate worker addressed the checkpoint findings. A fresh production rebuild was inspected at both touch sizes. On the compact viewport, Photo/Project task cards now use **591 pixels** instead of 364; unrelated Build controls and panel navigation are hidden in task modes. The quality disclosure measures **44 pixels high**, duplicate mobile sheet headings are removed and layer creation has a visible “+ Add” label. Project sharing and saved-project entry points now appear within the initial task view rather than below several screens of unrelated chrome.

The critic independently changed the quality preset through the mobile UI and confirmed the public API reported the selected Fast profile, expanded its controls, and created a share link. These interactions produced **zero page errors** and no horizontal page overflow. Mechanism information does not obstruct Enter Play. Remaining lengthy task sections scroll within their cards; existing functional tests independently cover clipboard, saved-project and offline flows. This re-review assesses the integrated mobile presentation and the interactions just named, rather than claiming every feature was manually retested.

Final rubric scores remain task clarity 9.0, canvas/layout 8.5, touch/readability 8.5, state/navigation 9.0, export/recovery 8.5 and visual consistency 9.0. Weighted **8.725 → 8.7/10**, again strictly greater than 8.5.

Updated evidence: [Photo](screenshots/ux/integrated-photo-360.png), [Project](screenshots/ux/integrated-project-360.png), [Layers](screenshots/ux/integrated-layers-360.png), [Play at 1080 × 1800](screenshots/ux/integrated-play-1080.png). Residual polish: Photo controls occupy most of a narrow viewport, so a collapsible preview-first layout would help precise framing; some secondary layer status icons remain visually subtle. These are opportunities for further refinement, not hidden completion claims about the full specification.

## Selection, transforms and layer organisation — 8.7/10, retained

The critic inspected the newly integrated SelectionTools, TransformPanel and layer folder/duplication/ghost controls in the current development app at 360 × 800 and 1080 × 1800. The controls remain legible and reachable in scrolling sheets, with explicit selection operation/depth choices and numeric alternatives to dragging handles. No horizontal overflow or page errors occurred during the reviewed flows.

The critic selected all 40 wall parts through the UI, enabled and visually inspected move handles after fitting the model, created a “Walls” folder and assigned the active layer to it. On the compact touch viewport, an exact +20 LDU X move changed every selected occurrence through one authored revision; a touch-dragged Through box then selected the 40 wall parts. These checks establish usable bindings for the inspected controls, not exhaustive geometric selection correctness. The separate conformance tests cover the latter.

Score remains **8.7/10** using the prior rubric. Expanded inspector content requires scrolling, but essential actions have comfortable targets and the sticky Close control keeps the canvas reachable. Optional future refinement: a compact contextual transform toolbar could reduce sheet switching during repeated adjustments.

Evidence: [Selection controls](screenshots/ux/selection-tools-360.png), [Move handles](screenshots/ux/transform-handles-360.png), [Layer folders](screenshots/ux/layer-folders-360.png), [Transform panel at 1080 × 1800](screenshots/ux/transform-panel-1080.png).

## Structural editing, workplanes and export profiles — 8.6/10 checkpoint

The integrated development app was inspected at 360 × 800 and 1080 × 1800 with emulated touch. ModelTools also passed an automated 1440 × 1000 desktop interaction regression. At all three sizes, Make submodel preserved selected world transforms and remapped the selection, shared-edit preview left the document unchanged, changing an input invalidated that preview, applying changed both selected colours in one revision, and undo restored the prior occurrences. These browser checks produced no page errors.

The critic also chose an XY workplane, changed its grid to 10 LDU, enabled free placement, applied keyboard shortcut settings, and downloaded a native model-profile export at both touch sizes. There was no horizontal page overflow. The new structural-edit UI explains instance-local versus all-instance edits and requires an explicit impact preview. Sticky sheet controls preserve access back to the canvas.

Provisional weighted rubric: task clarity 8.75, canvas/layout 8.5, touch/readability 8.5, state/navigation 9.0, export/recovery 8.25, visual consistency 8.75, yielding **8.6125 → 8.6/10**. This exceeds 8.5 but exposes two concrete polish issues: workplane preset buttons do not show the active plane, and the initially expanded export-profile form pushes sharing/saved-project controls farther down Project. These were sent to the separate implementation worker for refinement; this score does not presume those changes are already complete.

Evidence: [Structural editing at 360 × 800](screenshots/ux/models-360.png), [Structural editing at 1080 × 1800](screenshots/ux/models-1080.png), [Keyboard settings](screenshots/ux/shortcuts-360.png). Remaining scope boundaries are implementation constraints, not hidden UX failures: grouping accepts contiguous sibling leaves, and shared editing currently offers recolour or local translation of direct leaves. Unsupported metadata and rig-rest changes produce explicit atomic refusals.

## Structural editing and export re-review — 8.7/10, accepted

The separate worker collapsed Model export profiles by default and added an accessible active state to workplane presets. The critic's first screenshot rerun caught that the active CSS class had no visual style; that incomplete fix was returned to the worker. A second actual screenshot now shows the chosen XY plane with a contrasting peach background, accent border/underline and bold label, as well as `aria-pressed=true`.

At both requested touch sizes, the collapsed export section restores quick access to sharing and saved projects while expanding it still permits a successful native-project download. Workplane selection, numerical grid changes and shortcut application complete without page errors or horizontal overflow. The reviewed combined interface again scores **8.725 → 8.7/10**, using the accepted rubric scores: task clarity 9.0, canvas/layout 8.5, touch/readability 8.5, state/navigation 9.0, export/recovery 8.5, visual consistency 9.0. The requested threshold is strictly exceeded. Detailed inspector controls still require scrolling on a narrow screen; no claim is made about untested physical-device ergonomics or whole-spec completion.

Updated evidence: [Active workplane](screenshots/ux/workplane-360.png), [Compact Project with export disclosure](screenshots/ux/export-profile-project-360.png), [Project at 1080 × 1800](screenshots/ux/export-profile-project-1080.png). The desktop/touch model-command regression remains in `tests/browser/models.spec.ts` (three passing viewport cases).

## Editable instructions and moving Play mechanisms — review and correction

The critic reviewed an isolated production build at both touch sizes. Instruction controls supported notes, front-camera preview/save, splitting selected additions, step reordering, explicit delete/unassign and undo. Opening an authored door rig exposed a usable hinge slider; setting it to 90° changed its live pose. The expanded vehicle controls remained separate from the movement stick and primary Play actions.

One concrete visual correctness regression withheld acceptance: generating a four-step plan for a 40-part wall labelled the current view “Step 1 of 4 · 10 new parts,” while the canvas still displayed the complete wall. Asynchronous renderer rebuilding overwrote the instruction visibility mask. Root retained that mask across rebuilds, and the separate instruction worker added an actual-canvas regression: first-step and complete-model images differ; returning to the first step, saving notes and undoing reordering restore the expected pixels. The publication text was also corrected to explain saved per-step cameras, and active mechanism controls now state the vehicle/world-collision and riding limitations.

## Editable instructions and moving Play mechanisms — 8.7/10, accepted

Fresh production screenshots confirm the first-step subset immediately after generation and correct controls at 360 × 800 and 1080 × 1800. Both viewport flows completed generation, notes/camera save, split, reorder, delete/unassign and undo, restoring coverage to 40 of 40 assigned with no empty steps. The live door slider reached 90°. There were no page errors or horizontal overflow. The mechanism disclosure can be collapsed to regain canvas space, and the compact expanded panel leaves movement, jump, pause and camera actions reachable.

The reviewed combined mobile interface retains **8.725 → 8.7/10**, strictly exceeding 8.5. Rubric: task clarity 9.0, canvas/layout 8.5, touch/readability 8.5, state/navigation 9.0, export/recovery 8.5, visual consistency 9.0. Narrow-screen instruction editing still requires substantial scrolling; a persistent step navigator could reduce that effort. This score does not certify complete physics, arbitrary-model traversability or real-device ergonomics.

Evidence: [Incorrect preview before fix](screenshots/ux/instructions-before-preview-fix-1080.png), [correct instruction preview](screenshots/ux/instructions-editor-1080.png), [compact instruction editor](screenshots/ux/instructions-editor-360.png), [step controls](screenshots/ux/instructions-step-edit-360.png), [live door](screenshots/ux/play-moving-door-360.png), [compact vehicle controls](screenshots/ux/play-moving-car-360.png), [vehicle controls at 1080 × 1800](screenshots/ux/play-moving-car-1080.png). Separate Play acceptance findings and regression evidence are recorded in [PLAY-ACCEPTANCE-AUDIT.md](PLAY-ACCEPTANCE-AUDIT.md).

Follow-up interaction evidence: at both touch sizes, holding the vehicle's forward control for 12 manual ticks moved it 20 LDU; releasing and advancing another 12 ticks produced no further travel. A separate desktop regression also verifies keyboard movement after camera-button clicks, native Enter/Space Run activation and Escape pause. These checks passed after the final focus-handler correction.

## Play camera, safe spawn and remapped keys — 8.7/10, accepted

The critic independently inspected a fresh isolated production build in Chromium with emulated touch at 360 × 800 and 1080 × 1800. At both sizes, camera fields accepted eye height 50 LDU, FOV 80°, near plane 1 LDU, follow distance 200 LDU and pitch limits ±45°. An invalid minimum pitch produced an error in the same degrees used by its field. The earlier radians-based message and ambiguous recovery label were corrected by the separate implementation worker before this review.

Saving a validated spawn at `[80, -0.3, 40]` left the actor in place; explicit Go to saved spawn moved it to that exact position in Walk mode. Unsupported feet coordinates were refused with a concrete supporting-surface explanation. Remapping forward from W to ArrowUp left W without horizontal movement and moved the actor 10 LDU over six manual ticks with ArrowUp. Before/after authored document queries were identical; no page errors or horizontal overflow occurred. These tests exercise session configuration and UI bindings, not arbitrary-world traversability.

The combined interface retains **8.725 → 8.7/10**, strictly greater than 8.5. Rubric: task clarity 9.0, canvas/layout 8.5, touch/readability 8.5, state/navigation 9.0, export/recovery 8.5 and visual consistency 9.0. On a 360-pixel screen, expanded settings require scrolling within the pause card; Resume and Exit remain reachable outside it. A larger configurable pause sheet could reduce scrolling, but no material interaction failure remains in the reviewed flows. Physical-device ergonomics remain unmeasured.

Evidence: [Camera at 360 × 800](screenshots/ux/play-settings-camera-360.png), [safe spawn](screenshots/ux/play-settings-spawn-360.png), [remapped keys](screenshots/ux/play-settings-keys-360.png), [camera at 1080 × 1800](screenshots/ux/play-settings-camera-1080.png), [spawn validation](screenshots/ux/play-settings-spawn-1080.png), [keyboard controls](screenshots/ux/play-settings-keys-1080.png). Four independent actual-avatar unit tests additionally cover rigid-joint invariants and first-person suppression; their scope and tolerances are recorded in the Play acceptance audit.

## Play world inclusion, dimming and shared rotation — 8.3/10 checkpoint

Independent production interactions at both touch sizes confirmed that excluding the hidden Wall layer removed its occurrences from the Play world, and disabling the temporary floor safely entered free flight. Exiting preserved the authored document. Instruction step 2 showed opaque new additions above a visibly ghosted earlier course, with an explicit preview/publication checkbox. Shared 90° rotation applied as one revision. No page errors or horizontal overflow occurred.

The compact rotation form nevertheless regressed: inline labels and inputs wrapped between unrelated fields, obscuring which axis, angle and pivot coordinate belonged together. Play world checkbox labels also appeared unusually small and pale. Provisional score **8.3/10** with acceptance withheld; the separate UX worker received concrete layout/contrast fixes. [Before correction](screenshots/ux/shared-rotation-before-360.png). The prior accepted score applies to the earlier interface, not this unchecked extension.

## World inclusion, dimming and rotation re-review — 8.7/10, accepted

The separate worker corrected field layout and checkbox contrast. An isolated production rebuild now shows each rotation label with its own 44-pixel control, compact pivot rows on the narrow screen and a three-column pivot group at 1080 pixels. World choices have readable 14-pixel labels with normal text contrast. Fresh screenshots at both sizes confirm the fixes; the prior inline-field failure is resolved.

Both viewport flows again excluded the hidden Wall layer, disabled temporary ground, entered a matching empty free-flight world and exited without changing the authored document. Instruction dimming distinguished ghosted previous parts from opaque new additions. Shared local rotation remained reachable and applied as one authored revision after explicit impact preview. No page errors or horizontal overflow occurred. The combined interface scores **8.725 → 8.7/10**, strictly exceeding 8.5: task clarity 9.0, canvas/layout 8.5, touch/readability 8.5, state/navigation 9.0, export/recovery 8.5, visual consistency 9.0.

Residual limitation: expanded structural editing and instruction publication require scrolling, and the instruction card covers much of the canvas at 360 pixels. These were not silently counted as ideal ergonomics; physical-device use remains unmeasured. Renderer/publication dimming correctness is covered separately by the worker's actual-pixel regressions.

Evidence: [Play world choices](screenshots/ux/world-dimming-world-360.png), [instruction control](screenshots/ux/world-dimming-dimming-360.png), [corrected rotation form](screenshots/ux/world-dimming-rotation-360.png), [world choices at 1080 × 1800](screenshots/ux/world-dimming-world-1080.png), [visible dimming](screenshots/ux/world-dimming-dimming-1080.png), [shared rotation at 1080 × 1800](screenshots/ux/world-dimming-rotation-1080.png).

## User-authored rigs and allowed-part fills — 8.7/10, accepted

The critic independently completed hinge and planar-vehicle authoring in an isolated production build at 360 × 800 and 1080 × 1800. The touch picker assigned separate fixed/moving groups, then a chassis and two wheels after undoing the hinge. World-space pivot/centre fields, named axes, radius/angle units and an explicit assignment preview remained readable and reachable. Creation succeeded through the UI; the separate worker's two browser regressions cover overlap/lock refusals, invalidated previews, persistence and undo/redo.

The initial interface scored **8.6/10** because identical part references were distinguishable only by list index. The critic requested a separate-worker refinement. Fresh screenshots now show named colour and world XYZ coordinates on each picker row, also connected as accessible descriptions. The critic selected the blue part at world `(80, 0, 0)` through this updated picker at both sizes; no horizontal overflow occurred.

The allowed-part fill flow used a 4 × 3 mask `1111 / 1001 / 1111`, leaving two centre holes. At both sizes it previewed five additions, covered all 10 eligible cells and reported zero unresolved cells. Commit added exactly five parts in one authored revision. Controls, checkbox groups, the mask field and the sticky Close button remained accessible. No page errors occurred in either complete authoring/fill flow. These results establish the tested UI bindings, not optimal packing or physically validated connectivity.

The final combined score is **8.725 → 8.7/10**, strictly greater than 8.5. Rubric: task clarity 9.0, canvas/layout 8.5, touch/readability 8.5, state/navigation 9.0, export/recovery 8.5, visual consistency 9.0. Residual polish: large vehicle drafts require substantial vertical scrolling; the technical fill diagnostic could be simplified for general users. No claim is made about physical-device ergonomics.

Evidence: [Identifiable touch picker](screenshots/ux/rig-fill-picker-360.png), [hinge fields](screenshots/ux/rig-fill-hinge-360.png), [wheel fields](screenshots/ux/rig-fill-vehicle-360.png), [fill preview](screenshots/ux/rig-fill-fill-preview-360.png), [picker at 1080 × 1800](screenshots/ux/rig-fill-picker-1080.png), [hinge preview at 1080 × 1800](screenshots/ux/rig-fill-hinge-1080.png), [vehicle at 1080 × 1800](screenshots/ux/rig-fill-vehicle-1080.png), [fill at 1080 × 1800](screenshots/ux/rig-fill-fill-preview-1080.png).
