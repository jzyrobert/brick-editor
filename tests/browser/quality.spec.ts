import { expect, test } from "@playwright/test";
test("capture uses distinct quality profiles, records lighting and restores interactive controls on success and failure", async ({
  page,
  baseURL,
}) => {
  await page.goto(`${process.env.BRICK_QUALITY_URL || baseURL}/?automation=1`);
  await page.waitForFunction(() => !!window.brickEditor);
  const result = await page.evaluate(async () => {
    const api = window.brickEditor!;
    await api.project.import({ format: "template", template: "room" });
    const q = await api.query();
    await api.ready({ minRevision: q.revision, strict: true });
    await api.camera.set({
      space: "ldraw",
      projection: "perspective",
      position: [420, -340, 460],
      target: [0, -25, 0],
      up: [0, -1, 0],
      fovDeg: 45,
      near: 0.5,
      far: 50000,
    });
    const before = await api.render.quality.set("fast", {
      edges: "ordinary",
      exposure: 1.4,
      pixelRatioCap: 1.5,
    });
    const captures = [];
    for (const quality of ["fast", "balanced", "photo"] as const) {
      const result = await api.render.image({
        revision: q.revision,
        width: 160,
        height: 120,
        format: "png",
        visibility: { mode: "all" },
        background: { type: "transparent" },
        quality,
        strict: true,
      });
      const bytes = await result.blob.arrayBuffer();
      const hash = Array.from(
        new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
      )
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
      captures.push({
        manifest: result.manifest,
        hash,
        restored: await api.render.quality.get(),
      });
    }
    const override = await api.render.image({
      revision: q.revision,
      width: 160,
      height: 120,
      format: "png",
      visibility: { mode: "all" },
      background: { type: "transparent" },
      quality: "photo",
      qualityControls: {
        edges: "none",
        shadows: "off",
        toneMapping: "neutral",
        exposure: 1,
      },
      strict: true,
    });
    const overrideHash = Array.from(
      new Uint8Array(
        await crypto.subtle.digest(
          "SHA-256",
          await override.blob.arrayBuffer(),
        ),
      ),
    )
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    let failure = "";
    try {
      await api.render.image({
        revision: q.revision,
        width: 160,
        height: 120,
        format: "png",
        visibility: {
          mode: "occurrences",
          occurrenceIds: ["missing-occurrence"],
        },
        background: { type: "transparent" },
        quality: "photo",
        strict: true,
      });
    } catch (e) {
      failure = (e as Error).message;
    }
    return {
      before,
      captures,
      overrideHash,
      overrideProfile: override.manifest.profile,
      failure,
      afterFailure: await api.render.quality.get(),
    };
  });
  expect(result.captures.map((c) => c.manifest.profile.name)).toEqual([
    "fast",
    "balanced",
    "photo",
  ]);
  expect(new Set(result.captures.map((c) => c.hash)).size).toBe(3);
  expect(result.overrideHash).toBe(result.captures[0].hash);
  expect(result.overrideProfile).toMatchObject({
    name: "photo",
    edges: "none",
    shadows: "off",
    toneMapping: "neutral",
    exposure: 1,
  });
  for (const capture of result.captures) {
    expect(capture.restored).toEqual(result.before);
    expect(capture.manifest.lighting.lights).toHaveLength(3);
    expect(capture.manifest.output).toMatchObject({ width: 160, height: 120 });
    expect(capture.manifest.capabilities.maxTextureSize).toBeGreaterThanOrEqual(
      160,
    );
  }
  expect(result.captures[0].manifest.profile.edges).toBe("none");
  expect(result.captures[2].manifest.profile.shadows).toBe("soft");
  expect(
    result.captures[2].manifest.lighting.lights.some(
      (light) => (light.shadow as { enabled: boolean } | undefined)?.enabled,
    ),
  ).toBe(true);
  expect(result.failure).toContain("unknown occurrence");
  expect(result.afterFailure).toEqual(result.before);
});
