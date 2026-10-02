import { expect, it } from "vitest";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import {
  registerFullLibraryFromDisk,
  fullLibrarySources,
} from "../../scripts/full-library-node";
import { importLDraw, exportLDraw } from "../../src/ldraw/io";
import { occurrences, validateDocument } from "../../src/core/document";
import {
  displayProfiles,
  DISPLAY_PROCEDURE_SOURCE_SHA256,
} from "../../src/instructions/display-procedures";
import { generateInstructions } from "../../src/instructions/generate";
import {
  sourcePrecedence,
  isolatedWorkbenchCandidates,
  type SourceGraphItem,
} from "../../src/instructions/source-procedures";
import {
  instructionDisplayStates,
  instructionAlternateIds,
  instructionReceivingIds,
} from "../../src/instructions/programme";
import { encodeNative, decodeNative } from "../../src/persistence/native";
registerFullLibraryFromDisk();
const row = (
  ref: string,
  x: number,
  y: number,
  z: number,
  basis = "1 0 0 0 1 0 0 0 1",
) => `1 16 ${x} ${y} ${z} ${basis} ${ref}`;
const p = (rows: string[], extra = "") =>
  importLDraw(
    [
      "0 FILE main.ldr",
      row("thing.ldr", 0, 0, 0),
      extra,
      "0 FILE thing.ldr",
      ...rows,
    ].join("\n"),
  );
const sign = () =>
  p([row("3068bp06.dat", 0, -8, 10), row("3023.dat", 0, 0, 0)]);
const graph = (project: ReturnType<typeof sign>): SourceGraphItem[] =>
  occurrences(project).map((o, index) => ({
    index,
    ids: [o.id],
    box: { min: [0, 0, 0], max: [40, 80, 40] },
    broad: false,
    supports: new Set(),
    hosts: new Set(),
    access: new Set(),
    adjacent: new Set(),
  }));
it("pins all reviewed top-level parts, subparts and raised-stud aliases to actual source bytes", () => {
  const texts = fullLibrarySources(
    Object.keys(DISPLAY_PROCEDURE_SOURCE_SHA256),
  );
  for (const [ref, hash] of Object.entries(DISPLAY_PROCEDURE_SOURCE_SHA256))
    expect(createHash("sha256").update(texts[ref]).digest("hex"), ref).toBe(
      hash,
    );
  const model = sign();
  expect(displayProfiles(model, occurrences(model)).groups).toHaveLength(1);
  model.library.full!.manifestSha256 = "different";
  expect(displayProfiles(model, occurrences(model)).groups).toHaveLength(0);
});
it("requires complete source sign membership, exact relative seat, same proper axes and official namespace", () => {
  for (const rows of [
    [row("3023.dat", 0, 0, 0), row("3068bp06.dat", 0, -8, 13)],
    [
      row("3023.dat", 0, 0, 0),
      row("3068bp06.dat", 0, -8, 10),
      row("3024.dat", 0, 24, 0),
    ],
    [
      row("3023.dat", 0, 0, 0),
      row("3068bp06.dat", 0, -8, 10, "-1 0 0 0 1 0 0 0 -1"),
    ],
    [
      row("3023.dat", 0, 0, 0),
      row("3068bp06.dat", 0, -8, 10, "1.03 0 0 0 1 0 0 0 1"),
    ],
  ]) {
    const model = p(rows);
    expect(displayProfiles(model, occurrences(model)).groups).toHaveLength(0);
  }
  const model = sign(),
    all = occurrences(model);
  all[0].namespace = "project";
  expect(displayProfiles(model, all).groups).toHaveLength(0);
});
it("rejects ambiguous frames, duplicated loose shutters, wrong endpoints and foreign parent seats", () => {
  const rows = [row("3853.dat", 0, 0, 0), row("3856.dat", 40, 0, -10)];
  const good = p(rows);
  expect(displayProfiles(good, occurrences(good)).groups).toHaveLength(1);
  for (const parts of [
    [...rows, row("3853.dat", 0, 0, 0)],
    [...rows, rows[1]],
    [rows[0], row("3856.dat", 40, 0, -6)],
  ]) {
    const model = p(parts);
    expect(displayProfiles(model, occurrences(model)).groups).toHaveLength(0);
  }
  const model = p([rows[1]], rows[0]);
  expect(displayProfiles(model, occurrences(model)).groups).toHaveLength(0);
});
it("finds exact raised car-base seating and preserves the complete steering shortcut", () => {
  const model = p([row("4211.dat", 0, 0, 0), row("3829c01.dat", 0, 0, -10)]),
    all = occurrences(model);
  const profile = displayProfiles(model, all).groups[0],
    op = profile.operations.get(all[1].id)!;
  expect(op.hostIds).toEqual([all[0].id]);
  expect(op.feature).toEqual([0, 8, -10]);
  expect(op.notes).not.toMatch(/offset|above/);
  const rounded = p([
      row("4211.dat", 0, 0, 0),
      row("3829c01.dat", 0.25, 0, -10),
    ]),
    rows = occurrences(rounded);
  const actual = displayProfiles(rounded, rows).groups[0].operations.get(
    rows[1].id,
  )!;
  expect(actual.landmarks!.map((p) => p.position)).toEqual([
    [-10, 8, -10],
    [10, 8, -10],
  ]);
  const duplicate = p([
    row("4211.dat", 0, 0, 0),
    row("3829c01.dat", 0, 0, -10),
    row("3829c01.dat", 0, 0, -10),
  ]);
  expect(
    displayProfiles(duplicate, occurrences(duplicate)).groups,
  ).toHaveLength(0);
  const wrong = p([row("4211.dat", 0, 0, 0), row("3829c01.dat", 0, -8, -10)]);
  expect(displayProfiles(wrong, occurrences(wrong)).groups).toHaveLength(0);
});
it("retains all original constraints if source precedence cycles and rejects crossings in either direction", () => {
  const model = sign(),
    groups = displayProfiles(model, occurrences(model)).groups,
    items = graph(model);
  items[1].supports.add(0);
  const result = sourcePrecedence(groups, items);
  expect(result.conflicts).toBe(1);
  expect(items.every((i) => !i.access.size)).toBe(true);
  const withForeign = p(
    [row("3068bp06.dat", 0, -8, 10), row("3023.dat", 0, 0, 0)],
    row("3024.dat", 500, 0, 0),
  );
  const all = occurrences(withForeign),
    foreign = graph(withForeign),
    g = displayProfiles(withForeign, all).groups;
  for (const relation of ["supports", "hosts", "access", "adjacent"] as const)
    for (const reverse of [false, true]) {
      for (const item of foreign) item[relation].clear();
      const outside = foreign.find((i) => all[i.index].path.length === 1)!,
        inside = foreign.find((i) => all[i.index].path.length > 1)!;
      foreign[reverse ? outside.index : inside.index][relation].add(
        reverse ? inside.index : outside.index,
      );
      expect(isolatedWorkbenchCandidates(g, foreign)).toHaveLength(0);
    }
});
it("generates and persists real Truck receivers before closure and isolated source-preserving signs", async () => {
  const model = importLDraw(
      await readFile("fixtures/instructions/omr/6450-1.mpd", "utf8"),
    ),
    source = exportLDraw(model),
    plan = generateInstructions(model).plan;
  const step = (id: string) => plan.steps.findIndex((ids) => ids.includes(id));
  const stand = '["n10","n51"]',
    frame = '["n10","n59"]',
    base = '["n10","n37"]',
    cap = '["n10","n79"]';
  expect(step(base)).toBeLessThan(step(stand));
  for (const id of ['["n10","n81"]', '["n10","n82"]', '["n10","n83"]'])
    expect(step(stand)).toBeLessThan(step(id));
  for (const id of ['["n10","n60"]', '["n10","n61"]']) {
    expect(plan.steps[step(id)]).toEqual([id]);
    expect(step(frame)).toBeLessThan(step(id));
    expect(step(id)).toBeLessThan(step(cap));
    expect(instructionAlternateIds(plan, step(id))).toEqual([frame]);
  }
  expect(instructionAlternateIds(plan, step(stand))).toEqual([base]);
  const signs = Object.entries(plan.modules!).filter(([k]) =>
    k.startsWith("sign-"),
  );
  expect(signs).toHaveLength(2);
  for (const [key, module] of signs) {
    const join = plan.stepMetadata!.findIndex(
      (m) => m.assembly?.moduleId === key && m.assembly.type === "join",
    );
    expect(plan.steps[join]).toEqual([]);
    const builds = plan.stepMetadata!.flatMap((m, n) =>
      m.assembly?.moduleId === key && m.assembly.type === "build" ? [n] : [],
    );
    expect(builds).toHaveLength(2);
    expect(instructionReceivingIds(plan, builds[1])).toEqual(
      plan.steps[builds[0]],
    );
    expect(instructionDisplayStates(plan)[builds[1]].displayIds).toHaveLength(
      2,
    );
    expect(module.placement).toBe("scene");
  }
  for (const n of [step(stand), step('["n10","n60"]'), step('["n10","n61"]')])
    expect(
      plan.stepMetadata![n].insertionChecks!.every(
        (c) => c.status === "unknown" && !c.from,
      ),
    ).toBe(true);
  expect(new Set(plan.steps.flat()).size).toBe(86);
  expect(exportLDraw(model)).toBe(source);
  model.instructionPlans.heuristic = plan;
  validateDocument(model);
  const restored = await decodeNative(await encodeNative(model));
  expect(restored.instructionPlans.heuristic).toEqual(
    JSON.parse(JSON.stringify(plan)),
  );
});

it("does not install a partially inspected shutter-cap or steering-closure proposal on budget exhaustion", () => {
  const shutter = p([
    row("3853.dat", 0, 0, 0),
    row("3856.dat", 40, 0, -10),
    row("3023.dat", 0, -8, 0),
  ]);
  const steer = p([
    row("4211.dat", 0, 0, 0),
    row("3829c01.dat", 0, 0, -10),
    row("3823.dat", 0, -72, -10),
  ]);
  for (const model of [shutter, steer]) {
    const result = displayProfiles(model, occurrences(model), 1);
    expect(result.exhausted).toBe(true);
    expect(result.groups).toHaveLength(0);
  }
  const duplicate = p([
    row("3853.dat", 0, 0, 0),
    row("3856.dat", 40, 0, -10),
    row("3856.dat", 40, 0, -10),
  ]);
  const partial = displayProfiles(duplicate, occurrences(duplicate), 1);
  expect(partial.exhausted).toBe(true);
  expect(partial.groups).toHaveLength(0);
});
