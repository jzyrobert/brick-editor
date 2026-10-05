import { ConnectorIndex } from "../core/connectivity";
import { installedSource } from "../catalog/catalog";
import { occurrences } from "../core/document";
import {
  ensure,
  type Occurrence,
  type Project,
  type Vec3,
} from "../core/types";
import {
  mechanicalContactGraph,
  mechanicalInterval,
  matchMechanicalFeatures,
} from "../mechanisms/mechanical-contacts";
import {
  assemblyHingeInterface,
  assemblyKeyedBore,
  assemblyStudConnectors,
} from "./reviewed-assembly-attachments";
import { reviewedAccessoryFits } from "./reviewed-accessory-fits";

/** Attachment ownership is separate from a rigid weld. Mesh contact alone,
 * coincident origins, bounds proximity and MPD hierarchy grant no ownership. */
export type SourceAssemblyEdge = {
  a: string;
  b: string;
  kind: "fixed" | "articulated" | "visual";
  evidence: { profile: string; featureA: string; featureB: string };
  pivot?: Vec3;
  axis?: Vec3;
  /** A captured keyed accessory can slide between actual collars while its
   * rotation stays locked to the shaft. Limits are offsets from the source pose. */
  axialLimitsLdu?: [number, number];
};
export const SOURCE_ASSEMBLY_LIMITS = Object.freeze({
  parts: 2048,
  edges: 8192,
  connectors: 20000,
  hingeChecks: 100000,
  keyedChecks: 100000,
});
export function sourceAssemblyEdges(
  project: Project,
  all = occurrences(project),
): SourceAssemblyEdge[] {
  // A root can be official while an embedded project primitive changes its
  // dependency geometry. Decline this review rather than trust the basename.
  // A future resolved-closure binding can narrow this conservative refusal.
  ensure(
    !Object.keys(project.models).some(installedSource),
    "INVALID_INPUT",
    "Project definitions shadow installed source geometry; source assembly needs an unshadowed dependency binding",
  );
  ensure(
    all.length <= SOURCE_ASSEMBLY_LIMITS.parts,
    "LIMIT_EXCEEDED",
    "Too many parts for source assembly review",
  );
  const out: SourceAssemblyEdge[] = [],
    seen = new Set<string>();
  const emit = (edge: SourceAssemblyEdge) => {
    const key = JSON.stringify([edge.kind, ...[edge.a, edge.b].sort()]);
    if (seen.has(key)) return;
    ensure(
      out.length < SOURCE_ASSEMBLY_LIMITS.edges,
      "LIMIT_EXCEEDED",
      "Source assembly attachment budget exceeded",
    );
    seen.add(key);
    out.push(edge);
  };
  const graph = mechanicalContactGraph(project, all);
  for (const edge of reviewedAccessoryFits(all)) emit(edge);
  const featureLookup = new Map(graph.features.map((f) => [f.key, f]));
  const featureKey = (e: { occurrenceId: string; featureId: string }) =>
    JSON.stringify([e.occurrenceId, e.featureId]);
  for (const c of graph.contacts) {
    const fixed =
      c.kind === "stud-weld" || (c.kind === "keyed-slide" && c.axialGrip);
    const articulated =
      c.kind === "finger-hinge" || (c.kind === "pin-bearing" && c.retained);
    if (!fixed && !articulated) continue;
    emit({
      a: c.a.occurrenceId,
      b: c.b.occurrenceId,
      kind: fixed ? "fixed" : "articulated",
      evidence: {
        profile: c.kind,
        featureA: c.a.featureId,
        featureB: c.b.featureId,
      },
      ...("pivot" in c ? { pivot: c.pivot, axis: c.axis } : {}),
    });
  }
  // A round bearing permits axial escape until source collars seat outside
  // both faces of that bearing. Only a fully retained shaft grants ownership;
  // its bearing remains an articulated boundary, never a rigid weld.
  for (const shaft of graph.features.filter((f) => f.kind === "axle")) {
    const bearings = graph.contacts.filter(
      (c) => c.kind === "bearing" && featureKey(c.a) === shaft.key,
    );
    if (!bearings.length) continue;
    const ambiguous = bearings.some((c) =>
      graph.contacts.some(
        (other) =>
          other.kind === "bearing" &&
          featureKey(other.b) === featureKey(c.b) &&
          featureKey(other.a) !== shaft.key,
      ),
    );
    if (ambiguous) continue;
    const faces = bearings
      .map((c) => featureLookup.get(featureKey(c.b))!)
      .map((f) =>
        mechanicalInterval(
          f,
          shaft,
          f.kind === "round-hole" ? f.faceSpan : f.span,
        ),
      );
    const stops = graph.contacts
      .filter(
        (c) =>
          c.kind === "keyed-slide" &&
          c.axialGrip &&
          featureKey(c.a) === shaft.key,
      )
      .map((c) =>
        mechanicalInterval(featureLookup.get(featureKey(c.b))!, shaft),
      );
    for (const [i, c] of bearings.entries())
      if (
        c.kind === "bearing" &&
        stops.some((s) => Math.abs(s[1] - faces[i][0]) <= 0.5) &&
        stops.some((s) => Math.abs(s[0] - faces[i][1]) <= 0.5)
      )
        emit({
          a: c.a.occurrenceId,
          b: c.b.occurrenceId,
          kind: "articulated",
          evidence: {
            profile: "source-retained-axle-bearing",
            featureA: c.a.featureId,
            featureB: c.b.featureId,
          },
          pivot: c.pivot,
          axis: c.axis,
        });
  }
  let keyedChecks = 0;
  for (const o of all) {
    const bore = assemblyKeyedBore(o);
    if (!bore) continue;
    const matches = graph.features.filter((shaft) => {
      if (shaft.kind !== "axle") return false;
      ensure(
        ++keyedChecks <= SOURCE_ASSEMBLY_LIMITS.keyedChecks,
        "LIMIT_EXCEEDED",
        "Source assembly keyed contact budget exceeded",
      );
      const match = matchMechanicalFeatures(shaft, bore);
      return match && "kind" in match && match.kind === "keyed-slide";
    });
    if (matches.length !== 1) continue;
    const shaft = matches[0],
      span = mechanicalInterval(bore, shaft);
    const stops = graph.contacts
      .filter(
        (c) =>
          c.kind === "keyed-slide" &&
          c.axialGrip &&
          featureKey(c.a) === shaft.key,
      )
      .map((c) =>
        mechanicalInterval(featureLookup.get(featureKey(c.b))!, shaft),
      );
    const lower = stops
      .filter((s) => s[1] <= span[0] + 0.5)
      .sort((a, b) => b[1] - a[1])[0];
    const upper = stops
      .filter((s) => s[0] >= span[1] - 0.5)
      .sort((a, b) => a[0] - b[0])[0];
    if (!lower || !upper) continue;
    // Stops must keep the whole keyed bore on the shaft throughout its travel.
    const limits: [number, number] = [
      Math.min(0, lower[1] - span[0]),
      Math.max(0, upper[0] - span[1]),
    ];
    if (
      span[0] + limits[0] < shaft.span[0] - 0.5 ||
      span[1] + limits[1] > shaft.span[1] + 0.5
    )
      continue;
    const fixed = limits[1] - limits[0] <= 1;
    emit({
      a: shaft.occurrenceId,
      b: bore.occurrenceId,
      kind: fixed ? "fixed" : "articulated",
      evidence: {
        profile: "source-captured-keyed-accessory",
        featureA: shaft.id,
        featureB: bore.id,
      },
      pivot: bore.center,
      axis: shaft.axis,
      ...(!fixed ? { axialLimitsLdu: limits } : {}),
    });
  }
  const studs = new ConnectorIndex(),
    sockets: ReturnType<typeof assemblyStudConnectors> = [];
  let connectorCount = 0;
  for (const o of all)
    for (const c of assemblyStudConnectors(o)) {
      ensure(
        ++connectorCount <= SOURCE_ASSEMBLY_LIMITS.connectors,
        "LIMIT_EXCEEDED",
        "Source assembly connector budget exceeded",
      );
      if (c.kind === "stud") studs.add(c);
      else sockets.push(c);
    }
  for (const b of sockets)
    for (const a of studs.mates(b, "stud"))
      if (a.occurrenceId !== b.occurrenceId)
        emit({
          a: a.occurrenceId,
          b: b.occurrenceId,
          kind: "fixed",
          evidence: {
            profile: "source-stud-subset",
            featureA: JSON.stringify(a.p),
            featureB: JSON.stringify(b.p),
          },
        });
  const hinges = all.flatMap((o) => {
    const h = assemblyHingeInterface(o);
    return h ? [h] : [];
  });
  let checks = 0;
  for (const a of hinges.filter((h) => h.half === "base")) {
    const matches = hinges.filter((b) => {
      ensure(
        ++checks <= SOURCE_ASSEMBLY_LIMITS.hingeChecks,
        "LIMIT_EXCEEDED",
        "Source assembly hinge budget exceeded",
      );
      return (
        b.half === "leaf" &&
        a.family === b.family &&
        Math.hypot(...a.pivot.map((x, i) => x - b.pivot[i])) <= 0.5 &&
        Math.abs(a.axis.reduce((s, x, i) => s + x * b.axis[i], 0)) >= 0.99999
      );
    });
    if (matches.length !== 1) continue;
    const b = matches[0];
    const reverse = hinges.filter((h) => {
      ensure(
        ++checks <= SOURCE_ASSEMBLY_LIMITS.hingeChecks,
        "LIMIT_EXCEEDED",
        "Source assembly hinge budget exceeded",
      );
      return (
        h.half === "base" &&
        h.family === b.family &&
        Math.hypot(...h.pivot.map((x, i) => x - b.pivot[i])) <= 0.5 &&
        Math.abs(h.axis.reduce((s, x, i) => s + x * b.axis[i], 0)) >= 0.99999
      );
    });
    if (reverse.length === 1)
      emit({
        a: a.occurrenceId,
        b: b.occurrenceId,
        kind: "articulated",
        evidence: {
          profile: `source-${a.family}-hinge`,
          featureA: "retained-base",
          featureB: "retained-leaf",
        },
        pivot: a.pivot,
        axis: a.axis,
      });
  }
  return out;
}

export type SourceAssembly = {
  occurrenceIds: string[];
  fixedIslands: string[][];
  boundaries: SourceAssemblyEdge[];
  witnessEdges: SourceAssemblyEdge[];
};
/** Caller-supplied edges must come from reviewed mount/adhesive/hose adapters;
 * this internal helper is not an automation API or generic attachment command.
 * Excluded/reserved members are hard traversal boundaries. */
export function sourceConnectedAssembly(
  project: Project,
  options: {
    seeds: readonly string[];
    all?: Occurrence[];
    reserved?: ReadonlySet<string>;
    included?: ReadonlySet<string>;
    attachments?: readonly SourceAssemblyEdge[];
  },
): SourceAssembly {
  const all = options.all ?? occurrences(project),
    lookup = new Map(all.map((o) => [o.id, o]));
  ensure(
    lookup.size === all.length,
    "INVALID_INPUT",
    "Source assembly occurrences must be unique",
  );
  const allowed = (id: string) =>
    lookup.has(id) &&
    !options.reserved?.has(id) &&
    (!options.included || options.included.has(id));
  const edges = [
    ...sourceAssemblyEdges(project, all),
    ...(options.attachments ?? []),
  ];
  ensure(
    edges.length <= SOURCE_ASSEMBLY_LIMITS.edges,
    "LIMIT_EXCEEDED",
    "Source assembly attachment budget exceeded",
  );
  for (const e of edges)
    ensure(
      e.a !== e.b &&
        lookup.has(e.a) &&
        lookup.has(e.b) &&
        ["fixed", "articulated", "visual"].includes(e.kind) &&
        !!e.evidence.profile &&
        !!e.evidence.featureA &&
        !!e.evidence.featureB,
      "INVALID_INPUT",
      "Invalid source attachment evidence",
    );
  const adjacent = new Map<string, Set<string>>();
  for (const e of edges)
    if (allowed(e.a) && allowed(e.b)) {
      for (const [a, b] of [
        [e.a, e.b],
        [e.b, e.a],
      ]) {
        const set = adjacent.get(a) ?? new Set<string>();
        set.add(b);
        adjacent.set(a, set);
      }
    }
  const owned = new Set<string>(),
    queue: string[] = [];
  for (const id of options.seeds) {
    ensure(
      allowed(id),
      "INVALID_INPUT",
      "Assembly seed is missing, excluded or already owned",
    );
    if (!owned.has(id)) {
      owned.add(id);
      queue.push(id);
    }
  }
  for (let i = 0; i < queue.length; i++)
    for (const id of adjacent.get(queue[i]) ?? [])
      if (!owned.has(id)) {
        owned.add(id);
        queue.push(id);
      }
  const witnesses = edges.filter((e) => owned.has(e.a) && owned.has(e.b)),
    fixed = new Map<string, Set<string>>();
  for (const e of witnesses)
    if (e.kind === "fixed")
      for (const [a, b] of [
        [e.a, e.b],
        [e.b, e.a],
      ]) {
        const set = fixed.get(a) ?? new Set<string>();
        set.add(b);
        fixed.set(a, set);
      }
  const visited = new Set<string>(),
    islands: string[][] = [];
  for (const id of owned) {
    if (visited.has(id)) continue;
    const island = [id];
    visited.add(id);
    for (let i = 0; i < island.length; i++)
      for (const next of fixed.get(island[i]) ?? [])
        if (!visited.has(next)) {
          visited.add(next);
          island.push(next);
        }
    islands.push(island);
  }
  return {
    occurrenceIds: [...owned],
    fixedIslands: islands,
    boundaries: witnesses.filter((e) => e.kind !== "fixed"),
    witnessEdges: witnesses,
  };
}

/** Partitions every included source occurrence, including removable objects.
 * This is a body/collision coverage plan, not proof that every body is attached
 * to a chassis. Native contact may carry a separate body and let it detach. */
export function sourceAssemblyPartition(
  project: Project,
  options: {
    all?: Occurrence[];
    reserved?: ReadonlySet<string>;
    included?: ReadonlySet<string>;
    attachments?: readonly SourceAssemblyEdge[];
  } = {},
) {
  const all = options.all ?? occurrences(project);
  const allowed = all.filter(
    (o) =>
      !options.reserved?.has(o.id) &&
      (!options.included || options.included.has(o.id)),
  );
  const result = sourceConnectedAssembly(project, {
    ...options,
    all,
    seeds: allowed.map((o) => o.id),
  });
  const adjacent = new Map<string, Set<string>>();
  for (const e of result.witnessEdges)
    for (const [a, b] of [
      [e.a, e.b],
      [e.b, e.a],
    ]) {
      const set = adjacent.get(a) ?? new Set<string>();
      set.add(b);
      adjacent.set(a, set);
    }
  const visited = new Set<string>(),
    attachmentComponents: string[][] = [];
  for (const id of result.occurrenceIds) {
    if (visited.has(id)) continue;
    const component = [id];
    visited.add(id);
    for (let i = 0; i < component.length; i++)
      for (const next of adjacent.get(component[i]) ?? [])
        if (!visited.has(next)) {
          visited.add(next);
          component.push(next);
        }
    attachmentComponents.push(component);
  }
  return {
    occurrenceIds: result.occurrenceIds,
    rigidIslands: result.fixedIslands,
    attachmentComponents,
    boundaries: result.boundaries,
    witnessEdges: result.witnessEdges,
  };
}
