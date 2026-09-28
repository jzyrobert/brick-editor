// Connectivity from verified connector data (spec §11.2, §11.3, §20.3).
// Two parts are connected when a stud of one sits in an anti-stud of the other,
// or a hinge pin in a hinge socket: positions coincide within TOLERANCE and the
// axes are opposed. Only official
// catalogue parts with verified connectors and rigid, unmirrored placements take
// part; every other occurrence is reported as uncovered, never as floating.
import { verifiedConnectors, type Connector } from "../catalog/connectors";
import { isMale, mateKind } from "../catalog/connector-pack";
import { occurrences } from "./document";
import { add, mv, physical } from "./math";
import type { Occurrence, Project } from "./types";

export const CONNECTION_TOLERANCE = 0.5; // LDU
const AXIS_OPPOSED = -0.99;

export type WorldConnector = Connector & { occurrenceId: string };

/** Connectors of one occurrence in world (LDraw) space, or null when not covered. */
export function worldConnectors(o: Occurrence): WorldConnector[] | null {
  if (o.namespace !== "official" || o.node.kind !== "part") return null;
  if (!physical(o.transform)) return null;
  const local = verifiedConnectors(o.node.ref);
  if (!local) return null;
  return local.map((c) => ({
    kind: c.kind,
    p: add(o.transform.position, mv(o.transform.basis, c.p)),
    axis: mv(o.transform.basis, c.axis),
    occurrenceId: o.id,
  }));
}

/** Spatial hash of connectors for mating queries. */
export class ConnectorIndex {
  private cells = new Map<string, WorldConnector[]>();
  add(c: WorldConnector) {
    const k = c.p.map(Math.round).join(",");
    const list = this.cells.get(k);
    if (list) list.push(c);
    else this.cells.set(k, [c]);
  }
  /** Connectors of the given kind that mate with `c` (coincident, opposed axes). */
  mates(c: Connector, kind: Connector["kind"]): WorldConnector[] {
    const out: WorldConnector[] = [];
    const [x, y, z] = c.p.map(Math.round);
    for (let dx = -1; dx <= 1; dx++)
      for (let dy = -1; dy <= 1; dy++)
        for (let dz = -1; dz <= 1; dz++)
          for (const s of this.cells.get(`${x + dx},${y + dy},${z + dz}`) ?? [])
            if (s.kind === kind && mates(c, s)) out.push(s);
    return out;
  }
}
export function mates(a: Connector, b: Connector) {
  const d = Math.hypot(a.p[0] - b.p[0], a.p[1] - b.p[1], a.p[2] - b.p[2]);
  const dot =
    a.axis[0] * b.axis[0] + a.axis[1] * b.axis[1] + a.axis[2] * b.axis[2];
  return d <= CONNECTION_TOLERANCE && dot <= AXIS_OPPOSED;
}

export type ConnectionGraph = {
  /** Occurrences with verified connector data. */
  covered: string[];
  /** Occurrences without verified data (unknown connectivity). */
  uncovered: string[];
  /** Adjacency between covered occurrences. */
  edges: Map<string, Set<string>>;
  /** Stud-in-anti-stud and pin-in-socket contacts found. */
  contacts: number;
  /** Of those, hinge pins in sockets. */
  hingeContacts: number;
};

export function connectionGraph(
  project: Project,
  all: Occurrence[] = occurrences(project),
): ConnectionGraph {
  const males = new ConnectorIndex();
  const females: WorldConnector[] = [];
  const covered: string[] = [],
    uncovered: string[] = [];
  const edges = new Map<string, Set<string>>();
  for (const o of all) {
    const list = worldConnectors(o);
    if (!list) {
      uncovered.push(o.id);
      continue;
    }
    covered.push(o.id);
    edges.set(o.id, new Set());
    for (const c of list)
      if (isMale(c.kind)) males.add(c);
      else females.push(c);
  }
  let contacts = 0,
    hingeContacts = 0;
  for (const r of females)
    for (const s of males.mates(r, mateKind(r.kind))) {
      if (s.occurrenceId === r.occurrenceId) continue;
      contacts++;
      if (r.kind === "socket") hingeContacts++;
      edges.get(r.occurrenceId)!.add(s.occurrenceId);
      edges.get(s.occurrenceId)!.add(r.occurrenceId);
    }
  return { covered, uncovered, edges, contacts, hingeContacts };
}

/** Connected groups of covered parts, largest first (ties by first ID). */
export function connectedGroups(graph: ConnectionGraph): string[][] {
  const seen = new Set<string>();
  const groups: string[][] = [];
  for (const id of graph.covered) {
    if (seen.has(id)) continue;
    const group: string[] = [];
    const stack = [id];
    seen.add(id);
    while (stack.length) {
      const next = stack.pop()!;
      group.push(next);
      for (const n of graph.edges.get(next) ?? [])
        if (!seen.has(n)) {
          seen.add(n);
          stack.push(n);
        }
    }
    groups.push(group);
  }
  return groups.sort((a, b) => b.length - a.length);
}

/**
 * Every part connected (through verified stud connections) to any seed. Seeds
 * without verified data are returned alone; the result keeps seed order first.
 */
export function connectedAssembly(
  project: Project,
  seeds: string[],
  all: Occurrence[] = occurrences(project),
): { occurrenceIds: string[]; uncoveredSeeds: string[] } {
  const graph = connectionGraph(project, all);
  const result = new Set<string>();
  const uncoveredSeeds: string[] = [];
  const stack: string[] = [];
  for (const id of seeds) {
    if (!graph.edges.has(id)) {
      if (all.some((o) => o.id === id)) {
        uncoveredSeeds.push(id);
        result.add(id);
      }
      continue;
    }
    if (!result.has(id)) {
      result.add(id);
      stack.push(id);
    }
  }
  while (stack.length)
    for (const n of graph.edges.get(stack.pop()!) ?? [])
      if (!result.has(n)) {
        result.add(n);
        stack.push(n);
      }
  return { occurrenceIds: [...result], uncoveredSeeds };
}
