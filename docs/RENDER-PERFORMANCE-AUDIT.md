# Viewer performance audit — 11 October 2026

The audit covers startup and asset boundaries, official-part compilation and caching, Standard/soft outlines, Realistic, Photo's moving preview and path-traced stills, raster fallback, shadow invalidation, GPU resource disposal, and large-scene/Play/offline regressions. Baseline: `f0cd3a2` (`origin/main` at the start of the audit). The accompanying [measurement record](reports/render-performance-2026-10-11.json) retains individual frame samples and capture results.

## Environment and interpretation

Production Vite bundles, Node 22.14, Chromium/SwiftShader on the shared ARM64 development VM. Desktop: 1440 × 1000 at DPR 1. Phone emulation: 390 × 844 at DPR 3 with the mobile resource profile; moving views retain the existing density/geometry reductions. These are software-renderer measurements, not physical-phone FPS, GPU memory, field Core Web Vitals, or reference-hardware acceptance results.

The look benchmark imports the deterministic 5,000-part, 100-variant architectural stress model with a blank backdrop. Each look gets two warm-up camera frames and six recorded frames. It records renderer submission time, draws, triangles, cached-shadow passes, and completed-frame wall time (a `gl.finish()` fence). The default camera workload replaces the camera through the public API while a gesture is held. This exercises view changes and resize invalidation; **it is not a claim that ordinary OrbitControls previously redrew shadows**. `--camera orbit` measures ordinary camera movement separately. Photo's path budget is exceeded by this model, so its still would use raster fallback; the finishes fixture below independently exercises actual path tracing.

Fresh browser contexts have empty application caches; later contexts in one Chromium process can reuse driver shader caches. Timings are observations from a shared CPU, not confidence intervals. Byte counts, work counts, explicit resource disposal and matched pixels are the strongest evidence. CPU profiles, network entries, long-task observations and accessibility snapshots are emitted locally by the benchmark for inspection.

## Changes and measurements

| Deterministic work                                      |           Before |                    After |
| ------------------------------------------------------- | ---------------: | -----------------------: |
| Initial entry JavaScript                                | 10,064,088 bytes | 5,618,919 bytes (−44.2%) |
| Entry gzip (Node zlib defaults)                         |  2,672,535 bytes |   990,142 bytes (−63.0%) |
| Realistic desktop draws / camera replacement            |              222 |             113 (−49.1%) |
| Realistic phone draws / camera replacement              |              219 |             110 (−49.8%) |
| Photo preview draws / camera replacement, both profiles |              223 |             113 (−49.3%) |
| Shadow-map redraws after first map, per replacement     |                1 |                        0 |
| Photo scene inspections across 8 held camera frames     |                8 |                        0 |
| Rendered triangles, Realistic desktop frame             |        3,757,065 |                1,878,535 |

Observed medians (six recorded frames), **CPU submission ms / completed-frame wall ms**:

| Look                                     | Desktop before → after      | Phone before → after        |
| ---------------------------------------- | --------------------------- | --------------------------- |
| Standard                                 | 3.30 / 16 → 3.90 / 14       | 4.35 / 11 → 2.75 / 15       |
| Soft outlines                            | 3.80 / 16 → 3.90 / 13       | 1.55 / 14 → 1.90 / 14       |
| Realistic                                | 5.35 / 2,803 → 4.30 / 2,804 | 7.20 / 2,688 → 4.75 / 1,349 |
| Photo moving preview                     | 6.40 / 2,927 → 2.80 / 2,835 | 6.50 / 1,296 → 6.90 / 1,182 |
| Explicit raster Photo, one moving sample | 3.35 / 4,727 → 2.30 / 3,051 | 3.85 / 1,520 → 2.90 / 3,810 |

Wall times do not improve consistently: notably the phone's explicit raster Photo wall time increases despite half the submitted geometry. Unchanged Standard also varies. These runs support less rendering work, not a general FPS or every-mode timing improvement. Shader compilation, software rasterization and shared-machine scheduling remain significant.

The whole-run shell observations are recorded separately from 3D readiness:

| Lab observation                                              | Desktop before → after | Phone before → after |
| ------------------------------------------------------------ | ---------------------- | -------------------- |
| FCP and last observed LCP                                    | 1,020 → 856 ms         | 1,656 → 1,084 ms     |
| Sum of layout shifts without recent input, full scripted run | 0.00097 → 0.00097      | 0.02965 → 0.00037    |
| INP                                                          | Not measured           | Not measured         |

These are individual lab observations, not field ratings or attributed improvements. The three-context capture run's startup readiness was 9.73 / 1.99 / 1.74 seconds before and 10.77 / 1.98 / 1.69 seconds after: startup wall time is not demonstrably faster here despite the smaller download.

1. **Restore the physics loading boundary.** `BrowserPlay` eagerly imported compact vehicles, motor source preparation and the native Arocs contact module. Those static imports pulled Rapier/WASM and native physics into the initial viewer bundle despite the existing lazy session import. Entry preparation now imports native modules alongside the session; connection review loads its preparation only when a candidate needs it. Eligibility imports the native-free binding module directly. The offline precache includes the emitted chunks. This moves download/parse work to first Play entry or a native motor connection review; it does not remove it from the application.
2. **Keep cached shadows across camera replacement and resizing.** `setCamera()` calls `resize()`, which invalidated the scene as if the model had changed. Resize now invalidates only the viewing camera. The model-fitted directional shadow camera, light, geometry, shadow quality and image are unchanged. Scene changes continue to dirty shadows.
3. **Defer Photo scene inspection during motion.** A held/moving view displays its raster preview without counting triangles, constructing trace proxies, computing bounds or hashing a scene it cannot yet trace. The final still inspects the current scene and applies the existing path/fallback policy. Small models also receive the settling frame; release without a camera change cannot strand Photo. The 180 ms motion-settle interval precedes the usual 220 ms Photo scheduling delay. Captures bypass this interactive shortcut.
4. **Release all AO materials.** Pinned three r174's `GTAOPass.dispose()` omits `gtaoMaterial` and `blendMaterial`. The pipeline explicitly disposes both when releasing AO, including temporary captures and look switches. The rendered AO material otherwise holds a program reference after leaving Realistic. The unused blend material is released for complete ownership; this does not imply two rendered programs per switch.

### Ordinary orbit, within Photo's path budget

A second paired run uses 1,000 parts (468,378 budgeted scene triangles), desktop, the same two warm-up/six measured frames and actual OrbitControls camera updates. The 1440 × 1000 page has a 1440 × 922 drawing buffer. Realistic and Photo remain at **104 draws** in both builds; their shadow-pass counters stay constant throughout movement. This confirms ordinary orbit already cached shadows.

Photo's eight scene inspections take 54.8 ms in total before the change and **zero** afterward. Its recorded CPU median is **5.90 → 2.25 ms**, with completed-frame median **404 → 355 ms**. Standard is 4.55 → 4.00 ms CPU and Realistic 3.55 → 6.20 ms, illustrating timing variance even when the draw workload is unchanged. The eliminated inspection work is deterministic; the timing delta is a single paired software-renderer observation.

## Look and lifecycle coverage

| Area                | Finding                                                                                                                                                                                |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Standard            | Existing direct rendering, instancing, ordinary/conditional lines and demand-driven idle frames work. No quality reduction introduced.                                                 |
| Soft outlines       | Same draw/triangle work as Standard; the existing shared-material recolouring adds no passes.                                                                                          |
| Realistic desktop   | Existing half-resolution GTAO reuses beauty depth. Shadows are now reused on camera replacement as well as ordinary orbit. AO/postprocessing remain substantial software raster costs. |
| Realistic mobile    | Existing direct-render path omits default AO/vignette; retains studio IBL and fitted shadows.                                                                                          |
| Photo movement      | One raster preview per requested frame; scene inspection is deferred until rest. Large scenes still obey the same path-tracing budget.                                                 |
| Photo still/capture | BVH construction, seeded sampling, denoising, progressive stopping, physical materials and sample limits are unchanged. Matched four-sample captures exercise the actual path tracer.  |
| Raster Photo        | Matched four-sample captures exercise the fallback pipeline, jitter and shadow accumulation; still quality is unchanged.                                                               |
| Idle                | No additional Standard frames in the measured 500 ms idle window after settling. Existing heavy tests cover converged Photo idle behavior.                                             |
| Loading             | Existing compile workers, progressive drawing, indexed/shared geometry and persistent caches remain in place; import and compilation diagnostics are retained in the raw runs.         |
| Resources           | AO materials now have explicit disposal; existing HDR/accumulation targets, PMREM caching and Photo trimming are retained.                                                             |
| Play/offline        | Native physics is delayed, not removed. Real Play entry, motor-source preparation and offline first entry are regression-tested.                                                       |

## Image and regression verification

All 46 targeted unit checks, eleven main browser checks and two heavy Photo checks pass. [VERIFICATION](VERIFICATION.md#viewer-performance-audit--11-october-2026) lists the cases and all six viewport sizes. Production build, type-check and repository formatting pass.

With the benchmark's `--seeded` noise texture generation, Standard, soft outlines, Realistic and four-sample raster Photo are pixel-identical before/after. Actual path-traced Photo traces 61,428 triangles at four samples in both builds; its mean absolute RGBA-channel difference is 0.0057/255, maximum 60, with 190 changed channels of 76,800. It is a close match, not pixel identity. Uncontrolled cross-page Photo noise was larger, which is why the controlled comparison was added.

First actual Photo capture takes 54.26 → 54.20 seconds; the two later captures take 2.24/2.06 → 1.90/1.80 seconds. These are low-resolution software-GPU observations; no first-still compile improvement is claimed.

The capture benchmark renders `fixtures/ldraw/finishes.mpd` from a fixed camera at 160 × 120, with Standard, soft outlines, Realistic, raster Photo at four samples, and path-traced Photo at four samples. Three captures per look include cold setup and two warm repetitions. Low sample counts make this a parity/renderer-path test, not an evaluation of converged Photo quality.

### Near-limit phone stress check

`npm run test:stress -- --parts 148960 --model city --profiles mobile --label audit-city --no-play --no-recovery --no-interaction` completes with no failure or browser errors. The generated city contains 148,960 occurrences and 29 variants, budgeting 17,265,248 triangles against the unchanged 24,000,000 mobile limit (62,935,600 before hidden-geometry culling). The final camera-sweep frame submits 76 draws and 9,388,400 triangles; median submission is 5.2 ms, with a 354.4 ms maximum. JavaScript heap after load and explicit garbage collection is 162 MiB (not peak heap); time to first full render is 8.804 seconds. Occlusion takes 349.3 ms and the longest load task 1.766 seconds. These are a current-build capacity smoke check, not a before/after speedup claim. Play and recovery were explicitly skipped in this large run; separate browser checks cover Play and offline reload.

The existing stress runner also still waited for the former “Saved revision” label. It now recognizes “Saved on this device · version”, so an autosave is measured instead of silently spending five minutes waiting and omitting the save result. An initial approximate 150,000-part city generated 150,480 parts and was correctly refused by the unchanged mobile limit; the within-budget run uses 148,960 explicitly.

## Remaining bottlenecks and follow-up

- First use of a look can synchronously wait for shader linking. The desktop baseline CPU profile attributed about 32 seconds over the entire cold multi-look run to three's program initialization/status queries; steady-frame CPU numbers omit those cold transitions. No blanket compile-time improvement is claimed. Warm the pipeline's shader variants asynchronously with a defined visible fallback before considering this solved.
- The remaining initial JavaScript is still large (including precompiled schema validators and application/catalogue code). Splitting validators requires preserving synchronous validation, strict CSP and worker/offline behavior; it is separate work.
- Rasterization and full-screen effects dominate these software-GPU runs. Lower resolution, fewer AO samples, lower-resolution studs, different shadows or fewer Photo samples would change quality and require real-device/image measurements. None is silently reduced here.
- Measure real phone GPU timings, memory and first Play entry over a constrained network. Moving the native physics payload trades viewer startup work for first-use Play work. The opt-in offline installation still downloads the complete precache.
- Existing occurrence/scene budgets bound geometry, but a direct JavaScript heap budget and incremental occlusion remain open. See [resource limits](RESOURCE-LIMITS.md) and [TODO](../TODO.md).
- No field INP, hardware GPU timings or Lighthouse score is claimed. Scripted camera changes do not supply a representative user-interaction INP distribution. The shell's FCP/LCP does not measure when all 3D geometry is ready. Local preview transfer timings do not model CDN compression or real networks.

## Reproduction

Build the baseline and changed revision in separate worktrees and preserve each `dist/`. Use separate strict localhost ports. Do not benchmark two builds concurrently.

```sh
export PATH=/tmp/brick-node/node-v22.14.0-linux-arm64/bin:$PATH
export FORCE_COLOR=0
npm run build
npx vite preview --port 4391 --strictPort --host 127.0.0.1
# From another shell; stop the owned preview process when finished.
BRICK_BENCH_URL=http://127.0.0.1:4391/ npx tsx scripts/benchmark-looks.ts --label before --profiles desktop --frames 6
BRICK_BENCH_URL=http://127.0.0.1:4391/ npx tsx scripts/benchmark-looks.ts --label before-mobile --profiles mobile --frames 6
BRICK_BENCH_URL=http://127.0.0.1:4391/ npx tsx scripts/benchmark-looks.ts --label before-orbit --profiles desktop --parts 1000 --camera orbit --looks standard,realistic,photo --frames 6
BRICK_BENCH_URL=http://127.0.0.1:4391/ npx tsx scripts/benchmark-look-captures.ts --label before
BRICK_BENCH_URL=http://127.0.0.1:4391/ npx tsx scripts/benchmark-look-captures.ts --label before-seeded --seeded --startup-runs 1 --repeats 1
# Repeat against the changed bundle with distinct labels and its own port.
```

Results, PNGs, CPU profiles and accessibility snapshots go to `.local/perf/` and are not automatically committed. The browser benchmarks block OMR and remote gallery requests. Use the private Playwright-config procedure in [AGENTS.md](../AGENTS.md) for regression tests. The dependency-boundary test walks actual TypeScript runtime imports/re-exports so an accidental eager Rapier import fails with its import path.
