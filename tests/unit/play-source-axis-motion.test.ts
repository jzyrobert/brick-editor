import { describe, expect, it } from "vitest";
import { add, compose, identity, mv } from "../../src/core/math";
import type { Transform, Vec3 } from "../../src/core/types";
import { axisRotation } from "../../src/mechanisms/kinematic";
import { fromPhysics, toPhysics } from "../../src/play/physics-frame";
import {
  sourceAxisMotion,
  sourceAxisTravel,
  type SourceAxisMotion,
} from "../../src/play/source-axis-motion";
const native = (points: Vec3[]) =>
  Float32Array.from(points.flatMap((p) => Object.values(toPhysics(p))));
const point = (t: Transform, p: Vec3) => add(t.position, mv(t.basis, p));

describe("complete fixed-axis source motion bounds", () => {
  it("uses sideways extent rather than shaft length while preserving full-turn arcs", () => {
    const points = native([
        [6, 0, -140],
        [-6, 0, 20],
        [0, 6, -60],
      ]),
      token = sourceAxisMotion(points, [0, 0, 0], [0, 0, 1])!;
    const after = { ...identity(), basis: axisRotation([0, 0, 1], 1.5) };
    expect(sourceAxisTravel(token, identity(), after, 1.5)).toBeLessThan(0.16);
    expect(
      sourceAxisTravel(token, identity(), identity(), 720),
    ).toBeGreaterThan(75);
  });
  it("covers every transformed support point, including offset pivots and actual-frame residuals", () => {
    const points = native(
        Array.from(
          { length: 30 },
          (_, i): Vec3 => [10 * Math.cos(i), 10 * Math.sin(i), i * 10 - 140],
        ),
      ),
      pivot: Vec3 = [2, -1, 20],
      axis: Vec3 = [0, 0, 1],
      token = sourceAxisMotion(points, pivot, axis)!;
    const before: Transform = {
      position: [91, -145, -83],
      basis: axisRotation(
        [1 / Math.sqrt(14), 2 / Math.sqrt(14), 3 / Math.sqrt(14)],
        37,
      ),
    };
    for (const degrees of [
      -1080, -360, -5, -1.5, -0.1, 0.1, 1.5, 5, 360, 1080,
    ]) {
      const rotation = axisRotation(axis, degrees),
        after = compose(before, {
          position: add(pivot, mv(rotation, pivot.map((v) => -v) as Vec3)),
          basis: rotation,
        });
      // Native/source drift must increase the certificate, never disappear.
      after.position[0] += 0.03;
      after.basis[4] += 0.0001;
      const bound = sourceAxisTravel(token, before, after, degrees)!;
      for (let i = 0; i < points.length; i += 3) {
        const p = fromPhysics({
            x: points[i],
            y: points[i + 1],
            z: points[i + 2],
          }),
          a = point(before, p),
          b = point(after, p);
        expect(Math.hypot(...a.map((v, k) => v - b[k]))).toBeLessThanOrEqual(
          bound,
        );
      }
    }
  });
  it("refuses forged or incomplete supports and invalid frame/axis data", () => {
    expect(
      sourceAxisMotion(new Float32Array(), [0, 0, 0], [0, 0, 1]),
    ).toBeUndefined();
    expect(
      sourceAxisMotion(native([[1, 0, 0]]), [0, 0, 0], [0, 0, 2]),
    ).toBeUndefined();
    const token = sourceAxisMotion(native([[1, 0, 0]]), [0, 0, 0], [0, 0, 1])!;
    expect(
      sourceAxisTravel(
        { ...token } as SourceAxisMotion,
        identity(),
        identity(),
        1,
      ),
    ).toBeUndefined();
    expect(
      sourceAxisTravel(token, identity(), identity(), NaN),
    ).toBeUndefined();
  });
});
