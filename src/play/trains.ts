import { compose, inverse } from "../core/math";
import installedBounds from "../catalog/bounds.json";
import { projectBounds, transformBounds, type Bounds } from "../core/spatial";
import {
  ensure,
  type Occurrence,
  type Project,
  type Transform,
  type Vec3,
} from "../core/types";
import {
  buildTrackGraph,
  enter,
  entryEnd,
  exitEnd,
  pieceAt,
  projectOnTrack,
  reverseTraversal,
  traversalAt,
  trackPart,
  trackPartKey,
  type TrackGraph,
  type TrackProjection,
  type Traversal,
} from "./track";
import {
  TRAIN_COUPLER_PARTS,
  TRAIN_LOCO_PARTS,
  TRAIN_WHEEL_PARTS,
} from "../catalog/train-parts";

/**
 * Running trains in Play (session-only, like automatic doors): cars found
 * on official track are moved along the rail centreline each fixed tick.
 * Nothing is written to the project. See docs/PLAY-TRAINS.md.
 */

export {
  TRAIN_COUPLER_PARTS,
  TRAIN_LOCO_PARTS,
  TRAIN_WHEEL_PARTS,
} from "../catalog/train-parts";
export const TRAIN_PREFIX = "train:";
export const TRAIN_LIMITS = Object.freeze({
  trains: 8,
  carsPerTrain: 16,
  partsPerCar: 600,
  /** LDU/s at full throttle (about 24 studs a second). */
  maxSpeed: 480,
  /** LDU/s². */
  acceleration: 180,
  braking: 360,
});
/** Wheels count as on the track within these distances (LDU). */
const WHEEL_LATERAL = 64,
  WHEEL_HEIGHT = 10,
  /** Parts belong to a car only above this far below the rail tops. */
  CAR_BELOW_RAIL = 10,
  CAR_REACH = 200,
  /** Axles closer than this along the car share a bogie. */
  BOGIE_GAP = 40,
  /** Car ends closer than this are coupled. */
  COUPLING_GAP = 40;

export type TrainBogieDef = {
  id: string;
  occurrenceIds: string[];
  /** Route distance behind the train's head pivot. */
  offset: number;
};
export type TrainCarDef = {
  id: string;
  occurrenceIds: string[];
  locomotive: boolean;
  bogies: TrainBogieDef[];
  /** Offsets of the car's front and rear pivots (bogie centres). */
  pivots: [number, number];
  /** Car-local footprint in its pivot frame (x along the track, z across). */
  footprint: { min: [number, number]; max: [number, number] };
  restTransforms: Record<string, Transform>;
};
export type TrainDef = {
  id: string;
  name: string;
  cars: TrainCarDef[];
  /** Track ahead of the head pivot that the front car covers. */
  frontOverhang: number;
  /** Track behind the last pivot that the rear car covers. */
  rearOverhang: number;
  /** Route at rest: the head pivot is at `head` along it. */
  route: Traversal[];
  head: number;
};
export type TrainSkip = { occurrenceIds: string[]; reason: string };
export type DerivedTrains = {
  graph: TrackGraph;
  trains: TrainDef[];
  skipped: TrainSkip[];
  /** Every occurrence a train moves. */
  occurrenceIds: string[];
};

const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot2 = (a: Vec3, b: Vec3) => a[0] * b[0] + a[2] * b[2];
const unit2 = (v: Vec3): Vec3 => {
  const l = Math.hypot(v[0], v[2]) || 1;
  return [v[0] / l, 0, v[2] / l];
};
const centreOf = (b: Bounds): Vec3 => [
  (b.min[0] + b.max[0]) / 2,
  (b.min[1] + b.max[1]) / 2,
  (b.min[2] + b.max[2]) / 2,
];

/**
 * The frame of a car or bogie at two route points (front, rear): origin at
 * their midpoint, X along the track toward the front, Y world down (LDraw),
 * Z = X × Y. With one point (front = rear) X is the track tangent there.
 */
export function pivotFrame(
  front: { position: Vec3; tangent: Vec3 },
  rear: { position: Vec3; tangent: Vec3 },
): Transform {
  let d = sub(front.position, rear.position);
  if (Math.hypot(...d) < 1e-6) d = front.tangent;
  const l = Math.hypot(...d);
  const x: Vec3 = [d[0] / l, d[1] / l, d[2] / l];
  // Y: world down, made orthogonal to X (level track keeps it exact).
  let y: Vec3 = [-x[1] * x[0], 1 - x[1] * x[1], -x[1] * x[2]];
  const ly = Math.hypot(...y) || 1;
  y = [y[0] / ly, y[1] / ly, y[2] / ly];
  const z: Vec3 = [
    x[1] * y[2] - x[2] * y[1],
    x[2] * y[0] - x[0] * y[2],
    x[0] * y[1] - x[1] * y[0],
  ];
  return {
    position: [
      (front.position[0] + rear.position[0]) / 2,
      (front.position[1] + rear.position[1]) / 2,
      (front.position[2] + rear.position[2]) / 2,
    ],
    basis: [x[0], y[0], z[0], x[1], y[1], z[1], x[2], y[2], z[2]],
  };
}

// ---- Route arithmetic ------------------------------------------------------

/** A train's route: traversals in travel order and their start coordinates. */
export class Route {
  starts: number[] = [];
  constructor(
    public graph: TrackGraph,
    public items: Traversal[],
  ) {
    this.reindex();
  }
  reindex() {
    let u = 0;
    this.starts = this.items.map((t) => {
      const s = u;
      u += t.length;
      return s;
    });
  }
  get length() {
    const n = this.items.length;
    return n ? this.starts[n - 1] + this.items[n - 1].length : 0;
  }
  locate(u: number) {
    let lo = 0,
      hi = this.items.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (this.starts[mid] <= u) lo = mid;
      else hi = mid - 1;
    }
    return lo;
  }
  at(u: number) {
    const i = this.locate(u),
      t = this.items[i];
    return traversalAt(
      this.graph,
      t,
      Math.max(0, Math.min(t.length, u - this.starts[i])),
    );
  }
}

// ---- Derivation --------------------------------------------------------------

type Candidate = { o: Occurrence; key: string; box: Bounds };
/**
 * Find trains standing on official track: wheels on the rails, the parts
 * above the rails around them grouped into cars (couplings join cars into
 * trains without making them one body), cars ordered from the locomotive.
 */
export function deriveTrains(options: {
  all: Occurrence[];
  included?: ReadonlySet<string>;
  /** Occurrences owned by authored or derived rigs. */
  reserved: ReadonlySet<string>;
  /** World bounds of a part occurrence, or null when unknown. */
  bounds: (o: Occurrence) => Bounds | null;
}): DerivedTrains {
  const present = options.all.filter(
    (o) =>
      (!options.included || options.included.has(o.id)) &&
      o.node.kind === "part",
  );
  const graph = buildTrackGraph(
    present
      .filter((o) => trackPart(o.node.ref))
      .map((o) => ({ id: o.id, ref: o.node.ref, transform: o.transform })),
  );
  const empty: DerivedTrains = {
    graph,
    trains: [],
    skipped: [],
    occurrenceIds: [],
  };
  if (!graph.pieces.length) return empty;
  const defaultRoute = (piece: number) =>
    graph.pieces[piece].def.defaultRoute ?? 0;
  const project = (p: Vec3, lateral: number) =>
    projectOnTrack(graph, p, lateral, defaultRoute);
  // Parts above the rails near the track.
  const candidates: Candidate[] = [];
  for (const o of present) {
    if (options.reserved.has(o.id) || trackPart(o.node.ref)) continue;
    const box = options.bounds(o);
    if (!box) continue;
    const c = centreOf(box),
      near = project([c[0], box.max[1], c[2]], CAR_REACH);
    if (!near || box.max[1] > near.railY + CAR_BELOW_RAIL) continue;
    candidates.push({ o, key: trackPartKey(o.node.ref), box });
  }
  const wheels = new Map<string, TrackProjection>();
  for (const c of candidates) {
    if (!TRAIN_WHEEL_PARTS.has(c.key)) continue;
    const centre = centreOf(c.box),
      p = project([centre[0], c.box.max[1], centre[2]], WHEEL_LATERAL);
    if (p && Math.abs(c.box.max[1] - p.railY) <= WHEEL_HEIGHT)
      wheels.set(c.o.id, p);
  }
  if (!wheels.size) return empty;
  // Union-find over touching boxes (0.5 LDU), couplers never joining couplers.
  const parent = candidates.map((_, i) => i);
  const find = (i: number): number =>
    parent[i] === i ? i : (parent[i] = find(parent[i]));
  const CELL = 48,
    grid = new Map<string, number[]>();
  const cells = (b: Bounds) => {
    const lo = b.min.map((v) => Math.floor((v - 0.5) / CELL)),
      hi = b.max.map((v) => Math.floor((v + 0.5) / CELL));
    const out: string[] = [];
    if ((hi[0] - lo[0] + 1) * (hi[1] - lo[1] + 1) * (hi[2] - lo[2] + 1) > 512)
      return out;
    for (let x = lo[0]; x <= hi[0]; x++)
      for (let y = lo[1]; y <= hi[1]; y++)
        for (let z = lo[2]; z <= hi[2]; z++) out.push(`${x},${y},${z}`);
    return out;
  };
  const touching = (a: Bounds, b: Bounds) =>
    [0, 1, 2].every(
      (k) => a.min[k] <= b.max[k] + 0.5 && b.min[k] <= a.max[k] + 0.5,
    );
  candidates.forEach((c, i) => {
    const seen = new Set<number>();
    for (const cell of cells(c.box)) {
      const list = grid.get(cell) ?? [];
      for (const j of list) {
        if (seen.has(j)) continue;
        seen.add(j);
        const d = candidates[j];
        if (TRAIN_COUPLER_PARTS.has(c.key) && TRAIN_COUPLER_PARTS.has(d.key))
          continue;
        if (touching(c.box, d.box)) parent[find(i)] = find(j);
      }
      list.push(i);
      grid.set(cell, list);
    }
  });
  const groups = new Map<number, Candidate[]>();
  candidates.forEach((c, i) => {
    const r = find(i);
    const list = groups.get(r) ?? [];
    list.push(c);
    groups.set(r, list);
  });
  const skipped: TrainSkip[] = [];
  type Car = {
    parts: Candidate[];
    centroid: Vec3;
    axis: Vec3;
    extent: [number, number];
    clusters: Array<{ ids: string[]; a: number; centre: Vec3 }>;
    loco: boolean;
    frontSign: number;
  };
  const cars: Car[] = [];
  for (const parts of [...groups.values()].sort((a, b) =>
    a[0].o.id < b[0].o.id ? -1 : 1,
  )) {
    const carWheels = parts.filter((c) => wheels.has(c.o.id));
    if (!carWheels.length) continue;
    const ids = parts.map((c) => c.o.id);
    if (parts.length > TRAIN_LIMITS.partsPerCar) {
      skipped.push({
        occurrenceIds: ids,
        reason: `A train car may have at most ${TRAIN_LIMITS.partsPerCar} parts`,
      });
      continue;
    }
    const centres = carWheels.map((c) => centreOf(c.box));
    const centroid = centres
      .reduce((s, c) => [s[0] + c[0], s[1] + c[1], s[2] + c[2]] as Vec3, [
        0, 0, 0,
      ] as Vec3)
      .map((v) => v / centres.length) as Vec3;
    const p = project(centroid, CAR_REACH);
    if (!p) continue;
    const axis = unit2(pieceAt(graph.pieces[p.piece], p.segment, p.s).tangent);
    const along = (v: Vec3) => dot2(sub(v, centroid), axis);
    const sorted = carWheels
      .map((c, i) => ({ id: c.o.id, a: along(centres[i]), centre: centres[i] }))
      .sort((x, y) => x.a - y.a || (x.id < y.id ? -1 : 1));
    const clusters: Car["clusters"] = [];
    for (const w of sorted) {
      const last = clusters.at(-1);
      if (last && w.a - last.a <= BOGIE_GAP) {
        last.ids.push(w.id);
        const n = last.ids.length;
        last.centre = last.centre.map(
          (v, k) => v + (w.centre[k] - v) / n,
        ) as Vec3;
        last.a = along(last.centre);
      } else clusters.push({ ids: [w.id], a: w.a, centre: [...w.centre] });
    }
    let aMin = Infinity,
      aMax = -Infinity;
    for (const c of parts)
      for (const x of [c.box.min[0], c.box.max[0]])
        for (const z of [c.box.min[2], c.box.max[2]]) {
          const a = along([x, 0, z]);
          aMin = Math.min(aMin, a);
          aMax = Math.max(aMax, a);
        }
    const fronts = parts.filter((c) => TRAIN_LOCO_PARTS.has(c.key));
    const frontA = fronts.length
      ? fronts.reduce((s, c) => s + along(centreOf(c.box)), 0) / fronts.length
      : 0;
    cars.push({
      parts,
      centroid,
      axis,
      extent: [aMin, aMax],
      clusters,
      loco: fronts.length > 0,
      frontSign: frontA < 0 ? -1 : 1,
    });
  }
  // Couple cars whose ends meet.
  const ends = (car: Car): Vec3[] =>
    car.extent.map((a) => [
      car.centroid[0] + car.axis[0] * a,
      car.centroid[1],
      car.centroid[2] + car.axis[2] * a,
    ]);
  const links = cars.map(() => new Set<number>());
  for (let i = 0; i < cars.length; i++)
    for (let j = i + 1; j < cars.length; j++) {
      const gap = Math.min(
        ...ends(cars[i]).flatMap((a) =>
          ends(cars[j]).map((b) => Math.hypot(a[0] - b[0], a[2] - b[2])),
        ),
      );
      if (
        gap <= COUPLING_GAP &&
        Math.abs(cars[i].centroid[1] - cars[j].centroid[1]) < 40
      ) {
        links[i].add(j);
        links[j].add(i);
      }
    }
  const done = new Set<number>(),
    trains: TrainDef[] = [];
  for (let start = 0; start < cars.length; start++) {
    if (done.has(start)) continue;
    // The component, then a chain from one end.
    const component: number[] = [],
      stack = [start];
    while (stack.length) {
      const i = stack.pop()!;
      if (done.has(i)) continue;
      done.add(i);
      component.push(i);
      stack.push(...links[i]);
    }
    const first =
      component.find((i) => links[i].size <= 1) ?? Math.min(...component);
    const chain: number[] = [],
      seen = new Set<number>();
    let at: number | undefined = first;
    while (at !== undefined) {
      chain.push(at);
      seen.add(at);
      at = [...links[at]].sort((a, b) => a - b).find((j) => !seen.has(j));
    }
    for (const i of component)
      if (!seen.has(i)) {
        skipped.push({
          occurrenceIds: cars[i].parts.map((c) => c.o.id),
          reason: "Cars coupled into a branch cannot run as one train",
        });
      }
    // The locomotive leads.
    const locoAt = chain.findIndex((i) => cars[i].loco);
    if (locoAt > (chain.length - 1) / 2) chain.reverse();
    if (
      trains.length >= TRAIN_LIMITS.trains ||
      chain.length > TRAIN_LIMITS.carsPerTrain
    ) {
      skipped.push({
        occurrenceIds: chain.flatMap((i) => cars[i].parts.map((c) => c.o.id)),
        reason:
          chain.length > TRAIN_LIMITS.carsPerTrain
            ? `A train may have at most ${TRAIN_LIMITS.carsPerTrain} cars`
            : `Play runs at most ${TRAIN_LIMITS.trains} trains`,
      });
      continue;
    }
    const built = buildTrain(
      graph,
      chain.map((i) => cars[i]),
      `${TRAIN_PREFIX}${trains.length + 1}`,
      trains.length + 1,
      project,
      defaultRoute,
    );
    if (typeof built === "string")
      skipped.push({
        occurrenceIds: chain.flatMap((i) => cars[i].parts.map((c) => c.o.id)),
        reason: built,
      });
    else trains.push(built);
  }
  return {
    graph,
    trains,
    skipped,
    occurrenceIds: trains.flatMap((t) =>
      t.cars.flatMap((c) => [
        ...c.occurrenceIds,
        ...c.bogies.flatMap((b) => b.occurrenceIds),
      ]),
    ),
  };
}

function buildTrain(
  graph: TrackGraph,
  cars: Array<{
    parts: Candidate[];
    centroid: Vec3;
    axis: Vec3;
    extent: [number, number];
    clusters: Array<{ ids: string[]; a: number; centre: Vec3 }>;
    loco: boolean;
    frontSign: number;
  }>,
  id: string,
  index: number,
  project: (p: Vec3, lateral: number) => TrackProjection | undefined,
  defaultRoute: (piece: number) => 0 | 1,
): TrainDef | string {
  // Forward: from the second car toward the first, or the loco's front.
  const lead = cars[0];
  let sign = lead.frontSign;
  if (cars.length > 1)
    sign = dot2(sub(lead.centroid, cars[1].centroid), lead.axis) >= 0 ? 1 : -1;
  const forward: Vec3 = [lead.axis[0] * sign, 0, lead.axis[2] * sign];
  // Every bogie, front to back, with its projection.
  const bogies = cars.map((car) => {
    const s = dot2(car.axis, forward) >= 0 ? 1 : -1;
    return [...car.clusters]
      .sort((a, b) => b.a * s - a.a * s)
      .map((c) => ({ ...c, at: project(c.centre, WHEEL_LATERAL)! }));
  });
  const head = bogies[0][0];
  const onTrack = new Set(
    bogies.flat().map((b) => `${b.at.piece}/${b.at.segment}`),
  );
  const tangent = pieceAt(
    graph.pieces[head.at.piece],
    head.at.segment,
    head.at.s,
  ).tangent;
  const L = graph.pieces[head.at.piece].lengths[head.at.segment];
  const first: Traversal = {
    piece: head.at.piece,
    segment: head.at.segment,
    forward: dot2(tangent, forward) >= 0,
    length: L,
  };
  const items = [first];
  const headU0 = first.forward ? head.at.s : L - head.at.s;
  // Extend behind until the whole train fits.
  const span =
    Math.hypot(
      ...sub(head.centre, bogies.at(-1)!.at(-1)!.centre).map((v, k) =>
        k === 1 ? 0 : v,
      ),
    ) *
      1.2 +
    400;
  let covered = headU0;
  while (covered < span) {
    const before = prepend(graph, items[0], (piece, options) => {
      const hit = options.find((o) => onTrack.has(`${piece}/${o}`));
      return hit ?? defaultRoute(piece);
    });
    if (!before) break;
    items.unshift(before);
    covered += before.length;
    if (items.length > 400) break;
  }
  // Ahead: enough for the front overhang.
  const route = new Route(graph, items);
  let headU = covered;
  // Locate every bogie on the route near where it should be.
  const offsets: number[][] = [];
  for (const carBogies of bogies) {
    const list: number[] = [];
    for (const b of carBogies) {
      const expected =
        headU -
        Math.hypot(head.centre[0] - b.centre[0], head.centre[2] - b.centre[2]);
      let best: { u: number; err: number } | undefined;
      route.items.forEach((t, i) => {
        if (t.piece !== b.at.piece || t.segment !== b.at.segment) return;
        const u = route.starts[i] + (t.forward ? b.at.s : t.length - b.at.s),
          err = Math.abs(u - expected);
        if (!best || err < best.err) best = { u, err };
      });
      if (!best || best.u > headU + 1)
        return "Train cars must stand on one joined track";
      list.push(headU - (best as { u: number }).u);
    }
    offsets.push(list);
  }
  // Pivots must run front to back.
  const flat = offsets.flat();
  for (let i = 1; i < flat.length; i++)
    if (flat[i] < flat[i - 1] - 1)
      return "Train cars must stand on one joined track";
  headU = route.length > 0 ? headU : 0;
  const carDefs: TrainCarDef[] = cars.map((car, c) => {
    const carOffsets = offsets[c];
    const pivots: [number, number] = [carOffsets[0], carOffsets.at(-1)!];
    const bogieDefs = bogies[c].map((b, i) => ({
      id: `bogie-${i + 1}`,
      occurrenceIds: [...b.ids].sort(),
      offset: carOffsets[i],
    }));
    const bogieIds = new Set(bogieDefs.flatMap((b) => b.occurrenceIds));
    const frame = pivotFrame(
      route.at(headU - pivots[0]),
      route.at(headU - pivots[1]),
    );
    const inv = inverse(frame);
    const min: [number, number] = [Infinity, Infinity],
      max: [number, number] = [-Infinity, -Infinity];
    for (const part of car.parts)
      for (const x of [part.box.min[0], part.box.max[0]])
        for (const z of [part.box.min[2], part.box.max[2]]) {
          const y = (part.box.min[1] + part.box.max[1]) / 2;
          const l = [
            inv.position[0] +
              inv.basis[0] * x +
              inv.basis[1] * y +
              inv.basis[2] * z,
            0,
            inv.position[2] +
              inv.basis[6] * x +
              inv.basis[7] * y +
              inv.basis[8] * z,
          ];
          min[0] = Math.min(min[0], l[0]);
          min[1] = Math.min(min[1], l[2]);
          max[0] = Math.max(max[0], l[0]);
          max[1] = Math.max(max[1], l[2]);
        }
    return {
      id: `car-${c + 1}`,
      occurrenceIds: car.parts
        .map((p) => p.o.id)
        .filter((o) => !bogieIds.has(o))
        .sort(),
      locomotive: car.loco,
      bogies: bogieDefs,
      pivots,
      footprint: { min, max },
      restTransforms: Object.fromEntries(
        car.parts.map((p) => [p.o.id, structuredClone(p.o.transform)]),
      ),
    };
  });
  // Overhangs: the front car's footprint ahead of its front pivot, the
  // last car's behind its rear pivot (in each car's own pivot frame).
  const firstCar = carDefs[0],
    lastCar = carDefs.at(-1)!;
  const halfSpan = (car: TrainCarDef) => (car.pivots[1] - car.pivots[0]) / 2;
  const frontOverhang = Math.max(
    0,
    firstCar.footprint.max[0] - halfSpan(firstCar),
  );
  const rearOverhang = Math.max(
    0,
    -lastCar.footprint.min[0] - halfSpan(lastCar),
  );
  return {
    id,
    name: cars.some((c) => c.loco) ? `Train ${index}` : `Wagons ${index}`,
    cars: carDefs,
    frontOverhang,
    rearOverhang,
    route: route.items.map((t) => ({ ...t })),
    head: headU,
  };
}

/**
 * The traversal just before `t`: into t's entry end from the piece joined
 * there. `choose` picks a switch's route when the way back is ambiguous.
 */
export function prepend(
  graph: TrackGraph,
  t: Traversal,
  choose: (piece: number, routes: Array<0 | 1>) => 0 | 1,
): Traversal | undefined {
  const link = graph.pieces[t.piece].links[entryEnd(graph, t)];
  if (!link) return undefined;
  const piece = graph.pieces[link.piece];
  const routes = piece.def.segments
    .map((seg, i) => ({ seg, i }))
    .filter(({ seg }) => seg.ends.includes(link.end));
  const options = routes.map(({ seg }) => seg.route ?? 0);
  const inward = enter(
    graph,
    link.piece,
    link.end,
    options.length > 1 ? choose(link.piece, options) : options[0],
  );
  return inward && reverseTraversal(inward);
}
/** The traversal just after `t`, given the switch routes. */
export function append(
  graph: TrackGraph,
  t: Traversal,
  routeOf: (piece: number) => 0 | 1,
): Traversal | undefined {
  const link = graph.pieces[t.piece].links[exitEnd(graph, t)];
  if (!link) return undefined;
  return enter(graph, link.piece, link.end, routeOf(link.piece));
}

// ---- Simulation --------------------------------------------------------------

export type TrainStatus =
  | "stopped"
  | "running"
  | "end-of-track"
  | "blocked"
  | "waiting";
export type CarPose = {
  frame: Transform;
  bogies: Record<string, Transform>;
};
/** Rectangles in XZ: centre, unit axis, half extents. */
type Box2 = { c: [number, number]; u: [number, number]; h: [number, number] };
const obb = (car: TrainCarDef, frame: Transform): Box2 => {
  const b = frame.basis,
    cx = (car.footprint.min[0] + car.footprint.max[0]) / 2,
    cz = (car.footprint.min[1] + car.footprint.max[1]) / 2;
  return {
    c: [
      frame.position[0] + b[0] * cx + b[2] * cz,
      frame.position[2] + b[6] * cx + b[8] * cz,
    ],
    u: [b[0], b[6]],
    h: [
      (car.footprint.max[0] - car.footprint.min[0]) / 2,
      (car.footprint.max[1] - car.footprint.min[1]) / 2,
    ],
  };
};
function overlap(a: Box2, b: Box2) {
  const axes: Array<[number, number]> = [
    a.u,
    [-a.u[1], a.u[0]],
    b.u,
    [-b.u[1], b.u[0]],
  ];
  const d = [b.c[0] - a.c[0], b.c[1] - a.c[1]];
  const radius = (box: Box2, n: [number, number]) =>
    box.h[0] * Math.abs(box.u[0] * n[0] + box.u[1] * n[1]) +
    box.h[1] * Math.abs(-box.u[1] * n[0] + box.u[0] * n[1]);
  return axes.every(
    (n) => Math.abs(d[0] * n[0] + d[1] * n[1]) < radius(a, n) + radius(b, n),
  );
}

type TrainState = {
  def: TrainDef;
  route: Route;
  head: number;
  speed: number;
  throttle: number;
  /** Driver's lever held: +1 faster forwards, −1 slower / backwards. */
  drive: -1 | 0 | 1;
  status: TrainStatus;
  reason?: string;
  odometer: number;
  rest: Array<{ frame: Transform; inverse: Transform; bogies: Transform[] }>;
  poses: CarPose[];
};
/** A motion guard: a reason to refuse this train's move, or undefined. */
export type TrainGuard = (
  trainId: string,
  before: CarPose[],
  after: CarPose[],
) => string | undefined;

/**
 * Deterministic train simulation: fixed ticks, no randomness, trains in id
 * order. All cars keep their route spacing (couplers hold), every bogie
 * follows the rail centreline and turns on its own pivot.
 */
export class TrainWorld {
  private trains: TrainState[] = [];
  private routes = new Map<number, 0 | 1>();
  private trailed = new Set<number>();
  tick = 0;
  constructor(readonly derived: DerivedTrains) {
    derived.graph.pieces.forEach((p, i) => {
      if (p.def.kind === "switch") this.routes.set(i, p.def.defaultRoute ?? 0);
    });
    for (const def of derived.trains) {
      const route = new Route(
        derived.graph,
        def.route.map((t) => ({ ...t })),
      );
      const state: TrainState = {
        def,
        route,
        head: def.head,
        speed: 0,
        throttle: 0,
        drive: 0,
        status: "stopped",
        odometer: 0,
        rest: [],
        poses: [],
      };
      state.poses = this.poses(state, state.head);
      state.rest = state.poses.map((pose) => ({
        frame: pose.frame,
        inverse: inverse(pose.frame),
        bogies: Object.values(pose.bogies).map((b) => inverse(b)),
      }));
      this.trains.push(state);
    }
  }
  get ids() {
    return this.trains.map((t) => t.def.id);
  }
  routeOf = (piece: number): 0 | 1 => this.routes.get(piece) ?? 0;
  private state(id?: string) {
    const t = id
      ? this.trains.find((x) => x.def.id === id)
      : this.trains.length === 1
        ? this.trains[0]
        : undefined;
    ensure(
      t,
      "INVALID_INPUT",
      id ? "Unknown train " + id : "Specify trainId when several trains run",
    );
    return t;
  }
  private poses(t: TrainState, head: number): CarPose[] {
    return t.def.cars.map((car) => {
      const front = t.route.at(head - car.pivots[0]),
        rear = t.route.at(head - car.pivots[1]);
      return {
        frame: pivotFrame(front, rear),
        bogies: Object.fromEntries(
          car.bogies.map((b) => {
            const at = t.route.at(head - b.offset);
            return [b.id, pivotFrame(at, at)];
          }),
        ),
      };
    });
  }
  /** Throttle −1..1 of full speed; negative runs backwards. */
  setThrottle(throttle: number, id?: string) {
    ensure(
      Number.isFinite(throttle) && Math.abs(throttle) <= 1,
      "INVALID_INPUT",
      "Throttle must be between -1 and 1",
    );
    const t = this.state(id);
    t.throttle = throttle;
    if (
      throttle !== 0 &&
      (t.status === "end-of-track" || t.status === "blocked")
    ) {
      t.status = "stopped";
      t.reason = undefined;
    }
  }
  /**
   * The driver's lever (W/S while riding): held at +1 the throttle notch
   * rises toward full speed forwards at the acceleration rate; held at −1 it
   * falls at the braking rate to zero, then on into reverse. Released (0),
   * the notch stays where it is, so the train holds its speed.
   */
  setDrive(drive: -1 | 0 | 1, id?: string) {
    ensure(
      drive === -1 || drive === 0 || drive === 1,
      "INVALID_INPUT",
      "Drive must be -1, 0 or 1",
    );
    const t = this.state(id);
    t.drive = drive;
    if (drive && (t.status === "end-of-track" || t.status === "blocked")) {
      t.status = "stopped";
      t.reason = undefined;
    }
  }
  /** Stop at once (emergency brake): no coasting. */
  stop(id?: string) {
    const t = this.state(id);
    t.throttle = 0;
    t.speed = 0;
    t.status = "stopped";
    t.reason = undefined;
  }
  switches() {
    return this.derived.graph.pieces
      .map((p, i) => ({ p, i }))
      .filter(({ p }) => p.def.kind === "switch");
  }
  /** Pieces some train's cars (with overhangs) currently cover. */
  private occupied() {
    const out = new Set<number>();
    for (const t of this.trains) {
      const lo = t.head - t.def.cars.at(-1)!.pivots[1] - t.def.rearOverhang,
        hi = t.head + t.def.frontOverhang;
      t.route.items.forEach((item, i) => {
        const a = t.route.starts[i],
          b = a + item.length;
        if (b > lo && a < hi) out.add(item.piece);
      });
    }
    return out;
  }
  setPoints(occurrenceId: string, route?: 0 | 1) {
    const i = this.derived.graph.pieces.findIndex(
      (p) => p.occurrenceId === occurrenceId,
    );
    ensure(
      i >= 0 && this.derived.graph.pieces[i].def.kind === "switch",
      "INVALID_INPUT",
      "Not a track switch in this world",
    );
    ensure(
      !this.occupied().has(i),
      "INVALID_INPUT",
      "A train is on these points",
    );
    const next = route ?? (this.routeOf(i) === 0 ? 1 : 0);
    this.routes.set(i, next);
    this.trailed.delete(i);
    return next;
  }
  /** Extend or trim the route to cover [lo, hi]; returns the reachable range. */
  private cover(t: TrainState, lo: number, hi: number) {
    while (t.route.length < hi) {
      const next = append(this.derived.graph, t.route.items.at(-1)!, (piece) =>
        this.routeOf(piece),
      );
      if (!next) break;
      // Trailing through a switch set the other way throws it over.
      const def = this.derived.graph.pieces[next.piece].def;
      const seg = def.segments[next.segment];
      if (def.kind === "switch" && seg.route !== undefined && !next.forward) {
        if (this.routeOf(next.piece) !== seg.route) {
          this.routes.set(next.piece, seg.route);
          this.trailed.add(next.piece);
        }
      }
      t.route.items.push(next);
      t.route.reindex();
      if (t.route.items.length > 2000) break;
    }
    while (lo < 0) {
      const before = prepend(this.derived.graph, t.route.items[0], (piece) =>
        this.routeOf(piece),
      );
      if (!before) break;
      const def = this.derived.graph.pieces[before.piece].def;
      const seg = def.segments[before.segment];
      if (def.kind === "switch" && seg.route !== undefined && before.forward) {
        if (this.routeOf(before.piece) !== seg.route) {
          this.routes.set(before.piece, seg.route);
          this.trailed.add(before.piece);
        }
      }
      t.route.items.unshift(before);
      t.route.reindex();
      t.head += before.length;
      lo += before.length;
      hi += before.length;
      if (t.route.items.length > 2000) break;
    }
    return { lo: 0, hi: t.route.length };
  }
  /** Drop track far behind and far ahead of the train (keeps routes small). */
  private trim(t: TrainState) {
    const tail = t.head - t.def.cars.at(-1)!.pivots[1] - t.def.rearOverhang;
    while (t.route.items.length > 1 && t.route.starts[1] < tail - 400) {
      const first = t.route.items.shift()!;
      t.route.reindex();
      t.head -= first.length;
    }
    const front = t.head + t.def.frontOverhang;
    while (t.route.items.length > 1 && t.route.starts.at(-1)! > front + 400) {
      t.route.items.pop();
      t.route.reindex();
    }
  }
  step(guard?: TrainGuard, dt = 1 / 60) {
    this.tick++;
    for (const t of this.trains) {
      if (t.drive) {
        // The notch moves at the rate the speed can follow, so the speed
        // tracks it and the slider shows the speed.
        const rate =
          (t.throttle === 0 || Math.sign(t.throttle) === t.drive
            ? TRAIN_LIMITS.acceleration
            : TRAIN_LIMITS.braking) / TRAIN_LIMITS.maxSpeed;
        let next = t.throttle + t.drive * rate * dt;
        // Braking stops at zero for a tick before running the other way.
        if (t.throttle !== 0 && Math.sign(next) !== Math.sign(t.throttle))
          next = 0;
        t.throttle = Math.max(-1, Math.min(1, next));
      }
      const target = t.throttle * TRAIN_LIMITS.maxSpeed;
      const accel =
        Math.sign(target - t.speed) === Math.sign(t.speed) || t.speed === 0
          ? TRAIN_LIMITS.acceleration
          : TRAIN_LIMITS.braking;
      const dv = target - t.speed,
        limit = accel * dt;
      t.speed += Math.abs(dv) <= limit ? dv : Math.sign(dv) * limit;
      if (Math.abs(t.speed) < 1e-9) t.speed = 0;
      if (t.speed === 0) {
        if (t.status === "running" || t.status === "waiting")
          t.status = "stopped";
        if (t.throttle === 0 && t.status !== "end-of-track")
          t.reason = undefined;
        continue;
      }
      const ds = t.speed * dt;
      const back = t.def.cars.at(-1)!.pivots[1] + t.def.rearOverhang;
      let next = t.head + ds;
      const reach = this.cover(
        t,
        next - back - 1,
        next + t.def.frontOverhang + 1,
      );
      next = t.head + ds; // cover() may have shifted head when prepending
      let stop: string | undefined;
      if (next + t.def.frontOverhang > reach.hi) {
        next = Math.max(t.head, reach.hi - t.def.frontOverhang);
        stop = "The track ends here";
      }
      if (next - back < reach.lo) {
        next = Math.min(t.head, reach.lo + back);
        stop = "The track ends here";
      }
      const before = t.poses,
        after = this.poses(t, next);
      // Other trains.
      const blocker = this.trains.find(
        (o) =>
          o !== t &&
          after.some((pose, i) =>
            o.poses.some((other, j) =>
              overlap(
                obb(t.def.cars[i], pose.frame),
                obb(o.def.cars[j], other.frame),
              ),
            ),
          ),
      );
      if (blocker) {
        t.speed = 0;
        t.status = "blocked";
        t.reason = `${blocker.def.name} is in the way`;
        continue;
      }
      const refused = guard?.(t.def.id, before, after);
      if (refused) {
        t.speed = 0;
        t.status = "waiting";
        t.reason = refused;
        continue;
      }
      t.odometer += Math.abs(next - t.head);
      t.head = next;
      t.poses = after;
      if (stop) {
        t.speed = 0;
        t.throttle = 0;
        t.status = "end-of-track";
        t.reason = stop;
      } else {
        t.status = "running";
        t.reason = undefined;
      }
      this.trim(t);
    }
  }
  /** World transforms of every train occurrence now. */
  transforms(): Record<string, Transform> {
    const out: Record<string, Transform> = {};
    for (const t of this.trains)
      t.def.cars.forEach((car, i) => {
        const pose = t.poses[i],
          rest = t.rest[i];
        const move = compose(pose.frame, rest.inverse);
        for (const id of car.occurrenceIds)
          out[id] = compose(move, car.restTransforms[id]);
        car.bogies.forEach((b, j) => {
          const m = compose(pose.bogies[b.id], rest.bogies[j]);
          for (const id of b.occurrenceIds)
            out[id] = compose(m, car.restTransforms[id]);
        });
      });
    return out;
  }
  /** Car frames now and at rest (for colliders built from rest geometry). */
  carFrames(id: string) {
    const t = this.state(id);
    return t.poses.map((p, i) => ({ now: p.frame, rest: t.rest[i].frame }));
  }
  report(): PlayTrainsReport {
    const occupied = this.occupied();
    return {
      trains: this.trains.map((t) => {
        const front = t.route.at(t.head);
        return {
          id: t.def.id,
          name: t.def.name,
          cars: t.def.cars.map((c) => ({
            id: c.id,
            locomotive: c.locomotive,
            parts:
              c.occurrenceIds.length +
              c.bogies.reduce((n, b) => n + b.occurrenceIds.length, 0),
            bogies: c.bogies.length,
          })),
          throttle: t.throttle,
          speed: Math.round(t.speed * 1000) / 1000,
          status: t.status,
          ...(t.reason ? { reason: t.reason } : {}),
          odometer: Math.round(t.odometer * 1000) / 1000,
          position: front.position.map(
            (v) => Math.round(v * 1000) / 1000,
          ) as Vec3,
          heading: [
            Math.round(front.tangent[0] * 1e6) / 1e6,
            0,
            Math.round(front.tangent[2] * 1e6) / 1e6,
          ] as Vec3,
          pieces: [
            ...new Set(
              t.route.items.map(
                (item) => this.derived.graph.pieces[item.piece].occurrenceId,
              ),
            ),
          ],
        };
      }),
      track: {
        pieces: this.derived.graph.pieces.length,
        gaps: structuredClone(this.derived.graph.gaps),
        deadEnds: this.derived.graph.deadEnds.length,
        skipped: structuredClone(this.derived.graph.skipped),
      },
      switches: this.switches().map(({ p, i }) => ({
        occurrenceId: p.occurrenceId,
        part: p.part,
        route: this.routeOf(i) === 0 ? "straight" : "branch",
        occupied: occupied.has(i),
        ...(this.trailed.has(i) ? { trailed: true } : {}),
        position: pieceAt(p, 0, p.lengths[0] / 2).position.map(
          (v) => Math.round(v * 1000) / 1000,
        ) as Vec3,
      })),
      skipped: structuredClone(this.derived.skipped),
      tick: this.tick,
    };
  }
}

export type PlayTrainsReport = {
  trains: Array<{
    id: string;
    name: string;
    cars: Array<{
      id: string;
      locomotive: boolean;
      parts: number;
      bogies: number;
    }>;
    /** −1..1 of full speed. */
    throttle: number;
    /** LDU/s along the track; negative is backwards. */
    speed: number;
    status: TrainStatus;
    reason?: string;
    /** LDU travelled. */
    odometer: number;
    /** Head pivot on the rail tops, world LDU. */
    position: Vec3;
    /** Travel direction at the head (forward). */
    heading: Vec3;
    /** Track occurrences on the train's current route. */
    pieces: string[];
  }>;
  track: {
    pieces: number;
    gaps: TrackGraph["gaps"];
    deadEnds: number;
    skipped: TrackGraph["skipped"];
  };
  switches: Array<{
    occurrenceId: string;
    part: string;
    route: "straight" | "branch";
    occupied: boolean;
    /** Thrown by a train running through it from the other side. */
    trailed?: boolean;
    position: Vec3;
  }>;
  skipped: TrainSkip[];
  tick: number;
};

/**
 * World bounds of part occurrences from the installed bounds table (the
 * curated pack, plus every complete-library part once its index is
 * registered), as automatic doors use them.
 */
export function occurrenceBounds(project: Project) {
  let sources: ReturnType<typeof projectBounds> | undefined;
  const local = new Map<string, Bounds | null>();
  return (o: Occurrence): Bounds | null => {
    let b = local.get(o.node.ref);
    if (b === undefined) {
      try {
        sources ??= projectBounds(
          project,
          installedBounds.bounds as unknown as Record<string, Bounds | null>,
          installedBounds.dependencies.transitive,
        );
        b = sources.model(o.node.ref);
      } catch {
        b = null;
      }
      local.set(o.node.ref, b);
    }
    return b ? transformBounds(b, o.transform) : null;
  };
}
