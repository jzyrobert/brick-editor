import { expect, it } from "vitest";
import {
  createProject,
  occurrences,
  validateDocument,
} from "../../src/core/document";
import { identity } from "../../src/core/math";
import type { Node } from "../../src/core/types";
import {
  expansionLimits,
  EXPANSION_PROFILES,
} from "../../src/core/expansion-policy";
function part(id: string): Node {
  return {
    id,
    kind: "part",
    ref: "3001.dat",
    colorCode: "4",
    transform: identity(),
  };
}
function failure(run: () => unknown) {
  try {
    run();
  } catch (error) {
    return error as {
      code: string;
      details: { resource: string; phase: string };
    };
  }
  throw Error("Expected resource rejection");
}
it("accepts exact boundaries and distinguishes each exceeded derived budget before expansion", () => {
  const p = createProject();
  p.models.root.nodes = [part("a"), part("b")];
  const exact = {
    leafCount: 2,
    visitedNodes: 2,
    maxDepth: 1,
    referenceDepth: 1,
    retainedIdCharacters: 10,
    generatedIdCharacters: 10,
    pathSlots: 2,
  };
  expect(occurrences(p, { limits: exact })).toHaveLength(2);
  for (const resource of Object.keys(exact) as (keyof typeof exact)[]) {
    const error = failure(() =>
      occurrences(p, { limits: { ...exact, [resource]: exact[resource] - 1 } }),
    );
    expect(error.code).toBe("LIMIT_EXCEEDED");
    expect(error.details).toMatchObject({ resource, phase: "preflight" });
  }
  expect(p.revision).toBe(0);
  expect(p.models.root.nodes.map((n) => n.id)).toEqual(["a", "b"]);
});
it("refuses the small hostile source before touching any occurrence transform", () => {
  const p = createProject();
  p.models = {};
  p.rootModelId = "m0";
  for (let i = 0; i < 64; i++) {
    const ids =
      i < 59
        ? ["\0".repeat(1024)]
        : Array.from(
            { length: 10 },
            (_, j) => `00000000-0000-0000-0000-${String(j).padStart(12, "0")}`,
          );
    p.models[`m${i}`] = {
      id: `m${i}`,
      name: `m${i}.ldr`,
      classification: "model",
      records: [],
      nodes: ids.map((id) => ({
        ...part(id),
        kind: i === 63 ? "part" : "submodel",
        ref: i === 63 ? "3001.dat" : `m${i + 1}`,
      })),
    };
  }
  Object.defineProperty(p.models.m0.nodes[0], "transform", {
    get() {
      throw Error("Expansion must not begin");
    },
  });
  const error = failure(() => occurrences(p));
  expect(error.code).toBe("LIMIT_EXCEEDED");
  expect(error.details).toMatchObject({
    resource: "retainedIdCharacters",
    phase: "preflight",
  });
  // Source-only validation is intentionally not decoupled in this checkpoint.
  Object.defineProperty(p.models.m0.nodes[0], "transform", {
    value: identity(),
  });
  expect(() => validateDocument(p)).toThrow(/derived resource budget/);
});
it("charges traversal before constructing over-budget paths even if source changes after preflight", () => {
  const p = createProject();
  const first = part("a"),
    second = part("b");
  p.models.root.nodes = [first, second];
  Object.defineProperty(first, "transform", {
    get() {
      second.id = "b".repeat(100);
      return identity();
    },
  });
  const error = failure(() =>
    occurrences(p, { limits: { generatedIdCharacters: 10 } }),
  );
  expect(error.details).toMatchObject({
    resource: "generatedIdCharacters",
    phase: "traversal",
  });
});
it("keeps desktop 200k flat support and mobile count limits independent of imported metadata", () => {
  const p = createProject();
  p.models.root.nodes = Array.from({ length: 200000 }, (_, i) =>
    part(`00000000-0000-0000-0000-${String(i).padStart(12, "0")}`),
  );
  expect(occurrences(p)).toHaveLength(200000);
  p.metadata.expansionOptions = {
    profile: "desktop",
    acknowledgeDerivedImpact: true,
  };
  expect(
    failure(() => occurrences(p, { profile: "mobile" })).details.resource,
  ).toBe("leafCount");
  expect(
    occurrences(p, {
      limits: { retainedIdCharacters: 256 * 1024 * 1024 },
      acknowledgeDerivedImpact: true,
    }),
  ).toHaveLength(200000);
});
it("requires bounded acknowledged desktop overrides, never raising structural caps", () => {
  const raised = EXPANSION_PROFILES.desktop.retainedIdCharacters + 1;
  expect(() =>
    expansionLimits({ limits: { retainedIdCharacters: raised } }),
  ).toThrow(/acknowledged/);
  expect(
    expansionLimits({
      limits: { retainedIdCharacters: raised },
      acknowledgeDerivedImpact: true,
    }).retainedIdCharacters,
  ).toBe(raised);
  expect(() =>
    expansionLimits({
      profile: "mobile",
      limits: { leafCount: 150001 },
      acknowledgeDerivedImpact: true,
    }),
  ).toThrow(/acknowledged/);
  for (const limits of [
    { leafCount: 200001 },
    { visitedNodes: 400001 },
    { maxDepth: 65 },
    { referenceDepth: 65 },
    { retainedIdCharacters: 512 * 1024 * 1024 + 1 },
    { pathSlots: -1 },
  ])
    expect(() =>
      expansionLimits({ limits, acknowledgeDerivedImpact: true }),
    ).toThrow(/Invalid or excessive/);
});
