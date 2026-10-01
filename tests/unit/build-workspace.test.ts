import { describe, expect, it } from "vitest";
import { mkdtempSync, readFileSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  REPO,
  createWorkspace,
  slug,
  workspacePrompt,
  wrapperScript,
} from "../../scripts/new-build-workspace";

describe("build agent workspaces", () => {
  it("fills the brief and part budget into the prompt", () => {
    const text = workspacePrompt(
      "A lighthouse ($& and $1 stay as written)",
      4000,
    );
    expect(text).not.toMatch(/\{\{|Return ONLY/);
    expect(text).toContain("Hard maximum: 4,000 parts");
    expect(text).toContain("to the 4,000-part budget");
    expect(text).toContain("Write the script to `build.json`");
    expect(text).not.toMatch(/(?<!\.\/)brick-cli /);
    expect(text.trimEnd()).toMatch(
      /Build request: A lighthouse \(\$& and \$1 stay as written\)$/,
    );
    // The workspace section comes after the opening paragraph, before Output.
    expect(text.indexOf("## Workspace")).toBeLessThan(
      text.indexOf("## Output"),
    );
    expect(text.startsWith("You are a master brick architect.")).toBe(true);
  });

  it("holds builds to the budget in the CLI wrapper", () => {
    const sh = wrapperScript(1500, "/repo/it's here", "/usr/bin/node");
    expect(sh).toContain(`REPO='/repo/it'\\''s here'`);
    expect(sh).toContain(`set -- "$@" --max-parts 1500`);
  });

  it("names folders from the brief", () => {
    expect(slug("A red-and-white lighthouse on a rock")).toBe(
      "red-and-white-lighthouse",
    );
    expect(slug("!!!")).toBe("build");
  });

  it("creates a clean workspace outside the repository only", async () => {
    const root = mkdtempSync(join(tmpdir(), "brick-ws-"));
    const dir = await createWorkspace(join(root, "w"), "A barn", 800, "barn");
    expect(readFileSync(join(dir, "CLAUDE.md"), "utf8")).toBe("@AGENTS.md\n");
    expect(readFileSync(join(dir, "AGENTS.md"), "utf8")).toContain(
      "Build request: A barn",
    );
    expect(statSync(join(dir, "brick-cli")).mode & 0o111).toBeTruthy();
    expect(statSync(join(dir, "views")).isDirectory()).toBe(true);
    expect(
      JSON.parse(readFileSync(join(dir, "workspace.json"), "utf8")),
    ).toMatchObject({ name: "barn", maxParts: 800, brief: "A barn" });
    await expect(createWorkspace(dir, "A barn", 800, "barn")).rejects.toThrow(
      /not empty/,
    );
    await expect(
      createWorkspace(join(REPO, ".local", "ws"), "A barn", 800, "barn"),
    ).rejects.toThrow(/inside the repository/);
  });
});
