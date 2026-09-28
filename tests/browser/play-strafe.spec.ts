import { expect, test, type Page } from "@playwright/test";
import { openMode } from "./helpers/mode";
async function screenRight(page: Page) {
  return page.evaluate(async () => {
    const a = window.brickEditor!,
      q = await a.query();
    const camera = (
      await a.render.image({
        revision: q.revision,
        width: 128,
        height: 128,
        format: "png",
        visibility: { mode: "all" },
        background: { type: "solid", color: "#ffffff" },
        quality: "fast",
        strict: true,
      })
    ).manifest.camera;
    const f = camera.target.map((v, i) => v - camera.position[i]),
      u = camera.up;
    const right = [
        f[1] * u[2] - f[2] * u[1],
        f[2] * u[0] - f[0] * u[2],
        f[0] * u[1] - f[1] * u[0],
      ],
      length = Math.hypot(...right);
    return right.map((v) => v / length);
  });
}
const position = (page: Page) =>
  page.evaluate(() =>
    window.brickEditor!.play.snapshot().then((s) => s.position),
  );
function sideways(before: number[], after: number[], right: number[]) {
  return after.reduce((sum, v, i) => sum + (v - before[i]) * right[i], 0);
}
async function open(page: Page) {
  await page.goto("/?automation=1");
  await page.waitForFunction(() => !!window.brickEditor);
  await page.evaluate(async () => {
    await window.brickEditor!.project.import({
      format: "template",
      template: "blank",
    });
    await window.brickEditor!.ready();
  });
  await openMode(page, "Play");
}
test("A and D strafe toward actual camera left and right in both views and movement modes", async ({
  page,
}) => {
  await open(page);
  for (const locomotion of ["walk", "fly-noclip"] as const)
    for (const cameraMode of ["first-person", "third-person"] as const)
      for (const yaw of [0, Math.PI / 2]) {
        await page.evaluate(
          async ({ locomotion, cameraMode, yaw }) => {
            await window.brickEditor!.play.enter({
              locomotion,
              cameraMode,
              yaw,
              pitch: 0.2,
              position: [0, -0.3, 0],
              realtime: false,
            });
          },
          { locomotion, cameraMode, yaw },
        );
        const right = await screenRight(page);
        for (const [key, direction] of [
          ["a", -1],
          ["d", 1],
        ] as const) {
          const before = await position(page);
          await page.keyboard.down(key);
          await page.evaluate(() => window.brickEditor!.play.stepTicks(6));
          await page.keyboard.up(key);
          expect(
            sideways(before, await position(page), right) * direction,
          ).toBeGreaterThan(9);
        }
      }
});
for (const viewport of [
  { width: 360, height: 800 },
  { width: 1080, height: 1800 },
])
  test(`touch joystick left/right agrees with camera at ${viewport.width}px`, async ({
    browser,
    baseURL,
  }) => {
    const context = await browser.newContext({
        viewport,
        hasTouch: true,
        baseURL,
      }),
      page = await context.newPage();
    try {
      await open(page);
      const client = await context.newCDPSession(page);
      for (const cameraMode of ["first-person", "third-person"] as const) {
        await page.evaluate(async (cameraMode) => {
          await window.brickEditor!.play.enter({
            locomotion: "fly-noclip",
            cameraMode,
            yaw: 0.7,
            pitch: 0.2,
            position: [0, -80, 0],
            realtime: false,
          });
        }, cameraMode);
        const right = await screenRight(page),
          stick = (await page
            .getByRole("group", { name: "Movement joystick", exact: true })
            .boundingBox())!;
        for (const direction of [-1, 1]) {
          const before = await position(page);
          await client.send("Input.dispatchTouchEvent", {
            type: "touchStart",
            touchPoints: [
              {
                id: 1,
                x: stick.x + stick.width / 2 + direction * stick.width * 0.4,
                y: stick.y + stick.height / 2,
              },
            ],
          });
          await page.evaluate(() => window.brickEditor!.play.stepTicks(6));
          await client.send("Input.dispatchTouchEvent", {
            type: "touchEnd",
            touchPoints: [],
          });
          expect(
            sideways(before, await position(page), right) * direction,
          ).toBeGreaterThan(9);
        }
      }
    } finally {
      await context.close();
    }
  });
