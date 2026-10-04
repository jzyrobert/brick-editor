import doorTable from "./door-parts.json";
import installedBounds from "../catalog/bounds.json";
import {
  add,
  determinant,
  inverse,
  mv,
  nearlyPhysical,
  orthonormalized,
} from "../core/math";
import { projectBounds, transformBounds, type Bounds } from "../core/spatial";
import type { Occurrence, Project, Vec3 } from "../core/types";
import type { MotionRig, RigidGroup } from "../mechanisms/types";
import type { DoorHinge } from "./door-derive";
import { hingeData } from "../catalog/connectors";
import { fullConnectorEntry } from "../catalog/full-connectors";

/**
 * Derived, session-only door rigs (spec 19.4 authored door hinges, applied
 * automatically to official LDraw door leaves). They are never written to the
 * project; Play builds them from the pinned hinge table each time it starts.
 */
export const AUTO_DOOR_PREFIX = "auto-door:";
export const isAutoDoorRig = (rigId: string) =>
  rigId.startsWith(AUTO_DOOR_PREFIX);
/** Maximum distance from the hinge line to the part that holds the door. */
export const DOOR_ANCHOR_REACH = 16;

const table = doorTable as unknown as {
  hinges: Record<string, DoorHinge>;
  excluded: Record<string, { title: string; reason: string }>;
  aliases: Record<string, string>;
};
const partKey = (ref: string) =>
  ref
    .toLowerCase()
    .replaceAll("\\", "/")
    .replace(/^.*\//, "")
    .replace(/\.dat$/, "");
/** Hinge data for an official part reference, following official aliases. */
export function doorHinge(ref: string): DoorHinge | undefined {
  const key = partKey(ref);
  const derived = table.hinges[key] ?? table.hinges[table.aliases[key] ?? ""];
  // The verified connector pack (docs/CONNECTORS.md) is authoritative for
  // catalogue leaves: Play swings about the same pins the editor seats.
  const pack = hingeData(key + ".dat")?.hinge;
  if (!pack) return derived;
  let leaf = derived?.leaf,
    width = derived?.width,
    height = derived?.height;
  if (!leaf || width === undefined || height === undefined) {
    // Window panes and other pack-only leaves: from their source bounds.
    const b = (
      installedBounds.bounds as unknown as Record<string, Bounds | null>
    )[key + ".dat"];
    if (!b) return derived;
    const center = b.min.map((v, k) => (v + b.max[k]) / 2) as Vec3;
    const along = center.map((v, k) => v - pack.pivot[k]) as Vec3;
    const dot = along.reduce((sum, v, k) => sum + v * pack.axis[k], 0);
    const dir = unit(along.map((v, k) => v - dot * pack.axis[k]) as Vec3);
    leaf = dir;
    width = Math.max(
      ...[0, 1, 2].map((k) =>
        Math.abs((dir[k] > 0 ? b.max[k] : b.min[k]) - pack.pivot[k]),
      ),
    );
    height = Math.hypot(...pack.pins[0].map((v, k) => v - pack.pins[1][k]));
  }
  return {
    part: derived?.part ?? key,
    title: derived?.title ?? key,
    rule: "connector-pins",
    pivot: [...pack.pivot] as Vec3,
    axis: [...pack.axis] as Vec3,
    leaf,
    width,
    height,
    maxOpenDegrees: 90,
    pins: [pack.pins[0], pack.pins[1]],
  };
}
/**
 * The official part an occurrence is a hinged leaf of: the part itself, or
 * for an LDraw OMR model's embedded copy ("21318 - 60623.dat", a custom part
 * in the project), the official part it copies once that is in the table.
 */
export function doorPart(project: Project, o: Occurrence) {
  if (o.node.kind !== "part") return undefined;
  if (o.namespace === "official")
    return doorHinge(o.node.ref) ? o.node.ref : undefined;
  if (
    o.namespace !== "project" ||
    project.models[o.node.ref]?.classification !== "custom"
  )
    return undefined;
  const copy = /^\S+ - (.+)$/.exec(partKey(o.node.ref))?.[1];
  return copy && doorHinge(copy) ? copy : undefined;
}
export function doorExclusion(ref: string) {
  return table.excluded[partKey(ref)];
}
export type AutoDoor = {
  rigId: string;
  jointId: string;
  occurrenceId: string;
  part: string;
  anchorOccurrenceId: string;
  /** World LDU, negative Y up. */
  pivot: Vec3;
  axis: Vec3;
  /** World unit direction from hinge to free edge at rest. */
  leaf: Vec3;
};
export type AutoDoorSkip = {
  occurrenceId: string;
  part: string;
  reason: string;
};
export type DerivedDoors = {
  rigs: Record<string, MotionRig>;
  doors: AutoDoor[];
  skipped: AutoDoorSkip[];
};
/** Narrow classic shutter end bearing, reviewed from the pinned source files
 * parts/3582.dat (Willy Tschager): R2 2-4cyli Y[4,44], 2-4disc caps Y4/44;
 * parts/3581.dat (James Jessiman): R4 2-4cyli Y[0,4]/[44,48], centre Z=-12,
 * inner 2-4disc faces Y4/44. Both are CC BY 4.0 in the complete-library pack
 * locked by src/catalog/full-library-lock.json. These are contacting end
 * bearing faces, not an inferred negative bore. The 2 LDU radial clearance
 * bounds the existing 1.5 LDU seating allowance; axial faces must agree within
 * the existing .001 LDU contact guard. Only this official leaf/holder pair
 * uses the adapter; generated connector data and legacy derivation stay intact. */
const CLASSIC_SHUTTER_PINS: [Vec3, Vec3] = [
  [0, 4, 0],
  [0, 44, 0],
];
const CLASSIC_SHUTTER_SOCKET = {
  top: [0, 4, -12] as Vec3,
  bottom: [0, 44, -12] as Vec3,
  depth: 4,
};
/** Hinge sockets of a holder: the verified catalogue pack, else the complete
 * library's derived connector pack when its shard is loaded. */
function socketsOf(holder: Occurrence) {
  const name = partKey(holder.node.ref) + ".dat";
  return hingeData(name)?.sockets ?? fullConnectorEntry(name)?.sockets ?? [];
}
const distanceToBox = (p: Vec3, b: Bounds) =>
  Math.hypot(
    ...[0, 1, 2].map((k) => Math.max(b.min[k] - p[k], 0, p[k] - b.max[k])),
  );
const unit = (v: Vec3) => {
  const l = Math.hypot(...v) || 1;
  return v.map((x) => x / l) as Vec3;
};
/**
 * Find official door leaves in the included world and hinge each to the part
 * holding it (a frame, container or wall part touching the hinge line).
 * Several doors sharing one holder become one rig with one joint each.
 */
export function deriveDoorRigs(
  project: Project,
  options: {
    all: Occurrence[];
    /** Occurrences present in the Play world; undefined means all. */
    included?: ReadonlySet<string>;
    /** Occurrences already owned by authored rigs. */
    reserved: ReadonlySet<string>;
    maxRigs: number;
    maxGroups: number;
    /** Normal Play requires a source pin/socket connection. The default keeps
     * direct engineering fixtures compatible with the older proximity rule. */
    requirePhysicalConnection?: boolean;
  },
): DerivedDoors {
  const skipped: AutoDoorSkip[] = [];
  const present = options.all.filter(
    (o) =>
      (!options.included || options.included.has(o.id)) &&
      o.node.kind === "part",
  );
  const leafPart = new Map<string, string>();
  for (const o of present) {
    const part = doorPart(project, o);
    if (part) leafPart.set(o.id, part);
  }
  const doors = present.filter((o) => leafPart.has(o.id));
  if (!doors.length) return { rigs: {}, doors: [], skipped };
  let sources: ReturnType<typeof projectBounds> | undefined;
  const boxes = new Map<string, Bounds | null>();
  const box = (o: Occurrence) => {
    if (boxes.has(o.id)) return boxes.get(o.id)!;
    let local: Bounds | null = null;
    try {
      sources ??= projectBounds(
        project,
        installedBounds.bounds as unknown as Record<string, Bounds | null>,
        installedBounds.dependencies.transitive,
      );
      local = sources.model(o.node.ref);
    } catch {
      local = null;
    }
    const world = local ? transformBounds(local, o.transform) : null;
    boxes.set(o.id, world);
    return world;
  };
  const doorIds = new Set(doors.map((o) => o.id));
  const holders = present.filter(
    (o) => !doorIds.has(o.id) && !options.reserved.has(o.id),
  );
  // Uniform grid over holder boxes: large worlds have hundreds of doors and
  // tens of thousands of parts, so each door only tests holders near it.
  const CELL = 64;
  const grid = new Map<string, Occurrence[]>();
  const oversize: Occurrence[] = [];
  const cellRange = (min: number[], max: number[]) =>
    [0, 1, 2].map((k) => [
      Math.floor(min[k] / CELL),
      Math.floor(max[k] / CELL),
    ]);
  for (const holder of holders) {
    const b = box(holder);
    if (!b) continue;
    const r = cellRange(b.min, b.max);
    if (r.reduce((n, [lo, hi]) => n * (hi - lo + 1), 1) > 512) {
      oversize.push(holder);
      continue;
    }
    for (let x = r[0][0]; x <= r[0][1]; x++)
      for (let y = r[1][0]; y <= r[1][1]; y++)
        for (let z = r[2][0]; z <= r[2][1]; z++) {
          const key = `${x},${y},${z}`;
          const cell = grid.get(key);
          if (cell) cell.push(holder);
          else grid.set(key, [holder]);
        }
  }
  const nearby = (p: Vec3, radius: number) => {
    const r = cellRange(
      p.map((v) => v - radius),
      p.map((v) => v + radius),
    );
    const found = new Set<Occurrence>(oversize);
    for (let x = r[0][0]; x <= r[0][1]; x++)
      for (let y = r[1][0]; y <= r[1][1]; y++)
        for (let z = r[2][0]; z <= r[2][1]; z++)
          for (const o of grid.get(`${x},${y},${z}`) ?? []) found.add(o);
    return found;
  };
  // Group frames are exact rotations; members keep their authored (possibly
  // rounded) transforms as their rest pose.
  const frames = new Map<string, Occurrence["transform"]>();
  const frameOf = (o: Occurrence) => {
    let f = frames.get(o.id);
    if (!f) frames.set(o.id, (f = orthonormalized(o.transform)));
    return f;
  };
  const byAnchor = new Map<
    string,
    Array<{
      door: Occurrence;
      hinge: DoorHinge;
      pivot: Vec3;
      axis: Vec3;
      leaf: Vec3;
    }>
  >();
  for (const door of [...doors].sort((a, b) => (a.id < b.id ? -1 : 1))) {
    const sourceHinge = doorHinge(leafPart.get(door.id)!)!,
      part = partKey(leafPart.get(door.id)!),
      classic =
        options.requirePhysicalConnection && sourceHinge.part === "3582",
      hinge = classic
        ? { ...sourceHinge, pins: CLASSIC_SHUTTER_PINS }
        : sourceHinge;
    if (options.reserved.has(door.id)) {
      skipped.push({
        occurrenceId: door.id,
        part,
        reason: "Already part of an authored mechanism",
      });
      continue;
    }
    // Official models round their matrices (0.707, 0.661/0.75): accept a
    // rotation within that rounding; a mirror or scale cannot hinge.
    if (!nearlyPhysical(door.transform)) {
      skipped.push({
        occurrenceId: door.id,
        part,
        reason:
          determinant(door.transform.basis) < 0
            ? "Mirrored doors cannot hinge"
            : "Scaled or sheared doors cannot hinge",
      });
      continue;
    }
    if (
      options.requirePhysicalConnection &&
      (door.namespace !== "official" || !hinge.pins || hinge.pins.length !== 2)
    ) {
      skipped.push({
        occurrenceId: door.id,
        part,
        reason:
          door.namespace !== "official"
            ? "Embedded door geometry is not verified against the official source"
            : "This source leaf has no reviewed hinge pins",
      });
      continue;
    }
    const frame = frameOf(door);
    const pivot = add(frame.position, mv(frame.basis, hinge.pivot));
    const axis = unit(mv(frame.basis, hinge.axis)),
      leaf = unit(mv(frame.basis, hinge.leaf));
    // The holder is the nearest other part whose box reaches the hinge line.
    // A frame whose verified hinge sockets hold this door's pins wins.
    const pins = hinge.pins?.map((p) =>
      add(door.transform.position, mv(door.transform.basis, p)),
    );
    const seated = (holder: Occurrence) => {
      if (
        !pins ||
        (options.requirePhysicalConnection && holder.namespace !== "official")
      )
        return false;
      const sockets = classic
        ? partKey(holder.node.ref) === "3581"
          ? [CLASSIC_SHUTTER_SOCKET]
          : []
        : socketsOf(holder);
      return sockets.some((socket) => {
        const ends = [socket.top, socket.bottom].map((s) =>
          add(holder.transform.position, mv(holder.transform.basis, s)),
        );
        const matches = (a: Vec3, b: Vec3) => {
          const delta = a.map((v, k) => v - b[k]) as Vec3;
          if (
            classic &&
            Math.abs(delta.reduce((sum, v, k) => sum + v * axis[k], 0)) > 0.001
          )
            return false;
          return Math.hypot(...delta) <= 1.5;
        };
        return options.requirePhysicalConnection
          ? pins.length === 2 &&
              ((matches(ends[0], pins[0]) && matches(ends[1], pins[1])) ||
                (matches(ends[0], pins[1]) && matches(ends[1], pins[0])))
          : ends.every((w) => pins.some((p) => matches(p, w)));
      });
    };
    // A seated holder's box contains its sockets, each within 1.5 LDU of a
    // pin, so no holder farther than this from the pivot can win.
    const reach = Math.max(
      DOOR_ANCHOR_REACH,
      ...(pins ?? []).map(
        (p) => Math.hypot(...p.map((v, k) => v - pivot[k])) + 1.5,
      ),
    );
    let best: { id: string; d: number } | undefined;
    let seatedHolders = 0;
    for (const holder of nearby(pivot, reach)) {
      const b = box(holder);
      if (!b || !nearlyPhysical(holder.transform)) continue;
      const matched = seated(holder);
      if (options.requirePhysicalConnection && !matched) continue;
      if (matched) seatedHolders++;
      const d = matched ? -1 : distanceToBox(pivot, b);
      if (d > DOOR_ANCHOR_REACH) continue;
      if (!best || d < best.d || (d === best.d && holder.id < best.id))
        best = { id: holder.id, d };
    }
    if (options.requirePhysicalConnection && seatedHolders > 1) {
      skipped.push({
        occurrenceId: door.id,
        part,
        reason: "More than one source holder seats these hinge pins",
      });
      continue;
    }
    if (!best) {
      skipped.push({
        occurrenceId: door.id,
        part,
        reason: options.requirePhysicalConnection
          ? "No official holder sockets seat both source hinge pins"
          : `No frame or holding part within ${DOOR_ANCHOR_REACH} LDU of the hinge`,
      });
      continue;
    }
    const list = byAnchor.get(best.id) ?? [];
    list.push({ door, hinge, pivot, axis, leaf });
    byAnchor.set(best.id, list);
  }
  const rigs: Record<string, MotionRig> = {},
    derived: AutoDoor[] = [];
  const byId = new Map(present.map((o) => [o.id, o]));
  const group = (id: string, o: Occurrence): RigidGroup => ({
    id,
    occurrenceIds: [o.id],
    frame: structuredClone(frameOf(o)),
    restTransforms: { [o.id]: structuredClone(o.transform) },
  });
  let index = 0,
    groups = 0;
  for (const anchorId of [...byAnchor.keys()].sort()) {
    const entries = byAnchor.get(anchorId)!;
    const anchor = byId.get(anchorId)!;
    if (
      index >= options.maxRigs ||
      groups + entries.length + 1 > options.maxGroups
    ) {
      for (const e of entries)
        skipped.push({
          occurrenceId: e.door.id,
          part: partKey(leafPart.get(e.door.id)!),
          reason: "Play's moving-part budget is full",
        });
      continue;
    }
    while (
      Object.hasOwn(project.motionRigs ?? {}, `${AUTO_DOOR_PREFIX}${index}`)
    )
      index++;
    const rigId = `${AUTO_DOOR_PREFIX}${index++}`;
    groups += entries.length + 1;
    const inv = inverse(frameOf(anchor));
    const rig: MotionRig = {
      schemaVersion: 1,
      id: rigId,
      name: entries.length > 1 ? "Doors" : "Door",
      mode: "kinematic",
      groups: [
        group("holder", anchor),
        ...entries.map((e, i) => group(`leaf-${i + 1}`, e.door)),
      ],
      joints: entries.map((e, i) => {
        const doorInv = inverse(frameOf(e.door));
        return {
          id: entries.length > 1 ? `door-${i + 1}` : "door",
          kind: "revolute" as const,
          bodyA: "holder",
          bodyB: `leaf-${i + 1}`,
          anchorA: add(inv.position, mv(inv.basis, e.pivot)),
          anchorB: add(doorInv.position, mv(doorInv.basis, e.pivot)),
          axisA: unit(mv(inv.basis, e.axis)),
          axisB: unit(mv(doorInv.basis, e.axis)),
          limits: [-e.hinge.maxOpenDegrees, e.hinge.maxOpenDegrees] as [
            number,
            number,
          ],
        };
      }),
    };
    rigs[rigId] = rig;
    entries.forEach((e, i) =>
      derived.push({
        rigId,
        jointId: rig.joints[i].id,
        occurrenceId: e.door.id,
        part: partKey(leafPart.get(e.door.id)!),
        anchorOccurrenceId: anchorId,
        pivot: e.pivot,
        axis: e.axis,
        leaf: e.leaf,
      }),
    );
  }
  return { rigs, doors: derived, skipped };
}
