import { expect, it } from "vitest";
import { importLDraw } from "../../src/ldraw/io";
import { instructionDisplayStates } from "../../src/instructions/programme";
import { encodeNative, decodeNative } from "../../src/persistence/native";
import { queryProject } from "../../src/automation/query";
import { worldConnectors } from "../../src/core/connectivity";
import { occurrences } from "../../src/core/document";
import {
  applyWorkbenchProposal,
  compactProposal,
  workbenchAliases,
  sourceModelHash,
  workbenchReviewIndices,
  prepareWorkbench,
  workbenchReviewSelection,
  workbenchReviewPixels,
  inspectWorkbenchDossier,
  workbenchOccurrenceBounds,
  formatWorkbenchError,
  type WorkbenchProposal,
} from "../../scripts/instruction-workbench";

const line = (ref: string, x = 0, y = 0) =>
  `1 4 ${x} ${y} 0 1 0 0 0 1 0 0 0 1 ${ref}`;
const source = () =>
  importLDraw(
    [line("3001.dat"), line("3023.dat", 0, -24), line("3001.dat", 200)].join(
      "\n",
    ),
  );
const proposal = (): WorkbenchProposal => ({
  schemaVersion: 1,
  sourceHash: "source-hash",
  modules: [
    {
      id: "scene-object",
      name: "Separate object",
      members: ["p0001", "p0002"],
      placement: "scene",
    },
    {
      id: "child",
      name: "Child",
      members: ["p0002"],
      parentId: "scene-object",
      receivers: ["p0001"],
    },
  ],
  operations: [
    { key: "root", additions: ["p0003"] },
    { key: "parent-base", additions: ["p0001"], workbench: "scene-object" },
    { key: "child-build", additions: ["p0002"], workbench: "child" },
    {
      key: "child-place",
      place: "child",
      notes: "Check the receiving interface.",
    },
    { key: "object-place", place: "scene-object" },
  ],
  reviewTasks: [
    "Confirm whether the child can be held and seated on the base.",
  ],
});
it("authors nested workbenches without duplicating source leaves or inheriting CAD claims", async () => {
  const p = source(),
    before = sourceModelHash(p),
    input = proposal();
  const result = applyWorkbenchProposal(
    p,
    input,
    workbenchAliases(p),
    "source-hash",
  );
  expect(sourceModelHash(result.project)).toBe(before);
  expect(p.instructionPlans.agent).toBeUndefined();
  expect(result.plan.generation).toBeUndefined();
  expect(result.plan.presentation).toBe("pictorial");
  expect(result.plan.stepMetadata?.every((m) => !m.insertionChecks)).toBe(true);
  const states = instructionDisplayStates(result.plan);
  expect(states[2].displayIds).toEqual([workbenchAliases(p).p0002]);
  expect(states[3].displayIds).toEqual([
    workbenchAliases(p).p0001,
    workbenchAliases(p).p0002,
  ]);
  expect(states[4].displayIds).toHaveLength(3);
  expect(states[4].operationLabel).toMatch(/scene.*no mating connection/i);
  expect(result.plan.stepMetadata?.[3].alternateBeforePlacement).toBe(true);
  expect(result.plan.steps.flat()).toHaveLength(3);
  const restored = await decodeNative(await encodeNative(result.project));
  expect(restored.instructionPlans.agent.modules).toEqual(result.plan.modules);
  expect(restored.instructionPlans.agent.steps).toEqual(result.plan.steps);
});
it("rejects incomplete coverage, duplicate additions and changed source identity", () => {
  const p = source(),
    aliases = workbenchAliases(p);
  expect(() =>
    applyWorkbenchProposal(p, proposal(), aliases, "other-source"),
  ).toThrow(/source hash/);
  const missing = proposal();
  missing.operations.shift();
  expect(() =>
    applyWorkbenchProposal(p, missing, aliases, "source-hash"),
  ).toThrow(/exactly once/);
  const repeated = proposal();
  repeated.operations[0].additions!.push("p0001");
  expect(() =>
    applyWorkbenchProposal(p, repeated, aliases, "source-hash"),
  ).toThrow(/exactly once/);
  const unknown = proposal();
  unknown.operations[0].additions = ["p9999"];
  expect(() =>
    applyWorkbenchProposal(p, unknown, aliases, "source-hash"),
  ).toThrow(/unknown alias/);
});
it("rejects unfinished children and receivers unavailable in the destination workbench", () => {
  const p = source(),
    aliases = workbenchAliases(p);
  const premature = proposal();
  [premature.operations[3], premature.operations[4]] = [
    premature.operations[4],
    premature.operations[3],
  ];
  expect(() =>
    applyWorkbenchProposal(p, premature, aliases, "source-hash"),
  ).toThrow(/completed/);
  const wrongReceiver = proposal();
  wrongReceiver.modules![1].receivers = ["p0003"];
  expect(() =>
    applyWorkbenchProposal(p, wrongReceiver, aliases, "source-hash"),
  ).toThrow(/Receiving candidate/);
  const wrongView = proposal();
  wrongView.operations[3].receiving = ["p0003"];
  expect(() =>
    applyWorkbenchProposal(p, wrongView, aliases, "source-hash"),
  ).toThrow(/displayed prior assembly/);
});
it("rejects split generated drawings and within-step ordering constraints", () => {
  const p = importLDraw(
    "0 FILE root.ldr\n" +
      line("flex.ldr") +
      "\n0 FILE flex.ldr\n0 !LDCAD CONTENT [type=path]\n0 !LDCAD GENERATED\n" +
      line("3001.dat") +
      "\n" +
      line("3001.dat", 40),
  );
  const split: WorkbenchProposal = {
    sourceHash: "flex",
    operations: [
      { key: "one", additions: ["p0001"] },
      { key: "two", additions: ["p0002"] },
    ],
  };
  expect(() =>
    applyWorkbenchProposal(p, split, workbenchAliases(p), "flex"),
  ).toThrow(/atomically/);
  const q = source(),
    unordered: WorkbenchProposal = {
      sourceHash: "source-hash",
      operations: [{ key: "all", additions: ["p0001", "p0002", "p0003"] }],
      before: [["p0001", "p0002"]],
    };
  expect(() =>
    applyWorkbenchProposal(q, unordered, workbenchAliases(q), "source-hash"),
  ).toThrow(/before the operation starts/);
});
it("roundtrips the compact authored proposal with stable aliases and bounded review ranges", () => {
  const p = source(),
    result = applyWorkbenchProposal(
      p,
      proposal(),
      workbenchAliases(p),
      "source-hash",
    );
  const compact = compactProposal(p, result.plan, "source-hash");
  const restored = applyWorkbenchProposal(
    p,
    compact,
    workbenchAliases(p),
    "source-hash",
  );
  expect(restored.plan.steps).toEqual(result.plan.steps);
  expect(restored.plan.modules).toEqual(result.plan.modules);
  expect(workbenchReviewIndices("1,3-5,3", 5)).toEqual([0, 2, 3, 4]);
  expect(() => workbenchReviewIndices("0", 5)).toThrow(/outside/);
  expect(() => workbenchReviewIndices("1-61", 100)).toThrow(/60/);
  expect(() => workbenchReviewIndices(undefined, 61)).toThrow(/Choose/);
});
it("retains complete large incoming modules while reserving native marks for receivers", async () => {
  const p = importLDraw(
      Array.from({ length: 26 }, (_, i) => line("3001.dat", i * 80)).join("\n"),
    ),
    aliases = workbenchAliases(p),
    members = Object.keys(aliases).slice(1);
  const input: WorkbenchProposal = {
    sourceHash: "large",
    modules: [
      {
        id: "large-module",
        name: "Large candidate",
        members,
        receivers: ["p0001"],
        receiver: { position: [0, 0, 0], axis: [1, 0, 0] },
      },
    ],
    operations: [
      { key: "receiver", additions: ["p0001"] },
      { key: "build", additions: members, workbench: "large-module" },
      { key: "place", place: "large-module" },
    ],
  };
  const result = applyWorkbenchProposal(p, input, aliases, "large"),
    targets = result.plan.stepMetadata![2].targets!;
  expect(targets).toHaveLength(3);
  expect(targets.map((target) => target.label)).toEqual(
    expect.arrayContaining(["J", "R", "P"]),
  );
  expect(instructionDisplayStates(result.plan)[2].incomingIds).toHaveLength(25);
  expect(
    (
      await decodeNative(await encodeNative(result.project))
    ).instructionPlans.agent.steps.flat(),
  ).toHaveLength(26);
});
it("selects stable keys and real neighboring operations without hiding missing keys", () => {
  const keys = ["first", "rim", "tyre", "wheel-place", "last"];
  expect(
    workbenchReviewSelection(5, { keys: "tyre", neighbors: 1 }, keys),
  ).toEqual([1, 2, 3]);
  expect(
    workbenchReviewSelection(5, { keys: "first,last", neighbors: 1 }, keys),
  ).toEqual([0, 1, 3, 4]);
  expect(() => workbenchReviewSelection(5, { keys: "unknown" }, keys)).toThrow(
    /missing/,
  );
  expect(() => workbenchReviewSelection(5, { keys: "tyre" })).toThrow(
    /matching authored audit/,
  );
  expect(() =>
    workbenchReviewSelection(5, { keys: "tyre", steps: "1" }, keys),
  ).toThrow(/not both/);
  expect(() =>
    workbenchReviewSelection(5, { steps: "1", neighbors: 3 }),
  ).toThrow(/0, 1 or 2/);
  expect(
    workbenchReviewPixels([
      {
        contextCamera: {} as never,
        alternateCamera: {} as never,
        incomingIds: ["part"],
      },
    ]),
  ).toBe(640 * 480 + 3 * 240 * 180);
});
it("opens the authored native plan first and retains explicit receiving and incoming views", async () => {
  const p = source(),
    aliases = workbenchAliases(p),
    input = proposal();
  p.instructionPlans.baseline = {
    name: "Reference",
    steps: [Object.values(aliases)],
  };
  const camera = {
    space: "ldraw" as const,
    projection: "orthographic" as const,
    position: [200, -100, 300] as [number, number, number],
    target: [0, 0, 0] as [number, number, number],
    up: [0, -1, 0] as [number, number, number],
    near: 0.5,
    far: 5000,
    span: 300,
    fovDeg: 45,
  };
  input.operations[3].receivingCamera = camera;
  input.operations[3].incomingCamera = { ...camera, span: 100 };
  const result = applyWorkbenchProposal(p, input, aliases, "source-hash");
  expect(Object.keys(result.project.instructionPlans)).toEqual([
    "agent",
    "baseline",
  ]);
  expect(result.plan.stepMetadata![3].alternateCamera).toEqual(camera);
  expect(result.plan.stepMetadata![3].incomingCamera?.span).toBe(100);
  expect(
    result.plan.stepMetadata![4].targets?.map((target) => target.label),
  ).toEqual(["S"]);
  expect(result.plan.stepMetadata![4].targets![0].caption).toMatch(
    /no mating connection/,
  );
  expect(
    Object.keys(
      (await decodeNative(await encodeNative(result.project))).instructionPlans,
    ),
  ).toEqual(["agent", "baseline"]);
  const invalid = proposal();
  invalid.operations[0].receivingCamera = camera;
  expect(() =>
    applyWorkbenchProposal(p, invalid, aliases, "source-hash"),
  ).toThrow(/named candidates/);
  const badSchema = proposal();
  badSchema.operations[3].camera = { ...camera, fovDeg: -10 };
  expect(() =>
    applyWorkbenchProposal(p, badSchema, aliases, "source-hash"),
  ).toThrow();
});
it("returns compact bounded inspection and makes full connector arrays explicit", () => {
  const parts = Array.from({ length: 60 }, (_, i) => ({
    alias: `p${i}`,
    occurrenceId: `id${i}`,
    sourcePath: ["group", `part${i}`],
    model: "group",
    ref: "3001.dat",
    name: "Brick",
    namespace: "official",
    colorCode: "4",
    kind: "part",
    transform: { position: [i, 0, 0], basis: [1, 0, 0, 0, 1, 0, 0, 0, 1] },
    bounds: null,
    verifiedConnectors: [{ kind: "stud" }],
  }));
  const dossier = {
    sourceHash: "hash",
    inputName: "model",
    occurrenceCount: 60,
    groups: [
      { name: "Vehicle", path: ["group"], members: parts.map((p) => p.alias) },
    ],
    parts,
    strictContacts: {
      covered: parts.map((p) => p.alias),
      uncovered: [],
      contacts: 0,
      edges: [] as [string, string][],
    },
    components: [],
  };
  const compact = inspectWorkbenchDossier(dossier);
  expect(compact.returnedPartCount).toBe(50);
  expect(compact.partsTruncated).toBe(true);
  expect(compact.parts[0]).not.toHaveProperty("verifiedConnectors");
  const detail = inspectWorkbenchDossier(dossier, {
    parts: "p59",
    group: "Vehicle",
    detail: true,
  });
  expect(detail.parts[0]).toHaveProperty("verifiedConnectors");
  expect(() => inspectWorkbenchDossier(dossier, { parts: "missing" })).toThrow(
    /existing part aliases/,
  );
  expect(() => inspectWorkbenchDossier(dossier, { group: "missing" })).toThrow(
    /No source group/,
  );
});
it("reports the operation, camera field and actionable schema error without hiding invalid values", () => {
  const p = source(),
    aliases = workbenchAliases(p),
    camera = {
      space: "ldraw" as const,
      projection: "orthographic" as const,
      position: [200, -100, 300] as [number, number, number],
      target: [0, 0, 0] as [number, number, number],
      up: [0, -1, 0] as [number, number, number],
      near: 0.5,
      far: 5000,
      span: 300,
      fovDeg: -10,
    };
  const failure = (value: unknown) => {
    const input = proposal();
    input.operations[3].receivingCamera = value as never;
    try {
      applyWorkbenchProposal(p, input, aliases, "source-hash");
    } catch (error) {
      return formatWorkbenchError(error);
    }
    throw new Error("Invalid camera was accepted.");
  };
  expect(failure(camera)).toMatch(
    /Operation 4 \(child-place\)\.receivingCamera.*Invalid camera\n\s+\/fovDeg: must be > 0/,
  );
  const missing = { ...camera, fovDeg: 45 } as Partial<typeof camera>;
  delete missing.fovDeg;
  expect(failure(missing)).toMatch(/required property 'fovDeg'/);
  expect(failure(null)).toMatch(/must be object/);
  expect(failure({ ...camera, fovDeg: 45, zoom: 2 })).toMatch(
    /additional properties \(zoom\)/,
  );
  expect(failure({ ...camera, fovDeg: 45, up: [0, 0, 0] })).toMatch(
    /receivingCamera.*valid range, direction and up vector/,
  );
});
it("rejects incoming views for build steps and accepts them for completed scene placements", () => {
  const p = source(),
    aliases = workbenchAliases(p),
    camera = {
      space: "ldraw" as const,
      projection: "perspective" as const,
      position: [200, -100, 300] as [number, number, number],
      target: [0, 0, 0] as [number, number, number],
      up: [0, -1, 0] as [number, number, number],
      near: 0.5,
      far: 5000,
      fovDeg: 45,
    };
  for (const index of [0, 1, 2]) {
    const invalid = proposal();
    invalid.operations[index].incomingCamera = camera;
    expect(() =>
      applyWorkbenchProposal(p, invalid, aliases, "source-hash"),
    ).toThrow(
      /incomingCamera requires place.*use camera for ordinary additions/,
    );
  }
  const valid = proposal();
  valid.operations[4].incomingCamera = camera;
  const result = applyWorkbenchProposal(p, valid, aliases, "source-hash");
  expect(result.plan.stepMetadata![4].incomingCamera).toEqual(camera);
});
it("frames file-local surface dependencies using current nodes without granting connectors", () => {
  const p = importLDraw(
    "0 FILE root.ldr\n" +
      line("custom.dat") +
      "\n0 FILE custom.dat\n0 Local source panel\n" +
      line("nested.dat") +
      "\n0 FILE nested.dat\n3 16 0 0 0 10 0 0 0 10 0",
  );
  p.models["custom.dat"].nodes[0].transform.position[0] = 100;
  const allIds = Object.values(workbenchAliases(p)),
    bounds = workbenchOccurrenceBounds(p);
  expect(bounds[allIds[0]]?.min[0]).toBe(100);
  expect(bounds[allIds[0]]?.max[0]).toBe(110);
});
it("resolves a missing file-local dependency box from pinned surfaces while retaining unknown connectivity", () => {
  const p = importLDraw(
    "0 FILE root.ldr\n" +
      line("local.dat") +
      "\n0 FILE local.dat\n0 Local representation\n0 !LDRAW_ORG Unofficial_Part\n" +
      line("48/1-6cyli.dat"),
  );
  p.models["local.dat"].nodes[0].transform.position[0] = 100;
  const o = occurrences(p)[0];
  expect(
    queryProject(p, { spatial: true }).spatial!.occurrenceBounds[o.id],
  ).toBeNull();
  const bounds = workbenchOccurrenceBounds(p)[o.id];
  expect(bounds).not.toBeNull();
  expect(bounds!.min[0]).toBeGreaterThan(50);
  expect(o.namespace).toBe("project");
  expect(worldConnectors(o)).toBeNull();
});
it("refuses prepare outputs that would overwrite the original native input", async () => {
  await expect(
    prepareWorkbench(
      "/tmp/instruction-workbench-guard/source.brickproj",
      "/tmp/instruction-workbench-guard",
    ),
  ).rejects.toThrow(/overwrite its input source/);
});

it("accepts vertical feature axes and honors valid authored receiving cameras", () => {
  for (const sign of [-1, 1]) {
    for (const override of [false, true]) {
      const p = source(),
        input = proposal();
      input.modules![1].receiver = { position: [0, 0, 0], axis: [0, sign, 0] };
      const camera = {
        space: "ldraw" as const,
        projection: "orthographic" as const,
        position: [200, -100, 300] as [number, number, number],
        target: [0, 0, 0] as [number, number, number],
        up: [0, -1, 0] as [number, number, number],
        near: 0.5,
        far: 5000,
        span: 100,
        fovDeg: 45,
      };
      if (override) input.operations[3].receivingCamera = camera;
      const result = applyWorkbenchProposal(
        p,
        input,
        workbenchAliases(p),
        "source-hash",
      );
      const received = result.plan.stepMetadata![3].alternateCamera!;
      if (override) expect(received).toEqual(camera);
      else
        expect(
          Math.abs(received.position[0] - received.target[0]),
        ).toBeGreaterThan(0);
      expect(sourceModelHash(result.project)).toBe(sourceModelHash(p));
      expect(result.plan.steps.flat()).toHaveLength(3);
    }
  }
});
