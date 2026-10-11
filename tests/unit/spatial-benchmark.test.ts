import { expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  validateManifest,
  schedule,
  effectivePrompt,
} from "../../scripts/spatial-benchmark/manifest";
import { oneShotPrompt } from "../../scripts/one-shot-build";
import { compileBuildScript } from "../../src/build-script/compile";
import {
  inspectCalibration,
  type Witness,
} from "../../scripts/spatial-benchmark/calibration-evaluator";
import { registerAgentData } from "../../scripts/build-script-cli";
import { registerFullLibraryFromDisk } from "../../scripts/full-library-node";
const load = (name: string) =>
  JSON.parse(
    readFileSync(`fixtures/spatial-benchmark/manifests/${name}.json`, "utf8"),
  );
it("validates all declared schedules and preserves unchanged E control input", () => {
  for (const name of [
    "calibration",
    "calibration-alias",
    "calibration-facts",
    "calibration-exposure",
    "facts-factorial",
    "feedback",
  ])
    expect(validateManifest(load(name)).version).toBe("spatial-benchmark/1");
  const m = validateManifest(load("facts-factorial"));
  const c = schedule(m).find((c) => c.condition.id === "control")!;
  expect(effectivePrompt(m, c)).toBe(
    oneShotPrompt(c.task.brief, c.task.targetParts, {
      search: true,
      check: true,
    }),
  );
  expect(schedule(m)).toEqual(schedule(m));
  expect(schedule(m)).toHaveLength(48);
});
it("rejects observation conflicts, image/native/resume options and malformed manifests", () => {
  for (const key of [
    "images",
    "reference",
    "revision",
    "resume",
    "nativeTools",
    "network",
  ]) {
    const m = load("calibration");
    m[key] = [];
    expect(() => validateManifest(m)).toThrow(/forbidden/);
  }
  for (const key of ["checks", "repairs"]) {
    const m = load("calibration");
    m.budgets[key] = 1;
    expect(() => validateManifest(m)).toThrow(/forbids/);
  }
  const m = load("calibration");
  m.tasks[0].id = "../evaluator";
  expect(() => validateManifest(m)).toThrow();
  const n = load("calibration");
  n.conditions[0].facts = ["shape", "shortcut-assemblies"];
  expect(() => validateManifest(n)).toThrow();
  const a = load("calibration-alias");
  a.tasks[0].aliases.p2 = "3039.dat";
  expect(() => validateManifest(a)).toThrow();
});
it("isolates factorial field guides and does not bundle shortcut evidence", () => {
  const m = validateManifest(load("facts-factorial"));
  const shape = schedule(m).find((c) => c.condition.id === "shape")!,
    connections = schedule(m).find((c) => c.condition.id === "connections")!;
  const p = effectivePrompt(m, shape);
  expect(p).toContain("Shape facts v1");
  expect(p).not.toContain("Connector facts v1");
  expect(p).not.toContain("official shortcut");
  expect(effectivePrompt(m, connections)).toContain("Connector facts v1");
  expect(effectivePrompt(m, connections)).not.toContain("Shape facts v1");
});
it("supplies temporary aliases with facts and no private mapping or detailed part-number IDs", () => {
  const m = validateManifest(load("calibration-alias")),
    c = schedule(m)[0],
    p = effectivePrompt(m, c);
  expect(p).toContain('"part":"p1"');
  expect(p).not.toContain("3039");
  expect(p).not.toContain("3024.dat");
  expect(p).not.toContain('"aliases"');
});
it("hand-authored witnesses match compile/export and fail deliberate perturbations", () => {
  registerFullLibraryFromDisk();
  registerAgentData();
  const fixtures = JSON.parse(
    readFileSync("fixtures/spatial-benchmark/evaluator/witnesses.json", "utf8"),
  ) as Witness[];
  for (const w of fixtures) {
    const script = {
      buildScript: 1,
      title: "Fixture",
      sections: [
        {
          name: "Parts",
          ops: w.places.map((p) => ({ op: "place", ...p, colour: 4 })),
        },
      ],
    };
    const result = compileBuildScript(script, { now: () => 0 });
    const evaluation = inspectCalibration(result.ldraw, w);
    expect(
      evaluation.records.every((p) => p.status === "verified"),
      w.task + JSON.stringify(evaluation),
    ).toBe(true);
    const changed = structuredClone(script);
    changed.sections[0].ops[w.perturb.index].at = w.perturb.at;
    const broken = inspectCalibration(
      compileBuildScript(changed, { now: () => 0 }).ldraw,
      w,
    );
    expect(
      broken.records.some((p) => p.status === "invalid"),
      w.task,
    ).toBe(true);
    expect(
      broken.records.find(
        (p) => p.property === "surface-occupancy-intersection",
      )?.observed,
      w.task,
    ).toBe(w.perturbedOverlaps);
    expect(
      broken.records.find((p) => p.property === "supported-contact-count")
        ?.observed,
    ).toBe(w.perturbedContacts);
  }
});

it("unsupported connector families remain unknown in calibration evaluation", () => {
  registerFullLibraryFromDisk();
  registerAgentData();
  const w = JSON.parse(
    readFileSync("fixtures/spatial-benchmark/evaluator/witnesses.json", "utf8"),
  )[0] as Witness;
  const r = compileBuildScript({
    buildScript: 1,
    title: "Unknown",
    sections: [
      {
        name: "Parts",
        ops: [
          { op: "place", part: "4081b", at: [0, 0, 0], colour: 4 },
          { op: "place", part: "3001", at: [4, 0, 0], colour: 4 },
        ],
      },
    ],
  });
  const e = inspectCalibration(r.ldraw, w);
  expect(
    e.records.find((p) => p.property === "supported-contact-count")?.status,
  ).toBe("unknown");
  expect(e.coverage.uncovered).toBeGreaterThan(0);
});

it("relationship calibration accepts reordered operations without changing literal pose expectations", () => {
  registerFullLibraryFromDisk();
  registerAgentData();
  const w = JSON.parse(
    readFileSync("fixtures/spatial-benchmark/evaluator/witnesses.json", "utf8"),
  )[0] as Witness;
  const compile = (ps: Witness["places"]) =>
    compileBuildScript({
      buildScript: 1,
      title: "Order",
      sections: [
        {
          name: "Parts",
          ops: ps.map((p) => ({ op: "place", ...p, colour: 4 })),
        },
      ],
    }).ldraw;
  const reversed = compile([...w.places].reverse());
  expect(
    inspectCalibration(reversed, w, "any").records.every(
      (p) => p.status === "verified",
    ),
  ).toBe(true);
  expect(
    inspectCalibration(reversed, w, "given").records.find(
      (p) => p.property === "specified-poses",
    )?.status,
  ).toBe("invalid");
  const bad = structuredClone(w.places);
  bad[1].at = [0, 3, 0];
  expect(
    inspectCalibration(compile(bad), w, "any").records.some(
      (p) => p.status === "invalid",
    ),
  ).toBe(true);
});
