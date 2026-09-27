# Independent conformance audit

2026-09-27. Audit against spec sections 22.1–22.3. This is an evidence assessment, not a blanket compatibility claim. The user reprioritized Play ahead of unfinished P0 gates. Source and tests were inspected; the additional stress and failure-path checks below were executed against the production preview.

## New executed evidence

- `tests/browser/conformance.spec.ts`: **2 passed**. A 5,001-part document rejects renderer readiness explicitly while preserving all 5,001 occurrence IDs and inventory quantities. Simulated WebGL initialization failure returns `WEBGL_UNAVAILABLE` while template import, inventory preview and native export remain usable.
- [5,000-part report](reports/performance-5000.json): actual pinned 3001 geometry, two audited colours, 1920 × 1080 software WebGL capture. Shell 366.0 ms; command 344.9 ms; scene readiness 415.1 ms; inventory preview/export 152.3 ms; PNG capture 9,156.8 ms. Render statistics: **15,001 calls, 3,500,000 triangles, 3,480,202 lines**, 68,219-byte PNG. Entire fixture was within the camera frustum. Measurements are one run in Linux ARM64 Chromium/SwiftShader, not hardware FPS, p95 latency or physical-phone evidence.
- Mobile Play runtime audit discovered and verified fixes for an initial sheet blocking entry and a negative first-frame delta stopping movement. See [UX audit](UX-AUDIT.md).

## Acceptance evidence matrix

“Partial” means existing implementation/tests address part of the stated condition but do not establish the entire acceptance gate. “Missing” means required behavior or adequate evidence is absent. A scoped pass is deliberately limited to its named fixtures.

| IDs          | Current evidence and conclusion                                                                                                                                                                                             |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| LD-01, LD-02 | Unit fixtures establish repeated definitions, inherited colour, stable occurrence paths, affine movement, copy-on-write and undo. Nested reference-image placement remains narrower than the full visual gate. **Partial.** |
| LD-03        | Browser fixed-colour repaint fixture plus inherited-colour unit tests. Full custom finish/material scope and edge-colour corpus absent. **Partial.**                                                                        |
| LD-04        | Mirrored/type-5 fixture renders; no reference-versus-optimized image tolerance suite. **Partial.**                                                                                                                          |
| LD-05        | Native source records and strict texture refusal tested; comprehensive embedded-image asset round-trip not demonstrated. **Partial.**                                                                                       |
| LD-06        | Cycle, traversal, duplicate names, malformed numbers, missing refs and filename-tail tests. Wider dependency/security corpus remains. **Scoped pass for committed cases.**                                                  |
| LD-07        | 200 placements and raw primitive transforms round-trip; no separately published semantic manifest measuring every approved fixture to 0.0001 LDU. **Partial.**                                                              |
| LD-08        | Layer/ID/source/bookmark/plan metadata tests; asset and future rig/migration cases incomplete. **Partial.**                                                                                                                 |
| LD-09        | Per-layer inventory archives exist; independent-resolution LDraw archive/recombination gate lacks evidence. **Missing.**                                                                                                    |
| ED-01        | Locked-target atomic rejection and history invariants tested in unit/browser paths. **Scoped pass.**                                                                                                                        |
| ED-02        | Batch fill/recolour/replace and undo covered; full metadata/unsupported-target corpus narrower than gate. **Partial.**                                                                                                      |
| ED-03        | Reference groups retain occurrence handles; no optimized batch-repacking regression yet. **Missing optimization-specific evidence.**                                                                                        |
| ED-04        | Hidden obstacles and one-entry fill undo tested. **Scoped pass for rectangular single-part fill.**                                                                                                                          |
| ED-05        | Visible-versus-through geometric selection unavailable. **Missing.**                                                                                                                                                        |
| UI-01, UI-02 | 360 and 1080 touch flows, explicit placement, multipointer rejection and independent 8.7/10 review. Advanced absent editor tools remain outside demonstrated scope. **Scoped pass.**                                        |
| SV-01        | Quota/corrupt-head recovery unit evidence; native backup accessible. Full interruption points and UI fault-injection corpus incomplete. **Partial.**                                                                        |
| SV-02        | Stored revision rejection and Web Locks present; migrations and non-Web-Locks concurrent-writer strategy incomplete. **Partial.**                                                                                           |
| RN-01, RN-02 | Exact interior camera/alpha/dimensions and readiness/cancellation tested. Broader concurrent import/render combinations remain. **Scoped pass.**                                                                            |
| RN-03        | New test proves non-graphics workflows survive WebGL initialization failure. Context-loss restoration/document retention still lacks equivalent automated coverage. **Partial.**                                            |
| BL-01        | Deterministic strict XML, escaping and required quantity format tested. **Scoped pass.**                                                                                                                                    |
| BL-02        | Repeated submodels/physical boundaries and local override protection tested; verified composite decomposition and variant fixture packs absent. **Partial.**                                                                |
| BL-03        | Scope and inherited-colour tests cover core cases; broader submodel/layer interactions remain. **Partial.**                                                                                                                 |
| BL-04, BL-05 | Blocking, partial report, explicit override, escaping and stale-preview tests. Ambiguous candidate UI/composite corpus incomplete. **Scoped pass for supported curated mappings.**                                          |
| BL-06        | Browser offline, Node CLI, touch XML flows and Play isolation tests; no exhaustive row-for-row UI/API/CLI corpus. **Partial.**                                                                                              |
| BL-07        | No authorized destination upload performed. **Missing; cannot be inferred from XML validity.**                                                                                                                              |
| IN-01        | Root imported steps/layer plans supported; repeated nested instruction semantics need more fixtures. **Partial.**                                                                                                           |
| IN-02        | Assembly heuristic unavailable; no fabricated buildability claim. **Missing feature, honestly declared.**                                                                                                                   |
| PL-01        | Triangle-world door, ceiling, step and ramp tests plus browser exploration. Larger authored exploration corpus still limited. **Partial.**                                                                                  |
| PL-02        | Authored revision isolation tested; explicit pose application unavailable. **Partial.**                                                                                                                                     |
| PL-03        | Kinematic wheel/hinge mechanisms unavailable. **Missing P2 feature.**                                                                                                                                                       |
| PL-04        | First-person body hidden; fixed-tick API and non-pointer-lock capture available/tested. **Scoped pass.**                                                                                                                    |
| PL-05        | Original rigid avatar and camera switching implemented; joint-pivot/gait-against-wall rendered reference evidence incomplete. **Partial.**                                                                                  |
| PL-06        | Thin wall, ceiling, step, slope and sphere-swept camera unit cases. Arbitrary custom transforms/materials/room corpus not certified. **Partial.**                                                                           |
| PL-07        | Touch movement/look/jump and lost-input browser tests plus manual emulated-touch audit. Physical phone testing not performed. **Scoped pass.**                                                                              |
| PL-08        | Fixed-tick repeatability and exit camera restore tested; repeated-entry GPU/listener growth measurements absent. **Partial.**                                                                                               |
| SEC-01       | Archive traversal/checksum/resource bounds and cancellation tested; share fragments and comprehensive adversarial cancellation corpus not available. **Partial.**                                                           |

## Fixture and performance gaps

Section 22.1 is not fully satisfied. Existing fixtures include wall, room/interior camera, nested models, custom/fixed-colour geometry and synthetic collision cases. Missing or insufficiently independent evidence includes transparent-material references, full mirrored/conditional-line pixel comparisons, printed/left/right purchasing variants, verified composites, full native image assets, opening door/wheeled mechanism and separately stored expected semantic manifests across all fixtures. Provenance needs to accompany every newly added fixture.

The 5,000-part software run proves bounded completion, not the 60 FPS objective. The implementation currently uses reference groups and distinct colour prototypes. The 15,001 calls make renderer batching the highest-impact performance follow-up. There is no measured 1,000-part physical-phone 30 FPS result, repeated 1,000-change p95 under 100 ms, long-task distribution, decoded texture/peak-memory profile or context-restoration stress report. Demand rendering exists by code inspection; idle frame-count verification would strengthen that claim.

## Recommended next work

1. Add correctness-preserving repeated-part rendering batches with occurrence mapping, mirrored-transform handling, conditional-line attributes, selection and per-capture visibility tests. Compare images against the existing reference path before enabling it broadly.
2. Close per-layer portable LDraw and source/asset round-trip cases; publish semantic fixture manifests.
3. Verify save conflict/recovery UX with actual concurrent pages, migrations, sustained-input maximum delay and interrupted snapshot writes.
4. Add context-loss restoration and repeated Play entry/disposal browser tests with GPU allocation counters.
5. Implement visible/through selection and clipboard/array workflows with undo/identity tests, then broaden inventory composites and instruction planning.

This audit is a dated snapshot; later work must update capabilities and status only when corresponding evidence exists.

## Follow-up: reference-preserving batching

Implemented a render-only batching cache after this audit. Original occurrence handles remain authoritative for selection, picking and collision extraction. Repeated opaque meshes use instancing; transparent, reflected and sheared meshes retain reference rendering. Ordinary and conditional lines are merged with full affine transformation of positions/control points and linear transformation of direction vectors. Visibility changes repack render-only data and restore original handles after every draw, including exceptions.

- `tests/unit/batching.test.ts`: **5 passed**, covering instance identity/visibility, exception restoration, reflection/shear/transparency fallback, conditional-line affine attributes and multi-material line groups.
- `tests/browser/batching.spec.ts`: **1 passed** against an isolated production build, two cameras × all/explicit occurrence visibility, with real pinned 3001 geometry, repeated current/fixed-colour custom parts, conditional lines, reflected/sheared placements and transparency. Every comparison had mean RGBA-channel error below 0.35/255 and fewer than 0.2% of channels differing by more than 16/255. Every batched view used fewer calls. The original inline synthetic arrangement is CC0-1.0; official part provenance remains the pinned library manifest.
- [Batched 5,000-part report](reports/performance-5000-batched.json): **7 calls** instead of 15,001, with unchanged 3,500,000 triangles and 3,480,202 lines. Sequential single-run command 418.4 ms, readiness 420.5 ms, inventory 132.8 ms, PNG 12,702.5 ms. [Reference baseline](reports/performance-5000-reference.json) remains available.

The draw-call reduction is established. A capture-speed improvement is **not** established: this cold software-rendering capture was slower than the earlier reference run. Batch construction, driver behavior and timing variation require separate warm/cold measurements before making performance claims. These results strengthen LD-04/ED-03 evidence only for the committed fixtures; they do not establish whole-library equivalence or the 60 FPS gate.

## Follow-up: distinct quality profiles and capture state

The renderer now provides versioned Fast/Balanced/Photo settings and bounded independent edge, shadow, shadow-map, pixel-ratio, tone-mapping and exposure controls. Fast suppresses authored edges and uses a lower DPR cap; Balanced retains the prior default lighting/tone pipeline; Photo enables soft shadow maps. Transparent materials retain the reference sorted path. Environment maps, screen-space ambient occlusion and user-authored light rigs remain unsupported.

The capture request accepts optional `qualityControls`; it applies the requested profile temporarily and restores interactive controls after both successful captures and errors. The manifest records the resolved profile, actual light positions/colours/intensities/shadow camera/map settings, clipping state, output pipeline, GPU limits, app version and asset hashes. Capture statistics are recorded immediately after the offscreen draw.

Evidence: two quality unit tests plus five batching unit tests passed. The expanded batching comparison passed for Fast and Photo in addition to Balanced. `tests/browser/quality.spec.ts` passed on an isolated production build: all three defaults produced distinct PNGs, the expected light/shadow/size metadata was returned, explicit overrides took effect (a Photo profile overridden to Fast image settings exactly matched the Fast PNG), and the interactive profile survived success and an unknown-occurrence failure. This improves section 13.4/16.3 coverage without claiming all lighting/background/clipping UI options are implemented.

## Follow-up: scoped source interchange

Six focused interchange tests now cover hierarchy-preserving scoped export, ancestor colour/BFC source retention, complete embedded dependency closure, deterministic scoped names, orphaned `INVERTNEXT` removal, indented MPD recognition/boundary rejection and reflected raw-polygon winding. The CC0 [scoped-material fixture](../fixtures/ldraw/scoped-materials.mpd) has a separate [expected semantic manifest](../fixtures/ldraw/scoped-materials.expected.json). The focused interchange/core/share run passed 39 tests.

These tests prove source structure and semantic placement/colour preservation for the fixture. They **do not independently prove rendered ancestor-BFC equivalence**: inherited inversion/culling in the renderer still requires its own image evidence. Full local material/finish and texture semantics remain outside this source-export claim.
