// Generates the sample builds and their chooser previews:
//
//   npm run templates            sources, checks and previews
//   npm run templates -- --check sources and checks only (no browser)
//
// Sources: fixtures/ldraw/templates/*.mpd, written from the generators in
// src/catalog/builds/ (the app builds the same text at runtime; a unit test
// keeps them identical). Each build is checked for overlapping part bodies,
// stud-grid placement and verified connectivity (src/catalog/builds/check.ts)
// and the script fails on any problem. Previews: public/templates/<name>.webp
// (320 × 240), one per chooser card, rendered by the app's own renderer.
import { mkdirSync, writeFileSync } from "node:fs";
import { houseSource } from "../src/catalog/builds/house";
import { castleSource } from "../src/catalog/builds/castle";
import { carSource } from "../src/catalog/builds/car";
import { jeepSource } from "../src/catalog/builds/jeep";
import { windmillSource } from "../src/catalog/builds/windmill";
import { lighthouseSource } from "../src/catalog/builds/lighthouse";
import { cafeSource } from "../src/catalog/builds/cafe";
import { checkBuild } from "../src/catalog/builds/check";
import { template } from "../src/catalog/templates";
import {
  TEMPLATE_CARDS,
  type TemplateName,
} from "../src/catalog/template-names";
import { curatedHas } from "../src/catalog/full-library";
import { occurrences } from "../src/core/document";
import type { CameraSpec } from "../src/core/types";
import { encodeNative } from "../src/persistence/native";
import {
  fullLibraryOccupancy,
  registerFullLibraryFromDisk,
} from "./full-library-node";
import { withHeadlessPage } from "./headless";

export const TEMPLATE_BUILDS = [
  { name: "house", file: "house-with-garden.mpd", source: houseSource },
  { name: "castle", file: "small-castle.mpd", source: castleSource },
  { name: "car", file: "roadster.mpd", source: carSource },
  { name: "jeep", file: "off-road-jeep.mpd", source: jeepSource },
  { name: "windmill", file: "windmill-farm.mpd", source: windmillSource },
  { name: "lighthouse", file: "lighthouse.mpd", source: lighthouseSource },
  { name: "cafe", file: "corner-cafe.mpd", source: cafeSource },
] as const;

const cam = (position: number[], target: number[], fovDeg = 40) =>
  ({
    space: "ldraw",
    projection: "perspective",
    position,
    target,
    up: [0, -1, 0],
    fovDeg,
    near: 1,
    far: 20000,
  }) as CameraSpec;
/** Preview cameras: front three-quarter views (fronts face −Z). */
const CAMERAS: Partial<Record<TemplateName, CameraSpec>> = {
  house: cam([520, -560, -880], [-10, -120, -40]),
  castle: cam([520, -620, -900], [0, -80, 0]),
  car: cam([210, -170, -300], [0, -40, 0], 38),
  jeep: cam([300, -230, -430], [0, -60, -10], 38),
  windmill: cam([600, -660, -960], [-30, -160, -20]),
  lighthouse: cam([600, -620, -980], [-10, -230, -20]),
  cafe: cam([600, -560, -940], [-40, -140, -30]),
};

registerFullLibraryFromDisk();
mkdirSync("fixtures/ldraw/templates", { recursive: true });
let failed = false;
for (const build of TEMPLATE_BUILDS) {
  writeFileSync("fixtures/ldraw/templates/" + build.file, build.source());
  const project = template(build.name);
  const extra = occurrences(project)
    .map((o) => o.node.ref)
    .filter((ref) => !curatedHas(ref));
  const r = checkBuild(project, { occupancy: fullLibraryOccupancy(extra) });
  const connectivity = r.health.checks.find((c) => c.id === "connectivity")!;
  console.log(
    `${build.name}: ${r.parts} parts, ${Object.keys(r.refs).length} designs; ` +
      `${r.overlaps.length} overlaps, ${r.offGrid.length} off grid, ` +
      `${r.groups} verified group(s) (${r.covered} covered, ${r.uncovered} without data). ` +
      connectivity.detail,
  );
  if (r.overlaps.length || r.offGrid.length || r.groups > 1) failed = true;
}
if (failed) throw new Error("A template build failed its checks");

if (!process.argv.includes("--check")) {
  mkdirSync("public/templates", { recursive: true });
  const cards = TEMPLATE_CARDS.filter((c) => c.name !== "blank");
  await withHeadlessPage(template("blank"), async (page) => {
    await page.setViewportSize({ width: 800, height: 600 });
    for (const card of cards) {
      const bytes = Array.from(await encodeNative(template(card.name)));
      const base64 = await page.evaluate(
        async ({ bytes, camera }) => {
          const a = window.brickEditor!;
          const imported = await a.project.import({ format: "native", bytes });
          await a.ready({ minRevision: imported.revision, strict: true });
          if (camera) await a.camera.set(camera);
          else await a.camera.fit();
          const q = await a.query();
          const { blob } = await a.render.image({
            revision: q.revision,
            width: 640,
            height: 480,
            format: "png",
            visibility: { mode: "all" },
            background: { type: "solid", color: "#ffffff" },
            quality: "photo",
            strict: true,
          });
          const bitmap = await createImageBitmap(blob, {
            resizeWidth: 320,
            resizeHeight: 240,
            resizeQuality: "high",
          });
          const canvas = new OffscreenCanvas(320, 240);
          canvas.getContext("2d")!.drawImage(bitmap, 0, 0);
          const webp = await canvas.convertToBlob({
            type: "image/webp",
            quality: 0.84,
          });
          const buffer = new Uint8Array(await webp.arrayBuffer());
          let binary = "";
          for (const b of buffer) binary += String.fromCharCode(b);
          return btoa(binary);
        },
        { bytes, camera: CAMERAS[card.name] ?? null },
      );
      const data = Buffer.from(base64, "base64");
      if (data.subarray(8, 12).toString() !== "WEBP")
        throw new Error("Not a WebP image: " + card.name);
      writeFileSync(`public/templates/${card.name}.webp`, data);
      console.log(`Preview ${card.name}: ${data.length} bytes`);
    }
  });
}
