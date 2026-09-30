// Browser side of the official set models (docs/OFFICIAL-MODELS.md): the
// committed metadata index (a lazy chunk, precached with offline snapshots)
// and model files fetched live through the same-origin proxy, kept in Cache
// Storage so a set opened once opens again offline.
import { AppError, ensure } from "../core/types";
import {
  OMR_PROXY_PATH,
  decodeOmrIndex,
  looksLikeLDraw,
  omrFileName,
  type OmrIndexFile,
  type OmrSet,
} from "./omr";

export const omrCacheName = "brick-editor-omr-v1";

let index: Promise<{ sets: OmrSet[]; retrieved: string }> | undefined;
/** The OMR set index (about 1,500 sets). */
export function loadOmrIndex() {
  index ??= import("./omr-index.json")
    .then((m) => {
      const file = (m.default ?? m) as unknown as OmrIndexFile;
      return { sets: decodeOmrIndex(file), retrieved: file.retrieved };
    })
    .catch((error) => {
      index = undefined;
      throw error;
    });
  return index;
}

const modelUrl = (set: OmrSet) =>
  new URL(
    import.meta.env.BASE_URL + OMR_PROXY_PATH + omrFileName(set),
    location.href,
  ).href;

async function openCache() {
  try {
    return typeof caches === "undefined"
      ? undefined
      : await caches.open(omrCacheName);
  } catch {
    return undefined; // Opaque origins, private modes: network only.
  }
}

/** Whether a set's model is stored on this device (opens offline). */
export async function omrModelCached(set: OmrSet) {
  const cache = await openCache();
  return !!(await cache?.match(modelUrl(set)).catch(() => undefined));
}

/** The set's main model file as text: from this device's cache when it was
 * opened before, otherwise from ldraw.org through the proxy (then cached). */
export async function fetchOmrModel(
  set: OmrSet,
  maxBytes: number,
): Promise<{ text: string; cached: boolean }> {
  const url = modelUrl(set);
  const cache = await openCache();
  const hit = await cache?.match(url).catch(() => undefined);
  if (hit) {
    const text = await hit.text();
    if (looksLikeLDraw(text)) return { text, cached: true };
    await cache!.delete(url).catch(() => false);
  }
  let res: Response;
  try {
    res = await fetch(url);
  } catch {
    throw new AppError(
      "NETWORK_UNAVAILABLE",
      `Could not reach LDraw.org for ${set.number}. Sets you have opened before also open offline.`,
    );
  }
  ensure(
    res.status !== 404,
    "REFERENCE_MISSING",
    `LDraw.org has no main model file for ${set.number}.`,
  );
  ensure(
    res.ok,
    "NETWORK_UNAVAILABLE",
    `LDraw.org is unavailable (HTTP ${res.status}). Try again later.`,
  );
  const bytes = new Uint8Array(await res.arrayBuffer());
  ensure(
    bytes.length <= maxBytes,
    "LIMIT_EXCEEDED",
    `${set.number} is ${Math.ceil(bytes.length / 1024 / 1024)} MiB, over this device's import limit.`,
  );
  const text = new TextDecoder().decode(bytes);
  ensure(
    looksLikeLDraw(text),
    "INVALID_INPUT",
    `The file for ${set.number} is not an LDraw model.`,
  );
  await cache
    ?.put(
      url,
      new Response(bytes, {
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      }),
    )
    .catch(() => {}); // Quota: still opens, just not offline.
  return { text, cached: false };
}
