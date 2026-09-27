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
