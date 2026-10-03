import { expect, test, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { openMode } from "./helpers/mode";
import { refusePointerLock } from "./helpers/pointer";
import { enterPlay, openRemoteControls } from "./helpers/play";

const shots = fileURLToPath(
  new URL("../../.local/screenshots/", import.meta.url),
);
mkdirSync(shots, { recursive: true });
const phone = { width: 360, height: 800 };
const desktop = { width: 1440, height: 1000 };

async function load(page: Page, template: "door-room" | "physics") {
  await page.goto("/?automation=1");
  await page.waitForFunction(() => !!window.brickEditor);
  await page.evaluate(async (template) => {
    await window.brickEditor!.project.import({ format: "template", template });
    await window.brickEditor!.ready();
  }, template);
}
const snapshot = (page: Page) =>
  page.evaluate(() => window.brickEditor!.play.snapshot());

test("a rendered dynamic shaft reaches and holds accumulated turn targets", async ({
  page,
}) => {
  test.setTimeout(120000);
  await refusePointerLock(page);
  await load(page, "physics");
  const source = await page.evaluate(async () =>
    new TextDecoder().decode(
      (await window.brickEditor!.project.export({ format: "ldraw" })).bytes,
    ),
  );
  await page.evaluate(() =>
    window.brickEditor!.play.enter({
      rigIds: ["spinner"],
      dynamicRigIds: ["spinner"],
      position: [160, -0.3, 200],
      cameraMode: "first-person",
      realtime: false,
    }),
  );
  const images: number[][] = [];
  for (const target of [720, -720, 765]) {
    const result = await page.evaluate(async (target) => {
      const play = window.brickEditor!.play;
      await play.setJointTarget({
        rigId: "spinner",
        jointId: "axle",
        target,
        speed: 180,
      });
      await play.stepTicks(900);
      return play.snapshot();
    }, target);
    expect(result.mechanisms!.spinner.pose.jointPositions.axle).toBeCloseTo(
      target,
      0,
    );
    expect(result.mechanisms!.spinner.jointTargets.axle.status).toBe(
      "complete",
    );
    const capture = await page.evaluate(async () => {
      const api = window.brickEditor!;
      const play = await api.play.snapshot();
      const image = await api.render.image({
        revision: play.sourceRevision,
        width: 256,
        height: 256,
        format: "png",
        visibility: { mode: "all" },
        background: { type: "solid", color: "#ffffff" },
        quality: "fast",
        strict: true,
      });
      return {
        bytes: Array.from(new Uint8Array(await image.blob.arrayBuffer())),
        manifest: image.manifest,
      };
    });
    expect(
      (capture.manifest as unknown as { play: typeof result }).play.mechanisms!
        .spinner.pose.jointPositions.axle,
    ).toBeCloseTo(target, 0);
    images.push(capture.bytes);
  }
  expect(images[2]).not.toEqual(images[0]);
  const held = await page.evaluate(async () => {
    await window.brickEditor!.play.stepTicks(120);
    return window.brickEditor!.play.snapshot();
  });
  expect(held.mechanisms!.spinner.pose.jointPositions.axle).toBeCloseTo(765, 0);
  const posed = await page.evaluate(() =>
    window.brickEditor!.play.exportPosedModel(),
  );
  expect(posed.text).not.toEqual(source);
  await page.evaluate(() => window.brickEditor!.play.exit());
  expect(
    await page.evaluate(async () =>
      new TextDecoder().decode(
        (await window.brickEditor!.project.export({ format: "ldraw" })).bytes,
      ),
    ),
  ).toEqual(source);
});

for (const viewport of [desktop, phone])
  test(`official LDraw door opens with ${viewport === phone ? "a tap" : "E"} at ${viewport.width}px`, async ({
    browser,
    baseURL,
  }) => {
    const touch = viewport === phone;
    const context = await browser.newContext({
      viewport,
      hasTouch: touch,
      isMobile: touch,
      baseURL,
    });
    const page = await context.newPage();
    await refusePointerLock(page);
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    try {
      await load(page, "door-room");
      const source = await page.evaluate(() =>
        window.brickEditor!.project.export({ format: "ldraw" }),
      );
      await openMode(page, "Play");
      // The entry card stays plain: no mechanism options without authored rigs.
      await expect(page.getByText("Mechanism physics")).toHaveCount(0);
      const entered = await page.evaluate(() =>
        window.brickEditor!.play.enter({
          position: [0, -0.3, 70],
          yaw: 0,
          realtime: false,
          cameraMode: "third-person",
        }),
      );
      expect(entered.autoDoors!.doors).toHaveLength(1);
      expect(entered.autoDoors!.doors[0]).toMatchObject({
        part: "60616a",
        swing: "positive",
      });
      const open = page.getByRole("button", { name: "Open door" });
      await expect(open).toBeEnabled();
      await page.screenshot({
        path: `${shots}door-closed-${viewport.width}.png`,
      });
      // The door swings towards this side; step back out of its sweep first.
      await page.evaluate(() =>
        window.brickEditor!.play.teleport({ position: [-32, -0.3, 92] }),
      );
      await expect(open).toBeEnabled();
      if (touch) await open.tap();
      else await page.keyboard.press("e");
      await page.evaluate(() => window.brickEditor!.play.stepTicks(70));
      const opened = await snapshot(page);
      expect(opened.mechanisms!["auto-door:0"].pose.jointPositions.door).toBe(
        90,
      );
      await expect(
        page.getByRole("button", { name: "Close door" }),
      ).toBeVisible();
      await page.evaluate(async () => {
        await window.brickEditor!.play.teleport({ position: [10, -0.3, 150] });
        await window.brickEditor!.play.setInput({ moveZ: 1 });
        await window.brickEditor!.play.stepTicks(200);
        await window.brickEditor!.play.setInput({});
      });
      expect((await snapshot(page)).position[2]).toBeLessThan(-60);
      await page.evaluate(() =>
        window.brickEditor!.play.teleport({ position: [0, -0.3, 180] }),
      );
      await page.evaluate(() => window.brickEditor!.play.stepTicks(1));
      await page.screenshot({
        path: `${shots}door-open-${viewport.width}.png`,
      });
      // Automation: the static posed snapshot is explicit; the build is not edited.
      const posed = await page.evaluate(() =>
        window.brickEditor!.play.exportPosedModel(),
      );
      expect(posed.rigIds).toEqual(["auto-door:0"]);
      expect(posed.text).toMatch(/0 0 -1 0 1 0 1 0 0 60616a\.dat/);
      await page.evaluate(() => window.brickEditor!.play.exit());
      expect(
        await page.evaluate(() =>
          window.brickEditor!.project.export({ format: "ldraw" }),
        ),
      ).toEqual(source);
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });

for (const viewport of [desktop, phone])
  test(`dynamic physics from the Play drawer at ${viewport.width}px`, async ({
    browser,
    baseURL,
  }) => {
    test.setTimeout(120000);
    const touch = viewport === phone;
    const context = await browser.newContext({
      viewport,
      hasTouch: touch,
      isMobile: touch,
      baseURL,
    });
    const page = await context.newPage();
    await refusePointerLock(page);
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    try {
      await load(page, "physics");
      await openMode(page, "Play");
      const drawer = page.locator("summary", { hasText: "Mechanism physics" });
      await expect(drawer).toBeVisible();
      // Progressive disclosure: the choice is folded away until asked for.
      await expect(page.getByText("Dynamic · gravity")).toBeHidden();
      await drawer.click();
      await page.getByText("Dynamic · gravity").click();
      await enterPlay(page);
      await expect(page.locator(".play-overlay")).toBeVisible({
        timeout: 30000,
      });
      await page.evaluate(() => window.brickEditor!.play.pause(true));
      const entered = await snapshot(page);
      for (const id of ["crate", "door", "spinner", "vehicle"])
        expect(entered.mechanisms![id].mode).toBe("dynamic");
      await page.evaluate(async () => {
        const play = window.brickEditor!.play;
        // Facing −Z, towards the crate (Play now starts in front of a build,
        // facing +Z).
        await play.teleport({ position: [-120, -0.3, 140], yaw: 0 });
        await play.setInput({ moveZ: 1 });
        await play.stepTicks(90);
        await play.setInput({});
      });
      const pushed = await snapshot(page);
      expect(
        pushed.mechanisms!.crate.groupFrames.crate.position[2],
      ).toBeLessThan(30);
      // Motor toggle lives in the existing remote-controls drawer.
      await page.evaluate(() => window.brickEditor!.play.pause(false));
      await openRemoteControls(page);
      await page
        .getByRole("combobox", { name: "Remote mechanism" })
        .selectOption("spinner");
      const stop = page.getByRole("button", { name: /Stop motor/ });
      await expect(stop).toBeVisible();
      await page.screenshot({
        path: `${shots}physics-drawer-${viewport.width}.png`,
      });
      await stop.click();
      await expect(
        page.getByRole("button", { name: /Start motor/ }),
      ).toBeVisible();
      expect(
        (await snapshot(page)).mechanisms!.spinner.motors!.axle.enabled,
      ).toBe(false);
      await page.evaluate(() => window.brickEditor!.play.exit());
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });
