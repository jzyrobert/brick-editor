import { directReferences } from "../catalog/full-pack";
import { sha256 } from "../core/hash";
import { inverse, mv, nearlyPhysical, orthonormalized } from "../core/math";
import { ensure, type Project, type Transform, type Vec3 } from "../core/types";
import {
  normalizedPneumaticSource,
  pneumaticProjectSource,
} from "../mechanisms/pneumatic-sources";
import { sourceHardwareIndex } from "../mechanisms/source-hardware-index";
import { reviewedGeometryDigest } from "./reviewed-geometry-binding";
import type { PneumaticCylinderSurface } from "./pneumatic-cylinder-source";
import manifest from "./pneumatic-pump-source.json";
export const PNEUMATIC_PUMP_REFS = [
  "42043 - 2943-v2.dat",
  "99799.dat",
  "2941.dat",
  "2944.dat",
] as const;
export const PNEUMATIC_PUMP_LIMITS = Object.freeze({
  triangles: 8192,
  vertices: 24576,
  characters: 8_000_000,
  files: 1024,
  sourceFrameResidualLdu: 0.05,
  capSealFitLdu: 0.012,
});
type Member = {
  frame: Transform;
  surface: PneumaticCylinderSurface;
  relative: Vec3;
};
export type PreparedPneumaticPump = Readonly<{
  occurrenceIds: readonly [string, string, string, string];
  initialSeparationLdu: number;
  triangles: number;
  children: 4;
}>;
type Seal = {
  project: Project;
  revision: number;
  stamp: string;
  members: readonly Member[];
};
const seals = new WeakMap<PreparedPneumaticPump, Seal>();
function stamp(project: Project) {
  let length = 0;
  return JSON.stringify(
    Object.entries(project.models).map(([id, m]) => {
      const row = JSON.stringify([id, m.name, m.nodes, m.records]);
      length += row.length;
      ensure(
        length <= PNEUMATIC_PUMP_LIMITS.characters,
        "LIMIT_EXCEEDED",
        "The pump source snapshot exceeds its budget",
      );
      return row;
    }),
  );
}
/** The three fixed factory case components are certified by the pinned pump
 * shortcuts and literal source surfaces, not proximity or shared transforms.
 * Original 2015 stepped outlet and current pinned rod remain separate owners. */
export async function prepareSourcePneumaticPump(
  project: Project,
  sources: Readonly<Record<string, string>>,
  input: {
    occurrenceIds: readonly [string, string, string, string];
    surfaces: readonly [
      PneumaticCylinderSurface,
      PneumaticCylinderSurface,
      PneumaticCylinderSurface,
      PneumaticCylinderSurface,
    ];
  },
): Promise<PreparedPneumaticPump> {
  const original = stamp(project),
    revision = project.revision,
    hashes = new Map<string, Promise<string>>();
  let characters = 0;
  for (const root of [
    ...PNEUMATIC_PUMP_REFS,
    "99798-f1.dat",
    "99798-f2.dat",
  ] as const) {
    const seen = new Set<string>(),
      todo = [root as string];
    while (todo.length) {
      const ref = todo.pop()!;
      if (seen.has(ref)) continue;
      seen.add(ref);
      const raw = pneumaticProjectSource(project, ref) ?? sources[ref];
      ensure(
        typeof raw === "string",
        "INVALID_INPUT",
        "Missing actual pump source: " + ref,
      );
      const text = normalizedPneumaticSource(raw);
      if (!hashes.has(ref)) {
        characters += text.length;
        ensure(
          hashes.size < PNEUMATIC_PUMP_LIMITS.files &&
            characters <= PNEUMATIC_PUMP_LIMITS.characters,
          "LIMIT_EXCEEDED",
          "Pump source closure exceeds its budget",
        );
        hashes.set(ref, sha256(text));
      }
      todo.push(...directReferences(text));
    }
    const rows = await Promise.all(
      [...seen].sort().map(async (ref) => [ref, await hashes.get(ref)!]),
    );
    ensure(
      seen.size === manifest[root].files &&
        (await sha256(JSON.stringify(rows))) === manifest[root].closureSha256,
      "INVALID_INPUT",
      "Reviewed pump source changed: " + root,
    );
  }
  const hardware = sourceHardwareIndex(project).hardware,
    owners = input.occurrenceIds.map((id, i) => {
      const h = hardware.find((h) => h.id === id);
      ensure(
        h && h.reference === PNEUMATIC_PUMP_REFS[i],
        "INVALID_INPUT",
        "Choose all four actual pump source owners",
      );
      return h;
    });
  ensure(
    new Set(input.occurrenceIds).size === 4 &&
      owners.every(
        (h) =>
          nearlyPhysical(h.frame) &&
          JSON.stringify(h.frame.basis) ===
            JSON.stringify(owners[0].frame.basis),
      ),
    "INVALID_INPUT",
    "The pump needs distinct owners with matching proper axial source frames",
  );
  const base = orthonormalized(owners[0].frame),
    relative = owners.map((h) =>
      mv(
        inverse(base).basis,
        h.frame.position.map((v, i) => v - base.position[i]) as Vec3,
      ),
    );
  for (const [i, offset] of [
    [1, 88],
    [2, 90],
  ] as const)
    ensure(
      Math.abs(relative[i][1] + offset) <= 0.005 &&
        Math.hypot(relative[i][0], relative[i][2]) <=
          PNEUMATIC_PUMP_LIMITS.sourceFrameResidualLdu,
      "INVALID_INPUT",
      "The actual pump factory barrel or cap is unseated",
    );
  const separation = -relative[3][1];
  ensure(
    Math.hypot(relative[3][0], relative[3][2]) <=
      PNEUMATIC_PUMP_LIMITS.sourceFrameResidualLdu &&
      separation >= 100 &&
      separation <= 140,
    "INVALID_INPUT",
    "The pump rod is outside its reviewed retained source guide",
  );
  let triangles = 0;
  for (const [i, s] of input.surfaces.entries()) {
    ensure(
      s.vertices instanceof Float64Array &&
        s.indices instanceof Uint32Array &&
        s.vertices.length <= PNEUMATIC_PUMP_LIMITS.vertices * 3 &&
        s.indices.length <= PNEUMATIC_PUMP_LIMITS.triangles * 3,
      "LIMIT_EXCEEDED",
      "The pump surface exceeds its geometry budget",
    );
    triangles += s.indices.length / 3;
    ensure(
      (await reviewedGeometryDigest(s)) ===
        manifest[PNEUMATIC_PUMP_REFS[i]].geometrySha256,
      "INVALID_INPUT",
      "The actual pump surface changed",
    );
  }
  ensure(
    triangles <= PNEUMATIC_PUMP_LIMITS.triangles &&
      project.revision === revision &&
      stamp(project) === original,
    "REVISION_CONFLICT",
    "Reload the exact pump source after changing its parts",
  );
  const token = Object.freeze({
    occurrenceIds: Object.freeze([
      ...input.occurrenceIds,
    ]) as unknown as PreparedPneumaticPump["occurrenceIds"],
    initialSeparationLdu: separation,
    triangles,
    children: 4 as const,
  });
  seals.set(token, {
    project,
    revision,
    stamp: original,
    members: owners.map((h, i) => ({
      frame: structuredClone(h.frame),
      relative: relative[i],
      surface: {
        vertices: input.surfaces[i].vertices.slice(),
        indices: input.surfaces[i].indices.slice(),
      },
    })),
  });
  return token;
}
export function readPreparedPneumaticPump(token: PreparedPneumaticPump) {
  const seal = seals.get(token);
  ensure(
    seal &&
      seal.project.revision === seal.revision &&
      stamp(seal.project) === seal.stamp,
    "REVISION_CONFLICT",
    "Reload the exact pump source before using its native actors",
  );
  return seal;
}
