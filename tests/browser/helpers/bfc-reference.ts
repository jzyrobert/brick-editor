import * as THREE from "three";
import { LDrawLoader } from "three/examples/jsm/loaders/LDrawLoader.js";
import { LDrawConditionalLineMaterial } from "three/examples/jsm/materials/LDrawConditionalLineMaterial.js";

// Independent whole-MPD loader: no editor importer, occurrence expansion,
// source-context reconstruction, prototype compilation or render batching.
export async function referencePixels(text: string, z: number) {
  const loader = new LDrawLoader().setConditionalLineMaterial(
    LDrawConditionalLineMaterial,
  );
  // The fixture's faces are isolated triangles, so loader smoothing could only pair a
  // double-sided (NOCLIP/uncertified) face with its reversed twin and cancel both normals,
  // rendering them unlit. Culling and winding are what this reference checks.
  loader.smoothNormals = false;
  const group = await new Promise<THREE.Group>((resolve, reject) =>
    (
      loader.parse as unknown as (
        s: string,
        ok: (g: THREE.Group) => void,
        fail: (e: unknown) => void,
      ) => void
    )(text, resolve, reject),
  );
  const renderer = new THREE.WebGLRenderer({ alpha: true });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#ffffff");
  group.rotation.x = Math.PI;
  scene.add(group);
  scene.add(new THREE.HemisphereLight(0xffffff, 0xa4adb2, 3));
  const sun = new THREE.DirectionalLight(0xffffff, 3);
  sun.position.set(250, 600, 300);
  scene.add(sun);
  const fill = new THREE.DirectionalLight(0xcbdcf0, 1.5);
  fill.position.set(-300, 150, -200);
  scene.add(fill);
  const camera = new THREE.OrthographicCamera(-165, 165, 110, -110, 0.5, 10000);
  camera.position.set(0, 55, -z);
  camera.up.set(0, 1, 0);
  camera.lookAt(0, 55, 0);
  const target = new THREE.WebGLRenderTarget(384, 256, {
    format: THREE.RGBAFormat,
    type: THREE.UnsignedByteType,
    colorSpace: THREE.SRGBColorSpace,
  });
  await renderer.compileAsync(scene, camera);
  renderer.setRenderTarget(target);
  renderer.render(scene, camera);
  const pixels = new Uint8Array(384 * 256 * 4);
  renderer.readRenderTargetPixels(target, 0, 0, 384, 256, pixels);
  const flipped = new Uint8Array(pixels.length);
  for (let y = 0; y < 256; y++)
    flipped.set(
      pixels.subarray((255 - y) * 384 * 4, (256 - y) * 384 * 4),
      y * 384 * 4,
    );
  target.dispose();
  group.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.geometry) m.geometry.dispose();
    if (m.material)
      for (const material of Array.isArray(m.material)
        ? m.material
        : [m.material])
        material.dispose();
  });
  renderer.dispose();
  renderer.forceContextLoss();
  return Array.from(flipped);
}
(window as unknown as { bfcReference: typeof referencePixels }).bfcReference =
  referencePixels;
