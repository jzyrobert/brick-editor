import { expect, type BrowserContext, type Page } from "@playwright/test";
import { openMenuTab } from "./mode";
import { refusePointerLock } from "./pointer";

/** A fresh realm and offline network verify real parts plus all lazy Play assets. */
export async function offlinePhysicalMotion(
  page: Page,
  context: BrowserContext,
  kind: "motor-gears" | "rack-drive" | "twin-drive",
) {
  await refusePointerLock(page);
  await page.goto("./?automation=1");
  await page.waitForFunction(() => !!window.brickEditor);
  const saved = await page.evaluate(async (kind) => {
    const api = window.brickEditor!;
    await api.project.import({ format: "template", template: kind });
    await api.ready({ strict: true });
    return Array.from((await api.project.export({ format: "native" })).bytes);
  }, kind);
  await openMenuTab(page, "Project", "Settings");
  await page
    .getByRole("button", { name: "Download / check for updates", exact: true })
    .click();
  await expect(page.getByText(/Ready offline\./)).toBeVisible({
    timeout: 45000,
  });
  await expect
    .poll(() => page.evaluate(() => !!navigator.serviceWorker.controller))
    .toBe(true);
  await context.setOffline(true);
  try {
    await page.reload();
    await page.waitForFunction(() => !!window.brickEditor);
    const result = await page.evaluate(
      async ({ saved, kind }) => {
        const api = window.brickEditor!;
        // The larger sample must build its source-derived rig on its first
        // template open in a fresh offline realm, not rely on a saved rig.
        await api.project.import(
          kind === "twin-drive"
            ? { format: "template", template: kind }
            : { format: "native", bytes: saved },
        );
        await api.ready({ strict: true });
        const query = await api.query(),
          source = await api.project.export({ format: "ldraw" }),
          inventory = await api.inventory.preview({
            expectedRevision: query.revision,
            format: "bricklink-wanted-xml",
            scope: { kind: "all" },
            errorPolicy: "export-resolved",
            acceptUnknownColors: true,
            acceptDerivedMappings: true,
          });
        const rig = (await api.mechanisms.list())[0],
          joint = rig.joints.find((j) =>
            kind !== "rack-drive" ? !!j.motor : j.kind === "prismatic",
          )!;
        const legs = [];
        for (const dynamic of [false, true]) {
          await api.play.enter({
            rigIds: [rig.id],
            dynamicRigIds: dynamic ? [rig.id] : [],
            position: [300, -0.3, 300],
            realtime: false,
          });
          const rest = await api.play.snapshot();
          if (kind !== "rack-drive")
            await api.play.setMotor({
              rigId: rig.id,
              jointId: joint.id,
              enabled: true,
              input: 1,
            });
          else
            await api.play.setJointTarget({
              rigId: rig.id,
              jointId: joint.id,
              target: -60,
              speed: 40,
            });
          const moved = await api.play.stepTicks(dynamic ? 900 : 120);
          await api.play.exit();
          legs.push({ dynamic, rest, moved });
        }
        return {
          query,
          source,
          inventory,
          rig,
          joint,
          legs,
          after: {
            query: await api.query(),
            source: await api.project.export({ format: "ldraw" }),
            inventory: await api.inventory.preview({
              expectedRevision: query.revision,
              format: "bricklink-wanted-xml",
              scope: { kind: "all" },
              errorPolicy: "export-resolved",
              acceptUnknownColors: true,
              acceptDerivedMappings: true,
            }),
          },
        };
      },
      { saved, kind },
    );
    expect(result.after).toEqual({
      query: result.query,
      source: result.source,
      inventory: result.inventory,
    });
    expect(result.query.occurrences.length).toBe(
      kind === "twin-drive" ? 35 : kind === "motor-gears" ? 15 : 2,
    );
    for (const leg of result.legs) {
      const moved = leg.moved.mechanisms![result.rig.id],
        rest = leg.rest.mechanisms![result.rig.id];
      expect(leg.rest.collisionReady).toBe(true);
      expect(moved.mode).toBe(leg.dynamic ? "dynamic" : "kinematic");
      expect(
        Math.abs(
          moved.pose.jointPositions[result.joint.id] -
            rest.pose.jointPositions[result.joint.id],
        ),
      ).toBeGreaterThan(kind !== "rack-drive" ? 10 : 20);
      if (kind !== "rack-drive") {
        expect(result.joint.motor!.binding!.profile).toBe(
          "power-functions-motor-m-v1",
        );
        const transmission = result.rig.transmissions!.find(
          (t) => t.kind === "spur" && t.jointA === result.joint.id,
        );
        if (transmission?.kind !== "spur")
          throw new Error("Expected a real linked spur output");
        expect(
          Math.abs(
            moved.pose.jointPositions[transmission.jointB] +
              (moved.pose.jointPositions[result.joint.id] *
                transmission.teethA) /
                transmission.teethB,
          ),
        ).toBeLessThan(leg.dynamic ? 1 : 0.001);
      } else expect(result.rig.joints.every((j) => !j.motor)).toBe(true);
    }
  } finally {
    await context.setOffline(false);
  }
}
