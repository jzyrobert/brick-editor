import { expect, test, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// Measures fixed-tick cost and realtime frame time of Play with no rigs,
// kinematic rigs and dynamic rigs (physics playground), and with automatic
// doors (door room), on the desktop profile and on a phone context (mobile
// resource profile, 4x CPU throttling). Numbers go to .local/perf/.
const out = fileURLToPath(new URL("../../.local/perf/", import.meta.url));
mkdirSync(out, { recursive: true });
type Mode = "static" | "kinematic" | "dynamic" | "doors";
async function measure(page: Page, mode: Mode) {
  return page.evaluate(async (mode) => {
    const api = window.brickEditor!;
    const rigs = ["crate", "door", "spinner", "vehicle"];
    const request =
      mode === "doors"
        ? { position: [10, -0.3, 150] as [number, number, number] }
        : {
            position: [300, -0.3, 300] as [number, number, number],
            autoDoors: false,
            ...(mode === "static" ? {} : { rigIds: rigs }),
            ...(mode === "dynamic" ? { dynamicRigIds: rigs } : {}),
          };
    const entry = performance.now();
    await api.play.enter({ ...request, realtime: false });
    const enterMs = performance.now() - entry;
    if (mode !== "static" && mode !== "doors")
      await api.play.setMechanismVehicleInput(
        { throttle: 1, steering: 0.4 },
        "vehicle",
      );
    if (mode === "doors")
      await api.play.setJointTarget({
        rigId: "auto-door:0",
        jointId: "door",
        target: 90,
        speed: 90,
      });
    await api.play.setInput({ moveZ: 1 });
    const ticks: number[] = [];
    for (let i = 0; i < 20; i++) {
      const t = performance.now();
      await api.play.stepTicks(15);
      ticks.push((performance.now() - t) / 15);
    }
    await api.play.exit();
    // Realtime: the UI loop with catch-up, redrawing only on change.
    await api.play.enter({ ...request, realtime: true });
    await api.play.setInput({ moveZ: 1 });
    const frames: number[] = [];
    let last = performance.now();
    await new Promise<void>((done) => {
      const frame = (now: number) => {
        frames.push(now - last);
        last = now;
        if (frames.length < 90) requestAnimationFrame(frame);
        else done();
      };
      requestAnimationFrame(frame);
    });
    await api.play.exit();
    const sorted = (a: number[]) => [...a].sort((x, y) => x - y);
    const p = (a: number[], q: number) =>
      sorted(a)[Math.floor((a.length - 1) * q)];
    const mean = (a: number[]) => a.reduce((s, v) => s + v, 0) / a.length;
    const settled = frames.slice(10);
    return {
      mode,
      enterMs: Math.round(enterMs),
      tickMeanMs: +mean(ticks).toFixed(3),
      tickP95Ms: +p(ticks, 0.95).toFixed(3),
      frameMeanMs: +mean(settled).toFixed(2),
      frameP95Ms: +p(settled, 0.95).toFixed(2),
    };
  }, mode);
}
for (const device of ["desktop", "phone"] as const)
  test(`Play physics cost on the ${device} profile`, async ({
    browser,
    baseURL,
  }) => {
    test.setTimeout(300000);
    const phone = device === "phone";
    const context = await browser.newContext({
      viewport: phone
        ? { width: 360, height: 800 }
        : { width: 1440, height: 1000 },
      deviceScaleFactor: phone ? 3 : 1,
      isMobile: phone,
      hasTouch: phone,
      baseURL,
    });
    const page = await context.newPage();
    if (phone) {
      const cdp = await context.newCDPSession(page);
      await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
    }
    await page.goto("/?automation=1");
    await page.waitForFunction(() => !!window.brickEditor);
    const profile = await page.evaluate(async () => {
      await window.brickEditor!.ready();
      return (await window.brickEditor!.resources.status()).profile;
    });
    expect(profile).toBe(phone ? "mobile" : "desktop");
    const results = [];
    await page.evaluate(async () => {
      await window.brickEditor!.project.import({
        format: "template",
        template: "physics",
      });
      await window.brickEditor!.ready();
    });
    for (const mode of ["static", "kinematic", "dynamic"] as const)
      results.push(await measure(page, mode));
    await page.evaluate(async () => {
      await window.brickEditor!.project.import({
        format: "template",
        template: "door-room",
      });
      await window.brickEditor!.ready();
    });
    results.push(await measure(page, "doors"));
    writeFileSync(
      `${out}play-physics-${device}.json`,
      JSON.stringify(
        { device, profile, cpuThrottle: phone ? 4 : 1, results },
        null,
        2,
      ),
    );
    console.log(device, JSON.stringify(results));
    // Budget: a dynamic tick stays well inside the 10 ms per-frame tick budget.
    const dynamic = results.find((r) => r.mode === "dynamic")!;
    expect(dynamic.tickMeanMs).toBeLessThan(phone ? 10 : 4);
    await context.close();
  });
