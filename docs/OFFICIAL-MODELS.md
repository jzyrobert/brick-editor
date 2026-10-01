# Official set models (LDraw OMR)

Project → **Official LEGO sets** searches the 1,470 sets of the [LDraw Official Model Repository](https://library.ldraw.org/omr) (OMR) by set number, name, theme or year, and opens a set's main model as a new project. The OMR models are fan-made LDraw models of real LEGO sets, reviewed by LDraw.org. This is a model source only: there is no buildable-coverage or collection feature.

## Where the files come from

- **Model files are not self-hosted.** They load live from `https://library.ldraw.org/library/omr/<set>.mpd` through a same-origin proxy at `/api/omr/<set>.mpd`.
- **The set index is committed.** `src/catalog/omr-index.json` (94 KB, one set per line: number, name, theme, year, model count, OMR page id) ships as a lazy chunk, so it is included in offline snapshots. `npm run omr:index` rebuilds it from the public listing at `https://library.ldraw.org/omr/sets`. That fetches about 60 listing pages, one every 1.5 s, with an identifying User-Agent. It runs by hand when the OMR grows, never in CI.
- **Set images are not shown.** Rebrickable's CDN images are not hotlinked (CSP, offline use and rights), and no thumbnails are rendered.

### Why a proxy (CORS findings, 30 September 2026)

- `library.ldraw.org` sends **no `Access-Control-Allow-Origin`** on model files (`/library/omr/*.mpd`, `application/octet-stream`), on the listing or on set pages. `OPTIONS` returns 405.
- Headless Chromium on the production origin gets `Failed to fetch` ("blocked by CORS policy") for both the files and the listing. A `no-cors` request only gets an opaque response.
- There is **no public API or JSON/CSV index**: `/api/...` returns 404. The listing is a Livewire/Filament table of 25 rows per page. Each set page links its model files and names their authors.
- The earlier `403` for `/library/omr/` was **not** User-Agent filtering. nginx forbids listing that directory for every client and method. `GET` and `HEAD` for a file return 200 with a browser UA, curl's UA or an `Origin` header.
- `robots.txt` allows everything (`Disallow:` empty). The site's [legal page](https://www.ldraw.org/docs-main/licenses/legal-info.html) puts content "not specifically made for LDraw.org" under its own licences. OMR files state `0 !LICENSE Redistributable under CCAL version 2.0`, i.e. [CC BY 2.0](https://creativecommons.org/licenses/by/2.0/).

A browser app on our origin therefore cannot read OMR files directly. Self-hosting a pinned snapshot would mean copying roughly 1,500 files and keeping them in sync. The proxy forwards unmodified files on demand instead, and caches them at the edge.

### The proxy

`functions/api/omr/[file].ts` is a Cloudflare Pages Function. `wrangler pages deploy dist`, run from the repository root as in `.github/workflows/cloudflare.yml`, bundles `functions/` automatically and routes only `/api/omr/*` to it; all other paths stay static assets. The function:

- **Accepts only GET/HEAD** of a plain file name `[A-Za-z0-9][A-Za-z0-9._-]*.(mpd|ldr)` with no path and no query (`omrFileAllowed`). Everything else is 404 or 405, and no other upstream is reachable.
- **Forwards unmodified** to `https://library.ldraw.org/library/omr/<file>` with the User-Agent `brick-editor OMR proxy (+https://bricks.robertj.in)`. It does not follow redirects, caps files at 16 MiB and refuses anything that is not LDraw text, such as an HTML error page.
- **Caches for 7 days** in the Cloudflare edge cache (`caches.default`), so each colo asks ldraw.org at most about once a week per file. Browsers may reuse a response for a day. Responses are `text/plain` with `nosniff` and a `default-src 'none'; sandbox` CSP.
- **Keeps the page CSP unchanged.** The page loads models from `'self'`, so `connect-src 'self' ws:` is enough and ldraw.org is never contacted from the browser.

In development, `vite` and `vite preview` proxy the same path to ldraw.org (`vite.config.ts`). `npx wrangler@4.142.0 pages dev dist` runs the real Function locally; it was checked on 30 September 2026:

- A model came back byte-identical, and the second request was served from the cache.
- Traversal, other extensions, query strings and `POST` were refused.
- An unknown set answered 404.

Each open of a set not yet in the edge cache costs one Function invocation, within the Workers free-plan daily request allowance. There is no per-client rate limit. The allowlist and the edge cache bound the upstream traffic.

## In the app

- **Opening a set:** the app fetches `api/omr/<set>.mpd` and imports it like an opened `.mpd` file. The project is titled `<number> <name>`, and the usual save/discard prompt protects unsaved work. `src/catalog/omr-loader.ts` keeps each fetched file in Cache Storage (`brick-editor-omr-v1`), so a set opened once opens again without a connection. With the offline snapshot installed, the whole app works offline, and so do those sets and the index.
- **Main model only:** only the main model (`<set>.mpd`) is offered. 200 sets also have alternate models (for example `10001-1_B-Model-from-Instruction.mpd`); those file names appear only on set pages, which are not indexed. A set whose main file is missing reports "LDraw.org has no main model file".
- **Attribution:** the author and licence are read from the file's own header (`omrAttribution`). The header lines stay in the project, in native saves and in LDraw export, byte for byte. Opening a set reports "Opened … — <author> · CC BY 2.0 · LDraw OMR". The Official LEGO sets search in Project then shows "This model: <set> by <author>, CC BY 2.0", with links to the set's OMR page and the licence. The section itself credits the OMR and states the licence.
- **Steps:** `0 STEP`/`0 ROTSTEP` lines are kept as source records. The root model's steps become the imported instruction plan, as for any LDraw import.

## Coverage against our complete LDraw pack

`npm run omr:coverage -- --sample 50` fetched an evenly spaced sample of 50 sets (one request every 2 s) and imported each one offline against the committed complete official library:

| Measure                                          | Result                                                                               |
| ------------------------------------------------ | ------------------------------------------------------------------------------------ |
| Main model file present                          | 50 / 50                                                                              |
| Every part reference resolved                    | 50 / 50                                                                              |
| Part reference lines / unresolved                | 16,915 / 0                                                                           |
| Sets embedding their own (unofficial) part files | 18 (resolve as project-local parts)                                                  |
| Sets with STEP lines                             | 35                                                                                   |
| Author read from header                          | 46; 3 of the other 4 were checked: they lack `!LDRAW_ORG Model` and are now accepted |
| Largest file                                     | 0.87 MB (sample mean 0.1 MB)                                                         |

OMR rules require official parts, or unofficial ones embedded in the MPD, so full resolution is expected. A model that uses a part newer than our pinned release would draw that part as the usual pink placeholder box and list it in Health. `npm run library:update` then brings the part in.

## Tests

- `tests/unit/omr.test.ts`:
  - index shape;
  - listing parser;
  - search ranking;
  - attribution (with and without `!LDRAW_ORG`, non-OMR files, survival through import);
  - the Pages Function (allowlist, methods, unmodified forwarding, edge cache, non-LDraw and 404 upstream answers).
- `tests/browser/official-sets.spec.ts` mocks the network: `api/omr/*` is fulfilled, `library.ldraw.org` is aborted and counted.
  - search, open and credit links;
  - exported header and STEP lines;
  - no direct ldraw.org requests;
  - reopening from the device cache when the proxy is unreachable;
  - a missing main model;
  - a 360 px phone layout without horizontal overflow.
