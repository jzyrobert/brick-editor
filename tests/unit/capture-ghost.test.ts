import { expect, it, vi } from "vitest";
import * as THREE from "three";
import { SceneAdapter } from "../../src/render/adapter";
import { LayerGhost } from "../../src/render/layerGhost";
import { importLDraw } from "../../src/ldraw/io";
import { occurrences } from "../../src/core/document";
import { resolveQuality } from "../../src/render/quality";
import { resolveLook } from "../../src/render/look";

it.each([false, true])(
  "restores view materials after readback failure (capture dimming: %s)",
  async (dimPrevious) => {
    const project = importLDraw("1 4 0 0 0 1 0 0 0 1 0 0 0 1 3001.dat");
    project.layers.other = {
      id: "other",
      name: "Other",
      visible: true,
      locked: false,
      order: 1,
    };
    const occurrence = occurrences(project)[0];
    const original = new THREE.MeshBasicMaterial({ color: "red" });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(), original);
    const group = new THREE.Group();
    group.add(mesh);
    let release!: () => void;
    let started!: () => void;
    const entered = new Promise<void>((resolve) => {
      started = resolve;
    });
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const failure = new Error("readback fixture failure");
    const draw = vi.fn(() => {
      expect(mesh.material === original).toBe(!dimPrevious);
      expect(mesh.material.opacity).toBe(dimPrevious ? 0.3 : 1);
    });
    // Use the real capture state machine and real material replacement. Only the
    // WebGL driver is replaced, allowing a deterministic async compilation pause.
    const adapter = Object.assign(Object.create(SceneAdapter.prototype), {
      revision: project.revision,
      project,
      handles: new Map([[occurrence.id, group]]),
      layerGhost: new LayerGhost(),
      instructionDimming: new LayerGhost(0.3),
      ghostLayerId: null,
      floorFocusSpec: null,
      floorHidden: new Set(),
      floorGhosted: new Set(),
      annotations: new THREE.Group(),
      guidesShown: false,
      labelsShown: false,
      captureActive: false,
      contextEpoch: 0,
      contextWork: new AbortController(),
      compileForCapture: async () => {
        started();
        await gate;
      },
      scene: new THREE.Scene(),
      grid: new THREE.Group(),
      selection: new THREE.Group(),
      ghost: new THREE.Group(),
      controls: { enabled: true },
      renderer: {
        capabilities: { maxTextureSize: 4096 },
        getRenderTarget: () => null,
        getContext: () => ({ isContextLost: () => false }),
        setRenderTarget: vi.fn(),
        compileAsync: async () => {
          started();
          await gate;
        },
        readRenderTargetPixels: () => {
          throw failure;
        },
        info: { render: {} },
      },
      ready: async () => {},
      currentCamera: () => ({}),
      currentQuality: () => resolveQuality("balanced"),
      look: resolveLook("standard"),
      lookResourceProfile: "desktop",
      applyQuality: vi.fn(),
      lightingManifest: () => ({}),
      aspect: vi.fn(),
      drawDirect: draw,
      resize: vi.fn(),
      invalidate: vi.fn(),
      batches: { rebuild: vi.fn() },
    }) as SceneAdapter;
    const capture = adapter.image({
      ...(dimPrevious ? { instructionNewIds: [] } : {}),
      revision: project.revision,
      width: 16,
      height: 16,
      format: "png",
      quality: "photo",
      visibility: { mode: "all" },
      background: { type: "transparent" },
    });
    const rejected = expect(capture).rejects.toBe(failure);
    await entered;
    adapter.ghostOtherLayers(occurrence.layerId);
    adapter.ghostOtherLayers(null);
    adapter.ghostOtherLayers("other");
    adapter.showStep([], []);
    expect(group.visible).toBe(true);
    expect(mesh.material === original).toBe(!dimPrevious);
    release();
    await rejected;
    expect(draw).toHaveBeenCalledOnce();
    expect(mesh.material).not.toBe(original);
    expect(mesh.material.opacity).toBeCloseTo(0.18 * 0.3);
    expect(group.visible).toBe(false);
    adapter.showStep(null);
    expect(group.visible).toBe(true);
    expect(mesh.material.opacity).toBeCloseTo(0.18);
    adapter.ghostOtherLayers(null);
    expect(mesh.material).toBe(original);
    mesh.geometry.dispose();
    original.dispose();
  },
);
