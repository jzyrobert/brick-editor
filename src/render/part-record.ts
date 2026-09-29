import * as THREE from "three";

/**
 * A compiled part as one transferable, storable ArrayBuffer: the loader's
 * object tree (groups, meshes, edge and conditional-edge lines with their
 * transforms, names and user data), every geometry attribute, and — instead of
 * material objects — which LDraw colour code and kind each material slot draws.
 *
 * Compile workers produce it (src/workers/part-compile.worker.ts), the
 * persistent geometry cache stores it, and the main thread rebuilds Three
 * objects around views of the same bytes (no copy) with its own shared
 * materials. Layout: u32 magic, u32 header length, UTF-8 JSON header, padding
 * to 4 bytes, then the arrays the header points into.
 */
export const PART_RECORD_MAGIC = 0x31525042; // "BPR1" little-endian
export type MaterialKind = "face" | "edge" | "conditional";
export type MaterialSlot = { code: string; kind: MaterialKind };
type ArrayType = "f32" | "u16" | "u32";
type ArrayRef = { o: number; n: number; t: ArrayType };
type ObjectType = "Group" | "Mesh" | "LineSegments" | "ConditionalLineSegments";
type ObjectRecord = {
  type: ObjectType;
  parent: number;
  name: string;
  p: number[];
  q: number[];
  s: number[];
  userData: Record<string, unknown>;
  geometry?: {
    attributes: {
      name: string;
      itemSize: number;
      normalized: boolean;
      array: ArrayRef;
    }[];
    index?: ArrayRef;
    /** count -1 encodes Infinity (JSON has no Infinity). */
    groups: { start: number; count: number; materialIndex: number }[];
  };
  materials?: MaterialSlot[];
  /** The loader assigned an array of materials (else a single material). */
  multi?: boolean;
};
export type PartRecordHeader = {
  format: 1;
  objects: ObjectRecord[];
  /** Distinct colour codes the materials draw in. */
  codes: string[];
  /** Surface triangles (diagnostics). */
  triangles: number;
};

const BYTES: Record<ArrayType, number> = { f32: 4, u16: 2, u32: 4 };
const align4 = (n: number) => (n + 3) & ~3;

/** Colour code and kind of a loader material, or undefined when it cannot be
 * rebuilt from the colour table alone (direct colours, missing colours). */
export function materialSlot(
  material: THREE.Material,
  object: THREE.Object3D,
): MaterialSlot | undefined {
  const code = material.userData?.code;
  if (typeof code !== "string" || !/^\d+$/.test(code)) return undefined;
  if ((object as THREE.Mesh).isMesh)
    return (material as THREE.MeshStandardMaterial).isMeshStandardMaterial
      ? { code, kind: "face" }
      : undefined;
  if ((material as THREE.ShaderMaterial).isShaderMaterial)
    return { code, kind: "conditional" };
  return (material as THREE.LineBasicMaterial).isLineBasicMaterial
    ? { code, kind: "edge" }
    : undefined;
}

export class NotPortable extends Error {}

/**
 * Packs a compiled loader group. Throws NotPortable when a material cannot be
 * described by `slot` (the caller then keeps the group itself).
 */
export function packPart(
  root: THREE.Object3D,
  slot: (
    material: THREE.Material,
    object: THREE.Object3D,
  ) => MaterialSlot | undefined = materialSlot,
): ArrayBuffer {
  const arrays: { array: ArrayLike<number>; ref: ArrayRef }[] = [];
  let offset = 0;
  const add = (array: THREE.TypedArray): ArrayRef => {
    const t: ArrayType | undefined =
      array instanceof Float32Array
        ? "f32"
        : array instanceof Uint16Array
          ? "u16"
          : array instanceof Uint32Array
            ? "u32"
            : undefined;
    if (!t) throw new NotPortable("Unsupported attribute array type");
    const ref = { o: offset, n: array.length, t };
    offset = align4(offset + array.length * BYTES[t]);
    arrays.push({ array, ref });
    return ref;
  };
  const objects: ObjectRecord[] = [];
  const codes = new Set<string>();
  let triangles = 0;
  const visit = (object: THREE.Object3D, parent: number) => {
    const drawable = object as THREE.Mesh | THREE.LineSegments;
    const isMesh = !!(drawable as THREE.Mesh).isMesh;
    const isLines = !!(drawable as THREE.LineSegments).isLineSegments;
    const type: ObjectType = isMesh
      ? "Mesh"
      : isLines
        ? (drawable as { isConditionalLine?: boolean }).isConditionalLine
          ? "ConditionalLineSegments"
          : "LineSegments"
        : "Group";
    if (type === "Group" && !(object as THREE.Group).isGroup)
      throw new NotPortable("Unsupported object " + object.type);
    const record: ObjectRecord = {
      type,
      parent,
      name: object.name,
      p: object.position.toArray(),
      q: object.quaternion.toArray(),
      s: object.scale.toArray(),
      userData: JSON.parse(JSON.stringify(object.userData ?? {})),
    };
    if (type !== "Group") {
      const geometry = drawable.geometry;
      if (Object.keys(geometry.morphAttributes).length)
        throw new NotPortable("Morph attributes are not supported");
      record.geometry = {
        attributes: Object.entries(geometry.attributes).map(
          ([name, attribute]) => {
            const buffer = attribute as THREE.BufferAttribute;
            if (
              !buffer.isBufferAttribute ||
              (attribute as { isInterleavedBufferAttribute?: boolean })
                .isInterleavedBufferAttribute
            )
              throw new NotPortable("Interleaved attributes are not supported");
            return {
              name,
              itemSize: buffer.itemSize,
              normalized: buffer.normalized,
              array: add(buffer.array),
            };
          },
        ),
        index: geometry.index ? add(geometry.index.array) : undefined,
        groups: geometry.groups.map((g) => ({
          start: g.start,
          count: Number.isFinite(g.count) ? g.count : -1,
          materialIndex: g.materialIndex ?? 0,
        })),
      };
      const list = Array.isArray(drawable.material)
        ? drawable.material
        : [drawable.material];
      record.multi = Array.isArray(drawable.material);
      record.materials = list.map((material) => {
        const s = slot(material, object);
        if (!s) throw new NotPortable("Material cannot be shared by code");
        codes.add(s.code);
        return s;
      });
      if (isMesh)
        triangles += Math.floor(
          (geometry.index?.count ??
            geometry.getAttribute("position")?.count ??
            0) / 3,
        );
    }
    objects.push(record);
    const self = objects.length - 1;
    for (const child of object.children) visit(child, self);
  };
  visit(root, -1);
  const header: PartRecordHeader = {
    format: 1,
    objects,
    codes: [...codes],
    triangles,
  };
  const json = new TextEncoder().encode(JSON.stringify(header));
  const dataStart = align4(8 + json.length);
  const buffer = new ArrayBuffer(dataStart + offset);
  const view = new DataView(buffer);
  view.setUint32(0, PART_RECORD_MAGIC, true);
  view.setUint32(4, json.length, true);
  new Uint8Array(buffer, 8, json.length).set(json);
  for (const { array, ref } of arrays) {
    const target =
      ref.t === "f32"
        ? new Float32Array(buffer, dataStart + ref.o, ref.n)
        : ref.t === "u16"
          ? new Uint16Array(buffer, dataStart + ref.o, ref.n)
          : new Uint32Array(buffer, dataStart + ref.o, ref.n);
    target.set(array);
  }
  return buffer;
}

/** Header and array views of a packed part; throws on a malformed buffer. */
export function unpackPart(buffer: ArrayBuffer) {
  const fail = () => {
    throw new Error("Malformed compiled part record");
  };
  if (buffer.byteLength < 8) fail();
  const view = new DataView(buffer);
  if (view.getUint32(0, true) !== PART_RECORD_MAGIC) fail();
  const length = view.getUint32(4, true);
  if (8 + length > buffer.byteLength) fail();
  const header = JSON.parse(
    new TextDecoder().decode(new Uint8Array(buffer, 8, length)),
  ) as PartRecordHeader;
  if (header?.format !== 1 || !Array.isArray(header.objects)) fail();
  const dataStart = align4(8 + length);
  const array = (ref: ArrayRef): THREE.TypedArray => {
    const bytes = BYTES[ref.t];
    if (
      !bytes ||
      !Number.isInteger(ref.o) ||
      !Number.isInteger(ref.n) ||
      ref.o < 0 ||
      ref.n < 0 ||
      ref.o % 4 !== 0 ||
      dataStart + ref.o + ref.n * bytes > buffer.byteLength
    )
      fail();
    return ref.t === "f32"
      ? new Float32Array(buffer, dataStart + ref.o, ref.n)
      : ref.t === "u16"
        ? new Uint16Array(buffer, dataStart + ref.o, ref.n)
        : new Uint32Array(buffer, dataStart + ref.o, ref.n);
  };
  return { header, array };
}

/**
 * Rebuilds the loader's object tree around views of `buffer`. `materialFor`
 * supplies the (shared) material for each colour code and kind.
 */
export function rebuildPart(
  buffer: ArrayBuffer,
  materialFor: (slot: MaterialSlot) => THREE.Material,
): THREE.Group {
  const { header, array } = unpackPart(buffer);
  const built: THREE.Object3D[] = [];
  for (const record of header.objects) {
    let object: THREE.Object3D;
    if (record.type === "Group") object = new THREE.Group();
    else {
      const geometry = new THREE.BufferGeometry();
      for (const attribute of record.geometry!.attributes)
        geometry.setAttribute(
          attribute.name,
          new THREE.BufferAttribute(
            array(attribute.array),
            attribute.itemSize,
            attribute.normalized,
          ),
        );
      if (record.geometry!.index)
        geometry.setIndex(
          new THREE.BufferAttribute(array(record.geometry!.index), 1),
        );
      for (const g of record.geometry!.groups)
        geometry.addGroup(
          g.start,
          g.count < 0 ? Infinity : g.count,
          g.materialIndex,
        );
      const materials = record.materials!.map(materialFor);
      const material = record.multi ? materials : materials[0];
      if (record.type === "Mesh") object = new THREE.Mesh(geometry, material);
      else {
        object = new THREE.LineSegments(geometry, material);
        if (record.type === "ConditionalLineSegments")
          (
            object as unknown as { isConditionalLine: boolean }
          ).isConditionalLine = true;
      }
    }
    object.name = record.name;
    object.position.fromArray(record.p);
    object.quaternion.fromArray(record.q);
    object.scale.fromArray(record.s);
    object.userData = record.userData;
    if (record.parent >= 0) {
      const parent = built[record.parent];
      if (!parent) throw new Error("Malformed compiled part record");
      parent.add(object);
    }
    built.push(object);
  }
  const root = built[0];
  if (!root || !(root as THREE.Group).isGroup)
    throw new Error("Malformed compiled part record");
  return root as THREE.Group;
}
