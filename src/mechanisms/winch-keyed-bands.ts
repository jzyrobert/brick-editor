import { inverse, mv } from "../core/math";
import { ensure, type Project, type Vec3 } from "../core/types";
import { bindWinchCarrierSources } from "./winch-carrier";
import {
  winchCollisionMatchesProject,
  type SourceBoundWinchCollision,
} from "./winch-collision";
import { certifyWinchKeyedColumn } from "./winch-keyed-column";
import {
  winchSurfaceBands,
  type WinchSurfaceBands,
} from "./winch-surface-bands";

const PROFILES: Readonly<Record<string, string>> = Object.freeze({
  "32449.dat": "axl5hol8.dat",
  "6536.dat": "axl5hol8.dat",
  "4716.dat": "axl5hol8.dat",
  "10928.dat": "axl5hol8.dat",
  "4185.dat": "axl5hol8.dat",
  "32123a.dat": "axl2hol8.dat",
  "18948.dat": "axl3hol8.dat",
});
/** Actual three-decimal joiner boundary versus its inserted cross-axle source.
 * Applies ONLY to finite residual capsules at this literal keyed profile.
 * The 1e-6-LDU triangulated normal-plane scope is reported separately. */
export const WINCH_JOINER_KEY_RESIDUAL_LDU = 0.0004;
export type WinchKeyedBands = Readonly<{
  bands: WinchSurfaceBands;
  keys: readonly Readonly<{
    bearingIndex: number;
    shaftId: string;
    boreId: string;
    bandIndex: number;
    /** Output triangle IDs within this band; all remaining faces respond. */
    triangles: readonly number[];
    sourceProfile: string;
    proof: ReturnType<typeof certifyWinchKeyedColumn>;
    angularModel: "source-keyed-ideal-with-bounded-reconciliation";
    axialGrip: false;
  }>[];
  ordinaryAdmission: false;
}>;
const seals = new WeakSet<WinchKeyedBands>();
export const isWinchKeyedBands = (value: unknown): value is WinchKeyedBands =>
  !!value && typeof value === "object" && seals.has(value as WinchKeyedBands);

function profile(text: string): Readonly<Vec3>[] {
  const vertices = new Map<string, Readonly<Vec3>>();
  for (const line of text.split(/\r?\n/)) {
    const words = line.trim().split(/\s+/);
    if (words[0] !== "4") continue;
    for (const j of [2, 5, 8, 11]) {
      const p = words.slice(j, j + 3).map(Number);
      if (p[1] === 0) vertices.set(p[0] + "," + p[2], [p[0], p[2], 0]);
    }
  }
  return [...vertices.values()].sort(
    (a, b) => Math.atan2(a[1], a[0]) - Math.atan2(b[1], b[0]),
  );
}
/** Source preflight ONLY. No normal-engine admission or native contact changes.
 * Complete core triangle footprints/edges are certified against literal pinned
 * negative columns; axial cut events retain divider, head and foreign surfaces.
 * Runtime must still bind each actual collider and current/predicted bearing,
 * angular phase, axial interval and owner geometry before using these records. */
export async function prepareWinchKeyedBands(
  packet: SourceBoundWinchCollision,
  project: Project,
  resolved: Readonly<Record<string, string>>,
): Promise<WinchKeyedBands> {
  ensure(
    winchCollisionMatchesProject(packet, project),
    "INVALID_INPUT",
    "Use the original current project bound to the source collision packet.",
  );
  await bindWinchCarrierSources(resolved, project);
  const bands = winchSurfaceBands(packet),
    keys: WinchKeyedBands["keys"][number][] = [],
    owners = new Map(packet.owners.map((o) => [o.occurrenceId, o]));
  for (const [index, bearing] of packet.plan.bearings.entries()) {
    if (bearing.kind !== "keyed") continue;
    const shaft = owners.get(bearing.shaft.occurrenceId)!,
      bore = owners.get(bearing.bore.occurrenceId)!,
      inverseBore = inverse(bore.frame),
      shaftBands = bands.shafts.find(
        (s) => s.occurrenceId === shaft.occurrenceId,
      )!,
      sourceProfile = PROFILES[bore.ref];
    ensure(
      sourceProfile && resolved[sourceProfile],
      "INVALID_INPUT",
      "Missing actual reviewed keyed bore profile.",
    );
    const hole = profile(resolved[sourceProfile]),
      coordinates =
        bore.ref === "32449.dat"
          ? [0, 2]
          : bore.ref === "6536.dat"
            ? [1, 2]
            : [0, 1];
    for (const [bandIndex, band] of shaftBands.bands.entries()) {
      if (!band.bearingCandidates.includes(index)) continue;
      const triangles: Vec3[][] = [],
        ids: number[] = [];
      for (let t = 0; t < band.triangles.length; t += 3) {
        const points = [0, 1, 2].map((k) => band.points[band.triangles[t + k]]);
        // Exclude actual heads, collars and catches. Convexity of the radial
        // norm bounds the whole triangle; the negative-column proof below is
        // additional and never replaced by a radius-only mating decision.
        if (
          !points.every((p) => {
            const delta = p.map(
                (n, i) => n + shaft.frame.position[i] - bearing.shaft.center[i],
              ),
              station = delta.reduce(
                (s, n, i) => s + n * bearing.shaft.axis[i],
                0,
              );
            return (
              Math.hypot(
                ...delta.map((n, i) => n - station * bearing.shaft.axis[i]),
              ) <=
              6 + 1e-6
            );
          })
        )
          continue;
        triangles.push(
          points.map((p) => {
            const local = mv(
              inverseBore.basis,
              p.map(
                (n, i) => n + shaft.frame.position[i] - bearing.bore.center[i],
              ) as Vec3,
            );
            return [local[coordinates[0]], local[coordinates[1]], 0];
          }),
        );
        ids.push(t / 3);
      }
      if (!ids.length) continue;
      const proof = certifyWinchKeyedColumn(
        triangles,
        hole,
        bore.ref === "18948.dat" ? WINCH_JOINER_KEY_RESIDUAL_LDU : 0,
      );
      keys.push(
        Object.freeze({
          bearingIndex: index,
          shaftId: shaft.occurrenceId,
          boreId: bore.occurrenceId,
          bandIndex,
          triangles: Object.freeze(ids),
          sourceProfile,
          proof,
          angularModel: "source-keyed-ideal-with-bounded-reconciliation",
          axialGrip: false,
        }),
      );
    }
  }
  ensure(
    new Set(keys.map((k) => k.bearingIndex)).size === 20,
    "INVALID_INPUT",
    "Every actual source key must retain a certified positive chamber interval.",
  );
  const result = Object.freeze({
    bands,
    keys: Object.freeze(keys),
    ordinaryAdmission: false as const,
  });
  seals.add(result);
  return result;
}
