import { beforeAll, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { template } from "../../src/catalog/templates";
import { houseSource } from "../../src/catalog/builds/house";
import { castleSource } from "../../src/catalog/builds/castle";
import { carSource, AXLES } from "../../src/catalog/builds/car";
import { bond, joints } from "../../src/catalog/builds/kit";
import { checkBuild } from "../../src/catalog/builds/check";
import {
  TEMPLATE_CARDS,
  TEMPLATE_NAMES,
} from "../../src/catalog/template-names";
import { curatedHas } from "../../src/catalog/full-library";
import { occurrences } from "../../src/core/document";
import { modelHealth } from "../../src/core/health";
import { KinematicSession, validateRig } from "../../src/mechanisms/kinematic";
import { deriveDoorRigs } from "../../src/play/auto-doors";
import { PlaySession } from "../../src/play/session";
import { CHARACTER_PROFILE } from "../../src/play/types";
import { validate } from "../../src/core/validate";
import {
  fullLibraryOccupancy,
  registerFullLibraryFromDisk,
} from "../../scripts/full-library-node";
import { officialSources } from "../helpers/official-geometry";
import type { Project } from "../../src/core/types";

beforeAll(() => {
  expect(registerFullLibraryFromDisk()).toBe(true);
});

const report = (project: Project, baseY = 0) =>
  checkBuild(project, {
    baseY,
    occupancy: fullLibraryOccupancy(
      occurrences(project)
        .map((o) => o.node.ref)
        .filter((ref) => !curatedHas(ref)),
    ),
  });
const outside = (project: Project) =>
  [
    ...new Set(
      occurrences(project)
        .map((o) => o.node.ref)
        .filter((ref) => !curatedHas(ref)),
    ),
  ].sort();

describe("template builds", () => {
  it("are committed exactly as generated and offered in the chooser and API", () => {
    for (const [file, source] of [
      ["house-with-garden.mpd", houseSource],
      ["small-castle.mpd", castleSource],
      ["roadster.mpd", carSource],
    ] as const)
      expect(
        readFileSync("fixtures/ldraw/templates/" + file, "utf8"),
        file,
      ).toBe(source());
    for (const name of ["house", "castle", "car"] as const) {
      expect(TEMPLATE_NAMES).toContain(name);
      expect(TEMPLATE_CARDS.map((c) => c.name)).toContain(name);
      validate("importRequest", { format: "template", template: name });
    }
    // Every chooser card except the blank canvas has a rendered preview.
    for (const card of TEMPLATE_CARDS)
      if (card.name !== "blank")
        expect(
          readFileSync(`public/templates/${card.name}.webp`)
            .subarray(8, 12)
            .toString(),
        ).toBe("WEBP");
  });

  it("house: grid-placed catalogue parts, no overlaps, one connected build", () => {
    const project = template("house");
    expect(project.title).toBe("House with garden");
    const r = report(project);
    expect(r.parts).toBe(281);
    expect(outside(project)).toEqual([]);
    expect(r.overlaps).toEqual([]);
    expect(r.offGrid).toEqual([]);
    expect(r.groups).toBe(1);
    expect(r.hingeContacts).toBe(2); // the door's two pins in its frame
    expect(r.refs["60596.dat"]).toBe(1);
    expect(r.refs["60616a.dat"]).toBe(1);
    // Glazed windows: every frame has its glass.
    expect(r.refs["60602.dat"]).toBe(r.refs["60593.dat"]);
    expect(r.refs["60601.dat"]).toBe(r.refs["60592.dat"]);
    // The roof: 45° slopes, a ridge and a chimney.
    expect(r.refs["3043.dat"]).toBe(8);
    expect(r.refs["3037.dat"]).toBeGreaterThan(20);
    const health = Object.fromEntries(
      modelHealth(project).checks.map((c) => [c.id, c]),
    );
    expect(health["missing-definitions"].status).toBe("ok");
    expect(health.collisions.status).toBe("ok");
    expect(health.connectivity.status).toBe("ok");
    expect(health.assemblies.status).toBe("ok");
  });

  it("house: the door fits the Play figure and Play hinges it in its frame", () => {
    // Door Frame 1 × 4 × 6 opening: posts at x ±34, sill top 136, lintel 8.
    expect(2 * CHARACTER_PROFILE.radius).toBeLessThan(68);
    expect(CHARACTER_PROFILE.height).toBeLessThan(128);
    const project = template("house");
    const derived = deriveDoorRigs(project, {
      all: occurrences(project),
      reserved: new Set(),
      maxRigs: 32,
      maxGroups: 128,
    });
    expect(derived.skipped).toEqual([]);
    expect(derived.doors).toHaveLength(1);
    const all = occurrences(project);
    expect(
      all.find((o) => o.id === derived.doors[0].anchorOccurrenceId)!.node.ref,
    ).toBe("60596.dat");
  });

  it(
    "house: the explorer walks up the path, opens the door and goes inside",
    { timeout: 120000 },
    async () => {
      const project = template("house");
      const derived = deriveDoorRigs(project, {
        all: occurrences(project),
        reserved: new Set(),
        maxRigs: 32,
        maxGroups: 128,
      });
      const { geometry, sources } = await officialSources(
        project,
        derived.rigs,
        { min: [-330, -460, -330], max: [330, 0, 330] },
      );
      const play = await PlaySession.create(
        geometry,
        {
          rigIds: Object.keys(derived.rigs),
          position: [-40, -0.3, -290],
          yaw: Math.PI,
        },
        sources,
        derived,
      );
      const door = play.snapshot().autoDoors!.doors[0];
      expect(door.swing).not.toBe("blocked");
      play.setJointTarget({
        rigId: door.rigId,
        jointId: door.jointId,
        target: door.swing === "negative" ? -90 : 90,
        speed: 120,
      });
      play.setInput({ moveZ: 1, yaw: Math.PI });
      play.stepTicks(360);
      const inside = play.snapshot().position;
      // Past the front wall (z = −40..−20) and on the floor plates (y = −8).
      expect(inside[2]).toBeGreaterThan(0);
      expect(inside[1]).toBeLessThan(-7);
      expect(inside[1]).toBeGreaterThan(-16);
      play.dispose();
    },
  );

  it("castle: grid-placed parts, no overlaps, one connected build, catalogue flags", () => {
    const project = template("castle");
    expect(project.title).toBe("Small castle");
    const r = report(project);
    expect(r.parts).toBe(235);
    // The flag 2335 joined the catalogue (release catalogue-2026-09-29).
    expect(outside(project)).toEqual([]);
    expect(r.overlaps).toEqual([]);
    expect(r.offGrid).toEqual([]);
    expect(r.groups).toBe(1);
    expect(r.refs["87081.dat"]).toBe(4 * 7 + 1); // towers and the well
    expect(r.refs["3307.dat"]).toBe(1); // the gate arch
  });

  it("castle: the drawbridge rig raises the bridge in front of the gate", () => {
    const project = template("castle");
    const rig = project.motionRigs.drawbridge;
    validateRig(project, rig);
    const session = new KinematicSession(project, "drawbridge");
    const bridgeId = rig.groups.find((g) => g.id === "bridge")!
      .occurrenceIds[0];
    session.setJointPosition("hinge", 85);
    const raised = session.snapshot().transforms[bridgeId];
    // The 4 × 6 plate (its centre 70 LDU from the hinge) stands up just in
    // front of the wall face (z = −180), closing the gateway.
    expect(raised.position[1]).toBeLessThan(-50);
    expect(raised.position[2]).toBeLessThan(-180);
    expect(raised.position[2]).toBeGreaterThan(-200);
  });

  it(
    "castle: plate-high steps carry the explorer up to the wall walk",
    { timeout: 120000 },
    async () => {
      const project = template("castle");
      const { geometry, sources } = await officialSources(
        project,
        {},
        {
          min: [-330, -340, -330],
          max: [330, 0, 330],
        },
      );
      // Each step rises one plate: the Play figure's step height.
      expect(CHARACTER_PROFILE.stepHeight).toBeGreaterThanOrEqual(8);
      const play = await PlaySession.create(geometry, {
        position: [-160, -0.3, -128],
        yaw: Math.PI,
      });
      // Up the stairs along +Z to the top step (level 16 = y −128)…
      play.setInput({ moveZ: 1, yaw: Math.PI });
      play.stepTicks(190);
      const top = play.snapshot().position;
      expect(top[1]).toBeLessThan(-124);
      expect(top[2]).toBeGreaterThan(170);
      // …across onto the tiled wall walk (x −200..−180)…
      play.setInput({ moveZ: 1, yaw: -Math.PI / 2 });
      play.stepTicks(20);
      // …and along it towards the gate side.
      play.setInput({ moveZ: 1, yaw: 0 });
      play.stepTicks(120);
      const walk = play.snapshot().position;
      expect(walk[0]).toBeLessThan(-180);
      expect(walk[1]).toBeLessThan(-124);
      expect(walk[2]).toBeLessThan(0);
      play.dispose();
    },
  );

  it("car: grid-placed parts, no overlaps, a valid four-wheel drivable rig", () => {
    const project = template("car");
    const r = report(project);
    expect(r.parts).toBe(52);
    // Every roadster part is in the catalogue (release catalogue-2026-09-29).
    expect(outside(project)).toEqual([]);
    expect(r.overlaps).toEqual([]);
    expect(r.offGrid).toEqual([]);
    expect(r.groups).toBe(1);
    const rig = project.motionRigs.car;
    validateRig(project, rig);
    expect(rig.vehicle!.wheels.map((w) => w.steering)).toEqual([
      true,
      true,
      false,
      false,
    ]);
    // Every part is in exactly one group: the chassis or a wheel (rim + tyre).
    const grouped = rig.groups.flatMap((g) => g.occurrenceIds);
    expect(new Set(grouped).size).toBe(occurrences(project).length);
    for (const g of rig.groups.slice(1))
      expect(g.occurrenceIds).toHaveLength(2);
    expect(rig.vehicle!.wheelbase).toBe(AXLES[1] - AXLES[0]);
  });

  it("car: drives forward (−Z), steers and spins its wheels", () => {
    const project = template("car");
    const session = new KinematicSession(project, "car");
    session.setVehicleInput({ throttle: 1, steering: 0 });
    let s = session.stepTicks(60);
    expect(s.pose.vehicle!.position[2]).toBeLessThan(-150);
    expect(Math.abs(s.pose.vehicle!.position[0])).toBeLessThan(1e-6);
    expect(s.pose.vehicle!.wheelAngles["left-front"]).toBeGreaterThan(360);
    session.setVehicleInput({ throttle: 1, steering: 1 });
    s = session.stepTicks(60);
    expect(Math.abs(s.pose.vehicle!.headingDegrees)).toBeGreaterThan(30);
  });
});

describe("running bond", () => {
  it("avoids the joints of the course below and prefers long bricks", () => {
    const lengths = [1, 2, 3, 4, 6, 8];
    const first = bond(14, lengths);
    expect(first.reduce((a, b) => a + b)).toBe(14);
    const below = joints(first);
    const second = bond(14, lengths, below);
    expect([...joints(second)].filter((j) => below.has(j))).toEqual([]);
    expect(Math.max(...first)).toBeGreaterThanOrEqual(6);
  });
});
