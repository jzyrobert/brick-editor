import { describe, expect, it } from "vitest";
import { mkdtemp, open, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  assertRequestBudget,
  MAX_REQUEST_BYTES,
} from "../../src/core/request-budget";
import { Editor } from "../../src/core/commands";
import { createProject, occurrences } from "../../src/core/document";
import { pasteFragment } from "../../src/core/fragments";
import { importLDraw } from "../../src/ldraw/io";
import { main } from "../../scripts/brick-cli";

describe("bounded external requests", () => {
  it("accounts for encoded keys, escapes, Unicode and shared values without serializing", () => {
    const shared = { text: '\u0000\\"\n漢😀\ud800' };
    const value = { "key\n": [shared, shared, true, false, null, -1.5] };
    const bytes = new TextEncoder().encode(JSON.stringify(value)).length;
    expect(assertRequestBudget(value, bytes)).toBe(bytes);
    expect(() => assertRequestBudget(value, bytes - 1)).toThrow(/byte budget/);
  });
  it("rejects cycles, accessors, excessive nesting and sparse work before recursion", () => {
    const cyclic: unknown[] = [];
    cyclic.push(cyclic);
    expect(() => assertRequestBudget(cyclic)).toThrow(/cycle/);
    let invoked = false;
    const accessor = Object.defineProperty({}, "value", {
      enumerable: true,
      get() {
        invoked = true;
        return 1;
      },
    });
    expect(() => assertRequestBudget(accessor)).toThrow(/accessors/);
    expect(invoked).toBe(false);
    const inherited = new Array(1);
    const prototype = Object.create(Array.prototype);
    Object.defineProperty(prototype, "0", {
      get() {
        invoked = true;
        return "x";
      },
    });
    Object.setPrototypeOf(inherited, prototype);
    expect(() => assertRequestBudget(inherited)).toThrow(/plain objects/);
    expect(invoked).toBe(false);
    let deep: unknown = null;
    for (let i = 0; i < 130; i++) deep = [deep];
    expect(() => assertRequestBudget(deep)).toThrow(/nesting/);
    expect(() => assertRequestBudget(new Array(1_000_001))).toThrow(
      /work budget/,
    );
  });
  it("rejects aggregate transactions and cut input atomically before hashing", () => {
    const editor = new Editor();
    const before = editor.project;
    const command = {
      schemaVersion: 1 as const,
      commandId: "large",
      expectedRevision: 0,
      type: "groups.create",
      payload: { name: "x", occurrenceIds: ["x".repeat(1024 * 1024)] },
    };
    expect(() =>
      editor.transaction({
        commandId: "batch",
        expectedRevision: 0,
        commands: Array(26).fill(command),
      }),
    ).toThrow(/byte budget/);
    const ids: any[] = [];
    ids.push(ids);
    expect(() =>
      editor.cut({ commandId: "cut", expectedRevision: 0, occurrenceIds: ids }),
    ).toThrow(/cycle/);
    expect(editor.project).toEqual(before);
    expect(editor.canUndo).toBe(false);
  });
  it("bounds clipboard fragments before serialization", () => {
    const fragment = { schemaVersion: 1 as const, project: createProject() };
    (fragment.project.assets as any).cycle = fragment;
    expect(() => pasteFragment(createProject(), fragment, [])).toThrow(/cycle/);
  });
  it("rejects an unpasteable Unicode-heavy cut before removing its source", () => {
    const project = importLDraw("1 4 0 0 0 1 0 0 0 1 0 0 0 1 3001.dat");
    project.metadata.preamble = Array(6144).fill("0 " + "漢".repeat(1024));
    const editor = new Editor(project);
    const id = occurrences(project)[0].id;
    expect(() =>
      editor.cut({
        commandId: "unicode-cut",
        expectedRevision: project.revision,
        occurrenceIds: [id],
      }),
    ).toThrow(/byte budget/);
    expect(editor.project.revision).toBe(project.revision);
    expect(occurrences(editor.project).map((o) => o.id)).toEqual([id]);
    expect(editor.canUndo).toBe(false);
  });
  it("rejects oversized CLI command files before parsing or writing output", async () => {
    const dir = await mkdtemp(join(tmpdir(), "brick-command-budget-"));
    try {
      const input = join(dir, "input.ldr"),
        commands = join(dir, "commands.json"),
        output = join(dir, "output.brickproj");
      await writeFile(input, "1 4 0 0 0 1 0 0 0 1 0 0 0 1 3001.dat");
      await writeFile(output, "keep");
      const handle = await open(commands, "w");
      try {
        await handle.truncate(MAX_REQUEST_BYTES + 1);
      } finally {
        await handle.close();
      }
      await expect(
        main([
          "apply",
          "--input",
          input,
          "--commands",
          commands,
          "--output",
          output,
        ]),
      ).rejects.toThrow(/Command file exceeds/);
      const { readFile } = await import("node:fs/promises");
      expect(await readFile(output, "utf8")).toBe("keep");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
