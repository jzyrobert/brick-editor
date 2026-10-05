import type { Project } from "../core/types";

const frozen = new WeakSet<object>();
const stamps = new WeakMap<object, Map<string, string>>();

function deepFreeze(value: unknown, seen: Set<object>) {
  if (!value || typeof value !== "object" || seen.has(value)) return;
  seen.add(value);
  for (const key of Reflect.ownKeys(value))
    deepFreeze((value as Record<PropertyKey, unknown>)[key], seen);
  Object.freeze(value);
}

/**
 * A private, deeply frozen copy of a project for a Play session's reviewed
 * source seals. Nothing can edit it in place, so a seal's source stamp can be
 * computed once instead of on every fixed tick. Projects that were not made
 * here are always stamped in full.
 */
export function frozenSourceSnapshot(project: Project): Project {
  const copy = structuredClone(project);
  deepFreeze(copy, new Set());
  frozen.add(copy);
  return copy;
}
export const isFrozenSourceSnapshot = (project: Project) => frozen.has(project);

/** Memoise a stamp of a frozen snapshot; compute every time otherwise. */
export function sourceStamp(
  project: Project,
  kind: string,
  compute: () => string,
) {
  if (!frozen.has(project)) return compute();
  let byKind = stamps.get(project);
  if (!byKind) stamps.set(project, (byKind = new Map()));
  let stamp = byKind.get(kind);
  if (stamp === undefined) byKind.set(kind, (stamp = compute()));
  return stamp;
}
