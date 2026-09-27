import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Plugin } from "vite";
function publicFiles(path = "public", prefix = ""): string[] {
  return readdirSync(path, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory()
      ? publicFiles(join(path, e.name), prefix + e.name + "/")
      : [prefix + e.name],
  );
}
/** Emits an opt-in, immutable app/library snapshot. Old snapshots are never silently evicted. */
export function offlinePlugin(): Plugin {
  return {
    name: "offline-snapshot",
    apply: "build",
    enforce: "post",
    generateBundle(_options, bundle) {
      const files = publicFiles();
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
      const version = hash.digest("hex").slice(0, 20),
        paths = [...new Set(["index.html", ...assets, ...files])];
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
