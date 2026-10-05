import { libraryLock } from "../catalog/catalog";
import { fullLibraryLock } from "../catalog/full-library";
import { verifiedConnectors, type Connector } from "../catalog/connectors";
import { add, mv, nearlyPhysical, orthonormalized } from "../core/math";
import type { Occurrence, Vec3 } from "../core/types";
import { MECHANICAL_PACK } from "../mechanisms/mechanical-pack";
import type { WorldMechanicalFeature } from "../mechanisms/mechanical-contacts";

type StudSubset = { sourceSha256: string; connectors: Connector[] };
const studs = (points: Vec3[]): Connector[] =>
  points.map((p) => ({ kind: "stud", p, axis: [0, -1, 0] }));
const sockets = (points: Vec3[]): Connector[] =>
  points.map((p) => ({ kind: "antistud", p, axis: [0, 1, 0] }));
const pair = (y: number): Vec3[] => [
  [-10, y, 0],
  [10, y, 0],
];
/** Narrow interface subsets reviewed against the literal pinned source. These
 * do not upgrade the whole part's connector status or claim a hinge is rigid.
 * Stud/underside coordinates are separate from the source hinge barrels.
 * Library files and their licence headers remain untouched. */
export const ASSEMBLY_STUD_SUBSETS: Readonly<Record<string, StudSubset>> = {
  "4070.dat": {
    sourceSha256:
      "bf1878c02423294b3c0b82db4c416e1d77608bbfb3a2b2b569b42d8a10c75e6c",
    // The rear opening has a 12-LDU square mouth at Z=10, centered at Y=10.
    // It seats a normal stud independently of the front hollow side stud.
    connectors: [{ kind: "antistud", p: [0, 10, 10], axis: [0, 0, 1] }],
  },
  "3937.dat": {
    sourceSha256:
      "b822cfd72b93d341f795277012269377d41a90d8dcbb9c481ea704dd3670c416",
    connectors: sockets(pair(24)),
  },
  "3938.dat": {
    sourceSha256:
      "a804b5605ba7ded1a0a39388935e153702e11a17dc9768fb7434577e7c6632c0",
    connectors: studs(pair(0)),
  },
  "4275a.dat": {
    sourceSha256:
      "e66b94b8de38f3ad012685e03b4cc0fb7d960856ebd2fd07e29e2e51ae7fca44",
    connectors: [...studs(pair(0)), ...sockets(pair(8))],
  },
  "4276a.dat": {
    sourceSha256:
      "431fff45538ebe2ad9713af11385575ec2136bf9a94df2c92877b59ae7cd8116",
    connectors: [...studs(pair(0)), ...sockets(pair(8))],
  },
  "4531.dat": {
    sourceSha256:
      "3bc7dea36cf0959d04dda8d94d2fa611c674c4906ce65058ffa38a704d023a16",
    connectors: sockets(pair(16)),
  },
  "4175.dat": {
    sourceSha256:
      "fbf1ba4b98d4f9e6e60eab5967a79f8675553a70aa843cf9f4f910784b4b1ee1",
    connectors: [...studs(pair(0)), ...sockets(pair(8))],
  },
  "3794a.dat": {
    sourceSha256:
      "7acf130b3578a36f1277ed5d00757aef0a1263e3f5b58dcf9346457d180f4355",
    connectors: [...studs([[0, 0, 0]]), ...sockets(pair(8))],
  },
  "4287a.dat": {
    sourceSha256:
      "9fa0f126d34ba9f9c128404e47540198969478985322a11328fbbbaf8a3a096f",
    connectors: [...studs([[0, 0, 0]]), ...sockets([[0, 24, 0]])],
  },
  "3660.dat": {
    sourceSha256:
      "79f4b7c72cbc672054e6972f6faec91fa90571030ce91b1c0c12095dde184ca5",
    connectors: [...studs(pair(0)), ...sockets(pair(24))],
  },
  "4083.dat": {
    sourceSha256:
      "e361125fba3a327bb86011a4e74a116d2cc5762c359416bac1f3bff35bcc3360",
    connectors: [
      ...studs(pair(0)),
      ...sockets([
        [-30, 48, 0],
        [30, 48, 0],
      ]),
    ],
  },
  "4599a.dat": {
    sourceSha256:
      "6b89229de52e63414f90a0bf79f0dd7917591bc452537f33b74b5b56926e6b2b",
    connectors: [...studs([[0, 0, 0]]), ...sockets([[0, 24, 0]])],
  },
  "4858.dat": {
    sourceSha256:
      "a372ba97d9d8763477528368f5b24c10a2d8ec89804b8b0f952153bb80dfef3c",
    connectors: [
      ...studs([
        [-30, 0, 0],
        [30, 0, 0],
      ]),
      ...sockets([
        [-30, 24, 0],
        [30, 24, 0],
        [-10, 24, -60],
        [10, 24, -60],
        [-10, 24, -40],
        [10, 24, -40],
      ]),
    ],
  },
  "4861.dat": {
    sourceSha256:
      "29cc9c458ebdb11b8e6212d6da82e95e228dcf4590c92029d1c2c270892344bd",
    connectors: [
      ...studs(pair(0)),
      ...sockets([
        [-30, 24, -40],
        [-10, 24, -40],
        [10, 24, -40],
        [30, 24, -40],
        [-30, 24, -20],
        [30, 24, -20],
        [-30, 24, 0],
        [30, 24, 0],
      ]),
    ],
  },
};
export function assemblySourcesMatch() {
  return (
    libraryLock.manifestSha256 === MECHANICAL_PACK.curatedManifestSha256 &&
    fullLibraryLock.manifestSha256 === MECHANICAL_PACK.fullManifestSha256
  );
}
export function assemblyStudConnectors(o: Occurrence) {
  if (
    o.namespace !== "official" ||
    o.node.kind !== "part" ||
    !nearlyPhysical(o.transform) ||
    !assemblySourcesMatch()
  )
    return [];
  const frame = orthonormalized(o.transform);
  return [
    ...(verifiedConnectors(o.node.ref) ?? []),
    ...(ASSEMBLY_STUD_SUBSETS[o.node.ref]?.connectors ?? []),
  ]
    .filter((c) => c.kind === "stud" || c.kind === "antistud")
    .map((c) => ({
      ...c,
      occurrenceId: o.id,
      p: add(frame.position, mv(frame.basis, c.p)),
      axis: mv(frame.basis, c.axis),
    }));
}

export type AssemblyHingeInterface = {
  occurrenceId: string;
  family: "plate-barrel" | "finger";
  half: "base" | "leaf";
  pivot: Vec3;
  axis: Vec3;
};
/** Coincident paired barrels retain rotation freedom. Finger profiles use the
 * literal h1/h2 placements; 4531 models the same two fingers explicitly. */
export function assemblyHingeInterface(
  o: Occurrence,
): AssemblyHingeInterface | undefined {
  if (
    !assemblySourcesMatch() ||
    o.namespace !== "official" ||
    o.node.kind !== "part" ||
    !nearlyPhysical(o.transform) ||
    !ASSEMBLY_STUD_SUBSETS[o.node.ref]
  )
    return undefined;
  const barrel = o.node.ref === "3937.dat" || o.node.ref === "3938.dat";
  const finger = ["4275a.dat", "4276a.dat", "4531.dat"].includes(o.node.ref);
  if (!barrel && !finger) return undefined;
  const frame = orthonormalized(o.transform);
  return {
    occurrenceId: o.id,
    family: barrel ? "plate-barrel" : "finger",
    half: ["3937.dat", "4276a.dat", "4531.dat"].includes(o.node.ref)
      ? "base"
      : "leaf",
    pivot: add(
      frame.position,
      mv(frame.basis, barrel ? [0, 10, 0] : [30, 4, 0]),
    ),
    axis: mv(frame.basis, barrel ? [1, 0, 0] : [0, 0, 1]),
  };
}

/** Attachment-only keyed bores. These profiles say nothing about bevel gear
 * transmission or belt motion; those require separate reviewed routing. */
export const ASSEMBLY_KEYED_BORES = Object.freeze({
  "4143.dat": {
    sourceSha256:
      "34db20dd445a715b99d0b1358350169d104f98d782e7544740819372dbf2fa88",
    span: [-4, 3] as [number, number],
  },
  "4185a.dat": {
    sourceSha256:
      "d5f7ebd121e817a836f91f6c735587604122b5e46803ed3f7eb25de329b4b74a",
    span: [-5, 5] as [number, number],
  },
});
export function assemblyKeyedBore(
  o: Occurrence,
): WorldMechanicalFeature | undefined {
  const profile =
    ASSEMBLY_KEYED_BORES[o.node.ref as keyof typeof ASSEMBLY_KEYED_BORES];
  if (
    !profile ||
    !assemblySourcesMatch() ||
    o.namespace !== "official" ||
    o.node.kind !== "part" ||
    !nearlyPhysical(o.transform)
  )
    return undefined;
  const frame = orthonormalized(o.transform),
    id = "source-keyed-bore";
  return {
    occurrenceId: o.id,
    ref: o.node.ref,
    key: JSON.stringify([o.id, id]),
    id,
    kind: "keyed-hole",
    center: frame.position,
    axis: mv(frame.basis, [0, 0, 1]),
    keyDirection: mv(frame.basis, [1, 0, 0]),
    span: [...profile.span],
    radius: 6,
    axialGrip: false,
  };
}
