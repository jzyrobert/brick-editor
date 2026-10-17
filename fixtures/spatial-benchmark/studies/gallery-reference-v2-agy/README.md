# Gemini gallery builds through agy — 17 October 2026

The owner requested the six existing gallery briefs from Gemini 3.8 Flash
and Gemini 4 Argon on high thinking, testing Flash first and checking quota
after every run. Generation uses the current corrected-reference E procedure:
the same six filled prompts as the archived Luna cohort, advisory targets,
`spatial-part-facts/2`, text-only searches and checks, three checks and two
repairs. No images or visual critiques enter generation. Only frozen,
compiler-accepted sources are publication candidates.

The [procedure](../../../../docs/AGY-GENERATION.md) documents the native CLI,
Windows-to-WSL compiler isolation, quota gate and guarded publication workflow.
This is an additional gallery cohort, not evidence of improved build quality
or a controlled comparison across transports.

## Transport preflight

- The model-free isolated compiler probe passed all six briefs on Windows
  through WSL. The namespace retains network isolation and read-only library
  mounts. Ubuntu's packaged Node requires its externalized runtime builtins;
  Windows-to-WSL compilation uses a single request file mounted read-only
  because closed Windows stdin pipes were unreliable.
- A Flash smoke test confirmed continuation memory. A requested sentinel-file
  read reported no file tool available and returned no sentinel content.
  The custom agent requests no native tools, with a deny-all hook and
  streamed tool-attempt rejection as additional guards. The initialization
  event still lists the CLI's general tool catalog.
- The first real Flash pilot, on transport 1, accepted **Captain Barnaby the
  Pelican on a Bicycle**: 310 parts, two warnings, no compiler errors. Its three
  final gallery views rendered successfully. All six filled input prompts
  match the archived Luna preflight byte for byte. The pilot is retained as
  Flash's pelican response; it is not rerun following visual review.
- Argon's first transport-1 pelican attempt failed during a continuation with
  `Function call is empty - no input to parse`. The full failed attempt is
  retained separately. It made no accepted build.
- Structured-output tests on Flash and Argon revealed that `agy` can return
  several internal retry responses concatenated in its final envelope.
  A follow-up Flash probe attempted a native resource tool and was rejected;
  structured output is not used for production. Transport 2 clarifies in its
  system instruction that all JSON routes are ordinary response text and
  selects the last completed assistant response from the stream. It still rejects every errored turn. Native
  retries and their usage remain visible in local evidence; no output is
  edited or manually repaired.
- The transport-2 Argon pelican also failed with the empty-function diagnostic.
  Its stream contains a 34,101-token provider response, above the declared
  32,768-token budget, followed by an internal retry. The original outcome is
  unchanged; transport 3 now rejects such a response as a model-budget failure
  as soon as its usage arrives. For a response within budget, only the exact
  known empty-function artifact and a complete declared-protocol JSON object
  can be recovered. Other native errors and every tool attempt remain fatal.
- Flash's transport-2 Piplup also hit the empty-function error, with a
  40,554-token native response. Argon's transport-3 Piplup stopped at the old
  guard with a 45,146-token response. All these records remain unchanged.
  The native-high profile was then adapted to a 128,000-token host guard,
  because `agy` cannot configure the former 32K server limit. This does not
  change the native request, the filled prompts or the other assistance
  budgets, and does not purchase credits. The owner explicitly approved native
  high thinking with this 128,000-token acceptance limit. Flash and Argon both passed a
  same-conversation resume smoke test. Recoveries replay saved responses with
  exact request/compiler checks before continuing only the original model
  conversation; the time already spent is retained.
- Flash's temple returned the same function-parser error without its detailed
  cause, followed by a complete JSON wrapper for `check_build`. Transport 4
  recognizes these two observed diagnostic forms. The original JSON is passed
  unchanged to the normal protocol-repair loop rather than corrected by the
  host. Native-tool, unknown-route and unrelated-error guards remain in place.
- Transport 5 adapts the observed `tool: check_build` / `input` carrier to the
  host's `check_build` field, preserving its code and seed exactly. The host
  still validates and counts each check; no geometry or final source is edited.
  Early generic `modelCalls: 0` / replay-network preflight fields describe the
  shared model-free preflight, not the later native generation calls. Case
  audits, native usage metadata and transport settings record the actual runs;
  later preflights mark the provider call count unknown because CLI housekeeping
  and internal retries are not fully observable.

Argon's first temple attempt on transport 5 returned two complete protocol
objects in a single native assistant step after the known parser diagnostic.
The initial failed outcome is retained. Transport 6 passes the entire text
unchanged to the normal bounded JSON-repair loop after verifying every object
is complete and on a declared route. This consumes the original case's repair
budget when continued; no object is chosen and no source is edited.

Flash's first Star Destroyer attempt on transport 5 returned completed prose
while diagnosing that same parser artifact and was rejected by the narrower
transport guard. Transport 7 treats all completed text after either exact known
diagnostic like successful native text: it reaches the unchanged host protocol,
which rejects undeclared routes and spends the existing repair budget on
malformed replies. Unknown errors, incomplete native streams, native tools and
output-budget violations still fail. Earlier outcomes are preserved; any
continuation uses only its own native conversation and remaining budgets.

Argon's Ewok returned its exact stream-interruption diagnostic after a complete
draft-check response had already reached DONE. Transport 8 verifies that the
saved JSON belongs to the interrupted external turn before delivering it
unchanged to the host. Its provider request is not repeated; only the normal
compiler feedback can continue the same native conversation with remaining
budgets. The earlier interruption remains archived.

## Quota policy

Initial quota was 100% Gemini weekly, 100% Gemini five-hour and 100% Argon
weekly. After the Flash pilot it was 100% / 98% / 100%; after the aborted
Argon attempt, 100% / 98% / 99%. Subsequent readings are retained per run.
Generation is serial. The adaptive next-run estimate and five-point reserve
are documented in the procedure. Missing quota stops work; credits are not
purchased and quota resets are not awaited.

## Outcomes and publication

9 accepted builds from 12 completed cases, 3 failed final outcomes and 0 quota-gated skips out of twelve planned cases. The schedule completed without a quota stop.

| Brief     | Model                 | Outcome                                                          | Parts | Warnings | Active seconds | Build                                                   |
| --------- | --------------------- | ---------------------------------------------------------------- | ----: | -------: | -------------: | ------------------------------------------------------- |
| pelican   | Gemini 3.8 Flash/high | Accepted                                                         |   310 |        2 |            365 | [Open](https://bricks.robertj.in/?gallery=ee15b3045deb) |
| pelican   | Gemini 4 Argon/high   | Accepted · continued                                             |   861 |        2 |           1462 | [Open](https://bricks.robertj.in/?gallery=54a3f3afdcfe) |
| piplup    | Gemini 3.8 Flash/high | Accepted · continued                                             |   763 |        1 |            470 | [Open](https://bricks.robertj.in/?gallery=746ff27b7848) |
| piplup    | Gemini 4 Argon/high   | Accepted · continued                                             |   922 |        1 |            731 | [Open](https://bricks.robertj.in/?gallery=ae16905b8678) |
| temple    | Gemini 3.8 Flash/high | Accepted · continued                                             |  1397 |        1 |            496 | [Open](https://bricks.robertj.in/?gallery=e21c4fd3ccd3) |
| temple    | Gemini 4 Argon/high   | Accepted · continued                                             |  1959 |        3 |           1473 | [Open](https://bricks.robertj.in/?gallery=7ea14e8f8e5d) |
| destroyer | Gemini 3.8 Flash/high | model-failure: Invalid final submission; repair budget exhausted |     — |        — |            502 | —                                                       |
| destroyer | Gemini 4 Argon/high   | Accepted                                                         |  5340 |        1 |            891 | [Open](https://bricks.robertj.in/?gallery=ca99d2770076) |
| dragon    | Gemini 3.8 Flash/high | Accepted                                                         |   816 |        2 |            586 | [Open](https://bricks.robertj.in/?gallery=baf76cf0a61b) |
| dragon    | Gemini 4 Argon/high   | model-failure: Run-wide infoCalls budget exhausted               |     — |        — |           1138 | —                                                       |
| ewok      | Gemini 3.8 Flash/high | model-failure: Invalid final submission; repair budget exhausted |     — |        — |            518 | —                                                       |
| ewok      | Gemini 4 Argon/high   | Accepted · continued                                             |  3364 |        1 |           1182 | [Open](https://bricks.robertj.in/?gallery=6bcbf8212ad1) |

Targets remain advisory. Accepted means the compiler returned no errors; construction warnings remain visible and do not prove physical stability. Continued rows retain their own original conversations, prior assistance and cumulative active time. Earlier failures are preserved separately, including the original lower-cap and native-parser outcomes.

The owner subsequently identified that the prompt did not disclose the separate
eight-call inspection allowance which stopped Argon's dragon. That outcome is
a runner-limit failure, despite its recorded `model-failure` status. The runner
now offers the prompt's assistance contract; the owner-requested Argon
continuation and fresh Flash Star Destroyer/Ewok retries are recorded in
[the follow-up archive](../gallery-reference-v2-agy-retries/README.md). These
original frozen outcomes and the first publication remain unchanged.

Final observed quota at 2026-10-17T06:25:35.524Z: **97% Gemini weekly, 91% Gemini five-hour and 27% Argon weekly**. The next-run estimate uses each model's largest full-build quota drop, including original plus continuation phases, with a five-point reserve. Rounded counters are estimates; no credits were purchased.

Published **9 new builds**, bringing the gallery to **133 entries**. All 124 earlier builds and the Fresh E default are unchanged. The [main-only publishing workflow](https://github.com/jzyrobert/brick-editor/actions/runs/39011770268) passed, including exact D1/index equality. Public verification fetched all 54 new assets and matched their byte counts and SHA-256 hashes. See [the publication receipt](publication-receipt.json). Final-only renders were inspected; no visual feedback or manual source repairs entered generation.

Cloudflare MCP and local Wrangler were unauthenticated. The owner entered a separate gallery-scoped token directly into GitHub Actions as `CLOUDFLARE_GALLERY_API_TOKEN`; no token value passed through chat, source, generation directories or the public archive.

## Evidence and reproduction

- [Archive manifest](archive-manifest.json): 20 selected and earlier run records, with archive/original SHA-256 hashes. Only unrelated Claude/GPT quota TSV rows are omitted from quota records; frozen generation files remain byte-identical.
- [Schedule](schedule.json), per-run manifests/preflights, exact prompts, replies, mechanical audits, frozen submissions/MPDs, compiler reports, native usage summaries and quota readings. Native conversations/stderr, credentials, temporary Git roots and compiler bundles are excluded.
- [Publication bundle](publication/manifest.json): checksummed SQL/index/assets and the original public baseline. Local SQLite replay reproduces the reviewed index exactly.
- Type checking and formatting pass; 40 focused transport/quota/gallery tests and 17 compiler/session integration tests pass. No blinded visual assessment or controlled cross-transport quality comparison was performed. The native CLI's provider cap and internal housekeeping limitations remain as documented above.

Use [the procedure](../../../../docs/AGY-GENERATION.md) for new runs; preserve new outputs in fresh directories rather than overwriting this frozen cohort.
