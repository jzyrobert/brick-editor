import { expect, it, vi } from "vitest";
import { occurrences } from "../../src/core/document";
import { rackFixture } from "../../src/mechanisms/rack-fixture";
import {
  fullLibrarySources,
  registerFullLibraryFromDisk,
} from "../../scripts/full-library-node";
import { playSources } from "../helpers/play-dynamic-source";
import { PlaySession } from "../../src/play/session";
import {
  loadReviewedMechanicalProxies,
  reviewedMechanicalMember,
} from "../../src/play/reviewed-mechanical-proxies";

const allocations = vi.hoisted(() => ({ worlds: 0, queues: 0 }));
vi.mock("@dimforge/rapier3d-compat", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@dimforge/rapier3d-compat")>();
  class World extends actual.World {
    constructor(...args: ConstructorParameters<typeof actual.World>) {
      allocations.worlds++;
      super(...args);
    }
  }
  class EventQueue extends actual.EventQueue {
    constructor(...args: ConstructorParameters<typeof actual.EventQueue>) {
      allocations.queues++;
      super(...args);
    }
  }
  return {
    ...actual,
    World,
    EventQueue,
    default: { ...actual.default, World, EventQueue },
  };
});
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

it("refuses a changed rack surface before allocating native worlds or queues in either Play mode", async () => {
  const { project, proposal } = rackFixture(),
    rig = proposal.rig!,
    all = occurrences(project),
    housing = all.find((o) => o.node.ref === "18940.dat")!.id,
    rack = all.find((o) => o.node.ref === "18942.dat")!.id;
  // This independent authored slider has no recognized paired guide, so the
  // temporary guided-rack refusal cannot mask the async geometry preflight.
  rig.groups[0].occurrenceIds = rig.groups[0].occurrenceIds.filter(
    (id) => id !== housing,
  );
  delete rig.groups[0].restTransforms[housing];
  const before = JSON.stringify(project),
    { sources, geometry } = await playSources(
      project,
      [rig.id],
      fullLibrarySources(all.map((o) => o.node.ref)),
    ),
    local = sources[0].memberLocals![rack],
    vertices = local.vertices.slice();
  const interior = vertices.findIndex(
    (n, i) =>
      n > local.bounds.min[i % 3] + 1 && n < local.bounds.max[i % 3] - 1,
  );
  expect(interior).toBeGreaterThanOrEqual(0);
  vertices[interior] += 0.001;
  sources[0].memberLocals![rack] = { ...local, vertices };
  allocations.worlds = 0;
  allocations.queues = 0;
  for (const dynamic of [false, true])
    await expect(
      PlaySession.create(
        geometry,
        { rigIds: [rig.id], dynamicRigIds: dynamic ? [rig.id] : [] },
        sources,
      ),
    ).rejects.toThrow(/matching reviewed geometry/);
  expect(allocations).toEqual({ worlds: 0, queues: 0 });
  expect(JSON.stringify(project)).toBe(before);
}, 15000);
