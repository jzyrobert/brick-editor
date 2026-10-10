# Plan: a gallery, arena and leaderboard of agent builds

Status: **phase 1 built and published.** Written 3 October 2026; collection notes updated 10 October. The gallery uses D1 and a public R2 bucket on `gallery.bricks.robertj.in`. The reviewed E replacement collection covers six briefs with Sol, Astra and Opus at high effort; see [GALLERY](GALLERY.md) for the collection and guarded publication workflow. The app shows published builds with a live 3D view on each detail page ([§12](#12-phase-1-as-built)). Votes, the arena and the leaderboard (phases 2 and 3) are not built.

The idea comes from [Minebench](https://github.com/Ammaar-Alam/minebench) (see also [PERFORMANCE-MINEBENCH.md](PERFORMANCE-MINEBENCH.md)): people browse builds that models made from the same prompt, vote blind between two of them, and models are ranked from the votes.

This plan adapts that idea to this app, using only Cloudflare's free tier, with three goals:

1. **Mostly static.** Everything people read is a static file. A Pages Function runs only when someone votes.
2. **Only the owner publishes.** There is no upload endpoint at all. Builds are published from the owner's machine with `wrangler` and a Cloudflare API token. The Cloudflare account login (with 2FA) is the only authentication.
3. **The editor stays as it is.** It stays a static, offline-capable, phone-first app with a strict CSP. The gallery is an online-only addition that degrades with a message when offline.

Decisions already made by the owner:

- Scope: gallery, arena and leaderboard.
- Publishing: from the CLI with `wrangler`.
- Files: a public R2 bucket on a subdomain.
- The Cloudflare MCP will be connected in a later session.

## 1. Architecture

```
 owner's machine                              Cloudflare
 ───────────────                              ──────────
 npm run oneshot … (existing)                 R2 bucket "brick-gallery"  ── public on gallery.bricks.robertj.in
   └─ ~/brick-builds/oneshot-*/<effort>/         index.json           (60 s cache)
 npm run gallery:publish -- <dir> --remote       leaderboard.json     (60 s cache)
   1 compile + checks (0 errors)                 b/<sha256>.mpd.gz    (immutable)
   2 export MPD, gzip, hash                      s/<sha256>.json      (immutable: build script)
   3 render views → WebP                         r/<sha256>.webp      (immutable: renders)
   4 R2 put (skip existing)          ───────►    p/<sha256>.json      (immutable: run report, costs)
   5 D1 insert                       ───────►  D1 "brick-gallery": prompts, agents, builds, votes
   6 rebuild index.json from D1      ───────►
                                               Pages "brick-editor" (existing, bricks.robertj.in)
 GitHub Action, hourly (schedule)                static app + gallery.html  (static: never a Function)
   D1 votes → Bradley–Terry → leaderboard.json   functions/api/vote.ts      (the only new Function)
                                                 functions/api/omr/[file].ts (existing)
```

What each visitor action costs:

| Visitor action                  | Requests                                        | Function calls | D1                                        |
| ------------------------------- | ----------------------------------------------- | -------------- | ----------------------------------------- |
| Open the gallery or leaderboard | static page + `index.json` / `leaderboard.json` | 0              | 0                                         |
| Browse cards                    | WebP renders from the R2 domain (CDN-cached)    | 0              | 0                                         |
| Open a build in 3D              | `b/<sha>.mpd.gz` (immutable, CDN-cached)        | 0              | 0                                         |
| Arena: get a pair               | none (picked in the browser from `index.json`)  | 0              | 0                                         |
| Arena: vote                     | `POST /api/vote`                                | **1**          | 1 query reading a few rows, 1 row written |
| Leaderboard refresh             | the GitHub Action, hourly                       | 0              | 1 read of all votes per hour              |

Free-tier figures, as I remember them; check them against current docs once the MCP is connected:

| Service             | Approximate limit                                         | Headroom                                                              |
| ------------------- | --------------------------------------------------------- | --------------------------------------------------------------------- |
| Workers / Functions | ~100,000 requests/day                                     | About 100,000 votes/day. Static Pages assets are free and not counted |
| D1                  | ~5 GB; ~5M rows read/day; ~100,000 rows written/day       | Votes are tiny                                                        |
| R2                  | 10 GB; ~1M writes/month; ~10M reads/month; no egress fees | CDN cache hits don't reach R2 (needs the cache rule in §3)            |

## 2. Why these choices

**R2 on a custom domain, not a Function.** A file served through a Function counts against the request limit even when it's a cache hit. A public bucket on a custom domain is plain CDN traffic.

- It costs one CSP origin (§6) and a CORS rule on the bucket.
- Don't use the `r2.dev` development URL in production: it's rate-limited and can't use cache rules.

**The arena pair is picked in the browser.** Minebench picks matchups on the server. Here the browser picks a prompt and two builds by different agents from `index.json`. It favours pairs with few votes, using the pair counts in `leaderboard.json`, so we keep a rough version of Minebench's coverage weighting without an extra request.

- The vote Function checks that the pair is valid (same prompt, different agents, both visible, prompt active), so a forged pair is rejected.
- Trade-off: the arena is only blind for casual visitors. The gallery shows which agent made each build, so a determined visitor could match the renders. Minebench's gallery has the same leak.
- Bradley–Terry over many voters, with per-session and per-day caps (§5), limits what one person can do.
- If this turns out to matter, a signed matchup token from a Function would close the gap, at the cost of one more Function call per vote.

**The arena compares still renders.** Each build is rendered from the same cameras with the same look and backdrop, so the comparison is fair, and a phone never has to hold two 3D scenes.

- The editor's budgets in [RESOURCE-LIMITS.md](RESOURCE-LIMITS.md) were set for one scene, and I haven't checked whether `src/render/adapter.ts` can run as two instances.
- "Look around in 3D" opens one build at a time in the editor.
- Side-by-side 3D can come later if the adapter allows it.

**The leaderboard is rebuilt on a schedule.** The Bradley–Terry refit runs hourly in a scheduled GitHub Action, in Node, using code that is unit-tested in this repo.

- It reads D1 with `wrangler d1 execute --remote --json` and writes `leaderboard.json` with `wrangler r2 object put`.
- It reuses the `CLOUDFLARE_API_TOKEN` secret.
- No cron Worker is needed, and no Function runs for it.
- A Cron Trigger Worker is the alternative if you'd rather keep it inside Cloudflare.

**No upload endpoint.** Builds only enter through `gallery:publish` on the owner's machine.

- That needs a scoped API token: D1 Edit and R2 Edit on this account. Keep it in the shell environment, never committed.
- Changes by hand go through `wrangler d1 execute brick-gallery --remote --command "…"` or the dashboard's D1 console. Examples: hiding a build, retiring a prompt, deleting spam votes.
- After a change by hand, `npm run gallery:publish -- --reindex --remote` rebuilds `index.json`.
- The vote Function's D1 binding can technically do anything, but its code only inserts votes and reads builds. No route accepts builds, files or admin actions.

**The MPD is the main file; the build script is provenance.** The editor already imports LDraw (as the OMR flow does), and an MPD doesn't depend on the build-script compiler version. The script and run report are kept for download and for re-checking.

**D1 is the source of truth for builds; `index.json` is generated from it.** So the published files and the database can't drift apart, and the vote Function can validate pairs with one indexed query.

## 3. Cloudflare setup (once; a session with the Cloudflare MCP can do most of it)

1. **D1**
   - Create `brick-gallery`, and `brick-gallery-preview` for Pages preview deployments.
   - Record both database IDs in `wrangler.toml`.
2. **R2**
   - Create `brick-gallery` (and `brick-gallery-preview`).
   - Connect a custom domain: `gallery.bricks.robertj.in`. This needs the `robertj.in` zone to be on Cloudflare DNS. **To check:** if the domain is only CNAME'd to Pages, the zone must move first, or use another zone you have on Cloudflare.
3. **CORS on the bucket**
   - Allow `GET` and `HEAD` from `https://bricks.robertj.in`, `https://*.brick-editor.pages.dev` and `http://127.0.0.1:*`.
   - `<img>` tags don't need CORS; `fetch()` of JSON and `.mpd.gz` does.
4. **Cache rule** on `gallery.bricks.robertj.in`: "Eligible for cache" for everything, and respect origin `Cache-Control`. By default Cloudflare doesn't cache `.json` or `.gz`. The publish script sets `Cache-Control` on each object:
   - `public, max-age=31536000, immutable` for `b/`, `s/`, `r/` and `p/`;
   - `public, max-age=60, s-maxage=60` for `index.json` and `leaderboard.json`.
5. **API tokens**
   - Your local publishing token: D1 Edit and R2 Edit.
   - The CI token, for migrations and the leaderboard Action: D1 Edit and R2 Edit, added to the existing Pages Edit token, or a second secret.
6. **Pages secret** `VOTE_SALT` (random, 32 bytes), set with `wrangler pages secret put VOTE_SALT --project-name brick-editor`.

`wrangler.toml` (new, repo root). Pages has read this file since 2024; verify the exact keys against current docs:

```toml
name = "brick-editor"
pages_build_output_dir = "dist"
compatibility_date = "2026-10-01"

[[d1_databases]]
binding = "DB"
database_name = "brick-gallery"
database_id = "<from step 1>"
migrations_dir = "migrations"

[env.preview]
[[env.preview.d1_databases]]
binding = "DB"
database_name = "brick-gallery-preview"
database_id = "<from step 1>"
migrations_dir = "migrations"
```

The Function needs no R2 binding: it never reads files.

**Keeping Functions off static paths.** Pages generates `_routes.json` from `functions/`. With Functions only under `functions/api/`, static paths never invoke one. Check that the generated `include` in the deploy output is `["/api/*"]`, or commit a `public/_routes.json` saying so.

## 4. Data

`migrations/0001_gallery.sql`:

```sql
CREATE TABLE prompts (
  id TEXT PRIMARY KEY,                 -- slug, e.g. "japanese-temple-2000"
  brief TEXT NOT NULL,                 -- the --brief text
  target_parts INTEGER,
  arena INTEGER NOT NULL DEFAULT 1,    -- 0 = gallery only
  created_at INTEGER NOT NULL
);
CREATE TABLE agents (
  id TEXT PRIMARY KEY,                 -- "claude/claude-opus-5-5/high"
  runner TEXT NOT NULL, model TEXT NOT NULL, effort TEXT,
  display_name TEXT NOT NULL
);
CREATE TABLE builds (
  id TEXT PRIMARY KEY,                 -- first 12 hex of mpd_sha
  prompt_id TEXT NOT NULL REFERENCES prompts(id),
  agent_id TEXT NOT NULL REFERENCES agents(id),
  mpd_sha TEXT NOT NULL, mpd_bytes INTEGER NOT NULL,
  script_sha TEXT, report_sha TEXT,
  renders TEXT NOT NULL,               -- JSON {"iso": sha, "front": sha, "iso-back": sha, "top": sha}
  parts INTEGER NOT NULL,
  attempts INTEGER, seconds INTEGER, cost_usd REAL, output_tokens INTEGER,
  library_release TEXT NOT NULL, library_hash TEXT NOT NULL,
  warnings INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  hidden INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX builds_prompt ON builds(prompt_id, hidden);
CREATE UNIQUE INDEX builds_once ON builds(prompt_id, agent_id, mpd_sha);
CREATE TABLE votes (
  id INTEGER PRIMARY KEY,
  created_at INTEGER NOT NULL,
  prompt_id TEXT NOT NULL,
  build_lo TEXT NOT NULL, build_hi TEXT NOT NULL,   -- pair stored in sorted order
  choice TEXT NOT NULL CHECK (choice IN ('lo','hi','tie','both_bad')),
  session TEXT NOT NULL,               -- HMAC(VOTE_SALT, cookie id)
  net_day TEXT NOT NULL,               -- HMAC(VOTE_SALT, ip + UTC day): rotates daily, never stored raw
  excluded INTEGER NOT NULL DEFAULT 0  -- set by hand to drop abuse from ranking
);
CREATE UNIQUE INDEX votes_once ON votes(session, build_lo, build_hi);
CREATE INDEX votes_net ON votes(net_day, created_at);
```

Several builds per prompt and agent are allowed (for example, repeated runs). The ranking is per agent; the gallery shows each build.

**`index.json`** (generated, with versioned contents):

```json
{
  "v": 1,
  "generated": "2026-10-03T18:00:00Z",
  "files": "https://gallery.bricks.robertj.in",
  "prompts": [
    {
      "id": "japanese-temple-2000",
      "brief": "a japanese buddhist temple",
      "targetParts": 2000,
      "arena": true
    }
  ],
  "agents": [
    { "id": "claude/claude-opus-5-5/high", "name": "Claude Opus 5.5 (high)" }
  ],
  "builds": [
    {
      "id": "3fa9c01b77de",
      "prompt": "japanese-temple-2000",
      "agent": "claude/claude-opus-5-5/high",
      "mpd": "<sha>",
      "mpdBytes": 41210,
      "renders": { "iso": "<sha>", "front": "<sha>" },
      "parts": 1921,
      "attempts": 2,
      "seconds": 1148,
      "costUsd": 2.84,
      "library": { "release": "…", "hash": "…" }
    }
  ]
}
```

At about 400 bytes per build, 1,000 builds come to roughly 400 KB, or about 60 KB gzipped (the CDN compresses JSON). Once that gets uncomfortable, split it into `index.json` (prompts and agents) plus `prompts/<id>.json`.

**`leaderboard.json`**:

- Per agent: rating (Elo scale, 1500-centred, 400 per factor of 10, as Minebench does), a 95% interval from Fisher information, wins, losses, ties, both-bad, and the number of prompts covered.
- Per pair: vote counts, which the arena uses to pick under-voted pairs.
- `generated` and the vote count.

## 5. The vote Function: `functions/api/vote.ts`

`POST /api/vote` with `{ "a": buildId, "b": buildId, "choice": "a" | "b" | "tie" | "both_bad" }`:

1. **Basic checks.** Only `POST`. Content type must be JSON, under 512 bytes. `Origin` must be our site (`bricks.robertj.in` or our Pages preview host), which stops cross-site posting.
2. **Session.** Read the `bv` cookie, or create one: a random 128-bit id, `HttpOnly; Secure; SameSite=Strict; Max-Age=1 year; Path=/api`. `session = HMAC(VOTE_SALT, id)`.
3. **Pair check.** One query: `SELECT id, prompt_id, agent_id FROM builds JOIN prompts … WHERE id IN (?, ?) AND hidden = 0 AND prompts.arena = 1`. Reject unless there are two rows, with the same prompt and different agents.
4. **Caps.** Reject with 429 if `count(votes WHERE net_day = ? AND created_at > now - 1 day)` exceeds 300 (to be tuned). This could share a statement with step 3 to stay at one round trip.
5. **Write.** `INSERT OR IGNORE`. A repeat vote on the same pair is ignored and still answers 200, so retries are safe.
6. **Reply.** `204` with `Cache-Control: no-store`. Nothing about the agents comes back: the client already has the mapping and shows it after the vote.

Privacy: no raw IP, user agent or location is stored, and `net_day` can't be linked across days. Add a short note on the gallery page and in README ("votes store an anonymous cookie id; nothing else").

Bot protection, if needed later:

- Cloudflare's rate limiting (a WAF rule on `/api/vote`; the free plan includes a basic rule).
- Turnstile, but it needs `challenges.cloudflare.com` in `script-src`/`frame-src`. That deliberately breaks the "no CDNs" rule, so only on `gallery.html`.

Tests: `tests/unit/gallery-vote.test.ts` drives the handler with a fake `env.DB`. A small adapter implements `prepare().bind().first()/all()/run()` over an in-memory SQLite, or over a hand-written fake if a SQLite dev dependency isn't wanted. Run the migration SQL against it so the schema is tested too.

## 6. Front end

**A separate page: `gallery.html`.** It's a second Vite entry (`build.rollupOptions.input`), so the gallery, arena and leaderboard load without the 3D editor bundle, and render-card grids stay light on phones.

Routes are fragment-based, so static hosting needs no rewrites:

- `gallery.html#/` lists prompts, with filters by agent.
- `#/p/<prompt>` shows that prompt's builds as cards (iso render, agent, parts, cost, time).
- `#/b/<id>` is one build: all its renders, stats, and downloads of the MPD and script. It also has "Look around in 3D", which opens `index.html?gallery=<id>`.
- `#/arena` shows two builds (A and B) as swipeable render sets with four buttons: A, B, Tie, Both bad. After a vote it reveals the agents and offers "Next".
- `#/leaderboard` shows a table with rating, interval and coverage. On a phone it's a stacked list, not a wide table.

It uses the same `tokens.css` and design rules ([DESIGN.md](../DESIGN.md)): 44 px targets, plain labels. Check it at the phone sizes in AGENTS.md.

**Editor entry: `?gallery=<id>`.**

- Add `openGalleryBuild(id)` next to `openOfficialSet` in `src/ui/App.tsx`, as the same pattern:
  1. Fetch `index.json` and find the build.
  2. Fetch `b/<sha>.mpd.gz` and inflate it with fflate.
  3. Check its SHA-256 and that it's under `resourceLimits(...).importBytes`.
  4. Check the library lock against `project.library` or `retiredLibraryLocks`, as `share.ts` does.
  5. Run `api.project.import({ format: "ldraw", … })`.
- Open it as a **preview**, like share links (`SharePanel.tsx`): nothing replaces the user's autosaved project until they pick "Open a copy". The status line credits the agent and links back to the gallery page.
- A small new module, `src/catalog/gallery.ts` (types, `GALLERY_ORIGIN`, fetch and verify), is shared by both pages. Unit-test the verification.
- In the editor, the existing Project mode's templates area gets one "Agent gallery" link. Nothing else changes, so the editor's menus stay uncluttered.

**CSP** (`index.html` and the new `gallery.html`):

```
connect-src 'self' https://gallery.bricks.robertj.in ws:;
img-src 'self' blob: data: https://gallery.bricks.robertj.in;
```

That's the only new origin. Put it in one constant used by `vite.config.ts` if the CSP is templated, otherwise edit both files.

**Offline.**

- `scripts/offline-plugin.ts` precaches `gallery.html` and its chunk, so the shell opens. It doesn't cache the gallery's data.
- Offline, the page says "The gallery needs a connection", and the editor's `?gallery=` entry gives the same message.
- Builds a user has opened are optionally kept in a small Cache Storage bucket, as `omrCacheName` does for OMR models.

**Browser tests.**

- Mock `https://gallery.bricks.robertj.in/**` and `/api/vote` with `page.route`, as `/api/omr/` is mocked.
- `tests/browser/gallery.spec.ts`: list, filter, open a build in the editor, arena vote (sending the right body and showing the reveal), the leaderboard at phone sizes, and the offline message.
- No test may reach the real bucket.

## 7. Publishing: `scripts/gallery-publish.ts` (`npm run gallery:publish`)

```
npm run gallery:publish -- ~/brick-builds/oneshot-temple-2000 [--prompt-id japanese-temple-2000]
                           [--only high,max] [--remote] [--hide] [--reindex]
```

- **Input.** A `npm run oneshot` output folder: per effort, `build.json` and `result.json`. The folder's `prompt.md` and `summary.md` give the brief and target. A single build script with `--agent` and `--brief` flags also works, for builds made by hand or by other harnesses.
- **Default is a dry run.** Without `--remote` it writes everything to `.local/gallery-out/` and prints the SQL. `--remote` uploads.

For each accepted effort:

1. **Compile and check** with the same code as `npm run cli -- build`. Refuse builds with errors, and record warnings.
2. **Export the MPD.** It's deterministic, so the same script gives the same SHA-256 and re-publishing is idempotent. Gzip it at level 9.
3. **Render the views** `iso`, `front`, `iso-back` and `top` with **fixed** settings: 1024 × 768, `standard` look, `blank` backdrop.
   - Don't reuse the oneshot PNGs, which may use other looks, so every build in the arena looks alike.
   - Encode WebP in Chromium, as `scripts/build-templates.ts` does with `convertToBlob({ type: "image/webp" })`.
   - Store the settings in the report.
4. **Hash and name** every file by its SHA-256.
5. **Upload.** With `--remote`, `wrangler r2 object put brick-gallery/<key> --file … --content-type … --cache-control …`. Check first with a `HEAD` request to the public URL and skip objects that already exist.
6. **Insert into D1.** Write one SQL file of `INSERT OR IGNORE` for prompts, agents and builds, and run `wrangler d1 execute brick-gallery --remote --file …`. Builds are inserted only after their files are uploaded, so the database never points at a missing file.
7. **Reindex.** `SELECT` the visible builds as JSON, write `index.json`, and upload it with `max-age=60`.

`--hide <buildId>` sets `hidden = 1` and reindexes. `--reindex` only rebuilds `index.json`.

Unit tests cover the agent and prompt id derivation, index generation from rows, and the refusal of builds with errors. The R2 and D1 steps are behind a small interface so tests use fakes.

## 8. Leaderboard job

- **Code.** `scripts/gallery-rank.ts` contains a pure `rank(votes) → leaderboard`, unit-tested on synthetic votes where the true strengths are known. It uses Bradley–Terry by minorization–maximization with a 0.5-win prior on each pair, ties counted as half a win each, and `both_bad` and `excluded` votes left out. It converts to the Elo scale with intervals from the inverse Fisher information. A thin CLI reads the votes and uploads the result.
- **Workflow.** `.github/workflows/gallery-rank.yml` runs on `schedule: "17 * * * *"` and `workflow_dispatch`. Its steps:
  1. `npm ci`.
  2. `wrangler d1 execute brick-gallery --remote --json --command "SELECT … FROM votes WHERE excluded = 0"`.
  3. `tsx scripts/gallery-rank.ts`.
  4. `wrangler r2 object put …/leaderboard.json`.
  - It skips the upload when the vote count hasn't changed.
  - Reading every vote each hour is cheap until about 100,000 votes. Past that, keep running per-pair totals in a `pair_counts` table, either updated by the vote Function or summarised by the job.

## 9. Changes to repository rules and docs

AGENTS.md says "No backend. No accounts, telemetry or uploads. The OMR proxy is the only function." It would become:

> **Small backend.** No accounts, telemetry or user uploads. Functions: the OMR proxy and the gallery vote (`functions/api/vote.ts`), which stores an anonymous cookie id and the vote, nothing else. Gallery builds are published only by the owner with `npm run gallery:publish` and a Cloudflare API token; there is no upload endpoint. Gallery files are static on `gallery.bricks.robertj.in` (the one CSP exception).

Also update:

- AGENTS.md's layout table (`functions/`, `migrations/`, `gallery.html`, the new scripts).
- README (a privacy note and the docs index).
- PRODUCT.md.
- `docs/ARCHITECTURE.md` (a "Gallery" section).
- `docs/STATUS.md`, TODO.md and VERIFICATION.md as each phase lands.
- `scripts/check-deploy-limits.ts`, if the second HTML entry affects it.

CI (`.github/workflows/cloudflare.yml`):

- Run `wrangler d1 migrations apply brick-gallery --remote` in `publish` before `pages deploy`. This needs D1 Edit on the token.
- The unit tests for the Function and ranking run in `checks` as usual.

## 10. Phases

| Phase                            | Deliverable                                                                                                                                                                                                                       | Done when                                                                                                                                                                         |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0. Cloudflare setup              | §3, with the MCP: D1 and R2 for production and preview, custom domain, CORS, cache rule, tokens, `VOTE_SALT`; `wrangler.toml`; `migrations/0001_gallery.sql` applied                                                              | `curl -I https://gallery.bricks.robertj.in/index.json` shows the cache headers; `wrangler d1 execute … "SELECT 1"` works                                                          |
| 1. Publish and read-only gallery | `scripts/gallery-publish.ts`, `src/catalog/gallery.ts`, `gallery.html` (list, prompt, build pages), `?gallery=` in the editor, CSP, offline message, docs; seed with the temple runs in `docs/samples/japanese-temple-one-shot-*` | The temple builds browse and open in 3D on a 1080 × 1800 phone; a second visit to a build fetches nothing but `index.json` (check the network panel); unit and browser tests pass |
| 2. Arena                         | `functions/api/vote.ts`, the arena view, pair picking, privacy note, rule changes in AGENTS.md                                                                                                                                    | A vote writes one row; repeats and forged pairs are rejected; at least 2 prompts have 3 or more agents each, so pairs are varied                                                  |
| 3. Leaderboard                   | `scripts/gallery-rank.ts`, the hourly workflow, `#/leaderboard`                                                                                                                                                                   | Synthetic votes recover the known order; the page shows intervals and coverage                                                                                                    |
| 4. Later                         | Turnstile or rate rules if abused; side-by-side 3D if the adapter allows two scenes; per-prompt index files; RSS of new builds; build pages with reasoning and token charts from `result.json`                                    | When needed                                                                                                                                                                       |

## 11. Open questions

- Is `robertj.in` on Cloudflare DNS (needed for the R2 custom domain)?
- What should the arena show by default: only builds that passed checks with no warnings, or any accepted build? (The plan: any accepted build, with the warning count on the card.)
- Which builds go in first, beyond the temple runs: the other one-shot samples, and new prompts run across several models (Claude and Codex runners at a few efforts)? The arena needs at least 3 agents per prompt to be interesting.
- What should gallery cards show: only cost and time, or the token counts too?

## 12. Phase 1 as built

Built on 3 October 2026. Meanwhile, a redesign on `main` made Gallery the app's default mode, with bundled samples ([GALLERY.md](GALLERY.md)), so §6's separate `gallery.html` is dropped. Gallery should read the published index itself. That page work is done separately; this phase built the backend and the contract the page uses:

**Front end** (the redesign's in-app Gallery)

- `galleryPrompts(index)` (`src/catalog/gallery.ts`) maps published builds to Gallery entries; the five bundled GPT-6.1-Sol samples are gone, so Gallery needs a connection and says so when the index can't load.
- Explore and the tools fetch a build's MPD with `fetchGalleryModel`, checked by `verifyGalleryBuild` (size, SHA-256, library release), and cache it for offline use.
- The detail page has a live, spinnable view in the Realistic look (`src/ui/GalleryPreview.tsx`): a second `SceneAdapter` without the grid, freed when the page closes. The angle tabs swing its camera to the renders' framing. It loads on open on desktops and on **Spin in 3D** on touch or narrow screens. A `.glb` export was considered and rejected: the Realistic look's lighting, shader tweak and post-processing don't survive export, and the app already ships the renderer.
- `galleryIndexEnabled(location)` keeps local servers and tests off the real bucket (https, or `?galleryIndex=1`). The CSP allows `https://gallery.bricks.robertj.in` in `img-src` and `connect-src`.

**Published files**

- Renders match the bundled samples' pictures: Realistic look, white background, 1,280 × 960 WebP, and only Gallery's three angles (corner, front, back). There is no top view or card image.
- The index carries each build's script `title`, and each agent's `model` and `effort`.

**Config**

- The D1 and R2 settings for publishing live in `wrangler.gallery.toml`, not `wrangler.toml`. Pages reads `wrangler.toml` on every deploy, and the database ID is a placeholder until phase 0 creates it.
- Phase 2 moves the D1 binding into `wrangler.toml` once the vote Function needs it.
- `--remote` needs `CLOUDFLARE_API_TOKEN` in the shell (D1 Edit, R2 Edit).

**Dry run.** Without `--remote`, the script applies `migrations/` to a local D1 (`--local --persist-to .local/gallery-d1`) and writes files to `.local/gallery-out/` in the bucket's layout. So a dry run exercises the same SQL as a real publish.

**Data**

- `builds.source` records the batch a build came from (the one-shot folder name), so repeated runs of the same agent can be told apart.
- `builds.title` holds the script's title.
- Prompt ids come from the brief and target: "a japanese buddhist temple", 2,000 → `japanese-buddhist-temple-2000`. `--prompt-id` overrides that.
- Runs made before the runner was recorded in `result.json` are taken as Codex runs.

**Refusals.** The first temple run's five builds now fail the colour check added after they were made (for example, 3633 in dark brown), so they are refused. The other 24 accepted temple builds, from 5 runs and 2 models, compile with no errors; each has one or two warnings (floating parts).

What's left for phase 1's "done when": a check on a physical 1,080 × 1,800 phone (the live preview's memory and frame time beside the workspace scene).
