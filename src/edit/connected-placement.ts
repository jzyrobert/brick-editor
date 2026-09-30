// "Snap together" building (docs/CONNECTORS.md, Connected building): a
// placement or move is accepted only when the part really holds somewhere.
// A tool setting of the editor UI; commands and the document are unaffected.
//
// A part holds when, in this order:
//   1. it pushes through no other body (the clash test of snap.ts; a hinged
//      leaf's own frame is exempt, its sockets hold the pins);
//   2. one of its verified connectors mates with a verified connector of a
//      scene part: stud in anti-stud (upright, side or jumper studs) or hinge
//      pin in socket;
//   3. its lowest point lies on the ground (LDraw y = 0) — the table the
//      build stands on. A baseplate on the ground holds this way, and parts on
//      the baseplate hold through its studs (2);
//   4. only where connector data is missing on either side (an unverified
//      part, or a verified part on an unverified one): its underside rests on
//      the top of that part's box, overlapping it. Reported as an unchecked
//      connection, never as a verified one.
// Anything else floats and is refused. Two verified parts that merely touch
// (a brick half a stud off, a tile on a tile) do not hold.
import { verifiedConnectors } from "../catalog/connectors";
import { isMale, mateKind } from "../catalog/connector-pack";
import { partSpec } from "../catalog/extended";
import installedBounds from "../catalog/bounds.json";
import { occurrences } from "../core/document";
import { add, mv, physical } from "../core/math";
import { projectBounds, transformBounds, type Bounds } from "../core/spatial";
import type { Occurrence, Project, Transform, Vec3 } from "../core/types";
import { clashes, sceneConnectors, type SceneConnectors } from "./snap";

/** World LDraw height of the ground (LDraw −Y is up). */
export const GROUND_Y = 0;
/** Gap ignored when testing ground and resting contact, in LDU. */
export const CONTACT_TOLERANCE = 0.5;
const STUD = 4; // a stud row rises 4 LDU above a body top
const OVERLAP = 0.5; // least footprint overlap for resting contact

export type Holder = "studs" | "hinge" | "ground" | "resting" | "unchecked";
export type ConnectionCheck = {
  ok: boolean;
  /** How the part holds; null when it does not. */
  via: Holder | null;
  /** True when the hold is by verified connectors or the ground. */
  verified: boolean;
  reason: "clash" | "floating" | null;
  /** Mating connectors (studs, anti-studs, pins, sockets). */
  contacts: number;
  /** Scene parts it connects to or rests on. */
  targetIds: string[];
  /** Short, child-friendly explanation for the placement card. */
  message: string;
};
type SceneBox = { occurrenceId: string; box: Bounds; covered: boolean };
/** Scene connectors plus every scene part's world box and coverage (derived
 * on first use: most checks hold by connectors or the ground first). */
export type PlacementScene = SceneConnectors & { boxes: () => SceneBox[] };

const officialBounds = installedBounds.bounds as unknown as Record<
  string,
  Bounds | null
>;
const specBounds = (ref: string): Bounds | null => {
  const b = partSpec(ref)?.bounds;
  if (b) return { min: [...b.min] as Vec3, max: [...b.max] as Vec3 };
  return Object.hasOwn(officialBounds, ref) ? officialBounds[ref] : null;
};
const covered = (o: Occurrence) =>
  o.namespace === "official" &&
  o.node.kind === "part" &&
  physical(o.transform) &&
  !!verifiedConnectors(o.node.ref);

/** Local boxes of occurrences' nodes (null when unknown), sharing one
 * bounds context and one record index per model. */
function boxReader(project: Project) {
  let sources: ReturnType<typeof projectBounds> | null | undefined;
  const records = new Map<string, Map<string, string>>();
  return (o: Occurrence): Bounds | null => {
    if (o.namespace === "official" && o.node.kind === "part")
      return specBounds(o.node.ref);
    if (sources === undefined)
      try {
        sources = projectBounds(
          project,
          officialBounds,
          installedBounds.dependencies.transitive,
        );
      } catch {
        sources = null;
      }
    if (!sources) return null;
    try {
      if (o.node.kind === "geometry") {
        let index = records.get(o.modelId);
        if (!index) {
          index = new Map(
            (project.models[o.modelId]?.records ?? []).map((r) => [
              r.id,
              r.raw,
            ]),
          );
          records.set(o.modelId, index);
        }
        const raw = index.get(o.node.sourceRecordId ?? "");
        return raw ? sources.primitive(raw) : null;
      }
      return sources.model(o.node.ref);
    } catch {
      return null;
    }
  };
}

/** Placement scene of the given occurrences (by default the visible ones). */
export function placementScene(
  project: Project,
  all: Occurrence[] = occurrences(project),
  include: (o: Occurrence) => boolean = (o) => o.visible,
): PlacementScene {
  const scene = sceneConnectors(project, all, include);
  let boxes: SceneBox[] | undefined;
  return {
    ...scene,
    boxes: () => {
      if (boxes) return boxes;
      const read = boxReader(project);
      boxes = [];
      for (const o of all) {
        if (!include(o)) continue;
        const local = read(o);
        if (local)
          boxes.push({
            occurrenceId: o.id,
            box: transformBounds(local, o.transform),
            covered: covered(o),
          });
      }
      return boxes;
    },
  };
}

const MESSAGES = {
  floating: "Nothing to connect to here — move it onto studs or the ground.",
  clash: "Another part is in the way here — try a different spot.",
};
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
const refused = (reason: "clash" | "floating"): ConnectionCheck => ({
  ok: false,
  via: null,
  verified: false,
  reason,
  contacts: 0,
  targetIds: [],
  message: MESSAGES[reason],
});

/** What is placed: an official part `ref`, or any node with a known local box. */
export type Placed = { ref?: string; box?: Bounds | null };

/**
 * Whether a part placed at `transform` holds (see the rules above).
 */
export function checkConnection(
  placed: Placed | string,
  transform: Transform,
  scene: PlacementScene,
): ConnectionCheck {
  const item = typeof placed === "string" ? { ref: placed } : placed;
  const ref = item.ref;
  const local = ref && physical(transform) ? verifiedConnectors(ref) : null;
  // Mating connectors, and which targets hold hinge pins (exempt from clash).
  let contacts = 0,
    hinge = false;
  const targets = new Set<string>(),
    frames = new Set<string>();
  for (const c of local ?? []) {
    const w = {
      kind: c.kind,
      p: add(transform.position, mv(transform.basis, c.p)),
      axis: mv(transform.basis, c.axis),
    };
    const found = (isMale(c.kind) ? scene.receptors : scene.studs).mates(
      w,
      mateKind(c.kind),
    );
    if (!found.length) continue;
    contacts++;
    const pin = c.kind === "pin" || c.kind === "socket";
    if (pin) hinge = true;
    for (const f of found) {
      targets.add(f.occurrenceId);
      if (pin) frames.add(f.occurrenceId);
    }
  }
  if (
    ref &&
    scene.occupants &&
    clashes(
      ref,
      transform,
      scene.occupants.filter((o) => !frames.has(o.occurrenceId)),
    )
  )
    return refused("clash");
  if (contacts)
    return {
      ok: true,
      via: hinge ? "hinge" : "studs",
      verified: true,
      reason: null,
      contacts,
      targetIds: [...targets],
      message: hinge
        ? `Clicks into the hinges: ${plural(contacts, "pin")}.`
        : `Connects with ${plural(contacts, "stud")}.`,
    };
  const lb = item.box !== undefined ? item.box : ref ? specBounds(ref) : null;
  if (!lb)
    return {
      ok: true,
      via: "unchecked",
      verified: false,
      reason: null,
      contacts: 0,
      targetIds: [],
      message: "This part’s shape is unknown, so its connection isn’t checked.",
    };
  const box = transformBounds(lb, transform);
  // LDraw +Y is down: the lowest point is the box's max y.
  const bottom = box.max[1];
  if (Math.abs(bottom - GROUND_Y) <= CONTACT_TOLERANCE)
    return {
      ok: true,
      via: "ground",
      verified: true,
      reason: null,
      contacts: 0,
      targetIds: [],
      message: "Sits on the ground.",
    };
  const self = !!local;
  const resting = scene
    .boxes()
    .filter(
      (b) =>
        (!self || !b.covered) &&
        bottom >= b.box.min[1] - CONTACT_TOLERANCE &&
        bottom <= b.box.min[1] + STUD + CONTACT_TOLERANCE &&
        [0, 2].every(
          (i) =>
            Math.min(box.max[i], b.box.max[i]) -
              Math.max(box.min[i], b.box.min[i]) >
            OVERLAP,
        ),
    );
  if (resting.length)
    return {
      ok: true,
      via: "resting",
      verified: false,
      reason: null,
      contacts: 0,
      targetIds: resting.map((b) => b.occurrenceId),
      message: "Rests on a part (this connection isn’t checked).",
    };
  return refused("floating");
}

/**
 * Whether a group of occurrences, each at the given transform, holds on the
 * rest of the scene: none clashes with a part outside the group and at least
 * one holds on a part outside it (or on the ground). Parts inside the group
 * may hold only on each other.
 */
export function checkGroup(
  project: Project,
  transforms: Record<string, Transform>,
  all: Occurrence[] = occurrences(project),
): ConnectionCheck {
  const moved = all.filter((o) => Object.hasOwn(transforms, o.id));
  if (!moved.length) return refused("floating");
  const scene = placementScene(
    project,
    all,
    (o) => o.visible && !Object.hasOwn(transforms, o.id),
  );
  const read = boxReader(project);
  let best: ConnectionCheck | null = null;
  for (const o of moved) {
    const official = o.namespace === "official" && o.node.kind === "part";
    const check = checkConnection(
      official ? { ref: o.node.ref } : { box: read(o) },
      transforms[o.id],
      scene,
    );
    if (check.reason === "clash") return check;
    if (!check.ok) continue;
    if (!best || (check.verified && !best.verified)) best = check;
  }
  return best ?? refused("floating");
}

/**
 * The move rule: a move is refused only when it breaks a hold, that is when
 * the group held where it was and would not hold where it goes. Parts that
 * already floated (an imported model off the ground, say) move freely.
 */
export function checkMove(
  project: Project,
  transforms: Record<string, Transform>,
): ConnectionCheck & { before: boolean } {
  const all = occurrences(project);
  const after = checkGroup(project, transforms, all);
  if (after.ok) return { ...after, before: true };
  const current = Object.fromEntries(
    all
      .filter((o) => Object.hasOwn(transforms, o.id))
      .map((o) => [o.id, o.transform]),
  );
  const before = checkGroup(project, current, all);
  return before.ok
    ? { ...after, before: true }
    : {
        ...after,
        ok: true,
        before: false,
        message: "It wasn’t connected before, so it moves freely.",
      };
}
