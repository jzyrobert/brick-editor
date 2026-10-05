import { directReferences } from "../catalog/full-pack";
import { sha256 } from "../core/hash";
import { ensure, type Project } from "../core/types";

export type ReviewedSourceManifest = Readonly<
  Record<
    string,
    {
      files: number;
      closureSha256: string;
    }
  >
>;
export type ReviewedSourceOptions = { project?: Pick<Project, "models"> };
/** Verify the actual resolved literal dependency bytes once, with bounded shared
 * work across all requested profiles. Product callers pass the authoritative
 * project too: independently loading clean library bytes cannot bypass an MPD
 * which shadows a dependency used by the renderer. No geometry is rewritten. */
export async function verifyReviewedSourceClosures(
  sources: Readonly<Record<string, string>>,
  manifest: ReviewedSourceManifest,
  refs: readonly string[],
  options: ReviewedSourceOptions = {},
): Promise<readonly string[]> {
  ensure(
    refs.length <= 32,
    "RESOURCE_LIMIT",
    "Too many reviewed source profiles.",
  );
  const shadows = new Set(
    Object.entries(options.project?.models ?? {})
      .flatMap(([id, model]) => [id, model.name])
      .map((ref) => ref.toLowerCase().replaceAll("\\", "/")),
  );
  const hashes = new Map<string, Promise<string>>();
  let bytes = 0;
  const verified = new Set<string>();
  for (const root of new Set(refs)) {
    ensure(
      Object.hasOwn(manifest, root),
      "INVALID_INPUT",
      "Unreviewed source profile.",
    );
    const seen = new Set<string>(),
      pending = [root as string];
    while (pending.length) {
      const ref = pending.pop()!;
      if (seen.has(ref)) continue;
      seen.add(ref);
      ensure(
        !shadows.has(ref),
        "INVALID_INPUT",
        "Project shadows reviewed source: " + ref,
      );
      const text = sources[ref];
      ensure(
        typeof text === "string",
        "INVALID_INPUT",
        "Missing reviewed source: " + ref,
      );
      if (!hashes.has(ref)) {
        bytes += text.length;
        ensure(
          hashes.size < 1024 && bytes <= 8_000_000,
          "RESOURCE_LIMIT",
          "Reviewed source verification budget exceeded.",
        );
        hashes.set(ref, sha256(text));
      }
      pending.push(...directReferences(text));
    }
    const rows = await Promise.all(
      [...seen].sort().map(async (ref) => [ref, await hashes.get(ref)!]),
    );
    const expected = manifest[root];
    ensure(
      seen.size === expected.files &&
        (await sha256(JSON.stringify(rows))) === expected.closureSha256,
      "INVALID_INPUT",
      "Reviewed source geometry changed: " + root,
    );
    verified.add(root);
  }
  return Object.freeze([...verified]);
}
