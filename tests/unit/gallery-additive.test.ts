import { expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { decodeGalleryIndex } from "../../src/catalog/gallery-index";
import { verifyAdditiveIndex } from "../../scripts/publish-gallery-bundle";
const before = decodeGalleryIndex(
  JSON.parse(
    readFileSync(
      "fixtures/spatial-benchmark/studies/gallery-reference-v2/publication/index.json",
      "utf8",
    ),
  ),
);
const addition = () => {
  const after = structuredClone(before);
  after.builds.push({ ...after.builds[0], id: "123456789abc" });
  return after;
};
it("permits new builds but refuses edits/removal of existing published data", () => {
  expect(() => verifyAdditiveIndex(before, addition())).not.toThrow();
  for (const mutate of [
    (after: typeof before) => {
      after.files = "https://other.invalid";
    },
    (after: typeof before) => {
      after.generations![0].name = "changed";
    },
    (after: typeof before) => {
      after.builds[0].mpd = "f".repeat(64);
    },
    (after: typeof before) => {
      after.builds.shift();
    },
    (after: typeof before) => {
      after.agents[0].name = "changed";
    },
    (after: typeof before) => {
      after.prompts[0].brief = "changed";
    },
    (after: typeof before) => {
      after.generations!.find((g) => g.default)!.default = false;
    },
  ]) {
    const after = addition();
    mutate(after);
    expect(() => verifyAdditiveIndex(before, after)).toThrow();
  }
  expect(() => verifyAdditiveIndex(before, before)).toThrow("no new builds");
});
