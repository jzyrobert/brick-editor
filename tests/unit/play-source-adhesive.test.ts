import { describe, expect, it } from "vitest";
import {
  sourceBackingCoverage,
  reviewedAdhesiveContacts,
  sourceBackingSeated,
} from "../../src/play/source-adhesive";
import type { SourceTriangle } from "../../src/play/source-support-contacts";
describe("whole adhesive backing support", () => {
  const rectangle = (
    left: number,
    right: number,
    bottom: number,
    top: number,
  ): SourceTriangle[] => [
    [
      [left, 0, bottom],
      [right, 0, bottom],
      [right, 0, top],
    ],
    [
      [left, 0, bottom],
      [right, 0, top],
      [left, 0, top],
    ],
  ];
  it("proves complete support across actual face tessellation and seams", () => {
    expect(
      sourceBackingCoverage(10, 10, [
        ...rectangle(-10, 0, -10, 10),
        ...rectangle(0, 10, -10, 10),
      ]),
    ).toMatchObject({ coverage: 1, missingAreaLdu2: 0 });
  });
  it("exposes a hole despite supported corners and center", () => {
    const triangles = [
      ...rectangle(-10, 2, -10, 10),
      ...rectangle(4, 10, -10, 10),
      ...rectangle(2, 4, -10, -2),
      ...rectangle(2, 4, 2, 10),
    ];
    expect(sourceBackingCoverage(10, 10, triangles)).toMatchObject({
      coverage: 0.98,
      missingAreaLdu2: 8,
    });
  });
  it("does not double-count overlapping source faces or accept an elevated host", () => {
    const tris = rectangle(-10, 0, -10, 10);
    expect(sourceBackingCoverage(10, 10, [...tris, ...tris])).toMatchObject({
      coverage: 0.5,
      missingAreaLdu2: 200,
    });
    expect(
      sourceBackingCoverage(
        10,
        10,
        rectangle(-10, 10, -10, 10).map(
          (t) => t.map((p) => [p[0], 1, p[2]]) as SourceTriangle,
        ),
      ).coverage,
    ).toBe(0);
  });
  it("refuses caller-forged sticker approvals", () => {
    expect(() =>
      reviewedAdhesiveContacts(
        {
          occurrenceId: "sticker",
          geometrySha256: "a".repeat(64),
          halfWidth: 10,
          halfDepth: 10,
          transform: {
            position: [0, 0, 0],
            basis: [1, 0, 0, 0, 1, 0, 0, 0, 1],
          },
        },
        [],
      ),
    ).toThrow("reviewed source backing");
  });
  it("allows only source precision at the backing rim, preserving actual hole and overhang refusals", () => {
    expect(
      sourceBackingSeated(
        10,
        10,
        sourceBackingCoverage(10, 10, rectangle(-10, 9.96, -10, 10)),
      ),
    ).toBe(true);
    expect(
      sourceBackingSeated(
        10,
        10,
        sourceBackingCoverage(10, 10, rectangle(-10, 9, -10, 10)),
      ),
    ).toBe(false);
    const hole = [
      ...rectangle(-10, 2, -10, 10),
      ...rectangle(4, 10, -10, 10),
      ...rectangle(2, 4, -10, -2),
      ...rectangle(2, 4, 2, 10),
    ];
    expect(
      sourceBackingSeated(10, 10, sourceBackingCoverage(10, 10, hole)),
    ).toBe(false);
  });
});
