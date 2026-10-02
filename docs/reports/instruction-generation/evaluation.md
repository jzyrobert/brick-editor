# Heuristic instruction evaluation

> Generated evaluation outputs referenced below are retained locally, outside
> this PR. See the [artifact policy](README.md#local-artifacts).

This records the original v1 baseline. The [four-round refinement report](refinement-rounds.md) and [final critic review](round-4-critic.md) describe the current generator and retain comparable source occurrences, diagrams and limitations.

Evaluated all 12 nonempty repository samples and eight OMR models. Nine samples and all eight OMR models generate complete draft plans; the three large samples are rejected explicitly by the 5,000-occurrence generation budget. Every generated plan covers its expanded occurrences exactly once. This includes raw drawing geometry, so occurrence counts are not necessarily physical brick counts.

The table records the default six additions per step. “Known” is verified connector coverage. “Unanchored” counts additions for which no confirmed prior connection, inferred prior support or global-ground contact is found; it is an uncertainty signal, not a count of physically unstable parts. Visibility flags use conservative body boxes and mean some additions require manual inspection.

| Model      | Occurrences |    Steps | Known | Unanchored | Visibility review | Publishable                     |
| ---------- | ----------: | -------: | ----: | ---------: | ----------------: | ------------------------------- |
| house      |         281 |      104 |   263 |         13 |                 9 | yes                             |
| castle     |         237 |      107 |   223 |          7 |                 1 | yes                             |
| car        |          58 |       21 |    44 |         11 |                 0 | yes                             |
| jeep       |          80 |       28 |    61 |         12 |                 4 | yes                             |
| windmill   |         338 |      115 |   313 |         30 |                 8 | yes                             |
| lighthouse |         269 |       85 |   264 |          3 |                 3 | yes                             |
| cafe       |         358 |      124 |   334 |         14 |                11 | yes                             |
| playground |         110 |       61 |    94 |          7 |                 0 | yes                             |
| train      |         415 |      160 |   371 |         34 |                 7 | yes                             |
| town       |        6083 | rejected |     — |          — |                 — | —                               |
| cathedral  |       11817 | rejected |     — |          — |                 — | —                               |
| harbour    |        6966 | rejected |     — |          — |                 — | —                               |
| 6350-1     |         166 |       68 |    77 |         81 |                 7 | yes                             |
| 6361-1     |         170 |       56 |   105 |         43 |                12 | yes                             |
| 6450-1     |          86 |       32 |    41 |         45 |                 6 | yes                             |
| 6980-1     |        2698 |      557 |    12 |       2677 |               255 | no: existing publication budget |
| 8832-1     |         145 |       37 |    24 |        132 |                20 | yes                             |
| 21034-1    |         827 |      296 |   328 |        472 |                52 | no: existing publication budget |
| 31025-1    |         549 |      205 |   494 |         75 |                22 | no: existing publication budget |
| 31088-1    |         230 |       80 |     0 |        229 |                33 | yes                             |

## Comparison with authored OMR boundaries

Only boundaries actually present in each model instance contribute comparisons. Same generated step receives half credit. The layer baseline chunks source/layer order at six occurrences per step; source order is often authored order, so it naturally scores highly on this metric. The generator intentionally does not read STEP hints. Agreement measures order similarity, not buildability or booklet quality.

| Set     | Authored instances | Comparable pairs | Heuristic agreement | Layer baseline |
| ------- | -----------------: | ---------------: | ------------------: | -------------: |
| 6350-1  |                  2 |             4455 |               84.5% |          98.5% |
| 6361-1  |                  0 |                0 |                 n/a |            n/a |
| 6450-1  |                  1 |             2163 |               68.0% |          98.7% |
| 6980-1  |                 14 |            92860 |               79.7% |          99.8% |
| 8832-1  |                  1 |             7642 |               72.8% |          99.5% |
| 21034-1 |                  0 |                0 |                 n/a |            n/a |
| 31025-1 |                  8 |           113518 |               77.5% |          99.8% |
| 31088-1 |                  7 |            25426 |               32.7% |          99.2% |

## LEGO booklet comparison and critic

Three matching LEGO booklets were read: London 21034, Mountain Hut 31025 and Deep Sea Creatures 31088. Their main numbered sequences end at 99, 78 and 85 respectively, with additional inset/subassembly operations. These numbers cannot be equated to our flat occurrence-step counts. They provide concrete references for grouping, isolated construction, flips, merging and pictorial parts trays. See [source links and hashes](research.md) and the [independent critic review](../instruction-critic.md) for numbered-page comparisons.

The critic found that saved scene backdrops reduced contrast; instruction publication and evaluation now explicitly select a blank backdrop. The visibility heuristic was also tightened to flag any fully hidden addition rather than accept a batch with adequate average visibility. Detached subassemblies, insertion arrows, pictorial part trays and underside/flip guidance remain substantial gaps, especially for the posed shark and Technic Roadster.

Final judgments: seven sample guides score 3/5 (useful editable drafts), while playground and train score 2/5 (substantial editing needed). Mountain Hut scores 3/5; the other rendered official-set outputs score 1–2/5. Concrete failures include tiny vehicle additions in the full track-loop view and individual graphical tube segments presented as parts in London. The review calls for physical-element ownership and action/subassembly semantics as well as better framing.

The accompanying contact sheets show representative early, middle and late consecutive sequences, plus quartile views. They are rendered from the actual draft plans and cumulative occurrence scopes, with prior parts dimmed. This is a visual desk review, not a physical building study. All large-sample rejections are retained in the evidence rather than excluded from the summary.

## Reproduction and artifacts

Run `npm run instructions:evaluate -- --fetch --render --output .local/instructions` once, then omit `--fetch` for offline repeats. The script reuses the OMR index/name/attribution logic and the committed full library. evaluation.json (local artifact) contains exact source URLs, hashes, per-plan coverage, generation-time findings, timings, publication errors and comparison metrics. Raw downloaded models, full plans and full-resolution PNGs remain in the local output folder; selected derived contact sheets are committed here with attribution below.

Local timings are CPU/load-dependent (Node 22.14, Linux arm64, software WebGL). They exclude model download and rendering. No performance improvement over another planner is claimed.

Sixteen models have eleven sampled PNG views each. Galaxy Commander (6980-1) generated a plan, but strict rendering refused unresolved body colours; no visual judgment or sheet is claimed for it. An initial gallery-context error happened after the successful PNG and HTML captures. The sheets were recovered from those saved HTML files without changing the diagrams; the evaluation script now creates a separate gallery context correctly.

Sample sheets: house (local artifact), castle (local artifact), car (local artifact), jeep (local artifact), windmill (local artifact), lighthouse (local artifact), cafe (local artifact), playground (local artifact), train (local artifact).

Official-set derivatives: 6350 Pizza To Go (local artifact), 6361 Mobile Crane (local artifact), 6450 Mobile Police Truck (local artifact), 8832 Roadster (local artifact), 21034 London (local artifact), 31025 Mountain Hut (local artifact), 31088 Deep Sea Creatures (local artifact). See author/source/licence attribution (local artifact).

Two complete publication examples (local artifact) exercise the new CLI end to end: the sample car PDF has all 21 instruction steps, and the OMR police-truck HTML ZIP contains all 32 cumulative PNGs. Their embedded reports retain exact coverage, dimming and unvalidated-assembly diagnostics.

See [implementation verification](verification.md) for build, unit, browser, CLI and formatting results, including the full-run timeouts and successful isolated reruns.
