import { expect, it } from "vitest";
import { visualContrasts } from "../../scripts/spatial-benchmark/analysis";
it("averages repetitions within task before equal task weighting", () => {
  const rows = ["a", "b"].flatMap((task) =>
    ["control", "shape", "connections", "combined"].flatMap((condition, i) =>
      Array.from({ length: task === "a" ? 1 : 9 }, () => ({
        task,
        condition,
        total: i * (task === "a" ? 2 : 4),
      })),
    ),
  );
  const result = visualContrasts(rows, 12, 100);
  expect(
    result.contrasts.find((r) => r.contrast === "combined-control")?.mean,
  ).toBe(9);
  expect(result.contrasts.find((r) => r.contrast === "interaction")?.mean).toBe(
    0,
  );
  expect(visualContrasts(rows, 12, 100)).toEqual(result);
});
it("discloses incomplete task groups and does not invent intervals for one cluster", () => {
  const rows = ["control", "shape", "connections", "combined"].map(
    (condition) => ({ task: "complete", condition, total: 12 }),
  );
  rows.push({ task: "missing", condition: "control", total: 24 });
  const result = visualContrasts(rows);
  expect(result.omittedTasks).toEqual(["missing"]);
  expect(
    result.contrasts.every((r) => r.mean === 0 && r.percentile95 === null),
  ).toBe(true);
  expect(visualContrasts([]).contrasts).toEqual([]);
  expect(() =>
    visualContrasts([{ task: "a", condition: "control", total: NaN }]),
  ).toThrow("Non-finite");
});

import { screeningContrast } from "../../scripts/spatial-benchmark/analysis";
it("computes two-arm task-weighted effects without inventing missing arms", () => {
  const rows = [
    { task: "a", condition: "control", total: 10 },
    { task: "a", condition: "control", total: 12 },
    { task: "a", condition: "combined", total: 15 },
    { task: "b", condition: "control", total: 10 },
    { task: "b", condition: "combined", total: 8 },
    { task: "c", condition: "control", total: 12 },
  ];
  const result = screeningContrast(rows);
  expect(result.mean).toBe(1);
  expect(result.percentile95).toEqual([-2, 4]);
  expect(result.omittedTasks).toEqual(["c"]);
  expect(screeningContrast(rows)).toEqual(result);
  expect(screeningContrast([]).mean).toBeNull();
  expect(screeningContrast(rows.slice(0, 3)).percentile95).toBeNull();
});
