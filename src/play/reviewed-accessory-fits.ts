import { add, mv, nearlyPhysical, orthonormalized } from "../core/math";
import { ensure, type Occurrence, type Vec3 } from "../core/types";
import { assemblySourcesMatch } from "./reviewed-assembly-attachments";
import type { SourceAssemblyEdge } from "./source-assembly";

export const ACCESSORY_FIT_SOURCES = Object.freeze({
  "4599a.dat":
    "6b89229de52e63414f90a0bf79f0dd7917591bc452537f33b74b5b56926e6b2b",
  "4589.dat":
    "bce02358484d09c47c3d8f5d512425ca2bc7b1ad1be39b8bc743ce12b38f0c9e",
  "4185a.dat":
    "d5f7ebd121e817a836f91f6c735587604122b5e46803ed3f7eb25de329b4b74a",
  "2815.dat":
    "12bf80e6316b3ab1e9d5d776a4b5fb7672a0be1b089a89537d455608350374d5",
});
const close = (a: Vec3, b: Vec3) =>
  Math.hypot(...a.map((x, i) => x - b[i])) <= 0.05;
const parallel = (a: Vec3, b: Vec3) =>
  Math.abs(a.reduce((s, x, i) => s + x * b[i], 0)) >= 0.99999;
/** Two narrowly reviewed source friction fits, independent of model names and
 * root hierarchy. Like stud connections these are ideal seated attachments,
 * not measured clutch forces or a claim about shaft/belt transmission.
 * Tap spout: radius4 sleeve atZ16..20; cone stud2a cavity radius4,Y−4..0.
 * Pulley/tyre: real coaxial paired30-LDU rim lips and flexible tyre grooves;
 * the nominal rubber fit retains its source placement and flanges. */
export function reviewedAccessoryFits(
  all: readonly Occurrence[],
): SourceAssemblyEdge[] {
  ensure(
    all.length <= 2048,
    "LIMIT_EXCEEDED",
    "Accessory source review part budget exceeded",
  );
  if (!assemblySourcesMatch()) return [];
  const eligible = all.filter(
    (o) =>
      o.namespace === "official" &&
      o.node.kind === "part" &&
      nearlyPhysical(o.transform) &&
      Object.hasOwn(ACCESSORY_FIT_SOURCES, o.node.ref),
  );
  const edges: SourceAssemblyEdge[] = [];
  let checks = 0;
  for (const [
    outerRef,
    innerRef,
    profile,
    outerLocal,
    innerLocal,
    outerAxis,
    innerAxis,
  ] of [
    [
      "4599a.dat",
      "4589.dat",
      "source-spout-hollow-stud-fit",
      [0, 4, 16],
      [0, -4, 0],
      [0, 0, 1],
      [0, 1, 0],
    ],
    [
      "4185a.dat",
      "2815.dat",
      "source-pulley-tyre-fit",
      [0, 0, 0],
      [0, 0, 0],
      [0, 0, 1],
      [0, 0, 1],
    ],
  ] as const) {
    const outers = eligible.filter((o) => o.node.ref === outerRef),
      inners = eligible.filter((o) => o.node.ref === innerRef);
    const pairs: [Occurrence, Occurrence][] = [];
    for (const a of outers)
      for (const b of inners) {
        ensure(
          ++checks <= 100000,
          "LIMIT_EXCEEDED",
          "Accessory source review contact budget exceeded",
        );
        const af = orthonormalized(a.transform),
          bf = orthonormalized(b.transform);
        if (
          close(
            add(af.position, mv(af.basis, [...outerLocal])),
            add(bf.position, mv(bf.basis, [...innerLocal])),
          ) &&
          parallel(mv(af.basis, [...outerAxis]), mv(bf.basis, [...innerAxis]))
        )
          pairs.push([a, b]);
      }
    for (const [a, b] of pairs)
      if (
        pairs.filter((p) => p[0].id === a.id).length === 1 &&
        pairs.filter((p) => p[1].id === b.id).length === 1
      )
        edges.push({
          a: a.id,
          b: b.id,
          kind: "fixed",
          evidence: {
            profile,
            featureA:
              outerRef === "4599a.dat"
                ? "spout-sleeve-Z16..20"
                : "paired-rim-lips-radius30",
            featureB:
              innerRef === "4589.dat"
                ? "stud2a-cavity-Y-4..0"
                : "source-flexible-tyre-groove",
          },
        });
  }
  return edges;
}
