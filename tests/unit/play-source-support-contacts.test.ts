import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import {
  fullLibrarySources,
  registerFullLibraryFromDisk,
} from "../../scripts/full-library-node";
import { occurrences } from "../../src/core/document";
import { add, mv } from "../../src/core/math";
import { importLDraw } from "../../src/ldraw/io";
import { collisionProxy } from "../../src/play/collision-proxy";
import { sourceConnectedAssembly } from "../../src/play/source-assembly";
import {
  sourceSupportContacts,
  sourceSupportPatch,
  type SourceTriangle,
} from "../../src/play/source-support-contacts";

beforeAll(() => expect(registerFullLibraryFromDisk()).toBe(true));

describe("source-supported removable bodies", () => {
  const rail: SourceTriangle = [
    [0, 0, 0],
    [10, 0, 0],
    [0, 0, 10],
  ];
  it("preserves the actual overlapping face polygon independently of winding", () => {
    const support: SourceTriangle = [
      [0, 0, 0],
      [5, 0, 0],
      [0, 0, 5],
    ];
    expect(sourceSupportPatch(rail, support)).toEqual({
      areaLdu2: 12.5,
      polygon: [
        [0, 0, 0],
        [5, 0, 0],
        [0, 0, 5],
      ],
    });
    expect(
      sourceSupportPatch(rail, [...support].reverse() as SourceTriangle)
        ?.areaLdu2,
    ).toBe(12.5);
  });
  it("refuses gaps, side faces, degenerate faces and mere edge contact", () => {
    expect(
      sourceSupportPatch(
        rail,
        rail.map((p) => [p[0], 1, p[2]]) as SourceTriangle,
      ),
    ).toBeUndefined();
    expect(
      sourceSupportPatch(rail, [
        [10, 0, 0],
        [20, 0, 0],
        [10, 0, 10],
      ]),
    ).toBeUndefined();
    expect(
      sourceSupportPatch(rail, [
        [0, 0, 0],
        [0, 10, 0],
        [0, 0, 10],
      ]),
    ).toBeUndefined();
    expect(
      sourceSupportPatch(rail, [
        [0, 0, 0],
        [0, 0, 0],
        [0, 0, 0],
      ]),
    ).toBeUndefined();
  });
  it("retains source closure and face identities without creating an attachment kind", () => {
    const contacts = sourceSupportContacts(
      {
        occurrenceId: "rail",
        sourceClosureSha256: "a".repeat(64),
        triangles: [rail],
      },
      {
        occurrenceId: "support",
        sourceClosureSha256: "b".repeat(64),
        triangles: [rail],
      },
    );
    expect(contacts).toHaveLength(1);
    expect(contacts[0]).toMatchObject({
      a: { occurrenceId: "rail", triangle: 0 },
      b: { occurrenceId: "support", triangle: 0 },
      areaLdu2: 50,
    });
    expect(contacts[0]).not.toHaveProperty("kind");
    expect(() =>
      sourceSupportContacts(
        { occurrenceId: "rail", sourceClosureSha256: "bad", triangles: [rail] },
        {
          occurrenceId: "support",
          sourceClosureSha256: "b".repeat(64),
          triangles: [rail],
        },
      ),
    ).toThrow("source-bound");
  });
  it("proves an actual5540 removable cowl face contact without welding it to its tile support", () => {
    const p = importLDraw(
        readFileSync(
          "fixtures/play/official-cars/5540-cowl-support.ldr",
          "utf8",
        ),
      ),
      all = occurrences(p),
      before = structuredClone(all);
    const sources = fullLibrarySources(all.map((o) => o.node.ref));
    const meshes = all.map((o) => {
      const mesh = collisionProxy(
        (n) => sources[n],
        o.node.ref,
        () => false,
      )!;
      const triangles: SourceTriangle[] = [];
      for (let i = 0; i < mesh.length; i += 9)
        triangles.push(
          [0, 3, 6].map((j) =>
            add(
              o.transform.position,
              mv(
                o.transform.basis,
                Array.from(mesh.slice(i + j, i + j + 3)) as [
                  number,
                  number,
                  number,
                ],
              ),
            ),
          ) as SourceTriangle,
        );
      return triangles.filter((t) =>
        t.every((p) => Math.abs(p[1] + 96) < 0.001),
      );
    });
    const patches = meshes[0].flatMap((a) =>
      meshes[1].flatMap((b) => {
        const patch = sourceSupportPatch(a, b);
        return patch ? [patch] : [];
      }),
    );
    expect(patches.length).toBeGreaterThan(0);
    expect(patches.every((p) => p.polygon.every((v) => v[1] === -96))).toBe(
      true,
    );
    expect(
      sourceConnectedAssembly(p, { seeds: [all[0].id] }).occurrenceIds,
    ).toEqual([all[0].id]);
    const lifted = meshes[0].map(
      (t) => t.map((v) => [v[0], v[1] - 2, v[2]]) as SourceTriangle,
    );
    expect(
      lifted.flatMap((a) =>
        meshes[1].flatMap((b) => (sourceSupportPatch(a, b) ? [1] : [])),
      ),
    ).toEqual([]);
    expect(occurrences(p)).toEqual(before);
  });
});
