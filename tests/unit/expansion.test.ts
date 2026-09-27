import { expect, it } from "vitest";
import { estimateExpansion } from "../../src/core/expansion";
import { createProject, occurrences } from "../../src/core/document";
import { identity } from "../../src/core/math";
import type { Node, Project } from "../../src/core/types";

function node(id: string, ref = "3001.dat", kind: Node["kind"] = "part"): Node {
  return { id, ref, kind, transform: identity(), colorCode: "4" };
}
function model(p: Project, id: string, nodes: Node[]) {
  p.models[id] = {
    id,
    name: id + ".ldr",
    classification: "model",
    nodes,
    records: [],
  };
}
function project() {
  const p = createProject();
  p.models = {};
  p.rootModelId = "root";
  return p;
}
it("matches actual small shared expansion and all intermediate JSON paths", () => {
  const p = project();
  model(p, "root", [
    node('quote"\\\0', "child", "submodel"),
    node("😀", "child", "submodel"),
    node("opaque", "physical"),
  ]);
  model(p, "child", [node("😀".repeat(3)), node("\n\t", "child", "geometry")]);
  // A physical part's internals are intentionally not expanded or inspected.
  model(p, "physical", [node("internal", "absent", "submodel")]);
  const all = occurrences(p);
  const result = estimateExpansion(p);
  const intermediate = p.models.root.nodes
    .filter((n) => n.kind === "submodel")
    .map((n) => JSON.stringify([n.id]).length);
  expect(result.metrics).toEqual({
    leafCount: all.length,
    visitedNodes: 7,
    maxDepth: 2,
    referenceDepth: 2,
    retainedIdCharacters: all.reduce((n, o) => n + o.id.length, 0),
    generatedIdCharacters:
      all.reduce((n, o) => n + o.id.length, 0) +
      intermediate.reduce((a, b) => a + b, 0),
    pathSlots: all.reduce((n, o) => n + o.path.length, 0),
  });
  expect(Object.values(result.saturated)).not.toContain(true);
});
it("estimates the 109-node hostile DAG without materializing its 100k long paths", () => {
  const p = project();
  p.rootModelId = "m0";
  for (let i = 0; i < 64; i++) {
    const nodes =
      i < 59
        ? [node("\0".repeat(1024), `m${i + 1}`, "submodel")]
        : Array.from({ length: 10 }, (_, j) =>
            node(
              `00000000-0000-0000-0000-${String(j).padStart(12, "0")}`,
              i === 63 ? "3001.dat" : `m${i + 1}`,
              i === 63 ? "part" : "submodel",
            ),
          );
    model(p, `m${i}`, nodes);
  }
  expect(Object.values(p.models).reduce((n, m) => n + m.nodes.length, 0)).toBe(
    109,
  );
  const result = estimateExpansion(p);
  expect(result.metrics).toMatchObject({
    leafCount: 100000,
    visitedNodes: 111169,
    maxDepth: 64,
    referenceDepth: 64,
    retainedIdCharacters: 36286900000,
    pathSlots: 6400000,
  });
  expect(Object.values(result.saturated)).not.toContain(true);
  const limited = estimateExpansion(p, {
    ceilings: { leafCount: 20, retainedIdCharacters: 1000 },
  });
  expect(limited.metrics.leafCount).toBe(21);
  expect(limited.metrics.retainedIdCharacters).toBe(1001);
  expect(limited.saturated.leafCount).toBe(true);
  expect(limited.metrics.pathSlots).toBe(6400000);
});
it("saturates exponential sharing with independent exact boundary flags", () => {
  const p = project();
  p.rootModelId = "m0";
  for (let i = 0; i < 64; i++)
    model(
      p,
      `m${i}`,
      [0, 1].map((j) =>
        node(
          String(j),
          i === 63 ? "3001.dat" : `m${i + 1}`,
          i === 63 ? "part" : "submodel",
        ),
      ),
    );
  const result = estimateExpansion(p);
  expect(result.metrics.leafCount).toBe(Number.MAX_SAFE_INTEGER);
  expect(result.saturated.leafCount).toBe(true);
  expect(result.metrics.maxDepth).toBe(64);
  model(p, "root", [node("a")]);
  p.rootModelId = "root";
  const exact = estimateExpansion(p, {
    ceilings: {
      leafCount: 1,
      retainedIdCharacters: 5,
      generatedIdCharacters: 4,
    },
  });
  expect(exact.saturated.leafCount).toBe(false);
  expect(exact.saturated.retainedIdCharacters).toBe(false);
  expect(exact.saturated.generatedIdCharacters).toBe(true);
  expect(exact.metrics.generatedIdCharacters).toBe(5);
  for (const limit of [-1, 0.5, Infinity, Number.MAX_SAFE_INTEGER])
    expect(() =>
      estimateExpansion(p, { ceilings: { leafCount: limit } }),
    ).toThrow();
});
it("handles empty models and rejects missing references, cycles and depth overflow even through memoized subgraphs", () => {
  const p = project();
  model(p, "root", []);
  expect(estimateExpansion(p).metrics).toEqual({
    leafCount: 0,
    visitedNodes: 0,
    maxDepth: 0,
    referenceDepth: 1,
    retainedIdCharacters: 0,
    generatedIdCharacters: 0,
    pathSlots: 0,
  });
  model(p, "root", [node("empty", "empty", "submodel")]);
  model(p, "empty", []);
  expect(estimateExpansion(p).metrics).toMatchObject({
    leafCount: 0,
    visitedNodes: 1,
    maxDepth: 1,
    referenceDepth: 2,
    generatedIdCharacters: 9,
  });
  delete p.models.empty;
  expect(() => estimateExpansion(p)).toThrow(/Missing submodel/);
  model(p, "empty", [node("cycle", "root", "submodel")]);
  expect(() => estimateExpansion(p)).toThrow(/Cyclic/);
  // First visit and cache the suffix shallowly, then reach it through 63 edges.
  model(p, "suffix", [node("part")]);
  for (let i = 0; i < 63; i++)
    model(p, `d${i}`, [
      node("next", i === 62 ? "suffix" : `d${i + 1}`, "submodel"),
    ]);
  model(p, "root", [
    node("short", "suffix", "submodel"),
    node("long", "d0", "submodel"),
  ]);
  expect(() => estimateExpansion(p)).toThrow(/depth exceeds 64/);
  p.models.root.nodes.pop();
  expect(estimateExpansion(p).metrics.referenceDepth).toBe(2);
});
