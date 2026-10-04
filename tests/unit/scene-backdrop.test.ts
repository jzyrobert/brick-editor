import { describe, expect, it } from "vitest";
import { Editor } from "../../src/core/commands";
import { createProject, occurrences } from "../../src/core/document";
import { exportLDraw } from "../../src/ldraw/io";
import { encodeNative, decodeNative } from "../../src/persistence/native";
import { copyFragment } from "../../src/core/fragments";
import { validate } from "../../src/core/validate";
import { uid } from "../../src/core/types";
import {
  BACKDROP_NAMES,
  BACKDROPS,
  backdropOf,
  isBackdropName,
  requireBackdrop,
  PLAY_HINT_MAX_LENGTH,
} from "../../src/core/scene";
import { TEMPLATE_BACKDROPS, template } from "../../src/catalog/templates";
import { SAMPLE_TEMPLATES } from "../../src/catalog/template-names";
import { registerFullLibraryFromDisk } from "../../scripts/full-library-node";
import { registerScriptTemplatesFromDisk } from "../../scripts/script-templates-node";

const run = (editor: Editor, type: string, payload: Record<string, unknown>) =>
  editor.dispatch({
    schemaVersion: 1,
    commandId: uid(),
    expectedRevision: editor.revision,
    type,
    payload,
  });
const brick = () => {
  const p = createProject("Backdrop test");
  p.models.root.nodes.push({
    id: "a",
    kind: "part",
    ref: "3001.dat",
    colorCode: "4",
    transform: { position: [0, -24, 0], basis: [1, 0, 0, 0, 1, 0, 0, 0, 1] },
  });
  return p;
};

describe("scene backdrops", () => {
  it("define every preset with a label, hint, swatch and sky", () => {
    expect(BACKDROP_NAMES).toEqual([
      "blank",
      "grass",
      "street",
      "beach",
      "night",
      "studio",
    ]);
    for (const name of BACKDROP_NAMES) {
      const spec = BACKDROPS[name];
      expect(spec.name).toBe(name);
      expect(spec.label.length).toBeGreaterThan(0);
      expect(spec.hint.length).toBeGreaterThan(0);
      expect(spec.swatch).toMatch(/gradient/);
      expect(spec.background).toMatch(/^#[0-9a-f]{6}$/);
      expect(spec.gridOpacity).toBeGreaterThan(0);
      expect(spec.gridOpacity).toBeLessThanOrEqual(1);
      // Everything but Blank draws a sky that meets its ground at the horizon.
      if (name === "blank") expect(spec.sky).toBeUndefined();
      else {
        expect(spec.sky!.top).toMatch(/^#[0-9a-f]{6}$/);
        expect(spec.sky!.horizon).toMatch(/^#[0-9a-f]{6}$/);
      }
    }
    expect(isBackdropName("grass")).toBe(true);
    expect(isBackdropName("lava")).toBe(false);
    expect(() => requireBackdrop("lava")).toThrow(/Backdrop must be one of/);
  });

  it("saves a backdrop and a Play hint as undoable project edits", async () => {
    const editor = new Editor(brick());
    expect(backdropOf(editor.project)).toBe("blank");
    expect(editor.project.scene).toBeUndefined();
    await run(editor, "scene.set", { backdrop: "street" });
    expect(editor.project.scene).toEqual({ backdrop: "street" });
    await run(editor, "scene.set", { playHint: "Drive around the block!" });
    expect(editor.project.scene).toEqual({
      backdrop: "street",
      playHint: "Drive around the block!",
    });
    await run(editor, "history.undo", {});
    await run(editor, "history.undo", {});
    expect(editor.project.scene).toBeUndefined();
    await run(editor, "history.redo", {});
    expect(backdropOf(editor.project)).toBe("street");
    // Blank is the default and is not stored.
    await run(editor, "scene.set", { backdrop: "blank" });
    expect(editor.project.scene).toBeUndefined();
    validate("project", editor.project);
  });

  it("refuses unknown backdrops, fields and over-long hints", async () => {
    const editor = new Editor(brick());
    const revision = editor.revision;
    const refused = async (payload: Record<string, unknown>) => {
      await expect(
        (async () => run(editor, "scene.set", payload))(),
      ).rejects.toThrow();
    };
    await refused({ backdrop: "lava" });
    await refused({ sky: "red" });
    await refused({});
    await refused({ playHint: "x".repeat(PLAY_HINT_MAX_LENGTH + 1) });
    await refused({ playHint: "two\nlines" });
    expect(editor.revision).toBe(revision);
    expect(() =>
      validate("command", {
        schemaVersion: 1,
        commandId: "c",
        expectedRevision: 0,
        type: "scene.set",
        payload: { backdrop: "beach" },
      }),
    ).not.toThrow();
  });

  it("round-trips through native projects but never reaches LDraw or clipboard fragments", async () => {
    const p = brick();
    p.scene = { backdrop: "beach", playHint: "Build a sandcastle!" };
    const restored = await decodeNative(await encodeNative(p));
    expect(restored.scene).toEqual(p.scene);
    const ldraw = exportLDraw(p);
    expect(ldraw).not.toMatch(/beach|sandcastle/i);
    const fragment = copyFragment(p, {
      occurrenceIds: occurrences(p).map((o) => o.id),
    });
    expect(JSON.stringify(fragment)).not.toMatch(/beach|sandcastle/);
  });

  it("opens each sample on a fitting backdrop", () => {
    expect(TEMPLATE_BACKDROPS).toMatchObject({
      jeep: "street",
      car: "street",
      windmill: "grass",
      house: "grass",
      castle: "grass",
      lighthouse: "beach",
      playground: "grass",
      town: "street",
      cathedral: "grass",
      harbour: "beach",
    });
    registerFullLibraryFromDisk();
    registerScriptTemplatesFromDisk();
    for (const name of SAMPLE_TEMPLATES)
      expect(backdropOf(template(name))).toBe(
        TEMPLATE_BACKDROPS[name] ?? "blank",
      );
  });
});
