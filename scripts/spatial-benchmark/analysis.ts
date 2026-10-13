// Numeric summaries only. No generation channel or design repair facilities.
export type Score = { task: string; condition: string; total: number };
// Opt-in eligibility; legacy protocols still assess every rendered artifact.
export function reviewEligible(status: string, policy?: string) {
  if (policy === undefined) return true;
  if (policy !== "submitted-only")
    throw new Error("Unknown review eligibility");
  return status === "submitted";
}
export function visualContrasts(
  rows: Score[],
  seed = 20261011,
  resamples = 10000,
) {
  const conditions = ["control", "shape", "connections", "combined"];
  const tasks = [...new Set(rows.map((r) => r.task))].sort();
  const paired = tasks.flatMap((task) => {
    const means = conditions.map((condition) => {
      const values = rows.filter(
        (r) => r.task === task && r.condition === condition,
      );
      return values.length
        ? values.reduce((a, r) => a + r.total, 0) / values.length
        : null;
    });
    if (means.some((v) => v === null)) return [];
    const [control, shape, connections, combined] = means as number[];
    return [
      {
        task,
        contrasts: {
          "combined-control": combined - control,
          "shape-control": shape - control,
          "connections-control": connections - control,
          "shape-main-effect": (shape - control + (combined - connections)) / 2,
          "connections-main-effect":
            (connections - control + (combined - shape)) / 2,
          interaction: combined - shape - connections + control,
        },
      },
    ];
  });
  let state = seed >>> 0;
  const random = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
  if (!Number.isInteger(resamples) || resamples < 1)
    throw new Error("Invalid bootstrap count");
  if (rows.some((r) => !Number.isFinite(r.total)))
    throw new Error("Non-finite score");
  const contrasts = paired.length
    ? Object.keys(paired[0].contrasts).map((key) => {
        const values = paired.map(
          (r) => r.contrasts[key as keyof typeof r.contrasts],
        );
        const mean = values.reduce((a, b) => a + b, 0) / values.length;
        const samples = Array.from({ length: resamples }, () => {
          let sum = 0;
          for (let i = 0; i < values.length; i++)
            sum += values[Math.floor(random() * values.length)];
          return sum / values.length;
        }).sort((a, b) => a - b);
        return {
          contrast: key,
          mean,
          percentile95:
            paired.length < 2
              ? null
              : [
                  samples[Math.floor(resamples * 0.025)],
                  samples[
                    Math.min(resamples - 1, Math.floor(resamples * 0.975))
                  ],
                ],
        };
      })
    : [];
  return {
    version: "task-cluster-summary/1",
    seed,
    resamples,
    pairedTasks: paired.map((r) => r.task),
    omittedTasks: tasks.filter((t) => !paired.some((r) => r.task === t)),
    taskContrasts: paired,
    contrasts,
    interpretation:
      "Descriptive task-cluster resampling on fixed development tasks; not evidence of general improvement or independent reviewer agreement.",
  };
}
