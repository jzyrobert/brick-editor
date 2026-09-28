// Compact encoding of connector lists in src/catalog/connectors.json.
// Upright studs (axis −Y) and downward-opening anti-studs (axis +Y) are stored
// as runs along x with a 20 LDU pitch: [kind, y, z, firstX, count]. Anything
// else is stored explicitly: [kind, x, y, z, ax, ay, az].
import type { Vec3 } from "../core/types";

export type ConnectorKind = "stud" | "antistud";
export type Connector = { kind: ConnectorKind; p: Vec3; axis: Vec3 };
type Code = "s" | "a";
export type Run = [Code, number, number, number, number];
export type Explicit = [Code, number, number, number, number, number, number];
export type Encoded = { runs: Run[]; other?: Explicit[] };

const code = (k: ConnectorKind): Code => (k === "stud" ? "s" : "a");
const kindOf = (c: Code): ConnectorKind => (c === "s" ? "stud" : "antistud");
const upright = (c: Connector) =>
  c.axis[0] === 0 &&
  c.axis[2] === 0 &&
  c.axis[1] === (c.kind === "stud" ? -1 : 1);

export function encodeConnectors(list: readonly Connector[]): Encoded {
  const groups = new Map<
    string,
    { k: Code; y: number; z: number; xs: number[] }
  >();
  const other: Explicit[] = [];
  for (const c of list) {
    if (!upright(c)) {
      other.push([code(c.kind), ...c.p, ...c.axis]);
      continue;
    }
    const key = code(c.kind) + "|" + c.p[1] + "|" + c.p[2];
    const g = groups.get(key) ?? {
      k: code(c.kind),
      y: c.p[1],
      z: c.p[2],
      xs: [],
    };
    g.xs.push(c.p[0]);
    groups.set(key, g);
  }
  const runs: Run[] = [];
  for (const g of groups.values()) {
    const xs = [...g.xs].sort((a, b) => a - b);
    let start = xs[0],
      n = 1;
    for (let i = 1; i <= xs.length; i++) {
      if (i < xs.length && Math.abs(xs[i] - (start + n * 20)) < 1e-6) n++;
      else {
        runs.push([g.k, g.y, g.z, start, n]);
        if (i < xs.length) {
          start = xs[i];
          n = 1;
        }
      }
    }
  }
  return other.length ? { runs, other } : { runs };
}

export function decodeConnectors(e: Encoded): Connector[] {
  const out: Connector[] = [];
  for (const [k, y, z, x0, n] of e.runs)
    for (let i = 0; i < n; i++)
      out.push({
        kind: kindOf(k),
        p: [x0 + i * 20, y, z],
        axis: k === "s" ? [0, -1, 0] : [0, 1, 0],
      });
  for (const [k, x, y, z, ax, ay, az] of e.other ?? [])
    out.push({ kind: kindOf(k), p: [x, y, z], axis: [ax, ay, az] });
  return out;
}
