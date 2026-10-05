import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import {
  fullLibrarySources,
  registerFullLibraryFromDisk,
} from "../../scripts/full-library-node";
import { occurrences } from "../../src/core/document";
import { add, compose, mv, rotationY } from "../../src/core/math";
import { importLDraw, exportLDraw } from "../../src/ldraw/io";
import { partsList } from "../../src/inventory/parts-list";
import manifest from "../../src/play/arocs-articulation-sources.json";
import {
  bindArocsArticulationSources,
  arocsArticulationInterface,
  arocsBallFits,
  arocsBallJoint,
  type ArocsArticulationBinding,
  type ArocsArticulationRef,
} from "../../src/play/arocs-articulation-interfaces";
import type { RigidGroup } from "../../src/mechanisms/types";
import {
  BufferAttribute,
  BufferGeometry,
  Line3,
  Matrix4,
  Vector3,
} from "three";
import { MeshBVH } from "three-mesh-bvh";
import { meshOf } from "../helpers/play-dynamic-source";
const refs = Object.keys(manifest) as ArocsArticulationRef[];
let binding: ArocsArticulationBinding;
beforeAll(async () => {
  registerFullLibraryFromDisk();
  binding = await bindArocsArticulationSources(fullLibrarySources(refs), refs);
});
const fixture = () =>
  importLDraw(
    readFileSync(
      "fixtures/play/official-cars/42043-ball-link-interfaces.ldr",
      "utf8",
    ),
  );
const interfaces = (all = occurrences(fixture())) =>
  all.flatMap((o) => {
    const f = arocsArticulationInterface(o, binding);
    return f ? [f] : [];
  });
describe("source-bound Arocs suspension and steering endpoint review", () => {
  it("constructs source-coincident spherical anchors without inventing angular limits, power or collision allowances", () => {
    const p = fixture(),
      all = occurrences(p),
      fits = arocsBallFits(interfaces(all)).fits,
      fit = fits.find((f) => f.rest === "coincident")!;
    const body = (occurrenceId: string, id: string): RigidGroup => {
      const o = all.find((o) => o.id === occurrenceId)!;
      return {
        id,
        occurrenceIds: [o.id],
        frame: structuredClone(o.transform),
        restTransforms: { [o.id]: structuredClone(o.transform) },
      };
    };
    const a = body(fit.ball.occurrenceId, "ball"),
      b = body(fit.socket.occurrenceId, "socket"),
      joint = arocsBallJoint(fit, a, b, "actual-ball");
    expect(joint.kind).toBe("spherical");
    expect(joint.motor).toBeUndefined();
    expect(joint.limits).toBeUndefined();
    expect(joint.mating).toBeUndefined();
    const pa = add(a.frame.position, mv(a.frame.basis, joint.anchorA)),
      pb = add(b.frame.position, mv(b.frame.basis, joint.anchorB));
    expect(Math.hypot(...pa.map((n, k) => n - pb[k]))).toBeLessThan(1e-8);
    expect(() => arocsBallJoint({ ...fit }, a, b, "fake-fit")).toThrow(
      "verified",
    );
    expect(() =>
      arocsBallJoint(
        fits.find((f) => f.sourceGapLdu > 1)!,
        a,
        b,
        "misaligned-fit",
      ),
    ).toThrow("assembly alignment");
    a.restTransforms[fit.ball.occurrenceId].position[1] += 1;
    expect(() => arocsBallJoint(fit, a, b, "changed-rest")).toThrow(
      "rest frames",
    );
  });
  it("distinguishes rear authored material intersections from an ideal alignment diagnostic", async () => {
    const p = fixture(),
      all = occurrences(p),
      parts = interfaces(all),
      r = arocsBallFits(parts),
      fit = r.fits.find(
        (f) =>
          f.sourceGapLdu > 1 &&
          parts.find((p) => p.occurrenceId === f.socket.occurrenceId)!.ref ===
            "15459.dat",
      )!;
    const trees = await Promise.all(
      [fit.ball.occurrenceId, fit.socket.occurrenceId].map(async (id) => {
        const mesh = await meshOf(p, [id], fullLibrarySources(refs)),
          g = new BufferGeometry();
        g.setAttribute("position", new BufferAttribute(mesh.vertices, 3));
        g.setIndex(new BufferAttribute(mesh.indices, 1));
        return new MeshBVH(g, { maxLeafTris: 8 });
      }),
    );
    const crossings = (transform: Matrix4) => {
      let n = 0;
      const line = new Line3(),
        na = new Vector3(),
        nb = new Vector3(),
        mid = new Vector3(),
        ba = new Vector3(),
        bb = new Vector3();
      trees[0].bvhcast(trees[1], transform, {
        intersectsTriangles(a, b) {
          const parallel =
            Math.abs(a.getNormal(na).dot(b.getNormal(nb))) >= 0.99999;
          if (!a.intersectsTriangle(b, parallel ? undefined : line))
            return false;
          if (!parallel && line.distance() > 1e-4) {
            line.getCenter(mid);
            a.getBarycoord(mid, ba);
            b.getBarycoord(mid, bb);
            if ([ba.x, ba.y, ba.z, bb.x, bb.y, bb.z].every((x) => x > 1e-5))
              n++;
          }
          return false;
        },
      });
      return n;
    };
    expect(crossings(new Matrix4())).toBe(95);
    expect(
      crossings(new Matrix4().makeTranslation(...fit.idealSocketTranslation)),
    ).toBe(0);
    expect(fit.rest).toBe("requires-assembly-alignment");
  });
  it("binds actual sphere, socket tab and arm subpart closures and refuses replacements", async () => {
    const ss = fullLibrarySources(refs);
    expect(ss["6628.dat"]).toMatch(/-10 0 0 8 0 0 0 8 0 0 0 8 8-8sphe/);
    expect(ss["2736.dat"]).toMatch(/-12 0 0 8 0 0 0 8 0 0 0 8 8-8sphe/);
    expect(ss["15459.dat"]).toContain(
      "0 0 -60 1 0 0 0 1 0 0 0 1 s\\57515s01.dat",
    );
    expect(ss["s/57515s01.dat"]).toContain(
      "0 0 -20 1 0 0 0 1 0 0 0 1 s\\57515s02.dat",
    );
    expect(ss["s/32005s01.dat"]).toContain("0 3.5 0 0 0 -7.27");
    await expect(
      bindArocsArticulationSources(
        { ...ss, "s/57515s02.dat": ss["s/57515s02.dat"] + "\n0 changed" },
        refs,
      ),
    ).rejects.toThrow("geometry changed");
    const o = occurrences(fixture())[0];
    expect(
      arocsArticulationInterface({ ...o, namespace: "project" }, binding),
    ).toBeUndefined();
    expect(arocsArticulationInterface(o, { refs })).toBeUndefined();
    expect(() => arocsBallFits([{ ...interfaces()[0] }])).toThrow("actual");
  });
  it("retains every authored endpoint and distinguishes exact spherical connections from unresolved rest closure", () => {
    const p = fixture(),
      before = JSON.stringify(p),
      source = exportLDraw(p),
      inv = partsList(p, occurrences(p)),
      parts = interfaces(occurrences(p)),
      r = arocsBallFits(parts);
    expect(parts).toHaveLength(38);
    expect(
      parts.flatMap((p) => p.features).filter((f) => f.role === "socket"),
    ).toHaveLength(18);
    expect(r.fits).toHaveLength(18);
    expect(r.unresolved).toEqual([]);
    expect(
      r.attachments.every(
        (e) => e.kind === "articulated" && e.axis === undefined,
      ),
    ).toBe(true);
    const exact = r.fits.filter((f) => f.rest === "coincident");
    expect(r.attachments).toHaveLength(exact.length);
    expect(exact.length).toBeGreaterThan(0);
    expect(r.fits.filter((f) => f.sourceGapLdu > 1)).toHaveLength(7);
    expect(
      r.fits
        .filter((f) => f.sourceGapLdu > 1)
        .every((f) => f.rest === "requires-assembly-alignment"),
    ).toBe(true);
    expect(
      parts
        .filter((p) => p.ref === "15459.dat")
        .every((p) => p.features[0].localCenter[2] === -80),
    ).toBe(true);
    expect(JSON.stringify(p)).toBe(before);
    expect(exportLDraw(p)).toBe(source);
    expect(partsList(p, occurrences(p))).toEqual(inv);
  });
  it("does not grant attachment through proximity, ambiguous balls, missing balls or raised budgets", () => {
    const parts = interfaces(),
      r = arocsBallFits(parts),
      exact = r.fits.find((f) => f.rest === "coincident")!,
      socket = parts.find((p) => p.occurrenceId === exact.socket.occurrenceId)!;
    expect(
      arocsBallFits([socket]).unresolved.every(
        (f) => f.reason === "no-source-ball",
      ),
    ).toBe(true);
    expect(() => arocsBallFits(parts, { checks: 1 })).toThrow("budget");
    expect(() => arocsBallFits(parts, { checks: 100001 })).toThrow(
      "cannot raise",
    );
    const all = occurrences(fixture()),
      ball = all.find((o) => o.id === exact.ball.occurrenceId)!,
      duplicate = { ...ball, id: "another-source-ball" };
    const duplicated = interfaces([...all, duplicate]),
      ambiguous = arocsBallFits(duplicated);
    expect(
      ambiguous.unresolved.some(
        (f) =>
          f.occurrenceId === socket.occurrenceId &&
          f.reason === "ambiguous-ball",
      ),
    ).toBe(true);
    expect(ambiguous.attachments.some((e) => e.b === socket.occurrenceId)).toBe(
      false,
    );
  });
  it("keeps source rest errors explicit under translated yaw and never uses an ideal translation as serialized source", () => {
    const all = occurrences(fixture()),
      r = arocsBallFits(interfaces(all));
    for (const yaw of [37, 90, 180]) {
      const moved = all.map((o) => ({
          ...o,
          transform: compose(
            { position: [340, 24, -190], basis: rotationY(yaw) },
            o.transform,
          ),
        })),
        next = arocsBallFits(interfaces(moved));
      expect(next.fits).toHaveLength(r.fits.length);
      expect(next.attachments).toHaveLength(r.attachments.length);
      next.fits.forEach((f, k) => {
        expect(f.sourceGapLdu).toBeCloseTo(r.fits[k].sourceGapLdu, 9);
        expect(f.rigidGapLdu).toBeCloseTo(r.fits[k].rigidGapLdu, 9);
      });
    }
  });
});
