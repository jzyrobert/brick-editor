# Generate the gallery briefs with Antigravity CLI

`scripts/generate-agy-gallery.ts` runs the six existing gallery briefs with
Gemini 3.8 Flash and Gemini 4 Argon, both on high thinking. It uses the current
E guidance, corrected `spatial-part-facts/2` references and the same
`GenerationSession` as the Codex and Claude cohorts. Targets remain advisory.

Authenticate `agy` interactively first. `agy models` must list
`gemini-3.8-flash-high` and `gemini-4-argon-high`. The compiler requires Linux
Node 22 or later and bubblewrap. On Windows, install those in the default WSL
distribution; the host still runs the authenticated Windows `agy` CLI. Install
the repository dependencies with `npm ci` and rendering Chromium with
`npx playwright install chromium`. Use `npm.cmd`/`npx.cmd` in PowerShell when
script execution policy blocks their `.ps1` wrappers.

```sh
npx tsx scripts/generate-agy-gallery.ts --out .local/agy-gallery-new
```

The first case is Flash's pelican; it must produce an accepted build before the
schedule continues. The remaining order alternates Flash and Argon for pelican,
Piplup, temple, Star Destroyer, dragon and Ewok. Each case starts in a separate
temporary Git root containing only transport configuration, with a new native
CLI conversation. Only that case's text searches, part facts, compiler checks
and repairs enter its conversation. No sources from other builds, images or
render feedback are provided. The six filled initial prompts are unchanged
from the earlier corrected-reference gallery cohort.

The custom `brick-blind` main agent uses a neutral system prompt and empty
tool/skill/plugin/MCP lists. A deny-all `PreToolUse` hook and streamed-event
checks provide additional protection: any native tool or subagent attempt
invalidates the run. The CLI's initialization event still advertises its full
tool catalog; that field alone is not evidence that a model used a tool. The
Flash transport probe was unable to access a file tool. Native host diagnostics
are retained locally and excluded from the published archive.

The CLI cannot configure a server output-token cap. The adapter checks the
reported per-turn output usage after completion and rejects a reply exceeding
the manifest's 32,768-token limit. This cannot prevent an over-budget provider
call; it is an explicit difference from transports with a server cap. The CLI's
own internal error handling and housekeeping calls are also outside the
adapter's control. No API keys are copied into generation directories.

Transport 2 adds a transport-only system instruction that the JSON routes are
ordinary text messages handled externally, not native function calls. It reads
the final completed assistant step from streaming events. `agy` may concatenate several
internal retry responses in its final envelope; passing that concatenation
directly to the benchmark would create a protocol error the model did not
emit as one response. Every underlying event and the envelope hash remain in
local evidence. An errored native result is always rejected, even if its text
contains a valid JSON object. This transport behavior differs from a direct
provider broker and does not establish a controlled model comparison. The
`--json-schema` option was tested and rejected for production: it introduced
internal retries and a native resource-tool attempt in a Flash probe, which
the adapter rejected. Failed probes are retained locally.

## Quota and stopping

`agy -p /usage` reads account quota without a model call. Each case records it
before and after generation. Flash is gated on Gemini weekly and five-hour
limits; Argon is also gated on its separate weekly limit. Missing quota stops
the schedule. The next-run estimate is the larger of five percentage points
and 1.5 times the largest observed drop plus two points, with another five
points reserved. Rounded percentages and unrelated account use mean this is
an estimate, not a guarantee that the provider will finish the next request.
The batch stops after three consecutive infrastructure failures. It does not
purchase credits or wait for quota resets.

An existing completed case can be reused only within the same schedule after
its manifest, case ID and frozen file hashes are verified. An incomplete
directory is refused; it is never overwritten or silently restarted. The
optional `--pilot DIR` uses an already completed Flash pelican pilot. Single
fresh cases can also be run with:

```sh
npx tsx scripts/spatial-benchmark-live-agy.ts --manifest fixtures/spatial-benchmark/studies/gallery-reference-v2-agy/flash.json --out .local/agy-pilot-new --cases pelican--reference-v2--1
```

Retain failures. A transport correction or deliberately changed retry must
have a separate fresh directory and an explicit record of the prior outcome.

## Freeze, render and publish

After generation stops, collect the selected run directories (one outcome per
model/brief) and prepare the publication. This command makes no model calls:

```sh
npx tsx scripts/prepare-spatial-gallery.ts --runs RUN1,RUN2 --out fixtures/spatial-benchmark/studies/gallery-reference-v2-agy/publication
npx tsx scripts/publish-gallery-bundle.ts fixtures/spatial-benchmark/studies/gallery-reference-v2-agy/publication
```

Only compiler-accepted frozen sources are candidates. Preparation verifies
their hashes, recompiles the saved build script to the identical MPD, renders
the three standard Realistic gallery views, and writes content-addressed
assets plus a reviewed SQL/index bundle. Inspect the final renders without
feeding them back to generation. Archive exact prompts, feedback, outcomes,
quota and frozen sources; exclude native conversations, credentials, temporary
repositories and compiler bundles.

Bundle version 3 is additive. Its verifier preserves every existing build,
prompt, agent and default-generation selection. The remote publisher checks
the live baseline before uploading, uploads all immutable assets before SQL,
and requires exact database/index equality before publishing the new index.

Push the reviewed source and assets through the repository's branch/PR checks.
After all main validation jobs pass, dispatch the **Publish reviewed gallery
generations** workflow with `collection=gemini-agy`. It uses the GitHub Actions
secret `CLOUDFLARE_GALLERY_API_TOKEN` (falling back to the existing token).
The token requires D1 Edit and Workers R2 Storage Edit on the gallery's account.
Enter it directly in GitHub's secrets settings, never in prompts, source or
ordinary tool output. Main validation and the publishing workflow remain
required; this procedure does not deploy the app by hand.

See [the run record](../fixtures/spatial-benchmark/studies/gallery-reference-v2-agy/README.md)
for actual outcomes, transport revisions and publication status.
