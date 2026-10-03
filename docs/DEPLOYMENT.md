# Static hosting

Production address: **https://bricks.robertj.in/**. The app has moved from GitHub Pages to the Cloudflare Pages project **brick-editor**, in the same account as modern-mahjong. Its provider URL is **https://brick-editor.pages.dev/**.

`.github/workflows/cloudflare.yml` runs formatting, unit/integration/CLI tests, pinned-library validation and the full Chromium browser suite on every push to `main`, and on manual dispatch (`gh workflow run cloudflare.yml --ref <branch>`) for any branch. Its jobs: `build` (bundle once, check Pages limits, upload `dist/` as `cloudflare-static-site`), `checks` (format, unit tests, library validation), `browser` (eleven parallel shards testing that same `dist/`; see [Verification](VERIFICATION.md#running-the-browser-suite)), `report` (merged Playwright report artifact), and `verified`, a single gate that passes only when build, checks and every browser shard passed. `publish` needs `verified` and runs only for `refs/heads/main`, so branch runs validate without deploying; publication is serialised on the `cloudflare-pages` concurrency group, while superseded branch runs are cancelled. A successful main run advances `cloudflare-production` without force. The publication job uses pinned Wrangler 4.142.0 to upload that artifact to Cloudflare Pages, following the same approach as modern-mahjong.

**Automatic publication is configured.** The repository Actions secret `CLOUDFLARE_API_TOKEN` (Cloudflare Pages Edit, this account only) and the variable `CLOUDFLARE_ACCOUNT_ID` are set. Each push to `main` runs format, unit, library and browser checks; only if all pass does the publish job advance `cloudflare-production` to that commit and upload the tested `dist` with Wrangler. A missing or revoked token makes the job warn and skip upload, so a green run without the deploy step means production did not change. Never commit the token; rotate it in the Cloudflare dashboard and update the secret in GitHub settings.

The authenticated Cloudflare connection deployed the current site directly. It can manage Pages and DNS but cannot create the required API token, and GitHub cannot reveal another repository's encrypted secret. Native Git build triggers failed to start deployments even after reconnection, so automatic native builds and previews are disabled. The source connection and tested branch remain available for manual builds using the settings below. This is a static deployment with one small Pages Function: `functions/api/omr/[file].ts`, an allowlisted, edge-cached proxy for LDraw OMR model files ([official models](OFFICIAL-MODELS.md)). `wrangler pages deploy dist`, run from the repository root, bundles `functions/` automatically and routes only `/api/omr/*` to it; every other path stays a static asset. Published [agent gallery](GALLERY-PLAN.md) builds are not part of this deployment: they live in a separate R2 bucket that `npm run gallery:publish` writes to.

Cloudflare project settings:

| Setting           | Value                   |
| ----------------- | ----------------------- |
| Project           | brick-editor            |
| Repository        | jzyrobert/brick-editor  |
| Production branch | cloudflare-production   |
| Build command     | npm ci && npm run build |
| Output            | dist                    |
| Node              | 22.14.0                 |
| Base path         | /                       |
| Custom domain     | bricks.robertj.in       |

The custom domain must be attached to the Pages project before its DNS is changed. The Cloudflare `robertj.in` record is CNAME `bricks` → `brick-editor.pages.dev`, DNS only, TTL Auto. Pages itself serves through Cloudflare and handles TLS. Domain verification is active and HTTPS returned HTTP 200 with a valid certificate on 2026-09-27. Secure live Chromium checks passed at desktop, 360px and 1080px widths, including keyboard/touch steering, multiple mechanisms and capture behavior. Automatic publication has run on every green `main` push since 2026-09-28 (first deployment for 8289bb3).

GitHub's former custom-domain certificate never became valid during the migration checks. The old GitHub Pages deployment workflow is replaced by the validation/publication workflow above. Do not repoint production DNS to GitHub while it still has the invalid certificate.

Browser projects and offline installation are stored per origin. Keeping `https://bricks.robertj.in` preserves that origin; moving between a provider URL and the custom domain requires native project export/import. DNS changes do not transfer browser storage between different origins.

References: [Cloudflare Git integration](https://developers.cloudflare.com/pages/configuration/git-integration/), [build configuration](https://developers.cloudflare.com/pages/configuration/build-configuration/), and [custom domains](https://developers.cloudflare.com/pages/configuration/custom-domains/).
