import { afterEach, describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
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
import {
  verifyBundle,
  verifyLiveIndex,
} from "../../scripts/publish-gallery-bundle";

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

const generationsBundle = resolve(
  "docs/samples/lego-style-study/generation-publication",
);
const sha = (s: string) => createHash("sha256").update(s).digest("hex");
function editedGenerations() {
  const dir = mkdtempSync(join(tmpdir(), "brick-gallery-generations-"));
  temporary.push(dir);
  for (const file of ["manifest.json", "index.json", "publish.sql"])
    copyFileSync(join(generationsBundle, file), join(dir, file));
  for (const folder of ["b", "s", "p", "r"])
    symlinkSync(join(generationsBundle, folder), join(dir, folder), "dir");
  return dir;
}
function changeIndex(dir: string, edit: (index: any) => void) {
  const index = JSON.parse(readFileSync(join(dir, "index.json"), "utf8"));
  edit(index);
  const body = JSON.stringify(index);
  writeFileSync(join(dir, "index.json"), body);
  const manifest = JSON.parse(readFileSync(join(dir, "manifest.json"), "utf8"));
  manifest.indexSha256 = sha(body);
  writeFileSync(join(dir, "manifest.json"), JSON.stringify(manifest));
}

describe("text-only gallery history", () => {
  it("requires live generation assignments and the default to match review before publishing the index", () => {
    const { index } = verifyBundle(generationsBundle);
    expect(() =>
      verifyLiveIndex({ ...index, generated: new Date().toISOString() }, index),
    ).not.toThrow();
    expect(() =>
      verifyLiveIndex(
        {
          ...index,
          generations: index.generations!.map((g) => ({
            ...g,
            default: false,
          })),
        },
        index,
      ),
    ).toThrow("Live gallery metadata differs");
    expect(() =>
      verifyLiveIndex(
        {
          ...index,
          builds: index.builds.map((b, i) =>
            i ? b : { ...b, generation: "f-fresh" },
          ),
        },
        index,
      ),
    ).toThrow("Live gallery metadata differs");
  });
  it("preserves the current 18 revisions while featuring 18 fresh E builds among 80", () => {
    const { index, manifest } = verifyBundle(generationsBundle);
    expect(index.builds).toHaveLength(80);
    expect(index.generations).toHaveLength(9);
    expect(manifest.files).toHaveLength(480);
    expect(manifest.before).toHaveLength(18);
    expect(manifest.before.every((id) => manifest.after.includes(id))).toBe(
      true,
    );
    expect(
      index.generations?.filter((g) => g.default).map((g) => g.id),
    ).toEqual(["e-fresh"]);
    expect(index.builds.filter((b) => b.generation === "e-fresh")).toHaveLength(
      18,
    );
    expect(index.builds.filter((b) => b.generation === "f-fresh")).toHaveLength(
      6,
    );
    const fresh = manifest.inputs!.filter((i) => i.generation === "e-fresh");
    for (const subject of [
      "pelican",
      "piplup",
      "temple",
      "dragon",
      "destroyer",
      "ewok",
    ]) {
      const inputs = fresh.filter((i) => i.folder.endsWith("-" + subject));
      expect(inputs).toHaveLength(3);
      expect(new Set(inputs.map((i) => i.promptSha256)).size).toBe(1);
    }
    expect(manifest.inputs!.every((i) => i.images === 0)).toBe(true);
  });
  it("refuses F as the featured generation when reviewed E is required", () => {
    const dir = editedGenerations();
    changeIndex(dir, (index) => {
      for (const g of index.generations) g.default = g.id === "f-fresh";
    });
    expect(() => verifyBundle(dir)).toThrow(
      "Unexpected prompt generation metadata",
    );
  });
  it("refuses an incomplete three-model latest collection even if cohort counts are unchanged", () => {
    const dir = editedGenerations();
    changeIndex(dir, (index) => {
      const b = index.builds.find((b: any) => b.generation === "e-fresh");
      b.agent =
        b.agent === "codex/gpt-6-1-sol/high"
          ? "codex/gpt-6-astra/high"
          : "codex/gpt-6-1-sol/high";
    });
    expect(() => verifyBundle(dir)).toThrow(
      "Latest E must include three high-effort models for every brief",
    );
  });
  it("refuses image-input runs in the text-only publication", () => {
    const dir = editedGenerations();
    const manifest = JSON.parse(
      readFileSync(join(dir, "manifest.json"), "utf8"),
    );
    manifest.inputs[0].images = 1;
    writeFileSync(join(dir, "manifest.json"), JSON.stringify(manifest));
    expect(() => verifyBundle(dir)).toThrow(
      "Text-only input provenance changed",
    );
  });
});
