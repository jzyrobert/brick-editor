import { ensure, type Vec3 } from "../core/types";

type Point2 = [number, number];
export type SourceTriangle = [Vec3, Vec3, Vec3];
export type SourceSupportPatch = {
  /** Actual overlapping source faces. A patch is contact, never an attachment. */
  polygon: Vec3[];
  areaLdu2: number;
};
const signedArea = (p: readonly Point2[]) =>
  p.reduce((s, a, i) => {
    const b = p[(i + 1) % p.length];
    return s + a[0] * b[1] - a[1] * b[0];
  }, 0) / 2;
const side = (a: Point2, b: Point2, p: Point2) =>
  (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);

/** Exact positive-area support-face intersection in the initial LDraw Y-down
 * frame. Feed literal source triangles, not part bounds or occupancy boxes.
 * This proves an initial surface contact, not friction, retention, stability,
 * ownership, or a rigid weld. The native bodies remain free to separate. */
export function sourceSupportPatch(
  a: SourceTriangle,
  b: SourceTriangle,
): SourceSupportPatch | undefined {
  ensure(
    [...a, ...b].every((p) => p.length === 3 && p.every(Number.isFinite)),
    "INVALID_INPUT",
    "Source support faces must have finite coordinates",
  );
  const plane = a[0][1];
  if ([...a, ...b].some((p) => Math.abs(p[1] - plane) > 0.05)) return undefined;
  const project = (p: Vec3): Point2 => [p[0], p[2]];
  let subject = a.map(project),
    clip = b.map(project);
  if (
    Math.abs(signedArea(subject)) < 0.001 ||
    Math.abs(signedArea(clip)) < 0.001
  )
    return undefined;
  if (signedArea(subject) < 0) subject.reverse();
  if (signedArea(clip) < 0) clip.reverse();
  for (let i = 0; i < 3 && subject.length; i++) {
    const c = clip[i],
      d = clip[(i + 1) % 3],
      next: Point2[] = [];
    for (let j = 0; j < subject.length; j++) {
      const p = subject[j],
        q = subject[(j + 1) % subject.length];
      const ps = side(c, d, p),
        qs = side(c, d, q),
        pi = ps >= -1e-9,
        qi = qs >= -1e-9;
      if (pi) next.push(p);
      if (pi !== qi) {
        const t = ps / (ps - qs);
        next.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]);
      }
    }
    subject = next;
  }
  const area = Math.abs(signedArea(subject));
  return area > 0.001
    ? { polygon: subject.map((p) => [p[0], plane, p[1]]), areaLdu2: area }
    : undefined;
}

export type SourceContactSurface = {
  occurrenceId: string;
  /** Hash of the complete source dependency closure used to compile these faces. */
  sourceClosureSha256: string;
  /** World triangles from literal part surfaces, with openings preserved. */
  triangles: readonly SourceTriangle[];
};
export type SourceSupportContact = SourceSupportPatch & {
  a: { occurrenceId: string; sourceClosureSha256: string; triangle: number };
  b: { occurrenceId: string; sourceClosureSha256: string; triangle: number };
};
/** Internal source-geometry adapter seam. The renderer/loader supplies verified
 * source closures and their actual compiled triangles. A returned support
 * contact belongs in the contact/collision plan, never SourceAssemblyEdge. */
export function sourceSupportContacts(
  a: SourceContactSurface,
  b: SourceContactSurface,
) {
  ensure(
    a.occurrenceId !== b.occurrenceId &&
      !!a.occurrenceId &&
      !!b.occurrenceId &&
      /^[a-f0-9]{64}$/.test(a.sourceClosureSha256) &&
      /^[a-f0-9]{64}$/.test(b.sourceClosureSha256),
    "INVALID_INPUT",
    "Source support contact needs two source-bound occurrences",
  );
  ensure(
    a.triangles.length * b.triangles.length <= 200000 &&
      a.triangles.length + b.triangles.length <= 10000,
    "LIMIT_EXCEEDED",
    "Source support face budget exceeded",
  );
  const contacts: SourceSupportContact[] = [];
  for (const [i, at] of a.triangles.entries())
    for (const [j, bt] of b.triangles.entries()) {
      const patch = sourceSupportPatch(at, bt);
      if (!patch) continue;
      ensure(
        contacts.length < 4096,
        "LIMIT_EXCEEDED",
        "Source support contact budget exceeded",
      );
      contacts.push({
        ...patch,
        a: {
          occurrenceId: a.occurrenceId,
          sourceClosureSha256: a.sourceClosureSha256,
          triangle: i,
        },
        b: {
          occurrenceId: b.occurrenceId,
          sourceClosureSha256: b.sourceClosureSha256,
          triangle: j,
        },
      });
    }
  return contacts;
}
