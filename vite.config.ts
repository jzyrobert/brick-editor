import { offlinePlugin } from "./scripts/offline-plugin";
import { defineConfig, type ProxyOptions } from "vite";
import react from "@vitejs/plugin-react";
const base = process.env.BASE_PATH || "/";
// Official set models (docs/OFFICIAL-MODELS.md): production serves
// `api/omr/<file>` from a Cloudflare Pages Function (functions/api/omr);
// the dev and preview servers forward the same path to LDraw.org.
const omrProxy: Record<string, ProxyOptions> = {
  [base + "api/omr/"]: {
    target: "https://library.ldraw.org",
    changeOrigin: true,
    rewrite: (path) =>
      path.replace(
        /^.*\/api\/omr\/([A-Za-z0-9._-]+\.(?:mpd|ldr))$/,
        "/library/omr/$1",
      ),
    headers: {
      "User-Agent": "brick-editor dev server (+https://bricks.robertj.in)",
    },
  },
};
export default defineConfig({
  base,
  plugins: [react(), offlinePlugin()],
  build: { target: "es2022" },
  server: { host: "0.0.0.0", proxy: omrProxy },
  preview: { proxy: omrProxy },
});
