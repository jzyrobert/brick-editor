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
import manifest from "./pneumatic-cylinder-source.json";
export const PNEUMATIC_CYLINDER_LIMITS = Object.freeze({
  triangles: 8192,
  vertices: 24576,
  closureFiles: 1024,
  characters: 8_000_000,
  minimumSeparationLdu: 200,
  maximumSeparationLdu: 330,
  sourceRadialFitLdu: 0.002,
});
export type PneumaticCylinderSurface = {
  vertices: Float64Array;
  indices: Uint32Array;
};
export type PreparedPneumaticCylinder = Readonly<{
  bodyOccurrenceId: string;
  rodOccurrenceId: string;
  initialSeparationLdu: number;
  children: 3;
  triangles: number;
}>;
type Seal = {
  project: Project;
  revision: number;
  stamp: string;
  body: { frame: Transform; surface: PneumaticCylinderSurface };
  rod: { frame: Transform; surface: PneumaticCylinderSurface };
};
const seals = new WeakMap<PreparedPneumaticCylinder, Seal>();
function stamp(p: Project) {
  let bytes = 0;
  const data = Object.entries(p.models).map(([id, m]) => {
    const row = JSON.stringify([id, m.name, m.nodes, m.records]);
    bytes += row.length;
    ensure(
      bytes <= PNEUMATIC_CYLINDER_LIMITS.characters,
      "LIMIT_EXCEEDED",
      "Pneumatic source snapshot exceeds its budget",
    );
    return row;
  });
  return JSON.stringify(data);
}
const refs = ["42043 - 19466c01.dat", "42043 - 19467c01.dat"] as const;
/** Narrow embedded 2015 V2 profile; no filename-only or nearest-part match. */
export async function prepareSourcePneumaticCylinder(
  project: Project,
  sources: Readonly<Record<string, string>>,
  input: {
    bodyOccurrenceId: string;
    rodOccurrenceId: string;
    body: PneumaticCylinderSurface;
    rod: PneumaticCylinderSurface;
  },
): Promise<PreparedPneumaticCylinder> {
  const original = stamp(project),
    revision = project.revision,
    hashes = new Map<string, Promise<string>>();
  let characters = 0;
  for (const root of refs) {
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
        "Missing pneumatic cylinder source: " + ref,
      );
      const text = normalizedPneumaticSource(raw);
      if (!hashes.has(ref)) {
        characters += text.length;
        ensure(
          hashes.size < PNEUMATIC_CYLINDER_LIMITS.closureFiles &&
            characters <= PNEUMATIC_CYLINDER_LIMITS.characters,
          "LIMIT_EXCEEDED",
          "Pneumatic cylinder closure exceeds its budget",
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
      "Reviewed pneumatic cylinder source changed: " + root,
    );
  }
  const hardware = sourceHardwareIndex(project).hardware,
    body = hardware.find((h) => h.id === input.bodyOccurrenceId),
    rod = hardware.find((h) => h.id === input.rodOccurrenceId);
  ensure(
    body &&
      rod &&
      body.id !== rod.id &&
      body.reference === refs[0] &&
      rod.reference === refs[1],
    "INVALID_INPUT",
    "Choose the actual separate pneumatic body and rod source owners",
  );
  ensure(
    nearlyPhysical(body.frame) &&
      nearlyPhysical(rod.frame) &&
      JSON.stringify(body.frame.basis) === JSON.stringify(rod.frame.basis),
    "INVALID_INPUT",
    "Pneumatic source actors need matching rigid axial frames",
  );
  const frame = orthonormalized(body.frame),
    local = mv(
      inverse(frame).basis,
      rod.frame.position.map((x, i) => x - frame.position[i]) as Vec3,
    ),
    separation = -local[1];
  ensure(
    Math.hypot(local[0], local[2]) <=
      PNEUMATIC_CYLINDER_LIMITS.sourceRadialFitLdu &&
      separation >= 200 &&
      separation <= 330,
    "INVALID_INPUT",
    "The source rod is outside its reviewed axial guide or retained stroke",
  );
  let triangles = 0;
  for (const [i, s] of [input.body, input.rod].entries()) {
    ensure(
      s.vertices instanceof Float64Array &&
        s.indices instanceof Uint32Array &&
        s.vertices.length <= PNEUMATIC_CYLINDER_LIMITS.vertices * 3 &&
        s.indices.length <= PNEUMATIC_CYLINDER_LIMITS.triangles * 3,
      "LIMIT_EXCEEDED",
      "The pneumatic cylinder surface exceeds its geometry budget",
    );
    triangles += s.indices.length / 3;
    ensure(
      (await reviewedGeometryDigest(s)) === manifest[refs[i]].geometrySha256,
      "INVALID_INPUT",
      "The actual pneumatic cylinder surface changed",
    );
  }
  ensure(
    triangles <= PNEUMATIC_CYLINDER_LIMITS.triangles &&
      project.revision === revision &&
      stamp(project) === original,
    "REVISION_CONFLICT",
    "Reload the pneumatic source after changing its parts",
  );
  const token = Object.freeze({
    bodyOccurrenceId: body.id,
    rodOccurrenceId: rod.id,
    initialSeparationLdu: separation,
    children: 3 as const,
    triangles,
  });
  seals.set(token, {
    project,
    revision,
    stamp: original,
    body: {
      frame: structuredClone(body.frame),
      surface: {
        vertices: input.body.vertices.slice(),
        indices: input.body.indices.slice(),
      },
    },
    rod: {
      frame: structuredClone(rod.frame),
      surface: {
        vertices: input.rod.vertices.slice(),
        indices: input.rod.indices.slice(),
      },
    },
  });
  return token;
}
export function readPreparedPneumaticCylinder(
  token: PreparedPneumaticCylinder,
) {
  const seal = seals.get(token);
  ensure(
    seal &&
      seal.project.revision === seal.revision &&
      stamp(seal.project) === seal.stamp,
    "REVISION_CONFLICT",
    "Reload the exact pneumatic source before constructing its native actors",
  );
  return seal;
}
