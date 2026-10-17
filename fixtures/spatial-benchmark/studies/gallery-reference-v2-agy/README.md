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

## Quota policy

Initial quota was 100% Gemini weekly, 100% Gemini five-hour and 100% Argon
weekly. After the Flash pilot it was 100% / 98% / 100%; after the aborted
Argon attempt, 100% / 98% / 99%. Subsequent readings are retained per run.
Generation is serial. The adaptive next-run estimate and five-point reserve
are documented in the procedure. Missing quota stops work; credits are not
purchased and quota resets are not awaited.

## Outcomes and publication

Generation and publication are in progress. Cloudflare MCP and local Wrangler
were unauthenticated in this session. The owner added the separate GitHub
Actions secret `CLOUDFLARE_GALLERY_API_TOKEN`; publishing will use that credential
without exposing it in chat or generation sessions.
The final run table, frozen evidence and publication receipt will replace this
status when the batch ends.
