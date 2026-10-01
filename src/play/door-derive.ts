import type { Vec3 } from "../core/types";

/**
 * Hinge derivation for official LDraw door leaves (maintainer build step and
 * pinned tests; the runtime reads the generated table). Coordinates are
 * part-local LDU with negative Y up.
 *
 * Rule "origin-edge": LDraw hinged parts are authored with the origin on the
 * rotation axis. A door leaf is a thin vertical slab; when the origin lies on
 * one width end of that slab, the hinge is the vertical line through it.
 *
 * Rule "hinge-pins": drop-down and cabinet doors whose origin belongs to their
 * container instead carry a symmetric pair of hinge-pin primitives whose axes
 * are collinear; the hinge is that shared axis.
 *
 * Rule "flap-edge": trapdoors and hatches are thin horizontal slabs with the
 * origin on one edge; the hinge is the horizontal line through it.
 *
 * Rule "connector-pins": leaves no geometric rule explains but whose derived
 * connector data (the complete library's connector pack) has hinge pins.
 *
 * Rule "flap-edge": trapdoors and hatches are thin horizontal slabs with the
 * origin on one edge; the hinge is the horizontal line through it.
 *
 * Rule "connector-pins": a leaf no geometric rule explains whose derived
 * connector data (the complete library's connector pack) has hinge pins.
 * Pins that agree with a geometric rule are recorded too, so Play prefers
 * the frame whose sockets hold them.
 *
 * LDraw carries no stop data, so every hinged entry swings up to 90 degrees;
 * Play decides the free direction from the surrounding build at runtime.
 */
export type DoorHinge = {
  part: string;
  title: string;
  rule: "origin-edge" | "hinge-pins" | "flap-edge" | "connector-pins";
  /** Upper and lower pin points from the verified connector pack, if any. */
  pins?: [Vec3, Vec3];
  /** Point on the hinge axis, part-local LDU (mid-height of the leaf). */
  pivot: Vec3;
  /** Unit hinge axis, part-local. */
  axis: Vec3;
  /** Unit direction from the hinge toward the free edge, part-local. */
  leaf: Vec3;
  /** Leaf width from the hinge to the free edge, LDU. */
  width: number;
  /** Leaf extent along the hinge axis, LDU. */
  height: number;
  maxOpenDegrees: number;
};
export type DoorExclusion = { part: string; title: string; reason: string };
export type DoorGeometry = {
  points: Vec3[];
  /** Hinge-pin primitive placements with their primitive Y axis. */
  pins: Array<{ ref: string; position: Vec3; axis: Vec3 }>;
};
const PIN =
  /(^|[\\/])(bump5000|[1-4]-4cyl[ioc]|[1-4]-4cylo|2-4cylo|axle|confric\d*|stud3|stud4)\.dat$/i;
/** Expand an LDraw file into its surface points and hinge-pin primitives. */
export function doorGeometry(
  read: (name: string) => string | undefined,
  ref: string,
): DoorGeometry {
  const cache = new Map<string, DoorGeometry>();
  const expand = (name: string, depth: number): DoorGeometry => {
    const key = name.toLowerCase().replaceAll("\\", "/");
    const hit = cache.get(key);
    if (hit) return hit;
    const out: DoorGeometry = { points: [], pins: [] };
    const text = depth > 24 ? undefined : read(key);
    if (text)
      for (const line of text.split(/\r?\n/)) {
        const t = line.trim().split(/\s+/);
        if (t[0] === "3" || t[0] === "4") {
          const n = Number(t[0]);
          const c = t.slice(2, 2 + 3 * n).map(Number);
          for (let i = 0; i < c.length; i += 3)
            out.points.push([c[i], c[i + 1], c[i + 2]]);
        } else if (t[0] === "1" && t.length >= 15) {
          const [x, y, z, a, b, c, d, e, f, g, h, i] = t
            .slice(2, 14)
            .map(Number);
          const sub = t.slice(14).join(" ");
          const apply = (p: Vec3): Vec3 => [
            a * p[0] + b * p[1] + c * p[2] + x,
            d * p[0] + e * p[1] + f * p[2] + y,
            g * p[0] + h * p[1] + i * p[2] + z,
          ];
          const child = expand(sub, depth + 1);
          for (const p of child.points) out.points.push(apply(p));
          for (const pin of child.pins)
            out.pins.push({
              ref: pin.ref,
              position: apply(pin.position),
              axis: normal([
                a * pin.axis[0] + b * pin.axis[1] + c * pin.axis[2],
                d * pin.axis[0] + e * pin.axis[1] + f * pin.axis[2],
                g * pin.axis[0] + h * pin.axis[1] + i * pin.axis[2],
              ]),
            });
          if (PIN.test(sub))
            out.pins.push({
              ref: sub.toLowerCase(),
              position: [x, y, z],
              axis: normal([b, e, h]),
            });
        }
      }
    // Deduplicate points to keep the closure bounded.
    const seen = new Set<string>();
    out.points = out.points.filter((p) => {
      const k = p.map((v) => Math.round(v * 100)).join(",");
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
    cache.set(key, out);
    return out;
  };
  return expand(ref, 0);
}
function normal(v: Vec3): Vec3 {
  const l = Math.hypot(...v) || 1;
  return v.map((x) => x / l) as Vec3;
}
/**
 * Whether an official part is a candidate hinged leaf, from its LDraw title
 * and category (the complete pack's catalogue). Candidates are then derived
 * from geometry; anything without a hinge is listed as an explained exclusion.
 * Doors of every kind (including ones "with Window"), window panes and
 * shutters, gates, trapdoors and hatches; never frames, glass or stickers.
 */
export function doorCandidate(title: string, category: string) {
  if (/^~moved to/i.test(title) || /sticker|^moved$/i.test(category))
    return false;
  // Frames, glazing, subparts that are not the whole leaf, and fixed parts.
  if (
    /\bframe\b|glass for|outline|counterweight|doorbell|door rail|\bholder\b|shutter holes|shutter tabs|\bopening\b|\bbase\b|- (?:upper|lower)\b|back plate|\bblock\b|level crossing|sticker/i.test(
      title,
    )
  )
    return false;
  if (/\btrap ?door\b/i.test(title)) return true;
  if (/\bgate\b/i.test(title))
    return ["Fence", "Bar", "Door", "Duplo"].includes(category);
  if (category === "Window") return /\b(pane|shutter)\b/i.test(title);
  const door = title.search(/\bdoors?\b/i);
  if (door < 0) return false;
  // "Cupboard … with Blue Doors (Complete)": an assembly holding its doors,
  // not a leaf.
  const withAt = title.search(/\bwith\b/i);
  if (withAt >= 0 && withAt < door) return false;
  // "Door" in a brick, plate, tile or dish title is a pattern or an opening.
  return !/^(brick|plate|tile|dish|slope|panel|wedge|minifig|baseplate|wall|window)\b/i.test(
    title.replace(/^[~=_|]+/, ""),
  );
}
const round = (v: number) => {
  const r = Math.round(v * 1000) / 1000;
  return Object.is(r, -0) ? 0 : r;
};
const roundVec = (v: Vec3) => v.map(round) as Vec3;
/** Derive a hinge from geometry, or explain why the part is not auto-hinged. */
export function deriveDoorHinge(
  part: string,
  title: string,
  geometry: DoorGeometry,
  /** Upright hinge pins from the derived connector pack, when it has them. */
  connector?: { axis: Vec3; pivot: Vec3; pins: [Vec3, Vec3] },
): DoorHinge | DoorExclusion {
  const hinge = deriveGeometricHinge(part, title, geometry);
  const p = geometry.points;
  if ("reason" in hinge) {
    if (!connector || p.length < 4 || hinge.reason.startsWith("Slides"))
      return hinge;
    // Leaf direction: from the axis towards the geometry's centre.
    const min = [0, 1, 2].map((k) => Math.min(...p.map((q) => q[k]))) as Vec3,
      max = [0, 1, 2].map((k) => Math.max(...p.map((q) => q[k]))) as Vec3;
    const along = min.map(
      (v, k) => (v + max[k]) / 2 - connector.pivot[k],
    ) as Vec3;
    const dot = along.reduce((s, v, k) => s + v * connector.axis[k], 0);
    const off = along.map((v, k) => v - dot * connector.axis[k]) as Vec3;
    if (Math.hypot(...off) < 4) return hinge;
    const leaf = normal(off);
    return {
      part,
      title,
      rule: "connector-pins",
      pins: connector.pins.map(roundVec) as [Vec3, Vec3],
      pivot: roundVec(connector.pivot),
      axis: roundVec(connector.axis),
      leaf: roundVec(leaf),
      width: round(
        Math.max(
          ...p.map((q) =>
            [0, 1, 2].reduce(
              (s, k) => s + (q[k] - connector.pivot[k]) * leaf[k],
              0,
            ),
          ),
        ),
      ),
      height: round(
        Math.hypot(
          ...connector.pins[0].map((v, k) => v - connector.pins[1][k]),
        ),
      ),
      maxOpenDegrees: 90,
    };
  }
  // Pins on the derived axis let Play prefer the frame they are seated in.
  const onAxis = (pin: Vec3) =>
    Math.hypot(
      ...[0, 1, 2].map((k) =>
        Math.abs(hinge.axis[k]) > 0.5 ? 0 : pin[k] - hinge.pivot[k],
      ),
    ) < 0.5;
  if (
    connector &&
    hinge.axis.every(
      (v, k) => Math.abs(Math.abs(v) - Math.abs(connector.axis[k])) < 1e-3,
    ) &&
    connector.pins.every(onAxis)
  )
    return { ...hinge, pins: connector.pins.map(roundVec) as [Vec3, Vec3] };
  return hinge;
}
function deriveGeometricHinge(
  part: string,
  title: string,
  geometry: DoorGeometry,
): DoorHinge | DoorExclusion {
  const exclude = (reason: string): DoorExclusion => ({ part, title, reason });
  if (/sliding|lift|portcullis|garage|roller|revolving/i.test(title))
    return exclude("Slides or lifts rather than swinging on a hinge");
  const p = geometry.points;
  if (p.length < 4) return exclude("No surface geometry");
  const min = [0, 1, 2].map((k) => Math.min(...p.map((q) => q[k]))) as Vec3,
    max = [0, 1, 2].map((k) => Math.max(...p.map((q) => q[k]))) as Vec3,
    ext = max.map((v, k) => v - min[k]) as Vec3;
  // Rule origin-edge: thin vertical slab with the origin on a width end.
  const thin = ext[0] <= ext[2] ? 0 : 2,
    wide = thin === 0 ? 2 : 0;
  const tol = 12;
  if (
    ext[1] >= 16 &&
    ext[wide] >= 16 &&
    ext[thin] <= 32 &&
    min[thin] - 1 <= 0 &&
    max[thin] + 1 >= 0
  ) {
    const atMin = min[wide] <= 1 && min[wide] >= -tol,
      atMax = max[wide] >= -1 && max[wide] <= tol;
    if (atMin !== atMax) {
      const leaf: Vec3 = [0, 0, 0];
      leaf[wide] = atMin ? 1 : -1;
      return {
        part,
        title,
        rule: "origin-edge",
        pivot: roundVec([0, (min[1] + max[1]) / 2, 0]),
        axis: [0, -1, 0],
        leaf,
        width: round(atMin ? max[wide] : -min[wide]),
        height: round(ext[1]),
        maxOpenDegrees: 90,
      };
    }
  }
  // Rule flap-edge: a thin horizontal slab (trapdoor, hatch) whose origin
  // lies on one edge; the hinge runs along that edge.
  if (
    ext[1] <= 24 &&
    ext[0] >= 16 &&
    ext[2] >= 16 &&
    min[1] - 1 <= 0 &&
    max[1] + 1 >= 0
  )
    for (const across of [0, 2]) {
      const along = across === 0 ? 2 : 0;
      if (min[along] - 1 > 0 || max[along] + 1 < 0) continue;
      const atMin = min[across] <= 1 && min[across] >= -tol,
        atMax = max[across] >= -1 && max[across] <= tol;
      if (atMin === atMax) continue;
      const leaf: Vec3 = [0, 0, 0],
        axis: Vec3 = [0, 0, 0],
        pivot: Vec3 = [0, 0, 0];
      leaf[across] = atMin ? 1 : -1;
      axis[along] = 1;
      pivot[along] = (min[along] + max[along]) / 2;
      return {
        part,
        title,
        rule: "flap-edge",
        pivot: roundVec(pivot),
        axis,
        leaf,
        width: round(atMin ? max[across] : -min[across]),
        height: round(ext[along]),
        maxOpenDegrees: 90,
      };
    }
  // Rule hinge-pins: two collinear pins symmetric across the leaf.
  const pins = geometry.pins;
  for (let i = 0; i < pins.length; i++)
    for (let j = i + 1; j < pins.length; j++) {
      const a = pins[i],
        b = pins[j];
      if (a.ref !== b.ref) continue;
      const along = [0, 2].find(
        (k) => Math.abs(Math.abs(a.axis[k]) - 1) < 1e-3,
      );
      if (along === undefined || Math.abs(Math.abs(b.axis[along]) - 1) > 1e-3)
        continue;
      // Pins across the leaf thickness are handles or studs, not hinges.
      const thinnest = [0, 1, 2].reduce((a, k) => (ext[k] < ext[a] ? k : a), 0);
      if (along === thinnest || ext[along] < 24) continue;
      const others = [0, 1, 2].filter((k) => k !== along);
      if (others.some((k) => Math.abs(a.position[k] - b.position[k]) > 0.01))
        continue;
      const span = Math.abs(a.position[along] - b.position[along]);
      if (span < ext[along] * 0.5) continue;
      const pivot = [...a.position] as Vec3;
      pivot[along] = (a.position[along] + b.position[along]) / 2;
      const center = min.map((v, k) => (v + max[k]) / 2) as Vec3;
      const toCenter = center.map((v, k) =>
        k === along ? 0 : v - pivot[k],
      ) as Vec3;
      const length = Math.hypot(...toCenter);
      if (length < 4) continue;
      const leaf = normal(toCenter);
      const axis: Vec3 = [0, 0, 0];
      axis[along] = 1;
      // Width: farthest leaf point from the axis along the leaf direction.
      const width = Math.max(
        ...p.map((q) =>
          [0, 1, 2].reduce((s, k) => s + (q[k] - pivot[k]) * leaf[k], 0),
        ),
      );
      return {
        part,
        title,
        rule: "hinge-pins",
        pivot: roundVec(pivot),
        axis,
        leaf: roundVec(leaf),
        width: round(width),
        height: round(ext[along]),
        maxOpenDegrees: 90,
      };
    }
  return exclude(
    "No hinge convention found: the origin is not on a leaf edge and no collinear hinge pins were found",
  );
}
