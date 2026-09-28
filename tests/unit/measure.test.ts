import { expect, it } from "vitest";
import { measure } from "../../src/edit/measure";

it("reports distances in studs, plates and straight LDU", () => {
  expect(measure([0, 0, 0], [80, -24, 40])).toEqual({
    delta: [80, 24, 40],
    straight: 92.61,
    label: "4 studs across · 2 studs deep · 3 plates up · 92.61 LDU straight",
  });
  expect(measure([0, -8, 0], [20, 0, 0]).label).toBe(
    "1 stud across · 1 plate down · 21.54 LDU straight",
  );
  expect(measure([5, 5, 5], [5, 5, 5]).label).toBe(
    "Same point · 0 LDU straight",
  );
});
