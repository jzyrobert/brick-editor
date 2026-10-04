import {
  occurrenceRenderContext,
  occurrenceRawRecord,
} from "../../src/render/source-context";
import { dependencySource } from "../../src/render/dependency-source";
import { normalizeBfcSource } from "../../src/render/bfc-source";
import { RawPrimitiveCompiler } from "../../src/render/raw-primitives";
import { OccurrenceHandle } from "../../src/render/occurrence-handles";
import { PlayMemberGeometryCapture } from "../../src/render/play-member-geometry";
import { Group, Mesh, Vector3 } from "three";
import { LDrawLoader } from "three/examples/jsm/loaders/LDrawLoader.js";
import { LDrawConditionalLineMaterial } from "three/examples/jsm/materials/LDrawConditionalLineMaterial.js";
import { scopedLDraw } from "../../src/ldraw/io";
import { occurrences } from "../../src/core/document";
import type { Project } from "../../src/core/types";
import type {
  CollisionSnapshot,
  PlayMemberLocalGeometry,
} from "../../src/play/types";
import type { DynamicRigSource } from "../../src/play/dynamics";

/** Collision triangles for the given occurrences, compiled like the renderer. */
export async function meshOf(
  project: Project,
  ids: string[],
  officialSources: Record<string, string> = {},
): Promise<CollisionSnapshot> {
  const vertices: number[] = [],
    indices: number[] = [];
  if (ids.length) {
    const source =
      scopedLDraw(project, ids, true).replace(
        "\n",
        "\n0 !COLOUR TestGrey CODE 7 VALUE #888888 EDGE #333333\n",
      ) +
      Object.entries(officialSources)
        .map(([ref, text]) => `\n0 FILE ${ref}\n${text}\n0 NOFILE\n`)
        .join("");
    const loader = new LDrawLoader().setConditionalLineMaterial(
      LDrawConditionalLineMaterial,
    );
    if (Object.keys(officialSources).length) {
      loader.setFileMap(
        Object.fromEntries(
          Object.keys(officialSources).map((ref) => [ref, ref]),
        ),
      );
      (
        loader as unknown as {
          partsCache: {
            parseCache: { fetchData: (ref: string) => Promise<string> };
          };
        }
      ).partsCache.parseCache.fetchData = async (ref) => {
        const text = officialSources[ref.replaceAll("\\", "/").toLowerCase()];
        if (!text) throw new Error(`Missing pinned test geometry: ${ref}`);
        return text;
      };
    }
    const group = await new Promise<Group>((ok, fail) =>
      (
        loader.parse as unknown as (
          s: string,
          o: (g: Group) => void,
          f: (e: unknown) => void,
        ) => void
      )(source, ok, fail),
    );
    group.updateMatrixWorld(true);
    group.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      const p = object.geometry.getAttribute("position"),
        offset = vertices.length / 3;
      for (let i = 0; i < p.count; i++) {
        const v = new Vector3()
          .fromBufferAttribute(p, i)
          .applyMatrix4(object.matrixWorld);
        vertices.push(v.x, v.y, v.z);
      }
      const idx = object.geometry.index;
      for (let i = 0; i < (idx?.count ?? p.count); i++)
        indices.push(offset + (idx ? idx.getX(i) : i));
    });
  }
  return {
    revision: project.revision,
    vertices: new Float32Array(vertices),
    indices: new Uint32Array(indices),
    bounds: { min: [-400, -300, -500], max: [400, 0, 300] },
  };
}
/** Compile an identity reference with the ORIGINAL occurrence source scope.
 * World scoped parsing already rounds flattened placements in the loader. */
export async function memberLocalOf(
  project: Project,
  id: string,
  officialSources: Record<string, string> = {},
): Promise<PlayMemberLocalGeometry> {
  const occurrence = occurrences(project).find((o) => o.id === id);
  if (!occurrence || occurrence.namespace === "missing")
    throw new Error("Missing canonical member source");
  const context = occurrenceRenderContext(project, occurrence),
    colour = "0 !COLOUR TestGrey CODE 7 VALUE #888888 EDGE #333333";
  let group: Group;
  if (occurrence.node.kind === "geometry") {
    group = await new RawPrimitiveCompiler(colour).compile(
      occurrenceRawRecord(project, occurrence),
      occurrence.colorCode,
      context,
    );
  } else {
    const definitions =
        occurrence.namespace === "project"
          ? dependencySource(project, occurrence.node.ref).replace(
              /\n0 NOFILE\s*$/,
              "",
            )
          : "",
      ref =
        occurrence.namespace === "project"
          ? project.models[occurrence.node.ref].name
          : occurrence.node.ref,
      source = normalizeBfcSource(
        [
          "0 FILE __canonical__.ldr",
          colour,
          context.source,
          `1 ${occurrence.colorCode} 0 0 0 1 0 0 0 1 0 0 0 1 ${ref}`,
          definitions,
          ...Object.entries(officialSources)
            .filter(([name]) => !project.models[name.toLowerCase()])
            .map(([name, text]) => `0 FILE ${name}\n${text}\n0 NOFILE`),
        ].join("\n"),
      );
    const loader = new LDrawLoader().setConditionalLineMaterial(
      LDrawConditionalLineMaterial,
    );
    const refs = { ...officialSources };
    loader.setFileMap(
      Object.fromEntries(Object.keys(refs).map((ref) => [ref, ref])),
    );
    (
      loader as unknown as {
        partsCache: {
          parseCache: { fetchData: (ref: string) => Promise<string> };
        };
      }
    ).partsCache.parseCache.fetchData = async (ref) => {
      const text = refs[ref.replaceAll("\\", "/").toLowerCase()];
      if (!text) throw new Error(`Missing pinned canonical geometry: ${ref}`);
      return text;
    };
    group = await new Promise<Group>((ok, fail) =>
      (
        loader.parse as unknown as (
          s: string,
          o: (g: Group) => void,
          f: (e: unknown) => void,
        ) => void
      )(source, ok, fail),
    );
  }
  return new PlayMemberGeometryCapture().capture(
    [id],
    new Map([[id, occurrence]]),
    new Map([[id, new OccurrenceHandle(id, group)]]),
    project.revision,
  )[id];
}
/** Static world plus every requested rig with group and member geometry. */
export async function playSources(
  project: Project,
  rigIds: string[],
  officialSources: Record<string, string> = {},
) {
  const members = new Set(
    rigIds.flatMap((id) =>
      project.motionRigs[id].groups.flatMap((g) => g.occurrenceIds),
    ),
  );
  const geometry = await meshOf(
    project,
    occurrences(project)
      .filter((o) => !members.has(o.id))
      .map((o) => o.id),
    officialSources,
  );
  const sources: DynamicRigSource[] = [];
  for (const rigId of rigIds) {
    const rig = project.motionRigs[rigId];
    const groups: DynamicRigSource["groups"] = {},
      memberMeshes: DynamicRigSource["members"] = {},
      memberLocals: NonNullable<DynamicRigSource["memberLocals"]> = {};
    for (const g of rig.groups) {
      groups[g.id] = await meshOf(project, g.occurrenceIds, officialSources);
      for (const id of g.occurrenceIds) {
        memberMeshes[id] = await meshOf(project, [id], officialSources);
        memberLocals[id] = await memberLocalOf(project, id, officialSources);
      }
    }
    sources.push({
      project,
      rigId,
      groups,
      members: memberMeshes,
      memberLocals,
    });
  }
  return { geometry, sources };
}
