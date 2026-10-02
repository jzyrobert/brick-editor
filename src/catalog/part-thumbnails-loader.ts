/**
 * Browser loader for the complete library's sprite-sheet thumbnails
 * (part-thumbnails.ts). The index is verified against the build's lock and
 * each sheet against its content address before use; verified bytes are kept
 * in a Cache Storage cache named after the pack, so thumbnails seen once also
 * show offline. Sheets are fetched only when a card asks for them.
 */
import { catalog } from "./catalog";
import { sha256 } from "../core/hash";
import {
  PART_THUMBNAILS_FORMAT,
  cellStyle,
  locateThumbnails,
  partThumbnailsLock,
  sheetPath,
  type PartThumbnailIndex,
  type PartThumbnailLocation,
} from "./part-thumbnails";

export const partThumbnailCacheName =
  "brick-editor-part-thumbnails:" + partThumbnailsLock.packId;
const base = () =>
  new URL(
    import.meta.env.BASE_URL + "thumbnails/" + partThumbnailsLock.packId + "/",
    location.href,
  ).href;

/** Request statistics (for tests and diagnostics). */
export const partThumbnailStats = { requests: 0, cacheHits: 0, bytes: 0 };

type State = {
  index: PartThumbnailIndex;
  where: Map<string, PartThumbnailLocation>;
};
let state: State | undefined;
let indexLoad: Promise<void> | undefined;
let indexFailed = false;
/** Sheet number → object URLs of its image and mask (once verified). */
const sheets = new Map<number, { image: string; mask?: string } | null>();
const sheetLoads = new Map<number, Promise<void>>();
const listeners = new Set<() => void>();
let generation = 0;
const changed = () => {
  generation++;
  for (const l of [...listeners]) l();
};
export function onPartThumbnailsChange(listener: () => void) {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}
export const partThumbnailsGeneration = () => generation;

// Failed loads are not retried in a loop; coming back online retries them.
if (typeof addEventListener === "function")
  addEventListener("online", () => {
    let retry = indexFailed;
    indexFailed = false;
    for (const [sheet, loaded] of sheets)
      if (loaded === null) {
        sheets.delete(sheet);
        sheetLoads.delete(sheet);
        retry = true;
      }
    if (retry) changed();
  });

async function openCache() {
  try {
    return typeof caches === "undefined"
      ? undefined
      : await caches.open(partThumbnailCacheName);
  } catch {
    return undefined;
  }
}
/** Verified bytes of one pack file: cache first (re-verified), then network. */
async function verified(path: string, expected: string, bytes: number) {
  const url = base() + path;
  const cache = await openCache();
  const hit = await cache?.match(url).catch(() => undefined);
  if (hit) {
    const b = new Uint8Array(await hit.arrayBuffer());
    if ((await sha256(b)) === expected) {
      partThumbnailStats.cacheHits++;
      return b;
    }
    await cache!.delete(url).catch(() => false);
  }
  partThumbnailStats.requests++;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Thumbnail file unavailable: " + path);
  const b = new Uint8Array(await res.arrayBuffer());
  if (b.length !== bytes || (await sha256(b)) !== expected)
    throw new Error("Thumbnail file hash mismatch: " + path);
  partThumbnailStats.bytes += b.length;
  await cache?.put(url, new Response(b as BufferSource)).catch(() => {});
  return b;
}

/** Loads the verified index once (retried after a failure on next request). */
export function loadPartThumbnailIndex(): Promise<void> {
  if (state) return Promise.resolve();
  return (indexLoad ??= (async () => {
    const bytes = await verified(
      "index.json",
      partThumbnailsLock.indexSha256,
      partThumbnailsLock.indexBytes,
    );
    const index = JSON.parse(
      new TextDecoder().decode(bytes),
    ) as PartThumbnailIndex;
    if (
      index.format !== PART_THUMBNAILS_FORMAT ||
      index.packId !== partThumbnailsLock.packId
    )
      throw new Error("Unsupported part thumbnail pack");
    state = { index, where: locateThumbnails(index) };
    indexFailed = false;
    changed();
  })().catch((e) => {
    indexLoad = undefined;
    indexFailed = true;
    changed();
    throw e;
  }));
}

function loadSheet(sheet: number) {
  let load = sheetLoads.get(sheet);
  if (!load) {
    load = (async () => {
      const s = state!.index.sheets[sheet];
      const url = async ([sha, bytes]: [string, number]) =>
        URL.createObjectURL(
          new Blob([(await verified(sheetPath(sha), sha, bytes)) as BlobPart], {
            type: "image/webp",
          }),
        );
      try {
        const [image, mask] = await Promise.all([
          url(s.image),
          s.mask ? url(s.mask) : undefined,
        ]);
        sheets.set(sheet, { image, ...(mask ? { mask } : {}) });
      } catch {
        // Offline and never seen, or refused: the card keeps its outline
        // until the browser is back online.
        sheets.set(sheet, null);
      }
      changed();
    })();
    sheetLoads.set(sheet, load);
  }
  return load;
}

export type PartThumbnail =
  | { status: "none" }
  | { status: "loading" }
  | {
      status: "ready";
      image: string;
      /** Tint mask: the mask sheet for printed cells, else the image itself. */
      mask: string;
      printed: boolean;
      size: string;
      position: string;
    };

/**
 * The thumbnail of a complete-library part. With `visible`, starts loading
 * the index and the part's sheet; otherwise only reports what is loaded.
 * `none` means the pack has no rendering for it (or could not be loaded).
 */
export function partThumbnail(id: string, visible: boolean): PartThumbnail {
  if (!state) {
    if (indexFailed) return { status: "none" };
    if (visible) void loadPartThumbnailIndex().catch(() => {});
    return { status: "loading" };
  }
  const at = state.where.get(id);
  if (!at) return { status: "none" };
  const loaded = sheets.get(at.sheet);
  if (loaded === undefined) {
    if (visible) void loadSheet(at.sheet);
    return { status: "loading" };
  }
  if (!loaded) return { status: "none" };
  const style = cellStyle(state.index, at);
  return {
    status: "ready",
    image: loaded.image,
    mask: at.printed && loaded.mask ? loaded.mask : loaded.image,
    printed: at.printed,
    ...style,
  };
}

/** Export one packaged curated thumbnail or verified atlas cell for an instruction tray. Prints retain their
 * fixed colours. A missing rendering stays explicit; never substitute a part. */
export async function partThumbnailPng(
  id: string,
  hex: string,
  transparent = false,
): Promise<Uint8Array | undefined> {
  if (
    typeof document === "undefined" ||
    typeof createImageBitmap === "undefined"
  )
    return;
  try {
    const curated = catalog[id];
    let x = 0,
      y = 0,
      cell = 80;
    let urls: string[];
    if (curated?.thumbnail) {
      const url = new URL(
        import.meta.env.BASE_URL + curated.thumbnail,
        location.href,
      ).href;
      urls = [url, url];
    } else {
      await loadPartThumbnailIndex();
      const at = state!.where.get(id);
      if (!at) return;
      await loadSheet(at.sheet);
      const loaded = sheets.get(at.sheet);
      if (!loaded) return;
      cell = state!.index.cell;
      x = (at.cell % state!.index.columns) * cell;
      y = Math.floor(at.cell / state!.index.columns) * cell;
      urls = [
        loaded.image,
        at.printed && loaded.mask ? loaded.mask : loaded.image,
      ];
    }
    const bitmaps = await Promise.all(
      urls.map(async (url) => {
        // Blob URLs are permitted for images by CSP, but not for fetch.
        const image = new Image();
        await new Promise<void>((resolve, reject) => {
          image.onload = () => resolve();
          image.onerror = () => reject(new Error("Thumbnail unavailable"));
          image.src = url;
        });
        return createImageBitmap(image);
      }),
    );
    if (curated?.thumbnail) cell = bitmaps[0].width;
    try {
      const canvas = document.createElement("canvas"),
        tint = document.createElement("canvas");
      canvas.width = canvas.height = tint.width = tint.height = cell;
      const c = canvas.getContext("2d")!,
        t = tint.getContext("2d")!;
      c.drawImage(bitmaps[0], x, y, cell, cell, 0, 0, cell, cell);
      t.drawImage(bitmaps[1], x, y, cell, cell, 0, 0, cell, cell);
      t.globalCompositeOperation = "source-in";
      t.fillStyle = hex;
      t.fillRect(0, 0, cell, cell);
      c.globalCompositeOperation = "multiply";
      c.drawImage(tint, 0, 0);
      c.globalCompositeOperation = "destination-in";
      c.drawImage(bitmaps[0], x, y, cell, cell, 0, 0, cell, cell);
      if (transparent) {
        c.globalCompositeOperation = "destination-in";
        c.fillStyle = "rgba(0,0,0,0.55)";
        c.fillRect(0, 0, cell, cell);
      }
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/png"),
      );
      return blob ? new Uint8Array(await blob.arrayBuffer()) : undefined;
    } finally {
      bitmaps.forEach((b) => b.close());
    }
  } catch {
    return;
  }
}
