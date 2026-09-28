// Connector queries shared by the browser API and the CLI (no WebGL needed).
import {
  connectorCoverage,
  connectorStatus,
  hingeData,
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
import {
  chooseFit,
  hingeCandidates,
  orientedCandidates,
  sceneConnectors,
  snapCandidates,
} from "../edit/snap";

const finite = (v: unknown, n: number) =>
  Array.isArray(v) && v.length === n && v.every((x) => Number.isFinite(x));

type Proposal = {
  part: string;
  position: Vec3;
  angle?: number;
  basis?: Basis;
  up?: Vec3;
};
function checkProposal(input: Proposal) {
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
}

export function connectorService(project: () => Project) {
  const visibleScene = () => {
    const p = project();
    return sceneConnectors(p, occurrences(p), (o) => o.visible);
  };
  const fitsFor = (input: Proposal) => {
    checkProposal(input);
    const basis = input.basis ?? rotationY(input.angle ?? 0);
    return snapCandidates(
      input.part,
      basis,
      input.position,
      visibleScene(),
      input.up,
    );
  };
  return {
    /** Pack identity, families and how many catalogue parts are verified. */
    coverage: async () => ({
      ...connectorCoverage,
      verifiedParts: Object.keys(catalog).filter((id) =>
        verifiedConnectors(id),
      ),
    }),
    /** One catalogue part's verification status, connectors and hinge data (LDraw space). */
    part: async (input: { ref: string }) => {
      ensure(
        typeof input?.ref === "string",
        "INVALID_INPUT",
        "ref must be a catalogue part file name",
      );
      const hinge = hingeData(input.ref);
      return {
        ref: input.ref,
        ...connectorStatus(input.ref),
        connectors: verifiedConnectors(input.ref) ?? [],
        ...(hinge ?? {}),
      };
    },
    /**
     * Snaps a proposed placement to verified connectors of the current project's
     * visible parts: the nearest fit, or `previous` while hysteresis keeps it.
     * Returns null when nothing connects within one stud.
     */
    snap: async (
      input: Proposal & { previous?: { position: Vec3; basis?: Basis } },
    ) => {
      const fits = fitsFor(input);
      const i = chooseFit(fits, input.previous);
      if (i < 0) return null;
      const { distance: _distance, ...fit } = fits[i];
      return { ...fit, fit: i, fits: fits.length };
    },
    /** Every fit near a proposal, nearest first (what Next fit cycles through). */
    fits: async (input: Proposal) =>
      fitsFor(input).map(({ distance: _d, ...fit }) => fit),
    /**
     * Fits for a tap on a part's face: a hinged leaf seated in the hinge
     * sockets of a frame near `point`, else the part turned onto sideways
     * studs of that face (`normal` points out of it), spun by `angle`.
     */
    orient: async (input: {
      part: string;
      point: Vec3;
      normal: Vec3;
      angle?: number;
      up?: Vec3;
    }) => {
      ensure(
        typeof input?.part === "string" &&
          finite(input.point, 3) &&
          finite(input.normal, 3),
        "INVALID_INPUT",
        "orient needs a part, a finite point and a finite normal",
      );
      const scene = visibleScene();
      const hinge = hingeCandidates(input.part, input, scene);
      const fits = hinge.length
        ? hinge
        : orientedCandidates(
            input.part,
            input.angle ?? 0,
            input,
            scene,
            input.up,
          );
      return {
        mode: hinge.length ? "hinge" : fits.length ? "side" : "none",
        fits: fits.map(({ distance: _d, ...fit }) => fit),
      };
    },
    /** Every part connected to the given ones through verified connections. */
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
        hingeContacts: graph.hingeContacts,
      };
    },
  };
}
