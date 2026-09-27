import { expect, test } from "@playwright/test";
test("Play capture visibility and collision use the same frozen layer profile", async ({
  page,
}) => {
  await page.goto("/?automation=1");
  await page.waitForFunction(() => !!window.brickEditor);
  const r = await page.evaluate(async () => {
    const a = window.brickEditor!;
    await a.project.import({ format: "template", template: "wall" });
    const q = await a.query(),
      layerId = q.occurrences[0].layerId;
    await a.dispatch({
      schemaVersion: 1,
      commandId: crypto.randomUUID(),
      expectedRevision: q.revision,
      type: "layers.update",
      payload: { layerId, visible: false },
    });
    await a.ready({ strict: true });
    const before = await a.query(),
      document = await a.project.export({ format: "ldraw" });
    const capture = async (
      visibility:
        | { mode: "all" | "current" }
        | { mode: "layers"; layerIds: string[] }
        | { mode: "occurrences"; occurrenceIds: string[] },
    ) => {
      const result = await a.render.image({
        revision: before.revision,
        width: 256,
        height: 256,
        format: "png",
        visibility,
        background: { type: "solid", color: "#ffffff" },
        quality: "balanced",
        strict: true,
      });
      return Array.from(new Uint8Array(await result.blob.arrayBuffer()));
    };
    const authored = await capture({ mode: "current" });
    const entry = {
      position: [160, -0.3, 80] as [number, number, number],
      yaw: 0,
      pitch: 0,
    };
    const included = await a.play.enter(entry);
    const includedAll = await capture({ mode: "all" }),
      includedCurrent = await capture({ mode: "current" });
    a.play.setInput({ moveZ: 1 });
    const blocked = await a.play.stepTicks(90);
    await a.play.exit();
    const excluded = await a.play.enter({
      ...entry,
      worldProfile: { excludedLayerIds: [layerId] },
    });
    const excludedAll = await capture({ mode: "all" }),
      excludedCurrent = await capture({ mode: "current" }),
      excludedLayer = await capture({ mode: "layers", layerIds: [layerId] }),
      excludedOccurrences = await capture({
        mode: "occurrences",
        occurrenceIds: before.occurrences.map((o) => o.id),
      });
    a.play.setInput({ moveZ: 1 });
    const traversed = await a.play.stepTicks(90);
    await a.play.exit();
    return {
      included,
      excluded,
      includedAll,
      includedCurrent,
      excludedAll,
      excludedCurrent,
      excludedLayer,
      excludedOccurrences,
      blocked,
      traversed,
      authored,
      restored: await capture({ mode: "current" }),
      before,
      after: await a.query(),
      document,
      documentAfter: await a.project.export({ format: "ldraw" }),
    };
  });
  expect(r.included.worldProfile.includedOccurrenceIds).toHaveLength(40);
  expect(r.excluded.worldProfile.includedOccurrenceIds).toEqual([]);
  expect(r.includedAll).toEqual(r.includedCurrent);
  expect(r.excludedAll).toEqual(r.excludedCurrent);
  expect(r.excludedAll).toEqual(r.excludedLayer);
  expect(r.excludedAll).toEqual(r.excludedOccurrences);
  expect(r.includedAll).not.toEqual(r.excludedAll);
  expect(r.blocked.position[2]).toBeGreaterThan(20);
  expect(r.traversed.position[2]).toBeLessThan(-60);
  expect(r.restored).toEqual(r.authored);
  expect(r.after).toEqual(r.before);
  expect(r.documentAfter).toEqual(r.document);
});
