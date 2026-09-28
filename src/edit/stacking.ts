import installedBounds from "../catalog/bounds.json";
import { projectBounds, transformBounds, type Bounds } from "../core/spatial";
import type { Occurrence, Project, Vec3 } from "../core/types";
import type { Workplane } from "./workplane";

const STUD = 4; // LDU a stud row rises above a brick or plate top.

/** World-space source box of one occurrence, or null outside known geometry. */
export function occurrenceBox(project: Project, o: Occurrence): Bounds | null {
  try {
    const sources = projectBounds(
      project,
      installedBounds.bounds as unknown as Record<string, Bounds | null>,
      installedBounds.dependencies.transitive,
    );
    const local =
      o.node.kind === "geometry"
        ? sources.primitive(
            project.models[o.modelId]?.records.find(
              (r) => r.id === o.node.sourceRecordId,
            )?.raw ?? "",
          )
        : sources.model(o.node.ref);
    return local ? transformBounds(local, o.transform) : null;
  } catch {
    return null;
  }
}

export type Surface = { point: Vec3; normal: Vec3 };
export type NewPart = { width: number; depth: number; angle: number };

/**
 * Where a tap on an existing part should put the new part (spec §11.1 placement):
 * on a top face it rests on the part's body top (studs allowed for); on a side face it
 * sits flush beside the part at the same level. Returns the placement plane and the point
 * to snap, or null to fall back to the workplane. Only for horizontal workplanes.
 */
export function stackingTarget(
  workplane: Workplane,
  surface: Surface,
  box: Bounds | null,
  studded: boolean,
  part: NewPart,
): { plane: Workplane; point: Vec3 } | null {
  if (workplane.normal[1] > -0.99) return null; // tilted or face-aligned workplane
  const [nx, ny, nz] = surface.normal;
  const level = (y: number): Workplane => ({
    ...workplane,
    origin: [workplane.origin[0], y, workplane.origin[2]],
    elevation: 0,
  });
  if (ny < -0.7) {
    // Top face (LDraw −Y is up). Tapping a stud top still lands on the body top.
    const top = box
      ? box.min[1] + (studded ? STUD : 0)
      : Math.ceil(surface.point[1] / 8) * 8;
    return { plane: level(top), point: surface.point };
  }
  if (Math.abs(ny) < 0.3 && box) {
    // Side face: step out by half the new part's extent along the face normal.
    const turned = Math.round(((part.angle % 180) + 180) % 180) === 90;
    const alongX = (turned ? part.depth : part.width) / 2,
      alongZ = (turned ? part.width : part.depth) / 2;
    const horizontal = Math.hypot(nx, nz) || 1;
    const ux = nx / horizontal,
      uz = nz / horizontal;
    const step = Math.abs(ux) >= Math.abs(uz) ? alongX : alongZ;
    const faceX = Math.abs(ux) >= Math.abs(uz),
      edge = faceX
        ? ux > 0
          ? box.max[0]
          : box.min[0]
        : uz > 0
          ? box.max[2]
          : box.min[2];
    const point: Vec3 = faceX
      ? [edge + Math.sign(ux) * step, surface.point[1], surface.point[2]]
      : [surface.point[0], surface.point[1], edge + Math.sign(uz) * step];
    return { plane: level(box.max[1]), point };
  }
  return null;
}
