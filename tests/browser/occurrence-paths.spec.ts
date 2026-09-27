import { expect, test } from "@playwright/test";
import { unzipSync, zipSync, strToU8, strFromU8 } from "fflate";
import { createHash, randomUUID } from "node:crypto";
import type { Project } from "../../src/core/types";
test("deep native occurrence paths survive query, editing, capture and Play", async ({
  page,
}) => {
  const source = Array.from(
    { length: 32 },
    (_, i) =>
      `0 FILE m${i}.ldr\n1 4 0 0 0 1 0 0 0 1 0 0 0 1 ${i === 31 ? "3001.dat" : `m${i + 1}.ldr`}`,
  ).join("\n");
  await page.goto("/?automation=1");
  await page.waitForFunction(() => !!window.brickEditor);
  const original = await page.evaluate(async (source) => {
    const api = window.brickEditor!;
    await api.project.import({ format: "ldraw", text: source });
    return Array.from((await api.project.export({ format: "native" })).bytes);
  }, source);
  const files = unzipSync(new Uint8Array(original));
  const project = JSON.parse(strFromU8(files["project.json"])) as Project;
  for (const model of Object.values(project.models)) {
    const names = new Map(model.nodes.map((node) => [node.id, randomUUID()]));
    for (const node of model.nodes) node.id = names.get(node.id)!;
    for (const record of model.records)
      if (record.nodeId) record.nodeId = names.get(record.nodeId)!;
  }
  files["project.json"] = strToU8(JSON.stringify(project));
  const manifest = JSON.parse(strFromU8(files["manifest.json"]));
  manifest.projectSha256 = createHash("sha256")
    .update(files["project.json"])
    .digest("hex");
  manifest.entries["project.json"] = manifest.projectSha256;
  files["manifest.json"] = strToU8(JSON.stringify(manifest));
  const bytes = Array.from(zipSync(files));
  const result = await page.evaluate(async (bytes) => {
    const api = window.brickEditor!;
    await api.project.import({ format: "native", bytes });
    const id = (await api.query()).occurrences[0].id;
    const query = await api.query({ occurrenceIds: [id] });
    await api.dispatch({
      schemaVersion: 1,
      commandId: crypto.randomUUID(),
      expectedRevision: query.revision,
      type: "parts.recolor",
      payload: { occurrenceIds: [id], colorCode: "1" },
    });
    const changed = await api.query({
      scope: { kind: "selection", occurrenceIds: [id] },
    });
    await api.ready({ strict: true });
    const capture = await api.render.image({
      revision: changed.revision,
      width: 256,
      height: 256,
      format: "png",
      visibility: { mode: "occurrences", occurrenceIds: [id] },
      background: { type: "solid", color: "#ffffff" },
      quality: "balanced",
      strict: true,
    });
    const play = await api.play.enter({
      position: [100, -0.3, 100],
      yaw: 0,
      pitch: 0,
    });
    await api.play.exit();
    return {
      id,
      original: query.count,
      color: changed.occurrences[0].colorCode,
      pngBytes: capture.blob.size,
      included: play.worldProfile.includedOccurrenceIds,
    };
  }, bytes);
  expect(result.original).toBe(1);
  expect(result.color).toBe("1");
  expect(result.pngBytes).toBeGreaterThan(100);
  expect(result.id.length).toBeGreaterThan(1024);
  expect(result.included).toEqual([result.id]);
});
