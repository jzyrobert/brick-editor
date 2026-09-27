import { expect, test } from "vitest";
import { createShare, previewShare } from "../../src/persistence/share";
import { template } from "../../src/catalog/templates";
import { occurrences } from "../../src/core/document";
test("share round trip keeps geometry in a new temporary project and strips automation query", async () => {
  const p = template("room"),
    before = JSON.stringify(p);
  const link = await createShare(
    p,
    "https://example.com/brick-editor/?automation=1",
  );
  expect(link.url).not.toContain("automation");
  expect(link.bytes).toBeLessThan(8192);
  const preview = await previewShare(new URL(link.url).hash);
  expect(occurrences(preview.project)).toHaveLength(74);
  expect(preview.project.id).not.toBe(p.id);
  expect(JSON.stringify(p)).toBe(before);
});
test("share envelope rejects corruption, duplicate fields, unsupported libraries and oversize input", async () => {
  const { url } = await createShare(template("blank"), "https://example.com/");
  const hash = new URL(url).hash;
  await expect(previewShare(hash + "&v=1")).rejects.toThrow("envelope");
  await expect(
    previewShare(hash.replace("codec=deflate", "codec=script")),
  ).rejects.toThrow("codec");
  await expect(
    previewShare(hash.replace(/sha256=[^&]+/, "sha256=bad")),
  ).rejects.toThrow("checksum");
  await expect(previewShare("x".repeat(32769))).rejects.toThrow("32 KiB");
});
