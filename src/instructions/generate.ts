import { insertionFingerprint } from "./collision";
import { insertionPlanning } from "./motion";
import { instructionDisplayStates } from "./programme";
import { displayProfiles } from "./display-procedures";
import { mechanismProfiles } from "./mechanism-procedures";
import { interfaceProfiles } from "./interface-procedures";
import { decorationProfiles } from "./decoration-procedures";
import {
  sourcePrecedence,
  isolatedWorkbenchCandidates,
} from "./source-procedures";
import { sceneWorkbenches } from "./scene-workbenches";
import { sourceGuidedProgramme } from "./source-programme";
import {
  sourceGuidedCandidates,
  type SourceCandidateResult,
} from "./source-candidates";
import { getLocalInstructionBounds } from "./source-geometry";
import { axialPrecedence, AXIAL_PROFILES } from "./axial";
import { wheelCandidates, WHEEL_FAMILIES } from "./wheels";
import {
  figureProfiles,
  figurePrecedence,
  figureWorkbenchCandidates,
} from "./figures";
import { enclosurePrecedence } from "./access";
/** Deterministic planning of an existing assembly. Narrow source-guided
 * candidates explicitly use authored hierarchy/STEP as an ordering prior. */
import { instructionComponents } from "./components";
import { partSpec } from "../catalog/extended";
import installed from "../catalog/bounds.json";
import { localOccupancy } from "../edit/snap";
import { connectionGraph, worldConnectors, mates } from "../core/connectivity";
import { occurrences } from "../core/document";
import { physical } from "../core/math";
import {
  projectBounds,
  primitiveBounds,
  transformBounds,
  unionBounds,
  type Bounds,
} from "../core/spatial";
import {
  ensure,
  type CameraSpec,
  type InstructionPlan,
  type Project,
  type Vec3,
} from "../core/types";

export type GenerationReport = {
  algorithm:
    | "connected-bottom-up-v1"
    | "connected-bottom-up-v2"
    | "connected-bottom-up-v3"
    | "connected-bottom-up-v4"
    | "connected-bottom-up-v5"
    | "connected-bottom-up-v6"
    | "connected-bottom-up-v7"
    | "connected-bottom-up-v8"
    | "connected-bottom-up-v9"
    | "connected-bottom-up-v10"
    | "connected-bottom-up-v11"
    | "connected-bottom-up-v12"
    | "connected-bottom-up-v13"
    | "connected-bottom-up-v14"
    | "connected-bottom-up-v15"
    | "connected-bottom-up-v16";
  sourceGuidance?: "hierarchy-and-step-prior";
  sourceCandidates?: number;
  displayOperations?: number;
  displayConflicts?: number;
  displaySceneCandidates?: number;
  figureOperations?: number;
  figureConflicts?: number;
  figureCandidates?: number;
  insertionFingerprint?: string;
  insertionPrecedences?: number;
  insertionConflicts?: number;
  insertionClear?: number;
  insertionBlocked?: number;
  insertionUnknown?: number;
  insertionTriangleTests?: number;
  insertionBudgetReached?: boolean;
  axialOperations?: number;
  axialMatchedBushes?: number;
  axialUnmatched?: number;
  axialConflicts?: number;
  enclosureConstraints?: number;
  accessConflicts?: number;
  sourceRevision: number;
  maxPerStep: number;
  total: number;
  connectorCovered: number;
  boundsUnknown: number;
  inferredSupportPairs: number;
  unanchored: number;
  lowVisibilitySteps: number;
  warnings: string[];
};
export type GenerationOptions = {
  name?: string;
  maxPerStep?: number;
  /** Default true. Authored source order is a disclosed prior, not connectivity. */
  useSourceSteps?: boolean;
};
/** Maintainer evidence for checked agent refinement; copied arrays cannot edit
 * the generator's graph. Indices address whole planning units, never parts
 * silently extracted from a generated drawing owner. */
export type InstructionPlanningEvidence = {
  units: {
    index: number;
    ids: string[];
    supports: number[];
    hosts: number[];
    access: number[];
    adjacent: number[];
    wholeDrawing: boolean;
  }[];
  connectorCovered: string[];
};
const centre = (b: Bounds): Vec3 =>
  b.min.map((v, i) => (v + b.max[i]) / 2) as Vec3;
const distance = (a: Vec3, b: Vec3) => Math.hypot(...a.map((v, i) => v - b[i]));
const dot = (a: Vec3, b: Vec3) => a.reduce((n, v, i) => n + v * b[i], 0);
const normalize = (a: Vec3): Vec3 => a.map((v) => v / Math.hypot(...a)) as Vec3;
const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const directions: Vec3[] = (
  [
    [1, -1.3, 1],
    [-1, -1.3, 1],
    [-1, -1.3, -1],
    [1, -1.3, -1],
    [1, 0.45, 1],
    [-1, 0.45, 1],
    [-1, 0.45, -1],
    [1, 0.45, -1],
  ] as Vec3[]
).map(normalize);

/** A ray to the viewer intersects the conservative blocker box. */
function blocked(p: Vec3, direction: Vec3, b: Bounds) {
  let enter = 0.5,
    leave = Infinity;
  for (let axis = 0; axis < 3; axis++) {
    if (Math.abs(direction[axis]) < 1e-12) {
      if (p[axis] < b.min[axis] || p[axis] > b.max[axis]) return false;
      continue;
    }
    const a = (b.min[axis] - p[axis]) / direction[axis],
      c = (b.max[axis] - p[axis]) / direction[axis];
    enter = Math.max(enter, Math.min(a, c));
    leave = Math.min(leave, Math.max(a, c));
  }
  return leave > enter;
}

/** Fit the displayed geometry; score candidate views for visibility of additions.
 * The margin fits a 4:3 page and the narrower live viewport. AABB rays are a
 * conservative visibility proxy, not a mesh or insertion-path validation. */
function stepCamera(
  boxes: Bounds[],
  additions: Bounds[],
  previous: number,
  focusBoxes: Bounds[] = additions,
  preferDetail = false,
  facingAxis?: Vec3,
) {
  // Reviewed receiving axes point towards the wheel. Restrict its completed
  // placement views to that side; visibility boxes alone can favour a view
  // through the body. This is a camera direction, not an installation path.
  const views = facingAxis
    ? (() => {
        const axis = normalize(facingAxis),
          tilt: Vec3 = Math.abs(axis[1]) > 0.95 ? [1, 0, 0] : [0, -1, 0],
          lateral = normalize(cross(axis, tilt));
        return [
          ...[-0.35, 0, 0.35].map((side) =>
            normalize(
              axis.map((v, a) => v + tilt[a] * 0.4 + lateral[a] * side) as Vec3,
            ),
          ),
          ...directions.filter((d) => dot(d, axis) > 0.3),
        ];
      })()
    : directions;
  const bounds = boxes.reduce<Bounds | null>(unionBounds, null)!;
  const target = centre(bounds);
  let best = previous,
    bestScore = -Infinity,
    bestHidden = 0;
  for (let view = 0; view < views.length; view++) {
    let visible = 0,
      hidden = 0;
    for (const b of additions) {
      const c = centre(b),
        d = views[view];
      // Sample the top centre and two viewer-facing corners, just outside the box.
      const samples: Vec3[] = [
        [c[0], b.min[1] - 0.6, c[2]],
        [d[0] > 0 ? b.max[0] + 0.6 : b.min[0] - 0.6, c[1], c[2]],
        [c[0], c[1], d[2] > 0 ? b.max[2] + 0.6 : b.min[2] - 0.6],
      ];
      const seen = samples.filter(
        (p) => !boxes.some((other) => other !== b && blocked(p, d, other)),
      ).length;
      visible += seen / 3;
      if (!seen) hidden++;
    }
    const score =
      visible - hidden * 10 - (facingAxis || view === previous ? 0 : 0.35);
    if (score > bestScore) {
      best = view;
      bestScore = score;
      bestHidden = hidden;
    }
  }
  const direction = views[best],
    right = normalize(cross(direction, [0, -1, 0])),
    up = cross(right, direction);
  let halfWidth = 0,
    halfHeight = 0,
    depth = 0;
  for (const x of [bounds.min[0], bounds.max[0]])
    for (const y of [bounds.min[1], bounds.max[1]])
      for (const z of [bounds.min[2], bounds.max[2]]) {
        const relative: Vec3 = [x - target[0], y - target[1], z - target[2]];
        halfWidth = Math.max(halfWidth, Math.abs(dot(relative, right)));
        halfHeight = Math.max(halfHeight, Math.abs(dot(relative, up)));
        depth = Math.max(depth, Math.abs(dot(relative, direction)));
      }
  const span = Math.max(60, 2.35 * Math.max(halfHeight, halfWidth)),
    offset = Math.max(200, depth + span * 2);
  const camera: CameraSpec = {
    space: "ldraw",
    projection: "orthographic",
    position: target.map((v, i) => v + direction[i] * offset) as Vec3,
    target,
    up: [0, -1, 0],
    fovDeg: 45,
    near: 0.5,
    far: offset + depth + span * 3,
    span,
  };
  const newBounds = focusBoxes.reduce<Bounds | null>(unionBounds, null)!;
  const focus = {
    min: newBounds.min.map((v) => v - 40) as Vec3,
    max: newBounds.max.map((v) => v + 40) as Vec3,
  };
  const focusTarget = centre(focus);
  let focusWidth = 0,
    focusHeight = 0;
  for (const x of [focus.min[0], focus.max[0]])
    for (const y of [focus.min[1], focus.max[1]])
      for (const z of [focus.min[2], focus.max[2]]) {
        const relative: Vec3 = [
          x - focusTarget[0],
          y - focusTarget[1],
          z - focusTarget[2],
        ];
        focusWidth = Math.max(focusWidth, Math.abs(dot(relative, right)));
        focusHeight = Math.max(focusHeight, Math.abs(dot(relative, up)));
      }
  const focusSpan = Math.max(100, 2.35 * Math.max(focusWidth, focusHeight));
  const close =
    camera.span! > focusSpan * 1.6 ||
    (preferDetail && focusSpan < camera.span!);
  const detailCamera: CameraSpec = {
    ...camera,
    target: focusTarget,
    span: focusSpan,
    position: focusTarget.map((v, i) => v + direction[i] * offset) as Vec3,
  };
  return {
    camera: close ? detailCamera : camera,
    contextCamera: close ? camera : undefined,
    view: best,
    lowVisibility: bestHidden > 0,
  };
}
export { stepCamera as instructionPlacementCamera };

export function generateInstructions(
  project: Project,
  options: GenerationOptions = {},
  captureEvidence?: (evidence: InstructionPlanningEvidence) => void,
): { plan: InstructionPlan; report: GenerationReport } {
  const maxPerStep = options.maxPerStep ?? 6;
  ensure(
    options.useSourceSteps === undefined ||
      typeof options.useSourceSteps === "boolean",
    "INVALID_INPUT",
    "Source-step guidance must be a boolean.",
  );
  ensure(
    Number.isInteger(maxPerStep) && maxPerStep >= 1 && maxPerStep <= 20,
    "INVALID_INPUT",
    "Heuristic steps support 1–20 new parts.",
  );
  const name = options.name ?? "Suggested steps";
  ensure(
    typeof name === "string" && name.trim().length > 0 && name.length <= 200,
    "INVALID_INPUT",
    "Instruction name must contain 1–200 characters.",
  );
  const all = occurrences(project);
  ensure(
    all.length > 0 && all.length <= 5000,
    "LIMIT_EXCEEDED",
    "Heuristic generation supports 1–5,000 occurrences.",
  );
  const graph = connectionGraph(project, all),
    known = new Set(graph.covered);
  const resolver = projectBounds(
    project,
    installed.bounds as unknown as Record<string, Bounds | null>,
    installed.dependencies.transitive,
  );
  const report: GenerationReport = {
    algorithm: "connected-bottom-up-v16",
    sourceRevision: project.revision,
    maxPerStep,
    total: all.length,
    connectorCovered: known.size,
    boundsUnknown: 0,
    inferredSupportPairs: 0,
    unanchored: 0,
    lowVisibilitySteps: 0,
    warnings: [],
  };
  const sourceBounds = new Map<string, Bounds | null>();
  const missingLocalBounds = (ref: string) => {
    if (!project.models[ref]) return null;
    if (!sourceBounds.has(ref))
      sourceBounds.set(ref, getLocalInstructionBounds(project, ref).bounds);
    return sourceBounds.get(ref)!;
  };
  const leaves = all.map((o, index) => {
    const occupancy =
      o.namespace === "official" && o.node.kind === "part"
        ? localOccupancy(o.node.ref)
        : null;
    const local =
      o.node.kind === "geometry"
        ? primitiveBounds(
            project.models[o.modelId].records.find(
              (r) => r.id === o.node.sourceRecordId,
            )?.raw ?? "",
          )
        : (occupancy?.reduce<Bounds | null>(unionBounds, null) ??
          resolver.model(o.node.ref));
    const box = local ? transformBounds(local, o.transform) : null;
    if (!box) report.boundsUnknown++;
    const p = box ? centre(box) : o.transform.position;
    return {
      o,
      index,
      box,
      p,
      area: box ? (box.max[0] - box.min[0]) * (box.max[2] - box.min[2]) : 0,
      lot: JSON.stringify([o.node.ref, o.colorCode]),
      parent: JSON.stringify(o.path.slice(0, -1)),
      supports: new Set<number>(),
      adjacent: new Set<number>(),
      inferred: new Set<number>(),
      hosts: new Set<number>(),
      access: new Set<number>(),
      downstream: 0,
      region:
        o.path.length > 1
          ? JSON.stringify(o.path.slice(0, 1))
          : JSON.stringify([
              o.layerId,
              Math.floor(p[0] / 160),
              Math.floor(p[2] / 160),
            ]),
      broad:
        !!box && box.max[0] - box.min[0] > 240 && box.max[2] - box.min[2] > 240,
      name: partSpec(o.node.ref)?.name ?? "",
    };
  });
  const components = instructionComponents(project, all);
  const ownerById = new Map(
    components.flatMap((c) => c.occurrenceIds.map((id) => [id, c] as const)),
  );
  const figures = figureProfiles(project, all);
  figures.groups = figures.groups.filter((group) => {
    if (!group.ids.some((id) => ownerById.has(id))) return true;
    for (const id of group.ids) figures.units.delete(id);
    return false;
  });
  const leafById = new Map(leaves.map((i) => [i.o.id, i]));
  const consumed = new Set<string>();
  const items = leaves.flatMap((leaf) => {
    if (consumed.has(leaf.o.id)) return [];
    const component = ownerById.get(leaf.o.id);
    const sourceLegs = figures.units.get(leaf.o.id);
    const ids = component?.occurrenceIds ?? sourceLegs?.ids ?? [leaf.o.id];
    for (const id of ids) consumed.add(id);
    const box = ids
      .map((id) => leafById.get(id)!.box)
      .reduce<Bounds | null>(
        (b, next) => (next ? unionBounds(b, next) : b),
        null,
      );
    return [
      {
        ...leaf,
        box,
        p: box ? centre(box) : leaf.p,
        area: box ? (box.max[0] - box.min[0]) * (box.max[2] - box.min[2]) : 0,
        ids,
        lot: component
          ? JSON.stringify([
              "@generated:" + component.sourceModelId,
              component.colorCode,
              component.kind,
            ])
          : leaf.lot,
        component,
        sourceLegs,
      },
    ];
  });
  items.forEach((item, index) => (item.index = index));
  const byId = new Map(
    items.flatMap((item) => item.ids.map((id) => [id, item] as const)),
  );
  const connectors = new Map(all.map((o) => [o.id, worldConnectors(o)]));
  for (const item of items)
    for (const leafId of item.ids)
      for (const id of graph.edges.get(leafId) ?? []) {
        const other = byId.get(id)!;
        if (other === item) continue;
        item.adjacent.add(other.index);
        // Verified seating outranks body-centre height (overhangs and thin
        // tiles can share a centre). A vertical underside needs its receiving
        // stud first; a hinged leaf needs the actual socket frame. These final
        // contacts still do not establish a feasible insertion or snap motion.
        let typed = false;
        for (const c of connectors.get(leafId) ?? [])
          for (const d of connectors.get(id) ?? []) {
            if (!mates(c, d)) continue;
            const seated =
              c.kind === "antistud" && d.kind === "stud" && c.axis[1] > 0.99;
            const receiving =
              c.kind === "stud" && d.kind === "antistud" && d.axis[1] > 0.99;
            const leaf = c.kind === "pin" && d.kind === "socket";
            const frame = c.kind === "socket" && d.kind === "pin";
            if (seated || leaf) item.supports.add(other.index);
            if (leaf) item.hosts.add(other.index);
            typed ||= seated || receiving || leaf || frame;
          }
        // Other contacts retain the prior height heuristic. Lateral mating
        // direction alone cannot say which loose part should be held first.
        if (!typed && other.p[1] > item.p[1] + 0.5)
          item.supports.add(other.index);
      }
  // Body-face support is only a fallback for uncovered connectors. Keep it
  // separate from verified attachment, and restrict to rigid placements.
  const topPlanes = new Map<number, typeof items>();
  for (const item of items)
    if (
      item.box &&
      !item.component &&
      physical(item.o.transform) &&
      item.o.node.kind !== "geometry"
    ) {
      const key = Math.round(item.box.min[1]),
        list = topPlanes.get(key) ?? [];
      list.push(item);
      topPlanes.set(key, list);
    }
  let pairWork = 0;
  for (const item of items)
    if (
      item.box &&
      !item.component &&
      physical(item.o.transform) &&
      item.o.node.kind !== "geometry"
    ) {
      const key = Math.round(item.box.max[1]);
      for (let plane = key - 1; plane <= key + 1; plane++)
        for (const other of topPlanes.get(plane) ?? []) {
          ensure(
            ++pairWork <= 2000000,
            "LIMIT_EXCEEDED",
            "Support search exceeds its work budget.",
          );
          if (
            other.index === item.index ||
            !other.box ||
            other.p[1] <= item.p[1] + 0.5 ||
            Math.abs(other.box.min[1] - item.box.max[1]) > 0.5
          )
            continue;
          if (
            item.ids.every((id) => known.has(id)) &&
            other.ids.every((id) => known.has(id))
          )
            continue;
          const overlap = [0, 2].map(
            (a) =>
              Math.min(item.box!.max[a], other.box!.max[a]) -
              Math.max(item.box!.min[a], other.box!.min[a]),
          );
          if (
            overlap.some((v) => v < 4) ||
            overlap[0] * overlap[1] < Math.min(item.area, other.area) * 0.2
          )
            continue;
          item.supports.add(other.index);
          item.inferred.add(other.index);
          report.inferredSupportPairs++;
        }
    }
  // Cavity hints only expedite glazing in a containing window frame. They
  // are never counted as verified connectors or insertion-path evidence.
  for (const pane of items.filter((i) => /glass.*window/i.test(i.name)))
    for (const host of items.filter(
      (i) => /window/i.test(i.name) && !/glass/i.test(i.name),
    )) {
      if (pane.region !== host.region || !pane.box || !host.box) continue;
      if (
        pane.p.every(
          (v, a) => v >= host.box!.min[a] - 2 && v <= host.box!.max[a] + 2,
        )
      )
        pane.hosts.add(host.index);
    }
  const access = enclosurePrecedence(
    items.map((i) => ({
      index: i.index,
      box: i.box,
      parent: i.parent,
      blocksTop: !connectors.get(i.o.id)?.some((c) => c.kind === "pin"),
      eligible:
        !i.component &&
        !i.broad &&
        i.o.namespace === "official" &&
        !!worldConnectors(i.o)?.some(
          (c) => c.kind === "antistud" && c.axis[1] > 0.99,
        ),
      requires: new Set([...i.supports, ...i.hosts]),
    })),
  );
  items.forEach((item, index) => (item.access = access.edges[index]));
  const accessTargets = new Set(access.edges.flatMap((s) => [...s]));
  report.enclosureConstraints = access.edges.reduce((n, s) => n + s.size, 0);
  report.accessConflicts = access.conflicts.size;
  report.warnings.push(
    `${report.enclosureConstraints} closure precedences use an estimated top approach with a 12 LDU handling margin, not a validated hand or insertion path. ${report.accessConflicts} operations have conflicting support/access evidence and need manual review.${access.exhausted ? " Access search reached its work budget; remaining approaches are unknown." : ""}`,
  );
  const axial = axialPrecedence(
    items.map((i) => ({
      index: i.index,
      o: i.o,
      eligible: !i.component,
      requires: new Set([...i.supports, ...i.hosts, ...i.access]),
    })),
  );
  items.forEach(
    (i, n) => (i.access = new Set([...i.access, ...axial.edges[n]])),
  );
  report.axialOperations = axial.operations.size;
  report.axialMatchedBushes = [...axial.operations.values()].filter(
    (o) => o.host !== undefined,
  ).length;
  report.axialUnmatched = axial.ambiguous;
  report.axialConflicts = axial.conflicts;
  if (axial.operations.size)
    report.warnings.push(
      `${axial.operations.size} separate axial operations use six source-reviewed part profiles; ${report.axialMatchedBushes} bushes have a unique geometric axle match. ${axial.ambiguous} bushes have no unique match; ${axial.conflicts} mechanism groups have conflicting ordering evidence. Alignment, roll, receiving holes, travel, support and physical fit remain unverified.${axial.exhausted ? " Axial search reached its work budget; remaining matches are unknown." : ""}`,
    );
  const wheels = wheelCandidates(items, project.library);
  if (wheels.candidates.length || wheels.unmatched)
    report.warnings.push(
      `${wheels.candidates.length} unique rim/tyre candidates from five reviewed families; ${wheels.unmatched} tyres need pairing review. Geometric association does not verify tyre deformation, seating, receiving fit or fastening.${wheels.exhausted ? " Wheel matching reached its work budget." : ""}`,
    );
  const wheelOwner = new Map<number, string>();
  const wheelModules: NonNullable<InstructionPlan["modules"]> = {};
  const wheelIndices = new Set(
    items
      .filter((i) =>
        WHEEL_FAMILIES.some(
          (f) => f.rim === i.o.node.ref || f.tyre === i.o.node.ref,
        ),
      )
      .map((i) => i.index),
  );
  const depends = (from: number, on: number) => {
    const seen = new Set<number>(),
      queue = [from];
    for (let n = 0; n < queue.length; n++) {
      if (n >= 200000) return true;
      const index = queue[n];
      if (index === on) return true;
      if (seen.has(index)) continue;
      seen.add(index);
      queue.push(
        ...items[index].supports,
        ...items[index].hosts,
        ...items[index].access,
      );
    }
    return false;
  };
  for (const c of wheels.candidates) {
    // Respect existing receiving/access constraints rather than contract a cycle.
    if (
      depends(c.rim, c.tyre) ||
      (c.host !== undefined &&
        (depends(c.host, c.rim) || depends(c.host, c.tyre)))
    )
      continue;
    items[c.tyre].access.add(c.rim);
    if (c.host !== undefined) items[c.rim].access.add(c.host);
    const key = "wheel-" + (Object.keys(wheelModules).length + 1);
    wheelModules[key] = {
      name: `Wheel ${Object.keys(wheelModules).length + 1} (${items[c.rim].o.node.ref} + ${items[c.tyre].o.node.ref})`,
      occurrenceIds: [...items[c.rim].ids, ...items[c.tyre].ids],
      feasibility: "unknown",
      purpose: "wheel",
      ...(c.receiver ? { receiver: c.receiver } : {}),
      ...(c.host !== undefined ? { hostIds: items[c.host].ids } : {}),
    };
    for (const index of [c.rim, c.tyre]) {
      wheelOwner.set(index, key);
      items[index].region = key;
    }
  }
  const originalDisplays = displayProfiles(project, all);
  const interfaces = interfaceProfiles(project, all);
  const decorations = decorationProfiles(project, all);
  const displayProfilesResult = {
    groups: [
      ...originalDisplays.groups,
      ...interfaces.groups,
      ...decorations.groups,
    ],
    exhausted:
      originalDisplays.exhausted ||
      interfaces.exhausted ||
      decorations.exhausted,
  };
  const displayOrder = sourcePrecedence(
    displayProfilesResult.groups.filter((group) =>
      group.ids.every((id) => {
        const item = byId.get(id)!;
        return (
          !item.component && !item.broad && !!item.box && item.ids.length === 1
        );
      }),
    ),
    items,
  );
  const displayOperations = displayOrder.operations;
  const displayScenes = isolatedWorkbenchCandidates(
    displayOrder.groups.filter((g) => g.scene),
    items,
  );
  report.displayOperations = displayOperations.size;
  report.displayConflicts = displayOrder.conflicts;
  report.displaySceneCandidates = displayScenes.length;
  if (displayProfilesResult.groups.length || displayProfilesResult.exhausted)
    report.warnings.push(
      `${displayOperations.size} source-reviewed sign, shutter, steering, control, hand-grip or decoration operations; ${displayOrder.conflicts} candidates retained conflicting prerequisites. ${displayScenes.length} isolated two-part source signs are eligible for scene benches; conflicting contraction retains a flat programme. Landmark association does not verify hinge snapping, steering or handle fit, adhesive supply/retention, detached support or a stable stance.${displayOrder.exhausted || displayProfilesResult.exhausted ? " Display procedure search reached its work budget; remaining candidates retain their original constraints." : ""}`,
    );
  const figureOrder = figurePrecedence(figures.groups, items),
    figureOperations = figureOrder.operations,
    figureGroups = figureOrder.groups,
    figureConflicts = figureOrder.conflicts;
  report.figureOperations = figureOperations.size;
  report.figureConflicts = figureConflicts;
  report.figureCandidates = figureGroups.length;
  const figureMembers = new Map(
    figureGroups.flatMap((group) =>
      [...group.operations.keys()].map(
        (id) => [byId.get(id)!.index, group.ids] as const,
      ),
    ),
  );
  if (figures.groups.length || figures.rejected)
    report.warnings.push(
      `${figureGroups.length} source-reviewed figure candidates have separate body/arm/hand/head procedures; ${figureConflicts} retained conflicting prerequisites and ${figures.rejected} source groups failed profile/membership gates. Source landmarks and 0.02 near-rigid display tolerance do not grant verified connectors, rigid insertion, manufactured fit or supplied part identity. Obsolete hips/legs source groups retain every raw inventory occurrence.${figureOrder.exhausted ? " Figure prerequisite search reached its budget; unfinished candidates retain the original constraints." : ""}`,
    );
  const mechanisms = mechanismProfiles(project, all);
  const jointProcedures = new Map<
    string,
    NonNullable<import("./display-procedures").DisplayGroup["workbench"]>
  >();
  const motion = insertionPlanning(project, all, items);
  try {
    items.forEach((i, n) => {
      for (const required of motion.edges[n]) i.access.add(required);
    });
    const mechanismOrder = sourcePrecedence(
      mechanisms.groups.filter((group) =>
        group.ids.every((id) => {
          const item = byId.get(id)!;
          return (
            !item.component &&
            !item.broad &&
            !!item.box &&
            item.ids.length === 1 &&
            !wheelOwner.has(item.index) &&
            !figureOperations.has(item.index) &&
            !displayOperations.has(item.index)
          );
        }),
      ),
      items,
    );
    for (const [index, operation] of mechanismOrder.operations)
      displayOperations.set(index, operation);
    report.displayOperations = displayOperations.size;
    for (const group of mechanismOrder.groups)
      if (group.workbench) {
        const key = `joint-${jointProcedures.size + 1}`;
        jointProcedures.set(key, group.workbench);
        const inside = new Set(
          group.workbench.ids.map((id) => byId.get(id)!.index),
        );
        const receivers = new Set(
          [...inside]
            .flatMap((n) => [...items[n].supports, ...items[n].hosts])
            .filter((n) => !inside.has(n))
            .flatMap((n) => items[n].ids),
        );
        wheelModules[key] = {
          name: group.name,
          occurrenceIds: group.workbench.ids,
          feasibility: "unknown",
          purpose: "joint",
          hostIds: [...receivers],
        };
        for (const index of inside) items[index].region = key;
      }
    if (mechanisms.groups.length || mechanisms.exhausted)
      report.warnings.push(
        `${mechanismOrder.operations.size} source-reviewed hinge and staged pin-joint operations; ${jointProcedures.size} held five-part joint candidates. ${mechanismOrder.conflicts} groups retained original prerequisites because ordering or workbench contraction conflicted. Pin collars are not passed through closed two-recipient bores; snap lips, mounting travel, fit and detached support remain unverified.${mechanisms.exhausted || mechanismOrder.exhausted ? " Mechanism search reached its work budget; unfinished candidates retain their original programme." : ""}`,
      );
    report.insertionFingerprint = motion.fingerprint;
    report.insertionPrecedences = motion.precedences;
    report.insertionConflicts = motion.conflicts.size;
    report.insertionClear =
      report.insertionBlocked =
      report.insertionUnknown =
        0;
    // Bounded support-chain utility breaks foundation ties before cosmetic work.
    // Counts are saturated because shared DAG descendants can occur twice.
    for (const item of [...items].sort((a, b) => a.p[1] - b.p[1]))
      for (const n of item.supports)
        items[n].downstream = Math.min(
          64,
          items[n].downstream + item.downstream + 1,
        );
    const remaining = new Set(items.map((i) => i.index)),
      built = new Set<number>();
    const steps: string[][] = [],
      stepMetadata: NonNullable<InstructionPlan["stepMetadata"]> = [];
    const cumulativeBoxes: Bounds[] = [];
    let view = 0,
      last: (typeof items)[number] | undefined;
    // Lowest body level, independent of LDraw origin (which may be off-centre).
    const ground = items.reduce(
      (y, i) => Math.max(y, i.box?.max[1] ?? i.p[1]),
      -Infinity,
    );
    const attached = (i: (typeof items)[number]) =>
      [...i.adjacent].some((n) => built.has(n));
    const inferred = (i: (typeof items)[number]) =>
      [...i.inferred].some((n) => built.has(n));
    while (remaining.size) {
      ensure(
        steps.length < 2000,
        "LIMIT_EXCEEDED",
        "Heuristic plan exceeds 2,000 steps; generate a smaller section.",
      );
      const prior = new Set(built);
      // An open region can contain another section's furniture/stairs. Complete
      // ready interior work before its surrounding region becomes an enclosure.
      // This is an access preference from boxes, never a collision or motion proof.
      const walls = last
        ? items.filter(
            (i) =>
              prior.has(i.index) &&
              i.region === last!.region &&
              !i.broad &&
              !i.component &&
              i.box &&
              i.box.max[1] - i.box.min[1] >= 20,
          )
        : [];
      const enclosure =
        walls.length >= 3
          ? walls.map((i) => i.box!).reduce<Bounds | null>(unionBounds, null)
          : null;
      const urgent = new Set<number>();
      if (
        enclosure &&
        enclosure.max[0] - enclosure.min[0] <= 500 &&
        enclosure.max[2] - enclosure.min[2] <= 500
      )
        for (const n of remaining) {
          const i = items[n];
          if (
            i.region !== last!.region &&
            !i.component &&
            i.p[0] > enclosure.min[0] + 8 &&
            i.p[0] < enclosure.max[0] - 8 &&
            i.p[2] > enclosure.min[2] + 8 &&
            i.p[2] < enclosure.max[2] - 8 &&
            i.p[1] <= enclosure.max[1]
          )
            urgent.add(n);
        }
      const chosen: typeof items = [],
        lots = new Set<string>();
      let anchor: (typeof items)[number] | undefined;
      const issues = new Set<string>();
      while (chosen.length < maxPerStep) {
        let next: (typeof items)[number] | undefined,
          best = -Infinity;
        for (const n of remaining) {
          const item = items[n];
          if (![...item.supports].every((n) => prior.has(n))) continue;
          if (![...item.access].every((n) => prior.has(n))) continue;
          if (item.hosts.size && ![...item.hosts].some((n) => prior.has(n)))
            continue;
          if (
            anchor &&
            (axial.operations.has(anchor.index) ||
              axial.operations.has(item.index) ||
              wheelIndices.has(anchor.index) ||
              wheelIndices.has(item.index) ||
              displayOperations.has(anchor.index) ||
              displayOperations.has(item.index) ||
              figureOperations.has(anchor.index) ||
              figureOperations.has(item.index) ||
              anchor.sourceLegs ||
              item.sourceLegs)
          )
            continue;
          if (
            anchor &&
            (item.region !== anchor.region ||
              Math.abs(item.p[1] - anchor.p[1]) > 8.5 ||
              distance(item.p, anchor.p) > 120 ||
              (!lots.has(item.lot) && lots.size >= 3))
          )
            continue;
          // A lateral pair with no prior anchor is an ordered held operation,
          // not two mutually dependent additions in an unordered picture.
          if (
            anchor &&
            !attached(item) &&
            chosen.some((i) => item.adjacent.has(i.index))
          )
            continue;
          // Unconfirmed attachments may group within the same authored section,
          // but never silently mix separate unconnected sections.
          const onGround =
            !!item.box && Math.abs(item.box.max[1] - ground) < 0.5;
          if (
            anchor &&
            !attached(item) &&
            !inferred(item) &&
            !onGround &&
            anchor.parent !== item.parent
          )
            continue;
          const reference = anchor ?? last;
          const hostReady =
            [...item.hosts].some((n) => prior.has(n)) ||
            !!displayOperations
              .get(item.index)
              ?.hostIds.some((id) => prior.has(byId.get(id)!.index));
          const score =
            (attached(item) ? 1000 : inferred(item) || hostReady ? 500 : 0) +
            item.p[1] * 0.6 +
            item.downstream * 24 +
            (reference && !reference.broad && reference.region === item.region
              ? 3000
              : 0) +
            (hostReady ? 6000 : 0) +
            (urgent.has(item.index) ? 8000 : 0) +
            Math.min(200, Math.sqrt(item.area)) * 0.6 +
            (reference?.parent === item.parent ? 35 : 0) +
            (lots.has(item.lot) ? 30 : 0) -
            (reference ? distance(item.p, reference.p) * 0.2 : 0);
          if (score > best) {
            best = score;
            next = item;
          }
        }
        if (!next && chosen.length) break;
        ensure(
          next,
          "INVALID_INPUT",
          "No build order found for support constraints.",
        );
        const onGround = !!next.box && Math.abs(next.box.max[1] - ground) < 0.5;
        if (!attached(next) && !inferred(next) && !onGround) {
          report.unanchored++;
          if (
            !figureOperations.has(next.index) &&
            !displayOperations.has(next.index)
          )
            issues.add(
              "Hold this section while adding it; attachment has not been confirmed.",
            );
        }
        // Axial operations already name the receiving/alignment review below.
        // Retain coverage diagnostics in the report without repeating a generic
        // fitting warning in the same printed operation.
        if (
          !axial.operations.has(next.index) &&
          !figureOperations.has(next.index) &&
          !displayOperations.has(next.index) &&
          !next.ids.every((id) => known.has(id))
        )
          issues.add(
            "Check the fit of these parts; their connections are not fully described.",
          );
        if (inferred(next) && !attached(next))
          issues.add(
            "Support is estimated from touching surfaces; check the connection.",
          );
        if (!next.box)
          issues.add(
            "The size of some additions is unknown; adjust the view if needed.",
          );
        if (next.o.node.kind === "geometry" && !next.component)
          issues.add(
            "Includes drawing geometry rather than a separate physical part.",
          );
        if (next.hosts.size && !displayOperations.has(next.index))
          issues.add(
            connectors.get(next.o.id)?.some((c) => c.kind === "pin")
              ? "Use the receiving frame already shown; insertion or snapping remains unverified."
              : "The glass destination is estimated from a nearby frame; check fit and access.",
          );
        const axialOperation = axial.operations.get(next.index);
        if (axialOperation)
          issues.add(
            axialOperation.role === "axle"
              ? "Place this axle separately. Check receiving holes, alignment, support and access."
              : axialOperation.host !== undefined
                ? "Add this bush after axle R; inner collars before outer. Check roll, seating and fit."
                : "Handle this bush separately. " +
                  axialOperation.unknownReason +
                  " Check its receiving part, orientation and fit manually.",
          );
        if (next.component)
          issues.add(
            next.component.name +
              ". Its source drawing is one operation; real part identity and assembly feasibility are unverified.",
          );
        if (next.sourceLegs && !figureOperations.has(next.index))
          issues.add(
            "Use the supplied hips-and-legs group together; do not separate it to match these obsolete source component drawings. If loose, review their identity and joining method. Physical fit and support remain unverified.",
          );
        const figureOperation = figureOperations.get(next.index);
        const displayOperation = displayOperations.get(next.index);
        if (figureOperation && !displayOperation)
          issues.add(figureOperation.notes);
        if (displayOperation) issues.add(displayOperation.notes);
        if (urgent.has(next.index))
          issues.add(
            "Work in this overlapping region before more enclosure work; access is only estimated from body bounds.",
          );
        if (accessTargets.has(next.index))
          issues.add(
            "Add this before nearby enclosure parts. Top approach and handling clearance are estimated from body bounds; check actual access.",
          );
        if (access.conflicts.has(next.index))
          issues.add(
            "Support prerequisites conflict with the estimated approach. Access remains unresolved; review the construction order manually.",
          );
        anchor ??= next;
        chosen.push(next);
        lots.add(next.lot);
        remaining.delete(next.index);
        last = next;
      }
      for (const item of chosen) built.add(item.index);
      if (anchor) {
        const rootNode = project.models[project.rootModelId].nodes.find(
          (n) => n.id === anchor.o.path[0],
        );
        const name =
          rootNode?.kind === "submodel"
            ? project.models[rootNode.ref]?.name
            : undefined;
        if (name) issues.add(`Work on ${name.slice(0, 160)}.`);
      }
      steps.push(chosen.flatMap((i) => i.ids));
      for (const item of chosen) if (item.box) cumulativeBoxes.push(item.box);
      const additions = chosen.flatMap((i) => (i.box ? [i.box] : []));
      let camera: CameraSpec | undefined, contextCamera: CameraSpec | undefined;
      if (additions.length) {
        const result = stepCamera(cumulativeBoxes, additions, view);
        camera = result.camera;
        contextCamera = result.contextCamera;
        if (result.view !== view)
          issues.add("View turns to show the new parts.");
        view = result.view;
        if (result.lowVisibility) {
          report.lowVisibilitySteps++;
          issues.add(
            "Some additions may be hidden. Rotate the model to check their positions.",
          );
        }
      }
      stepMetadata.push({
        ...(camera ? { camera } : {}),
        ...(contextCamera ? { contextCamera } : {}),
        ...(issues.size ? { notes: [...issues].join(" ") } : {}),
      });
    }
    if (components.length)
      report.warnings.push(
        `${components.length} generated drawing representations are owned as whole operations; their physical identities, lengths or part breakdowns remain unverified.`,
      );
    if (report.connectorCovered < all.length)
      report.warnings.push(
        `${all.length - report.connectorCovered} occurrences have unknown connector coverage.`,
      );
    if (report.boundsUnknown)
      report.warnings.push(
        `${report.boundsUnknown} occurrences have unknown bounds.`,
      );
    if (report.inferredSupportPairs)
      report.warnings.push(
        `${report.inferredSupportPairs} support relationships were inferred from body bounds, not verified connectors.`,
      );
    if (report.unanchored)
      report.warnings.push(
        `${report.unanchored} additions start without a confirmed prior attachment or ground support.`,
      );
    if (report.lowVisibilitySteps)
      report.warnings.push(
        `${report.lowVisibilitySteps} steps need a visibility review.`,
      );
    report.warnings.push(
      "Review before building: straight CAD approaches cover only supported rigid motions. Physical fit, stability, hands, snaps, flexible elements and separate subassembly construction are not validated.",
    );
    const plan: InstructionPlan = {
      name,
      steps,
      stepMetadata,
      generation: report,
    };
    // Only compact, non-foundation source sections become workbench candidates.
    // Source hierarchy is never proof of detachable construction or a safe join.
    const modules: NonNullable<InstructionPlan["modules"]> = {
        ...wheelModules,
      },
      owner = new Map<string, string>();
    for (const group of figureWorkbenchCandidates(figureGroups, items)) {
      const key =
        "figure-" +
        (Object.keys(modules).filter((k) => k.startsWith("figure-")).length +
          1);
      modules[key] = {
        name: group.name,
        occurrenceIds: group.ids,
        feasibility: "unknown",
        placement: "scene",
      };
    }
    const displaySceneFacing = new Map<string, Vec3>();
    for (const [n, group] of displayScenes.entries()) {
      displaySceneFacing.set(
        `sign-${n + 1}`,
        [...group.operations.values()][0].facing,
      );
      modules[`sign-${n + 1}`] = {
        name: group.name,
        occurrenceIds: group.ids,
        feasibility: "unknown",
        placement: "scene",
      };
    }
    for (const node of project.models[project.rootModelId].nodes) {
      if (node.kind !== "submodel") continue;
      const section = items.filter((i) => i.o.path[0] === node.id);
      if (
        section.length < 4 ||
        section.length > 300 ||
        section.some(
          (i) =>
            wheelOwner.has(i.index) ||
            figureOperations.has(i.index) ||
            displayOperations.has(i.index) ||
            i.component ||
            i.broad ||
            !i.box ||
            i.o.node.kind === "geometry",
        )
      )
        continue;
      const b = section
        .map((i) => i.box!)
        .reduce<Bounds | null>(unionBounds, null)!;
      if (
        b.max[0] - b.min[0] > 500 ||
        b.max[2] - b.min[2] > 500 ||
        b.max[1] - b.min[1] > 650
      )
        continue;
      // A compact envelope can still hide disconnected props. Require complete
      // connector coverage and one verified internal contact component. This
      // establishes contact topology, not detachable stability or handling.
      if (section.some((i) => !i.ids.every((id) => known.has(id)))) continue;
      const connected = new Set([section[0].index]),
        internal = new Set(section.map((i) => i.index));
      const queue = [section[0].index];
      for (let cursor = 0; cursor < queue.length; cursor++)
        for (const next of items[queue[cursor]].adjacent)
          if (internal.has(next) && !connected.has(next)) {
            connected.add(next);
            queue.push(next);
          }
      if (connected.size !== section.length) continue;
      const key = "candidate-" + (Object.keys(modules).length + 1);
      const ids = section.flatMap((i) => i.ids);
      modules[key] = {
        name: project.models[node.ref].name,
        occurrenceIds: ids,
        feasibility: "unknown",
      };
      for (const id of ids) owner.set(id, key);
    }
    if (Object.keys(modules).length) {
      const sourceStep = new Map(
        steps.flatMap((ids, index) => ids.map((id) => [id, index] as const)),
      );
      type Task = {
        key: string;
        indices: number[];
        requires: Set<string>;
        first: number;
      };
      let ordered: Task[] = [];
      // Contraction can turn a leaf DAG into a module cycle. Fall back to ordinary
      // cumulative steps for implicated candidates, then rebuild the task graph.
      while (true) {
        owner.clear();
        for (const [key, module] of Object.entries(modules))
          for (const id of module.occurrenceIds) owner.set(id, key);
        const stepTask = steps.map(
            (ids, n) => owner.get(ids[0]) ?? "step-" + n,
          ),
          tasks = new Map<string, Task>();
        for (let n = 0; n < steps.length; n++) {
          const key = stepTask[n],
            task = tasks.get(key) ?? {
              key,
              indices: [],
              requires: new Set<string>(),
              first: n,
            };
          ensure(
            steps[n].every((id) => (owner.get(id) ?? "step-" + n) === key),
            "INVALID_INPUT",
            "A workbench task mixes ownership.",
          );
          task.indices.push(n);
          tasks.set(key, task);
          for (const item of new Set(steps[n].map((id) => byId.get(id)!)))
            for (const required of new Set([
              ...item.supports,
              ...item.hosts,
              ...item.access,
            ])) {
              const dependency =
                stepTask[sourceStep.get(items[required].ids[0])!];
              if (dependency !== key) task.requires.add(dependency);
            }
        }
        const pending = new Map(tasks),
          complete = new Set<string>();
        ordered = [];
        while (pending.size) {
          const ready = [...pending.values()]
            .filter((task) =>
              [...task.requires].every((key) => complete.has(key)),
            )
            .sort((a, b) => a.first - b.first)[0];
          if (!ready) break;
          ordered.push(ready);
          complete.add(ready.key);
          pending.delete(ready.key);
        }
        if (!pending.size) break;
        const rejected = [...pending.keys()].filter((key) => modules[key]);
        ensure(
          rejected.length > 0,
          "INVALID_INPUT",
          "No source-task order satisfies prerequisites.",
        );
        for (const key of rejected) delete modules[key];
        report.warnings.push(
          `${rejected.length} candidate source sections reverted to cumulative construction because contracting them prevents a dependency order.`,
        );
      }
      const expandedSteps: string[][] = [],
        expandedMeta: NonNullable<InstructionPlan["stepMetadata"]> = [];
      for (const task of ordered) {
        const candidate = modules[task.key];
        for (const index of task.indices) {
          expandedSteps.push(steps[index]);
          const meta = structuredClone(stepMetadata[index]);
          if (candidate) meta.assembly = { type: "build", moduleId: task.key };
          if (
            task.key.startsWith("sign-") &&
            displayOperations.get(byId.get(steps[index][0])!.index)?.role ===
              "sign-base"
          )
            meta.notes =
              "Build this sign on its own workbench. " + (meta.notes ?? "");
          if (candidate?.purpose === "wheel")
            meta.notes =
              candidate.occurrenceIds[0] === steps[index][0]
                ? "Hold this rim separately before fitting its tyre."
                : "Fit the pictured tyre around the rim from the preceding step. Check its seating all around; tyre deformation and physical fit are unverified.";
          expandedMeta.push(meta);
        }
        if (candidate) {
          expandedSteps.push([]);
          expandedMeta.push({
            assembly: { type: "join", moduleId: task.key },
            notes:
              candidate.placement === "scene"
                ? task.key.startsWith("sign-")
                  ? "Place this completed sign beside the other objects as shown. No new parts or mating connection inferred. Check that its support and stance are suitable; the source grouping does not establish physical independence or balance."
                  : "Place the completed pictured figure in the scene. No new parts or mating connection inferred. Keep any supplied torso and hips-and-legs assemblies together. Check its stance and support; source grouping does not prove physical independence or a stable pose."
                : candidate.purpose === "joint"
                  ? jointProcedures.get(task.key)!.notes +
                    " The far arm tip also has an estimated source support at the cab panel; compare that relationship in the main context. It is not a verified socket."
                  : candidate.purpose === "wheel"
                    ? candidate.hostIds?.length
                      ? `Place the completed wheel on the pictured pin/axle feature of ${byId.get(candidate.hostIds[0])!.name || byId.get(candidate.hostIds[0])!.o.node.ref} (${byId.get(candidate.hostIds[0])!.o.node.ref}). Use the bare receiver view to locate the feature. Keep the receiver in place and check the wheel hole, alignment and fastening. Physical fit and handling need review.`
                      : "Receiving part unresolved: choose the mounting pin/axle in the editor before building. Review its hole, alignment and fastening at the marked destination."
                    : "Use the completed candidate. No new parts. Source support/host prerequisites are already in the main assembly; physical fit, detachable stability, handling and insertion access remain unknown. Final orientation is shown.",
          });
        }
      }
      ensure(
        expandedSteps.length <= 2000,
        "LIMIT_EXCEEDED",
        "Workbench programme exceeds 2,000 steps.",
      );
      plan.steps = expandedSteps;
      plan.stepMetadata = expandedMeta;
      if (Object.keys(modules).length) {
        plan.modules = modules;
        report.warnings.push(
          `${Object.keys(modules).length} candidates have workbench builds and zero-new-part joins: ${Object.values(modules).filter((m) => m.purpose === "wheel").length} use reviewed wheel-family geometry; figure/sign sections use reviewed complete source membership; joint sections use finite source-reviewed bore/pin associations; other source sections have internally verified contact connectivity. Every external support/host task precedes their build. Detached stability, handling and merge feasibility remain UNKNOWN.`,
        );
      }
    }
    const scenes = sceneWorkbenches(project, plan, items);
    report.warnings.push(...scenes.warnings);
    captureEvidence?.({
      units: items.map((i) => ({
        index: i.index,
        ids: [...i.ids],
        supports: [...i.supports],
        hosts: [...i.hosts],
        access: [...i.access],
        adjacent: [...i.adjacent],
        wholeDrawing: !!i.component,
      })),
      connectorCovered: [...graph.covered],
    });
    // Recover complete custom-source bounds for candidate display only, after
    // support/access planning. They cannot manufacture graph prerequisites.
    const sourceItems =
      options.useSourceSteps === false
        ? items
        : items.map((item) => {
            if (
              item.box ||
              item.ids.length !== 1 ||
              item.o.node.kind !== "part"
            )
              return item;
            const local = missingLocalBounds(item.o.node.ref);
            if (!local) return item;
            const box = transformBounds(local, item.o.transform);
            return {
              ...item,
              box,
              p: centre(box),
              broad:
                box.max[0] - box.min[0] > 240 && box.max[2] - box.min[2] > 240,
            };
          });
    const source: SourceCandidateResult =
      options.useSourceSteps === false
        ? {
            candidates: [],
            matches: new Map(),
            provenance: [],
            refusals: [],
            exhausted: false,
          }
        : sourceGuidedCandidates(project, all, sourceItems);
    const programme = sourceGuidedProgramme(plan, items, source.candidates);
    if (programme.adopted) {
      plan.steps = programme.plan.steps;
      plan.stepMetadata = programme.plan.stepMetadata;
      plan.modules = programme.plan.modules;
      const owned = new Set(source.candidates.flatMap((c) => c.members));
      for (const item of sourceItems)
        if (
          !items[item.index].box &&
          item.box &&
          item.ids.every((id) => owned.has(id))
        ) {
          items[item.index].box = item.box;
          items[item.index].p = item.p;
          report.boundsUnknown -= item.ids.length;
        }
      report.sourceGuidance = "hierarchy-and-step-prior";
      report.sourceCandidates = programme.adopted;
      report.warnings.push(
        `${programme.adopted} source-guided candidates use authored hierarchy and STEP order as a prior. Finite source landmarks identify receiving candidates; connector coverage is unchanged. These programmes do not establish connected or stable detached construction, physical fit, permitted angle, insertion or handling.`,
      );
    }
    if (source.exhausted || programme.reason)
      report.warnings.push(
        source.exhausted
          ? "Source-guided candidate search exhausted its budget; the existing programme is retained."
          : programme.reason!,
      );
    if (source.refusals.length)
      report.warnings.push(
        `${source.refusals.length} source-guided interface candidates failed complete membership, frame or ordering gates; no partial candidate is used.`,
      );
    // Reframe the state actually shown: a workbench contains only that candidate;
    // the main assembly contains only completed joins and directly built parts.
    let previousView = 0;
    report.lowVisibilitySteps = 0;
    const states = instructionDisplayStates(plan);
    for (let n = 0; n < plan.steps.length; n++) {
      const state = states[n],
        meta = plan.stepMetadata![n];
      const shown = [...new Set(state.displayIds.map((id) => byId.get(id)!))],
        additions = [...new Set(state.highlightIds.map((id) => byId.get(id)!))];
      const moving = state.incomingIds;
      const module = meta.assembly
        ? plan.modules?.[meta.assembly.moduleId]
        : undefined;
      const figureOperation =
        additions.length === 1
          ? figureOperations.get(additions[0].index)
          : undefined;
      const displayOperation =
        additions.length === 1
          ? displayOperations.get(additions[0].index)
          : undefined;
      meta.insertionChecks =
        module?.placement === "scene" && meta.assembly?.type === "join"
          ? [
              {
                occurrenceIds: moving!,
                status: "unknown",
                scope: "cad-surface-translation",
                reason:
                  "Scene arrangement has no inferred mating connection or prescribed installation route. Physical independence, support and handling remain unverified.",
              },
            ]
          : module?.purpose === "source"
            ? [
                {
                  occurrenceIds: moving ?? plan.steps[n],
                  status: "unknown",
                  scope: "cad-surface-translation",
                  reason:
                    "Authored source order and finite display landmarks do not prescribe a rigid insertion route, snap fit, permitted angle, support or physical reorientation. Physical assembly remains unverified.",
                },
              ]
            : module?.purpose === "joint" && meta.assembly?.type === "join"
              ? [
                  (() => {
                    const checked = motion.check(
                      moving!,
                      state.displayIds.filter((id) => !moving!.includes(id)),
                      motion.groupDirections(moving!),
                    );
                    return {
                      ...checked,

                      reason:
                        checked.status === "blocked"
                          ? "The tested rigid straight mounting route crosses prior source surfaces. This does not prove physical impossibility or rule out angled handling. Mounting alignment, snap fit and support require review."
                          : (checked.reason ? checked.reason + " " : "") +
                            "The joint candidate has no prescribed mounting route; snap fit, simultaneous alignment, support and handling remain unverified.",
                    };
                  })(),
                ]
              : displayOperation
                ? [
                    {
                      occurrenceIds: plan.steps[n],
                      status: "unknown",
                      scope: "cad-surface-translation",
                      reason:
                        displayOperation.role === "decoration"
                          ? "Source finite-face coverage does not verify adhesive attachment, sticker identity/supply, seam retention or a checked insertion route."
                          : displayOperation.role === "control-base" ||
                              displayOperation.role === "control-stick" ||
                              displayOperation.role === "accessory"
                            ? "Source interface landmarks do not prescribe lever snapping, grip fitting, retention, support or a checked insertion route."
                            : "Source display landmarks and ordering do not prescribe hinge snapping, steering fitting, detached support or a checked insertion route.",
                    },
                  ]
                : figureOperation || additions.some((i) => i.sourceLegs)
                  ? [
                      {
                        occurrenceIds: plan.steps[n],
                        status: "unknown",
                        scope: "cad-surface-translation",
                        reason:
                          "Figure source landmarks and supplied-assembly guidance do not prescribe rigid fitting, deformation, retention or a checked insertion route.",
                      },
                    ]
                  : module?.purpose === "wheel"
                    ? [
                        {
                          occurrenceIds: moving ?? plan.steps[n],
                          status: "unknown",
                          scope: "cad-surface-translation",
                          reason:
                            meta.assembly?.type === "join"
                              ? "Wheel receiving fit and fastening require review; no straight installation route is prescribed."
                              : plan.steps[n][0] === module.occurrenceIds[0]
                                ? "Rim preparation is a held workbench operation; no installation route is prescribed."
                                : "Tyre fitting requires deformation; source poses show seating, not a rigid translation route.",
                        },
                      ]
                    : moving
                      ? [
                          motion.check(
                            moving,
                            state.displayIds.filter(
                              (id) => !moving.includes(id),
                            ),
                            motion.groupDirections(moving),
                          ),
                        ]
                      : additions.map((item) =>
                          motion.check(
                            item.ids,
                            state.displayIds.filter(
                              (id) => !item.ids.includes(id),
                            ),
                          ),
                        );
      for (const check of meta.insertionChecks) {
        if (check.status === "clear") report.insertionClear!++;
        else if (check.status === "blocked") report.insertionBlocked!++;
        else report.insertionUnknown!++;
      }
      const boxes = shown.flatMap((i) => (i.box ? [i.box] : [])),
        newBoxes = additions.flatMap((i) => (i.box ? [i.box] : []));
      if (!newBoxes.length) continue;
      const defaultResult = stepCamera(
        boxes,
        newBoxes,
        previousView,
        newBoxes,
        additions.some((i) => axial.operations.has(i.index)),
      );
      const placementFacing =
        meta.assembly?.type === "join"
          ? ((programme.adopted
              ? source.matches.get(meta.assembly.moduleId)?.facing
              : undefined) ??
            jointProcedures.get(meta.assembly.moduleId)?.facing ??
            displaySceneFacing.get(meta.assembly.moduleId) ??
            (scenes.staticModules.includes(meta.assembly.moduleId)
              ? ([0, -1, 0] as Vec3)
              : undefined))
          : undefined;
      const result =
        displayOperation || placementFacing
          ? stepCamera(
              boxes,
              newBoxes,
              0,
              newBoxes,
              !!displayOperation ||
                !scenes.staticModules.includes(meta.assembly?.moduleId ?? ""),
              displayOperation?.facing ?? placementFacing,
            )
          : figureOperation
            ? stepCamera(
                boxes,
                newBoxes,
                0,
                newBoxes,
                true,
                figureOperation.facing,
              )
            : module?.receiver && meta.assembly?.type === "join"
              ? stepCamera(
                  boxes,
                  newBoxes,
                  0,
                  newBoxes,
                  false,
                  module.receiver.axis,
                )
              : defaultResult;
      meta.camera = displayOperation?.camera ?? result.camera;
      if (displayOperation?.completedDetail)
        meta.completedDetail = structuredClone(
          displayOperation.completedDetail,
        );
      meta.contextCamera = result.contextCamera;
      // Warnings describe this replayed display, not the old cumulative image.
      meta.notes = meta.notes
        ?.replace(/View turns to show the new parts\.\s*/g, "")
        .replace(
          /Some additions may be hidden\. Rotate the model to check their positions\.\s*/g,
          "",
        );
      if (result.lowVisibility) {
        report.lowVisibilitySteps++;
        meta.notes =
          (meta.notes ?? "") +
          " Some destinations remain concealed; markers show approximate final locations, not insertion paths.";
      }
      // Keep the continuity sequence for unrelated operations unchanged.
      previousView = defaultResult.view;
      if (state.incomingIds)
        meta.incomingCamera = stepCamera(
          newBoxes,
          newBoxes,
          previousView,
          newBoxes,
          false,
          placementFacing,
        ).camera;
      if (
        result.lowVisibility ||
        additions.some((i) => i.component) ||
        module?.purpose === "wheel"
      ) {
        const alt = {
          ...meta.camera,
          target: [...meta.camera.target] as Vec3,
          position: meta.camera.position.map((v, a) =>
            a === 1 ? 2 * meta.camera!.target[a] - v : v,
          ) as Vec3,
        };
        meta.alternateCamera = alt;
      } else delete meta.alternateCamera;
      // Tyre fitting needs the bare rim from the preceding workbench state.
      // A second completed-wheel view hides the receiving surface and can imply
      // that the tyre was already fitted. No rigid installation path is inferred.
      if (
        module?.purpose === "wheel" &&
        meta.assembly?.type === "build" &&
        plan.steps[n][0] !== module.occurrenceIds[0]
      )
        meta.alternateBeforePlacement = true;
      const marked = additions.filter(
        (i) =>
          result.lowVisibility ||
          i.component ||
          axial.operations.has(i.index) ||
          [15, 47, 40, 36, 41, 42, 43, 44, 45, 46, 57].includes(
            Number(i.o.colorCode),
          ) ||
          i.hosts.size,
      );
      meta.targets = marked.slice(0, 6).map((i, index) => ({
        position: i.p,
        label: String(index + 1),
        occurrenceId: i.o.id,
        caption: i.component?.name ?? (i.name || i.o.node.ref),
      }));
      if (meta.assembly?.type === "join")
        meta.targets = [
          {
            position: centre(
              newBoxes.reduce<Bounds | null>(unionBounds, null)!,
            ),
            label: module?.placement === "scene" ? "S" : "J",
            caption:
              module?.placement === "scene"
                ? "Completed candidate scene destination; no mating connection inferred"
                : "Completed candidate final destination",
          },
        ];
      if (module?.purpose === "wheel" && meta.assembly?.type === "join")
        for (const id of module.hostIds ?? []) {
          const receiver = byId.get(id)!;
          meta.targets.push({
            position: receiver.p,
            label: "R",
            occurrenceId: id,
            caption: `${receiver.name || receiver.o.node.ref}; receiving candidate — check hole, alignment and fastening`,
          });
        }
      if (module?.receiver && meta.assembly?.type === "join") {
        meta.targets.push({
          position: module.receiver.position,
          label: "P",
          caption:
            "Candidate receiving pin/axle feature; check matching hole, roll and fastening",
        });
        meta.axisReference = {
          from: module.receiver.position,
          to: module.receiver.position.map(
            (v, a) => v + module.receiver!.axis[a] * 24,
          ) as Vec3,
          sourceRef: byId.get(module.hostIds![0])!.o.node.ref,
          feasibility: "unknown",
        };
        const a = module.receiver.axis;
        const d = normalize(
          Math.abs(a[1]) > 0.95 ? [1, a[1] * 0.5, 0] : [a[0], a[1] - 0.4, a[2]],
        );
        meta.alternateCamera = {
          space: "ldraw",
          projection: "orthographic",
          target: module.receiver.position,
          position: module.receiver.position.map(
            (v, n) => v + d[n] * 250,
          ) as Vec3,
          up: [0, -1, 0],
          span: 100,
          fovDeg: 45,
          near: 0.5,
          far: 600,
        };
        meta.alternateBeforePlacement = true;
      }
      if (displayOperation?.feature && displayOperation.hostIds.length) {
        const hostId = displayOperation.hostIds[0],
          host = byId.get(hostId)!;
        const detail = normalize(
          displayOperation.receivingFacing ?? displayOperation.facing,
        );
        meta.alternateCamera = {
          space: "ldraw",
          projection: "orthographic",
          target: displayOperation.feature,
          position: displayOperation.feature.map(
            (v, a) => v + detail[a] * 200,
          ) as Vec3,
          up: Math.abs(detail[1]) > 0.95 ? [1, 0, 0] : [0, -1, 0],
          span: displayOperation.span,
          fovDeg: 45,
          near: 0.5,
          far: 500,
        };
        meta.alternateBeforePlacement = true;
        if (displayOperation.detailIds) {
          const prior = new Set(
            state.displayIds.filter((id) => !plan.steps[n].includes(id)),
          );
          meta.alternateDetailIds = displayOperation.detailIds.filter((id) =>
            prior.has(id),
          );
          meta.notes =
            (meta.notes ?? "") +
            " Receiver detail omits surrounding parts; locate it in the main view. Physical access remains unverified.";
        }
        meta.targets ??= [];
        if (displayOperation.role === "sign-face")
          meta.targets = meta.targets.filter(
            (t) => !plan.steps[n].includes(t.occurrenceId ?? ""),
          );
        const landmarks = displayOperation.landmarks ?? [
          {
            position: displayOperation.feature,
            caption: `Receiving source landmark on ${host.name || host.o.node.ref} (${host.o.node.ref}); fit unverified`,
          },
        ];
        meta.targets.push(
          ...landmarks.map((p, n) => {
            const id =
              "occurrenceId" in p && p.occurrenceId ? p.occurrenceId : hostId;
            const owner = byId.get(id)!;
            return {
              position: p.position,
              label: landmarks.length > 1 ? `P${n + 1}` : "P",
              occurrenceId: id,
              caption: `${p.caption} (${owner.o.node.ref})`,
            };
          }),
        );
      }
      if (module?.purpose === "joint" && meta.assembly?.type === "join") {
        const receivers = module.hostIds ?? [];
        const boxes = receivers.map((id) => byId.get(id)!.box!).filter(Boolean);
        const nearby = boxes.filter(
          (b) => b.min[2] > meta.camera!.target[2] - 150,
        );
        const target = centre(
          (nearby.length ? nearby : boxes).reduce<Bounds | null>(
            unionBounds,
            null,
          )!,
        );
        const detail = normalize(
          jointProcedures.get(meta.assembly.moduleId)!.facing,
        );
        meta.alternateCamera = {
          space: "ldraw",
          projection: "orthographic",
          target,
          position: target.map((v, a) => v + detail[a] * 300) as Vec3,
          up: [0, -1, 0],
          span: 180,
          fovDeg: 45,
          near: 0.5,
          far: 700,
        };
        meta.alternateBeforePlacement = true;
        meta.alternateDetailIds = receivers;
        meta.notes =
          (meta.notes ?? "") +
          " Receiver detail omits surrounding vehicle parts; use the main context for the long arm and cab. Physical access remains unverified.";
        meta.targets.push(
          ...receivers.map((id, n) => ({
            position: byId.get(id)!.p,
            label: `R${n + 1}`,
            occurrenceId: id,
            caption: `${byId.get(id)!.name || byId.get(id)!.o.node.ref}; source support candidate, mounting unverified`,
          })),
        );
      }
      const sourceInterface =
        programme.adopted && meta.assembly?.type === "join"
          ? source.matches.get(meta.assembly.moduleId)
          : undefined;
      if (
        programme.adopted &&
        module?.purpose === "source" &&
        meta.assembly?.type === "build"
      ) {
        const jaw = source.matches.get(meta.assembly.moduleId);
        if (jaw && plan.steps[n].includes(jaw.incomingId))
          meta.notes =
            "Add the plate with two clip mouths to the supported source section. Keep both mouths exposed for the later handle comparison. Confirm its seating and support; the pictured pose does not establish fit.";
        else if (
          jaw &&
          plan.steps[n][0] === module.occurrenceIds[0] &&
          additions[0]?.o.node.ref === "2654.dat"
        )
          meta.notes =
            "Hold the small dish from underneath. Keep the subsequent angular bricks separately supported in their pictured spacing until the later connecting pieces are in place. The source sequence does not establish their seating or a stable loose foundation. Shown in the final source orientation; choose a supported working orientation before continuing.";
        else {
          const receiver = [...source.matches.values()].find((p) =>
            plan.steps[n].includes(p.receiverId),
          );
          if (receiver)
            meta.notes =
              "Add the pictured handle-bearing plate while supporting the source body underneath. Keep the finite handle visible for the later paired-clip comparison. Confirm its seating and support before proceeding; physical fit and access remain unverified.";
        }
      }
      if (sourceInterface) {
        // Complete incoming work remains pictured; the isolated receiver and
        // completed pair are details, with the actual parent in context.
        meta.contextCamera =
          defaultResult.contextCamera ?? defaultResult.camera;
        meta.camera = structuredClone(sourceInterface.camera);
        meta.alternateCamera = structuredClone(sourceInterface.receivingCamera);
        meta.alternateBeforePlacement = true;
        meta.alternateDetailIds = [sourceInterface.receiverId];
        meta.completedDetail = structuredClone(sourceInterface.completedDetail);
        meta.targets!.push(
          ...sourceInterface.landmarks.map((p, i) => ({
            position: p.position,
            occurrenceId: p.occurrenceId,
            label: `P${i + 1}`,
            caption:
              p.caption + "; finite source landmark, physical fit unverified",
          })),
        );
        meta.notes =
          (meta.notes ?? "") +
          " The bare detail shows only the receiving handle and the completed detail only the paired clip/handle members; surrounding parts are omitted. Use the full parent context to locate them. Check both clip mouths, simultaneous seating, support and permitted angle without forcing. Physical access, retention and a safe supported reorientation remain unverified; the changed camera is a view, not a physical turn.";
      }
      if (displayOperation?.role === "sign-base") {
        for (const target of meta.targets ?? [])
          if (plan.steps[n].includes(target.occurrenceId ?? ""))
            target.caption = "Plate 1 × 2; separate sign support";
      }
      if (figureOperation?.feature && figureOperation.hostIds.length) {
        const host = byId.get(figureOperation.hostIds[0])!;
        const tilt: Vec3 =
          Math.abs(figureOperation.facing[1]) > 0.95 ? [1, 0, 0] : [0, -1, 0];
        const detail = normalize(
          figureOperation.facing.map((v, a) => v + tilt[a] * 0.2) as Vec3,
        );
        meta.alternateCamera = {
          space: "ldraw",
          projection: "orthographic",
          target: figureOperation.feature,
          position: figureOperation.feature.map(
            (v, a) => v + detail[a] * 200,
          ) as Vec3,
          up: [0, -1, 0],
          span: figureOperation.role === "hand" ? 65 : 100,
          fovDeg: 45,
          near: 0.5,
          far: 500,
        };
        meta.alternateBeforePlacement = true;
        meta.targets ??= [];
        if (meta.assembly?.type !== "build") {
          const prior = new Set(
            state.displayIds.filter((id) => !plan.steps[n].includes(id)),
          );
          meta.alternateDetailIds = figureMembers
            .get(additions[0].index)!
            .filter((id) => prior.has(id));
          meta.notes =
            (meta.notes ?? "") +
            " Receiver detail omits the surrounding model; use the main view to locate it. Physical access remains unverified.";
        }
        meta.targets.push({
          position: figureOperation.feature,
          label: "P",
          occurrenceId: host.o.id,
          caption: `Pictured ${figureOperation.role === "hand" ? "wrist opening" : "receiving landmark"} on ${host.name || host.o.node.ref} (${host.o.node.ref}); source point, fit unverified`,
        });
      }
      if (meta.assembly?.type === "build") {
        const shownSet = new Set(shown.map((i) => i.index));
        const omitted = new Set(
          additions.flatMap((i) =>
            [...i.supports, ...i.hosts].filter((index) => !shownSet.has(index)),
          ),
        );
        if (omitted.size)
          meta.notes =
            (meta.notes ?? "") +
            ` This detached view omits ${omitted.size} source support/host relationships. Supply temporary workbench support; detached stability is unverified.`;
      }
      for (const item of additions)
        if (item.component?.endpoints) {
          meta.targets.push(
            ...item.component.endpoints.map((position, index) => ({
              position,
              label: index === 0 ? "A" : "B",
              caption:
                "Source path endpoint " +
                (index === 0 ? "A" : "B") +
                "; length and fastening unverified",
            })),
          );
          meta.notes =
            (meta.notes ?? "") +
            " A/B locate source path endpoints; verify the real flexible element, length and fastening method.";
        }
      for (const item of additions) {
        const operation = axial.operations.get(item.index);
        if (!operation) continue;
        const delta = operation.ends[1].map(
          (v, a) => v - operation.ends[0][a],
        ) as Vec3;
        const axis = normalize(delta);
        const ends =
          operation.role === "bush"
            ? ([-24, 24].map(
                (t) =>
                  item.o.transform.position.map(
                    (v, a) => v + t * axis[a],
                  ) as Vec3,
              ) as [Vec3, Vec3])
            : operation.ends;
        if (operation.host !== undefined) {
          const host = items[operation.host];
          meta.targets.push({
            position: host.p,
            label: "R",
            occurrenceId: host.o.id,
            caption:
              (host.name ||
                "Receiving Technic Axle " +
                  AXIAL_PROFILES[host.o.node.ref].halfLength / 10) +
              "; receiving candidate (whole view)",
          });
        }
        meta.axisReference = {
          from: ends[0],
          to: ends[1],
          sourceRef: item.o.node.ref,
          feasibility: "unknown",
        };
        meta.targets.push(
          ...ends.map((position, index) => ({
            position,
            label: index === 0 ? "E" : "F",
            caption:
              "Axis reference " +
              (index === 0 ? "E" : "F") +
              "; alignment only",
          })),
        );
      }
      const obstructionIds = [
        ...new Set(
          meta.insertionChecks.flatMap((check) =>
            check.status === "blocked" ? (check.blockerIds ?? []) : [],
          ),
        ),
      ].slice(0, 2);
      for (const [index, id] of obstructionIds.entries()) {
        const blocker = byId.get(id)!;
        meta.targets.push({
          position: blocker.p,
          label: "B" + (index + 1),
          occurrenceId: id,
          caption:
            "CAD crossing on tested route: " +
            blocker.o.node.ref +
            (additions.some(
              (i) =>
                i.supports.has(blocker.index) ||
                i.hosts.has(blocker.index) ||
                axial.operations.get(i.index)?.host === blocker.index,
            )
              ? " (required receiver/support)"
              : ""),
        });
      }
      if (!meta.targets.length) delete meta.targets;
    }
    report.warnings = report.warnings.filter(
      (w) => !/^\d+ steps need a visibility review/.test(w),
    );
    if (report.lowVisibilitySteps)
      report.warnings.push(
        `${report.lowVisibilitySteps} displayed operations need a visibility review.`,
      );
    report.insertionFingerprint = insertionFingerprint(project, plan);
    const collisionStats = motion.stats();
    report.insertionTriangleTests = collisionStats.triangleTests;
    report.insertionBudgetReached = collisionStats.exhausted;
    report.warnings.push(
      `${report.insertionClear} CAD straight approaches clear, ${report.insertionBlocked} blocked, ${report.insertionUnknown} unknown. ${motion.precedences} blocker precedences added; ${motion.conflicts.size} conflict with existing prerequisites. Tangency and local final-seating contact allowances apply; no general physical assembly guarantee.${collisionStats.exhausted ? " The bounded collision search left some approaches unknown." : ""}`,
    );
    return { plan, report };
  } finally {
    motion.dispose();
  }
}
