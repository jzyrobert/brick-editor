import { fileURLToPath } from "node:url";
import type { Page } from "@playwright/test";
import type { Project } from "../src/core/types";
import { encodeNative } from "../src/persistence/native";

/** Renderer-only CLI operations use a private local server and always dispose it. */
export async function withHeadlessPage<T>(
  project: Project,
  operation: (page: Page) => Promise<T>,
): Promise<T> {
  const [{ createServer }, { chromium }] = await Promise.all([
    import("vite"),
    import("@playwright/test"),
  ]);
  const server = await createServer({
    root: fileURLToPath(new URL("../", import.meta.url)),
    base: "/",
    server: { host: "127.0.0.1", port: 0, hmr: false, watch: null },
    logLevel: "error",
  });
  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
  try {
    await server.listen();
    browser = await chromium.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--use-angle=swiftshader",
        "--enable-unsafe-swiftshader",
      ],
    });
    const page = await browser.newPage({
      viewport: { width: 1200, height: 900 },
    });
    page.setDefaultTimeout(60000);
    await page.goto(server.resolvedUrls!.local[0] + "?automation=1");
    await page.waitForFunction(() => window.brickEditor?.apiVersion === "1.0");
    await page.evaluate(
      async (bytes) => {
        const a = window.brickEditor!,
          imported = await a.project.import({ format: "native", bytes });
        await a.ready({ minRevision: imported.revision, strict: true });
      },
      Array.from(await encodeNative(project)),
    );
    return await operation(page);
  } finally {
    try {
      await browser?.close();
    } finally {
      await server.close();
    }
  }
}
