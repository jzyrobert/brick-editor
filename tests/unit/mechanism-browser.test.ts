import { expect, it } from "vitest";
import { MechanismBrowser } from "../../src/mechanisms/browser";
import { mechanismFixture } from "../../src/mechanisms/fixtures";
import { Editor } from "../../src/core/commands";
import type { SceneAdapter } from "../../src/render/adapter";
import { uid } from "../../src/core/types";
it("restores preview and cancels stale sessions; only explicit apply changes authored state", async () => {
  const editor = new Editor(mechanismFixture());
  let restores = 0,
    applies = 0;
  const renderer = {
    ready: async () => {},
    beginTransientPose: () => () => {
      restores++;
    },
    applyTransientPose: () => {
      applies++;
    },
  } as unknown as SceneAdapter;
  const browser = new MechanismBrowser(editor, renderer),
    revision = editor.project.revision;
  await browser.enter("door");
  browser.setJointPosition("hinge", 45);
  expect(editor.project.revision).toBe(revision);
  expect(applies).toBeGreaterThan(1);
  browser.exit();
  expect(restores).toBe(1);
  await browser.enter("door");
  browser.setJointPosition("hinge", 45);
  browser.applyPose();
  expect(editor.project.revision).toBe(revision + 1);
  expect(browser.active).toBe(false);
  expect(restores).toBe(2);
  await browser.enter("door");
  editor.dispatch({
    schemaVersion: 1,
    commandId: uid(),
    expectedRevision: editor.project.revision,
    type: "project.rename",
    payload: { title: "Changed" },
  });
  expect(browser.active).toBe(false);
  expect(browser.getState().error).toContain("project changed");
  expect(() => browser.stepTicks(1)).toThrow();
  browser.dispose();
});
