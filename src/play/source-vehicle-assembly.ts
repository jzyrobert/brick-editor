import { occurrences } from "../core/document";
import type { Bounds } from "../core/spatial";
import type { Occurrence, Project } from "../core/types";
import {
  sourceAssemblyPartition,
  type SourceAssemblyEdge,
} from "./source-assembly";
import { sourceWheelAttachments } from "./source-wheel-attachments";

export type SourceVehicleAssembly = {
  occurrenceIds: string[];
  carrierOccurrenceIds: string[];
  wheelOccurrenceIds: string[];
  chassisOccurrenceIds: string[];
  /** Actual fixed attachment islands, not a chassis made from MPD ancestors. */
  fixedIslands: string[][];
  boundaries: SourceAssemblyEdge[];
  reservedOccurrenceIds: string[];
  /** Existing protected/raycast wheel driving cannot absorb free source bodies. */
  rigidWheelProfileCompatible: boolean;
};
export type SourceVehicleAssemblyReview = {
  assemblies: SourceVehicleAssembly[];
  /** Complete included-source partition, including unattached embedded content.
   * Unclaimed members retain ordinary world collision/render/inventory ownership. */
  occurrenceIds: string[];
  fixedIslands: string[][];
  unattachedOccurrenceIds: string[];
};

/** Source vehicle ownership preflight for the reviewed retained-axle family.
 * A source-connected body graph is broader than the old stud-only component.
 * Retained bearings and hinges supply ownership but remain motion boundaries.
 * Merely sharing an MPD ancestor supplies neither a body nor an attachment.
 * Review includes reserved neighbors so another active owner cannot silently
 * turn a connected assembly into an apparently independent partial chassis. */
export function sourceVehicleAssemblyReview(
  project: Project,
  options: {
    all?: Occurrence[];
    reserved: ReadonlySet<string>;
    bounds: (o: Occurrence) => Bounds | null;
    limits: { wheelParts: number; holders: number; connectionWork: number };
  },
): SourceVehicleAssemblyReview {
  const all = options.all ?? occurrences(project),
    wheel = sourceWheelAttachments(project, { ...options, all }),
    partition = sourceAssemblyPartition(project, {
      all,
      attachments: wheel.attachments,
      keyedAxialFreedom: true,
    });
  const assemblies: SourceVehicleAssembly[] = [];
  for (const component of partition.attachmentComponents) {
    const ids = new Set(component),
      wheels = wheel.assemblies.filter((w) => ids.has(w.carrier.id));
    if (!wheels.length) continue;
    const wheelIds = new Set(wheels.flatMap((w) => w.members.map((o) => o.id))),
      chassis = component.filter((id) => !wheelIds.has(id)),
      chassisSet = new Set(chassis),
      fixedIslands = partition.rigidIslands.filter((island) =>
        ids.has(island[0]),
      ),
      chassisIslands = fixedIslands.filter((island) =>
        island.some((id) => chassisSet.has(id)),
      ),
      boundaries = partition.boundaries.filter(
        (edge) => ids.has(edge.a) && ids.has(edge.b),
      );
    assemblies.push({
      occurrenceIds: [...component],
      carrierOccurrenceIds: [...new Set(wheels.map((w) => w.carrier.id))],
      wheelOccurrenceIds: [...wheelIds],
      chassisOccurrenceIds: chassis,
      fixedIslands: fixedIslands.map((island) => [...island]),
      boundaries: structuredClone(boundaries),
      reservedOccurrenceIds: component.filter((id) => options.reserved.has(id)),
      rigidWheelProfileCompatible:
        chassisIslands.length === 1 &&
        !boundaries.some(
          (edge) => chassisSet.has(edge.a) && chassisSet.has(edge.b),
        ),
    });
  }
  const claimed = new Set(assemblies.flatMap((a) => a.occurrenceIds));
  return {
    assemblies,
    occurrenceIds: [...partition.occurrenceIds],
    fixedIslands: partition.rigidIslands.map((island) => [...island]),
    unattachedOccurrenceIds: partition.occurrenceIds.filter(
      (id) => !claimed.has(id),
    ),
  };
}
