import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import {
  fullLibrarySources,
  registerFullLibraryFromDisk,
} from "../../scripts/full-library-node";
import { occurrences } from "../../src/core/document";
import { compose, identity } from "../../src/core/math";
import type { Transform, Vec3 } from "../../src/core/types";
import { importLDraw, exportLDraw } from "../../src/ldraw/io";
import { axisRotation } from "../../src/mechanisms/kinematic";
import {
  MECHANICAL_PARTS,
  MECHANICAL_PACK,
} from "../../src/mechanisms/mechanical-pack";
import {
  mechanicalContactGraph,
  worldMechanicalFeatures,
} from "../../src/mechanisms/mechanical-contacts";
import { fullLibraryLock } from "../../src/catalog/full-library";
import { libraryLock } from "../../src/catalog/catalog";

registerFullLibraryFromDisk();
const pose = (
  position: Vec3 = [0, 0, 0],
  basis = identity().basis,
): Transform => ({ position, basis });
const row = (ref: string, t = identity()) =>
  `1 7 ${[...t.position, ...t.basis].join(" ")} ${ref}`;
const shaftPose = pose([0, 0, 0], axisRotation([0, 1, 0], -90));

describe("reviewed mechanical features and typed contacts", () => {
  it("binds all feature reviews and subparts to the shipped source packs", () => {
    expect(MECHANICAL_PACK.fullManifestSha256).toBe(
      fullLibraryLock.manifestSha256,
    );
    expect(MECHANICAL_PACK.curatedManifestSha256).toBe(
      libraryLock.manifestSha256,
    );
    const sources = fullLibrarySources(Object.keys(MECHANICAL_PARTS));
    for (const [ref, profile] of Object.entries(MECHANICAL_PARTS)) {
      expect(createHash("sha256").update(sources[ref]).digest("hex"), ref).toBe(
        profile.sourceSha256,
      );
      expect(profile.review.length).toBeGreaterThan(20);
    }
    // Independent source landmarks: these are not guessed from part bounds.
    expect(sources["3700.dat"]).toContain(
      "0 10 10 1 0 0 0 0 1 0 -1 0 peghole.dat",
    );
    expect(
      sources["3647.dat"]
        .split("\n")
        .filter(
          (l) => l.startsWith("1 ") && l.trimEnd().endsWith("tooth8.dat"),
        ),
    ).toHaveLength(8);
    expect(
      sources["s/3648s01.dat"]
        .split("\n")
        .filter(
          (l) => l.startsWith("1 ") && l.trimEnd().endsWith("tooth24.dat"),
        ),
    ).toHaveLength(24);
    expect(sources["h1.dat"]).toContain("0 10 -6");
    expect(sources["h2.dat"]).toContain("0 10 6");
  });

  it("distinguishes an axle bearing, a sliding keyed gear and a gripping collar", () => {
    const p = importLDraw(
      [
        row("3705.dat", shaftPose),
        row("3700.dat", pose([0, -10, 0])),
        row("3647.dat"),
        row("4265a.dat", pose([0, 0, 25])),
      ].join("\n"),
    );
    const before = exportLDraw(p),
      graph = mechanicalContactGraph(p);
    expect(graph.contacts.filter((c) => c.kind === "bearing")).toHaveLength(1);
    const keys = graph.contacts.filter((c) => c.kind === "keyed-slide");
    expect(keys).toHaveLength(2);
    expect(
      keys.map((c) => [c.rotationLocked, c.axialFreedom, c.axialGrip]),
    ).toEqual([
      [true, true, false],
      [true, false, true],
    ]);
    expect(graph.contacts.some((c) => c.kind === "stud-weld")).toBe(false);
    expect(exportLDraw(p)).toBe(before);
  });

  it.each(["3673.dat", "2780.dat"])(
    "retains seated %s halves without treating friction as a weld",
    (ref) => {
      const p = importLDraw(
        [
          row(ref, shaftPose),
          row("3700.dat", pose([0, -10, -10])),
          row("3700.dat", pose([0, -10, 10])),
        ].join("\n"),
      );
      const pins = mechanicalContactGraph(p).contacts.filter(
        (c) => c.kind === "pin-bearing",
      );
      expect(pins).toHaveLength(2);
      expect(
        pins.every((c) => c.retained && c.friction === (ref === "2780.dat")),
      ).toBe(true);
      expect(pins.map((c) => c.engagementLdu)).toEqual([16, 16]);
    },
  );

  it("does not retain an offset pin or match a remote or skewed bore", () => {
    const partial = importLDraw(
      [row("3673.dat", shaftPose), row("3700.dat", pose([0, -10, 9]))].join(
        "\n",
      ),
    );
    const pin = mechanicalContactGraph(partial).contacts.find(
      (c) => c.kind === "pin-bearing",
    );
    expect(pin?.kind === "pin-bearing" && pin.retained).toBe(false);
    for (const hole of [
      pose([0, -10, 100]),
      pose([1, -10, 0]),
      pose([0, -10, 0], axisRotation([0, 1, 0], 30)),
    ]) {
      const p = importLDraw(
        [row("3705.dat", shaftPose), row("3700.dat", hole)].join("\n"),
      );
      expect(
        mechanicalContactGraph(p).contacts.filter((c) => c.kind === "bearing"),
      ).toHaveLength(0);
    }
  });

  it("checks keyed phase and shaft interval instead of matching centres alone", () => {
    for (const gearPose of [
      pose([0, 0, 50]),
      pose([0, 0, 0], axisRotation([0, 0, 1], 22.5)),
    ]) {
      const p = importLDraw(
        [row("3705.dat", shaftPose), row("3647.dat", gearPose)].join("\n"),
      );
      expect(
        mechanicalContactGraph(p).contacts.some(
          (c) => c.kind === "keyed-slide",
        ),
      ).toBe(false);
    }
    const clash = importLDraw(
      [
        row("3705.dat", shaftPose),
        row("3647.dat", pose([0, 0, 0], axisRotation([0, 0, 1], 22.5))),
      ].join("\n"),
    );
    expect(
      mechanicalContactGraph(clash).rejected.some((r) =>
        r.reason.includes("phase"),
      ),
    ).toBe(true);
  });

  it("recognises a staggered 8:24 mesh and records its signed 3:1 relation", () => {
    const p = importLDraw(
      [
        row("3647.dat"),
        row("3648b.dat", pose([40, 0, 0], axisRotation([0, 0, 1], 7.5))),
      ].join("\n"),
    );
    const mesh = mechanicalContactGraph(p).contacts.find(
      (c) => c.kind === "spur-mesh",
    );
    expect(mesh).toMatchObject({
      teethA: 8,
      teethB: 24,
      ratio: -1 / 3,
      engagementLdu: 9.5,
    });
    for (const t of [
      pose([40, 0, 0]),
      pose([42, 0, 0]),
      pose([40, 0, 20], axisRotation([0, 0, 1], 7.5)),
      pose([40, 0, 0], axisRotation([1, 0, 0], 30)),
    ]) {
      const invalid = importLDraw(
        [row("3647.dat"), row("3648b.dat", t)].join("\n"),
      );
      expect(
        mechanicalContactGraph(invalid).contacts.some(
          (c) => c.kind === "spur-mesh",
        ),
      ).toBe(false);
      expect(mechanicalContactGraph(invalid).rejected.length).toBeGreaterThan(
        0,
      );
    }
  });

  it("retains mesh direction when the second gear declares the opposite axis", () => {
    const p = importLDraw(
      [
        row("3647.dat"),
        row(
          "3648b.dat",
          pose(
            [40, 0, 0],
            compose(
              pose([0, 0, 0], axisRotation([0, 0, 1], 7.5)),
              pose([0, 0, 0], axisRotation([0, 1, 0], 180)),
            ).basis,
          ),
        ),
      ].join("\n"),
    );
    expect(
      mechanicalContactGraph(p).contacts.find((c) => c.kind === "spur-mesh"),
    ).toMatchObject({ ratio: 1 / 3 });
  });

  it("matches complementary ordinary finger hinges without welding them", () => {
    const p = importLDraw(
      [
        row("4275b.dat"),
        row("4276b.dat", pose([60, 0, 0], axisRotation([0, 1, 0], 180))),
      ].join("\n"),
    );
    const contact = mechanicalContactGraph(p).contacts.find(
      (c) => c.kind === "finger-hinge",
    );
    expect(contact).toMatchObject({ retained: true });
    if (!contact || contact.kind !== "finger-hinge") throw Error();
    contact.pivot.forEach((value, i) =>
      expect(value).toBeCloseTo([30, 4, 0][i], 8),
    );
    const same = importLDraw(
      [
        row("4275b.dat"),
        row("4275b.dat", pose([60, 0, 0], axisRotation([0, 1, 0], 180))),
      ].join("\n"),
    );
    expect(
      mechanicalContactGraph(same).contacts.some(
        (c) => c.kind === "finger-hinge",
      ),
    ).toBe(false);
  });

  it("recruits an accessory through a reviewed hinge stud and a verified antistud", () => {
    const p = importLDraw(
      [row("4276b.dat"), row("3023.dat", pose([0, -8, 0]))].join("\n"),
    );
    expect(
      mechanicalContactGraph(p).contacts.filter((c) => c.kind === "stud-weld"),
    ).toHaveLength(2);
  });

  it("transforms nested, rounded models without rewriting source placements", () => {
    const global = pose([100, -200, 300], axisRotation([0, 1, 0], 45));
    global.basis = global.basis.map(
      (x) => Math.round(x * 1000) / 1000,
    ) as Transform["basis"];
    const p = importLDraw(
      [
        "0 FILE root.ldr",
        row("assembly.ldr", global),
        "0 FILE assembly.ldr",
        row("3705.dat", shaftPose),
        row("3700.dat", pose([0, -10, 0])),
      ].join("\n"),
    );
    const before = JSON.stringify(p),
      graph = mechanicalContactGraph(p);
    expect(graph.contacts.filter((c) => c.kind === "bearing")).toHaveLength(1);
    expect(graph.features[0].axis).toEqual(
      expect.arrayContaining([expect.any(Number)]),
    );
    expect(JSON.stringify(p)).toBe(before);
  });

  it("excludes mirrors, scales, missing and file-local copies and fails closed on budgets", () => {
    for (const basis of [
      [-1, 0, 0, 0, 1, 0, 0, 0, 1],
      [2, 0, 0, 0, 1, 0, 0, 0, 1],
    ]) {
      const p = importLDraw(
        row("3705.dat", pose([0, 0, 0], basis as Transform["basis"])),
      );
      expect(worldMechanicalFeatures(occurrences(p)[0])).toBeUndefined();
    }
    const copy = importLDraw(
      [
        "0 FILE root.ldr",
        row("3705.dat"),
        "0 FILE 3705.dat",
        "3 16 0 0 0 1 0 0 0 1 0",
      ].join("\n"),
    );
    expect(worldMechanicalFeatures(occurrences(copy)[0])).toBeUndefined();
    const crowded = importLDraw(
      Array.from({ length: 2049 }, () => row("3705.dat")).join("\n"),
    );
    expect(() => mechanicalContactGraph(crowded)).toThrow(/2,048/);
    const dense = importLDraw(
      Array.from({ length: 200 }, () => row("3702.dat")).join("\n"),
    );
    expect(() => mechanicalContactGraph(dense)).toThrow(/budget/);
  });
});
