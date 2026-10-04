import { expect, test } from "@playwright/test";
import { refusePointerLock } from "./helpers/pointer";

const doorSource = [
  "0 Door floor-clearance probe",
  "1 15 0 -152 -770 1 0 0 0 1 0 0 0 1 60596.dat",
  "1 4 -32 -152 -765 1 0 0 0 1 0 0 0 1 60616a.dat",
  "1 71 0 -8 -750 1 0 0 0 1 0 0 0 1 4162.dat",
].join("\n");

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

test("rendered door opens over a real tile and closes without changing its source", async ({
  page,
}) => {
  await refusePointerLock(page);
  await page.goto("/?automation=1");
  await page.waitForFunction(() => !!window.brickEditor);
  const result = await page.evaluate(async (text) => {
    const api = window.brickEditor!;
    await api.project.import({
      format: "ldraw",
      name: "door-support.ldr",
      text,
    });
    await api.ready({ strict: true });
    const before = await api.query();
    const source = new TextDecoder().decode(
      (await api.project.export({ format: "ldraw" })).bytes,
    );
    await api.play.enter({ realtime: false, position: [180, -0.3, -900] });
    const rest = await api.play.snapshot();
    const door = rest.autoDoors!.doors[0];
    await api.play.setJointTarget({
      rigId: door.rigId,
      jointId: door.jointId,
      target: 90,
      speed: 180,
    });
    await api.play.stepTicks(40);
    const opened = await api.play.snapshot();
    await api.play.setJointTarget({
      rigId: door.rigId,
      jointId: door.jointId,
      target: 0,
      speed: 180,
    });
    await api.play.stepTicks(40);
    const closed = await api.play.snapshot();
    await api.play.exit();
    return {
      before,
      after: await api.query(),
      source,
      exported: new TextDecoder().decode(
        (await api.project.export({ format: "ldraw" })).bytes,
      ),
      door,
      opened,
      closed,
    };
  }, doorSource);
  const opened = result.opened.mechanisms![result.door.rigId];
  const closed = result.closed.mechanisms![result.door.rigId];
  expect(opened.pose.jointPositions[result.door.jointId]).toBe(90);
  expect(opened.jointTargets[result.door.jointId].status).toBe("complete");
  expect(closed.pose.jointPositions[result.door.jointId]).toBe(0);
  expect(closed.jointTargets[result.door.jointId].status).toBe("complete");
  expect(result.after.occurrences).toEqual(result.before.occurrences);
  expect(result.exported).toBe(result.source);
});
