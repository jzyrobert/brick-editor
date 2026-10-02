import { expect, it } from "vitest";
import { importLDraw, exportLDraw } from "../../src/ldraw/io";
import { occurrences } from "../../src/core/document";
import { instructionComponents } from "../../src/instructions/components";
import { instructionLots } from "../../src/instructions/lots";
import { generateInstructions } from "../../src/instructions/generate";
import { prepareInstructionPlan } from "../../src/instructions/publish";
const placement = (ref: string, x = 0) =>
  `1 4 ${x} 0 0 1 0 0 0 1 0 0 0 1 ${ref}`;
const path = () =>
  importLDraw(
    "0 FILE root.ldr\n" +
      placement("hose.ldr") +
      "\n" +
      placement("hose.ldr", 200) +
      "\n" +
      placement("3001.dat", 400) +
      "\n0 FILE hose.ldr\n0 !LDCAD CONTENT [type=path] [addFallBack=default]\n0 !LDCAD GENERATED [generator=test]\n3 4 0 0 0 20 0 0 0 -20 0\n3 4 20 0 0 40 0 0 20 -20 0",
  );
it("owns repeated generated paths separately and introduces each entire drawing once", () => {
  const p = path(),
    before = exportLDraw(p),
    components = instructionComponents(p);
  expect(components).toHaveLength(2);
  expect(components.map((c) => c.occurrenceIds.length)).toEqual([2, 2]);
  const { plan } = generateInstructions(p, { maxPerStep: 1 });
  expect(plan.steps.map((s) => s.length).sort()).toEqual([1, 2, 2]);
  expect(new Set(plan.steps.flat())).toEqual(
    new Set(occurrences(p).map((o) => o.id)),
  );
  expect(exportLDraw(p)).toBe(before);
  p.instructionPlans.draft = plan;
  const prepared = prepareInstructionPlan(p, "draft");
  expect(
    prepared.inventory.find((l) => l.kind === "generated-component")?.quantity,
  ).toBe(2);
  expect(
    prepared.inventory
      .filter((l) => !l.kind)
      .reduce((n, l) => n + l.quantity, 0),
  ).toBe(1);
  expect(prepared.warnings.join(" ")).toMatch(
    /not a verified physical parts list/,
  );
  expect(prepared.assemblyValidated).toBe(false);
});
it("rejects partial physical owners in publication but permits an explicitly drawing-only editor preview", () => {
  const p = path(),
    component = instructionComponents(p)[0];
  expect(() =>
    instructionLots(p, [component.occurrenceIds[0]], { physical: true }),
  ).toThrow(/split across steps/);
  expect(
    instructionLots(p, [component.occurrenceIds[0]], {
      physical: true,
      allowPartial: true,
    })[0],
  ).toMatchObject({ quantity: 0, kind: "drawing" });
});
it("distinguishes LSynth paired path runs from custom printed parts and incomplete drawings", () => {
  const p = importLDraw(
    "0 FILE root.ldr\n" +
      [
        placement("end.dat"),
        placement("segment.dat"),
        placement("end.dat"),
        placement("segment.dat", 100),
        placement("print.dat", 200),
      ].join("\n") +
      "\n0 FILE end.dat\n0 ~LSynth Technic Flexible Axle - End Piece\n0 !LDRAW_ORG Unofficial_Part\n0 !KEYWORDS LSynth\n3 16 0 0 0 20 0 0 0 -20 0\n0 FILE segment.dat\n0 ~LSynth Technic Flexible Axle - Cross Section\n0 !LDRAW_ORG Unofficial_Part\n0 !KEYWORDS LSynth\n3 16 0 0 0 20 0 0 0 -20 0\n0 FILE print.dat\n0 Custom printed brick\n0 !LDRAW_ORG Unofficial_Part\n" +
      placement("3001.dat"),
  );
  const components = instructionComponents(p);
  expect(components.map((c) => [c.kind, c.occurrenceIds.length])).toEqual([
    ["flexible", 3],
    ["drawing", 1],
  ]);
  const lots = instructionLots(
    p,
    occurrences(p).map((o) => o.id),
    { physical: true, named: true },
  );
  expect(lots.find((l) => l.ref === "print.dat")).toMatchObject({
    quantity: 1,
    name: "Custom printed brick",
  });
  expect(lots.find((l) => l.kind === "generated-component")?.quantity).toBe(1);
  expect(lots.find((l) => l.kind === "drawing")?.quantity).toBe(0);
});
it("locates explicit generated-path endpoints through repeated ancestor poses", () => {
  const p = importLDraw(
    "0 FILE root.ldr\n1 4 100 0 0 0 -1 0 1 0 0 0 0 1 hose.ldr\n0 FILE hose.ldr\n0 !LDCAD CONTENT [type=path]\n0 !LDCAD GENERATED [generator=test]\n0 !LDCAD PATH_POINT [posOri=0 0 0 1 0 0 0 1 0 0 0 1]\n0 !LDCAD PATH_POINT [posOri=0 -20 40 1 0 0 0 1 0 0 0 1]\n3 4 0 0 0 20 0 0 0 -20 0",
  );
  expect(instructionComponents(p)[0].endpoints).toEqual([
    [100, 0, 0],
    [120, 0, 40],
  ]);
});

it("names file-local shadow parts from their own source instead of the library entry", () => {
  const p = importLDraw(
    "0 FILE root.ldr\n" +
      placement("3001.dat") +
      "\n0 FILE 3001.dat\n0 Local triangular panel\n0 !LDRAW_ORG Unofficial_Part\n3 4 0 0 0 10 0 0 0 10 0",
  );
  const o = occurrences(p)[0];
  expect(o.namespace).toBe("project");
  const [lot] = instructionLots(p, [o.id], { named: true });
  expect(lot.name).toBe("Local triangular panel");
  expect(lot.thumbnailRef).toBeUndefined();
});
