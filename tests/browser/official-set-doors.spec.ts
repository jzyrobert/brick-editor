import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { openMode } from "./helpers/mode";

// Doors in an official set opened from the LDraw OMR (docs/PLAY-PHYSICS.md,
// "Doors in official models"). The network is mocked: `api/omr/21318-1.mpd`
// answers with an original CC0 door study (fixtures/ldraw/omr-doors.mpd) that
// authors doors the way OMR models do, not with the real set.
test.describe.configure({ timeout: 180000 });
const MODEL = readFileSync("fixtures/ldraw/omr-doors.mpd", "utf8");

test("an official set's doors, panes and shutters open in Play", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route("https://library.ldraw.org/**", (route) => route.abort());
  await page.route("**/api/omr/**", (route) =>
    new URL(route.request().url()).pathname.endsWith("/api/omr/21318-1.mpd")
      ? route.fulfill({
          status: 200,
          contentType: "text/plain; charset=utf-8",
          body: MODEL,
        })
      : route.fulfill({ status: 404, body: "No such OMR model\n" }),
  );
  await page.goto("./?automation=1");
  await page.waitForFunction(() => !!window.brickEditor);
  await openMode(page, "Project");
  await page
    .getByRole("searchbox", { name: "Search official sets" })
    .fill("tree house 21318");
  await page
    .getByRole("list", { name: "Matching sets" })
    .getByRole("button", { name: /21318-1\s*Tree House/ })
    .first()
    .click();
  await expect(page.getByLabel("Project title")).toHaveValue(
    "21318-1 Tree House",
    { timeout: 60000 },
  );
  await openMode(page, "Play");
  const entered = await page.evaluate(async () => {
    const a = window.brickEditor!;
    await a.ready({ strict: true });
    return a.play.enter({
      position: [0, -0.3, 300],
      realtime: false,
      cameraMode: "third-person",
    });
  });
  const doors = entered.autoDoors!.doors;
  // Both houses (square and turned with rounded decimals): the ajar door,
  // two panes and a shutter each, plus the embedded copy of a door.
  expect(doors.map((d) => d.part).sort()).toEqual(
    [
      "3582",
      "3582",
      "3854",
      "3854",
      "3854",
      "3854",
      "60623",
      "60623",
      "60623",
    ].sort(),
  );
  expect(doors.every((d) => d.swing !== "blocked")).toBe(true);
  expect(entered.autoDoors!.skipped).toEqual([
    expect.objectContaining({
      part: "60616a",
      reason: "Mirrored doors cannot hinge",
    }),
  ]);
  // Swing a shutter open on its holder.
  const shutter = doors.find((d) => d.part === "3582")!;
  const opened = await page.evaluate(async (door) => {
    const play = window.brickEditor!.play;
    const s = await play.snapshot();
    const joint = s.mechanisms![door.rigId];
    const report = s.autoDoors!.doors.find(
      (d) => d.occurrenceId === door.occurrenceId,
    )!;
    const target = report.swing === "negative" ? -60 : 60;
    await play.setJointTarget({
      rigId: door.rigId,
      jointId: door.jointId,
      target,
      speed: 90,
    });
    await play.stepTicks(60);
    return {
      before: joint.pose.jointPositions[door.jointId],
      after: (await play.snapshot()).mechanisms![door.rigId].pose
        .jointPositions[door.jointId],
      target,
    };
  }, shutter);
  expect(opened.before).toBe(0);
  expect(opened.after).toBe(opened.target);
  await page.evaluate(() => window.brickEditor!.play.exit());
  expect(errors).toEqual([]);
});
