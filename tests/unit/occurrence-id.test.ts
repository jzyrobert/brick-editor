import { expect, it } from "vitest";
import {
  createProject,
  occurrences,
  validateDocument,
} from "../../src/core/document";
import { identity } from "../../src/core/math";
import {
  isOccurrenceId,
  parseOccurrenceId,
  OCCURRENCE_ID_MAX_LENGTH,
} from "../../src/core/occurrence-id";
import { validate } from "../../src/core/validate";
import { Editor } from "../../src/core/commands";
import { queryProject } from "../../src/automation/query";
import { encodeNative, decodeNative } from "../../src/persistence/native";
import { InventoryService } from "../../src/inventory/service";
import { PlaySession } from "../../src/play/session";
function deepProject(
  depth: number,
  segment: () => string = () => crypto.randomUUID(),
) {
  const p = createProject();
  p.rootModelId = "m0";
  p.models = {};
  for (let i = 0; i < depth; i++)
    p.models[`m${i}`] = {
      id: `m${i}`,
      name: `m${i}.ldr`,
      classification: "model",
      records: [],
      nodes: [
        {
          id: segment(),
          kind: i === depth - 1 ? "part" : "submodel",
          ref: i === depth - 1 ? "3001.dat" : `m${i + 1}`,
          colorCode: "4",
          transform: identity(),
        },
      ],
    };
  validate("project", p);
  validateDocument(p);
  return p;
}
it("accepts exact legal escaped depth boundary and Unicode node IDs while refusing malformed/noncanonical paths", () => {
  const p = deepProject(64, () => "\0".repeat(1024)),
    id = occurrences(p)[0].id;
  expect(id.length).toBe(393409);
  expect(id.length).toBe(OCCURRENCE_ID_MAX_LENGTH);
  expect(parseOccurrenceId(id)).toHaveLength(64);
  expect(() => validate("query", { occurrenceIds: [id] })).not.toThrow();
  expect(
    parseOccurrenceId(JSON.stringify(["😀".repeat(1024)]))[0],
  ).toHaveLength(2048);
  for (const invalid of [
    "[]",
    '[""]',
    '["a", "b"]',
    '["\\u0061"]',
    JSON.stringify(Array(65).fill("a")),
    JSON.stringify(["a".repeat(1025)]),
    JSON.stringify(["😀".repeat(1025)]),
    "not-json",
  ]) {
    expect(isOccurrenceId(invalid)).toBe(false);
    expect(() => validate("query", { occurrenceIds: [invalid] })).toThrow();
  }
});
it("deep IDs work across editing/history, project metadata, copy, native roundtrip and output schemas", async () => {
  const p = deepProject(32),
    id = occurrences(p)[0].id;
  expect(id.length).toBe(1249);
  p.layerAssignments[id] = p.defaultLayerId;
  p.groups.selected = [id];
  p.instructionPlans.plan = { name: "Plan", steps: [[id]] };
  p.marketplace.overrides[id] = {
    itemId: "3001",
    colorId: "4",
    acknowledged: true,
    substitution: false,
  };
  p.diagnostics.push({
    code: "TEST",
    message: "Fixture",
    severity: "warning",
    occurrenceIds: [id],
  });
  validate("project", p);
  validateDocument(p);
  expect(queryProject(p, { occurrenceIds: [id] }).count).toBe(1);
  const e = new Editor(p);
  e.dispatch({
    schemaVersion: 1,
    commandId: "recolour",
    expectedRevision: e.project.revision,
    type: "parts.recolor",
    payload: { occurrenceIds: [id], colorCode: "1", preserveFixedColors: true },
  });
  expect(occurrences(e.project)[0].colorCode).toBe("1");
  e.dispatch({
    schemaVersion: 1,
    commandId: "undo",
    expectedRevision: e.project.revision,
    type: "history.undo",
    payload: {},
  });
  expect(occurrences(e.project)[0].colorCode).toBe("4");
  const fragment = e.copy({ occurrenceIds: [id] });
  expect(occurrences(fragment.project)[0].id).toBe(id);
  const pasted = new Editor();
  pasted.dispatch({
    schemaVersion: 1,
    commandId: "paste-deep",
    expectedRevision: pasted.project.revision,
    type: "clipboard.paste",
    payload: { fragment },
  });
  expect(occurrences(pasted.project)[0].path).toHaveLength(33);
  const dispatch = (type: string, payload: Record<string, unknown>) =>
    e.dispatch({
      schemaVersion: 1,
      commandId: crypto.randomUUID(),
      expectedRevision: e.project.revision,
      type,
      payload,
    });
  const planId = dispatch("instructions.create", {
    name: "Deep instruction",
    occurrenceIds: [id],
  }).addedPlanIds[0];
  dispatch("instructions.step.add", { planId });
  dispatch("instructions.step.assign", {
    planId,
    index: 1,
    occurrenceIds: [id],
  });
  expect(e.project.instructionPlans[planId].steps[1]).toEqual([id]);
  const inventory = await new InventoryService().preview(e.project, {
    expectedRevision: e.project.revision,
    format: "bricklink-wanted-xml",
    scope: { kind: "selection", occurrenceIds: [id] },
  });
  expect(inventory.sourceOccurrenceCount).toBe(1);
  validate("inventoryPreview", inventory);
  expect(
    occurrences(await decodeNative(await encodeNative(e.project)))[0].id,
  ).toBe(id);
  validate("render", {
    revision: e.project.revision,
    width: 64,
    height: 64,
    format: "png",
    visibility: { mode: "occurrences", occurrenceIds: [id] },
    instructionNewIds: [id],
    background: { type: "solid", color: "#ffffff" },
    quality: "balanced",
    strict: true,
  });
  validate("motionRig", {
    schemaVersion: 1,
    id: "rig",
    name: "Rig",
    mode: "kinematic",
    groups: [
      {
        id: "body",
        occurrenceIds: [id],
        frame: identity(),
        restTransforms: { [id]: occurrences(p)[0].transform },
      },
    ],
    joints: [],
  });
  const play = await PlaySession.create({
    revision: 0,
    vertices: new Float32Array(),
    indices: new Uint32Array(),
    bounds: { min: [0, 0, 0], max: [0, 0, 0] },
    worldProfile: { excludedLayerIds: [], includedOccurrenceIds: [id] },
  });
  try {
    validate("playSnapshot", play.snapshot());
    expect(play.snapshot().worldProfile.includedOccurrenceIds).toEqual([id]);
  } finally {
    play.dispose();
  }
});
it("preserves ordinary ID limits and validates occurrence-keyed dictionaries without widening their values", () => {
  const p = deepProject(1);
  p.models.m0.nodes[0].id = "x".repeat(1025);
  expect(() => validate("project", p)).toThrow();
  const q = deepProject(1);
  q.layerAssignments["not-a-path"] = "base";
  expect(() => validate("project", q)).toThrow();
  delete q.layerAssignments["not-a-path"];
  q.layerAssignments[occurrences(q)[0].id] = "x".repeat(1025);
  expect(() => validate("project", q)).toThrow();
  expect(() => validate("query", { ref: "x".repeat(1025) })).toThrow();
});
