import { afterEach, beforeAll, describe, expect, it } from "vitest";
import RAPIER from "@dimforge/rapier3d-compat";
import {
  fullLibrarySources,
  registerFullLibraryFromDisk,
} from "../../scripts/full-library-node";
import { occurrences } from "../../src/core/document";
import { AppError } from "../../src/core/types";
import { rackFixture } from "../../src/mechanisms/rack-fixture";
import { mechanismFixture } from "../../src/mechanisms/fixtures";
import {
  GUIDED_RACK_PLAY_REFUSAL,
  GUIDED_RACK_PROXY_WARNING,
  unsupportedMechanicalPlayContact,
} from "../../src/mechanisms/mechanical-play-support";
import { KinematicSession } from "../../src/mechanisms/kinematic";
import { previewMechanicalProposal } from "../../src/mechanisms/mechanical-proposals";
import { DynamicRig, PlayDynamicsWorld } from "../../src/play/dynamics";
import {
  PlayMechanism,
  validatePlayMechanismSource,
  type PlayMechanismSource,
} from "../../src/play/mechanism";
import { prepareMechanicalSources } from "../../src/play/mechanical-solids";
import {
  loadReviewedMechanicalProxies,
  reviewedMechanicalMember,
} from "../../src/play/reviewed-mechanical-proxies";
import { PlaySession } from "../../src/play/session";
import { exportLDraw } from "../../src/ldraw/io";
import { posedLDraw } from "../../src/mechanisms/posed-export";
import { decodeNative, encodeNative } from "../../src/persistence/native";
import { playSources } from "../helpers/play-dynamic-source";

registerFullLibraryFromDisk();
let base: Awaited<ReturnType<typeof playSources>>;
beforeAll(async () => {
  await RAPIER.init();
  const { project } = rackFixture();
  base = await playSources(
    project,
    ["rack-drive"],
    fullLibrarySources(occurrences(project).map((o) => o.node.ref)),
  );
});
const cleanup: Array<() => void> = [];
afterEach(() =>
  cleanup
    .splice(0)
    .reverse()
    .forEach((fn) => fn()),
);
const fixture = () => structuredClone(base);
const error = (fn: () => unknown) => {
  try {
    fn();
  } catch (e) {
    expect(e).toBeInstanceOf(AppError);
    return e as AppError;
  }
  throw new Error("Expected refusal");
};
const definition = (source: PlayMechanismSource) =>
  source.project.motionRigs[source.rigId];

describe("source-bound reviewed rack contact admission", () => {
  it.each([false, true])(
    "refuses unbound Play constructors before allocating proxies (native %s)",
    (native) => {
      const source = fixture().sources[0],
        before = JSON.stringify(source.project),
        world = new RAPIER.World({ x: 0, y: 0, z: 0 }),
        mirror = new RAPIER.World({ x: 0, y: 0, z: 0 });
      cleanup.push(
        () => mirror.free(),
        () => world.free(),
      );
      const sentinel = world.createCollider(RAPIER.ColliderDesc.ball(0.1)),
        mirrorSentinel = mirror.createCollider(RAPIER.ColliderDesc.ball(0.1));
      const refusal = error(() =>
        native
          ? new DynamicRig(world, mirror, source, 0, source.project.revision)
          : new PlayMechanism(world, source, () => ({
              position: [300, -100, 300],
              walk: false,
            })),
      );
      expect(refusal.code).toBe("INVALID_INPUT");
      expect(refusal.message).toBe(GUIDED_RACK_PLAY_REFUSAL);
      expect(refusal.details).toMatchObject({
        contactStatus: "unsupported",
        feature: "18940-guided-rack",
        rigId: source.rigId,
        jointId: definition(source).joints[1].id,
      });
      expect(world.colliders.len()).toBe(1);
      expect(mirror.colliders.len()).toBe(1);
      expect(world.bodies.len()).toBe(0);
      expect(mirror.bodies.len()).toBe(0);
      expect(world.getCollider(sentinel.handle)).toBeTruthy();
      expect(mirror.getCollider(mirrorSentinel.handle)).toBeTruthy();
      expect(JSON.stringify(source.project)).toBe(before);
    },
  );

  it("also requires binding for a mobile carrier and an unmotorized guided slider", () => {
    const source = fixture().sources[0],
      rig = definition(source);
    rig.dynamics = { groups: { frame: { anchored: false } } };
    delete rig.transmissions;
    for (const joint of rig.joints) delete joint.motor;
    const before = JSON.stringify(source.project);
    expect(() => prepareMechanicalSources([source])).toThrow(
      GUIDED_RACK_PLAY_REFUSAL,
    );
    expect(JSON.stringify(source.project)).toBe(before);
  });

  it("checks unbound dynamic-world entry before allocation even with a supplied preparation map", () => {
    const source = fixture().sources[0],
      before = JSON.stringify(source.project),
      walking = new RAPIER.World({ x: 0, y: 0, z: 0 });
    cleanup.push(() => walking.free());
    walking.createCollider(RAPIER.ColliderDesc.ball(0.1));
    for (const prepared of [undefined, new Map()])
      expect(
        () =>
          new PlayDynamicsWorld(
            undefined,
            true,
            walking,
            [source],
            source.project.revision,
            prepared,
          ),
      ).toThrow(GUIDED_RACK_PLAY_REFUSAL);
    expect(walking.colliders.len()).toBe(1);
    expect(walking.bodies.len()).toBe(0);
    expect(JSON.stringify(source.project)).toBe(before);
  });

  it("admits only the captured source identities with both reviewed guide and rack bindings", async () => {
    const source = fixture().sources[0],
      before = JSON.stringify(source.project),
      contact = unsupportedMechanicalPlayContact(
        source.project,
        definition(source),
        source.lookup,
      )!;
    expect(
      reviewedMechanicalMember(source, contact.guideOccurrenceId),
    ).toBeUndefined();
    expect(
      reviewedMechanicalMember(source, contact.rackOccurrenceId),
    ).toBeUndefined();
    await loadReviewedMechanicalProxies([source]);
    expect(
      reviewedMechanicalMember(source, contact.guideOccurrenceId)?.childCount,
    ).toBe(927);
    expect(
      reviewedMechanicalMember(source, contact.rackOccurrenceId)?.childCount,
    ).toBe(1245);
    expect(() =>
      validatePlayMechanismSource(source, source.project.revision),
    ).not.toThrow();
    const prepared = prepareMechanicalSources([source]).get(source.rigId)!;
    expect(prepared).toBeDefined();
    expect(
      [...prepared.solids, ...prepared.stationary]
        .filter((s) => s.memberId === contact.guideOccurrenceId)
        .reduce((n, s) => n + s.childCount, 0),
    ).toBe(927);
    expect(() =>
      validatePlayMechanismSource({ ...source }, source.project.revision),
    ).toThrow(GUIDED_RACK_PLAY_REFUSAL);
    expect(JSON.stringify(source.project)).toBe(before);
  }, 15000);

  it("keeps source revision and complete-geometry errors ahead of the contact refusal", () => {
    const source = fixture().sources[0];
    expect(
      error(() =>
        validatePlayMechanismSource(source, source.project.revision + 1),
      ).code,
    ).toBe("REVISION_CONFLICT");
    delete source.members![definition(source).groups[2].occurrenceIds[0]];
    const refusal = error(() =>
      validatePlayMechanismSource(source, source.project.revision),
    );
    expect(refusal.message).toMatch(/complete geometry/);
    expect(refusal.details).toBeUndefined();
  });

  it("enforces the existing triangle budget before checking contact support", () => {
    const source = fixture().sources[0],
      before = JSON.stringify(source.project);
    source.groups.frame.indices = new Uint32Array(200001 * 3);
    const refusal = error(() =>
      validatePlayMechanismSource(source, source.project.revision),
    );
    expect(refusal.code).toBe("LIMIT_EXCEEDED");
    expect(refusal.message).toMatch(/200,000 triangles/);
    expect(JSON.stringify(source.project)).toBe(before);
  });

  it("enforces the aggregate source budget before preparing the refused assembly", () => {
    const source = fixture().sources[0],
      before = JSON.stringify(source.project),
      id = definition(source).groups[0].occurrenceIds[0];
    source.members![id].vertices = new Float32Array(600001 * 3);
    const refusal = error(() => prepareMechanicalSources([source]));
    expect(refusal.code).toBe("LIMIT_EXCEEDED");
    expect(refusal.message).toMatch(/source vertex budget/);
    expect(JSON.stringify(source.project)).toBe(before);
  });

  it("recognizes the source alignment and tree mount rather than banning part references", () => {
    const source = fixture().sources[0],
      rig = definition(source),
      lookup = new Map(occurrences(source.project).map((o) => [o.id, o])),
      unsupported = unsupportedMechanicalPlayContact(
        source.project,
        rig,
        lookup,
      )!;
    expect(lookup.get(unsupported.guideOccurrenceId)?.node.ref).toBe(
      "18940.dat",
    );
    expect(lookup.get(unsupported.rackOccurrenceId)?.node.ref).toBe(
      "18942.dat",
    );
    const unrelated = structuredClone(rig);
    unrelated.groups[0].occurrenceIds =
      unrelated.groups[0].occurrenceIds.filter(
        (id) => id !== unsupported.guideOccurrenceId,
      );
    expect(
      unsupportedMechanicalPlayContact(source.project, unrelated, lookup),
    ).toBeUndefined();
    const misplaced = structuredClone(lookup);
    misplaced.get(unsupported.rackOccurrenceId)!.transform.position[1] += 2;
    expect(
      unsupportedMechanicalPlayContact(source.project, rig, misplaced),
    ).toBeUndefined();
  });

  it("bounds source-pair inspection instead of searching an unchecked product", () => {
    const source = fixture().sources[0],
      rig = structuredClone(definition(source)),
      lookup = new Map(occurrences(source.project).map((o) => [o.id, o])),
      ids = unsupportedMechanicalPlayContact(source.project, rig, lookup)!;
    const guide = lookup.get(ids.guideOccurrenceId)!,
      rack = lookup.get(ids.rackOccurrenceId)!;
    rig.groups[0].occurrenceIds = [];
    rig.groups[2].occurrenceIds = [];
    for (let i = 0; i < 65; i++) {
      const a = structuredClone(guide),
        b = structuredClone(rack);
      a.id = `guide-${i}`;
      b.id = `rack-${i}`;
      b.transform.position[1] += 100;
      lookup.set(a.id, a);
      lookup.set(b.id, b);
      rig.groups[0].occurrenceIds.push(a.id);
      rig.groups[2].occurrenceIds.push(b.id);
    }
    const before = JSON.stringify(source.project),
      refusal = error(() =>
        unsupportedMechanicalPlayContact(source.project, rig, lookup),
      );
    expect(refusal.code).toBe("LIMIT_EXCEEDED");
    expect(refusal.details).toEqual({
      limit: "mechanicalPlaySupport",
      maximum: 4096,
    });
    expect(JSON.stringify(source.project)).toBe(before);
  });

  it("preserves mathematical preview, proposal warnings, posed export and native save", async () => {
    const { project, proposal } = rackFixture(),
      before = JSON.stringify(project),
      original = exportLDraw(project);
    expect(proposal.warnings).toContain(GUIDED_RACK_PROXY_WARNING);
    expect(proposal.warnings).not.toContain(GUIDED_RACK_PLAY_REFUSAL);
    const session = new KinematicSession(project, "rack-drive"),
      forward = session.setJointPosition("joint-0", 150);
    expect(forward.pose.jointPositions["joint-1"]).toBeCloseTo(
      -25 * Math.PI,
      10,
    );
    expect(posedLDraw(project, forward.transforms).text).not.toBe(original);
    const reverse = session.setJointPosition("joint-1", 8);
    expect(reverse.pose.jointPositions["joint-0"]).toBeCloseTo(
      -48 / Math.PI,
      10,
    );
    const restored = await decodeNative(await encodeNative(project));
    expect(restored.motionRigs).toEqual(project.motionRigs);
    expect(exportLDraw(restored)).toBe(original);
    expect(JSON.stringify(project)).toBe(before);
    const draftSource = structuredClone(project);
    draftSource.motionRigs = {};
    const draftBefore = JSON.stringify(draftSource),
      draft = previewMechanicalProposal(draftSource, proposal);
    expect(
      draft.setJointPosition("joint-0", 150).pose.jointPositions["joint-1"],
    ).toBeCloseTo(-25 * Math.PI, 10);
    expect(JSON.stringify(draftSource)).toBe(draftBefore);
  });

  it("rejects changed canonical geometry without poisoning another live session or its disposal", async () => {
    const project = mechanismFixture(),
      ordinary = await playSources(project, ["door"]),
      active = await PlaySession.create(
        ordinary.geometry,
        { rigId: "door", position: [300, -0.3, 300] },
        ordinary.sources[0],
      );
    cleanup.push(() => active.dispose());
    const { geometry, sources } = fixture(),
      before = JSON.stringify(sources[0].project),
      tick = active.snapshot().tick;
    const contact = unsupportedMechanicalPlayContact(
        sources[0].project,
        definition(sources[0]),
        sources[0].lookup,
      )!,
      local = sources[0].memberLocals![contact.rackOccurrenceId],
      vertices = local.vertices.slice(),
      interior = vertices.findIndex(
        (n, i) =>
          n > local.bounds.min[i % 3] + 1 && n < local.bounds.max[i % 3] - 1,
      );
    expect(interior).toBeGreaterThanOrEqual(0);
    vertices[interior] += 0.001;
    sources[0].memberLocals![contact.rackOccurrenceId] = { ...local, vertices };
    for (const dynamic of [false, true])
      await expect(
        PlaySession.create(
          geometry,
          {
            rigId: "rack-drive",
            ...(dynamic ? { dynamicRigIds: ["rack-drive"] } : {}),
          },
          sources,
        ),
      ).rejects.toThrow(/matching reviewed geometry/);
    active.stepTicks(3);
    expect(active.snapshot().tick).toBe(tick + 3);
    expect(active.snapshot().sourceRevision).toBe(project.revision);
    expect(JSON.stringify(sources[0].project)).toBe(before);
  });
});
