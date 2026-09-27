import { describe, expect, it } from "vitest";
import { resolveQuality } from "../../src/render/quality";
describe("bounded render profiles", () => {
  it("provides genuinely distinct profiles and independent controls", () => {
    expect(resolveQuality("fast")).toMatchObject({
      edges: "none",
      pixelRatioCap: 1,
      shadows: "off",
      toneMapping: "neutral",
    });
    expect(resolveQuality("balanced")).toMatchObject({
      edges: "all",
      shadows: "off",
      toneMapping: "aces",
    });
    expect(resolveQuality("photo")).toMatchObject({
      edges: "all",
      shadows: "soft",
      shadowMapSize: 2048,
    });
    expect(
      resolveQuality("fast", {
        edges: "ordinary",
        exposure: 2,
        pixelRatioCap: 1.5,
      }),
    ).toMatchObject({
      edges: "ordinary",
      exposure: 2,
      pixelRatioCap: 1.5,
      shadows: "off",
    });
    expect(resolveQuality("fast").exposure).toBe(1);
  });
  it("rejects unknown or unbounded quality parameters", () => {
    for (const controls of [
      { exposure: NaN },
      { exposure: 5 },
      { pixelRatioCap: 0 },
      { pixelRatioCap: 4 },
      { shadowMapSize: 8192 },
      { edges: "wireframe" },
      { unexpected: true },
    ])
      expect(() => resolveQuality("photo", controls as any)).toThrow();
    expect(() => resolveQuality("unknown" as any)).toThrow();
  });
});
