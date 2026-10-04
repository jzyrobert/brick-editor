import { expect, test } from "@playwright/test";
import { refusePointerLock } from "./helpers/pointer";

test("rendered lighthouse turns on its support without changing the source", async ({
  page,
}) => {
  await refusePointerLock(page);
  await page.goto("/?automation=1");
  await page.waitForFunction(() => !!window.brickEditor);
  const result = await page.evaluate(async () => {
    const api = window.brickEditor!;
    await api.project.import({ format: "template", template: "lighthouse" });
    await api.ready({ strict: true });
    const before = await api.query();
    const source = new TextDecoder().decode(
      (await api.project.export({ format: "ldraw" })).bytes,
    );
    await api.play.enter({
      rigIds: ["lighthouse"],
      realtime: false,
      position: [0, -8.3, -130],
      yaw: Math.PI,
    });
    const rest = await api.play.snapshot();
    const capture = async () => {
      const shot = await api.render.image({
        revision: rest.sourceRevision,
        width: 256,
        height: 256,
        format: "png",
        visibility: {
          mode: "occurrences",
          occurrenceIds: Object.keys(rest.mechanisms!.lighthouse.transforms),
        },
        background: { type: "solid", color: "#ffffff" },
        quality: "fast",
        strict: true,
      });
      return Array.from(new Uint8Array(await shot.blob.arrayBuffer()));
    };
    const restImage = await capture();
    await api.play.stepTicks(30);
    const moved = await api.play.snapshot();
    const movedImage = await capture();
    const posed = await api.play.exportPosedModel();
    await api.play.exit();
    return {
      before,
      after: await api.query(),
      source,
      exported: new TextDecoder().decode(
        (await api.project.export({ format: "ldraw" })).bytes,
      ),
      rest,
      moved,
      posed,
      restImage,
      movedImage,
    };
  });
  const lamp = result.moved.mechanisms!.lighthouse;
  expect(lamp.pose.jointPositions.turn).toBeCloseTo(30, 5);
  expect(lamp.blocked).toBe(false);
  expect(lamp.groupFrames.lamp.basis).not.toEqual(
    result.rest.mechanisms!.lighthouse.groupFrames.lamp.basis,
  );
  expect(result.posed.posedOccurrenceIds.length).toBeGreaterThan(0);
  expect(result.posed.text).not.toBe(result.source);
  expect(result.movedImage).not.toEqual(result.restImage);
  expect(result.after.occurrences).toEqual(result.before.occurrences);
  expect(result.exported).toBe(result.source);
});
