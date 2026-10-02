/** Reviewed control and hand-grip source associations, never physical fit proof. */
import { add, mv, physical } from "../core/math";
import { libraryLock } from "../catalog/catalog";
import { fullLibraryLock } from "../catalog/full-library";
import type { Occurrence, Project, Vec3 } from "../core/types";
import type { DisplayGroup } from "./display-procedures";

export const INTERFACE_SOURCE_SHA256: Record<string, string> = {
  "4592.dat":
    "c2fac37c1ce2bc7ee7419585dc37bb47891abc82e32cbeb7d5c95bc463632544",
  "4593.dat":
    "8aaa1ad77c4fe3bd4dd8554470b8a78425d2265c432fd402fbe2c51b4ecd8512",
  "bump5000.dat":
    "e5421cb73e8e81827e5600317c1b08d8ec53cfc90912799e4f99cf2289e51d93",
  "3820.dat":
    "13959ac6763f2a1b5d8b076c99e73951b6eb9586ad486e32bf772a69a726f42f",
  "3899.dat":
    "c51265e779f13702e9f6397a2d3b4102181a502495ad08d67fbc92f5ecd1ceb8",
  "s/3899s01.dat":
    "6b10f2289992e88848761955e4e5abed1ab47820a11b2e23c85d51de6986ab6f",
  "3962b.dat":
    "b3ab6ccc7bd522ec3a95acb19ed97a1f43146c18378e37d30ee3dff10956b6a1",
  "2-4cylo.dat":
    "4fa9f597d775c7f15e3fc66f60e20d914134d13004b485488b7dbff684776232",
  "4-4cyli.dat":
    "4a742c2765b6ebf98245baaf8a160a4ff587fc93d36c8ee2b9074712a2f968c4",
};
const point = (o: Occurrence, p: Vec3) =>
  add(o.transform.position, mv(o.transform.basis, p));
const unit = (v: Vec3): Vec3 => v.map((x) => x / Math.hypot(...v)) as Vec3;
const axis = (o: Occurrence, p: Vec3) => unit(mv(o.transform.basis, p));
const dot = (a: Vec3, b: Vec3) => a.reduce((s, v, i) => s + v * b[i], 0);
const delta = (a: Vec3, b: Vec3): Vec3 => a.map((v, i) => v - b[i]) as Vec3;
const distance = (a: Vec3, b: Vec3) => Math.hypot(...delta(a, b));
const parent = (o: Occurrence) => JSON.stringify(o.path.slice(0, -1));
const gripCentre: Vec3 = [0, -0.8229, -9.8948];
// Inner half-cylinder in 3820.dat: explicit source axis, not the part's Y axis.
const gripAxis: Vec3 = [0, -10.64966, -2.75422];
// Look along the grip cylinder so the before view exposes its open C section.
// This is an illustration direction, not a physical insertion route.
const gripView: Vec3 = [0, -1, -0.25];
const handles: Record<string, [Vec3, Vec3]> = {
  "3962b.dat": [
    [0, -7, 0],
    [0, 7, 0],
  ],
  "3899.dat": [
    [0, 4, 20],
    [0, 18, 20],
  ],
};

export function interfaceProfiles(
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
  const official = occurrences.filter(
    (o) => o.namespace === "official" && o.node.kind === "part",
  );
  const controls = official.filter((o) => physical(o.transform, 0.001));
  const bases = controls.filter((o) => o.node.ref === "4592.dat");
  let work = 0,
    exhausted = false;
  for (const stick of controls.filter((o) => o.node.ref === "4593.dat")) {
    const matches: Occurrence[] = [];
    for (const base of bases) {
      if (++work > maxWork) {
        exhausted = true;
        break;
      }
      if (
        parent(base) === parent(stick) &&
        distance(base.transform.position, stick.transform.position) <= 0.5 &&
        dot(axis(base, [1, 0, 0]), axis(stick, [1, 0, 0])) >= 0.999 &&
        distance(
          delta(point(stick, [-2, 0, 0]), point(base, [-2, -2, 0])),
          mv(base.transform.basis, [0, 2, 0]),
        ) <= 0.5 &&
        distance(point(base, [-2, -2, 0]), point(stick, [-2, 0, 0])) <= 2.5
      )
        matches.push(base);
    }
    if (exhausted) break;
    if (matches.length !== 1) continue;
    const base = matches[0],
      feature = point(base, [-2, -2, 0]);
    const offset = distance(feature, point(stick, [-2, 0, 0]));
    groups.push({
      name: "Control lever source candidate",
      ids: [base.id, stick.id],
      scene: false,
      edges: [[stick.id, base.id]],
      operations: new Map([
        [
          base.id,
          {
            role: "control-base",
            hostIds: [],
            facing: axis(base, [0.5, -0.8, -1]),
            span: 65,
            notes:
              "Prepare the pictured control base. If the lever is supplied already assembled, keep the stick and base together; the separate source drawings do not ask you to dismantle it. Otherwise support the base for the next loose-stick operation. Placement, support and physical fit remain unverified.",
          },
        ],
        [
          stick.id,
          {
            role: "control-stick",
            hostIds: [base.id],
            feature,
            landmarks: [
              {
                position: feature,
                caption:
                  "Control-base slot bump; source landmark, pivot seating unverified",
              },
            ],
            detailIds: [base.id],
            facing: axis(base, [0.5, -0.8, -1]),
            span: 65,
            notes: `Use the pictured slot in this control base for the lever stick. Keep a supplied complete lever assembled; if loose, support the base while checking the stick's seating and permitted angle. The source pivot centres differ by ${offset.toFixed(1)} LDU; this is not a coaxial fit or snapping check. Do not force the parts to match the drawing.`,
          },
        ],
      ]),
    });
  }
  const figures = official.filter((o) => physical(o.transform, 0.02));
  const hands = figures.filter((o) => o.node.ref === "3820.dat");
  for (const prop of figures.filter((o) =>
    Object.hasOwn(handles, o.node.ref),
  )) {
    if (exhausted) break;
    const [start, end] = handles[prop.node.ref].map((v) => point(prop, v));
    const rod = delta(end, start),
      rodLength = Math.hypot(...rod),
      direction = unit(rod);
    const matches: { hand: Occurrence; gap: number; angle: number }[] = [];
    for (const hand of hands) {
      if (++work > maxWork) {
        exhausted = true;
        break;
      }
      if (parent(hand) !== parent(prop)) continue;
      const grip = point(hand, gripCentre),
        relative = delta(grip, start);
      const t = dot(relative, direction) / rodLength;
      // Match the finite cylindrical handle, never an infinite axis or body origin.
      if (t < 0 || t > 1) continue;
      const closest = start.map((v, i) => v + rod[i] * t) as Vec3;
      const gap = distance(grip, closest),
        alignment = Math.abs(dot(axis(hand, gripAxis), direction));
      if (gap <= 0.5 && alignment >= Math.cos((16 * Math.PI) / 180))
        matches.push({
          hand,
          gap,
          angle: (Math.acos(Math.min(1, alignment)) * 180) / Math.PI,
        });
    }
    if (exhausted) break;
    if (matches.length !== 1) continue;
    const { hand, gap, angle } = matches[0],
      feature = point(hand, gripCentre);
    const cup = prop.node.ref === "3899.dat";
    groups.push({
      name: cup ? "Cup grip source candidate" : "Radio grip source candidate",
      ids: [hand.id, prop.id],
      scene: false,
      edges: [[prop.id, hand.id]],
      operations: new Map([
        [
          prop.id,
          {
            role: "accessory",
            hostIds: [hand.id],
            feature,
            landmarks: [
              {
                position: feature,
                caption:
                  "Hand grip centre from source HELP; handle fit and retention unverified",
              },
            ],
            detailIds: [hand.id],
            facing: axis(prop, [1, -0.35, 0.45]),
            receivingFacing: axis(hand, gripView),
            span: 60,
            notes: `Use this ${cup ? "cup's cylindrical handle" : "radio's long cylindrical handle"} at the pictured hand grip. The bare-hand detail identifies this receiver before the accessory is present. Keep any supplied torso, arms and hands together; support the hand while checking handle seating and grip orientation. Source grip/handle axes differ by ${angle.toFixed(1)} degrees and their centre-line gap is ${gap.toFixed(1)} LDU. Physical fit and retention remain unverified; do not force the source pose.`,
          },
        ],
      ]),
    });
  }
  // Refuse two overlapping incoming objects competing for the same receiver.
  const count = new Map<string, number>();
  const key = (g: DisplayGroup) =>
    [...g.operations.values()]
      .filter((o) => o.feature)
      .map((o) => JSON.stringify([o.role, o.hostIds, o.feature]));
  for (const g of groups)
    for (const k of key(g)) count.set(k, (count.get(k) ?? 0) + 1);
  return {
    // A later unexamined incoming object can compete with an earlier match.
    // Reciprocal uniqueness is unproven until every relevant scan completes.
    groups: exhausted
      ? []
      : groups.filter((g) => key(g).every((k) => count.get(k) === 1)),
    exhausted,
  };
}
