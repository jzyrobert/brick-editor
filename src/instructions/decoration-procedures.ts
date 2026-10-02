/** Reviewed finite source faces, not adhesive, connector or physical fit data. */
import { add, mv, physical } from "../core/math";
import { libraryLock } from "../catalog/catalog";
import { fullLibraryLock } from "../catalog/full-library";
import type { Occurrence, Project, Vec3 } from "../core/types";
import type { DisplayGroup } from "./display-procedures";

export const DECORATION_SOURCE_SHA256: Record<string, string> = {
  "195075b.dat":
    "f51325ef6ce79de8354cba49136c76b1eaae62ca041e205c7cb3570fd1c54f9c",
  "2362a.dat":
    "250ce4f6daffbc8ef489c0f9928b46137eb07d6c9165b73f671c64b758fe4758",
  "4215a.dat":
    "5399c992a3ca97fbeeb562949fc850b740bc25fa90946ffb791189fa347f18b3",
  "box5-12.dat":
    "e248d0caf0fa62ffa1fc7cbf8600b4ca4eef940504022825316f756d47b8c5ca",
};
const point = (o: Occurrence, v: Vec3) =>
  add(o.transform.position, mv(o.transform.basis, v));
const unit = (v: Vec3): Vec3 => v.map((x) => x / Math.hypot(...v)) as Vec3;
const axis = (o: Occurrence, v: Vec3) => unit(mv(o.transform.basis, v));
const dot = (a: Vec3, b: Vec3) => a.reduce((s, x, n) => s + x * b[n], 0);
const subtract = (a: Vec3, b: Vec3) => a.map((x, n) => x - b[n]) as Vec3;
const parent = (o: Occurrence) => JSON.stringify(o.path.slice(0, -1));
type Rect = { min: [number, number]; max: [number, number] };
const area = (r: Rect) =>
  Math.max(0, r.max[0] - r.min[0]) * Math.max(0, r.max[1] - r.min[1]);
const overlap = (a: Rect, b: Rect): Rect => ({
  min: [Math.max(a.min[0], b.min[0]), Math.max(a.min[1], b.min[1])],
  max: [Math.min(a.max[0], b.max[0]), Math.min(a.max[1], b.max[1])],
});
const footprint: Rect = { min: [-28, -19], max: [28, 19] };
const corners = (o: Occurrence, width: number) =>
  [-width, width].flatMap((x) =>
    [0, 72].map((y) => point(o, [x, y, 10])),
  ) as Vec3[];
const rect = (points: Vec3[], origin: Vec3, u: Vec3, v: Vec3): Rect => {
  const coordinates = points.map((p) => {
    const d = subtract(p, origin);
    return [dot(d, u), dot(d, v)];
  });
  return {
    min: [
      Math.min(...coordinates.map((p) => p[0])),
      Math.min(...coordinates.map((p) => p[1])),
    ],
    max: [
      Math.max(...coordinates.map((p) => p[0])),
      Math.max(...coordinates.map((p) => p[1])),
    ],
  };
};

/** Match only the reviewed sticker back rectangle and panel outer quads.
 * A sticker may bridge a seam: every contributing panel becomes a prerequisite.
 * Do not turn projected bounds into coverage for tilted faces or accept a
 * partial/overlapping union. Exhaustion discards all matches, including earlier
 * ones whose uniqueness could be invalidated by an unexamined duplicate. */
export function decorationProfiles(
  project: Project,
  occurrences: Occurrence[],
  maxWork = 200000,
) {
  const groups: DisplayGroup[] = [];
  if (!Number.isSafeInteger(maxWork) || maxWork < 0 || maxWork > 200000)
    return { groups, exhausted: true };
  if (
    project.library.releaseId !== libraryLock.releaseId ||
    project.library.manifestSha256 !== libraryLock.manifestSha256 ||
    project.library.full?.releaseId !== fullLibraryLock.releaseId ||
    project.library.full?.manifestSha256 !== fullLibraryLock.manifestSha256
  )
    return { groups, exhausted: false };
  const eligible = occurrences.filter(
      (o) =>
        o.namespace === "official" &&
        o.node.kind === "part" &&
        physical(o.transform, 0.001),
    ),
    stickers = eligible.filter((o) => o.node.ref === "195075b.dat"),
    panels = eligible.filter((o) =>
      ["2362a.dat", "4215a.dat"].includes(o.node.ref),
    );
  let work = 0;
  const spend = () => ++work <= maxWork;
  for (const sticker of stickers) {
    const origin = point(sticker, [0, 0, 0]),
      normal = axis(sticker, [0, -1, 0]),
      u = axis(sticker, [1, 0, 0]),
      v = axis(sticker, [0, 0, 1]),
      patches: { panel: Occurrence; rect: Rect }[] = [];
    for (const panel of panels) {
      if (!spend()) return { groups: [], exhausted: true };
      if (parent(sticker) !== parent(panel)) continue;
      if (dot(normal, axis(panel, [0, 0, 1])) < 0.999999) continue;
      // A rectangle projection is valid only for the same finite planar axes.
      const a = axis(panel, [1, 0, 0]),
        b = axis(panel, [0, 1, 0]);
      if (
        ![u, v].every((d) => [a, b].some((e) => Math.abs(dot(d, e)) > 0.999999))
      )
        continue;
      const face = corners(panel, panel.node.ref === "2362a.dat" ? 20 : 40);
      if (face.some((p) => Math.abs(dot(subtract(p, origin), normal)) > 0.05))
        continue;
      const patch = overlap(footprint, rect(face, origin, u, v));
      if (area(patch) > 0.01) patches.push({ panel, rect: patch });
    }
    if (!patches.length || patches.length > 4) continue;
    let ambiguous = false;
    for (let n = 0; n < patches.length; n++)
      for (const previous of patches.slice(0, n)) {
        if (!spend()) return { groups: [], exhausted: true };
        if (area(overlap(previous.rect, patches[n].rect)) > 0.01)
          ambiguous = true;
      }
    if (
      ambiguous ||
      Math.abs(
        patches.reduce((s, p) => s + area(p.rect), 0) - area(footprint),
      ) > 0.01
    )
      continue;
    // Competing stickers on the same face are ambiguous even if a later one
    // lacks a complete panel match. Non-overlapping decorations can coexist.
    for (const other of stickers) {
      if (!spend()) return { groups: [], exhausted: true };
      if (other === sticker || parent(other) !== parent(sticker)) continue;
      if (dot(normal, axis(other, [0, -1, 0])) < 0.999999) continue;
      const otherPoints = [-28, 28].flatMap((x) =>
        [-19, 19].map((z) => point(other, [x, 0, z])),
      );
      if (
        otherPoints.every(
          (p) => Math.abs(dot(subtract(p, origin), normal)) <= 0.05,
        ) &&
        area(overlap(footprint, rect(otherPoints, origin, u, v))) > 0.01
      )
        ambiguous = true;
    }
    if (ambiguous) continue;
    // The common display compositor binds the centre landmark to the first
    // receiver. A seam-spanning footprint's centre need not lie on the first
    // panel in source order. Name its actual containing face, keeping every
    // contributing panel as an ordering/receiving prerequisite.
    const centreHost = patches.find(
      (p) => p.rect.min.every((v) => v <= 0) && p.rect.max.every((v) => v >= 0),
    );
    if (!centreHost) continue;
    const hosts = [
        centreHost.panel.id,
        ...patches.filter((p) => p !== centreHost).map((p) => p.panel.id),
      ],
      faceNormal = axis(centreHost.panel, [0, 0, 1]),
      planeOffset = dot(
        subtract(point(centreHost.panel, [0, 0, 10]), origin),
        faceNormal,
      ),
      feature = add(origin, faceNormal.map((v) => v * planeOffset) as Vec3);
    groups.push({
      name: "Panel decoration candidate",
      ids: [sticker.id, ...hosts],
      scene: false,
      edges: hosts.map((id) => [sticker.id, id]),
      operations: new Map([
        [
          sticker.id,
          {
            role: "decoration",
            hostIds: hosts,
            feature,
            facing: normal,
            span: 100,
            detailIds: hosts,
            notes:
              (hosts.length > 1
                ? "Check this sticker's identity and arrow orientation against the pictured outer panel faces. Its source footprint crosses their seam: align and support both panels before applying it. The source drawing does not verify adhesion, sticker supply or seam retention."
                : "Check this sticker's identity and arrow orientation against the pictured outer panel face. Support the panel and align the sticker edges before applying it. The source drawing does not verify adhesion or sticker supply.") +
              " If already applied, keep it in place.",
          },
        ],
      ]),
    });
  }
  return { groups, exhausted: false };
}
