import { directReferences } from "../catalog/full-pack";
import { sha256 } from "../core/hash";
import { encodePath, occurrences } from "../core/document";
import {
  add,
  compose,
  identity,
  mv,
  nearlyPhysical,
  orthonormalized,
} from "../core/math";
import {
  ensure,
  type Occurrence,
  type Project,
  type Vec3,
} from "../core/types";
import { canonical } from "../ldraw/path";
import { sourceMechanicalContent } from "./source-content";
import profiles from "./pneumatic-sources.json";

/** Source-routing evidence only. A pneumatic seal does not weld parts or
 * authorize their native solids, guides, rod attachments or travel stops. */
export const PNEUMATIC_SOURCE_LIMITS = Object.freeze({
  profiles: 16,
  files: 1024,
  sourceCharacters: 8_000_000,
  ports: 128,
  hoses: 64,
  fittingChecks: 8192,
});
export type PneumaticPortRole =
  | "supply"
  | "workA"
  | "workB"
  | "base"
  | "cap"
  | "pump"
  | "passive";
type Profile = {
  files: number;
  closureSha256: string;
  kind:
    | "valve"
    | "cylinder"
    | "pump"
    | "tee"
    | "joiner"
    | "hose-end"
    | "hose-skin";
  ports: Array<{
    id: string;
    role: PneumaticPortRole;
    base: Vec3;
    tip: Vec3;
    radiusLdu: number;
  }>;
};
const manifest = profiles as unknown as Record<string, Profile>;
export type PneumaticSourceBinding = Readonly<{ refs: readonly string[] }>;
type Bound = {
  project: Project;
  revision: number;
  stamp: string;
  refs: ReadonlySet<string>;
};
const bindings = new WeakMap<PneumaticSourceBinding, Bound>();
const stamp = (project: Project) => {
  ensure(
    Object.keys(project.models).length <= 4096,
    "LIMIT_EXCEEDED",
    "Too many pneumatic source definitions",
  );
  const rows: unknown[] = [];
  let characters = 0;
  for (const [id, m] of Object.entries(project.models)) {
    const row = JSON.stringify([id, m.name, m.nodes, m.records]);
    characters += row.length;
    ensure(
      characters <= PNEUMATIC_SOURCE_LIMITS.sourceCharacters,
      "LIMIT_EXCEEDED",
      "Pneumatic source snapshot exceeds its work budget",
    );
    rows.push(row);
  }
  return JSON.stringify(rows);
};
/** Wrapper FILE/NOFILE records belong to the container, not the literal part.
 * Other source records, including BFC and reference transforms, are retained. */
export function normalizedPneumaticSource(text: string) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !/^0\s+(?:FILE\s|NOFILE(?:\s|$))/.test(line))
    .join("\n");
}
export function pneumaticProjectSource(project: Project, ref: string) {
  const model = project.models[canonical(ref)];
  return model && model.records.map((r) => r.raw).join("\n");
}
/** Resolve the same embedded definitions as the renderer. The 2015 Arocs
 * versions are explicitly reviewed; a modern file with a similar name cannot
 * replace them, and an altered embedded dependency invalidates the closure. */
export async function bindPneumaticSources(
  project: Project,
  sources: Readonly<Record<string, string>>,
  refs: readonly string[],
): Promise<PneumaticSourceBinding> {
  ensure(
    refs.length <= PNEUMATIC_SOURCE_LIMITS.profiles,
    "LIMIT_EXCEEDED",
    "Too many pneumatic source profiles",
  );
  const initial = stamp(project),
    revision = project.revision,
    hashes = new Map<string, Promise<string>>();
  let characters = 0;
  const verified = new Set<string>();
  for (const root of new Set(refs.map(canonical))) {
    ensure(
      Object.hasOwn(manifest, root),
      "INVALID_INPUT",
      "Unreviewed pneumatic source profile",
    );
    const seen = new Set<string>(),
      pending = [root];
    while (pending.length) {
      const ref = pending.pop()!;
      if (seen.has(ref)) continue;
      seen.add(ref);
      const raw = pneumaticProjectSource(project, ref) ?? sources[ref];
      ensure(
        typeof raw === "string",
        "INVALID_INPUT",
        "Missing pneumatic source: " + ref,
      );
      const text = normalizedPneumaticSource(raw);
      if (!hashes.has(ref)) {
        characters += text.length;
        ensure(
          hashes.size < PNEUMATIC_SOURCE_LIMITS.files &&
            characters <= PNEUMATIC_SOURCE_LIMITS.sourceCharacters,
          "LIMIT_EXCEEDED",
          "Pneumatic source review exceeds its work budget",
        );
        hashes.set(ref, sha256(text));
      }
      pending.push(...directReferences(text));
    }
    const rows = await Promise.all(
      [...seen].sort().map(async (ref) => [ref, await hashes.get(ref)!]),
    );
    ensure(
      seen.size === manifest[root].files &&
        (await sha256(JSON.stringify(rows))) === manifest[root].closureSha256,
      "INVALID_INPUT",
      "Reviewed pneumatic source changed: " + root,
    );
    verified.add(root);
  }
  ensure(
    project.revision === revision &&
      revision >= 0 &&
      stamp(project) === initial,
    "REVISION_CONFLICT",
    "The pneumatic source changed during review",
  );
  const binding = Object.freeze({ refs: Object.freeze([...verified]) });
  bindings.set(binding, {
    project,
    revision: project.revision,
    stamp: initial,
    refs: verified,
  });
  return binding;
}
export type SourcePneumaticPort = Readonly<{
  id: string;
  occurrenceId: string;
  ref: string;
  role: PneumaticPortRole;
  base: Vec3;
  tip: Vec3;
  axis: Vec3;
  radiusLdu: number;
}>;
export type SourcePneumaticHose = Readonly<{
  id: string;
  occurrenceIds: readonly string[];
  capIds: readonly [string, string];
  ports: readonly [string, string];
  /** Observed fit, retained for review; never a global joint tolerance. */
  fits: readonly [
    { radialLdu: number; insertionLdu: number },
    { radialLdu: number; insertionLdu: number },
  ];
}>;
export type SourcePneumaticTopology = Readonly<{
  ports: readonly SourcePneumaticPort[];
  hoses: readonly SourcePneumaticHose[];
  /** Passive real T/joiner bores and actual hose connections only. Valves
   * retain three separate nodes until their lever state routes pressure. */
  passages: readonly (readonly [string, string])[];
  valves: readonly Readonly<{
    id: string;
    supply: string;
    workA: string;
    workB: string;
  }>[];
  cylinders: readonly Readonly<{ id: string; base: string; cap: string }>[];
  pumps: readonly Readonly<{ id: string; outlet: string }>[];
}>;
const topologies = new WeakMap<SourcePneumaticTopology, Bound>();
/** Internal runtime handoff. Copying the observation cannot create source
 * admission, and any later source/revision edit requires another review. */
export function isPreparedPneumaticTopology(
  project: Project,
  topology: SourcePneumaticTopology,
) {
  const checked = topologies.get(topology);
  return (
    checked?.project === project &&
    checked.revision === project.revision &&
    checked.stamp === stamp(project)
  );
}
const dot = (a: Vec3, b: Vec3) => a.reduce((sum, x, i) => sum + x * b[i], 0);
const subtract = (a: Vec3, b: Vec3) => a.map((x, i) => x - b[i]) as Vec3;
const unit = (v: Vec3) => v.map((x) => x / Math.hypot(...v)) as Vec3;
const frozenVector = (p: Vec3) => Object.freeze(p) as unknown as Vec3;
/** Rounded source frames of flexible tube ends include a0.002511 column-length
 * residual and0.001756 normalized cross-column dot residual. Keep the original
 * placement; only normalize its fitting direction.
 * This narrow elastomer allowance never qualifies a rigid hardware frame. */
const tubeFrame = (basis: readonly number[]) => {
  if (basis.length !== 9 || !basis.every(Number.isFinite)) return false;
  const columns = [0, 1, 2].map(
    (k) => [basis[k], basis[k + 3], basis[k + 6]] as Vec3,
  );
  return (
    columns.every((v) => Math.abs(Math.hypot(...v) - 1) <= 0.003) &&
    Math.abs(dot(unit(columns[0]), unit(columns[1]))) <= 0.002 &&
    Math.abs(dot(unit(columns[0]), unit(columns[2]))) <= 0.002 &&
    Math.abs(dot(unit(columns[1]), unit(columns[2]))) <= 0.002 &&
    dot(columns[0], [
      columns[1][1] * columns[2][2] - columns[1][2] * columns[2][1],
      columns[1][2] * columns[2][0] - columns[1][0] * columns[2][2],
      columns[1][0] * columns[2][1] - columns[1][1] * columns[2][0],
    ]) > 0
  );
};

/** The flexible 165/71533k01 end has a source R4 bore at localY2..20.
 * The source R4 barbs enter it tip-first. A narrow0.15LDU radial elastic seal
 * allowance represents this rubber end, not an alignment or attachment rule
 * for rigid hardware. Axial insertion must be8..18LDU and tip localY2..12.
 * No nearest-part fallback: each actual cap must have exactly one fitting. */
export function sourcePneumaticTopology(
  project: Project,
  binding: PneumaticSourceBinding,
  all: Occurrence[] = occurrences(project),
): SourcePneumaticTopology {
  const checked = bindings.get(binding);
  ensure(
    checked?.project === project &&
      checked.revision === project.revision &&
      checked.stamp === stamp(project),
    "REVISION_CONFLICT",
    "Reload the pneumatic source after changing its parts",
  );
  ensure(
    checked.refs.has("165.dat"),
    "INVALID_INPUT",
    "Review the actual pneumatic hose-end source first",
  );
  const ports: SourcePneumaticPort[] = [],
    passages: Array<readonly [string, string]> = [],
    valves: Array<SourcePneumaticTopology["valves"][number]> = [],
    cylinders: Array<SourcePneumaticTopology["cylinders"][number]> = [],
    pumps: Array<SourcePneumaticTopology["pumps"][number]> = [];
  const content = sourceMechanicalContent(project, all),
    lookup = new Map(all.map((o) => [o.id, o]));
  // Embedded DAT hardware expands into render leaves. Its physical parent is
  // still one source placement; never guess it from a nearby primitive leaf.
  const hardware: Array<{
      id: string;
      node: { ref: string };
      transform: import("../core/types").Transform;
    }> = [],
    flexibleIds = new Set(content.flexible.map((f) => f.id));
  let visits = 0;
  const walk = (
    modelId: string,
    path: string[],
    frame: import("../core/types").Transform,
  ) => {
    for (const node of project.models[modelId].nodes) {
      ensure(
        ++visits <= 100_000,
        "LIMIT_EXCEEDED",
        "Too many pneumatic source placements",
      );
      if (node.kind === "geometry") continue;
      const next = [...path, node.id],
        id = encodePath(next),
        transform = compose(frame, node.transform),
        ref = canonical(node.ref);
      if (flexibleIds.has(id)) continue;
      if (checked.refs.has(ref) && manifest[ref])
        hardware.push({ id, node, transform });
      else if (node.kind === "submodel") walk(node.ref, next, transform);
    }
  };
  walk(project.rootModelId, [], identity());
  for (const o of hardware) {
    const ref = canonical(o.node.ref),
      profile = manifest[ref];
    if (
      !checked.refs.has(ref) ||
      !profile ||
      profile.kind === "hose-end" ||
      profile.kind === "hose-skin"
    )
      continue;
    ensure(
      nearlyPhysical(o.transform),
      "INVALID_INPUT",
      "Pneumatic hardware requires a rigid source frame",
    );
    const frame = orthonormalized(o.transform),
      memberPorts = profile.ports.map((p) => {
        const base = add(frame.position, mv(frame.basis, p.base)),
          tip = add(frame.position, mv(frame.basis, p.tip));
        return Object.freeze({
          id: o.id + ":" + p.id,
          occurrenceId: o.id,
          ref,
          role: p.role,
          base: frozenVector(base),
          tip: frozenVector(tip),
          axis: frozenVector(unit(subtract(tip, base))),
          radiusLdu: p.radiusLdu,
        });
      });
    ports.push(...memberPorts);
    ensure(
      ports.length <= PNEUMATIC_SOURCE_LIMITS.ports,
      "LIMIT_EXCEEDED",
      "Too many pneumatic ports",
    );
    const role = (r: PneumaticPortRole) =>
      memberPorts.find((p) => p.role === r)!.id;
    if (profile.kind === "valve")
      valves.push(
        Object.freeze({
          id: o.id,
          supply: role("supply"),
          workA: role("workA"),
          workB: role("workB"),
        }),
      );
    else if (profile.kind === "cylinder")
      cylinders.push(
        Object.freeze({ id: o.id, base: role("base"), cap: role("cap") }),
      );
    else if (profile.kind === "pump")
      pumps.push(Object.freeze({ id: o.id, outlet: role("pump") }));
    else
      for (const p of memberPorts.slice(1))
        passages.push(Object.freeze([memberPorts[0].id, p.id] as const));
  }
  const hoses: SourcePneumaticHose[] = [],
    occupied = new Set<string>();
  let checks = 0;
  for (const hose of content.flexible) {
    // A track, string or spring is never admitted because its file name sounds
    // pneumatic. Every donor and both exact cap references must match.
    if (
      hose.kind !== "path" ||
      hose.skins.length !== 1 ||
      canonical(hose.skins[0].donPart ?? "") !== "166.dat"
    )
      continue;
    ensure(
      checked.refs.has(canonical(hose.skins[0].donPart)),
      "INVALID_INPUT",
      "Review the actual pneumatic tube section first",
    );
    ensure(
      hose.issues.length === 0 &&
        hose.parameters.looped === "false" &&
        hose.caps.length === 2 &&
        hoses.length < PNEUMATIC_SOURCE_LIMITS.hoses,
      "INVALID_INPUT",
      "Pneumatic hoses need two complete distinct source ends",
    );
    const caps = ["start", "end"].map((group) => {
      const cap = hose.caps.find((c) => c.group === group);
      ensure(
        cap &&
          canonical(cap.reference) === "165.dat" &&
          cap.sourceNodeId &&
          cap.occurrenceIds.length === 1,
        "INVALID_INPUT",
        "Pneumatic hoses require their exact reviewed tube ends",
      );
      const o = lookup.get(cap.occurrenceIds[0]);
      ensure(
        o &&
          canonical(o.node.ref) === "165.dat" &&
          tubeFrame(o.transform.basis) &&
          o.transform.position.every(Number.isFinite) &&
          JSON.stringify(o.transform) === JSON.stringify(cap.frame),
        "INVALID_INPUT",
        "The pneumatic tube end has no matching source fitting frame",
      );
      return o;
    });
    const fits = caps.map((cap) => {
      const frame = cap.transform,
        inward = unit(mv(frame.basis, [0, 1, 0]));
      const candidates = ports.flatMap((port) => {
        ensure(
          ++checks <= PNEUMATIC_SOURCE_LIMITS.fittingChecks,
          "LIMIT_EXCEEDED",
          "Too many pneumatic fitting checks",
        );
        if (dot(inward, port.axis) > -0.9999 || port.radiusLdu > 4) return [];
        const d = subtract(port.tip, frame.position),
          along = dot(d, inward),
          radialLdu = Math.hypot(
            ...subtract(d, inward.map((x) => x * along) as Vec3),
          );
        const length = Math.hypot(...subtract(port.tip, port.base)),
          insertionLdu = Math.min(length, 20 - along);
        return radialLdu <= 0.15 &&
          along >= 2 &&
          along <= 12 &&
          insertionLdu >= 8 &&
          insertionLdu <= 18
          ? [{ port, radialLdu, insertionLdu }]
          : [];
      });
      ensure(
        candidates.length === 1,
        "INVALID_INPUT",
        candidates.length
          ? "A pneumatic hose end fits more than one port"
          : "A pneumatic hose end is not seated on a reviewed barb",
      );
      const fit = candidates[0];
      ensure(
        !occupied.has(fit.port.id),
        "INVALID_INPUT",
        "A pneumatic port cannot hold two hose ends",
      );
      occupied.add(fit.port.id);
      return fit;
    });
    ensure(
      fits[0].port.id !== fits[1].port.id,
      "INVALID_INPUT",
      "A pneumatic hose needs two distinct ports",
    );
    const pair = Object.freeze(
      fits.map((f) => f.port.id),
    ) as unknown as readonly [string, string];
    passages.push(pair);
    hoses.push(
      Object.freeze({
        id: hose.id,
        occurrenceIds: Object.freeze([...hose.occurrenceIds]),
        capIds: Object.freeze(caps.map((c) => c.id)) as unknown as readonly [
          string,
          string,
        ],
        ports: pair,
        fits: Object.freeze(
          fits.map((f) =>
            Object.freeze({
              radialLdu: f.radialLdu,
              insertionLdu: f.insertionLdu,
            }),
          ),
        ) as unknown as SourcePneumaticHose["fits"],
      }),
    );
  }
  ensure(
    hoses.length > 0 && occupied.size === ports.length,
    "INVALID_INPUT",
    "The pneumatic circuit has open or unsupported hose ports",
  );
  const topology = Object.freeze({
    ports: Object.freeze(ports),
    hoses: Object.freeze(hoses),
    passages: Object.freeze(passages),
    valves: Object.freeze(valves),
    cylinders: Object.freeze(cylinders),
    pumps: Object.freeze(pumps),
  });
  topologies.set(topology, checked);
  return topology;
}
