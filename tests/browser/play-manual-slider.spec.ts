import { expect, test, type Locator, type Page } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { openMode } from "./helpers/mode";
import { closeRemoteControls, openRemoteControls } from "./helpers/play";
import { refusePointerLock } from "./helpers/pointer";

async function documentState(page: Page) {
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

async function burst(slider: Locator, values: number[]) {
  await slider.evaluate((input, values) => {
    const setter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )!.set!;
    for (const value of values) {
      setter.call(input, String(value));
      input.dispatchEvent(new Event("input", { bubbles: true }));
    }
  }, values);
}

for (const [template, width, height] of [
  ["house", 1440, 1000],
  ["house", 390, 844],
  ["cafe", 1440, 1000],
  ["cafe", 390, 844],
] as const) {
  test(`rapid manual door slider ${template} ${width}×${height}`, async ({
    browser,
    baseURL,
  }) => {
    test.setTimeout(180000);
    const context = await browser.newContext({
        viewport: { width, height },
        hasTouch: width !== 1440,
      }),
      page = await context.newPage(),
      errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await refusePointerLock(page);
    try {
      await page.goto(`${baseURL}/?automation=1`);
      await page.waitForFunction(() => !!window.brickEditor);
      await page.evaluate(async (template) => {
        const api = window.brickEditor!;
        await api.project.import({ format: "template", template });
        await api.ready({ strict: true });
      }, template);
      const before = await documentState(page);
      await openMode(page, "Play");
      const door = await page.evaluate(async () => {
        const api = window.brickEditor!;
        const entered = await api.play.enter({
          position: [300, -0.3, 250],
          realtime: false,
        });
        return entered.autoDoors!.doors.find(
          (d) => d.part === "60616a" || d.part === "60623",
        )!;
      });
      expect(door).toBeTruthy();
      await openRemoteControls(page);
      const rigs = page.getByLabel("Remote mechanism", { exact: true });
      if (await rigs.count()) await rigs.selectOption(door.rigId);
      const joints = page.getByLabel("Part control", { exact: true });
      if (await joints.count()) await joints.selectOption(door.jointId);
      const slider = page.getByLabel(`Explore joint ${door.jointId}`, {
        exact: true,
      });
      await expect(slider).toBeVisible();
      const target = door.swing === "negative" ? -90 : 90;
      const report = async () =>
        page.evaluate(
          async (id) =>
            (await window.brickEditor!.play.snapshot()).mechanisms![id],
          door.rigId,
        );
      // A synchronous event burst changes the intended thumb position immediately
      // but publishes only its latest target. The accepted source pose stays put
      // until ordinary, bounded simulation ticks advance it.
      await burst(slider, [0, target * 0.2, target, 0, target * 0.6, target]);
      await expect(slider).toHaveValue(String(target));
      await expect
        .poll(async () => (await report()).jointTargets?.[door.jointId]?.target)
        .toBe(target);
      expect((await report()).pose.jointPositions[door.jointId]).toBe(0);
      await page.evaluate(() => window.brickEditor!.play.stepTicks(80));
      expect((await report()).pose.jointPositions[door.jointId]).toBe(target);
      expect((await report()).jointTargets![door.jointId].status).toBe(
        "complete",
      );
      await expect(page.locator(".play-mechanism")).not.toContainText(
        /too complex|too many safety checks/i,
      );
      await burst(slider, [0, target, 0, target * 0.4, 0]);
      await expect
        .poll(async () => (await report()).jointTargets?.[door.jointId]?.target)
        .toBe(0);
      await page.evaluate(() => window.brickEditor!.play.stepTicks(80));
      const closed = await report();
      expect(Math.abs(closed.pose.jointPositions[door.jointId])).toBeLessThan(
        3,
      );
      expect(closed.blockedReason ?? "").not.toMatch(
        /too complex|too many safety checks/i,
      );
      await page.screenshot({
        path: `.local/remote-slider-${template}-${width}.png`,
      });
      // Close before the pending animation-frame dispatch. It must not send a
      // late move after the control surface has gone away.
      await slider.evaluate((input, target) => {
        Object.getOwnPropertyDescriptor(
          HTMLInputElement.prototype,
          "value",
        )!.set!.call(input, String(target));
        input.dispatchEvent(new Event("input", { bubbles: true }));
        (
          document.querySelector(".play-mechanism-close") as HTMLButtonElement
        ).click();
      }, target);
      await expect(page.locator(".play-mechanism")).toHaveCount(0);
      expect((await report()).jointTargets![door.jointId].target).toBe(0);
      await page.evaluate(() => window.brickEditor!.play.stepTicks(5));
      expect((await report()).jointTargets![door.jointId].target).toBe(0);
      await openRemoteControls(page);

      const box = await slider.boundingBox();
      expect(box!.height).toBeGreaterThanOrEqual(44);
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(width);
      await burst(slider, [target, 0, target]);
      await expect
        .poll(async () => (await report()).jointTargets?.[door.jointId]?.target)
        .toBe(target);
      await page.evaluate(() => window.brickEditor!.play.stepTicks(80));
      expect((await report()).pose.jointPositions[door.jointId]).toBe(target);
      await closeRemoteControls(page);
      await page.evaluate(() => window.brickEditor!.play.exit());
      const after = await documentState(page);
      expect(after.query.revision).toBe(before.query.revision);
      expect(after.inventory).toEqual(before.inventory);
      expect(after.source).toEqual(before.source);
      expect(after.query.occurrences).toEqual(before.query.occurrences);
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });
}

test("manual slider keeps a real thin wall stop and retries after a source edit removes it", async ({
  page,
}) => {
  test.setTimeout(180000);
  await refusePointerLock(page);
  await page.goto("/?automation=1");
  await page.waitForFunction(() => !!window.brickEditor);
  for (const wall of [true, false]) {
    const text =
      "0 Original CC0 manual-door obstruction probe\n" +
      "1 15 0 -152 -770 1 0 0 0 1 0 0 0 1 60596.dat\n" +
      "1 4 -32 -152 -765 1 0 0 0 1 0 0 0 1 60616a.dat\n" +
      (wall ? "4 7 -10 -140 -740 50 -140 -740 50 -30 -740 -10 -30 -740\n" : "");
    // Playwright's native TS importer cannot load the pinned JSON imports in
    // fixture producers. Use the repository's TS loader, as other native
    // browser fixtures do; this changes no product entry policy.
    const bytes: number[] = JSON.parse(
      execFileSync(
        process.execPath,
        [
          "node_modules/tsx/dist/cli.mjs",
          "--eval",
          `
      import { importLDraw } from './src/ldraw/io';
      import { occurrences } from './src/core/document';
      import { deriveDoorRigs } from './src/play/auto-doors';
      import { encodeNative } from './src/persistence/native';
      const project = importLDraw(${JSON.stringify(text)}, 'manual-door.ldr');
      const derived = deriveDoorRigs(project, { all: occurrences(project), reserved: new Set(), maxRigs:32,maxGroups:128 });
      const rig = Object.values(derived.rigs)[0]; rig.id='manual-door';
      project.motionRigs = { [rig.id]: rig };
      encodeNative(project).then(bytes=>process.stdout.write(JSON.stringify(Array.from(bytes))));
      `,
        ],
        { encoding: "utf8", maxBuffer: 4 * 1024 * 1024 },
      ),
    );
    await page.evaluate(async (bytes) => {
      const api = window.brickEditor!;
      await api.project.import({ format: "native", bytes });
      await api.ready({ strict: true });
    }, bytes);
    const before = await documentState(page);
    await openMode(page, "Play");
    await page.evaluate(() =>
      window.brickEditor!.play.enter({
        rigIds: ["manual-door"],
        autoDoors: false,
        position: [150, -0.3, -650],
        realtime: false,
      }),
    );
    await openRemoteControls(page);
    const slider = page.getByLabel("Explore joint door", { exact: true });
    await burst(slider, [90, 0, 90, 30, 90]);
    await expect
      .poll(
        async () =>
          (await page.evaluate(() => window.brickEditor!.play.snapshot()))
            .mechanisms!["manual-door"].jointTargets?.door?.target,
      )
      .toBe(90);
    await page.evaluate(() => window.brickEditor!.play.stepTicks(80));
    const report = (
      await page.evaluate(() => window.brickEditor!.play.snapshot())
    ).mechanisms!["manual-door"];
    if (wall) {
      expect(report.pose.jointPositions.door).toBeGreaterThan(5);
      expect(report.pose.jointPositions.door).toBeLessThan(60);
      expect(report.jointTargets!.door.status).toBe("blocked");
      expect(report.blockedReason).toMatch(/intersect/);
      await expect(slider).toHaveValue(
        String(Math.round(report.pose.jointPositions.door)),
      );
    } else {
      expect(report.pose.jointPositions.door).toBe(90);
      expect(report.jointTargets!.door.status).toBe("complete");
    }
    expect(report.blockedReason ?? "").not.toMatch(
      /too complex|too many safety checks/i,
    );
    // Closing with another event burst retains only its final intent.
    await burst(slider, [90, 0, 60, 0]);
    await expect
      .poll(
        async () =>
          (await page.evaluate(() => window.brickEditor!.play.snapshot()))
            .mechanisms!["manual-door"].jointTargets?.door?.target,
      )
      .toBe(0);
    await page.evaluate(() => window.brickEditor!.play.stepTicks(80));
    expect(
      (await page.evaluate(() => window.brickEditor!.play.snapshot()))
        .mechanisms!["manual-door"].pose.jointPositions.door,
    ).toBe(0);
    await closeRemoteControls(page);
    await page.evaluate(() => window.brickEditor!.play.exit());
    expect(await documentState(page)).toEqual(before);
  }
});
