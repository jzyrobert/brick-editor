# Static hosting

Production address: **https://bricks.robertj.in/**. The app has moved from GitHub Pages to the Cloudflare Pages project **brick-editor**, in the same account as modern-mahjong. Its provider URL is **https://brick-editor.pages.dev/**.

The Cloudflare connection can manage Pages and DNS but cannot create account API tokens. This repository therefore uses the existing Cloudflare GitHub integration instead of duplicating modern-mahjong's Wrangler deployment secret. The result is still a static Cloudflare Pages deployment, with no application server.

`.github/workflows/cloudflare.yml` runs formatting, unit/integration/CLI tests, pinned-library validation and the full Chromium browser suite on `main`. Only a successful run advances `cloudflare-production` to the tested commit. Cloudflare watches that branch, with preview deployments disabled, and builds `dist/` using `npm ci && npm run build`, Node 22.14.0 and `BASE_PATH=/`. The branch advances without force, preventing an older rerun from rolling production backward.

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

The custom domain must be attached to the Pages project before its DNS is changed. The Cloudflare `robertj.in` record is CNAME `bricks` → `brick-editor.pages.dev`, DNS only, TTL Auto. Pages itself serves through Cloudflare and handles TLS. Domain verification is active and HTTPS returned HTTP 200 with a valid certificate on 2026-09-27. Live-browser and automatic-publication checks are tracked in TODO.md until they pass.

GitHub's former custom-domain certificate never became valid during the migration checks. The old GitHub Pages deployment workflow is replaced by the validation/publication workflow above. Do not repoint production DNS to GitHub while it still has the invalid certificate.

Browser projects and offline installation are stored per origin. Keeping `https://bricks.robertj.in` preserves that origin; moving between a provider URL and the custom domain requires native project export/import. DNS changes do not transfer browser storage between different origins.

References: [Cloudflare Git integration](https://developers.cloudflare.com/pages/configuration/git-integration/), [build configuration](https://developers.cloudflare.com/pages/configuration/build-configuration/), and [custom domains](https://developers.cloudflare.com/pages/configuration/custom-domains/).
