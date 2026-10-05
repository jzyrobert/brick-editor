import * as THREE from "three";
import { sha256 } from "../core/hash";
import { ensure, type Occurrence, type Project } from "../core/types";
import { DRIVETRAIN_SOURCES } from "../mechanisms/drivetrain-sources";
import { verifyReviewedSourceClosures } from "../mechanisms/reviewed-source-closure";
import {
  cloneTree,
  drawableTemplates,
  OccurrenceHandle,
} from "./occurrence-handles";
import { PART_COMPILER_VERSION } from "./part-compile-core";
import { PlayMemberGeometryCapture } from "./play-member-geometry";
import type { PlayMemberLocalGeometry } from "../play/types";

/** The source-bound rendering partition must be re-reviewed when the compiler
 * changes. Original source children, matrices, surfaces and line geometry are
 * retained; no bounding-box cut or replacement output shape is involved. */
export const MOTOR_COMPONENT_REVIEW = Object.freeze({
  compiler: "bpc4:three-r174",
  parentRef: "99499.dat",
  case: {
    ref: "10089c01.dat",
    triangles: 5824,
    geometrySha256:
      "7910889eaeecc44d8937e54ca69ae9da297cff33e31ece40057964cebbb387c6",
  },
  output: {
    ref: "10095.dat",
    triangles: 368,
    geometrySha256:
      "edf506aaf48378606216a6c886951b8b0c07d491475548df32be128320694562",
  },
});
type GeometrySignature = {
  triangles: number;
  lines: number;
  geometrySha256: string;
};
const coordinate = (x: number) => (Object.is(x, -0) ? 0 : x);
/** Complete canonical primitive multiset, preserving duplicate surfaces and
 * triangle winding. Indexing and drawable traversal order do not affect it. */
export async function sourceComponentGeometrySignature(
  prototype: THREE.Group,
): Promise<GeometrySignature> {
  const rows: string[] = [];
  let triangles = 0,
    lines = 0;
  const point = new THREE.Vector3();
  for (const t of drawableTemplates(prototype)) {
    const g = t.object.geometry,
      p = g.getAttribute("position"),
      index = g.index;
    ensure(
      p && p.itemSize >= 3,
      "INVALID_INPUT",
      "Source component needs position geometry",
    );
    const count = index?.count ?? p.count,
      stride = t.mesh ? 3 : 2;
    ensure(
      count % stride === 0,
      "INVALID_INPUT",
      "Invalid source primitive count",
    );
    const read = (
      attribute: THREE.BufferAttribute | THREE.InterleavedBufferAttribute,
      i: number,
    ) => {
      point
        .set(attribute.getX(i), attribute.getY(i), attribute.getZ(i))
        .applyMatrix4(t.local);
      ensure(
        [point.x, point.y, point.z].every(Number.isFinite),
        "INVALID_INPUT",
        "Source component geometry is not finite",
      );
      return [point.x, point.y, point.z].map(coordinate);
    };
    for (let i = 0; i < count; i += stride) {
      ensure(
        rows.length < 20000,
        "LIMIT_EXCEEDED",
        "Source component primitive budget exceeded",
      );
      const ids = Array.from({ length: stride }, (_, k) =>
        index ? index.getX(i + k) : i + k,
      );
      ensure(
        ids.every((n) => Number.isInteger(n) && n >= 0 && n < p.count),
        "INVALID_INPUT",
        "Invalid source component index",
      );
      if (t.mesh) {
        const corners = ids.map((n) => read(p, n)),
          variants = [0, 1, 2].map((k) =>
            JSON.stringify([
              corners[k],
              corners[(k + 1) % 3],
              corners[(k + 2) % 3],
            ]),
          );
        rows.push("triangle:" + variants.sort()[0]);
        triangles++;
      } else {
        const endpoints = ids.map((n) => JSON.stringify(read(p, n))).sort();
        const controls = t.conditional
          ? ["control0", "control1"]
              .map((name) => {
                const a = g.getAttribute(name);
                ensure(
                  a && a.itemSize >= 3,
                  "INVALID_INPUT",
                  "Conditional source line is incomplete",
                );
                return JSON.stringify(read(a, ids[0]));
              })
              .sort()
          : [];
        rows.push(
          JSON.stringify([
            t.conditional ? "conditional" : "edge",
            endpoints,
            controls,
          ]),
        );
        lines++;
      }
    }
  }
  return {
    triangles,
    lines,
    geometrySha256: await sha256(JSON.stringify(rows.sort())),
  };
}
export type MotorComponentSourceBinding = Readonly<{
  ref: "99499.dat";
  closureSha256: string;
}>;
const bindings = new WeakMap<
  MotorComponentSourceBinding,
  { project: Project; revision: number }
>();
export async function bindMotorComponentSources(
  sources: Readonly<Record<string, string>>,
  project: Project,
) {
  await verifyReviewedSourceClosures(
    sources,
    DRIVETRAIN_SOURCES,
    ["99499.dat"],
    { project },
  );
  const binding = Object.freeze({
    ref: "99499.dat" as const,
    closureSha256: DRIVETRAIN_SOURCES["99499.dat"].closureSha256,
  });
  bindings.set(binding, { project, revision: project.revision });
  return binding;
}
export type SourceComponentLocalGeometry = Omit<
  PlayMemberLocalGeometry,
  "occurrenceId"
> & {
  parentOccurrenceId: string;
  componentId: string;
  role: "case" | "output";
  sourcePath: readonly string[];
  sourceClosureSha256: string;
};
export type MotorSourceComponent = {
  parentOccurrenceId: string;
  componentId: string;
  role: "case" | "output";
  sourcePath: readonly string[];
  /** Borrowed source geometry/material buffers in an independently cloned tree. */
  prototype: THREE.Group;
  geometry: SourceComponentLocalGeometry;
};
export type MotorSourceComponentPartition = {
  parentOccurrenceId: string;
  components: [MotorSourceComponent, MotorSourceComponent];
  coverage: {
    triangles: number;
    drawables: number;
    componentTriangles: [number, number];
  };
};
const partitions = new WeakMap<MotorSourceComponentPartition, THREE.Group>();
function motorBranches(prototype: THREE.Group) {
  const motor = prototype.children[0] as THREE.Group | undefined;
  ensure(
    prototype.children.length === 1 &&
      motor?.isGroup &&
      motor.children.length === 2 &&
      motor.userData.type === "Shortcut",
    "INVALID_INPUT",
    "Motor source prototype must preserve the actual shortcut branches",
  );
  const branches = motor.children as THREE.Group[];
  ensure(
    branches.every((g) => g.isGroup) &&
      branches[0].userData.type === "Shortcut" &&
      branches[1].userData.type === "Part" &&
      branches[1].userData.colorCode === "25",
    "INVALID_INPUT",
    "Motor source child roles do not match the reviewed literal source",
  );
  motor.updateMatrix();
  ensure(
    motor.matrix.equals(new THREE.Matrix4()),
    "INVALID_INPUT",
    "Motor source wrapper does not match its literal rest placement",
  );
  return branches as [THREE.Group, THREE.Group];
}
/** Consume an actual loaded canonical occurrence prototype after source binding.
 * Output components share one inventory occurrence and retain its exact frame.
 * Their canonical surfaces are supplied separately to carrier/rotor collisions. */
export async function partitionMotorSourcePrototype(
  project: Project,
  o: Occurrence,
  prototype: THREE.Group,
  binding: MotorComponentSourceBinding,
): Promise<MotorSourceComponentPartition> {
  ensure(
    bindings.get(binding)?.project === project &&
      bindings.get(binding)?.revision === project.revision &&
      o.namespace === "official" &&
      o.node.ref === "99499.dat" &&
      PART_COMPILER_VERSION === MOTOR_COMPONENT_REVIEW.compiler,
    "INVALID_INPUT",
    "Motor components need the reviewed project, source closure and compiler",
  );
  const branches = motorBranches(prototype),
    wrappers = branches.map((branch) => {
      const wrapper = new THREE.Group();
      wrapper.add(cloneTree(branch));
      return wrapper;
    });
  const signatures = await Promise.all(
    wrappers.map(sourceComponentGeometrySignature),
  );
  const expected = [MOTOR_COMPONENT_REVIEW.case, MOTOR_COMPONENT_REVIEW.output];
  ensure(
    signatures.every(
      (s, i) =>
        s.triangles === expected[i].triangles &&
        s.geometrySha256 === expected[i].geometrySha256,
    ),
    "INVALID_INPUT",
    "Motor source component geometry changed or lost source coverage",
  );
  const all = drawableTemplates(prototype),
    covered = branches.flatMap((branch) =>
      drawableTemplates(branch).map((t) => t.object),
    );
  ensure(
    new Set(covered).size === covered.length &&
      all.length === covered.length &&
      all.every((t) => covered.includes(t.object)),
    "INVALID_INPUT",
    "Motor component partition must cover every drawable exactly once",
  );
  const roles = ["case", "output"] as const;
  const occurrences = new Map<string, Occurrence>(),
    handles = new Map<string, OccurrenceHandle>();
  for (const [i, role] of roles.entries()) {
    const id = JSON.stringify([o.id, "source-component", role]);
    occurrences.set(id, { ...o, id });
    handles.set(id, new OccurrenceHandle(id, wrappers[i]));
  }
  const surfaces = new PlayMemberGeometryCapture().capture(
    [...occurrences.keys()],
    occurrences,
    handles,
    project.revision,
  );
  const components: MotorSourceComponent[] = roles.map((role, i) => {
    const componentId = [...occurrences.keys()][i],
      { occurrenceId: _, ...surface } = surfaces[componentId];
    const sourcePath = ["99499.dat", expected[i].ref];
    return {
      parentOccurrenceId: o.id,
      componentId,
      role,
      sourcePath,
      prototype: wrappers[i],
      geometry: {
        ...surface,
        parentOccurrenceId: o.id,
        componentId,
        role,
        sourcePath,
        sourceClosureSha256: binding.closureSha256,
      },
    };
  });
  const partition = {
    parentOccurrenceId: o.id,
    components: [components[0], components[1]] as [
      MotorSourceComponent,
      MotorSourceComponent,
    ],
    coverage: {
      triangles: signatures[0].triangles + signatures[1].triangles,
      drawables: all.length,
      componentTriangles: signatures.map((s) => s.triangles) as [
        number,
        number,
      ],
    },
  };
  partitions.set(partition, prototype);
  return partition;
}
/** Apply motor spin only to the materialized occurrence copy. Neither the shared
 * prototype nor authored placement is changed. The parent continues to follow
 * its actual carrier handle; local source rest phase stays independent. */
export function motorSourceComponentController(
  handle: OccurrenceHandle,
  partition: MotorSourceComponentPartition,
) {
  ensure(
    partitions.get(partition) === handle.prototype &&
      handle.id === partition.parentOccurrenceId &&
      handle.object,
    "INVALID_INPUT",
    "Motor transient components need their materialized occurrence",
  );
  const materialized = handle.object;
  const [caseGroup, outputGroup] = motorBranches(materialized),
    caseRest = caseGroup.matrix.clone(),
    outputRest = outputGroup.matrix.clone();
  const restAutoupdate = [
    caseGroup.matrixAutoUpdate,
    outputGroup.matrixAutoUpdate,
  ];
  caseGroup.matrixAutoUpdate = false;
  outputGroup.matrixAutoUpdate = false;
  return {
    setOutputAngle(degrees: number) {
      ensure(
        handle.object === materialized,
        "INVALID_INPUT",
        "Motor component occurrence is no longer materialized",
      );
      ensure(
        Number.isFinite(degrees) && Math.abs(degrees) <= 1e9,
        "INVALID_INPUT",
        "Motor output phase must be finite and bounded",
      );
      outputGroup.matrix.multiplyMatrices(
        new THREE.Matrix4().makeRotationZ(((degrees % 360) * Math.PI) / 180),
        outputRest,
      );
      outputGroup.matrixWorldNeedsUpdate = true;
    },
    reset() {
      caseGroup.matrix.copy(caseRest);
      outputGroup.matrix.copy(outputRest);
      caseGroup.matrixAutoUpdate = restAutoupdate[0];
      outputGroup.matrixAutoUpdate = restAutoupdate[1];
      caseGroup.matrixWorldNeedsUpdate = true;
      outputGroup.matrixWorldNeedsUpdate = true;
    },
  };
}
