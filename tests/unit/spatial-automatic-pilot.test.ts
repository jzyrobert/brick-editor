import { expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  validateManifest,
  schedule,
  effectivePrompt,
} from "../../scripts/spatial-benchmark/manifest";
import { registerFullLibraryFromDisk } from "../../scripts/full-library-node";
import { registerAgentData } from "../../scripts/build-script-cli";
import { compileBuildScript } from "../../src/build-script/compile";
import {
  inspectCalibration,
  type Witness,
} from "../../scripts/spatial-benchmark/calibration-evaluator";
const root = "fixtures/spatial-benchmark/";
const load = (p: string) => JSON.parse(readFileSync(root + p, "utf8"));
registerFullLibraryFromDisk();
registerAgentData();
it("freezes 32 automatic-exposure cases with isolated fact fields and identical controls", () => {
  const m = validateManifest(
    load("studies/automatic-facts-pilot/manifest.json"),
  );
  const cases = schedule(m);
  expect(cases).toHaveLength(32);
  expect(schedule(m)).toEqual(cases);
  for (const c of cases) {
    const prompt = effectivePrompt(m, c);
    expect(prompt.includes('"shape":')).toBe(
      c.condition.facts.includes("shape"),
    );
    expect(prompt.includes('"connectors":')).toBe(
      c.condition.facts.includes("connectors"),
    );
    if (c.condition.id === "control")
      expect(prompt).toBe(
        effectivePrompt(m, {
          ...c,
          condition: { ...c.condition, exposure: "on-demand" },
        }),
      );
    expect(Buffer.byteLength(prompt)).toBeLessThan(m.budgets.referenceBytes);
  }
});
it("independently checks combined four-part relationships and detects perturbations", () => {
  for (const w of load(
    "evaluator/automatic-facts/relationships.json",
  ) as Witness[]) {
    const script = {
      buildScript: 1,
      title: w.task,
      sections: [
        {
          name: "witness",
          ops: w.places.map((p) => ({ op: "place", ...p, colour: 4 })),
        },
      ],
    };
    const result = inspectCalibration(
      compileBuildScript(script).ldraw,
      w,
      "any",
    );
    expect(
      result.records.every((r) => r.status === "verified"),
      JSON.stringify(result),
    ).toBe(true);
    script.sections[0].ops[w.perturb.index].at = w.perturb.at;
    const bad = inspectCalibration(compileBuildScript(script).ldraw, w, "any");
    expect(bad.records.some((r) => r.status === "invalid")).toBe(true);
    expect(
      bad.records.find((r) => r.property === "supported-contact-count")
        ?.observed,
    ).toBe(w.perturbedContacts);
    expect(
      bad.records.find((r) => r.property === "surface-occupancy-intersection")
        ?.observed,
    ).toBe(w.perturbedOverlaps);
  }
});
it("compiles each 16-part feasibility sketch inside the declared inventory", () => {
  const m = validateManifest(
    load("studies/automatic-facts-pilot/manifest.json"),
  );
  for (const task of m.tasks) {
    const script = load("evaluator/automatic-facts/" + task.id + ".json");
    const ops = script.sections[0].ops;
    expect(ops).toHaveLength(16);
    const counts: Record<string, number> = {};
    for (const op of ops)
      counts[op.part + ".dat"] = (counts[op.part + ".dat"] ?? 0) + 1;
    for (const [ref, count] of Object.entries(counts))
      expect(count).toBeLessThanOrEqual(task.inventory![ref]);
    const compiled = compileBuildScript(script);
    expect(compiled.ldraw).toContain(".dat");
  }
});

it("excludes invalid compiled artifacts only under the declared review policy", async () => {
  const { reviewEligible } = await import(
    "../../scripts/spatial-benchmark/analysis"
  );
  expect(reviewEligible("submitted", "submitted-only")).toBe(true);
  expect(reviewEligible("model-failure", "submitted-only")).toBe(false);
  expect(reviewEligible("infrastructure-failure", "submitted-only")).toBe(
    false,
  );
  expect(reviewEligible("model-failure")).toBe(true);
  expect(() => reviewEligible("submitted", "unknown")).toThrow();
});

it("screens both requested models with the identical Sol inputs and two fact arms", () => {
  const base = validateManifest(
    load("studies/automatic-facts-pilot/manifest.json"),
  );
  const controls = schedule(base);
  for (const name of ["luna", "astra"]) {
    const m = validateManifest(
      load(`studies/model-screening-pilot/${name}.json`),
    );
    expect(m.model).toMatchObject({
      id: `gpt-6-${name}`,
      effort: name === "luna" ? "high" : "medium",
    });
    expect(m.tasks).toEqual(base.tasks);
    expect(m.budgets).toEqual(base.budgets);
    expect(m.conditions.map((c) => c.id)).toEqual(["control", "combined"]);
    expect(schedule(m)).toHaveLength(16);
    for (const c of schedule(m)) {
      const original = controls.find((x) => x.id === c.id)!;
      expect(effectivePrompt(m, c)).toBe(effectivePrompt(base, original));
    }
  }
});
