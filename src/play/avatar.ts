import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { AvatarPose, PlaySnapshotReport } from "./types";
import type { Vec3 } from "../core/types";
import { frameRotation } from "./physics-frame";
import { conversion } from "../core/math";
import { ensure } from "../core/types";
import { sha256 } from "../core/hash";
import { normalizeBfcSource } from "../render/bfc-source";
import { repairFaceNormals } from "../render/raw-primitives";
import { parseLDraw } from "../render/part-compile-core";
import avatarPackLock from "./avatar-pack-lock.json";
import {
  AVATAR_PARTS,
  JOINTS,
  JOINT_ORDER,
  type AvatarNode,
} from "./avatar-assembly";

export { JOINTS, AVATAR_COLOURS } from "./avatar-assembly";

/**
 * The Play figure: a rigid hierarchy assembled from official LDraw minifig
 * parts (head 3626cp01 with hair 3901, torso 973, arms 3818/3819, hands 3820,
 * hips 3815b, legs 3816c/3817c) at true minifig scale, placed by the standard
 * assembly offsets in avatar-assembly.ts. The parts come from a small
 * dedicated pack (public/libraries/avatar-minifig-*, pinned by
 * avatar-pack-lock.json and precached for offline use), are compiled once per
 * page through the scene's own LDraw parse path, and shared by every session.
 *
 * Units LDU, local +Y up, front −Z, feet (the collider anchor) at y = 0. The
 * torso and hips are fixed to the root; the neck yaws and pitches; each
 * shoulder and hip is one hinge about its declared axis (positive swings the
 * limb forward); each hand turns about its wrist. Every node is one mesh with
 * baked vertex colours and a shared material: eight draw calls in all.
 */
export type AvatarGeometry = ReadonlyMap<AvatarNode, THREE.BufferGeometry>;

type PackManifest = {
  releaseId: string;
  files: { path: string; sha256: string; bytes: number }[];
  bundle: { path: string; sha256: string; bytes: number };
};
/** Library sources keyed by reference name ("973.dat", "s/973s01.dat"). */
export type AvatarSources = { files: Map<string, string>; colours: string };

/** Verifies the pinned manifest and the single-request bundle, then splits it. */
export async function avatarSourcesFromPack(
  manifestText: string,
  bundle: Uint8Array,
): Promise<AvatarSources> {
  ensure(
    (await sha256(manifestText)) === avatarPackLock.manifestSha256,
    "INVALID_INPUT",
    "Figure pack manifest hash mismatch",
  );
  const manifest = JSON.parse(manifestText) as PackManifest;
  ensure(
    bundle.length === manifest.bundle.bytes &&
      (await sha256(bundle)) === manifest.bundle.sha256,
    "INVALID_INPUT",
    "Figure pack bundle hash mismatch",
  );
  const decoder = new TextDecoder();
  const files = new Map<string, string>();
  let offset = 0,
    colours = "";
  for (const f of manifest.files) {
    const text = decoder.decode(bundle.subarray(offset, offset + f.bytes));
    offset += f.bytes;
    if (f.path === "LDConfig.ldr")
      colours = text
        .split(/\r?\n/)
        .filter((l) => /^0 !COLOUR/.test(l))
        .join("\n");
    else files.set(f.path.replace(/^(parts|p)\//, ""), text);
  }
  return { files, colours };
}

async function fetchPack(): Promise<AvatarSources> {
  const base =
    (import.meta.env?.BASE_URL ?? "/") +
    "libraries/" +
    avatarPackLock.releaseId +
    "/";
  const manifest = await fetch(base + "manifest.json");
  ensure(manifest.ok, "REFERENCE_MISSING", "Figure pack unavailable");
  const text = await manifest.text();
  const { bundle } = JSON.parse(text) as PackManifest;
  const r = await fetch(base + bundle.path);
  ensure(r.ok, "REFERENCE_MISSING", "Figure pack bundle unavailable");
  return avatarSourcesFromPack(text, new Uint8Array(await r.arrayBuffer()));
}

/** Compiles one merged, vertex-coloured mesh geometry per rig node. */
export async function buildAvatarGeometry(
  sources: AvatarSources,
): Promise<AvatarGeometry> {
  const colourLines = new Map<string, string>();
  for (const l of sources.colours.split("\n")) {
    const code = /\sCODE\s+(\d+)/.exec(l)?.[1];
    if (code) colourLines.set(code, l);
  }
  const closure = (roots: string[]) => {
    const keep = new Map<string, string>();
    const visit = (name: string) => {
      if (keep.has(name)) return;
      const text = sources.files.get(name);
      ensure(!!text, "REFERENCE_MISSING", "Figure part missing: " + name);
      keep.set(name, text!);
      for (const m of text!.matchAll(/^\s*1\s+(?:\S+\s+){13}(.+?)\s*$/gm))
        visit(m[1].replaceAll("\\", "/").toLowerCase());
    };
    roots.forEach(visit);
    return keep;
  };
  const out = new Map<AvatarNode, THREE.BufferGeometry>();
  for (const node of ["body", ...JOINT_ORDER] as AvatarNode[]) {
    const parts = AVATAR_PARTS.filter((p) => p.node === node);
    const lines = parts.map(
      (p) =>
        `1 ${p.colour} ${p.position.join(" ")} ${p.basis.join(" ")} ${p.part}`,
    );
    const library = closure(parts.map((p) => p.part));
    const body = [...library]
      .map(([name, text]) => `0 FILE ${name}\n${text}`)
      .join("\n");
    const used = new Set(["16", "24"]);
    for (const m of (lines.join("\n") + "\n" + body).matchAll(
      /^\s*[1-5]\s+(\d+)\s/gm,
    ))
      used.add(m[1]);
    const colours = [...used]
      .map((c) => colourLines.get(c))
      .filter(Boolean)
      .join("\n");
    const text = normalizeBfcSource(
      `0 FILE __figure_${node}__.ldr\n${colours}\n${lines.join("\n")}\n${body}`,
    );
    // The scene's own parse path (vendored loader, no network resolution).
    const { group: parsed, dependencyFailure } = await parseLDraw(text);
    ensure(
      !dependencyFailure,
      "REFERENCE_MISSING",
      "Figure part dependency missing: " + dependencyFailure,
    );
    const group = repairFaceNormals(parsed);
    group.updateMatrixWorld(true);
    const pieces: THREE.BufferGeometry[] = [];
    group.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (!mesh.isMesh) return;
      const source = mesh.geometry.index
        ? mesh.geometry.toNonIndexed()
        : mesh.geometry.clone();
      source.applyMatrix4(mesh.matrixWorld);
      // A mirrored reference (3819 is 3818 mirrored, 3816c is 3817c) reaches
      // here as a negative-determinant matrix, which Three.js would cull
      // with reversed front faces; baked in, each triangle's winding flips.
      if (mesh.matrixWorld.determinant() < 0)
        for (const name of ["position", "normal"]) {
          const attr = source.getAttribute(name);
          for (let i = 0; i + 2 < attr.count; i += 3)
            for (let k = 0; k < attr.itemSize; k++) {
              const t = attr.getComponent(i + 1, k);
              attr.setComponent(i + 1, k, attr.getComponent(i + 2, k));
              attr.setComponent(i + 2, k, t);
            }
        }
      const materials = Array.isArray(mesh.material)
        ? mesh.material
        : [mesh.material];
      const groups = source.groups.length
        ? source.groups
        : [
            {
              start: 0,
              count: source.getAttribute("position").count,
              materialIndex: 0,
            },
          ];
      const position = source.getAttribute("position");
      const normal = source.getAttribute("normal");
      for (const group of groups) {
        const g = {
          start: group.start,
          count: Math.min(group.count, position.count - group.start),
          materialIndex: group.materialIndex,
        };
        if (g.count <= 0) continue;
        const colour = (
          materials[g.materialIndex ?? 0] as THREE.MeshStandardMaterial
        ).color;
        const piece = new THREE.BufferGeometry();
        const slice = (
          attr: THREE.BufferAttribute | THREE.InterleavedBufferAttribute,
        ) => {
          const array = new Float32Array(g.count * 3);
          for (let i = 0; i < g.count; i++)
            for (let k = 0; k < 3; k++)
              array[i * 3 + k] = attr.getComponent(g.start + i, k);
          return new THREE.BufferAttribute(array, 3);
        };
        piece.setAttribute("position", slice(position));
        piece.setAttribute("normal", slice(normal));
        const colours = new Float32Array(g.count * 3);
        for (let i = 0; i < g.count; i++)
          colours.set([colour.r, colour.g, colour.b], i * 3);
        piece.setAttribute("color", new THREE.BufferAttribute(colours, 3));
        pieces.push(piece);
      }
      source.dispose();
    });
    // The loader's own geometry and materials are no longer needed.
    group.traverse((object) => {
      const drawable = object as THREE.Mesh;
      drawable.geometry?.dispose();
      for (const m of Array.isArray(drawable.material)
        ? drawable.material
        : drawable.material
          ? [drawable.material]
          : [])
        m.dispose();
    });
    ensure(pieces.length > 0, "REFERENCE_MISSING", "Figure part empty");
    const merged = mergeGeometries(pieces)!;
    pieces.forEach((p) => p.dispose());
    merged.computeBoundingBox();
    merged.computeBoundingSphere();
    out.set(node, merged);
  }
  return out;
}

let shared: Promise<AvatarGeometry> | undefined;
/**
 * The figure's geometry, compiled once per page from the pinned pack and
 * shared by every Play session (never disposed; about 60 kB of vertices).
 */
export function loadAvatarGeometry(): Promise<AvatarGeometry> {
  if (!shared) {
    shared = fetchPack().then(buildAvatarGeometry);
    shared.catch(() => (shared = undefined));
  }
  return shared;
}

export class BrickAvatar {
  group = new THREE.Group();
  private joints = new Map<string, THREE.Group>();
  private material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.35,
    metalness: 0,
  });
  private attached = false;
  /** Empty until `attach` supplies the compiled geometry. */
  constructor(geometry?: AvatarGeometry) {
    this.group.name = "Play avatar (not an authored part)";
    for (const name of JOINT_ORDER) {
      const joint = JOINTS[name];
      const g = new THREE.Group();
      g.name = name;
      g.position.fromArray(joint.pivot);
      g.rotation.order = joint.order;
      g.rotation.fromArray([...joint.restEuler, joint.order]);
      this.joints.set(name, g);
    }
    for (const name of JOINT_ORDER) {
      const parent = JOINTS[name].parent;
      (parent === "body" ? this.group : this.joints.get(parent)!).add(
        this.joints.get(name)!,
      );
    }
    if (geometry) this.attach(geometry);
  }
  get ready() {
    return this.attached;
  }
  /** Adds one mesh per node (shared geometry, this figure's material). */
  attach(geometry: AvatarGeometry) {
    if (this.attached) return;
    this.attached = true;
    for (const [node, g] of geometry) {
      const mesh = new THREE.Mesh(g, this.material);
      mesh.name = node + " mesh";
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      // Body meshes go first so the root's own children list the fixed
      // torso/hips before the joint groups.
      if (node === "body") this.group.add(mesh);
      else this.joints.get(node)!.add(mesh);
    }
  }
  /** What is drawn (diagnostics for tests; not a stable contract). */
  describe() {
    let meshes = 0,
      triangles = 0;
    this.group.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      meshes++;
      triangles += mesh.geometry.getAttribute("position").count / 3;
    });
    this.group.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(this.group, true);
    return {
      pack: avatarPackLock.releaseId,
      parts: [...new Set(AVATAR_PARTS.map((p) => p.part))],
      ready: this.attached,
      visible: this.group.visible,
      meshes,
      triangles,
      height: this.attached ? box.max.y - box.min.y : 0,
      joints: Object.fromEntries(
        [...this.joints].map(([name, g]) => [
          name,
          [g.rotation.x, g.rotation.y, g.rotation.z],
        ]),
      ),
    };
  }
  /** Joint group by name (tests and diagnostics). */
  joint(name: keyof typeof JOINTS) {
    return this.joints.get(name)!;
  }
  /**
   * Poses the figure. `view` is the render-interpolated root and pose from
   * PlaySession.presentation(); without it the latest tick state is shown.
   */
  update(
    state: PlaySnapshotReport,
    view?: { position: Vec3; avatar: AvatarPose },
  ) {
    const pose = view?.avatar ?? state.avatar;
    this.group.visible =
      state.avatarVisible && state.cameraMode === "third-person";
    this.group.position.fromArray(conversion(view?.position ?? state.position));
    this.group.position.y += pose.bob ?? 0;
    // Player size: the whole figure (and its joint offsets) scales uniformly.
    this.group.scale.setScalar(state.playerScale ?? 1);
    if (pose.basis)
      this.group.quaternion
        .copy(frameRotation({ position: [0, 0, 0], basis: pose.basis }))
        .multiply(
          new THREE.Quaternion().setFromAxisAngle(
            new THREE.Vector3(0, 1, 0),
            Math.PI,
          ),
        );
    else this.group.rotation.set(0, pose.heading + Math.PI, 0);
    const neck = this.joints.get("head")!;
    neck.rotation.y = pose.headYaw;
    neck.rotation.x = pose.headPitch ?? 0;
    for (const name of [
      "leftShoulder",
      "rightShoulder",
      "leftHip",
      "rightHip",
    ] as const)
      this.joints.get(name)!.rotation.x = pose[name];
    this.joints.get("leftWrist")!.rotation.z = pose.leftWrist ?? 0;
    this.joints.get("rightWrist")!.rotation.z = pose.rightWrist ?? 0;
  }
  dispose() {
    this.group.removeFromParent();
    // Geometry is shared across sessions (see loadAvatarGeometry).
    this.material.dispose();
  }
}
