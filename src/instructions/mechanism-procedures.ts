/** Finite, source-reviewed Crane joint procedures. No snap or motion certificate. */
import { add, mv, physical } from "../core/math";
import { libraryLock } from "../catalog/catalog";
import { fullLibraryLock } from "../catalog/full-library";
import type { Occurrence, Project, Vec3 } from "../core/types";
import type { DisplayGroup, DisplayOperation } from "./display-procedures";
export const MECHANISM_SOURCE_SHA256: Record<string, string> = {
  "3315.dat":
    "512d5a1693c385c0912e3d0727c008031c0539b9e9b7115822021d389f27c7b2",
  "3597.dat":
    "7d81fe3e7a3743482a537e78ed9741adccd8b0dfdc78dc0f19ffa0a9710583f8",
  "3673.dat":
    "d846c8c80ecd254b61378e7a40b5b75b243be75de63b2458ac834de988c05b7b",
  "3700.dat":
    "6cb6522c580754cf970dad0fae688bb78cb3253a7237038dad83965fe47cfec6",
  "2350ap01.dat":
    "5a2c837c8411a0804d4acebd2a22b0682d22cce757852cb4402914ea22e589e4",
  "2350a.dat":
    "6e08b32b615103fc7632eb9964439da96f2427aa69c1390024b4159823c927a8",
  "s/2350s01.dat":
    "8273ac08c6409e5edeb39762f47d5ec2aaf3d079e61d2110bb28f1ada0717775",
  "s/2350s02.dat":
    "a20ddba148dc103497e6d7fa8da5d0f7b8c82a79f75db7ead947b96f809a411f",
  "connect.dat":
    "fa572d5b7bcdb19ea2ba74cd1a98aca913e1e556001232e484611915adf83305",
  "peghole.dat":
    "90c6dba9e5bcdd63955b9a5208f377761850863be9ed26cac7cd2be61ab85c92",
  "2-4cyli.dat":
    "d486780f0f84893899d9eadcd13150f13a42e15e77a3cda38cdf24ded98862c6",
  "4-4cyli.dat":
    "4a742c2765b6ebf98245baaf8a160a4ff587fc93d36c8ee2b9074712a2f968c4",
};
const point = (o: Occurrence, p: Vec3) =>
  add(o.transform.position, mv(o.transform.basis, p));
const gap = (a: Vec3, b: Vec3) => Math.hypot(...a.map((v, n) => v - b[n]));
const axis = (o: Occurrence, p: Vec3) => {
  const a = mv(o.transform.basis, p);
  return a.map((v) => v / Math.hypot(...a)) as Vec3;
};
const aligned = (a: Vec3, b: Vec3) => gap(a, b) < 0.002;
const sameParent = (a: Occurrence, b: Occurrence) =>
  JSON.stringify(a.path.slice(0, -1)) === JSON.stringify(b.path.slice(0, -1));
export function mechanismProfiles(
  project: Project,
  all: Occurrence[],
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
  const official = all.filter(
    (o) =>
      o.namespace === "official" &&
      o.node.kind === "part" &&
      physical(o.transform, 0.001),
  );
  let work = 0,
    exhausted = false;
  const scan = <T>(items: T[], matches: (item: T) => boolean) => {
    const found: T[] = [];
    for (const item of items) {
      if (++work > maxWork) {
        exhausted = true;
        break;
      }
      if (matches(item)) found.push(item);
    }
    return found;
  };
  const holders = official.filter((o) => o.node.ref === "3315.dat");
  for (const clip of official.filter((o) => o.node.ref === "3597.dat")) {
    const matches = scan(
      holders,
      (holder) =>
        sameParent(holder, clip) &&
        gap(point(holder, [0, 4, -56]), point(clip, [0, -4, -24])) <= 0.25 &&
        aligned(axis(holder, [1, 0, 0]), axis(clip, [1, 0, 0])) &&
        aligned(axis(holder, [0, -1, 0]), axis(clip, [0, 1, 0])),
    );
    if (exhausted) break;
    if (matches.length !== 1) continue;
    const holder = matches[0];
    groups.push({
      name: "Split-finger hinge source candidate",
      ids: [holder.id, clip.id],
      scene: false,
      edges: [[clip.id, holder.id]],
      operations: new Map<string, DisplayOperation>([
        [
          holder.id,
          {
            role: "hinge-holder",
            hostIds: [],
            span: 110,
            facing: axis(holder, [0.7, -0.7, -1]),
            notes:
              "Prepare the hinge plate with the split pivot and central gap. Keep a supplied joined hinge together. If the plates are loose, support this holder while comparing the complementary fingers in the next operation; the source drawing does not establish a safe snap procedure.",
          },
        ],
        [
          clip.id,
          {
            role: "hinge-clip",
            completedDetail: {
              occurrenceIds: [holder.id, clip.id],
              camera: {
                space: "ldraw",
                projection: "orthographic",
                target: point(holder, [0, 4, -56]),
                position: point(holder, [30, 144, -246]),
                up: axis(holder, [0, -1, 0]),
                span: 100,
                fovDeg: 45,
                near: 0.5,
                far: 500,
              },
            },
            camera: {
              space: "ldraw",
              projection: "orthographic",
              target: point(holder, [0, 4, -56]),
              position: point(holder, [90, -116, -196]),
              up: axis(holder, [0, -1, 0]),
              span: 135,
              fovDeg: 45,
              near: 0.5,
              far: 500,
            },
            hostIds: [holder.id],
            feature: point(holder, [0, 4, -56]),
            detailIds: [holder.id],
            span: 85,
            facing: axis(holder, [-0.5, -0.8, -1]),
            receivingFacing: axis(holder, [0.45, -0.7, -1]),
            landmarks: [-18, 18].map((x) => ({
              position: point(holder, [x, 0, -56]),
              caption:
                "Outer pivot surface beside the hinge fingers; fit unverified",
            })),
            notes:
              "Compare the incoming hinge plate's central and two outer clip fingers with the holder's split pivot. Keep an already joined pair intact. If loose, support both plates while checking the pictured orientation and finger engagement; do not force a snap. The close-up shows the bare holder before this addition. The completed-pair detail shows both hinge members with surrounding parts omitted; locate the joint in the main context. It does not demonstrate physical access. The camera change does not ask you to turn or rotate the physical hinge; clip travel, fit and holding remain unverified.",
          },
        ],
      ]),
    });
  }
  const pins = official.filter((o) => o.node.ref === "3673.dat"),
    bricks = official.filter((o) => o.node.ref === "3700.dat");
  for (const arm of official.filter((o) => o.node.ref === "2350ap01.dat")) {
    if (exhausted) break;
    const pairs: {
      pin: Occurrence;
      brick: Occurrence;
      side: number;
      mouth: Vec3;
    }[] = [];
    for (const side of [-1, 1]) {
      const mouth = point(arm, [side * 20, 10, 140]);
      const candidates = scan(
        pins,
        (pin) =>
          sameParent(arm, pin) &&
          gap(pin.transform.position, mouth) <= 0.25 &&
          aligned(axis(arm, [1, 0, 0]), axis(pin, [1, 0, 0])) &&
          aligned(axis(arm, [0, 1, 0]), axis(pin, [0, 1, 0])),
      );
      const receivers = scan(
        bricks,
        (brick) =>
          sameParent(arm, brick) &&
          gap(point(brick, [0, 10, -side * 10]), mouth) <= 0.25 &&
          aligned(axis(arm, [1, 0, 0]), axis(brick, [0, 0, 1])) &&
          aligned(axis(arm, [0, 1, 0]), axis(brick, [0, 1, 0])),
      );
      if (candidates.length === 1 && receivers.length === 1)
        pairs.push({ pin: candidates[0], brick: receivers[0], side, mouth });
    }
    if (exhausted) break;
    if (pairs.length !== 2) continue;
    const ids = [arm.id, ...pairs.flatMap((p) => [p.pin.id, p.brick.id])];
    const operations = new Map<string, DisplayOperation>([
      [
        arm.id,
        {
          role: "joint-arm",
          hostIds: [],
          span: 110,
          facing: axis(arm, [0.7, -0.65, 0.5]),
          notes:
            "Prepare this outer crane arm on a separate, supported workbench. Leave both Technic bricks loose while preparing the two pin joints. Support the long arm throughout; its final pose and the supplied source grouping do not establish detached stability.",
        },
      ],
    ]);
    for (const { pin, brick, side, mouth } of pairs) {
      operations.set(pin.id, {
        role: "joint-pin",
        hostIds: [arm.id],
        feature: mouth,
        landmarks: [
          {
            position: mouth,
            caption:
              "Arm bore mouth and final pin-collar position; seating unverified",
          },
        ],
        detailIds: [arm.id],
        span: 70,
        facing: axis(arm, [side, -0.3, 0.45]),
        notes:
          "Prepare this pin at the pictured arm bore, before the Technic brick on this side. Compare the central collar with the bore mouth: one half belongs inside the arm and the other remains exposed for the brick. Support the arm and pin while checking seating. The collar is wider than the interior bore, so do not try to push it through two already positioned recipients. The pin lips require physical fit review; no rigid insertion route or force is prescribed.",
      });
      operations.set(brick.id, {
        role: "joint-brick",
        hostIds: [arm.id, pin.id],
        feature: mouth,
        landmarks: [
          {
            position: mouth,
            occurrenceId: pin.id,
            caption:
              "Exposed pin half starts at this collar; brick seating unverified",
          },
        ],
        detailIds: [arm.id, pin.id],
        span: 75,
        facing: axis(arm, [side, -0.5, 0.45]),
        notes:
          "Compare this Technic brick's side hole with the exposed half of the preceding pin. Keep the arm and brick supported on this separate workbench while checking seating up to the collar. Leave the vehicle's studded supports out of this fitting action; the completed joint is mounted in a later operation. Do not assume the first pin holds the whole arm securely. Snap fit, retention and handling remain unverified.",
      });
    }
    groups.push({
      name: "Crane arm pin-joint candidate",
      ids,
      scene: false,
      edges: pairs.flatMap(
        ({ pin, brick }) =>
          [
            [pin.id, arm.id],
            [brick.id, pin.id],
          ] as [string, string][],
      ),
      operations,
      workbench: {
        ids,
        notes:
          "Compare the completed arm joint with the prior vehicle supports. Match both Technic brick undersides to the studded strips and the arm underside to the hinge plates. Support the long arm and both bricks while checking these interfaces together. No new parts. The drawing shows the final source pose; it does not prescribe a straight mounting route, hinge rotation or force. Mounting fit, access and temporary stability remain unverified.",
        facing: axis(arm, [0.7, -0.7, 0.4]),
      },
    });
  }
  const counts = new Map<string, number>();
  for (const group of groups)
    for (const id of group.ids) counts.set(id, (counts.get(id) ?? 0) + 1);
  return {
    groups: exhausted
      ? []
      : groups.filter((g) => g.ids.every((id) => counts.get(id) === 1)),
    exhausted,
  };
}
