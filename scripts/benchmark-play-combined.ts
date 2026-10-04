/** Read-only admission and live-session probe: two spur assemblies sharing
 * one anchored frame advance; a third exceeds the shared convex-child cap.
 * Run: npx tsx scripts/benchmark-play-combined.ts. These are VM diagnostics,
 * including actor/ground and native gravity, rather than a phone FPS claim. */
import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import { cpus, loadavg } from "node:os";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import type RAPIER from "@dimforge/rapier3d-compat";
import { technicFixture } from "../src/mechanisms/technic-fixture";
import {
  fullLibrarySources,
  registerFullLibraryFromDisk,
} from "./full-library-node";
import { occurrences } from "../src/core/document";
import { playSources } from "../tests/helpers/play-dynamic-source";
import { PlaySession } from "../src/play/session";
registerFullLibraryFromDisk();
const sourceFiles = [
  "src/play/session.ts",
  "src/play/dynamics.ts",
  "src/play/mechanism.ts",
  "src/play/mechanical-solids.ts",
  "src/mechanisms/technic-fixture.ts",
];
const hashes = () =>
  Object.fromEntries(
    sourceFiles.map((p) => [
      p,
      createHash("sha256")
        .update(readFileSync(new URL("../" + p, import.meta.url)))
        .digest("hex"),
    ]),
  );
const initialHashes = hashes();
console.log(
  JSON.stringify({
    type: "metadata",
    node: process.version,
    cpu: cpus()[0]?.model,
    load: loadavg(),
    hashes: initialHashes,
    massKg: 1,
    warmup: 30,
    samples: 60,
  }),
);
function combined(copies: number) {
  const { project, proposal } = technicFixture();
  const rig = proposal.rig!;
  const root = project.models[project.rootModelId],
    nodes = structuredClone(root.nodes),
    records = structuredClone(root.records),
    base = structuredClone(rig);
  const fixed = rig.groups.find((g) => g.id === "frame")!;
  for (let c = 1; c < copies; c++) {
    const dx = c * 400,
      mapNode = (id: string) => `${id}-copy${c}`,
      mapOcc = (id: string) =>
        JSON.stringify((JSON.parse(id) as string[]).map(mapNode)),
      mapGroup = (id: string) => (id === "frame" ? id : `copy${c}:${id}`),
      mapJoint = (id: string) => `copy${c}:${id}`;
    for (const n of nodes) {
      const x = structuredClone(n);
      x.id = mapNode(n.id);
      x.transform.position[0] += dx;
      root.nodes.push(x);
    }
    for (const r of records)
      if (r.nodeId)
        root.records.push({ ...structuredClone(r), nodeId: mapNode(r.nodeId) });
    for (const g of base.groups) {
      const x = structuredClone(g);
      x.id = mapGroup(g.id);
      x.frame.position[0] += dx;
      x.occurrenceIds = g.occurrenceIds.map(mapOcc);
      x.restTransforms = Object.fromEntries(
        Object.entries(g.restTransforms).map(([id, t]) => {
          const v = structuredClone(t);
          v.position[0] += dx;
          return [mapOcc(id), v];
        }),
      );
      if (g.id === "frame") {
        fixed.occurrenceIds.push(...x.occurrenceIds);
        Object.assign(fixed.restTransforms, x.restTransforms);
      } else rig.groups.push(x);
    }
    for (const j of base.joints) {
      const x = structuredClone(j);
      x.id = mapJoint(j.id);
      x.bodyA = mapGroup(j.bodyA);
      x.bodyB = mapGroup(j.bodyB);
      if (j.bodyA === "frame") x.anchorA[0] += dx;
      if (j.bodyB === "frame") x.anchorB[0] += dx;
      rig.joints.push(x);
    }
    for (const t of base.transmissions ?? [])
      rig.transmissions!.push({
        ...structuredClone(t),
        id: `copy${c}:${t.id}`,
        jointA: mapJoint(t.jointA),
        jointB: mapJoint(t.jointB),
      });
  }
  rig.dynamics = {
    groups: Object.fromEntries(
      rig.groups
        .filter((g) => g.id !== "frame")
        .map((g) => [g.id, { massKg: 1 }]),
    ),
  };
  return { project, rig };
}
for (const copies of [2, 3]) {
  const { project, rig } = combined(copies),
    before = JSON.stringify(project),
    all = occurrences(project),
    start = performance.now();
  const prepared = await playSources(
    project,
    [rig.id],
    fullLibrarySources(all.map((o) => o.node.ref)),
  );
  console.log(
    JSON.stringify({
      copies,
      parts: all.length,
      groups: rig.groups.length,
      compileMs: performance.now() - start,
    }),
  );
  for (const dynamic of [false, true]) {
    const t = performance.now();
    let play: PlaySession | undefined;
    try {
      play = await PlaySession.create(
        prepared.geometry,
        {
          rigId: rig.id,
          ...(dynamic ? { dynamicRigIds: [rig.id] } : {}),
          position: [1200, -0.3, 300],
        },
        prepared.sources,
      );
      assert.equal(
        copies,
        2,
        "Third compound drive should exceed the global child budget",
      );
      const entryMs = performance.now() - t;
      play.stepTicks(30);
      const times = [];
      for (let i = 0; i < 60; i++) {
        const a = performance.now();
        play.stepTicks(1);
        times.push(performance.now() - a);
      }
      const r = play.snapshot().mechanism!;
      for (const x of rig.transmissions!) {
        const a = r.pose.jointPositions[x.jointA],
          b = r.pose.jointPositions[x.jointB];
        assert(a > 90);
        assert(Math.abs(b + a / 3) < 1);
      }
      assert.equal(r.blocked, false);
      assert.equal(JSON.stringify(project), before);
      const internal = play as unknown as {
        world: RAPIER.World;
        dynamics?: { world: RAPIER.World };
      };
      const world = dynamic ? internal.dynamics!.world : internal.world;
      console.log(
        JSON.stringify({
          copies,
          dynamic,
          entryMs,
          meanMs: times.reduce((a, b) => a + b, 0) / times.length,
          p95Ms: [...times].sort((a, b) => a - b)[57],
          worldColliders: world.colliders.len(),
          load: loadavg(),
          positions: r.pose.jointPositions,
          motors: r.motors,
          sourceUnchanged: true,
        }),
      );
    } catch (e) {
      if (copies === 2) throw e;
      assert.match(
        (e as Error).message,
        /^Mechanical contact proxy budget exceeds 4,096 solids$/,
      );
      assert.equal(JSON.stringify(project), before);
      console.log(
        JSON.stringify({
          copies,
          dynamic,
          refused: (e as Error).message,
          sourceUnchanged: true,
        }),
      );
    } finally {
      play?.dispose();
    }
  }
}
assert.deepEqual(hashes(), initialHashes, "Source changed during the probe");
console.log(
  JSON.stringify({ type: "final", hashes: hashes(), load: loadavg() }),
);
