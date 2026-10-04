import { describe, expect, it } from "vitest";
import {
  BufferGeometry,
  Float32BufferAttribute,
  Group,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
} from "three";
import { PlayMemberGeometryCapture } from "../../src/render/play-member-geometry";
import { OccurrenceHandle } from "../../src/render/occurrence-handles";
import { occurrences } from "../../src/core/document";
import { importLDraw, exportLDraw } from "../../src/ldraw/io";
import { identity } from "../../src/core/math";
import { PLAY_MEMBER_GEOMETRY_LIMITS } from "../../src/play/member-geometry";
import {
  memberLocalOf,
  meshOf,
  playSources,
} from "../helpers/play-dynamic-source";
import { validatePlayMechanismSource } from "../../src/play/mechanism";
import { mechanismFixture } from "../../src/mechanisms/fixtures";

const triangle = () => {
  const root = new Group(),
    mesh = new Mesh(
      new BufferGeometry().setAttribute(
        "position",
        new Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0], 3),
      ),
      new MeshBasicMaterial(),
    );
  root.add(mesh);
  return root;
};
const project = () =>
  importLDraw(`0 FILE main.ldr
1 7 20 -30 40 1 0 0 0 1 0 0 0 1 custom.dat
1 7 100 -200 300 .8137976813 -.4698463104 .3420201433 .5438381425 .8231729446 -.1631759112 -.2048741287 .3187957776 .9254165784 custom.dat
0 FILE custom.dat
0 !LDRAW_ORG Unofficial_Part
0 BFC CERTIFY CCW
3 16 0 0 0 1 0 0 0 1 0
3 16 0 0 0 0 0 1 1 0 0
3 16 0 0 0 0 1 0 0 0 1
3 16 1 0 0 0 0 1 0 1 0`);

describe("canonical Play member geometry", () => {
  it("ignores occurrence/world placement, shares identical prototypes and retains exact authored frames", () => {
    const p = project(),
      all = occurrences(p),
      proto = triangle(),
      handles = new Map(
        all.map((o) => [o.id, new OccurrenceHandle(o.id, proto)]),
      ),
      capture = new PlayMemberGeometryCapture(),
      before = JSON.stringify(p);
    for (const h of handles.values())
      h.matrix.copy(
        new Matrix4().makeRotationZ(0.721).setPosition(90000, 20000, -30000),
      );
    const a = capture.capture(
      all.map((o) => o.id),
      new Map(all.map((o) => [o.id, o])),
      handles,
      p.revision,
    );
    expect(a[all[0].id].vertices).toBe(a[all[1].id].vertices);
    expect(Array.from(a[all[0].id].vertices)).toEqual([
      0, 0, 0, 1, 0, 0, 0, 1, 0,
    ]);
    expect(a[all[1].id].frame).toEqual(all[1].transform);
    expect(a[all[1].id].frame).not.toBe(all[1].transform);
    expect(Object.isFrozen(a[all[1].id].frame)).toBe(true);
    expect(JSON.stringify(p)).toBe(before);
  });
  it("uses prototype-local transforms and preserves local mirrored winding without adding the occurrence mirror", () => {
    const p = project(),
      o = occurrences(p)[0],
      proto = triangle();
    proto.children[0].scale.x = -1;
    proto.children[0].position.set(2, 3, 4);
    const result = new PlayMemberGeometryCapture().capture(
      [o.id],
      new Map([[o.id, o]]),
      new Map([[o.id, new OccurrenceHandle(o.id, proto)]]),
      p.revision,
    )[o.id];
    expect(Array.from(result.vertices)).toEqual([2, 3, 4, 1, 3, 4, 2, 4, 4]);
    expect(Array.from(result.indices)).toEqual([0, 2, 1]);
  });
  it("refuses missing, empty, malformed and over-budget requested geometry before returning a partial map", () => {
    const p = project(),
      all = occurrences(p),
      lookup = new Map(all.map((o) => [o.id, o])),
      capture = new PlayMemberGeometryCapture(),
      proto = triangle(),
      handles = new Map([[all[0].id, new OccurrenceHandle(all[0].id, proto)]]);
    expect(() =>
      capture.capture(
        all.map((o) => o.id),
        lookup,
        handles,
        p.revision,
      ),
    ).toThrow("complete loaded geometry");
    handles.set(all[1].id, new OccurrenceHandle(all[1].id, new Group()));
    expect(() =>
      capture.capture(
        all.map((o) => o.id),
        lookup,
        handles,
        p.revision,
      ),
    ).toThrow("complete triangle geometry");
    const huge = triangle();
    huge.children[0] = new Mesh(
      new BufferGeometry().setAttribute(
        "position",
        new Float32BufferAttribute(
          new Float32Array((PLAY_MEMBER_GEOMETRY_LIMITS.vertices + 3) * 3),
          3,
        ),
      ),
      new MeshBasicMaterial(),
    );
    handles.set(all[1].id, new OccurrenceHandle(all[1].id, huge));
    expect(() =>
      capture.capture(
        all.map((o) => o.id),
        lookup,
        handles,
        p.revision,
      ),
    ).toThrow("budget");
    const invalid = triangle();
    (invalid.children[0] as Mesh).geometry.setIndex([0, 1, 99]);
    handles.set(all[1].id, new OccurrenceHandle(all[1].id, invalid));
    expect(() =>
      capture.capture([all[1].id], lookup, handles, p.revision),
    ).toThrow("invalid triangle indices");
  });
  it("preflights sparse-indexed vertices across the whole requested union and releases the prior request cache", () => {
    const p = project(),
      all = occurrences(p),
      lookup = new Map(all.map((o) => [o.id, o])),
      capture = new PlayMemberGeometryCapture(),
      proto = triangle();
    const handles = new Map(
      all.map((o) => [o.id, new OccurrenceHandle(o.id, proto)]),
    );
    const first = capture.capture([all[0].id], lookup, handles, p.revision)[
      all[0].id
    ];
    const second = capture.capture([all[0].id], lookup, handles, p.revision)[
      all[0].id
    ];
    expect(second.vertices).not.toBe(first.vertices);
    expect(second.vertices).toEqual(first.vertices);
    const sparse = triangle();
    (sparse.children[0] as Mesh).geometry
      .setAttribute(
        "position",
        new Float32BufferAttribute(new Float32Array(300003 * 3), 3),
      )
      .setIndex([0, 1, 2]);
    for (const o of all) handles.set(o.id, new OccurrenceHandle(o.id, sparse));
    expect(() =>
      capture.capture(
        all.map((o) => o.id),
        lookup,
        handles,
        p.revision,
      ),
    ).toThrow("existing mechanical source budget");
  });
  it("canonical test compilation is byte-identical across translations/oblique placements and cannot borrow an official same-name definition", async () => {
    const p = project(),
      before = exportLDraw(p),
      all = occurrences(p),
      fallback = {
        "custom.dat": "0 !LDRAW_ORG Part\n3 16 0 0 0 900 0 0 0 900 0",
      };
    const a = await memberLocalOf(p, all[0].id, fallback),
      b = await memberLocalOf(p, all[1].id, fallback);
    expect(a.vertices).toEqual(b.vertices);
    expect(a.indices).toEqual(b.indices);
    expect(Math.max(...a.vertices)).toBe(1);
    expect(a.namespace).toBe("project");
    expect(a.frame).toEqual(all[0].transform);
    expect(b.frame).toEqual(all[1].transform);
    const world = await meshOf(p, [all[1].id]);
    expect(Array.from(world.vertices)).not.toEqual(Array.from(b.vertices));
    expect(exportLDraw(p)).toBe(before);
    expect(occurrences(p)).toEqual(all);
  });
  it("validates the complete source-bound local map and refuses stale ID/frame/namespace, partial or corrupt inputs", async () => {
    const p = mechanismFixture(),
      { sources } = await playSources(p, ["door"]),
      source = sources[0];
    expect(() => validatePlayMechanismSource(source, p.revision)).not.toThrow();
    const id = Object.keys(source.memberLocals!)[0],
      original = source.memberLocals![id];
    for (const patch of [
      { revision: p.revision + 1 },
      { occurrenceId: "other" },
      { namespace: "official" },
      { frame: { ...identity(), position: [123, 0, 0] } },
      { indices: new Uint32Array([999999, 0, 1]) },
      { vertices: new Float64Array([NaN, 0, 0]) },
    ]) {
      source.memberLocals![id] = { ...original, ...patch } as typeof original;
      expect(() => validatePlayMechanismSource(source, p.revision)).toThrow(
        "match every authored source member",
      );
    }
    source.memberLocals![id] = original;
    for (const key of Object.keys(source.memberLocals!)) {
      const local = source.memberLocals![key];
      source.memberLocals![key] = {
        ...local,
        vertices: new Float64Array(300003 * 3),
      };
      source.members[key] = {
        ...source.members[key],
        vertices: new Float32Array(300003 * 3),
      };
    }
    expect(() => validatePlayMechanismSource(source, p.revision)).toThrow(
      "existing mechanical source budget",
    );
    delete source.memberLocals![id];
    expect(() => validatePlayMechanismSource(source, p.revision)).toThrow(
      "include every source member",
    );
  });
});
