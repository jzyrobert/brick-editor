import { readFileSync } from "node:fs";
import type * as THREE from "three";
import { parseLDraw } from "../../src/render/part-compile-core";
import { repairFaceNormals } from "../../src/render/raw-primitives";
import { indexPrototypeGeometry } from "../../src/render/geometry-index";
import { normalizeBfcSource } from "../../src/render/bfc-source";
import { PACK, readPack } from "./official-geometry";
import { fullLibrarySources } from "../../scripts/full-library-node";

const SHARED = "0 !COLOUR Shared CODE 9900016 VALUE #808080 EDGE #333333";
const ldconfig = readFileSync(PACK + "/LDConfig.ldr", "utf8")
  .split(/\r?\n/)
  .filter((l) => l.startsWith("0 !COLOUR"))
  .join("\n");
const read = (name: string) =>
  readPack(name) ?? fullLibrarySources([name])[name];

/** A renderer-shaped compile source for one official part (catalogue pack,
 * else the complete library): shared main colour, LDConfig and closure. */
export function partSource(ref: string, colour = "9900016") {
  const blocks = new Map<string, string>();
  const visit = (text: string) => {
    for (const m of text.matchAll(/^\s*1\s+(?:\S+\s+){13}(.+?)\s*$/gm)) {
      const name = m[1].toLowerCase().replaceAll("\\", "/");
      const body = read(name);
      if (body === undefined || blocks.has(name)) continue;
      blocks.set(name, `0 FILE ${name}\n${body}`);
      visit(body);
    }
  };
  const line = `1 ${colour} 0 0 0 1 0 0 0 1 0 0 0 1 ${ref}`;
  visit(line);
  return normalizeBfcSource(
    [
      "0 FILE __render__.ldr",
      SHARED,
      ldconfig,
      "0 BFC CERTIFY CCW",
      line,
      ...blocks.values(),
    ].join("\n"),
  );
}

const compiled = new Map<string, Promise<THREE.Group>>();
/** The part compiled as the renderer compiles it (normals repaired, indexed). */
export function compileOfficialPart(ref: string): Promise<THREE.Group> {
  let result = compiled.get(ref);
  if (!result) {
    result = parseLDraw(partSource(ref)).then(({ group }) => {
      repairFaceNormals(group);
      indexPrototypeGeometry(group);
      return group;
    });
    compiled.set(ref, result);
  }
  return result;
}
