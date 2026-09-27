import { expect, it } from "vitest";
import { importLDraw, exportLDraw } from "../../src/ldraw/io";
import { dependencySource } from "../../src/render/dependency-source";
it("physical compilation includes shared recursive dependencies without unrelated source or mutations", () => {
  const project = importLDraw(`0 FILE main.ldr
0 !COLOUR Parent CODE 100 VALUE #ff0000 EDGE #333333
1 100 0 0 0 1 0 0 0 1 0 0 0 1 parts/body.dat
1 4 0 0 0 1 0 0 0 1 0 0 0 1 unused.dat
0 FILE parts/body.dat
0 !LDRAW_ORG Unofficial_Part
0 BFC CERTIFY CW
1 16 0 0 0 1 0 0 0 1 0 0 0 1 edge.dat
1 16 20 0 0 1 0 0 0 1 0 0 0 1 edge.dat
0 FILE parts/edge.dat
0 !LDRAW_ORG Unofficial_Subpart
3 16 0 0 0 20 0 0 0 20 0
0 FILE unused.dat
0 !LDRAW_ORG Unofficial_Part
3 4 0 0 0 30 0 0 0 30 0
0 NOFILE
`);
  const original = exportLDraw(project);
  const source = dependencySource(project, "parts/body.dat");
  expect(source).toContain("0 FILE parts/body.dat");
  expect(source).toContain("0 BFC CERTIFY CW");
  expect(source.match(/0 FILE parts\/edge.dat/g)).toHaveLength(1);
  expect(source).not.toContain("unused.dat");
  expect(source).not.toContain("Parent CODE");
  expect(exportLDraw(project)).toBe(original);
  const reconstructed = importLDraw(source);
  expect(Object.keys(reconstructed.models)).toEqual([
    "parts/body.dat",
    "parts/edge.dat",
  ]);
  project.revision++;
  project.models["parts/edge.dat"].records.push({
    id: "comment",
    raw: "0 New source revision",
  });
  expect(dependencySource(project, "parts/body.dat")).toContain(
    "New source revision",
  );
});
