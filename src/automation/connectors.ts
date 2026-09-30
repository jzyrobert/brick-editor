// Connector queries shared by the browser API and the CLI (no WebGL needed).
import {
  connectorCoverage,
  connectorStatus,
  hingeData,
  verifiedConnectors,
} from "../catalog/connectors";
import { catalog } from "../catalog/catalog";
import {
  fullConnectorLock,
  fullConnectorManifest,
} from "../catalog/full-connectors";
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
import {
  checkConnection,
  checkMove,
  placementScene,
} from "../edit/connected-placement";

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

/**
 * `prepare` makes a part's complete-library data available (the browser
 * loads its definition and derived connector shard; the CLI reads them from
 * disk synchronously and passes none).
 */
export function connectorService(
  project: () => Project,
  prepare?: (refs: string[]) => Promise<unknown>,
) {
  const ready = async (ref: string) => {
    if (prepare) await prepare([ref]).catch(() => {});
  };
  const visibleScene = () => {
    const p = project();
    return sceneConnectors(p, occurrences(p), (o) => o.visible);
  };
  const fitsFor = async (input: Proposal) => {
    checkProposal(input);
    await ready(input.part);
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
    coverage: async () => {
      const full = fullConnectorManifest();
      return {
        ...connectorCoverage,
        verifiedParts: Object.keys(catalog).filter((id) =>
          verifiedConnectors(id),
        ),
        // The pack derived from the complete official library (loaded per
        // part on demand); null until its manifest is registered.
        completeLibrary: full
          ? { packId: full.id, ...full.coverage }
          : { packId: fullConnectorLock.connectorPackId, loaded: false },
      };
    },
    /** One catalogue part's verification status, connectors and hinge data (LDraw space). */
    part: async (input: { ref: string }) => {
      ensure(
        typeof input?.ref === "string",
        "INVALID_INPUT",
        "ref must be an official part file name",
      );
      await ready(input.ref);
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
      const fits = await fitsFor(input);
      const i = chooseFit(fits, input.previous);
      if (i < 0) return null;
      const { distance: _distance, ...fit } = fits[i];
      return { ...fit, fit: i, fits: fits.length };
    },
    /** Every fit near a proposal, nearest first (what Next fit cycles through). */
    fits: async (input: Proposal) =>
      (await fitsFor(input)).map(({ distance: _d, ...fit }) => fit),
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
      await ready(input.part);
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
    /**
     * Whether a proposed placement would hold under the editor's "Snap
     * together" rule (docs/CONNECTORS.md, Connected building): verified stud
     * or hinge connections to the visible parts, the ground, or (where
     * connector data is missing) resting on a part's top; clashes are refused.
     * A query only: commands stay unrestricted.
     */
    validatePlacement: async (input: Proposal) => {
      checkProposal(input);
      await ready(input.part);
      const p = project();
      const basis = input.basis ?? rotationY(input.angle ?? 0);
      return {
        revision: p.revision,
        ...checkConnection(
          input.part,
          { position: input.position, basis },
          placementScene(p),
        ),
      };
    },
    /**
     * Whether moving occurrences to the given world transforms keeps them
     * held (the rule the Move and rotate handles apply in "Snap together"):
     * refused only when the group held before and would float or clash after.
     */
    validateMove: async (input: {
      transforms: Record<string, { position: Vec3; basis: Basis }>;
    }) => {
      const t = input?.transforms;
      ensure(
        !!t &&
          typeof t === "object" &&
          Object.values(t).every(
            (v) => finite(v?.position, 3) && finite(v?.basis, 9),
          ),
        "INVALID_INPUT",
        "transforms must map occurrence IDs to { position, basis }",
      );
      const p = project();
      const { before, ...check } = checkMove(p, t);
      return { revision: p.revision, heldBefore: before, ...check };
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
