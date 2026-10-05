import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import { directReferences } from "../../src/catalog/full-pack";
import {
  fullLibrarySources,
  registerFullLibraryFromDisk,
} from "../../scripts/full-library-node";
import { importLDraw, exportLDraw } from "../../src/ldraw/io";
import { occurrences } from "../../src/core/document";
import {
  bindPneumaticSources,
  isPreparedPneumaticTopology,
  sourcePneumaticTopology,
} from "../../src/mechanisms/pneumatic-sources";
import manifest from "../../src/mechanisms/pneumatic-sources.json";

const text = readFileSync(
    "fixtures/play/mechanical-systems/42043-pneumatic-routing.mpd",
    "utf8",
  ),
  refs = Object.keys(manifest);
let sources: Record<string, string>;
beforeAll(() => {
  registerFullLibraryFromDisk();
  const project = importLDraw(text),
    official = new Set<string>();
  for (const model of Object.values(project.models))
    for (const ref of directReferences(
      model.records.map((r) => r.raw).join("\n"),
    ))
      if (!project.models[ref]) official.add(ref);
  sources = fullLibrarySources([...official, "165.dat", "166.dat"]);
});
const connected = (
  passages: readonly (readonly [string, string])[],
  start: string,
) => {
  const result = new Set([start]);
  for (let previous = -1; previous !== result.size; ) {
    previous = result.size;
    for (const [a, b] of passages)
      if (result.has(a) || result.has(b)) {
        result.add(a);
        result.add(b);
      }
  }
  return result;
};
describe("actual source pneumatic routing", () => {
  it("binds all28 literal hoses and56 exact ports without flattening valves or cylinder chambers into one line", async () => {
    const project = importLDraw(text),
      original = JSON.stringify(project),
      exported = exportLDraw(project),
      all = occurrences(project);
    const binding = await bindPneumaticSources(project, sources, refs),
      topology = sourcePneumaticTopology(project, binding, all);
    expect(topology.ports).toHaveLength(56);
    expect(topology.hoses).toHaveLength(28);
    expect(topology.valves).toHaveLength(4);
    expect(topology.cylinders).toHaveLength(4);
    expect(topology.pumps).toHaveLength(1);
    expect(topology.passages).toHaveLength(47);
    expect(new Set(topology.hoses.flatMap((h) => h.ports)).size).toBe(56);
    expect(new Set(topology.hoses.flatMap((h) => h.capIds)).size).toBe(56);
    expect(
      topology.hoses.every(
        (h) =>
          h.occurrenceIds.length > 2 &&
          h.fits.every((f) => f.radialLdu <= 0.15 && f.insertionLdu >= 8),
      ),
    ).toBe(true);
    const supply = connected(topology.passages, topology.pumps[0].outlet);
    expect(supply.size).toBe(16);
    expect(
      topology.valves.every(
        (v) =>
          supply.has(v.supply) && !supply.has(v.workA) && !supply.has(v.workB),
      ),
    ).toBe(true);
    // Four independent double-acting functions, including the real inverse
    // cap/base plumbing. No assumption that workA always means rod extension.
    const pairs = topology.valves.map((v) => {
      const a = connected(topology.passages, v.workA),
        b = connected(topology.passages, v.workB);
      expect(a.has(v.workB)).toBe(false);
      const matched = topology.cylinders.filter(
        (c) =>
          (a.has(c.base) && b.has(c.cap)) || (a.has(c.cap) && b.has(c.base)),
      );
      expect(matched).toHaveLength(1);
      return matched[0].id;
    });
    expect(new Set(pairs).size).toBe(4);
    expect(Object.isFrozen(topology)).toBe(true);
    expect(Object.isFrozen(topology.ports[0].tip)).toBe(true);
    expect(isPreparedPneumaticTopology(project, topology)).toBe(true);
    expect(
      isPreparedPneumaticTopology(project, structuredClone(topology)),
    ).toBe(false);
    expect(JSON.stringify(project)).toBe(original);
    expect(exportLDraw(project)).toBe(exported);
  });
  it("refuses altered embedded dependencies and library shadows despite unchanged part names", async () => {
    const project = importLDraw(text),
      dependency = project.models["42043 - 47222-v2.dat"];
    const record = dependency.records.find((r) => r.raw.startsWith("1 "))!;
    record.raw = record.raw.replace("1 16 ", "1 0 ");
    await expect(bindPneumaticSources(project, sources, refs)).rejects.toThrow(
      /source changed/,
    );
    const shadow = importLDraw(
      text +
        "\n0 FILE165.dat\n0 Fake tube end\n1 16 0 0 0 1 0 0 0 1 0 0 0 1 3001.dat\n".replace(
          "FILE165",
          "FILE 165",
        ),
    );
    await expect(
      bindPneumaticSources(
        shadow,
        { ...sources, ...fullLibrarySources(["3001.dat"]) },
        refs,
      ),
    ).rejects.toThrow(/source changed/);
  });
  it("refuses stale placement edits and an unseated end after a fresh source review", async () => {
    const project = importLDraw(text),
      binding = await bindPneumaticSources(project, sources, refs);
    const node = project.models[project.rootModelId].nodes.find(
      (n) => n.ref === "99021.dat",
    )!;
    node.transform.position[0] += 4;
    expect(() => sourcePneumaticTopology(project, binding)).toThrow(/Reload/);
    const rebound = await bindPneumaticSources(project, sources, refs);
    expect(() => sourcePneumaticTopology(project, rebound)).toThrow(
      /not seated/,
    );
  });
  it("refuses ambiguous duplicated fittings and incomplete source ends atomically", async () => {
    const line = text
      .split("\n")
      .find((l) => l.startsWith("1 ") && l.endsWith("99021.dat"))!;
    const duplicate = importLDraw(text.replace(line, line + "\n" + line));
    const binding = await bindPneumaticSources(duplicate, sources, refs);
    expect(() => sourcePneumaticTopology(duplicate, binding)).toThrow(
      /more than one port/,
    );
    const missing = importLDraw(
      text.replace("[group=start]", "[group=missing]"),
    );
    const missingBinding = await bindPneumaticSources(missing, sources, refs);
    expect(() => sourcePneumaticTopology(missing, missingBinding)).toThrow(
      /caps need a start\/end/,
    );
  });
});
