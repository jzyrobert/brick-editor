/** Narrow source-reviewed figure procedures. No connector or physical fit certificate. */
import { add, mv, physical } from "../core/math";
import { libraryLock } from "../catalog/catalog";
import { fullLibraryLock } from "../catalog/full-library";
import {
  sourcePrecedence,
  isolatedWorkbenchCandidates,
  type SourceGraphItem,
} from "./source-procedures";
import type { Occurrence, Project, Vec3 } from "../core/types";
export const FIGURE_SOURCE_SHA256: Record<string, string> = {
  "973.dat": "bc916535c228a21d472db6868c591d8e8c7a9c6340b300aba07a7ba22f972ad9",
  "973p1a.dat":
    "076b1f3e9ae0688ead65a4c3223e5ad8ffe289ac63ce410bb79e623f9a203beb",
  "973p1b.dat":
    "1acfef4b1824a3cf9a646aa0f982fc408e562f826f57b9f0896c6908d0612889",
  "973p1f.dat":
    "83a2efcd6e60c0d4955cec41c34749c4f5cb0d6c4b251b2d8aa752a2323a6a9c",
  "973p2a.dat":
    "35117460f8d2589f3a1aa558d8eac6e8bb6d3242ec248a1135d709541e1e4776",
  "973p2c.dat":
    "cf533348b5bb71e199ef6c10e3852f4c9cd4b9199c0520225d50982571d54b83",
  "973p90.dat":
    "486c22dd65c8ea92eec073dfce1cc3bcab1fa0c2259e9ee11f17abc65dff5df5",
  "3818.dat":
    "26c380709d59d175ef5441a3014aad60392b40f4c7c94db6651450b03b58d088",
  "3819.dat":
    "604c257daffba455d0a57523d7f2a36700a4ca25328714a555bf93d8f2c9b4cb",
  "3820.dat":
    "13959ac6763f2a1b5d8b076c99e73951b6eb9586ad486e32bf772a69a726f42f",
  "s/3818s01.dat":
    "285d429460a6f43d44aadbc190a6c9f43ddb368b0459683f982c1d1d83e36093",
  "3815.dat":
    "97817b8d90131f69072c3caaff606591ea96aa766f7ec8cd5b570e0bd2abca06",
  "3816.dat":
    "e8c09f1639b6ce3b38c975f44e71a1e3fb80fe61a37c96da63f8866eafd832bb",
  "3817.dat":
    "90510c11a90f6599bc14005e2a41b89cc625e71e41b5f8b54f62f44ffb9513fd",
  "3815c01.dat":
    "aa9b5ceb0176693142e13ed08b58b9d760a95d8176c535359da3e819477525e9",
  "3626bp01.dat":
    "1e61b90bc0c87bebd6dcf30d8fe96c47f22a9dabb49f93b1ba2daf6a2e89ac60",
  "3626bp03.dat":
    "d2db36e09b45f23435f98af7f1639004725c69bde6677e7046252f7a78b4b7a0",
  "3626bp08.dat":
    "732fd8feb906da8656dafb1c5a79f7a9c23c7e6885ae285ace5cf3e853bc17e4",
  "3626cp88.dat":
    "9162a1455ef2b5c81fd2c9b8a79ea8d75d92ead87f04d3a9562b6c3d869bb3c8",
  "3898.dat":
    "3a3cc9fe48c556cc906342e4a796b9148f4671c81d601cfd135e1ae55472c19f",
  "4485.dat":
    "254b1db0d3fe7f24ed08fb07a1028e48b3d4cfabedde527e47a71a716635c618",
  "6093a.dat":
    "2500f41235f9ad771d06556f86d035d14f9bffeafeffa7665ac989ead3f98cba",
  "3833.dat":
    "c79ea14c65f6dbb1bad766f76d0f754c981f76eee3b53181d2ca880be689c2f5",
  "3624.dat":
    "9ee2bf2cf9507ad7065e56ec491698fc5eac25c999b7fb076a66e1809e33d0de",
  "46303.dat":
    "c952af39099f740c021b0e635f8471293f65918294524a795790f91e8d5e6d03",
  "3899.dat":
    "c51265e779f13702e9f6397a2d3b4102181a502495ad08d67fbc92f5ecd1ceb8",
  "3962b.dat":
    "b3ab6ccc7bd522ec3a95acb19ed97a1f43146c18378e37d30ee3dff10956b6a1",
};
const torsos = new Set([
  "973.dat",
  "973p1a.dat",
  "973p1b.dat",
  "973p1f.dat",
  "973p2a.dat",
  "973p2c.dat",
  "973p90.dat",
]);
const heads = new Set([
  "3626bp01.dat",
  "3626bp03.dat",
  "3626bp08.dat",
  "3626cp88.dat",
]);
const headgear = new Set([
  "3898.dat",
  "4485.dat",
  "6093a.dat",
  "3833.dat",
  "3624.dat",
  "46303.dat",
]);
const accessories = new Set(["3899.dat", "3962b.dat"]);
const oldLegs = ["3815.dat", "3816.dat", "3817.dat"];
const unit = (v: Vec3): Vec3 => v.map((x) => x / Math.hypot(...v)) as Vec3;
const dot = (a: Vec3, b: Vec3) => a.reduce((s, v, n) => s + v * b[n], 0);
const point = (o: Occurrence, p: Vec3) =>
  add(o.transform.position, mv(o.transform.basis, p));
const axis = (o: Occurrence, p: Vec3) => unit(mv(o.transform.basis, p));
const near = (a: Vec3, b: Vec3, tolerance = 0.5) =>
  Math.hypot(...a.map((v, n) => v - b[n])) <= tolerance;
const parent = (o: Occurrence) => JSON.stringify(o.path.slice(0, -1));
const suppliedTorso =
  "If the torso is supplied with these arms and hands already assembled, keep it assembled and check the pictured pose; otherwise use the loose components. Do not dismantle a supplied assembly to match these drawings.";
export type FigureOperation = {
  role: "legs" | "torso" | "arm" | "hand" | "head" | "headgear" | "accessory";
  hostIds: string[];
  feature?: Vec3;
  facing: Vec3;
  notes: string;
};
export type FigureGroup = {
  name: string;
  ids: string[];
  edges: [string, string][];
  operations: Map<string, FigureOperation>;
  lowerIds: string[];
};
export function figureProfiles(project: Project, occurrences: Occurrence[]) {
  const groups: FigureGroup[] = [],
    units = new Map<string, { ids: string[]; name: string }>();
  if (
    project.library.releaseId !== libraryLock.releaseId ||
    project.library.manifestSha256 !== libraryLock.manifestSha256 ||
    project.library.full?.releaseId !== fullLibraryLock.releaseId ||
    project.library.full?.manifestSha256 !== fullLibraryLock.manifestSha256
  )
    return { groups, units, rejected: 0 };
  const sourceGroups = new Map<string, Occurrence[]>();
  for (const o of occurrences) {
    const key = parent(o),
      rows = sourceGroups.get(key) ?? [];
    rows.push(o);
    sourceGroups.set(key, rows);
  }
  let rejected = 0;
  for (const rows of sourceGroups.values()) {
    const body = rows.filter((o) => torsos.has(o.node.ref));
    if (body.length !== 1) continue;
    const torso = body[0],
      arms = rows.filter((o) => ["3818.dat", "3819.dat"].includes(o.node.ref)),
      hands = rows.filter((o) => o.node.ref === "3820.dat"),
      headRows = rows.filter((o) => heads.has(o.node.ref)),
      gear = rows.filter((o) => headgear.has(o.node.ref)),
      props = rows.filter((o) => accessories.has(o.node.ref));
    const lower = rows.filter((o) => oldLegs.includes(o.node.ref)),
      assembly = rows.filter((o) => o.node.ref === "3815c01.dat");
    if (
      rows.length < 8 ||
      rows.length > 12 ||
      arms.length !== 2 ||
      new Set(arms.map((o) => o.node.ref)).size !== 2 ||
      hands.length !== 2 ||
      headRows.length !== 1 ||
      gear.length > 1 ||
      props.length > 1 ||
      rows.some(
        (o) =>
          o.namespace !== "official" ||
          o.node.kind !== "part" ||
          !Object.hasOwn(FIGURE_SOURCE_SHA256, o.node.ref) ||
          !physical(o.transform, 0.02) ||
          !near(o.transform.position, torso.transform.position, 85),
      )
    ) {
      rejected++;
      continue;
    }
    // The loose obsolete drawing family has a shared +12 LDU leg origin. A
    // supplied lower-body source shortcut is already one source occurrence.
    if (
      !(
        (lower.length === 3 &&
          assembly.length === 0 &&
          oldLegs.every(
            (ref) => lower.filter((o) => o.node.ref === ref).length === 1,
          )) ||
        (lower.length === 0 && assembly.length === 1)
      )
    ) {
      rejected++;
      continue;
    }
    const hips = lower.find((o) => o.node.ref === "3815.dat") ?? assembly[0];
    if (
      !near(hips.transform.position, point(torso, [0, 32, 0])) ||
      dot(axis(hips, [0, 1, 0]), axis(torso, [0, 1, 0])) < 0.999 ||
      lower.some(
        (o) =>
          o !== hips &&
          (!near(o.transform.position, point(hips, [0, 12, 0])) ||
            [0, 1, 2].some(
              (n) =>
                dot(
                  axis(o, [0, 1, 2].map((a) => (a === n ? 1 : 0)) as Vec3),
                  axis(hips, [0, 1, 2].map((a) => (a === n ? 1 : 0)) as Vec3),
                ) < 0.999,
            )),
      )
    ) {
      rejected++;
      continue;
    }
    const operations = new Map<string, FigureOperation>(),
      edges: [string, string][] = [];
    const front = axis(torso, [0, 0, -1]);
    const put = (o: Occurrence, operation: FigureOperation) => {
      operations.set(o.id, operation);
      for (const host of operation.hostIds) edges.push([o.id, host]);
    };
    for (const o of [hips, ...lower.filter((o) => o !== hips)])
      operations.set(o.id, {
        role: "legs",
        hostIds: [],
        facing: front,
        notes: lower.length
          ? "These three obsolete source records depict a hips-and-legs group, not three required loose pieces. If supplied assembled, keep the lower body together; do not separate it to reproduce these component drawings. If supplied loose, review their identity and joining method before using the pictured group. Fit and support are unverified."
          : "Use the supplied hips-and-legs assembly. Keep it together and check its front against the torso picture. Support and fit remain unverified.",
      });
    put(torso, {
      role: "torso",
      hostIds: [hips.id],
      feature: point(hips, [0, -8, 0]),
      facing: front,
      notes: `Hold the lower body and add the torso with its front facing as pictured. Check the pictured torso front against the legs. ${suppliedTorso} Physical fit and support remain unverified.`,
    });
    let valid = true;
    const matched = new Set<string>();
    for (const arm of arms) {
      const right = arm.node.ref === "3818.dat",
        shoulder: Vec3 = [right ? -15.552 : 15.552, 9, 0];
      if (
        !near(arm.transform.position, point(torso, shoulder), 1.5) ||
        dot(axis(arm, [1, 0, 0]), axis(torso, [1, 0, 0])) < 0.97
      ) {
        valid = false;
        break;
      }
      const mouth = point(arm, [right ? -5 : 5, 18.9, -9.9]),
        outward = axis(arm, [0, 1, -1]);
      const matches = hands.filter(
        (hand) =>
          near(hand.transform.position, mouth) &&
          dot(axis(hand, [0, 0, 1]), outward) <= -0.99,
      );
      if (matches.length !== 1 || matched.has(matches[0].id)) {
        valid = false;
        break;
      }
      matched.add(matches[0].id);
      put(arm, {
        role: "arm",
        hostIds: [torso.id],
        feature: point(torso, shoulder),
        facing: front,
        notes: `Use the figure's own ${right ? "right" : "left"} arm at the pictured side of the torso. ${suppliedTorso} Check shoulder position and final arm angle; fitting, retention and permitted rotation remain unverified.`,
      });
      put(matches[0], {
        role: "hand",
        hostIds: [arm.id],
        feature: mouth,
        facing: outward,
        notes: `Use the pictured wrist opening of the figure's own ${right ? "right" : "left"} arm (${arm.node.ref}); the bare receiver view shows that opening before the hand is present. ${suppliedTorso} If loose, align the hand post with that opening and check the final grip orientation against the completed picture. Roll, seating, retention and physical fit remain unverified; no straight installation route is prescribed.`,
      });
    }
    const head = headRows[0];
    if (
      !valid ||
      matched.size !== 2 ||
      !near(head.transform.position, point(torso, [0, -24, 0]), 1.5) ||
      dot(axis(head, [0, 1, 0]), axis(torso, [0, 1, 0])) < 0.999 ||
      gear.some(
        (o) =>
          !near(o.transform.position, head.transform.position) ||
          dot(axis(o, [0, 1, 0]), axis(head, [0, 1, 0])) < 0.999,
      )
    ) {
      rejected++;
      continue;
    }
    put(head, {
      role: "head",
      hostIds: [torso.id],
      feature: point(torso, [0, -12, 0]),
      facing: axis(head, [0, 0, -1]),
      notes:
        "Add the pictured head to this torso's neck. Check the actual printed face and its orientation relative to the torso front in the completed picture. Use the bare neck view to identify the receiving feature; seating, permitted rotation and physical fit remain unverified.",
    });
    for (const o of gear)
      put(o, {
        role: "headgear",
        hostIds: [head.id],
        feature: point(head, [0, -4, 0]),
        facing: axis(head, [0, 0, -1]),
        notes:
          "Add the pictured hair, hat or helmet after the head. Check its front and the visible printed face; the bare head view identifies the receiving object. Seating and physical fit remain unverified.",
      });
    for (const o of props)
      put(o, {
        role: "accessory",
        hostIds: hands.map((h) => h.id),
        facing: front,
        notes:
          "Use the pictured accessory after preparing both hands. Check which hand holds it and how its actual grip is supported; source grouping alone does not establish a mating feature or a safe fit.",
      });
    const ids = rows.map((o) => o.id),
      name = project.models[torso.modelId].name;
    groups.push({
      name,
      ids,
      edges,
      operations,
      lowerIds: lower.map((o) => o.id),
    });
    if (lower.length) {
      const value = {
        ids: lower.map((o) => o.id),
        name: "Supplied lower body (obsolete source component drawings)",
      };
      for (const o of lower) units.set(o.id, value);
    }
  }
  return { groups, units, rejected };
}

export type FigureGraphItem = SourceGraphItem;
export const figurePrecedence = (
  groups: FigureGroup[],
  items: FigureGraphItem[],
) => sourcePrecedence(groups, items);
export const figureWorkbenchCandidates = (
  groups: FigureGroup[],
  items: FigureGraphItem[],
) => isolatedWorkbenchCandidates(groups, items);
