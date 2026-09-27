import { expect, test } from "@playwright/test";

test("repeated real context loss preserves edits, backups and restored capture", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/?automation=1");
  await page.waitForFunction(() => !!window.brickEditor);
  const result = await page.evaluate(async () => {
    const api = window.brickEditor!;
    await api.ready();
    const canvas = document.querySelector<HTMLCanvasElement>(
      'canvas[aria-label="3D build viewport"]',
    )!;
    const gl = canvas.getContext("webgl2")!;
    const extension = gl.getExtension("WEBGL_lose_context")!;
    if (!extension) throw new Error("Real context-loss extension unavailable");
    const capture = async () => {
      const q = await api.query();
      const image = await api.render.image({
        revision: q.revision,
        width: 240,
        height: 180,
        format: "png",
        visibility: { mode: "all" },
        background: { type: "solid", color: "#ffffff" },
        quality: "balanced",
        strict: true,
      });
      return Array.from(new Uint8Array(await image.blob.arrayBuffer()));
    };
    const cycles = [];
    for (let i = 0; i < 3; i++) {
      const before = await api.query();
      const lost = new Promise<void>((resolve) =>
        canvas.addEventListener("webglcontextlost", () => resolve(), {
          once: true,
        }),
      );
      extension.loseContext();
      await lost;
      let code = "";
      try {
        await api.ready();
      } catch (e) {
        code = (e as { code: string }).code;
      }
      await api.dispatch({
        schemaVersion: 1,
        commandId: crypto.randomUUID(),
        expectedRevision: before.revision,
        type: "project.rename",
        payload: { title: "Recovered draft " + i },
      });
      const draft = await api.query();
      const backup = await api.project.export({ format: "native" });
      const restored = new Promise<void>((resolve) =>
        canvas.addEventListener("webglcontextrestored", () => resolve(), {
          once: true,
        }),
      );
      // Let the browser finish dispatching the loss event before restoring.
      await new Promise((resolve) => setTimeout(resolve, 0));
      extension.restoreContext();
      await restored;
      await api.ready({ minRevision: draft.revision, strict: true });
      const after = await api.query();
      const png = await capture();
      cycles.push({
        code,
        backup: backup.bytes.length,
        same: JSON.stringify(draft) === JSON.stringify(after),
        png,
      });
    }
    return cycles;
  });
  expect(result).toHaveLength(3);
  for (const cycle of result) {
    expect(cycle.code).toBe("WEBGL_UNAVAILABLE");
    expect(cycle.backup).toBeGreaterThan(100);
    expect(cycle.same).toBe(true);
    expect(cycle.png.length).toBeGreaterThan(1000);
    expect(cycle.png).toEqual(result[0].png);
  }
  expect(errors).toEqual([]);
});

test("context loss interrupts a pending shader capture instead of returning an empty image", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const state = { hold: false, checks: 0 };
    Object.assign(window, { shaderTest: state });
    const getExtension = WebGL2RenderingContext.prototype.getExtension;
    WebGL2RenderingContext.prototype.getExtension = function (
      this: WebGL2RenderingContext,
      name: string,
    ) {
      const actual = Reflect.apply(getExtension, this, [name]);
      // Deterministic delayed-completion fault injection, including software
      // drivers which normally compile synchronously without KHR support.
      return name === "KHR_parallel_shader_compile"
        ? (actual ?? { COMPLETION_STATUS_KHR: 0x91b1 })
        : actual;
    } as typeof getExtension;
    const original = WebGL2RenderingContext.prototype.getProgramParameter;
    WebGL2RenderingContext.prototype.getProgramParameter = function (
      program,
      parameter,
    ) {
      if (parameter === 0x91b1) {
        if (state.hold) state.checks++;
        return !state.hold;
      }
      return original.call(this, program, parameter);
    };
  });
  await page.goto("/?automation=1");
  await page.waitForFunction(() => !!window.brickEditor);
  await page.evaluate(async () => {
    const api = window.brickEditor!;
    await api.ready();
    const state = (window as any).shaderTest;
    state.hold = true;
    const q = await api.query();
    (window as any).pendingCapture = api.render
      .image({
        revision: q.revision,
        width: 240,
        height: 180,
        format: "png",
        visibility: { mode: "all" },
        background: { type: "solid", color: "#ffffff" },
        quality: "photo",
        strict: true,
      })
      .then(
        () => "unexpected-success",
        (e: { code: string }) => e.code,
      );
  });
  await page.waitForFunction(() => (window as any).shaderTest.checks > 0);
  const code = await page.evaluate(async () => {
    const canvas = document.querySelector<HTMLCanvasElement>(
      'canvas[aria-label="3D build viewport"]',
    )!;
    const gl = canvas.getContext("webgl2")!;
    const extension = gl.getExtension("WEBGL_lose_context")!;
    const lost = new Promise<void>((resolve) =>
      canvas.addEventListener("webglcontextlost", () => resolve(), {
        once: true,
      }),
    );
    extension.loseContext();
    await lost;
    const code = await (window as any).pendingCapture;
    const stoppedChecks = (window as any).shaderTest.checks;
    await new Promise((resolve) => setTimeout(resolve, 50));
    if ((window as any).shaderTest.checks !== stoppedChecks)
      throw new Error("Shader polling continued after graphics interruption");
    (window as any).shaderTest.hold = false;
    const restored = new Promise<void>((resolve) =>
      canvas.addEventListener("webglcontextrestored", () => resolve(), {
        once: true,
      }),
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
    extension.restoreContext();
    await restored;
    await window.brickEditor!.ready();
    return code;
  });
  expect(code).toBe("WEBGL_UNAVAILABLE");
});
