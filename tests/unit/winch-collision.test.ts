import { readFileSync } from "node:fs";
import RAPIER from "@dimforge/rapier3d-compat";
import { beforeAll, expect, it } from "vitest";
import { occurrences } from "../../src/core/document";
import type { Project, Occurrence, Vec3 } from "../../src/core/types";
import { importLDraw } from "../../src/ldraw/io";
import type { PlayMemberLocalGeometry } from "../../src/play/types";
import { toPhysics } from "../../src/play/physics-frame";
import {
  prepareWinchCollision,
  isSourceBoundWinchCollision,
  winchCollisionMatchesProject,
} from "../../src/mechanisms/winch-collision";
import {
  fullLibrarySources,
  registerFullLibraryFromDisk,
} from "../../scripts/full-library-node";
import { memberLocalOf } from "../helpers/play-dynamic-source";
let project: Project,
  all: Occurrence[],
  sources: Record<string, string>,
  captures: Record<string, PlayMemberLocalGeometry>,
  original: string,
  wormId: string;
beforeAll(async () => {
  registerFullLibraryFromDisk();
  await RAPIER.init();
  project = importLDraw(
    readFileSync("fixtures/ldraw/technic/42042-mounted-winch.ldr", "utf8"),
  );
  all = occurrences(project);
  sources = fullLibrarySources(all.map((o) => o.node.ref));
  original = JSON.stringify(project);
  wormId = all.find((o) => o.node.ref === "4716.dat")!.id;
  captures = {};
  for (const o of all)
    captures[o.id] = await memberLocalOf(project, o.id, sources);
}, 30_000);

it("binds every actual canonical face and retains 29 source owners within the existing native budgets", async () => {
  const packet = await prepareWinchCollision(
    project,
    wormId,
    sources,
    captures,
  );
  expect(isSourceBoundWinchCollision(packet)).toBe(true);
  expect(isSourceBoundWinchCollision(structuredClone(packet))).toBe(false);
  expect(winchCollisionMatchesProject(packet, project)).toBe(true);
  expect(winchCollisionMatchesProject(packet, structuredClone(project))).toBe(
    false,
  );
  expect(packet.owners).toHaveLength(29);
  expect(packet.sourceTriangles).toBe(34_729);
  expect(packet.literalMeshTriangles).toBe(33_349);
  expect(packet.childCount).toBe(255);
  expect(packet.captureBinding).toBe("matched-canonical");
  expect(packet.nativeRestRotation).toBe("identity");
  expect(packet.rotorCaps).toHaveLength(2);
  expect(packet.rotorCaps.map((c) => c.spanLdu)).toEqual([
    [-20, 20],
    [-10, 10],
  ]);
  expect(
    packet.rotorCaps.every(
      (c) => c.supportIds.length === 2 && c.sourceHalfspaceErrorLdu <= 1e-6,
    ),
  ).toBe(true);
  expect(packet.ordinaryAdmission).toBe(false);
  expect(packet.rotorSourcePlaneEnvelopeLdu).toBe(0.00035);
  expect(
    packet.owners
      .flatMap((o) => o.regions)
      .filter((r) => r.kind === "source-trimesh"),
  ).toHaveLength(27);
  expect(
    packet.owners
      .flatMap((o) => o.regions)
      .filter((r) => r.kind === "source-convex"),
  ).toHaveLength(228);
  for (const o of packet.owners) {
    const originalMember = all.find((m) => m.id === o.occurrenceId)!;
    expect(o.frame).toEqual(originalMember.transform);
    expect(Object.isFrozen(o.frame.position)).toBe(true);
    for (const r of o.regions) {
      expect(Object.isFrozen(r.points)).toBe(true);
      const vertices = Float32Array.from(
        r.points.flatMap((p) => Object.values(toPhysics(p as Vec3))),
      );
      const desc =
        r.kind === "source-trimesh"
          ? RAPIER.ColliderDesc.trimesh(vertices, new Uint32Array(r.triangles!))
          : RAPIER.ColliderDesc.convexHull(vertices);
      expect(desc).not.toBeNull();
      const raw = desc!.shape.intoRaw();
      expect(raw).not.toBeNull();
      raw!.free();
    }
  }
  expect(JSON.stringify(project)).toBe(original);
}, 30_000);

it("refuses changed actual geometry, face winding, source shadows and stale capture context", async () => {
  const id = all[0].id;
  const changed = structuredClone(captures);
  changed[id].vertices[0] += 0.1;
  await expect(
    prepareWinchCollision(project, wormId, sources, changed),
  ).rejects.toThrow("canonical source geometry changed");
  const reversed = structuredClone(captures);
  const indices = reversed[id].indices;
  [indices[0], indices[1]] = [indices[1], indices[0]];
  await expect(
    prepareWinchCollision(project, wormId, sources, reversed),
  ).rejects.toThrow("canonical source geometry changed");
  const stale = structuredClone(captures);
  stale[id] = { ...stale[id], revision: stale[id].revision + 1 };
  await expect(
    prepareWinchCollision(project, wormId, sources, stale),
  ).rejects.toThrow("capture is missing or stale");
  const displaced = structuredClone(captures);
  displaced[id].frame.position[0] += 0.001;
  await expect(
    prepareWinchCollision(project, wormId, sources, displaced),
  ).rejects.toThrow("capture is missing or stale");
  await expect(
    prepareWinchCollision(
      project,
      wormId,
      {
        ...sources,
        "beamhole.dat": sources["beamhole.dat"] + "\n0 changed source",
      },
      captures,
    ),
  ).rejects.toThrow("source geometry changed");
  const shadow = structuredClone(project);
  shadow.models["beamhole.dat"] = {
    id: "beamhole.dat",
    name: "beamhole.dat",
    nodes: [],
    records: [],
    classification: "custom",
  };
  await expect(
    prepareWinchCollision(shadow, wormId, sources, captures),
  ).rejects.toThrow("shadows reviewed source");
  expect(JSON.stringify(project)).toBe(original);
}, 30_000);
