import { readFile } from "node:fs/promises";
import { expect, it } from "vitest";
import { importLDraw } from "../../src/ldraw/io";
import { occurrences } from "../../src/core/document";
import { occurrenceRenderContext } from "../../src/render/source-context";
it("accumulates inversion/culling on raw branches and resets at physical parts", async () => {
  const p = importLDraw(
    await readFile("fixtures/ldraw/bfc-branches.mpd", "utf8"),
  );
  const contexts = occurrences(p).map((o) => occurrenceRenderContext(p, o));
  expect(contexts).toHaveLength(7);
  expect(contexts[0].source).toContain("CERTIFY CW");
  expect(contexts[1].source).toContain("NOCLIP");
  expect(contexts[2].source).toContain("CERTIFY CCW");
  expect(contexts[3].source).not.toContain("INVERTNEXT");
  expect(contexts[3].forceDoubleSided).toBe(false);
  expect(contexts[4].source).toContain("INVERTNEXT");
  expect(contexts[5].source).not.toContain("INVERTNEXT");
  expect(contexts[6].source).toContain("NOCLIP");
});
it("uncertified ancestors prevent raw/subpart culling; comments consume INVERTNEXT", () => {
  const p = importLDraw(`0 FILE main.ldr
1 100 0 0 0 1 0 0 0 1 0 0 0 1 raw.ldr
0 FILE raw.ldr
0 BFC CERTIFY CCW
0 BFC INVERTNEXT
0 comment invalidates adjacency
1 100 0 0 0 1 0 0 0 1 0 0 0 1 patch.dat
3 100 0 0 0 10 0 0 0 -10 0
0 FILE patch.dat
0 !LDRAW_ORG Subpart
0 BFC CERTIFY CCW
3 100 0 0 0 10 0 0 0 -10 0
0 NOFILE`);
  const [subpart, raw] = occurrences(p).map((o) =>
    occurrenceRenderContext(p, o),
  );
  expect(subpart.source).not.toContain("INVERTNEXT");
  expect(subpart.source).toContain("NOCLIP");
  expect(raw.source).toContain("NOCLIP");
});
