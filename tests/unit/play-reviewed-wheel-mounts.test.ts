import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { occurrences } from "../../src/core/document";
import { compose, rotationY } from "../../src/core/math";
import type { Occurrence } from "../../src/core/types";
import { importLDraw, exportLDraw } from "../../src/ldraw/io";
import { partsList } from "../../src/inventory/parts-list";
import { occurrenceBounds } from "../../src/play/trains";
import {
  AUTO_VEHICLE_LIMITS,
  deriveVehicleRigs,
  checkAuthoredVehicleSource,
} from "../../src/play/auto-vehicles";
import {
  REVIEWED_AXLE_WHEEL_SOURCES,
  reviewedAxleWheelMounts,
} from "../../src/play/reviewed-wheel-mounts";
import {
  registerFullLibraryFromDisk,
  fullLibrarySources,
} from "../../scripts/full-library-node";
import { memberLocalOf, playSources } from "../helpers/play-dynamic-source";
import { KinematicSession } from "../../src/mechanisms/kinematic";
import { PlaySession } from "../../src/play/session";

beforeAll(() => expect(registerFullLibraryFromDisk()).toBe(true));
const fixture = () =>
  importLDraw(
    readFileSync("fixtures/play/official-cars/5540-wheel-mounts.ldr", "utf8"),
  );
const derive = (
  p: ReturnType<typeof fixture>,
  options: Partial<Parameters<typeof deriveVehicleRigs>[1]> = {},
) =>
  deriveVehicleRigs(p, {
    reserved: new Set(),
    maxRigs: 32,
    maxGroups: 128,
    ...options,
  });
const mount = (
  p = fixture(),
  all = occurrences(p),
  options: Partial<Record<keyof typeof AUTO_VEHICLE_LIMITS, number>> = {},
) =>
  reviewedAxleWheelMounts(all, new Set(), occurrenceBounds(p), {
    ...AUTO_VEHICLE_LIMITS,
    ...options,
  });
const fourStation = (stations = [-120, -40, 40, 120]) => {
  const rows = ["1 0 0 -32 0 0 0 1 0 1 0 -1 0 0 2445.dat"];
  for (const z of stations) {
    rows.push(`1 0 0 -24 ${z} 1 0 0 0 1 0 0 0 1 4600.dat`);
    for (const x of [-30, 30])
      for (const ref of ["4624", "3641"])
        rows.push(
          `1 7 ${x} -19 ${z} 0 0 ${x < 0 ? -1 : 1} 0 1 0 ${x < 0 ? 1 : -1} 0 0 ${ref}.dat`,
        );
  }
  return importLDraw(rows.join("\n"));
};

describe("reviewed actual axle wheel mounts", () => {
  it("preserves every source tyre and joining pin in the real doubled/tripled stacks without welding a chassis", () => {
    const p = fixture(),
      json = JSON.stringify(p),
      source = exportLDraw(p),
      inventory = partsList(p, occurrences(p)),
      r = mount(p);
    expect(r.skipped).toEqual([]);
    expect(r.assemblies.map((a) => a.instances.length)).toEqual([2, 2, 3, 3]);
    expect(r.assemblies.map((a) => a.members.length)).toEqual([6, 6, 10, 10]);
    expect(r.assemblies.map((a) => a.center)).toEqual([
      [-144, -54, -200],
      [144, -54, -200],
      [-120, -54, 230],
      [120, -54, 230],
    ]);
    expect(
      new Set(r.assemblies.flatMap((a) => a.members.map((o) => o.id))).size,
    ).toBe(32);
    expect(r.edges.filter((e) => e.kind === "tyre-fit")).toHaveLength(10);
    expect(r.assemblies.every((a) => a.radius === 54.005)).toBe(true);
    expect(r.edges.some((e) => e.kind === "retained-pivot")).toBe(true);
    expect(derive(p).vehicles).toHaveLength(0); // Actual omitted chassis must not become a proximity weld.
    expect(JSON.stringify(p)).toBe(json);
    expect(exportLDraw(p)).toBe(source);
    expect(partsList(p, occurrences(p))).toEqual(inventory);
  });
  it("binds the reviewed literal profiles to the pinned official source and its actual radial geometry", async () => {
    const refs = Object.keys(REVIEWED_AXLE_WHEEL_SOURCES),
      sources = fullLibrarySources(refs);
    for (const ref of refs)
      expect(createHash("sha256").update(sources[ref]).digest("hex")).toBe(
        REVIEWED_AXLE_WHEEL_SOURCES[
          ref as keyof typeof REVIEWED_AXLE_WHEEL_SOURCES
        ],
      );
    const p = importLDraw("1 7 0 0 0 1 0 0 0 1 0 0 0 1 2696.dat"),
      local = await memberLocalOf(
        p,
        occurrences(p)[0].id,
        fullLibrarySources(["2696.dat"]),
      );
    let max = 0;
    for (let i = 0; i < local.vertices.length; i += 3)
      max = Math.max(max, Math.hypot(local.vertices[i], local.vertices[i + 1]));
    expect(max).toBeGreaterThan(53.9);
    expect(max).toBeLessThanOrEqual(54.005);
  });
  it("retains real socket, bearing and stack seating under translated source yaw", () => {
    for (const yaw of [37, 90, 180]) {
      const p = fixture(),
        all = occurrences(p).map((o) => ({
          ...o,
          transform: compose(
            { position: [340, 24, -190], basis: rotationY(yaw) },
            o.transform,
          ),
        }));
      const r = mount(p, all);
      expect(r.skipped).toEqual([]);
      expect(r.assemblies).toHaveLength(4);
      expect(r.assemblies.flatMap((a) => a.instances)).toHaveLength(10);
    }
  });
  it("refuses lost retainers, axle tips, pivot sockets, real joining pins and borrowed part names", () => {
    const p = fixture(),
      original = occurrences(p),
      target = mount(p).assemblies[0];
    const changes: Array<(all: Occurrence[]) => void> = [
      (all) =>
        all.splice(
          all.findIndex(
            (o) =>
              o.id ===
              target.mountMembers.find((o) => o.node.ref === "3713.dat")!.id,
          ),
          1,
        ),
      (all) => {
        all.find((o) => o.id === target.shaft.id)!.transform.position[0] -= 30;
      },
      (all) =>
        all.splice(
          all.findIndex(
            (o) =>
              o.id ===
              target.mountMembers.find((o) => o.node.ref === "4263.dat")!.id,
          ),
          1,
        ),
      (all) =>
        all.splice(
          all.findIndex(
            (o) =>
              o.id ===
              target.members.find((o) => o.node.ref === "3749.dat")!.id,
          ),
          1,
        ),
      (all) => {
        all.find((o) => o.id === target.instances[0].rim.id)!.namespace =
          "project";
      },
      (all) => {
        all.find((o) => o.id === target.instances[0].tyre.id)!.transform.basis =
          compose(
            { position: [0, 0, 0], basis: rotationY(180) },
            all.find((o) => o.id === target.instances[0].tyre.id)!.transform,
          ).basis;
      },
      (all) => {
        all.find((o) => o.id === target.instances[0].rim.id)!.transform.basis =
          [0, 0, 1, 0, 1, 0, -1, 0, 0];
      },
    ];
    for (const change of changes) {
      const all = structuredClone(original);
      change(all);
      const r = mount(p, all);
      expect(
        r.assemblies.some((a) =>
          a.members.some((o) => o.id === target.instances[0].rim.id),
        ),
      ).toBe(false);
    }
  });
  it("reports real optional steering rack attachment without borrowing a nearby socket", () => {
    const text = readFileSync(
        "fixtures/play/official-cars/5540-wheel-mounts.ldr",
        "utf8",
      ),
      links = [-1, 1].flatMap((side) => [
        `1 7 ${side * 110} -64 -160 0 0 1 1 0 0 0 1 0 3749.dat`,
        `1 7 ${side * 80} -72 -160 1 0 0 0 1 0 0 0 1 4263.dat`,
      ]),
      p = importLDraw(text + links.join("\n")),
      r = mount(p);
    expect(r.skipped).toEqual([]);
    expect(r.assemblies.slice(0, 2).map((a) => a.mountMembers.length)).toEqual([
      8, 8,
    ]);
    const linkIds = new Set(
      occurrences(p)
        .slice(-4)
        .map((o) => o.id),
    );
    expect(
      r.edges.filter(
        (e) =>
          e.kind === "retained-pivot" && linkIds.has(e.a) && linkIds.has(e.b),
      ),
    ).toHaveLength(2);
    const all = occurrences(p);
    all.at(-1)!.transform.position[0] += 2;
    const moved = mount(p, all);
    expect(moved.assemblies[1].mountMembers).toHaveLength(6);
    expect(moved.edges.some((e) => e.b === all.at(-1)!.id)).toBe(false);
  });
  it("refuses ambiguous ownership and budget exhaustion before accepting any partial mount review", () => {
    const p = fixture(),
      all = occurrences(p),
      pin = structuredClone(all.find((o) => o.node.ref === "3749.dat")!);
    pin.id += "duplicate";
    expect(mount(p, [...all, pin]).assemblies).toHaveLength(3);
    const small = mount(p, all, { connectionWork: 1 });
    expect(small.assemblies).toEqual([]);
    expect(small.edges).toEqual([]);
    expect(small.skipped.at(-1)?.reason).toMatch(/budget/);
    expect(mount(p, all, { wheelParts: 19 }).assemblies).toEqual([]);
    expect(mount(p, all, { connectionWork: 100001 }).assemblies).toEqual([]);
  });
  it("drives four actual connected axle stations with the true controller count, origin and group budget", () => {
    const p = fourStation(),
      source = exportLDraw(p),
      r = derive(p);
    expect(r.skipped).toEqual([]);
    expect(r.vehicles).toHaveLength(1);
    const rig = Object.values(r.rigs)[0];
    expect(rig.groups).toHaveLength(9);
    expect(rig.groups[0].frame.position).toEqual([0, -19, 0]);
    expect(rig.vehicle!.wheelbase).toBe(240);
    expect(rig.vehicle!.wheels.filter((w) => w.steering)).toHaveLength(2);
    expect(
      checkAuthoredVehicleSource({ ...p, motionRigs: r.rigs }, rig),
    ).toEqual({ eligible: true });
    expect(derive(p, { maxGroups: 8 }).vehicles).toHaveLength(0);
    expect(derive(p, { maxGroups: 9 }).vehicles).toHaveLength(1);
    const k = new KinematicSession({ ...p, motionRigs: r.rigs }, rig.id);
    k.setVehicleInput({ throttle: 1, steering: 0 });
    k.stepTicks(60);
    expect(k.snapshot().groupFrames.chassis.position[2]).toBeLessThan(-100);
    k.setVehicleInput({ throttle: -1, steering: 0 });
    k.stepTicks(60);
    expect(k.snapshot().groupFrames.chassis.position[2]).toBeCloseTo(0, 8);
    expect(exportLDraw(p)).toBe(source);
  });
  it("refuses an unsupported support plane or a missing side at any station", () => {
    const p = fourStation(),
      all = occurrences(p),
      tyre = all.find((o) => o.node.ref === "3641.dat")!,
      bounds = occurrenceBounds(p);
    expect(
      derive(p, {
        bounds: (o) => {
          const b = bounds(o);
          return o.id === tyre.id && b
            ? { min: [b.min[0], b.min[1] - 3, b.min[2]], max: b.max }
            : b;
        },
      }).vehicles,
    ).toHaveLength(0);
    expect(
      derive(p, { all: all.filter((o) => o.id !== tyre.id) }).vehicles,
    ).toHaveLength(0);
    const holder = all.find((o) => o.node.ref === "4600.dat")!,
      station = all.filter(
        (o) => o.transform.position[2] === holder.transform.position[2],
      );
    for (const o of station) o.transform.position[1] -= 0.02;
    expect(derive(p, { all }).vehicles).toHaveLength(0);
  });
  it("keeps all eight native wheels supported while a four-station vehicle drives and reverses", async () => {
    const p = fourStation(),
      before = JSON.stringify(p),
      inventory = partsList(p, occurrences(p)),
      source = exportLDraw(p),
      derived = derive(p),
      id = Object.keys(derived.rigs)[0],
      prepared = await playSources(
        { ...p, motionRigs: derived.rigs },
        [id],
        fullLibrarySources(occurrences(p).map((o) => o.node.ref)),
      ),
      play = await PlaySession.create(
        prepared.geometry,
        { rigIds: [id], dynamicRigIds: [id], position: [400, -0.3, 400] },
        prepared.sources,
      );
    try {
      const rest = play.stepTicks(60).mechanisms![id];
      play.setMechanismVehicleInput({ throttle: 1, steering: 0 }, id);
      const driven = play.stepTicks(90).mechanisms![id];
      expect(driven.pose.vehicle!.position[2]).toBeLessThan(
        rest.pose.vehicle!.position[2] - 30,
      );
      expect(driven.dynamics!.speed).toBeGreaterThan(10);
      expect(Object.values(driven.dynamics!.wheels!)).toHaveLength(8);
      expect(
        Object.values(driven.dynamics!.wheels!).filter((w) => w.contact),
      ).toHaveLength(8);
      play.setMechanismVehicleInput({ throttle: -1, steering: 0 }, id);
      const reversed = play.stepTicks(180).mechanisms![id];
      expect(reversed.pose.vehicle!.position[2]).toBeGreaterThan(
        driven.pose.vehicle!.position[2] + 30,
      );
      expect(reversed.dynamics!.speed).toBeLessThan(-10);
      expect(JSON.stringify(p)).toBe(before);
      expect(exportLDraw(p)).toBe(source);
      expect(partsList(p, occurrences(p))).toEqual(inventory);
    } finally {
      play.dispose();
    }
  }, 60000);
});
