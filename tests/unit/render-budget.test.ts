import { describe, expect, it } from "vitest";
import { RESOURCE_PROFILES } from "../../src/core/resource-profile";
import {
  checkRenderBudget,
  RENDER_BUDGETS,
  renderBudget,
} from "../../src/render/render-budget";
import {
  boxProxy,
  collisionProxy,
  isCollisionOmitted,
  keepsOpenings,
  partTitle,
} from "../../src/play/collision-proxy";
import { readPack } from "../helpers/official-geometry";
import {
  architecturalStressModel,
  stressVariants,
} from "../helpers/architectural-stress";

const refusal = (fn: () => void) => {
  try {
    fn();
  } catch (e) {
    return e as Error & { code: string; details: Record<string, unknown> };
  }
  throw new Error("expected a refusal");
};

describe("renderer budgets follow the resource profile", () => {
  it("draws up to the profile's expanded-occurrence limit", () => {
    expect(RENDER_BUDGETS.desktop.partOccurrences).toBe(
      RESOURCE_PROFILES.desktop.occurrences,
    );
    expect(RENDER_BUDGETS.mobile.partOccurrences).toBe(
      RESOURCE_PROFILES.mobile.occurrences,
    );
    // Far above the old reference-renderer caps (5,000 parts, 128 variants).
    expect(RENDER_BUDGETS.mobile.partOccurrences).toBeGreaterThan(5000);
    expect(RENDER_BUDGETS.mobile.variants).toBeGreaterThan(128);
  });
  it("keeps phones strictly tighter than desktop on every resource", () => {
    for (const key of Object.keys(RENDER_BUDGETS.desktop) as Array<
      keyof typeof RENDER_BUDGETS.desktop
    >)
      expect(RENDER_BUDGETS.mobile[key], key).toBeLessThanOrEqual(
        RENDER_BUDGETS.desktop[key],
      );
    expect(RENDER_BUDGETS.mobile.variants).toBeLessThan(
      RENDER_BUDGETS.desktop.variants,
    );
    expect(RENDER_BUDGETS.mobile.sceneTriangles).toBeLessThan(
      RENDER_BUDGETS.desktop.sceneTriangles,
    );
  });
  it("accepts exact boundaries and refuses one over with a clear message", () => {
    for (const profile of ["desktop", "mobile"] as const) {
      const b = renderBudget(profile);
      expect(() =>
        checkRenderBudget(profile, {
          partOccurrences: b.partOccurrences,
          variants: b.variants,
          prototypeTriangles: b.prototypeTriangles,
          sceneTriangles: b.sceneTriangles,
          rawOccurrences: b.rawOccurrences,
        }),
      ).not.toThrow();
      const e = refusal(() =>
        checkRenderBudget(profile, { variants: b.variants + 1 }),
      );
      expect(e.code).toBe("LIMIT_EXCEEDED");
      expect(e.message).toContain("distinct part/colour variants");
      expect(e.message).toContain(b.variants.toLocaleString("en-US"));
      expect(e.message).toContain("Nothing was drawn");
      expect(e.details).toEqual({
        resource: "variants",
        used: b.variants + 1,
        budget: b.variants,
        profile,
      });
    }
  });
  it("refuses a desktop-sized model on the phone profile and points to desktop limits", () => {
    const usage = { partOccurrences: 160000, variants: 300 };
    expect(() => checkRenderBudget("desktop", usage)).not.toThrow();
    const e = refusal(() => checkRenderBudget("mobile", usage));
    expect(e.message).toMatch(
      /160,000 part occurrences; the phone renderer budget is 150,000/,
    );
    expect(e.message).toContain("Device limits");
    const triangles = refusal(() =>
      checkRenderBudget("mobile", { sceneTriangles: 30_000_000 }),
    );
    expect(triangles.message).toContain("scene triangles");
  });
  it("keeps enough unused prototypes that undo does not recompile", () => {
    expect(RENDER_BUDGETS.desktop.retainedUnusedPrototypes).toBeGreaterThan(
      128,
    );
    expect(RENDER_BUDGETS.mobile.retainedUnusedPrototypes).toBeGreaterThan(0);
  });
});

describe("stress fixture", () => {
  it("generates exact part and variant counts from official architectural parts", () => {
    const model = architecturalStressModel({ parts: 6000, variants: 200 });
    const lines = model.text
      .split("\n")
      .filter((l) => /^1 /.test(l) && !/floor-\d+\.ldr$/.test(l));
    expect(lines).toHaveLength(6000);
    const variants = new Set(
      lines.map((l) => {
        const t = l.split(/\s+/);
        return t[1] + ":" + t[14];
      }),
    );
    expect(variants.size).toBe(200);
    expect(model.text.match(/^0 FILE /gm)).toHaveLength(5);
    // Deterministic.
    expect(architecturalStressModel({ parts: 6000, variants: 200 }).text).toBe(
      model.text,
    );
    expect(stressVariants().length).toBeGreaterThanOrEqual(300);
  });
});

describe("large-world collision proxies", () => {
  it("omits stud and underside-tube primitives only", () => {
    expect(isCollisionOmitted("stud.dat")).toBe(true);
    expect(isCollisionOmitted("stud4.dat")).toBe(true);
    expect(isCollisionOmitted("48/stud2a.dat")).toBe(true);
    expect(isCollisionOmitted("stug-2x2.dat")).toBe(true);
    expect(isCollisionOmitted("box5.dat")).toBe(false);
    expect(isCollisionOmitted("4-4cyli.dat")).toBe(false);
    expect(isCollisionOmitted("s/3001s01.dat")).toBe(false);
  });
  it("composes transforms and emits quads as two triangles", () => {
    const sources: Record<string, string> = {
      "part.dat": [
        "0 BFC CERTIFY CCW",
        "1 16 10 0 0 2 0 0 0 1 0 0 0 1 face.dat",
        "1 16 0 -4 0 1 0 0 0 1 0 0 0 1 stud.dat",
      ].join("\n"),
      "face.dat": "4 16 0 0 0 1 0 0 1 0 1 0 0 1",
      "stud.dat": "3 16 0 0 0 1 0 0 0 0 1",
    };
    const proxy = collisionProxy((n) => sources[n], "part.dat")!;
    expect([...proxy]).toEqual([
      10, 0, 0, 12, 0, 0, 12, 0, 1, 10, 0, 0, 12, 0, 1, 10, 0, 1,
    ]);
    expect(collisionProxy((n) => sources[n], "missing.dat")).toBeUndefined();
    expect(
      collisionProxy(
        (n) => (n === "face.dat" ? undefined : sources[n]),
        "part.dat",
      ),
    ).toBeUndefined();
  });
  it("keeps a real brick's body and drops its studs and tubes", () => {
    const proxy = collisionProxy(readPack, "3001.dat")!;
    expect(proxy).toBeDefined();
    const ys = [...proxy].filter((_, i) => i % 3 === 1);
    // Body from the top surface (y 0) down to the bottom (y 24): no stud tops at y -4.
    expect(Math.min(...ys)).toBe(0);
    expect(Math.max(...ys)).toBe(24);
    const xs = [...proxy].filter((_, i) => i % 3 === 0);
    expect([Math.min(...xs), Math.max(...xs)]).toEqual([-40, 40]);
    // The full surface (nothing omitted) is several times larger.
    const full = collisionProxy(readPack, "3001.dat", () => false)!;
    expect(Math.min(...[...full].filter((_, i) => i % 3 === 1))).toBe(-4);
    expect(proxy.length * 3).toBeLessThan(full.length);
    // A door frame keeps its opening: nothing blocks the doorway's centre line.
    const frame = collisionProxy(readPack, "60596.dat")!;
    expect(frame.length).toBeGreaterThan(0);
    let blocking = 0;
    for (let i = 0; i < frame.length; i += 9) {
      const tri = [0, 3, 6].map((o) => [
        frame[i + o],
        frame[i + o + 1],
        frame[i + o + 2],
      ]);
      const minX = Math.min(...tri.map((p) => p[0])),
        maxX = Math.max(...tri.map((p) => p[0])),
        minY = Math.min(...tri.map((p) => p[1])),
        maxY = Math.max(...tri.map((p) => p[1]));
      // The doorway is centred on x = 0, 20 LDU either side, from y 8 up to y 120.
      if (minX < 10 && maxX > -10 && minY < 100 && maxY > 20) blocking++;
    }
    expect(blocking).toBe(0);
  });
  it("reduces parts without doorways or arches to boxes at the coarsest level", () => {
    const title = (ref: string) => partTitle(readPack(ref)!);
    expect(title("60596.dat")).toMatch(/^Door\s+1 x\s+4 x\s+6 Frame/);
    expect(keepsOpenings(title("60596.dat"))).toBe(true);
    expect(keepsOpenings(title("3659.dat"))).toBe(true);
    expect(keepsOpenings(title("3001.dat"))).toBe(false);
    expect(keepsOpenings(title("60592.dat"))).toBe(false);
    const box = boxProxy(collisionProxy(readPack, "3062b.dat")!);
    expect(box.length).toBe(12 * 9);
    const ys = [...box].filter((_, i) => i % 3 === 1);
    expect([Math.min(...ys), Math.max(...ys)]).toEqual([0, 24]);
    expect(boxProxy(new Float32Array(0)).length).toBe(0);
  });
});
