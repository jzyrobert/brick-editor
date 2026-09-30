import { describe, expect, it } from "vitest";
import { fullLibrarySources } from "../../scripts/full-library-node";
import { doorGeometry } from "../../src/play/door-derive";
import {
  TRACK_PARTS,
  buildTrackGraph,
  enter,
  projectOnTrack,
  segmentAt,
  segmentLength,
  traversalAt,
  type TrackPartDef,
} from "../../src/play/track";
import type { Transform, Vec3 } from "../../src/core/types";
import { rotationY } from "../../src/core/math";
import { trackCandidates, trackJoins } from "../../src/edit/track-snap";

/** Triangles of a part (quads split), flattened through its subfiles. */
function faces(name: string) {
  const sources = fullLibrarySources([name]),
    out: Vec3[][] = [];
  const walk = (key: string, m: number[], depth: number) => {
    const text = depth > 24 ? undefined : sources[key];
    if (!text) return;
    const apply = (p: number[]): Vec3 => [
      m[0] + m[3] * p[0] + m[4] * p[1] + m[5] * p[2],
      m[1] + m[6] * p[0] + m[7] * p[1] + m[8] * p[2],
      m[2] + m[9] * p[0] + m[10] * p[1] + m[11] * p[2],
    ];
    for (const line of text.split(/\r?\n/)) {
      const t = line.trim().split(/\s+/);
      if (t[0] === "3" || t[0] === "4") {
        const c = t.slice(2, 2 + 3 * Number(t[0])).map(Number),
          p = [0, 3, 6, 9]
            .slice(0, Number(t[0]))
            .map((i) => apply(c.slice(i, i + 3)));
        out.push([p[0], p[1], p[2]]);
        if (p[3]) out.push([p[0], p[2], p[3]]);
      } else if (t[0] === "1" && t.length >= 15) {
        const v = t.slice(2, 14).map(Number),
          // Compose m · v (position then row-major basis).
          b = [m[3], m[4], m[5], m[6], m[7], m[8], m[9], m[10], m[11]],
          c = [v[3], v[4], v[5], v[6], v[7], v[8], v[9], v[10], v[11]];
        const r = [0, 1, 2].flatMap((i) =>
          [0, 1, 2].map(
            (j) =>
              b[i * 3] * c[j] +
              b[i * 3 + 1] * c[3 + j] +
              b[i * 3 + 2] * c[6 + j],
          ),
        );
        walk(
          t.slice(14).join(" ").toLowerCase().replaceAll("\\", "/"),
          [...apply(v.slice(0, 3)), ...r],
          depth + 1,
        );
      }
    }
  };
  walk(name, [0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1], 0);
  return out;
}
/** Rail-head top faces: every vertex within 1.5 LDU of the rail top. */
const railTops = (def: TrackPartDef) =>
  faces(def.part + ".dat").filter((f) =>
    f.every((p) => Math.abs(p[1] - def.railTop) < 1.5),
  );
const inside = (f: Vec3[], x: number, z: number) => {
  const s = (a: Vec3, b: Vec3) =>
    (b[0] - a[0]) * (z - a[2]) - (b[2] - a[2]) * (x - a[0]);
  const d = [s(f[0], f[1]), s(f[1], f[2]), s(f[2], f[0])];
  return d.every((v) => v >= -1e-6) || d.every((v) => v <= 1e-6);
};
const place = (position: Vec3, deg = 0, mirror = false): Transform => {
  const b = rotationY(deg);
  if (mirror) {
    b[2] = -b[2];
    b[5] = -b[5];
    b[8] = -b[8];
  }
  return { position, basis: b };
};

describe("track centrelines from the official geometry", () => {
  it("ends and primitives join smoothly", () => {
    for (const def of Object.values(TRACK_PARTS))
      for (const seg of def.segments) {
        const L = segmentLength(seg),
          [x0, z0, tx0, tz0] = segmentAt(seg, 0),
          [x1, z1, tx1, tz1] = segmentAt(seg, L),
          a = def.ends[seg.ends[0]],
          b = def.ends[seg.ends[1]];
        expect([x0, z0][0], def.part).toBeCloseTo(a.position[0], 2);
        expect(z0, def.part).toBeCloseTo(a.position[1], 2);
        expect(tx0, def.part).toBeCloseTo(-a.direction[0], 4);
        expect(tz0, def.part).toBeCloseTo(-a.direction[1], 4);
        expect(x1, def.part).toBeCloseTo(b.position[0], 2);
        expect(z1, def.part).toBeCloseTo(b.position[1], 2);
        expect(tx1, def.part).toBeCloseTo(b.direction[0], 4);
        expect(tz1, def.part).toBeCloseTo(b.direction[1], 4);
        // No kink between primitives.
        for (let s = 0; s + 1 <= L; s += 1) {
          const p = segmentAt(seg, s),
            q = segmentAt(seg, s + 1);
          expect(Math.hypot(q[0] - p[0], q[1] - p[1])).toBeCloseTo(1, 2);
          expect(Math.abs(q[2] - p[2]) + Math.abs(q[3] - p[3])).toBeLessThan(
            0.01,
          );
        }
      }
  });

  it("pins the published numbers", () => {
    const c = TRACK_PARTS["53400"];
    expect(c.ends[1].position[0]).toBeCloseTo(156.0723, 3);
    expect(c.ends[1].position[1]).toBeCloseTo(-15.3718, 3);
    expect(segmentLength(c.segments[0])).toBeCloseTo(314.16, 2);
    expect(segmentLength(TRACK_PARTS["53401"].segments[0])).toBe(320);
    const sw = TRACK_PARTS["75541-f1"];
    expect(sw.ends[2].position[0]).toBeCloseTo(333.853, 3);
    expect(sw.ends[2].position[1]).toBeCloseTo(-259.104, 3);
    expect(TRACK_PARTS["75542-f1"].ends[2].position[1]).toBeCloseTo(259.104, 3);
    // The diverging route: two R40 arcs, 36.87° out and 14.37° back.
    expect(segmentLength(sw.segments[1])).toBeCloseTo(
      800 * (2 * Math.asin(0.6) - Math.PI / 8),
      3,
    );
  });

  // Every rail head of every supported part lies on a rail line 50 LDU
  // either side of its centreline, and every centreline has both rails.
  it.each(Object.keys(TRACK_PARTS))(
    "%s: rail heads lie 50 LDU either side of the centreline",
    (part) => {
      const def = TRACK_PARTS[part],
        tops = railTops(def);
      expect(tops.length, "rail-top faces").toBeGreaterThan(8);
      // Coverage: both rails exist along the whole of every route: the
      // point 50 LDU either side of the centreline is on a rail-top face
      // (within 1.5 LDU across).
      for (const seg of def.segments) {
        const L = segmentLength(seg);
        let missing = 0,
          samples = 0;
        for (let s = 4; s <= L - 4; s += 4) {
          const [x, z, tx, tz] = segmentAt(seg, s);
          for (const side of [-1, 1]) {
            samples++;
            const hit = [-1.5, 0, 0.5, 1.5].some((d) => {
              const r = 50 + d,
                rx = x - tz * r * side,
                rz = z + tx * r * side;
              return tops.some((f) => inside(f, rx, rz));
            });
            if (!hit) missing++;
          }
        }
        // A switch's frog and tongue tips break each rail for a few LDU.
        expect(missing / samples, `${part} route ${seg.ends}`).toBeLessThan(
          def.kind === "switch" ? 0.06 : 0.01,
        );
      }
      // Precision: rail-head vertices sit on the rail lines (±4.5 LDU across
      // the 6 LDU head and the 9V rails' 50.5 offset).
      let near = 0;
      const vertices = tops.flat();
      for (const p of vertices) {
        let best = Infinity;
        for (const seg of def.segments) {
          const L = segmentLength(seg);
          for (let s = 0; s <= L; s += 2) {
            const [x, z] = segmentAt(seg, s);
            best = Math.min(
              best,
              Math.abs(Math.hypot(p[0] - x, p[2] - z) - 50),
            );
          }
        }
        if (best <= 4.5) near++;
      }
      expect(near / vertices.length).toBeGreaterThan(
        def.kind === "switch" ? 0.85 : 0.95,
      );
    },
    60000,
  );
});

describe("rail graph", () => {
  // An R40 circle of 16 curves, each rotated 22.5° about the circle's centre.
  const circle = (centre: Vec3, deg0 = 0) =>
    Array.from({ length: 16 }, (_, i) => {
      const a = ((deg0 + i * 22.5) * Math.PI) / 180;
      const t = place(
        [
          centre[0] + 800 * Math.sin(a),
          centre[1],
          centre[2] + 800 * Math.cos(a),
        ],
        deg0 + i * 22.5,
      );
      return { id: `c${i}`, ref: "53400.dat", transform: t };
    });
  it("closes a circle of rotated curves", () => {
    const g = buildTrackGraph(circle([0, -8, 0], 7));
    expect(g.pieces).toHaveLength(16);
    expect(g.gaps).toEqual([]);
    expect(g.deadEnds).toEqual([]);
    expect(g.pieces.every((p) => p.links.every(Boolean))).toBe(true);
  });
  it("joins rotated pieces and reports gaps and dead ends", () => {
    const g = buildTrackGraph([
      { id: "a", ref: "53401.dat", transform: place([0, -8, 0]) },
      { id: "b", ref: "53401.dat", transform: place([320, -8, 0], 180) },
      { id: "d", ref: "53401.dat", transform: place([-330, -8, 0]) },
    ]);
    const [a, b, d] = g.pieces;
    expect(a.links[1]).toEqual({ piece: 1, end: 1 });
    expect(b.links[0]).toBeUndefined();
    expect(d.links[1]).toBeUndefined();
    expect(g.gaps).toEqual([
      {
        a: { occurrenceId: "a", end: 0 },
        b: { occurrenceId: "d", end: 1 },
        distance: 10,
        angle: 0,
      },
    ]);
    expect(g.deadEnds.map((e) => e.occurrenceId).sort()).toEqual(["b", "d"]);
  });
  it("follows a mirrored switch: a mirrored right switch branches left", () => {
    const g = buildTrackGraph([
      { id: "s", ref: "75541-f1.dat", transform: place([0, -8, 0], 0, true) },
      { id: "l", ref: "75542-f1.dat", transform: place([0, -8, 1000]) },
    ]);
    const mirrored = g.pieces[0].ends[2],
      left = g.pieces[1].ends[2];
    expect(mirrored.position[0]).toBeCloseTo(333.853, 2);
    expect(mirrored.position[2]).toBeCloseTo(259.104, 2);
    expect(left.position[2] - 1000).toBeCloseTo(259.104, 2);
    expect(mirrored.direction[2]).toBeCloseTo(left.direction[2], 5);
    const branch = enter(g, 0, 0, 1)!,
      mid = traversalAt(g, branch, branch.length / 2);
    expect(mid.position[2]).toBeGreaterThan(0);
  });
  it("skips track that is not upright", () => {
    const g = buildTrackGraph([
      {
        id: "x",
        ref: "53401.dat",
        transform: {
          position: [0, 0, 0],
          basis: [1, 0, 0, 0, -1, 0, 0, 0, -1],
        },
      },
    ]);
    expect(g.pieces).toHaveLength(0);
    expect(g.skipped[0].reason).toMatch(/rails on top/);
  });
  it("projects points and walks a switch by its route", () => {
    const g = buildTrackGraph([
      { id: "s", ref: "75541-f1.dat", transform: place([0, -8, 0]) },
    ]);
    const p = projectOnTrack(g, [100, -30, 3])!;
    expect(p.lateral).toBeCloseTo(3, 5);
    expect(p.railY).toBeCloseTo(-24, 5);
    const straight = enter(g, 0, 0, 0)!,
      branch = enter(g, 0, 0, 1)!;
    expect(straight.segment).toBe(0);
    expect(branch.segment).toBe(1);
    const end = traversalAt(g, branch, branch.length);
    expect(end.position[0]).toBeCloseTo(333.853, 2);
    expect(end.position[2]).toBeCloseTo(-259.104, 2);
    // Entering from the diverging end can only go back to the common end.
    const back = enter(g, 0, 2, 0)!;
    expect(back.segment).toBe(1);
    expect(back.forward).toBe(false);
  });
});

describe("track snapping in the editor", () => {
  const occupant = (id: string, ref: string, transform: Transform) => ({
    occurrenceId: id,
    ref,
    transform,
    world: {
      min: [-1e5, -1e5, -1e5] as Vec3,
      max: [1e5, 1e5, 1e5] as Vec3,
    },
    boxes: [],
  });
  it("offers a straight joined at the nearest free rail end", () => {
    const scene = [occupant("a", "53401.dat", place([0, -8, 0]))];
    const fits = trackCandidates("53401.dat", { point: [200, 0, 10] }, scene);
    // Either end of the new straight meets the end at x = 160 the same way.
    expect(fits.length).toBe(1);
    expect(fits[0].position).toEqual([320, -8, 0]);
    expect(fits[0].targetIds).toEqual(["a"]);
    // Tapped in the middle, both free ends are in reach.
    const both = trackCandidates("53401.dat", { point: [0, 0, 0] }, scene);
    expect(both.map((f) => f.position[0]).sort((x, y) => x - y)).toEqual([
      -320, 320,
    ]);
  });
  it("offers a curve bending either way and a switch from any end", () => {
    const scene = [occupant("a", "53401.dat", place([0, -8, 0]))];
    const curves = trackCandidates("53400.dat", { point: [170, 0, 0] }, scene);
    expect(curves).toHaveLength(2);
    const sides = curves.map((f) => {
      const g = buildTrackGraph([
        { id: "a", ref: "53401.dat", transform: place([0, -8, 0]) },
        { id: "n", ref: "53400.dat", transform: f },
      ]);
      const free = g.pieces[1].ends.find((_, e) => !g.pieces[1].links[e])!;
      return Math.sign(free.position[2]);
    });
    expect(sides.sort()).toEqual([-1, 1]);
    const switches = trackCandidates(
      "75541-f1.dat",
      { point: [170, 0, 0] },
      scene,
    );
    expect(switches).toHaveLength(3);
  });
  it("never offers track lying on existing track", () => {
    const scene = [
      occupant("a", "53401.dat", place([0, -8, 0])),
      occupant("b", "53401.dat", place([320, -8, 0])),
    ];
    // The joint at x = 160 is taken: tapped there, nothing fits; near the
    // free end at 480 a straight continues the line.
    expect(trackCandidates("53401.dat", { point: [160, 0, 0] }, scene)).toEqual(
      [],
    );
    const fits = trackCandidates("53401.dat", { point: [420, 0, 0] }, scene);
    expect(fits.map((f) => f.position[0])).toEqual([640]);
    expect(
      trackJoins("53401.dat", place([640, -8, 0]), [
        { id: "a", ref: "53401.dat", transform: place([0, -8, 0]) },
        { id: "b", ref: "53401.dat", transform: place([320, -8, 0]) },
      ]),
    ).toEqual({ joined: ["b"], overlaps: false });
    expect(
      trackJoins("53401.dat", place([330, -8, 0]), [
        { id: "b", ref: "53401.dat", transform: place([320, -8, 0]) },
      ]).overlaps,
    ).toBe(true);
  });
});
