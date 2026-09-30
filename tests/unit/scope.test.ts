import { afterEach, describe, expect, it, vi } from "vitest";
import * as document from "../../src/core/document";
import { resolveScope } from "../../src/core/scope";
import { resolveScope as inventoryScope } from "../../src/inventory/service";
import { identity } from "../../src/core/math";
import { Editor } from "../../src/core/commands";
import type { Node, Occurrence, Project } from "../../src/core/types";

const part = (id: string): Node => ({
  id,
  kind: "part",
  ref: "3001.dat",
  colorCode: "4",
  transform: identity(),
});
function nested(): Project {
  const project = document.createProject();
  project.models.root.nodes = [
    { ...part("a"), kind: "submodel", ref: "assembly" },
    { ...part("ab"), kind: "submodel", ref: "assembly" },
    part("outside"),
  ];
  project.models.assembly = {
    id: "assembly",
    name: "assembly.ldr",
    classification: "model",
    records: [],
    nodes: [part("x"), { ...part("nested"), kind: "submodel", ref: "detail" }],
  };
  project.models.detail = {
    id: "detail",
    name: "detail.ldr",
    classification: "model",
    records: [],
    nodes: [part("y")],
  };
  project.layers.hidden = {
    id: "hidden",
    name: "Hidden",
    order: 1,
    visible: false,
    locked: false,
  };
  project.layerAssignments['["a","x"]'] = "hidden";
  return project;
}
const ids = (rows: Occurrence[]) => rows.map((row) => row.id);
afterEach(() => vi.restoreAllMocks());

describe("bounded occurrence scope matching", () => {
  it("keeps document order, shared-instance boundaries and hidden explicit members while deduplicating overlapping paths", () => {
    const project = nested();
    expect(inventoryScope).toBe(resolveScope);
    expect(
      ids(
        resolveScope(project, {
          kind: "selection",
          occurrenceIds: ['["ab","nested"]', '["a"]', '["a","x"]', '["a"]'],
        }),
      ),
    ).toEqual(['["a","x"]', '["a","nested","y"]', '["ab","nested","y"]']);
    expect(
      ids(resolveScope(project, { kind: "submodel", occurrenceId: '["a"]' })),
    ).toEqual(['["a","x"]', '["a","nested","y"]']);
    expect(ids(resolveScope(project, { kind: "visible" }))).not.toContain(
      '["a","x"]',
    );
    expect(
      ids(
        resolveScope(project, {
          kind: "layers",
          layerIds: ["hidden", "hidden"],
        }),
      ),
    ).toEqual(['["a","x"]']);
    expect(
      resolveScope(project, { kind: "selection", occurrenceIds: [] }),
    ).toEqual([]);
  });
  it("rejects empty and malformed paths and never lets a selected ancestor hide an unknown selected descendant", () => {
    const project = nested();
    for (const occurrenceId of [
      "[]",
      '[""]',
      '["a",4]',
      '[ "a" ]',
      '["a","missing"]',
      '["a","x","extra"]',
    ]) {
      expect(() =>
        resolveScope(project, { kind: "submodel", occurrenceId }),
      ).toThrow();
      expect(() =>
        resolveScope(project, {
          kind: "selection",
          occurrenceIds: ['["a"]', occurrenceId],
        }),
      ).toThrow();
    }
    expect(() =>
      resolveScope(project, { kind: "layers", layerIds: ["__proto__"] }),
    ).toThrow("Unknown layer");
  });
  it("matches complete Unicode segments and prototype-like node IDs without string-prefix shortcuts", () => {
    const project = document.createProject(),
      unicode = "😀".repeat(1024);
    project.models.root.nodes = [
      part("__proto__"),
      part("constructor"),
      part(unicode),
    ];
    const chosen = [JSON.stringify([unicode]), '["__proto__"]'];
    expect(
      ids(resolveScope(project, { kind: "selection", occurrenceIds: chosen })),
    ).toEqual(['["__proto__"]', JSON.stringify([unicode])]);
  });
  it("resolves the supported 200,000 ordinary selections with work bounded by total occurrence paths", () => {
    const project = document.createProject();
    project.models.root.nodes = [part("sample")];
    const sample = document.occurrences(project)[0],
      count = 200000;
    let pathReads = 0;
    const all: Occurrence[] = Array.from({ length: count }, (_, index) => ({
      ...sample,
      id: JSON.stringify([`n${index}`]),
      get path() {
        if (++pathReads > count * 2)
          throw new Error(
            "Scope rescanned occurrence paths for each selected ID",
          );
        return [`n${index}`];
      },
    }));
    vi.spyOn(document, "occurrences").mockReturnValueOnce(all);
    const selected = all.map((row) => row.id).reverse(),
      found = resolveScope(project, {
        kind: "selection",
        occurrenceIds: selected,
      });
    expect(found).toHaveLength(count);
    expect(found[0].id).toBe('["n0"]');
    expect(found[count - 1].id).toBe('["n199999"]');
    expect(pathReads).toBeLessThanOrEqual(count * 2);
  });
  it("uses exact editable membership and preserves atomic hidden, locked and unknown-ID refusals", () => {
    const project = document.createProject();
    project.models.root.nodes = [part("a"), part("ab"), part("c")];
    const editor = new Editor(project),
      selected = ['["a"]', '["c"]'];
    // Detect the previous per-occurrence linear scan without a timing threshold.
    Object.defineProperty(selected, "includes", {
      value: () => {
        throw new Error("Repeated linear membership scan");
      },
    });
    editor.dispatch({
      schemaVersion: 1,
      commandId: "exact-members",
      expectedRevision: 0,
      type: "parts.recolor",
      payload: { occurrenceIds: selected, colorCode: "14" },
    });
    expect(
      document.occurrences(editor.project).map((o) => o.colorCode),
    ).toEqual(["14", "4", "14"]);
    for (const change of ["hidden", "locked", "unknown"] as const) {
      const fixture = document.createProject();
      fixture.models.root.nodes = [part("a"), part("b")];
      if (change === "hidden") fixture.layers.base.visible = false;
      if (change === "locked") fixture.layers.base.locked = true;
      const target = new Editor(fixture),
        before = target.project;
      expect(() =>
        target.dispatch({
          schemaVersion: 1,
          commandId: change,
          expectedRevision: 0,
          type: "parts.recolor",
          payload: {
            occurrenceIds: [
              '["a"]',
              change === "unknown" ? '["missing"]' : '["b"]',
            ],
            colorCode: "1",
          },
        }),
      ).toThrow();
      expect(target.project).toEqual(before);
    }
  });
});
