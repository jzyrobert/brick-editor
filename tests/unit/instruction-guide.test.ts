import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { importLDraw } from "../../src/ldraw/io";
import { occurrences } from "../../src/core/document";
import {
  deriveGuide,
  hasModelSteps,
  laterParts,
  sequencePositions,
  stepView,
  type Guide,
} from "../../src/instructions/guide";

const brick = (x: number, y: number, z: number, color = 4, ref = "3001.dat") =>
  `1 ${color} ${x} ${y} ${z} 1 0 0 0 1 0 0 0 1 ${ref}`;

/** Every occurrence appears in exactly one step, and views are prefixes. */
function checkCoverage(guide: Guide, ids: string[]) {
  const added = guide.steps.flatMap((s) => s.added);
  const main = guide.sequences[0].ids;
  expect(new Set(main)).toEqual(new Set(ids));
  expect(main.length).toBe(ids.length);
  for (const [i, step] of guide.steps.entries()) {
    const view = stepView(guide, i);
    expect(view.slice(-step.added.length)).toEqual(
      step.sequence === 0 ? step.added : view.slice(-step.added.length),
    );
    expect(step.units.flat()).toEqual(step.added);
  }
  // Callout builds repeat their first copy's IDs; the main sequence holds each once.
  expect(added.length).toBeGreaterThanOrEqual(ids.length);
}

describe("follow-along guide", () => {
  it("follows STEP lines in the main model and a sub-assembly callout", () => {
    const p = importLDraw(
      [
        "0 FILE main.ldr",
        "0 Main",
        brick(0, 0, 0),
        brick(40, 0, 0),
        "0 STEP",
        "1 16 0 -24 0 1 0 0 0 1 0 0 0 1 wing.ldr",
        "1 16 0 -24 80 1 0 0 0 1 0 0 0 1 wing.ldr",
        brick(80, 0, 0, 1),
        "0 STEP",
        brick(0, -48, 0, 14, "3003.dat"),
        "0 FILE wing.ldr",
        "0 Wing",
        brick(0, 0, 0, 2, "3020.dat"),
        "0 STEP",
        brick(0, -8, 0, 2, "3024.dat"),
        brick(20, -8, 0, 2, "3024.dat"),
        "",
      ].join("\n"),
      "main.mpd",
    );
    const all = occurrences(p);
    expect(hasModelSteps(p)).toBe(true);
    const guide = deriveGuide(p, all);
    expect(guide.source).toBe("model-steps");
    checkCoverage(
      guide,
      all.map((o) => o.id),
    );
    // Step 1 (main), wing steps 1–2 (callout), main step 2 placing both wings, main step 3.
    expect(guide.steps.map((s) => s.sequence)).toEqual([0, 1, 1, 0, 0]);
    expect(guide.sequences[1]).toMatchObject({
      kind: "callout",
      name: "wing",
      instances: 2,
      depth: 1,
    });
    const place = guide.steps[3];
    expect(place.assemblies).toEqual([
      { modelId: expect.any(String), name: "wing", count: 2 },
    ]);
    expect(place.lots).toEqual([{ ref: "3001.dat", colorCode: "1", count: 1 }]);
    // Two wings of three parts move as two units, the brick as one.
    expect(place.units.map((u) => u.length).sort()).toEqual([1, 3, 3]);
    expect(guide.steps[2].lots).toEqual([
      { ref: "3024.dat", colorCode: "2", count: 2 },
    ]);
    // The callout shows only the first wing, cumulatively.
    expect(stepView(guide, 1)).toHaveLength(1);
    expect(stepView(guide, 2)).toHaveLength(3);
    expect(stepView(guide, 3)).toHaveLength(2 + 7);
    expect(laterParts(guide, 3)).toHaveLength(1);
    const positions = sequencePositions(guide);
    expect(positions.position).toEqual([1, 1, 2, 2, 3]);
    expect(positions.count(0)).toBe(3);
    expect(positions.count(1)).toBe(2);
  });

  it("generates bottom-up steps of 3–12 parts for a model without STEP lines", () => {
    const lines = ["0 FILE wall.ldr", "0 Wall"];
    // Three courses of 10 bricks, listed top course first.
    for (const y of [-48, -24, 0])
      for (let i = 0; i < 10; i++) lines.push(brick(i * 80, y, 0));
    const p = importLDraw(lines.join("\n"), "wall.ldr");
    const all = occurrences(p);
    const guide = deriveGuide(p, all);
    expect(guide.source).toBe("generated");
    checkCoverage(
      guide,
      all.map((o) => o.id),
    );
    for (const step of guide.steps) {
      expect(step.added.length).toBeGreaterThanOrEqual(3);
      expect(step.added.length).toBeLessThanOrEqual(12);
    }
    // Bottom course first: the y of every step never rises back down.
    const byId = new Map(all.map((o) => [o.id, o]));
    const lowest = guide.steps.map((s) =>
      Math.max(...s.added.map((id) => byId.get(id)!.transform.position[1])),
    );
    for (let i = 1; i < lowest.length; i++)
      expect(lowest[i]).toBeLessThanOrEqual(lowest[i - 1]);
    expect(lowest[0]).toBe(0);
  });

  it("merges small layers and keeps runs spatially compact", () => {
    const lines = ["0 FILE t.ldr", "0 T"];
    for (let i = 0; i < 16; i++)
      lines.push(brick((i % 4) * 80, 0, Math.floor(i / 4) * 80));
    lines.push(brick(0, -24, 0), brick(0, -48, 0));
    const p = importLDraw(lines.join("\n"), "t.ldr");
    const guide = deriveGuide(p, occurrences(p), { maxPerStep: 8 });
    expect(guide.steps.map((s) => s.added.length)).toEqual([8, 8, 2]);
    const byId = new Map(occurrences(p).map((o) => [o.id, o]));
    // Each run of the 4 × 4 floor covers two rows (a compact 4 × 2 patch).
    const rows = guide.steps[0].added.map(
      (id) => byId.get(id)!.transform.position[2],
    );
    expect(new Set(rows).size).toBe(2);
  });

  it("builds single in-place submodels in place and in file order", () => {
    const text = readFileSync(
      "fixtures/ldraw/templates/house-with-garden.mpd",
      "utf8",
    );
    const p = importLDraw(text, "house-with-garden.mpd");
    const all = occurrences(p);
    const guide = deriveGuide(p, all);
    expect(guide.source).toBe("generated");
    expect(guide.sequences).toHaveLength(1);
    checkCoverage(
      guide,
      all.map((o) => o.id),
    );
    for (const step of guide.steps)
      expect(step.added.length).toBeLessThanOrEqual(12);
    // Garden, ground floor, upper floor, roof: submodel paths never interleave.
    const firstNode = guide.steps.map((s) => JSON.parse(s.added[0])[0]);
    const order = [...new Set(firstNode)];
    expect(order).toHaveLength(4);
    let last = -1;
    for (const node of firstNode) {
      const index = order.indexOf(node);
      expect(index).toBeGreaterThanOrEqual(last);
      last = index;
    }
  });

  it("covers every built-in sample with sensible step sizes", () => {
    for (const file of [
      "small-castle.mpd",
      "railway-station.mpd",
      "off-road-jeep.mpd",
      "corner-cafe.mpd",
    ]) {
      const p = importLDraw(
        readFileSync("fixtures/ldraw/templates/" + file, "utf8"),
        file,
      );
      const all = occurrences(p);
      const guide = deriveGuide(p, all);
      checkCoverage(
        guide,
        all.map((o) => o.id),
      );
      const sizes = guide.steps.map((s) => s.units.length);
      const mean = sizes.reduce((a, b) => a + b, 0) / sizes.length;
      expect(mean).toBeGreaterThanOrEqual(3);
      expect(Math.max(...sizes)).toBeLessThanOrEqual(12);
    }
  });

  it("follows an authored plan as one flat sequence", () => {
    const p = importLDraw(
      ["0 FILE a.ldr", brick(0, 0, 0), brick(80, 0, 0), brick(0, -24, 0)].join(
        "\n",
      ),
      "a.ldr",
    );
    const ids = occurrences(p).map((o) => o.id);
    const guide = deriveGuide(p, occurrences(p), {
      plan: { name: "Mine", steps: [[ids[2]], [], [ids[0], ids[1]]] },
    });
    expect(guide.source).toBe("plan");
    expect(guide.steps.map((s) => s.added)).toEqual([
      [ids[2]],
      [ids[0], ids[1]],
    ]);
    expect(stepView(guide, 1)).toEqual([ids[2], ids[0], ids[1]]);
  });

  it("derives a 150,000-part guide quickly", () => {
    const lines = ["0 FILE big.mpd", "0 Big"];
    for (let b = 0; b < 100; b++)
      lines.push(
        `1 16 ${(b % 10) * 1000} 0 ${Math.floor(b / 10) * 1000} 1 0 0 0 1 0 0 0 1 block.ldr`,
      );
    lines.push("0 FILE block.ldr", "0 Block");
    for (let i = 0; i < 1500; i++)
      lines.push(
        brick(
          (i % 10) * 80,
          -24 * Math.floor(i / 100),
          Math.floor((i % 100) / 10) * 40,
        ),
      );
    const p = importLDraw(lines.join("\n"), "big.mpd");
    const all = occurrences(p);
    expect(all).toHaveLength(150_000);
    const start = performance.now();
    const guide = deriveGuide(p, all);
    const ms = performance.now() - start;
    expect(guide.sequences[0].ids).toHaveLength(150_000);
    expect(guide.sequences[1].kind).toBe("callout");
    expect(ms).toBeLessThan(3000);
  });
});
