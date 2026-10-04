import type { Page } from "@playwright/test";

/** Runtime exploration must preserve the source document and inventory. */
export async function playSourceState(page: Page) {
  return page.evaluate(async () => {
    const api = window.brickEditor!,
      query = await api.query();
    return {
      query,
      source: Array.from((await api.project.export({ format: "ldraw" })).bytes),
      inventory: await api.inventory.preview({
        expectedRevision: query.revision,
        scope: { kind: "all" },
        format: "bricklink-wanted-xml",
        acceptDerivedMappings: true,
        acceptUnknownColors: true,
        errorPolicy: "export-resolved",
      }),
    };
  });
}
