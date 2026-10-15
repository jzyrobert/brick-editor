# Render-blind spatial benchmark v1

This is an opt-in infrastructure increment, based on remote `main` **f7f7b4b7fe6a9831a256f2c48dada858f9c90fc8**, checked on 11 October 2026. PR 19 was already merged and was not reapplied. Worktree: `/home/ubuntu/brick-benchmark`, branch `codex/render-blind-benchmark`. E, the diorama prompt, the legacy runner/facts, language, editor and published gallery are unchanged. The initial delivery ran no models or visual assessments. The subsequent authorised [Sol 6.1 high pilot](SPATIAL-PILOT.md) adds an isolated subscription transport and records actual calibration results.

The initial CLI supports preflight, isolated transport dry runs and text replay. `GenerationSession` also accepts a trusted host `TextChannel` for later provider integration; **that initial delivery had no live provider adapter**; the later opt-in adapter is documented in [SPATIAL-PILOT](SPATIAL-PILOT.md). Replay fixtures test infrastructure, not model ability. Adding a provider requires a separate adapter audit, explicit spending authorisation and a new executed configuration. Unisolated native Codex/Claude CLIs are not a supported benchmark transport in v1. The later Codex broker has its own version and OS isolation audit.

## Current observation audit

| Legacy path      | What the model sees / what the host does                                                                                                                                                                                                                                                                                                                             |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Prompt           | `oneShotPrompt` takes text below the prompt separator, removes the tool-enabled section, replaces Output/Example from the selected reply prompt, substitutes the exact brief/target and normally the 224-part curated list. Search and check instructions are inserted when enabled. E and diorama are separate preserved choices.                                   |
| Catalogue        | Existing footprints, stacking heights, overreach and known common colours remain baseline information. Search includes the complete pinned official library, with deterministic ranking.                                                                                                                                                                             |
| Richer facts     | Legacy `--part-facts on` appends bounds, the first 16 connectors and shortcut co-occurrence evidence to searches. It remains bundled and outside the new factorial conditions.                                                                                                                                                                                       |
| Draft checking   | `checkAnswer` returns counts/section counts and up to 20 **errors**, excluding construction warnings. Three checks per attempt. Host compilation can see more than the generating model.                                                                                                                                                                             |
| Repairs          | Legacy limits restart per repair attempt. Errors and previous output return in `repairPrompt`; infrastructure busy retries have their own backoff.                                                                                                                                                                                                                   |
| Native runtimes  | Codex ignores user configuration, disables listed tools/web, uses a read-only sandbox and `project_doc_max_bytes=0`; Claude uses empty tools, safe mode and strict MCP. Both start in an empty directory, then resume a native session for dialogue. That is not an OS filesystem/network isolation guarantee. The host inherits runtime environment/authentication. |
| Images/revisions | `one-shot-build --images` permits Codex image input. `evaluate-build-style` retains historical reference/revision options, with safeguards specific to its studies. These legacy modes are outside benchmark v1.                                                                                                                                                     |
| Rendering        | Accepted legacy candidates are rendered after generation. Existing workspace/CLI automation can render and exposes repo tools; those workspaces must not be used as benchmark generation sandboxes.                                                                                                                                                                  |

Potential leakage routes are image revision inputs, filesystem/native tools, credentials/environment, repository examples/gallery/archives, evaluator comments disguised as text, resumed sessions containing earlier visual inputs and rendering before a final freeze. Prompt wording and hashes alone do not close these routes.

Prior evidence retains its original interpretation: richer facts scored 183/240 versus unchanged repeats 182 and 175; this does not demonstrate reliable general improvement ([study](samples/style-directions/README.md)). Format references scored 349/480 versus 343/480, a mean difference 0.25/20 with mixed task effects and unblinded review; all 48 final sources compiled without errors while 214 construction-warning records remained ([sizing study](samples/format-size/README.md)). Acceptance is not physical certification.

## Enforced observation contract

| Policy              | Candidate information returned during generation                                                                                                                                                                                      |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `blind-no-feedback` | None. Catalogue/inspection queries only. `check_build` receives a generic denial without compilation. No final repair. The channel is revoked and exact submission is hashed before final compilation.                                |
| `blind-mechanical`  | Run-bounded draft checks/repairs with `mechanical-feedback/1`: syntax/compiler errors, inventory violations, conservative occupancy warnings, connection coverage and explicit unknowns. No renderer or visual evaluator.             |
| `legacy-control`    | Existing `checkAnswer` count/error text, preserving the three-check contract, and existing error-reason text on final errors. E/default and diorama filled controls are byte-identical when no task-specific palette/facts are added. |

The new runner applies **run-wide** limits to every condition. It is not a claim that its orchestration is byte-identical to the older native runner: native system prompts, session management and repair orchestration are separate confounds. Contemporaneous controls must use the same new transport, budgets and orchestration as treatments. Legacy runner research archives are context, not replacement controls. Checks/repairs are never reset by invalid source. The original `--part-facts`, prompt, reply and image flags retain their old behaviour because those files were not edited.

The model channel gets only copied, immutable text messages, the declared model settings, an output-token ceiling and cancellation signal. It gets no local tools, filesystem objects, repository handle, evaluator callback or credentials. Text dispatch accepts only `parts_search`, `part_info`, `check_build` and the final `brick.build`. Undeclared requests, including native read/render/network routes, are denied and audited. JSON manifests reject unknown fields; the CLI rejects image/reference/revision/resume/native/live options before execution. No session resume facility exists; a generation object runs once.

Each run has an empty `generation/` folder containing only the approved filled text input. Host transcripts, compiler bundle, aliases, witnesses and evaluation outputs stay outside it and are not offered to the model. A remote text model has no filesystem tool; directory placement is not the security boundary. Submitted JavaScript runs through Bubblewrap with fresh user/PID/network namespaces, an empty environment apart from PATH and sandbox-generated `PWD=/tmp`, an empty writable `/tmp`, read-only Node/system libraries, a single bundled compiler and pinned public part libraries. Repository/gallery/archives/fixtures/evaluator/credentials are not mounted. Failure to establish isolation fails closed. There is no VM-on-host fallback. Node VM restrictions add defence inside this OS boundary; VM alone is not claimed safe.

`preflight.json` records a probe of the actual namespace, the repository commit/dirty state, Node/platform, source hashes/copies, compiler-bundle hash, exact manifest, expanded run order and each **filled** prompt with byte/character counts and SHA-256. `audit.jsonl` retains exact model inputs/outputs, whole channel requests, search/info request and response text (in order, with hashes/lengths), denials, private compile reports, check/repair feedback and budget usage. `freeze.json` records identity hashes of immutable submission text, compilation result and MPD when available, plus final status and fact availability/return coverage for selected parts. Returned facts are not assumed used.

Final compilation can fail. Its original source and failure are retained. `model-failure`, `infrastructure-failure` and `submitted` are separate states; `submitted` means compiled/task acceptance, **not evaluated quality**. Replay missing a scheduled case records an infrastructure failure rather than dropping the case. Infrastructure retries are zero in v1. Source is never overwritten with a repair or evaluator mutation after freeze. A separate evaluator staging command verifies hashes and makes disposable copies. Evaluation has no channel or session restoration capability. Hash checking catches changes to frozen files; OS/text capability isolation prevents candidate feedback from returning to generation. A trusted host program can always violate its own contract; arbitrary host callbacks are not an adversarial security boundary.

## Part reference and units

`spatial-part-facts/1` uses typed objects; model text is JSON rendered from them. Logic never parses explanatory prose. Search stays concise and preserves the unbounded-palette legacy payload. Selected IDs can be inspected with:

```json
{
  "part_info": {
    "part_ids": ["3039", "3024"],
    "fields": ["shape", "connectors"],
    "offset": 0,
    "limit": 16
  }
}
```

Fields are independently switchable. Requests outside a condition's fields fail. There is **no shortcut assembly evidence** in the new interface. `capabilities` is a third declared information field, excluded from the shape/connector development factorial. Its guide is logged only when selected. Any unit/interpretation guide is part of its treatment, not an edit to E.

The local frame is the legacy **minimum-footprint anchor at `at:[0,0,0],turn:0`**, with +Y up. All new points/axes/boxes use uniform **LDU**, including vertical coordinates: 20 LDU/stud, 8 LDU/plate. For an LDraw point p at turn 0:

```text
local = [p.x - footprint.minX, underside - p.y, p.z - footprint.minZ]
world LDraw origin = [20*at.x - rotatedFootprint.minX,
                      -8*at.y - underside,
                      20*at.z - rotatedFootprint.minZ]
```

For a quarter-turn, rotate the LDraw point in uniform LDU before subtracting the rotated footprint minimum; invert Y only when reporting the Y-up frame. Do not rotate mixed studs/plates vectors. Tests compare reported points to exported occurrence transforms for all four upright turns and to literal LDraw witness origins/bases.

Nominal footprint/stacking height, stud-inclusive physical envelope, projection beyond the nominal box, conservative collision occupancy and connector points are distinct fields. The five starter parts (3001, 3024, 3039, 3659, 3068b) have checked contours/surface extents; unsupported descriptions/features are null. Other extents are labelled estimated conservative envelopes. In particular, 3659's legacy transformed bounding envelope extends to source Y=33.412 LDU while the pinned surface vertices stop at Y=24. New shape facts distinguish these; legacy placement is unchanged. An envelope is not occupied solid volume or proof of contact. Occupancy boxes are derived surface approximations, exclude studs and can miss containment/interior intersections.

Connector IDs combine locked data version, part ID and a hash of the original connector kind/point/axis. Sorting is deterministic. Pages disclose offset, total, next offset and omitted count; page size is 1–64, without silent loss after the first 16. A complete baseplate array is tested for unique stable IDs and lossless retrieval. `known` with an empty list is distinct from `unknown`; derived but unverified data is distinct from unavailable data. Dimensions missing in the connector pack remain null. Available hinge-pin radius/protrusion and socket depth are exposed with pack provenance; unsupported stud/socket radii remain null. Evidence, pose expressibility and validator coverage remain separate, including explicit unsupported side-stud attachment poses and untested strength/support/assembly order.

Temporary aliases replace selected part IDs in the prompt, response IDs and connector-ID prefixes; the private mapping is recorded only in the host manifest. Compilation resolves explicit `place.part` aliases after JavaScript produces a script; it does not choose parts or poses. This diagnostic currently supports explicit placements, not every macro/search-by-alias idiom. Aliases do not eliminate prior part knowledge, shape recognition or examples elsewhere in E. Aliased search hides names and offers the same baseline sizes; detailed geometry is unchanged.

## Calibration and comparisons

All released calibration fixtures have two real parts and supported upright whole-grid poses. Evaluator-only literal world origins/bases and expected contacts/clearances are in `fixtures/spatial-benchmark/evaluator/`; they are not generation inputs. Triangle checks and independently multiplied exported bounds avoid generating both a reference and its answer through the same anchor routine. Five fixtures cover the slope row, central arch opening, planar tile contact without mating, a rotated brick stack and a rotated/translated slope transfer combination. Every fixture has an intentional perturbation that fails at least one specified property. The known-invalid arch case intersects its beam. The hollow-end-support checker gap is documented, not promoted to verified absence of collision.

These are public development fixtures, **not a private held-out evaluation suite**. Later held-out manifests may use the `held-out` split, but private witness geometry/results must remain outside generation and prompt-tuning inputs. No sideways, inverted, articulated or functional motion tasks are released. Connection absence is reported as no verified contact under supported rules, not physical incompatibility. Intentional separate objects in the arch task do not fail merely for lacking a graph edge. Coverage and untested properties are reported separately.

| Manifest                    | Comparison                                                                                                                                     |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `calibration.json`          | Checked shape/connectors/capabilities automatically presented, no feedback                                                                     |
| `calibration-alias.json`    | Same calibration with temporary IDs and private mappings                                                                                       |
| `calibration-facts.json`    | Control, shape, connectors, combined; on-demand, no feedback                                                                                   |
| `calibration-exposure.json` | Combined facts on-demand versus automatic, no feedback                                                                                         |
| `facts-factorial.json`      | Six original development briefs/targets, E/reply/language/search/check feedback fixed; control/shape/connectors/combined, no shortcut evidence |
| `feedback.json`             | Same fixed metadata/briefs/targets; legacy count/errors versus structured mechanical feedback                                                  |

No bundled style/assembly-language treatment is present. Palette/inventory limits are explicit task requirements and report counts by emitted official instances. The calibration palette contains simple physical parts only. An open-palette compiler report may count library shortcuts as instances; **physical shortcut part counts are not certified**, so shortcuts must not be used to claim fixed-inventory compliance without a separately verified count policy.

Development manifests have a placeholder model identifier, two repetitions and deterministic randomised condition order. They are runnable preflight plans, **not adequately powered studies or an authorised spending schedule**. Repetition count/model families must be chosen from authorised budget and pilot task variance before making general claims; use multiple families and fresh contemporaneous controls. Build-program seed and order seed are separate from model sampling temperature/top-p/seed (null records unavailable settings, not determinism). A compiler seed does not make generation deterministic.

## Commands

On the shared VM, first set the documented Node PATH. Each output must be a fresh empty directory. No command below calls a model.

```sh
export PATH=/tmp/brick-node/node-v22.14.0-linux-arm64/bin:$PATH

npx tsx scripts/spatial-benchmark.ts --manifest fixtures/spatial-benchmark/manifests/facts-factorial.json --out .local/spatial-facts-preflight --mode preflight
npx tsx scripts/spatial-benchmark.ts --manifest fixtures/spatial-benchmark/manifests/calibration.json --out .local/spatial-dry-run --mode dry-run
npx tsx scripts/spatial-benchmark.ts --manifest fixtures/spatial-benchmark/manifests/calibration.json --out .local/spatial-replay --mode replay --responses fixtures/spatial-benchmark/evaluator/replay.json

# Separate evaluator-only step after source/artifact freeze:
npx tsx scripts/spatial-benchmark.ts --mode calibrate --run .local/spatial-replay/slope-row--combined--1 --task slope-row --out .local/spatial-score-slope
npx tsx scripts/spatial-benchmark.ts --mode stage --run .local/spatial-replay/slope-row--combined--1 --out .local/spatial-evaluator-input
```

Preflight also probes Bubblewrap isolation and preserves source copies. `compiler.mjs` is the exact bundled compiler used. To reproduce compilation, use the archived source call/build seed, pinned libraries and that bundle in the same sandbox (`isolatedCompile`). The bundle embeds the exact compiler/VM/type/schema/colour implementation; source hashes and repository commit provide the attribution/version chain. Full-library locks bind the external read-only geometry/connector packs. `compilation.json` contains expanded build script, all compiler warnings and MPD; no renderer is involved. Dry-run probes can fail palette requirements and are explicitly marked infrastructure checks rather than model outcomes. The supplied replay file contains evaluator witnesses and must never be supplied to a live generating model.

## Assessment protocol v1

The manifest fixes evaluator version and view order (`iso`, `front`, `iso-back`, `back`). Before a live study, freeze a separate render configuration artifact containing renderer/build hash, look, lighting/backdrop, image dimensions, framing/bounds rule and camera parameters, plus assessment form hash. Archive every camera/image hash and presentation order. V1 preflight **does not render or invent an executed camera configuration**; live visual-study launch remains gated on that frozen artifact and adapter/budget review.

Use equal predefined views for every candidate, with no selected flattering view. Hide condition/model/part count/title/design notes from reviewers. First obtain unlabelled recognition, then reveal the brief and assess fidelity, proportions, composition, coherent contours and consistency across views. Record reviewer agreement. No visual reviewer output may enter the evaluated generation session, its repairs or a resumed thread; development learning belongs only in a later version and never tunes held-out cases.

Report visual design, construction requirements, verification coverage and process/cost separately. Keep verified-palette and open-palette tracks labelled. Report initial/final acceptance, warnings, missing coverage, inventory violations, checks/repairs/searches, retrieved facts, bytes/tokens where available, runtime and infrastructure failures. Do not infer actual use of a retrieved fact from mere availability; calibration correctness and later occurrence-linked analysis are separate evidence. A connected graph does not establish stability or assembly sequence.

Retain every scheduled case, including ordinary poor outputs and unevaluated runs. Infrastructure retries are predetermined (zero here), separately labelled and never swapped for better model outputs. Summarise paired task-level effects with repeated samples clustered by task; views are not independent generated builds. Predefine exclusions and uncertainty analysis before seeing results. Historical 183/182/175 and 349/343 totals are exploratory context, not power estimates or promotion evidence. Promote no default on the basis of a best sample or unblinded marginal win.

## Initial delivery boundaries

Implemented: policy validation/enforcement, fresh one-way text sessions, isolated compiler, exact inputs/payloads/hashes, modular facts/pagination/aliases, source freeze/evaluator staging, calibration witnesses/evaluator and declarative comparison/preflight/replay facilities.

Tested: focused unit and CLI integration evidence is recorded in [VERIFICATION](VERIFICATION.md). No editor/default/gallery behaviour changed, and no browser/performance claim is made.

Experimentally evaluated: none. Replay is not generation research. No quality improvement is claimed.

Deferred: live provider adapter/native-runtime audit and paid budget, private held-out suite/reviewer sessions, executed visual renderer protocol, broader uncertainty-preserving occurrence/interface diagnostics, physical shortcut counting, assembly-language poses/offsets/attachment assistance, model-authored advanced component provenance, alternative design metadata/guidance, functional motion tasks and physical builder audits. These require separate increments and comparisons.

## Corrected reference for future generation — 14 October 2026

Use `factsVersion: "spatial-part-facts/2"` for corrected discovery/inspection and task `sizePolicy: "exact"` when count is a validity requirement. The [generation data audit](GENERATION-DATA-AUDIT.md) records differences, deterministic evidence and limits. v1 remains the historical control, including its arch-clearance and nominal-search limitations; no archived result was rewritten. E and the legacy richer-facts path are unchanged. The automation API exposes no new operation from this host-only increment.
