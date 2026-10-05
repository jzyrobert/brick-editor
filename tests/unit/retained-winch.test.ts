import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import { compose } from "../../src/core/math";
import { occurrences } from "../../src/core/document";
import { importLDraw } from "../../src/ldraw/io";
import { axisRotation } from "../../src/mechanisms/kinematic";
import {
  bindRetainedWinchSources,
  isRetainedWinch,
  retainedWinch,
} from "../../src/mechanisms/retained-winch";
import {
  fullLibrarySources,
  registerFullLibraryFromDisk,
} from "../../scripts/full-library-node";
import { Mesh, DoubleSide, Raycaster, Vector3 } from "three";
import { compileOfficialPart } from "../helpers/compile-part";
const text = readFileSync(
  "fixtures/ldraw/technic/42042-retained-winch.ldr",
  "utf8",
);
const project = () => importLDraw(text);
let sources: Record<string, string>;
beforeAll(() => {
  registerFullLibraryFromDisk();
  sources = fullLibrarySources(occurrences(project()).map((o) => o.node.ref));
});
describe("literal retained crane winch", () => {
  it("requires all12 source members and separates captured shafts from the connected carrier", async () => {
    const p = project(),
      before = JSON.stringify(p),
      all = occurrences(p),
      binding = await bindRetainedWinchSources(sources, p);
    const worm = all.find((o) => o.node.ref === "4716.dat")!;
    const witness = retainedWinch(worm, all, binding);
    expect(isRetainedWinch(witness)).toBe(true);
    expect(isRetainedWinch(structuredClone(witness))).toBe(false);
    expect(witness.carrierMembers).toHaveLength(8);
    expect(witness.inputMembers).toHaveLength(2);
    expect(witness.outputMembers).toHaveLength(2);
    expect(witness.keyedCarrierEdges).toHaveLength(10);
    expect(witness.captures.map((c) => c.spanLdu)).toEqual([
      [-20, 20],
      [-10, 10],
    ]);
    expect(witness.ratio).toBe(1 / 8);
    expect(JSON.stringify(p)).toBe(before);
    const omitted = all.filter((o) => o.id !== witness.carrierMembers[0]);
    expect(() => retainedWinch(worm, omitted, binding)).toThrow("winch seat");
    const floating = structuredClone(all);
    floating.find((o) => o.node.ref === "6536.dat")!.transform.position[0] += 1;
    expect(() => retainedWinch(worm, floating, binding)).toThrow("winch seat");
    expect(() =>
      retainedWinch(worm, [...all, { ...all[0], id: "duplicate" }], binding),
    ).toThrow("ambiguous");
  });
  it("retains literal seats under a common oblique world transform", async () => {
    const p = project(),
      binding = await bindRetainedWinchSources(sources, p);
    const frame = {
      position: [317, -88, 51] as [number, number, number],
      basis: axisRotation([0, 1, 0], 37),
    };
    const all = occurrences(p).map((o) => ({
      ...o,
      transform: compose(frame, o.transform),
    }));
    const witness = retainedWinch(
      all.find((o) => o.node.ref === "4716.dat")!,
      all,
      binding,
    );
    expect(witness.ratio).toBe(1 / 8);
    expect(witness.carrierMembers).toHaveLength(8);
  });
  it("binds every actual support dependency and refuses source mutation or embedded shadows", async () => {
    await expect(
      bindRetainedWinchSources(
        {
          ...sources,
          "axlehol4.dat": sources["axlehol4.dat"] + "\n3 16 0 0 0 1 0 0 0 1 0",
        },
        project(),
      ),
    ).rejects.toThrow("geometry changed");
    const shadow = importLDraw(
      "0 FILE winch.ldr\n" +
        text +
        "\n0 NOFILE\n0 FILE axlehol4.dat\n0 Embedded source shadow\n0 NOFILE\n",
    );
    await expect(bindRetainedWinchSources(sources, shadow)).rejects.toThrow(
      "shadows",
    );
    await expect(bindRetainedWinchSources({}, project())).rejects.toThrow(
      "Missing reviewed",
    );
  });
  it("independently measures real carrier bores and gear/worm shoulder surfaces", async () => {
    const surface = async (ref: string) => {
      const group = await compileOfficialPart(ref);
      group.updateMatrixWorld(true);
      group.traverse((o) => {
        if (o instanceof Mesh)
          for (const m of Array.isArray(o.material) ? o.material : [o.material])
            m.side = DoubleSide;
      });
      return group;
    };
    const beam = await surface("32449.dat"),
      block = await surface("6536.dat"),
      gear = await surface("10928.dat"),
      worm = await surface("4716.dat");
    const cast = (object: typeof beam, origin: number[], direction: number[]) =>
      new Raycaster(
        new Vector3(...origin),
        new Vector3(...direction),
      ).intersectObject(object, true)[0];
    // The round carrier cores are R6, not a false hull covering the openings.
    expect(cast(beam, [0, 0, 10], [1, 0, 0]).point.x).toBeCloseTo(6, 5);
    expect(cast(block, [0, 20, 0], [1, 0, 0]).point.x).toBeCloseTo(6, 5);
    // At radius7 the cap surfaces are actual material outside those R6 bores.
    expect(cast(gear, [7, 0, 20], [0, 0, -1]).point.z).toBeCloseTo(10, 5);
    expect(cast(worm, [7, 0, 30], [0, 0, -1]).point.z).toBeCloseTo(20, 5);
  });
});
