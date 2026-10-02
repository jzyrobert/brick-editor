/** Curated definitions registered only after the caller verifies the pinned pack. */
const curated = new Map<string, string>();
export function registerCuratedGeometrySources(sources: Map<string, string>) {
  for (const [name, text] of sources) curated.set(name, text);
}
export const curatedGeometrySource = (name: string) => curated.get(name);
