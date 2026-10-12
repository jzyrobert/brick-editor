# Sol 6.1 high spatial pilot

This opt-in follow-up uses the owner's authorised **gpt-6.1-sol, high effort**, through Codex subscription access. No API-key fallback, credit purchases or earned resets are enabled. E, diorama, the original runner/facts, archived studies, language and gallery remain unchanged. Nothing has been pushed or published.

## Split and evidence

The initial schedule is **112 independent generation sessions**:

| Stage                |             Tasks | Fact conditions | Repetitions | Sessions |
| -------------------- | ----------------: | --------------: | ----------: | -------: |
| Calibration          |  5 two-part tasks |               4 |           2 |       40 |
| Creative development | 6 original briefs |               4 |           3 |       72 |

The four conditions are baseline, shape, connections and combined. Retrieval is on demand. Calibration uses no candidate feedback; the creative comparison fixes E, its reply example, numerical targets, language, search budgets and legacy count/error feedback. A separate **36-session feedback comparison** is prepared, outside the initial 112. Aliases, automatic presentation, assembly-language expansion and new design guidance are separate experiments.

All **40 calibration sessions completed and passed**, ten per condition. Detailed inspection was used in **0/10 control, 1/10 shape, 3/10 connections and 6/10 combined** sessions. These easy tasks show a ceiling and establish no accuracy improvement. Two tasks directly prescribe placement and do not independently assess verbal predictions. Familiar part numbers and baseline dimensions remain available; the alias diagnostic has not run. Facts being available or returned does not prove they were used.

[Every calibration result and its hashes](../fixtures/spatial-benchmark/studies/sol-high-pilot/calibration-results.json) is retained. The evaluator's new v2 compares pose multisets, removing an unrequested source-operation ordering requirement; v1 remains the default for frozen replay comparisons. Both original v1 and v2 pass all 40 actual candidates. Deliberately perturbed witnesses still fail. Connection/occupancy checks do not certify physical fit, stability or assembly order.

**The 72 creative sessions are in progress.** No creative visual scores exist yet. Four fixed views and a two-phase blinded assessment protocol are frozen. After generation finishes or records a stop boundary, anonymous candidates are rendered and reviewed in fresh evaluator sessions: unlabelled recognition first, then the exact brief. Evaluator requests consume additional Codex usage and are distinct from the 112 generation sessions. One automated reviewer is exploratory; human agreement and broader model generality remain unmeasured.

## Transport and quota boundary

Executed generation uses archived `codex-text-broker/2`. The currently exposed adapter is `codex-guarded-broker/4`, adding evaluator-only frozen image hashes, cancellation handling and typed model-budget failures; changes do not alter the already running v2 process. Each study archives its actual adapter source, binary hash, bridge hash, exact effective native request and response stream. Native instructions add transport context beyond the filled E prompt. The same transport applies to contemporaneous controls and treatments; historical native runs are not replacement controls.

The native client runs in a fresh Bubblewrap filesystem/network namespace. Only approved text, credential-free private client state, runtime libraries, the client binary and a Unix transport socket are mounted. The host broker allows only the fixed Codex subscription Responses endpoint, forces Sol 6.1/high and an empty native tool list, denies non-text generation inputs and undeclared actions, and logs denied routes. Authentication stays on the host. Each case starts a fresh session; within-case catalogue/check dialogue resumes only its own isolated thread. Compilation remains a separate sandbox.

Quota is read through `account/rateLimits/read` before and after every provider request and every completed case. The reserve is at least **5 percentage points**, or twice the largest observed case drop. Missing quota data blocks further generation. This is a conservative gate, not a guarantee against concurrent account usage. No quota reset or paid-credit operation is called. The calibration stage's recorded account readings moved from 51% to 50% remaining; these readings include activity outside the experiment.

One initial launch failed before any model request because the Unix socket pathname was too long; it is retained separately. V2 used a short temporary socket pathname. Infrastructure retries are zero within a study; the corrected launch has its own version and directory. An initial renderer smoke check failed on missing render quality, then a separate corrected smoke check produced four images. Neither is a model-quality result.

## Recorded continuation — 12 October 2026

The first creative phase attempted seven cases: six submitted, and `ewok--shape--3` exhausted the declared 16,000 output tokens entirely in reasoning before returning source. Its frozen v2 status remains `infrastructure-failure`; terminal provider evidence identifies a model output-budget failure. A separate analysis taxonomy records that distinction without altering the original source/status archive.

The v4 continuation selects only the **65 unexecuted case IDs**, preserves their original order and uses fresh sessions/workspaces. It verifies identical manifests, every prior frozen hash, all effective filled inputs and the compiler bundle. No failed or successful prior case is repeated. Budgets, model/effort, fact guides, language and feedback remain fixed. This unplanned host correction is recorded as a separate execution phase; no creative images or visual judgements informed it. The later adapter correctly counts output-token exhaustion as model failure and continues the schedule, with no repair or budget increase.

Use `--remaining-from <stopped-run-directory>` only for an identical manifest and recorded stop boundary. The output archives `continuation.json`, prior result identity, excluded prior IDs and selected remaining IDs. Different effective prompts/compiler require another experiment. Report execution phases and original versus analysed failure categories; the host change must not be presented as a model-performance improvement.

## Reproduction

[Frozen manifests, render protocol and analysis plan](../fixtures/spatial-benchmark/studies/sol-high-pilot) specify task IDs/briefs, condition order, model/effort, budgets, compiler/build seeds, unavailable sampling settings, views and assessment rules. Three creative repetitions are screening counts, not a power calculation. Analysis averages repetitions by task, gives tasks equal weight and reports task-cluster bootstrap intervals alongside missingness and per-task results. Six fixed development tasks cannot establish general improvement.

Each output directory must be fresh. Live commands consume the authorised subscription allowance; they do not imply authority to run another study.

```sh
export PATH=/tmp/brick-node/node-v22.14.0-linux-arm64/bin:$PATH

# Read-only preflight; zero model calls:
npx tsx scripts/spatial-benchmark.ts --manifest fixtures/spatial-benchmark/studies/sol-high-pilot/creative.json --out .local/new-pilot-preflight --mode preflight

# Explicit live generation, only within a separately authorised allowance:
npx tsx scripts/spatial-benchmark-live.ts --manifest fixtures/spatial-benchmark/studies/sol-high-pilot/creative.json --out .local/new-pilot-runs --authorised-cases 72

# Combine ended phases, retaining prior failures and excluding duplicate IDs:
npx tsx scripts/spatial-benchmark-pool.ts --phase .local/first-phase --phase .local/remaining-phase --out .local/new-pilot-runs

# Post-freeze evaluator, with no route back to generation:
npx tsx scripts/spatial-benchmark-evaluate.ts --runs .local/new-pilot-runs --protocol fixtures/spatial-benchmark/studies/sol-high-pilot/visual-protocol.json --out .local/new-pilot-views --mode render
npx tsx scripts/spatial-benchmark-evaluate.ts --runs .local/new-pilot-runs --protocol fixtures/spatial-benchmark/studies/sol-high-pilot/visual-protocol.json --out .local/new-pilot-views --mode review
npx tsx scripts/spatial-benchmark-report.ts --runs .local/new-pilot-runs --evaluation .local/new-pilot-views --out .local/new-pilot-summary.json
```

Private raw archives are under `.local/spatial-pilot-sol-high-calibration-v2` and `.local/spatial-pilot-sol-high-creative-v2`. They retain every actual input/output, failure, source, compiled artifact, reference payload, usage record and quota reading. Raw native context and credentials are not published. The public evidence ledger records hashes and every calibration outcome; no gallery entries or new defaults were introduced.

Implemented: subscription transport, quota gate, post-freeze renderer/reviewer and numeric reporting. Tested: 81 unit and 25 integration checks, type checking, formatting, real isolated-client transport with mocked responses (including evaluator images), and a four-view headless renderer smoke check. Experimentally evaluated: the 40 calibration sessions only. Deferred: completed creative scoring, the independent feedback study, held-out subjects, another model family, human review and later language/guidance increments.
