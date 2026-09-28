import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { importLDraw, exportLDraw } from "../../src/ldraw/io";
import { createProject, occurrences } from "../../src/core/document";
import { Editor } from "../../src/core/commands";
import { identity, conversion } from "../../src/core/math";
import { uid, type Project } from "../../src/core/types";
import { template } from "../../src/catalog/templates";
import {
  encodeNative,
  decodeNative,
  boundedUnzip,
} from "../../src/persistence/native";
import { InventoryService, wantedXML } from "../../src/inventory/service";
import { LocalProjects } from "../../src/persistence/storage";
import { fillPreview } from "../../src/edit/fill";
import { zipSync, strToU8 } from "fflate";
const nested = () =>
  importLDraw(readFileSync("fixtures/ldraw/nested.mpd", "utf8"));
const command = (
  e: Editor,
  type: string,
  payload: Record<string, unknown> = {},
) =>
  e.dispatch({
    schemaVersion: 1,
    commandId: uid(),
    expectedRevision: e.project.revision,
    type,
    payload,
  });
describe("source and identity", () => {
  it("expands repeated submodels with inherited and fixed colours", () => {
    const p = nested(),
      a = occurrences(p);
    expect(a).toHaveLength(4);
    expect(new Set(a.map((o) => o.id)).size).toBe(4);
    expect(a.map((o) => o.colorCode)).toEqual(["4", "15", "1", "15"]);
    expect(a[2].transform.position).toEqual([200, -24, 0]);
    expect(exportLDraw(p)).toContain("0 !CUSTOM preserve this exact payload");
  });
  it("makes only one occurrence unique, preserving paths and metadata, and undoes sharing", () => {
    const e = new Editor(nested()),
      before = e.project,
      all = occurrences(before);
    command(e, "parts.recolor", {
      occurrenceIds: [all[0].id],
      colorCode: "14",
    });
    const after = occurrences(e.project);
    expect(after.map((o) => o.colorCode)).toEqual(["14", "15", "1", "15"]);
    expect(after.map((o) => o.id)).toEqual(all.map((o) => o.id));
    expect(Object.keys(e.project.models).length).toBe(3);
    command(e, "history.undo");
    expect(e.project.models).toEqual(before.models);
    command(e, "history.redo");
    expect(occurrences(e.project)[0].colorCode).toBe("14");
  });
  it("preserves complete affine bases and world-space movement under rotated parents", () => {
    const p = nested();
    p.models[p.rootModelId].nodes[0].transform.basis = [
      0, 0, 1, 0, 1, 0, -1, 0, 0,
    ];
    const e = new Editor(p),
      o = occurrences(p)[0];
    command(e, "parts.transform", {
      occurrenceIds: [o.id],
      delta: [15, -8, 20],
      space: "ldraw",
    });
    expect(occurrences(e.project)[0].transform.position).toEqual([15, -32, 20]);
    const re = importLDraw(exportLDraw(e.project));
    expect(occurrences(re).map((o) => o.transform)).toEqual(
      occurrences(e.project).map((o) => o.transform),
    );
    expect(conversion(conversion([2, -3, 4]))).toEqual([2, -3, 4]);
  });
  it("rejects cycles, traversal, duplicate names and malformed numbers", () => {
    for (const s of [
      "0 FILE a.ldr\n1 4 0 0 0 1 0 0 0 1 0 0 0 1 a.ldr",
      "0 FILE ../bad.ldr",
      "0 FILE A.ldr\n0 FILE a.LDR",
      "1 4 NaN 0 0 1 0 0 0 1 0 0 0 1 3001.dat",
    ])
      expect(() => importLDraw(s)).toThrow();
  });
  it("keeps filename tails and missing references without fetching", () => {
    const p = importLDraw("1 4 0 0 0 1 0 0 0 1 0 0 0 1 a file.dat");
    expect(occurrences(p)[0].node.ref).toBe("a file.dat");
    expect(p.diagnostics[0].code).toBe("REFERENCE_MISSING");
    expect(exportLDraw(p)).toContain("a file.dat");
  });
  it("preserves 200 placements through native and LDraw round trips", async () => {
    const p = template("200"),
      native = await decodeNative(await encodeNative(p));
    expect(native).toEqual(p);
    const next = importLDraw(exportLDraw(p));
    expect(
      occurrences(next).map((o) => [o.node.ref, o.colorCode, o.transform]),
    ).toEqual(
      occurrences(p).map((o) => [o.node.ref, o.colorCode, o.transform]),
    );
  });
});
describe("command safety", () => {
  it("fails atomically for locked targets and retains the original document", () => {
    const e = new Editor(template("wall"));
    command(e, "layers.update", { layerId: "base", locked: true });
    const before = e.project;
    expect(() =>
      command(e, "parts.remove", {
        occurrenceIds: occurrences(before).map((o) => o.id),
      }),
    ).toThrow("Unlock");
    expect(e.project).toEqual(before);
  });
  it("deduplicates retries and rejects conflicting payload or stale revision", () => {
    const e = new Editor();
    const c = {
      schemaVersion: 1 as const,
      commandId: "retry",
      expectedRevision: 0,
      type: "parts.add",
      payload: {
        parts: [{ ref: "3001.dat", colorCode: "4", transform: identity() }],
      },
    };
    e.dispatch(c);
    e.dispatch(c);
    expect(occurrences(e.project)).toHaveLength(1);
    expect(() => e.dispatch({ ...c, payload: { parts: [] } })).toThrow();
    expect(() => e.dispatch({ ...c, commandId: "different" })).toThrow(
      "changed",
    );
  });
  it("dry runs do not consume history, IDs or revisions; transaction failures roll back", () => {
    const e = new Editor(template("wall")),
      o = occurrences(e.project)[0];
    e.dispatch({
      schemaVersion: 1,
      commandId: uid(),
      expectedRevision: 0,
      type: "parts.transform",
      payload: { occurrenceIds: [o.id], delta: [20, 0, 0] },
      dryRun: true,
    });
    expect(e.project.revision).toBe(0);
    expect(e.canUndo).toBe(false);
    expect(() =>
      e.transaction({
        commandId: uid(),
        expectedRevision: 0,
        commands: [
          {
            schemaVersion: 1,
            commandId: uid(),
            expectedRevision: 0,
            type: "project.rename",
            payload: { title: "bad" },
          },
          {
            schemaVersion: 1,
            commandId: uid(),
            expectedRevision: 0,
            type: "parts.remove",
            payload: { occurrenceIds: ["missing"] },
          },
        ],
      }),
    ).toThrow();
    expect(e.project.title).toBe("Brick wall");
  });
  it("requires explicit policy to mutate hidden parts", () => {
    const e = new Editor(template("wall"));
    command(e, "layers.update", { layerId: "base", visible: false });
    const ids = occurrences(e.project).map((o) => o.id);
    expect(() =>
      command(e, "parts.recolor", { occurrenceIds: ids, colorCode: "1" }),
    ).toThrow("Hidden");
    command(e, "parts.recolor", {
      occurrenceIds: ids,
      colorCode: "1",
      includeHidden: true,
    });
    expect(occurrences(e.project).every((o) => o.colorCode === "1")).toBe(true);
  });
  it("fills with hidden obstacles and one undo", () => {
    const p = createProject(),
      r = {
        ref: "3001.dat",
        colorCode: "4",
        columns: 20,
        rows: 10,
        origin: [0, -24, 0] as [number, number, number],
        layerId: "base",
        maxAdditions: 200,
      };
    const preview = fillPreview(p, r);
    expect(preview.parts).toHaveLength(200);
    const e = new Editor(p);
    command(e, "parts.add", { parts: preview.parts });
    expect(fillPreview(e.project, r).parts).toHaveLength(0);
    command(e, "history.undo");
    expect(occurrences(e.project)).toHaveLength(0);
  });
});
describe("offline Wanted List", () => {
  it("aggregates 200 audited parts and emits the strict profile deterministically", async () => {
    const p = template("200"),
      service = new InventoryService(),
      preview = await service.preview(p, {
        expectedRevision: 0,
        format: "bricklink-wanted-xml",
        scope: { kind: "all" },
      });
    expect(preview.resolvedPhysicalUnitCount).toBe(200);
    expect(preview.rows.map((r) => r.quantity)).toEqual([100, 100]);
    const a = await service.export(p, {
      previewId: preview.previewId,
      expectedRevision: 0,
      expectedMappingPackSha256: preview.mappingPackSha256,
      errorPolicy: "block",
    });
    const xml = new TextDecoder().decode(a.bytes);
    expect(xml.startsWith("<INVENTORY>")).toBe(true);
    expect(xml).toContain("<MINQTY>100</MINQTY>");
    expect(xml).not.toMatch(/<QTY>|<CONDITION>|<\?xml|DOCTYPE/);
    expect(xml).toBe(wantedXML(preview.rows, preview.request));
  });
  it("includes hidden layers by default and deduplicates parent/child selection", async () => {
    const p = nested();
    p.layers.base.visible = false;
    const service = new InventoryService(),
      all = occurrences(p),
      req = { expectedRevision: 0, format: "bricklink-wanted-xml" as const };
    expect(
      (await service.preview(p, { ...req, scope: { kind: "all" } }))
        .sourceOccurrenceCount,
    ).toBe(4);
    expect(
      (await service.preview(p, { ...req, scope: { kind: "visible" } }))
        .sourceOccurrenceCount,
    ).toBe(0);
    expect(
      (
        await service.preview(p, {
          ...req,
          scope: {
            kind: "selection",
            occurrenceIds: [
              JSON.stringify(all[0].path.slice(0, -1)),
              all[0].id,
            ],
          },
        })
      ).sourceOccurrenceCount,
    ).toBe(2);
  });
  it("never lends official mappings to a local override; partial archive includes a report", async () => {
    const p = importLDraw(
      "0 FILE main.ldr\n1 4 0 0 0 1 0 0 0 1 0 0 0 1 3001.dat\n1 4 80 0 0 1 0 0 0 1 0 0 0 1 3003.dat\n0 FILE 3001.dat\n0 !LDRAW_ORG Unofficial_Part\n3 16 0 0 0 20 0 0 0 20 0",
    );
    const s = new InventoryService(),
      v = await s.preview(p, {
        expectedRevision: 0,
        format: "bricklink-wanted-xml",
        scope: { kind: "all" },
      });
    expect(v.canExportComplete).toBe(false);
    expect(v.excludedOccurrenceIds).toHaveLength(1);
    const r = {
      previewId: v.previewId,
      expectedRevision: 0,
      expectedMappingPackSha256: v.mappingPackSha256,
      errorPolicy: "block" as const,
    };
    await expect(s.export(p, r)).rejects.toThrow("Resolve inventory");
    const a = await s.export(p, { ...r, errorPolicy: "export-resolved" });
    expect(a.name).toBe("wanted-list.partial.zip");
    expect(Object.keys(boundedUnzip(a.bytes))).toEqual([
      "wanted-list.partial.xml",
      "inventory-report.json",
    ]);
  });
  it("rejects stale preview even if a caller changes visibility without advancing revision", async () => {
    const p = template("wall"),
      s = new InventoryService(),
      v = await s.preview(p, {
        expectedRevision: 0,
        format: "bricklink-wanted-xml",
        scope: { kind: "all" },
      });
    p.layers.base.visible = false;
    await expect(
      s.export(p, {
        previewId: v.previewId,
        expectedRevision: 0,
        expectedMappingPackSha256: v.mappingPackSha256,
        errorPolicy: "block",
      }),
    ).rejects.toThrow("stale");
  });
  it("escapes remarks, rejects invalid XML, and does not invent Any condition", async () => {
    const p = template("wall"),
      s = new InventoryService();
    const v = await s.preview(p, {
      expectedRevision: 0,
      format: "bricklink-wanted-xml",
      scope: { kind: "all" },
      remarks: '<a & "b">',
      condition: "any",
    });
    expect(wantedXML(v.rows, v.request)).toContain(
      "&lt;a &amp; &quot;b&quot;&gt;",
    );
    await expect(
      s.preview(p, { ...v.request, remarks: "\u0001" }),
    ).rejects.toThrow("XML");
    await expect(
      s.preview(p, { ...v.request, buildMultiplier: 0 }),
    ).rejects.toThrow();
  });
  it("marks nonphysical transforms and unknown colours as blockers unless acknowledged", async () => {
    const p = template("wall");
    p.models.root.nodes[0].transform.basis[0] = -1;
    // BrickLink lists no Trans-Brown (LDraw 40) Brick 1 × 2, so that
    // combination stays unverified.
    const node = p.models.root.nodes[1];
    if (node.kind !== "geometry") node.ref = "3004.dat";
    node.colorCode = "40";
    const v = await new InventoryService().preview(p, {
      expectedRevision: 0,
      format: "bricklink-wanted-xml",
      scope: { kind: "all" },
    });
    expect(v.diagnostics.map((d) => d.code)).toContain("NONPHYSICAL_TRANSFORM");
    expect(v.diagnostics.map((d) => d.code)).toContain("UNVERIFIED_PART_COLOR");
  });
});
class MemoryStorage {
  data = new Map<string, string>();
  fail = false;
  get length() {
    return this.data.size;
  }
  key(i: number) {
    return [...this.data.keys()][i] || null;
  }
  getItem(k: string) {
    return this.data.get(k) || null;
  }
  setItem(k: string, v: string) {
    if (this.fail) throw new Error("quota");
    this.data.set(k, v);
  }
  removeItem(k: string) {
    this.data.delete(k);
  }
}
describe("recovery and archives", () => {
  it("keeps a recoverable revision on quota failure and rejects stale writers", async () => {
    const mem = new MemoryStorage(),
      store = new LocalProjects(mem),
      p = template("wall");
    await store.save(p, null);
    mem.fail = true;
    p.revision = 1;
    await expect(store.save(p, 0)).rejects.toThrow("Browser save failed");
    expect((await store.load(p.id))?.revision).toBe(0);
    mem.fail = false;
    await store.save(p, 0);
    p.revision = 2;
    await expect(store.save(p, 0)).rejects.toThrow("Another tab");
    expect((await store.load(p.id))?.revision).toBe(1);
  });
  it("recovers from a corrupt head", async () => {
    const mem = new MemoryStorage(),
      store = new LocalProjects(mem),
      p = template("wall");
    await store.save(p, null);
    mem.setItem("brick-editor:" + p.id + ":head", "broken");
    expect(await store.load(p.id)).toEqual(p);
  });
  it("rejects archive traversal and invalid native checksums", async () => {
    expect(() =>
      boundedUnzip(zipSync({ "../escape": strToU8("bad") })),
    ).toThrow();
    const bytes = await encodeNative(template("wall"));
    const f = boundedUnzip(bytes);
    f["project.json"] = strToU8("{}");
    await expect(decodeNative(zipSync(f))).rejects.toThrow("checksum");
  });
});

describe("source geometry and instruction preservation", () => {
  it("exports moved and repainted raw primitives in world coordinates", () => {
    const p = importLDraw("0 BFC CERTIFY CCW\n3 4 0 0 0 20 0 0 0 -20 0");
    const e = new Editor(p),
      o = occurrences(p)[0];
    command(e, "parts.transform", {
      occurrenceIds: [o.id],
      delta: [40, -8, 20],
    });
    command(e, "parts.recolor", { occurrenceIds: [o.id], colorCode: "1" });
    expect(exportLDraw(e.project)).toContain("3 1 40 -8 20 60 -8 20 40 -28 20");
    expect(exportLDraw(e.project)).toContain("0 BFC CERTIFY CCW");
  });
  it("derives root imported steps exactly once without counting unreferenced files", () => {
    const p = nested(),
      steps = p.instructionPlans.imported.steps;
    expect(steps).toHaveLength(2);
    expect(new Set(steps.flat()).size).toBe(4);
    expect(steps.flat()).toEqual(occurrences(p).map((o) => o.id));
  });
  it("rejects native custom-part reference cycles before renderer invocation", () => {
    const p = importLDraw(
      "0 FILE main.ldr\n1 4 0 0 0 1 0 0 0 1 0 0 0 1 custom.dat\n0 FILE custom.dat\n0 !LDRAW_ORG Part\n3 16 0 0 0 10 0 0 0 10 0",
    );
    p.models["custom.dat"].nodes.push({
      id: "cycle",
      kind: "part",
      ref: "custom.dat",
      colorCode: "16",
      transform: identity(),
    });
    expect(() => new Editor(p)).toThrow("Cyclic");
  });
});

describe("later editing contracts", () => {
  it("keeps occurrence metadata attached across copy-on-write and native reload", async () => {
    const p = nested(),
      o = occurrences(p)[0];
    p.groups.chosen = [o.id];
    p.marketplace.overrides[o.id] = {
      itemId: "3001",
      colorId: "5",
      acknowledged: true,
      substitution: false,
    };
    p.layers.second = {
      id: "second",
      name: "Second",
      visible: true,
      locked: false,
      order: 1,
    };
    p.layerAssignments[o.id] = "second";
    const e = new Editor(p);
    command(e, "parts.transform", { occurrenceIds: [o.id], delta: [20, 0, 0] });
    const loaded = await decodeNative(await encodeNative(e.project));
    expect(loaded.groups.chosen).toEqual([o.id]);
    expect(loaded.layerAssignments[o.id]).toBe("second");
    expect(loaded.marketplace.overrides[o.id]).toEqual(
      p.marketplace.overrides[o.id],
    );
    command(e, "history.undo");
    expect(e.project.models).toEqual(p.models);
  });
  it("deletes a layer only with an explicit disposition and restores metadata on undo", () => {
    const e = new Editor(template("wall"));
    command(e, "layers.add", { name: "Destination" });
    const destination = Object.values(e.project.layers).find(
      (l) => l.id !== "base",
    )!.id;
    expect(() => command(e, "layers.remove", { layerId: "base" })).toThrow();
    command(e, "layers.remove", {
      layerId: "base",
      mode: "reassign",
      destinationLayerId: destination,
    });
    expect(occurrences(e.project).every((o) => o.layerId === destination)).toBe(
      true,
    );
    expect(occurrences(e.project)).toHaveLength(40);
    command(e, "history.undo");
    expect(e.project.layers.base).toBeDefined();
    expect(occurrences(e.project).every((o) => o.layerId === "base")).toBe(
      true,
    );
  });
  it("bookmarks are validated, undoable authoring changes", () => {
    const e = new Editor();
    const camera = {
      space: "ldraw",
      projection: "perspective",
      position: [0, -70, 100],
      target: [0, -70, -140],
      up: [0, -1, 0],
      near: 0.5,
      far: 10000,
      fovDeg: 60,
    };
    command(e, "camera.bookmark", { name: "Interior", camera });
    expect(e.project.cameraBookmarks.Interior).toEqual(camera);
    command(e, "history.undo");
    expect(e.project.cameraBookmarks).toEqual({});
  });
  it("rejects unknown payload fields and non-finite imported native transforms", () => {
    const e = new Editor();
    expect(() =>
      command(e, "project.rename", { title: "x", script: "unexpected" }),
    ).toThrow();
    const p = template("wall");
    p.models.root.nodes[0].transform.basis[0] = Infinity;
    expect(() => new Editor(p)).toThrow();
  });
});
it("storage namespaces imported IDs and does not discard the head on repeated revision saves", async () => {
  const mem = new MemoryStorage(),
    store = new LocalProjects(mem),
    p = template("wall");
  p.id = "project:with:delimiters";
  await store.save(p, null);
  await store.save(p, 0);
  await store.save(p, 0);
  expect(await store.load(p.id)).toEqual(p);
  for (let i = 1; i <= 4; i++) {
    p.revision = i;
    await store.save(p, i - 1);
  }
  expect((await store.load(p.id))?.revision).toBe(4);
  expect((await store.list()).map((saved) => saved.id)).toEqual([p.id]);
  const other = template("wall");
  other.id = "project";
  await store.save(other, null);
  expect((await store.load(p.id))?.revision).toBe(4);
});
it("replacement revisions never alias an earlier snapshot", () => {
  const e = new Editor();
  command(e, "project.rename", { title: "one" });
  const before = e.project.revision;
  e.replace(createProject());
  expect(e.project.revision).toBeGreaterThan(before);
  const high = createProject();
  high.revision = 100;
  e.replace(high);
  expect(e.project.revision).toBe(101);
});
it("native source records cannot inject MPD boundaries or duplicate occurrence anchors", () => {
  const p = nested();
  const m = p.models[p.rootModelId];
  m.records.push({
    id: "injected",
    raw: "0 FILE stolen.dat\n3 4 0 0 0 20 0 0 0 20 0",
  });
  expect(() => new Editor(p)).toThrow("individual");
  m.records.pop();
  m.records.push({ ...m.records.find((r) => r.nodeId)!, id: "duplicate" });
  expect(() => new Editor(p)).toThrow("Duplicate source anchor");
});
it("validates a 10,000-reference source without quadratic anchor searches", () => {
  const text = Array.from(
    { length: 10000 },
    (_, i) => `1 4 ${i * 80} -24 0 1 0 0 0 1 0 0 0 1 3001.dat`,
  ).join("\n");
  const p = importLDraw(text);
  expect(occurrences(p)).toHaveLength(10000);
}, 5000);
