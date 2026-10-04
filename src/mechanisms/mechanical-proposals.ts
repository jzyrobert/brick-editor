import { occurrences } from "../core/document";
import { add, inverse, mv, orthonormalized } from "../core/math";
import {
  ensure,
  type Occurrence,
  type Project,
  type Vec3,
} from "../core/types";
import { KinematicSession, validateRig } from "./kinematic";
import type { JointSpec, MotionRig, RigidGroup } from "./types";
import {
  GUIDED_RACK_PROXY_WARNING,
  unsupportedMechanicalPlayContact,
} from "./mechanical-play-support";
import {
  mechanicalContactGraph,
  mechanicalInterval,
  type MechanicalGraph,
  type WorldMechanicalFeature,
} from "./mechanical-contacts";

export type MechanicalProposalRequest = {
  id: string;
  name: string;
  expectedRevision: number;
  /** Explicit world-fixed seeds. Stud-welded accessories are recruited. */
  frameOccurrenceIds: string[];
  /** Limit inference to this assembly; omitted means all visible occurrences. */
  occurrenceIds?: string[];
  includeHidden?: boolean;
  /** A shaft/pin/leaf/rack occurrence, not an inferred second transmission motor. */
  motors?: Record<string, NonNullable<JointSpec["motor"]>>;
};
export type SpurRelationProposal = {
  kind: "spur";
  jointA: string;
  jointB: string;
  ratio: number;
  teethA: number;
  teethB: number;
  occurrenceA: string;
  occurrenceB: string;
};
export type RackRelationProposal = {
  kind: "rack";
  jointA: string;
  jointB: string;
  pitchRadiusLdu: number;
  occurrenceA: string;
  occurrenceB: string;
};
export type MechanicalProposal = {
  sourceRevision: number;
  /** Supported motor input occurrence for each proposed joint. */
  drivers: Record<string, string>;
  rig?: MotionRig;
  /** Reviewed relations also installed as ideal transmissions on the draft. */
  relations: Array<SpurRelationProposal | RackRelationProposal>;
  graph: MechanicalGraph;
  unresolved: Array<{ occurrenceIds: string[]; reason: string }>;
  warnings: string[];
};
const keyOf = (e: { occurrenceId: string; featureId: string }) =>
  JSON.stringify([e.occurrenceId, e.featureId]);
const localPoint = (g: RigidGroup, p: Vec3) =>
  add(inverse(g.frame).position, mv(inverse(g.frame).basis, p));
const T = 0.5;

/** A conservative, reviewable session draft. It does not save or enter Play.
 * Stops must restrain both shaft ends, and sliding keyed accessories must be
 * individually captured. Unknown attachment and loop closure are never welded. */
export function proposeMechanicalRig(
  project: Project,
  request: MechanicalProposalRequest,
  /** Optional precomputed occurrence index for this source revision. */
  occurrenceLookup?: ReadonlyMap<string, Occurrence>,
): MechanicalProposal {
  ensure(
    request.expectedRevision === project.revision,
    "REVISION_CONFLICT",
    "Project changed; rebuild the mechanical proposal.",
  );
  ensure(
    Array.isArray(request.frameOccurrenceIds) &&
      request.frameOccurrenceIds.length > 0 &&
      new Set(request.frameOccurrenceIds).size ===
        request.frameOccurrenceIds.length,
    "INVALID_INPUT",
    "Choose distinct frame anchors for the mechanical proposal.",
  );
  ensure(
    !Object.hasOwn(project.motionRigs, request.id),
    "INVALID_INPUT",
    "Choose a new proposal ID; existing authored rigs retain ownership.",
  );
  const lookup =
    occurrenceLookup ?? new Map(occurrences(project).map((o) => [o.id, o]));
  const selection =
    request.occurrenceIds ??
    [...lookup.values()]
      .filter((o) => o.visible || request.includeHidden)
      .map((o) => o.id);
  ensure(
    new Set(selection).size === selection.length &&
      selection.every((id) => lookup.has(id)),
    "INVALID_INPUT",
    "Mechanical selection needs distinct existing occurrences.",
  );
  const selected = new Set(selection);
  ensure(
    request.frameOccurrenceIds.every((id) => selected.has(id)),
    "INVALID_INPUT",
    "Every frame anchor must be included in the mechanical selection.",
  );
  const all = selection.map((id) => lookup.get(id)!);
  ensure(
    all.every((o) => o.visible || request.includeHidden),
    "INVALID_INPUT",
    "Hidden proposal members require includeHidden.",
  );
  const graph = mechanicalContactGraph(project, all);
  const result: MechanicalProposal = {
    sourceRevision: project.revision,
    drivers: {},
    graph,
    relations: [],
    unresolved: [],
    warnings: [
      "Review the fixed frame and moving groups before using this session draft. Unknown contacts remain unknown.",
      "Collars are ideal axial grips; friction pins remain articulations. Physical snap fit and clutch strength are not certified.",
      "Spur and rack meshes use ideal ratio constraints; they do not simulate individual tooth contacts or real clutch strength.",
    ],
  };
  const owned = new Set(
    Object.values(project.motionRigs).flatMap((r) =>
      r.groups.flatMap((g) => g.occurrenceIds),
    ),
  );
  const parent = new Map(selection.map((id) => [id, id]));
  const root = (id: string): string => {
    const p = parent.get(id)!;
    if (p === id) return id;
    const r = root(p);
    parent.set(id, r);
    return r;
  };
  const union = (a: string, b: string) => {
    const ra = root(a),
      rb = root(b);
    if (ra !== rb) parent.set(rb, ra);
  };
  for (const c of graph.contacts)
    if (c.kind === "stud-weld") union(c.a.occurrenceId, c.b.occurrenceId);
  const rigidComponents = new Map<string, string[]>();
  for (const id of selection) {
    const key = root(id),
      list = rigidComponents.get(key) ?? [];
    list.push(id);
    rigidComponents.set(key, list);
  }
  const members = (id: string) => rigidComponents.get(root(id))!;
  const frameIds = [...new Set(request.frameOccurrenceIds.flatMap(members))];
  ensure(
    !frameIds.some((id) => owned.has(id)),
    "INVALID_INPUT",
    "An authored rig already owns a frame anchor or its rigid accessory.",
  );
  const frame = new Set(frameIds);
  const group = (id: string, ids: string[], seed = ids[0]): RigidGroup => ({
    id,
    occurrenceIds: [...new Set(ids)],
    frame: orthonormalized(lookup.get(seed)!.transform),
    restTransforms: Object.fromEntries(
      [...new Set(ids)].map((id) => [
        id,
        structuredClone(lookup.get(id)!.transform),
      ]),
    ),
  });
  const rig: MotionRig = {
    schemaVersion: 1,
    id: request.id,
    name: request.name,
    mode: "kinematic",
    groups: [group("frame", frameIds)],
    joints: [],
  };
  const features = new Map(graph.features.map((f) => [f.key, f]));
  const groupFor = new Map(frameIds.map((id) => [id, "frame"]));
  const jointFor = new Map<string, string>();
  const usedMotors = new Set<string>();
  const unresolved = (ids: string[], reason: string) =>
    result.unresolved.push({ occurrenceIds: [...new Set(ids)], reason });
  const addGroup = (ids: string[], seed: string): RigidGroup | undefined => {
    const allIds = [...new Set(ids.flatMap(members))];
    if (allIds.some((id) => owned.has(id))) {
      unresolved(allIds, "An authored rig already owns this moving assembly.");
      return undefined;
    }
    if (allIds.some((id) => groupFor.has(id))) {
      unresolved(
        allIds,
        "The moving assembly has conflicting ownership or multiple motion connections; review its linkage.",
      );
      return undefined;
    }
    const g = group(`moving-${rig.groups.length}`, allIds, seed);
    rig.groups.push(g);
    for (const id of allIds) groupFor.set(id, g.id);
    return g;
  };
  const addJoint = (
    a: RigidGroup,
    b: RigidGroup,
    pivot: Vec3,
    axis: Vec3,
    driver: string,
    kind: "revolute" | "prismatic" = "revolute",
    matingSource = driver,
  ) => {
    const id = `joint-${rig.joints.length}`;
    const joint: JointSpec = {
      id,
      kind,
      bodyA: a.id,
      bodyB: b.id,
      anchorA: localPoint(a, pivot),
      anchorB: localPoint(b, pivot),
      axisA: mv(inverse(a.frame).basis, axis),
      axisB: mv(inverse(b.frame).basis, axis),
    };
    if (kind === "revolute") {
      const sourceFeatures = graph.features.filter(
        (f) => f.occurrenceId === matingSource,
      );
      const shaft = sourceFeatures.find(
        (f) => f.kind === "axle" || f.kind === "pin",
      );
      if (shaft && "radius" in shaft) {
        const collars = graph.features.filter(
          (f) =>
            b.occurrenceIds.includes(f.occurrenceId) &&
            f.kind === "keyed-hole" &&
            "stopRadius" in f &&
            f.stopRadius,
        );
        const radius = Math.max(
          shaft.radius,
          "stopRadius" in shaft ? shaft.stopRadius : 0,
          ...collars.map((f) => ("stopRadius" in f ? f.stopRadius! : 0)),
        );
        joint.mating = {
          radiusLdu: radius + 0.1,
          halfLengthLdu: Math.max(...shaft.span.map(Math.abs)) + 0.1,
        };
      }
    }
    const motor = request.motors?.[driver];
    if (motor) {
      joint.motor = structuredClone(motor);
      usedMotors.add(driver);
    }
    result.drivers[id] = driver;
    rig.joints.push(joint);
    for (const member of b.occurrenceIds) jointFor.set(member, id);
    return joint;
  };
  const ambiguous = new Set<string>();
  const boreMatches = new Map<string, Set<string>>();
  for (const c of graph.contacts)
    if (
      c.kind === "bearing" ||
      c.kind === "keyed-slide" ||
      c.kind === "pin-bearing"
    ) {
      const list = boreMatches.get(keyOf(c.b)) ?? new Set();
      list.add(c.a.occurrenceId);
      boreMatches.set(keyOf(c.b), list);
    }
  for (const ids of boreMatches.values())
    if (ids.size > 1) for (const id of ids) ambiguous.add(id);
  for (const shaft of graph.features.filter((f) => f.kind === "axle")) {
    if (frame.has(shaft.occurrenceId)) continue;
    const incompatible = graph.rejected.find((r) => {
      const other =
        keyOf(r.a) === shaft.key
          ? r.b
          : keyOf(r.b) === shaft.key
            ? r.a
            : undefined;
      const f = other ? features.get(keyOf(other)) : undefined;
      return f?.kind === "keyed-hole" || f?.kind === "round-hole";
    });
    if (incompatible) {
      unresolved(
        [
          shaft.occurrenceId,
          incompatible.a.occurrenceId,
          incompatible.b.occurrenceId,
        ],
        incompatible.reason,
      );
      continue;
    }
    if (ambiguous.has(shaft.occurrenceId)) {
      unresolved(
        [shaft.occurrenceId],
        "A bore matches several shafts; choose the receiving shaft explicitly.",
      );
      continue;
    }
    const bearings = graph.contacts.filter(
      (c) =>
        c.kind === "bearing" &&
        keyOf(c.a) === shaft.key &&
        frame.has(c.b.occurrenceId),
    );
    if (!bearings.length) {
      unresolved(
        [shaft.occurrenceId],
        "No reviewed bearing in the chosen fixed frame.",
      );
      continue;
    }
    const bearingFeatures = bearings.map((c) => features.get(keyOf(c.b))!);
    const faces = bearingFeatures.map((f) =>
      mechanicalInterval(
        f,
        shaft,
        f.kind === "round-hole" ? f.faceSpan : f.span,
      ),
    );
    const keyed = graph.contacts.filter(
      (c) => c.kind === "keyed-slide" && keyOf(c.a) === shaft.key,
    );
    const grips = keyed
      .filter((c) => c.kind === "keyed-slide" && c.axialGrip)
      .map((c) => features.get(keyOf(c.b))!);
    const stops = grips.map((f) => mechanicalInterval(f, shaft));
    const low = Math.min(...faces.map((s) => s[0])),
      high = Math.max(...faces.map((s) => s[1]));
    if (
      !stops.some((s) => Math.abs(s[1] - low) <= T) ||
      !stops.some((s) => Math.abs(s[0] - high) <= T)
    ) {
      unresolved(
        [shaft.occurrenceId],
        "The shaft can slide: seated axial retainers are required on both sides of its frame bearings.",
      );
      continue;
    }
    const sliding = keyed
      .filter((c) => c.kind === "keyed-slide" && !c.axialGrip)
      .map((c) => features.get(keyOf(c.b))!);
    const walls = [...faces, ...stops],
      captured: WorldMechanicalFeature[] = [];
    let pending = [...sliding];
    for (let pass = 0; pass <= sliding.length && pending.length; pass++) {
      const remaining: WorldMechanicalFeature[] = [];
      for (const f of pending) {
        const span = mechanicalInterval(f, shaft);
        if (
          walls.some((s) => Math.abs(s[1] - span[0]) <= T) &&
          walls.some((s) => Math.abs(s[0] - span[1]) <= T)
        ) {
          captured.push(f);
          walls.push(span);
        } else remaining.push(f);
      }
      if (remaining.length === pending.length) break;
      pending = remaining;
    }
    if (pending.length) {
      unresolved(
        [shaft.occurrenceId, ...pending.map((f) => f.occurrenceId)],
        "A keyed accessory can still slide on the shaft; capture both of its axial faces before grouping it.",
      );
      continue;
    }
    const g = addGroup(
      [
        shaft.occurrenceId,
        ...grips.map((f) => f.occurrenceId),
        ...captured.map((f) => f.occurrenceId),
      ],
      shaft.occurrenceId,
    );
    if (g)
      addJoint(rig.groups[0], g, shaft.center, shaft.axis, shaft.occurrenceId);
  }
  for (const rack of graph.features.filter((f) => f.kind === "rack")) {
    if (frame.has(rack.occurrenceId)) continue;
    const guides = graph.contacts.filter(
      (c) =>
        c.kind === "rack-guide" &&
        c.b.occurrenceId === rack.occurrenceId &&
        frame.has(c.a.occurrenceId),
    );
    if (guides.length !== 1) {
      unresolved(
        [rack.occurrenceId],
        "A rack needs one unique reviewed housing in the fixed frame; loose racks and improvised rails require authored guide review.",
      );
      continue;
    }
    const guide = guides[0];
    if (guide.kind !== "rack-guide") continue;
    const g = addGroup([rack.occurrenceId], rack.occurrenceId);
    if (g) {
      const j = addJoint(
        rig.groups[0],
        g,
        guide.pivot,
        guide.axis,
        rack.occurrenceId,
        "prismatic",
      );
      j.limits = [...guide.limits];
    }
  }
  // A pin retains two bearings but can spin in both. Keep the pin as its own
  // body and use two revolute joints rather than freezing a friction pin.
  const pinIds = [
    ...new Set(
      graph.features.filter((f) => f.kind === "pin").map((f) => f.occurrenceId),
    ),
  ];
  const articulationCount = new Map<string, number>();
  for (const c of graph.contacts) {
    let moving: string | undefined;
    if (c.kind === "pin-bearing" && c.retained && !frame.has(c.b.occurrenceId))
      moving = c.b.occurrenceId;
    if (
      c.kind === "finger-hinge" &&
      frame.has(c.a.occurrenceId) !== frame.has(c.b.occurrenceId)
    )
      moving = frame.has(c.a.occurrenceId)
        ? c.b.occurrenceId
        : c.a.occurrenceId;
    if (moving)
      articulationCount.set(
        root(moving),
        (articulationCount.get(root(moving)) ?? 0) + 1,
      );
  }
  for (const pinId of pinIds) {
    if (frame.has(pinId)) continue;
    const contacts = graph.contacts.filter(
      (c) => c.kind === "pin-bearing" && c.a.occurrenceId === pinId,
    );
    const fixed = contacts.filter(
      (c) =>
        c.kind === "pin-bearing" && c.retained && frame.has(c.b.occurrenceId),
    );
    const free = contacts.filter(
      (c) =>
        c.kind === "pin-bearing" && c.retained && !frame.has(c.b.occurrenceId),
    );
    if (
      ambiguous.has(pinId) ||
      fixed.length !== 1 ||
      free.length !== 1 ||
      contacts.some((c) => c.kind === "pin-bearing" && !c.retained)
    ) {
      unresolved(
        [pinId],
        "A pin needs one unique, fully seated frame bearing and one moving bearing; other pin/linkage layouts need review.",
      );
      continue;
    }
    const fc = fixed[0],
      mc = free[0];
    if (fc.kind !== "pin-bearing" || mc.kind !== "pin-bearing") continue;
    if ((articulationCount.get(root(mc.b.occurrenceId)) ?? 0) > 1) {
      unresolved(
        [pinId, mc.b.occurrenceId],
        "The arm has several articulations; solve or review its closed linkage instead of dropping a joint.",
      );
      continue;
    }
    const pinMembers = members(pinId),
      armMembers = members(mc.b.occurrenceId);
    if (
      [...pinMembers, ...armMembers].some(
        (id) => owned.has(id) || groupFor.has(id),
      ) ||
      pinMembers.some((id) => armMembers.includes(id))
    ) {
      unresolved(
        [pinId, ...armMembers],
        "The pin arm conflicts with authored ownership or another joint.",
      );
      continue;
    }
    const p = addGroup([pinId], pinId)!,
      arm = addGroup([mc.b.occurrenceId], mc.b.occurrenceId)!;
    addJoint(rig.groups[0], p, fc.pivot, fc.axis, pinId);
    addJoint(p, arm, mc.pivot, mc.axis, mc.b.occurrenceId, "revolute", pinId);
    if (fc.friction || mc.friction)
      result.warnings.push(
        "This friction pin remains movable; its measured rotational resistance is not available.",
      );
  }
  for (const c of graph.contacts.filter((c) => c.kind === "finger-hinge")) {
    if (c.kind !== "finger-hinge") continue;
    const aFixed = frame.has(c.a.occurrenceId),
      bFixed = frame.has(c.b.occurrenceId);
    if (aFixed === bFixed) continue;
    const moving = aFixed ? c.b.occurrenceId : c.a.occurrenceId;
    if ((articulationCount.get(root(moving)) ?? 0) > 1) {
      unresolved(
        [moving],
        "The moving assembly has several articulations; a single inferred hinge would drop a constraint.",
      );
      continue;
    }
    const mates = graph.contacts.filter(
      (other) =>
        other.kind === "finger-hinge" &&
        (other.a.occurrenceId === moving || other.b.occurrenceId === moving),
    );
    if (mates.length !== 1) {
      unresolved(
        [moving],
        "Several possible finger-hinge mates; choose its receiving half explicitly.",
      );
      continue;
    }
    const g = addGroup([moving], moving);
    if (g) addJoint(rig.groups[0], g, c.pivot, c.axis, moving);
  }
  for (const c of graph.contacts)
    if (c.kind === "spur-mesh") {
      const jointA = jointFor.get(c.a.occurrenceId),
        jointB = jointFor.get(c.b.occurrenceId);
      if (!jointA || !jointB || jointA === jointB) {
        unresolved(
          [c.a.occurrenceId, c.b.occurrenceId],
          "Both meshed gears need distinct retained shaft joints before proposing a transmission.",
        );
        continue;
      }
      const ja = rig.joints.find((j) => j.id === jointA)!,
        jb = rig.joints.find((j) => j.id === jointB)!;
      const axisA = mv(
          rig.groups.find((g) => g.id === ja.bodyA)!.frame.basis,
          ja.axisA!,
        ),
        axisB = mv(
          rig.groups.find((g) => g.id === jb.bodyA)!.frame.basis,
          jb.axisA!,
        );
      const gearA = features.get(keyOf(c.a))!,
        gearB = features.get(keyOf(c.b))!;
      const signA =
          axisA.reduce((s, x, i) => s + x * gearA.axis[i], 0) < 0 ? -1 : 1,
        signB =
          axisB.reduce((s, x, i) => s + x * gearB.axis[i], 0) < 0 ? -1 : 1;
      result.relations.push({
        kind: "spur",
        jointA,
        jointB,
        ratio: (c.ratio * signA) / signB,
        teethA: c.teethA,
        teethB: c.teethB,
        occurrenceA: c.a.occurrenceId,
        occurrenceB: c.b.occurrenceId,
      });
    }
  for (const c of graph.contacts)
    if (c.kind === "rack-mesh") {
      const jointA = jointFor.get(c.a.occurrenceId),
        jointB = jointFor.get(c.b.occurrenceId);
      if (!jointA || !jointB) {
        unresolved(
          [c.a.occurrenceId, c.b.occurrenceId],
          "A rack mesh needs a retained pinion shaft and a reviewed guided rack on the same carrier.",
        );
        continue;
      }
      const ja = rig.joints.find((j) => j.id === jointA)!,
        jb = rig.joints.find((j) => j.id === jointB)!;
      if (
        ja.kind !== "revolute" ||
        jb.kind !== "prismatic" ||
        ja.bodyA !== jb.bodyA
      ) {
        unresolved(
          [c.a.occurrenceId, c.b.occurrenceId],
          "Rack and pinion mounting is not a supported shared carrier.",
        );
        continue;
      }
      const axisA = mv(
        rig.groups.find((g) => g.id === ja.bodyA)!.frame.basis,
        ja.axisA!,
      );
      const gear = features.get(keyOf(c.a))!;
      const sign =
        axisA.reduce((sum, x, i) => sum + x * gear.axis[i], 0) < 0 ? -1 : 1;
      jb.limits = [
        Math.max(jb.limits![0], c.limits[0]),
        Math.min(jb.limits![1], c.limits[1]),
      ];
      result.relations.push({
        kind: "rack",
        jointA,
        jointB,
        pitchRadiusLdu: c.pitchRadiusLdu * sign,
        occurrenceA: c.a.occurrenceId,
        occurrenceB: c.b.occurrenceId,
      });
    }
  for (const id of Object.keys(request.motors ?? {}))
    ensure(
      usedMotors.has(id),
      "INVALID_INPUT",
      "A requested motor has no supported shaft, pin, hinge-leaf or guided rack joint in this proposal.",
    );
  if (result.relations.length)
    rig.transmissions = result.relations.map((r, i) =>
      r.kind === "rack"
        ? {
            id: `rack-${i + 1}`,
            kind: "rack",
            jointA: r.jointA,
            jointB: r.jointB,
            pitchRadiusLdu: r.pitchRadiusLdu,
          }
        : {
            id: `spur-${i + 1}`,
            kind: "spur",
            jointA: r.jointA,
            jointB: r.jointB,
            teethA: r.teethA,
            teethB: r.teethB,
            axisSign: r.ratio < 0 ? 1 : -1,
          },
    );
  if (rig.joints.length) {
    validateRig(project, rig, true, lookup);
    result.rig = rig;
    const reviewedGuide = unsupportedMechanicalPlayContact(
      project,
      rig,
      lookup,
    );
    if (reviewedGuide) result.warnings.push(GUIDED_RACK_PROXY_WARNING);
  }
  return result;
}

/** Preview on a private source copy; original placements, rigs and inventory stay unchanged. */
export function previewMechanicalProposal(
  project: Project,
  proposal: MechanicalProposal,
) {
  ensure(
    proposal.sourceRevision === project.revision,
    "REVISION_CONFLICT",
    "Project changed; rebuild the mechanical proposal.",
  );
  ensure(
    proposal.rig,
    "INVALID_INPUT",
    "This proposal has no supported moving joint.",
  );
  const ids = new Set(proposal.rig.groups.flatMap((g) => g.occurrenceIds));
  ensure(
    !Object.hasOwn(project.motionRigs, proposal.rig.id) &&
      !Object.values(project.motionRigs).some((r) =>
        r.groups.some((g) => g.occurrenceIds.some((id) => ids.has(id))),
      ),
    "INVALID_INPUT",
    "Authored rig ownership changed; rebuild the mechanical proposal.",
  );
  const copy = structuredClone(project);
  copy.motionRigs[proposal.rig.id] = structuredClone(proposal.rig);
  return new KinematicSession(copy, proposal.rig.id);
}
