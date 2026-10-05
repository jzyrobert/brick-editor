import { readFileSync } from "node:fs";
import { Vector3 } from "three";
import { beforeAll, expect, it } from "vitest";
import { occurrences } from "../../src/core/document";
import type { Project, Vec3 } from "../../src/core/types";
import { importLDraw } from "../../src/ldraw/io";
import type { PlayMemberLocalGeometry } from "../../src/play/types";
import {
  prepareWinchCollision,
  type SourceBoundWinchCollision,
} from "../../src/mechanisms/winch-collision";
import {
  winchSurfaceBands,
  isWinchSurfaceBands,
} from "../../src/mechanisms/winch-surface-bands";
import {
  fullLibrarySources,
  registerFullLibraryFromDisk,
} from "../../scripts/full-library-node";
import { memberLocalOf } from "../helpers/play-dynamic-source";

let packet: SourceBoundWinchCollision, project: Project, original: string;
beforeAll(async () => {
  registerFullLibraryFromDisk();
  project = importLDraw(
    readFileSync("fixtures/ldraw/technic/42042-mounted-winch.ldr", "utf8"),
  );
  original = JSON.stringify(project);
  const all = occurrences(project),
    sources = fullLibrarySources(all.map((o) => o.node.ref)),
    captures: Record<string, PlayMemberLocalGeometry> = {};
  for (const o of all)
    captures[o.id] = await memberLocalOf(project, o.id, sources);
  packet = await prepareWinchCollision(
    project,
    all.find((o) => o.node.ref === "4716.dat")!.id,
    sources,
    captures,
  );
}, 30_000);
const delta = (a: readonly number[], b: readonly number[]) =>
  new Vector3(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const triangleArea = (
  a: readonly number[],
  b: readonly number[],
  c: readonly number[],
) => delta(b, a).cross(delta(c, a)).length() / 2;

it("retains every oriented source face through literal bore-end cuts without virtual caps or positive interval cutoffs", () => {
  const result = winchSurfaceBands(packet);
  expect(isWinchSurfaceBands(result)).toBe(true);
  expect(isWinchSurfaceBands(structuredClone(result))).toBe(false);
  expect(() => winchSurfaceBands(structuredClone(packet))).toThrow();
  expect(result.ordinaryAdmission).toBe(false);
  expect(result.shafts).toHaveLength(
    new Set(packet.plan.bearings.map((b) => b.shaft.occurrenceId)).size,
  );
  let outputTriangles = 0,
    bandCount = 0;
  for (const shaft of result.shafts) {
    const owner = packet.owners.find(
        (o) => o.occurrenceId === shaft.occurrenceId,
      )!,
      source = owner.regions[0],
      counts = new Uint32Array(shaft.sourceTriangles),
      areas = new Float64Array(shaft.sourceTriangles),
      port = packet.plan.bearings.find(
        (b) => b.shaft.occurrenceId === shaft.occurrenceId,
      )!.shaft;
    const station = (p: readonly number[]) =>
      delta(
        p,
        port.center.map((v, i) => v - owner.frame.position[i]),
      ).dot(new Vector3(...port.axis));
    for (const band of shaft.bands) {
      expect(band.spanLdu[1]).toBeGreaterThan(band.spanLdu[0]);
      expect(band.points).toHaveLength(band.triangles.length);
      expect(band.sourceFaces).toHaveLength(band.triangles.length / 3);
      expect(Object.isFrozen(band.points)).toBe(true);
      bandCount++;
      for (let t = 0; t < band.triangles.length; t += 3) {
        const id = band.sourceFaces[t / 3],
          a = band.points[band.triangles[t]],
          b = band.points[band.triangles[t + 1]],
          c = band.points[band.triangles[t + 2]],
          originalTriangle = [0, 1, 2].map(
            (k) => source.points[source.triangles![3 * id + k]],
          ),
          originalNormal = delta(
            originalTriangle[1],
            originalTriangle[0],
          ).cross(delta(originalTriangle[2], originalTriangle[0])),
          outputNormal = delta(b, a).cross(delta(c, a));
        counts[id]++;
        areas[id] += triangleArea(a, b, c);
        outputTriangles++;
        expect(outputNormal.dot(originalNormal)).toBeGreaterThanOrEqual(-1e-12);
        for (const p of [a, b, c]) {
          expect(station(p)).toBeGreaterThanOrEqual(band.spanLdu[0] - 1e-9);
          expect(station(p)).toBeLessThanOrEqual(band.spanLdu[1] + 1e-9);
        }
      }
      for (const index of band.bearingCandidates) {
        const bearing = packet.plan.bearings[index];
        expect(bearing.shaft.occurrenceId).toBe(shaft.occurrenceId);
      }
    }
    for (let id = 0; id < counts.length; id++) {
      expect(counts[id]).toBeGreaterThan(0); // Includes original degenerate faces.
      const ps = [0, 1, 2].map(
        (k) => source.points[source.triangles![3 * id + k]],
      );
      expect(
        Math.abs(areas[id] - triangleArea(...(ps as [Vec3, Vec3, Vec3]))),
      ).toBeLessThanOrEqual(1e-8);
    }
    expect(shaft.maxFaceAreaErrorLdu2).toBeLessThanOrEqual(1e-8);
    expect(shaft.maxSourcePlaneErrorLdu).toBeLessThanOrEqual(1e-9);
  }
  expect(outputTriangles).toBeGreaterThan(
    result.shafts.reduce((s, p) => s + p.sourceTriangles, 0),
  );
  expect(
    bandCount + packet.owners.length - result.shafts.length + 226,
  ).toBeLessThan(4096);
  expect(JSON.stringify(project)).toBe(original);
});

it("keeps the real joiner divider and one-sided stop head outside any inferred whole-owner exemption", () => {
  const result = winchSurfaceBands(packet),
    joiner = packet.owners.find((o) => o.ref === "18948.dat")!,
    head = packet.owners.find((o) => o.ref === "15462.dat")!,
    bands = result.shafts.find((s) => s.occurrenceId === head.occurrenceId)!;
  expect(
    result.shafts.some((s) => s.occurrenceId === joiner.occurrenceId),
  ).toBe(false);
  expect(joiner.regions[0].kind).toBe("source-trimesh");
  expect(joiner.regions[0].triangles!.length).toBe(772 * 3);
  const headArea = bands.bands
    .flatMap((b) => b.sourceFaces)
    .filter((face) => {
      const points = [0, 1, 2].map(
        (k) => head.regions[0].points[head.regions[0].triangles![3 * face + k]],
      );
      // A real head extends outside the cross-axle's 6-LDU radial envelope.
      const axis = packet.plan.bearings.find(
        (b) => b.shaft.occurrenceId === head.occurrenceId,
      )!.shaft.axis;
      return points.some((p) => {
        const v = new Vector3(...p),
          a = new Vector3(...axis);
        return v.sub(a.multiplyScalar(v.dot(a))).length() > 6 + 1e-6;
      });
    });
  expect(headArea.length).toBeGreaterThan(0);
  expect(result.ordinaryAdmission).toBe(false);
  expect(JSON.stringify(project)).toBe(original);
});
