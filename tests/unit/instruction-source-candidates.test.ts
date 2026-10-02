import { expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { registerFullLibraryFromDisk } from "../../scripts/full-library-node";
import { importLDraw, exportLDraw } from "../../src/ldraw/io";
import { occurrences } from "../../src/core/document";
import { partOccupancy } from "../../src/catalog/connectors";
import installed from "../../src/catalog/bounds.json";
import {
  projectBounds,
  transformBounds,
  unionBounds,
  type Bounds,
} from "../../src/core/spatial";
import { connectionGraph } from "../../src/core/connectivity";
import type { Project } from "../../src/core/types";
import type { SourceGraphItem } from "../../src/instructions/source-procedures";
import { sourceGuidedCandidates } from "../../src/instructions/source-candidates";
registerFullLibraryFromDisk();
const row = (ref: string, x = 0, y = 0, z = 0, basis = "1 0 0 0 1 0 0 0 1") =>
  `1 16 ${x} ${y} ${z} ${basis} ${ref}`;
const source = () =>
  importLDraw(
    [
      "0 FILE root.ldr",
      row("48336.dat"),
      row("3023.dat", 0, -8),
      "0 STEP",
      row("child.ldr", 0, 0, -40, "-1 0 0 0 1 0 0 0 -1"),
      "0 STEP",
      row("3001.dat", 100, 0, 100),
      row("foreign.ldr", 150, 0, 150),
      "0 FILE child.ldr",
      row("60470b.dat"),
      "0 STEP",
      row("3023.dat", 0, -8),
      "0 FILE foreign.ldr",
      row("3001.dat"),
      "0 STEP",
    ].join("\n"),
  );
function items(p: Project): SourceGraphItem[] {
  const resolver = projectBounds(
    p,
    installed.bounds as unknown as Record<string, Bounds | null>,
    installed.dependencies.transitive,
  );
  return occurrences(p).map((o, index) => {
    const local =
      partOccupancy(o.node.ref)?.reduce<Bounds | null>(unionBounds, null) ??
      resolver.model(o.node.ref);
    return {
      index,
      ids: [o.id],
      box: local ? transformBounds(local, o.transform) : null,
      broad: false,
      supports: new Set(),
      hosts: new Set(),
      access: new Set(),
      adjacent: new Set(),
    };
  });
}
const derive = (p: Project) =>
  sourceGuidedCandidates(p, occurrences(p), items(p));
it("derives exactly the complete source child and receiver's contiguous direct run", () => {
  const p = source(),
    before = JSON.stringify(p),
    all = occurrences(p),
    r = derive(p);
  expect(r.exhausted).toBe(false);
  expect(r.refusals).toEqual([]);
  expect(r.candidates).toHaveLength(2);
  const parent = r.candidates.find((c) => c.placement === "scene")!,
    child = r.candidates.find((c) => c.parentId)!;
  expect(parent.members).toHaveLength(4);
  expect(child.members).toHaveLength(2);
  expect(parent.sourceOrder).toEqual([...parent.members]);
  expect(child.sourceOrder).toEqual(child.members);
  expect(child.parentId).toBe(parent.id);
  expect(child.receivers).toEqual([all[0].id]);
  expect(parent.members).not.toContain(all[4].id);
  expect(parent.members).not.toContain(all[5].id);
  expect(r.matches.get(child.id)?.receiverId).toBe(all[0].id);
  expect(
    r.provenance.every(
      (p) =>
        p.mode === "authored-source-prior" &&
        p.contactVerification === "unknown",
    ),
  ).toBe(true);
  expect(JSON.stringify(p)).toBe(before);
});
it("organizes the actual81-leaf primary body and15-leaf jaw, excluding149 other leaves", async () => {
  const p = importLDraw(
      await readFile("fixtures/instructions/omr/31088-1.mpd", "utf8"),
    ),
    before = exportLDraw(p),
    all = occurrences(p),
    r = derive(p);
  expect(r.refusals).toEqual([]);
  expect(r.candidates).toHaveLength(2);
  const parent = r.candidates.find((c) => !c.parentId)!,
    child = r.candidates.find((c) => c.parentId)!;
  expect(parent.members).toHaveLength(81);
  expect(child.members).toHaveLength(15);
  expect(
    parent.members.filter((id) => !child.members.includes(id)),
  ).toHaveLength(66);
  expect(new Set(parent.members)).toEqual(new Set(parent.sourceOrder));
  expect(all.filter((o) => !parent.members.includes(o.id))).toHaveLength(149);
  expect(connectionGraph(p, all).covered).toHaveLength(0);
  expect(exportLDraw(p)).toBe(before);
});
it("uses stable structural keys and authored source order despite current node array reordering", () => {
  const p = source(),
    r = derive(p);
  for (const m of Object.values(p.models)) m.nodes.reverse();
  const reordered = derive(p);
  expect(reordered.candidates).toEqual(r.candidates);
  expect(reordered.candidates.map((c) => c.id)).toEqual(
    r.candidates.map((c) => c.id),
  );
});
it("does not require particular model names or node identifiers", () => {
  const p = source(),
    m = p.models["child.ldr"];
  delete p.models["child.ldr"];
  m.id = "opaque-section.ldr";
  m.name = "Unrelated source section";
  p.models[m.id] = m;
  p.models[p.rootModelId].nodes.find((n) => n.ref === "child.ldr")!.ref = m.id;
  for (const model of Object.values(p.models))
    for (const node of model.nodes) {
      const record = model.records.find((r) => r.id === node.sourceRecordId)!;
      node.id = "opaque-" + node.id;
      record.nodeId = node.id;
    }
  expect(derive(p).candidates.map((c) => c.members.length)).toEqual([4, 2]);
});
it("refuses missing STEP priors, stale membership records and a child introduced before its receiver run", () => {
  for (const change of [
    (p: Project) => {
      p.models["child.ldr"].records = p.models["child.ldr"].records.filter(
        (r) => !r.raw.includes("STEP"),
      );
    },
    (p: Project) => {
      p.models[p.rootModelId].records = p.models[p.rootModelId].records.filter(
        (r) => !r.raw.includes("STEP"),
      );
    },
    (p: Project) => {
      p.models["child.ldr"].nodes[0].sourceRecordId = "absent";
    },
    (p: Project) => {
      p.models["child.ldr"].classification = "custom";
    },
    (p: Project) => {
      const m = p.models[p.rootModelId],
        reference = m.nodes.find(
          (n) => n.kind === "submodel" && n.ref === "child.ldr",
        )!;
      const record = m.records.find((r) => r.id === reference.sourceRecordId)!;
      m.records = m.records.filter((r) => r !== record);
      m.records.unshift(record);
    },
  ]) {
    const p = source();
    change(p);
    const r = derive(p);
    expect(r.candidates).toHaveLength(0);
    expect(r.refusals.length).toBeGreaterThan(0);
  }
});
it("requires the exact complete source membership supplied by current source nodes", () => {
  const p = source(),
    all = occurrences(p),
    group = items(p),
    missing = all.filter(
      (o) => o.node.ref !== "3023.dat" || o.modelId !== "child.ldr",
    );
  const r = sourceGuidedCandidates(p, missing, group);
  expect(r.candidates).toHaveLength(0);
  expect(r.refusals[0].reason).toMatch(/omits|incomplete/);
});
it("rejects whole drawing owners, split inventory, missing or broad bounds and excessive envelopes", () => {
  for (const alter of [
    (g: SourceGraphItem[]) => {
      g[1].component = {};
    },
    (g: SourceGraphItem[]) => {
      g[1].ids.push(g[2].ids[0]);
      g.splice(2, 1);
    },
    (g: SourceGraphItem[]) => {
      g[1].box = null;
    },
    (g: SourceGraphItem[]) => {
      g[1].broad = true;
    },
    (g: SourceGraphItem[]) => {
      g[1].box = { min: [0, 0, 0], max: [501, 10, 10] };
    },
    (g: SourceGraphItem[]) => {
      g[1].box = { min: [0, 0, 0], max: [NaN, 10, 10] };
    },
  ]) {
    const p = source(),
      g = items(p);
    alter(g);
    expect(
      sourceGuidedCandidates(p, occurrences(p), g).candidates,
    ).toHaveLength(0);
  }
});
it("refuses a distorted unmatched member rather than validating only the interface pair", () => {
  const p = source();
  p.models["child.ldr"].nodes.find(
    (n) => n.ref === "3023.dat",
  )!.transform.basis[0] = 1.02;
  const r = derive(p);
  expect(r.candidates).toHaveLength(0);
  expect(r.refusals[0].reason).toMatch(/display path/);
});
it("refuses exhausted searches atomically and never changes the existing source graph", () => {
  const p = source(),
    all = occurrences(p),
    g = items(p);
  g[0].supports.add(1);
  g[1].hosts.add(0);
  g[2].access.add(1);
  g[3].adjacent.add(2);
  const snapshot = () =>
    JSON.stringify(
      g.map((i) => ({
        index: i.index,
        ids: i.ids,
        supports: [...i.supports],
        hosts: [...i.hosts],
        access: [...i.access],
        adjacent: [...i.adjacent],
      })),
    );
  const prior = snapshot();
  for (const budget of [0, 1, 30, NaN, -1, 200001]) {
    const r = sourceGuidedCandidates(p, all, g, budget);
    expect(r.exhausted).toBe(true);
    expect(r.candidates).toHaveLength(0);
    expect(r.matches.size).toBe(0);
  }
  const accepted = sourceGuidedCandidates(p, all, g);
  expect(accepted.candidates).toHaveLength(2);
  expect(snapshot()).toBe(prior);
});
