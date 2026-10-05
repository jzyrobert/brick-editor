/** Hash actual resolved pneumatic definitions from the attributed source
 * excerpt and pinned local pack. No network or library edits. */
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { format } from "prettier";
import { importLDraw } from "../src/ldraw/io";
import { directReferences } from "../src/catalog/full-pack";
import {
  fullLibrarySources,
  registerFullLibraryFromDisk,
} from "./full-library-node";
import {
  normalizedPneumaticSource,
  pneumaticProjectSource,
} from "../src/mechanisms/pneumatic-sources";
if (!registerFullLibraryFromDisk()) throw Error("Pinned library unavailable");
const project = importLDraw(
  readFileSync(
    "fixtures/play/mechanical-systems/42043-pneumatic-routing.mpd",
    "utf8",
  ),
);
const port = (id: string, role: string, base: number[], tip: number[]) => ({
  id,
  role,
  base,
  tip,
  radiusLdu: 4,
});
const profiles: Record<
  string,
  { kind: string; ports: ReturnType<typeof port>[] }
> = {
  "165.dat": { kind: "hose-end", ports: [] },
  "166.dat": { kind: "hose-skin", ports: [] },
  "99021.dat": {
    kind: "joiner",
    ports: [
      port("left", "passive", [-4, -20, 0], [-20, -20, 0]),
      port("right", "passive", [4, -20, 0], [20, -20, 0]),
    ],
  },
  "4697b.dat": {
    kind: "tee",
    ports: [
      port("branch", "passive", [0, 4, 0], [0, 20, 0]),
      port("left", "passive", [0, 0, -4], [0, 0, -20]),
      port("right", "passive", [0, 0, 4], [0, 0, 20]),
    ],
  },
  "2947.dat": {
    kind: "cylinder",
    ports: [
      port("base", "base", [0, -10, -10], [0, -10, -26]),
      port("cap", "cap", [0, -60, -10], [0, -60, -26]),
    ],
  },
  "42043 - 19466c01.dat": {
    kind: "cylinder",
    ports: [
      port("base", "base", [0, -20, -18], [0, -20, -36]),
      port("cap", "cap", [0, -168, -19], [0, -168, -36]),
    ],
  },
  "42043 - u9145c01.dat": {
    kind: "cylinder",
    ports: [
      port("base", "base", [0, -10, -9], [0, -10, -26]),
      port("cap", "cap", [0, -170, -10], [0, -170, -26]),
    ],
  },
  "42043 - 2943-v2.dat": {
    kind: "pump",
    ports: [port("outlet", "pump", [0, -10, -9], [0, -10, -26])],
  },
  "42043 - 47223-v2-p1.dat": {
    kind: "valve",
    ports: [
      port("supply", "supply", [10, 0, -24], [26, 0, -24]),
      port("workA", "workA", [10, 11, -30], [26, 11, -30]),
      port("workB", "workB", [10, -11, -30], [26, -11, -30]),
    ],
  },
};
const official = new Set<string>();
const visit = (ref: string, seen: Set<string>) => {
  if (seen.has(ref)) return;
  seen.add(ref);
  const own = pneumaticProjectSource(project, ref);
  if (own === undefined) {
    official.add(ref);
    return;
  }
  directReferences(own).forEach((child) => visit(child, seen));
};
Object.keys(profiles).forEach((r) => visit(r, new Set()));
const sources = fullLibrarySources(official),
  hash = (s: string) => createHash("sha256").update(s).digest("hex");
const output: Record<string, unknown> = {};
for (const [root, profile] of Object.entries(profiles)) {
  const seen = new Set<string>(),
    pending = [root];
  while (pending.length) {
    const ref = pending.pop()!;
    if (seen.has(ref)) continue;
    seen.add(ref);
    const text = pneumaticProjectSource(project, ref) ?? sources[ref];
    if (text === undefined) throw Error("Missing source " + ref);
    pending.push(...directReferences(text));
  }
  const rows = [...seen]
    .sort()
    .map((ref) => [
      ref,
      hash(
        normalizedPneumaticSource(
          pneumaticProjectSource(project, ref) ?? sources[ref],
        ),
      ),
    ]);
  output[root] = {
    ...profile,
    files: seen.size,
    closureSha256: hash(JSON.stringify(rows)),
  };
}
const target = "src/mechanisms/pneumatic-sources.json",
  text = await format(JSON.stringify(output), { parser: "json" });
if (process.argv.includes("--check")) {
  if (readFileSync(target, "utf8") !== text)
    throw Error("Pneumatic source manifest needs regeneration");
} else writeFileSync(target, text);
