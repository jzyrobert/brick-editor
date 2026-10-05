import { libraryLock } from "../catalog/catalog";
import { fullLibraryLock } from "../catalog/full-library";
import {
  add,
  inverse,
  mv,
  nearlyPhysical,
  orthonormalized,
} from "../core/math";
import type { Bounds } from "../core/spatial";
import type { Occurrence, Vec3 } from "../core/types";
import { MECHANICAL_PACK } from "../mechanisms/mechanical-pack";

/** Pinned literal interfaces. These are round bearings, not keyed wheel welds.
 * The Model Team stack is retained on a real axle and its rims are connected
 * through two opposed off-axis pins. No bounds/proximity attachment is used. */
export const REVIEWED_AXLE_WHEEL_SOURCES = Object.freeze({
  "2695.dat":
    "619f9c685d815c117a0c865ac8a55d45e9f1a71eb42e8e260f4afb41a7b6c5dc",
  "2696.dat":
    "55f45df681295ee0cf4197897c2cdce49d1529f26de281d6042573a5a98844f8",
  "4261.dat":
    "c30a6ebe1e478f416ce6602ddd647b54684b2b3b53227deaf8d5ad65bebfd80d",
  "4262.dat":
    "bcdbbab32f4b3d4e891f04645cc5012f2b6ad8eacb2cb02ddae1f2ddaa1052bc",
  "4263.dat":
    "5a624a7575458a23ffd1c31e868d28cd18d906c9853517aef362de9cfbfb0880",
  "3749.dat":
    "45cc85e7a28f7d0f9cd8be2aaeba090d91e7aa54649344f19c8fa5dc81684985",
});
export type ReviewedWheelInstance = {
  rim: Occurrence;
  tyre: Occurrence;
  center: Vec3;
  radius: number;
};
export type ReviewedVehicleAttachment = {
  a: string;
  b: string;
  kind:
    | "round-bearing"
    | "retained-pivot"
    | "inter-rim-pin"
    | "axial-retainer"
    | "tyre-fit";
};
export type ReviewedAxleWheelAssembly = {
  instances: ReviewedWheelInstance[];
  /** Rotating source members, including the actual inter-rim pins. */
  members: Occurrence[];
  /** Primary stud-connected frame support, not an imaginary wheel holder. */
  carrier: Occurrence;
  mountMembers: Occurrence[];
  shaft: Occurrence;
  axis: Vec3;
  center: Vec3;
  radius: number;
  steering: boolean;
  side: -1 | 1;
};
const ref = (o: Occurrence) => o.node.ref.toLowerCase();
const dot = (a: Vec3, b: Vec3) => a.reduce((s, x, k) => s + x * b[k], 0);
const sub = (a: Vec3, b: Vec3): Vec3 => a.map((x, k) => x - b[k]) as Vec3;
const unit = (p: Vec3): Vec3 => p.map((x) => x / Math.hypot(...p)) as Vec3;
const at = (o: Occurrence, p: Vec3) => {
  const f = orthonormalized(o.transform);
  return add(f.position, mv(f.basis, p));
};
const axis = (o: Occurrence, p: Vec3) =>
  unit(mv(orthonormalized(o.transform).basis, p));
const distance = (a: Vec3, b: Vec3) => Math.hypot(...sub(a, b));
const axial = (p: Vec3, origin: Vec3, direction: Vec3) => {
  const delta = sub(p, origin),
    t = dot(delta, direction);
  return {
    t,
    off: Math.hypot(...sub(delta, direction.map((x) => x * t) as Vec3)),
  };
};
const physical = (o: Occurrence) =>
  o.namespace === "official" &&
  o.node.kind === "part" &&
  nearlyPhysical(o.transform);
const boxOk = (b: Bounds | null): b is Bounds =>
  !!b &&
  b.min.every(
    (x, k) => Number.isFinite(x) && Number.isFinite(b.max[k]) && x <= b.max[k],
  );

/** Reusable attachment evidence for an assembly owner. Edges establish that
 * parts stay attached; their kind deliberately does not turn a bearing into a
 * rigid weld or imply a simulated steering linkage. */
export function reviewedAxleWheelMounts(
  all: readonly Occurrence[],
  reserved: ReadonlySet<string>,
  bounds: (o: Occurrence) => Bounds | null,
  limits: { wheelParts: number; holders: number; connectionWork: number },
) {
  const result: {
    assemblies: ReviewedAxleWheelAssembly[];
    edges: ReviewedVehicleAttachment[];
    skipped: Array<{ occurrenceIds: string[]; reason: string }>;
  } = { assemblies: [], edges: [], skipped: [] };
  if (
    !Number.isInteger(limits.wheelParts) ||
    limits.wheelParts < 1 ||
    limits.wheelParts > 256 ||
    !Number.isInteger(limits.holders) ||
    limits.holders < 1 ||
    limits.holders > 128 ||
    !Number.isInteger(limits.connectionWork) ||
    limits.connectionWork < 1 ||
    limits.connectionWork > 100000
  ) {
    result.skipped.push({
      occurrenceIds: [],
      reason: "Wheel mount review needs the existing bounded resource limits",
    });
    return result;
  }
  if (
    libraryLock.manifestSha256 !== MECHANICAL_PACK.curatedManifestSha256 ||
    fullLibraryLock.manifestSha256 !== MECHANICAL_PACK.fullManifestSha256
  )
    return result;
  const selected = all.filter(physical),
    rims = selected.filter((o) => ref(o) === "2695.dat" && !reserved.has(o.id)),
    tyres = selected.filter((o) => ref(o) === "2696.dat"),
    shafts = selected.filter((o) => ["3706.dat", "3707.dat"].includes(ref(o))),
    collars = selected.filter((o) => ref(o) === "3713.dat"),
    bearings = selected.filter((o) =>
      ["3700.dat", "4261.dat"].includes(ref(o)),
    ),
    plates = selected.filter((o) => ["4262.dat", "4263.dat"].includes(ref(o))),
    pins = selected.filter((o) => ref(o) === "3749.dat");
  const refuse = (ids: string[], reason: string) =>
    result.skipped.push({ occurrenceIds: ids, reason });
  if (!rims.length) return result;
  if (
    rims.length + tyres.length > limits.wheelParts ||
    bearings.length + plates.length > limits.holders
  ) {
    refuse(
      rims.map((o) => o.id),
      "Too many wheel parts to review their real axle mounts",
    );
    return result;
  }
  let work = 0;
  const charge = () => {
    if (++work > limits.connectionWork)
      throw new Error(
        "Wheel mount review exceeds its bounded connection budget",
      );
  };
  type Match = ReviewedWheelInstance & {
    shaft: Occurrence;
    carrier: Occurrence;
    mountMembers: Occurrence[];
    axis: Vec3;
    coordinate: number;
    boreCoordinate: number;
    retainers: Occurrence[];
  };
  const matches: Match[] = [];
  try {
    for (const rim of rims) {
      const ids = [rim.id],
        direction = axis(rim, [0, 0, 1]);
      if (Math.abs(direction[1]) > 1e-4) {
        refuse(ids, "Driving needs a horizontal wheel axle");
        continue;
      }
      const ts = tyres.filter((t) => {
        charge();
        return (
          distance(t.transform.position, rim.transform.position) <= 0.5 &&
          dot(direction, axis(t, [0, 0, 1])) >= 0.9999
        );
      });
      if (ts.length !== 1 || reserved.has(ts[0]?.id)) {
        refuse(
          ids,
          "This stepped rim needs one available matching tyre in its source orientation",
        );
        continue;
      }
      const tyre = ts[0],
        box = bounds({
          ...tyre,
          transform: {
            position: [0, 0, 0],
            basis: [1, 0, 0, 0, 1, 0, 0, 0, 1],
          },
        });
      if (!boxOk(box)) {
        refuse(ids, "This tyre needs complete source bounds");
        continue;
      }
      const radius = Math.max(
        // Complete canonical source reaches 54.004008581 LDU between axes.
        // AABB extrema alone miss those faceted radial vertices.
        54.005,
        box.max[0],
        box.max[1],
        -box.min[0],
        -box.min[1],
      );
      if (radius > 100) {
        refuse(ids, "This wheel radius is outside the supported source range");
        continue;
      }
      const ss = shafts.filter((s) => {
        charge();
        const dir = axis(s, [1, 0, 0]),
          p = axial(rim.transform.position, s.transform.position, dir),
          half = ref(s) === "3706.dat" ? 60 : 80;
        return (
          Math.abs(dot(dir, direction)) >= 0.9999 &&
          p.off <= 0.5 &&
          p.t - 8 >= -half + 2.5 &&
          p.t + 8 <= half - 2.5 &&
          !reserved.has(s.id)
        );
      });
      if (ss.length !== 1) {
        refuse(
          ids,
          "This wheel needs one real axle spanning its complete round hub",
        );
        continue;
      }
      const shaft = ss[0],
        dir = axis(shaft, [1, 0, 0]),
        p = axial(rim.transform.position, shaft.transform.position, dir);
      const bs = bearings.filter((b) => {
        charge();
        const a = axis(b, ref(b) === "3700.dat" ? [0, 0, 1] : [1, 0, 0]),
          c = axial(at(b, [0, 10, 0]), shaft.transform.position, dir),
          half = ref(shaft) === "3706.dat" ? 60 : 80;
        return (
          Math.abs(dot(a, dir)) >= 0.9999 &&
          c.off <= 0.5 &&
          Math.abs(c.t) + 10 <= half &&
          !reserved.has(b.id)
        );
      });
      if (bs.length !== 1) {
        refuse(
          ids,
          "This wheel axle needs one available reviewed frame bearing",
        );
        continue;
      }
      const bearing = bs[0],
        bore = axial(at(bearing, [0, 10, 0]), shaft.transform.position, dir).t;
      const retainers = collars.filter((c) => {
        charge();
        const pos = axial(c.transform.position, shaft.transform.position, dir),
          half = ref(shaft) === "3706.dat" ? 60 : 80;
        return (
          Math.abs(dot(axis(c, [0, 0, 1]), dir)) >= 0.9999 &&
          (Math.abs(dot(axis(c, [1, 0, 0]), axis(shaft, [0, 1, 0]))) >=
            0.9999 ||
            Math.abs(dot(axis(c, [1, 0, 0]), axis(shaft, [0, 1, 0]))) <=
              1e-4) &&
          pos.off <= 0.5 &&
          Math.abs(pos.t) + 10 <= half + 0.5 &&
          !reserved.has(c.id)
        );
      });
      if (
        retainers.length !== 2 ||
        !retainers.some(
          (c) =>
            axial(c.transform.position, shaft.transform.position, dir).t + 10 <=
            bore - 10 + 0.5,
        ) ||
        !retainers.some(
          (c) =>
            axial(c.transform.position, shaft.transform.position, dir).t - 10 >=
            bore + 10 - 0.5,
        )
      ) {
        refuse(
          ids,
          "Capture this wheel axle with real retainers on both sides of its frame bearing",
        );
        continue;
      }
      let carrier = bearing,
        mountMembers = [bearing, shaft, ...retainers];
      if (ref(bearing) === "4261.dat") {
        const yAxis = axis(bearing, [0, 1, 0]);
        if (Math.abs(yAxis[1]) < 0.9999) {
          refuse(ids, "The steering arm needs an upright retained pivot");
          continue;
        }
        const ends = [-5, 29].map((offset) =>
          plates.filter((plate) => {
            charge();
            if (
              reserved.has(plate.id) ||
              Math.abs(dot(axis(plate, [0, 1, 0]), yAxis)) < 0.9999
            )
              return false;
            const x = ref(plate) === "4262.dat" ? 50 : 30;
            return [-x, x].some((px) => {
              const a = axial(
                  at(plate, [px, 0, 0]),
                  at(bearing, [0, offset, 0]),
                  yAxis,
                ),
                b = axial(
                  at(plate, [px, 6, 0]),
                  at(bearing, [0, offset, 0]),
                  yAxis,
                );
              return (
                a.off <= 0.5 &&
                b.off <= 0.5 &&
                Math.min(a.t, b.t) >= -5 - 0.5 &&
                Math.max(a.t, b.t) <= 5 + 0.5
              );
            });
          }),
        );
        if (
          ends.some((e) => e.length !== 1) ||
          ends[0][0].id === ends[1][0].id
        ) {
          refuse(
            ids,
            "The steering arm needs real sockets capturing both pivot pins",
          );
          continue;
        }
        carrier = ends[1][0];
        mountMembers = [...mountMembers, ends[0][0], ends[1][0]];
        for (const e of ends)
          result.edges.push({
            a: bearing.id,
            b: e[0].id,
            kind: "retained-pivot",
          });
        // The arm's second, vertical keyed bore carries the real 3749 axle-pin
        // into a 4263 steering link. Optional evidence, never a guessed rack.
        const linkOrigin = at(bearing, [0, 0, 40]);
        const linkPins = pins.filter((pin) => {
          charge();
          return (
            !reserved.has(pin.id) &&
            distance(pin.transform.position, linkOrigin) <= 0.5 &&
            dot(axis(pin, [1, 0, 0]), yAxis) >= 0.9999 &&
            (Math.abs(dot(axis(pin, [0, 1, 0]), axis(bearing, [1, 0, 0]))) >=
              0.9999 ||
              Math.abs(dot(axis(pin, [0, 1, 0]), axis(bearing, [1, 0, 0]))) <=
                1e-4)
          );
        });
        if (linkPins.length === 1) {
          const linkPin = linkPins[0],
            links = plates.filter((plate) => {
              charge();
              if (
                ref(plate) !== "4263.dat" ||
                reserved.has(plate.id) ||
                Math.abs(dot(axis(plate, [0, 1, 0]), yAxis)) < 0.9999
              )
                return false;
              return [-30, 30].some((px) => {
                const lo = axial(at(plate, [px, 0, 0]), linkOrigin, yAxis),
                  hi = axial(at(plate, [px, 6, 0]), linkOrigin, yAxis);
                return (
                  lo.off <= 0.5 &&
                  hi.off <= 0.5 &&
                  Math.min(lo.t, hi.t) >= -18 - 0.5 &&
                  Math.abs(Math.max(lo.t, hi.t) + 2) <= 0.5
                );
              });
            });
          if (
            links.length === 1 &&
            boxOk(bounds(linkPin)) &&
            boxOk(bounds(links[0]))
          ) {
            mountMembers.push(linkPin, links[0]);
            result.edges.push(
              { a: bearing.id, b: linkPin.id, kind: "axial-retainer" },
              { a: linkPin.id, b: links[0].id, kind: "retained-pivot" },
            );
          }
        }
      }
      result.edges.push(
        { a: rim.id, b: tyre.id, kind: "tyre-fit" },
        { a: shaft.id, b: rim.id, kind: "round-bearing" },
        { a: shaft.id, b: bearing.id, kind: "round-bearing" },
        ...retainers.map((c) => ({
          a: shaft.id,
          b: c.id,
          kind: "axial-retainer" as const,
        })),
      );
      if ([rim, ...mountMembers].some((o) => !boxOk(bounds(o)))) {
        refuse(
          ids,
          "This wheel mount needs complete source bounds for every real support and retainer",
        );
        continue;
      }
      matches.push({
        rim,
        tyre,
        center: [...rim.transform.position],
        radius,
        shaft,
        carrier,
        mountMembers,
        axis: dir,
        coordinate: p.t,
        boreCoordinate: bore,
        retainers,
      });
    }
    const shaftGroups = new Map<string, Match[]>();
    for (const m of matches) {
      const k = `${m.shaft.id}:${m.coordinate < m.boreCoordinate ? -1 : 1}`,
        list = shaftGroups.get(k) ?? [];
      list.push(m);
      shaftGroups.set(k, list);
    }
    for (const stack of shaftGroups.values()) {
      stack.sort((a, b) => a.coordinate - b.coordinate);
      const first = stack[0],
        side = stack[0].coordinate < first.boreCoordinate ? -1 : 1,
        members = stack.flatMap((w) => [w.rim, w.tyre]),
        outer = side < 0 ? stack[0] : stack[stack.length - 1],
        inner = side < 0 ? stack[stack.length - 1] : stack[0],
        innerFace = inner.coordinate + side * -8,
        frameFace = first.boreCoordinate + side * 10;
      const collar = first.retainers.find(
        (c) =>
          side *
            (axial(
              c.transform.position,
              first.shaft.transform.position,
              first.axis,
            ).t -
              first.boreCoordinate) >
          0,
      )!;
      const collarFace =
        axial(
          collar.transform.position,
          first.shaft.transform.position,
          first.axis,
        ).t -
        side * 10;
      if (
        Math.abs(innerFace - frameFace) > 0.5 ||
        Math.abs(outer.coordinate + side * 8 - collarFace) > 0.5
      ) {
        refuse(
          members.map((o) => o.id),
          "The actual frame and outer retainer must capture the wheel stack's hub faces",
        );
        continue;
      }
      let valid = true;
      for (let i = 1; i < stack.length; i++) {
        const a = stack[i - 1],
          b = stack[i];
        if (Math.abs(b.coordinate - a.coordinate - 32) > 0.5) {
          valid = false;
          break;
        }
        const outerRim = side < 0 ? a.rim : b.rim,
          innerRim = side < 0 ? b.rim : a.rim,
          inward = first.axis.map((x) => -side * x) as Vec3;
        // Both opposing offset holes are literal ±20, round R6, depth16.
        const links = [-20, 20].map((y) =>
          pins.filter((pin) => {
            charge();
            const expected = add(
              at(outerRim, [0, y, 0]),
              inward.map((x) => x * 10) as Vec3,
            );
            const innerHole = add(
              at(outerRim, [0, y, 0]),
              inward.map((x) => x * 32) as Vec3,
            );
            return (
              !reserved.has(pin.id) &&
              [-20, 20].some(
                (iy) => distance(at(innerRim, [0, iy, 0]), innerHole) <= 0.5,
              ) &&
              distance(pin.transform.position, expected) <= 0.5 &&
              dot(axis(pin, [1, 0, 0]), inward) >= 0.9999
            );
          }),
        );
        if (
          links.some((x) => x.length !== 1) ||
          links[0][0].id === links[1][0].id
        ) {
          valid = false;
          break;
        }
        for (const link of links) {
          members.push(link[0]);
          if (!boxOk(bounds(link[0]))) {
            valid = false;
            break;
          }
          result.edges.push(
            { a: a.rim.id, b: link[0].id, kind: "inter-rim-pin" },
            { a: b.rim.id, b: link[0].id, kind: "inter-rim-pin" },
          );
        }
      }
      if (!valid) {
        refuse(
          members.map((o) => o.id),
          "Connect each adjacent wheel pair with its two real opposing axle-pins",
        );
        continue;
      }
      result.assemblies.push({
        instances: stack.map(({ rim, tyre, center, radius }) => ({
          rim,
          tyre,
          center,
          radius,
        })),
        members,
        carrier: first.carrier,
        mountMembers: first.mountMembers,
        shaft: first.shaft,
        axis: first.axis,
        center: stack
          .reduce((p, w) => add(p, w.center), [0, 0, 0] as Vec3)
          .map((x) => x / stack.length) as Vec3,
        radius: Math.max(...stack.map((w) => w.radius)),
        steering: first.mountMembers.some((o) => ref(o) === "4261.dat"),
        side,
      });
    }
    const owners = new Map<string, number>();
    for (const a of result.assemblies)
      for (const m of a.members) owners.set(m.id, (owners.get(m.id) ?? 0) + 1);
    result.assemblies = result.assemblies.filter((a) => {
      if (a.members.some((m) => owners.get(m.id) !== 1)) {
        refuse(
          a.members.map((m) => m.id),
          "A wheel or joining pin belongs to more than one assembly",
        );
        return false;
      }
      return true;
    });
  } catch (error) {
    result.assemblies = [];
    result.edges = [];
    refuse(
      rims.map((o) => o.id),
      (error as Error).message,
    );
  }
  const accepted = new Set(
    result.assemblies.flatMap((a) =>
      [...a.members, ...a.mountMembers].map((o) => o.id),
    ),
  );
  result.edges = [
    ...new Map(
      result.edges
        .filter((e) => accepted.has(e.a) && accepted.has(e.b))
        .map((e) => [JSON.stringify([e.a, e.b, e.kind]), e]),
    ).values(),
  ];
  return result;
}
