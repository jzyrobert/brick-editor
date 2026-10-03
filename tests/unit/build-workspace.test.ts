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
  it("fills the brief and part target into the prompt", () => {
    const text = workspacePrompt(
      "A lighthouse ($& and $1 stay as written)",
      4000,
    );
    expect(text).not.toMatch(/\{\{|Return ONLY/);
    expect(text).toContain("Target: 4,000 parts");
    expect(text).toMatch(
      /\n- 3005 Brick 1 × 1 — 1×1 studs \(x×z\), 3 plates — /,
    );
    // Guidance with a score, not a range the compiler enforces.
    expect(text).not.toMatch(/Accepted range|accepted range|refuses/);
    expect(text).toContain("its part count against the target of 4,000");
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

  it("reports builds against the part target in the CLI wrapper", () => {
    const sh = wrapperScript(1500, "/repo/it's here", "/usr/bin/node");
    expect(sh).toContain(`REPO='/repo/it'\\''s here'`);
    expect(sh).toContain(`set -- "$@" --target-parts 1500; fi`);
    expect(sh).not.toContain("--leeway");
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
    const meta = JSON.parse(readFileSync(join(dir, "workspace.json"), "utf8"));
    expect(meta).toMatchObject({
      name: "barn",
      targetParts: 800,
      brief: "A barn",
    });
    expect(meta).not.toHaveProperty("leeway");
    await expect(createWorkspace(dir, "A barn", 800, "barn")).rejects.toThrow(
      /not empty/,
    );
    await expect(
      createWorkspace(join(REPO, ".local", "ws"), "A barn", 800, "barn"),
    ).rejects.toThrow(/inside the repository/);
  });
});
