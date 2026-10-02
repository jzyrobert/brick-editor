/** Narrow, source-reviewed axial hints; not connector or insertion validation. */
import { add, mv, physical } from "../core/math";
import type { Occurrence, Vec3 } from "../core/types";
export const AXIAL_PROFILES: Record<
  string,
  {
    role: "axle" | "bush";
    axis: Vec3;
    halfLength: number;
    sourceSha256: string;
  }
> = {
  "3705.dat": {
    role: "axle",
    axis: [1, 0, 0],
    halfLength: 40,
    sourceSha256:
      "ed90738971675e2dbd05b5a0aecaccf2da32e62b4e9085b886f084de890a853a",
  },
  "3706.dat": {
    role: "axle",
    axis: [1, 0, 0],
    halfLength: 60,
    sourceSha256:
      "a45710ed426e853ec856c7a13339ff0e1821d67ffc792b2d931ff57dafb01443",
  },
  "3707.dat": {
    role: "axle",
    axis: [1, 0, 0],
    halfLength: 80,
    sourceSha256:
      "e7843fe0f96ce7c6c99cd79bff5ee5d5493e438bfb822f00a739f900bf3374ae",
  },
  "3708.dat": {
    role: "axle",
    axis: [1, 0, 0],
    halfLength: 120,
    sourceSha256:
      "005c1a60fa620efe3ddadb388481ed06a4cee73d4dec7aad5509492c26941dbc",
  },
  "3713.dat": {
    role: "bush",
    axis: [0, 0, 1],
    halfLength: 10,
    sourceSha256:
      "2b813f30e7a6843cbd330035763f6ef904eafc8e7b5395c98332d07e8dfa1c43",
  },
  "4265a.dat": {
    role: "bush",
    axis: [0, 0, 1],
    halfLength: 5,
    sourceSha256:
      "c620aa9fa2510b275b17c90a26ee0bcd0e6453fe60f53cbf57f1bdab8a1fd0ea",
  },
};
type Item = {
  index: number;
  o: Occurrence;
  requires: Set<number>;
  eligible?: boolean;
};
type Operation = {
  role: "axle" | "bush";
  ends: [Vec3, Vec3];
  host?: number;
  coordinate?: number;
  unknownReason?: string;
};
const dot = (a: Vec3, b: Vec3) => a.reduce((n, v, i) => n + v * b[i], 0);
export function axialPrecedence(items: Item[]) {
  const edges = items.map(() => new Set<number>()),
    operations = new Map<number, Operation>(),
    groups = new Map<number, { index: number; t: number; half: number }[]>();
  let work = 0,
    exhausted = false,
    ambiguous = 0,
    conflicts = 0;
  const budget = 200000;
  const profiles = items.flatMap((i) => {
    const p = Object.hasOwn(AXIAL_PROFILES, i.o.node.ref)
      ? AXIAL_PROFILES[i.o.node.ref]
      : undefined;
    // Rounded OMR transforms may supply orientation hints without qualifying
    // for the strict connector graph. Never repair/overwrite source transforms.
    if (
      i.eligible === false ||
      !p ||
      i.o.namespace !== "official" ||
      i.o.node.kind !== "part" ||
      !physical(i.o.transform, 0.001)
    )
      return [];
    const vector = mv(i.o.transform.basis, p.axis),
      length = Math.hypot(...vector),
      axis = vector.map((v) => v / length) as Vec3;
    const ends = [-p.halfLength, p.halfLength].map((t) =>
      add(i.o.transform.position, vector.map((v) => v * t) as Vec3),
    ) as [Vec3, Vec3];
    operations.set(i.index, { role: p.role, ends });
    return [{ ...i, profile: p, axis }];
  });
  const axles = profiles.filter((i) => i.profile.role === "axle");
  for (const bush of profiles.filter((i) => i.profile.role === "bush")) {
    const matches: { axle: (typeof axles)[number]; t: number }[] = [];
    for (const axle of axles) {
      if (++work > budget) {
        exhausted = true;
        break;
      }
      if (Math.abs(dot(bush.axis, axle.axis)) < 0.999) continue;
      const delta = bush.o.transform.position.map(
          (v, a) => v - axle.o.transform.position[a],
        ) as Vec3,
        t = dot(delta, axle.axis);
      const radial = Math.hypot(...delta.map((v, a) => v - t * axle.axis[a]));
      if (
        radial <= 0.5 &&
        Math.abs(t) + bush.profile.halfLength <= axle.profile.halfLength + 0.5
      )
        matches.push({ axle, t });
    }
    const operation = operations.get(bush.index)!;
    if (exhausted || matches.length !== 1) {
      operation.unknownReason = exhausted
        ? "Axial matching reached its work budget."
        : matches.length
          ? "Several possible coaxial axles; choose the receiving axle manually."
          : "No unique receiving axle identified by this narrow profile family.";
      ambiguous++;
      continue;
    }
    const { axle, t } = matches[0],
      group = groups.get(axle.index) ?? [];
    group.push({ index: bush.index, t, half: bush.profile.halfLength });
    groups.set(axle.index, group);
  }
  const depends = (from: number, on: number) => {
    const seen = new Set<number>(),
      q = [from];
    for (let n = 0; n < q.length; n++) {
      if (++work > budget) {
        exhausted = true;
        return true;
      }
      const at = q[n];
      if (at === on) return true;
      if (seen.has(at)) continue;
      seen.add(at);
      q.push(...items[at].requires, ...edges[at]);
    }
    return false;
  };
  for (const [host, group] of groups) {
    const proposed: [number, number][] = group.map((b) => [b.index, host]);
    let overlap = false;
    for (const sign of [-1, 1]) {
      const side = group
        .filter((b) => Math.sign(b.t) === sign)
        .sort((a, b) => Math.abs(a.t) - Math.abs(b.t) || a.index - b.index);
      for (let n = 1; n < side.length; n++) {
        const inner = side[n - 1],
          outer = side[n];
        if (
          Math.abs(outer.t) - outer.half <
          Math.abs(inner.t) + inner.half - 0.5
        )
          overlap = true;
        else proposed.push([outer.index, inner.index]);
      }
    }
    const added: [number, number][] = [];
    let conflict = overlap;
    if (!conflict)
      for (const [from, on] of proposed) {
        if (depends(on, from)) {
          conflict = true;
          break;
        }
        edges[from].add(on);
        added.push([from, on]);
      }
    if (conflict) {
      for (const [from, on] of added) edges[from].delete(on);
      conflicts++;
      for (const b of group)
        operations.get(b.index)!.unknownReason =
          "Axial order conflicts with support/access evidence or overlapping collars; review this mechanism manually.";
    } else
      for (const b of group)
        Object.assign(operations.get(b.index)!, { host, coordinate: b.t });
  }
  return { edges, operations, ambiguous, conflicts, exhausted };
}
