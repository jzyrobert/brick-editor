import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { PDFDocument, PDFDict, PDFName } from "pdf-lib";
import type { CameraSpec, InstructionPlan } from "../../src/core/types";
import { OrthographicCamera, Vector3 } from "three";
import { instructionDisplayState } from "../../src/instructions/programme";
import { openMode, openMenuTab } from "./helpers/mode";
test("static source workbench keeps seam receivers local and scene placement separate", async ({
  page,
}) => {
  const text = await readFile(
    new URL("../../fixtures/instructions/omr/6361-1.mpd", import.meta.url),
    "utf8",
  );
  await page.goto("/?automation=1");
  await page.waitForFunction(() => !!window.brickEditor);
  await page.evaluate(async (text) => {
    await window.brickEditor!.project.import({ format: "ldraw", text });
    await window.brickEditor!.ready({ strict: true });
  }, text);
  await openMode(page, "Instructions");
  await page
    .getByRole("button", { name: "Make steps automatically", exact: true })
    .click();
  await expect(
    page.getByText("Generated plan review", { exact: true }),
  ).toBeVisible({ timeout: 60000 });
  const download = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Download plan JSON", exact: true })
    .click();
  const plan = JSON.parse(
    await readFile((await (await download).path())!, "utf8"),
  ) as InstructionPlan;
  const [key, container] = Object.entries(plan.modules!).find(([, m]) =>
    m.name.includes("container"),
  )!;
  expect(container.occurrenceIds).toHaveLength(23);
  expect(container.placement).toBe("scene");
  const first = plan.stepMetadata!.findIndex(
      (m) => m.assembly?.type === "build" && m.assembly.moduleId === key,
    ),
    sticker = plan.stepMetadata!.findIndex((m) =>
      m.notes?.includes("footprint crosses their seam"),
    ),
    join = plan.stepMetadata!.findIndex(
      (m) => m.assembly?.type === "join" && m.assembly.moduleId === key,
    ),
    detail = plan.stepMetadata![sticker].alternateDetailIds!;
  expect(detail).toHaveLength(2);
  expect(
    detail.every((id) => plan.steps.slice(0, sticker).flat().includes(id)),
  ).toBe(true);
  expect(plan.steps[join]).toEqual([]);
  const visible = async () =>
    page.evaluate(async () => {
      await window.brickEditor!.ready();
      await new Promise<void>((r) =>
        requestAnimationFrame(() => requestAnimationFrame(() => r())),
      );
      const scene = window.__brickScene as unknown as {
        handles: Map<string, { visible: boolean }>;
      };
      return [...scene.handles]
        .filter(([, h]) => h.visible)
        .map(([id]) => id)
        .sort();
    });
  await page
    .getByRole("button", { name: "Build it step by step", exact: true })
    .click();
  for (const size of [
    { width: 360, height: 600 },
    { width: 686, height: 411 },
  ]) {
    await page.setViewportSize(size);
    await page.locator(".guide-scrubber").fill(String(first));
    expect(await visible()).toEqual([...plan.steps[first]].sort());
    await expect(page.locator(".guide-placement-note")).toContainText(
      "loose pieces supported",
    );
    await page.locator(".guide-scrubber").fill(String(sticker));
    const summary = page
      .locator(".guide-panel summary")
      .filter({ hasText: "Placement views" });
    if (
      !(await summary.evaluate(
        (el) => (el.parentElement as HTMLDetailsElement).open,
      ))
    )
      await summary.click();
    await page
      .getByRole("button", {
        name: "Show receiver detail — access unverified",
        exact: true,
      })
      .click();
    expect(await visible()).toEqual([...detail].sort());
    await page.locator(".guide-scrubber").fill(String(join));
    await expect(page.locator(".guide-panel")).toContainText(
      "Place completed object",
    );
    await expect(page.locator(".guide-panel")).toContainText("No new parts");
    if (
      !(await summary.evaluate(
        (el) => (el.parentElement as HTMLDetailsElement).open,
      ))
    )
      await summary.click();
    await page
      .getByRole("button", { name: "Show completed candidate", exact: true })
      .click();
    expect(await visible()).toEqual([...container.occurrenceIds].sort());
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
    ).toBe(false);
  }
});
test("staged crane joint keeps pin preparation separate from vehicle mounting", async ({
  page,
}) => {
  const text = await readFile(
    new URL("../../fixtures/instructions/omr/6361-1.mpd", import.meta.url),
    "utf8",
  );
  await page.goto("/?automation=1");
  await page.waitForFunction(() => !!window.brickEditor);
  await page.evaluate(async (text) => {
    await window.brickEditor!.project.import({ format: "ldraw", text });
    await window.brickEditor!.ready({ strict: true });
  }, text);
  await openMode(page, "Instructions");
  await page
    .getByRole("button", { name: "Make steps automatically", exact: true })
    .click();
  await expect(
    page.getByText("Generated plan review", { exact: true }),
  ).toBeVisible({ timeout: 60000 });
  const download = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Download plan JSON", exact: true })
    .click();
  const plan = JSON.parse(
    await readFile((await (await download).path())!, "utf8"),
  ) as InstructionPlan;
  const [key, joint] = Object.entries(plan.modules!).find(
    ([, m]) => m.purpose === "joint",
  )!;
  expect(joint.parentModuleId).toBeTruthy();
  const stages = plan.stepMetadata!.flatMap((m, n) =>
    m.assembly?.moduleId === key ? [n] : [],
  );
  expect(stages).toHaveLength(6);
  const hinge = plan.stepMetadata!.findIndex((m) => !!m.completedDetail);
  expect(hinge).toBeGreaterThan(0);
  const visible = async () =>
    page.evaluate(async () => {
      await window.brickEditor!.ready();
      await new Promise<void>((r) =>
        requestAnimationFrame(() => requestAnimationFrame(() => r())),
      );
      const scene = window.__brickScene as unknown as {
        handles: Map<string, { visible: boolean }>;
      };
      return [...scene.handles]
        .filter(([, h]) => h.visible)
        .map(([id]) => id)
        .sort();
    });
  await page
    .getByLabel("Instruction step", { exact: true })
    .fill(String(hinge));
  await page
    .getByRole("button", {
      name: "Show joint detail — access unverified",
      exact: true,
    })
    .click();
  expect(await visible()).toEqual(
    [...plan.stepMetadata![hinge].completedDetail!.occurrenceIds].sort(),
  );
  await page
    .getByRole("button", {
      name: "Show receiver detail — access unverified",
      exact: true,
    })
    .click();
  expect(await visible()).toEqual(
    [...plan.stepMetadata![hinge].alternateDetailIds!].sort(),
  );
  await page
    .getByRole("button", { name: "Show placement close-up", exact: true })
    .click();
  expect(await visible()).toEqual(
    [...instructionDisplayState(plan, hinge).displayIds].sort(),
  );
  await page
    .getByRole("button", { name: "Build it step by step", exact: true })
    .click();
  for (const size of [
    { width: 360, height: 600 },
    { width: 686, height: 411 },
  ]) {
    await page.setViewportSize(size);
    await page.locator(".guide-scrubber").fill(String(hinge));
    const hingeSummary = page
      .locator(".guide-panel summary")
      .filter({ hasText: "Placement views" });
    if (
      !(await hingeSummary.evaluate(
        (el) => (el.parentElement as HTMLDetailsElement).open,
      ))
    )
      await hingeSummary.click();
    await page
      .getByRole("button", {
        name: "Show joint detail — access unverified",
        exact: true,
      })
      .click();
    expect(await visible()).toEqual(
      [...plan.stepMetadata![hinge].completedDetail!.occurrenceIds].sort(),
    );
    await page
      .getByRole("button", {
        name: "Show receiver detail — access unverified",
        exact: true,
      })
      .click();
    expect(await visible()).toEqual(
      [...plan.stepMetadata![hinge].alternateDetailIds!].sort(),
    );
    await page
      .getByRole("button", { name: "Show placement", exact: true })
      .click();
    expect(await visible()).toEqual(
      [...instructionDisplayState(plan, hinge).displayIds].sort(),
    );
    await page.locator(".guide-scrubber").fill(String(hinge + 1));
    expect(await visible()).toEqual(
      [...instructionDisplayState(plan, hinge + 1).displayIds].sort(),
    );
    for (const n of stages.slice(1)) {
      await page.locator(".guide-scrubber").fill(String(n));
      const summary = page
        .locator(".guide-panel summary")
        .filter({ hasText: "Placement views" });
      if (
        !(await summary.evaluate(
          (el) => (el.parentElement as HTMLDetailsElement).open,
        ))
      )
        await summary.click();
      await page
        .getByRole("button", {
          name: "Show receiver detail — access unverified",
          exact: true,
        })
        .click();
      expect(await visible()).toEqual(
        [...plan.stepMetadata![n].alternateDetailIds!].sort(),
      );
      expect((await visible()).some((id) => plan.steps[n].includes(id))).toBe(
        false,
      );
      await expect(page.locator(".guide-approach-note")).toContainText(
        n === stages.at(-1) ? "crossing" : "No checked route",
      );
      const incoming = page.getByRole("button", {
        name: "Show completed candidate",
        exact: true,
      });
      if (n === stages.at(-1)) {
        expect(plan.steps[n]).toEqual([]);
        expect(plan.stepMetadata![n].alternateDetailIds).toEqual(joint.hostIds);
        await incoming.click();
        expect(await visible()).toEqual([...joint.occurrenceIds].sort());
      }
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
      ).toBe(false);
    }
  }
});
test("figure receiver detail omits scenery while retaining the real prior host in editor and viewer", async ({
  page,
}) => {
  const text = await readFile(
    new URL("../../fixtures/instructions/omr/31025-1.mpd", import.meta.url),
    "utf8",
  );
  await page.goto("/?automation=1");
  await page.waitForFunction(() => !!window.brickEditor);
  await page.evaluate(async (text) => {
    await window.brickEditor!.project.import({ format: "ldraw", text });
    await window.brickEditor!.ready({ strict: true });
  }, text);
  await openMode(page, "Instructions");
  await page
    .getByRole("button", { name: "Make steps automatically", exact: true })
    .click();
  await expect(
    page.getByText("Generated plan review", { exact: true }),
  ).toBeVisible({ timeout: 60000 });
  const download = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Download plan JSON", exact: true })
    .click();
  const plan = JSON.parse(
    await readFile((await (await download).path())!, "utf8"),
  ) as InstructionPlan;
  const n = plan.stepMetadata!.findIndex(
    (m) => m.alternateDetailIds && m.notes?.includes("wrist"),
  );
  expect(n).toBeGreaterThan(0);
  expect(
    Object.keys(plan.modules ?? {}).some((k) => k.startsWith("figure-")),
  ).toBe(false);
  const detail = plan.stepMetadata![n].alternateDetailIds!;
  expect(detail.some((id) => plan.steps[n].includes(id))).toBe(false);
  const visible = async () =>
    page.evaluate(async () => {
      await window.brickEditor!.ready();
      const scene = window.__brickScene as unknown as {
        handles: Map<string, { visible: boolean }>;
      };
      return [...scene.handles]
        .filter(([, h]) => h.visible)
        .map(([id]) => id)
        .sort();
    });
  await page.getByLabel("Instruction step", { exact: true }).fill(String(n));
  await page
    .getByRole("button", {
      name: "Show receiver detail — access unverified",
      exact: true,
    })
    .click();
  expect(await visible()).toEqual([...detail].sort());
  await page
    .getByRole("button", { name: "Show placement close-up", exact: true })
    .click();
  expect((await visible()).length).toBeGreaterThan(detail.length);
  await page
    .getByRole("button", { name: "Build it step by step", exact: true })
    .click();
  await page.locator(".guide-scrubber").fill(String(n));
  await page.getByText("Placement views", { exact: true }).click();
  for (const size of [
    { width: 360, height: 600 },
    { width: 686, height: 411 },
  ]) {
    await page.setViewportSize(size);
    await page
      .getByRole("button", {
        name: "Show receiver detail — access unverified",
        exact: true,
      })
      .click();
    expect(await visible()).toEqual([...detail].sort());
    await expect(page.locator(".guide-approach-note")).toContainText(
      "No checked route",
    );
    await expect(page.locator(".guide-approach-note")).not.toContainText(
      "Contact allowances apply",
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
    ).toBe(false);
  }
});
test("wheel placement shows its receiving pin before installation in the editor, viewer and publication", async ({
  page,
}) => {
  await page.goto("/?automation=1");
  await page.waitForFunction(() => !!window.brickEditor);
  await page.evaluate(async () => {
    const a = window.brickEditor!;
    await a.project.import({
      format: "ldraw",
      text: "0 Wheel\n1 0 30 5 0 0 0 1 0 1 0 -1 0 0 4084.dat\n1 14 30 5 0 0 0 1 0 1 0 -1 0 0 4624.dat\n1 0 0 0 0 1 0 0 0 1 0 0 0 1 4600.dat",
    });
    await a.ready({ strict: true });
  });
  await openMode(page, "Instructions");
  await page
    .getByRole("button", { name: "Make steps automatically", exact: true })
    .click();
  await expect(
    page.getByText("Generated plan review", { exact: true }),
  ).toBeVisible();
  const range = page.getByLabel("Instruction step", { exact: true });
  await range.focus();
  await range.press("End");
  await page
    .getByRole("button", {
      name: "Show receiver before placement",
      exact: true,
    })
    .click();
  const visible = await page.evaluate(async () => {
    await window.brickEditor!.ready();
    const scene = window.__brickScene as unknown as {
      handles: Map<string, { visible: boolean }>;
    };
    return [...scene.handles].filter(([, h]) => h.visible).map(([id]) => id);
  });
  expect(visible).toHaveLength(1);
  const expectExposedPin = async (selector: string) => {
    const view = await page.evaluate(async (selector) => {
      await window.brickEditor!.ready();
      const scene = window.__brickScene as unknown as {
          currentCamera(): CameraSpec;
          renderer: { domElement: HTMLCanvasElement };
        },
        canvas = scene.renderer.domElement.getBoundingClientRect(),
        panel = document.querySelector(selector)!.getBoundingClientRect();
      return {
        camera: scene.currentCamera(),
        width: canvas.width,
        height: canvas.height,
        panel: {
          left: panel.left - canvas.left,
          right: panel.right - canvas.left,
          top: panel.top - canvas.top,
          bottom: panel.bottom - canvas.top,
        },
      };
    }, selector);
    const span = view.camera.span!,
      aspect = view.width / view.height,
      camera = new OrthographicCamera(
        (-span * aspect) / 2,
        (span * aspect) / 2,
        span / 2,
        -span / 2,
        view.camera.near,
        view.camera.far,
      );
    camera.position.fromArray(view.camera.position);
    camera.up.fromArray(view.camera.up);
    camera.lookAt(new Vector3(...view.camera.target));
    camera.updateMatrixWorld();
    const point = new Vector3(22, 5, 0).project(camera),
      x = ((point.x + 1) * view.width) / 2,
      y = ((1 - point.y) * view.height) / 2;
    expect(x).toBeGreaterThan(0);
    expect(x).toBeLessThan(view.width);
    expect(y).toBeGreaterThan(64);
    expect(y).toBeLessThan(view.height);
    expect(
      x < view.panel.left ||
        x > view.panel.right ||
        y < view.panel.top ||
        y > view.panel.bottom,
    ).toBe(true);
  };
  for (const size of [
    { width: 360, height: 600 },
    { width: 686, height: 411 },
  ]) {
    await page.setViewportSize(size);
    await page
      .getByRole("button", {
        name: "Show receiver before placement",
        exact: true,
      })
      .click();
    await expectExposedPin(".mode-card");
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page
    .getByRole("button", { name: "Show join destination", exact: true })
    .click();
  await openMenuTab(page, "Instructions", "Publish");
  const publication = page.getByRole("region", {
    name: "Publish instructions",
  });
  await publication.getByLabel("Image size").selectOption("640");
  await publication.getByLabel("Publication format").selectOption("html-zip");
  const downloaded = page.waitForEvent("download");
  await publication
    .getByRole("button", { name: "Download publication" })
    .click();
  const { unzipSync, strFromU8 } = await import("fflate");
  const files = unzipSync(await readFile((await (await downloaded).path())!));
  const html = strFromU8(files["index.html"]);
  expect(html).toContain("Receiving assembly before placement");
  const prepared = JSON.parse(strFromU8(files["instructions.json"]));
  expect(prepared.steps.at(-1).alternateBeforePlacement).toBe(true);
  expect(prepared.steps[2].alternateBeforePlacement).toBe(true);
  expect(prepared.steps.at(-1).insertionChecks[0].status).toBe("unknown");
  await page
    .getByRole("button", { name: "Build it step by step", exact: true })
    .click();
  await page.locator(".guide-scrubber").fill(String(prepared.steps.length - 1));
  await page.getByText("Placement views", { exact: true }).click();
  await page
    .getByRole("button", {
      name: "Show receiver before placement",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("button", { name: "Show wheel placement", exact: true }),
  ).toBeVisible();
  for (const size of [
    { width: 360, height: 600 },
    { width: 686, height: 411 },
  ]) {
    await page.setViewportSize(size);
    await page
      .getByRole("button", {
        name: "Show receiver before placement",
        exact: true,
      })
      .click();
    await expectExposedPin(".guide-panel");
    if (size.height > size.width)
      expect(
        await page
          .locator(".guide-panel")
          .evaluate((e) => e.getBoundingClientRect().height),
      ).toBeLessThan(size.height / 2);
  }
  await page.locator(".guide-scrubber").fill("2");
  await page
    .getByRole("button", {
      name: "Show receiver before placement",
      exact: true,
    })
    .click();
  const bareRim = await page.evaluate(async () => {
    await window.brickEditor!.ready();
    const scene = window.__brickScene as unknown as {
      handles: Map<string, { visible: boolean }>;
    };
    return [...scene.handles].filter(([, h]) => h.visible).map(([id]) => id);
  });
  expect(bareRim).toEqual(prepared.steps[1].addedIds);
});
test("instruction worker keeps the page responsive and cancellation leaves no draft", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const NativeWorker = window.Worker;
    window.Worker = class extends NativeWorker {
      instructionWorker: boolean;
      constructor(url: string | URL, options?: WorkerOptions) {
        super(url, options);
        this.instructionWorker = String(url).includes("instructions.worker");
        if (this.instructionWorker) {
          (window as any).__instructionWorkerActive = true;
          this.addEventListener("message", () => {
            (window as any).__instructionWorkerActive = false;
          });
        }
      }
      terminate() {
        if (this.instructionWorker)
          (window as any).__instructionWorkerActive = false;
        super.terminate();
      }
    };
  });
  await page.goto("/?automation=1");
  await page.waitForFunction(() => !!window.brickEditor);
  await page.evaluate(async () => {
    const a = window.brickEditor!;
    await a.project.import({ format: "template", template: "house" });
    await a.ready({ strict: true });
    (window as any).__instructionFrames = 0;
    const tick = () => {
      if ((window as any).__instructionWorkerActive)
        (window as any).__instructionFrames++;
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  await openMode(page, "Instructions");
  await page
    .getByRole("button", { name: "Make steps automatically", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Cancel instruction generation", exact: true })
    .click();
  await expect(
    page.getByText("Generated plan review", { exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Make steps automatically", exact: true }),
  ).toBeEnabled();
  await page.evaluate(() => {
    (window as any).__instructionFrames = 0;
  });
  await page
    .getByRole("button", { name: "Make steps automatically", exact: true })
    .click();
  await expect(
    page.getByText("Generated plan review", { exact: true }),
  ).toBeVisible({ timeout: 60000 });
  expect(
    await page.evaluate(() => (window as any).__instructionFrames),
  ).toBeGreaterThan(3);
});
for (const width of [1440, 360])
  test(`heuristic instructions generate, preview and undo at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: width === 360 ? 800 : 1000 });
    await page.goto("/?automation=1");
    await page.waitForFunction(() => !!window.brickEditor);
    await page.evaluate(async () => {
      const a = window.brickEditor!;
      await a.project.import({ format: "template", template: "car" });
      await a.ready({ strict: true });
    });
    await openMode(page, "Instructions");
    await page
      .getByRole("button", { name: "Make steps automatically", exact: true })
      .click();
    await expect(
      page.getByText("Generated plan review", { exact: true }),
    ).toBeVisible();
    const waiting = page.waitForEvent("download");
    await page
      .getByRole("button", { name: "Download plan JSON", exact: true })
      .click();
    const plan = JSON.parse(
      await readFile((await (await waiting).path())!, "utf8"),
    ) as InstructionPlan;
    const ids = await page.evaluate(async () =>
      (await window.brickEditor!.query()).occurrences.map((o) => o.id),
    );
    const result = { plan, ids };
    expect(new Set(result.plan.steps.flat())).toEqual(new Set(result.ids));
    expect(result.plan.generation!.connectorCovered).toBeGreaterThan(0);
    expect(result.plan.generation!.algorithm).toBe("connected-bottom-up-v16");
    const scene = Object.entries(result.plan.modules!).find(
      ([, module]) => module.placement === "scene",
    )!;
    expect(scene[1].occurrenceIds).toHaveLength(58);
    expect(
      Object.values(result.plan.modules!).filter(
        (module) => module.parentModuleId === scene[0],
      ),
    ).toHaveLength(4);
    expect(result.plan.steps.at(-1)).toEqual([]);
    expect(result.plan.stepMetadata!.at(-1)!.assembly).toEqual({
      type: "join",
      moduleId: scene[0],
    });
    expect(result.plan.generation!.insertionClear).toBeGreaterThan(0);
    await expect(page.locator(".instruction-approach")).toContainText("CAD");
    expect(result.plan.stepMetadata!.every((s) => !!s.camera)).toBe(true);
    await openMenuTab(page, "Instructions", "Publish");
    await expect(
      page.getByRole("checkbox", {
        name: "Dim previous parts in preview and publication",
      }),
    ).toBeChecked();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.evaluate(async () => {
      const a = window.brickEditor!,
        p = await a.query();
      await a.dispatch({
        schemaVersion: 1,
        commandId: "undo-heuristic",
        expectedRevision: p.revision,
        type: "history.undo",
        payload: {},
      });
    });
    await expect(
      page.getByText("Generated plan review", { exact: true }),
    ).toHaveCount(0);
  });

test("generated publications contain coloured part pictures and a placement locator", async ({
  page,
}) => {
  await page.goto("/?automation=1");
  await page.waitForFunction(() => !!window.brickEditor);
  await page.evaluate(async () => {
    const a = window.brickEditor!;
    await a.project.import({
      format: "ldraw",
      name: "detail.mpd",
      text: "0 Detail\n1 4 0 0 0 1 0 0 0 1 0 0 0 1 3001.dat\n1 1 1200 0 0 1 0 0 0 1 0 0 0 1 3003.dat\n1 0 2400 0 0 1 0 0 0 1 0 0 0 1 3707.dat",
    });
    await a.ready({ strict: true });
    const q = await a.query();
    await a.dispatch({
      schemaVersion: 1,
      commandId: "detail-steps",
      expectedRevision: q.revision,
      type: "instructions.generate",
      payload: {},
    });
  });
  await openMode(page, "Instructions");
  await expect(page.getByLabel("Parts for this step")).toContainText("Brick");
  await openMenuTab(page, "Instructions", "Publish");
  const publication = page.getByRole("region", {
    name: "Publish instructions",
  });
  await publication.getByLabel("Image size").selectOption("640");
  await publication.getByLabel("Publication format").selectOption("html-zip");
  const downloaded = page.waitForEvent("download");
  await publication
    .getByRole("button", { name: "Download publication" })
    .click();
  const { unzipSync, strFromU8 } = await import("fflate");
  const files = unzipSync(await readFile((await (await downloaded).path())!));
  const html = strFromU8(files["index.html"]);
  expect(html).toContain("Where this fits");
  expect(html).toContain("checked CAD approach");
  const prepared = JSON.parse(strFromU8(files["instructions.json"]));
  expect(
    prepared.steps
      .flatMap((s: any) => s.insertionChecks)
      .some((c: any) => c.status === "clear" && c.from && c.to),
  ).toBe(true);
  expect(html).toContain("Brick");
  expect(html).toContain("Technic Axle");
  expect(html).not.toContain("No picture");
  expect(
    JSON.parse(strFromU8(files["instructions.json"])).assemblyValidated,
  ).toBe(false);
});

test("generated flexible drawings publish as whole unverified representations", async ({
  page,
}) => {
  await page.goto("/?automation=1");
  await page.waitForFunction(() => !!window.brickEditor);
  await page.evaluate(async () => {
    const a = window.brickEditor!;
    await a.project.import({
      format: "ldraw",
      name: "flexible.mpd",
      text: "0 FILE root.ldr\n1 4 0 0 0 1 0 0 0 1 0 0 0 1 hose.ldr\n0 FILE hose.ldr\n0 !LDCAD CONTENT [type=path] [addFallBack=default]\n0 !LDCAD GENERATED [generator=test]\n3 4 0 0 0 20 0 0 0 -20 0\n3 4 20 0 0 40 0 0 20 -20 0",
    });
    await a.ready({ strict: true });
    const q = await a.query();
    await a.dispatch({
      schemaVersion: 1,
      commandId: "flex-step",
      expectedRevision: q.revision,
      type: "instructions.generate",
      payload: { maxPerStep: 1 },
    });
  });
  await openMode(page, "Instructions");
  await expect(page.getByLabel("Parts for this step")).toContainText(
    "Generated flexible element",
  );
  await openMenuTab(page, "Instructions", "Publish");
  const publication = page.getByRole("region", {
    name: "Publish instructions",
  });
  await publication.getByLabel("Image size").selectOption("640");
  await publication.getByLabel("Publication format").selectOption("html-zip");
  const download = page.waitForEvent("download");
  await publication
    .getByRole("button", { name: "Download publication" })
    .click();
  const { unzipSync, strFromU8 } = await import("fflate");
  const files = unzipSync(await readFile((await (await download).path())!));
  const plan = JSON.parse(strFromU8(files["instructions.json"]));
  expect(plan.coverage).toMatchObject({
    intended: 2,
    introduced: 2,
    complete: true,
  });
  expect(plan.inventory).toHaveLength(1);
  expect(plan.inventory[0]).toMatchObject({
    quantity: 1,
    kind: "generated-component",
    identityVerified: false,
  });
  expect(strFromU8(files["index.html"])).toContain("verify real parts");
});

test("workbench builds publish zero-new-part joins with completed candidate diagrams", async ({
  page,
}) => {
  await page.goto("/?automation=1");
  await page.waitForFunction(() => !!window.brickEditor);
  await page.evaluate(async () => {
    const a = window.brickEditor!;
    const line = (ref: string, y = 0) =>
      `1 4 0 ${y} 0 1 0 0 0 1 0 0 0 1 ${ref}`;
    await a.project.import({
      format: "ldraw",
      name: "workbench.mpd",
      text:
        "0 FILE root.ldr\n" +
        line("tower.ldr") +
        "\n0 FILE tower.ldr\n" +
        [0, -24, -48, -72].map((y) => line("3001.dat", y)).join("\n"),
    });
    await a.ready({ strict: true });
    const q = await a.query();
    await a.dispatch({
      schemaVersion: 1,
      commandId: "programme",
      expectedRevision: q.revision,
      type: "instructions.generate",
      payload: {},
    });
  });
  await openMode(page, "Instructions");
  const range = page.getByLabel("Instruction step", { exact: true });
  await range.focus();
  await range.press("End");
  await expect(
    page.getByRole("button", { name: "Show completed candidate", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Show completed candidate", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Show join destination", exact: true })
    .click();
  await openMenuTab(page, "Instructions", "Publish");
  const publication = page.getByRole("region", {
    name: "Publish instructions",
  });
  await publication.getByLabel("Image size").selectOption("640");
  await publication.getByLabel("Publication format").selectOption("html-zip");
  const download = page.waitForEvent("download");
  await publication
    .getByRole("button", { name: "Download publication" })
    .click();
  const { unzipSync, strFromU8 } = await import("fflate");
  const files = unzipSync(await readFile((await (await download).path())!));
  const plan = JSON.parse(strFromU8(files["instructions.json"]));
  expect(plan.steps.at(-1)).toMatchObject({
    partCount: 0,
    lots: [],
    addedIds: [],
  });
  expect(plan.steps.at(-1).incomingIds).toHaveLength(4);
  expect(plan.inventory.reduce((n: number, l: any) => n + l.quantity, 0)).toBe(
    4,
  );
  expect(strFromU8(files["index.html"])).toContain(
    "Use this completed candidate",
  );
  // Exercise the pictorial PDF publisher with actual GPU captures, including
  // the completed candidate's zero-new-part join and its supporting diagrams.
  await publication.getByLabel("Publication format").selectOption("pdf");
  const pdfDownload = page.waitForEvent("download");
  await publication
    .getByRole("button", { name: "Download publication" })
    .click();
  const pdf = await PDFDocument.load(
    await readFile((await (await pdfDownload).path())!),
  );
  expect(pdf.getPageCount()).toBe(plan.steps.length + 2);
  const joinImages = pdf
    .getPages()
    [plan.steps.length].node.Resources()!
    .lookup(PDFName.of("XObject"), PDFDict);
  // This origin-only fixture has the main scene and incoming candidate; there
  // are no additional context/alternate cameras in its generated join.
  expect(joinImages.keys()).toHaveLength(2);
  await page
    .getByRole("button", { name: "Build it step by step", exact: true })
    .click();
  const scrubber = page.locator(".guide-scrubber");
  await expect(scrubber).toHaveValue("0");
  // Opening the viewer must replace the editor's completed join mask with
  // the first isolated workbench step, including after parent effects run.
  const shown = await page.evaluate(async () => {
    const api = window.brickEditor!;
    await api.ready();
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );
    const scene = window.__brickScene as unknown as {
      handles: Map<string, { visible: boolean }>;
    };
    return [...scene.handles].flatMap(([id, handle]) =>
      handle.visible ? [id] : [],
    );
  });
  expect(new Set(shown)).toEqual(new Set(plan.steps[0].addedIds));
  await expect(page.locator(".guide-placement-note")).toContainText(
    "Work on tower.ldr",
  );
  await scrubber.fill(String(plan.steps.length - 1));
  await expect(page.locator(".guide-panel")).toContainText("No new parts");
  await expect(page.locator(".guide-panel")).toContainText(
    "candidate; fit unknown",
  );
  await page.getByRole("button", { name: "Close steps", exact: true }).click();
});
