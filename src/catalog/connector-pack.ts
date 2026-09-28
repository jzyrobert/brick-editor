// Compact encoding of connector lists in src/catalog/connectors.json.
// Upright studs (axis −Y) and downward-opening anti-studs (axis +Y) are stored
// as runs along x with a 20 LDU pitch: [kind, y, z, firstX, count]. Anything
// else (side studs, hinge pins and sockets) is stored explicitly:
// [kind, x, y, z, ax, ay, az]. Codes: s stud, a anti-stud, p hinge pin,
// h hinge socket.
import type { Vec3 } from "../core/types";

/** stud/pin are the male halves; antistud/socket the female ones. */
export type ConnectorKind = "stud" | "antistud" | "pin" | "socket";
export type Connector = { kind: ConnectorKind; p: Vec3; axis: Vec3 };
type Code = "s" | "a" | "p" | "h";
export type Run = [Code, number, number, number, number];
export type Explicit = [Code, number, number, number, number, number, number];
export type Encoded = { runs: Run[]; other?: Explicit[] };

const codes: Record<ConnectorKind, Code> = {
  stud: "s",
  antistud: "a",
  pin: "p",
  socket: "h",
};
const code = (k: ConnectorKind): Code => codes[k];
const kindOf = (c: Code): ConnectorKind =>
  (Object.keys(codes) as ConnectorKind[]).find((k) => codes[k] === c)!;
/** The kind a connector mates with. */
export const mateKind = (k: ConnectorKind): ConnectorKind =>
  k === "stud"
    ? "antistud"
    : k === "antistud"
      ? "stud"
      : k === "pin"
        ? "socket"
        : "pin";
/** Studs and pins are the male half of a connection. */
export const isMale = (k: ConnectorKind) => k === "stud" || k === "pin";
const upright = (c: Connector) =>
  (c.kind === "stud" || c.kind === "antistud") &&
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

/** Identity of the connector pack format and derivation (see build-connectors.ts). */
export const CONNECTOR_PACK_ID = "ldraw-derived-connectors-2";

export type OccupancyBox = { min: Vec3; max: Vec3 };
/** Occupancy boxes as one flat list: [minX, minY, minZ, maxX, maxY, maxZ, …]. */
export function encodeOccupancy(boxes: readonly OccupancyBox[]): number[] {
  return boxes.flatMap((b) => [...b.min, ...b.max]);
}
export function decodeOccupancy(flat: readonly number[]): OccupancyBox[] {
  const out: OccupancyBox[] = [];
  for (let i = 0; i + 5 < flat.length; i += 6)
    out.push({
      min: [flat[i], flat[i + 1], flat[i + 2]],
      max: [flat[i + 3], flat[i + 4], flat[i + 5]],
    });
  return out;
}
