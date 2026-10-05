import { directReferences } from "../catalog/full-pack";
import { mv, orthonormalized } from "../core/math";
import type { Bounds } from "../core/spatial";
import type { Occurrence, Project, Transform, Vec3 } from "../core/types";
import type { DerivedVehicles } from "./auto-vehicles";
import {
  reviewedStickerBacking,
  sourceBackingCoverage,
  sourceBackingSeated,
} from "./source-adhesive";
import {
  sourceFlexibleHoseWitness,
  type FlexibleHoseSourceBinding,
} from "./source-flexible-hose";
import {
  sourceSupportPatch,
  type SourceTriangle,
} from "./source-support-contacts";
import type {
  RideAlongKind,
  SourceVehicleArticulation,
} from "./source-vehicle-articulation";
import type { CollisionSnapshot } from "./types";

/**
 * Parts that are NOT attached in the source but ride with a one-body source
 * vehicle (owner decision, 5 October 2026), each on its own evidence:
 *
 * - resting cover: a rigid group of official parts resting on the chassis
 *   through real coplanar support faces (no clutch). Moves with the chassis
 *   and keeps its collision, as part of the one chassis body;
 * - steering wheel: a pulley on the steering column's own line; drawn turning
 *   with the column;
 * - stickers: a reviewed backing fully supported by chassis faces; drawn only;
 * - flexible hoses: both reviewed end caps seated on chassis studs; the ends
 *   do not move relative to each other, so the hose is drawn riding along.
 *
 * Anything else stays where it was built, with a plain reason. Nothing here
 * adds a physics body, joint or contact exemption.
 */
export const RIDE_ALONG_LIMITS = Object.freeze({
  candidates: 128,
  supportPairs: 4_000_000,
  hostTriangles: 20_000,
});
export type RideAlongResult = {
  rigId: string;
  admitted: Array<{ kind: RideAlongKind; occurrenceIds: string[] }>;
  staying: Array<{ occurrenceIds: string[]; reason: string }>;
};

const triangles = (mesh: CollisionSnapshot): SourceTriangle[] => {
  const out: SourceTriangle[] = [],
    v = mesh.vertices,
    at = (i: number): Vec3 => [v[i * 3], v[i * 3 + 1], v[i * 3 + 2]];
  for (let i = 0; i < mesh.indices.length; i += 3)
    out.push([
      at(mesh.indices[i]),
      at(mesh.indices[i + 1]),
      at(mesh.indices[i + 2]),
    ]);
  return out;
};
const overlaps = (a: Bounds, b: Bounds, pad: number) =>
  [0, 1, 2].every(
    (k) => a.min[k] <= b.max[k] + pad && b.min[k] <= a.max[k] + pad,
  );
const flat = (t: SourceTriangle) =>
  Math.abs(t[0][1] - t[1][1]) <= 0.05 && Math.abs(t[0][1] - t[2][1]) <= 0.05;

/** Admit ride-along parts into derived one-body vehicles (mutates `derived`). */
export async function admitSourceRideAlong(input: {
  project: Project;
  derived: DerivedVehicles;
  all: readonly Occurrence[];
  bounds: (o: Occurrence) => Bounds | null;
  /** Compiled world triangles of the given occurrences (renderer capture). */
  surfaces: (ids: string[]) => Promise<Record<string, CollisionSnapshot>>;
  /** Verified flexible-hose source closures, when they could be loaded. */
  hoseBinding?: () => Promise<FlexibleHoseSourceBinding | undefined>;
}): Promise<RideAlongResult[]> {
  const { project, derived, all, bounds } = input;
  const lookup = new Map(all.map((o) => [o.id, o]));
  const review = derived.sourceAssemblies;
  const results: RideAlongResult[] = [];
  if (!review) return results;
  const unattached = new Set(review.unattachedOccurrenceIds);
  const islands = review.fixedIslands.filter((island) =>
    island.every((id) => unattached.has(id)),
  );
  const claimed = new Set(derived.vehicles.flatMap((v) => v.occurrenceIds));
  let binding: FlexibleHoseSourceBinding | undefined | null = null;
  for (const vehicle of derived.vehicles) {
    const a = vehicle.articulation;
    if (!a) continue;
    const rig = derived.rigs[vehicle.rigId],
      chassis = rig.groups.find((g) => g.id === a.chassisGroup)!,
      moving = new Set([
        ...a.knuckles.flatMap((k) => k.occurrenceIds),
        ...(a.linkage?.occurrenceIds ?? []),
        ...(a.column?.occurrenceIds ?? []),
      ]),
      still = chassis.occurrenceIds.filter((id) => !moving.has(id)),
      result: RideAlongResult = {
        rigId: vehicle.rigId,
        admitted: [],
        staying: [],
      };
    results.push(result);
    const box = (ids: readonly string[]): Bounds | null => {
      const boxes = ids
        .map((id) => bounds(lookup.get(id)!))
        .filter((b): b is Bounds => !!b);
      if (boxes.length !== ids.length) return null;
      return {
        min: [0, 1, 2].map((k) =>
          Math.min(...boxes.map((b) => b.min[k])),
        ) as Vec3,
        max: [0, 1, 2].map((k) =>
          Math.max(...boxes.map((b) => b.max[k])),
        ) as Vec3,
      };
    };
    // Project-defined parts (stickers, hoses) may have no library bounds:
    // their placement point still locates them.
    const pointBox = (ids: readonly string[]): Bounds => {
      const points = ids.map((id) => lookup.get(id)!.transform.position);
      return {
        min: [0, 1, 2].map((k) => Math.min(...points.map((p) => p[k]))) as Vec3,
        max: [0, 1, 2].map((k) => Math.max(...points.map((p) => p[k]))) as Vec3,
      };
    };
    const vehicleBox = box(chassis.occurrenceIds);
    if (!vehicleBox) continue;
    const candidates = islands.filter((island) => {
      const b = box(island) ?? pointBox(island);
      return (
        b &&
        overlaps(b, vehicleBox, 1) &&
        island.every((id) => !claimed.has(id))
      );
    });
    if (candidates.length > RIDE_ALONG_LIMITS.candidates) {
      result.staying.push({
        occurrenceIds: candidates.flat(),
        reason: "Too many loose parts near this car to check",
      });
      continue;
    }
    const stillBoxes = still.map((id) => ({
      id,
      b: bounds(lookup.get(id)!),
    }));
    const hostsNear = (b: Bounds, pad: number) =>
      stillBoxes.filter((h) => h.b && overlaps(h.b, b, pad)).map((h) => h.id);
    const meshes = new Map<string, CollisionSnapshot>();
    const surface = async (ids: string[]) => {
      const missing = ids.filter((id) => !meshes.has(id));
      if (missing.length) {
        const got = await input.surfaces(missing);
        for (const id of missing) if (got[id]) meshes.set(id, got[id]);
      }
      return ids.map((id) => meshes.get(id));
    };
    const admit = (
      kind: RideAlongKind,
      ids: string[],
      follows: "chassis" | "column",
      visualOnly: boolean,
    ) => {
      result.admitted.push({ kind, occurrenceIds: ids });
      a.rideAlong.push({ kind, occurrenceIds: ids, follows, visualOnly });
      for (const id of ids) {
        chassis.occurrenceIds.push(id);
        chassis.restTransforms[id] = structuredClone(lookup.get(id)!.transform);
        vehicle.occurrenceIds.push(id);
        claimed.add(id);
        // A resting cover moves rigidly with the chassis: it may carry stickers.
        if (kind === "resting-cover")
          stillBoxes.push({ id, b: bounds(lookup.get(id)!) });
      }
    };
    const backingsOf = new Map(
      await Promise.all(
        candidates.map(
          async (island) =>
            [
              island,
              await Promise.all(
                island.map((id) =>
                  reviewedStickerBacking(project, lookup.get(id)!),
                ),
              ),
            ] as const,
        ),
      ),
    );
    // Stickers last, so a cover they are stuck on is already riding along.
    const ordered = [...candidates].sort(
      (x, y) =>
        Number(backingsOf.get(x)!.every(Boolean)) -
        Number(backingsOf.get(y)!.every(Boolean)),
    );
    for (const island of ordered) {
      const members = island.map((id) => lookup.get(id)!);
      const b = box(island) ?? pointBox(island);
      // Stickers: every member a reviewed backing fully seated on still parts.
      const backings = backingsOf.get(island)!;
      if (backings.every(Boolean)) {
        let ok = true;
        for (const backing of backings) {
          const hosts = hostsNear(
            pointBox([backing!.occurrenceId]),
            Math.hypot(backing!.halfWidth, backing!.halfDepth) + 1,
          );
          const local: SourceTriangle[] = [];
          const frame = orthonormalized(backing!.transform),
            inv = [
              frame.basis[0],
              frame.basis[3],
              frame.basis[6],
              frame.basis[1],
              frame.basis[4],
              frame.basis[7],
              frame.basis[2],
              frame.basis[5],
              frame.basis[8],
            ] as Transform["basis"];
          for (const mesh of await surface(hosts))
            if (mesh)
              for (const t of triangles(mesh)) {
                const q = t.map((p) =>
                  mv(inv, p.map((x, k) => x - frame.position[k]) as Vec3),
                ) as SourceTriangle;
                // Only faces in the backing's own plane, under its footprint.
                if (
                  q.some((p) => Math.abs(p[1]) > 0.05) ||
                  q.every((p) => p[0] < -backing!.halfWidth) ||
                  q.every((p) => p[0] > backing!.halfWidth) ||
                  q.every((p) => p[2] < -backing!.halfDepth) ||
                  q.every((p) => p[2] > backing!.halfDepth)
                )
                  continue;
                if (local.length >= RIDE_ALONG_LIMITS.hostTriangles) break;
                local.push(q);
              }
          const coverage = sourceBackingCoverage(
            backing!.halfWidth,
            backing!.halfDepth,
            local,
          );
          ok &&= sourceBackingSeated(
            backing!.halfWidth,
            backing!.halfDepth,
            coverage,
          );
        }
        if (ok) admit("sticker", island, "chassis", true);
        else
          result.staying.push({
            occurrenceIds: island,
            reason:
              "A sticker stays where it was built: its backing is not fully on the car's bricks",
          });
        continue;
      }
      // Flexible hoses: both reviewed caps seated on still chassis studs.
      if (members.every((o) => o.namespace === "project")) {
        if (binding === null)
          binding = (await input.hoseBinding?.()) ?? undefined;
        let ok = !!binding;
        for (const o of members) {
          const witness = binding
            ? await sourceFlexibleHoseWitness(project, o, all, binding)
            : undefined;
          ok &&=
            !!witness &&
            witness.endpoints.every((e) => still.includes(e.hostOccurrenceId));
        }
        if (ok) admit("flexible-hose", island, "chassis", true);
        else
          result.staying.push({
            occurrenceIds: island,
            reason:
              "A flexible part stays where it was built: both of its ends are not plugged into the car",
          });
        continue;
      }
      if (!members.every((o) => o.namespace === "official")) {
        result.staying.push({
          occurrenceIds: island,
          reason: "This part stays where it was built: Play cannot check it",
        });
        continue;
      }
      // Steering wheel: a pulley on the steering column's own line.
      const column = a.column;
      const wheel = members.find((o) => o.node.ref === "4185a.dat");
      if (wheel && column) {
        const f = orthonormalized(wheel.transform),
          axis = mv(f.basis, [0, 0, 1]),
          d = f.position.map((v, k) => v - column.point[k]) as Vec3,
          along = d.reduce((s, v, k) => s + v * column.axis[k], 0),
          off = Math.hypot(
            ...(d.map((v, k) => v - along * column.axis[k]) as Vec3),
          ),
          parallel = Math.abs(
            Math.abs(axis.reduce((s, v, k) => s + v * column.axis[k], 0)) - 1,
          );
        if (off <= 0.1 && parallel <= 1e-3) {
          admit("steering-wheel", island, "column", true);
          continue;
        }
      }
      // Resting cover: real coplanar support faces under it on still parts.
      const own = (await surface(island))
        .flatMap((m) => (m ? triangles(m) : []))
        .filter(flat);
      const hosts = (await surface(hostsNear(b, 0.1)))
        .flatMap((m) => (m ? triangles(m) : []))
        .filter(flat);
      let area = 0,
        work = 0,
        supported = false;
      // Only faces in the same horizontal plane can support each other.
      const level = new Map<number, SourceTriangle[]>();
      for (const h of hosts) {
        const key = Math.round(h[0][1] * 10);
        level.set(key, [...(level.get(key) ?? []), h]);
      }
      const xz = (t: SourceTriangle) => ({
        min: [0, 2].map((k) => Math.min(t[0][k], t[1][k], t[2][k])),
        max: [0, 2].map((k) => Math.max(t[0][k], t[1][k], t[2][k])),
      });
      for (const t of own) {
        const key = Math.round(t[0][1] * 10),
          tb = xz(t);
        for (const h of [key - 1, key, key + 1].flatMap(
          (k) => level.get(k) ?? [],
        )) {
          if (++work > RIDE_ALONG_LIMITS.supportPairs) break;
          if (Math.abs(t[0][1] - h[0][1]) > 0.05) continue;
          const hb = xz(h);
          if (
            hb.min[0] > tb.max[0] ||
            tb.min[0] > hb.max[0] ||
            hb.min[1] > tb.max[1] ||
            tb.min[1] > hb.max[1]
          )
            continue;
          const patch = sourceSupportPatch(t, h);
          if (!patch) continue;
          area += patch.areaLdu2;
          // The cover sits on top: its parts are above (smaller Y) the face.
          supported ||= b.min[1] < t[0][1] - 0.05;
        }
      }
      if (supported && area >= 4 && work <= RIDE_ALONG_LIMITS.supportPairs)
        admit("resting-cover", island, "chassis", false);
      else
        result.staying.push({
          occurrenceIds: island,
          reason:
            "This part stays where it was built: it is not resting on the car",
        });
    }
    const count = (kind: RideAlongKind) =>
      result.admitted
        .filter((x) => x.kind === kind)
        .reduce((n, x) => n + x.occurrenceIds.length, 0);
    const parts = (n: number, one: string, many: string) =>
      n === 1 ? `1 ${one}` : `${n} ${many}`;
    const said: string[] = [];
    if (count("resting-cover"))
      said.push(
        `the loose cover (${parts(count("resting-cover"), "part", "parts")}) rides on the body`,
      );
    if (count("steering-wheel"))
      said.push("the steering wheel turns with the steering");
    if (count("sticker"))
      said.push(
        `${parts(count("sticker"), "sticker stays", "stickers stay")} on ${count("sticker") === 1 ? "its brick" : "their bricks"}`,
      );
    if (count("flexible-hose"))
      said.push(
        `${parts(count("flexible-hose"), "hose rides", "hoses ride")} along between ${count("flexible-hose") === 1 ? "its" : "their"} ends`,
      );
    if (said.length)
      a.notes.push(
        `Along for the ride: ${said.join("; ")}. They are not clipped on in the real model.`,
      );
    if (result.staying.length)
      a.notes.push(
        `${parts(
          result.staying.reduce((n, s) => n + s.occurrenceIds.length, 0),
          "loose part stays",
          "loose parts stay",
        )} where they were built.`,
      );
  }
  return results;
}

/** Library texts of `roots` and their dependency closure, for closure checks. */
export function librarySourceRecord(
  roots: readonly string[],
  read: (name: string) => string | undefined,
) {
  const out: Record<string, string> = Object.create(null),
    pending = [...roots],
    seen = new Set<string>();
  while (pending.length) {
    const ref = pending.pop()!.toLowerCase().replaceAll("\\", "/");
    if (seen.has(ref) || seen.size > 256) continue;
    seen.add(ref);
    const text = read(ref);
    if (text === undefined) continue;
    out[ref] = text;
    pending.push(...directReferences(text));
  }
  return out;
}
