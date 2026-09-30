// Renders a thumbnail of every placeable part of the complete official LDraw
// pack into sprite-sheet atlases (public/thumbnails/<pack id>/), with the app's
// own LDraw/three.js pipeline in headless Chromium, exactly like the curated
// thumbnails (scripts/build-thumbnails.ts): same view, same quality controls,
// bodies in white so the UI can tint them to the held colour.
//
// Many parts are rendered in one image: each is scaled uniformly to fill its
// own cell of an orthographic grid, so a batch of 256 parts is one import and
// one render instead of 256. Parts with fixed-colour geometry (prints,
// stickers, assemblies) are rendered a second time with a black body; pixels
// that did not change are print, and a tint mask (alpha) marks the rest.
//
// Two resumable phases:
//   render → .cache/part-thumbnails/<pack id>/<batch>.json (lossless cells)
//   pack   → public/thumbnails/<pack id>/sheets/<sha256>.webp + index.json
//            and src/catalog/part-thumbnails-lock.json
//
//   npx tsx scripts/build-part-thumbnails.ts [--render] [--pack]
//        [--batches 0-9] [--workers 2] [--list <batch>] [--partial]
//   npx tsx scripts/build-part-thumbnails.ts --textured
// (--list prints a batch's parts; --partial packs whatever is rendered, for
// previews only: validation then fails on the missing parts. --textured
// re-renders only the parts that map a !TEXMAP texture, with their textures,
// and patches their cells into the published sheets: the sheets holding them
// are decoded, re-encoded and re-addressed, and the index and lock updated.)
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";
import { catalog } from "../src/catalog/catalog";
import { fullLibraryLock } from "../src/catalog/full-library";
import {
  chunkPath,
  directReferences,
  type FullPackCatalogEntry,
  type FullPackIndex,
} from "../src/catalog/full-pack";
import {
  PART_THUMBNAILS_FORMAT,
  thumbnailPackId,
  type PartThumbnailIndex,
} from "../src/catalog/part-thumbnails";
import {
  fullLibraryDir,
  registerFullLibraryFromDisk,
} from "./full-library-node";

const args = process.argv.slice(2);
const option = (name: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const texturedOnly = args.includes("--textured");
const phases = {
  render:
    !texturedOnly && (args.includes("--render") || !args.includes("--pack")),
  pack:
    !texturedOnly && (args.includes("--pack") || !args.includes("--render")),
};
/** Output cell size (px); parts are rendered at twice this and downscaled. */
const CELL = 80;
/** Cells per row and column of a render batch (one import, one render). */
const GRID = 16;
const PER_SHEET = GRID * GRID;
/** Cells per row of a published sheet (64 cells, about 60 kB), so a search
 * result fetches little beyond the parts on screen. */
const SHEET_COLUMNS = 8;
const SHEET_CELLS = SHEET_COLUMNS * SHEET_COLUMNS;
const WEBP_QUALITY = 0.8;
const packId = thumbnailPackId;
const cacheDir = `.cache/part-thumbnails/${packId}/`;
const outDir = `public/thumbnails/${packId}/`;
const hash = (b: Uint8Array | string) =>
  createHash("sha256").update(b).digest("hex");

// ---- Part list and fixed-colour scan (deterministic, from the pinned pack).
if (!registerFullLibraryFromDisk())
  throw new Error("Complete LDraw pack not built (npm run library:full)");
const dir = fullLibraryDir();
const manifest = JSON.parse(readFileSync(dir + "manifest.json", "utf8"));
const index = JSON.parse(
  readFileSync(dir + manifest.index.path, "utf8"),
) as FullPackIndex;
const entries = JSON.parse(
  readFileSync(dir + manifest.catalog.path, "utf8"),
) as FullPackCatalogEntry[];

/** Top-level parts the picker lists: not moved-to redirects, not curated
 * (they have their own 128 px thumbnails), with bounds to frame. */
const placeable = entries
  .filter(
    ([id, title]) =>
      !title.startsWith("~Moved") &&
      !Object.hasOwn(catalog, id) &&
      !!index.parts[id]?.[1],
  )
  .map(([id, , category]) => ({ id, category }));

const texts = new Map<string, string>();
for (const [sha, , names, lengths] of index.chunks) {
  const stored = readFileSync(dir + chunkPath(sha));
  if (hash(stored) !== sha) throw new Error("Chunk hash mismatch " + sha);
  const raw = gunzipSync(stored);
  let offset = 0;
  names.forEach((name, i) => {
    texts.set(name, raw.subarray(offset, offset + lengths[i]).toString());
    offset += lengths[i];
  });
}
const fixedMemo = new Map<string, boolean>();
/** Whether a file draws any geometry in a colour other than the inherited
 * main (16) or edge (24) colour, directly or through its subfiles. */
function fixedColour(name: string, stack = new Set<string>()): boolean {
  const known = fixedMemo.get(name);
  if (known !== undefined) return known;
  const text = texts.get(name);
  if (!text || stack.has(name)) return false;
  stack.add(name);
  // A !TEXMAP image is print: drawn over the body, never tinted.
  let fixed = /^\s*0\s+!TEXMAP\s/m.test(text);
  for (const line of fixed ? [] : text.split(/\r?\n/)) {
    const m = /^\s*(?:0\s+!:\s*)?([1-5])\s+(\S+)/.exec(line);
    if (!m) continue;
    if (m[1] !== "2" && m[1] !== "5" && m[2] !== "16") {
      fixed = true;
      break;
    }
    if (m[1] === "1") {
      const ref = directReferences(line)[0];
      if (ref && fixedColour(ref, stack)) {
        fixed = true;
        break;
      }
    }
  }
  stack.delete(name);
  fixedMemo.set(name, fixed);
  return fixed;
}
const fixedIds = new Set(
  placeable.filter((p) => fixedColour(p.id)).map((p) => p.id),
);

// ---- Render batches: plain parts, then fixed-colour parts (two renders).
const sortedIds = (list: { id: string }[]) =>
  list.map((p) => p.id).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
const plainIds = sortedIds(placeable.filter((p) => !fixedIds.has(p.id)));
const printIds = sortedIds(placeable.filter((p) => fixedIds.has(p.id)));
type Batch = { key: string; ids: string[]; fixed: boolean };
const batches: Batch[] = [];
const cut = (ids: string[], fixed: boolean) => {
  for (let i = 0; i < ids.length; i += PER_SHEET)
    batches.push({
      key:
        (fixed ? "fixed-" : "plain-") + String(i / PER_SHEET).padStart(3, "0"),
      ids: ids.slice(i, i + PER_SHEET),
      fixed,
    });
};
cut(plainIds, false);
cut(printIds, true);
if (option("--list")) {
  console.log(batches[Number(option("--list"))].ids.join(" "));
  process.exit(0);
}

console.log(
  JSON.stringify({
    parts: placeable.length,
    fixedColour: fixedIds.size,
    batches: batches.length,
  }),
);

// Same view as the curated thumbnails: from above, front right (LDraw −Y up).
const view = [-1, 0.8, -1.1];
const len = Math.hypot(...view);
const dir3 = view.map((v) => v / len);
const cross = (a: number[], b: number[]) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const norm = (a: number[]) => a.map((v) => v / Math.hypot(...a));
const right = norm(cross(dir3, [0, -1, 0])),
  screenUp = norm(cross(right, dir3));
/** World size of one grid cell (LDU); parts are scaled to fill it. */
const CELL_WORLD = 1000;
const fmt = (v: number) => {
  const s = v.toFixed(5).replace(/\.?0+$/, "");
  return s === "-0" ? "0" : s;
};

/** Placement line of a part scaled into grid cell `i` (the curated framing:
 * its box's larger screen half-extent × 2 × 1.08 fills the cell). */
function placement(id: string, i: number, colour: number) {
  const b = index.parts[id][1]!;
  const min = b.slice(0, 3),
    max = b.slice(3);
  const centre = [0, 1, 2].map((k) => (min[k] + max[k]) / 2);
  let w = 0,
    h = 0;
  for (const x of [min[0], max[0]])
    for (const y of [min[1], max[1]])
      for (const z of [min[2], max[2]]) {
        const d = [x - centre[0], y - centre[1], z - centre[2]];
        w = Math.max(
          w,
          Math.abs(d[0] * right[0] + d[1] * right[1] + d[2] * right[2]),
        );
        h = Math.max(
          h,
          Math.abs(
            d[0] * screenUp[0] + d[1] * screenUp[1] + d[2] * screenUp[2],
          ),
        );
      }
  const span = Math.max(w, h, 0.5) * 2 * 1.08;
  const s = CELL_WORLD / span;
  const col = i % GRID,
    row = Math.floor(i / GRID);
  const cx = (col - (GRID - 1) / 2) * CELL_WORLD,
    cy = ((GRID - 1) / 2 - row) * CELL_WORLD;
  const at = [0, 1, 2].map(
    (k) => cx * right[k] + cy * screenUp[k] - s * centre[k],
  );
  return `1 ${colour} ${at.map(fmt).join(" ")} ${fmt(s)} 0 0 0 ${fmt(s)} 0 0 0 ${fmt(s)} ${id}`;
}
const distance = 4000 + CELL_WORLD * GRID;
const camera = {
  space: "ldraw" as const,
  projection: "orthographic" as const,
  position: dir3.map((d) => -d * distance) as [number, number, number],
  target: [0, 0, 0] as [number, number, number],
  up: [0, -1, 0] as [number, number, number],
  fovDeg: 30,
  near: 1,
  far: distance * 2,
  span: CELL_WORLD * GRID,
};

type Cells = {
  /** part → base64 PNG of the cell (white body). */
  cells: Record<string, string>;
  /** part → base64 PNG tint mask (fixed-colour parts whose print shows). */
  masks: Record<string, string>;
};

async function withBrowser<T>(
  work: (
    url: string,
    browser: import("@playwright/test").BrowserContext,
  ) => Promise<T>,
) {
  const [{ createServer }, { chromium }] = await Promise.all([
    import("vite"),
    import("@playwright/test"),
  ]);
  const server = await createServer({
    root: fileURLToPath(new URL("../", import.meta.url)),
    base: "/",
    server: { host: "127.0.0.1", port: 0, hmr: false, watch: null },
    logLevel: "error",
  });
  await server.listen();
  const browser = await chromium.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--use-angle=swiftshader",
      "--enable-unsafe-swiftshader",
    ],
  });
  // tsx names inner functions with a helper the page does not have.
  const context = await browser.newContext({
    viewport: { width: 900, height: 700 },
  });
  await context.addInitScript(() => {
    (globalThis as unknown as { __name: unknown }).__name = (f: unknown) => f;
    // Each render starts from an empty project, not the recovered last one.
    try {
      localStorage.removeItem("brick-editor-current");
    } catch {
      /* Opaque origins have no storage. */
    }
  });
  try {
    return await work(server.resolvedUrls!.local[0], context);
  } finally {
    await browser.close();
    await server.close();
  }
}

type Page = import("@playwright/test").Page;
type Slot = { id: string; i: number };
const edgesFor = (id: string) => {
  const b = index.parts[id][1]!;
  // Stud-dense baseplates turn into edge-line noise at thumbnail size.
  return Math.max(b[3] - b[0], b[5] - b[2]) >= 200 ? "none" : "all";
};

/** Imports one grid scene (white bodies) into a freshly loaded page and
 * renders it; with `black`, recolours every part black and renders again.
 * Returns the downscaled grids as base64 PNGs. Each scene gets a fresh page:
 * a second large import into the same page can fail to resolve official
 * subfiles, and a recolour reuses the compiled geometry. */
async function renderScene(
  page: Page,
  url: string,
  text: string,
  edges: "all" | "none",
  black: boolean,
) {
  await page.goto(url + "?automation=1");
  await page.waitForFunction(() => window.brickEditor?.apiVersion === "1.0");
  return page.evaluate(
    async ({ text, camera, edges, black, CELL, GRID }) => {
      const a = window.brickEditor!;
      const imported = await a.project.import({
        format: "ldraw",
        text,
        name: "Thumbnails",
        strict: true,
      });
      await a.ready({ minRevision: imported.revision, strict: true });
      await a.camera.set(camera);
      const shot = async (revision: number) => {
        const { blob } = await a.render.image({
          revision,
          width: CELL * GRID * 2,
          height: CELL * GRID * 2,
          format: "png",
          visibility: { mode: "all" },
          background: { type: "transparent" },
          quality: "balanced",
          qualityControls: { edges, toneMapping: "neutral" },
          strict: true,
        });
        const bitmap = await createImageBitmap(blob, {
          resizeWidth: CELL * GRID,
          resizeHeight: CELL * GRID,
          resizeQuality: "high",
        });
        const canvas = new OffscreenCanvas(CELL * GRID, CELL * GRID);
        canvas.getContext("2d")!.drawImage(bitmap, 0, 0);
        const png = new Uint8Array(
          await (
            await canvas.convertToBlob({ type: "image/png" })
          ).arrayBuffer(),
        );
        let binary = "";
        for (const b of png) binary += String.fromCharCode(b);
        return btoa(binary);
      };
      const white = await shot(imported.revision);
      if (!black) return { white };
      const q = await a.query({});
      const result = await a.dispatch({
        schemaVersion: 1,
        commandId: crypto.randomUUID(),
        expectedRevision: q.revision,
        type: "parts.recolor",
        payload: {
          occurrenceIds: q.occurrences.map((o: { id: string }) => o.id),
          colorCode: "0",
          includeHidden: true,
        },
      });
      await a.ready({ minRevision: result.revision, strict: true });
      return { white, black: await shot(result.revision) };
    },
    { text, camera, edges, black, CELL, GRID },
  );
}

/** Cells (and tint masks) of these slots, from a white-body render and, for
 * fixed-colour parts, a black-body render of the same grid. */
async function renderSlots(
  page: Page,
  url: string,
  slots: Slot[],
  edges: "all" | "none",
  fixed: boolean,
): Promise<Cells> {
  const text =
    "0 FILE thumbnails.ldr\n" +
    slots.map(({ id, i }) => placement(id, i, 15)).join("\n") +
    "\n";
  const { white, black } = await renderScene(page, url, text, edges, fixed);
  return page.evaluate(
    async ({ white, black, slots, CELL }) => {
      const pixels = async (b64: string) => {
        const bitmap = await createImageBitmap(
          new Blob([Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))], {
            type: "image/png",
          }),
        );
        const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
        const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
        ctx.drawImage(bitmap, 0, 0);
        return ctx;
      };
      const encode = async (data: ImageData) => {
        const c = new OffscreenCanvas(CELL, CELL);
        c.getContext("2d")!.putImageData(data, 0, 0);
        const png = new Uint8Array(
          await (await c.convertToBlob({ type: "image/png" })).arrayBuffer(),
        );
        let binary = "";
        for (const b of png) binary += String.fromCharCode(b);
        return btoa(binary);
      };
      const w = await pixels(white);
      const k = black ? await pixels(black) : undefined;
      const columns = w.canvas.width / CELL;
      const cells: Record<string, string> = {},
        masks: Record<string, string> = {};
      for (const { id, i } of slots) {
        const x = (i % columns) * CELL,
          y = Math.floor(i / columns) * CELL;
        const wd = w.getImageData(x, y, CELL, CELL);
        cells[id] = await encode(wd);
        if (!k) continue;
        const kd = k.getImageData(x, y, CELL, CELL);
        // Body pixels change between a white and a black body; print and
        // fixed-colour pixels do not. The mask's alpha is the tintable part.
        const mask = new ImageData(CELL, CELL);
        let fixedPixels = 0;
        for (let p = 0; p < wd.data.length; p += 4) {
          const lw =
            (0.2126 * wd.data[p] +
              0.7152 * wd.data[p + 1] +
              0.0722 * wd.data[p + 2]) /
            255;
          const lk =
            (0.2126 * kd.data[p] +
              0.7152 * kd.data[p + 1] +
              0.0722 * kd.data[p + 2]) /
            255;
          const m = Math.min(1, Math.max(0, ((lw - lk) / (lw + 0.02)) * 1.6));
          const alpha = Math.round(m * wd.data[p + 3]);
          mask.data[p] = mask.data[p + 1] = mask.data[p + 2] = 255;
          mask.data[p + 3] = alpha;
          if (wd.data[p + 3] > 128 && alpha < wd.data[p + 3] * 0.5)
            fixedPixels++;
        }
        // Fixed colours hidden inside the body leave nothing to protect.
        if (fixedPixels >= 3) masks[id] = await encode(mask);
      }
      return { cells, masks };
    },
    { white, black, slots, CELL },
  );
}

/** Renders a batch; a group that fails (a renderer budget, a part that does
 * not compile) is split in halves until the failing parts are isolated. Every
 * part keeps its cell, so the pixels do not depend on the split. */
async function renderBatch(page: Page, url: string, batch: Batch) {
  const out: Cells = { cells: {}, masks: {} };
  const failed: string[] = [];
  const attempt = async (slots: Slot[], edges: "all" | "none") => {
    try {
      const r = await renderSlots(page, url, slots, edges, batch.fixed);
      Object.assign(out.cells, r.cells);
      Object.assign(out.masks, r.masks);
    } catch (e) {
      const message = e instanceof Error ? e.message.split("\n")[0] : String(e);
      if (slots.length === 1) {
        failed.push(slots[0].id);
        console.error(`${slots[0].id}: ${message}`);
        return;
      }
      const half = Math.ceil(slots.length / 2);
      await attempt(slots.slice(0, half), edges);
      await attempt(slots.slice(half), edges);
    }
  };
  for (const edges of ["all", "none"] as const) {
    const slots = batch.ids
      .map((id, i) => ({ id, i }))
      .filter(({ id }) => edgesFor(id) === edges);
    if (slots.length) await attempt(slots, edges);
  }
  return { ...out, failed };
}

if (phases.render) {
  mkdirSync(cacheDir, { recursive: true });
  const range = option("--batches");
  const [from, to] = range
    ? range.split("-").map(Number)
    : [0, batches.length - 1];
  const todo = batches.filter(
    (b, i) =>
      i >= from && i <= (to ?? from) && !existsSync(cacheDir + b.key + ".json"),
  );
  const workers = Math.max(1, Number(option("--workers") ?? 2));
  const started = Date.now();
  let done = 0;
  await withBrowser(async (url, browser) => {
    let next = 0;
    await Promise.all(
      Array.from({ length: Math.min(workers, todo.length) }, async () => {
        const page = await browser.newPage();
        page.setDefaultTimeout(900000);
        page.on("pageerror", (e) => console.error("page error:", e.message));
        while (next < todo.length) {
          const batch = todo[next++];
          const t0 = Date.now();
          const cells = await renderBatch(page, url, batch);
          writeFileSync(
            cacheDir + batch.key + ".json",
            JSON.stringify({ ids: batch.ids, ...cells }),
          );
          done++;
          const missing = cells.failed;
          console.log(
            `${batch.key}: ${batch.ids.length} parts${missing.length ? `, ${missing.length} failed` : ""}, ${((Date.now() - t0) / 1000).toFixed(1)} s (${done}/${todo.length}, ${((Date.now() - started) / 60000).toFixed(1)} min)`,
          );
        }
      }),
    );
  });
}

if (phases.pack) {
  // Sheets group parts by LDraw category (then number), so browsing one
  // category fetches only a few sheets.
  const cached: Cells = { cells: {}, masks: {} };
  for (const b of batches) {
    const file = cacheDir + b.key + ".json";
    if (!existsSync(file)) {
      if (args.includes("--partial")) continue;
      throw new Error("Batch not rendered: " + b.key);
    }
    const data = JSON.parse(readFileSync(file, "utf8"));
    Object.assign(cached.cells, data.cells);
    Object.assign(cached.masks, data.masks);
  }
  const ordered = placeable
    .filter((p) => cached.cells[p.id])
    .sort((a, b) =>
      a.category !== b.category
        ? a.category < b.category
          ? -1
          : 1
        : a.id < b.id
          ? -1
          : a.id > b.id
            ? 1
            : 0,
    );
  const sheets: string[][] = [];
  for (let i = 0; i < ordered.length; i += SHEET_CELLS)
    sheets.push(ordered.slice(i, i + SHEET_CELLS).map((p) => p.id));
  const encoded = await withBrowser(async (url, browser) => {
    const page = await browser.newPage();
    await page.goto(url + "?automation=1");
    const out: { image: string; mask?: string }[] = [];
    for (const ids of sheets) {
      out.push(
        await page.evaluate(
          async ({ cells, masks, CELL, GRID, quality }) => {
            const decode = async (b64: string) =>
              createImageBitmap(
                new Blob([Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))], {
                  type: "image/png",
                }),
              );
            const rows = Math.ceil(cells.length / GRID);
            const sheet = async (list: (string | undefined)[]) => {
              const canvas = new OffscreenCanvas(CELL * GRID, CELL * rows);
              const ctx = canvas.getContext("2d")!;
              for (let i = 0; i < list.length; i++)
                if (list[i])
                  ctx.drawImage(
                    await decode(list[i]!),
                    (i % GRID) * CELL,
                    Math.floor(i / GRID) * CELL,
                  );
              const blob = await canvas.convertToBlob({
                type: "image/webp",
                quality,
              });
              const b = new Uint8Array(await blob.arrayBuffer());
              let binary = "";
              for (const x of b) binary += String.fromCharCode(x);
              return btoa(binary);
            };
            return {
              image: await sheet(cells),
              ...(masks.some(Boolean) ? { mask: await sheet(masks) } : {}),
            };
          },
          {
            cells: ids.map((id) => cached.cells[id]),
            masks: ids.map((id) => cached.masks[id]),
            CELL,
            GRID: SHEET_COLUMNS,
            quality: WEBP_QUALITY,
          },
        ),
      );
    }
    return out;
  });
  rmSync(outDir + "sheets", { recursive: true, force: true });
  mkdirSync(outDir + "sheets", { recursive: true });
  let bytes = 0;
  const pinned = (b64: string) => {
    const data = Buffer.from(b64, "base64");
    if (data.subarray(8, 12).toString() !== "WEBP")
      throw new Error("Not a WebP image");
    const sha = hash(data);
    writeFileSync(`${outDir}sheets/${sha}.webp`, data);
    bytes += data.length;
    return [sha, data.length] as [string, number];
  };
  const thumbIndex: PartThumbnailIndex = {
    format: PART_THUMBNAILS_FORMAT,
    packId,
    library: {
      releaseId: fullLibraryLock.releaseId,
      manifestSha256: fullLibraryLock.manifestSha256,
    },
    cell: CELL,
    columns: SHEET_COLUMNS,
    sheets: sheets.map((ids, s) => {
      const image = pinned(encoded[s].image);
      const mask = encoded[s].mask ? pinned(encoded[s].mask!) : undefined;
      return {
        image,
        ...(mask ? { mask } : {}),
        parts: ids,
        printed: ids
          .map((id, i) => (cached.masks[id] ? i : -1))
          .filter((i) => i >= 0),
      };
    }),
    unrendered: placeable
      .filter((p) => !cached.cells[p.id])
      .map((p) => p.id)
      .sort(),
  };
  const text = JSON.stringify(thumbIndex);
  writeFileSync(outDir + "index.json", text);
  const lock = {
    packId,
    indexSha256: hash(text),
    indexBytes: Buffer.byteLength(text),
  };
  writeFileSync(
    "src/catalog/part-thumbnails-lock.json",
    JSON.stringify(lock, null, 2) + "\n",
  );
  const missing = placeable.length - ordered.length;
  console.log(
    JSON.stringify({
      parts: ordered.length,
      missing,
      printed: Object.keys(cached.masks).length,
      sheets: sheets.length,
      files: readdirSync(outDir + "sheets").length + 1,
      bytes,
      indexBytes: lock.indexBytes,
    }),
  );
}

if (texturedOnly) {
  // Parts that map a !TEXMAP texture (the texture pack's part table).
  const textureLock = JSON.parse(
    readFileSync("src/catalog/full-textures-lock.json", "utf8"),
  ) as { texturePackId: string };
  const textureManifest = JSON.parse(
    readFileSync(
      `public/libraries/${textureLock.texturePackId}/manifest.json`,
      "utf8",
    ),
  ) as { parts: Record<string, string[]> };
  const ids = placeable
    .map((p) => p.id)
    .filter((id) => Object.hasOwn(textureManifest.parts, id))
    .sort();
  const thumbIndex = JSON.parse(
    readFileSync(outDir + "index.json", "utf8"),
  ) as PartThumbnailIndex;
  const rendered: Cells = { cells: {}, masks: {} };
  const failed: string[] = [];
  const t0 = Date.now();
  await withBrowser(async (url, browser) => {
    const page = await browser.newPage();
    page.setDefaultTimeout(900000);
    page.on("pageerror", (e) => console.error("page error:", e.message));
    for (let i = 0; i < ids.length; i += PER_SHEET) {
      // Rendered as print (white and black bodies): textures are not tinted.
      const r = await renderBatch(page, url, {
        key: "textured-" + i / PER_SHEET,
        ids: ids.slice(i, i + PER_SHEET),
        fixed: true,
      });
      Object.assign(rendered.cells, r.cells);
      Object.assign(rendered.masks, r.masks);
      failed.push(...r.failed);
    }
    // Patch the sheets that hold them (their other cells are re-encoded).
    for (const sheet of thumbIndex.sheets) {
      if (!sheet.parts.some((id) => rendered.cells[id])) continue;
      const file = (entry: [string, number]) =>
        readFileSync(`${outDir}sheets/${entry[0]}.webp`).toString("base64");
      const cellsOf = (list: Record<string, string>) =>
        sheet.parts.map((id) => list[id] ?? null);
      const out = await page.evaluate(
        async ({ image, mask, cells, masks, CELL, GRID, quality, rows }) => {
          const decode = async (b64: string) =>
            createImageBitmap(
              new Blob([Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))]),
            );
          const patch = async (
            base: string | null,
            list: (string | null)[],
            replace: boolean[],
          ) => {
            const canvas = new OffscreenCanvas(CELL * GRID, CELL * rows);
            const ctx = canvas.getContext("2d")!;
            if (base) ctx.drawImage(await decode(base), 0, 0);
            for (let i = 0; i < list.length; i++) {
              if (!replace[i]) continue;
              const x = (i % GRID) * CELL,
                y = Math.floor(i / GRID) * CELL;
              ctx.clearRect(x, y, CELL, CELL);
              if (list[i]) ctx.drawImage(await decode(list[i]!), x, y);
            }
            const blob = await canvas.convertToBlob({
              type: "image/webp",
              quality,
            });
            const b = new Uint8Array(await blob.arrayBuffer());
            let binary = "";
            for (const x of b) binary += String.fromCharCode(x);
            return btoa(binary);
          };
          const replace = cells.map((c) => c !== null);
          return {
            image: await patch(image, cells, replace),
            mask:
              mask || masks.some(Boolean)
                ? await patch(mask, masks, replace)
                : undefined,
          };
        },
        {
          image: file(sheet.image),
          mask: sheet.mask ? file(sheet.mask) : null,
          cells: cellsOf(rendered.cells),
          masks: cellsOf(rendered.masks),
          CELL,
          GRID: SHEET_COLUMNS,
          quality: WEBP_QUALITY,
          rows: Math.ceil(sheet.parts.length / SHEET_COLUMNS),
        },
      );
      const pin = (b64: string, old?: [string, number]) => {
        const data = Buffer.from(b64, "base64");
        if (data.subarray(8, 12).toString() !== "WEBP")
          throw new Error("Not a WebP image");
        const sha = hash(data);
        writeFileSync(`${outDir}sheets/${sha}.webp`, data);
        if (old && old[0] !== sha) rmSync(`${outDir}sheets/${old[0]}.webp`);
        return [sha, data.length] as [string, number];
      };
      sheet.image = pin(out.image, sheet.image);
      if (out.mask) sheet.mask = pin(out.mask, sheet.mask);
      const printed = new Set(sheet.printed);
      sheet.parts.forEach((id, i) => {
        if (!rendered.cells[id]) return;
        if (rendered.masks[id]) printed.add(i);
        else printed.delete(i);
      });
      sheet.printed = [...printed].sort((a, b) => a - b);
    }
  });
  const text = JSON.stringify(thumbIndex);
  writeFileSync(outDir + "index.json", text);
  writeFileSync(
    "src/catalog/part-thumbnails-lock.json",
    JSON.stringify(
      { packId, indexSha256: hash(text), indexBytes: Buffer.byteLength(text) },
      null,
      2,
    ) + "\n",
  );
  console.log(
    JSON.stringify({
      textured: ids.length,
      rendered: Object.keys(rendered.cells).length,
      printed: Object.keys(rendered.masks).length,
      failed,
      seconds: Math.round((Date.now() - t0) / 1000),
    }),
  );
}
