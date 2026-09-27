import { estimateExpansion } from "./expansion";
import { expansionLimits, type ExpansionOptions } from "./expansion-policy";
import { AppError, type Project } from "./types";

/** Trusted session policy; never taken from project metadata. */
export function assessMaterialization(
  project: Project,
  options: ExpansionOptions = {},
) {
  const limits = expansionLimits(options);
  const estimate = estimateExpansion(project);
  const resource = (Object.keys(limits) as (keyof typeof limits)[]).find(
    (key) => estimate.metrics[key] > limits[key],
  );
  return {
    projectId: project.id,
    revision: project.revision,
    status: resource ? ("limited" as const) : ("available" as const),
    profile: options.profile ?? "desktop",
    limits,
    estimate,
    ...(resource
      ? {
          diagnostic: {
            code: "LIMIT_EXCEEDED",
            message: `Expanded ${resource} exceeds the derived resource budget`,
            resource,
            limit: limits[resource],
            requiredAtLeast: estimate.metrics[resource],
            unit: resource.endsWith("Characters")
              ? "UTF-16 code units"
              : "count",
          },
        }
      : {}),
  };
}
export type Materialization = ReturnType<typeof assessMaterialization>;
export function requireMaterialization(status: Materialization) {
  if (status.diagnostic)
    throw new AppError(status.diagnostic.code, status.diagnostic.message, {
      ...status.diagnostic,
      projectId: status.projectId,
      revision: status.revision,
      profile: status.profile,
    });
}
