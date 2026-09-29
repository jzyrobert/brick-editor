import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { shardOf } from "../src/catalog/full-connector-pack";
import { join } from "node:path";
import type { Plugin } from "vite";
function publicFiles(path = "public", prefix = ""): string[] {
  return readdirSync(path, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory()
      ? publicFiles(join(path, e.name), prefix + e.name + "/")
      : [prefix + e.name],
  );
}
/**
 * Files of the complete LDraw pack that the built-in template builds need
 * (fixtures/ldraw/templates/*.mpd): the pack index and the chunks holding the
 * closure of every referenced part outside the curated catalogue. Precaching
 * them lets the templates open offline like the rest of the app.
 */
export function templateLibraryFiles(root = "public") {
  const dir = "fixtures/ldraw/templates";
  const refs = new Set<string>();
  for (const file of readdirSync(dir))
    if (file.endsWith(".mpd") || file.endsWith(".ldr"))
      for (const m of readFileSync(join(dir, file), "utf8").matchAll(
        /^\s*1\s+\S+(?:\s+\S+){12}\s+(.+?)\s*$/gm,
      ))
        refs.add(m[1].toLowerCase());
  const curated = new Set(
    Object.keys(
      JSON.parse(readFileSync("src/catalog/data.json", "utf8")).catalog,
    ),
  );
  const libraries = join(root, "libraries");
  // The release this build ships (a retired release may still be on disk).
  const release = JSON.parse(
    readFileSync("src/catalog/full-library-lock.json", "utf8"),
  ).releaseId as string;
  if (!existsSync(join(libraries, release, "manifest.json"))) return [];
  const manifest = JSON.parse(
    readFileSync(join(libraries, release, "manifest.json"), "utf8"),
  );
  const index = JSON.parse(
    readFileSync(join(libraries, release, manifest.index.path), "utf8"),
  ) as {
    chunks: [string, number, string[], number[]][];
    parts: Record<string, [number[], unknown]>;
  };
  const chunks = new Set<number>();
  for (const ref of refs)
    if (!curated.has(ref))
      for (const c of index.parts[ref]?.[0] ?? []) chunks.add(c);
  if (!chunks.size) return [];
  const base = `libraries/${release}/`;
  // The derived connector shards of those parts (health and snapping offline).
  const connectorLock = JSON.parse(
    readFileSync("src/catalog/full-connectors-lock.json", "utf8"),
  ) as { connectorPackId: string };
  const connectorDir = join(libraries, connectorLock.connectorPackId);
  const shards: string[] = [];
  if (existsSync(join(connectorDir, "manifest.json"))) {
    const m = JSON.parse(
      readFileSync(join(connectorDir, "manifest.json"), "utf8"),
    ) as { shards: [string, number, number][] };
    const wanted = new Set<number>();
    for (const ref of refs)
      if (!curated.has(ref) && index.parts[ref])
        wanted.add(shardOf(ref, m.shards.length));
    for (const s of [...wanted].sort((a, b) => a - b))
      shards.push(
        `libraries/${connectorLock.connectorPackId}/shards/${m.shards[s][0]}.bin`,
      );
  }
  return [
    base + manifest.index.path,
    ...[...chunks]
      .sort((a, b) => a - b)
      .map((c) => `${base}chunks/${index.chunks[c][0]}.bin`),
    ...shards,
  ];
}

/** Emits an opt-in, immutable app/library snapshot. Old snapshots are never
 * silently evicted. The complete LDraw pack is excluded (cached on demand),
 * except the few files the built-in templates need. */
export function offlinePlugin(): Plugin {
  return {
    name: "offline-snapshot",
    apply: "build",
    enforce: "post",
    generateBundle(_options, bundle) {
      // The complete LDraw pack (~90 MB) and its derived connector pack are never precached: the app loads and
      // caches the parts a model uses on demand (src/catalog/full-library-loader.ts).
      // Its content-addressed files are all pinned by its manifest, so hashing
      // the manifest alone versions it.
      const full = /^libraries\/(connectors-)?ldraw-full-[^/]+\//;
      const files = publicFiles().filter(
        (f) => !full.test(f) || f.endsWith("/manifest.json"),
      );
      const assets = Object.keys(bundle);
      const hash = createHash("sha256");
      for (const key of assets.sort()) {
        const entry = bundle[key];
        hash.update(key);
        hash.update(entry.type === "chunk" ? entry.code : entry.source);
      }
      for (const file of files.sort()) {
        hash.update(file);
        hash.update(readFileSync(join("public", file)));
      }
      const templateFiles = templateLibraryFiles();
      hash.update(templateFiles.join("\n"));
      const version = hash.digest("hex").slice(0, 20),
        paths = [
          ...new Set([
            "index.html",
            ...assets,
            ...files.filter((f) => !full.test(f)),
            ...templateFiles,
          ]),
        ];
      const source = `const VERSION=${JSON.stringify(version)};\nconst PATHS=${JSON.stringify(paths)};\nconst CACHE='brick-editor-offline:'+self.registration.scope+':'+VERSION;\nself.addEventListener('install',event=>{event.waitUntil((async()=>{const cache=await caches.open(CACHE);try{await cache.addAll(PATHS.map(p=>new URL(p,self.registration.scope).href));}catch(error){await caches.delete(CACHE);throw error;}})());});\nself.addEventListener('activate',event=>{event.waitUntil(self.clients.claim());});\nself.addEventListener('message',event=>{if(event.data?.type==='ACTIVATE_OFFLINE_UPDATE')self.skipWaiting();});\nself.addEventListener('fetch',event=>{if(event.request.method!=='GET')return;const url=new URL(event.request.url);if(!url.href.startsWith(self.registration.scope))return;event.respondWith((async()=>{const cache=await caches.open(CACHE);const key=event.request.mode==='navigate'?new URL('index.html',self.registration.scope).href:event.request;return await cache.match(key,{ignoreVary:true})||fetch(event.request);})());});\n`;
      this.emitFile({ type: "asset", fileName: "service-worker.js", source });
      this.emitFile({
        type: "asset",
        fileName: "offline-manifest.json",
        source: JSON.stringify(
          {
            version,
            files: paths,
            policy:
              "Explicit install/update; previous app and library snapshots are retained.",
          },
          null,
          2,
        ),
      });
    },
  };
}
