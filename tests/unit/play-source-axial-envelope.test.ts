import { describe, expect, it } from "vitest";
import { add, identity, mv } from "../../src/core/math";
import type { Transform, Vec3 } from "../../src/core/types";
import { axisRotation } from "../../src/mechanisms/kinematic";
import { fromPhysics, toPhysics } from "../../src/play/physics-frame";
import {
  axialEnvelopeInside,
  sourceAxialEnvelope,
  type SourceAxialEnvelope,
} from "../../src/play/source-axial-envelope";

const native = (points: Vec3[]) =>
  Float32Array.from(points.flatMap((p) => Object.values(toPhysics(p))));
const exactPoints = (points: Float32Array, t: Transform) =>
  Array.from({ length: points.length / 3 }, (_, i) =>
    add(
      t.position,
      mv(
        t.basis,
        fromPhysics({
          x: points[i * 3],
          y: points[i * 3 + 1],
          z: points[i * 3 + 2],
        }),
      ),
    ),
  );

describe("conservative source axial support certificates", () => {
  it("covers every Float32 support point under rotation, tilt, translation, scale and shear", () => {
    const points = native(
      Array.from(
        { length: 72 },
        (_, i): Vec3 => [
          8 * Math.cos((i * Math.PI) / 12),
          8 * Math.sin((i * Math.PI) / 12),
          i % 3 === 0 ? -0.05 : i % 3 === 1 ? 10 : 22.05,
        ],
      ),
    );
    const token = sourceAxialEnvelope(points, identity())!;
    let positive = 0,
      negative = 0;
    for (let n = 0; n < 100; n++) {
      const basis = axisRotation([0, 0, 1], n * 137);
      basis[2] += (n % 5) * 0.0001;
      basis[6] -= (n % 3) * 0.0001;
      basis[0] *= 1 + (n % 2) * 0.001;
      const transform: Transform = {
        position: [(n % 4) * 0.0001, 0, (n % 3) * 0.0001],
        basis,
      };
      const radius = n % 2 ? 9.102 : 7.99;
      const result = axialEnvelopeInside(
        token,
        transform,
        radius,
        -0.052,
        22.052,
      );
      if (result) {
        positive++;
        for (const p of exactPoints(points, transform)) {
          expect(Math.hypot(p[0], p[1])).toBeLessThanOrEqual(radius);
          expect(p[2]).toBeGreaterThanOrEqual(-0.052);
          expect(p[2]).toBeLessThanOrEqual(22.052);
        }
      } else negative++;
    }
    expect(positive).toBeGreaterThan(0);
    expect(negative).toBeGreaterThan(0);
  });
  it("declines uncertain envelopes even when the exact point remains inside", () => {
    const points = native([[8, 0, 1]]),
      token = sourceAxialEnvelope(points, identity())!;
    const shear: Transform = {
      position: [0, 0, 0],
      basis: [1, 1, 0, 0, 1, 0, 0, 0, 1],
    };
    expect(
      Math.hypot(...exactPoints(points, shear)[0].slice(0, 2)),
    ).toBeLessThan(9);
    expect(axialEnvelopeInside(token, shear, 9, 0, 2)).toBe(false);
  });
  it("refuses invalid supports, copied tokens and nonfinite current frames", () => {
    expect(sourceAxialEnvelope(new Float32Array(), identity())).toBeUndefined();
    expect(
      sourceAxialEnvelope(new Float32Array([1, 2]), identity()),
    ).toBeUndefined();
    expect(
      sourceAxialEnvelope(new Float32Array([NaN, 0, 0]), identity()),
    ).toBeUndefined();
    const token = sourceAxialEnvelope(native([[1, 0, 0]]), identity())!;
    expect(
      axialEnvelopeInside(
        { ...token } as SourceAxialEnvelope,
        identity(),
        2,
        -1,
        1,
      ),
    ).toBe(false);
    expect(
      axialEnvelopeInside(
        token,
        { ...identity(), position: [NaN, 0, 0] },
        2,
        -1,
        1,
      ),
    ).toBe(false);
    expect(axialEnvelopeInside(token, identity(), 2, 1, -1)).toBe(false);
  });
});
