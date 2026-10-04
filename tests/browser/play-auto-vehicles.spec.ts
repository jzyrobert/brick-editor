import { expect, test } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { refusePointerLock } from "./helpers/pointer";

// Original CC0 sample sources, imported as plain LDraw without authored rigs.
const sources = JSON.parse(
  execFileSync(
    process.execPath,
    [
      "node_modules/tsx/dist/cli.mjs",
      "--eval",
      `
 import {carSource} from './src/catalog/builds/car';
 import {jeepSource} from './src/catalog/builds/jeep';
 process.stdout.write(JSON.stringify({car:carSource(),jeep:jeepSource()}));
`,
    ],
    { encoding: "utf8", maxBuffer: 1024 * 1024 },
  ),
) as Record<"car" | "jeep" | "fleet", string>;

sources.fleet = `0 FILE fleet.ldr\n1 16 -180 0 0 1 0 0 0 1 0 0 0 1 roadster.mpd\n1 16 180 0 0 1 0 0 0 1 0 0 0 1 roadster.mpd\n${sources.car}`;

for (const [name, width, height] of [
  ["car", 1440, 1000],
  ["car", 360, 600],
  ["jeep", 1440, 1000],
  ["fleet", 1440, 1000],
] as const)
  test(`plain imported ${name} drives without a motor and preserves source ${width}×${height}`, async ({
    browser,
    baseURL,
  }) => {
    const context = await browser.newContext({
        viewport: { width, height },
        hasTouch: width === 360,
        isMobile: width === 360,
      }),
      page = await context.newPage();
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await refusePointerLock(page);
    try {
      await page.goto(`${baseURL}/?automation=1`);
      await page.waitForFunction(() => !!window.brickEditor);
      const result = await page.evaluate(async (text) => {
        const a = window.brickEditor!;
        await a.project.import({ format: "ldraw", text });
        await a.ready({ strict: true });
        const authored = async () => {
          const q = await a.query();
          return {
            revision: q.revision,
            occurrences: q.occurrences,
            source: Array.from(
              (await a.project.export({ format: "ldraw" })).bytes,
            ),
            inventory: await a.inventory.preview({
              expectedRevision: q.revision,
              scope: { kind: "all" },
              format: "bricklink-wanted-xml",
              acceptDerivedMappings: true,
              acceptUnknownColors: true,
              errorPolicy: "export-resolved",
            }),
          };
        };
        const original = await authored(),
          declared = await a.mechanisms.list(),
          entered = await a.play.enter({
            position: [400, -0.3, 0],
            realtime: false,
            cameraMode: "third-person",
          });
        const ids = Object.keys(entered.mechanisms ?? {}).filter((id) =>
          id.startsWith("auto-vehicle:"),
        );
        if (ids.length !== (text.startsWith("0 FILE fleet.ldr") ? 2 : 1))
          throw new Error(
            `Expected separated source-derived vehicles, got ${ids.join(", ")}`,
          );
        const id = ids[0];
        await a.play.setMechanismVehicleInput({ throttle: 1, steering: 0 }, id);
        const straight = await a.play.stepTicks(60);
        await a.play.setMechanismVehicleInput({ throttle: 1, steering: 1 }, id);
        const turned = await a.play.stepTicks(45);
        const posed = await a.play.exportPosedModel();
        await a.play.setMechanismVehicleInput({ throttle: 0, steering: 0 }, id);
        await a.play.exit();
        return {
          original,
          after: await authored(),
          declared,
          id,
          entered: entered.mechanisms![id],
          straight: straight.mechanisms![id],
          turned: turned.mechanisms![id],
          posed,
          declaredAfter: await a.mechanisms.list(),
          otherAtRest: ids
            .slice(1)
            .every(
              (other) =>
                JSON.stringify(straight.mechanisms![other].groupFrames) ===
                JSON.stringify(entered.mechanisms![other].groupFrames),
            ),
        };
      }, sources[name]);
      expect(result.declared).toEqual([]);
      expect(result.otherAtRest).toBe(true);
      expect(result.declaredAfter).toEqual([]);
      expect(result.entered.pose.vehicle).toBeDefined();
      expect(Object.keys(result.entered.groupFrames)).toHaveLength(5);
      expect(result.straight.pose.vehicle!.position[2]).toBeLessThan(-100);
      expect(result.straight.vehicleCollision?.status).toBe("ready");
      expect(
        Math.max(...Object.values(result.straight.pose.vehicle!.wheelAngles)),
      ).toBeGreaterThan(180);
      expect(
        Math.abs(result.turned.pose.vehicle!.headingDegrees),
      ).toBeGreaterThan(15);
      expect(result.posed.rigIds).toContain(result.id);
      expect(result.posed.posedOccurrenceIds.length).toBe(
        result.original.occurrences.length,
      );
      expect(result.after).toEqual(result.original);
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });
