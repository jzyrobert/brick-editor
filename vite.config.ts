import { offlinePlugin } from "./scripts/offline-plugin";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
  base: process.env.BASE_PATH || "/",
  plugins: [react(), offlinePlugin()],
  build: { target: "es2022" },
  server: { host: "0.0.0.0" },
});
