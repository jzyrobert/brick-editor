import { expect, test } from "@playwright/test";
import { unzipSync, strFromU8 } from "fflate";
import { openMenuTab } from "./helpers/mode";
import { refusePointerLock } from "./helpers/pointer";
import { mountedMotorFixture } from "./helpers/physical-fixtures";
const source = mountedMotorFixture().text;

for (const physics of ["kinematic", "dynamic"] as const)
  test(`unsaved ${physics} proposal drives a full Play session, exports a pose and exits without changing source`, async ({
    page,
  }) => {
    await page.goto("/?automation=1");
    await page.waitForFunction(() => !!window.brickEditor);
    const result = await page.evaluate(
      async ({ source, physics }) => {
        const api = window.brickEditor!;
        await api.project.import({
          format: "ldraw",
          name: "proposal.mpd",
          text: source,
        });
        await api.ready({ strict: true });
        const before = await api.query(),
          text = await api.project.export({ format: "ldraw" });
        const inventoryInput = {
          expectedRevision: before.revision,
          scope: { kind: "all" as const },
          format: "bricklink-wanted-xml" as const,
          acceptDerivedMappings: true,
          acceptUnknownColors: true,
          errorPolicy: "export-resolved" as const,
        };
        const nativeBefore = Array.from(
            (await api.project.export({ format: "native" })).bytes,
          ),
          inventoryBefore = await api.inventory.preview(inventoryInput);
        const request = {
          id: "unsaved-drive",
          name: "Unsaved drive",
          expectedRevision: before.revision,
          occurrenceIds: before.occurrences.map((o) => o.id),
          frameOccurrenceIds: [12].map((i) => before.occurrences[i].id),
          motors: {
            [before.occurrences[2].id]: {
              mode: "velocity" as const,
              binding: {
                occurrenceId: before.occurrences[10].id,
                profile: "power-functions-motor-m-v1" as const,
              },
              target: 90,
              maxEffort: { value: 50, unit: "N*m" as const },
            },
          },
        };
        const proposal = await api.mechanisms.propose(request);
        await api.mechanisms.tryProposal(
          request,
          { realtime: false, ground: true },
          physics,
        );
        const moved = await api.play.stepTicks(120),
          posed = await api.play.exportPosedModel();
        let refusedStale = false;
        try {
          await api.mechanisms.tryProposal({
            ...request,
            expectedRevision: before.revision + 1,
          });
        } catch {
          refusedStale = true;
        }
        const retained = await api.play.snapshot();
        const during = await api.query(),
          authored = await api.mechanisms.list();
        await api.play.exit();
        const after = await api.query(),
          afterText = await api.project.export({ format: "ldraw" });
        const nativeAfter = Array.from(
            (await api.project.export({ format: "native" })).bytes,
          ),
          inventoryAfter = await api.inventory.preview(inventoryInput);
        await api.mechanisms.saveProposal(request);
        const saved = await api.mechanisms.list();
        await api.dispatch({
          schemaVersion: 1,
          commandId: "undo-reviewed-drive",
          expectedRevision: (await api.query()).revision,
          type: "history.undo",
          payload: {},
        });
        return {
          nativeBefore,
          nativeAfter,
          inventoryBefore,
          inventoryAfter,
          refusedStale,
          retained,
          before,
          during,
          after,
          text,
          afterText,
          proposal,
          moved,
          posed,
          authored,
          saved,
          undone: await api.mechanisms.list(),
        };
      },
      { source, physics },
    );
    expect(result.authored).toEqual([]);
    expect(result.refusedStale).toBe(true);
    expect(result.retained).toEqual(result.moved);
    expect(result.inventoryAfter).toEqual(result.inventoryBefore);
    expect(
      strFromU8(unzipSync(new Uint8Array(result.nativeAfter))["project.json"]),
    ).toBe(
      strFromU8(unzipSync(new Uint8Array(result.nativeBefore))["project.json"]),
    );
    expect(result.during).toEqual(result.before);
    expect(result.after).toEqual(result.before);
    expect(result.afterText).toEqual(result.text);
    const rig = result.proposal.rig!,
      input = rig.transmissions![0].jointA,
      output = rig.transmissions![0].jointB;
    const positions = result.moved.mechanisms![rig.id].pose.jointPositions;
    expect(positions[input]).toBeGreaterThan(90);
    expect(Math.abs(positions[output] + positions[input] / 3)).toBeLessThan(
      physics === "dynamic" ? 1 : 0.0001,
    );
    expect(result.moved.mechanisms![rig.id].mode).toBe(physics);
    expect(result.posed.text).not.toEqual(
      new TextDecoder().decode(new Uint8Array(result.text.bytes)),
    );
    expect(result.saved.map((r) => r.id)).toEqual([rig.id]);
    expect(result.undone).toEqual([]);
  });

for (const [width, height] of [
  [1440, 1000],
  [1080, 1800],
  [360, 600],
  [411, 685],
  [390, 844],
  [686, 411],
])
  test(`review and try a mechanism at ${width}×${height}`, async ({
    browser,
    baseURL,
  }, testInfo) => {
    const context = await browser.newContext({
      viewport: { width, height },
      hasTouch: width !== 1440,
    });
    const page = await context.newPage();
    await refusePointerLock(page);
    try {
      await page.goto(`${baseURL}/?automation=1`);
      await page.waitForFunction(() => !!window.brickEditor);
      const before = await page.evaluate(async (source) => {
        const api = window.brickEditor!;
        await api.project.import({
          format: "ldraw",
          name: "proposal.mpd",
          text: source,
        });
        await api.ready({ strict: true });
        return api.query();
      }, source);
      await openMenuTab(page, "Play", "Mechanisms");
      await expect(
        page.getByRole("button", { name: "Enter Play", exact: true }),
      ).toBeVisible();
      await page
        .getByRole("button", { name: "Set up a mechanism", exact: true })
        .click();
      await expect(
        page.getByRole("button", { name: "Enter Play", exact: true }),
      ).toHaveCount(0);
      await expect(
        page.getByText("Preview authored hinges and planar vehicles.", {
          exact: false,
        }),
      ).toHaveCount(0);
      await expect(
        page.getByText("Open the “Door & vehicle” template", { exact: false }),
      ).toHaveCount(0);
      // <section> carries its accessible label without a redundant explicit role.
      const surface = page.locator(".play-mechanism-setup");
      await expect(surface).toBeVisible();
      for (const i of [12]) {
        const checkbox = surface.getByRole("checkbox").nth(i);
        await expect(checkbox).toHaveAttribute(
          "data-occurrence-id",
          before.occurrences[i].id,
        );
        await expect(checkbox).toHaveAccessibleName(/^Plate .* · Part n\d+$/);
        await checkbox.check();
      }
      await surface
        .getByRole("button", { name: "Review connections", exact: true })
        .click();
      await expect(
        surface.getByText("2 moving groups · 2 joints · 1 linked outputs", {
          exact: true,
        }),
      ).toBeVisible();
      await surface
        .getByLabel("Proposal motor", { exact: true })
        .selectOption(JSON.stringify(["joint-0", before.occurrences[10].id]));
      await expect(
        surface.getByLabel("Proposal motor").locator("option").nth(1),
      ).toContainText("Motor");
      await expect(
        page.getByRole("button", { name: "Enter Play", exact: true }),
      ).toHaveCount(0);
      await surface.getByLabel("Proposal motor effort").fill("50");
      await surface
        .getByRole("button", { name: "Try in Play", exact: true })
        .scrollIntoViewIfNeeded();
      await page.screenshot({
        path: testInfo.outputPath(`proposal-review-${width}x${height}.png`),
      });
      await surface
        .getByRole("button", { name: "Try in Play", exact: true })
        .click();
      await expect(
        page.getByRole("button", { name: "Run motor 1 forward", exact: true }),
      ).toBeVisible();
      await expect(
        page.getByRole("group", { name: "Movement joystick", exact: true }),
      ).toHaveCount(0);
      const current = await page.evaluate(async () => ({
        query: await window.brickEditor!.query(),
        rigs: await window.brickEditor!.mechanisms.list(),
        view: await window.brickEditor!.play.view(),
      }));
      expect(current.query).toEqual(before);
      expect(current.rigs).toEqual([]);
      expect(current.view.mechanismOverview).toBeTruthy();
      await page.screenshot({
        path: testInfo.outputPath(`proposal-playing-${width}x${height}.png`),
      });
      const targets = await page
        .locator(".play-mechanism button:visible")
        .evaluateAll((buttons) =>
          buttons.map((b) => ({
            width: b.getBoundingClientRect().width,
            height: b.getBoundingClientRect().height,
          })),
        );
      for (const target of targets) {
        expect(target.width).toBeGreaterThanOrEqual(44);
        expect(target.height).toBeGreaterThanOrEqual(44);
      }
      await page.evaluate(() => window.brickEditor!.play.exit());
      expect(await page.evaluate(() => window.brickEditor!.query())).toEqual(
        before,
      );
      if (width === 360) {
        await expect(
          surface.getByRole("button", {
            name: "Save mechanism to build",
            exact: true,
          }),
        ).toBeEnabled();
        await expect(
          surface.getByLabel("Proposal motor", { exact: true }),
        ).toHaveValue(JSON.stringify(["joint-0", before.occurrences[10].id]));
        await surface
          .getByRole("button", { name: "Save mechanism to build", exact: true })
          .click();
        await expect(surface.getByRole("status")).toContainText(
          "Mechanism saved",
        );
        const saved = await page.evaluate(() =>
          window.brickEditor!.mechanisms.list(),
        );
        expect(saved).toHaveLength(1);
        expect(saved[0].joints[0].motor?.target).toBe(60);
      }
      await surface
        .getByRole("button", { name: "Back to Play settings", exact: true })
        .click();
      await expect(
        page.getByRole("button", { name: "Enter Play", exact: true }),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Set up a mechanism", exact: true }),
      ).toBeVisible();
    } finally {
      await context.close();
    }
  });
