import { expect, it } from "vitest";
import { occurrences } from "../../src/core/document";
import { rackFixture } from "../../src/mechanisms/rack-fixture";
import {
  fullLibrarySources,
  registerFullLibraryFromDisk,
} from "../../scripts/full-library-node";
import { playSources } from "../helpers/play-dynamic-source";
import {
  loadReviewedMechanicalProxies,
  reviewedMechanicalMember,
} from "../../src/play/reviewed-mechanical-proxies";
registerFullLibraryFromDisk();
it("binds lazy licensed packets to the actual source and refuses changed buffers, geometry and revisions without mutating the build", async () => {
  const { project, proposal } = rackFixture(),
    before = JSON.stringify(project);
  const { sources } = await playSources(
    project,
    [proposal.rig!.id],
    fullLibrarySources(occurrences(project).map((o) => o.node.ref)),
  );
  const source = sources[0],
    all = occurrences(project),
    housing = all.find((o) => o.node.ref === "18940.dat")!.id,
    rack = all.find((o) => o.node.ref === "18942.dat")!.id;
  expect(reviewedMechanicalMember(source, housing)).toBeUndefined();
  await loadReviewedMechanicalProxies(sources);
  const h = reviewedMechanicalMember(source, housing)!,
    r = reviewedMechanicalMember(source, rack)!;
  expect([h.regionCount, h.childCount, r.regionCount, r.childCount]).toEqual([
    900, 927, 1245, 1245,
  ]);
  expect(h.source.license).toBe("CC BY 4.0");
  expect(h.regions.filter((x) => x.rank === 2)).toHaveLength(26);
  expect(h.regions.filter((x) => x.rank === 1)).toHaveLength(3);
  expect(JSON.stringify(project)).toBe(before);
  // Copying a source object requires a fresh preflight, even if buffers match.
  expect(reviewedMechanicalMember({ ...source }, housing)).toBeUndefined();
  const original = source.memberLocals![housing],
    copied = { ...original, vertices: original.vertices.slice() };
  source.memberLocals![housing] = copied;
  expect(() => reviewedMechanicalMember(source, housing)).toThrow(
    /build changed/,
  );
  copied.vertices[0] += 0.001;
  await expect(loadReviewedMechanicalProxies([source])).rejects.toThrow(
    /matching reviewed geometry/,
  );
  // A failed batch does not publish its otherwise valid members.
  expect(reviewedMechanicalMember({ ...source }, rack)).toBeUndefined();
  source.memberLocals![housing] = original;
  project.revision++;
  expect(() => reviewedMechanicalMember(source, rack)).toThrow(/build changed/);
  project.revision--;
  expect(JSON.stringify(project)).toBe(before);
}, 15000);
