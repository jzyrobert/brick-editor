import doorTable from "./door-parts.json";
import installedBounds from "../catalog/bounds.json";
import { add, inverse, mv, physical } from "../core/math";
import { projectBounds, transformBounds, type Bounds } from "../core/spatial";
import type { Occurrence, Project, Vec3 } from "../core/types";
import type { MotionRig, RigidGroup } from "../mechanisms/types";
import type { DoorHinge } from "./door-derive";
import { hingeData } from "../catalog/connectors";

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
  },
): DerivedDoors {
  const skipped: AutoDoorSkip[] = [];
  const present = options.all.filter(
    (o) =>
      (!options.included || options.included.has(o.id)) &&
      o.node.kind === "part",
  );
  const doors = present.filter(
    (o) => o.namespace === "official" && doorHinge(o.node.ref),
  );
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
    const hinge = doorHinge(door.node.ref)!,
      part = partKey(door.node.ref);
    if (options.reserved.has(door.id)) {
      skipped.push({
        occurrenceId: door.id,
        part,
        reason: "Already part of an authored mechanism",
      });
      continue;
    }
    if (!physical(door.transform)) {
      skipped.push({
        occurrenceId: door.id,
        part,
        reason: "Scaled, mirrored or sheared doors cannot hinge",
      });
      continue;
    }
    const pivot = add(
      door.transform.position,
      mv(door.transform.basis, hinge.pivot),
    );
    const axis = unit(mv(door.transform.basis, hinge.axis)),
      leaf = unit(mv(door.transform.basis, hinge.leaf));
    // The holder is the nearest other part whose box reaches the hinge line.
    // A frame whose verified hinge sockets hold this door's pins wins.
    const pins = hinge.pins?.map((p) =>
      add(door.transform.position, mv(door.transform.basis, p)),
    );
    const seated = (holder: Occurrence) =>
      !!pins &&
      (hingeData(partKey(holder.node.ref) + ".dat")?.sockets ?? []).some(
        (socket) =>
          [socket.top, socket.bottom].every((s) => {
            const w = add(
              holder.transform.position,
              mv(holder.transform.basis, s),
            );
            return pins.some(
              (p) => Math.hypot(...p.map((v, k) => v - w[k])) <= 1.5,
            );
          }),
      );
    // A seated holder's box contains its sockets, each within 1.5 LDU of a
    // pin, so no holder farther than this from the pivot can win.
    const reach = Math.max(
      DOOR_ANCHOR_REACH,
      ...(pins ?? []).map(
        (p) => Math.hypot(...p.map((v, k) => v - pivot[k])) + 1.5,
      ),
    );
    let best: { id: string; d: number } | undefined;
    for (const holder of nearby(pivot, reach)) {
      const b = box(holder);
      if (!b || !physical(holder.transform)) continue;
      const d = seated(holder) ? -1 : distanceToBox(pivot, b);
      if (d > DOOR_ANCHOR_REACH) continue;
      if (!best || d < best.d || (d === best.d && holder.id < best.id))
        best = { id: holder.id, d };
    }
    if (!best) {
      skipped.push({
        occurrenceId: door.id,
        part,
        reason: `No frame or holding part within ${DOOR_ANCHOR_REACH} LDU of the hinge`,
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
    frame: structuredClone(o.transform),
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
          part: partKey(e.door.node.ref),
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
    const inv = inverse(anchor.transform);
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
        const doorInv = inverse(e.door.transform);
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
        part: partKey(e.door.node.ref),
        anchorOccurrenceId: anchorId,
        pivot: e.pivot,
        axis: e.axis,
        leaf: e.leaf,
      }),
    );
  }
  return { rigs, doors: derived, skipped };
}
