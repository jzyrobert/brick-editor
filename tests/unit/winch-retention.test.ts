import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import {
  BufferGeometry,
  BufferAttribute,
  DoubleSide,
  Mesh,
  MeshBasicMaterial,
  Raycaster,
  Vector3,
} from "three";
import { importLDraw } from "../../src/ldraw/io";
import { occurrences } from "../../src/core/document";
import { compose } from "../../src/core/math";
import { axisRotation } from "../../src/mechanisms/kinematic";
import {
  bindWinchRetentionSources,
  isWinchRetention,
  winchRetention,
} from "../../src/mechanisms/winch-retention";
import {
  registerFullLibraryFromDisk,
  fullLibrarySources,
} from "../../scripts/full-library-node";
import { memberLocalOf } from "../helpers/play-dynamic-source";
const project = () =>
  importLDraw(
    readFileSync("fixtures/ldraw/technic/42042-winch-retention.ldr", "utf8"),
  );
beforeAll(() => registerFullLibraryFromDisk());
describe("complete source first-winch shaft retention", () => {
  it("binds all27 literal neighbours without turning bushes/keyed seats into axial welds", async () => {
    const p = project(),
      before = JSON.stringify(p),
      all = occurrences(p),
      sources = fullLibrarySources(all.map((o) => o.node.ref)),
      binding = await bindWinchRetentionSources(sources, p),
      worm = all.find((o) => o.node.ref === "4716.dat")!,
      review = winchRetention(worm, all, binding);
    expect(review.sourceMembers).toHaveLength(27);
    expect(review.shaftOwnership).toBe("axially-free-keyed");
    expect(review.input.opposingHardStop).toBeNull();
    expect(review.input.freeEndToDividerGapLdu).toBe(8.5);
    expect(review.output.hardStops).toEqual([]);
    expect(review.output.bushes).toHaveLength(4);
    expect(review.output.pulleys).toHaveLength(2);
    expect(isWinchRetention(review)).toBe(true);
    expect(isWinchRetention(structuredClone(review))).toBe(false);
    const missing = all.filter((o) => o.id !== review.output.bushes[0]);
    expect(() => winchRetention(worm, missing, binding)).toThrow(
      "retention seat",
    );
    const displaced = structuredClone(all);
    displaced.find(
      (o) => o.id === review.input.joinerId,
    )!.transform.position[2] += 1;
    expect(() => winchRetention(worm, displaced, binding)).toThrow(
      "retention seat",
    );
    const frame = {
        position: [13, -47, 51] as [number, number, number],
        basis: axisRotation([0, 1, 0], 37),
      },
      rotated = all.map((o) => ({
        ...o,
        transform: compose(frame, o.transform),
      }));
    expect(
      winchRetention(rotated.find((o) => o.id === worm.id)!, rotated, binding)
        .shaftOwnership,
    ).toBe("axially-free-keyed");
    expect(JSON.stringify(p)).toBe(before);
  });
  it("refuses mutated collar dependencies and project copies", async () => {
    const p = project(),
      sources = fullLibrarySources(occurrences(p).map((o) => o.node.ref));
    await expect(
      bindWinchRetentionSources(
        {
          ...sources,
          "axl2hol8.dat": sources["axl2hol8.dat"] + "\n3 16 0 0 0 1 0 0 0 1 0",
        },
        p,
      ),
    ).rejects.toThrow("geometry changed");
    const fake = importLDraw(
      "0 FILE winch.ldr\n" +
        readFileSync(
          "fixtures/ldraw/technic/42042-winch-retention.ldr",
          "utf8",
        ) +
        "\n0 NOFILE\n" +
        "\n0 FILE axl2hol8.dat\n0 Embedded substituted bore\n0 NOFILE\n",
    );
    await expect(bindWinchRetentionSources(sources, fake)).rejects.toThrow(
      "shadows",
    );
  });
  it("independently measures the head/counterbore stop and the8.5LDU gap to the actual joiner divider", async () => {
    const surface = async (ref: string) => {
      const p = importLDraw(
          `0 Test canonical part\n0 !COLOUR TestGrey CODE 71 VALUE #888888 EDGE #333333\n1 71 0 0 0 1 0 0 0 1 0 0 0 1 ${ref}\n`,
        ),
        local = await memberLocalOf(
          p,
          occurrences(p)[0].id,
          fullLibrarySources([ref]),
        ),
        geometry = new BufferGeometry().setAttribute(
          "position",
          new BufferAttribute(local.vertices, 3),
        );
      geometry.setIndex(new BufferAttribute(local.indices, 1));
      const mesh = new Mesh(
        geometry,
        new MeshBasicMaterial({ side: DoubleSide }),
      );
      mesh.updateMatrixWorld(true);
      return mesh;
    };
    const axle = await surface("15462.dat"),
      block = await surface("6536.dat"),
      joiner = await surface("18948.dat"),
      plain = await surface("3737.dat"),
      bush = await surface("32123a.dat");
    const ray = (g: typeof axle, p: number[], d: number[]) =>
      new Raycaster(new Vector3(...p), new Vector3(...d)).intersectObject(
        g,
        true,
      )[0].point;
    // Literal R8 stop starts atX48; its seat is the R6/R8 lip atZ−8.
    expect(ray(axle, [30, 7, 0], [1, 0, 0]).x).toBeCloseTo(48, 5);
    expect(ray(block, [7, 20, -20], [0, 0, 1]).z).toBeCloseTo(-8, 5);
    // Relative worm stations: head−10+48=38; seat30−(−8)=38.
    expect(-10 + ray(axle, [30, 7, 0], [1, 0, 0]).x).toBeCloseTo(
      30 - ray(block, [7, 20, -20], [0, 0, 1]).z,
      5,
    );
    const freeEnd = -10 + ray(axle, [-70, 0, 0], [1, 0, 0]).x,
      divider = -70 + ray(joiner, [0, 0, 10], [0, 0, -1]).z;
    expect(freeEnd).toBeCloseTo(-59.5, 5);
    expect(divider).toBeCloseTo(-68, 5);
    // The authored outer box primitive also leaves an internal untrimmed cap
    // atZ12 inside the negative keyed-hole interval2..29.5. A first raw mesh
    // ray would mistake that cap for a physical stop. Keep both witnesses.
    expect(ray(joiner, [0, 0, 40], [0, 0, -1]).z).toBeCloseTo(12, 5);
    expect(freeEnd - divider).toBeCloseTo(8.5, 5);
    expect(ray(plain, [-120, 0, 0], [1, 0, 0]).x).toBeCloseTo(-99.5, 5);
    expect(ray(plain, [120, 0, 0], [-1, 0, 0]).x).toBeCloseTo(99.5, 5);
    expect(ray(bush, [7, 0, 20], [0, 0, -1]).z).toBeCloseTo(5, 5);
    expect(ray(bush, [7, 0, -20], [0, 0, 1]).z).toBeCloseTo(-5, 5);
  });
});
