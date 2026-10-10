import { afterEach, describe, expect, it } from "vitest";
import {
  copyFileSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { verifyBundle } from "../../scripts/publish-gallery-bundle";

const bundle = resolve("docs/samples/lego-style-study/gallery-publication");
const temporary: string[] = [];
function editedBundle() {
  const dir = mkdtempSync(join(tmpdir(), "brick-gallery-review-"));
  temporary.push(dir);
  for (const file of ["manifest.json", "index.json", "publish.sql"])
    copyFileSync(join(bundle, file), join(dir, file));
  for (const folder of ["b", "s", "p", "r"])
    symlinkSync(join(bundle, folder), join(dir, folder), "dir");
  return dir;
}
afterEach(() =>
  temporary
    .splice(0)
    .forEach((dir) => rmSync(dir, { recursive: true, force: true })),
);

describe("reviewed gallery publication", () => {
  it("verifies the complete six-prompt, three-model replacement before uploads", () => {
    const { index, manifest } = verifyBundle(bundle);
    expect(index.builds).toHaveLength(18);
    expect(manifest.files).toHaveLength(108);
    expect(manifest.after.some((id) => manifest.before.includes(id))).toBe(
      false,
    );
  });
  it("rejects changed publication SQL before it can change visibility", () => {
    const dir = editedBundle();
    writeFileSync(join(dir, "publish.sql"), "DELETE FROM builds;");
    expect(() => verifyBundle(dir)).toThrow("Publication SQL checksum changed");
  });
  it("rejects an incomplete replacement roster", () => {
    const dir = editedBundle();
    const index = JSON.parse(readFileSync(join(dir, "index.json"), "utf8"));
    index.builds.pop();
    writeFileSync(join(dir, "index.json"), JSON.stringify(index));
    expect(() => verifyBundle(dir)).toThrow(
      "Unexpected gallery replacement roster",
    );
  });
  it("rejects an asset whose reviewed checksum does not match", () => {
    const dir = editedBundle();
    const manifest = JSON.parse(
      readFileSync(join(dir, "manifest.json"), "utf8"),
    );
    manifest.files[0].sha256 = "0".repeat(64);
    writeFileSync(join(dir, "manifest.json"), JSON.stringify(manifest));
    expect(() => verifyBundle(dir)).toThrow("File checksum changed");
  });
  it("rejects two responses from one model in place of a three-model comparison", () => {
    const dir = editedBundle();
    const index = JSON.parse(readFileSync(join(dir, "index.json"), "utf8"));
    const first = index.builds[0];
    const other = index.builds.find(
      (b: { prompt: string; agent: string }) =>
        b.prompt === first.prompt && b.agent !== first.agent,
    );
    first.agent = other.agent;
    writeFileSync(join(dir, "index.json"), JSON.stringify(index));
    expect(() => verifyBundle(dir)).toThrow(
      "Each prompt must have all three high-effort E models",
    );
  });
});
