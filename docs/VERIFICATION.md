# Verification — 27 September 2026

The final production build, clean install and test suites pass. These results establish the implemented subset, not completion of the entire specification.

| Check                      | Result                                                                                                     |
| -------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `npm ci`                   | Clean lockfile install passes                                                                              |
| `npm run build`            | TypeScript and Vite 6.4.3 pass                                                                             |
| `npm test`                 | **237 tests pass**, 52 files, 0 failures                                                                   |
| `npm run test:browser`     | **98 tests pass**, 0 failures, against the production bundle                                               |
| Browser engine             | Playwright 1.63.0, Chromium 153.0.8010.12, SwiftShader software WebGL2                                     |
| Layouts                    | 1440×1000 desktop, 1080×1800 touch, 360×800 touch                                                          |
| `npm run library:validate` | 23 files and six physical parts; dependency closure, licence metadata and library/mapping hashes pass      |
| `npm audit`                | 0 known vulnerabilities at verification time                                                               |
| Formatting                 | Prettier check passes                                                                                      |
| Standalone CLI inventory   | 200-part fixture produces 100 white + 100 red 3001 units, without a browser                                |
| Standalone CLI render      | Fixed interior camera exports 800×600 PNG and revision/camera/library manifest                             |
| Subdirectory deployment    | `/brick-editor/` works on an ordinary Python static HTTP server, including library loading and PNG capture |

Browser tests exercise a 200-part UI fill, command recolour/undo, native round trip, inventory preview/download, exact camera/alpha PNG readback, real starter geometry, both touch layouts, texture strict-refusal, fixed-colour decoration surviving repaint, reflected custom geometry, two-pointer placement separation, locked-layer atomicity, offline inventory, Photo UI transparent capture and cancelled import isolation. The domain suite also covers source paths/cycles, affine math, local-name override protection, XML escaping/invalid characters, stale inventory previews, native checksums, quota recovery, layer disposition, occurrence-scoped metadata, bookmark history, imported steps, revision monotonicity, unsafe source-record injection and a 10,000-reference parser fixture.

The first conformance run exposed a real loader integration failure: `s/` subparts were being rewritten to unresolved paths, and the loader returned empty groups after swallowing errors. The final adapter supplies an explicit embedded file map, checks for failed dependency attempts and rejects empty official prototypes. A separate material-cache issue was fixed by compiling colour directives in the same loader instance as the geometry. No placeholder cuboids stand in for the audited starter parts.

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

Request regressions cover encoded UTF-8 accounting, shared values, cycles, inherited/accessor rejection, nesting/work limits, aggregate transaction refusal before mutation, Unicode-heavy cut atomicity, and CLI command-file limits before parsing or output. The independent review found and verified fixes for the clipboard UTF-16/UTF-8 mismatch and inherited array getters. The scope regression checks 100,000 selections with a bound on path visits instead of a timing threshold. Empty paths and unknown selected descendants cannot widen a scope silently.

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
