# Verification — 27 September 2026

The final production build, clean install and test suites pass. These results establish the implemented subset, not completion of the entire specification.

| Check                      | Result                                                                                                     |
| -------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `npm ci`                   | Clean lockfile install passes                                                                              |
| `npm run build`            | TypeScript and Vite 6.4.3 pass                                                                             |
| `npm test`                 | **165 tests pass**, 38 files, 0 failures                                                                   |
| `npm run test:browser`     | **71 tests pass**, 0 failures, against the production bundle                                               |
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

Initial shell/library readiness was approximately 579 ms. The first capture includes shader warmup; the later case benefits from cached prototypes/shaders. The single 1,000-part command-plus-scene result does not establish the specification's sub-100ms p95 target. Frustum culling remains enabled. Hardware FPS targets remain unverified. A later 5,000-part comparison reduced draw calls from 15,001 to seven, with matching geometry counts; cold software PNG capture increased from 9,156.8 ms to 12,702.5 ms. This establishes draw-call reduction, not an FPS improvement. The production application JavaScript is approximately **391 kB gzip**, with separately loaded Rapier (about 1.65 MB gzip) and PDF (about 182 kB gzip) chunks, excluding worker scripts/library. Vite still reports its advisory about the uncompressed main chunk exceeding 500 kB; further splitting is deferred.

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
