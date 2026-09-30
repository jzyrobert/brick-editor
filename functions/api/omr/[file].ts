// Cloudflare Pages Function: GET /api/omr/<file>.mpd
//
// A thin, allowlisted proxy for LDraw Official Model Repository model files.
// library.ldraw.org serves them without CORS headers, so the browser cannot
// read them from our origin directly. This forwards only plain OMR model file
// names to https://library.ldraw.org/library/omr/<file>, unmodified (each file
// keeps its author and CC BY 2.0 licence header), and caches them at the edge
// so repeated opens do not reach ldraw.org. Nothing else is proxied.
// See docs/OFFICIAL-MODELS.md.
import {
  OMR_UPSTREAM,
  looksLikeLDraw,
  omrFileAllowed,
} from "../../../src/catalog/omr";

/** Largest file forwarded (the biggest OMR models are a few MiB). */
const MAX_BYTES = 16 * 1024 * 1024;
/** Edge cache lifetime: OMR files change rarely. */
const EDGE_TTL = 7 * 24 * 3600;
const USER_AGENT = "brick-editor OMR proxy (+https://bricks.robertj.in)";

type Context = {
  request: Request;
  params: { file?: string | string[] };
  waitUntil(promise: Promise<unknown>): void;
};
// Workers runtime globals (not in the DOM lib types).
declare const caches: CacheStorage & { default: Cache };

const reply = (status: number, message: string) =>
  new Response(message + "\n", {
    status,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });

export async function onRequest(context: Context): Promise<Response> {
  const { request } = context;
  if (request.method !== "GET" && request.method !== "HEAD")
    return reply(405, "Method not allowed");
  const file = context.params.file;
  if (typeof file !== "string" || !omrFileAllowed(file))
    return reply(404, "Not an OMR model file name");
  const url = new URL(request.url);
  if (url.search) return reply(404, "No query parameters");

  // Edge cache keyed by our own URL, so only one request per colo and week
  // reaches ldraw.org for a file.
  const cache = caches.default;
  const key = new Request(url.origin + url.pathname, { method: "GET" });
  const hit = await cache.match(key);
  if (hit) return request.method === "HEAD" ? new Response(null, hit) : hit;

  let upstream: Response;
  try {
    upstream = await fetch(OMR_UPSTREAM + encodeURIComponent(file), {
      headers: { "User-Agent": USER_AGENT, Accept: "text/plain,*/*" },
      // Workers do not support "error"; a redirect is answered as !ok below.
      redirect: "manual",
    });
  } catch {
    return reply(502, "LDraw.org is unreachable");
  }
  if (upstream.status === 404) return reply(404, "No such OMR model");
  if (!upstream.ok) return reply(502, `LDraw.org answered ${upstream.status}`);
  const length = Number(upstream.headers.get("Content-Length") ?? 0);
  if (length > MAX_BYTES) return reply(502, "Model file too large");
  const bytes = await upstream.arrayBuffer();
  if (bytes.byteLength > MAX_BYTES) return reply(502, "Model file too large");
  if (!looksLikeLDraw(new TextDecoder().decode(bytes.slice(0, 4096))))
    return reply(502, "Upstream did not return an LDraw file");

  const response = new Response(bytes, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": `public, max-age=86400, s-maxage=${EDGE_TTL}`,
      "Content-Security-Policy": "default-src 'none'; sandbox",
      "X-Content-Type-Options": "nosniff",
      "X-OMR-Source": OMR_UPSTREAM + file,
      ...(upstream.headers.get("Last-Modified")
        ? { "Last-Modified": upstream.headers.get("Last-Modified")! }
        : {}),
    },
  });
  context.waitUntil(cache.put(key, response.clone()));
  return request.method === "HEAD" ? new Response(null, response) : response;
}
