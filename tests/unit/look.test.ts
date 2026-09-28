import { describe, expect, it } from "vitest";
import {
  classifyFinish,
  lookControls,
  lookUsesPipeline,
  parseFlakeMaterials,
  resolveLook,
} from "../../src/render/look";
import { jitterOffset } from "../../src/render/look-pipeline";

describe("render looks", () => {
  it("keeps standard as the unchanged default and makes realistic looks distinct", () => {
    expect(resolveLook("standard")).toMatchObject({
      environment: "none",
      materials: "ldraw",
      ambientOcclusion: "off",
      edges: "quality",
      shadows: "quality",
      ground: "grid",
      samples: 1,
      vignette: 0,
      toneMapping: "quality",
      exposureScale: 1,
    });
    expect(lookUsesPipeline(resolveLook("standard"))).toBe(false);
    expect(resolveLook("realistic")).toMatchObject({
      environment: "room",
      materials: "plastic",
      ambientOcclusion: "gtao",
      edges: "hidden",
      shadows: "soft",
      ground: "shadow",
      samples: 1,
      toneMapping: "neutral",
    });
    expect(resolveLook("photo").samples).toBeGreaterThan(1);
    expect(lookUsesPipeline(resolveLook("photo"), false)).toBe(true);
  });
  it("degrades full-screen passes on the mobile resource profile", () => {
    const phone = resolveLook("realistic", {}, "mobile");
    expect(phone).toMatchObject({
      resourceProfile: "mobile",
      environment: "room",
      materials: "plastic",
      ambientOcclusion: "off",
      vignette: 0,
    });
    // Phone realistic draws directly, like the standard look.
    expect(lookUsesPipeline(phone)).toBe(false);
    expect(resolveLook("photo", {}, "mobile").samples).toBeLessThan(
      resolveLook("photo").samples,
    );
    // Explicit controls still win.
    expect(
      resolveLook("realistic", { ambientOcclusion: "gtao" }, "mobile")
        .ambientOcclusion,
    ).toBe("gtao");
  });
  it("round-trips controls and rejects unknown or unbounded controls", () => {
    const look = resolveLook("photo", { samples: 8 });
    expect(resolveLook("photo", lookControls(look))).toEqual(look);
    expect(() => resolveLook("glossy" as never)).toThrow();
    for (const controls of [
      { samples: 0 },
      { samples: 65 },
      { samples: 1.5 },
      { vignette: 0.9 },
      { exposureScale: 0 },
      { environment: "studio" },
      { unknown: 1 },
    ])
      expect(() => resolveLook("realistic", controls as never)).toThrow(
        /bounds/,
      );
  });
  it("classifies LDrawLoader finishes", () => {
    const m = (
      name: string,
      roughness: number,
      metalness: number,
      transparent = false,
    ) => ({ name, roughness, metalness, transparent });
    expect(classifyFinish(m("Red", 0.3, 0))).toBe("plastic");
    expect(classifyFinish(m("Trans_Clear", 0.3, 0, true))).toBe("transparent");
    expect(classifyFinish(m("Chrome_Silver", 0, 1))).toBe("chrome");
    expect(classifyFinish(m("Pearl_Gold", 0.3, 0.25))).toBe("pearlescent");
    expect(classifyFinish(m("Rubber_Black", 0.9, 0))).toBe("rubber");
    expect(classifyFinish(m("Metallic_Silver", 0.2, 0.85))).toBe("metal");
    expect(classifyFinish(m("Matte_Metallic", 0.8, 0.4))).toBe(
      "matte-metallic",
    );
    expect(classifyFinish(m("Glitter_Trans_Clear", 0.3, 0, true))).toBe(
      "glitter",
    );
    expect(classifyFinish(m("Speckle_Black_Silver", 0.3, 0))).toBe("speckle");
    expect(
      classifyFinish({
        ...m("Glow", 0.3, 0),
        emissive: { r: 0.2, g: 0.2, b: 0 },
      }),
    ).toBe("luminous");
  });
  it("parses LDConfig glitter and speckle materials", () => {
    const specs = parseFlakeMaterials(
      [
        "0 !COLOUR Glitter_Trans_Clear CODE 117 VALUE #EEEEEE EDGE #BABABA ALPHA 128 MATERIAL GLITTER VALUE #FFFFFF FRACTION 0.08 VFRACTION 0.1 SIZE 1",
        "0 !COLOUR Speckle_Black_Silver CODE 132 VALUE #000000 EDGE #898788 MATERIAL SPECKLE VALUE #898788 FRACTION 0.4 MINSIZE 1 MAXSIZE 3",
        "0 !COLOUR Red CODE 4 VALUE #B40000 EDGE #333333",
      ].join("\n"),
    );
    expect(specs.size).toBe(2);
    expect(specs.get("glitter_trans_clear")).toMatchObject({
      kind: "glitter",
      color: "#FFFFFF",
      fraction: 0.08,
      size: 1,
    });
    const speckle = specs.get("speckle_black_silver")!;
    expect(speckle.kind).toBe("speckle");
    expect(speckle.fraction).toBeCloseTo(0.2);
    expect(speckle.size).toBeCloseTo(2.4);
  });
  it("jitters later accumulation samples within one pixel", () => {
    expect(jitterOffset(0)).toEqual([0, 0]);
    const offsets = Array.from({ length: 32 }, (_, i) => jitterOffset(i + 1));
    for (const [x, y] of offsets) {
      expect(Math.abs(x)).toBeLessThan(0.5);
      expect(Math.abs(y)).toBeLessThan(0.5);
    }
    expect(new Set(offsets.map((o) => o.join())).size).toBe(32);
  });
});
