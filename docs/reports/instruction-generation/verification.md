# Implementation verification

> Generated evaluation outputs referenced below are retained locally, outside
> this PR. See the [artifact policy](README.md#local-artifacts).

This records the original feature's checks. Current four-round results and integration with the newer instruction viewer are recorded in [VERIFICATION](../../VERIFICATION.md) and [the refinement report](refinement-rounds.md).

Environment: Node 22.14.0, Linux arm64, local Chromium with software WebGL. This records software checks and a visual desk review, not physical assembly or a builder study.

## Automated checks

- `npm run build`: passed (schema generation, TypeScript and production bundle). Vite retains its existing large-chunk warning.
- `npm run format:check`: passed. The user-supplied theoretical report is preserved verbatim rather than reformatted.
- `npm test`: 799 tests passed; three existing tests timed out during the concurrent full run. Rerunning `expansion-policy.test.ts`, `cli-headless.test.ts` and `cli-play-mechanisms.test.ts` with `--maxWorkers=1` passed all nine tests at their unchanged timeout settings. No unrelated tests or timeouts were edited.
- Targeted generator/publication unit checks: 17 passed, including deterministic support ordering, repeated occurrence identity, undo/redo, native persistence, unchanged LDraw source, actual unmodified OMR fixtures and diagnostic publication metadata.
- Instruction browser checks: nine passed across generation, editing, cumulative masks, dimming, publication and cancellation. After the final camera/backdrop changes, generation at 1440 px and 360 px plus actual PNG/PDF publication and cancellation were rerun: four passed.
- CLI JSON: the sample car covers all 58 occurrences exactly once. Invalid method, oversized heuristic batch and conflicting plan/generation options reject without replacing an existing output file.
- Complete new-method CLI publications: car PDF (21 steps, 23 total pages) and OMR 6450 HTML ZIP (32 PNGs plus HTML/JSON) passed coverage, archive/PDF structure and diagnostic checks. An actual PDF instruction page was visually inspected. See artifacts and attribution (local artifact).
- `git diff --check`: passed.

The feature was rebased onto main commit `5869f6f` after the corpus runs. Its model-building DSL changes do not alter the evaluated templates or instruction planner. All 45 tests across the instruction generator/publication/editing/dimming and updated build-script suites passed on that base; the production build was also rerun.

## Corpus and review

The [evaluation](evaluation.md) records all 12 nonempty repository samples and eight OMR models, including rejected oversized samples. All 17 generated plans preserve source transforms and cover every expanded occurrence exactly once. Sixteen models have eleven actual sampled render views each. The remaining model's strict colour error is retained explicitly.

The [critic report](../instruction-critic.md) reviews consecutive sampled steps and compares three matching LEGO booklets. Its scores describe an editable draft; no claims of measured builder performance, force stability, collision-free insertion or LEGO-quality instructions are made.

## Research provenance

The [source audit](research.md) distinguishes full-text reading, accessible abstracts and bibliography-only traces. LEGO booklets and papers remain local downloads with direct source links and hashes; they are not redistributed. OMR fixtures and derived diagrams carry author/source credits. The user's [additional report](lego_instruction_generation_heuristic.md) is stored verbatim and its [assessment](additional-report-assessment.md) documents verified sources and proposed follow-up work.
