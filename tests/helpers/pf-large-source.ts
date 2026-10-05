import { fullLibrarySources } from "../../scripts/full-library-node";
import { compose, identity } from "../../src/core/math";
import type { Transform, Vec3 } from "../../src/core/types";
import { OccurrenceHandle } from "../../src/render/occurrence-handles";
import { PlayMemberGeometryCapture } from "../../src/render/play-member-geometry";
import {
  bindMotorComponentSources,
  partitionMotorSourcePrototype,
} from "../../src/render/source-component-geometry";
import { physicalPfLargeMotorFixture } from "../../src/mechanisms/pf-large-motor-fixture";
import { bindPfLargeMotorAssemblies } from "../../src/mechanisms/pf-large-motor-binding";
import type { PlayMechanismSource } from "../../src/play/mechanism";
import type { CollisionSnapshot } from "../../src/play/types";
import {
  loadMotorSourceComponents,
  motorComponentGroupMeshes,
} from "../../src/play/motor-source-components";
import { compileOfficialPart } from "./compile-part";

/** Real compiler/canonical capture plus actual source parts; no bounds proxy. */
export async function pfLargeSource(
  worldPose: Transform = identity(),
  phase = 0,
) {
  const fixture = physicalPfLargeMotorFixture(worldPose, phase),
    { project, all, rig } = fixture;
  const lookup = new Map(all.map((o) => [o.id, o])),
    handles = new Map(
      await Promise.all(
        all.map(
          async (o) =>
            [
              o.id,
              new OccurrenceHandle(o.id, await compileOfficialPart(o.node.ref)),
            ] as const,
        ),
      ),
    );
  const memberLocals = new PlayMemberGeometryCapture().capture(
      all.map((o) => o.id),
      lookup,
      handles,
      project.revision,
    ),
    members: Record<string, CollisionSnapshot> = {};
  for (const o of all) {
    const local = memberLocals[o.id],
      vertices = new Float32Array(local.vertices.length);
    for (let i = 0; i < vertices.length; i += 3) {
      const p = Array.from(local.vertices.slice(i, i + 3)) as Vec3;
      vertices.set(
        compose(o.transform, { ...identity(), position: p }).position,
        i,
      );
    }
    members[o.id] = {
      revision: project.revision,
      vertices,
      indices: local.indices,
      bounds: { min: [-100, -160, -150], max: [100, 0, 160] },
    };
  }
  const raw = fullLibrarySources(["99499.dat", "2780.dat", "3707.dat"]);
  await bindPfLargeMotorAssemblies(project, [rig], raw, all);
  const binding = await bindMotorComponentSources(raw, project),
    partition = await partitionMotorSourcePrototype(
      project,
      all[0],
      handles.get(all[0].id)!.prototype,
      binding,
    );
  const source: PlayMechanismSource = {
    project,
    rigId: rig.id,
    groups: {},
    members,
    memberLocals,
    lookup,
    motorComponents: {
      [all[0].id]: {
        case: partition.components[0].geometry,
        output: partition.components[1].geometry,
      },
    },
  };
  await loadMotorSourceComponents([source]);
  source.groups = motorComponentGroupMeshes(source);
  const geometry: CollisionSnapshot = {
    revision: project.revision,
    vertices: new Float32Array(),
    indices: new Uint32Array(),
    bounds: { min: [-400, -300, -400], max: [400, 0, 400] },
  };
  return { ...fixture, source, geometry };
}
