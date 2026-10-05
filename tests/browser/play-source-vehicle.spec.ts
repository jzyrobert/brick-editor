import { existsSync, readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { refusePointerLock } from "./helpers/pointer";

// One-body source car (docs/reviews/EFFICIENT-VEHICLE-AND-SYSTEMS-PHYSICS.md).
// The committed 84-part attached 5540 excerpt always runs; the whole private
// OMR car runs only where a maintainer keeps it in gitignored .local/.
const models = [
  {
    name: "attached 5540 excerpt",
    file: "fixtures/play/official-cars/5540-attached-graph.ldr",
  },
  { name: "whole 5540 (private)", file: ".local/5540-1.mpd" },
];
const sizes = [
  { label: "desktop", width: 1440, height: 1000, mobile: false },
  { label: "phone", width: 390, height: 844, mobile: true },
];
for (const model of models)
  for (const size of sizes)
    test(`${model.name} drives as one dynamic body with drawn steering on ${size.label}`, async ({
      browser,
      baseURL,
    }) => {
      test.skip(!existsSync(model.file), "private source not present");
      test.setTimeout(300000);
      const context = await browser.newContext({
          viewport: { width: size.width, height: size.height },
          hasTouch: size.mobile,
          isMobile: size.mobile,
        }),
        page = await context.newPage(),
        errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.route("**/library.ldraw.org/**", (route) => route.abort());
      await refusePointerLock(page);
      const text = readFileSync(model.file, "utf8");
      try {
        await page.goto(`${baseURL}/?automation=1`);
        await page.waitForFunction(() => !!window.brickEditor);
        await page.evaluate(async (text) => {
          const api = window.brickEditor!;
          await api.project.import({ format: "ldraw", text });
          await api.ready({ strict: true });
        }, text);
        const result = await page.evaluate(async () => {
          const api = window.brickEditor!;
          const started = performance.now();
          const entered = await api.play.enter({
            position: [600, -0.3, 600],
            realtime: false,
            cameraMode: "third-person",
          });
          const entryMs = performance.now() - started;
          const id = Object.keys(entered.mechanisms ?? {}).find((k) =>
            k.startsWith("auto-vehicle:"),
          )!;
          await api.play.stepTicks(30);
          const rest = (await api.play.snapshot()).mechanisms![id];
          await api.play.setMechanismVehicleInput(
            { throttle: 1, steering: 0 },
            id,
          );
          let t = performance.now();
          const straight = (await api.play.stepTicks(120)).mechanisms![id];
          const driveMs = (performance.now() - t) / 120;
          await api.play.setMechanismVehicleInput(
            { throttle: 1, steering: 1 },
            id,
          );
          t = performance.now();
          const turned = (await api.play.stepTicks(60)).mechanisms![id];
          const turnMs = (performance.now() - t) / 60;
          await api.play.setMechanismVehicleInput(
            { throttle: 0, steering: 0.6 },
            id,
          );
          await api.play.stepTicks(2);
          return { id, entryMs, driveMs, turnMs, rest, straight, turned };
        });
        // A look at the drawn steering: arms, wheels, link and riding parts.
        await page.waitForTimeout(500);
        await page.screenshot({
          path: test.info().outputPath(`steering-${size.label}.png`),
        });
        await page.evaluate(() => window.brickEditor!.play.exit());
        console.log(
          `[measure] ${model.name} ${size.label}: entry ${result.entryMs.toFixed(0)} ms, ${result.driveMs.toFixed(2)} ms/tick straight, ${result.turnMs.toFixed(2)} ms/tick turning (SwiftShader Chromium, shared VM)`,
        );
        expect(result.rest.mode).toBe("dynamic");
        expect(
          result.rest.pose.vehicle!.position[2] -
            result.straight.pose.vehicle!.position[2],
        ).toBeGreaterThan(150);
        expect(
          Math.abs(result.turned.pose.vehicle!.headingDegrees),
        ).toBeGreaterThan(3);
        expect(result.rest.warnings.join(" ")).toContain("moves as one piece");
        expect(errors).toEqual([]);
      } finally {
        await context.close();
      }
    });
