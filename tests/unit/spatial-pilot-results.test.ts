import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { expect, it } from "vitest";

const root = "fixtures/spatial-benchmark/studies/sol-high-pilot";
const load = (file: string) =>
  JSON.parse(readFileSync(join(root, file), "utf8"));
const sha = (data: string | Buffer) =>
  createHash("sha256").update(data).digest("hex");
type Case = {
  caseId: string;
  originalFrozenStatus: string;
  files: Record<string, string>;
  views: { view: string; sha256: string }[];
  assessment: {
    status: string;
    assessment?: { scores: Record<string, number> };
  };
};
type Row = {
  caseId: string;
  task: string;
  condition: string;
  status: string;
  originalFrozenStatus: string;
  visualTotal: number | null;
};
const evidence = load("creative-evidence.json");
const cases: Case[] = evidence.cases;
const report = load("creative-results.json");
const rows: Row[] = report.rows;

it("retains every scheduled creative case exactly once, including failures", () => {
  const manifest = load("creative.json");
  const expected = manifest.tasks.flatMap((t: { id: string }) =>
    manifest.conditions.flatMap((c: { id: string }) =>
      Array.from(
        { length: manifest.repetitions },
        (_, i) => `${t.id}--${c.id}--${i + 1}`,
      ),
    ),
  );
  expect(cases.map((c) => c.caseId).sort()).toEqual(expected.sort());
  expect(new Set(cases.map((c) => c.caseId)).size).toBe(72);
  expect(rows.filter((r) => r.status === "submitted")).toHaveLength(42);
  expect(
    rows.filter((r) => r.status === "infrastructure-failure"),
  ).toHaveLength(19);
  expect(rows.filter((r) => r.status === "model-failure")).toHaveLength(11);
  for (const row of rows)
    expect(row.originalFrozenStatus).toBe(
      cases.find((c) => c.caseId === row.caseId)!.originalFrozenStatus,
    );
  expect(rows.filter((r) => r.status !== r.originalFrozenStatus)).toHaveLength(
    1,
  );
});

it("verifies the original frozen file hashes and extracted compiled scripts", () => {
  expect(sha(readFileSync(join(root, "creative-results.json")))).toBe(
    evidence.evaluatedReportSha256,
  );
  for (const c of cases) {
    const dir = join("creative-cases", c.caseId);
    expect(load(join(dir, "freeze.json")).files).toEqual(c.files);
    for (const [file, expected] of Object.entries(c.files))
      expect(sha(readFileSync(join(root, dir, file)))).toBe(expected);
    if (c.files["compilation.json"]) {
      const compiled = load(join(dir, "compilation.json"));
      if (compiled.script)
        expect(load(join(dir, "script.json"))).toEqual(compiled.script);
    }
  }
});

it("retains exact filled inputs, lengths, hashes and the scheduled order", () => {
  const inputs = load("creative-effective-inputs.json");
  expect(inputs.inputs).toHaveLength(72);
  expect(new Set(inputs.runOrder).size).toBe(72);
  expect([...inputs.runOrder].sort()).toEqual(
    cases.map((c) => c.caseId).sort(),
  );
  for (const i of inputs.inputs) {
    expect(sha(i.prompt)).toBe(i.sha256);
    expect(Buffer.byteLength(i.prompt)).toBe(i.bytes);
    expect(i.prompt.length).toBe(i.characters);
    expect(cases.some((c) => c.caseId === i.caseId)).toBe(true);
  }
});

it("keeps all fixed-view assessments and unevaluated failures without imputation", () => {
  const protocol = load("visual-protocol.json");
  for (const c of cases) {
    const row = rows.find((r) => r.caseId === c.caseId)!;
    if (c.assessment.status === "assessed") {
      expect(c.views.map((v) => v.view)).toEqual(protocol.views);
      expect(c.views.every((v) => /^[a-f0-9]{64}$/.test(v.sha256))).toBe(true);
      const scores = c.assessment.assessment!.scores;
      expect(Object.keys(scores).sort()).toEqual([...protocol.axes].sort());
      expect(
        Object.values(scores).every(
          (v) => Number.isInteger(v) && v >= 0 && v <= 4,
        ),
      ).toBe(true);
      expect(Object.values(scores).reduce((a, b) => a + b, 0)).toBe(
        row.visualTotal,
      );
    } else {
      expect(c.assessment.status).toBe("unevaluated-no-render");
      expect(c.views).toEqual([]);
      expect(row.visualTotal).toBeNull();
    }
  }
});

it("independently checks equal-task primary means and discloses missing arms", () => {
  const arms = ["control", "shape", "connections", "combined"];
  const tasks = [...new Set(rows.map((r) => r.task))].sort();
  const differences: number[] = [];
  const omitted: string[] = [];
  for (const task of tasks) {
    const groups = arms.map((arm) =>
      rows
        .filter((r) => r.task === task && r.condition === arm)
        .flatMap((r) => (r.visualTotal === null ? [] : [r.visualTotal])),
    );
    if (groups.some((g) => g.length === 0)) omitted.push(task);
    else {
      const mean = (g: number[]) => g.reduce((a, b) => a + b, 0) / g.length;
      differences.push(mean(groups[3]) - mean(groups[0]));
    }
  }
  expect(omitted).toEqual(["destroyer"]);
  expect(report.visualContrasts.omittedTasks).toEqual(omitted);
  expect(differences).toHaveLength(5);
  const primary = report.visualContrasts.contrasts.find(
    (c: { contrast: string }) => c.contrast === "combined-control",
  );
  expect(primary.mean).toBeCloseTo(
    differences.reduce((a, b) => a + b, 0) / differences.length,
    12,
  );
  expect(primary.mean).toBeCloseTo(0.1, 12);
  expect(primary.percentile95).toEqual([-0.5, 0.6]);
});
