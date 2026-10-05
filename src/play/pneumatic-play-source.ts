import { directReferences } from "../catalog/full-pack";
import { occurrences } from "../core/document";
import { inverse, mv, nearlyPhysical, orthonormalized } from "../core/math";
import {
  AppError,
  ensure,
  type Occurrence,
  type Project,
  type Transform,
  type Vec3,
} from "../core/types";
import { canonical } from "../ldraw/path";
import { frozenSourceSnapshot } from "../mechanisms/frozen-source";
import {
  bindPneumaticSources,
  pneumaticProjectSource,
  sourcePneumaticTopology,
  type SourcePneumaticTopology,
} from "../mechanisms/pneumatic-sources";
import { sourceHardwareIndex } from "../mechanisms/source-hardware-index";
import type { MotionRig, RigidGroup } from "../mechanisms/types";
import {
  prepareSourcePneumaticCylinder,
  type PneumaticCylinderSurface,
  type PreparedPneumaticCylinder,
} from "./pneumatic-cylinder-source";
import {
  PNEUMATIC_PUMP_REFS,
  prepareSourcePneumaticPump,
  type PreparedPneumaticPump,
} from "./pneumatic-pump-source";
import { compileReviewedPneumaticSurface } from "./pneumatic-surfaces";
import { PNEUMATIC_PLAY_LIBRARY_ROOTS } from "./pneumatic-library-roots";

/**
 * Ordinary Play admission of a complete, routed pneumatic circuit built from
 * the reviewed 2015 Arocs hardware: the 2943 pump (with its 99799 barrel,
 * 2941 cap and 2944 rod), 47223 valves and 2 × 11 19466/19467 cylinders,
 * joined only by seated 165/166 tubes (and reviewed T-pieces/joiners).
 *
 * Only the pump rods and cylinder rods move, each inside its own reviewed
 * source guide. Pump cases, cylinder bodies, valves and tubes stay where the
 * build puts them, like every other unrigged part of a Play world: no pivot,
 * hose flex or chassis attachment is simulated or claimed. Anything else
 * (another cylinder type, an open port, a cylinder without exactly one valve
 * route) leaves every part still with a reason.
 */
export const PNEUMATIC_PLAY_PROFILE = "source-pneumatic-circuit-v1";
export const PNEUMATIC_PLAY_LIMITS = Object.freeze({
  pumps: 2,
  cylinders: 4,
  valves: 4,
  /** Closure texts read for the reviewed roots (files, characters). */
  files: 1024,
  characters: 8_000_000,
});
const PUMP = "42043 - 2943-v2.dat",
  VALVE = "42043 - 47223-v2-p1.dat",
  BODY = "42043 - 19466c01.dat",
  ROD = "42043 - 19467c01.dat";
/** Hardware the routing review knows but Play cannot move yet. */
const UNMODELLED: Record<string, string> = {
  "2947.dat":
    "This 1 × 5 pneumatic cylinder has no reviewed moving rod yet, so the air circuit stays still.",
  "42043 - u9145c01.dat":
    "This small pneumatic cylinder has no reviewed moving rod yet, so the air circuit stays still.",
};
/** Other pneumatic parts: explained, never guessed into a circuit. */
const OTHER_PNEUMATIC =
  /^(?:2797|2798|2793|2943|2944c|2947|4688|4694c|47223|47224c|19466|19467c|19474|19475|19476|19477|99798|75974|67c01)/;
export type PneumaticPlaySkip = {
  occurrenceId: string;
  part: string;
  reason: string;
};
type Hardware = ReturnType<typeof sourceHardwareIndex>["hardware"][number];
export type PneumaticPlayCandidate = {
  rig: MotionRig;
  /** Pump case/rod and cylinder body/rod leaves: native bodies, not static world. */
  movingOccurrenceIds: string[];
  pumps: Array<{
    owners: [string, string, string, string];
    caseGroup: string;
    rodGroup: string;
  }>;
  cylinders: Array<{
    body: string;
    rod: string;
    bodyGroup: string;
    rodGroup: string;
  }>;
};
export type PneumaticPlayDerivation = {
  systems: PneumaticPlayCandidate[];
  skipped: PneumaticPlaySkip[];
};
const local = (frame: Transform, p: Vec3) =>
  mv(inverse(frame).basis, p.map((v, i) => v - frame.position[i]) as Vec3);
/** Quick name test before any source expansion: most builds have none. */
function mentionsPneumatics(project: Project, all: Occurrence[]) {
  const names = new Set(
    Object.values(project.models).map((m) => canonical(m.name)),
  );
  return (
    [PUMP, VALVE, BODY, ...Object.keys(UNMODELLED)].some((n) => names.has(n)) ||
    all.some((o) => OTHER_PNEUMATIC.test(o.node.ref))
  );
}

/**
 * Finds the reviewed pneumatic hardware of a build. This is organisation
 * only: the circuit is admitted later by `preparePneumaticPlay`, which binds
 * every closure, port, tube end and surface to its reviewed source.
 */
export function derivePneumaticPlay(
  project: Project,
  options: {
    all?: Occurrence[];
    included?: ReadonlySet<string>;
    reserved?: ReadonlySet<string>;
  } = {},
): PneumaticPlayDerivation {
  const all = options.all ?? occurrences(project);
  if (!mentionsPneumatics(project, all)) return { systems: [], skipped: [] };
  const skipped: PneumaticPlaySkip[] = [];
  let hardware: Hardware[];
  try {
    hardware = sourceHardwareIndex(project, all).hardware;
  } catch (e) {
    return {
      systems: [],
      skipped: [
        {
          occurrenceId: "",
          part: "pneumatics",
          reason:
            "The pneumatic parts could not be checked safely: " +
            (e instanceof Error ? e.message : String(e)),
        },
      ],
    };
  }
  const lookup = new Map(all.map((o) => [o.id, o]));
  const reviewed = new Set([PUMP, VALVE, BODY, ROD, ...PNEUMATIC_PUMP_REFS]);
  const unmodelled = hardware.filter((h) => UNMODELLED[h.reference]);
  const others = hardware.filter(
    (h) =>
      !reviewed.has(h.reference) &&
      !UNMODELLED[h.reference] &&
      h.namespace === "official" &&
      OTHER_PNEUMATIC.test(h.reference),
  );
  for (const h of others)
    skipped.push({
      occurrenceId: h.id,
      part: h.reference,
      reason:
        "Only the reviewed 2015 Arocs pump, valve and 2 × 11 cylinder move in Play. This pneumatic part stays still.",
    });
  const pumps = hardware.filter((h) => h.reference === PUMP),
    bodies = hardware.filter((h) => h.reference === BODY);
  if (!pumps.length && !bodies.length) return { systems: [], skipped };
  const refuse = (reason: string, owners: Hardware[]) => {
    for (const h of owners)
      skipped.push({ occurrenceId: h.id, part: h.reference, reason });
    return { systems: [], skipped };
  };
  if (unmodelled.length)
    return refuse(UNMODELLED[unmodelled[0].reference], [
      ...unmodelled,
      ...pumps,
      ...bodies,
    ]);
  if (!pumps.length)
    return refuse(
      "No reviewed pump feeds these cylinders, so they stay still.",
      bodies,
    );
  if (
    pumps.length > PNEUMATIC_PLAY_LIMITS.pumps ||
    bodies.length > PNEUMATIC_PLAY_LIMITS.cylinders ||
    hardware.filter((h) => h.reference === VALVE).length >
      PNEUMATIC_PLAY_LIMITS.valves
  )
    return refuse(
      `Play moves at most ${PNEUMATIC_PLAY_LIMITS.pumps} pumps, ${PNEUMATIC_PLAY_LIMITS.cylinders} cylinders and ${PNEUMATIC_PLAY_LIMITS.valves} valves in one circuit. These stay still.`,
      [...pumps, ...bodies],
    );
  const used = new Set<string>();
  const closest = (
    base: Hardware,
    ref: string,
    accept: (offset: number) => boolean,
  ) => {
    if (!nearlyPhysical(base.frame)) return undefined;
    const frame = orthonormalized(base.frame);
    const matches = hardware.filter((h) => {
      if (h.reference !== ref || used.has(h.id)) return false;
      if (JSON.stringify(h.frame.basis) !== JSON.stringify(base.frame.basis))
        return false;
      const p = local(frame, h.frame.position);
      return Math.hypot(p[0], p[2]) <= 0.5 && accept(-p[1]);
    });
    return matches.length === 1 ? matches[0] : undefined;
  };
  const groups: RigidGroup[] = [];
  const group = (id: string, owners: Hardware[]) => {
    const ids = owners.flatMap((h) => h.occurrenceIds);
    groups.push({
      id,
      occurrenceIds: ids,
      frame: orthonormalized(owners[0].frame),
      restTransforms: Object.fromEntries(
        ids.map((o) => [o, structuredClone(lookup.get(o)!.transform)]),
      ),
    });
    return id;
  };
  const candidate: PneumaticPlayCandidate = {
    rig: undefined as unknown as MotionRig,
    movingOccurrenceIds: [],
    pumps: [],
    cylinders: [],
  };
  for (const [n, base] of pumps.entries()) {
    const barrel = closest(base, "99799.dat", (y) => Math.abs(y - 88) <= 0.5),
      cap = closest(base, "2941.dat", (y) => Math.abs(y - 90) <= 0.5),
      rod = closest(base, "2944.dat", (y) => y >= 100 && y <= 140);
    if (!barrel || !cap || !rod)
      return refuse(
        "This pump is missing its barrel, cap or rod in a reviewed position, so the air circuit stays still.",
        [base],
      );
    for (const h of [barrel, cap, rod]) used.add(h.id);
    candidate.pumps.push({
      owners: [base.id, barrel.id, cap.id, rod.id],
      caseGroup: group(`pump-${n + 1}-case`, [base, barrel, cap]),
      rodGroup: group(`pump-${n + 1}-rod`, [rod]),
    });
  }
  for (const [n, body] of bodies.entries()) {
    const rod = closest(body, ROD, (y) => y >= 200 && y <= 330);
    if (!rod)
      return refuse(
        "This cylinder's rod is not inside its reviewed guide, so the air circuit stays still.",
        [body],
      );
    used.add(rod.id);
    candidate.cylinders.push({
      body: body.id,
      rod: rod.id,
      bodyGroup: group(`cylinder-${n + 1}-body`, [body]),
      rodGroup: group(`cylinder-${n + 1}-rod`, [rod]),
    });
  }
  const ids = groups.flatMap((g) => g.occurrenceIds);
  if (options.included && ids.some((id) => !options.included!.has(id)))
    return refuse(
      "Part of the air circuit is on a hidden layer, so it stays still.",
      [...pumps, ...bodies],
    );
  if (options.reserved && ids.some((id) => options.reserved!.has(id)))
    return refuse(
      "Part of the air circuit already belongs to another mechanism, so it stays still.",
      [...pumps, ...bodies],
    );
  candidate.movingOccurrenceIds = ids;
  candidate.rig = {
    schemaVersion: 1,
    id: "pneumatic:0",
    // Short, plain names: the Controls sheet title adds "controls".
    name: pumps.length === 1 ? "Air pump" : "Air pumps",
    mode: "kinematic",
    groups,
    joints: [],
  };
  return { systems: [candidate], skipped };
}

/** Rest bounds for framing Controls: each cylinder body also covers its
 * rod's whole retained stroke, so a pushed load stays in view. */
export function pneumaticViewBounds(
  candidate: PneumaticPlayCandidate,
  meshes: Readonly<Record<string, { bounds: { min: Vec3; max: Vec3 } }>>,
) {
  const out: Record<string, { bounds: { min: Vec3; max: Vec3 } }> = {};
  for (const [id, mesh] of Object.entries(meshes))
    out[id] = { bounds: structuredClone(mesh.bounds) };
  const frames = new Map(candidate.rig.groups.map((g) => [g.id, g.frame]));
  for (const c of candidate.cylinders) {
    const body = frames.get(c.bodyGroup)!,
      rod = frames.get(c.rodGroup)!,
      separation = -local(body, rod.position)[1],
      // The retained stroke plus three studs of room for what the tip pushes.
      reach = Math.max(0, 329.5 - separation) + 60,
      outward = mv(body.basis, [0, -1, 0]).map((v) => v * reach),
      bounds = out[c.bodyGroup].bounds,
      swept = out[c.rodGroup].bounds;
    for (const corner of [swept.min, swept.max])
      for (const shift of [[0, 0, 0], outward])
        for (let k = 0; k < 3; k++) {
          bounds.min[k] = Math.min(bounds.min[k], corner[k] + shift[k]);
          bounds.max[k] = Math.max(bounds.max[k], corner[k] + shift[k]);
        }
  }
  return out;
}

/** Reads every library text the reviewed roots need (closures included). */
export function pneumaticLibrarySources(
  project: Project,
  roots: Iterable<string>,
  read: (name: string) => string | undefined,
) {
  const sources: Record<string, string> = Object.create(null),
    pending = [...roots];
  let characters = 0;
  const seen = new Set<string>();
  while (pending.length) {
    const ref = canonical(pending.pop()!);
    if (seen.has(ref)) continue;
    seen.add(ref);
    const embedded = pneumaticProjectSource(project, ref),
      text = embedded ?? read(ref);
    ensure(
      text !== undefined,
      "REFERENCE_MISSING",
      "Load the pneumatic library parts before Play: " + ref,
    );
    characters += text.length;
    ensure(
      seen.size <= PNEUMATIC_PLAY_LIMITS.files &&
        characters <= PNEUMATIC_PLAY_LIMITS.characters,
      "LIMIT_EXCEEDED",
      "The pneumatic sources are too large to check safely",
    );
    if (embedded === undefined) sources[ref] = text;
    pending.push(...directReferences(text));
  }
  return sources;
}
/** Library roots the reviewed seals verify, besides the build's references. */
export { PNEUMATIC_PLAY_LIBRARY_ROOTS };

export type PreparedPneumaticPlay = {
  candidate: PneumaticPlayCandidate;
  /** Private, deeply frozen copy the seals refer to. */
  project: Project;
  topology: SourcePneumaticTopology;
  pumps: Array<{ token: PreparedPneumaticPump; portId: string }>;
  cylinders: Array<{ token: PreparedPneumaticCylinder; id: string }>;
  valves: Array<{
    id: string;
    cylinderId?: string;
    /** Kernel state that pushes the routed rod out (or pulls it in). */
    out?: "extend" | "retract";
  }>;
};

/**
 * Binds the candidate to its reviewed sources: every closure hash, the
 * complete seated routing, the exact pump and cylinder surfaces, and one
 * opposing valve route per cylinder reached from a pump outlet. Throws an
 * explanation (the circuit then stays still) on any mismatch.
 */
export async function preparePneumaticPlay(
  source: Project,
  candidate: PneumaticPlayCandidate,
  read: (name: string) => string | undefined,
): Promise<PreparedPneumaticPlay> {
  const project = frozenSourceSnapshot(source);
  const referenced = new Set(
    Object.values(project.models).flatMap((m) =>
      directReferences(m.records.map((r) => r.raw).join("\n")),
    ),
  );
  const profiled = [
    "165.dat",
    "166.dat",
    PUMP,
    VALVE,
    BODY,
    "99021.dat",
    "4697b.dat",
  ].filter(
    (ref) =>
      ref === "165.dat" ||
      ref === "166.dat" ||
      !!project.models[canonical(ref)] ||
      referenced.has(ref),
  );
  const sources = pneumaticLibrarySources(
    project,
    [...PNEUMATIC_PLAY_LIBRARY_ROOTS, ...profiled, ROD],
    read,
  );
  const binding = await bindPneumaticSources(project, sources, profiled);
  const topology = sourcePneumaticTopology(project, binding);
  const pumpIds = candidate.pumps.map((p) => p.owners[0]).sort(),
    bodyIds = candidate.cylinders.map((c) => c.body).sort();
  ensure(
    JSON.stringify(topology.pumps.map((p) => p.id).sort()) ===
      JSON.stringify(pumpIds) &&
      JSON.stringify(topology.cylinders.map((c) => c.id).sort()) ===
        JSON.stringify(bodyIds),
    "INVALID_INPUT",
    "The air circuit's routing does not match its pumps and cylinders",
  );
  const connected = (start: string) => {
    const found = new Set([start]);
    for (let previous = -1; previous !== found.size; ) {
      previous = found.size;
      for (const [a, b] of topology.passages)
        if (found.has(a) || found.has(b)) {
          found.add(a);
          found.add(b);
        }
    }
    return found;
  };
  const outlets = topology.pumps.map((p) => p.outlet);
  const valves: PreparedPneumaticPlay["valves"] = topology.valves.map((v) => {
    const a = connected(v.workA),
      b = connected(v.workB),
      routed = topology.cylinders.filter(
        (c) =>
          (a.has(c.base) && b.has(c.cap)) || (a.has(c.cap) && b.has(c.base)),
      );
    ensure(
      routed.length <= 1,
      "INVALID_INPUT",
      "A valve drives more than one cylinder; Play only moves one cylinder per valve",
    );
    const supplied = outlets.some((o) => connected(v.supply).has(o));
    ensure(
      !routed.length || supplied,
      "INVALID_INPUT",
      "A valve's cylinder has no pump feeding the valve",
    );
    return routed.length
      ? {
          id: v.id,
          cylinderId: routed[0].id,
          out: a.has(routed[0].base) ? "extend" : "retract",
        }
      : { id: v.id };
  });
  for (const c of topology.cylinders)
    ensure(
      valves.filter((v) => v.cylinderId === c.id).length === 1,
      "INVALID_INPUT",
      "Each cylinder needs exactly one valve with opposite hoses to its two ports",
    );
  const surfaces = new Map<string, Promise<PneumaticCylinderSurface>>();
  const surface = (ref: string) => {
    if (!surfaces.has(ref))
      surfaces.set(
        ref,
        compileReviewedPneumaticSurface(project, sources, ref).catch(
          (e: unknown) => {
            throw e instanceof AppError
              ? e
              : new AppError(
                  "INVALID_INPUT",
                  "A pneumatic part could not be compiled for checking",
                );
          },
        ),
      );
    return surfaces.get(ref)!;
  };
  const pumpSurfaces = await Promise.all(
    PNEUMATIC_PUMP_REFS.map((ref) => surface(ref)),
  );
  const pumps = await Promise.all(
    candidate.pumps.map(async (p) => {
      const token = await prepareSourcePneumaticPump(project, sources, {
        occurrenceIds: p.owners,
        surfaces: pumpSurfaces as [
          PneumaticCylinderSurface,
          PneumaticCylinderSurface,
          PneumaticCylinderSurface,
          PneumaticCylinderSurface,
        ],
      });
      return {
        token,
        portId: topology.pumps.find((t) => t.id === p.owners[0])!.outlet,
      };
    }),
  );
  const [bodySurface, rodSurface] = await Promise.all([
    surface(BODY),
    surface(ROD),
  ]);
  const cylinders = await Promise.all(
    candidate.cylinders.map(async (c) => ({
      id: c.body,
      token: await prepareSourcePneumaticCylinder(project, sources, {
        bodyOccurrenceId: c.body,
        rodOccurrenceId: c.rod,
        body: bodySurface,
        rod: rodSurface,
      }),
    })),
  );
  return { candidate, project, topology, pumps, cylinders, valves };
}
