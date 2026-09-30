import { expect, it, vi } from "vitest";
import { createProject } from "../../src/core/document";
import { Editor } from "../../src/core/commands";
import { identity } from "../../src/core/math";
import { createAPI } from "../../src/automation/api";

function source() {
  const p = createProject();
  p.models[p.rootModelId].nodes = ["a", "b"].map((id) => ({
    id,
    kind: "part" as const,
    ref: "3001.dat",
    colorCode: "4",
    transform: identity(),
  }));
  return p;
}
it("commits a source-only replacement atomically and makes derived endpoints terminal", async () => {
  const editor = new Editor(undefined, { limits: { leafCount: 1 } });
  const listener = vi.fn();
  editor.subscribe(listener);
  const result = editor.replace(source());
  expect(result.materialization.status).toBe("limited");
  expect(result.materialization.diagnostic).toMatchObject({
    resource: "leafCount",
    limit: 1,
    requiredAtLeast: 2,
  });
  expect(listener).toHaveBeenCalledOnce();
  const api = createAPI(editor, () => undefined);
  expect((await api.project.status()).revision).toBe(result.revision);
  for (const operation of [
    () => api.ready(),
    () => api.query(),
    () => api.play.enter({}),
    () => api.project.export({ format: "ldraw", scope: { kind: "all" } }),
    () =>
      api.dispatch({
        schemaVersion: 1,
        commandId: "edit",
        expectedRevision: result.revision,
        type: "project.rename",
        payload: { title: "Unsafe edit" },
      }),
  ]) {
    await expect(operation()).rejects.toMatchObject({
      code: "LIMIT_EXCEEDED",
      details: { revision: result.revision },
    });
  }
  expect(
    (await api.project.export({ format: "native" })).bytes.length,
  ).toBeGreaterThan(0);
  expect(
    new TextDecoder().decode(
      (await api.project.export({ format: "ldraw" })).bytes,
    ),
  ).toContain("3001.dat");
  const before = editor.project;
  const bad = source();
  bad.rootModelId = "missing";
  expect(() => editor.replace(bad)).toThrow();
  expect(editor.project).toEqual(before);
  editor.replace(createProject());
  expect(editor.materialization.status).toBe("available");
});
it("reports listener faults separately from committed replacement and keeps prospective edits atomic", () => {
  const editor = new Editor(undefined, { limits: { leafCount: 1 } });
  const error = vi.spyOn(console, "error").mockImplementation(() => {});
  editor.subscribe(() => {
    throw new Error("Renderer failed");
  });
  const notify = vi.fn();
  editor.subscribe(notify);
  expect(() => editor.replace(createProject())).not.toThrow();
  expect(notify).toHaveBeenCalledOnce();
  expect(error).toHaveBeenCalledOnce();
  error.mockRestore();
  const before = editor.project;
  expect(() =>
    editor.dispatch({
      schemaVersion: 1,
      commandId: "two",
      expectedRevision: before.revision,
      type: "parts.add",
      payload: {
        parts: ["a", "b"].map(() => ({
          ref: "3001.dat",
          colorCode: "4",
          transform: identity(),
        })),
      },
    }),
  ).toThrow(/resource budget/);
  expect(editor.project).toEqual(before);
  expect(editor.canUndo).toBe(false);
});
it("a pending ready rejects a later limited source and cannot return the old renderer", async () => {
  const editor = new Editor(undefined, { limits: { leafCount: 1 } });
  let resolve!: () => void;
  const pending = new Promise<void>((r) => {
    resolve = r;
  });
  const api = createAPI(editor, () => ({ ready: () => pending }) as never);
  const ready = api.ready();
  await Promise.resolve();
  editor.replace(source());
  resolve();
  await expect(ready).rejects.toMatchObject({
    code: "LIMIT_EXCEEDED",
    details: { revision: editor.project.revision },
  });
});
it("copies trusted policy and refuses overrides not implemented by every consumer", () => {
  const options = { limits: { leafCount: 1 } };
  const editor = new Editor(undefined, options);
  options.limits.leafCount = 100;
  expect(editor.replace(source()).materialization.status).toBe("limited");
  expect(
    () =>
      new Editor(undefined, {
        limits: { retainedIdCharacters: 256 * 1024 * 1024 },
        acknowledgeDerivedImpact: true,
      }),
  ).toThrow(/not supported/);
});

for (const blockedAt of ["mount", "renderer"])
  it(`ready rejects limited replacement even when ${blockedAt} never settles`, async () => {
    const editor = new Editor(undefined, { limits: { leafCount: 1 } });
    const never = new Promise<never>(() => {});
    let activeListeners = 0;
    const original = editor.subscribe.bind(editor);
    vi.spyOn(editor, "subscribe").mockImplementation((fn) => {
      activeListeners++;
      const off = original(fn);
      return () => {
        activeListeners--;
        off();
      };
    });
    const api = createAPI(
      editor,
      () => ({ ready: () => never }) as never,
      undefined,
      undefined,
      undefined,
      blockedAt === "mount" ? () => never : undefined,
    );
    const ready = api.ready();
    await Promise.resolve();
    expect(activeListeners).toBe(1);
    editor.replace(source());
    await expect(ready).rejects.toMatchObject({
      code: "LIMIT_EXCEEDED",
      details: { revision: editor.project.revision },
    });
    expect(activeListeners).toBe(0);
  });
