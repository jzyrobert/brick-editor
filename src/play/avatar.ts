import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { AvatarPose, PlaySnapshotReport } from "./types";
import type { Vec3 } from "../core/types";
import { conversion } from "../core/math";

/**
 * Original procedural brick figure ("original-brick-figure-v1"): a cylindrical
 * head with a top stud, a tapered torso, bent arms ending in C-shaped hands, a
 * hip block and two straight legs, in toy-figure proportions scaled to the
 * 72 LDU collision profile. It is modelled here from primitives (no copied
 * meshes, logos or prints) and needs no download, so third person works
 * offline and costs a dozen small draw calls.
 *
 * Units LDU, local +Y up, front -Z, feet (collider anchor) at y = 0. A rigid
 * hierarchy: torso and hips are fixed to the root; the neck has declared yaw
 * and pitch axes; each shoulder and hip is one X hinge (positive swings the
 * limb forward). Every joint rotates about its declared pivot, never a mesh
 * bounding-box centre.
 */
export const JOINTS = {
  head: {
    pivot: [0, 52.5, 0],
    axis: [0, 1, 0],
    pitchAxis: [1, 0, 0],
    limits: [-0.873, 0.873],
    pitchLimits: [-0.35, 0.45],
  },
  leftShoulder: { pivot: [-11, 48.5, 0], axis: [1, 0, 0], limits: [-1.4, 1.4] },
  rightShoulder: { pivot: [11, 48.5, 0], axis: [1, 0, 0], limits: [-1.4, 1.4] },
  leftHip: { pivot: [-6.6, 26, 0], axis: [1, 0, 0], limits: [-1.4, 1.4] },
  rightHip: { pivot: [6.6, 26, 0], axis: [1, 0, 0], limits: [-1.4, 1.4] },
} as const;
export const AVATAR_COLORS = Object.freeze({
  torso: "#ec6b35",
  legs: "#255b9a",
  skin: "#f7c95e",
  detail: "#26333f",
});
type Part = {
  geometry: THREE.BufferGeometry;
  material: keyof typeof AVATAR_COLORS;
};
const place = (
  geometry: THREE.BufferGeometry,
  position: number[],
  rotation: number[] = [0, 0, 0],
  scale: number[] = [1, 1, 1],
) =>
  geometry.applyMatrix4(
    new THREE.Matrix4().compose(
      new THREE.Vector3(...position),
      new THREE.Quaternion().setFromEuler(
        new THREE.Euler(rotation[0], rotation[1], rotation[2], "YXZ"),
      ),
      new THREE.Vector3(...scale),
    ),
  );
/** Box whose top face is narrower in X by `taper` (the torso wedge). */
function taperedBox(w: number, h: number, d: number, topWidth: number) {
  const box = new THREE.BoxGeometry(w, h, d, 1, 1, 1);
  const position = box.getAttribute("position");
  for (let i = 0; i < position.count; i++)
    if (position.getY(i) > 0)
      position.setX(i, (position.getX(i) * topWidth) / w);
  box.computeVertexNormals();
  return box;
}
function head(): Part[] {
  // Lathe profile: a short cylinder with softly rounded rims.
  const profile = [
    [0, 0],
    [6.4, 0],
    [7.9, 0.5],
    [8.6, 2],
    [8.6, 12],
    [7.9, 13.5],
    [6.4, 14],
    [0, 14],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  const skull = place(new THREE.LatheGeometry(profile, 24), [0, 1, 0]);
  const stud = place(new THREE.CylinderGeometry(5, 5, 3.4, 18), [0, 16.6, 0]);
  const neck = place(
    new THREE.CylinderGeometry(4.6, 4.6, 1.6, 14),
    [0, 0.3, 0],
  );
  const eye = (x: number) =>
    place(
      new THREE.SphereGeometry(1.05, 10, 8),
      [x, 9.4, -8.35],
      [0, 0, 0],
      [1, 1.25, 0.55],
    );
  const smile = place(
    new THREE.TorusGeometry(3.1, 0.48, 6, 18, Math.PI * 0.7),
    [0, 7.4, -8.5],
    [0, 0, Math.PI * 1.15],
  );
  return [
    { geometry: skull, material: "skin" },
    { geometry: stud, material: "skin" },
    { geometry: neck, material: "skin" },
    { geometry: eye(-3.1), material: "detail" },
    { geometry: eye(3.1), material: "detail" },
    { geometry: smile, material: "detail" },
  ];
}
function arm(side: -1 | 1): Part[] {
  // Upper arm splays slightly outward, the forearm is bent forward at a
  // fixed elbow, and the hand is an open C ring.
  const splay = 0.16 * side;
  const upper = place(
    new THREE.CylinderGeometry(3, 3.4, 14, 12),
    [side * 1.1, -6.5, 0],
    [0, 0, splay],
  );
  const shoulder = place(new THREE.SphereGeometry(3.3, 12, 8), [0, 0, 0]);
  const elbow: Vec3 = [side * 2.2, -13, 0];
  const forward = new THREE.Vector3(0, -0.45, -1).normalize();
  const forearmCentre = new THREE.Vector3(...elbow).addScaledVector(
    forward,
    3.2,
  );
  const tilt = Math.atan2(-forward.z, -forward.y); // cylinder Y axis ∥ forearm
  const forearm = place(
    new THREE.CylinderGeometry(3, 3.1, 7, 12),
    forearmCentre.toArray(),
    [tilt, 0, 0],
  );
  const wristCentre = new THREE.Vector3(...elbow).addScaledVector(forward, 7.3);
  const wrist = place(
    new THREE.CylinderGeometry(1.5, 1.5, 2.6, 10),
    wristCentre.toArray(),
    [tilt, 0, 0],
  );
  const handCentre = new THREE.Vector3(...elbow).addScaledVector(forward, 10.6);
  // Ring axis across the body; opening faces forward-up.
  const hand = place(
    new THREE.TorusGeometry(2.4, 1.15, 8, 16, Math.PI * 1.5),
    handCentre.toArray(),
    [0, Math.PI / 2, Math.PI / 6 - Math.PI * 1.75],
  );
  return [
    { geometry: upper, material: "torso" },
    { geometry: shoulder, material: "torso" },
    { geometry: forearm, material: "torso" },
    { geometry: wrist, material: "skin" },
    { geometry: hand, material: "skin" },
  ];
}
function leg(): Part[] {
  // The leg hangs from the hip pivot to the sole at the collider anchor.
  // Nothing rises above the pivot, so a seated leg stays inside its box.
  const shin = place(new THREE.BoxGeometry(12.4, 21.5, 11), [0, -15.25, 0]);
  const toe = place(new THREE.BoxGeometry(12.4, 4, 3), [0, -24, -7]);
  const pin = place(
    new THREE.CylinderGeometry(4.5, 4.5, 12.4, 14),
    [0, -4.6, 0.5],
    [0, 0, Math.PI / 2],
  );
  const thigh = place(new THREE.BoxGeometry(12.4, 4.6, 11), [0, -6.8, 0]);
  return [
    { geometry: shin, material: "legs" },
    { geometry: thigh, material: "legs" },
    { geometry: toe, material: "legs" },
    { geometry: pin, material: "legs" },
  ];
}
function body(): Part[] {
  const torso = place(taperedBox(27, 23, 13.6, 18), [0, 41, 0]);
  const hips = place(new THREE.BoxGeometry(27, 6.5, 13.2), [0, 26.25, 0]);
  return [
    { geometry: torso, material: "torso" },
    { geometry: hips, material: "legs" },
  ];
}

export class BrickAvatar {
  group = new THREE.Group();
  private joints = new Map<string, THREE.Group>();
  private materials = new Map<string, THREE.Material>();
  private geometries: THREE.BufferGeometry[] = [];
  constructor() {
    for (const [name, color] of Object.entries(AVATAR_COLORS))
      this.materials.set(
        name,
        new THREE.MeshStandardMaterial({
          color,
          roughness: 0.42,
          metalness: 0,
        }),
      );
    // One merged mesh per material per rigid node keeps draw calls low.
    const attach = (parent: THREE.Object3D, parts: Part[], name: string) => {
      for (const key of Object.keys(AVATAR_COLORS)) {
        const own = parts
          .filter((p) => p.material === key)
          .map((p) => {
            const g = p.geometry.index ? p.geometry.toNonIndexed() : p.geometry;
            if (g !== p.geometry) p.geometry.dispose();
            g.deleteAttribute("uv");
            return g;
          });
        if (!own.length) continue;
        const geometry = mergeGeometries(own)!;
        own.forEach((g) => g.dispose());
        this.geometries.push(geometry);
        const mesh = new THREE.Mesh(geometry, this.materials.get(key)!);
        mesh.name = name + " " + key;
        mesh.castShadow = false;
        mesh.receiveShadow = false;
        parent.add(mesh);
      }
    };
    attach(this.group, body(), "body");
    for (const [name, joint] of Object.entries(JOINTS)) {
      const g = new THREE.Group();
      g.name = name;
      g.position.fromArray(joint.pivot);
      g.rotation.order = "YXZ";
      this.group.add(g);
      this.joints.set(name, g);
      attach(
        g,
        name === "head"
          ? head()
          : name.includes("Shoulder")
            ? arm(name.startsWith("left") ? -1 : 1)
            : leg(),
        name,
      );
    }
    this.group.name = "Play avatar (not an authored part)";
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
    this.group.rotation.y = pose.heading + Math.PI;
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
  }
  dispose() {
    this.group.removeFromParent();
    this.geometries.forEach((g) => g.dispose());
    this.materials.forEach((m) => m.dispose());
  }
}
