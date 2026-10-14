# Fresh gallery builds with corrected references — 14 October 2026

Owner authorised one new response to each of the six existing gallery briefs from Luna/high, Sol 6.1/high and Astra/medium, and publication in the main Brick Editor gallery. E creative guidance and the original advisory part targets are retained. All use spatial-part-facts/2, on-demand shape/connector/capability inspection and bounded blind-mechanical feedback (three checks, two repairs). No images or visual critiques enter generation. Render only frozen submissions. This is a new gallery cohort, not a controlled quality-improvement claim.

Schedule: six tasks in existing order, each Luna then Sol then Astra; 18 independent sessions total. No failed-case retries or visual repairs. Retain every failure; only compiler-accepted submissions are publication candidates. Record all exact inputs, reference payloads, checks, repairs and quota readings. A missing quota, reserve breach or three consecutive infrastructure failures stops the schedule. No credit purchases or resets. At preparation, weekly quota remaining was 73%.

Publication is additive and preserves previous entries and the existing default generation. Use the existing content-addressed R2/D1 gallery process after source freezing, mechanical validation and render checks. Native sidecars, credentials and private contexts are excluded. Model settings and source generation are identified on each new entry.

## Completed and published

All 18 scheduled sessions ended: Luna 6/6 submitted, Sol 6/6, Astra 5/6. Published 17 accepted builds in the [main gallery](https://bricks.robertj.in/?galleryIndex=1), under **Prompt generation → E · corrected part references**. The 83 prior entries and Fresh E default are unchanged; the gallery now has 100 entries. Generation used commit `55b3c1f4`; effective inputs and compiler/source hashes are in each archived preflight. Weekly quota went from 73% to 60%; account activity outside this batch can contribute.

Astra's Star Destroyer ended as an infrastructure failure when the isolated compiler exceeded its 384 MiB heap. A separately logged post-run compile of the identical frozen final source, using the same bundled compiler and a 1024 MiB heap, completed with 14 overlap errors (11,145 parts). This diagnostic used zero model calls and no visual feedback. The original failure remains unchanged; no replacement sample or manual repair was made, and that build was not published. See `results/astra-destroyer-post-run-diagnostic/`.

### Published builds

| Brief     | Model                | Parts | Warnings | Build                                                   |
| --------- | -------------------- | ----: | -------: | ------------------------------------------------------- |
| pelican   | GPT-6-Luna (high)    |   793 |        3 | [Open](https://bricks.robertj.in/?gallery=5b84f59bfa80) |
| piplup    | GPT-6-Luna (high)    |  1269 |        1 | [Open](https://bricks.robertj.in/?gallery=b68ac47fc4e8) |
| temple    | GPT-6-Luna (high)    |  1834 |        1 | [Open](https://bricks.robertj.in/?gallery=62944621ed6a) |
| destroyer | GPT-6-Luna (high)    |  4725 |        1 | [Open](https://bricks.robertj.in/?gallery=b94ed71c0b0a) |
| dragon    | GPT-6-Luna (high)    |  1055 |        1 | [Open](https://bricks.robertj.in/?gallery=9b5aaf804505) |
| ewok      | GPT-6-Luna (high)    |  1806 |        1 | [Open](https://bricks.robertj.in/?gallery=12ee2037da08) |
| pelican   | GPT-6.1-Sol (high)   |   884 |        2 | [Open](https://bricks.robertj.in/?gallery=0c3c45a3d632) |
| piplup    | GPT-6.1-Sol (high)   |  1100 |        0 | [Open](https://bricks.robertj.in/?gallery=648f4bfdeb7b) |
| temple    | GPT-6.1-Sol (high)   |  2299 |        1 | [Open](https://bricks.robertj.in/?gallery=df3094ba8b67) |
| destroyer | GPT-6.1-Sol (high)   |  5516 |        1 | [Open](https://bricks.robertj.in/?gallery=2283545ca396) |
| dragon    | GPT-6.1-Sol (high)   |  1144 |        1 | [Open](https://bricks.robertj.in/?gallery=b79780caabea) |
| ewok      | GPT-6.1-Sol (high)   |  2759 |        1 | [Open](https://bricks.robertj.in/?gallery=087d4aeb3a59) |
| pelican   | GPT-6-Astra (medium) |   874 |        1 | [Open](https://bricks.robertj.in/?gallery=981c6abb3e63) |
| piplup    | GPT-6-Astra (medium) |  1094 |        1 | [Open](https://bricks.robertj.in/?gallery=122e4e3f9ca0) |
| temple    | GPT-6-Astra (medium) |  2226 |        1 | [Open](https://bricks.robertj.in/?gallery=dfacf6528ca2) |
| dragon    | GPT-6-Astra (medium) |  1043 |        1 | [Open](https://bricks.robertj.in/?gallery=c6ca51b1221a) |
| ewok      | GPT-6-Astra (medium) |  2957 |        1 | [Open](https://bricks.robertj.in/?gallery=a31f1ee40b89) |

## Evidence and reproduction

- **Implemented:** frozen manifests use corrected v2 references with unchanged E guidance and original advisory targets; publication is an additive gallery data update. No app deployment or default promotion.
- **Tested:** type checking and repository formatting pass; 28 focused tests in gallery index/publishing/bundle and spatial-reference-v2 suites; all 17 publication compilations preserve the frozen MPD hash; 51 fixed-view renders; all 102 public asset byte lengths/SHA-256 hashes; exact database/index equality; six live viewport checks (1440×1000, 360×600, 1080×1800, 411×685, 390×844, 686×411). The browser check waits for a loaded image and checks all 17 cards and no page overflow; it is not an aesthetic assessment.
- **Experimentally evaluated:** 18 fresh generation attempts and their mechanical outcomes/cost records. No blinded visual assessment or contemporaneous control was performed; this batch cannot establish a quality improvement.
- **Deferred:** compiler heap sizing/explicit resource-budget semantics and a controlled v2 comparison. Compiler acceptance remains separate from physical certification.

`results/` retains exact effective prompts, requests/responses, frozen source/compilation hashes, outcomes and quota readings for every scheduled case. Native sidecars, credentials and private contexts are excluded. `publication/` contains all immutable uploaded assets, model-readable source, SQL, the exact public index, manifest, verification records and receipt. Its manifest is `additive-gallery-reference-v2/1`; it is not the older hard-coded `publish-gallery-bundle.ts` protocol. `host-tools/*.txt` preserves the run-specific orchestration source as evidence, with original paths; it is not a supported new CLI.

For a compilation replay, use any `publication/inputs/<model>-<task>/build.json` with the existing CLI:

```sh
npm run cli -- build --script fixtures/spatial-benchmark/studies/gallery-reference-v2/publication/inputs/luna-pelican/build.json --output /tmp/luna-pelican.mpd
npx vitest run tests/unit/gallery-publish.test.ts tests/unit/gallery-index.test.ts tests/unit/gallery-bundle.test.ts tests/unit/spatial-reference-v2.test.ts
```

Generation ran with `spatial-benchmark-live.ts --manifest <model.json> --authorised-cases 1`, pooling completed phases and continuing the remaining schedule. No failures were retried. Rendering ran only on frozen submissions in a separate checkout of the same commit. The first renderer hit Vite config-runner's file-watcher limit; a sparse temporary checkout with config loading switched from `runner` to `bundle` resolved this host issue without changing render/geometry code. Byte-identical old completed checkpoint files were hard-linked to recover disk space; paths and contents were preserved.
