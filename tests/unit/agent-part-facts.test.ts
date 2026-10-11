import { beforeAll, expect, it } from "vitest";
import { partFacts, partGeometryFacts } from "../../scripts/agent-part-facts";
import { registerFullLibraryFromDisk } from "../../scripts/full-library-node";
import { registerAgentData } from "../../scripts/build-script-cli";
beforeAll(() => {
  registerFullLibraryFromDisk();
  registerAgentData();
});
it("uses the actual placement anchor and converts physical vertical size to studs", () => {
  expect(partGeometryFacts("3001.dat")).toContain("min=[0,0,0] max=[4,3.5,2]");
  expect(partGeometryFacts("3001.dat")).toContain(
    "extent in studs (x,y,z)=[4,1.4,2]",
  );
  expect(partGeometryFacts("3001.dat")).toContain(
    '"kind":"stud","at":[0.5,3,1.5],"axis":[0,1,0]',
  );
  expect(partGeometryFacts("4600.dat")).toContain("min=[-0.7,-0.507,0]");
  expect(partGeometryFacts("4600.dat")).toContain(
    "verified connectors=unknown",
  );
});
it("reports pinned official wheel/tyre assembly evidence without inferring unknown fits", () => {
  const facts = partFacts("4624.dat");
  expect(facts).toContain("4624c01.dat");
  expect(facts).toContain("3641.dat");
  expect(facts).toContain("verified connectors=unknown");
  expect(partFacts("not-a-part.dat")).toContain("not a compatibility verdict");
}, 30000);
