/**
 * Browser host for build scripts and part search (automation `buildScript.*`
 * and `parts.search`): loads the data they rely on (colour availability, the
 * complete library's index, part names and connector shards) before running
 * the synchronous compiler and search.
 */
import { loadColorAvailability } from "../catalog/color-availability";
import {
  loadFullCatalog,
  loadFullConnectors,
  loadFullLibraryIndex,
} from "../catalog/full-library-loader";
import { curatedHas } from "../catalog/full-library";
import { occurrences } from "../core/document";
import type { ResourceProfileName } from "../core/resource-profile";
import { compileBuildScript, type CompileResult } from "./compile";
export { validateBuildScript } from "./spec";
import {
  registerSearchThumbnails,
  searchParts,
  type PartSearchRequest,
} from "./part-search";
import type { PartThumbnailIndex } from "../catalog/part-thumbnails";
import { partThumbnailsLock } from "../catalog/part-thumbnails";

const quiet = <T>(p: Promise<T>) => p.catch(() => undefined);
let thumbnailsTried = false;

/** Loads what part search needs: colours, names and the library index. */
export async function prepareParts(options: { thumbnails?: boolean } = {}) {
  await Promise.all([
    quiet(loadColorAvailability()),
    quiet(loadFullLibraryIndex().then(() => loadFullCatalog())),
    options.thumbnails && !thumbnailsTried
      ? quiet(
          (async () => {
            thumbnailsTried = true;
            const res = await fetch(
              `${import.meta.env.BASE_URL}thumbnails/${partThumbnailsLock.packId}/index.json`,
            );
            if (res.ok)
              registerSearchThumbnails(
                (await res.json()) as PartThumbnailIndex,
              );
          })(),
        )
      : undefined,
  ]);
}

export async function searchPartsInBrowser(request: PartSearchRequest) {
  await prepareParts({ thumbnails: true });
  let results = searchParts(request);
  // Connector data of complete-library parts loads per shard; fetch the
  // shards of the hits so `verified` is known, then rank again.
  const outside = results.filter((r) => !curatedHas(r.id)).map((r) => r.id);
  if (outside.length || request.connectable) {
    await quiet(
      loadFullConnectors(
        request.connectable
          ? searchParts({ ...request, connectable: false, limit: 200 }).map(
              (r) => r.id,
            )
          : outside,
      ),
    );
    results = searchParts(request);
  }
  return results;
}

/** Compiles in the browser with every referenced part's data loaded. */
export async function compileInBrowser(
  script: unknown,
  options: { profile: ResourceProfileName; check?: boolean },
): Promise<CompileResult> {
  const text = JSON.stringify(script ?? null);
  // Colours always matter (piece choice); the complete library only when
  // the script searches for parts or names parts outside the catalogue.
  await quiet(loadColorAvailability());
  if (/"find"|\.dat"|"[0-9]+[a-z]*[0-9]*"/i.test(text)) await prepareParts();
  const first = compileBuildScript(script, { ...options, check: false });
  if (options.check === false) return first;
  const outside = first.project
    ? [
        ...new Set(
          occurrences(first.project)
            .map((o) => o.node.ref)
            .filter((r) => !curatedHas(r)),
        ),
      ]
    : [];
  if (outside.length) {
    await quiet(loadFullLibraryIndex());
    await quiet(loadFullConnectors(outside));
  }
  return compileBuildScript(script, options);
}
