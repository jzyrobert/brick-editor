// Connector queries shared by the browser API and the CLI (no WebGL needed).
import {
  connectorCoverage,
  connectorStatus,
  verifiedConnectors,
} from "../catalog/connectors";
import { catalog } from "../catalog/catalog";
import {
  connectedAssembly,
  connectedGroups,
  connectionGraph,
} from "../core/connectivity";
import { occurrences } from "../core/document";
import { rotationY } from "../core/math";
import { ensure, type Basis, type Project, type Vec3 } from "../core/types";
import { sceneConnectors, snapPlacement } from "../edit/snap";

const finite = (v: unknown, n: number) =>
  Array.isArray(v) && v.length === n && v.every((x) => Number.isFinite(x));

export function connectorService(project: () => Project) {
  return {
    /** Pack identity, families and how many catalogue parts are verified. */
    coverage: async () => ({
      ...connectorCoverage,
      verifiedParts: Object.keys(catalog).filter((id) =>
        verifiedConnectors(id),
      ),
    }),
    /** One catalogue part's verification status and its connectors (LDraw space). */
    part: async (input: { ref: string }) => {
      ensure(
        typeof input?.ref === "string",
        "INVALID_INPUT",
        "ref must be a catalogue part file name",
      );
      return {
        ref: input.ref,
        ...connectorStatus(input.ref),
        connectors: verifiedConnectors(input.ref) ?? [],
      };
    },
    /**
     * Snaps a proposed placement to verified connectors of the current project's
     * visible parts. Returns null when nothing connects within one stud.
     */
    snap: async (input: {
      part: string;
      position: Vec3;
      angle?: number;
      basis?: Basis;
      up?: Vec3;
    }) => {
      ensure(
        typeof input?.part === "string" && finite(input.position, 3),
        "INVALID_INPUT",
        "snap needs a part and a finite position",
      );
      ensure(
        input.basis === undefined || finite(input.basis, 9),
        "INVALID_INPUT",
        "basis must be nine finite numbers",
      );
      ensure(
        input.up === undefined || finite(input.up, 3),
        "INVALID_INPUT",
        "up must be three finite numbers",
      );
      const basis = input.basis ?? rotationY(input.angle ?? 0);
      const p = project();
      const result = snapPlacement(
        input.part,
        basis,
        input.position,
        sceneConnectors(p, occurrences(p), (o) => o.visible),
        input.up,
      );
      return result && { ...result, basis };
    },
    /** Every part connected to the given ones through verified stud connections. */
    connected: async (input: { occurrenceIds: string[] }) => {
      ensure(
        Array.isArray(input?.occurrenceIds) &&
          input.occurrenceIds.every((id) => typeof id === "string"),
        "INVALID_INPUT",
        "occurrenceIds must be an array of occurrence IDs",
      );
      const p = project();
      return {
        revision: p.revision,
        ...connectedAssembly(p, input.occurrenceIds),
      };
    },
    /** Connected groups (largest first) and parts without verified data. */
    groups: async () => {
      const p = project();
      const graph = connectionGraph(p);
      return {
        revision: p.revision,
        groups: connectedGroups(graph),
        uncovered: graph.uncovered,
        contacts: graph.contacts,
      };
    },
  };
}
