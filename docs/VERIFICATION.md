# Verification — 27 September 2026

The final production build, clean install and test suites pass. These results establish the implemented subset, not completion of the entire specification.

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
