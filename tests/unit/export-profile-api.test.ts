import { expect, it, vi } from "vitest";
import { readFile } from "node:fs/promises";
import { Editor } from "../../src/core/commands";
import { createAPI } from "../../src/automation/api";
import { template } from "../../src/catalog/templates";
it("validates public profile requests and refuses stale snapshot exports as registered jobs", async () => {
  const editor = new Editor(template("wall")),
    api = createAPI(editor, () => undefined);
  await expect(
    api.project.exportProfile({
      profile: "standard",
      scope: { kind: "all" },
      unexpected: true,
    } as any),
  ).rejects.toThrow(/Invalid exportProfileRequest/);
  await expect(
    api.project.exportProfile({
      profile: "standard",
      scope: { kind: "all" },
      includeOfficial: "yes",
    } as any),
  ).rejects.toThrow(/Invalid exportProfileRequest/);
  await expect(
    api.project.exportProfile({
      profile: "standard",
      scope: { kind: "all" },
      expectedRevision: 99,
    }),
  ).rejects.toThrow(/revision/);
  let release!: () => void;
  const gate = new Promise<void>((r) => (release = r));
  const mock = vi
    .spyOn(globalThis, "fetch")
    .mockImplementation(async (input) => {
      await gate;
      return new Response(
        await readFile("public/" + String(input).replace(/^\//, "")),
      );
    });
  try {
    const pending = api.project
      .exportProfile({
        profile: "portable",
        scope: { kind: "all" },
        includeOfficial: true,
      })
      .then(
        () => null,
        (e) => e,
      );
    await vi.waitFor(() => expect(mock).toHaveBeenCalled());
    expect(
      (await api.jobs.list()).some(
        (j) => j.kind === "model-export" && j.state === "running",
      ),
    ).toBe(true);
    editor.dispatch({
      schemaVersion: 1,
      commandId: "change-during-profile",
      expectedRevision: editor.project.revision,
      type: "project.rename",
      payload: { title: "Changed" },
    });
    release();
    expect((await pending).code).toBe("REVISION_CONFLICT");
    expect(editor.project.title).toBe("Changed");
  } finally {
    release();
    mock.mockRestore();
  }
});
it("cancels public model export jobs and exposes cancelled state", async () => {
  const api = createAPI(new Editor(template("wall")), () => undefined);
  let release!: () => void;
  const gate = new Promise<void>((r) => (release = r));
  const mock = vi
    .spyOn(globalThis, "fetch")
    .mockImplementation(async (input) => {
      await gate;
      return new Response(
        await readFile("public/" + String(input).replace(/^\//, "")),
      );
    });
  try {
    const pending = api.project
      .exportProfile({
        profile: "portable",
        scope: { kind: "all" },
        includeOfficial: true,
      })
      .then(
        () => null,
        (e) => e,
      );
    await vi.waitFor(() => expect(mock).toHaveBeenCalled());
    const job = (await api.jobs.list()).find((j) => j.state === "running")!;
    await api.jobs.cancel(job.id);
    release();
    expect((await pending).code).toBe("CANCELLED");
    expect((await api.jobs.status(job.id)).state).toBe("cancelled");
  } finally {
    release();
    mock.mockRestore();
  }
});
