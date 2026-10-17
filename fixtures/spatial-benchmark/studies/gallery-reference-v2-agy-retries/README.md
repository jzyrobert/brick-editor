# Gemini retries after correcting assistance limits — 17 October 2026

The owner requested a runner fix, continuation of the original Argon dragon if
resumable, and fresh retries of Flash's Star Destroyer and Ewok. The original
[nine accepted builds and three failed outcomes](../gallery-reference-v2-agy/README.md)
remain unchanged. All models use native high thinking and the approved 128,000-token
host response guard; no paid credits are purchased.

The filled prompts are byte-identical to their original inputs. The corrected
gallery profile enforces the stated ten search replies of at most five queries,
three draft checks and two repairs. It does not impose the undisclosed eight-call
inspection allowance, eight-ID batch size, sixteen-turn cap or reference-volume
cap. Queries, replies, inspections, turns and bytes remain recorded. The agreed
time/output and compiler resource protections remain. Historical benchmark
contracts are preserved. See [the procedure](../../../../docs/AGY-GENERATION.md).

Argon's original native conversation resumes at its pending ninth inspection
attempt. Replay verifies every saved request against the original and preserves
earlier host denials, including an oversized inspection batch. Corrected limits
take effect only at the pending request. Its two earlier draft checks, prior
active time and quota cost remain counted. No prior model request is repeated.
An initial local-only replay check detected the changed historical denial and
stopped before any generation model call; that attempt is archived separately.
The Flash retries start independent new conversations with the original prompts;
no earlier source, error feedback, image or visual critique enters them.

| Model / brief     | Starting conditions             | Outcome                                           | Parts | Inspection attempts | Search replies | Active seconds | Build                                                   |
| ----------------- | ------------------------------- | ------------------------------------------------- | ----: | ------------------: | -------------: | -------------: | ------------------------------------------------------- |
| Argon / dragon    | Original conversation continued | Invalid final submission; repair budget exhausted |     — |                   9 |              2 |           2332 | —                                                       |
| Flash / destroyer | Fresh retry                     | Accepted                                          |  4050 |                   0 |              0 |            465 | [Open](https://bricks.robertj.in/?gallery=5e42ff26f9f9) |
| Flash / ewok      | Fresh retry                     | Accepted                                          |  2748 |                   0 |              0 |            612 | [Open](https://bricks.robertj.in/?gallery=9e26a98601e8) |

2 accepted outcomes from 3 requested cases. Earlier failures
remain archived; this is an authorised follow-up with corrected assistance limits,
not a controlled comparison or evidence of improved model quality. Compiler
acceptance means no compiler errors; warnings do not prove physical stability.

Final observed quota at 2026-10-17T08:38:42.996Z: **13% Argon weekly, 97% Gemini weekly and 97% Gemini five-hour**.
Quota is checked before and after every run, with the adaptive estimate and five-point
reserve. The original Argon phase's cost is included in the continuation record.

Prepared an additive bundle of **2 builds**, **12 assets** and **135 total gallery entries**, preserving all 133 earlier builds and the Fresh E default. Publication is pending main validation.

- [Archive manifest](archive-manifest.json): exact frozen artifacts, inputs, host audits, response metadata, quota and original/archive hashes. Native event streams, stderr, compiler bundles, temporary roots and credentials stay local; unrelated model-pool quota TSV rows are omitted.
- [Argon continuation](results/argon-dragon/results.json), [Flash retries](results/flash-retries/results.json), and [the initial model-free replay check](results/argon-replay-preflight/results.json).
- [Publication manifest](publication/manifest.json): frozen-source recompilation, standard final renders and the exact previous gallery baseline. No source is manually repaired and final renders do not enter generation.

Type checking, 54 focused transport/gallery/live-runner tests and 20 session/compiler
integration tests pass, including the hidden-limit and historical-replay regressions.
Publishing uses the existing dedicated GitHub Actions gallery secret; its value
does not enter chat, source files or generation directories.
