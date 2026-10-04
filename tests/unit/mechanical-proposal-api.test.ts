import { expect, it, vi } from "vitest";
import { registerFullLibraryFromDisk } from "../../scripts/full-library-node";
import { createAPI } from "../../src/automation/api";
import { Editor } from "../../src/core/commands";
import { occurrences } from "../../src/core/document";
import { importLDraw, exportLDraw } from "../../src/ldraw/io";

registerFullLibraryFromDisk();
const source = [
  "1 7 0 0 0 1 0 0 0 1 0 0 0 1 4275b.dat",
  "1 4 60 0 0 -1 0 0 0 1 0 0 0 -1 4276b.dat",
  "1 14 60 -8 0 -1 0 0 0 1 0 0 0 -1 3023.dat",
].join("\n");
it("proposes a reviewed hinge without a renderer, source edit or undo entry", async () => {
  const editor = new Editor(importLDraw(source)),
    api = createAPI(editor, () => undefined);
  const before = JSON.stringify(editor.project),
    text = exportLDraw(editor.project);
  const draft = await api.mechanisms.propose({
    id: "proposal",
    name: "Hinge proposal",
    expectedRevision: editor.revision,
    frameOccurrenceIds: [occurrences(editor.project)[0].id],
  });
  expect(draft.rig!.joints).toHaveLength(1);
  expect(draft.rig!.groups[1].occurrenceIds).toHaveLength(2);
  expect(editor.canUndo).toBe(false);
  expect(JSON.stringify(editor.project)).toBe(before);
  expect(await api.mechanisms.list()).toEqual([]);
  // Saving is an explicit existing command, never a side effect of analysis.
  await api.dispatch({
    schemaVersion: 1,
    commandId: "save-reviewed-proposal",
    expectedRevision: editor.revision,
    type: "rigs.upsert",
    payload: { rig: draft.rig! },
  });
  expect(editor.project.motionRigs.proposal).toEqual(draft.rig);
  expect(exportLDraw(editor.project)).toBe(text);
  expect(occurrences(editor.project)).toHaveLength(3);
  expect(editor.canUndo).toBe(true);
});

it("preflights malformed requests and refuses stale mechanical analysis", async () => {
  const editor = new Editor(importLDraw(source)),
    api = createAPI(editor, () => undefined),
    getter = vi.fn(() => editor.revision);
  const request = {
    id: "proposal",
    name: "Preview",
    expectedRevision: editor.revision,
    frameOccurrenceIds: [occurrences(editor.project)[0].id],
  };
  await expect(
    api.mechanisms.propose({ ...request, unexpected: true } as never),
  ).rejects.toMatchObject({ code: "INVALID_INPUT" });
  await expect(
    api.mechanisms.propose({
      ...request,
      get expectedRevision() {
        return getter();
      },
    }),
  ).rejects.toMatchObject({ code: "INVALID_INPUT" });
  expect(getter).not.toHaveBeenCalled();
  await expect(
    api.mechanisms.propose({
      ...request,
      expectedRevision: editor.revision + 1,
    }),
  ).rejects.toMatchObject({ code: "REVISION_CONFLICT" });
  await expect(
    api.mechanisms.propose({ ...request, frameOccurrenceIds: [] }),
  ).rejects.toMatchObject({ code: "INVALID_INPUT" });
});

it("refuses an edit made while lazy mechanical analysis is pending", async () => {
  const editor = new Editor(importLDraw(source)),
    api = createAPI(editor, () => undefined);
  const pending = api.mechanisms.propose({
    id: "proposal",
    name: "Hinge proposal",
    expectedRevision: editor.revision,
    frameOccurrenceIds: [occurrences(editor.project)[0].id],
  });
  editor.dispatch({
    schemaVersion: 1,
    commandId: "rename-during-analysis",
    expectedRevision: editor.revision,
    type: "project.rename",
    payload: { title: "Changed build" },
  });
  await expect(pending).rejects.toMatchObject({ code: "REVISION_CONFLICT" });
  expect(editor.project.motionRigs).toEqual({});
});

it("saves a reviewed source-bound proposal explicitly and undoes ownership without moving parts", async () => {
  const editor = new Editor(importLDraw(source)),
    api = createAPI(editor, () => undefined);
  const all = occurrences(editor.project),
    text = exportLDraw(editor.project);
  const input = {
    id: "reviewed",
    name: "Reviewed hinge",
    expectedRevision: editor.revision,
    frameOccurrenceIds: [all[0].id],
    occurrenceIds: all.map((o) => o.id),
  };
  const draft = await api.mechanisms.propose(input);
  expect(draft.drivers[draft.rig!.joints[0].id]).toBe(all[1].id);
  await api.mechanisms.saveProposal(input);
  expect(editor.project.motionRigs.reviewed).toEqual(draft.rig);
  expect(exportLDraw(editor.project)).toBe(text);
  expect(occurrences(editor.project)).toEqual(all);
  await expect(api.mechanisms.saveProposal(input)).rejects.toMatchObject({
    code: "REVISION_CONFLICT",
  });
  editor.dispatch({
    schemaVersion: 1,
    commandId: "undo-save",
    expectedRevision: editor.revision,
    type: "history.undo",
    payload: {},
  });
  expect(editor.project.motionRigs).toEqual({});
  expect(exportLDraw(editor.project)).toBe(text);
});

it("refuses saving unassigned parts instead of silently leaving a proposed assembly incomplete", async () => {
  const editor = new Editor(
      importLDraw(source + "\n1 7 200 0 0 1 0 0 0 1 0 0 0 1 3001.dat"),
    ),
    api = createAPI(editor, () => undefined);
  const input = {
    id: "reviewed",
    name: "Incomplete hinge",
    expectedRevision: editor.revision,
    frameOccurrenceIds: [occurrences(editor.project)[0].id],
  };
  const before = JSON.stringify(editor.project);
  await expect(api.mechanisms.saveProposal(input)).rejects.toThrow(
    "no reviewed group",
  );
  expect(JSON.stringify(editor.project)).toBe(before);
  expect(editor.canUndo).toBe(false);
});
