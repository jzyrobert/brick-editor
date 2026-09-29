import * as THREE from "three";
import { LDrawLoader } from "./vendor/LDrawLoader.js";
import { LDrawConditionalLineMaterial } from "three/addons/materials/LDrawConditionalLineMaterial.js";
import { AppError } from "../core/types";
import { repairFaceNormals } from "./raw-primitives";
import { NotPortable, packPart } from "./part-record";
import { indexPrototypeGeometry } from "./geometry-index";

/**
 * Version of everything that shapes compiled part geometry: the vendored
 * loader (and the three release it is pinned to), BFC normalization, normal
 * repair, triangle indexing (geometry-index.ts) and the record layout. Bump it whenever any of those change so
 * persistent caches never serve geometry from an older compiler.
 */
export const PART_COMPILER_VERSION = `bpc3:three-r${THREE.REVISION}`;

/**
 * Parses one self-contained LDraw compile source (every referenced file is
 * embedded as a `0 FILE` block). Network resolution is disabled: a reference
 * to anything not embedded is reported as `dependencyFailure`.
 */
export async function parseLDraw(text: string) {
  let dependencyFailure: string | undefined;
  const manager = new THREE.LoadingManager();
  const loader = new LDrawLoader(manager);
  loader.setConditionalLineMaterial(LDrawConditionalLineMaterial);
  loader.setMaterials([]);
  manager.setURLModifier((url) => {
    dependencyFailure = url;
    throw new AppError(
      "REFERENCE_MISSING",
      "Unresolved dependency (network resolution disabled): " + url,
    );
  });
  loader.setFileMap(
    Object.fromEntries(
      [...text.matchAll(/^0 FILE (.+)$/gm)].map((m) => [m[1], m[1]]),
    ),
  );
  let group: THREE.Group;
  try {
    group = await new Promise<THREE.Group>((resolve, reject) =>
      (
        loader.parse as unknown as (
          text: string,
          resolve: (g: THREE.Group) => void,
          reject: (e: unknown) => void,
        ) => void
      )(text, resolve, reject),
    );
  } catch (e) {
    // The loader rejects with a generic error once every lookup failed.
    if (dependencyFailure)
      throw new AppError(
        "REFERENCE_MISSING",
        "Unresolved dependency: " + dependencyFailure,
      );
    throw e;
  }
  return { group, dependencyFailure };
}

/** Whether any embedded file after the first (the compile's own header
 * file) defines colours: such file-local materials cannot be rebuilt from
 * the shared colour table, so the part is compiled on the main thread. */
export function definesLocalColours(text: string) {
  const first = text.indexOf("0 FILE ");
  const second = text.indexOf("\n0 FILE ", first + 1);
  return second >= 0 && /^\s*0\s+!COLOUR\s/m.test(text.slice(second));
}

/**
 * Compiles a normalized compile source into a packed part record
 * (src/render/part-record.ts), or null when its materials cannot be shared by
 * colour code. Runs in compile workers; the main thread uses it only as a
 * fallback.
 */
export async function compilePartRecord(
  text: string,
): Promise<ArrayBuffer | null> {
  if (definesLocalColours(text)) return null;
  const { group, dependencyFailure } = await parseLDraw(text);
  if (dependencyFailure)
    throw new AppError(
      "REFERENCE_MISSING",
      "Unresolved dependency: " + dependencyFailure,
    );
  repairFaceNormals(group);
  // The renderer's triangle indexing (geometry-index.ts), done here once so
  // records are stored indexed; it must follow normal repair.
  indexPrototypeGeometry(group);
  try {
    return packPart(group);
  } catch (e) {
    if (e instanceof NotPortable) return null;
    throw e;
  }
}
