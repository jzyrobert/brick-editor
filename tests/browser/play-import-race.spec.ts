import { realMechanismsFixture } from "./helpers/real-mechanisms";
import { test, expect } from "@playwright/test";
test("cached imports can enter Play immediately without a delayed editor effect cancelling the new session", async ({
  page,
}) => {
  await page.goto("/?automation=1");
  await page.waitForFunction(() => !!window.brickEditor);
  const results = await page.evaluate(async (realFixtureBytes: number[]) => {
    const api = window.brickEditor!;
    // Warm the lazy Play runtime, then replace and edit projects without UI
    // frame delays, matching a headless automation workflow.
    await api.project.import({ format: "template", template: "explore" });
    await api.ready({ strict: true });
    await api.play.enter({ ground: true });
    await api.play.teleport({ position: [0, -0.3, 125], policy: "safe" });
    await api.play.setInput({ moveZ: 1 });
    await api.play.stepTicks(30);
    await api.play.exit();
    await api.project.import({ format: "template", template: "wall" });
    const wall = await api.query();
    await api.dispatch({
      schemaVersion: 1,
      commandId: crypto.randomUUID(),
      expectedRevision: wall.revision,
      type: "layers.duplicate",
      payload: { layerId: wall.occurrences[0].layerId },
    });
    const duplicated = await api.query();
    await api.dispatch({
      schemaVersion: 1,
      commandId: crypto.randomUUID(),
      expectedRevision: duplicated.revision,
      type: "history.undo",
      payload: {},
    });
    const reports = [];
    for (let i = 0; i < 3; i++) {
      await api.project.import({ format: "native", bytes: realFixtureBytes });
      await api.ready({ strict: true });
      const before = await api.query();
      await api.play.enter({ rigId: "door", position: [20, -0.3, 45] });
      await new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      );
      await api.play.setJointTarget({
        jointId: "hinge",
        target: 90,
        speed: 90,
      });
      const opened = await api.play.stepTicks(60);
      reports.push({
        pose: opened.mechanism!.pose.jointPositions.hinge,
        revision: before.revision,
        after: (await api.query()).revision,
      });
      await api.play.exit();
    }
    return reports;
  }, realFixture.bytes);
  expect(results).toHaveLength(3);
  for (const result of results) {
    expect(result.pose).toBe(90);
    expect(result.after).toBe(result.revision);
  }
});

const realFixture = realMechanismsFixture();
