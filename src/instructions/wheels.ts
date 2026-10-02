/** Source-reviewed wheel families. Association is a geometric candidate, never a fit certificate. */
import { AXIAL_PROFILES } from "./axial";
import { add, mv, physical } from "../core/math";
import type { Occurrence, Project, Vec3 } from "../core/types";
import { libraryLock } from "../catalog/catalog";
import { fullLibraryLock } from "../catalog/full-library";

/** Reviewed top-level source bytes; pack updates must pass this provenance guard. */
export const WHEEL_SOURCE_SHA256: Record<string, string> = {
  "4624.dat":
    "bc24b27ad846b27401e4126cc45d06428c16199b1530faeb8d9082955b7150f0",
  "3641.dat":
    "43cff4c949bcffd76a7fa4d7139011344c066f0aeedc23f464223d654d33eef7",
  "4084.dat":
    "9891310c6b44f0363603f7ef0a1398444a8c1d19346f4bd4e998731418fd1a7f",
  "6014b.dat":
    "599027d23595722157bff6053e4864f8aba4d55547138c68891367f9e1c08d80",
  "56890.dat":
    "d7fdec95ce1036a213afe40db189c7457f031ba8ac258c34bd035678b2e53e70",
  "3482.dat":
    "16915287e15e21cd0d79fd8588e1a916761e1e0539bfe8c07615da8e1bddf327",
  "2346.dat":
    "d9c6cc4d561bbdb335f36e18f328f703b86bd3ec46f8c9cf0e10df169cfa5242",
  "93594.dat":
    "f222ca24d7ec5182ec38c8ea044e40d3e5bd47bfe439ed49aaf1349c454b2519",
  "51011.dat":
    "13880128f8eb0b9105d8d1956616dbea630740e335ae06874b2c83e5185f7d6d",
  "4600.dat":
    "9b1a5303143aebe44c66525a91ae3fc6ddd2bbf591d8f543e8a17a12f5062b81",
  "2441.dat":
    "5454396e9d319f611153bc8ecddaa0457810780ddb66d88e9c176003214906e3",
  "3749.dat":
    "45cc85e7a28f7d0f9cd8be2aaeba090d91e7aa54649344f19c8fa5dc81684985",
};
export const WHEEL_FAMILIES = [
  { rim: "4624.dat", tyre: "3641.dat", offset: 0 },
  { rim: "4624.dat", tyre: "4084.dat", offset: 0 },
  { rim: "6014b.dat", tyre: "56890.dat", offset: -6 },
  { rim: "3482.dat", tyre: "2346.dat", offset: 0 },
  { rim: "93594.dat", tyre: "51011.dat", offset: 0 },
] as const;
type Item = { index: number; o: Occurrence; component?: unknown };
export type WheelCandidate = {
  rim: number;
  tyre: number;
  host?: number;
  receiver?: { position: Vec3; axis: Vec3 };
};
const dot = (a: Vec3, b: Vec3) => a.reduce((s, v, n) => s + v * b[n], 0);
const unit = (a: Vec3) => a.map((v) => v / Math.hypot(...a)) as Vec3;
const delta = (a: Vec3, b: Vec3) => a.map((v, n) => v - b[n]) as Vec3;
export function wheelCandidates(items: Item[], library: Project["library"]) {
  // Profiles are reviewed against this build's validated packs; a document
  // pinned elsewhere cannot borrow their interface positions by filename.
  if (
    library.releaseId !== libraryLock.releaseId ||
    library.manifestSha256 !== libraryLock.manifestSha256 ||
    library.full?.releaseId !== fullLibraryLock.releaseId ||
    library.full?.manifestSha256 !== fullLibraryLock.manifestSha256
  )
    return {
      candidates: [] as WheelCandidate[],
      exhausted: false,
      unmatched: items.filter((i) =>
        WHEEL_FAMILIES.some((f) => f.tyre === i.o.node.ref),
      ).length,
    };
  let work = 0,
    exhausted = false;
  const eligible = items.filter(
    (i) =>
      !i.component &&
      i.o.namespace === "official" &&
      i.o.node.kind === "part" &&
      physical(i.o.transform, 0.001),
  );
  const rims = eligible.filter((i) =>
    WHEEL_FAMILIES.some((f) => f.rim === i.o.node.ref),
  );
  const tyres = eligible.filter((i) =>
    WHEEL_FAMILIES.some((f) => f.tyre === i.o.node.ref),
  );
  const proposed: WheelCandidate[] = [];
  for (const tyre of tyres) {
    const matches: Item[] = [];
    for (const rim of rims) {
      if (++work > 200000) {
        exhausted = true;
        break;
      }
      const family = WHEEL_FAMILIES.find(
        (f) => f.rim === rim.o.node.ref && f.tyre === tyre.o.node.ref,
      );
      if (!family) continue;
      const axis = unit(mv(rim.o.transform.basis, [0, 0, 1]));
      const other = unit(mv(tyre.o.transform.basis, [0, 0, 1]));
      if (Math.abs(dot(axis, other)) < 0.999) continue;
      const d = delta(
        tyre.o.transform.position,
        add(
          rim.o.transform.position,
          axis.map((v) => v * family.offset) as Vec3,
        ),
      );
      // Small authored OMR rounding/placement discrepancies remain reviewable;
      // neither a match nor this tolerance creates a connector or physical fit.
      if (Math.hypot(...d) <= 1.5) matches.push(rim);
    }
    if (exhausted) break;
    if (matches.length === 1)
      proposed.push({ rim: matches[0].index, tyre: tyre.index });
  }
  const counts = new Map<number, number>();
  for (const c of proposed) counts.set(c.rim, (counts.get(c.rim) ?? 0) + 1);
  const candidates = proposed.filter((c) => counts.get(c.rim) === 1);
  const hosts = eligible.filter(
    (i) =>
      ["4600.dat", "2441.dat", "3749.dat"].includes(i.o.node.ref) ||
      AXIAL_PROFILES[i.o.node.ref]?.role === "axle",
  );
  for (const c of candidates) {
    const rim = items[c.rim],
      axis = unit(mv(rim.o.transform.basis, [0, 0, 1]));
    const matches: { host: number; position: Vec3; axis: Vec3 }[] = [];
    for (const host of hosts) {
      if (++work > 200000) {
        exhausted = true;
        break;
      }
      const profile = AXIAL_PROFILES[host.o.node.ref];
      const axleRim = rim.o.node.ref === "3482.dat";
      if (axleRim !== (!!profile || host.o.node.ref === "3749.dat")) continue;
      const hostAxis = unit(mv(host.o.transform.basis, [1, 0, 0]));
      if (Math.abs(dot(axis, hostAxis)) < 0.999) continue;
      const centres =
        profile || host.o.node.ref === "3749.dat"
          ? [host.o.transform.position]
          : (host.o.node.ref === "2441.dat" ? [-50, 50] : [0]).flatMap((z) =>
              [-22, 22].map((x) =>
                add(
                  host.o.transform.position,
                  mv(host.o.transform.basis, [x, 5, z]),
                ),
              ),
            );
      const found = centres.filter((p) => {
        const d = delta(rim.o.transform.position, p),
          t = dot(d, hostAxis);
        const radial = Math.hypot(...d.map((v, n) => v - t * hostAxis[n]));
        return (
          radial <= 1.5 &&
          (host.o.node.ref === "3749.dat"
            ? t >= 0 && t <= 22
            : Math.abs(t) <= (profile ? profile.halfLength + 16 : 14))
        );
      });
      if (found.length === 1) {
        const p = found[0],
          sign = dot(delta(rim.o.transform.position, p), hostAxis) < 0 ? -1 : 1;
        matches.push({
          host: host.index,
          position:
            host.o.node.ref === "3749.dat"
              ? add(p, hostAxis.map((v) => v * 10) as Vec3)
              : p,
          axis: hostAxis.map((v) => v * sign) as Vec3,
        });
      }
    }
    if (!exhausted && matches.length === 1) {
      c.host = matches[0].host;
      c.receiver = { position: matches[0].position, axis: matches[0].axis };
    }
  }
  return { candidates, exhausted, unmatched: tyres.length - candidates.length };
}
