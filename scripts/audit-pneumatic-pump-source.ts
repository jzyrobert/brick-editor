/** Offline maintainer source/renderer binding audit; no downloads or pack edits.
 * --write rebuilds only the reviewed manifest. Source changes still require
 * physical/interface review; a new hash is never automatic runtime admission. */
import { readFileSync, writeFileSync } from "node:fs";
import { directReferences } from "../src/catalog/full-pack";
import { sha256 } from "../src/core/hash";
import {
  normalizedPneumaticSource,
  pneumaticProjectSource,
} from "../src/mechanisms/pneumatic-sources";
import { PNEUMATIC_PUMP_REFS } from "../src/play/pneumatic-pump-source";
import { reviewedGeometryDigest } from "../src/play/reviewed-geometry-binding";
import { pneumaticPumpFixture } from "../tests/helpers/pneumatic-pump-source";
const fixture = await pneumaticPumpFixture(),
  result: Record<
    string,
    {
      files: number;
      closureSha256: string;
      geometrySha256?: string;
      triangles?: number;
    }
  > = {};
for (const [i, root] of [
  ...PNEUMATIC_PUMP_REFS,
  "99798-f1.dat",
  "99798-f2.dat",
].entries()) {
  const seen = new Set<string>(),
    pending = [root as string];
  while (pending.length) {
    const ref = pending.pop()!;
    if (seen.has(ref)) continue;
    seen.add(ref);
    if (seen.size > 1024) throw Error("Source closure budget exhausted");
    const text = normalizedPneumaticSource(
      pneumaticProjectSource(fixture.project, ref) ?? fixture.sources[ref],
    );
    pending.push(...directReferences(text));
  }
  const rows = await Promise.all(
    [...seen]
      .sort()
      .map(async (ref) => [
        ref,
        await sha256(
          normalizedPneumaticSource(
            pneumaticProjectSource(fixture.project, ref) ??
              fixture.sources[ref],
          ),
        ),
      ]),
  );
  result[root] = {
    files: seen.size,
    closureSha256: await sha256(JSON.stringify(rows)),
    ...(i < 4
      ? {
          geometrySha256: await reviewedGeometryDigest(fixture.surfaces[i]),
          triangles: fixture.surfaces[i].indices.length / 3,
        }
      : {}),
  };
  console.log(
    JSON.stringify({
      reference: root,
      sourceFiles: seen.size,
      canonicalVertices:
        i < 4 ? fixture.surfaces[i].vertices.length / 3 : undefined,
      canonicalTriangles:
        i < 4 ? fixture.surfaces[i].indices.length / 3 : undefined,
      ...result[root],
    }),
  );
}
const file = "src/play/pneumatic-pump-source.json";
if (process.argv.includes("--write"))
  writeFileSync(file, JSON.stringify(result, null, 2) + "\n");
else if (
  JSON.stringify(JSON.parse(readFileSync(file, "utf8"))) !==
  JSON.stringify(result)
)
  throw Error(
    "Reviewed pump manifest changed; inspect source and interfaces before rebuilding",
  );
