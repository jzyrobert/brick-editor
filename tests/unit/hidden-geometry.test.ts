import { describe, expect, it } from "vitest";
import * as THREE from "three";
import {
  classifyGeometry,
  cullGeometry,
  keptPrimitives,
  shellBox,
  STUD_CULL,
  type StudAxis,
} from "../../src/render/hidden-geometry";
import { verifiedConnectors } from "../../src/catalog/connectors";
import { drawableTemplates } from "../../src/render/occurrence-handles";
import { compileOfficialPart } from "../helpers/compile-part";

async function part(ref: string) {
  const group = await compileOfficialPart(ref);
  const templates = drawableTemplates(group);
  const connectors = verifiedConnectors(ref) ?? [];
  const studs: StudAxis[] = connectors
    .filter((c) => c.kind === "stud")
    .map((c) => ({ p: c.p, axis: c.axis }));
  const meshes = templates.filter((t) => t.mesh).map((t) => t.object.geometry);
  const box = shellBox(meshes, studs);
  const drawables = templates.map((t) => ({
    template: t,
    kind: t.mesh ? "mesh" : t.conditional ? "conditional" : "lines",
    classes: classifyGeometry(t.object.geometry, !t.mesh, studs, box),
  }));
  return { group, studs, box, drawables };
}
const all = (n: number) => Array.from({ length: n }, (_, i) => i);
function counts(
  p: Awaited<ReturnType<typeof part>>,
  studs: number[],
  cavity: boolean,
) {
  return Object.fromEntries(
    p.drawables.map((d) => [
      d.kind,
      keptPrimitives(d.classes, { studs, cavity }),
    ]),
  );
}

describe("hidden-geometry classification", () => {
  it("finds the closed shell of plain bricks, plates and grooved tiles only", async () => {
    expect((await part("3001.dat")).box).toEqual({
      min: [-40, 0, -20],
      max: [40, 24, 20],
    });
    expect((await part("3020.dat")).box).toEqual({
      min: [-40, 0, -20],
      max: [40, 8, 20],
    });
    // The bottom groove is inset 1 LDU: still a closed shell.
    expect((await part("3068b.dat")).box).toEqual({
      min: [-20, 0, -20],
      max: [20, 8, 20],
    });
    // Round, sloped and window parts have visible faces inside their box.
    expect((await part("3062b.dat")).box).toBeNull();
    expect((await part("3039.dat")).box).toBeNull();
    expect((await part("60593.dat")).box).toBeNull();
  });
  it("leaves out only studs and the cavity: a covered 2 × 4 brick keeps 18 of 700 triangles", async () => {
    const brick = await part("3001.dat");
    expect(brick.studs).toHaveLength(8);
    expect(counts(brick, [], false)).toEqual({
      mesh: 700,
      lines: 472,
      conditional: 224,
    });
    expect(counts(brick, all(8), false)).toEqual({
      mesh: 316,
      lines: 216,
      conditional: 96,
    });
    // The outer box (top, four sides, bottom rim) and its outline remain.
    expect(counts(brick, all(8), true)).toEqual({
      mesh: 18,
      lines: 12,
      conditional: 0,
    });
    // Each stud accounts for the same share.
    const one = counts(brick, [3], false);
    expect(700 - one.mesh).toBe((700 - 316) / 8);
    const tile = await part("3068b.dat");
    expect(counts(tile, [], true).mesh).toBe(34);
    const round = await part("3062b.dat");
    expect(counts(round, [0], false)).toEqual({
      mesh: 288,
      lines: 112,
      conditional: 64,
    });
  });
  it("classifies only primitives inside a stud cylinder or strictly inside the shell", async () => {
    const brick = await part("3001.dat");
    const box = brick.box!;
    for (const d of brick.drawables) {
      const geometry = d.template.object.geometry;
      const position = geometry.getAttribute("position");
      const corners = d.template.mesh ? 3 : 2;
      for (let i = 0; i < d.classes.primitives; i++) {
        for (let c = 0; c < corners; c++) {
          const k = i * corners + c;
          const v = geometry.index ? geometry.index.getX(k) : k;
          const p = new THREE.Vector3().fromBufferAttribute(position, v);
          if (d.classes.stud[i]) {
            const s = brick.studs[d.classes.stud[i] - 1];
            const h = -(p.y - s.p[1]);
            expect(h).toBeGreaterThanOrEqual(-STUD_CULL.below);
            expect(h).toBeLessThanOrEqual(STUD_CULL.height);
            expect(Math.hypot(p.x - s.p[0], p.z - s.p[2])).toBeLessThanOrEqual(
              STUD_CULL.radius,
            );
          } else if (d.classes.cavity[i]) {
            expect(p.x).toBeGreaterThan(box.min[0]);
            expect(p.x).toBeLessThan(box.max[0]);
            expect(p.z).toBeGreaterThan(box.min[2]);
            expect(p.z).toBeLessThan(box.max[2]);
            expect(p.y).toBeGreaterThan(box.min[1]);
          }
        }
      }
    }
  });
  it("culled variants share the original attributes, keep groups consistent and are cached", async () => {
    const brick = await part("3001.dat");
    for (const d of brick.drawables) {
      const geometry = d.template.object.geometry;
      const hidden = { studs: all(8), cavity: true };
      const variant = cullGeometry(
        geometry,
        !d.template.mesh,
        d.classes,
        hidden,
      );
      expect(variant).not.toBe(geometry);
      expect(cullGeometry(geometry, !d.template.mesh, d.classes, hidden)).toBe(
        variant,
      );
      for (const [name, attribute] of Object.entries(geometry.attributes))
        expect(variant.getAttribute(name)).toBe(attribute);
      const corners = d.template.mesh ? 3 : 2;
      expect(variant.index!.count).toBe(
        keptPrimitives(d.classes, hidden) * corners,
      );
      const grouped = variant.groups.reduce((n, g) => n + g.count, 0);
      if (geometry.groups.length) expect(grouped).toBe(variant.index!.count);
      expect(variant.boundingSphere!.radius).toBe(
        geometry.boundingSphere!.radius,
      );
      // Nothing hidden: the original itself.
      expect(
        cullGeometry(geometry, !d.template.mesh, d.classes, {
          studs: [],
          cavity: false,
        }),
      ).toBe(geometry);
    }
  });
});
