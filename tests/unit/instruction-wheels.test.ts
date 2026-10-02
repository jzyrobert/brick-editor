import { expect, it } from "vitest";
import { importLDraw, exportLDraw } from "../../src/ldraw/io";
import { occurrences, validateDocument } from "../../src/core/document";
import { generateInstructions } from "../../src/instructions/generate";
import { wheelCandidates as reviewedWheelCandidates } from "../../src/instructions/wheels";
import { WHEEL_SOURCE_SHA256 } from "../../src/instructions/wheels";
import { createHash } from "node:crypto";
import { projectLibraryLock } from "../../src/catalog/catalog";
import { instructionDisplayStates } from "../../src/instructions/programme";
import {
  registerFullLibraryFromDisk,
  fullLibrarySources,
} from "../../scripts/full-library-node";
registerFullLibraryFromDisk();
const wheelCandidates = (
  items: Parameters<typeof reviewedWheelCandidates>[0],
) => reviewedWheelCandidates(items, projectLibraryLock);
it("binds reviewed wheel and receiving feature profiles to pinned source bytes and rejects another document pack", () => {
  const sources = fullLibrarySources(Object.keys(WHEEL_SOURCE_SHA256));
  for (const [ref, hash] of Object.entries(WHEEL_SOURCE_SHA256))
    expect(createHash("sha256").update(sources[ref]).digest("hex"), ref).toBe(
      hash,
    );
  const library = structuredClone(projectLibraryLock);
  library.full!.manifestSha256 = "changed";
  expect(
    reviewedWheelCandidates(
      rows([wheel("3641.dat"), wheel("4624.dat"), holder].join("\n")),
      library,
    ).candidates,
  ).toEqual([]);
});
const holder = "1 0 0 0 0 1 0 0 0 1 0 0 0 1 4600.dat";
const wheel = (ref: string, x = 30, extra = "0 0 1 0 1 0 -1 0 0") =>
  `1 0 ${x} 5 0 ${extra} ${ref}`;
const rows = (s: string) =>
  occurrences(importLDraw(s)).map((o, index) => ({ o, index }));
it("shows rim preparation, tyre fitting and receiver placement separately even when source starts with tyres", () => {
  const p = importLDraw(
      [wheel("4084.dat"), "0 STEP", wheel("4624.dat"), "0 STEP", holder].join(
        "\n",
      ),
    ),
    before = exportLDraw(p);
  const { plan } = generateInstructions(p, { maxPerStep: 20 });
  const byId = new Map(occurrences(p).map((o) => [o.id, o]));
  const module = Object.values(plan.modules!).find(
    (m) => m.purpose === "wheel",
  )!;
  expect(module.hostIds).toHaveLength(1);
  const build = plan.stepMetadata!.flatMap((m, n) =>
    m.assembly?.type === "build" ? [n] : [],
  );
  expect(
    build.map((n) => plan.steps[n].map((id) => byId.get(id)!.node.ref)),
  ).toEqual([["4624.dat"], ["4084.dat"]]);
  const states = instructionDisplayStates(plan),
    join = plan.stepMetadata!.findIndex((m) => m.assembly?.type === "join");
  expect(states[build[0]].displayIds).toHaveLength(1);
  expect(states[build[1]].displayIds).toHaveLength(2);
  expect(plan.stepMetadata![build[1]].alternateBeforePlacement).toBe(true);
  expect(plan.stepMetadata![build[0]].alternateBeforePlacement).toBeUndefined();
  expect(plan.steps[join]).toEqual([]);
  expect(plan.stepMetadata![join].notes).toContain("4600.dat");
  expect(plan.stepMetadata![join].notes).toContain("bare receiver view");
  expect(plan.stepMetadata![join].notes).not.toMatch(/candidate R|point P/);
  expect(states[join].displayIds).toHaveLength(3);
  expect(plan.stepMetadata![join].targets?.some((t) => t.label === "R")).toBe(
    true,
  );
  expect(
    [...build, join].every((n) =>
      plan.stepMetadata![n].insertionChecks!.every(
        (c) => c.status === "unknown" && !c.from,
      ),
    ),
  ).toBe(true);
  expect(new Set(plan.steps.flat()).size).toBe(3);
  expect(exportLDraw(p)).toBe(before);
  p.instructionPlans.test = plan;
  validateDocument(p);
});
it("faces completed wheel placements towards the reviewed receiver axis in rotated source frames", () => {
  for (const rotation of [
    "1 0 0 0 1 0 0 0 1",
    "0 -1 0 1 0 0 0 0 1",
    "0 0 1 0 1 0 -1 0 0",
  ])
    for (const x of [-30, 30]) {
      const source = [
        "0 FILE main.ldr",
        `1 16 0 0 0 ${rotation} vehicle.ldr`,
        "0 FILE vehicle.ldr",
        wheel("4624.dat", x),
        wheel("3641.dat", x),
        holder,
      ].join("\n");
      const p = importLDraw(source),
        before = exportLDraw(p),
        plan = generateInstructions(p).plan,
        meta = plan.stepMetadata!.find((m) => m.assembly?.type === "join")!,
        module = plan.modules![meta.assembly!.moduleId],
        camera = meta.camera!,
        delta = camera.position.map((v, a) => v - camera.target[a]),
        cosine =
          delta.reduce((s, v, a) => s + v * module.receiver!.axis[a], 0) /
          Math.hypot(...delta);
      expect(cosine).toBeGreaterThan(0.3);
      expect(meta.alternateBeforePlacement).toBe(true);
      expect(meta.axisReference!.feasibility).toBe("unknown");
      expect(
        meta.insertionChecks!.every((c) => c.status === "unknown" && !c.from),
      ).toBe(true);
      expect(exportLDraw(p)).toBe(before);
    }
});
it("refuses ambiguous rims, tyres and receivers instead of choosing the nearest catalogue match", () => {
  expect(
    wheelCandidates(
      rows(
        [wheel("3641.dat"), wheel("4624.dat"), wheel("4624.dat")].join("\n"),
      ),
    ).candidates,
  ).toEqual([]);
  expect(
    wheelCandidates(
      rows(
        [wheel("3641.dat"), wheel("3641.dat"), wheel("4624.dat")].join("\n"),
      ),
    ).candidates,
  ).toEqual([]);
  const result = wheelCandidates(
    rows([wheel("3641.dat"), wheel("4624.dat"), holder, holder].join("\n")),
  );
  expect(result.candidates).toHaveLength(1);
  expect(result.candidates[0].host).toBeUndefined();
});
it("uses authored local origins including the balloon tyre offset and rejects wrong orientation or far opposite wheels", () => {
  const result = wheelCandidates(
    rows(
      [
        wheel("6014b.dat", 33),
        wheel("56890.dat", 27),
        wheel("6014b.dat", -33),
        holder,
      ].join("\n"),
    ),
  );
  expect(result.candidates).toMatchObject([
    {
      rim: 0,
      tyre: 1,
      host: 3,
      receiver: { position: [22, 5, 0], axis: [1, 0, 0] },
    },
  ]);
  expect(
    wheelCandidates(
      rows(
        [wheel("4624.dat"), wheel("3641.dat", 30, "1 0 0 0 1 0 0 0 1")].join(
          "\n",
        ),
      ),
    ).candidates,
  ).toEqual([]);
});
it("keeps the spare wheel as an explicit unresolved mounting task", () => {
  const { plan } = generateInstructions(
    importLDraw(
      [wheel("4624.dat", 300), wheel("3641.dat", 300), holder].join("\n"),
    ),
  );
  const join = plan.stepMetadata!.find((m) => m.assembly?.type === "join")!;
  expect(join.notes).toMatch(/Receiving part unresolved/);
  expect(Object.values(plan.modules!)[0].hostIds).toBeUndefined();
});
