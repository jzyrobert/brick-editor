import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import type { MotionRig } from "../../src/mechanisms/types";
const fixture = readFileSync(
  new URL("../../fixtures/ldraw/moving-platform.mpd", import.meta.url),
  "utf8",
);
import { openMode } from "./helpers/mode";
import { refusePointerLock } from "./helpers/pointer";

for (const dynamic of [false, true])
  for (const kind of ["lift", "turntable"] as const)
    test(`rendered ${dynamic ? "dynamic" : "kinematic"} ${kind} carries and releases its explorer`, async ({
      page,
    }) => {
      await refusePointerLock(page);
      await page.goto("/?automation=1");
      await page.waitForFunction(() => !!window.brickEditor);
      const rig: MotionRig = {
        schemaVersion: 1,
        id: "platform",
        name: kind === "lift" ? "Moving lift" : "Turning platform",
        mode: "kinematic",
        groups: [],
        dynamics: { groups: { deck: { massKg: 20 } } },
        joints: [
          {
            id: "motion",
            kind: kind === "lift" ? "prismatic" : "revolute",
            bodyA: "post",
            bodyB: "deck",
            anchorA: [0, -24, 0],
            anchorB: [0, 0, 0],
            axisA: [0, -1, 0],
            axisB: [0, -1, 0],
            ...(kind === "lift"
              ? { limits: [0, 200] as [number, number] }
              : {}),
            motor: {
              mode: "velocity",
              target: kind === "lift" ? 30 : 45,
              maxEffort: { value: 10000, unit: kind === "lift" ? "N" : "N*m" },
            },
          },
        ],
      };
      const original = await page.evaluate(
        async ({ text, rig }) => {
          const api = window.brickEditor!;
          await api.project.import({
            format: "ldraw",
            name: "platforms.mpd",
            text,
          });
          await api.ready({ strict: true });
          const q = await api.query();
          rig.groups = q.occurrences.slice(0, 2).map((o, i) => ({
            id: i ? "deck" : "post",
            occurrenceIds: [o.id],
            frame: o.transform,
            restTransforms: { [o.id]: o.transform },
          }));
          await api.dispatch({
            schemaVersion: 1,
            commandId: "platform-rig",
            expectedRevision: q.revision,
            type: "rigs.upsert",
            payload: { rig },
          });
          return api.query();
        },
        { text: fixture, rig },
      );
      await openMode(page, "Play");
      await page.evaluate(async (dynamic) => {
        const play = window.brickEditor!.play;
        await play.enter({
          rigId: "platform",
          ...(dynamic ? { dynamicRigIds: ["platform"] } : {}),
          position: [80, -28.3, 0],
          cameraMode: "third-person",
          realtime: false,
        });
        await play.setMotor({
          rigId: "platform",
          jointId: "motion",
          enabled: true,
          input: 0,
        });
        await play.stepTicks(10);
      }, dynamic);
      const before = await page.evaluate(() =>
        window.brickEditor!.play.snapshot(),
      );
      const carried = await page.evaluate(async () => {
        const play = window.brickEditor!.play;
        await play.setMotor({
          rigId: "platform",
          jointId: "motion",
          enabled: true,
          input: 1,
        });
        return play.stepTicks(120);
      });
      expect(carried.grounded).toBe(true);
      expect(
        Math.hypot(...carried.position.map((v, i) => v - before.position[i])),
      ).toBeGreaterThan(20);
      const image = await page.locator("canvas").first().screenshot();
      expect(image.length).toBeGreaterThan(10000);
      await page.screenshot({
        path: test.info().outputPath(`${kind}-${dynamic}.png`),
      });
      const jump = await page.evaluate(async () => {
        await window.brickEditor!.play.setInput({ jump: true });
        return window.brickEditor!.play.stepTicks(1);
      });
      expect(jump.grounded).toBe(false);
      expect(jump.velocity[1]).toBeLessThan(-100);
      await page.evaluate(() => window.brickEditor!.play.exit());
      expect(await page.evaluate(() => window.brickEditor!.query())).toEqual(
        original,
      );
    });
for (const width of [1440, 360])
  test(`seated native jeep driving and safe exit ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: width === 360 ? 600 : 1000 });
    await refusePointerLock(page);
    await page.goto("/?automation=1");
    await page.waitForFunction(() => !!window.brickEditor);
    const original = await page.evaluate(async () => {
      const api = window.brickEditor!;
      await api.project.import({ format: "template", template: "jeep" });
      await api.ready({ strict: true });
      return api.query();
    });
    await openMode(page, "Play");
    await page.evaluate(async () => {
      const play = window.brickEditor!.play;
      await play.enter({
        rigId: "jeep",
        dynamicRigIds: ["jeep"],
        position: [-110, -0.3, -20],
        yaw: Math.PI / 2,
        cameraMode: "third-person",
        realtime: false,
      });
      await play.stepTicks(60);
    });
    const entry = await page.evaluate(async () =>
      window.brickEditor!.play.enterVehicle({
        rigId: "jeep",
        seatId: "driver",
      }),
    );
    expect(entry.avatar.state).toBe("seated");
    await expect(
      page.getByRole("button", { name: "Get out", exact: true }),
    ).toBeVisible();
    const driven = await page.evaluate(async () => {
      await window.brickEditor!.play.setInput({ moveZ: 1, moveX: -0.3 });
      return window.brickEditor!.play.stepTicks(120);
    });
    expect(driven.occupancy).toBeDefined();
    expect(driven.avatar.basis).toBeDefined();
    expect(
      Math.hypot(...driven.position.map((v, i) => v - entry.position[i])),
    ).toBeGreaterThan(50);
    await page.screenshot({
      path: test.info().outputPath(`dynamic-jeep-${width}.png`),
    });
    await page.evaluate(async () => {
      await window.brickEditor!.play.setInput({});
      await window.brickEditor!.play.stepTicks(240);
    });
    const exited = await page.evaluate(() =>
      window.brickEditor!.play.exitVehicle(),
    );
    expect(exited.occupancy).toBeUndefined();
    expect(Math.abs(exited.position[1])).toBeLessThan(1);
    await page.evaluate(() => window.brickEditor!.play.exit());
    expect(await page.evaluate(() => window.brickEditor!.query())).toEqual(
      original,
    );
  });
