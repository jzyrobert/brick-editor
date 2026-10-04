import { ensure, type Occurrence, type Vec3 } from "../core/types";
import type { PlayMemberLocalGeometry } from "../play/types";
import { PLAY_MEMBER_GEOMETRY_LIMITS } from "../play/member-geometry";
import type { OccurrenceHandle } from "./occurrence-handles";
import type { Object3D } from "three";

type Surface = Pick<PlayMemberLocalGeometry, "vertices" | "indices" | "bounds">;

/** Session inputs own read-only buffers shared only by identical loaded prototypes.
 * No occurrence/world transform is baked into the canonical surface. */
export class PlayMemberGeometryCapture {
  private surfaces = new WeakMap<Object3D, Surface>();

  capture(
    requested: readonly string[],
    lookup: ReadonlyMap<string, Occurrence>,
    handles: ReadonlyMap<string, OccurrenceHandle>,
    revision: number,
  ): Record<string, PlayMemberLocalGeometry> {
    // Only this bounded request is cached; old Play builds must not retain a
    // second canonical copy through prototypes that the renderer still keeps.
    this.surfaces = new WeakMap();
    const ids = [...new Set(requested)];
    let vertices = 0,
      triangles = 0;
    // Check the complete request before allocating any canonical buffers.
    for (const id of ids) {
      const occurrence = lookup.get(id),
        handle = handles.get(id);
      ensure(
        occurrence && handle && occurrence.namespace !== "missing",
        "INVALID_INPUT",
        "Moving parts need complete loaded geometry from this project",
      );
      let memberTriangles = 0;
      for (const template of handle.drawables) {
        if (!template.mesh) continue;
        const geometry = template.object.geometry,
          p = geometry.getAttribute("position"),
          count = geometry.index?.count ?? p?.count ?? 0;
        ensure(
          p && p.itemSize >= 3 && count % 3 === 0,
          "INVALID_INPUT",
          "Moving parts need complete triangle geometry",
        );
        vertices += p.count;
        triangles += count / 3;
        memberTriangles += count / 3;
      }
      ensure(
        memberTriangles > 0,
        "INVALID_INPUT",
        "Moving parts need complete triangle geometry",
      );
      ensure(
        vertices <= PLAY_MEMBER_GEOMETRY_LIMITS.vertices &&
          triangles <= PLAY_MEMBER_GEOMETRY_LIMITS.triangles,
        "LIMIT_EXCEEDED",
        "Moving part geometry exceeds the existing mechanical source budget",
        {
          maximum: PLAY_MEMBER_GEOMETRY_LIMITS,
          actual: { vertices, triangles },
        },
      );
    }
    const result: Record<string, PlayMemberLocalGeometry> = {};
    for (const id of ids) {
      const occurrence = lookup.get(id)!,
        handle = handles.get(id)!;
      let surface = this.surfaces.get(handle.prototype);
      if (!surface) {
        const drawables = handle.drawables.filter((template) => template.mesh),
          points = new Float64Array(
            drawables.reduce(
              (n, t) =>
                n + t.object.geometry.getAttribute("position").count * 3,
              0,
            ),
          ),
          indices = new Uint32Array(
            drawables.reduce(
              (n, t) =>
                n +
                (t.object.geometry.index?.count ??
                  t.object.geometry.getAttribute("position").count),
              0,
            ),
          ),
          min: Vec3 = [Infinity, Infinity, Infinity],
          max: Vec3 = [-Infinity, -Infinity, -Infinity];
        let vertexFloats = 0,
          indexCount = 0;
        for (const template of drawables) {
          const geometry = template.object.geometry,
            p = geometry.getAttribute("position"),
            e = template.local.elements,
            offset = vertexFloats / 3;
          for (let i = 0; i < p.count; i++) {
            const x = p.getX(i),
              y = p.getY(i),
              z = p.getZ(i),
              w = 1 / (e[3] * x + e[7] * y + e[11] * z + e[15]),
              px = (e[0] * x + e[4] * y + e[8] * z + e[12]) * w,
              py = (e[1] * x + e[5] * y + e[9] * z + e[13]) * w,
              pz = (e[2] * x + e[6] * y + e[10] * z + e[14]) * w;
            ensure(
              Number.isFinite(px) && Number.isFinite(py) && Number.isFinite(pz),
              "INVALID_INPUT",
              "Moving part geometry is not finite",
            );
            points[vertexFloats++] = px;
            points[vertexFloats++] = py;
            points[vertexFloats++] = pz;
            min[0] = Math.min(min[0], px);
            max[0] = Math.max(max[0], px);
            min[1] = Math.min(min[1], py);
            max[1] = Math.max(max[1], py);
            min[2] = Math.min(min[2], pz);
            max[2] = Math.max(max[2], pz);
          }
          const index = geometry.index,
            count = index?.count ?? p.count,
            mirrored = template.local.determinant() < 0;
          for (let i = 0; i < count; i += 3) {
            const triangle = [0, 1, 2].map((k) =>
              index ? index.getX(i + k) : i + k,
            );
            ensure(
              triangle.every(
                (n) => Number.isInteger(n) && n >= 0 && n < p.count,
              ),
              "INVALID_INPUT",
              "Moving part geometry has invalid triangle indices",
            );
            indices[indexCount++] = offset + triangle[0];
            indices[indexCount++] = offset + triangle[mirrored ? 2 : 1];
            indices[indexCount++] = offset + triangle[mirrored ? 1 : 2];
          }
        }
        surface = Object.freeze({
          vertices: points,
          indices,
          bounds: Object.freeze({
            min: Object.freeze(min) as unknown as Vec3,
            max: Object.freeze(max) as unknown as Vec3,
          }),
        });
        this.surfaces.set(handle.prototype, surface);
      }
      const frame = structuredClone(occurrence.transform);
      Object.freeze(frame.position);
      Object.freeze(frame.basis);
      Object.freeze(frame);
      result[id] = Object.freeze({
        ...surface,
        revision,
        occurrenceId: id,
        namespace: occurrence.namespace,
        frame,
      });
    }
    return result;
  }
}
