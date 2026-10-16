# Claude builds with corrected references — 16 October 2026

The owner asked for the corrected-reference gallery cohort to be repeated with Claude models locally and published alongside the OpenAI builds: Haiku 5.5, Sonnet 5.5 and Opus 5.5 at high effort and Fable 5.1 at medium, on the six existing gallery briefs. The builds join the existing **E · corrected part references** generation (`e-reference-v2-20261014`), whose description now names both model families and their outcomes. The Fresh E default and every earlier entry are unchanged.

## Setup

The [manifests](haiku.json) are the [OpenAI cohort's](../gallery-reference-v2/README.md) with only the model and effort changed: E guidance, original advisory targets, `spatial-part-facts/2`, on-demand shape/connector/capability inspection, blind-mechanical feedback, the same budgets (16 turns, 3 checks, 2 repairs, 32,768 output tokens, one hour) and zero infrastructure retries. Every filled prompt and the compiler bundle hash are byte-identical to the archived Luna preflight. The cohort ran on commit `07d36443` (transport 2) and the four resumed cases on `2c8994ba` (transport 3 and `--cases`); both preflights record a clean tree.

The harness had only a Codex broker, so `scripts/spatial-benchmark/claude-channel.ts` adds a native Claude CLI channel and `scripts/spatial-benchmark-live-claude.ts` runs a manifest through it. Claude authentication is managed by the host, so unlike the Codex broker the channel cannot inspect or rewrite HTTP payloads. Instead it turns tools off, enforces safe mode and an empty MCP configuration, starts each case in an empty directory with the calling session's identity scrubbed from the environment, resumes only that case's own session, caps output at the manifest budget, checks every streamed event for tool use and confirms the declared model answered each turn. Runs used a local `/lib64` bind so the isolated compiler runs on x86-64; `main` has since added the same bind for CI.

- **Transport 1 (aborted).** Claude Code's default system prompt teaches tool-call markup; with tools off, Sonnet prefixed protocol JSON with invented `<invoke name="…placeholder">` blocks, which the session counts as protocol violations against the repair budget. Sonnet's pelican ended as a model failure that way. The attempt was stopped after four cases and is retained in `aborted-transport-v1/`; nothing from it was published.
- **Transport 2 (cohort).** Claude Code's system prompt is replaced by `You are a helpful assistant.` Two Sonnet trials on the same pelican input returned clean protocol JSON. All 24 cases ran on this transport.
- **Transport 3.** Claude Code reports an exhausted output cap as an API error after its own internal retries rather than a `max_tokens` stop reason, so transport 2 filed Haiku's temple as an infrastructure failure. Version 3 classifies it as a model budget failure, as the Codex broker does. The original record is unchanged. The four resumed cases ran on version 3; nothing else differs.
- **Resumed cases.** A container restart killed Fable's Ewok and Opus's Star Destroyer mid-case, before any outcome, and Opus's dragon and Ewok had not started. Their partial audits are kept in `results/fable/` and `results/opus/`; each case then ran once from a fresh start (`--cases`) with identical inputs, manifest and compiler (`results/*-resume/`). No case with an outcome was run again.

Claude Code's own internal retries and its small housekeeping model calls are outside the channel's control and are recorded in the native logs, which are not archived.

## Outcomes

21 of 24 cases were accepted and published; three failed and are retained, not repaired or replaced. Cost is Claude Code's reported list-price cost for the case.

| Brief     | Model              | Outcome                                                                    | Parts | Warnings | Seconds | Cost (USD) | Build                                                   |
| --------- | ------------------ | -------------------------------------------------------------------------- | ----: | -------: | ------: | ---------: | ------------------------------------------------------- |
| pelican   | Haiku 5.5 (high)   | Accepted                                                                   |   117 |        1 |     657 |       0.20 | [Open](https://bricks.robertj.in/?gallery=01b5636d95a5) |
| piplup    | Haiku 5.5 (high)   | Accepted                                                                   |   871 |        1 |     303 |       0.06 | [Open](https://bricks.robertj.in/?gallery=928ce2c0d111) |
| temple    | Haiku 5.5 (high)   | Output-token budget (filed as infrastructure)                              |     — |        — |     668 |       0.12 | —                                                       |
| destroyer | Haiku 5.5 (high)   | Accepted                                                                   |  5718 |        1 |     272 |       0.06 | [Open](https://bricks.robertj.in/?gallery=27204c53a13f) |
| dragon    | Haiku 5.5 (high)   | Accepted                                                                   |   559 |        1 |     295 |       0.06 | [Open](https://bricks.robertj.in/?gallery=55f1f4b99f00) |
| ewok      | Haiku 5.5 (high)   | Accepted                                                                   |  3032 |        1 |     319 |       0.13 | [Open](https://bricks.robertj.in/?gallery=368ee19afc0b) |
| pelican   | Sonnet 5.5 (high)  | Accepted                                                                   |   648 |        1 |     469 |       0.57 | [Open](https://bricks.robertj.in/?gallery=41a8ac7cc76e) |
| piplup    | Sonnet 5.5 (high)  | Accepted                                                                   |   940 |        1 |     284 |       1.90 | [Open](https://bricks.robertj.in/?gallery=9d264f0ced99) |
| temple    | Sonnet 5.5 (high)  | Accepted                                                                   |  2194 |        1 |     563 |       2.49 | [Open](https://bricks.robertj.in/?gallery=a280aee4986a) |
| destroyer | Sonnet 5.5 (high)  | Accepted                                                                   |  5021 |        1 |     352 |       2.23 | [Open](https://bricks.robertj.in/?gallery=dcd33a159ad3) |
| dragon    | Sonnet 5.5 (high)  | Accepted                                                                   |  1007 |        1 |     376 |       3.09 | [Open](https://bricks.robertj.in/?gallery=64819a8bc525) |
| ewok      | Sonnet 5.5 (high)  | Accepted                                                                   |  2840 |        1 |     501 |       2.24 | [Open](https://bricks.robertj.in/?gallery=8463b767330c) |
| pelican   | Opus 5.5 (high)    | Model failure: Run-wide checks budget exhausted                            |     — |        — |     957 |      16.84 | —                                                       |
| piplup    | Opus 5.5 (high)    | Accepted                                                                   |  1203 |        1 |     931 |      11.30 | [Open](https://bricks.robertj.in/?gallery=eb068441c25c) |
| temple    | Opus 5.5 (high)    | Accepted                                                                   |  1868 |        1 |     608 |       7.38 | [Open](https://bricks.robertj.in/?gallery=51612920c884) |
| destroyer | Opus 5.5 (high)    | Accepted · resumed                                                         |  4851 |        1 |     700 |       7.53 | [Open](https://bricks.robertj.in/?gallery=555db6f48cdc) |
| dragon    | Opus 5.5 (high)    | Accepted · resumed                                                         |   908 |        2 |     949 |      15.08 | [Open](https://bricks.robertj.in/?gallery=d4e9aa0b82bd) |
| ewok      | Opus 5.5 (high)    | Model failure: Invalid final submission; repair budget exhausted · resumed |     — |        — |     995 |      19.04 | —                                                       |
| pelican   | Fable 5.1 (medium) | Accepted                                                                   |   727 |        1 |     764 |      10.48 | [Open](https://bricks.robertj.in/?gallery=da10dfb851fd) |
| piplup    | Fable 5.1 (medium) | Accepted                                                                   |  1117 |        1 |     414 |       8.86 | [Open](https://bricks.robertj.in/?gallery=ad4fe2b24337) |
| temple    | Fable 5.1 (medium) | Accepted                                                                   |  1773 |        1 |     221 |       6.31 | [Open](https://bricks.robertj.in/?gallery=2caa3be068c5) |
| destroyer | Fable 5.1 (medium) | Accepted                                                                   |  4918 |        1 |     368 |      13.59 | [Open](https://bricks.robertj.in/?gallery=ee58ef634238) |
| dragon    | Fable 5.1 (medium) | Accepted                                                                   |   912 |        2 |     640 |      16.76 | [Open](https://bricks.robertj.in/?gallery=7cf6c26655f0) |
| ewok      | Fable 5.1 (medium) | Accepted · resumed                                                         |  2184 |        1 |     488 |      11.22 | [Open](https://bricks.robertj.in/?gallery=e10db801b413) |

Haiku's 117-part pelican is thin but compiler-accepted, so it is published under the same rule as every other accepted output. Opus's pelican used its three checks and then asked for a fourth; its Ewok used both repairs without clearing overlaps and then replied in prose.

## Retry of failed cases — 16 October 2026

At the owner's request, each of the three failed cases ran once more from a fresh start with the same manifest, inputs and compiler, on transport 3 at `main` commit `81a13e0f` (`results/haiku-retry/`, `results/opus-retry/`, `retry/`). This is a deliberate exception to the cohort's no-retry rule, recorded as such; the original failures remain archived.

| Brief   | Model            | Retry outcome                                                   | Parts | Warnings | Seconds | Cost (USD) | Build                                                   |
| ------- | ---------------- | --------------------------------------------------------------- | ----: | -------: | ------: | ---------: | ------------------------------------------------------- |
| temple  | Haiku 5.5 (high) | Model failure: output-token budget exhausted on the first reply |     — |        — |     659 |       0.12 | —                                                       |
| pelican | Opus 5.5 (high)  | Model failure: run-wide checks budget exhausted                 |     — |        — |     928 |      12.76 | —                                                       |
| ewok    | Opus 5.5 (high)  | Accepted                                                        |  2649 |        2 |    1064 |      18.39 | [Open](https://bricks.robertj.in/?gallery=d54ddfd013de) |

Opus's Ewok ("Endor Explorer 497-E") recompiled to its frozen MPD hash and is published in the same generation as `gallery-reference-v2-claude-opus-ewok-retry`. The generation description now reports 22 of 24 Claude builds and names the retry. The live index has 122 unique builds; the 121 earlier entries are unchanged and Fresh E remains the default.

## Evidence and reproduction

- **Implemented:** native Claude channel and runner, `--cases` for interrupted cases, four manifests, and an additive gallery publication into the existing v2 generation.
- **Tested:** type checking and formatting pass; a channel smoke test resumed a fresh session; preflights match the Luna inputs and compiler. All 21 publication compilations reproduce their frozen MPD hashes (`expected-ids.json`); 63 fixed-view renders; all 126 new public files return 200; the live index has 121 unique builds, all 100 earlier entries unchanged, the 21 new entries in `e-reference-v2-20261014`, and Fresh E still the default (`index-live-before.json`, `generation-update.sql`).
- **Experimentally evaluated:** 24 fresh generation outcomes and their mechanical records. No blinded visual assessment; the transport differs from the Codex broker, so this cohort is not a controlled comparison with the OpenAI builds.
- **Deferred:** a payload-level Claude broker, if host authentication ever allows one.

`results/` keeps each model's manifest, preflight, results and per-case audit, submission, freeze, compilation and MPD. Native transcripts, the compiler bundle and host-source copies are excluded. `host-tools/prepare-claude-gallery.ts.txt` laid accepted submissions out as one-shot folders for `npm run gallery:publish`, one call per brief with its existing `--prompt-id` and `--generation e-reference-v2-20261014 --remote`.

```sh
npx tsx scripts/spatial-benchmark-live-claude.ts --manifest fixtures/spatial-benchmark/studies/gallery-reference-v2-claude/sonnet.json --out .local/claude-v2/sonnet
npx tsx scripts/spatial-benchmark-live-claude.ts --manifest fixtures/spatial-benchmark/studies/gallery-reference-v2-claude/opus.json --out .local/claude-v2/opus-resume --cases destroyer--reference-v2--1,dragon--reference-v2--1,ewok--reference-v2--1
```
