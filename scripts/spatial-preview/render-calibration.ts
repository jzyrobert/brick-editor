// Post-generation preview capture. Reuse one browser for the tiny calibration
// models; never expose images or an evaluator channel to generation.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve, join } from "node:path";
import { importLDraw } from "../../src/ldraw/io";
import { encodeNative } from "../../src/persistence/native";
import { viewCamera, type BuildView } from "../../src/build-script/views";
import { registerFullLibraryFromDisk } from "../full-library-node";
import { withHeadlessPage } from "../headless";
import { hash } from "../spatial-benchmark/part-reference";
import { verifyFile } from "../spatial-benchmark/sandbox";

async function main() {
  const runs = resolve(process.argv[2]);
  const out = resolve(process.argv[3]);
  const status = JSON.parse(
    await readFile(join(runs, "run-status.json"), "utf8"),
  );
  if (status.completed !== status.planned)
    throw new Error("Calibration generation must be complete");
  const protocol = JSON.parse(
    await readFile(
      "fixtures/spatial-benchmark/studies/sol-high-pilot/visual-protocol.json",
      "utf8",
    ),
  );
  for (const [file, sha] of Object.entries(protocol.sourceHashes))
    await verifyFile(file, String(sha));
  const runsData = JSON.parse(
    await readFile(join(runs, "results.json"), "utf8"),
  );
  const manifest = JSON.parse(
    await readFile(join(runs, "manifest.json"), "utf8"),
  );
  const ordered = [...runsData.results].sort((a, b) =>
    hash("blind-presentation-v1:" + a.caseId).localeCompare(
      hash("blind-presentation-v1:" + b.caseId),
    ),
  );
  await mkdir(out);
  await writeFile(
    join(out, "capture-source.ts"),
    await readFile(new URL(import.meta.url)),
  );
  await writeFile(
    join(out, "protocol.json"),
    JSON.stringify(
      {
        ...protocol,
        purpose: "post-generation calibration preview",
        browserReuse: true,
      },
      null,
      2,
    ),
  );
  registerFullLibraryFromDisk();
  const first = importLDraw(
    await readFile(join(runs, ordered[0].caseId, "build.mpd"), "utf8"),
    "anonymous.mpd",
  );
  const mapping: Record<string, unknown>[] = [];
  await withHeadlessPage(first, async (page) => {
    for (const [index, run] of ordered.entries()) {
      const id = `candidate-${String(index + 1).padStart(3, "0")}`;
      const source = join(runs, run.caseId),
        dir = join(out, id);
      await mkdir(dir);
      for (const [file, sha] of Object.entries(run.files))
        await verifyFile(join(source, file), String(sha));
      const compilation = JSON.parse(
        await readFile(join(source, "compilation.json"), "utf8"),
      );
      const project = importLDraw(
        await readFile(join(source, "build.mpd"), "utf8"),
        "anonymous.mpd",
      );
      const cameras = protocol.views.map((view: BuildView) => ({
        view,
        camera: viewCamera(
          compilation.report.bounds.ldu,
          view,
          protocol.width / protocol.height,
        ),
      }));
      const bytes = Array.from(await encodeNative(project));
      await page.evaluate(async (bytes) => {
        const api = window.brickEditor!;
        const imported = await api.project.import({ format: "native", bytes });
        await api.ready({ minRevision: imported.revision, strict: true });
      }, bytes);
      const images = [];
      for (const [i, c] of cameras.entries()) {
        const shot = await page.evaluate(
          async ({ camera, width, height, look, backdrop }) => {
            const api = window.brickEditor!;
            await api.camera.set(camera);
            const q = await api.query();
            const shot = await api.render.image({
              revision: q.revision,
              width,
              height,
              format: "png",
              visibility: { mode: "all" },
              background: { type: "solid", color: "#ffffff" },
              quality: "photo",
              strict: true,
              look,
              backdrop,
            });
            return Array.from(new Uint8Array(await shot.blob.arrayBuffer()));
          },
          {
            camera: c.camera,
            width: protocol.width,
            height: protocol.height,
            look: protocol.look,
            backdrop: protocol.backdrop,
          },
        );
        const file = `image-${i}.png`,
          data = Buffer.from(shot);
        await writeFile(join(dir, file), data);
        images.push({ file, sha256: hash(data), view: c.view });
      }
      const task = manifest.tasks.find((t: { id: string }) =>
        run.caseId.startsWith(t.id + "--"),
      );
      mapping.push({
        id,
        caseId: run.caseId,
        task: task.id,
        brief: task.brief,
        status: run.status,
        images,
        cameras,
        renderFailure: null,
      });
      await writeFile(
        join(out, "private-mapping.json"),
        JSON.stringify(mapping, null, 2),
      );
      console.log(JSON.stringify({ rendered: id, images: images.length }));
    }
  });
}
main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
