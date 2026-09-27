import { describe, expect, it } from "vitest";
import { Editor } from "../../src/core/commands";
import { occurrences } from "../../src/core/document";
import { importLDraw, exportLDraw } from "../../src/ldraw/io";
import { occurrenceRenderContext } from "../../src/render/source-context";
import { mechanismFixture } from "../../src/mechanisms/fixtures";
import { validateRig } from "../../src/mechanisms/kinematic";
import { uid } from "../../src/core/types";
import { encodeNative, decodeNative } from "../../src/persistence/native";
const command = (
  e: Editor,
  type: string,
  payload: Record<string, unknown>,
  dryRun = false,
) =>
  e.dispatch({
    schemaVersion: 1,
    commandId: uid(),
    expectedRevision: e.project.revision,
    type,
    payload,
    dryRun,
  });
const repeated = `0 FILE root.ldr
1 4 100 0 0 0 0 1 0 1 0 -1 0 0 assembly.ldr
1 1 -100 0 0 1 0 0 0 1 0 0 0 1 assembly.ldr
0 FILE assembly.ldr
1 16 0 -24 0 1 .2 0 0 1 0 0 0 1 3001.dat
1 16 80 -24 0 -1 0 0 0 1 0 0 0 1 3003.dat`;
describe("submodel structure and explicit shared editing", () => {
  it("groups one repeated instance with affine/pivot preservation and atomically remaps every occurrence metadata set", async () => {
    const p = importLDraw(repeated),
      before = occurrences(p),
      ids = before.slice(0, 2).map((o) => o.id);
    p.layers.other = {
      id: "other",
      name: "Other",
      visible: true,
      locked: false,
      order: 1,
    };
    p.layerAssignments[ids[1]] = "other";
    p.groups.chosen = [...ids, before[2].id];
    p.instructionPlans.plan = {
      name: "Plan",
      steps: [[ids[0]], [ids[1], before[2].id]],
    };
    p.marketplace.overrides[ids[0]] = {
      itemId: "3001",
      colorId: "5",
      acknowledged: true,
      substitution: false,
    };
    const editor = new Editor(p),
      result = command(editor, "models.makeSubmodel", {
        occurrenceIds: ids,
        name: "Wall",
        pivot: [20, -8, 10],
      });
    const after = occurrences(editor.project);
    expect(
      after.map((o) => ({
        transform: o.transform,
        color: o.colorCode,
        ref: o.node.ref,
      })),
    ).toEqual(
      before.map((o) => ({
        transform: o.transform,
        color: o.colorCode,
        ref: o.node.ref,
      })),
    );
    expect(after.slice(2).map((o) => o.id)).toEqual(
      before.slice(2).map((o) => o.id),
    );
    const mapped = ids.map((id) => result.idRemappings[id]);
    expect(mapped.every(Boolean)).toBe(true);
    expect(editor.project.layerAssignments[mapped[1]]).toBe("other");
    expect(editor.project.groups.chosen).toEqual([...mapped, before[2].id]);
    expect(editor.project.instructionPlans.plan.steps).toEqual([
      [mapped[0]],
      [mapped[1], before[2].id],
    ]);
    expect(editor.project.marketplace.overrides[mapped[0]].itemId).toBe("3001");
    const native = await decodeNative(await encodeNative(editor.project));
    expect(occurrences(native).map((o) => o.id)).toEqual(
      after.map((o) => o.id),
    );
    command(editor, "history.undo", {});
    expect({ ...editor.project, revision: p.revision }).toEqual(p);
  });
  it("retains common BFC cull/winding and local colours around grouped raw polygons", () => {
    const p = importLDraw(
      "0 FILE root.ldr\n0 !COLOUR Local CODE 1000 VALUE #112233 EDGE #445566\n0 BFC CERTIFY CW\n0 BFC NOCLIP\n3 1000 0 0 0 10 0 0 0 10 0\n0 BFC CLIP CCW\n3 1000 20 0 0 30 0 0 20 10 0\n3 1000 40 0 0 50 0 0 40 10 0",
    );
    const before = occurrences(p),
      contexts = before.map((o) => occurrenceRenderContext(p, o));
    const editor = new Editor(p);
    command(editor, "models.makeSubmodel", {
      occurrenceIds: before.slice(0, 2).map((o) => o.id),
      name: "Panels",
      pivot: [5, 0, 0],
    });
    const after = occurrences(editor.project),
      actual = after.map((o) => occurrenceRenderContext(editor.project, o));
    const bfc = (s: string) =>
      s
        .split("\n")
        .filter((l) => l.includes("BFC"))
        .join("\n");
    expect(actual.map((x) => bfc(x.source))).toEqual(
      contexts.map((x) => bfc(x.source)),
    );
    expect(actual[0].source).toContain("!COLOUR Local");
    const reload = importLDraw(exportLDraw(editor.project));
    expect(occurrences(reload)).toHaveLength(3);
  });
  it("moves INVERTNEXT into the new definition without transferring inversion to siblings", () => {
    const p = importLDraw(
      "0 FILE root.ldr\n0 BFC CERTIFY CCW\n0 BFC INVERTNEXT\n1 4 0 0 0 1 0 0 0 1 0 0 0 1 sub.dat\n1 4 20 0 0 1 0 0 0 1 0 0 0 1 sub.dat\n1 4 40 0 0 1 0 0 0 1 0 0 0 1 sub.dat\n0 FILE sub.dat\n0 !LDRAW_ORG Unofficial_Subpart\n0 BFC CERTIFY CCW\n3 16 0 0 0 10 0 0 0 10 0",
    );
    const before = occurrences(p),
      contexts = before.map((o) => occurrenceRenderContext(p, o));
    const editor = new Editor(p);
    command(editor, "models.makeSubmodel", {
      occurrenceIds: before.slice(0, 2).map((o) => o.id),
      name: "Two references",
    });
    expect(
      occurrences(editor.project).map((o) =>
        occurrenceRenderContext(editor.project, o),
      ),
    ).toEqual(contexts);
  });
  it("remaps rigid-group endpoints/rest keys while retaining authored rest poses", () => {
    const p = mechanismFixture(),
      editor = new Editor(p),
      selected = occurrences(p).slice(0, 2);
    const result = command(editor, "models.makeSubmodel", {
      occurrenceIds: selected.map((o) => o.id),
      name: "Assembly",
      pivot: [10, 20, 30],
    });
    for (const rig of Object.values(editor.project.motionRigs))
      expect(() => validateRig(editor.project, rig)).not.toThrow();
    expect(Object.keys(result.idRemappings)).toHaveLength(2);
    expect(occurrences(editor.project).map((o) => o.transform)).toEqual(
      occurrences(p).map((o) => o.transform),
    );
  });
  it("shared edits affect every placed definition instance and reject locked or unacknowledged impact atomically", () => {
    const p = importLDraw(repeated),
      all = occurrences(p),
      editor = new Editor(p),
      payload = {
        definitionId: "assembly.ldr",
        nodeIds: [all[0].node.id],
        confirmShared: true,
        operation: "recolor",
        colorCode: "14",
      };
    expect(() =>
      command(editor, "models.editShared", {
        ...payload,
        confirmShared: false,
      }),
    ).toThrow();
    command(editor, "models.editShared", payload);
    expect(
      occurrences(editor.project)
        .filter((o) => o.node.id === all[0].node.id)
        .map((o) => o.colorCode),
    ).toEqual(["14", "14"]);
    command(editor, "history.undo", {});
    const locked = editor.project;
    locked.layers.blocked = {
      id: "blocked",
      name: "Blocked",
      visible: true,
      locked: true,
      order: 1,
    };
    locked.layerAssignments[all[2].id] = "blocked";
    const blocked = new Editor(locked);
    expect(() => command(blocked, "models.editShared", payload)).toThrow(
      "Unlock",
    );
    expect(blocked.project).toEqual(locked);
  });
  it("make unique isolates the definition without remapping paths or losing metadata", () => {
    const editor = new Editor(importLDraw(repeated)),
      before = occurrences(editor.project);
    command(editor, "models.makeUnique", { occurrenceIds: [before[0].id] });
    const after = occurrences(editor.project);
    expect(after.map((o) => o.id)).toEqual(before.map((o) => o.id));
    expect(after[0].modelId).not.toBe(after[2].modelId);
    command(editor, "models.editShared", {
      definitionId: after[0].modelId,
      nodeIds: [after[0].node.id],
      confirmShared: true,
      operation: "move",
      delta: [10, 0, 0],
    });
    expect(occurrences(editor.project)[2].transform).toEqual(
      before[2].transform,
    );
  });
  it("refuses noncontiguous selections and unknown source directives without partial changes", () => {
    const p = importLDraw(
        "0 !CUSTOM ASSOCIATION a\n1 4 0 0 0 1 0 0 0 1 0 0 0 1 3001.dat",
      ),
      editor = new Editor(p);
    expect(() =>
      command(editor, "models.makeSubmodel", {
        occurrenceIds: [occurrences(p)[0].id],
        name: "Unsafe",
      }),
    ).toThrow("!CUSTOM");
    expect(editor.project).toEqual(p);
    const three = importLDraw(
      [0, 20, 40]
        .map((x) => `1 4 ${x} 0 0 1 0 0 0 1 0 0 0 1 3001.dat`)
        .join("\n"),
    );
    const noncontiguous = new Editor(three),
      leaves = occurrences(three);
    expect(() =>
      command(noncontiguous, "models.makeSubmodel", {
        occurrenceIds: [leaves[0].id, leaves[2].id],
        name: "Unsafe ordering",
      }),
    ).toThrow("contiguous");
    expect(noncontiguous.project).toEqual(three);
  });
  it("shared preview is read-only and rejects hidden or active-layer excluded instances before mutation", () => {
    const p = importLDraw(repeated),
      all = occurrences(p);
    p.layers.hidden = {
      id: "hidden",
      name: "Hidden",
      visible: false,
      locked: false,
      order: 1,
    };
    p.layerAssignments[all[2].id] = "hidden";
    const editor = new Editor(p),
      payload = {
        definitionId: all[0].modelId,
        nodeIds: [all[0].node.id],
        confirmShared: true,
        operation: "recolor",
        colorCode: "14",
      };
    expect(() => command(editor, "models.editShared", payload, true)).toThrow(
      "Hidden",
    );
    expect(() =>
      command(
        editor,
        "models.editShared",
        { ...payload, includeHidden: true, activeLayerId: all[0].layerId },
        true,
      ),
    ).toThrow("outside active layer");
    command(
      editor,
      "models.editShared",
      { ...payload, includeHidden: true },
      true,
    );
    expect(editor.project).toEqual(p);
    command(editor, "models.editShared", { ...payload, includeHidden: true });
    expect(
      occurrences(editor.project)
        .filter((o) => o.node.id === all[0].node.id)
        .map((o) => o.colorCode),
    ).toEqual(["14", "14"]);
  });
});
