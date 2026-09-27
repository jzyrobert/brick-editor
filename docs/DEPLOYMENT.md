# Static hosting

Production: **https://bricks.robertj.in/**.

The site remains hosted on GitHub Pages. The existing `.github/workflows/pages.yml` validates the app and deploys the static Vite output after pushes to `main`. GitHub Pages supports the requested subdomain, so no additional Cloudflare hosting service or deployment token is required.

Repository Pages settings use `bricks.robertj.in` as the custom domain. In the Cloudflare `robertj.in` zone, the DNS record is:

| Type  | Name   | Target              | Proxy    | TTL  |
| ----- | ------ | ------------------- | -------- | ---- |
| CNAME | bricks | jzyrobert.github.io | DNS only | Auto |

GitHub manages the TLS certificate. Enable **Enforce HTTPS** in Pages settings after the certificate is provisioned. The workflow takes `BASE_PATH` from `actions/configure-pages`; the custom domain serves the app at `/`, while a repository-only Pages URL uses `/brick-editor/`. Do not put a repository path into the CNAME target.

The custom domain is configured through repository Pages settings. A `CNAME` file is not required by this Actions deployment. To move hosting later, update the Pages custom-domain setting and DNS record together, then deploy with the new base path and verify part loading, workers, image capture and offline installation.

Browser projects and offline installation are stored per origin. Transfer an existing project between addresses using native project export/import; DNS changes do not transfer browser storage.
