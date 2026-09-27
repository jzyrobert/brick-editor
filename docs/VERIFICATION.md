# Verification — 27 September 2026

The final production build, clean install and test suites pass. These results establish the implemented subset, not completion of the entire specification.

| Check                      | Result                                                                                                     |
| -------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `npm ci`                   | Clean lockfile install passes                                                                              |
| `npm run build`            | TypeScript and Vite 6.4.3 pass                                                                             |
| `npm test`                 | **142 tests pass**, 32 files, 0 failures                                                                   |
| `npm run test:browser`     | **62 tests pass**, 0 failures, against the production bundle                                               |
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
