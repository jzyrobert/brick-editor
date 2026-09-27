import { expect, test, type Page } from "@playwright/test";
import { unzipSync, zipSync, strToU8, strFromU8 } from "fflate";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import type { Project, Node } from "../../src/core/types";

async function verifyStaleActions(page: Page, bytes: number[]) {
  for (const action of ["blank", "saved", "file"]) {
    await page.evaluate(
      (bytes) =>
        window.brickEditor!.project.import({ format: "native", bytes }),
      bytes,
    );
    await expect(
      page.getByRole("heading", { name: "Source retained", exact: true }),
    ).toBeVisible();
    await expect(page.getByText(/Source saved on this device/)).toBeVisible();
    await page.evaluate((action) => {
      const a = window.brickEditor!;
      const originalExport = a.project.export,
        originalText = File.prototype.text;
      let release!: () => void;
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      const state = {
        waiting: false,
        release,
        restore: () => {
          a.project.export = originalExport;
          File.prototype.text = originalText;
        },
      };
      (window as unknown as { race: typeof state }).race = state;
      if (action === "file")
        File.prototype.text = async function () {
          const text = await originalText.call(this);
          state.waiting = true;
          await gate;
          return text;
        };
      else
        a.project.export = async (input) => {
          const result = await originalExport(input);
          state.waiting = true;
          await gate;
          return result;
        };
    }, action);
    if (action === "blank")
      await page
        .getByRole("button", { name: "Back up source and start blank" })
        .click();
    else if (action === "saved")
      await page
        .locator(".saved-project")
        .filter({ hasText: "Unsaved prior project" })
        .getByRole("button", { name: "Open saved project", exact: true })
        .click();
    else
      await page.getByLabel("Open another project").setInputFiles({
        name: "stale.ldr",
        mimeType: "text/plain",
        buffer: Buffer.from("1 4 0 0 0 1 0 0 0 1 0 0 0 1 3001.dat"),
      });
    await page.waitForFunction(
      () => (window as unknown as { race: { waiting: boolean } }).race.waiting,
    );
    const newer = await page.evaluate(async () => {
      await window.brickEditor!.project.import({
        format: "template",
        template: "wall",
      });
      await window.brickEditor!.ready();
      return window.brickEditor!.project.status();
    });
    const downloaded =
      action === "file" ? undefined : page.waitForEvent("download");
    await page.evaluate(async () => {
      const state = (
        window as unknown as {
          race: { release: () => void; restore: () => void };
        }
      ).race;
      state.release();
      await new Promise(requestAnimationFrame);
      await new Promise(requestAnimationFrame);
      state.restore();
    });
    if (downloaded) await downloaded;
    expect(
      await page.evaluate(() => window.brickEditor!.project.status()),
    ).toEqual(newer);
  }
  await page.evaluate(
    (bytes) => window.brickEditor!.project.import({ format: "native", bytes }),
    bytes,
  );
  await expect(
    page.getByRole("heading", { name: "Source retained", exact: true }),
  ).toBeVisible();
}

for (const { width, denyStorage } of [
  { width: 360, denyStorage: false },
  { width: 1080, denyStorage: false },
  { width: 360, denyStorage: true },
])
  test(`limited source stays recoverable and clears old scene at ${width}px${denyStorage ? " with denied storage" : ""}`, async ({
    browser,
    baseURL,
  }) => {
    const context = await browser.newContext({
      viewport: { width, height: width === 360 ? 800 : 1800 },
      hasTouch: true,
      baseURL,
    });
    const page = await context.newPage();
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    try {
      await page.goto("/?automation=1");
      await page.waitForFunction(() => !!window.brickEditor);
      const bytes = await page.evaluate(async () => {
        const a = window.brickEditor!;
        await a.project.import({ format: "template", template: "wall" });
        await a.ready();
        return Array.from((await a.project.export({ format: "native" })).bytes);
      });
      const files = unzipSync(new Uint8Array(bytes));
      const project = JSON.parse(strFromU8(files["project.json"])) as Project;
      const previousId = project.id;
      project.id = "limited-source-browser";
      project.title = "Preserved shared source";
      project.rootModelId = "m0";
      project.models = {};
      project.instructionPlans = {};
      project.layerAssignments = {};
      project.groups = {};
      project.motionRigs = {};
      for (let i = 0; i < 5; i++) {
        const nodes: Node[] = Array.from({ length: 10 }, (_, j) => ({
          id: `${j}${"x".repeat(1023)}`,
          kind: i === 4 ? "part" : "submodel",
          ref: i === 4 ? "3001.dat" : `m${i + 1}`,
          colorCode: "4",
          transform: {
            position: [0, 0, 0],
            basis: [1, 0, 0, 0, 1, 0, 0, 0, 1],
          },
        }));
        project.models[`m${i}`] = {
          id: `m${i}`,
          name: `m${i}.ldr`,
          classification: "model",
          nodes,
          records: [],
        };
      }
      project.metadata = {};
      files["project.json"] = strToU8(JSON.stringify(project));
      files["sources/project.mpd"] = strToU8(
        Object.values(project.models)
          .map(
            (model) =>
              `0 FILE ${model.name}\n` +
              model.nodes
                .map(
                  (node) =>
                    `1 4 0 0 0 1 0 0 0 1 0 0 0 1 ${project.models[node.ref]?.name ?? node.ref}`,
                )
                .join("\n"),
          )
          .join("\n") + "\n0 NOFILE\n",
      );
      const hash = (v: Uint8Array) =>
        createHash("sha256").update(v).digest("hex");
      const manifest = JSON.parse(strFromU8(files["manifest.json"]));
      manifest.projectSha256 = hash(files["project.json"]);
      manifest.entries["project.json"] = manifest.projectSha256;
      manifest.entries["sources/project.mpd"] = hash(
        files["sources/project.mpd"],
      );
      files["manifest.json"] = strToU8(JSON.stringify(manifest));
      await page.evaluate(async (denyStorage) => {
        const a = window.brickEditor!;
        (window as unknown as { retainedAPI: typeof a }).retainedAPI = a;
        const q = await a.query();
        await a.dispatch({
          schemaVersion: 1,
          commandId: crypto.randomUUID(),
          expectedRevision: q.revision,
          type: "project.rename",
          payload: { title: "Unsaved prior project" },
        });
        if (denyStorage)
          Object.defineProperty(window, "localStorage", {
            configurable: true,
            get() {
              throw new Error("Device storage denied");
            },
          });
      }, denyStorage);
      const result = await page.evaluate(
        async (bytes) => {
          const a = window.brickEditor!;
          await a.project.import({ format: "native", bytes });
          await a.project.import({ format: "template", template: "blank" });
          await a.ready();
          if ((await a.query()).occurrences.length)
            throw new Error("Coalesced transition kept stale scene");
          return a.project.import({ format: "native", bytes });
        },
        Array.from(zipSync(files)),
      );
      expect(result.materialization.status).toBe("limited");
      await expect(
        page.getByRole("heading", { name: "Source retained", exact: true }),
      ).toBeVisible();
      await expect(page.locator("canvas")).toHaveCount(0);
      if (denyStorage)
        await expect(page.getByText(/Source save failed/)).toBeVisible();
      else {
        await expect(
          page.getByText(/Source saved on this device/),
        ).toBeVisible();
        await expect(
          page.getByText("Unsaved prior project", { exact: true }),
        ).toBeVisible();
        expect(
          await page.evaluate(
            (id) =>
              !!localStorage.getItem(
                "brick-editor:" + encodeURIComponent(id) + ":head",
              ),
            previousId,
          ),
        ).toBe(true);
      }
      const pendingCode = await page.evaluate(
        async (bytes) => {
          const a = window.brickEditor!;
          await a.project.import({ format: "template", template: "blank" });
          const pending = a.ready().then(
            () => "unexpected success",
            (error) => error.code,
          );
          await a.project.import({ format: "native", bytes });
          return pending;
        },
        Array.from(zipSync(files)),
      );
      expect(pendingCode).toBe("LIMIT_EXCEEDED");
      const refusals = await page.evaluate(async () => {
        const a = window.brickEditor!;
        const status = await a.project.status();
        return Promise.all(
          [
            a.ready(),
            a.query(),
            a.play.enter({}),
            a.render.image({
              revision: status.revision,
              width: 128,
              height: 128,
              format: "png",
              visibility: { mode: "all" },
              background: { type: "transparent" },
              quality: "fast",
              strict: true,
            }),
          ].map((p) =>
            p.then(
              () => "unexpected success",
              (error) => error.code,
            ),
          ),
        );
      });
      expect(refusals).toEqual(Array(4).fill("LIMIT_EXCEEDED"));
      for (const label of [
        "Download native backup",
        "Export complete LDraw source",
      ]) {
        const pending = page.waitForEvent("download");
        await page.getByRole("button", { name: label, exact: true }).tap();
        const artifact = await pending;
        const data = await readFile((await artifact.path())!);
        if (label.startsWith("Download")) {
          const saved = JSON.parse(strFromU8(unzipSync(data)["project.json"]));
          expect(saved.models).toEqual(project.models);
        } else expect(data.toString()).toContain("m4.ldr");
      }
      if (denyStorage) {
        expect(errors).toEqual([]);
        return;
      }
      if (width === 360)
        await verifyStaleActions(page, Array.from(zipSync(files)));
      await page.evaluate(async () => {
        const a = (
          window as unknown as { retainedAPI: typeof window.brickEditor }
        ).retainedAPI!;
        const native = await a.project.export({ format: "native" });
        await a.project.import({ format: "template", template: "blank" });
        await a.ready();
        if ((await a.query()).occurrences.length !== 0)
          throw new Error("Old API kept stale geometry");
        await a.project.import({
          format: "native",
          bytes: Array.from(native.bytes),
        });
      });
      await expect(page.getByText(/Source saved on this device/)).toBeVisible();
      await page.reload();
      await expect(
        page.getByRole("heading", { name: "Source retained", exact: true }),
      ).toBeVisible();
      await expect(page.locator("canvas")).toHaveCount(0);
      const pending = page.waitForEvent("download");
      await page
        .getByRole("button", { name: "Back up source and start blank" })
        .tap();
      await pending;
      await expect(
        page.getByRole("button", { name: "Build", exact: true }),
      ).toBeVisible();
      await expect
        .poll(() =>
          page.evaluate(
            async () => (await window.brickEditor?.project.status())?.status,
          ),
        )
        .toBe("available");
      expect(
        await page.evaluate(
          async () => (await window.brickEditor!.query()).occurrences.length,
        ),
      ).toBe(0);
      await expect(page.locator(".save-state")).toContainText("Saved revision");
      await page.reload();
      await expect(
        page.getByRole("button", { name: "Build", exact: true }),
      ).toBeVisible();
      expect(
        (await page.evaluate(() => window.brickEditor!.project.status()))
          .status,
      ).toBe("available");
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
