# Working on Brick Editor (for coding agents)

Read this before changing code. [README.md](README.md) says what the app does; [TODO.md](TODO.md) lists open work; [docs/STATUS.md](docs/STATUS.md) records what is done and how it was verified.

## Stack and layout

React 19 + TypeScript + Vite 6 + three.js r174, Rapier (lazy, WASM) for dynamic physics, three-gpu-pathtracer for Photo. Static site with one Cloudflare Pages Function. Node ≥ 22.14.

| Path                                               | What lives there                                                                                                                                                                                                                                                                                                             |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/core/`                                        | Document model, undoable command service (`commands.ts`), occurrence expansion and limits, validation (`validators.js` is generated), resource profiles (`resource-profile.ts`), health, connectivity                                                                                                                        |
| `src/render/adapter.ts`                            | The scene adapter (≈ 6,000 lines): loading, progressive drawing, loading skeleton, looks, captures, picking, budgets. Diagnostic URL switches: `?skeleton=0`, `?hiddenCull=0`, `?geometryCache=0`, `?compileWorkers=0`, `?progressive=0`                                                                                     |
| `src/render/` (rest)                               | `render-budget.ts` (per-profile triangle/variant budgets), `batching.ts` (instanced draws), `hidden-geometry.ts` + `hidden-view.ts` + `occlusion.ts` (hidden-geometry culling), `load-skeleton.ts`, `look*.ts`, `studio-lighting.ts`, `photo-*.ts`, `anatomy*.ts`, `texmap*.ts`, `vendor/LDrawLoader.js` (vendored, patched) |
| `src/ui/`                                          | React UI; `App.tsx` is the shell (modes Build, Instructions, Photo, Play, Project). Styles: `tokens.css`, `hud.css`; design rules in [DESIGN.md](DESIGN.md)                                                                                                                                                                  |
| `src/play/`                                        | Play session (`session.ts`), collision, avatar, vehicles and seats, doors (`auto-doors.ts`, `door-parts.json`), Rapier dynamics, trains (`track.ts`, `trains.ts`, `train-cab.ts`)                                                                                                                                            |
| `src/mechanisms/`                                  | Authored kinematic rigs, posed export                                                                                                                                                                                                                                                                                        |
| `src/edit/`                                        | Placement, snapping, stacking, transform gestures, selection, fills, floors, measure, track snapping                                                                                                                                                                                                                         |
| `src/catalog/`                                     | Parts catalogue and complete-library loaders, connectors, colours, mappings, OMR index/loader, sample templates (`builds/` generators, `script-templates.ts`, `template-names.ts`)                                                                                                                                           |
| `src/build-script/`                                | Build-script language (`spec.ts` is the schema source), compiler, packer, part search                                                                                                                                                                                                                                        |
| `src/instructions/`, `src/inventory/`              | Step guide and publishing; parts list, BrickLink/Rebrickable export, inventory decisions                                                                                                                                                                                                                                     |
| `src/persistence/`                                 | Autosave, IndexedDB projects, native `.brickproj`, checkpoints, share links, preferences                                                                                                                                                                                                                                     |
| `src/automation/`                                  | `window.brickEditor` API (`api.ts`, only with `?automation=1`), queries, jobs, `capabilities.json`                                                                                                                                                                                                                           |
| `src/workers/`                                     | Import, part compile, project save/restore and fill workers                                                                                                                                                                                                                                                                  |
| `functions/api/omr/[file].ts`                      | Allowlisted, edge-cached proxy for LDraw OMR set files ([docs/OFFICIAL-MODELS.md](docs/OFFICIAL-MODELS.md))                                                                                                                                                                                                                  |
| `src/catalog/gallery*.ts`, `src/ui/Gallery*.tsx`   | Gallery: published-index format, D1-row → `index.json`, download checks and loader (`gallery-index.ts`); page entries (`gallery.ts`); the page and its live 3D preview ([docs/GALLERY.md](docs/GALLERY.md), [docs/GALLERY-PLAN.md](docs/GALLERY-PLAN.md))                                                                    |
| `migrations/`, `wrangler.gallery.toml`             | The gallery's D1 schema and the D1/R2 config `npm run gallery:publish` uses (not `wrangler.toml`, which Pages reads on deploy)                                                                                                                                                                                               |
| `scripts/`                                         | CLI (`brick-cli.ts`), schema/template/library builders, `test-browser.ts`, `offline-plugin.ts` (service worker precache), `gallery-publish.ts` (owner-only gallery publishing)                                                                                                                                               |
| `schemas/`                                         | Generated JSON schemas for the API and build scripts                                                                                                                                                                                                                                                                         |
| `public/libraries`, `public/thumbnails`            | Pinned, hash-locked LDraw packs and thumbnail sheets (generated, committed, large: never edit by hand)                                                                                                                                                                                                                       |
| `fixtures/`                                        | LDraw test models, build scripts (`build-scripts/`), generated template sources (`ldraw/templates/`), [provenance](fixtures/PROVENANCE.md)                                                                                                                                                                                   |
| `tests/unit`, `tests/integration`, `tests/browser` | Vitest unit and CLI tests; Playwright specs                                                                                                                                                                                                                                                                                  |

Docs index: see the table at the end of [README.md](README.md). The feature docs (RENDERING, PLAY-\*, INSTRUCTIONS, CONNECTORS, RESOURCE-LIMITS, PERFORMANCE-MINEBENCH) explain design choices and carry measurements; read the relevant one before changing that area.

## Commands

```sh
export PATH=/tmp/brick-node/node-v22.14.0-linux-arm64/bin:$PATH  # on the shared dev VM; system Node may be wrong
npm ci                       # if node_modules is missing
npm test                     # Vitest unit + integration (the CLI tests launch Chromium)
npx tsc -b                   # type-check
npm run format:check         # Prettier: CI fails on formatting. `npx prettier --write <files>` before committing
npm run schemas              # regenerate schemas/ and src/core/validators.js; never hand-merge generated files
npm run templates            # regenerate sample sources + previews (`-- --check` without a browser, `-- --only=<name>`)
npm run library:validate     # pinned packs, locks, thumbnails
npm run build                # schemas + tsc + vite build into dist/
npm run test:browser         # build, then Playwright: main + heavy, then perf alone
npm run test:browser:quick   # build, then main only
npm run cli -- <command>     # headless CLI (docs/CLI.md)
npm run gallery:publish -- <oneshot-dir>  # agent gallery: dry run into .local/; --remote publishes (docs/GALLERY-PLAN.md)
```

Generated files (schemas, validators, template `.mpd` sources, library packs, thumbnails) are rebuilt by their script. On a merge or rebase conflict in one, take either side and rerun the generator.

## Browser tests

Playwright runs Chromium on SwiftShader (software WebGL), which is CPU-bound and slow; the dev VM is shared with other agents and often heavily loaded.

- **Build first** (`npm run build`), then run **only the relevant specs**. The full suite is for CI.
- Use a **private config** under `.local/` (gitignored) with its own port, so you never test another agent's server or build:

  ```ts
  // .local/mine.config.ts
  import { defineConfig } from "@playwright/test";
  import base from "../playwright.config";
  export default defineConfig({
    ...base,
    testDir: "../tests/browser",
    use: { ...base.use, baseURL: "http://127.0.0.1:4391" },
    webServer: {
      command: "npx vite preview --port 4391 --strictPort --host 127.0.0.1",
      url: "http://127.0.0.1:4391",
      reuseExistingServer: false,
      cwd: "..",
    },
    outputDir: "../test-results/mine",
    reporter: [["line"]],
  });
  ```

  Pick a port and check it is free first: `ss -ltn | grep :4391`. Run with `npx playwright test -c .local/mine.config.ts --project=main tests/browser/x.spec.ts`. `BROWSER_WORKERS=1` lowers parallelism when the machine is busy.

- **Tags.** End a test title with ` @heavy` if it path-traces (Photo) and ` @perf` if it asserts wall-clock time; untagged tests run in `main`. CI runs main in 8 shards, heavy in 2, perf in 1 (≈ 9 min total).
- **Flakes.** Timeouts under machine load are common. Rerun the failing spec alone before concluding it is a regression; don't loosen a budget without measuring.
- Check UI changes at phone sizes: 1080 × 1800 (portrait), 360 × 600, 411 × 685, 390 × 844 and landscape (e.g. 686 × 411), plus desktop 1440 × 1000. Helpers live in `tests/browser/helpers/`.

## Shell hygiene

- `FORCE_COLOR=0` for parseable output from npm, Vitest and Playwright.
- Never `pgrep -f` / `pkill -f` a pattern that also matches your own shell command line; kill by PID. Start servers in the background, record `$!`, wait on and kill that PID when done. Leave no servers running.
- Don't use bare `git stash` (the stash is shared between worktrees); use a WIP commit.

## Git

- Commit as the repository owner, with the attribution trailers the session gives you, e.g.

  ```sh
  git -c user.name="Robert Jin" -c user.email=20613660+jzyrobert@users.noreply.github.com commit
  ```

  (set `GIT_COMMITTER_NAME`/`GIT_COMMITTER_EMAIL` the same). Messages: an imperative subject saying what changed for the user ("Drive trains from the cab: …"), a body explaining why and how, with measurements where relevant, then the `Co-Authored-By:` / `Claude-Session:` trailers.

- Never commit `.local/`, `.impeccable/mocks/` or `.impeccable/review/`, secrets or tokens, or user-provided private models (e.g. the user's Santorini MPD files; the build script `fixtures/build-scripts/santorini.json` is ours and fine).
- Work on a branch or worktree; rebase onto `main` before merging. Push only when asked. Only `main` is published, and only after every CI job passes; don't deploy by hand. Pull requests into `main` run the same CI (validation only), so check a PR's checks before merging.
- Keep TODO.md, docs/STATUS.md, docs/VERIFICATION.md and `src/automation/capabilities.json` honest when you close or find work.

## Product constraints

- **Phone first.** The owner tests on a ~1080 × 1800 phone in portrait and landscape. No overlapping controls, 44 px touch targets, uncluttered menus with progressive disclosure; canvas space comes first. The audience includes hobbyists and children: plain labels.
- **Strict CSP** (`index.html`): same-origin only, no `unsafe-eval` (Ajv validators are precompiled), `wasm-unsafe-eval` only for Rapier. No CDNs, remote fonts or hotlinked images. To read the published agent gallery, a page must add its bucket, `https://gallery.bricks.robertj.in` (`GALLERY_ORIGIN`), to `img-src` and `connect-src`; that is the only other origin allowed.
- **Offline.** The opt-in offline install precaches the app, lazy chunks, the curated pack and template dependencies (`scripts/offline-plugin.ts`); complete-library chunks are cached as they load. New runtime assets must be same-origin and work offline (or degrade with a message).
- **Budgets.** Desktop 200,000 / phone 150,000 parts; scene-triangle and variant budgets per profile ([RESOURCE-LIMITS](docs/RESOURCE-LIMITS.md)). New views must stay within them; measure large models with `npm run test:stress` and the brick city helper.
- **No backend.** No accounts, telemetry or uploads. The OMR proxy is the only function; keep it allowlisted and cached. Agent-gallery files are static objects that only the owner publishes, with `npm run gallery:publish` and a Cloudflare API token; there is no upload endpoint. Pages should read the published index only where `galleryIndexEnabled()` allows it (https, or `?galleryIndex=1`); browser tests must mock the origin and never reach the real bucket.
- **Licensing.** LDraw files keep their headers and are never modified in packs. OMR models are CC BY 2.0: attribute them. Rebrickable data is used under its terms (attribution, pinned snapshot). Don't copy code or data from proprietary tools (Studio, LDCad shadow data without review, other sites' viewers).
- **Be polite to ldraw.org.** No crawling in CI or tests (mock `/api/omr/` in browser tests); maintainer scripts throttle requests and send an identifying User-Agent; prefer the local `complete.zip`.

## Automation API and build scripts

- `/?automation=1` exposes `window.brickEditor`: commands with `expectedRevision`, `ready({ strict: true })`, queries, `render.image`, `render.budget()`, Play control. See [docs/API.md](docs/API.md) and `schemas/`.
- Build big models as build scripts ([docs/AGENT-BUILDING.md](docs/AGENT-BUILDING.md), design rules in [docs/DESIGN-LANGUAGE.md](docs/DESIGN-LANGUAGE.md), system prompt in [prompts/build-agent.md](prompts/build-agent.md)): `npm run cli -- build --script x.json --output x.mpd --render x.png`, and `npm run cli -- parts search "…"` to find parts.
- The large samples (Market town, Cathedral, Harbour) are build scripts in `fixtures/build-scripts/`; the small ones are TypeScript generators in `src/catalog/builds/`. Both compile to `fixtures/ldraw/templates/` via `npm run templates`, and a unit test keeps them identical.
