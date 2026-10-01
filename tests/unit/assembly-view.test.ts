import { describe, expect, it } from "vitest";
import * as THREE from "three";
import {
  FLY_MS,
  hopHeight,
  hopPoint,
  staggerDelays,
  trayLayout,
} from "../../src/render/assembly";

describe("assembly view helpers", () => {
  it("lays tray items in rows without overlaps", () => {
    const sizes = [
      { x: 80, z: 40 },
      { x: 40, z: 40 },
      { x: 20, z: 20 },
      { x: 120, z: 60 },
      { x: 20, z: 40 },
    ];
    const { offsets, size } = trayLayout(sizes, 20);
    const boxes = offsets.map((o, i) => ({
      x0: o.x - sizes[i].x / 2,
      x1: o.x + sizes[i].x / 2,
      z0: o.z - sizes[i].z / 2,
      z1: o.z + sizes[i].z / 2,
    }));
    for (const b of boxes) {
      expect(b.x0).toBeGreaterThanOrEqual(-size.x / 2 - 1e-9);
      expect(b.x1).toBeLessThanOrEqual(size.x / 2 + 1e-9);
      expect(b.z0).toBeGreaterThanOrEqual(-size.z / 2 - 1e-9);
      expect(b.z1).toBeLessThanOrEqual(size.z / 2 + 1e-9);
    }
    boxes.forEach((a, i) =>
      boxes.slice(i + 1).forEach((b) => {
        const overlap =
          Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0) > 0 &&
          Math.min(a.z1, b.z1) - Math.max(a.z0, b.z0) > 0;
        expect(overlap).toBe(false);
      }),
    );
    // Roughly square, not one long row.
    expect(size.x / size.z).toBeLessThan(4);
  });

  it("hops along an arc from start to end", () => {
    const from = new THREE.Vector3(0, 0, 0),
      to = new THREE.Vector3(200, 0, 0);
    const hop = hopHeight(200);
    expect(hop).toBe(80);
    expect(hopPoint(from, to, 0, hop).toArray()).toEqual([0, 0, 0]);
    const end = hopPoint(from, to, 1, hop);
    expect(end.x).toBe(200);
    expect(end.y).toBeCloseTo(0);
    const mid = hopPoint(from, to, 0.5, hop);
    expect(mid.x).toBeCloseTo(100);
    // LDraw −Y is up: the arc rises to −hop halfway.
    expect(mid.y).toBeCloseTo(-80);
    // Clamped outside 0–1.
    expect(hopPoint(from, to, 2, hop).x).toBe(200);
  });

  it("staggers starts within a bounded window", () => {
    expect(staggerDelays(1)).toEqual([0]);
    expect(staggerDelays(4)).toEqual([0, 110, 220, 330]);
    const many = staggerDelays(40);
    expect(many[39]).toBeLessThanOrEqual(1500);
    expect(many[39] + FLY_MS).toBeLessThan(2200);
  });
});
