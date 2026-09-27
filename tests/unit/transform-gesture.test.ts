import { expect, it } from "vitest";
import { Editor } from "../../src/core/commands";
import { TransformGesture } from "../../src/edit/transform-gesture";
import { occurrences } from "../../src/core/document";
import { template } from "../../src/catalog/templates";
import { identity, rotationY } from "../../src/core/math";
import { uid, type Transform } from "../../src/core/types";
it("previews full affine transforms without edits and commits a multi-selection as one undoable gesture", () => {
  const p = template("wall");
  p.models.root.nodes[0].transform.basis = [-1, 0.2, 0, 0, 1, 0, 0, 0, 1];
  const editor = new Editor(p),
    before = editor.project,
    selected = occurrences(p)
      .slice(0, 2)
      .map((o) => o.id);
  let latest: Record<string, Transform> = {},
    restores = 0;
  const drag = new TransformGesture(editor, {
    beginTransientPose: () => () => {
      restores++;
    },
    applyTransientPose: (t) => {
      latest = t;
    },
  });
  drag.begin({ occurrenceIds: selected });
  for (let i = 1; i <= 50; i++)
    drag.preview({ position: [i, 0, 0], basis: rotationY(90) });
  expect(editor.project).toEqual(before);
  expect(latest[selected[0]].basis).not.toEqual(
    p.models.root.nodes[0].transform.basis,
  );
  drag.commit();
  expect(editor.project.revision).toBe(before.revision + 1);
  expect(restores).toBe(1);
  editor.dispatch({
    schemaVersion: 1,
    commandId: uid(),
    expectedRevision: editor.project.revision,
    type: "history.undo",
    payload: {},
  });
  expect(editor.project.models).toEqual(before.models);
  drag.dispose();
});
it("cancellation, zero motion, source changes, and locked targets cannot commit a gesture", () => {
  const editor = new Editor(template("wall")),
    ids = [occurrences(editor.project)[0].id];
  let restores = 0;
  const drag = new TransformGesture(editor, {
    beginTransientPose: () => () => {
      restores++;
    },
    applyTransientPose: () => {},
  });
  drag.begin({ occurrenceIds: ids });
  drag.preview({ ...identity(), position: [20, 0, 0] });
  drag.cancel();
  expect(editor.project.revision).toBe(0);
  drag.begin({ occurrenceIds: ids });
  drag.commit();
  expect(editor.project.revision).toBe(0);
  drag.begin({ occurrenceIds: ids });
  editor.dispatch({
    schemaVersion: 1,
    commandId: uid(),
    expectedRevision: 0,
    type: "layers.update",
    payload: { layerId: editor.project.defaultLayerId, locked: true },
  });
  expect(drag.active).toBe(false);
  expect(() => drag.commit()).toThrow();
  expect(() => drag.begin({ occurrenceIds: ids })).toThrow(/Unlock/);
  expect(restores).toBe(3);
  drag.dispose();
});
