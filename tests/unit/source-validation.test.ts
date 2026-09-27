import { expect, it } from "vitest";
import {
  createProject,
  validateDocument,
  validateSourceDocument,
} from "../../src/core/document";
import { Editor } from "../../src/core/commands";
import { identity } from "../../src/core/math";
import { validate } from "../../src/core/validate";
import { encodeNative, decodeNative } from "../../src/persistence/native";
import {
  LocalProjects,
  type StorageAdapter,
} from "../../src/persistence/storage";
import { exportLDraw } from "../../src/ldraw/io";
import type { Node } from "../../src/core/types";

function amplifiedSource() {
  const p = createProject();
  p.rootModelId = "m0";
  p.models = {};
  for (let i = 0; i < 64; i++) {
    const nodes: Node[] = Array.from({ length: i < 59 ? 1 : 10 }, (_, j) => ({
      id:
        i < 59
          ? "\0".repeat(1024)
          : `00000000-0000-0000-0000-${String(j).padStart(12, "0")}`,
      kind: i === 63 ? "part" : "submodel",
      ref: i === 63 ? "3001.dat" : `m${i + 1}`,
      transform: identity(),
      colorCode: "4",
    }));
    p.models[`m${i}`] = {
      id: `m${i}`,
      name: `m${i}.ldr`,
      classification: "model",
      nodes,
      records: [],
    };
  }
  return p;
}
class Memory implements StorageAdapter {
  data = new Map<string, string>();
  get length() {
    return this.data.size;
  }
  key(i: number) {
    return [...this.data.keys()][i] ?? null;
  }
  getItem(k: string) {
    return this.data.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.data.set(k, v);
  }
  removeItem(k: string) {
    this.data.delete(k);
  }
}
it("retains a small source whose derived paths exceed budget through native backup and local recovery", async () => {
  const p = amplifiedSource();
  validate("project", p);
  validateSourceDocument(p);
  // Guarded collector refuses before allocation; never expand the hostile graph.
  expect(() => validateDocument(p)).toThrow(/resource budget/);
  const editor = new Editor();
  const admitted = editor.replace(p);
  expect(admitted.materialization.status).toBe("limited");
  expect(editor.project.models).toEqual(p.models);
  const original = JSON.stringify(p);
  const bundle = await encodeNative(p);
  expect(bundle.length).toBeLessThan(1024 * 1024);
  const restored = await decodeNative(bundle);
  expect(restored).toEqual(p);
  expect(exportLDraw(restored)).toBe(exportLDraw(p));
  const storage = new LocalProjects(new Memory());
  await storage.save(p, null);
  expect(await storage.load(p.id)).toEqual(p);
  const newer = structuredClone(p);
  newer.revision = 1;
  newer.title = "Latest recoverable source";
  await storage.save(newer, 0);
  expect(await storage.load(p.id)).toEqual(newer);
  expect(JSON.stringify(p)).toBe(original);
});
it("validates supplied instruction paths without enumerating other occurrences", () => {
  const p = amplifiedSource();
  const path = Object.values(p.models).map((m) => m.nodes[0].id);
  const id = JSON.stringify(path);
  p.instructionPlans.test = { name: "Selected leaf", steps: [[id]] };
  validateSourceDocument(p);
  for (const invalid of [
    JSON.stringify(path.slice(0, -1)),
    JSON.stringify([...path.slice(0, -1), "absent"]),
    '["missing"]',
  ]) {
    p.instructionPlans.test.steps = [[invalid]];
    expect(() => validateSourceDocument(p)).toThrow(/missing or repeated/);
  }
  p.instructionPlans.test.steps = [[id], [id]];
  expect(() => validateSourceDocument(p)).toThrow(/missing or repeated/);
  p.instructionPlans.test.steps = [[id]];
  p.layerAssignments[id] = "absent";
  expect(() => validateSourceDocument(p)).toThrow(/Unknown layer assignment/);
});
it("checks depth through cached physical-part dependencies and treats physical parts as opaque paths", () => {
  const p = createProject();
  p.models.root.nodes = [
    {
      id: "opaque",
      kind: "part",
      ref: "physical",
      transform: identity(),
      colorCode: "4",
    },
  ];
  p.models.physical = {
    id: "physical",
    name: "physical.dat",
    classification: "custom",
    records: [],
    nodes: [
      {
        id: "inside",
        kind: "part",
        ref: "3001.dat",
        transform: identity(),
        colorCode: "4",
      },
    ],
  };
  p.instructionPlans.test = { name: "Leaf", steps: [['["opaque"]']] };
  validateSourceDocument(p);
  p.instructionPlans.test.steps = [['["opaque","inside"]']];
  expect(() => validateSourceDocument(p)).toThrow(/missing or repeated/);
  p.instructionPlans = {};
  for (let i = 62; i >= 0; i--)
    p.models[`d${i}`] = {
      id: `d${i}`,
      name: `d${i}.dat`,
      classification: "custom",
      records: [],
      nodes: [
        {
          id: "next",
          kind: "part",
          ref: i === 62 ? "physical" : `d${i + 1}`,
          transform: identity(),
          colorCode: "4",
        },
      ],
    };
  p.models.root.nodes.push({
    id: "long",
    kind: "part",
    ref: "d0",
    transform: identity(),
    colorCode: "4",
  });
  expect(() => validateSourceDocument(p)).toThrow(/depth exceeds 64/);
});
