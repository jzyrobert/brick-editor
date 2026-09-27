import { expect, test } from "@playwright/test";

test("render budget rejection retains every authored part and offline inventory", async ({
  page,
}) => {
  await page.goto("/?automation=1");
  await page.waitForFunction(() => !!window.brickEditor);
  const result = await page.evaluate(async () => {
    const api = window.brickEditor!;
    await api.ready();
    await api.project.import({ format: "template", template: "blank" });
    let q = await api.query();
    await api.dispatch({
      schemaVersion: 1,
      commandId: "over-render-budget",
      expectedRevision: q.revision,
      type: "parts.add",
      payload: {
        maxAdditions: 5001,
        parts: Array.from({ length: 5001 }, (_, i) => ({
          ref: "3001.dat",
          colorCode: "4",
          transform: {
            position: [(i % 100) * 80, -24, Math.floor(i / 100) * 40],
            basis: [1, 0, 0, 0, 1, 0, 0, 0, 1],
          },
        })),
      },
    });
    q = await api.query();
    let failure = "";
    try {
      await api.ready({ minRevision: q.revision, strict: true });
    } catch (e) {
      failure = (e as Error).message;
    }
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
    return { failure, query: q, inventory, xml };
  });
  expect(result.failure).toContain("5,000");
  expect(JSON.stringify(result.inventory)).toContain("5001");
  expect(JSON.stringify(result.xml)).toContain("5001");
  expect((result.query as any).occurrences).toHaveLength(5001);
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
