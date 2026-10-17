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

The Gemini manifests now select `assistanceLimits: "prompt"`. The runner allows
ten search replies of at most five queries each, three draft checks and two
repairs. Search queries and search replies are counted separately; an eleventh
search reply receives a notice without a search result. The prompt gives no
part-inspection call or batch-size allowance, so this profile imposes neither.
It records inspection calls, total turns and reference bytes without using the
historical eight-call, sixteen-turn or reference-volume caps to stop generation.
The agreed time, output and compiler resource protections remain. Historical
benchmark manifests without this option retain their original budget contract.

The custom `brick-blind` main agent uses a protocol-only system prompt and
requests empty tool/skill/plugin/MCP lists. A deny-all `PreToolUse` hook and streamed-event
checks provide additional protection: any native tool or subagent attempt
invalidates the run. The CLI's initialization event still advertises its full
tool catalog; that field alone is not evidence that a model used a tool. The
Flash transport probe was unable to access a file tool. Native host diagnostics
are retained locally and excluded from the published archive.

The CLI cannot configure a server output-token cap. The adapter checks the
reported output usage for each completed native model response and rejects a response exceeding
the manifest's limit. The native-high profile now uses a 128,000-token host
guard: the CLI cannot apply the older 32,768-token server cap, and native high
thinking exceeded it in the transport trials. The first Flash pilot and
earlier interrupted cases retain their original 32K records. Raising this host
guard does not change the native model request or enable paid credits.
This cannot prevent an over-budget provider
call; it is an explicit difference from transports with a server cap. The CLI's
own internal error handling and housekeeping calls are also outside the
adapter's control. No API keys are copied into generation directories.

Transport 2 adds a transport-only system instruction that the JSON routes are
ordinary text messages handled externally, not native function calls. It reads
the final completed assistant step from streaming events. `agy` may concatenate several
internal retry responses in its final envelope; passing that concatenation
directly to the benchmark would create a protocol error the model did not
emit as one response. Every underlying event and the envelope hash remain in
local evidence. Transport 2 rejected every errored native result, even if its text
contained a valid JSON object. This transport behavior differs from a direct
provider broker and does not establish a controlled model comparison. The
`--json-schema` option was tested and rejected for production: it introduced
internal retries and a native resource-tool attempt in a Flash probe, which
the adapter rejected. Failed probes are retained locally.

Transport 3 handles a reproduced CLI artifact: a complete JSON response can be
followed by the exact `Function call is empty - no input to parse` parsing
diagnostic. Only that full known diagnostic, with a completed JSON object on
one of the declared protocol routes and no native tool attempt, can be
recovered. The original error and response hashes remain in the run metadata;
normal compiler, search, check and repair limits still apply. Other errors
and partial/nonprotocol text are rejected. Token limits are checked on every
native model response, including internal retries, before recovery. A response
over its declared manifest limit is a model-budget failure; totals across several internal
calls are recorded separately rather than mistaken for one response.

Transport 4 also recognizes the observed version of that same parser error
which omits its detailed cause. Both complete diagnostic forms are matched
exactly. A malformed payload referring to a declared route is delivered
unchanged to the normal bounded protocol-repair loop; the adapter does not
rewrite it into a valid request or alter the build source. Unrelated errors,
unknown routes, native tools and incomplete JSON are still rejected.

Transport 5 additionally adapts the observed
`{"tool":"check_build","input":{"code":"…","seed":1}}` carrier to
`{"check_build":{"code":"…","seed":1}}`. It changes only the envelope;
the JavaScript and seed remain identical, the host validates the payload, and
the request consumes the usual draft-check budget. Original and normalized
response hashes are retained. Other payload formats still use ordinary repair.

Transport 6 handles a further observed native retry artifact: multiple complete
declared-protocol JSON objects can be concatenated inside one assistant step.
For the same two exact parser diagnostics, the adapter delivers that entire
text unchanged to the host's bounded JSON-repair loop. It never selects one
object, merges objects or changes source. Every object must be complete and
on a declared route; unknown routes, partial JSON and surrounding prose are
rejected. The ordinary turn, check, repair and time limits remain in force.

Transport 7 makes this handling consistent with successful native responses:
after either exact known parser diagnostic, any nonempty **completed** native
assistant text is delivered unchanged to the host, including prose and
malformed JSON. The host already rejects undeclared routes and spends the
ordinary repair budget on invalid protocol; the transport must not suppress
that chance to repair merely because agy also emitted its parser artifact.
No model code is edited and no extra feedback is supplied. A stream without a
completed assistant response, an unknown error, a native tool/subagent attempt
or an output-budget violation still fails. Versions 3–6 imposed the narrower
content checks described above; their earlier outcomes remain archived.

Transport 8 also recognizes the exact observed stream-interruption diagnostic,
but only when the latest assistant response is DONE and contains one complete
declared-protocol JSON object. Replay verifies native-result counts and event
positions against the external audit, so text from an earlier turn or an
incomplete later response cannot be substituted. The saved reply is delivered
unchanged; the interrupted provider request is not repeated. Only ordinary
subsequent host feedback can continue that original conversation. All prior
budgets, time and quota costs remain accounted for, and the interrupted outcome
stays archived. Other stream/network errors remain fatal.

## Quota and stopping

`agy -p /usage` reads account quota without a model call. Each case records it
before and after generation. Flash is gated on Gemini weekly and five-hour
limits; Argon is also gated on its separate weekly limit. Missing quota stops
the schedule. The next-run estimate is the larger of five percentage points
and 1.5 times that model's largest observed drop plus two points, with another five
points reserved. Rounded percentages and unrelated account use mean this is
an estimate, not a guarantee that the provider will finish the next request.
The batch stops after three consecutive infrastructure failures. It does not
purchase credits or wait for quota resets. A model with insufficient quota is
skipped while eligible cases from the other model continue. Every shared and
model-specific counter is compared separately when measuring consumption.

The gallery driver applies its full-history estimate before launching each
single-case runner. That runner takes another fresh reading and records its
own local gate, whose estimate starts at the minimum for its one-case history.
Both readings remain in the archive; the driver's schedule records the
cross-case adaptive gate.

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

An interrupted known empty-function/native-cap case can be continued in its
original conversation, with no source edits or new design prompt:

```sh
npx tsx scripts/recover-agy-run.ts --from ARCHIVED_RUN --out FRESH_RUN --output-budget 128000
```

Recovery verifies all frozen hashes and the original compiler bundle, replays
saved responses through the same host protocol, and checks that every replayed
request is byte-identical to the original. It then delivers the lost completed
native response. Only subsequent ordinary compiler/search feedback can resume
that case's own CLI conversation. Replaying makes no model calls. The original
active time is subtracted from the remaining time budget; searches, checks,
repairs and turns are reconstructed by replay rather than reset. The earlier
outcome remains archived and the recovery is labelled explicitly. Completed
lower-cap records remain reusable when only this unenforceable host guard is
raised; model, prompt, task and assistance changes are refused.

Replay recompiles saved drafts and measures their compiler time again; its
reported compiler milliseconds are replay measurements. Cumulative active
seconds retain the original phase as well as the continuation.

For the original Argon dragon stopped by the undisclosed inspection allowance,
append `--prompt-limits` to the recovery command. This accepts only that exact
host-budget failure, verifies all saved requests and completed native responses,
and replays historical turns under their original limits. The new limits take
effect at the pending request. Earlier host denials remain unchanged in the
conversation; the pending inspection is answered without repeating its model
call. Checks, repairs, active time and quota already spent are retained. Keep
the original failure and every recovery attempt in separate directories.

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
generations** workflow with `collection=gemini-agy` for the original cohort or
`collection=gemini-agy-retries` for the corrected-limit follow-up. Each selection
uses its separately reviewed, frozen bundle. It uses the GitHub Actions
secret `CLOUDFLARE_GALLERY_API_TOKEN` (falling back to the existing token).
The token requires D1 Edit and Workers R2 Storage Edit on the gallery's account.
Enter it directly in GitHub's secrets settings, never in prompts, source or
ordinary tool output. Main validation and the publishing workflow remain
required; this procedure does not deploy the app by hand.

The checked-in publication is frozen against its recorded baseline. A later
batch needs a fresh reviewed bundle path and workflow selection; reapplying this
bundle after publication is refused by the live-baseline check.

See [the run record](../fixtures/spatial-benchmark/studies/gallery-reference-v2-agy/README.md)
and [the corrected-limit follow-up](../fixtures/spatial-benchmark/studies/gallery-reference-v2-agy-retries/README.md)
for actual outcomes, transport revisions and publication status.
