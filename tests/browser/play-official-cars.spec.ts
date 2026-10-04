import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { rotationY } from "../../src/core/math";
import { playSourceState } from "./helpers/play-source-state";
import { refusePointerLock } from "./helpers/pointer";

// Attributed, unchanged car assembly excerpts; originals and source hashes are
// recorded in fixtures/play/official-cars/NOTICE.md. No live OMR access in tests.
const models = ["6503", "31027", "30572"] as const;
for (const number of models)
  for (const width of [1440, 360])
    test(`official ${number} car drives, steers, stops and reverses at ${width}px`, async ({
      browser,
      baseURL,
    }) => {
      test.setTimeout(180000);
      const context = await browser.newContext({
          viewport: { width, height: width === 360 ? 600 : 1000 },
          hasTouch: width === 360,
          isMobile: width === 360,
        }),
        page = await context.newPage(),
        errors: string[] = [];
      const source = readFileSync(
        `fixtures/play/official-cars/${number}-car.mpd`,
        "utf8",
      );
      const yaw = number === "30572" ? 37 : 0,
        root = /^0 FILE (.+)$/m.exec(source)![1].trim(),
        imported = yaw
          ? `0 FILE rotated-official-car.ldr\n1 16 0 0 0 ${rotationY(yaw).join(" ")} ${root}\n${source}`
          : source;
      page.on("pageerror", (e) => errors.push(e.message));
      await page.route("**/api/omr/*", (route) =>
        route.fulfill({
          status: 200,
          contentType: "text/plain",
          body: imported,
        }),
      );
      await page.route("**/library.ldraw.org/**", (route) => route.abort());
      await refusePointerLock(page);
      try {
        await page.goto(`${baseURL}/?automation=1`);
        await page.waitForFunction(() => !!window.brickEditor);
        await page.evaluate(async (number) => {
          const api = window.brickEditor!;
          await api.project.import({
            format: "ldraw",
            text: await (await fetch(`/api/omr/${number}-1.mpd`)).text(),
          });
          await api.ready({ strict: true });
        }, number);
        const original = await playSourceState(page);
        const result = await page.evaluate(async () => {
          const api = window.brickEditor!;
          const declared = await api.mechanisms.list(),
            entered = await api.play.enter({
              position: [400, -0.3, 0],
              realtime: false,
              cameraMode: "third-person",
            });
          const ids = Object.keys(entered.mechanisms ?? {}).filter((id) =>
            id.startsWith("auto-vehicle:"),
          );
          if (ids.length !== 1)
            throw new Error(
              `Expected one real source vehicle; got ${ids.join(", ")}`,
            );
          const id = ids[0];
          await api.play.setMechanismVehicleInput(
            { throttle: 1, steering: 0 },
            id,
          );
          const forward = await api.play.stepTicks(45);
          await api.play.setMechanismVehicleInput(
            { throttle: 0, steering: 0 },
            id,
          );
          const stopped = await api.play.stepTicks(30);
          await api.play.setMechanismVehicleInput(
            { throttle: -1, steering: 0 },
            id,
          );
          const reverse = await api.play.stepTicks(20);
          await api.play.setMechanismVehicleInput(
            { throttle: 1, steering: 1 },
            id,
          );
          const turned = await api.play.stepTicks(30),
            posed = await api.play.exportPosedModel();
          await api.play.setMechanismVehicleInput(
            { throttle: 0, steering: 0 },
            id,
          );
          await api.play.exit();
          return {
            declared,
            entered: entered.mechanisms![id],
            forward: forward.mechanisms![id],
            stopped: stopped.mechanisms![id],
            reverse: reverse.mechanisms![id],
            turned: turned.mechanisms![id],
            posed,
            id,
          };
        });
        expect(result.declared).toEqual([]);
        expect(result.forward.vehicleCollision?.status).toBe("ready");
        const basis = result.entered.groupFrames.chassis.basis,
          forwardAxis = [-basis[2], 0, -basis[8]],
          distanceAlong = (a: number[], b: number[]) =>
            a.reduce((sum, v, k) => sum + (v - b[k]) * forwardAxis[k], 0);
        expect(
          distanceAlong(
            result.forward.pose.vehicle!.position,
            result.entered.pose.vehicle!.position,
          ),
        ).toBeGreaterThan(100);
        expect(result.stopped.pose.vehicle).toEqual(
          result.forward.pose.vehicle,
        );
        expect(
          distanceAlong(
            result.reverse.pose.vehicle!.position,
            result.stopped.pose.vehicle!.position,
          ),
        ).toBeLessThan(-40);
        expect(
          Math.abs(result.turned.pose.vehicle!.headingDegrees),
        ).toBeGreaterThan(20);
        expect(result.posed.rigIds).toContain(result.id);
        expect(result.posed.posedOccurrenceIds).toHaveLength(
          original.query.occurrences.length,
        );
        expect(await playSourceState(page)).toEqual(original);
        expect(errors).toEqual([]);
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
      } finally {
        await context.close();
      }
    });

test("an imported source car stops at foreign scenery without claiming it", async ({
  page,
}) => {
  test.setTimeout(180000);
  const car = readFileSync("fixtures/play/official-cars/31027-car.mpd", "utf8"),
    root = /^0 FILE (.+)$/m.exec(car)![1].trim(),
    source = `0 FILE road-and-blocker.ldr\n1 16 0 0 0 1 0 0 0 1 0 0 0 1 ${root}\n1 4 0 0 -230 1 0 0 0 1 0 0 0 1 3001.dat\n${car}`;
  await refusePointerLock(page);
  await page.route("**/api/omr/*", (route) =>
    route.fulfill({ status: 200, contentType: "text/plain", body: source }),
  );
  await page.route("**/library.ldraw.org/**", (route) => route.abort());
  await page.goto("/?automation=1");
  await page.waitForFunction(() => !!window.brickEditor);
  await page.evaluate(async () => {
    const api = window.brickEditor!;
    await api.project.import({
      format: "ldraw",
      text: await (await fetch("/api/omr/31027-1.mpd")).text(),
    });
    await api.ready({ strict: true });
  });
  const original = await playSourceState(page),
    result = await page.evaluate(async () => {
      const api = window.brickEditor!,
        entered = await api.play.enter({
          position: [400, -0.3, 0],
          realtime: false,
        }),
        ids = Object.keys(entered.mechanisms ?? {}).filter((id) =>
          id.startsWith("auto-vehicle:"),
        );
      if (ids.length !== 1) throw new Error("Expected exactly one source car");
      await api.play.setMechanismVehicleInput(
        { throttle: 1, steering: 0 },
        ids[0],
      );
      const moved = await api.play.stepTicks(90),
        posed = await api.play.exportPosedModel();
      await api.play.exit();
      return { moved: moved.mechanisms![ids[0]], posed };
    });
  expect(result.moved.vehicleCollision?.status).toBe("blocked");
  expect(result.moved.vehicleCollision?.reason).toMatch(/world|intersect/i);
  expect(result.moved.pose.vehicle!.position[2]).toBeLessThan(-20);
  expect(result.moved.pose.vehicle!.position[2]).toBeGreaterThan(-180);
  expect(result.posed.posedOccurrenceIds).toHaveLength(59);
  expect(original.query.occurrences).toHaveLength(60);
  expect(await playSourceState(page)).toEqual(original);
});
