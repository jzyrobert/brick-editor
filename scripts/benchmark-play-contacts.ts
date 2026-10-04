/** Read-only native/contact cost probe. Run after the contact implementation is
 * integrated; JSONL includes hashes, prescribed masses and actual motion. */
import RAPIER from "@dimforge/rapier3d-compat";
import { performance } from "node:perf_hooks";
import { cpus, loadavg } from "node:os";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { DynamicRig } from "../src/play/dynamics";
import { PlayMechanism } from "../src/play/mechanism";
import { anchoredGroup } from "../src/mechanisms/dynamics-settings";
import { occurrences } from "../src/core/document";
import {
  registerFullLibraryFromDisk,
  fullLibrarySources,
} from "./full-library-node";
import { playSources } from "../tests/helpers/play-dynamic-source";
import type { Project } from "../src/core/types";

const root = fileURLToPath(new URL("..", import.meta.url));
const args = Object.fromEntries(
  process.argv.slice(2).map((arg) => {
    const [key, value = "true"] = arg.replace(/^--/, "").split("=");
    return [key, value];
  }),
);
const fixture = args.fixture ?? "spur",
  mode = args.mode ?? "dynamic";
if (
  !["spur", "rack"].includes(fixture) ||
  !["dynamic", "kinematic", "both"].includes(mode)
)
  throw new Error("Use --fixture=spur|rack and --mode=dynamic|kinematic|both");
const bounded = (key: string, fallback: number, min: number, max: number) => {
  const n = Number(args[key] ?? fallback);
  if (!Number.isInteger(n) || n < min || n > max)
    throw new Error(`Invalid --${key} (${min}..${max})`);
  return n;
};
const rounds = bounded("rounds", 2, 1, 5),
  ticks = bounded("ticks", 150, 1, 1200),
  warmup = bounded("warmup", 30, 0, 120);
const massKg = Number(args["mass-kg"] ?? 1);
if (!Number.isFinite(massKg) || massKg < 0.001 || massKg > 100000)
  throw new Error("Invalid --mass-kg");
const files = [
  "src/play/dynamics.ts",
  "src/play/mechanism.ts",
  "src/play/mechanical-solids.ts",
  "src/play/surface-compound.ts",
  `src/mechanisms/${fixture === "spur" ? "technic" : "rack"}-fixture.ts`,
];
const hashes = () =>
  Object.fromEntries(
    files.map((name) => {
      try {
        return [
          name,
          createHash("sha256")
            .update(readFileSync(resolve(root, name)))
            .digest("hex"),
        ];
      } catch {
        return [name, "absent"];
      }
    }),
  );
const stats = (values: number[]) => {
  const ordered = [...values].sort((a, b) => a - b);
  return {
    samples: values.length,
    mean: values.reduce((a, b) => a + b, 0) / values.length,
    p50: ordered[Math.floor(0.5 * ordered.length)],
    p95: ordered[Math.floor(0.95 * ordered.length)],
    max: ordered.at(-1),
  };
};
let Baseline: typeof DynamicRig | undefined;
if (args.baseline) {
  if (!/^[a-f0-9]{7,40}$/.test(args.baseline))
    throw new Error("--baseline requires a commit hash");
  let text = execFileSync(
    "git",
    ["show", `${args.baseline}:src/play/dynamics.ts`],
    { cwd: root, encoding: "utf8" },
  );
  text = text.replace(
    /(["'])(\.{1,2}\/[^"']+)\1/g,
    (_match, quote, relative) =>
      quote + resolve(root, "src/play", relative) + quote,
  );
  mkdirSync(resolve(root, ".local"), { recursive: true });
  const name = resolve(
    root,
    `.local/contact-benchmark-baseline-${args.baseline}.ts`,
  );
  writeFileSync(name, text);
  Baseline = (await import(pathToFileURL(name).href)).DynamicRig;
}
await RAPIER.init();
registerFullLibraryFromDisk();
const versionStart = hashes(),
  start = performance.now();
const fixtureModule = await import(
  pathToFileURL(
    resolve(
      root,
      `src/mechanisms/${fixture === "spur" ? "technic" : "rack"}-fixture.ts`,
    ),
  ).href
);
const { project }: { project: Project } = (
  fixture === "spur" ? fixtureModule.technicFixture : fixtureModule.rackFixture
)();
const rigId = Object.keys(project.motionRigs)[0],
  definition = project.motionRigs[rigId],
  all = occurrences(project);
definition.dynamics ??= {};
definition.dynamics.groups ??= {};
for (const group of definition.groups)
  if (!anchoredGroup(definition, group.id))
    definition.dynamics.groups[group.id] = {
      ...definition.dynamics.groups[group.id],
      massKg,
    };
const { sources } = await playSources(
  project,
  [rigId],
  fullLibrarySources(all.map((o) => o.node.ref)),
);
console.log(
  JSON.stringify({
    type: "metadata",
    fixture,
    mode,
    node: process.version,
    engine: RAPIER.version(),
    arch: process.arch,
    cpu: cpus()[0]?.model,
    cpuCount: cpus().length,
    load: loadavg(),
    hashes: versionStart,
    baseline: args.baseline,
    geometryMs: performance.now() - start,
    placements: all.length,
    groups: definition.groups.length,
    movingMembers: definition.groups
      .filter((g) => !anchoredGroup(definition, g.id))
      .reduce((n, g) => n + g.occurrenceIds.length, 0),
    sourceTriangles: Object.values(sources[0].groups).reduce(
      (n, mesh) => n + mesh.indices.length / 3,
      0,
    ),
    massKg,
    disableCcd: args["disable-ccd"] === "true",
  }),
);

for (let round = 0; round < rounds; round++) {
  const variants: Array<{ label: string; Dynamic: typeof DynamicRig }> = [
    { label: "current", Dynamic: DynamicRig },
  ];
  if (Baseline) variants.push({ label: "historical-hull", Dynamic: Baseline });
  if (round % 2) variants.reverse();
  if (mode !== "kinematic")
    for (const { label, Dynamic } of variants) {
      const world = new RAPIER.World({ x: 0, y: 0, z: 0 }),
        mirror = new RAPIER.World({ x: 0, y: 0, z: 0 });
      world.timestep = 1 / 60;
      if (args["disable-ccd"] === "true")
        world.integrationParameters.maxCcdSubsteps = 0;
      let rig: DynamicRig | undefined, queue: RAPIER.EventQueue | undefined;
      try {
        const t = performance.now();
        rig = new Dynamic(world, mirror, sources[0], 0, project.revision);
        const entryMs = performance.now() - t;
        // Optional diagnostics support old and new adapters without changing either.
        const internal = rig as unknown as {
          physicsHooks?: RAPIER.PhysicsHooks;
          contactSolids?: Map<
            number,
            { childCount?: number; memberId?: string; shape?: RAPIER.Shape }
          >;
        };
        let hookCalls = 0,
          hookRejects = 0;
        if (internal.physicsHooks) {
          const original = internal.physicsHooks.filterContactPair;
          internal.physicsHooks.filterContactPair = (a, b, ...rest) => {
            hookCalls++;
            const result = original(a, b, ...rest);
            if (result === null) hookRejects++;
            return result;
          };
          queue = new RAPIER.EventQueue(false);
        }
        let firstTickMs = 0;
        const total: number[] = [],
          native: number[] = [],
          before: number[] = [],
          after: number[] = [];
        for (let tick = 0; tick < warmup + ticks; tick++) {
          const a = performance.now();
          rig.beforeStep();
          const b = performance.now();
          world.step(queue, internal.physicsHooks);
          const c = performance.now();
          rig.afterStep();
          const d = performance.now();
          if (tick === 0) firstTickMs = d - a;
          if (tick >= warmup) {
            total.push(d - a);
            before.push(b - a);
            native.push(c - b);
            after.push(d - c);
          }
        }
        const report = rig.snapshot();
        console.log(
          JSON.stringify({
            type: "dynamic",
            fixture,
            label,
            round,
            entryMs,
            firstTickMs,
            nativeColliders: world.colliders.len(),
            mirrorColliders: mirror.colliders.len(),
            bodies: world.bodies.len(),
            children: internal.contactSolids
              ? [...internal.contactSolids.values()]
                  .filter((s) => s.shape)
                  .reduce((n, s) => n + (s.childCount ?? 1), 0)
              : undefined,
            hookCalls,
            hookRejects,
            totalMs: stats(total),
            nativeMs: stats(native),
            beforeMs: stats(before),
            afterMs: stats(after),
            masses: Object.fromEntries(
              Object.entries(report.dynamics!.bodies).map(([id, b]) => [
                id,
                b.massKg,
              ]),
            ),
            sleeping: Object.values(report.dynamics!.bodies).filter(
              (b) => b.sleeping,
            ).length,
            positions: report.pose.jointPositions,
            motors: report.motors,
            load: loadavg(),
          }),
        );
      } finally {
        rig?.dispose();
        queue?.free();
        world.free();
        mirror.free();
      }
    }
  if (mode !== "dynamic") {
    const world = new RAPIER.World({ x: 0, y: 0, z: 0 });
    let rig: PlayMechanism | undefined;
    try {
      const t = performance.now();
      rig = new PlayMechanism(world, sources[0], () => ({
        position: [10000, 0, 10000],
        walk: false,
      }));
      const entryMs = performance.now() - t;
      const total: number[] = [];
      let firstTickMs = 0;
      for (let tick = 0; tick < warmup + ticks; tick++) {
        const a = performance.now();
        rig.step();
        const elapsed = performance.now() - a;
        if (tick === 0) firstTickMs = elapsed;
        if (tick >= warmup) total.push(elapsed);
      }
      const internal = rig as unknown as {
        contactSolids?: Array<{ childCount?: number }>;
        stationarySolids?: unknown[];
      };
      const report = rig.snapshot();
      console.log(
        JSON.stringify({
          type: "kinematic",
          fixture,
          round,
          entryMs,
          firstTickMs,
          nativeColliders: world.colliders.len(),
          policyClasses: internal.contactSolids?.length,
          children: internal.contactSolids?.reduce(
            (n, s) => n + (s.childCount ?? 1),
            0,
          ),
          stationary: internal.stationarySolids?.length,
          totalMs: stats(total),
          positions: report.pose.jointPositions,
          motors: report.motors,
          load: loadavg(),
        }),
      );
    } finally {
      rig?.dispose();
      world.free();
    }
  }
}
console.log(
  JSON.stringify({
    type: "final",
    hashes: hashes(),
    load: loadavg(),
    note: "Shared Node VM probe; excludes rendering/actor/vehicles and is not a phone or cross-platform performance claim. Historical hull geometry, inertia, contact policy and controller version can differ despite equal prescribed mass.",
  }),
);
