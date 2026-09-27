import { expect, it } from "vitest";
import { Group, Mesh, MeshStandardMaterial } from "three";
import { LDrawLoader } from "three/examples/jsm/loaders/LDrawLoader.js";
import { LDrawConditionalLineMaterial } from "three/examples/jsm/materials/LDrawConditionalLineMaterial.js";
import { importLDraw } from "../../src/ldraw/io";
import { occurrences } from "../../src/core/document";
import { occurrenceSourceContext } from "../../src/render/source-context";
it("independent primitive compilation retains ancestor custom colours and local certified winding", async () => {
  const p = importLDraw(
    "0 FILE root.ldr\n0 !COLOUR OriginalOrange CODE 100 VALUE #ED9851 EDGE #74471F\n1 100 0 0 0 1 0 0 0 1 0 0 0 1 child.ldr\n0 FILE child.ldr\n0 BFC CERTIFY CCW\n0 BFC INVERTNEXT\n1 4 0 0 0 1 0 0 0 1 0 0 0 1 3001.dat\n3 16 0 0 0 20 0 0 0 -20 0\n0 NOFILE\n",
  );
  const o = occurrences(p).find((o) => o.node.kind === "geometry")!,
    context = occurrenceSourceContext(p, o);
  expect(context).toContain("!COLOUR OriginalOrange");
  expect(context).toContain("BFC CERTIFY CCW");
  expect(context).not.toContain("INVERTNEXT");
  const loader = new LDrawLoader().setConditionalLineMaterial(
    LDrawConditionalLineMaterial,
  );
  const text = `0 FILE __render__.ldr\n${context}\n3 ${o.colorCode} 0 0 0 20 0 0 0 -20 0\n`;
  const group = await new Promise<Group>((resolve, reject) =>
    (
      loader.parse as unknown as (
        text: string,
        resolve: (g: Group) => void,
        reject: (e: unknown) => void,
      ) => void
    )(text, resolve, reject),
  );
  let vertices = 0;
  const colors: string[] = [];
  group.traverse((object) => {
    if (object instanceof Mesh) {
      vertices += object.geometry.getAttribute("position").count;
      const materials = Array.isArray(object.material)
        ? object.material
        : [object.material];
      colors.push(
        ...materials.map((m) =>
          (m as MeshStandardMaterial).color.getHexString(),
        ),
      );
      object.geometry.dispose();
      materials.forEach((m) => m.dispose());
    }
  });
  expect(vertices).toBe(3);
  expect(colors).toContain("ed9851");
});
