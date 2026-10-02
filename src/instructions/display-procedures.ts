/** Narrow source landmarks for signs, shutter pivots and complete steering stands.
 * Display associations and precedence only; no manufactured fit or motion proof. */
import { add, mv, physical } from "../core/math";
import { libraryLock } from "../catalog/catalog";
import { fullLibraryLock } from "../catalog/full-library";
import type { Occurrence, Project, Vec3, CameraSpec } from "../core/types";
export const DISPLAY_PROCEDURE_SOURCE_SHA256: Record<string, string> = {
  "3853.dat":
    "179c02f18673c6446eda2d7995eea32b5dbc606f124bac9435ed0fbae05cd4e5",
  "3856.dat":
    "6c0df6beb2d299b7adbb0dd64cb047b791cbdf6293b7b434602712a8a873abce",
  "s/3856s02.dat":
    "867151164aa52cfa0344ba44d74505b825a6bec35921c5dbd04b13999fdfff8f",
  "3829c01.dat":
    "c4efe9f2b3ed960b822aaee6bea9dec4db3c7315afa3ca0d5b1496eed35433fa",
  "3829a.dat":
    "d55b794eaef00822478da85273c406406704767f0adc77bbd69be92f785c8e9b",
  "3823.dat":
    "0dd7f787b17c183150eaf6b9536a0c4671b98e4df9c6a556f667557bb2c2a7d0",
  "4213.dat":
    "701d376c761d99cb0d0ebc0f9cec9f807840da3303a11fae0f1313065d7a9826",
  "4214.dat":
    "07805df6d43dffbf49af15f147f9865ea091fbcd09bbbcf425098945f7bc043d",
  "3023.dat":
    "fa3eeab92b077488bae3dbc0fe974ef3327a77f130776d2965f13d3ebc22ab57",
  "3023b.dat":
    "42f96ca69f8a0b83a877f4e128e4143ce753d038b1074835edc5aca9a9954fc9",
  "3068bp05.dat":
    "b37fc6692ba06b50e59167aeee408e8ddbecabe1e236550fbd55b0b02a40cbad",
  "3068bp06.dat":
    "c02d54ae693e763ac25de47139cc581a8a85dd857f9806df88f135210d292a31",
  "s/3068bs01.dat":
    "b49ecb2e8e57d8ae4a64aa5e71713d769c2a5dc91f4611fbd3157fbc30a4c6c3",
  "4211.dat":
    "a3109c10a553c7e227e55955ec85937dc15f7243a9623e1d70d65c8e87c566d8",
  "stug2.dat":
    "e1dfe5f5e0c433cd406467d366d278518cde9d7e83cc5d4229c451adf52fcc71",
  "stug-2x2.dat":
    "16114159ea25719341a852d5403dc9982a6211f2fcb23f5c4c3eac05a2ad43f7",
};
export type DisplayOperation = {
  role:
    | "sign-base"
    | "sign-face"
    | "shutter"
    | "steering"
    | "control-base"
    | "control-stick"
    | "accessory"
    | "decoration"
    | "hinge-holder"
    | "hinge-clip"
    | "joint-arm"
    | "joint-pin"
    | "joint-brick";
  hostIds: string[];
  feature?: Vec3;
  landmarks?: { position: Vec3; caption: string; occurrenceId?: string }[];
  facing: Vec3;
  camera?: CameraSpec;
  completedDetail?: { occurrenceIds: string[]; camera: CameraSpec };
  receivingFacing?: Vec3;
  span: number;
  notes: string;
  detailIds?: string[];
};
export type DisplayGroup = {
  workbench?: { ids: string[]; notes: string; facing: Vec3 };
  name: string;
  ids: string[];
  scene: boolean;
  edges: [string, string][];
  operations: Map<string, DisplayOperation>;
};
const point = (o: Occurrence, p: Vec3) =>
  add(o.transform.position, mv(o.transform.basis, p));
const unit = (v: Vec3): Vec3 => v.map((x) => x / Math.hypot(...v)) as Vec3;
const axis = (o: Occurrence, p: Vec3) => unit(mv(o.transform.basis, p));
const dot = (a: Vec3, b: Vec3) => a.reduce((s, v, n) => s + v * b[n], 0);
const near = (a: Vec3, b: Vec3, t = 0.5) =>
  Math.hypot(...a.map((v, n) => v - b[n])) <= t;
const parent = (o: Occurrence) => JSON.stringify(o.path.slice(0, -1));
export function displayProfiles(
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
  );
  const eligibleSet = new Set(eligible);
  const sections = new Map<string, Occurrence[]>();
  for (const o of occurrences) {
    const key = parent(o),
      rows = sections.get(key) ?? [];
    rows.push(o);
    sections.set(key, rows);
  }
  const plates = new Set(["3023.dat", "3023b.dat"]),
    faces = new Set(["3068bp05.dat", "3068bp06.dat"]);
  for (const rows of sections.values()) {
    if (rows.length !== 2 || rows.some((o) => !eligibleSet.has(o))) continue;
    const base = rows.find((o) => plates.has(o.node.ref)),
      face = rows.find((o) => faces.has(o.node.ref));
    if (
      !base ||
      !face ||
      ![1, -1].some((sign) =>
        near(face.transform.position, point(base, [0, -8, sign * 10])),
      )
    )
      continue;
    if (
      [
        [1, 0, 0],
        [0, 1, 0],
        [0, 0, 1],
      ].some((v) => dot(axis(base, v as Vec3), axis(face, v as Vec3)) < 0.999)
    )
      continue;
    const facing = axis(face, [0, -1, 0]),
      ids = rows.map((o) => o.id);
    let model = project.models[project.rootModelId];
    for (const id of rows[0].path.slice(0, -1)) {
      const node = model.nodes.find((n) => n.id === id);
      if (node?.kind === "submodel") model = project.models[node.ref];
    }
    groups.push({
      name: model?.name ?? "Road sign candidate",
      ids,
      scene: true,
      edges: [[face.id, base.id]],
      operations: new Map([
        [
          base.id,
          {
            role: "sign-base",
            hostIds: [],
            facing,
            span: 90,
            notes:
              "Use this Plate 1 × 2 as the sign support. Hold it while adding the printed tile; the source pose does not establish a stable freestanding base.",
          },
        ],
        [
          face.id,
          {
            role: "sign-face",
            hostIds: [base.id],
            feature: point(base, [0, -4, 0]),
            landmarks: [-10, 10].map((x) => ({
              position: point(base, [x, -4, 0]),
              caption: "Sign support stud; source landmark, fit unverified",
            })),
            facing,
            span: 90,
            notes:
              "Fit the printed sign tile to the two pictured studs on the Plate 1 × 2. Match the printed face and edge alignment shown; support both pieces while checking seating. The source pose does not verify fit or a stable stance.",
          },
        ],
      ]),
    });
  }
  let work = 0,
    exhausted = false;
  const frames = eligible.filter((o) => o.node.ref === "3853.dat");
  for (const shutter of eligible.filter((o) => o.node.ref === "3856.dat")) {
    const matches: { frame: Occurrence; side: number }[] = [];
    for (const frame of frames) {
      if (++work > maxWork) {
        exhausted = true;
        break;
      }
      if (parent(frame) !== parent(shutter)) continue;
      if (dot(axis(frame, [0, 1, 0]), axis(shutter, [0, 1, 0])) < 0.999)
        continue;
      for (const side of [-1, 1])
        if (
          near(
            point(shutter, [0, 4, 0]),
            point(frame, [side * 40, 4, -12]),
            2.5,
          ) &&
          near(
            point(shutter, [0, 64, 0]),
            point(frame, [side * 40, 64, -12]),
            2.5,
          )
        )
          matches.push({ frame, side });
    }
    if (exhausted) break;
    if (matches.length !== 1) continue;
    const { frame, side } = matches[0],
      feature = point(frame, [side * 40, 34, -12]);
    const edges: [string, string][] = [[shutter.id, frame.id]];
    // Reviewed 1×2 caps immediately above this frame close the end region.
    for (const cap of eligible.filter(
      (o) => plates.has(o.node.ref) && parent(o) === parent(frame),
    )) {
      if (++work > maxWork) {
        exhausted = true;
        break;
      }
      if (dot(axis(cap, [0, 1, 0]), axis(frame, [0, 1, 0])) < 0.999) continue;
      const capTop = point(cap, [0, 8, 0]);
      if (near(capTop, point(frame, [0, 0, 0]), 0.5))
        edges.push([cap.id, shutter.id]);
    }
    if (exhausted) break;
    const offset = Math.hypot(
      ...point(shutter, [0, 4, 0]).map(
        (v, n) => v - point(frame, [side * 40, 4, -12])[n],
      ),
    );
    groups.push({
      name: "Window shutter candidate",
      ids: [shutter.id, frame.id],
      scene: false,
      edges,
      operations: new Map([
        [
          shutter.id,
          {
            role: "shutter",
            hostIds: [frame.id],
            feature,
            landmarks: [4, 64].map((y) => ({
              position: point(frame, [side * 40, y, -12]),
              caption: `${y === 4 ? "First" : "Second"} frame end region; source landmark, snapping unverified`,
            })),
            facing: axis(frame, [side * 0.25, -0.25, -1]),
            span: 100,
            detailIds: [frame.id],
            notes: `Add this shutter to the pictured side of the window frame before any covering cap. Align both end pivots with the two frame-end regions; hold the frame while checking seating and permitted movement. Source pivot centres differ by ${offset.toFixed(1)} LDU; This landmark match does not verify hinge seating or snapping. Do not force it to match the drawing.`,
          },
        ],
      ]),
    });
  }
  for (const stand of eligible.filter((o) => o.node.ref === "3829c01.dat")) {
    if (exhausted) break;
    // Both reviewed seats must match the raised studs of this car-base family.
    // stug2→stug-2x2 contributes ±10 X/Z at local [0,8,-20].
    const pair = [point(stand, [-10, 8, 0]), point(stand, [10, 8, 0])];
    const matches: { base: Occurrence; feature: Vec3; seats: Vec3[] }[] = [];
    for (const base of eligible.filter(
      (o) => o.node.ref === "4211.dat" && parent(o) === parent(stand),
    )) {
      if (++work > maxWork) {
        exhausted = true;
        break;
      }
      if (dot(axis(base, [0, 1, 0]), axis(stand, [0, 1, 0])) < 0.999) continue;
      const studs = [-10, 10].flatMap((x) =>
        [-30, -10].map((z) => point(base, [x, 8, z])),
      );
      const found = pair.map((p) => studs.filter((s) => near(s, p)));
      if (found.some((x) => x.length !== 1) || found[0][0] === found[1][0])
        continue;
      matches.push({
        base,
        seats: [found[0][0], found[1][0]],
        feature: found[0][0].map((v, n) => (v + found[1][0][n]) / 2) as Vec3,
      });
    }
    if (matches.length !== 1 || exhausted) continue;
    const { base, feature, seats } = matches[0],
      edges: [string, string][] = [[stand.id, base.id]];
    for (const closure of eligible.filter(
      (o) =>
        ["3823.dat", "4213.dat", "4214.dat"].includes(o.node.ref) &&
        parent(o) === parent(stand),
    )) {
      if (++work > maxWork) {
        exhausted = true;
        break;
      }
      if (
        Math.hypot(
          ...closure.transform.position.map(
            (v, n) => v - stand.transform.position[n],
          ),
        ) <= 110
      )
        edges.push([closure.id, stand.id]);
    }
    if (exhausted) break;
    groups.push({
      name: "Steering stand candidate",
      ids: [stand.id, base.id],
      scene: false,
      edges,
      operations: new Map([
        [
          stand.id,
          {
            role: "steering",
            hostIds: [base.id],
            feature,
            landmarks: seats.map((position) => ({
              position,
              caption:
                "Raised stud in car base; source seating candidate, fit unverified",
            })),
            facing: axis(stand, [0, -0.9, -0.6]),
            span: 110,
            detailIds: [base.id],
            notes:
              "Use the complete steering stand and wheel together before closing the cab. Align its two underside seats with the pictured raised stud pair in the car base; keep the wheel facing the seat. Support the base while checking seating. These source landmarks do not establish physical fit, fastening or a safe insertion route.",
          },
        ],
      ]),
    });
  }
  // A receiver region cannot explain two overlapping instances of the same
  // loose part. Reject both proposals rather than choosing an arbitrary winner.
  const counts = new Map<string, number>();
  const key = (g: DisplayGroup) =>
    [...g.operations.values()]
      .filter((o) => o.feature && o.hostIds.length)
      .map((o) => JSON.stringify([o.role, o.hostIds, o.feature]));
  for (const group of groups)
    for (const k of key(group)) counts.set(k, (counts.get(k) ?? 0) + 1);
  return {
    groups: exhausted
      ? []
      : groups.filter((g) => key(g).every((k) => counts.get(k) === 1)),
    exhausted,
  };
}
