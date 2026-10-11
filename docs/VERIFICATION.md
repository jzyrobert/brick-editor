# Verification — 27 September 2026

## Gallery prompt generations — 10 October 2026

- The latest selector uses explicit featured-generation metadata rather than publication date. Unit checks cover legacy-index compatibility, invalid or duplicated generation metadata, an F run newer than E, combined filters and retained source arrays.
- A production build passes schema/type checks. All nine relevant browser checks pass with one worker (2.3 minutes), including generation selection, recoverable empty results, detail/Play selection retention, imports, edited-copy protection and offline/corrupt download recovery. Layout checks cover 360 × 600, 411 × 685, 390 × 844, 1080 × 1800, 686 × 411 and 1440 × 1000 with 44 px controls and no horizontal overflow. An earlier test incorrectly expected the detail page after the main Gallery navigation from Play; it was corrected to assert the restored list, and the final nine checks pass.
- Migration `0003_prompt_generations.sql` applies to a local copy of the 42-row production baseline (18 visible), preserving the existing rows and passing foreign-key checks. The 80-build publication SQL, idempotent replay, rollback to 18 visible builds and re-publication all pass on that copy. Actual migrated database rows match the reviewed index, including generation assignments and the E default. The bundle verifies all 480 immutable file hashes and 38 exact input/script/MPD sources; all fresh E inputs match across models.
- The full-collection preview confirms 18 fresh E defaults, six results per model, all nine cohorts and 80 history entries, plus all three default-collection image angles. It passes all six supported sizes with no horizontal overflow and 44 px selectors. The first visual check found a 112.2 px closed phone filter area; moving the featured label onto the count line reduces it to 88.8 px at all four narrow widths. One confirmation pass covers desktop/mobile and expanded controls. Live publication follows successful main validation.
- The UI detector reports only pre-existing advisory CSS findings. The new filter and generation labels use existing design tokens; prompts, the generation harness and feedback protocol are unchanged.

## Fresh E/F independent generation — 10 October 2026

- All 24 fresh runs verify accepted source/input hashes, separate sessions and empty working directories, zero supplied sources/images and zero native tool events. All E inputs match byte for byte across Sol/Astra/Opus for each subject. Codex session records verify requested models/high effort and absence of repository AGENTS instructions; Claude initialization verifies model, working directory and empty tools/MCP/skills, with high effort recorded by invocation/results.
- All 24 accept in one attempt with zero final compiler errors and no baseplate parts. Compiler checks repair some colour/overlap errors; warnings remain. Sources are retained unchanged, and 96 final views use matching Standard look/resolution/camera presets. [Provenance and metrics](samples/lego-style-study/fresh-e/README.md) distinguish this experiment from historical source revisions.
- The viewer displays 24 distinct models in 30 comparison cells. All four views load at 360 × 600, 411 × 685, 390 × 844, 1080 × 1800, 686 × 411 and 1440 × 1000 without horizontal overflow. Exported E three-model and Sol E/F comparison sheets cover all six subjects. The application runtime, generation harness and default prompts are unchanged; repository formatting and diff whitespace checks pass.

## Browser CI timing races — 10 October 2026

- PR #13's failed shards timed out waiting for the train's transient look-hint geometry at 800 × 360 and for the expired fallback checksum to resume. Both original cases pass in isolation (two tests, one worker, 1.2 minutes), confirming timing-sensitive failures.
- The revised train checks explicitly advance only the six-second hint callbacks, retain real rendering/input clocks, capture simultaneous running-train/hint geometry and verify the hint disappears after expiry. The storage check waits for its deliberately blocked checksum before expiring coordination; the saved baseline and newer in-memory revision assertions remain intact.
- All four revised checks pass with two workers (2.6 minutes): train layout at 360 × 600, 600 × 360 and 800 × 360, plus expired fallback coordination. Production build, type-check, repository formatting and diff whitespace checks pass.
- [PR #13 validation](https://github.com/jzyrobert/brick-editor/actions/runs/38069119723) passed every job before merge. Main commit `ed5eda6` then passed [all validation and automatic deployment jobs](https://github.com/jzyrobert/brick-editor/actions/runs/38069999576) without a failed-job rerun.

## Default E adoption — 10 October 2026

- Default one-shot input is byte-identical to the frozen E system/reply combination. The default JSON and JavaScript examples match and compile with no warnings; legacy defaults are preserved explicitly. Generation still receives only text search results, part counts and errors.
- The study harness accepts the Claude runner and rejects image feedback there. Six Opus 5.5 high runs accept in one attempt with no compiler errors/baseplates and four final views; parts are 871/1,028/2,190/1,108/5,434/3,347. The 42-run provenance manifest verifies matching E inputs, original source hashes, zero images and disabled agent tools. The 48-build viewer loads three angles at all six supported phone/desktop sizes without overflow.
- Production build and type-check pass after rebasing on current main. All 72 focused generation, workspace, gallery and publication guard tests pass. The reviewed publication bundle has 18 replacements and 108 checksum-verified assets, with three high-effort models per prompt. Publication requires exact live-roster agreement and successful main CI; it uploads immutable files before hiding the exact 12 older entries and rebuilding the index. Main CI passed all checks and deployed after one isolated/retried frame-polling failure, with no code or budget changes. The gallery workflow failed at its first D1 read before changing anything; owner-authenticated publication succeeded. Public verification checks all 108 file checksums/cache headers, six prompts × three models, 12 hidden prior entries, and model filters at all six supported sizes. [The receipt](reports/e-gallery-publication.json) records the exact runs and cache policy.

## Astra E spatial reasoning comparison — 10 October 2026

- Six source-only E revisions use `gpt-6-astra` and `high`. Filled prompts, generic requests and original-source provenance match the six Sol E controls byte for byte. Session records verify model/effort, zero input images, no repository instructions and no agent tools. Search/check/repair limits and final cameras are unchanged.
- All six accept in one attempt, with zero compiler errors, zero baseplate parts and four views. Pelican/Piplup/temple/dragon/destroyer/Ewok counts are 884/1,037/2,297/1,072/5,272/3,181; generation/check times are 340/518/547/694/327/556 seconds. Warning records, exact sources, prompts and measurements are retained. These are individual output comparisons; no physical buildability or general model ranking is established.
- Type-check and all 52 relevant generation/build-script unit tests pass. Repository formatting and diff whitespace checks pass. The final viewer loads all forty-two builds in three angles at six phone/desktop sizes without horizontal overflow. Provenance verifies all thirty-six completed new runs, including the six Astra runs; hashes verify all accepted sources and identical E inputs. No application runtime, gallery defaults, publishing or automation capability changes.

## Text-only E/F spatial reasoning comparison — 10 October 2026

- Twelve paired GPT-6.1-Sol high revisions use identical original sources and byte-identical generic requests for each of the six gallery briefs. Frozen filled inputs match the prompt files; session provenance confirms no input images, repository AGENTS instructions or agent tools. Search/check/repair limits and text compiler feedback remain unchanged. The harness defaults revision feedback to text and rejects images for F.
- E/F parts: pelican 918/867, Piplup 1,007/949, temple 2,200/2,049, dragon 1,146/1,144, destroyer 5,334/4,287, Ewok 3,517/3,337. All twelve have zero compiler errors, no baseplate parts and four final views. F dragon uses two repair attempts; all others accept in one. Counts/timing/warnings and all final sources are retained; physical buildability is not certified.
- The long batch ended with exit 143 during an incomplete F Ewok run. Partial logs are preserved outside evaluated runs, with exclusion recorded in [interruptions.json](samples/lego-style-study/interruptions.json). Only that case was rerun, from byte-identical inputs; eleven completed results were skipped and retained. Completed timing excludes interrupted work.
- All 52 relevant Vitest tests across the four generation/build-script specs pass. Type-check and repository formatting pass; the earlier full application build remains valid because no runtime application code changed. Final provenance verifies thirty completed new runs, including twelve with zero image inputs. The local viewer loads all thirty-six previews in three angles with no horizontal overflow at 360 × 600, 411 × 685, 390 × 844, 1080 × 1800, 686 × 411 and 1440 × 1000. All accepted source hashes, paired input hashes and four captured views per new run are verified.

## Freestanding LEGO generation study — 10 October 2026

- Isolated worktree `codex/lego-generation-study`, based on `origin/main` at `579d0f7`; no gallery publishing, deployment or automation API change.
- Twelve new runs use `gpt-6.1-sol` and `high`; session metadata and runner events confirm no repository AGENTS instructions or agent tools. Discarded context-contaminated trials are excluded. Two revisions receive four views each; two fresh reference runs receive two official bird images each. See [provenance](samples/lego-style-study/provenance.json).
- All twelve accepted with zero compiler errors and were rendered in four views through the app's private headless renderer. All omit baseplate parts. Historical baselines retain their original previews and were recompiled for inventory/warning comparisons. Counts, time, warning records and source hashes are in [metrics](samples/lego-style-study/metrics.json). Acceptance does not certify attachment/stability; the report retains substantial clash, off-grid and connectivity warnings.
- Relevant Vitest: 50 tests pass across `one-shot-build`, `brick-build`, `build-script` and `build-script-look`, including selected-example/workflow coherence. `npm run build`, `npx tsc -b` and repository formatting pass. No application UI changed; the generation/rendering evidence is the scoped browser exercise. The local comparison viewer loads all eighteen previews in three angles and has no horizontal overflow at 360 × 600, 411 × 685, 390 × 844, 1080 × 1800, 686 × 411 and 1440 × 1000.
- Five public OMR sources studied, four rendered with strict readiness. Tranquil Garden failed unresolved-colour readiness and is source-only. Authors and CC BY 2.0 sources are attributed in [the report](samples/lego-style-study/README.md).

## Preserve preferred gallery concepts — 10 October 2026

- Two additional GPT-6.1-Sol high revisions use the original temple/Ewok source and three original gallery images each. Both share the same preservation instructions and contextual prompt; the guidance contains no per-build coordinates/palettes or named-set recipes. Session provenance confirms the model/effort, three images per run, no repository instructions and no tool events.
- Temple 2,220 parts (+11.0% against target), Ewok 3,367 (+12.2%); each accepted after two draft checks in one attempt and rendered in four views. Both retain meaningful original assemblies and omit baseplate parts. Net changes from originals are +25/+73 parts; model/check generation adds 585/630 seconds. Visual inspection covers front/back/three-quarter; compiler warning regressions remain explicit in [E results](samples/lego-style-study/README.md#e-results).
- All 51 relevant tests in the same four unit specs pass, including a general-setting/preserved-concept prompt case. Type-check, repository formatting and diff whitespace checks pass. The comparison viewer is rechecked with twenty samples in three angles at the six supported phone/desktop sizes. No application UI, default prompt, gallery content or API capability changed.

## E on the remaining gallery briefs — 10 October 2026

- Four more original-source revisions use the unchanged E prompt and preservation instructions, `gpt-6.1-sol` at `high`, three original input views and the original 800/1,000/1,000/5,000 targets. Session metadata confirms the settings, no AGENTS instructions and no agent tools; the [provenance manifest](samples/lego-style-study/provenance.json) now covers eighteen completed runs, six of them E.
- Accepted counts: pelican 882 (+10.3%), Piplup 1,228 (+22.8%), dragon 1,144 (+14.4%), Star Destroyer 5,287 (+5.7%). Each accepts in one attempt with zero errors and four final views, with two/three/three/two draft checks. Generation/check work takes 476/556/1,255/594 seconds, excluding final renders. All omit baseplate parts; substantial warning records remain. [Remaining E comparisons](samples/lego-style-study/README.md#remaining-gallery-builds-with-e) retain the costs and visual tradeoffs.
- Packaged original/E sheets, all-variant sheets, individual four-view WebPs, accepted sources/MPDs, exact prompts, input provenance and compiler reports. The viewer asserts twenty-four models and loads all three comparable angles at six supported phone/desktop sizes with no horizontal overflow. Documentation formatting and diff whitespace checks pass. Only artifacts and documentation changed in this continuation; prior 51 unit tests/type/build checks remain applicable. No defaults, application API or gallery publishing changed.

## Five Realistic critic and photo-audit rounds — 9–10 October 2026

Baseline `75ff771` and five candidates use one unchanged public gallery MPD:
936-part Piplup `256416f99469`, SHA-256
`256416f99469c6161aca23f05821f256ee72125e4b48d308ba034ea3f4a1a024`.
Independent critic and audit agents reviewed previous/current images in every
round; the audit compared photographed physical LEGO builds, not promotional
CGI. Source links, complete reviews, scores and measurements are preserved in
[the report](reports/realistic-five-rounds.json).

| Round | Trial                                       | Selection                                                                              |
| ----- | ------------------------------------------- | -------------------------------------------------------------------------------------- |
| 1     | Key share 0.8 → 0.65; panel energy held     | Both reject: no convincing reflection gain                                             |
| 2     | Desktop AO radius 14 → 8, denoiser 6 → 3    | Both reject: more conspicuous patterned ground shadow                                  |
| 3     | Phone shadow-catcher opacity 0.3 → 0.2      | Retain: audit accepts modest grounding gain; critic finds no demonstrated realism gain |
| 4     | ABS roughness 0.28 → 0.22                   | Both reject: tighter highlights without better reflection shapes                       |
| 5     | Existing fill azimuth 15° towards the front | Both reject: no convincing ABS gain                                                    |

Final selection is round 3; other experiments are restored. Auditor totals
before → final are desktop 23 → 23/50 and mobile 20 → 21/50; critic overall
scores remain desktop 5.5/10 and mobile 5/10. These are independent subjective
rubrics, not calibrated measurements or a percentage of realism. The retained
change reduces phone shadow density; it does not create physical softness,
refraction, moulded bevels, seams or stud lettering.

Images are actual live canvas screenshots with DOM visibility hidden while
layout remains intact. Both resource profiles use a 960 × 700 viewport,
960 × 622 canvas, DPR 1, balanced quality, Blank backdrop/grid off and matched
fit/zoom views. These are profile comparisons, not simulated physical phone
GPUs. Direct mobile API captures are not tone-mapped and were excluded from
visual judgement. Tight matched close-ups supplement full/detail views in
the final two rounds.

An unchanged-desktop discrepancy was traced to three.js GTAOPass creating its
denoiser texture from random Simplex noise. Later review captures fix randomness
in the private harness only. All three desktop full/detail/material plates
from frozen baseline and round 3 then match byte-for-byte. Production randomness
is unchanged; early desktop pixel attribution retains this limitation.

Twelve native-pointer orbit samples per profile/candidate on Chromium
153.0.8010.12 with SwiftShader: every packet preserves 110 desktop / 107 mobile
calls and 304,197 / 304,194 triangles, zero orbit shadow redraws, no page errors
and no reduced-quality fallback. All Standard captures share the same SHA-256.
Baseline → retained round 3 CPU medians: desktop 4.05 → 5.05ms, mobile
3.95 → 3.50ms; synchronous GPU-drain medians: 752.90 → 741.10ms and
570.15 → 561.90ms. Shared-machine timing variation supports neither speed-up
nor a causal regression; unchanged counts do not prove exact zero GPU cost.
Real-phone colour and performance acceptance remain open.

Final production build (schema generation, TypeScript and Vite) passes, as do
all 24 focused look/Photo/Play unit checks and four relevant browser cases
(3.1 minutes on the private production config). Browser coverage includes
cached Play shadows, Standard soft outlines/restoration, shared studio lighting,
and look switching/persistence/capture restoration with a small path-traced
capture. Repository formatting and diff whitespace checks pass. No review
photos, gallery MPDs or private capture assets are added to the product.
All six final seeded desktop/mobile full/detail/material plates match retained
round 3 byte-for-byte. A 390 × 844 workshop phone preview was also captured.

## Realistic studio refinement — 9 October 2026

Compared the baseline at `579d0f7` with the refined studio/ABS parameters using
the finish fixture (111 parts), House with garden (281 parts) and Off-road jeep.
Each collection used balanced quality, default Realistic controls, DPR 1,
desktop 960 × 700 or phone 390 × 844, and ten native-pointer orbit frames per
scene. A 640 × 480 capture warmed the look before measuring. Desktop draws into
960 × 622 and phone into 390 × 776. Captures include both resource profiles and
the full workshop viewport. No page errors appeared.

All six pairs have identical per-frame draw-call and triangle sequences.
Desktop draws are 34 (finishes), 69 (house), 51 (jeep); phone draws are 26–28,
66, 48 respectively. Camera movement reuses the shadow map in every trial
(zero shadow redraws). The renderer keeps the same shaders, five studio panels,
512 × 256 cached environment and shadow-map sizes; mobile Realistic still needs
no off-screen targets. The key's integrated irradiance stays about 3.10 and its
directional intensity about 2.48, with exposure unchanged.

CPU submission medians before → after: desktop 2.05 → 2.15ms, 6.05 → 3.15ms,
3.15 → 2.15ms; phone 1.55 → 1.40ms, 3.90 → 3.15ms, 1.80 → 1.80ms. Synchronous
one-pixel readback medians are recorded separately in
[the report](reports/realistic-studio-refinement.json). These sequential trials
run on a shared ARM64 VM with SwiftShader, so changing contention explains much
of the timing variation. This is evidence of unchanged rendering work, not a
hardware FPS result or a claimed speed-up. Colour/highlight and performance
acceptance on a physical phone remain open.

Validation: production build and final type check pass; all 24 look/Photo/Play
look unit checks and four relevant browser cases pass. The browser cases cover
cached shadows in Play, Standard soft outlines and restoration, shared
Realistic/Photo lighting, and look switching/persistence/capture restoration
(including a small path-traced capture). Repository formatting and diff
whitespace checks pass. The inline Impeccable finish review returned `ship` for
this parameter-only refinement; DESIGN.md and its sidecar are preserved.

## Compact phone gallery filters — 9 October 2026

The user's follow-up requested less phone space spent on filters. Phones now
keep search and a named Filters button in one row; prompt, model, effort,
sorting and viewing angles unfold together. Folded active choices retain a
short summary and a clear action. The redundant phone subtitle/search label
is hidden while the input retains its accessible name.

The default closed filter section measures 88.44px. On the real published
collection at 390 × 844, the first stage begins at 366.5px instead of about
532px (165px earlier); its full image and Explore action fit in the first
screen. At 360 × 600 its full stage also fits. Captures cover the six supported
sizes, folded active choices and expanded filters. The desktop/tablet
composition remains intact.

All 8 gallery browser cases pass on the private production config. The new
phone case asserts a default filter height below 90px, 44px targets, a first
stage before 400px, unfolding/reopening and folded reset/summary behavior.
Build/type checks, repository formatting and diff whitespace checks pass.
The inline Impeccable fallback review returned `ship` for this refinement;
no extra polishing round was needed. Documentation preserves DESIGN.md and
its sidecar and records the composition in the gallery surface brief. These
are Chromium viewport checks, not physical-phone acceptance.

## Gallery collection browsing — 9 October 2026

- Upstream was fetched and the change built in a fresh worktree from
  `origin/main` at `ae0bfb1`, on `codex/gallery-model-prompt-browse`.
- Unit: all 14 checks in `gallery-view.test.ts`, `gallery-index.test.ts` and
  `gallery-publish.test.ts` pass. New cases cover combined search/model/prompt/
  effort filtering, full-brief and accent-insensitive search, empty results,
  sorting by matching timestamps and source-array preservation.
- Browser: all 7 cases in `gallery.spec.ts` and `gallery-browse.spec.ts` pass
  against the production build, one worker, private port 4394. They cover
  combined filters and removal of a folded effort filter, reset, keyboard
  selection, detail/scroll restoration, retained filters and angle after Play,
  native import, live preview/data saver, tools, edited-copy protection and
  damaged/offline sources. The larger synthetic index has 15 prompts and 17
  builds, including three responses to one prompt, and verifies pagination,
  alphabetical sorting and vertical phone browsing.
- Layout: checks pass at 1440 × 1000, 1080 × 1800, 360 × 600, 411 × 685,
  390 × 844 and 686 × 411. They assert no gallery horizontal overflow,
  in-bounds navigation/filters and 44px select/angle controls. Screenshots of
  the existing six-prompt collection use a local mirror of its published
  renders; no browser test requests the real bucket. Captures also cover a
  filtered desktop result and expanded phone filters.
- Build, `npx tsc -b`, repository formatting and `git diff --check` pass.
  The first capture found a breakpoint block removed during CSS cleanup;
  the final batch restores it, fits entire renders and compacts the controls.
  The Impeccable detector ran once: the new select type size was brought back
  to the existing body token; its remaining advisories concern incumbent
  incidental values. The inline fallback finish review scored all four listed
  fixes resolved (`ship` at that scope), since no subagent tool is available.
- The approved cream palette/type/radius system and sidecar are retained.
  Gallery composition is documented in its surface brief and [Gallery](GALLERY.md).
  No physical-phone performance or touch-device acceptance is claimed.

## Gallery prompt tabs after Play — 7 October 2026

- Bug: after Explore (Play) and back to Gallery, a prompt tab stepped browser history back to the model, so it opened Play. Choosing a prompt now closes a detail page only when one is open, and closing with none open does nothing.
- `tests/browser/gallery.spec.ts` "changing the prompt after a trip into Play stays in Gallery" passes with the fix and fails without it (rebuilt both ways); Back from Gallery still returns to the model. All 5 gallery specs, `npx tsc -b` and the format check pass.

## Gallery: six prompts, two models — 7 October 2026

- Runs: twenty one-shot runs (Opus 5.5 high through Claude Code, GPT-6.1-Sol high through Codex), all accepted with no errors; the table is in [the prompt comparison](samples/creative-prompt-comparison/README.md).
- Publishing: a dry run (`gallery:publish` without `--remote`) applied `0002_prompt_names.sql` to a local D1 and wrote `name` into `index.json`; then six `--remote` publishes added the twelve creative builds and twelve `--hide` calls hid the earlier builds. The live `index.json` lists 6 prompts with their names, 2 agents and 12 builds.
- Unit: `tests/unit/gallery-view.test.ts` (pairs, notes, names, repeat takes), `gallery-index.test.ts` (prompt names through rows and the decoder), `gallery-publish.test.ts` (prompt in the effort folder; `--prompt-name` inserts and updates). `npm test`, `npx tsc -b` and `npm run format:check` pass.
- Browser: `tests/browser/gallery.spec.ts`, 4 of 4 on a private config, including the new pair test (names on tabs, the note, the pair side by side or stacked, angle tabs at least 44 px and no horizontal scroll at 360 × 600, 411 × 685, 390 × 844, 1080 × 1800, 686 × 411 and 1440 × 1000).
- Screenshots of the real index (bucket files proxied into a local preview) at 1440 × 1000, 1080 × 1800, 390 × 844, 360 × 600 and 686 × 411: no horizontal scroll; on phones the note sits above full-width angle tabs. Not checked on a physical phone.

## Player size in Play — 5 October 2026

`tests/unit/play-player-scale.test.ts` (13 checks) covers the scaling maths
(every length, speed and the explorer's gravity scale linearly; eye/height,
jump-apex/height, jump time and stride rhythm are unchanged), validation, the
scaled near plane, the suggestion heuristic, and real `PlaySession` runs: at ¼×,
1× and 4× the eye sits at 86 × scale, one second of walking covers 145 × scale
LDU and a jump peaks at 0.45–0.6 of the figure's height; a ¼× explorer walks
through a 40 LDU slot a minifigure cannot enter; a 3× explorer steps over a
48 LDU wall that stops a minifigure; growing to 2× under a 150 LDU ceiling is
refused with nothing changed while shrinking works; the third-person arm grows
4× with a 4× explorer; train cabs report a plain Minifigure-only reason.

`tests/browser/play-player-scale.spec.ts` (production bundle): a micro-scale
LDraw test town (two-brick arch, two-brick wall, four-brick houses) — Tiny walks
through the arch, Minifigure is stopped at it, 3× steps over the wall and
Minifigure does not; the settings mark Tiny **Suggested**, every size button is
at least 44 px, **Use Tiny** enters Play at ¼×, the pause sheet changes size
live to Giant, and the dock keeps "Giant size" at 1440 × 1000 and 390 × 844; a
Giant takes the roadster's controls from 300 LDU (a minifigure is offered
nothing there), drives it with the throttle pad and steps out. Screens were
checked at 1080 × 1800, 390 × 844, 360 × 600, 686 × 411 and 1440 × 1000 (dock,
Size tab, pause sheet and third-person HUD). Tick costs for walking the Market
town and Cathedral at ¼×–8× are in [PLAY-PHYSICS](PLAY-PHYSICS.md#player-size).
`tsc -b`, `format:check` and the play, settings, menus, zoom, orbit, world,
keys, acceptance and HUD specs were run; timeouts seen while the full Vitest
suite ran alongside passed when rerun alone.

## Air circuits in ordinary Play — 5 October 2026

Six focused engine checks (`tests/unit/play-pneumatic-air-pump.test.ts`) pass
in about 12 s on the shared VM: the sample derives one circuit (four groups, three
tubes, six ports, reviewed 1,533- and 2,263-triangle surfaces); in a real
`PlaySession` a closed valve lets the hand fill the supply tube and stall,
**Push out** moves the rod over 80% of its stroke within 1,500 ticks with its
rendered leaves following, **Hold** keeps it within 5% and **Pull in** returns it
below 10%; a static obstacle stops it at 23% with full pressure reported; a
removed tube, a 2947 cylinder, a missing pump or pump rod and a rod outside its
guide are each refused with their reason; the committed sample matches its
generator. Three presentation checks cover the plain-word readings.

In the production bundle, `tests/browser/play-air-pump.spec.ts` passes on
desktop and 390 × 844 phone emulation (Controls **Pump** and **Push out** push
the Dynamic crate over 20 LDU and extend the rod past 60% in 1,800 ticks;
**Pull in** returns it below 15%; closing lets go of the pump; LDraw export is
unchanged) and **Static build** keeps the circuit still. The menus, motion
sample, Large motor, mechanism controls, offline and physics specs also pass (26
tests). Controls were checked at 1080 × 1800, 390 × 844, 360 × 600, 686 × 411
and 1440 × 1000 with every sheet button at least 44 px. A private run measured
1.2–2.1 ms per tick (snapshots included) and about 1 s for entry in SwiftShader
Chromium; no phone-hardware measurement was made. The full Vitest suite (275
files, 1,856 tests), `tsc -b`, `format:check` and `library:validate` pass.

## Technic worktree checkpoints — 5 October 2026

The active, unpublished systems branch verifies motor status without continuous
shaft-angle counters and third-person vehicle possession. Seven focused engine
files pass 30 tests, including an actual source Roadster driven through the old
explorer position in native physics, shared capture visibility, current-location
exit and retained possession when no safe supported exit exists. The complete
snapshot validator accepts the new vehicle-reference state. Source project data
stays unchanged.

Twelve production browser cases pass for nearby interaction, physical seats and
independent twin motors on desktop and phone. The thirteenth case used the old
UI action to enter a physical seat; it now calls the explicit seat API, and its
blocked-exit/reverse recovery passes alone in 37.0 seconds. The production build
passes (Vite 57.40 seconds). A fresh private production check passes six
desktop/phone viewports (1440 × 1000, 1080 × 1800, 360 × 600, 411 × 685,
390 × 844 and 686 × 411) in 2.0 minutes, with usable motor/exit touch targets,
hidden walking sticks during remote motor control, third-person driving and
safe exit. Full CI and publication remain pending.

The native angular kernel now runs the existing admitted spur rows without
changing source or collision admission. Twenty-two integrated spur/rack checks
and the separate rounded-source axis case pass. Fresh UI confirmation passes
all six sizes in 3.7 minutes after keeping motor tabs/status outside scrolling
details, removing their duplicate reading, correcting driving help and hiding
unavailable recovery. A fresh independent Impeccable reviewer returns SHIP at
this motor/vehicle-control scope, and the surface documenter records the result.
Eight additional production interaction/twin-motor cases pass in 3.0 minutes,
including Dynamic on both desktop and phone and the driving pause menu.

Six source-content tests retain exact fallback leaves/caps and world frames,
reject ambiguous or displaced cap ancestry and conflicting metadata, and keep
independent placements separate. A private audit reads both unmodified complete
OMR models without unresolved content: five paths in 42042 and 29 paths/eight
springs in 42043. This verifies source organization, not mechanical attachment,
pneumatic forces, track motion or full-model native admission.

The branch is rebased on main `4282b58`, retaining its split throttle/steering pads
and current Play loading/menu designs. The production build passes (Vite 1m 26s).
Fresh private production evidence passes all six desktop/phone sizes in 7.3
minutes, including both 44px driving pads within the viewport, Get out clear of
each pad, hidden driving/walking controls during motor control and successful
current-location release. Those captures supersede the earlier driving screenshots
with a single joystick. The fresh independent reviewer returns SHIP at this UI scope; the surface
brief records the updated pads, evidence and review limits. Four production
interaction cases pass in 2.7 minutes and four twin-motor cases in 1.4 minutes,
including two-finger driving and independent Dynamic/Kinematic motor controls.

The separate pneumatic native kernel passes seven checks in 1.21 seconds:
balanced cylinder reaction without direct pose/velocity setters, supply/exhaust
reversal, neutral gas conservation under native backdrive, compression-powered
pump/refill, independent valves, external native blocker stall/removal, released
body refusal and atomic overpressure refusal. Isothermal instantaneous-line flow
and force caps are declared simulation assumptions, not measured LEGO properties.
Source-bound cylinder/pump geometry and actual hose admission remain open.

Explicit engineering worm transmission data now survives native save/restore
and shares the existing bounded coupled-coordinate and angular-kernel paths.
Six new tests and forty related spur/rack/source-admission cases pass in 9.04
seconds. Signed orthogonal native dispatch is compared against independently
calculated inertia/impulses; source stays unchanged. Actual retained-winch
contact packets and ordinary session integration remain separately required.

The actual source pneumatic routing layer passes four focused cases. Together
with the native circuit and source-content regressions,17 cases pass in5.12s.
The28 full authored hoses bind56 separate ports and47 passive connections;
the16-node pump supply reaches only the four valve supply ports, and each pair
of work routes reaches exactly one cylinder's opposing chambers. The tests
preserve source/export and refuse altered dependencies, project shadows, stale
or unseated placements, ambiguous duplicate fittings and incomplete ends. The
manifest reproduces offline with `scripts/build-pneumatic-sources.ts --check`.
The [routing review](reviews/AROCS-PNEUMATIC-ROUTING.md) declares the narrow
flexible-end seal/frame assumptions. Guided components, native circuit wiring,
controls and complete Arocs admission remain open.

The bounded semantic hardware index and source-content/pneumatic routing
regressions pass13 cases in1.83s. All25 port-bearing embedded/official parents,
28 hoses and56 cap components retain every source leaf of the routing excerpt
exactly once. A private audit of unmodified complete models accounts for every
leaf (5540:446;42042:13,550;42043:30,042), with no missing or unresolved
ownership. Measured index times, including import, are0.113s,0.419s and0.577s
respectively on this VM. Source/export remains unchanged; ordinary hierarchy
supplies no part or weld claim, and incomplete or forged leaf views are refused.
This verifies source ancestry and bounded organization, not native admission,
component collision or complete mechanical functionality.

## Physical admission CI follow-up — 4 October 2026

Initial main run [37213302926](https://github.com/jzyrobert/brick-editor/actions/runs/37213302926)
failed and did not publish: 1,552 of 1,556 unit/integration tests passed; build,
formatting, Photo and performance jobs passed. Its failures exposed connected
compound gravity admission, omitted source-seated gear hubs and ordinary Play
tests still assuming fictional motors/joints. Those fixtures are now replaced
with actual source hardware or explicitly checked for static, lossless refusal.

Focused follow-up acceptance:

- **29 checks in four source/contact specs** pass in 125.80 s. The original
  oblique/opposite-axis full-rotation, free-carrier momentum and 3,657/3,917
  rack hull assertions remain unchanged. New witnesses distinguish seated hub
  mouths from teeth, unseated hubs and foreign members. Actual motor rotation
  and closed socket back checks remain intact.
- **13 physical-admission checks** pass, including connected compound gravity,
  disconnected-weld and fake-vehicle refusal. The integrated unit rerun passes
  25 checks; its oblique case timed out under concurrent VM load and passes
  alone in 25.03 s with the unchanged 30 s test limit.
- Five focused playground structural/native checks pass in 28.07 s. Its
  production browser push case passes in 1.1 min: exactly six default Dynamic
  rigs, over 20 LDU of push, actual lowest source-point support within 3 LDU,
  at most 0.5 LDU penetration, settled velocities and exact source/inventory.
- Both actual two-part rack production browser cases pass in 53.3 s, covering
  manual travel to −60 and reversal to zero, rendered movement, displaced posed
  export and exact native contents, LDraw and inventory in both physics modes.
- Five retained production browser checks pass: actual door-over-tile clearance,
  desktop/360 px vehicle stop/reverse/capture, Jeep driving and explicit
  windmill/lighthouse missing-motor refusal with exact source preservation.
  The last two refusal rechecks pass in 1.4 min.
- The real mounted-motor CLI integration passes, including output ratio and
  unchanged source. Dynamic settling retains its 1°/2° per second limits;
  intermediate native movement is tested before completion.

Integrated follow-up [37215733610](https://github.com/jzyrobert/brick-editor/actions/runs/37215733610)
passes all **1,558 unit/CLI tests**, formatting, library validation, build, both
Photo shards, performance and seven of eight main browser shards. The remaining
failure was a desktop sample test advancing deterministic ticks before the
slider's queued animation frame submitted its target. It now waits for the
public joint-target snapshot, preserving the same movement assertions; both
desktop and phone rack cases pass in 48.8 s. No runtime or budget change was
needed. Full CI remains the publication gate; the prior deployed version remains
live until the complete follow-up run succeeds.

Final runtime follow-up [37216378449](https://github.com/jzyrobert/brick-editor/actions/runs/37216378449)
passes all unit/CLI and library checks, Photo, performance and seven main browser
shards. The remaining landscape train failure exposed a real delayed-hint
overlap: the six-second sample hint gives way to “Drag to look” in the same band
as the running train chip. Short-screen CSS now places the look hint below the
chip; the measured 30 px overlap becomes a 6 px gap. A browser-frame regression
captures the visible hint and train together before either can fade. Timers,
44 px controls and open-drawer hint hiding are unchanged.

All eight production viewport checks pass: the persistent 360 × 600,
600 × 360 and 800 × 360 cases in 4.6 min; private 411 × 685, 390 × 844 and
686 × 411 checks; and 1440 × 1000 / 1080 × 1800 reruns in 3.2 min. The first two
large-view capture attempts missed the short-lived hint; the passing reruns arm
capture before Play starts. The corrected production build passes in 43.81 s.
The complete publication gate remains required for this CSS follow-up.

## Physical-source Play correction — 4 October 2026

Ordinary Play now admits controls only for reviewed actual connections. Motors
require a source-bound, stud-mounted 58120 case and an engaged keyed shaft.
Bearing allowances apply to actual contact pairs, preserving foreign parts in
the same frame. Source-backed four-wheel cars retain the requested unpowered
exception. Unsupported synthetic grippers/linkages/force links remain native
engineering data; their low-level runtime tests still run, while ordinary Play
refuses to invent their physical connections.

The visible samples are now the 15-part mounted **Motor & gears** and the
manually operated two-part **Rack guide**. Crank & slider and Grab & lift are
removed from normal selection. The earlier four-sample and abstract mechanism
browser results below are historical and do not establish physical connections.

Local acceptance before publication:

- **39 focused unit checks / five files** pass in 26.65 s, covering physical
  admission, motor mounting/socket binding, source contact policy, canonical
  solids and real wheelbase detection. Separate source witnesses include full
  360° kinematic/native motor rotation, the measured Rapier entrance-seam false
  contact, and crossed/foreign/closed-back rejection.
- **19 source-door checks** pass for real seated doors, narrowly reviewed classic
  shutters, incorrect axial/radial seating, copied filenames, nearby bricks and
  ambiguous holders. A separate 12-check authored-admission run accepts a real
  door and refuses a nearby-brick hinge. The strict official-study and unchanged
  desktop/phone Door room browser checks pass **three cases** with exact source
  and inventory retention.
- Five House/Café desktop/phone rapid-slider and thin-wall checks pass; animated
  targets and one latest input per animation frame preserve existing collision
  caps. Seven sample chooser/desktop/phone/fresh offline checks pass.
- Four actual imported car/jeep/fleet driving checks, ten actual seat/world/HUD
  checks and 21 unsupported-rig admission/lossless-export checks pass.
- Real motor proposal review, linked controls and cold offline motor/rack
  restore pass in the production browser. Proposal controls are checked across
  all six required desktop/phone viewports, including 44 px targets and whole
  mechanism framing. Cold restore covers both Kinematic and Dynamic modes.
  The final desktop/360 px proposal confirmation passes two cases in 42.4 s;
  their setup and live-control screenshots were inspected, alongside sample
  controls. Extra settings remain folded and active mechanisms stay visible.
- The broad pre-integration unit run passed 1,506 tests and found seven isolated
  coordinator tests using synthetic source fixtures. Their focused nine-test
  rerun passes with the admission boundary mocked only in those coordinator
  tests; production BrowserPlay has no bypass. Full CI remains the publication
  gate.
- **31 retained functional browser cases** pass across scoped dependency
  checkpoints, covering all seven control viewports, two independent mounted
  motors, source-backed door/car interaction, pause/capture/import lifecycles,
  loose-body physics and both 8:24 transmission modes. The final three door
  rechecks use the strict source-seating build. The real frame sill retains its
  teleport refusal; the actor walks through the actual opening for the close
  obstruction/retry witness. No product entry bypass or contact budget change
  is introduced ([fixture review](reviews/PHYSICAL-PLAY-BROWSER-FIXTURES.md)).
- Final production build passes (Vite 1m 20s under shared load). **13 final
  browser cases pass in 6.5 minutes**, covering samples, six-size chooser, cold
  offline motor/rack in both modes and all five responsive-slider witnesses.
- Library validation and full formatting pass. Pinned geometry packs are
  unchanged; schemas, validators, template MPDs and previews use their generators.

The retained real door/car cost witness passes both unchanged Dynamic tick
budgets: 2.001 ms on desktop (<4 ms) and 5.699 ms in the phone profile with 4×
CPU throttling (<10 ms). The 300-tick measurement uses the actual source car
and seated door, replacing the older synthetic fixture. Measured mean tick
costs are:

| Mode           | Desktop (ms) | Phone profile, 4× CPU throttle (ms) |
| -------------- | -----------: | ----------------------------------: |
| Static         |        0.192 |                               0.818 |
| Kinematic car  |        7.009 |                              30.091 |
| Dynamic car    |        2.001 |                               5.699 |
| Automatic door |        3.694 |                              12.927 |

Kinematic source sweep costs remain follow-up work; these are shared-VM
software measurements, not physical-phone frame-rate claims.

Private production previews use isolated ports and are stopped after tests.
Browser evidence uses Chromium/SwiftShader and does not measure phone GPU rates.

## Play showcases and publication checks — 4 October 2026

The first main run at `8da12e9` passed build, formatting, library validation,
**211 files / 1,501 tests** (444.28 s) and nine of eleven browser shards.
[That run](https://github.com/jzyrobert/brick-editor/actions/runs/37201578764)
identified two reproducible failures: the official-study shutter offered a
blocked direction, and the playground browser asserted a tilting crate's frame
height instead of source floor support. Their focused repairs preserve source,
inventory, real responding obstacles and the existing contact/resource caps.

- Playground correction: actual pinned source bottom and plaza footprint are
  checked throughout all 40 push ticks, preserving the original >20 LDU push and
  3 LDU support allowance. The original 16.157 LDU origin rise accompanies valid
  source clearance; settling, near-zero velocities and exact source/inventory
  pass. Private production browser passes in 33.6 s.
- Shutter correction: all actual source vertices/face centroids and native end
  rays retain the source relief. Both original nested shutters choose the free
  negative side and reach −60°; a reversed installation opens positively. Real
  holder obstruction and a foreign 0.1 LDU wall block; removal permits retry.
  Exact-rest closing near tangent contact can exhaust refinement and remains
  limited, as [documented](reviews/SHUTTER-SOURCE-CONTACTS.md).
- Four new sample generators retain their native rigs, inventory and exact
  generated MPDs. Their actual rendered 320×240 WebP previews are committed.
  Ten production browser cases pass in 2.3 min: selectable cards, held controls
  and linked movement on desktop/360×600 phone, six-size chooser layout, and
  first-ever selection/movement of all four after a fresh offline install.
- The samples' isolated motion/backdrop checks and unchanged architectural
  suite pass **24 tests**. The combined release's source-shutter, smooth-door,
  official-study, motion-sample and backdrop checks pass **27 tests / five
  files** in 15.98 s.
- Combined schemas/TypeScript/Vite build passes (36.11 s Vite), full formatting
  and `git diff --check` pass. Private port 4397 confirms **all 12 release
  browser cases pass in 2.8 min**, including both original CI failures, every
  new sample on desktop/phone, six chooser sizes and cold installed-offline
  operation. The owned preview is stopped.

## Final physics and motion acceptance — 4 October 2026

Final runtime in `/home/ubuntu/brick-editor-physics-motion`, branch
`codex/physics-motion-investigation`, includes the source-preserving door repair
`de62bcc` and anchored-leaf support interval `1131dc3`. All named bounded roadmap
slices have implementations and acceptance evidence: multi-turn control,
reviewed features/Try/Save, spur and guided rack drives, contact policy/proxies,
planar loops and steering, authored force links/bearings, platforms/seats/grippers,
resource admission and contextual whole-mechanism controls. The source supports
reviewed families and authored mechanisms; broader automatic articulation is
still future work.

- `npm test -- --maxWorkers=2`: **211 files / 1,501 tests pass**, 694.12 s. This
  includes the original lighthouse, cathedral, CLI and playground regressions,
  new source/contact negatives and source/inventory preservation checks.
- Fresh schemas/TypeScript/Vite build passes; Vite takes 35.86 s. Generated
  schemas and validators have no changes.
- Private port 4397, one browser worker: **16 production cases pass in 4.5 min**.
  Rack forward/reverse in both modes, linked rack/slider-crank controls, every
  required viewport (1440×1000, 1080×1800, 360×600, 411×685, 390×844, 686×411),
  Dynamic phone controls, whole-system fit/orbit/return, and fresh installed
  offline rack restore remain verified.
- The rendered lighthouse reaches 30° after 30 ticks with changed pixels/posed
  export and exact normal source. A rendered official 60596/60616a door over a
  real 4162 tile opens 90° and closes to 0 with exact source/occurrences on exit.
- Full formatting, TypeScript and `git diff --check` pass; the eight-part rack
  fixture matches its generator. The owned browser preview is stopped.

The broad pass replaces the initial 1,476/1,480 checkpoint below. Source-bound
rack openings, native load/reaction/stall tests, thin-blocker response and public
reconstruction retain their separately documented finite scopes. Nothing here
claims universal molded-part fit, arbitrary spatial mechanisms or physical-phone
60 Hz throughput. Larger-contact costs remain in [measurements](PLAY-CONTACT-COSTS.md).

## Reviewed guided rack checkpoint — 4 October 2026

Production binding now admits only the actual source-bound reviewed 18940/18942
surfaces. All 900 housing regions retain 927 native children; all 1,245 rack regions
remain. Public regeneration independently passes its permanent integration check
in 9.76 s. The finite source floor review classifies 414 regions/425 children without
an epsilon or asset mutation; all lower-dimensional support stays. Source
projection exceptions are explicitly bounded, not presented as an exact molded
solid/topology theorem. See [rebuild](reviews/REVIEWED-PLAY-PROXY-REBUILD.md),
[floor review](reviews/REVIEWED-GUIDE-FLOOR-CONTACTS.md) and
[packet scope](reviews/REVIEWED-NATIVE-PROXY-PACKETS.md).

The focused 157-case initial run passed 155 cases and failed two added reaction
assertions measured after reversal had returned towards rest. Measuring carrier
reaction during forward travel corrects those assertions: both isolated mobile
cases pass in 50.61 s without changing motor/travel tolerances. The subsequent
full suite also passes every rack test. Full default-friction/default-density
forward/reverse, reflected load, obstruction recovery, straight/37° mobile
carrier reaction and per-pass angular-momentum checks pass. The 1 N·s passive
back-drive test explicitly authors friction 0; it makes no claim about travel
against default guide friction. 132 independent material/void controls preserve
source openings and every rack tooth/gap. Changed canonical geometry refuses
both modes before any native world/event allocation.

The fresh build passes schemas, TypeScript and Vite (40.53 s). 13 production browser
cases pass in 3.6 min on private 4397: both modes reach input 150°/rack −25π and
reverse slider +8 LDU, captures change, posed export moves all 8 parts, and normal
source/inventory remain exact. Linked rack and slider-crank controls, passive
feedback, release braking and whole-mechanism fit/orbit/restoration pass across
1440×1000, 1080×1800, 360×600, 411×685, 390×844 and 686×411, including Dynamic phone.
The production source entry covers the fixed-bearing composite rejection repair.
The owned preview has stopped.

A separate 9-case actual PlaySession safety run passes in 48.83 s: both modes stop
at a foreign 0.1 LDU wall and retry after removal; wider authored travel exposes
the actual housing stop and reverses back to 8; Y/Z misalignment refuses; a
native body displacement restores all floor/cap classes through the owned queue
hook. Source and every bound packet stay exact. See
[negative evidence](reviews/REVIEWED-GUIDE-CONTACT-SAFETY.md).

The new installed-offline rack companion passes in 55.8 s after restoring a saved
native project in a fresh JavaScript realm. Both modes run exactly 900 ticks per
leg. All 14 needed library chunks, lazy reviewed-rack-data and embedded-WASM
session assets come from service-worker caches; page/CSP errors are zero and the
full query/source/inventory match. The existing offline 8:24/pin-arm witness also
passes on the same final runtime. Offline build passes in 37.00 s; private 4413 is
stopped. The packets remain same-origin/lazy; no runtime dependency was added.

Broad verification: `npm test -- --maxWorkers=2` runs 208 files/1,480 tests in 732.89 s;
205 files/1,476 tests pass. Four failures are isolated for follow-up: the CLI's
90-tick door completion assertion precedes the new settling contract; lighthouse
lamp travel, cathedral entry and playground crate support reproduce independently.
Do not read the scoped rack/browser pass as a claim that the entire suite passed.

The isolated CLI follow-up passes in 49.00 s (45.47 s test): at 90 ticks the door is
89.601831° and 3.979926°/s, correctly still moving; at 120 ticks it is 90.175448°
and 0.050893°/s, complete under unchanged 1°/2°·s⁻¹ settling limits. Origin main
marked its 90-tick door complete while still 3.118948°/s. The test retains the
original motor/vehicle budget and kinematic 135° expectation and adds the bounded
settled witness. No CLI, API, runtime, contact or timeout change was needed.

The isolated playground follow-up passes in 26.40 s (22.62 s test). The original
4.230 LDU frame-origin displacement comes from crate tilt; transformed source
bottom clearance stays within the original 3 LDU allowance throughout all 40 push
ticks (maximum 1.543 LDU). After the actor stops and moves clear, the crate settles
within 0.05 LDU of the support with zero linear/angular velocity. Push distance,
Kinematic immobility, swing travel and exact source/inventory preservation remain
checked. No runtime, source, budget or tolerance change was needed. See
[physical support evidence](reviews/PLAYGROUND-CONTACT-REGRESSION.md).

The lighthouse follow-up restores the original lamp-turn/beach-to-top regression
without changing source, targets, tolerances or contact budgets (50.68 s in the
isolated worktree). Main integration passes 29 support/contact/BVH checks in
16.33 s and a schemas/TypeScript/Vite build (35.74 s Vite). Its new production
browser witness passes in 27.4 s: the actual rendered model reaches 30° after
30 ticks, the capture changes, posed export changes, and normal source and
occurrences remain exact. The private 4397 preview is stopped. Complete finite
source-triangle support applies only to the registered unchanged aggregate
collider and eligible literal Y-axis motion; wall, moved/changed collider,
unsupported compound and near-scaled/oblique frame checks retain fallback.

The doorway follow-up preserves the original cathedral west-entry and
organ-gallery stair assertions, adding exact project/inventory checks. Seven
focused source/physical/sample cases pass in 20.54 s; the final six door cases
pass in 9.21 s after a typed face-plane oracle correction. Actual 60596/60616a
geometry reaches 90° and closes to 0; included and 0.1 LDU native walls block,
removal permits retry, and raising the floor 0.01 LDU still blocks. Five convex
covers retain source surfaces and native hinge pins. The separate anchored-leaf
interval helper passes 23 focused checks and independent 6-case review with
exact source pivots, native rounding bounds and unchanged work/guard limits.
See [door source scope](reviews/CATHEDRAL-DOOR-PROXY-REVIEW.md).

## Canonical capture and native preparation integration — 4 October 2026

The parent integrates occurrence-bound canonical capture, the oblique native
consumer, exact-facet packet preparation, source-surface hashing and the maintainer
native compiler. **46 cases across eight files pass in 17.60 seconds**: capture,
oblique Kinematic/Dynamic spur motion, explicit thin/triangle/segment support,
surface binding, contact policy, anchored sliders and rack source/proposal checks.
The posed rack fixture generator retains its exact default eight-part source;
its existing oblique proposal check passes independently after adopting the new
optional fixture pose. This does not accept production rack physics.

The fresh production build passes, including schemas and TypeScript (Vite:
35.11 seconds). **Three browser cases pass in 41.6 seconds** on private port 4397:
oblique embedded same-name Kinematic/Dynamic entry at 390 × 844 and installed
offline pinned Technic entry/control after reload. The native WASM marker occurs
only in lazy `session-CZlDKufc.js`, absent initial `index-D8gvn4NH.js`. Generated
schemas remain unchanged; the owned preview has stopped. Focused formatting and
`git diff --check` pass. See [capture](reviews/PLAY-MEMBER-LOCAL-CAPTURE.md),
[canonical consumer](reviews/CANONICAL-MECHANICAL-PROXIES.md) and
[packet preparation](reviews/REVIEWED-NATIVE-PROXY-PACKETS.md).

## Centered collision children in rotated builds — 4 October 2026

Native compound children now compose both position and orientation through the
authored group frame. A new 37° oblique test checks actual containment in the
physics and walking-mirror worlds, including refusal at the old unrotated center.
The combined parent regression run passes **47 cases across six files in 44.56
seconds**. The fresh build passes, including TypeScript (Vite: 36.63 seconds),
and the rendered Dynamic lift/offline Technic reload checks pass in **39.9
seconds**. Rapier remains only in lazy `session-vZSJO0zJ.js` (4,483,783 bytes).
Generated files remain unchanged; port 4397 is stopped. See
[constraint and pose scope](reviews/ANCHORED-SLIDER-CONSTRAINT.md).

## Anchored slider obstruction and retry — 4 October 2026

The parent integrates the fixed-carrier prismatic rotational-lock repair and
passes **46 focused cases across six files in 36.56 seconds**: new straight and
37° oblique obstruction/retry, responding foreign contacts, mobile-carrier
rotation, existing dynamics, moving platforms, grippers and both native and
kinematic loop constraints. TypeScript and full formatting pass. No authored
pose, mass, effort or contact allowance is changed by this repair.

The production build passes (Vite: 43.65 seconds). Two relevant production-browser
checks pass in 54.7 seconds: rendered Dynamic lift carrying/release and installed
offline Technic reload/control. WASM occurs only in lazy
`session-D4A4P-ir.js` (4,483,767 bytes), not the initial app asset. Generated files
remain unchanged; owned port 4397 is stopped. See
[constraint scope](reviews/ANCHORED-SLIDER-CONSTRAINT.md). Corrected rack geometry
and back-drive acceptance remain separate and open.

## Corrected housing and native support diagnostics — 4 October 2026

The parent freezes the new 900-region positive-interval housing construction and
independently repeats 200 fresh-source section samples plus 101 material/void
controls. It also checks all 8,060 source vertices against the centered shared
Float32 lattice: exact local recovery and shared-vertex disagreement both have
zero failures; maximum part-local displacement is 5.954900129e-6 LDU.

Independent exact binary-rational faces and native ray clipping for two thin
regions show that explicit native faces retain interior support which automatic
QuickHull loses. Exported native hull data recomputes QuickHull and therefore
cannot establish internal shape preservation. Primitive Triangle/Segment checks
retain two lower-dimensional regions and verify both local contact and offset
clearance. These are private diagnostics. Full source coverage, native compound
support, loaded motion and production rack acceptance remain open; the Play
refusal and desired acceptance tests stay unchanged. See
[method, measurements and scope](reviews/RACK-CONTACT-ORIGIN-AND-FACTORING.md#positive-interval-construction-and-native-export-caveat).

## Proposal entry, rack refusal and moving-render resources — 4 October 2026

The proposal-entry child verifies **19 focused unit cases** and **eight
production-browser cases**, including both physics modes and all six required
viewports. A production-provider race test confirms replacement with an incoming
equal revision still increments the editor revision and refuses pending analysis
before renderer access. Native `project.json`, inventory, normal export and
queries stay exact during unsaved Try; posed export remains explicit and Save is
undoable. See [scoped evidence](reviews/MECHANICAL-PROPOSAL-ENTRY.md).
The fresh Impeccable reviewer scored the three setup-flow corrections resolved
after the same twelve recaptures and eight production cases passed. That verdict
covers its fix list, not the whole interface or rack-contact acceptance.

The narrow source-bound rack refusal child passes **52 focused regressions**,
including eleven new unsupported-contact/source/resource/lifecycle checks.
Integration retains the existing single dynamic event queue and delays its
allocation until source preflight passes. The parent focused four-file run passes
**26 tests in 17.25 seconds** (`.local/proposal-rack-integration-units.log`).
Desired rack geometry, forward/reverse, load, back-drive and mobile-carrier tests
are retained and still unaccepted. No contact exclusion or geometry relaxation
is introduced by the refusal.

At `af71078`, the production build passes (Vite: 63 seconds). The read-only
`scripts/benchmark-play-moving.ts` witness passes all four desktop/mobile and
Kinematic/Dynamic slices plus its final identical-source-hash assertion.
Both motors advance; renderer budgets, draw calls, moving collision triangles,
collected JavaScript heap and twelve fixed-tick rendered-frame samples per slice
are recorded. The 26-part scene draws 22,904 triangles in 78 calls; sampled ticks
are 34.7–77.8 ms under shared-VM load 8.52–12.36. This fills the moving-render
resource measurement gap and does not establish a phone or 60 Hz budget.
See [full method and limits](PLAY-CONTACT-COSTS.md#production-moving-render-resource-witness).
Private JSONL: `.local/moving-browser-resources.jsonl`; owned browser/4397 preview
are stopped. Later runtime/UI changes require their own integration checks.

## Authored grab/release and held-system overview — 4 October 2026

The native gripper child passes **35 focused unit cases** and **six production
browser cases in 1.8 minutes**, covering every required viewport. Current pose
and velocity stay unchanged at attach/release; actual payload load and obstacles
transmit through native joints while contacts remain enabled. Ownership, cycle,
overlap, pause/capture/revision and sixteen-attachment admission checks preserve
state on refusal. Persistence, posed application/undo and destructive basic-edit
or clipboard paths retain or explicitly refuse the new definitions.

Each browser case lifts/carries/releases an original CC0 crate, compares source
and inventory exactly and restores all five exported occurrence transforms.
Independent projections keep 32 selected-and-held corners clear of the controls,
for 192 checked corners across six sizes. The immutable packet at
`/home/ubuntu/brick-editor-grippers/.local/grip-review-3e7467d` contains six hashed
captures, fit records and logs; its detector confirms 44 px actions and clear
bounds. Child build, types and full formatting pass, and port 4403 is stopped.
A fresh reviewer reports `ship` for this scoped control/overview extension.

At runtime commit `f86b8c6`, the parent combined production build passes, including
schema regeneration and TypeScript (Vite: **46.98 seconds**). The Rapier WASM
marker remains confined to lazy `session-Dg0UUR_U.js`, absent from the main
application chunk. Full formatting passes and regeneration produces no diff.
The parent focused run passes **44 tests across seven files in 33.63 seconds**.

The parent production-browser run passes **21 cases in 5.8 minutes**: eight
proposal-entry cases, two grip integration cases, six grip viewport cases, one
offline case and four combined-control cases. Coverage includes all six required
viewports, gripper-only controls and replacing a held authored rig with an
unsaved proposal. The latter checks old-action refusal, source preservation and
the new overview's bounds. Logs are `.local/mechanisms-combined-{build,units,
browser,format}.log`; the owned 4397 preview is stopped. These focused suites
exclude the still-unaccepted rack motion tests and do not imply a full-suite
pass. See [behavior and limits](PLAY-GRIPPERS.md) and the
[scoped design handoff](reviews/MECHANISM-ENTRY-GRIP-DESIGN.md).

The original production build, clean install and test suites passed. These results establish the implemented subset, not completion of the entire specification.

Later feature checks are dated below; this opening table records the original release checks.

Instruction evaluation outputs are local artifacts, not committed test results.
Written reviews retain their historical scopes; see the
[artifact policy](reports/instruction-generation/README.md#local-artifacts).
Automated instruction regressions use six small unmodified OMR source fixtures
and existing sample generators. CI never fetches models or relies on archived
plans, booklets, screenshots or one-off review scripts.

| Check                      | Result                                                                                                                             |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `npm ci`                   | Clean lockfile install passes                                                                                                      |
| `npm run build`            | TypeScript and Vite 6.4.3 pass                                                                                                     |
| `npm test`                 | **237 tests pass**, 52 files, 0 failures                                                                                           |
| `npm run test:browser`     | **98 tests pass**, 0 failures, against the production bundle                                                                       |
| Browser engine             | Playwright 1.63.0, Chromium 153.0.8010.12, SwiftShader software WebGL2                                                             |
| Layouts                    | 1440×1000 desktop, 1080×1800 touch, 360×800 touch                                                                                  |
| `npm run library:validate` | 611 files and 214 catalogue parts; bundle, dependency closure, licences, thumbnails, retired locks and library/mapping hashes pass |
| `npm audit`                | 0 known vulnerabilities at verification time                                                                                       |
| Formatting                 | Prettier check passes                                                                                                              |
| Standalone CLI inventory   | 200-part fixture produces 100 white + 100 red 3001 units, without a browser                                                        |
| Standalone CLI render      | Fixed interior camera exports 800×600 PNG and revision/camera/library manifest                                                     |
| Subdirectory deployment    | `/brick-editor/` works on an ordinary Python static HTTP server, including library loading and PNG capture                         |

Browser tests exercise a 200-part UI fill, command recolour/undo, native round trip, inventory preview/download, exact camera/alpha PNG readback, real starter geometry, both touch layouts, texture strict-refusal, fixed-colour decoration surviving repaint, reflected custom geometry, two-pointer placement separation, locked-layer atomicity, offline inventory, Photo UI transparent capture and cancelled import isolation. The domain suite also covers source paths/cycles, affine math, local-name override protection, XML escaping/invalid characters, stale inventory previews, native checksums, quota recovery, layer disposition, occurrence-scoped metadata, bookmark history, imported steps, revision monotonicity, unsafe source-record injection and a 10,000-reference parser fixture.

The first conformance run exposed a real loader integration failure: `s/` subparts were being rewritten to unresolved paths, and the loader returned empty groups after swallowing errors. The final adapter supplies an explicit embedded file map, checks for failed dependency attempts and rejects empty official prototypes. A separate material-cache issue was fixed by compiling colour directives in the same loader instance as the geometry. No placeholder cuboids stand in for the audited starter parts.

## Walking and driving cameras — 10 October 2026

- All **203 Play unit tests in 35 files** pass. New regressions cover subtle
  distance-driven bob, deterministic replay/interpolation, release and wall
  settling, steady flight/third-person walking, constant chase distance through
  full steering circles and yaw wrapping, manual orbit/recentering, reverse,
  and foreign-wall retraction/recovery at four viewport aspects.
- **17 focused production-browser tests pass**, using a private preview on port
  4391 and one worker: `play-driving-camera`, `play-orbit`, `play-seats` and
  `play-strafe`. The new chase checks run at 1080×1800, 360×600, 411×685, 390×844,
  686×411 and 1440×1000. Existing tests drive the real jeep through fifteen
  seconds of steering, seat/drive/exit the roadster, and preserve seat and
  keyboard/touch movement behavior. Selected portrait/landscape and jeep
  screenshots were inspected; the nearby fixture panel shows no clipping.
- TypeScript, the production build and repository formatting checks pass.

These are Chromium/SwiftShader checks. They do not establish physical-phone
motion comfort or reproduce the separately reported nearby-block artifacts;
the affected model/look and a visual example remain needed for that issue.

### Current-main integration — 11 October 2026

The camera fixes are also applied to the current vehicle-possession route,
including native/source-derived cars and player scaling. Its camera caches a
chassis-local enclosing sphere, follows the actual chassis heading through a
damped turn, and uses the normal Play near plane. This removes pose-dependent
refitting and the excessive depth-range ratio on the driving camera.

The 29 targeted unit regressions pass across walking bob, both driving routes,
seat entry, possession/exit, and six-size vehicle framing. The broader Play run
passed 718 checks with two intentional skips; two existing mechanical checks
hit timeouts under parallel load and passed with unchanged limits when both
files (30 checks) were rerun alone. The six additional framing checks pass,
including projection of every corner through full chassis turns and orbit.
All 17 focused production-browser checks pass across the final targeted runs:
the six-size chase regression uses the real-parts roadster and the actual
Get in flow, with 450 driving ticks to cross the heading seam. The existing
jeep/roadster orbit, entry/exit, seat metadata and keyboard/touch strafe checks
also pass. Private previews used ports 4392 and 4393; phone portrait and
landscape captures were inspected. Production build, TypeScript and repository
formatting pass. The original nearby-block artifact report has not been
visually reproduced; the near-plane
correction addresses a concrete depth-precision issue, with confirmation on
the user's affected model still pending.

## Running the browser suite

The browser tests are independent (each gets a fresh browser context) and run in parallel. `playwright.config.ts` splits them into three projects:

| Project | Selects                | What it holds                                                                                                            |
| ------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `main`  | everything not tagged  | the bulk of the suite, fully parallel                                                                                    |
| `heavy` | titles ending `@heavy` | path-traced Photo tests; each compiles the path-tracing shader (about a minute on SwiftShader)                           |
| `perf`  | titles ending `@perf`  | tests asserting wall-clock budgets (longest main-thread task, physics tick, selection latency); one worker, never shared |

| Command                                           | What it does                                                                                                                |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `npm run test:browser`                            | builds, runs `main` + `heavy` in parallel, then `perf` alone (so budgets are never timed under load); fails if either fails |
| `npm run test:browser:quick`                      | builds, runs only `main` — for iteration                                                                                    |
| `npm run test:browser -- tests/browser/x.spec.ts` | extra arguments (spec paths, `--grep`) go to both phases                                                                    |
| `npx playwright test --project=main <spec>`       | against the existing `dist/`, no rebuild                                                                                    |
| `BROWSER_WORKERS=1 npm run test:browser`          | override the worker count (default: half the cores locally, 2 on CI)                                                        |

Tag a new test by ending its title with ` @perf` if it asserts elapsed time, or ` @heavy` if it path-traces. Local results go to `test-results/browser-results.json` (and `browser-results-perf.json`); perf traces to `test-results/perf/`.

On CI (`.github/workflows/cloudflare.yml`) the bundle is built once and shared as an artifact; the browser tests run as eleven parallel jobs — `main` in eight shards, `heavy` in two, `perf` in one — with a merged HTML/JSON report uploaded as `playwright-report`. SwiftShader is CPU-bound, so a second worker on a 4-vCPU runner roughly doubles each test's duration; the speed-up comes from more jobs, not more workers per job. Shards are contiguous by test count, not balanced by duration, so the slowest shard sets the pace. The default test timeout is 120 s, since two workers sharing the CPU can double a test's duration.

## Expanded feature verification

Production-browser coverage now includes fixed-tick Play and simultaneous touch movement/look, real doorway/stair collision, safe teleport and low-ceiling refusal, kinematic hinge/vehicle previews and undoable pose application, clipboard/arrays, layer disposition, PDF/PNG/HTML instruction publishing, native asset bundles, checksum-checked sharing, offline reload with lazy Play/PDF loading, multi-tab conflict forks and delayed startup recovery. The CLI suite also exports real Play PNGs and instruction PDFs. Recovery guards preserve edits made during delayed startup without re-saving an unchanged recovered project; the two-tab and controlled-delay regressions both pass.

The actual-app exploration test exposed lost scoped colour/BFC records during per-face compilation and false capsule hits against an oversized ground box. Compilation now carries the applicable source context, and the optional ground is an infinite collision plane. Regression tests exercise the rendered room and controller together.

The mobile UX review completed at **8.7/10** after fixes, including the expanded Project, Photo, Instructions and Play panels. See [UX audit](UX-AUDIT.md) and [conformance audit](CONFORMANCE-AUDIT.md). This is a headless-browser review, not physical-device testing.

## Performance smoke measurements

Linux ARM64 VM, Neoverse-N1, four available CPUs, software WebGL2, 1440×1000 viewport, local production preview. These are **single-run timings**, not p95 statistics, frame-rate measurements or physical-phone benchmarks.

| Fixture          | Add command | Scene readiness after command | Inventory preview/export | 1080×720 PNG |
| ---------------- | ----------: | ----------------------------: | -----------------------: | -----------: |
| 200 real parts   |     31.5 ms |                       79.7 ms |                  14.4 ms |     4,249 ms |
| 1,000 real parts |     68.7 ms |                       66.5 ms |                  38.9 ms |     1,979 ms |

Initial shell/library readiness was approximately 579 ms. The first capture includes shader warmup; the later case benefits from cached prototypes/shaders. The single 1,000-part command-plus-scene result does not establish the specification's sub-100ms p95 target. Frustum culling remains enabled. Hardware FPS targets remain unverified. A later 5,000-part comparison reduced draw calls from 15,001 to seven, with matching geometry counts; cold software PNG capture increased from 9,156.8 ms to 12,702.5 ms. This establishes draw-call reduction, not an FPS improvement. The production application JavaScript is approximately **430 kB gzip**, with separately loaded Rapier (about 1.65 MB gzip) and PDF (about 182 kB gzip) chunks, excluding worker scripts/library. Vite still reports its advisory about the uncompressed main chunk exceeding 500 kB; further splitting is deferred.

## Evidence and limits

- [Play exploration screenshot](screenshots/play-exploration.png)
- [5,000-part reference report](reports/performance-5000-reference.json) and [batched report](reports/performance-5000-batched.json)
- [Machine-readable verification](reports/verification.json)
- [Performance environment, timings and draw statistics](reports/performance.json)
- [Dependency advisory result](reports/npm-audit.json)
- [Subdirectory smoke result](reports/base-path.json)
- [200-part XML](reports/200-parts-wanted.xml) and [inventory report](reports/200-parts-inventory.json)
- [Interior PNG](screenshots/interior.png) and [render manifest](reports/interior.render.json)
- [Desktop](screenshots/desktop.png), [1080×1800 touch](screenshots/mobile-1080.png), [360px touch](screenshots/mobile-360.png)

There was no authenticated BrickLink upload, purchase, physical-device run, full-library compatibility test, universal connectivity/buildability proof or dynamic mechanism physics test. Capsule exploration and kinematic mechanisms have automated coverage. Conditional-line and BFC coverage includes shipped starter, scoped custom geometry and batched/reference image comparisons; broader library compatibility remains outstanding. See [STATUS.md](STATUS.md) for the remaining release gates.

## Editing and source-preservation follow-up

The production suite now covers transform-handle previews/cancellation/one-step undo on desktop and 1080×1800 touch; actual visible/through box and lasso selection; explicit add/remove/toggle selection; two-finger cancellation followed by real camera navigation at 360 and 1080 pixels; folder membership, layer duplication and ghosting with unchanged authored state and full-opacity image exports. The new domain fixtures cover hidden-material selection, near-plane clipping, affine/source-aware duplication, folder ancestry persistence, source-scope preservation, orphaned BFC directives and reflected raw polygon winding. Mobile UX remains **8.7/10** after the added controls. A deterministic asynchronous-capture regression proves ghost changes leave capture materials frozen and restore the latest view preference even after readback failure.

These checks do not establish connected-assembly selection, arbitrary workplanes, complete ancestor-BFC rendering, a full material library or physical-device performance. Selection is bounded and visible-surface evidence is at CSS-pixel resolution. See STATUS and TODO for the remaining work.

The latest production run adds independent front/back BFC comparisons, submodel/shared-edit flows at all three layouts, world/face/numerical workplanes, remappable shortcuts and shared clipboard, actual export-profile downloads, and controlled cross-tab races without Web Locks. Save tests cover absent coordination, expired transactions, backup-before-reload and stale errors after a fork. That checkpoint passed 48 browser tests; its 135-test domain/integration suite includes export API cancellation/revision guards and standalone export-profile CLI coverage.

## Moving Play, instruction editing and recovery

The final combined production run passes **62 browser tests**, with **142 unit/integration/CLI tests** across 32 files. Added coverage includes moving door colliders, blocked closing sweeps, fixed-tick vehicle motion and throttle release, actual touch rig controls, secondary-touch Run, pointer-capture and editable-focus loss, keyboard focus after camera clicks, fixed-view capture/bookmarks and project replacement. Eight UI-mounted third-person entry/exit cycles track live GL objects and global listeners after warmup; this is bounded lifecycle evidence rather than a universal leak proof.

Instruction browser tests edit and publish step notes/cameras and compare actual canvas pixels: the first ten parts differ from the full forty-part wall, and the first-step image survives note edits, slider round trips and reorder/undo. Three real WebGL loss/restore cycles preserve in-memory edits and native backups and produce identical restored captures. A controlled shader-completion delay confirms that graphics loss interrupts capture and stops polling rather than returning empty pixels or leaving a timer running.

The independent mobile re-review is **8.7/10** at 360×800 and 1080×1800. See [Play acceptance audit](PLAY-ACCEPTANCE-AUDIT.md) and [UX audit](UX-AUDIT.md) for evidence and remaining scope. No riding, pushing, vehicle/world dynamics, universal traversability or physical-device performance is claimed.

A deployment smoke test additionally exposed a warm-import race: a delayed instruction-plan effect could cancel a freshly entered API Play session. Mode lifecycle and plan preview effects are now separated. The new regression reproduces the prior failure and passes after the fix, including cached imports, layer duplication/undo, immediate rig entry and unchanged authored revisions. The final full production suite passes all 62 tests.

The latest settings checkpoint adds browser checks for validated session spawns and bounded camera controls at both touch sizes, persistent Play key remapping and Escape from focused inputs, and instruction-view isolation during API Play. Unit checks directly inspect avatar joints and gait, camera near-plane footprint/capture restoration, and saved-spawn revalidation after a mechanism moves. Generated AJV validators now expose a small declaration boundary to TypeScript; their runtime schemas and validation remain in the production build.

The world-profile/instruction checkpoint adds Play rendering/collision exclusions independent of editor visibility, captured-scope intersection, mobile layer/ground controls, instruction prior-part dimming with material restoration on success/failure, and shared rotation with local pivots and atomic all-instance scope checks. Five independent PL-06 tests exercise 20-LDU doorway traversal under a 76-LDU ceiling at four aspect ratios and actual avatar suppression/restoration under camera obstruction. These fixtures extend the audited subset; they do not certify every catalogue part or physical device.

## Camera-relative movement, fill sets and rig authoring

The combined production build passes **179 unit/integration/CLI tests across 42 files** and **80 Chromium browser tests**. TypeScript/build, formatting, and the pinned library integrity check also pass. Browser coverage includes 1440px desktop, 360px touch and 1080×1800 touch; these are emulated viewports, not physical-device measurements.

The left/right regression derives screen-right from the actual camera rather than repeating the movement formula. Four unit cases failed before the strafe-basis fix, then passed; keyboard and real CDP touch checks cover both views and walking/flying. Allowed-set fill checks cover quarter turns, masked holes, hidden obstacles, bounded output, mixed-height refusal, worker cancellation, stale results, UI preview invalidation and atomic undo. Rig checks cover explicit rotated frames/world pivots, rest-pose preservation, old/new membership locks, overlapping groups, stale drafts, native persistence and undo/redo.

Independent combined rig/fill mobile review reached **8.7/10** after adding colour and world position to the part picker. See UX-AUDIT for screenshots and remaining authoring limits.

## General joints and spatial query checkpoint

The combined run passes **206 unit/integration/CLI tests across 46 files** and **86 Chromium browser tests**. The final lossless-load guard is additionally checked by targeted rig browser tests after rebuilding. Formatting, TypeScript/build and library validation pass. Desktop rig editing now has 1440×1000 coverage alongside 360×800 and 1080×1800 touch emulation.

Independent query review reproduced oversized repeated diagnostics, falsely missing installed primitives, undersized bounds under nested project overrides, and hidden unresolved override dependencies. Regressions now require bounded output, source/purchasing identity separation, context-aware dependency diagnostics and conservative unknown bounds. The browser checks render an installed primitive while refusing complete purchasing export, inspect source bounds without WebGL, and read real editor selections. CLI tests verify the shared query contract and input/request overwrite protection.

General joint tests cover fixed/spherical rest-only behavior, revolute degrees, prismatic LDU, frames/axes/motor/limit preservation, pose equivalence, undo and supported topology. A final independent review reproduced silent normalization of valid near-unit axes and near-coincident anchors during rename. Loading now refuses a rig if reconstruction would change its data beyond ordinary floating-point roundoff; tests also cover tolerated rest-transform and wheel-axis drift. Unsupported compound editing remains explicit. Mobile review remains **8.7/10** with screenshots in UX-AUDIT.

## Nearby interaction checkpoint

The existing 206-test unit/integration/CLI suite passes, with three additional passing tests for asymmetric joint limits, reach boundaries, unsupported targets and key-preference migration. Nine targeted Chromium tests pass for interaction, remapped keys, moving colliders and camera-relative strafing. The three interaction tests also pass after adding actual CDP touch driving/release checks at 360×800 and 1080×1800. They verify E/tap open-close, out-of-range refusal, on-foot vehicle steering, paused drive input and unchanged exports. TypeScript/build and formatting pass. These are headless browser checks; seated access, multi-rig interactions and physical-device behavior remain unverified.

## Multiple rigs and capture isolation

The integrated checkpoint passes **216 unit/integration/CLI tests across 48 files** and all **32 Play Chromium browser tests**. TypeScript/build and formatting pass. New engine tests cover multiple moving collider sets, synchronized ticks, explicit targeting, aggregate budgets, duplicate/overlapping membership and layer exclusion. Browser tests keep a door pose while driving a different rig, inspect both poses in capture metadata, and preserve the authored export.

Independent review reproduced a mutation race during image capture. Play now rejects mutating operations before touching simulation state, refuses overlapping capture preparation, rolls back camera preparation failures and prevents an old callback from restoring a successor session. Actual Chromium regressions verify atomic rejection and preservation of an explicit pause during capture. The independent mobile critic initially scored an overlapping control layout 8.3; after the worker's correction, the integrated 360×800 and 1080×1800 interface scored **8.7/10**. See UX-AUDIT for the before/after evidence and limits.

## Deep occurrence paths and request budgets

The occurrence-ID checkpoint passes 231 unit/integration/CLI tests across 51 files, TypeScript/Vite build, formatting and pinned-library validation. The [clean GitHub CI run](https://github.com/jzyrobert/brick-editor/actions/runs/36327367099) passed all 97 production browser checks in one run. The fixtures use actual long native IDs and a syntactically valid unknown path for the capture-restoration failure case.

This checkpoint separates canonical occurrence paths from ordinary IDs. Targeted tests accept the exact 393,409-character escaped boundary and 1,024-code-point Unicode node IDs, reject empty/noncanonical/deeper paths, and preserve the ordinary ID limit. A 32-level UUID fixture exercises exact-ID queries, recolour/undo, clipboard paste, instruction assignment, inventory, native round trips and Play reporting. The browser fixture imports a checksummed native archive with long IDs, then queries, recolours, captures the selected part and enters Play.

Request regressions cover encoded UTF-8 accounting, shared values, cycles, inherited/accessor rejection, nesting/work limits, aggregate transaction refusal before mutation, Unicode-heavy cut atomicity, and CLI command-file limits before parsing or output. The independent review found and verified fixes for the clipboard UTF-16/UTF-8 mismatch and inherited array getters. The scope regression checks 200,000 selections (100,000 when written) with a bound on path visits instead of a timing threshold. Empty paths and unknown selected descendants cannot widen a scope silently.

Native archive limits remain separate. These tests do not prove a global bound on all expanded occurrence-path memory, compiler work or every valid project graph. No UI presentation changed; the prior mobile UX score remains 8.7/10.

## Animated Play joints

The integrated checkpoint passes all **237 unit/integration/CLI tests** across 52 files and all **98 production browser tests** in one run. Build, formatting and pinned-library checks pass. Targeted domain checks establish exact 60 Hz travel, fractional endpoints, negative prismatic limits and units, equivalent batched/single-tick replay, atomic invalid targets, independent targets and cancellation, and last-accepted-pose retention with real door triangle colliders.

Browser tests show intermediate rendered poses, reversal before the midpoint, persistent blocked retry, pause/capture isolation, simultaneous vehicle/door movement, and unchanged authored exports. The independent critic rechecked 360×800, 1080×1800 and desktop, including real-time pause/resume, and scored the new flows **8.7/10**. See the UX and Play acceptance audits for screenshots and limits. Proximity targeting, on-foot vehicle control and kinematic physics remain the scope; line of sight, seats/riding and vehicle/world response are still open.

The animation checkpoint also passed clean GitHub CI (238 unit/integration/CLI tests and 98 browser tests), then deployed to Cloudflare as commit `8ffcb1b`. Four live HTTPS browser tests pass at desktop, 360px and 1080px widths, covering contextual joint animation/reversal, vehicle controls, pause, frozen capture and blocked retry. The machine-readable report identifies the deployed commit separately from subsequent local work.

## Expanded path budgets and source persistence

The resource checkpoint passes **250 unit/integration/CLI tests** across 55 files and **98 production browser tests** in one run (8.7 minutes, no failures, retries or skips). TypeScript/Vite build, formatting and pinned-library checks pass. The source-validator tests also passed after correcting a fixture classification and adding replacement-atomicity/latest-recovery assertions.

A memoized estimator and incremental collector accounting bound expanded visits, leaves, path characters and retained path slots. Tests preserve 100,000 flat leaves and depth64 support while refusing a 109-node graph whose complete IDs would contain 36,286,900,000 characters. The dangerous graph is never materialized. Independent source review found no concrete semantic regression in indexed instruction-path validation or native/storage admission.

Native backup and local recovery now validate authoritative source without expanding its scene, including the newest valid revision of a project that exceeds derived path budgets. The Editor still requires a materializable replacement in this checkpoint. Source-only UI admission, deferred STEP derivation, profile plumbing and vehicle/world collision work remain separate subsequent changes. See [derived occurrence limits](RESOURCE-LIMITS.md) for units, defaults and remaining boundaries. This resource checkpoint passed clean GitHub CI (250 unit/integration/CLI and 98 browser tests) and deployed as `1232e48`. Five live HTTPS browser checks pass for deep occurrence handling and animated interaction at desktop, 360px and 1080px. Source-only UI and vehicle/world protection are subsequent unshipped work.

## Source-only recovery and protected vehicle driving

The integrated checkpoint passes **278 unit/integration/CLI tests across 60 files** and **103 production Chromium browser checks** (9.4 minutes). The first final unit invocation encountered a preparatory seat-test file being moved during collection; a clean rerun passes all 60 files. The full browser run covers source-only recovery and conservative vehicle/world collision. A subsequent readiness-invalidation fix also passes six focused unit tests and three isolated browser cases; final-build browser checks are recorded separately below rather than attributed to the earlier full run.

Source-only cases cover 360px and 1080px layouts, backup/reload, retained API handles, rapid source replacements and denied storage. Vehicle cases cover collision stop, persistent explanation after releasing controls, reversing away, capture metadata and unchanged authored source. Independent mobile UX scores are **8.8/10** for source-only recovery and **8.7/10** for vehicle collision feedback; these do not certify the planned seated-entry feature. Seats and riding remain unimplemented.

The final TypeScript/Vite build, including readiness invalidation and updated capability declarations, passes all five follow-up source-only/vehicle browser checks (30.7 seconds). The full 103-case result and final five-case follow-up are distinct runs. The live deployment is still `1232e48` until this checkpoint passes CI and is published.

Checkpoint `3c45969` passed clean GitHub CI ([run 36331550085](https://github.com/jzyrobert/brick-editor/actions/runs/36331550085)): 278 unit tests and 103 browser checks (6.4 minutes), formatting and pinned-library validation. Cloudflare deployment `d39136b2-49ba-4afc-a4ea-f1dc045e470d` successfully published that exact commit. All five live HTTPS source-only/vehicle checks pass. Seated entry, riding and safe exit are subsequent unshipped work; the deployment workflow still needs `CLOUDFLARE_API_TOKEN` for automatic uploads.

## Authored seated-driving checkpoint

Seated runtime passes the focused entry/drive/exit, rider/world and foreign-door collision, safe-exit, yaw-wrap and camera-obstruction checks. The integrated pre-camera-adjustment run passed 295 tests across 65 files; the camera and API preflight additions have separate focused coverage. Five final production-browser cases pass (26.6 seconds) at 360px, 1080px and desktop, including real simultaneous touch driving/look, capture, blocked-exit recovery, stale metadata refusal and preserving the seat through the older vehicle editor. Independent mobile review improved from 8.2 to **8.7/10** after the elevated chase view and exit-card placement fixes. The rendered original figure is also checked against independent body boxes at rotated seat/head angles. Live deployment remains `3c45969` until this checkpoint passes integrated CI.

An isolated checkout of the exact staged seated-driving checkpoint passes **297 unit/integration/CLI tests across 66 files**, including the final camera and API-preflight additions. This keeps subsequent Santorini renderer/storage work out of the seat checkpoint's evidence.

## Raw-geometry architectural import checkpoint

Evidence for the supplied Santorini v2 MPD set (user files; not committed). Software WebGL2 (SwiftShader) on the Linux ARM64 VM; single runs, not p95 statistics or phone measurements.

| File                          | Leaves | Ready after import | Result                                           |
| ----------------------------- | -----: | -----------------: | ------------------------------------------------ |
| `room_C0.mpd`                 |    615 |            ~0.35 s | Renders; previously refused (128-variant budget) |
| `all_interiors_only.mpd`      |  2,356 |             ~1.0 s | Renders; previously refused                      |
| `santorini_v2_cutaway.mpd`    | 13,923 |             ~5.1 s | Renders                                          |
| `santorini_v2_complete.mpd`   | 19,922 |          ~8.2–10 s | Renders; previously refused (5,000 occurrences)  |
| `all_interiors_only_flat.ldr` | 27,600 |             ~8.0 s | Renders (all raw geometry)                       |

- Rendered output was compared by eye with the supplied previews: white walls, blue domes/shutters, vines and cobbles match. The first integrated build rendered non-certified walls black (zero normals from loader twin-face smoothing); that is fixed and guarded by `tests/browser/raw-geometry.spec.ts`, which fails with 0 lit pixels when the fix is removed.
- Complete-file persistence: import → IndexedDB saved revision 1 → reload (identical models and LDraw export) → raw-face recolour → saved revision 3 → reload (identical). Native backup 1.03 MB, 142 source models. Previously localStorage autosave threw `QuotaExceededError` at ~9.5 M characters.
- Draw calls for the complete file fell from ~580 to ~250–270 per frame after baking sheared/non-instanceable part placements into merged batches (6 → 64 merged meshes, 582 → 10 per-object fallbacks). Frame time on software GL did not change measurably (~27–31 ms at 360×800, 1080×1800 and 1440×1000), so this is not an FPS claim. JS heap after load: ~310–530 MB depending on viewport.
- Two startup races surfaced and were fixed: automation `ready()` could resolve before asynchronous IndexedDB recovery, and against an update superseded by a newer one.
- The BFC pixel reference now disables loader smoothing, because the stock loader cancels double-sided twin normals in the reference as well.

## Play performance on large imports

Measured with `santorini_v2_complete.mpd` (user file; not committed) on software WebGL2 (SwiftShader) on the shared 4-core Linux ARM64 VM, which other jobs were also using. Frame intervals there are dominated by software rasterisation and CPU contention, so they are not phone frame rates. The comparable figures are main-thread JavaScript time per animation frame, fixed-tick cost, draw statistics and entry time. There were two interleaved runs per build, and the ranges below cover both.

| Metric (complete file)                                   | Before (6f2b9d4) |                                     After |
| -------------------------------------------------------- | ---------------: | ----------------------------------------: |
| Main-thread JS per realtime frame, standing in the open  |       506–582 ms |                                    5–8 ms |
| Main-thread JS per realtime frame, walking into a facade |       577–690 ms |                                  14–18 ms |
| One Play frame submission (CPU)                          |         18–21 ms |                                2.4–4.9 ms |
| Frame with an active mechanism pose (door/vehicle/drag)  |       419–577 ms |                                   4–13 ms |
| Enter Play                                               |            3.3 s |                                 1.5–2.2 s |
| Phone drawing buffer at 360×800, DPR 3                   |    720×1140 (2×) |                            540×855 (1.5×) |
| Draw calls / triangles per first-person frame            | ~240–260 / ~450k |                                 unchanged |
| Static collision triangles                               |          477,952 | 402,904 (126k welded vertices, was 1.43M) |

- **Root cause:** each realtime frame deep-copied the whole project twice, once for the revision check and once for the interaction lookup (`Editor.project` is a `structuredClone`). Play now reads a cheap `Editor.revision` and snapshots the rigs once per session.
- Rendering no longer rebuilds a JSON signature of about 20k occurrence IDs every frame. It also no longer walks or recomposes about 42k hidden handle objects: batched handles are excluded from the draw traversal. Moving rig members are drawn from their live handles, so an animated pose no longer re-merges every static batch per frame. Play redraws only when its camera, avatar or pose changes.
- Static collision stays one trimesh collider. Before it is built, reversed twins, exact duplicates and zero-area faces are removed; queries are two-sided, so the surface is unchanged. Deterministic `stepTicks` walks reached the same endpoints as before (one endpoint differed by under 1 LDU after 480 ticks).
- **Still expensive:** character-controller ticks while pressing into dense decorative geometry (flowers, vines) cost about 20–65 ms here, against under 1 ms in the open. Realtime catch-up now stops after 10 ms of ticks per frame and drops the whole-tick backlog, so the world slows instead of each frame getting longer. Individual ticks are unchanged.
- The first switch to third person compiles the avatar shaders once (a one-off stall of hundreds of ms on software GL).
- Phone FPS, GPU time and battery use were not measured on a physical device.

## Connectors checkpoint (28 September 2026)

- `npm test`: **84 files, 389 tests pass**. `tests/unit/connectors.test.ts` pins extraction for a 2 × 4 brick, 1 × 1 plate/brick, tiles, a 45° slope, round bricks and plates and a baseplate against hand-checked positions; re-derives all 214 parts from the pinned library and requires the committed pack, its hash lock and every `snapVerified` flag to match; and covers snapping (off-grid targets, 90° turns, underside placement, clash refusal, no snap without verified data), connectivity groups/assemblies and stud workplanes.
- Full Playwright suite against the production bundle (private config, own preview port): **136 tests; 134 passed on the first run**, the two failures were expectations of the old "no connector data" state (health Connections label, query connectivity status); both were updated and pass. New `connectors.spec.ts` taps a brick onto an off-grid brick (desktop and 390 px phone), turns it, checks the health report, **Select connected**, `connectors.groups/connected` and **Pick a stud**.
- `npm run library:validate` checks the connector pack hash and library binding; Prettier and TypeScript pass.
- Not established: other connector families, candidate cycling, real clutch or buildability, physical-device behaviour.

## Motors, dynamic physics and automatic doors (28 September 2026)

- Format check passes; `npx vitest run` (after rebasing onto the connector work in eb31233): **89 files, 433 tests pass**. New files: `play-dynamics.test.ts` (byte-identical replay, motor-driven joints, pushing, kinematic/dynamic velocity motors with blocking and retry, suspension vehicle and steering convention, validation, proxy reduction), `play-auto-doors.test.ts` (door-table pins, re-derivation of pack doors from shipped geometry, the real 60596/60616a door room with frame-decided swing, walk-through, posed export, two-way doors opening away from the explorer, skip reasons), `rig-dynamics-data.test.ts` (native round trip, undoable physics-only drafts, posed export) and `cli-play-mechanisms.test.ts` (CLI `--open-doors`, `--posed-output`, `--rigs`, `--dynamic-rigs`, `--vehicle`, `--motors`, `--joint-targets`, reproducible reports).
- Playwright (private config, SwiftShader): **147 tests pass**. These include `play-physics.spec.ts` (the door opens with E at 1440 px and with a tap at 360 px; the Dynamic choice in the folded Mechanism physics section; the motor toggle in the remote drawer at both sizes), `play-physics-performance.spec.ts` and the unchanged `hud-layout.spec.ts` at 360×600 and 411×685.
- Performance (`play-physics-performance.spec.ts`, VM load average about 12 from concurrent agents, so numbers are noisy). Means over 300 fixed ticks with the car driving, the spinner motor running and the explorer walking, physics playground; door room with the door opening:

| Profile                                                       | No rigs    | Kinematic rigs | Dynamic rigs | Auto door  |
| ------------------------------------------------------------- | ---------- | -------------- | ------------ | ---------- |
| Desktop, ms/tick (p95)                                        | 0.45 (1.7) | 5.8 (10.0)     | 1.4 (2.5)    | 0.9 (2.7)  |
| Phone context, mobile profile, 4× CPU throttle, ms/tick (p95) | 2.0 (2.8)  | 21.0 (34.4)    | 3.4 (6.6)    | 2.9 (10.0) |
| Desktop realtime frame, ms (mean)                             | 98         | 72             | 63           | 380        |
| Phone realtime frame, ms (mean)                               | 24         | 27             | 25           | 139        |

Dynamic ticks stay within the 10 ms per-frame tick budget in both profiles. Kinematic cost is dominated by the existing conservative vehicle-world sweeps while the car drives; a Node microbenchmark put the new motor at about 0.15 ms/tick. The new idle fast path halves the cost of idle kinematic rigs (1.3 → 0.6 ms/tick for four idle rigs in Node). Frame times are software-rendering bound (the door room renders real LDraw parts). None of these are phone-hardware measurements.

## Large real-parts models: renderer budgets (29 September 2026)

Stress fixture: `architecturalStressModel()` (`tests/helpers/architectural-stress.ts`, generated at test time, nothing large committed) — a four-floor village MPD of **20,000 official parts in 300 part/colour variants** (81 architectural parts: 1 × N bricks, plates, tiles, slopes, arches, windows, glass, doors and frames, fences, round parts, plants). `npm run test:stress` (`scripts/stress-benchmark.ts`) imports it and measures desktop (1440 × 1000) and a phone context (390 × 844, DPR 3, mobile profile). Software WebGL2 (SwiftShader) on the shared 4-core ARM64 VM: numbers are relative. "Frame CPU" is main-thread time to build and submit one orbit frame; SwiftShader rasterisation is not included. "Before" is this commit's code with only the caps lifted and every fix below disabled (the committed code refuses the model outright: 5,000 / 128 caps).

| Metric (20,000 parts, 300 variants)      |          Desktop before |           Desktop after |            Phone before |                              Phone after |
| ---------------------------------------- | ----------------------: | ----------------------: | ----------------------: | ---------------------------------------: |
| Import (parse, validate, commit)         |                   1.5 s |                   1.4 s |                   3.2 s |                                    1.7 s |
| Scene ready after import                 |                   7.4 s |                   3.1 s |                   7.2 s |                                    4.5 s |
| Time to first rendered frame             |                  11.7 s |                   4.9 s |                  13.3 s |                                    6.6 s |
| First frame (batch build) CPU            |                   2.8 s |                  0.45 s |                   2.9 s |                                   0.44 s |
| Unique geometry triangles                |                 194,395 |                  52,075 |                 194,395 |                                   52,075 |
| Renderer + GPU process RSS after load    |                1,689 MB |                  665 MB |                1,670 MB |                                   573 MB |
| JS heap after load                       |                  213 MB |                  204 MB |                  225 MB |                                   203 MB |
| Orbit frame CPU (median)                 |                 25.3 ms |                 19.9 ms |                 28.0 ms |                                  16.5 ms |
| Draw calls / triangles / lines per frame | 2,192 / 10.7 M / 10.1 M | 2,192 / 10.7 M / 10.1 M | 1,971 / 10.7 M / 10.1 M | 1,321 / 10.7 M / 6.6 M (reduced quality) |
| Enter Play                               |    16.4 s, **Fly only** |         3.0 s, **walk** |    15.6 s, **Fly only** |                          3.3 s, **walk** |
| Static collision triangles               |   over budget (≈10.7 M) |                 560,012 |             over budget |                                  560,012 |
| Play fixed tick (walking in)             |         1.4 ms (flying) |                  3.7 ms |         2.7 ms (flying) |                                   3.4 ms |
| Play frame CPU (median)                  |                  8.6 ms |                  8.8 ms |                  9.0 ms |                                   6.0 ms |

- **Merged lines were the main memory cost.** Edge and conditional lines were baked per occurrence into merged buffers (≈10 M segments, ≈1 GB of process memory). They are now instanced like meshes; the conditional-line shader moves endpoints, direction and control points with the instance matrix only when drawn instanced. The first frame no longer spends 2.8 s merging.
- **Compile cost.** Each part compile parsed all ~320 LDConfig colours; compiles now receive only the colours their source uses. Official parts compile once per part in a sentinel main colour and colour variants rebind materials (81 compiles instead of 300; unique geometry 3.7× smaller). Prototype preparation yields by elapsed time rather than every 128 occurrences.
- **Play.** The rendered surface (10.7 M triangles) was over the one-million-triangle collision budget, so the world was Fly only. Large worlds now collide with simplified official parts (studs and tubes omitted, then boxes for parts without doorways or arches) — 560,012 triangles here, walkable, reported in Play warnings. Entry also stopped recomputing every handle's world matrix and the whole occurrence list for each door rig request, and automatic-door holder search uses a spatial grid (entry 15.5 s → 3.0 s with the proxies alone in place).
- **Phones** above 4 M scene triangles draw without conditional lines at ≤ 1.5× pixel density while viewing (reported to the user; captures unchanged). Every part is still drawn.
- **Wall-clock frames** on SwiftShader are dominated by rasterising 10 M triangles and are not phone frame rates. At 6,000 parts (3.2 M triangles) the orbit frame interval was ~17 ms before and after, and a 6,000-part walking Play frame ~16 ms.
- **Tests.** `tests/unit/render-budget.test.ts` (profile budgets, boundaries and messages, fixture counts, collision proxies and boxes), `tests/unit/batching.test.ts` (instanced lines, merge fallback, conditional shader patch), `tests/browser/stress-model.spec.ts` (6,000 parts, 200 variants: every occurrence drawn on desktop and phone, walkable Play), `tests/browser/conformance.spec.ts` (769 variants refused on the phone profile with inventory intact, drawn completely after switching to desktop limits).
- **Not measured:** physical phones, real GPU frame times, transparent-part instancing (glass stays one draw per occurrence: 1,329 of the 2,192 draws).

**Supplied real-parts build (`santorini_v4_exterior.mpd`, user file, not committed).** 2,627 official parts in 62 submodels, 90 part/colour variants, 1,737,319 rendered triangles. Before: renders, but Play reports "Collision mesh exceeds one million triangles" and "No safe walk spawn was found" and falls back to Fly (`collisionReady: false`). After, on both desktop and phone profiles: all 2,627 parts drawn; Play enters in about 1.0–1.5 s with `collisionReady: true` and walking from a spawn outside the house, colliding with 477,549 simplified triangles (studs and underside tubes omitted). The facades stop the explorer, the auto-door at (−240, −150) opens with the contextual action and the explorer walks through it, and the curved garden stair is climbed to its top (407 LDU) with jumps. Without jumping the explorer stops at the garden edge (z ≈ −408), and the 32 LDU stair risers exceed its 8 LDU autostep; that is the existing Play profile, not the collision change.

## Complete-library connectors, mappings, catalogue release and update path (2026-09-29)

- `npm test`: **98 files, 502 tests pass** after the change, including the new `full-connectors.test.ts` (hand-checked derivations of 3065, 3068a, 60614 and 3854; reasons for 4600, 3644 and 2335; curated agreement; pack validation with sample re-derivation; registry, snapping a non-catalogue brick onto a catalogue brick and connectivity), `marketplace-mappings.test.ts` (keyword rules, exclusions, ambiguity, the shipped table re-derived from the pinned library, hash pinning, reviewed mappings for the new and formerly unmapped parts, derived mappings blocked until accepted, never lent to project definitions, roadster lots) and `library-update.test.ts` (a synthetic pair of official-format archives: new release, connector pack, locks, retired lock with exactly the affected files, removal of the old pack, re-pinning decisions, no-op on the same archive, refused reused ID).
- `npm run library:validate`: 650 files and 224 catalogue parts; retired locks `starter-2026-09-27` and `catalogue-2026-09-28` (every file byte-identical), retired mapping packs `curated-starter-1` and `curated-catalogue-2`, the derived mapping table's hash, the complete pack, and the complete-library connector pack (24,735 entries, 5,168 verified, 256 shards, sample re-derivations).
- `npm run build` and `npm run deploy:check`: 4,925 files in `dist` (limit 20,000), largest file 7.9 MB (limit 25 MiB). The derived mapping table is a separate 230 kB chunk loaded only by inventories.
- Browser (Playwright, production bundle, SwiftShader): **164 of 168 passed** in the full run on a machine shared with other jobs (load average about 15 on 4 cores). Of the four failures, one was real and fixed (an offline inventory could not load the lazily loaded derived table; it is now loaded only when a part lacks a reviewed mapping and tolerated offline) and its test passes on rerun; `editor.spec.ts` 200-part fill and `fill-set.spec.ts` at 1440 px timed out under load and pass on rerun; `play-avatar-motion.spec.ts` third-person walk times out at its two-minute limit under this load and passes with a longer limit (3.2 min). New: `full-library-connectors.spec.ts` (a non-catalogue brick snaps onto a 2 × 4 brick and connects, its shard loaded once and verified; castle and roadster health compare every part by derived shape and label the remaining nesting as unmodelled connections; the roadster's parts export as reviewed lots).
- Full-library derivation run: 24,735 parts in 596 s on 4 worker threads (machine shared).

## Complete-library thumbnails and picker (2026-09-29)

- `npm run library:validate` now also checks the thumbnail atlas: index hash and size against `part-thumbnails-lock.json`, every sheet's hash, size and WebP dimensions, one cell for each of the 23,343 placeable parts (none unrendered), no stray files. Re-packing from the render cache gives the same index hash.
- Unit (`tests/unit/part-thumbnails.test.ts`): atlas lock and validation, one cell per part (curated parts and redirects excluded, duplicates rejected), mask sheets matching their image sheets, CSS sprite percentages, print-variant grouping (including a moved-to base) and result folding, category listing and browsing.
- Browser (`tests/browser/part-thumbnails.spec.ts`): category browsing with lazy pages and real atlas thumbnails (only sheets near the screen fetched, each once); the 973 torso card folds its prints behind **+N** and a printed cell uses a separate tint mask; thumbnails follow the held colour and Clear shows curated and complete-library parts as glass; thumbnails seen once show offline after reload with the service worker installed. `full-library.spec.ts` now expects the dome's own rendering; `hud-layout.spec.ts` checks the Parts sheet browsing every LDraw part at 360 × 600 and 411 × 685.
- Full run on this VM: 511 unit tests, 172 browser tests passed; `deploy:check` 5,652 files, largest 7.9 MB.

## Frame cost on large real-parts models (29 September 2026)

Same 20,000-part, 300-variant stress village and `npm run test:stress` (see above), extended with a pointer drag, twelve picks, instruction steps (the first 90% of parts shown with the last 10% new and the rest dimmed, then 95%/5%, then the whole model), floor focus with ghosting below, and Play walking in the Standard and Realistic looks (`--play-frames 8`). Mechanisms: [rendering](RENDERING.md#frame-cost-on-large-models). "Before" is the parent commit's build; both builds were measured on the shared 4-core VM while other jobs kept its load average near 11, so CPU milliseconds vary by up to 3× between runs of the same build (the parent build's desktop orbit frame measured 21 ms in one run and 63 ms in another). Counts (draws, triangles, lines) are exact and the reliable comparison. A step "call" is the synchronous adapter call; "frame" is the CPU time of the next drawn frame.

| Metric (20,000 parts)                      |                       Desktop before |                  Desktop after |                          Phone before |                    Phone after |
| ------------------------------------------ | -----------------------------------: | -----------------------------: | ------------------------------------: | -----------------------------: |
| Draw calls, still whole-model view         |                                2,192 |                            893 |                                 1,321 |                            601 |
| Draws / lines while dragging the view      |                       2,192 / 10.1 M |          301 / 202 (grid only) |                         1,349 / 6.6 M |          301 / 202 (grid only) |
| Pixel ratio while dragging / at rest       |                                1 / 1 |                          1 / 1 |                             1.5 / 1.5 |                     1.25 / 1.5 |
| Frame CPU, still view (median)             |                             21–63 ms |                          12 ms |                                 34 ms |                         8.5 ms |
| Frame CPU while dragging (median)          |                             23–59 ms |                          13 ms |                                 30 ms |                         5.6 ms |
| Pick latency (median of 12)                |                             83–87 ms |                       23–28 ms |                                 78 ms |                          20 ms |
| Instruction step: draws                    |                      48,468 / 54,249 |                  1,767 / 1,704 |                       27,107 / 30,269 |                  1,183 / 1,127 |
| Instruction step: call + frame             | 76 + 2,103 ms, then 2,384 + 1,579 ms | 59 + 187 ms, then 64 + 160 ms¹ | 171 + 1,237 ms, then 1,014 + 1,807 ms |  97 + 138 ms, then 77 + 122 ms |
| Leave instructions: call + frame           |                       2,825 + 447 ms |                   160 + 162 ms |                        1,255 + 458 ms |                   259 + 104 ms |
| Floor focus (middle floor, ghost below)    |           25,098 draws, 395 + 983 ms |       1,785 draws, 317 + 87 ms |            14,125 draws, 296 + 481 ms |      1,201 draws, 396 + 111 ms |
| Floor focus (top floor) / clear            |   40,196 draws; clear 2,016 + 392 ms | 1,785 draws; clear 100 + 92 ms |      22,521 draws; clear 640 + 368 ms | 1,201 draws; clear 200 + 56 ms |
| Play walking, Standard: draws / lines      |                         821 / 10.0 M |                        299 / 0 |                 page crashed in Play² |                        299 / 0 |
| Play walking, Standard: frame interval     |                                 53 s |                          30 ms |                                     – |                          18 s³ |
| Play walking, Realistic: draws / triangles |                       1,023 / 19.9 M |                   300 / 10.6 M |                                     – |                   278 / 10.2 M |
| Unique vertices (indexed part geometry)    |                              156,225 |   54,229 (indexed in 55–74 ms) |                               156,225 |              54,229 (60–96 ms) |
| JS heap after load                         |                               204 MB |                         216 MB |                                203 MB |                         216 MB |

¹ New1 run; the second run's "next step" frame took 30 s once (a single stall of the whole VM; its other frames were 160–190 ms). ² The parent build's phone page crashed during Play after the step and floor measurements; its phone column is from a run without Play. ³ SwiftShader rasterises 10 M triangles per frame at the phone's pixel density; wall time is not a phone frame rate.

- **Draws.** Glass and other transparent parts are instanced (1,329 single draws on desktop become part of 893). A dimmed instruction step or a ghosted floor adds one draw per bucket and treatment instead of one per drawable (48,468 → 1,767). Steps, floor focus, layer ghosting, explode and section changes refill the existing instance arrays (`batches.structures` stays constant; `fills` counts refills) instead of rebuilding every batch, so their call time dropped from seconds to tens of milliseconds.
- **Moving views.** Both profiles exceed `motionReductionTriangles` (10.7 M scene triangles), so a drag draws only the meshes (plus the editor grid) and the phone drops to 1.25× density; the still frame 180 ms later redraws edges at the normal density. Captures are unchanged.
- **Play.** Every Play frame moves, so edges are left out while walking. The Realistic look no longer re-renders its shadow map for camera-only frames: the shadow pass, which doubled the triangles, now runs only when the scene (a mechanism pose) changes (`look.spec.ts` checks `shadowPasses` stays constant while flying).
- **Geometry indexing** merges bit-identical corners of each compiled part once (2.9× fewer vertices here). It adds 55–96 ms to the first load of these 81 parts; unit tests check the indexed triangles, normals and groups are exactly the originals.
- **Heap** grows about 12 MB: every drawable keeps a slot, and each bucket's draws reserve instance space for all its occurrences so refills never reallocate.
- **Spatial cells** (`?batchCells=640`) were not enabled: this village spans about 2,000 LDU per floor, so 640 LDU cells would multiply the 893 whole-view draws several times over for a culling gain only in close views.
- **Tests.** `tests/unit/batching.test.ts` (in-place refills for visibility, treatments and transforms; transparent instancing; section culling; cells; line suppression without refill), `tests/unit/geometry-index.test.ts`, `tests/browser/stress-model.spec.ts` (explode and section without rebuilds on 6,000 parts; phone drag drops edges and density and restores them), `tests/browser/look.spec.ts` (Play shadow cache).
- **Not measured:** physical phones and real GPU vertex throughput (the benefit of indexing and of dropping edges is GPU-side), transparent sorting artefacts on real glass-heavy builds (instances of one bucket share a material, so their blend order does not change the colour).

## Model loading: compile off the main thread (29 September 2026)

Method: `.local` Playwright harness on the production bundle (SwiftShader, 1440 × 1000; "mobile" is the phone resource profile at 390 × 844), `PerformanceObserver('longtask')` on the main thread, CPU profiles from the DevTools protocol on an unminified build. Each template was opened from an empty scene; "reopen" is the same template after a page reload (persistent cache for the new code, a full recompile for the old). The VM is shared with other agents' browser runs (load average 10–15 on 4 cores), so wall-clock times vary by ±50%; long-task totals and compile counts are the stable signals. "Before" is `main` at a0448f4.

**Where the house's time went (before).** A CPU profile of opening the house: 14.2 s on the main thread, of which **10.8 s in the loader's `smoothNormals()`** (95% of part compilation, most of it for the 32 × 32 baseplate `3811.dat`), 0.2 s other parsing/geometry, 0.26 s the first frame (shader compilation), 0.1 s React, 0.37 s garbage collection. The UI's post-load work (health, connectors, bounds) did not register. `smoothNormals()` restarted a `for…in` over a plain object after deleting each half-edge, which is quadratic. For the 20,000-part stress model the main-thread costs were instead cloning 20,000 occurrence handles (2.2 s), React re-deriving all occurrences in the workspace on every render (1.4 s), document replacement and validation plus autosave copies (1.6 s), batch building (0.75 s) and part compilation (0.76 s).

| Main thread, desktop profile             | Before: ready / first frame / longest task / long-task total | After                                              |
| ---------------------------------------- | ------------------------------------------------------------ | -------------------------------------------------- |
| House (281 parts), first open            | 17.4–18.0 s / 17.3–17.8 s / **16.1–16.5 s** / 17.2–17.6 s    | 2.8–3.7 s / 0.8 s / **1.3–1.5 s** / 1.7–1.9 s      |
| House, reopen after reload               | 16.3–18.1 s / 16.1–18.0 s / 15.3–17.2 s / 15.9–17.9 s        | 0.55–0.71 s / 0.44–0.61 s / 0.12–0.15 s / 0.2 s    |
| Castle (235), after the house            | 0.74–0.80 s / 0.68–0.76 s / 0.37–0.47 s / 0.5–0.7 s          | 0.47–0.56 s / 0.7–3.0 s¹ / 0.08–0.1 s / 0.1–0.25 s |
| Roadster (52), after the castle          | 0.45–0.55 s / 0.42–0.48 s / 0.33 s / 0.33 s                  | 0.35–0.62 s / 0.29–0.31 s / 0–0.05 s / 0–0.05 s    |
| 20,000-part stress village, first import | 9.1–9.9 s / 9.1–9.9 s / 1.5–1.7 s / 7.4–8.1 s                | 9.3–10.1 s / **5.7–5.9 s** / 1.0–1.2 s / 5.2–5.3 s |

| Main thread, phone profile   | Before                            | After                             |
| ---------------------------- | --------------------------------- | --------------------------------- |
| House, first open            | 13.2 s / 13.1 s / 12.0 s / 13.0 s | 3.0 s / 0.67 s / 0.18 s / 0.31 s  |
| House, reopen after reload   | 15.7 s / 15.7 s / 14.9 s / 15.6 s | 0.45 s / 0.40 s / 0.09 s / 0.09 s |
| Stress village, first import | 11.2 s / 11.1 s / 1.8 s / 9.3 s   | 8.9 s / 4.9 s / 0.78 s / 4.3 s    |

¹ Frames wait for the shared GPU process; the main thread was idle.

- **Steps and their effect** (house, first open, desktop): linear `smoothNormals()` in the vendored loader alone: ready 12.5 s → 2.1 s, longest task 11.6 s → 1.3 s. Compile workers (off the main thread): longest task → 0.2–0.3 s when the VM is quiet; the longest task left is the first frame's synchronous shader compilation (0.3–1.3 s on SwiftShader), not loading. Progressive drawing: first frame 2.6–3.1 s → 0.5–0.8 s. Persistent cache: reopening after a reload 12–18 s → 0.45–0.7 s with no compile at all (43 records, 12.3 MB for the house; 15.2 MB for all three templates).
- **Stress model** (steps on top of the compile workers): workspace occurrences derived once per project instead of per render, and passed to the rig and layer panels (React time 5.3 s → about 0.9 s during a progressive load); the renderer and autosave take the subscriber's own project copy instead of deep-copying it again (about 0.4 s each at 20,000 parts); handles clone without the throwaway default geometry/material Three's `clone()` allocates, and without JSON-copying unused loader metadata (clone time 2.2 s → 1.3 s); progressive redraws are spaced by their measured cost and gated by a WebGL fence. First frame ~40% sooner, long-task total down 30–55%; total time is unchanged because the remaining costs (document validation and first workspace derivation, autosave serialization, batch building) sit outside the compile path.
- **JS heap** after a load: unchanged for templates (15–18 MB); stress 187–194 MB (215 MB before).
- **Correctness.** The vendored loader matches the pinned upstream loader bit for bit on five parts (positions, normals, conditional-line controls, groups, material codes); worker records rebuild exactly what a main-thread compile builds; batching, BFC, conformance, look, raw-geometry, full-library (including offline reload and tamper rejection) and resource-profile specs pass unchanged; strict render still refuses unresolved parts. `tests/browser/load-performance.spec.ts` asserts that the house compiles in workers, is drawn before it is ready, shows the progress bar, splits its work into many tasks, and after a reload is served entirely from the cache and drawn completely; a corrupted cache entry is detected by its hash and recompiled.
- **Startup recovery of a large autosaved project** (reload with the project as this device's current one; production bundle; `.local` harness and `tests/browser/startup-recovery.spec.ts`). Before, the main thread read the saved copy back (hash, JSON parse, schema and source validation), replaced the document (validation and a deep copy again), derived every occurrence for the first workspace render, compiled parts and cloned handles in tasks of up to about 2 s. The saved copy is now verified in a worker (`src/workers/project-restore.worker.ts`) and handed to the editor as trusted (no second validation or deep copy); occurrence expansion is about 2.5× faster (resource checks build their error only on failure; the transform product is unrolled, same arithmetic); compile and placement use the paths above.

  | Recovery after reload (desktop) | Before: longest task / long-task total / mode-switch click answered in | After                                |
  | ------------------------------- | ---------------------------------------------------------------------- | ------------------------------------ |
  | 20,000-part village             | 1.2–1.9 s / 6.6–11.7 s / 5.3–9.9 s                                     | 0.45–0.68 s / 3.0–5.8 s / 2.5–2.7 s  |
  | 2,600-part real-parts build     | 1.1–1.2 s / 2.5–2.8 s / 3.8–4.8 s                                      | 0.17–0.19 s / 0.85–1.1 s / 1.4–1.9 s |

  In the browser test the mode switch is answered before the 20,000 parts finish loading and the longest task stays under the test's 1.5 s bound (0.42–0.99 s over five runs on the loaded VM; 1.1–2.0 s before). The user's Santorini file is not committed; the 2,600-part build is `architecturalStressModel({ parts: 2600 })`.

- **Complete-library closure after a large import** (found by the thumbnail work). Importing about 250 complete-library parts and then `10715.dat` failed strict readiness with "Unresolved dependency: 2313b.dat"; a fresh page rendered it. A chunk holds many files, so 10715.dat had arrived as a neighbour of another part and counted as loaded although none of its dependencies were. A part is now a root until its whole closure is loaded. Regression: `tests/unit/full-library.test.ts` ("loads the dependencies of a part first loaded only as a chunk neighbour"; fails without the fix) and the browser reproduction above now renders strictly.
- **Full run after rebasing onto the frame-cost work** (records are stored with the renderer's triangle indexing applied in the worker): `npm run format:check` clean, 536 unit tests and 176 browser tests passed.
- **Not measured:** physical phones and hardware GPUs (shader compilation is much faster there), cache behaviour under real storage pressure (the quota path is unit-tested only).

## LDraw minifig Play figure and notched phones (29 September 2026)

Software WebGL2 (SwiftShader) on the shared Linux ARM64 VM. `npm run format:check`, `npm test` (103 files, 541 tests), `npm run library:validate` (including the figure pack), `npm run deploy:check` and the full Playwright suite (179 tests, one worker, built preview) pass. The figure compiles from its pack in about 0.2 s in Node; in the browser it loads with one manifest and one bundle request while Play collects collision. The supplied Santorini v4 file (user file, not committed): all three ground-floor doors open and the minifig walks through each, in and back out.

## Lighter handles, prepared frames and adaptive culling (30 September 2026)

Same 20,000-part, 300-variant stress village and `npm run test:stress` (desktop profile, 1440 × 1000, SwiftShader), now also recording main-thread long tasks from the import to the first full frame, a recovery in a second tab of the same context (the imported project as this device's current one, long tasks until every part is drawn), and a first-person Play walk from the middle of the village. "Before" is the parent commit's production build (db9b43b), "after" this commit; before and the first after run were measured concurrently, so both saw the same machine load (load average 18–25 on 4 cores from other jobs), and two further after runs were taken later at a similar load. CPU milliseconds vary severalfold between runs on this VM; heap, draw and triangle counts are the stable comparison. Mechanisms: [rendering](RENDERING.md#frame-cost-on-large-models), [architecture](ARCHITECTURE.md#adr-009--off-main-thread-part-compilation-and-the-geometry-cache).

| 20,000 parts, desktop profile                               | Before                          | After (three runs)                               |
| ----------------------------------------------------------- | ------------------------------- | ------------------------------------------------ |
| JS heap after load / after Play                             | 193 MB / 214 MB                 | 59–77 MB / 80–85 MB                              |
| Renderer + GPU process RSS after load                       | 663 MB                          | 541–658 MB                                       |
| Import → first full frame: longest task / long-task total   | 9,138 ms / 15,091 ms (21 tasks) | 1,156 / 5,118 ms; 502 / 2,636 ms; 346 / 1,440 ms |
| Recovery in a new tab: longest task / long-task total       | 4,725 ms / 12,440 ms (37 tasks) | 450 / 3,070 ms; 442 / 2,385 ms; 235 / 1,618 ms   |
| JS heap after recovery                                      | 189 MB                          | 62–80 MB                                         |
| Pick (12 picks, median / max)                               | 31.6 / 179 ms                   | 8.1–16.9 / 37–45 ms                              |
| Whole-model orbit: draws / triangles                        | 893 / 10.70 M                   | 893 / 10.70 M (unchanged)                        |
| Play walking into the village, Standard: draws / triangles  | 883 / 10.63 M                   | 867 / 8.67 M (cells on)                          |
| Play walking into the village, Realistic: draws / triangles | 285 / 10.31 M                   | 261 / 8.18 M (cells on)                          |
| Editor camera at eye level in the middle of the village     | 893 / 10.70 M                   | 1,136 / 9.27 M (cells on)                        |
| Editor camera at the edge looking across / from the street  | 893 / 10.70 M                   | 893 / 10.70 M (cells stay off)                   |

- **Where the long tasks went** (CPU profiles of an unminified build, same import and recovery, `.local` harness). With record handles alone, import was 17 long tasks, longest 1.38 s: the first frame classified and filled 20,000 handles' batches and then blocked on linking every new shader program (`getProgramInfoLog`), and the first `renderer.compile()` of the whole scene spent 0.7 s building program parameters for every draw. Recovery: 16 tasks, longest 1.13 s. After the remaining steps (deferred rebuild, classification, fill and program warm-up in tasks of their own with frames held; one representative drawable per program input; a fence before the first status query; draw objects reused across rebuilds; the save worker; worker-validated imports; no per-commit deep copy; coalesced library re-derivations) import is 17 tasks, longest 329 ms, 2.7 s in all, and recovery 13 tasks, longest 207 ms, 1.8 s in all. What remains: the workspace's occurrence derivation (120–320 ms, once per project and per complete-library burst), the renderer's own occurrence walk (~280 ms), the structured clone of the project arriving from the import worker (~240 ms) and posted to the save worker (~110 ms), complete-library registration and batch classification/fill (~220 ms each).
- **Heap.** A handle was a cloned tree of five Object3Ds (about 6–10 KB); it is now a record (ID, prototype, matrix, visibility, treatments). The rest of the 60–80 MB is the batches' slots and instance buffers, prototypes and the document.
- **Culling.** Cells go on only when at least half of the split buckets' triangles are outside the view. Walking into the village in Play draws 18–21 % fewer triangles; an editor camera inside the village 13 % fewer for 27 % more draws; whole-model and street views are unchanged. An earlier, finer setting (cells for every bucket over 16,384 triangles, no cap) culled more — 5.44 M instead of 10.63 M triangles in the Play walk, 6.84 M in the middle of the village — but split the 892 buckets into 10,697 cell groups (3,279 draws inside); the committed setting caps them at 1,024 groups, heaviest buckets first. Ghosted and dimmed views never use cells.
- **Pre-existing stall.** On this VM one frame after a second instruction step can wait minutes for the GPU process (470 s before, 104 s after, same draw counts); it is SwiftShader working through the queued frames, not main-thread work.
- **Tests.** `tests/unit/occurrence-handles.test.ts` (templates match a clone's world matrices and `setFromObject` bounds, materialized trees follow matrix, visibility, edge mode and treatments, selection boxes match `BoxHelper`), `tests/unit/batching.test.ts` (record-based batching, adaptive cells switched by refills without rebuilding, `culledShare`), the updated ghosting/dimming/capture unit tests, and `tests/browser/stress-model.spec.ts` (6,000 parts: no Object3D tree per handle, cells off for the fitted view, on at eye level inside the village with fewer triangles drawn and every occurrence still filled, off again on fit, no rebuilds).
- **Runs.** `npm run format:check`, `npm test` (114 files, 656 tests) and the full Playwright suite on the built preview (210 tests, one worker): 209 passed; the one failure (storage: a page without Web Locks or IndexedDB must report saving as unavailable, but the save worker still had both) was fixed by letting the page's own coordination decide, and the storage, stress-model, batching, selection, startup-recovery, load-performance, look, instruction-dimming, floors, layers, section, explode, Play view isolation, mechanisms, transform, textures and indexed-projects specs were run again on the final build (49 tests, all passed).
- **Not measured:** phones and hardware GPUs (whether 13–21 % fewer triangles repays extra draws there), `KHR_parallel_shader_compile` (SwiftShader does not expose it; the warm-up then waits behind a fence).

## Hidden-geometry culling and the plain-brick city (30 September 2026)

Minebench study, design and full measurements: [PERFORMANCE-MINEBENCH.md](PERFORMANCE-MINEBENCH.md). `npm run test:stress -- --model city --parts N` runs the plain-brick city (`tests/helpers/brick-city.ts`); `--query hiddenCull=0` measures without culling.

- **24,320-part city, desktop:** 10.28 M → 1.53 M triangles and 10.05 M → 1.43 M line segments drawn in a whole-model orbit, 88 → 112 draws, heap 38 → 45 MB. Phone profile: 6.5–7.1 M → 1.28–1.45 M triangles, and the model no longer triggers the reduced phone quality.
- **150,480-part city, desktop (raised occurrence limit):** refused before (63.6 M scene triangles over the 60 M budget); now 17.4 M counted, 9.48 M drawn in 115 draws, 8.4–11 ms frame CPU, 162–164 MB heap. The 147,440-part phone run needs the proposed limits (see there).
- **20,000-part village, desktop:** 10.70 M → 7.84 M triangles, 893 → 942 draws.
- **Tests:** `tests/unit/hidden-geometry.test.ts` (classification and variants of real compiled parts), `tests/unit/occlusion.test.ts` (connector and grid decisions, transparency, lattice, a 150,000-part wall), `tests/unit/hidden-batching.test.ts` (plain view by eye side, fallback when a neighbour is hidden, ghosted, moved or cut, selection sources, variant pruning), `tests/browser/hidden-geometry.spec.ts` (phone profile budget and section fallback; culled and full captures agree; picking unchanged).

## Part budgets and agent workspaces (1 October 2026)

- **Before:** `limits.maxParts` counted parts as the compiler made them, so a component's parts counted once however often it was instanced: Santorini (4,098 parts, 30 houses from three components) compiled and was written under `limits.maxParts: 4097`. A build over the limit stopped at the first extra part with `Build exceeds N parts` and no total.
- **After:** the budget is checked on the finished build. Santorini under `--max-parts 300` reports `4,098 parts: 3,798 over the budget of 300 (largest sections: Houses 1,950, Terraces 1,394, Ground and sea 342; costliest ops: sections[2].ops[0].ops[1] 225, …)`; the costliest ops are house instances counted at their full 225 parts. The CLI exits 2, writes only the report, removes the House model an earlier run left at `--output`, and renders no views. `buildScript.apply({maxParts})` returns `applied: false` and leaves the document alone.
- **Workspaces:** `npm run workspace -- --max-parts 300,1000 --brief "…"` made two folders outside the repository; in the 300-part one, `./brick-cli build` compiled the House (263 parts) and refused Santorini as above, and `./brick-cli build … --max-parts 99999` was refused as a duplicate flag.
- **Tests:** `tests/unit/build-script.test.ts` (excess and costliest op, the lower of option and script limit, component instances counted per copy), `tests/unit/build-workspace.test.ts` (prompt filled in, `$&` in a brief kept, workspace section placed before Output, wrapper quoting, folder names, refusing a non-empty folder or one inside the repository), `tests/integration/build-cli.test.ts` (report only, exit 2, stale model removed, invalid `--max-parts`), `tests/browser/build-script.spec.ts` (over-budget `apply` not applied). `npx tsc -b`, `npm run format:check`, `npm test` (139 files, 855 tests, before the CLI budget test was added; the CLI file again after: 5 passed) and the build-script browser spec (2 passed) on the built preview.

## Part targets with leeway (1 October 2026)

`--max-parts` became `--target-parts N --leeway P` (default 10%); outside the range a build is refused either way.

- **Workspace, target 2,000 ± 5%:** the prompt says `Target: 2,000 parts`, `Accepted range: 1,900–2,100 parts.`; `./brick-cli build` refused the House with `under-budget: 263 parts: 1,637 under the minimum of 1,900 (target 2,000 ± 5%: 1,900–2,100): add more` and Santorini with `over-budget: 4,098 parts: 1,998 over the maximum of 2,100 (…)`, writing no model either time.
- **Tests:** `tests/unit/build-script.test.ts` (over and under, both ends of the range inside, other leeways, `limits.maxParts` still a hard cap, invalid target and leeway, range rounding such as 3,000 → 2,700–3,300), `tests/unit/build-workspace.test.ts`, `tests/integration/build-cli.test.ts` (over and under: report only, exit 2, earlier model removed; `--leeway` without a target refused) and `tests/browser/build-script.spec.ts` (`apply` refuses over and under). `npx tsc -b`, `npm run format:check`, `npm test` (139 files: 856 of 857 passed; `cli-headless.test.ts` timed out at load average 13–14 and passed alone) and the build-script browser spec (2 passed) on the built preview.

## One-shot runs (2 October 2026)

- **No tools.** `codex exec` with the runner's flags (every tool feature off, read-only sandbox, empty folder, user config ignored) answered "NO TOOLS" when asked to run `ls /`, and its event log had no command items. None of the temple runs recorded a tool event.
- **Temple sample** ([docs/samples/japanese-temple-one-shot](samples/japanese-temple-one-shot/README.md)): GPT-6.1-Sol at low, medium, high, xhigh and max, target 2,000 ± 5%, 5 attempts. All five were accepted in range (1,954–1,985 parts) after 2–4 attempts; every first reply was refused (over or under the range and/or overlaps), and the repair prompt fixed each. The max build recompiles from the committed script to the same 1,985 parts.
- **Sandbox-safe renders.** A render from a workspace inside Codex's `workspace-write` sandbox failed with `EROFS` on `node_modules/.vite-temp`; with Vite's runner config loader and a temp cache the render wrote its PNG and left the checkout untouched.
- **Tests:** `tests/unit/one-shot-build.test.ts` (prompt without tools, JSON extraction with fences, prose and braces in strings, repair prompt), `tests/integration/build-cli.test.ts` and `tests/integration/cli-headless.test.ts` (renders, after the Vite change), `npx tsc -b`, `npm run format:check`.

## Parts list, colour errors and search in one-shot runs (2 October 2026)

- **Compiler.** All seven committed build scripts compile cleanly with colour errors on; the five first-run temples now fail on 1–4 colours each (e.g. pearl-gold Round Brick 2 × 2, dark-brown lattice fences). `4032` and `4073` compile as `4032a` and `6141` with a `part-moved` note.
- **Search protocol.** A forced smoke run asked for two searches in one reply, got the results in the same Codex session (`codex exec resume`) and then answered; no tool events. A native Codex tool was tried first: custom (MCP) tools only appear with Codex's code mode, which also exposes a JavaScript runner, and `codex exec` refused the call for want of approval.
- **Temple rerun** ([sample](samples/japanese-temple-one-shot-search/README.md)): low, medium, high and max accepted (1,918–2,009 parts, 3–5 attempts); xhigh not accepted after 5 attempts (2 overlaps left). Only one colour error in 20 replies; the final scripts name only listed parts. The first xhigh and max runs died on "Selected model is at capacity"; with retries the reruns each waited out one such error.
- **Tests:** `tests/unit/build-script.test.ts` (colour errors with suggestions, moved parts by number and by `find`), `tests/unit/one-shot-build.test.ts` (part list and search section in the prompt, search requests, agent search results, part knowledge), `tests/unit/build-workspace.test.ts` (part list in workspace prompts).

## Four-round heuristic instruction refinement (1 October 2026)

The feature was rebased onto `main` at `3ac466d`, including its new instruction viewer and renderer. Four sequential implementation/evaluation/independent-critic cycles are recorded in [the refinement report](reports/instruction-generation/refinement-rounds.md); v1 baseline evidence remains separately labelled.

- Production build passes with regenerated schemas/validators, TypeScript and Vite. The existing large-chunk warning remains.
- Final full unit/integration suite: **877 tests pass in 143 files**, with two workers and unchanged timeout settings. This includes headless CLI checks; the earlier integrated full run also passed all 876 then-present tests.
- All 47 relevant unit checks pass after the final camera/replay/publication changes. Coverage includes prior-state prerequisites, whole drawing ownership, candidate contraction cycles, actual programme visibility, zero-part joins, source removal/edit flattening and numerical camera projection against three.js.
- Nineteen relevant browser checks pass across production generation, editing, dimming, actual PNG/HTML/PDF publication, cancellation, follow-along viewer and parts list: the final generation/viewer/publication rerun passes all 14 checks; five editing/dimming checks passed on the earlier integrated build. A provisional join test used the wrong close label, then incorrectly treated capture `visibility: current` as a viewport mask; both test mistakes were corrected. The final test checks actual handle visibility and passes. No timeout settings were loosened.
- Layout checks cover 1440×1000, 1080×1800, 360×600, 411×685, 390×844 and 686×411. Join buttons, workbench builds and zero-part joins were present; no horizontal page overflow and measured action buttons at least 44 px high. Saved camera framing was repaired after actual phone cropping was found. Representative screenshots and measurements (local artifact).
- Pinned-library validation passes: 650 files, 224 curated parts, dependency closure, licences, thumbnails and locks/hashes. Formatting and `git diff --check` pass. The additional user report retains SHA-256 `4f9bb6bddd99d93ecd779b1d18440e078805e3973ff96e68a734211c7a39f8a2`.
- All 12 samples and eight varied OMR sets were evaluated. Seventeen plans preserve source hashes/poses and introduce each source occurrence exactly once; three oversized samples retain their explicit generation refusal. All 17 final plans remained identical after rebase. Final review includes 204 fresh selected actual views across nine samples and seven renderable official sets, covering all eight accepted workbench candidates. No prior main image was reused. The first renderer process ended with signal 15 after Hut; Galaxy's strict colour refusal and Shark's final 17 views were rerun separately, and all sixteen sheets completed.
- Real v5 CLI publications were opened and inspected: car PDF (24 steps/32 pages), original workbench demonstration PDF (five steps/seven pages, join introduces zero parts), and Police Truck HTML ZIP (34 steps/86 inventory units). The critic independently viewed selected PDF pages and opened HTML steps 2/20, with all 120 image elements loading. Exports and attribution (local artifact).

Software environment: Node 22.14.0, Linux ARM64, Chromium/SwiftShader. These checks establish software replay, source preservation and sampled diagram usability. They do not establish a physical build, safe insertion, detached stability, handling or hobbyist success. The [final critic](reports/instruction-generation/round-4-critic.md) retains cafe/Hut access failures and major reconstruction requirements for Technic, London and Shark. London/Hut still exceed 200 publication steps; Galaxy still refuses strict rendering for unresolved body colours.

## Two additional instruction rounds (1 October 2026)

The separately reviewed v6/v7 refinements and source-preserved results are recorded in [rounds 5–6](reports/instruction-generation/refinement-rounds.md). The round-5 critic inspected 256 selected actual states across sixteen galleries. Round 6 adds 35 fresh Technic states, covering all eighteen axial operations and neighboring states, and retains 236 unchanged reviewed states. Sixteen of seventeen plans compare identically after generation metadata is removed. All seventeen preserve the source hashes and unique introduced occurrence sets. The same three oversized inputs are refused; Galaxy's strict unresolved-colour rendering refusal remains.

The complete local unit/integration run passed 894 of 895 tests across 145 files; the single headless complete-library CLI startup timed out at its unchanged 60-second budget under concurrent rendering. Its isolated rerun passes all three tests in that file. This is full test coverage plus a successful isolated rerun, not a claim of a completely clean first run. The first oversized-output attempt terminated before finishing and supplies no completed test result. Production build/schema generation/type checking pass, with the existing chunk-size warning.

The first production generation/viewer browser run passed eleven checks and caught a real editor regression: its physical inventory tray predicate only recognized v4/v5, so the v6/v7 flexible drawing tray was empty. The predicate now includes v6/v7. The 65 relevant unit tests pass across eleven files. Six final layout sizes pass with actual generated axial notes selected, no horizontal overflow and measured viewer actions at least 44 px high. The first private layout check mistakenly selected imported source STEP instructions; it was corrected to select the generated plan and repeated. Screenshots and measurements (local artifact). Final production rebuild and all **19 relevant browser checks pass** across generation, editing, dimming, viewer, actual PNG/HTML/PDF publication and cancellation. The repaired whole flexible-part tray passes. Pinned-library validation, formatting and diff checks pass.

Actual three-part CLI HTML and PDF examples retain complete coverage, three singleton steps, unknown axis feasibility and assembly validation false. The critic opened the HTML steps and all seven PDF pages. Captions initially split a normal word across a page boundary; word-aware wrapping repairs that, while long captions still create two sparse continuation pages. Concurrent dev-server dependency optimization initially broke PDF lazy loading; the serial warmed retry succeeds. No timeout or output limit was relaxed. Export evidence (local artifact).

These software and sampled diagram checks do not establish fitted insertion, detached support, mechanism usability or a successful physical hobbyist build. Cafe improves 2→3/5; all nine supported samples are editable 3/5 drafts, while Technic/London/Shark remain 1/5. The additional supplied research report remains verbatim.

## Straight CAD approach checker (1 October 2026)

V8 passed an integrated local run of 904 unit/integration/CLI tests, followed by 46 focused tests including a tenth collision test for the final numerical-domain repair. All19 relevant production-browser checks passed; the5 generation/publication cases were repeated after wording changes. Build/schema/typecheck, pinned library validation and formatting pass. Independent review covers270 actual selected states across16 renderable models and retains unchanged usability scores. Final six-size viewer/editor captures show visible CAD badges, no horizontal overflow and44px navigation targets; short landscape trays remain scrollable. Real two-part clear and three-part axial crossing PDF/HTML exports preserve coverage and honest CAD scope. See [evidence and limitations](reports/instruction-generation/collision-checks.md). Final-commit CI is linked from the PR.

## Wheel operation and worker continuation (1 October 2026)

V9 passes51 targeted tests across nine files, covering locked source families, unique rim/tyre/host matching, exact replay/inventory, worker handoff and stale-result rejection, collision/axial retention, structural editing and camera projection. Production build, regenerated schema/typecheck, formatting and pinned-library validation pass. The final production wheel browser regression checks the actual source pin against the actual presentation camera at360×600 and686×411, outside opaque editor/viewer panels. The worker responsiveness test counts frames only while the actual worker is active and verifies cancellation installs no draft.

All17 regenerated plans preserve source hashes and exact unique leaf introductions. Final corpus evidence covers363 selected states:206 freshly rendered wheel-model states and157 verified unchanged v8 rasters with v9 captions across nine unaffected renderable models. The critic independently inspects all31 wheel triples, fourteen final receiving details and78 retained representative states with fresh text. Whole-model scores remain unchanged; this is sampled desk review, not physical builder testing.

Actual final PDF/HTML fixtures are clear-stud(two operations/four PDF pages), axle/bush(three/five) and wheel(four/six). The axial example has no sparse note-continuation pages; required receivers and physical-undetermined CAD crossing outcomes remain on the principal step pages. Wheel labels are complete, and all nine fixture HTML steps load their pictures;360px supporting details are242px including the border. Final six-size editor/viewer captures leave bare pins and wheel placements visible, without horizontal overflow or action targets below44px. Earlier panel-obscured captures, superseded/terminated full test attempts and a concurrent export startup timeout are explicitly excluded from final verification. The final production browser suite passes21 checks across generation, editing, dimming, viewer, publication and cancellation. The real6450 PDF contains49 operations,86 occurrences and62 pages; its former one-word uncertainty continuation pages are removed by keeping full CAD summaries above the diagrams. Ten lower-notes continuation pages remain, including a short source-section reminder. After the final pagination/HTML-order repair, production rebuild, all eight fixture/real-model exports and nine generation/publication/cancellation browser checks pass. Full checks on the pushed commit are recorded in the PR; prior-head CI is not claimed for this code. [Reports and bounded evidence](reports/instruction-generation/wheel-operations.md).

## Three-round MPD authoring pilot (1 October 2026)

The earlier complete domain/integration run passed 933 tests across 150 files.
After publication/CLI repairs, the complete run passed 933 of 934 tests; the real
headless CLI test exceeded its unchanged 90-second budget during concurrent
software-WebGL publication. Its quiet isolated rerun passes both tests in 59.25
seconds. Subsequent camera and PDF dimension repairs pass all 15 workbench and
12 publication tests. Final production build, schema generation and type checking
pass; pinned-library validation and formatting pass. Full branch CI is reported
separately against its exact head.

Ten relevant production browser checks pass across generation, publication,
manual native opening, nested replay and Play camera isolation. Focused receiving
mask, editor restoration and readable-note checks subsequently pass 3, 2 and 3
tests respectively. Desktop 1440px and phone 360px checks retain actual receiving
states and restore current placement visibility. The final native phone packet
contains 48 captures with 16 fully visible action paragraphs; final HTML testing
covers 16 measured operation/viewport states with no broken images or overflow.

Final review packets contain 193 states, 403 captures and 24 sheets. Roadster is
fully reviewed; Truck 55, House 33 and Shark 59 are selected risk windows. Source
invariants pass with 58/86/281/230 unique introductions, unchanged models/assets/
library/root and no stale generated or insertion claims. Note-only corrections
retain explicit before/after equivalence, and gallery manifests keep their
original hashes. All eight full CLI exports succeed. The final PDF text repair
reuses verified HTML pictures through the production publisher; four compositions
retain exact full ZIP metadata and 1,338 image resources, independently extracted
from the PDF. Original browser exports and rejected cache pilots remain distinct.

All four final scores are 3/5. Complete text audits cover 439 action paragraphs
on their main pages across 491 PDF pages, with explicit multiplication/degree/
fraction normalization. This supplements selected visual review; no physical
device or physical builder trial is claimed. Passing source/replay/CAD gates is
not physical assembly validation. See the [experiment](reports/instruction-generation/agent-workflow.md)
and [independent critic](reports/instruction-generation/agent-workflow-critic.md).

## Automatic nested vehicle transfer (1 October 2026)

V10 passes100 instruction unit tests across16 files, including six new automatic
nested/source-isolation/foreign-receiver/dependency-fallback tests. Production
schema generation, type checking and build pass. Nine relevant generated/authored
browser checks pass; three focused final checks additionally verify v10 worker
output and actual bare-rim visibility in the viewer and publication.

All17 supported sources preserve7017 unique occurrences and original leaf-step
arrays. Five parents add only zero-new-part scene joins; ten programmes/presentation
remain equal to freshly regenerated v9 and two differ only in tyre receiving-view
flags. Source records, references, colours, poses, assets and pack locks are
unchanged, and CAD fingerprints are current. Three oversized samples and Galaxy's
strict render refusal remain explicit.

Independent review covers205 initial parent states/377 rasters,31 repaired tyre
states/62 rasters and28 windmill states/49 rasters. The tyre supplement changes
only31 before-state flags; original gallery hashes remain frozen. Each individual
capture completed its gates, while two outer batches returned143 after completion
and are not credited as outer exit0. Eight selected actual PDF pages,20 native
phone views and eight independently captured exported HTML windows supplement
this desk review. Four full real CLI exports return0;33/50 operations retain58/86
source inventory units,41/64 PDF pages and exact PDF/ZIP metadata. No physical
builder trial, fit/stability certification or whole-corpus acceptance is claimed.
The [report](reports/instruction-generation/scene-workbenches.md) and
[critic](reports/instruction-generation/scene-workbenches-critic.md) retain scope,
source notices, original/final evidence and remaining feasible directions.

## Wheel placement presentation follow-up

The v10 follow-up passes the production build, 113 instruction unit tests across 17
files and the focused production browser receiving-view/publication check. The
rotated camera regression covers left/right wheels with receiver axes in world
X/Y/Z, retaining UNKNOWN checks and exact source output. Independent 17-plan
comparison, actual all-resolved-wheel galleries and bounded native/publication
phone evidence are recorded in [the report](reports/instruction-generation/wheel-presentation.md).
These checks do not establish physical assembly or whole-corpus acceptance.

## Conditional source figure procedures

Automatic v11 preserves supplied lower-body/torso assemblies and adds narrow
source-reviewed shoulder/wrist/neck ordering and receiving illustrations. The
fresh 17-case comparison preserves all 7,017 source leaves; four official-set
programmes change and thirteen programme/presentation objects remain exact.
Atomic-cycle rejection, every kind/direction of known boundary crossing, actual
Hut scene fallback, rotated cameras, source-byte binding, before-state detail
masks and native persistence are covered by the 122 passing instruction unit tests
in 18 files. Production schemas/type-check/build pass.

Nine existing relevant production browser checks pass. The new actual-Hut
editor/viewer test additionally verifies the true prior-member detail mask at
360×600 and 686×411, full-scene restoration and honest UNKNOWN route status. Its
first pilot used an incorrect restore-button label; corrected final runs pass.
All 55 final selected figure states have 120 real rasters on eight sheets, binding
the exact native/source plan. Forty actual native phone captures and full Truck /
Pizzeria PDF+HTML checks are recorded in the [evidence report](reports/instruction-generation/figure-procedures.md)
and [independent critic](reports/instruction-generation/figure-procedures-critic.md).
Final marker-corrected publications reuse byte-identical unaffected diagrams and
fresh changed-operation diagrams at original dimensions, with exact metadata and
image hash checks; reused images are not fresh GPU measurements. No physical build
or real-device trial is claimed. Broader automatic acceptance remains open.

## Source steering, shutter and sign procedures (2 October 2026)

V12 passes129 instruction unit tests across19 files, including seven new source
hash/namespace/pose/ambiguity, actual receiver, rounding, atomic-cycle/boundary
and incomplete-budget-scan regressions. Production schemas/type-check/build
pass. The complete seventeen-plan audit preserves7,017 source introductions,
exact raw source exports and prior-member receiving replay; fifteen unaffected
programme/presentation objects remain exact against actual v11 natives.
Fresh latest-generation equality checks both final affected native plans.

Eight relevant production browser checks pass in the initial ten-check run.
Two generation/preview/undo assertions still expected v11; they were updated to
v12 and both focused reruns pass with exit zero at desktop and phone widths.
The initial outer run returned 143 and is not credited as an exit-zero batch.
Formatting, pinned-library validation and the archived file/semantic-plan hash
audit pass.

Two real final gallery commands returnzero: Truck55states/102rasters and Crane
30selected states/58rasters. This is85states/160rasters/eleven sheets, not a
complete Crane or seventeen-model visual rereview. Fifty fresh native-phone
views and eighteen independently captured HTML operation sections check actual
prior receivers, printed fronts, reachable scroll notes and overflow. Four full
fresh production CLI publications succeed: Truck55operations/86inventory/76PDF
pages, Crane82/170/112. Both PDF attachments exactly equal the corresponding ZIP
metadata; selected actual PDF pages retain complete core procedure notes.
All exports retain assemblyValidated:false; no physical fit or build trial is
claimed. [Evidence](reports/instruction-generation/display-procedures.md) and
[independent critic](reports/instruction-generation/display-procedures-critic.md)
record bounded acceptance, Truck3/5, Crane2/5 and remaining feasible work.

## Source control and hand-grip procedures (2 October 2026)

V13 passes136 instruction unit tests across20 files after final camera and budget
repairs, plus production schemas/type-check/build. Seven new tests bind all nine
source hashes, rotated control/grip landmarks, namespace/pose and unique ownership
gates, finite handle versus body-origin/infinite-axis matching, later competing
objects after scan exhaustion, actual model source/native preservation and honest
UNKNOWN outcomes. Seventeen persisted plans preserve7,017 introductions, exact
raw exports and source records; fourteen unaffected programmes remain exact to
committed v12. Fresh generation reproduces all three final affected natives.
The independent critic separately decodes all seventeen native/source pairs.

Ten relevant production browser checks pass in the initial v13 implementation.
Forty-two final native phone captures cover all eight new interface operations at
360×600 and686×411 after the camera/budget repairs, including actual prior masks,
main-scene restoration and reachable non-collapsing scroll notes. The first
Pizzeria bare-hand camera pilot is rejected; four actual camera variants are
rendered and the selected source-axis view exposes the C-shaped receiver.
Final gallery commands cover94 states/188 rasters/twelve sheets: all57 Truck,
twenty selected Crane and seventeen selected Pizzeria states. Retained Truck/Crane
captures bind exact final plans; the repaired Pizzeria packet is fresh.

Six full production CLI exports returnzero: Truck57operations/86inventory/77PDF
pages, Crane85/170/115 and Pizzeria96/166/137. PDF attachments equal ZIP metadata;
final native cameras, receiver masks, targets, checks and core notes survive.
The initial Pizzeria PDF process returns143 without an output and is recorded as
rejected; its retry succeeds after confirmed termination. The critic independently checks eight critical PDF pages, two actual Pizzeria
legend continuation pages and sixteen actual HTML phone states. All image sets
load with no horizontal overflow; sparse legend pages remain an editorial
limitation. This is bounded desk review, not a full corpus visual rereview or
physical builder trial. [Evidence](reports/instruction-generation/interface-procedures.md)
and [critic](reports/instruction-generation/interface-procedures-critic.md) retain
scope, exact hashes and remaining work. Broader automatic acceptance remains open.

## Measured pictorial PDF layout (2 October 2026)

147 instruction tests across 21 files and production schemas/type-check/build pass.
New regressions cover complete accessory prose, atomic marker qualifiers,
arbitrary long file-local titles, actual printed glyph widths, retained picture
scale after header rewrap and absent/one/two/three-view regions. The original
publication/cancellation browser checks pass. The new actual pictorial PDF join
check initially assumes four images, but its origin-only fixture has only main
and incoming diagrams; the corrected focused rerun passes exit 0. The failed
expectation is preserved in the execution evidence, not hidden as a product fix.

All five actual production PDF compositions terminate successfully with exact source/native/
prepared metadata and original PNG bindings. Three official PDFs 329→249 pages retain
238 ordered full-text/font checks and 787 decoded image/alpha/drawn-size checks.
Independent selected visual scope is 42 final official main pages. Roadster and
House preserve 165 complete operations and 569 decoded source-capture RGB/alpha draws.
Roadster 35 pages has no continuations; House 135 pages retains all 132 complete operations on their main pages. Strict page bounds
and text/image separation pass. House's complete original ZIP was recovered after
exit 143; its retry also 143 with no output. Neither is credited as a successful
fresh CLI command. Full native/source/programme/camera/picture gates and successful
PDF composition validate the recovered artifact separately.

All 17 accepted native byte hashes remain exact, binding 7,017 source introductions;
this is publisher-only work and generation stays v13. No physical trial, new
primary-manual comparison or whole-corpus visual rereview is claimed. Rejected
pilot metrics, corrected audit-harness assumptions, exact execution/file hashes
and bounded actual pages are in the [report](reports/instruction-generation/print-layout.md)
and archive (local artifact). Broader
assembly-guidance acceptance remains open.

## Static source workbenches and panel decoration verification (2 October 2026)

V14 keeps all17 source models/assets/library/root/raw exports and7,017 expanded
reference/colour/pose identities exact. Every leaf is introduced once;15 complete
programme/presentation objects match accepted v13 after generation reports are
removed. Independent persisted-native replay checks both actual prior panel
receivers and isolated bench/main-scene membership. All133 recorded source-section
edge sets retain their earlier adjacent/support/host/access prerequisites; only
four finite source decoration access edges are added. Planning connectivity
includes estimates and does not establish physical attachment.

All162 instruction units/22files pass, including finite seam/plane/orientation,
ambiguity/work-exhaustion and boundary/prerequisite/deferral cases. The final
618-module post-rebase production build and pinned library validation pass. Five focused
browser checks pass: actual Crane static bench/two-panel receiver/completed
candidate masks, existing figure and wheel receiving-view regressions, and
generation/preview/undo at1440px and360px. Final native phone evidence covers100
actual screenshots with exact final plan bindings and independent PNG viewport
dimensions. Note-box height is recorded separately; metadata correction did not
alter the screenshots. Whole-model ratings and physical-build limitations remain
unchanged. See the [report](reports/instruction-generation/static-workbenches.md)
and bounded archive (local artifact).

## Staged Crane mechanism verification (2 October 2026)

V15 preserves all17 exact source/reference/colour/pose rows and7,017 unique
introductions. Every old source-section support/host/access/adjacent edge is retained;
all final support/access introduction orders and current CAD fingerprints pass.
Sixteen full programmes equal v14 after generation metadata is removed. Crane's
held five-member child introduces each member once and mounts with zero new parts;
all six original receiving supports are actually prior on the parent bench.

Nine source/mechanism regressions cover actual twelve-source hashes, material
hinge endpoints, unique complete signed finite associations, transform ambiguity
and budgets, outside contraction cycles, actual pin-lip crossings, native/replay
ownership, completed/bare compositor masks and the auxiliary64MP preflight boundary.
All171 instruction units across23files pass. The619-module production build and
pinned library validation pass. Six relevant production browser checks pass,
including actual worker generation, editor and phone completed→bare→restore→next
states, unchanged static/figure/wheel view controls and desktop/phone preview/undo.

The critic inspected all93 original gallery states/181rasters. Per-operation
prepared capture recipes bind92 of those states to the final native; the final
57–59 supplement has3states/8freshrasters, superseding old58. Six native viewports
yield90screenshots,22restored-main equality checks and28next-state assertions,
all bound to the final source/native/plan. This records direct interaction checks
and independently reviewed samples, rather than independent driving of every UI
state. Long captions and trays require scrolling.

Full actual HTML CLI export exits0; the production PDF composes byte-identical
validated HTML pictures, with exact prepared/report metadata gates. Independent
extraction checks all93 action/CAD paragraphs,170inventory,99pages and307RGB/alpha
draws, including the actual completed hinge inset and trays. PDF attached JSON
equals the full HTML packet. Twenty-eight actual exported HTML phone states pass
loaded-picture and overflow checks; sixteen actual PDF pages are rendered for
review. All core actions stay complete on main pages;58/65 still have sparse
legend continuation pages. The unchanged-source terminal-pose diagnostic uses
1,792 bounded triangle tests without contact allowances:54/56 transverse outer-arm
intersection pairs with the two controls, none with the inner arm. It is separate
from runtime CAD metadata and does not certify solids or physical fit.

See the [report](reports/instruction-generation/mechanism-procedures.md),
[critic](reports/instruction-generation/mechanism-procedures-critic.md) and
archive (local artifact) for exact
source/picture bindings, rejected camera pilots, execution provenance and limits.
Whole Crane2/5 and broader corpus acceptance remain unchanged; no physical build.

## Source-guided articulation and hybrid refinement (2 October 2026)

Final source/frame/geometry/scheduler, worker, replay and hybrid regression checks
pass:243 instruction tests across30files, production schemas/typecheck and
623-module build, pinned library validation and seven focused production browser
checks. The browser run covers source jaw details, retained static/Crane/figure/
wheel procedures and generation/preview/undo at1440/360px. Final complete source
audits retain7,017 exact introductions across17models and all prior graph sets;
16programme objects remain exact excluding generation metadata. Independent
nonempty prerequisite probes cover actual availability and contraction refusal.

The complete v16 Shark139-state review covers233rasters/17sheets; the third
capture command returns143 after complete verified artifacts, not credited as
command success. Final native tests have106records/72screenshots at six required
sizes. Full HTML CLI returnszero; exact-raster production PDF composition checks
all139 notes, complete embedded metadata and424image rectangles inside145pages.
The initial clipped fourth support picture is rejected and preserved separately.

The four-case hybrid trial preserves655source occurrences, actual source aliases,
raw poses and every retained hard prerequisite. Roadster full33/40paired states,
Truck32paired windows, House17baseline/final32stable-action selected windows and
Shark complete139baseline/final38selected actions are independently reviewed.
Caption/frame repairs have fresh pictures and explicit stable-key equivalence for
unaffected earlier packets. A deliberately future receiver refuses without output.
All four final full HTML CLI exports returnzero; production PDF composition reuses
exact accepted HTML rasters and preserves all374operations/refinement provenance
over388pages with1,181 image draws. Every image rectangle and complete action
notes are audited. Actual final native phone cases explicitly open the agent plan
by default, check main/prior/detail/incoming/restored/next masks and reachable
notes at360×600/686×411. Initial House139export child reportszero but outerwrapper
returns143; it is a recovered, superseded pilot, not a successful final command.
The first Truck wrapper likewise returns143 after complete child output; a direct
CLI retry returnszero with every ZIP entry byte-identical, separately recorded.

The [source-guided report](reports/instruction-generation/source-guided-articulation.md)
and [hybrid trial](reports/instruction-generation/hybrid-workflow.md) link
independent audits, execution records, notices and actual selected publication
views. Whole hybrid scores remain3/3/3/2. These are bounded desk checks with no
physical build or whole-corpus acceptance claim.

## Geometry rules, footprints and located errors (2 October 2026)

- **Messages on real failures.** Recompiling the second temple run's failed replies: xhigh's last reply now reads `3045 Slope 45° 2 × 2 Double Convex at [9, 37, 31] and 2453b Brick 1 × 1 × 5 at [10, 38, 31] overlap where their boxes meet: x 10–11, y 38–40.5, z 31–32 (4 pairs like this)`; low's first reply's 312 overlaps fall into a few kinds led by 132 alike tile pairs; schema errors end `(got "bottom")` and `(got [0.5,31,0.5])`. 61678 "Curved Slope 4 × 1" lists as 1×4 studs (x×z), 3 plates.
- **Temple run 3** ([sample](samples/japanese-temple-one-shot-geometry/README.md)): all five efforts accepted on their second reply (1,965–2,098 parts), no schema errors, 5–37 minutes and 9k–46k output tokens, against run 2's 13–112 minutes and 21k–142k with xhigh not accepted. No searches; one colour error (medium's first reply). Remaining gap: irregular parts such as bamboo (30176) list their 1 × 1 attachment footprint while their leaves reach three to four studs.
- **Tests:** `tests/unit/build-script.test.ts` (grouped overlaps with positions, rejected values in schema errors, section totals on under-budget), `tests/unit/one-shot-build.test.ts` (footprints and heights in the list and search results, geometry rules and search allowance in the prompt), `tests/unit/build-workspace.test.ts`.

## Part targets as a score, counting rules and part reach (3 October 2026)

- **Per-op costs** (each op compiled alone, for the prompt's counting rules):
  - A plain `room` 12 × 8 and 4 bricks high is 22 parts; 16 × 12 and 8 bricks high is 44. With `texture: "masonry"`, `"log"` or `"grille"` they are 72 and 208, with `quoins` 32 and 72, and a colour mix adds nothing.
  - A `floor` 32 × 32 is 8 parts, or 128 with `top: "tile"`.
  - Gable and hip roofs: 12 × 8 is 45, 24 × 16 is 141–143.
  - `column` 4 per 12 plates; `window` and `door` 2 each; `fence` 5 per 20 studs; `dome` of diameter 8 is 81.
- **Rules against whole builds.** The run-3 attempt-1 scripts, 14 accepted temple scripts from runs 1–3 and the 7 repository samples, each compiled op by op and summed: whole builds came out 3% under to 16% over the sum. The gap is mostly massing cut up by parts, up to 45% at most, which is why the rules add 15% to massing.
- **Reach.** The overlap check's occupancy boxes were compared with the listed footprint for all 224 curated parts. 19 reach a quarter stud or more past it; bamboo 30176 reaches 1 stud at ±x and 1.5 at ±z. That matches run 3's max overlap: written at `[46, 0, 24]`, body from `[45, 0, 22.5]`. Recompiling that reply now reads `30176 Plant 1 × 1 Bamboo placed at [46, 0, 24] (repeat copy 1/3 > 1/2; its body reaches x 45–48, z 22.5–26.5, past its footprint) and 98138 Round Tile 1 × 1 placed at [45, 1, 24] …`.
- **Temple run 4** ([sample](samples/japanese-temple-one-shot-target/README.md)), GPT-6.1-Sol, target 2,000, low to max:
  - Every effort was accepted, max on its first reply.
  - Accepted counts were 2,007–2,195, 0.4–9.8% from the target. First replies that compiled were 2.5–7.3% off, against 3.1–28.5% in run 3.
  - Times and tokens were close to run 3's: 5–31 minutes, 11k–61k output tokens.
  - No bamboo overlaps, though every build used bamboo.
  - Medium's only error was a compiler fault: a closed fence path doubled its first post. It is fixed, and that reply now compiles cleanly at 1,848 parts. Xhigh's first reply mirrored a component, which the prompt now says is not allowed.
- **Tests:**
  - Unit and integration: `npx vitest run` passed 167 files, 1,110 tests. Coverage:
    - `tests/unit/build-script.test.ts`: any size accepted with `target` and `costliestOps`, `limits.maxParts` still refused, `targetText`/`targetMiss`, copies and placed positions in overlaps, the bamboo message and `overreach`, the closed fence.
    - `tests/unit/one-shot-build.test.ts`: the prompt's target and counting section, the repair reason with the size line.
    - `tests/unit/build-workspace.test.ts`: the wrapper passes only `--target-parts`.
    - `tests/integration/build-cli.test.ts`: far-off targets written with a `size:` line, `maxParts` refused with no model left behind, `--leeway` rejected.
  - Browser: `tests/browser/build-script.spec.ts` passed, including `limits.maxParts` refusing `apply` and `targetParts` reported by `compile`.
  - Templates: `tests/unit/template-*.test.ts` unchanged by the fence fix.

## One-shot runs through Claude Code (3 October 2026)

- **No tools.** `claude -p --tools "" --safe-mode --strict-mcp-config` answered "No tools are available to me in this session" when asked; no temple reply used a tool. At xhigh and max the first build reply hit the 128,000-token output cap while thinking and Claude Code continued it with its own message (`num_turns` 2, logged as `turns:2`); the session transcripts show the continuation.
- **Smoke run.** A 60-part shed at low effort went through two attempts end to end (overlap, then over budget), with tokens, thinking tokens, cost and the session logged.
- **Temple run with Opus 5.5** ([sample](samples/japanese-temple-one-shot-claude/README.md)): the run-3 prompt, byte for byte; all five efforts accepted (1,914–2,015 parts) after 5, 4, 2, 2 and 2 attempts, no schema errors, 4–51 minutes, 27k–334k output tokens, about $27 in all. Low and medium missed the part range; every overlap involved an irregular part (6255 plants, 2435 pines) reaching past its listed footprint. xhigh and max made 10 searches each; one colour error (low's first reply). Interviews with each final session are on the page.
- **Tests:** `npx tsc -b`, `npm run format:check`, `tests/unit/one-shot-build.test.ts`.

## Opus 5.5 under run 4's rules, and joined Claude Code replies (3 October 2026)

- **Runner fault.** Max's first reply filled the 128,000-token cap while writing JSON; Claude Code continued it and its `result` held only the last turn (4.6 kB of 17 kB), so the runner refused it as invalid. Joined from the session transcript it compiles cleanly at 1,744 parts. The runner now reads `--output-format stream-json --verbose` and joins every assistant text. Check: a reply forced to split under `CLAUDE_CODE_MAX_OUTPUT_TOKENS=600` (3 turns) had a 40-character `result`, while the joined text parsed as the full 400-number JSON. The first Opus run's cap hits happened during thinking, before any text (session transcripts), so its results stand.
- **Temple run** ([sample](samples/japanese-temple-one-shot-claude-target/README.md)): run 4's prompt plus the `mirror` line; all five accepted, low, xhigh and max (max rerun with the fixed runner) on their first reply. Parts 1,358–2,294 (0–32% from 2,000, 14% on average against GPT-6.1-Sol's 4%), 2–34 minutes, 11k–222k output tokens, about $18 in all. The two repairs were plant and tree reach (6255, 3470, 3471, 32607). No colour errors.
- **Tests:** `npx tsc -b`, `npm run format:check`, `tests/unit/one-shot-build.test.ts`; a 60-part smoke run through the merged runner.

## Cream Gallery and Play workshop — 3 October 2026

The production React app implements the approved cream Gallery/Play shell.
Verification covers the new browsing/import flow, real model loading and tool
switching, walking, editable-copy protection, failed-load preservation and
local offline assets. Additional checks cover the retained editor's placement,
parts browser, menus, keyboard controls and Play settings.

Thirteen distinct focused browser checks pass: three Gallery flows, two Play
world-layer cases, keyboard controls, two full phone HUD cases, short-landscape
train controls, two notched-phone cases and two complete menu traversals. The
last notched-landscape failure was corrected and rerun successfully. An
interrupted two-test model-load run was not counted; its isolated retry passes.

The production build and TypeScript check pass. All five gallery scripts match
the supplied originals byte for byte; fifteen sourced images retain origin
metadata. The offline snapshot includes gallery scripts, images and the local
licensed font. Deployment file-count and individual-file limits pass; the
existing large application chunk warning remains.

Visual evidence is stored locally under `.impeccable/review/workshop-app/`.
Gallery and Play entry were captured at 1440×1000, 390×844, 360×600, 411×685,
1080×1800 and 686×411. Details, model tools, real walking and Build also have
actual-app captures. The final packet has 31 app-state captures plus four
notched-landscape regression screenshots, including placement and the parts
sheet. Play settings include the short 600×360 landscape case; Tools include
active walking. All 50 runtime and review rasters retain origin metadata.
The capture checks report no JavaScript errors or horizontal page overflow.
The independent Impeccable review returned `ship`
for the approved cream direction; it does not certify the full roadmap or CI.
The final responsive corrections received a separate `ship` verdict with all
four scored fixes resolved. The final three settings captures also verify
complete labels inside 48px targets and a reachable Enter Play action.

Physical phone performance and the full CI suite were not run for this design
change. These checks do not establish large-model or Photo performance.

## Agent gallery, phase 1 (3 October 2026)

- **Unit:** `tests/unit/gallery-index.test.ts` and `tests/unit/gallery-publish.test.ts`: ids and names, index generation from D1 rows and its decoder, download checks (size, checksum, library release, damaged gzip), when a page reads the index, SQL quoting, one-shot folder discovery, and each prompt and agent inserted once.
- **Browser:** `tests/browser/gallery.spec.ts` (4 tests) mocks the bucket (`tests/browser/helpers/gallery.ts`) and checks:
  - browsing by brief, shared angles, the effort filter, compare (disabled for a single build), no overflow and 44 px targets at six sizes, and Open your model;
  - the detail page's facts and live 3D view loading on a desktop and on a 390 × 844 touch phone, the angle tabs, and with data saver no MPD request until **Spin in 3D**;
  - opening a build in all four tools and walking it in Play, and the save prompt protecting an edited copy;
  - a 503 or damaged MPD keeping the current model, the "needs a connection" state, and no request to the bucket on plain http without `?galleryIndex=1`.
- **Live:** `index.json` on `gallery.bricks.robertj.in` serves 10 builds with CORS for the site and `max-age=60`; MPDs and renders are `immutable`. Screenshots of the Gallery and the live preview (desktop 1440 × 1000, phone 390 × 844) were taken against a local mirror of the live files.
- **Design check:** Impeccable's detector found one new off-ramp font size (fixed to the 43 px display step); its other advisories predate this change.
- **Not checked:** a physical phone (memory and frame time with the preview beside the workspace scene).

## Gallery ↔ Play journey (4–5 October 2026)

- **Critic loop:** an independent agent drove the built app with Playwright at 390 × 844, 360 × 600, 686 × 411 and 1080 × 1800 (touch) and 1440 × 1000, scoring the Gallery-to-Play journey each round; findings were fixed and rechecked (scores 5.5, 5, 6.5 on the earlier gallery, then rechecked on the published-builds Gallery).
- **Browser:** `tests/browser/gallery.spec.ts` adds phones opening the live view by default and the data-saver path; `hud-layout.spec.ts` checks the rotate hint beside the Play controls; `play.spec.ts` checks Exit Play returns to the entry dock. Gallery, hud-layout, play and menus specs pass locally.
- **Not checked:** a physical phone's memory and frame time with the live preview loading on open; the full CI suite.

## brick.build, draft checks and the recalibrated prompt (3 October 2026)

- **brick.build.** `tests/unit/brick-build.test.ts`: the code example in `prompts/brick-build.md` makes exactly the JSON example of `prompts/build-agent.md` (and validates); loops, components, nested and conditional op lists, conditional openings and holes; code lines by op path, including inside components; a seed repeats exactly; errors name their line; an endless loop stops at the time limit; `section.constructor('return process')()` and `this.constructor.constructor(…)` fail with "Code generation from strings disallowed" (no host object is reachable); `require` and `process` are undefined. `brick-cli build --script t.js` printed `[sections[0].ops[0] (code line 6), sections[0].ops[1] > components.post.ops[0] (code line 3)]` on an overlap.
- **Checks.** `tests/unit/one-shot-build.test.ts`: the prompt's check section, reading `{"check_build": …}`, and the answer (count, sections by size, errors only). A forced smoke run through Codex (a 120-part shed whose brief asked for one check) got back 130 parts and 8 errors, then answered with 113 parts and no errors; another smoke run answered in code without checking and was repaired once.
- **Prompt facts.** Each was checked by compiling small scripts: turn 90 maps −z → −x (front → left; clockwise in the top view); slopes, curved and inverted slopes descend or overhang toward −z at turn 0; a 3062b or 3024 under a 2 × 4 plate is not reported floating; a part on a slope's face is; `top: "tile"` keeps the top height; a box's lid is its top 2 plates; `instance.at` [x, z] fails validation; `repeat` holds `instance`; holes in a group are local; stairs toward −x cover `at − run + 1 .. at` for the first step; an inward door in a 6b room with a floor gives `opening-height`.
- **Counting rules.** Every op of the ten run-4 temple builds (GPT-6.1-Sol and Opus 5.5) compiled alone and summed, and single ops measured in isolation: the old rules (with +15%) missed the builds by 15.3% on average; the new rules by 2.8% (at most 6.9%), fitted to the same builds, so expect 5–10% on new ones. The largest gaps were one-brick textured boxes (solid all through: 34 × 24 is 408 parts against 63 by the old rule) and slabs or walls with parts set into them.
- **Part list and search.** Reach is listed above 1 LDU (30 parts; 3470 and 3471 now show 0.5 stud on each side, which the overlap check sees at 0.65 LDU); common colours read "light bluish grey", "dark bluish grey", "trans-clear" as in the Colours section, and colour errors use the same names. Searches for "lantern", "bell" and "fish" return no minifigure torsos, Duplo or legs; "minifig torso" and "duplo brick" still return them.
- **Temple run 5** ([sample](samples/japanese-temple-one-shot-brickbuild/README.md)): GPT-6.1-Sol, all five efforts accepted on their first reply (1,998–2,170 parts, 0–8.5% from 2,000), in 2–45 minutes and 6k–169k output tokens; high, xhigh and max used three checks each, low one, medium none.
- **Tests:** `npx vitest run tests/unit` (161 files, 1,103 tests) and `tests/integration/build-cli.test.ts` passed; `npx tsc -b`; `npm run format:check`; `npm run schemas` (the `stairs.at` description).

## Shell layout fixes after the cream redesign (3 October 2026)

CI runs 102–104 failed in browser shards main-2/3/4, so nothing deployed. The causes, all from the new site header and model heading:

- The model heading (z-index 25) sat over the step viewer's top row, catching taps on Step options and Close steps at 360 × 600 and 411 × 685 and in generated-step views. It now hides with the rest of the build HUD while the viewer is open (`guide.css`).
- The Play view is now about 300 px tall in short landscape (below the 60 px header): the look hint at 46% overlapped the action prompt (raised to 30% at heights up to 420 px), and the remote-controls panel's height was bounded by `100dvh` and ran 60 px off the bottom (now bounded by the Play view, `100%`).
- With a phone on its side, the status line started 6 px inside the header actions; it now sits below them (`site-h + 132px`).
- The empty canvas's welcome card (z-index 16) covered the toolbar's More tools menu (15) on phones, so Rectangular fill could not be tapped; an open toolbar menu now rises to 17.
- The complete-library search result now starts below the fold; its thumbnail loads when scrolled near (by design), so the test scrolls it into view.

Locally all 9 failing tests pass, with hud-layout, menus, instruction-viewer, gallery, editor, fill-set, full-library, startup-recovery and the Play mechanism specs (45 tests). `load-performance.spec.ts:152` (skeleton frames) failed once in run 104 with only two frames sampled; it passes repeatedly here and is left to the next CI run.

## Play motion investigation (3 October 2026)

Worktree `/home/ubuntu/brick-editor-physics-motion`, branch
`codex/physics-motion-investigation`, starting at `c004c82`. Node 22.14.0, pinned
Rapier 0.21.0 and the committed `ldraw-full-2026-09-28` library. See the
[findings and proposed scope](PLAY-MOTION-ROADMAP.md).

```sh
FORCE_COLOR=0 npx vitest run \
  tests/unit/mechanisms.test.ts tests/unit/play-dynamics.test.ts \
  tests/unit/rig-joint-authoring.test.ts tests/unit/play-moving.test.ts \
  tests/unit/play-auto-doors.test.ts tests/unit/play-track.test.ts \
  tests/unit/play-trains.test.ts tests/unit/rig-authoring.test.ts \
  tests/unit/connectors.test.ts
npx tsx scripts/audit-play-motion.ts
npx tsc -b
```

- Existing tests: **9 files, 102 tests passed**, 16.14 s wall time in the focused
  run. This confirms their existing contracts, not new mechanism behavior.
- Audit: all assertions passed. Current dynamic frame overlap was measured at
  180.077° after 240 fixed ticks without gravity; kinematic static-obstacle overlap
  was accepted at 90°. The point [0, 10, 0] LDU in 3700's round through-hole lies
  inside its moving convex proxy. The cycle and spherical controls were refused
  as reported. Auto-door moving membership remained a single occurrence.
- Pinned-engine creation probes succeeded for spring, rope, generic cylindrical
  freedom and an additional closing impulse joint. Those objects were not stepped
  as a combined mechanism; no stability or transmission correctness is implied.
- Multi-turn target: a fresh zero-gravity unbounded hinge commanded to 720° at
  180°/s reports 9,127.104° and `blocked` after 600 fixed ticks. One-off 180° and
  360° checks ended at 180.077° and 360.078° respectively. This isolates a
  multi-turn positioning concern; the existing velocity-motor tests still pass.
- Spherical API discrepancy: creating `JointData.spherical` returns runtime
  `JointType.Generic` (6) with no `configureMotorPosition` or `setMotorMaxForce`
  method, despite the spherical class declarations/prototype containing them.
  The audit checks method availability; an initial direct method call reproduced
  `TypeError: ballJoint.setMotorMaxForce is not a function`.
- TypeScript and changed-file Prettier checks passed. No runtime feature, schema
  or generated library asset changed. The audit's three.js fixture loader emits
  existing missing-color-material warnings; probes concern collider geometry.
- No browser suite, phone/GPU benchmark, live OMR fetch or physical LEGO experiment
  was run. The original workspace's uncommitted changes were not copied or edited.

## Accumulated-turn position control (3 October 2026)

Worktree and engine match the investigation above. The repaired
`scripts/audit-play-motion.ts` now asserts a 720° target finishes within 1° and
reports `complete` after 600 ticks; observed final angle is 720°. The other audit
limitations remain reproduced, including own-frame overlap at 180°.

- Focused unit regression: `play-multiturn`, `play-dynamics`, `mechanisms`,
  `play-moving` and `play-auto-doors`: **5 files, 38 tests pass**, 6.61 s wall time;
  multiple turns in both directions,
  authored position motors, target reversal, repeatable replay, rotated axis,
  high mass/low effort progress, locked-body recovery and external impulses.
  Every fixed-tick helper check preserves the authored project byte-for-byte.
- `npm run build` passes (schemas, TypeScript and production Vite bundle).
  Changed-file Prettier and a final TypeScript check pass. No dependency,
  generated library, persisted schema or runtime asset was added.
- Production Playwright on a private server at port 4397: **5 checks pass**
  across the initial four existing passes (1.0 min) and the corrected new target
  check alone (15.4 s). The new check covers 720°, −720°, 765°, settled holding,
  capture metadata, different rendered PNGs, posed export and unchanged authored
  LDraw. Existing checks cover official auto doors and the Dynamic drawer/motor
  toggle at 1440×1000 and 360×800. Its first run exposed a missing `await` on
  `play.snapshot()` in the new capture test; corrected before the isolated pass.
- This establishes the controller on these fixtures and the pinned software
  WebGL browser. It does not establish arbitrary-load motor convergence, physical
  LEGO torque, Technic transmissions or a phone performance measurement.

## Reviewed mechanical proposals (3 October 2026)

Same worktree and source packs as the preceding checkpoints. The
[mechanical scope](PLAY-MECHANICAL-FEATURES.md) records the 15 profiles, ideal
contact semantics, analysis bounds and unfinished transmission/Play integration.

- Focused regression: **8 files, 79 tests pass**, 10.30 s wall time:
  `mechanical-contacts`, `mechanical-proposals`, `mechanical-proposal-api`,
  `play-multiturn`, `play-dynamics`, `rig-authoring`, `rig-joint-authoring` and
  `connectors`.
- New tests bind each profile to the exact pinned source hash and manifests;
  independently check source hole/tooth/finger landmarks; distinguish axial
  freedom, collars and friction pins; reject partial/remote/skew/phase-invalid
  engagement; check both gear axis signs and invalid mesh separation/faces;
  preserve rounded/nested source transforms; and fail closed on occurrence and
  dense search budgets.
- The original 13-part arrangement yields one joint per retained shaft despite
  multiple bearings, a separate pin and arm, four total joints and a −1/3 mesh
  candidate. Explicit preview moves a shaft/gear and pin arm; it deliberately
  leaves the second shaft independent until transmission integration. All
  authored placements, raw export and occurrence count remain unchanged.
- API checks establish a read-only proposal without a renderer/undo entry,
  explicit `rigs.upsert` saving with unchanged source/inventory, getter/unknown
  field preflight, stale requests and an edit during lazy analysis. An initial
  guard compared cloned `editor.project` objects; it now compares the immutable
  editor snapshot and revision, and both ordinary and concurrent-edit tests pass.
- `npm run build` passes with generated request/API schemas, standalone
  validators, TypeScript and production Vite output. The mechanical analysis is
  a separate lazy chunk (20.62 kB, 7.99 kB gzip in this build). No source pack,
  runtime asset or dependency was changed.
- Production browser: **3 checks pass**, 29.2 s, private server at port 4397.
  `mechanical-proposals.spec.ts` imports the actual official finger halves and
  plate, analyses without a document edit, explicitly saves, renders both moving
  accessories at 45°, checks changed PNGs and posed export, and retains exact
  authored LDraw/inventory. Existing `play-mechanisms.spec.ts` checks posed door
  colliders and restoration at desktop, plus authored rig control at 1080×1800
  touch size. The new proposal has API coverage; no proposal UI was introduced.
- Mechanical analysis, contact matching and proposal tests do not establish
  motor-driven 3:1 behavior, transmitted load, collision clearance, physical
  LEGO fit, automatic full-model rigging or phone performance. Those remain
  separate requirements of the active motion roadmap.

## Ideal spur transmissions and loaded pin arm (3 October 2026)

Same isolated worktree and pinned engine/library as the preceding checkpoints.
The original CC0 acceptance source is reproducible with
`npx tsx scripts/build-technic-fixture.ts --check`; it contains 13 direct official
part references and copies no library geometry. Moving rows start above Play's
default ground. An earlier ground-intersecting arrangement was corrected before
acceptance; its stalled motor was not evidence of a transmission regression.

- Focused regression: **12 files, 84 tests pass**, 13.41 s. A subsequent complete
  `play-transmissions` run passes **10 tests**, 9.49 s, adding an underpowered-arm
  check to its previous nine cases. Together these establish **85 distinct
  passing tests**. Scope: transmission validation, consistent/inconsistent ratio
  loops, 100-relation and speed bounds, reflected limits, kinematic multi-turn
  motion, native persistence/undo, proposals/API and existing rig/joint controls.
- Actual pinned LDraw geometry is compiled into dynamic proxies. The physical
  checks cover continuous >720° drive, either-shaft multi-turn targets, output
  mass reaction, a locked output stalling the input and recovery, output impulse
  backdriving, deterministic replay, oblique/opposed axes and a free carrier.
  Each coupling pass conserves total angular momentum within 1e-5 on the tested
  free bodies; total axial momentum also survives the full trajectory. The
  inertia matrix returned by this Rapier package aliases shared scratch storage:
  the test reads other body properties first and consumes the matrix immediately.
  Production constraint calculations consume their matrices immediately as well.
- The separate pin/arm check holds both bearing coordinates against gravity at
  0° and 45°, requires settled completion and checks continued holding. A
  1 N·m authored arm reports blocked rather than gaining unbounded effort.
  Controller regression covers prior multi-turn, obstruction and loaded targets.
- Production build passes (generated schema/validator, TypeScript and Vite,
  34.80 s). The optional relation is backwards compatible. No dependency,
  library pack, remote runtime asset or CSP change was added.
- Production browser: **both new rendered transmission cases pass**, using the
  kinematic pass in the initial pair and the corrected Dynamic case alone
  (16.6 s). Both command input 765°/output −255°, then output 270°/input −810°,
  require completion, and move the two-bearing arm to 45°. They compare rendered
  PNGs, accessory placements, posed inventory and exact source export before/
  after Play. The first loaded-arm run asserted completion after only 180 ticks;
  the corrected check allows 600 ticks for physical settling without changing its
  angle or completion requirements.
- Incumbent UI baseline only: **3 browser captures pass**, 39.8 s, at desktop
  1440×1000 and touch 360×600/1080×1800. Screenshots remain under `.local/`.
  They do not validate a redesigned interface or physical-phone performance.
- Existing physics performance regression: **2 checks pass**, 1.3 min, with
  dynamic mean tick cost **0.820 ms** on desktop and **1.820 ms** on the emulated
  phone profile with 4× CPU throttling (limits 4 ms / 10 ms). This is the existing
  physics playground, not a Technic scene or physical-phone benchmark. Software
  WebGL frame means vary by scene; the door-room means are 159.58 ms / 110.00 ms,
  so these tick measurements are not a claim of smooth rendering.

This establishes ideal spur behavior on these fixtures, not physical LEGO torque,
tooth clearance, energy conservation under position correction, general contact
safety or arbitrary assembly convergence. Rack coupling, other actuators and the
approved contextual-control/whole-mechanism camera slice remain active roadmap
work.

## Live motor controls and mechanism overview (3 October 2026)

- Focused unit checks: six files, **45 tests passed**, covering proportional
  kinematic/native input, reverse/brake and restoration of authored presets,
  invalid-input atomic refusal, coupled output stalls and recovery, multi-turn
  positioning and camera fitting. A separate browser-controller/capture and
  motor-input run passed **11 tests in two files** (motor-input overlaps the
  first run). Overview/capture assertions preserve the project and live pose;
  the capture-only camera aspect changes temporarily by design.
- The fit proof projects every real group-bound corner for a large moving
  mechanism at four orbit angles and three arm poses into six viewport sizes:
  1440×1000, 1080×1800, 360×600, 411×685, 390×844 and 686×411. All corners remain
  inside the area clear of the control sheet and between clipping planes.
- Production Chromium/SwiftShader: **seven new cases passed**, the six viewport
  sizes above in kinematic mode and 360×600 in Dynamic. They load the actual
  pinned 13-part Technic fixture, save its reviewed proposal, exercise held
  mouse/touch input and release, Enter-key and blur braking, passive output
  ratio, orbit/zoom/Fit build, pause/resume, 44 px buttons, page overflow,
  explorer-view restoration and source equality on exit. Captures were opened
  together for the first bounded Impeccable inspection. The changed UI detector
  ran once and returned no findings. The independent reviewer requested an
  overflow cue and updated behavioral documentation. Its first verdict found
  cue/feedback overlap; the second correction reserves a footer, keeps braking
  feedback above it and preserves the sheet height. All seven browser cases pass
  again, with assertions for cue visibility, unobscured feedback and access to
  linked outputs. The reviewer scored both material fixes **resolved**, with
  disposition **ship** at the listed-fix scope.
- Existing production regression: **13 cases passed** for default/selected rigs,
  vehicle controls, keyboard focus, seated driving, explorer orbit/zoom, official
  doors and Dynamic controls. The final vehicle/remote subset passed **three
  cases** again after the reserved-footer change; this is not a full
  browser-suite claim.
- The fresh Impeccable documenter checked the components, camera implementation,
  tokens, surface brief, incumbent DESIGN/sidecar and test evidence. It confirmed
  this ordinary extension matches the existing system and preserved its tokens.
  It reported pre-existing sidecar wording omitting the Play-control exception;
  that unrelated drift was left unchanged.
- Harness corrections: one CDP connection must span touch press and release;
  reconnecting at release fails the browser protocol. The floor's presented
  height eases separately from reported capsule feet, so the explorer-camera
  restoration assertion allows 0.05 LDU vertical tolerance while keeping exact
  horizontal placement and unchanged explorer yaw/pitch. A separate no-clip unit
  fixture checks exact restoration without floor presentation.
- Build and TypeScript checks passed. This is VM browser evidence, not a physical
  phone measurement or a new large-model performance measurement. Direct
  proposal/review/save UI, arbitrary Technic inference and the remaining motion
  roadmap remain open.

## Guided rack transmission (3 October 2026)

Run in `/home/ubuntu/brick-editor-rack`, branch `codex/rack-transmission`, from
spur checkpoint `e0139e5`. Tests resolve actual official geometry from the pinned
local pack without network access. The original eight-part acceptance source
references a reviewed 18940 housing, 18942 rack and retained 8-tooth shaft.

Historical scope: this checkpoint suppressed same-rig contacts. The subsequent
contact audit found actual rack/housing intersections in the original mounting,
so the recorded 720° / −125.66 LDU result does not certify collision-clear guide
travel. Revised mounting and physical contact acceptance are still in progress.

- Focused Vitest command below passes **59 tests in seven files**. New rack
  coverage includes reproducible fixture source; one reviewed guide and one
  motor; wrong web orientation/offset, withdrawal, pitch distance and rest-phase
  refusal; oblique source placements; atomic reflected limits and pose rejection;
  native persistence and posed source isolation. Native dynamics checks pinion
  accumulated 720° positioning, slider reversal, authored slider position motor,
  increased output inertia, a blocked rack and recovery, external rack back-drive,
  free-carrier reaction and linear momentum. With native damping disabled, each
  isolated coupling pass preserves angular momentum within 10⁻⁵ over 120 ticks.
- Production build passes (`npm run build`: schemas, TypeScript and Vite).
- Private Playwright config `.local/rack.config.ts` uses port 4401; one worker
  runs `tests/browser/play-rack-transmissions.spec.ts`: **two tests pass (41.1 s)**.
  Actual Kinematic and Dynamic rendering reaches 720° / −125.66 LDU, completes
  slider reversal to 100 LDU, changes pixels and rack transforms, preserves all
  eight source occurrences and default LDraw bytes, and exports eight posed parts.
- Fixture generation/check and changed-file Prettier checks pass. No dependency,
  runtime asset, library geometry or remote request is added.

```sh
FORCE_COLOR=0 npx vitest run tests/unit/rack-transmissions.test.ts \
  tests/unit/play-rack-transmissions.test.ts tests/unit/transmissions.test.ts \
  tests/unit/play-transmissions.test.ts tests/unit/mechanical-contacts.test.ts \
  tests/unit/mechanical-proposals.test.ts tests/unit/play-kinematic-transmissions.test.ts
npx tsx scripts/build-rack-fixture.ts --check
FORCE_COLOR=0 npm run build
FORCE_COLOR=0 BROWSER_WORKERS=1 npx playwright test -c .local/rack.config.ts \
  --project=main tests/browser/play-rack-transmissions.spec.ts
```

This is a bounded ideal rack constraint with source-bound mounting inference.
The polygonal 8-LDU rack spacing approximates the ideal nominal circular pitch;
individual tooth collision, physical LEGO retention/torque and backlash are not
verified. Loose/improvised guides are refused by inference. No physical-phone,
larger mixed-transmission convergence or broad internal/world-collision claim is
made here; those remain separate roadmap work.

## Closed planar linkages (3 October 2026)

Worktree `/home/ubuntu/brick-editor-joints`, branch `codex/joint-linkages`, from
`e0139e5`. No dependency, library pack, remote asset or CSP change.

- Focused regression: **9 files, 62 tests pass**, 15.90 s. This includes six
  kinematic loop tests and nine Play loop tests, together with existing rigs,
  authoring, transmissions, dynamic/multi-turn motors and joint-target tests.
- Rotated four-bar and slider-crank commands preserve the input exactly through
  1,080°; every accepted kinematic closure residual is at most 0.001 LDU.
  Independent replay agrees exactly. Limits, passive commands, invalid supplied
  poses, redundant closures, non-planar axes and excessive counts are refused.
- Warm continuation passes 90°/270° toggles and reversal on the tested four-bar.
  Cold poses at those toggles refuse ambiguous motion atomically; moving the
  supplied pose away from the toggle permits a new motion path.
- Native four-bar/slider-crank runs keep actual attachment error below 0.08 LDU
  during twenty 60-tick batches with one 30°/s motor, on a 73° oblique axis.
  Each rig contains all four native joints, including the closing bearing. A
  fixed rocker stalls the input below 5° and release restores motion. Passive
  travel limits block a 45° target, retain closure below 0.1 LDU and stay within
  one degree of the checked stop tolerance. Multi-turn position targets settle
  at 720° then −360°. Native replay matches exactly.
- Native save/restore and posed apply/rebase/undo preserve closure data and source
  placements. Fixture generation check passes for both original CC0 MPDs.
- Production build passes: schema generation, TypeScript and Vite (35.67 s).
  Four rendered cases cover both linkages in kinematic and Dynamic Play, settled
  45° targets, changed PNGs/transforms, actual closure, unchanged source export,
  unchanged four-part inventory and equivalent placements after posed re-import.
  All **four rendered cases pass**, 31.7 s, on the private port 4403.
- A local Node measurement of 3,600 half-degree preview commands averaged
  **0.202 ms** (four-bar) and **0.674 ms** (slider-crank), including snapshots.
  This measures these small solvers on the shared ARM64 VM; it is not a browser
  tick budget, worst-case graph guarantee or physical-phone measurement.

The existing forest validator still refuses cycles in mount joints. This is a
bounded explicit planar extension, not a claim that every graph converges or
that spatial/automatically discovered linkages and internal contacts are solved.

## Springs, ropes and ball resistance (3 October 2026)

Follow-up in `/home/ubuntu/brick-editor-joints` after `371cf78`, kept separate from
the closed-linkage checkpoint.

- **Seven new pinned-engine tests pass** in the final focused regression:
  **6 files, 46 tests**, 9.26 s, including existing dynamic/multi-turn controllers,
  closed linkages and authoring.
- A 1 kg load on a 100 N/m spring settles within 0.1 LDU of the analytical
  4.905 LDU extension at gameplay scale. This 2 mm bound includes the native
  fixed-tick solver and sleep threshold. An impulse decays below 0.1 LDU with
  declared damping while the undamped comparison retains more than 1 LDU motion.
  A guided spring retains its 2 LDU travel stop within 0.1 LDU.
- A rope begins at 20 LDU with a 30 LDU maximum, remains slack while falling,
  catches the load within 0.1 LDU of its maximum and allows shortening after an
  upward impulse. Source data stays unchanged.
- A freely rotating spherical body retains more than 20°/s after its test
  impulse; declared resistance reduces it below 1°/s. The native handle remains
  Generic-wrapped; the public exported spherical constructor supplies the real
  angular motor operations. Per-axis effort is capped at one third of the total.
- Validation refuses negative forces, bad/excessive lengths, duplicate/excessive
  links and invalid angular resistance. Native save/restore preserves metadata;
  existing simple authoring forms refuse data they would lose.
- Both new production browser cases pass: **2 tests, 18.3 s**, private port 4403.
  Rendered spring/rope loads settle at their expected lengths. Native export and
  re-import replay identical group frames; source export and two-part inventory
  remain unchanged, and static posed re-import preserves the actual placements.
- Schema generation, TypeScript, formatting and the production build pass
  (Vite approximately 66 s on the shared VM). No dependency, remote asset,
  library pack or CSP change.

These are authored force constraints on original bodies, not automatic animated
shock/actuator inventory parts. Kinematic preview remains a rest preview. No
reported tension, arbitrary ball orientation control, routed rope, visual cable
or physical-phone performance claim is made.

## Loaded linear position control (3 October 2026)

Separate controller follow-up after `0dbc9fd`. Reuses the coupled-prismatic PI
velocity strategy from rack commit `fbeb02f` for isolated actuators, retaining
native effort limits and contact response.

- The prior local gravity probe reached **12.369 LDU**, `blocked`, for a
  **10 LDU** target after 900 ticks on a 1 kg vertical slider with 500 N effort.
  The revised controller settles within 0.05 LDU of 10 and keeps holding.
- **Seven new tests pass**; the final focused regression is **6 files, 47 tests**,
  7.71 s. They cover a guided spring load; requested 2 LDU/s
  travel with measured peak below 2.2 LDU/s; reversal at 5 LDU/s; a 1 N motor
  which cannot lift the load; collision with an actual world collider, stalled
  status and recovery after removing it; an authored 0.2 LDU/s motor kept awake;
  oblique frames, byte-identical replay and unchanged authored data.
- Production build passes (39.30 s), with TypeScript checked again after the last
  test addition. No schema, asset, dependency or CSP change is needed.
- The rendered spring-load acceptance passes: **1 test, 14.6 s**, private port 4403. It reaches/holds 10 LDU at 2 LDU/s, reverses to −10 at 5 LDU/s, preserves
  source export, and re-imports the static posed placements with two occurrences.

This repairs physical held-position behavior; it does not add a screw/valve model,
automatically animate a complete official actuator or claim phone hardware speed.

## Free cylindrical bearings (3 October 2026)

Separate authored-bearing slice after `db8c96a`; original CC0 linkage surfaces
supply the test bodies, with no remote geometry or new dependencies.

- Six new pinned-engine tests pass. The focused regression is **7 files,
  44 tests**, 11.94 s: simultaneous axial/spin movement, both native stops,
  off-axis impulses with radial error below 0.05 LDU and axial alignment above
  0.9999, free travel when stops are omitted, oblique axes, exact replay,
  source/rest preservation, native round-trip and posed inventory/placements.
- Cylindrical rest preview warns that movement requires Dynamic. Scalar target,
  scalar motor, ordinary limits, mismatching axes, invalid axial ranges, null
  stop data and lossy form editing are refused.
- Rapier's public generic joint locks the other four axes; its public prismatic
  wrapper applies axial stops to the existing native handle. No private raw WASM
  entry points or pose/velocity assignments implement the bearing.
- Production build, generated schemas/validators and TypeScript pass; Vite takes
  40.49 s on the shared VM. Changed files pass formatting and whitespace checks.
- The production browser acceptance passes: **1 test, 18.6 s**, private port 4403.
  A tilted two-part bearing spins under gravity while a spring loads the 20 LDU
  axial stop. Native restore produces identical group frames; source export stays
  unchanged, and posed re-import retains both parts and their actual positions.

This verifies authored two-freedom constraints. It does not claim automatic axle
recognition, internal actuator component maps, bearing friction, two-axis motor
controls or phone hardware performance. Turn readings unwrap consecutive fixed
samples and may alias above 180° of spin per tick.

## Moving platforms and dynamic driver seats (3 October 2026)

- `play-platforms.test.ts`: seven cases cover kinematic/native dynamic lift and
  turntable transport, exact deterministic replay, platform-relative position,
  tangential/vertical jump velocity, source preservation, blocked ceilings and
  leaving/re-entering Walk. The native actor has a 1 LDU collision safety pad;
  its exact supporting body is contact-excluded only while predicted carrying
  is clear. An owned EventQueue is necessary for the pinned Rapier hooks.
- `play-dynamic-seats.test.ts`: three cases cover native-chassis entry/driving,
  full-frame root/eye/avatar alignment, deterministic replay, snapshot schema,
  safe current-frame exit, source preservation, unchanged chassis mass, a
  head-only wall with reverse recovery, atomic unknown-seat failure and fallback
  from an unsupported first authored exit.
- `play-platforms-seats.spec.ts`: six production Chromium checks pass in 1.4 min
  using private port 4407: kinematic/native lift and turntable carrying/jumping,
  and the real pinned 80-part Off-road jeep seated/driven/exited at desktop
  1440×1000 and viewport 360×600. Each exits Play with the same source query.
  Actual rendered platform/figure/jeep captures were inspected. Phone viewport
  uses API inputs; no new touch-gesture or physical-device acceptance is claimed.
- The production build passed (Vite 36.31 s). The nine-file focused unit run passed
  all 38 checks (new support/seats plus legacy moving, dynamics, seated profile,
  seat geometry, browser lifecycle and API); TypeScript, formatting and fixture
  generation checks passed. No new large-model or physical-phone performance claim.

The fixtures are original CC0 probe geometry; the jeep is the existing original
model of official pinned parts. Runtime creates no new network assets. Rider
weight/friction, arbitrary grab/release attachments, walking around moving train
cars, inferred seats, low-cabin fit and articulated vehicles remain outside this
slice. Upstream Play interface acceptance is verified separately.

## Mechanism controls on the workshop header (3 October 2026)

Production evidence after rebasing onto `b0ac932` and integrating loaded linear
controllers, cylindrical bearings and moving support/dynamic seats:

- `npm run build`: passes (35.81 s Vite build); `npm run format:check`: passes.
- `play-mechanism-controls.spec.ts`: all seven target cases pass (1440×1000,
  1080×1800, 360×600, 411×685, 390×844, 686×411, plus 360×600 Dynamic). Held
  mouse/CDP touch and keyboard input brakes on release/blur; orbit, fit, pause,
  passive output disclosure, source preservation and 44 px targets remain valid.
  Measured assertions keep the status slab at least 7 px clear of Tools, pause
  at least 44×44 and the panel inside the viewport below the site header.
- `play-linked-controls.spec.ts`: four actual rack/slider-crank desktop/phone
  cases pass. Only the independent driver is editable; passive parts move,
  released input is zero and rack feedback uses LDU per degree.
- `play-cylindrical.spec.ts` and `play-platforms-seats.spec.ts`: seven cases pass,
  including loaded bearing stops, native/kinematic lift and turntable carry and
  jump, plus actual pinned jeep seated entry/drive/exit at desktop and 360 px.
- Combined private-port Chromium run: 18 passed in 2.7 min, on port 4397, with
  the rebuilt root worktree. The server was stopped by Playwright afterward.
- Existing seat, orbit, keyboard-focus and all-mechanism regressions also pass:
  12 cases in 2.6 min on the same private port. These include blocked seat exit
  recovery, atomic seat metadata review, simultaneous driving/turning and
  ordinary explorer orbit after the native-seat/support integration.
- Foundation checks before platform integration: 18 unit files/130 passed in
  32.57 s. Six post-integration files/29 passed in 8.65 s, including lifecycle
  refusal atomicity, loaded motors, bearings, support and dynamic seats.

Seven final captures were opened and validated. The fresh Impeccable full review
identified one status/Tools overlap; after one correction/rebuild/recapture,
its verdict scored that fix resolved with `ship` scoped to that finding. The
single detector scan had no primary findings and two inherited 17 px hint-radius
advisories. The old surface brief still describes the former palette; this
pre-existing drift was reported and left untouched. No new runtime assets ship.
This checkpoint leaves general contact policy and physical-fit acceptance open.

## Independent mechanical contact cost probe (4 October 2026)

A read-only probe of the contact-agent worktree repeats native and kinematic
costs with source hashes, equal prescribed 1 kg moving-body masses, constructor
entry time, actual coordinates, and native/mirrored collider counts. The public
reproduction driver typechecks and runs against both current and historical
adapters; a live contact-source smoke run also exercises its owned event queue.

Separate surface handles exceed a fixed-tick frame budget, policy-class compounds
reduce the native work, and persistent native query colliders avoid rebuilding
large shapes during kinematic sweeps. The initial rack performance sample used
an interpenetrating fixture mount and is a blocked diagnostic, not an accepted
rack or phone result. See [measurements, reproduction and budget advice](PLAY-CONTACT-COSTS.md).

## Bounded contact and spur regressions (4 October 2026)

The root worktree integrates contact checkpoint `8a5c171`, signed-plane checks
and conservative far-plane certification (`f6912dc`, `a7297d8`), and the
source-preserving oblique bearing admission fix (`1461efb`).

- A 21-file focused unit run passes 135/137 checks, including every native spur
  load, stall/recovery, multi-turn, back-drive, carrier reaction and oblique-axis
  case. The two remaining failures were an independent target fixture moving
  into its floor and a door replay exceeding its old five-second deadline.
  Moving the fixture upward and allowing the measured 460-tick replay 15 seconds
  makes both files pass all 12 checks in 8.45 seconds. Motion, source and ownership
  assertions remain intact; the combined run took 141.33 seconds under VM load.
- Ten platform cases include translated, tilted and vertical planes; four live
  motor cases and both kinematic spur cases pass. The full 4,080-tick replay
  reaches 4,500° / −1,500°, reverses to 765° / −255°, then drives the output to
  270° / input −810°. Its isolated measured cost is 44 seconds; only this case
  receives a 90-second deadline. Near-ground penetration and ceiling checks
  remain active; a fast reverse tick uses 252 checks rather than over 200,000.
- Production build passes. The first 16-case browser run passes 15 cases: loaded
  spring/rope, linear load, cylindrical stops, four-bar/slider-crank, platforms,
  native jeep seats and dynamic spur. Its kinematic spur failure was resolved by
  the far-plane certificate. A rebuilt run passes all nine control/spur cases in
  2.1 minutes across the seven desktop/phone control viewports. After the oblique
  source fix, both rebuilt spur cases pass again in 52 seconds.
- The read-only motion audit verifies the static blocker refuses a hinge update,
  native frame contact stops the panel, and a separate clear rotor completes
  720° within 600 ticks. Source/default spherical orientation remains explicit;
  the raw legacy hull helper still fills a Technic hole, while reviewed runtime
  bore proxies preserve it.

All private browser servers stop afterward. These checks retain authored source,
inventory, native persistence and posed export. They do not accept the unresolved
rack/housing tangent path, phone hardware performance, or an arbitrary maximum
mechanism. [Measured costs and hashes](PLAY-CONTACT-COSTS.md) distinguish the
verified spur checkpoint from earlier blocked rack diagnostics.

## Combined drives and city resource smoke (4 October 2026)

The public `scripts/benchmark-play-combined.ts` probe typechecks and passes its
live-session assertions at the `21b90e2` contact source checkpoint. Two spur
assemblies sharing one frame (26 parts, nine groups, two motors) advance in both
modes, retain both gear phase relations and preserve source. A third assembly is
refused in both modes by the 4,096-solid limit before native allocation. Mean
fixed-tick costs are 40.68 ms kinematic and 26.25 ms native, including explorer
and ground but excluding drawing. This is admission proof with a material
performance limitation. [Reproduction and timings](PLAY-CONTACT-COSTS.md#two-drives-in-one-live-session-4-october-2026).

A separate clean worktree at exact `21b90e2` builds production and runs the
existing city stress driver against its private preview on port 4398:

```sh
BRICK_BENCH_URL=http://127.0.0.1:4398/ FORCE_COLOR=0 npx tsx scripts/stress-benchmark.ts --model city --parts 20000 --profiles desktop,mobile --play-frames 10 --no-recovery --label contact-city-21b90e2
```

The helper rounds 20,000 requested parts to 13 complete blocks / 19,760
occurrences. Generated model SHA-256:
`0443f70615d5edc2f641ef7a7660958b2d49b55ea98b777bd64b57b1373ee923`.
Both desktop (1440×1000) and mobile (390×844, DPR 3, touch) pass strict readiness,
enter/reenter Play walk, and report no geometry refusal or page error.

| City profile | First render | JS heap before / load / Play | RSS load / Play | Play entry / reentry | Mean fixed tick |
| ------------ | ------------ | ---------------------------- | --------------- | -------------------- | --------------- |
| Desktop      | 5,447 ms     | 13 / 42 / 55 MB              | 521 / 678 MB    | 1,648 / 1,350 ms     | 0.51 ms         |
| Mobile       | 4,798 ms     | 13 / 42 / 55 MB              | 512 / 622 MB    | 1,698 / 1,410 ms     | 0.31 ms         |

Each profile reports 29 variants, 2,986 prototype triangles, 2,290,288 counted
scene triangles / 8,348,600 full triangles, below its existing scene budget
(60M desktop / 24M mobile), with `reducedQuality: false`. Play has three colliders,
680,888 welded static triangles and 335,394 vertices. The expected collision
budget warning discloses omitted studs/underside tubes on all 19,760 parts and
session-only ground. Build succeeds; the private server stops afterward.

This city has no authored moving mechanism. Its Chromium SwiftShader results
prove profile/resource/entry smoke, separately from the combined-drive check.
Desktop realistic/inside median frame intervals are 2,243 / 2,181 ms, so these
results neither establish acceptable rendering performance nor measure phone
FPS. Raw evidence remains private in `.local/perf/stress-contact-city-21b90e2.json`
and source/bundle hashes in `.local/city-21b90e2-source-metadata.json`.

## Indexed mechanical contact policy (4 October 2026)

Group-pair indexes remove repeated sorting/JSON encoding and bearing scans from
each sweep/native-hook lookup. Geometry, actual mating predicates and limits
remain unchanged. TypeScript and formatting pass. Four focused unit files pass
37/38 checks; the one native bore/180-tick case times out at 5.306 seconds while
other work runs on the shared VM. Rerunning that case alone passes in 3.30 seconds
with its original five-second deadline. The other contact obstructions, native
spur load/reaction/replay, kinematic accumulated turns and multirig checks pass.

Two fresh combined-drive trials retain identical poses, phase, collider counts,
source and third-copy refusal. Kinematic means are 18.43 / 23.21 ms per fixed
tick, native 26.45 / 26.71 ms. A repeated isolated spur probe retains 1,924 source
children, 7,011 native hook calls / 5,754 exclusions, and the prior actual
coordinates. VM load is higher than the earlier measurements, so the evidence
supports lower sampled kinematic cost without a controlled speedup or
native-performance claim. See [hashes and measurements](PLAY-CONTACT-COSTS.md#indexed-contact-relationships-4-october-2026).

## Clear and closer whole-mechanism overview (4 October 2026)

Fit now solves the four shifted perspective-frustum planes for every live group
bound, reserving the measured status bar plus 12 px and the control sheet.
The camera remains ahead of all group bounds at Fit. Manual zoom permits closer
inspection (minimum 0.25×); Fit restores 1× and closing restores the explorer.
This replaces the enclosing-sphere distance that left narrow phones underused.

- Six unit viewport cases project every conservative group corner through
  multiple orbit angles and moving-arm poses, including a 76 px top reserve;
  all pass in 0.92 seconds. An independent review verifies the shifted-frustum
  inequalities and positive-depth condition. TypeScript and production build pass.
- Seven existing production-browser control cases pass in 2.1 minutes at
  1440×1000, 1080×1800, 360×600, 411×685, 390×844 and 686×411, including native
  controls at 360×600. Held input/release, context restoration, scrolling,
  source invariants and camera interaction assertions remain intact.
- Four combined-build production-browser cases pass in 1.4 minutes: 26 pinned
  parts, nine groups and two motors, each kinematic/native at 1440×1000 and
  360×600. Six independent choices omit coupled output controls. Both drivers
  advance their 8:24 outputs and brake on release. Zoom 2.5× and 0.5× changes the
  camera; Fit restores it exactly. All 72 full compiled-geometry group-bound
  corners remain clear of the actual canvas/header/HUD/sheet. Query, LDraw
  export and complete inventory preview are identical after Play exit.

At 360×600 the clear rectangle is x=0…360, y=144…284. Native combined-build
projected bounds change from x=100.85…246.55, y=156.93…199.33 to
x=16.25…297.77, y=175.36…270.38, increasing their projected bounding area by
4.33× while preserving clearance. The kinematic increase is 4.47×. These are
camera-layout measurements, not frame-rate claims. Desktop and phone captures
were inspected in the bounded confirmation pass; no further styling changes.

Tested SHA-256:
`browser.ts` = `7af580b0e834b5a261564215d8f86c514f76f58d173ed512e4b46eb859e379d3`;
`mechanism-view.ts` = `39f636c5f8decf23461705c9de731fd8d8f5b273cd60dfdf2a8acc4a53942441`;
`PlayMechanismControls.tsx` = `ca7ff04e8285b1e33466a3793a53b08b9255076ef89007ffa17a3e6c449bbf82`.
Both private previews stop; ports 4397/4398 are free. Source hashes, prior/new
projection measurements and JSON/PNG witnesses remain private in the platform
worktree's `.local/combined-controls-tight-*.json` and
`test-results/combined-controls/`. No runtime asset or dependency is added.

## Rack translation contact characterization (4 October 2026)

`npx tsx scripts/audit-rack-contact-translation.ts` runs from the committed pinned
library without private candidate assets. Two fresh native worlds use identical
3,212-triangle housing geometry and one source-derived convex rack region, with
enabled joint contacts, one-kilogram moving mass, zero gravity and no CCD.
After five ticks, maximum force is 0.000228 N at the origin and 795.52 N after
translating both bodies by 3.2 m in Y. Geometry hashes match between trials;
reported initial relative Y differs by approximately 1.49e-7 m after native
Float32 storage. Force events and post-step geometric/solver reports are separate.
TypeScript, diagnostic execution and formatting pass. This is a reproduction
of the unresolved contact behavior, not acceptance of the complete rack.

The same public diagnostic with `--triangle=749` keeps only three source vertices
and one triangle. It reproduces 223.05 N on the translated first tick, three
active solver contacts and 6.50676 N·s summed contact impulse. The origin maximum
over five ticks is 0.000110 N. Matching geometry hashes rule out differing mesh
content; no compound, multi-triangle traversal or Play filter is present.

Independent review of the private 1,245-prism rack candidate establishes
area-preserving extracted sections within stated tolerances, 29 native
containment tests including all 32 teeth/gaps, and zero mismatches in 16,804
source occupancy samples. Complete native motion still stalls. The private
housing approximation fails source controls, so its failed motion trials cannot
establish source-correct housing behavior. See [the bounded evidence and limits](reviews/RACK-SOURCE-REVIEW.md#private-thick-section-candidate-review).

## Offline Technic mechanism witness — 4 October 2026

`tests/browser/offline-mechanisms.spec.ts` exercises the original 13-part CC0
8:24 shaft/gear and pin-arm arrangement using actual pinned official geometry.
It renders the source online, explicitly installs the offline snapshot, verifies
all 13 required complete-library chunks are cached, disconnects Chromium's
network, reloads, and re-imports the source into fresh page memory. Dynamic Play
then initializes from the cached WASM-bearing asset. The test requires that
asset to remain unloaded until Play entry and to arrive through the service
worker while offline.

Held keyboard control advances the sole motor beyond 90°, the output retains
its signed 3:1 phase, all eight shaft/gear/bush accessories move, release brakes,
and the independent pin arm reaches 45°. Exiting preserves the complete query,
LDraw export bytes and inventory preview. The source still contains 13 physical
occurrences. The unchanged preview resolves four purchasing units; the witness
does not claim mappings for every Technic occurrence. No page errors are accepted.

The isolated production build passed (Vite 57.42 s), and the focused browser
witness passed in 57.6 s on SwiftShader at 1440×1000. This is offline behavior and
source-preservation evidence, not a physical-phone or frame-rate measurement.
A focused evidence replay passed in 35.6 s: input 179.7579°, output −59.9180°,
arm 45.0000°. All 83 observed page responses (49 unique URLs) came through the
service worker, including one lazy session-asset response. Source parts are
loaded directly from their verified Cache Storage entries, so those cache hits
do not appear as page network responses. The private preview used port 4402 and
was stopped afterward. Final type-check and formatting checks passed.

The preceding baseline also passed offline, but exposed an eager dependency:
Rapier's embedded WASM was in the main 9,503,376-byte asset. Moving the pure seat
point calculation out of the native collision module keeps that dependency
behind Play entry. The resulting main asset is 5,157,900 bytes without WASM;
`session-DWgQd3lE.js` is the lazy 4,477,946-byte WASM-bearing asset. All emitted
assets are already covered by the opt-in snapshot; no new caching policy,
runtime assets or dependencies were introduced. Bundle filenames are this
checkpoint's observations, not a public API.

The verified source-only extraction has SHA-256 hashes:

- `src/play/seated-profile.ts`: `17d41242ecfbe66e67506a47067c810a5a636ac07a323ee63b9463c0a5b81933`
- `src/play/vehicle-seat.ts`: `9a5e3b07becae8811ef8c2b7e20dbb5ac1d0dad7c321af7fbf9d9a20fbe4ff4d`
- `src/play/browser.ts`: `31d4c1fdfece4821bc20a0e5ff3e49591519b2c35553fca702a24a321997f5c8`

## Twin-loop steering acceptance (4 October 2026)

The original CC0 bench has six groups, eight occurrences, five mount joints and
two real native closure joints. One +/-25° input drives four passive coordinates
with +/-50° stops. Geometry and native save/restore retain the fixture exactly.
It is a steering linkage acceptance scene, without Ackermann or tire calibration.

- Nine unit checks pass in 27.04 s: rotated-frame deterministic reversal,
  cold-toggle/passive-input/limit refusal, swept/native repeated targets,
  fixed-wheel stall/recovery, reflected output inertia with a 2 N·m motor,
  and actual rotated world-obstacle response at 10 and 100 N·m. Closure is
  measured at every tick; tested normal/load and 10 N·m contact remain below
  0.1 LDU. The 100 N·m impact uses an explicit 0.2 LDU bound, with measured
  transient approximately 0.174 LDU. Source and rest export remain unchanged.
- The prior seven steering checks and fifteen existing linkage checks pass
  together in 45.89 s with one worker. An initial concurrent run hit the
  unchanged four-bar deadline; the isolated rerun retains that deadline.
- Four production-browser cases pass in 1.2 minutes at 1440×1000 and 360×600
  in kinematic and Dynamic modes. Wheel/source transforms and captures change,
  both closures remain bounded, source query/export/full inventory stay exact,
  and all eight posed occurrence matrices match after static posed re-import.
- The isolated build passes in 48.92 s; TypeScript and full formatting pass.
  Port 4401 is stopped/free. Raw logs and captures remain private in
  `/home/ubuntu/brick-editor-steering/.local/` and its `test-results/steering/`.

The runtime kernels are unchanged by this fixture. The pure seat-point extraction
has seven separate existing seated-profile, browser-seat and native-seat unit
checks passing in 7.45 s, and its offline lazy-entry witness above passes.

## Independent motor controls and official car mounts (4 October 2026)

The isolated worktree is `brick-editor-real-mechanics`, branch
`codex/technic-controls-examples`. These checks use actual pinned geometry,
ordinary source admission and the app-rendered interface. No motor binding,
wheel seat, collision allowance or resource cap is bypassed.

- 33 focused unit checks in five files pass with one worker (444.64 s on the
  shared VM): canonical motion-template sources and chooser entries, complete
  offline closure, both independent sample drives, real PF-M effort scaling,
  continuous turn/reversal, braking, preset restoration and source isolation.
  Quarter power caps native effort at 12.5 against the authored 50; zero removes
  powered effort. Dynamic zero-power recoil is bounded rather than assumed
  perfectly frozen. The two-stage sample obstruction allows six simulated
  seconds to settle and recovers after the foreign blocker is removed.
- Four production Twin motor table cases pass at 1440×1000 and 360×600, in
  Kinematic and Dynamic modes. Both motors run independently at different
  fractions and directions; their signed transmission ratios, selection
  memory, Brake all and close/overview restoration are checked. Source query,
  native/LDraw export and full inventory remain exact.
- The final production interface regression batch passes all 33 cases in
  9.3 minutes with one worker. It includes the seven required control viewports,
  Reverse → Power 0 → Power 50% restoring reverse, cold offline Twin opening
  in both modes, combined/linked motor controls, rapid House/Café sliders, real
  thin-wall stop/retry and source-bound setup/review/Try at all required sizes.
  Existing native documents, source exports and inventory remain unchanged.
  Eleven fresh interface captures were inspected; the bounded Impeccable finish
  reviewer scores its listed documentation fix resolved with `ship` at that
  fix scope. The detector and visual rounds were not repeated for assertion fixes.
- Source-mounted official-car unit checks cover 2441/4600/6157 holders,
  4624/3641, 6014b/56890 and 93593/93595/50951 families; arbitrary horizontal
  yaw and source-relative driving; disconnected/tilted/unsupported refusal;
  real obstacle response and inventory/source preservation. The shared-ground
  owner reports 27 focused walking/native/vehicle checks passing in 54.87 s,
  including real floors and foreign walls above the derived temporary plane.
- Root confirmation passes 11 shared-ground and rounded-export checks in two
  files (32.30 s). The full production build passes (Vite 40.18 s), pinned
  library validation passes, and the generator reproduces the Twin preview.
  The Impeccable origin scan reports 15 app-rendered previews with zero missing
  provenance records.
- Native source-heading confirmation (5 October) passes 18 checks across eight
  yaw/car cases, three dynamic-seat regressions and seven shared-ground cases
  in 55.70 s. Actual 31027/30572 cars drive forward, reverse and steer at
  37°, 90° and 180° with wheel support and exact source preservation. The
  correction changes the native speed sign to source forward while preserving
  cached velocity-norm magnitude and sample time; the unchanged seated head-stop
  recovery still passes. Reported forward/reverse snapshots remain below
  170 LDU/s with the existing 160 LDU/s fixed-tick cap; this is not a claim
  about every intermediate peak. See [native yaw review](reviews/NATIVE-VEHICLE-YAW.md).
  The final production build passes (Vite 36.61 s); rendered seated native
  Jeep driving and safe exit pass at 1440 px and 360 px in 49.1 s.
- Actual full public 31027 Blue Racer and 30572 Race Car imports pass four
  production cases on desktop and phone in 59.1 s. The rotated Race Car drives
  and exports all 68 parts; Blue Racer exports 59 car parts while its eight
  original cone parts stay static. Source metadata and default ground remain
  enabled. The separate 6503 car excerpt drives, while the full original with
  its separately rooted minifigure is an honest obstruction limitation.

Raw logs and captures remain private under `.local/` and `test-results/physical/`
in the isolated worktrees. Software-WebGL checks do not establish physical-phone
frame time, tire calibration or actual LEGO motor torque.

### Full-CI follow-up (5 October 2026)

The first main run passed the full unit/integration suite, library validation,
build, six general browser shards, both Photo shards and the performance shard.
Two remaining shards exposed three cases: the chooser's expected titles omitted
Twin motor table on both sizes, and foreign below-origin scenery could lower the
vehicle ground beneath an authored seat approach. The latter reproduced locally:
two real 3005 bricks chose Y=24 beneath a Roadster supported at Y=0, so boarding
failed the existing three-LDU supporting-surface guard. Publication was gated off.

Floor selection now uses only complete, certified vehicle group geometry and
wheel support envelopes. Foreign scenery keeps its actual collisions and does
not select the temporary plane. Eight focused ground checks pass in 31.13 s,
including Roadster boarding, blocked exits, reversing clear and exact source/
export/inventory preservation. The official 6503/31027 native and Kinematic
checks remain; a real floor and foreign wall are checked with temporary ground
disabled as well. The chooser expectation includes the generated Twin card, and
the blocked-exit browser case now verifies boarding before attempting its drive.

The corrected production build passes (Vite 46.95 s), full formatting passes,
and the three failed browser cases pass together in 2.3 minutes: blocked-seat
boarding/exit/reverse recovery and the desktop/phone full chooser. No collision
allowance, seat clearance, source placement or template layout is weakened.

The corrected main run passed those seat and chooser cases, but a timed train
hint observation expired at 600 × 360. That isolated case passed locally;
retrying the shard passed 600 × 360 but exposed the same observation race at
800 × 360. The test now installs an animation-frame observer before entering
Play, and retains the two control rectangles only while the look hint is
visible (opacity above 0.5) and the actual Stop train control is present. The
existing 15-second wait reads that captured frame after the tap resolves. All
three train viewports pass together in 4.2 minutes. The running-state overlap
assertion, other layout checks, six-second product timers and time limits remain
unchanged; no runtime or UI change was needed.

## Play and model tools critic loop (5 October 2026)

- **Loop:** two independent agents drove the built app with Playwright each round, one over Play (walking HUD, pause sheet, vehicles and seats, motor controls, trains, settings) and one over the model tools (Build, Instructions, Photo, Project), at 1080 × 1800, 390 × 844, 360 × 600, 686 × 411 and 844 × 390 (touch), 820 × 1180 tablet and 1440 × 1000. Scores by round: Play 7.0, 7.6, 7.9, 8.1, 8.3; model tools 6.4, 6.9, 6.8, 7.0, 7.2. Neither reached the 8.5 target in five rounds; the critics' remaining Play gap is split between UI and engine/camera work (train camera, Drive from here, Get out placement, car spawn), and the model tools' between landscape sheets, the desktop title shown twice, My builds thumbnails and the picture's manifest download.
- **Driving pads:** two-finger CDP touch drove and steered at once at every phone size; a third finger looked around; a second finger tapped Get out while the throttle was held. `play-interaction.spec.ts` and `play-seats.spec.ts` drive through the pads.
- **Sheets:** the camera adjustment beside phone and tablet sheets was checked by projecting the build's bounds (it sits in the free band) and by the dimming capture test (pictures are unaffected). Full-viewport headless screenshots can paint a pale rectangle over the canvas beside sheets; clipped captures of the same frame show the model, so it is a capture artefact.
- **Browser specs:** layout, Play, vehicles, seats, mechanism controls, selection, inspector, transform, instructions (generation, viewer, dimming), menus, mechanisms and Gallery pass locally. The timed train look-hint layout check (`hud-layout.spec.ts`, Train controls at 600 × 360 and 800 × 360) times out intermittently under load locally and in CI.
- **Not checked:** a physical phone; engine and camera items reported by the critics (train third-person camera clipping into wagons, Drive from here leaving the car out of view, Get out facing away, keyboard throttle speed) belong to the Play engine work.

### Native ball construction data (5 October 2026)

Five focused data cases plus nine existing mechanism/dynamics-data cases pass
(14 cases, 7.64 seconds), with TypeScript passing. The tests use all three original
Arocs ball fits, validate the regenerated schema and native save/restore, preserve
LDraw export and original anchors, refuse undeclared gaps and excessive declared
gaps, reject forged membership/endpoint/fields and incompatible joint options,
keep mixed kinematic assemblies static, refuse movement/rebasing atomically, and
refuse ordinary eligibility even when a declared pair happens to coincide. This
checks the saved request and static preview contract; it does not certify native
readiness or whole-model admission.

### Source motor entry and native seating (5 October 2026)

Six actual-source preparation cases pass: original sealed packets are retained,
Kinematic seating is rejected before binding, copied/transplanted/stale packets
are refused, a failed roster does not publish partial bindings, and undeclared
sources cannot retain native construction tokens. Two direct Play-session cases
pass in 23.43 seconds including import/transform work (9.76 seconds of tests):
native seating becomes ready, readiness reports validate against the regenerated
API schema, targets are refused during settling, saved project/anchors/LDraw
stay exact, and direct Kinematic entry refuses before token publication. The
session fixture supplies active rig members separately from static geometry,
matching Browser Play's ordinary capture behavior.

The actual PF-L Browser/adapter regression now also checks the pre-entry source
review. A previously unavailable source assembly becomes eligible without
allocating a Play session, capturing native component geometry or changing the
project export. That case passes in 22.10 seconds including import/transform work
(8.92 seconds of tests).

The generated Large motor sample has 13 official source parts, including one
99499 inventory item and the red 3707 axle. The motion/template unit cases pass
(19 cases); its preview was generated by the app renderer. The Impeccable raster
provenance scan reports 16 sample rasters and no missing provenance. Both
production Large motor cases pass on desktop and a 360 × 600 phone (38.4 seconds)
after rebasing onto main `9250c06`. They check the Dynamic entry option, actual
independent rotor draw matrix, fixed casing and carrier, forward/reverse motion,
zero power and reverse-direction resume, visible operating state, no horizontal
overflow, unchanged query/LDraw/native contents and no page errors. Zero input
is checked by magnitude because reverse at zero power may report IEEE negative
zero. The integrated build passes schema generation, TypeScript and Vite
(56.90 seconds for Vite). The first production passes exposed the pre-entry
availability and cleaned-up source-label defects; the tests now exercise both
production paths and find the imported occurrence through its actual motor
binding. All six control-layout cases pass (2.7 minutes) at 1440 × 1000,
1080 × 1800, 360 × 600, 411 × 685, 390 × 844 and 686 × 411. Their assertions retain
44px targets, usable motor tabs, hidden exploration controls while operating,
separate in-bounds driving pads, a reachable nonoverlapping Get out action,
third-person driving with a hidden explorer, successful exit and no page errors.
The fresh independent Impeccable reviewer inspected all fourteen motor/driving
captures and returned SHIP for the Play UI and Large motor sample; the updated
surface brief records that evidence and preview provenance. Full mechanical
systems, complete chooser composition and unpictured accessibility/state
behavior remain outside that acceptance.

Both production phone exit cases pass at 360px and 1080px (1.2 minutes), including
a second finger releasing Get out while throttle is held, no subsequent vehicle
movement, restored third-person explorer visibility and successful re-entry.
The test releases the actual exit finger through Chromium's touch protocol;
source export and beside-the-current-vehicle assertions remain in force.

### Actual PF-L casing-bore contact partition (5 October 2026)

Eight source/contact cases pass (16.13 seconds including transform/import work,
13.45 seconds of tests). The complete original casing support-point multiset and
all 2,854 convex children remain exact after separating exterior 2,810, front 28
and bore 16. A bound thrust-disc contact permission checks the whole current and
predicted source envelope; withdrawal, lateral displacement, tilt, copied parts,
foreign source components and rotor pins refuse that permission. Actual foreign
obstruction still blocks the motor and removal restores motion. Thirteen motor
binding, actual Browser/adapter and native beside-vehicle exit cases also pass
(52.49 seconds including transform/import work, 31.69 seconds of tests).

The private contact diagnostic records 1,320 native queries in each of its later
five-tick Kinematic blocks versus 3,810 in the earlier recorded run. Fresh Node
Kinematic ticks measure 61.65–76.87 ms; Dynamic ticks 16.83–29.35 ms. These separate
shared-VM observations are not a controlled speed ratio or a phone benchmark.
Geometry, sweep and aggregate contact budgets remain unchanged. See the
[source-interface scope](reviews/POWER-FUNCTIONS-MOTOR-L-RUNTIME.md#measured-limits).

## PR #3 motor controls and third-person vehicles (5 October 2026)

- **Critic loop:** three Playwright-driven rounds over the motor Controls (`large-motor`, `twin-drive`, `motor-gears`, and a refused `large-motor` with its axle moved off the motor) and third-person vehicle entry/exit with the throttle and steering pads (`car`, `jeep`), at 1080 × 1800, 390 × 844, 360 × 600, 686 × 411, 844 × 390 (touch) and 1440 × 1000. Scores: 7.0, 7.5, 7.3; the last round's two causes (refusal note hidden on phones, Power ignored by a self-starting motor) were fixed afterwards and not re-scored.
- **Browser specs:** mechanism controls (all six layouts), large motor, twin/linked/combined controls, physics, all mechanisms and menus pass; the timed train look-hint check passes alone under load.
- **Open:** the rotor is small in Controls at 844 × 390; Get out leaves the first-person camera facing bodywork; motor tabs are numbered rather than named by colour or role.
