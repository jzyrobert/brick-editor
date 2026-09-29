import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

const mappings = JSON.parse(
  readFileSync("src/catalog/mappings.json", "utf8"),
) as { parts: Record<string, { verifiedColors: string[] }> };

// Mapped part/colour pairs, so the refused model still has a complete inventory.
const pairs = Object.entries(mappings.parts).flatMap(([key, part]) =>
  part.verifiedColors.map((colorCode) => ({
    ref: key.replace(/^official:/, ""),
    colorCode,
  })),
);

test("render budget rejection retains every authored part and offline inventory", async ({
  page,
}) => {
  test.setTimeout(180000);
  await page.goto("/?automation=1");
  await page.waitForFunction(() => !!window.brickEditor);
  const variants = pairs.slice(0, 769);
  expect(variants).toHaveLength(769);
  const result = await page.evaluate(async (variants) => {
    const api = window.brickEditor!;
    await api.ready();
    // Phone limits: 768 part/colour variants; one more is refused.
    await api.resources.setProfile({ profile: "mobile" });
    await api.project.import({ format: "template", template: "blank" });
    let q = await api.query();
    await api.dispatch({
      schemaVersion: 1,
      commandId: "over-render-budget",
      expectedRevision: q.revision,
      type: "parts.add",
      payload: {
        maxAdditions: variants.length,
        parts: variants.map((v, i) => ({
          ...v,
          transform: {
            position: [(i % 30) * 100, -24, Math.floor(i / 30) * 60],
            basis: [1, 0, 0, 0, 1, 0, 0, 0, 1],
          },
        })),
      },
    });
    q = await api.query();
    let failure = "",
      code = "";
    try {
      await api.ready({ minRevision: q.revision, strict: true });
    } catch (e) {
      failure = (e as Error).message;
      code = (e as { code: string }).code;
    }
    const budget = await api.render.budget();
    const inventory = await api.inventory.preview({
      expectedRevision: q.revision,
      format: "bricklink-wanted-xml",
      scope: { kind: "all" },
    });
    const xml = await api.inventory.export({
      previewId: inventory.previewId,
      expectedRevision: q.revision,
      expectedMappingPackSha256: inventory.mappingPackSha256,
      errorPolicy: "block",
    });
    // Desktop limits (2,048 variants) draw the same document completely.
    await api.resources.setProfile({ profile: "desktop" });
    let desktopFailure = "";
    try {
      await api.ready({ minRevision: q.revision, strict: true });
    } catch (e) {
      desktopFailure = (e as Error).message;
    }
    const desktop = await api.render.budget();
    return {
      failure,
      code,
      budget,
      query: q,
      inventory,
      xml,
      desktopFailure,
      desktop,
    };
  }, variants);
  expect(result.code).toBe("LIMIT_EXCEEDED");
  expect(result.failure).toContain(
    "769 distinct part/colour variants; the phone renderer budget is 768",
  );
  expect(result.failure).toContain("Nothing was drawn");
  expect(result.budget.profile).toBe("mobile");
  expect(JSON.stringify(result.inventory)).toContain("769");
  expect(JSON.stringify(result.xml).length).toBeGreaterThan(1000);
  expect((result.query as any).occurrences).toHaveLength(769);
  expect(result.desktopFailure).toBe("");
  expect(result.desktop.profile).toBe("desktop");
  expect(result.desktop.usage).toMatchObject({
    partOccurrences: 769,
    variants: 769,
  });
});

test("WebGL initialization failure leaves native export and inventory usable", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      this: HTMLCanvasElement,
      type: string,
      ...args: any[]
    ) {
      if (type.startsWith("webgl") || type === "experimental-webgl")
        return null;
      return Reflect.apply(original, this, [type, ...args]);
    } as typeof original;
  });
  await page.goto("/?automation=1");
  await page.waitForFunction(() => !!window.brickEditor);
  const result = await page.evaluate(async () => {
    const api = window.brickEditor!;
    await api.project.import({ format: "template", template: "200" });
    const q = await api.query();
    let code = "";
    try {
      await api.ready();
    } catch (e) {
      code = (e as { code: string }).code;
    }
    const inventory = await api.inventory.preview({
      expectedRevision: q.revision,
      format: "bricklink-wanted-xml",
      scope: { kind: "all" },
    });
    const native = await api.project.export({ format: "native" });
    return { code, inventory, nativeSize: native.bytes.length };
  });
  expect(result.code).toBe("WEBGL_UNAVAILABLE");
  expect(JSON.stringify(result.inventory)).toContain("200");
  expect(result.nativeSize).toBeGreaterThan(100);
});
