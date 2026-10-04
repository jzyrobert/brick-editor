import { expect, it } from "vitest";
import { occurrences } from "../../src/core/document";
import {
  compose,
  identity,
  inverse,
  nearlyPhysical,
  physical,
  rotationY,
} from "../../src/core/math";
import { exportLDraw, importLDraw } from "../../src/ldraw/io";
import { posedLDraw } from "../../src/mechanisms/posed-export";

const rounded = () =>
  importLDraw("1 16 15 -20 30 0.7071 0 0.7071 0 1 0 -0.7071 0 0.7071 3001.dat");
it("exports a strict rigid motion of an authored decimal basis without normalizing its source", () => {
  const p = rounded(),
    before = JSON.stringify(p),
    source = exportLDraw(p),
    o = occurrences(p)[0],
    delta = {
      position: [60, -4, 20] as [number, number, number],
      basis: rotationY(74),
    },
    target = compose(delta, o.transform);
  expect(physical(o.transform)).toBe(false);
  expect(nearlyPhysical(o.transform)).toBe(true);
  expect(physical(target)).toBe(false);
  expect(physical(compose(target, inverse(o.transform)))).toBe(true);
  const out = posedLDraw(p, { [o.id]: target }),
    imported = occurrences(importLDraw(out.text))[0];
  expect(out.posedOccurrenceIds).toEqual([o.id]);
  for (let k = 0; k < 9; k++)
    expect(imported.transform.basis[k]).toBeCloseTo(target.basis[k], 6);
  for (let k = 0; k < 3; k++)
    expect(imported.transform.position[k]).toBeCloseTo(target.position[k], 3);
  expect(JSON.stringify(p)).toBe(before);
  expect(exportLDraw(p)).toBe(source);
});
it("keeps newly introduced scale, shear, reflection and nonfinite poses invalid", () => {
  const p = rounded(),
    o = occurrences(p)[0];
  for (const basis of [
    [1.0001, 0, 0, 0, 1, 0, 0, 0, 1],
    [1, 0.0001, 0, 0, 1, 0, 0, 0, 1],
    [-1, 0, 0, 0, 1, 0, 0, 0, 1],
    [Infinity, 0, 0, 0, 1, 0, 0, 0, 1],
  ]) {
    const target = compose(
      { ...identity(), basis: basis as typeof o.transform.basis },
      o.transform,
    );
    expect(() => posedLDraw(p, { [o.id]: target })).toThrow(/finite rigid/);
  }
});
it("refuses rounded ancestry outside the existing LDraw member allowance", () => {
  const p = importLDraw("1 16 0 0 0 1.01 0 0 0 1 0 0 0 1 3001.dat"),
    o = occurrences(p)[0];
  expect(nearlyPhysical(o.transform)).toBe(false);
  expect(() =>
    posedLDraw(p, {
      [o.id]: compose({ ...identity(), basis: rotationY(30) }, o.transform),
    }),
  ).toThrow(/rigid/);
});
it("retains strict absolute rigid transform exports for ordinary source parts", () => {
  const p = importLDraw("1 16 0 0 0 1 0 0 0 1 0 0 0 1 3001.dat"),
    o = occurrences(p)[0];
  expect(
    posedLDraw(p, {
      [o.id]: { ...identity(), position: [4, 5, 6], basis: rotationY(55) },
    }).posedOccurrenceIds,
  ).toEqual([o.id]);
});
