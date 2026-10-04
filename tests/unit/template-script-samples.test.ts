/**
 * The build-script samples (market town, cathedral, harbour): compiled from
 * fixtures/build-scripts/, committed as fixtures/ldraw/templates/*.mpd, clean
 * by the template checks, and walkable in Play.
 */
import { beforeAll, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { template, TEMPLATE_BACKDROPS } from "../../src/catalog/templates";
import {
  SCRIPT_TEMPLATES,
  TOWN_HINT,
  type ScriptTemplateName,
} from "../../src/catalog/script-templates";
import { checkBuild } from "../../src/catalog/builds/check";
import { curatedHas } from "../../src/catalog/full-library";
import { occurrences } from "../../src/core/document";
import { partsList } from "../../src/inventory/parts-list";
import { modelHealth } from "../../src/core/health";
import { deriveDoorRigs } from "../../src/play/auto-doors";
import { deriveTrains, occurrenceBounds } from "../../src/play/trains";
import { PlaySession } from "../../src/play/session";
import {
  fullLibraryOccupancy,
  registerFullLibraryFromDisk,
} from "../../scripts/full-library-node";
import {
  compileScriptTemplate,
  registerScriptTemplatesFromDisk,
} from "../../scripts/script-templates-node";
import { officialMesh } from "../helpers/official-geometry";
import type { Project, Vec3 } from "../../src/core/types";
import type { CollisionSnapshot } from "../../src/play/types";
import type { DynamicRigSource } from "../../src/play/dynamics";

beforeAll(() => {
  expect(registerFullLibraryFromDisk()).toBe(true);
  expect(registerScriptTemplatesFromDisk().sort()).toEqual(
    ["cathedral", "harbour", "town"].sort(),
  );
});

/**
 * A Play session over part of a big build: the parts whose origins lie in
 * `box` (LDU) and the doors among them, opened towards their free side.
 */
async function playIn(
  project: Project,
  box: { min: Vec3; max: Vec3 },
  request: { position: Vec3; yaw: number },
) {
  const all = occurrences(project);
  const inside = all.filter((o) =>
    [0, 1, 2].every(
      (k) =>
        o.transform.position[k] >= box.min[k] &&
        o.transform.position[k] <= box.max[k],
    ),
  );
  const included = new Set(inside.map((o) => o.id));
  const derived = deriveDoorRigs(project, {
    all,
    included,
    reserved: new Set(),
    maxRigs: 32,
    maxGroups: 128,
  });
  const members = new Set(
    Object.values(derived.rigs).flatMap((rig) =>
      rig.groups.flatMap((g) => g.occurrenceIds),
    ),
  );
  const geometry: CollisionSnapshot = await officialMesh(
    project,
    inside.filter((o) => !members.has(o.id)).map((o) => o.id),
    box,
  );
  const withRigs = {
    ...project,
    motionRigs: { ...project.motionRigs, ...derived.rigs },
  };
  const sources: DynamicRigSource[] = [];
  for (const rig of Object.values(derived.rigs)) {
    const groups: DynamicRigSource["groups"] = {},
      memberMeshes: DynamicRigSource["members"] = {};
    for (const g of rig.groups) {
      groups[g.id] = await officialMesh(project, g.occurrenceIds);
      for (const id of g.occurrenceIds)
        memberMeshes[id] = await officialMesh(project, [id]);
    }
    sources.push({
      project: withRigs,
      rigId: rig.id,
      groups,
      members: memberMeshes,
    });
  }
  const session = await PlaySession.create(
    geometry,
    { ...request, rigIds: Object.keys(derived.rigs) },
    sources,
    derived,
  );
  for (const door of session.snapshot().autoDoors?.doors ?? []) {
    if (door.swing === "blocked") continue;
    const limits = derived.rigs[door.rigId].joints.find(
      (j) => j.id === door.jointId,
    )!.limits!;
    session.setJointTarget({
      rigId: door.rigId,
      jointId: door.jointId,
      target: door.swing === "negative" ? limits[0] : limits[1],
      speed: 180,
    });
  }
  session.stepTicks(40);
  return { session, derived };
}

const report = (project: Project) =>
  checkBuild(project, {
    occupancy: fullLibraryOccupancy(
      occurrences(project)
        .map((o) => o.node.ref)
        .filter((ref) => !curatedHas(ref)),
    ),
  });

describe("build-script samples", () => {
  for (const [name, title, min, max] of [
    ["town", "Market town", 4000, 25000],
    ["cathedral", "Cathedral", 8000, 60000],
    ["harbour", "Harbour", 5000, 60000],
  ] as const)
    it(
      `${name}: committed as compiled, on the grid, no overlaps, one connected build`,
      { timeout: 180000 },
      () => {
        const spec = SCRIPT_TEMPLATES[name as ScriptTemplateName];
        expect(
          readFileSync("fixtures/ldraw/templates/" + spec.file, "utf8"),
        ).toBe(compileScriptTemplate(name));
        const project = template(name);
        expect(project.title).toBe(title);
        expect(project.scene?.backdrop).toBe(TEMPLATE_BACKDROPS[name]);
        // Its sections are layers.
        expect(Object.values(project.layers).length).toBeGreaterThan(2);
        const r = report(project);
        expect(r.parts).toBeGreaterThan(min);
        expect(r.parts).toBeLessThan(max);
        expect(r.overlaps).toEqual([]);
        expect(r.offGrid).toEqual([]);
        expect(r.groups).toBe(1);
        const health = Object.fromEntries(
          modelHealth(project).checks.map((c) => [c.id, c.status]),
        );
        expect(health["missing-definitions"]).toBe("ok");
        expect(health.connectivity).toBe("ok");
      },
    );

  it(
    "town: through the town hall door; the train runs round the oval",
    { timeout: 300000 },
    async () => {
      const project = template("town");
      expect(project.scene?.playHint).toBe(TOWN_HINT);
      const d = deriveTrains({
        all: occurrences(project),
        reserved: new Set(),
        bounds: occurrenceBounds(project),
      });
      expect(d.graph.pieces).toHaveLength(24);
      expect(d.graph.gaps).toEqual([]);
      expect(d.graph.deadEnds).toHaveLength(0);
      expect(d.trains).toHaveLength(1);
      expect(d.trains[0].cars.map((c) => c.locomotive)).toEqual([true, false]);
      // The hall's door is at x -40..40 on its front wall (z -300).
      const { session, derived } = await playIn(
        project,
        { min: [-260, -400, -420], max: [260, 10, 0] },
        { position: [0, -8.3, -380], yaw: Math.PI },
      );
      try {
        expect(derived.doors.length).toBeGreaterThan(0);
        session.setInput({ moveZ: 1, yaw: Math.PI });
        session.stepTicks(150);
        const inside = session.snapshot().position;
        expect(inside[2]).toBeGreaterThan(-260);
      } finally {
        session.dispose();
      }
    },
  );

  it(
    "town: over the footbridge from the fields, across the track and into the town",
    { timeout: 300000 },
    async () => {
      const project = template("town");
      // Stairs up along +x at z -47..-46 (x 9..25), a deck at level 34 across
      // the track (x 25..28, z -47..-31), stairs down along +x (x 28..44).
      const { session } = await playIn(
        project,
        { min: [120, -400, -980], max: [960, 10, -560] },
        { position: [160, -0.3, -930], yaw: Math.PI / 2 },
      );
      try {
        session.setInput({ moveZ: 1, yaw: Math.PI / 2 });
        session.stepTicks(150);
        let p = session.snapshot().position;
        // On the deck (x 500..580).
        expect(p[0]).toBeGreaterThan(500);
        expect(p[0]).toBeLessThan(580);
        expect(p[1]).toBeLessThan(-260);
        // Along the deck over the rails.
        session.setInput({ moveZ: 1, yaw: Math.PI });
        for (let i = 0; i < 40 && session.snapshot().position[2] < -625; i++)
          session.stepTicks(5);
        p = session.snapshot().position;
        expect(p[2]).toBeGreaterThan(-640);
        expect(p[1]).toBeLessThan(-260);
        // Down the far stairs (z -640..-600) onto the grass inside the oval.
        session.setInput({ moveZ: 1, yaw: Math.PI / 2 });
        session.stepTicks(300);
        p = session.snapshot().position;
        expect(p[0]).toBeGreaterThan(880);
        expect(p[1]).toBeGreaterThan(-20);
      } finally {
        session.dispose();
      }
    },
  );

  it(
    "cathedral: in at the west door and up the stairs to the organ gallery",
    { timeout: 300000 },
    async () => {
      const project = template("cathedral"),
        before = JSON.stringify(project),
        inventory = partsList(project, occurrences(project));
      const { session } = await playIn(
        project,
        { min: [-260, -400, -960], max: [260, 10, -200] },
        { position: [0, -8.3, -900], yaw: Math.PI },
      );
      try {
        session.setInput({ moveZ: 1, yaw: Math.PI });
        session.stepTicks(200);
        // Past the west wall (z -780) into the nave.
        expect(session.snapshot().position[2]).toBeGreaterThan(-740);
        // From the foot of the stairs (x -220..-180, z -300), climb towards -z.
        session.teleport({ position: [-200, -16.3, -270], yaw: 0 });
        session.setInput({ moveZ: 1, yaw: 0 });
        session.stepTicks(300);
        const up = session.snapshot().position;
        expect(up[2]).toBeLessThan(-600);
        // On the gallery (level 31: y -248).
        expect(up[1]).toBeLessThan(-240);
        expect(JSON.stringify(project)).toBe(before);
        expect(partsList(project, occurrences(project))).toEqual(inventory);
      } finally {
        session.dispose();
      }
    },
  );

  it(
    "harbour: up the steps from the water onto the quay",
    { timeout: 300000 },
    async () => {
      const project = template("harbour");
      // Steps rise a plate at a time from z -11 to -7 (x -4..-1) up to the
      // quay six plates above the sea.
      const { session } = await playIn(
        project,
        { min: [-240, -300, -420], max: [140, 10, -20] },
        { position: [-50, -0.3, -300], yaw: Math.PI },
      );
      try {
        session.setInput({ moveZ: 1, yaw: Math.PI });
        session.stepTicks(90);
        // On the quay (z > -120), six plates up.
        const p = session.snapshot().position;
        expect(p[2]).toBeGreaterThan(-120);
        expect(p[1]).toBeLessThan(-46);
      } finally {
        session.dispose();
      }
    },
  );

  it(
    "harbour: along the quay and in through a warehouse door",
    { timeout: 300000 },
    async () => {
      const project = template("harbour");
      // The first warehouse's door: x 120..200 on its front wall (z -40),
      // off the quay 6 plates up (y -48).
      const { session, derived } = await playIn(
        project,
        { min: [-100, -300, -260], max: [440, 10, 200] },
        { position: [160, -48.3, -100], yaw: Math.PI },
      );
      try {
        expect(derived.doors.length).toBeGreaterThan(0);
        session.setInput({ moveZ: 1, yaw: Math.PI });
        session.stepTicks(150);
        const p = session.snapshot().position;
        expect(p[2]).toBeGreaterThan(0);
        expect(p[1]).toBeLessThan(-40);
      } finally {
        session.dispose();
      }
    },
  );
});
