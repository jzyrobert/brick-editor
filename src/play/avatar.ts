import * as THREE from "three";
import type { PlaySnapshotReport } from "./types";
import { conversion } from "../core/math";

/** Original procedural rigid figure. Units LDU, local Y upward, feet anchor y=0.
 * Only neck yaw and shoulder/hip X hinges exist; torso is rigid to pelvis.
 */
export const JOINTS = {
  head: { pivot: [0, 54, 0], axis: [0, 1, 0], limits: [-0.7, 0.7] },
  leftShoulder: { pivot: [-15, 51, 0], axis: [1, 0, 0], limits: [-1.1, 1.1] },
  rightShoulder: { pivot: [15, 51, 0], axis: [1, 0, 0], limits: [-1.1, 1.1] },
  leftHip: { pivot: [-7, 27, 0], axis: [1, 0, 0], limits: [-0.9, 0.9] },
  rightHip: { pivot: [7, 27, 0], axis: [1, 0, 0], limits: [-0.9, 0.9] },
} as const;
export class BrickAvatar {
  group = new THREE.Group();
  private joints = new Map<string, THREE.Group>();
  private materials: THREE.Material[] = [];
  private geometries: THREE.BufferGeometry[] = [];
  constructor() {
    const material = (color: string) => {
      const m = new THREE.MeshStandardMaterial({ color, roughness: 0.7 });
      this.materials.push(m);
      return m;
    };
    const blue = material("#255b9a"),
      orange = material("#ec6b35"),
      skin = material("#f7c95e"),
      dark = material("#26333f");
    const box = (
      parent: THREE.Object3D,
      size: number[],
      position: number[],
      mat: THREE.Material,
    ) => {
      const geometry = new THREE.BoxGeometry(
        ...(size as [number, number, number]),
      );
      this.geometries.push(geometry);
      const mesh = new THREE.Mesh(geometry, mat);
      mesh.position.fromArray(position);
      parent.add(mesh);
    };
    box(this.group, [25, 24, 14], [0, 40, 0], orange);
    box(this.group, [26, 7, 15], [0, 26, 0], blue);
    for (const [name, joint] of Object.entries(JOINTS)) {
      const g = new THREE.Group();
      g.position.fromArray(joint.pivot);
      this.group.add(g);
      this.joints.set(name, g);
      if (name === "head") {
        box(g, [19, 18, 18], [0, 9, 0], skin);
        box(g, [3, 3, 1], [-4, 11, -9.5], dark);
        box(g, [3, 3, 1], [4, 11, -9.5], dark);
      } else if (name.includes("Shoulder")) {
        box(g, [8, 22, 10], [0, -11, 0], orange);
        box(g, [8, 7, 10], [0, -25, 0], skin);
      } else {
        box(g, [11, 25, 13], [0, -12.5, 0], blue);
        box(g, [11, 5, 19], [0, -24, -3], dark);
      }
    }
    this.group.name = "Play avatar (not an authored part)";
  }
  update(state: PlaySnapshotReport) {
    this.group.visible =
      state.avatarVisible && state.cameraMode === "third-person";
    this.group.position.fromArray(conversion(state.position));
    this.group.rotation.y = state.avatar.heading + Math.PI;
    this.joints.get("head")!.rotation.y = state.avatar.headYaw;
    for (const name of [
      "leftShoulder",
      "rightShoulder",
      "leftHip",
      "rightHip",
    ] as const)
      this.joints.get(name)!.rotation.x = state.avatar[name];
  }
  dispose() {
    this.group.removeFromParent();
    this.geometries.forEach((g) => g.dispose());
    this.materials.forEach((m) => m.dispose());
  }
}
