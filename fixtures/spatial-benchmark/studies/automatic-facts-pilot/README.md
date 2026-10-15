# Automatic facts pilot v1

Declared 13 October 2026, before generation. Owner authorised the proposed 32-session pilot, retaining Sol 6.1/high and quota checks. This is a new development experiment, not a repeat of the gallery study and not held-out evidence.

## Question and fixed conditions

Do automatically presented shape and/or connector facts improve small-inventory creative builds? Four new development briefs × four conditions × two independent repetitions = 32 sessions. The five-part palette has curated shape descriptions and supported stud interfaces. Each brief requires exactly 16 parts within declared maxima. Every condition retains E, its reply example, baseline catalogue information, language, seed, palette, inventory and all budgets. Control automatic exposure with zero additional fields produces exactly the same prompt as control on-demand exposure. Shape and connector guides belong only to their treatments; shortcut evidence stays off.

All four arms use `blind-no-feedback`: catalogue queries are allowed; candidate checks and repairs are zero. The existing legacy-control policy deliberately rejects inventory tasks, so it is not used. This choice is common to all arms and does not test feedback. Sources and compilation are frozen before evaluation. No visual feedback returns to generation. Models retain freedom to choose colours, arrangements, bulk operations and individual parts. No witness or subject constructor is exposed.

Automatic facts for the full palette, including every connector page, appear in the initial prompt and count toward reference bytes. Optional subsequent inspection remains available under identical call ceilings; extra retrieved content remains constrained to the arm's fields. Exact effective prompts and coverage distinguish automatic exposure from retrieval. Exposure is not proof of use.

## Preflight and feasibility

Evaluator-only files in `../../evaluator/automatic-facts` contain four explicit 16-part feasibility sketches and two harder four-part relationship fixtures. The latter combine independently specified origins/rotation matrices for translated and rotated slope attachments, arch clearance and smooth-tile contact. Perturbed poses must fail; these are infrastructure checks, not additional model trials or evidence that calibration is now discriminating. Witness sketches establish API/palette feasibility, not certified physical assembly or a visual ceiling. The candidate assessment accepts other arrangements; it never compares candidates to witness coordinates.

Before invoking models: run the new unit checks, existing observation/isolation tests, type checking, formatting and a zero-call dry run. Save manifest, effective inputs, implementation/library/compiler hashes and actual checkout commit. Start each case in a fresh isolated session and workspace.

## Execution and stops

Budgets are in `manifest.json`; no API-key fallback, credit purchases or earned quota resets. Read weekly usage before/after requests and every case. Stop at the existing reserve (at least 5 percentage points or twice the largest observed run drop) or if usage cannot be read. Initial observed weekly remaining was 100% at 07:37 UTC, after a new quota window; account-wide readings include other activity.

Infrastructure retries are zero. If an infrastructure failure ends a phase, retain it and wait five minutes before continuing only unattempted case IDs in original order, using identical inputs/compiler. Stop after three consecutive single-case infrastructure failures or a quota stop. Never replace a failed case with a new sample. Archive each phase and pool only ended phases. Maximum 32 generation sessions. The authorised study evaluation adds at most 32 independent blinded reviewer sessions (two requests each), with the same quota gate; reviewer failures remain unevaluated and are not retried.

## Frozen assessment and analysis

Use `visual-protocol.json`: four fixed views, all occurrences included, unlabelled recognition before revealing the brief, six axes scored 0–4 each, one fresh automated reviewer session per completed build. Hide condition, source and title. One model family and one automated reviewer support only exploratory conclusions. Recognition may be intrinsically ambiguous with this very small palette.

Primary descriptive contrast: task-weighted combined minus control visual total /24. Use the existing task-cluster bootstrap implementation with its fixed seed; report the number of represented tasks and every task/arm mean. Secondary shape/connector contrasts are exploratory. Report all 32 scheduled cases and missingness; no visual score for failed or unassessed candidates. Two repeats and four tasks do not establish general applicability or reliable significance.

Report separately: compiler acceptance; exact count and inventory compliance; conservative collision/contact diagnostics and unknown coverage; visual quality; exposure bytes and returned fields; searches/inspections/checks/repairs; tokens where recorded; runtime and infrastructure failures. No initial/post-feedback comparison exists because checks and repairs are disabled. Do not interpret longer-prompt effects as purely semantic, or comparisons against the earlier large-build study as causal.

No defaults, language, gallery or archived study artifacts change. Advanced poses, alignment assistance, automatic packing changes, mechanical-feedback comparisons, aliases and new design guidance remain deferred.

## Commands

```sh
npx vitest run --project unit tests/unit/spatial-automatic-pilot.test.ts
npx tsx scripts/spatial-benchmark.ts --manifest fixtures/spatial-benchmark/studies/automatic-facts-pilot/manifest.json --out .local/automatic-facts-dry-v1 --mode dry-run
npx tsx scripts/spatial-benchmark-live.ts --manifest fixtures/spatial-benchmark/studies/automatic-facts-pilot/manifest.json --out .local/automatic-facts-live-v1 --authorised-cases 32
npx tsx scripts/spatial-benchmark-evaluate.ts --runs .local/automatic-facts-live-v1 --protocol fixtures/spatial-benchmark/studies/automatic-facts-pilot/visual-protocol.json --out .local/automatic-facts-visual-v1 --mode render
npx tsx scripts/spatial-benchmark-evaluate.ts --runs .local/automatic-facts-live-v1 --protocol fixtures/spatial-benchmark/studies/automatic-facts-pilot/visual-protocol.json --out .local/automatic-facts-visual-v1 --mode review
npx tsx scripts/spatial-benchmark-report.ts --runs .local/automatic-facts-live-v1 --evaluation .local/automatic-facts-visual-v1 --out .local/automatic-facts-report.json
```

Use fresh output directories; if phases stop, use the documented continuation/pooling commands and point evaluation at the final pool. No experimental outcomes have been written into this pre-generation protocol.
