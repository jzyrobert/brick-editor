import { describe, expect, it, vi } from "vitest";
import { PDFDocument } from "pdf-lib";
import { unzipSync, strFromU8 } from "fflate";
import { importLDraw } from "../../src/ldraw/io";
import { occurrences } from "../../src/core/document";
import {
  prepareInstructionPlan,
  publishInstructions,
  type PublishRenderer,
} from "../../src/instructions/publish";
import type { CameraSpec } from "../../src/core/types";
const camera: CameraSpec = {
  space: "ldraw",
  projection: "perspective",
  position: [100, -200, 300],
  target: [0, 0, 0],
  up: [0, -1, 0],
  fovDeg: 45,
  near: 0.5,
  far: 10000,
};
function fixture() {
  const p = importLDraw(
    "0 FILE main.ldr\n0 Test\n1 4 0 0 0 1 0 0 0 1 0 0 0 1 3001.dat\n0 STEP\n1 1 100 0 0 1 0 0 0 1 0 0 0 1 3003.dat",
  );
  const ids = occurrences(p).map((o) => o.id);
  p.instructionPlans = {
    test: { name: "Explicit reverse order", steps: [[ids[1]], [ids[0]]] },
  };
  return p;
}
// A valid 1x1 RGBA PNG keeps these domain/composition tests independent of WebGL.
const png = Uint8Array.from(
  Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLttAAAAABJRU5ErkJggg==",
    "base64",
  ),
);
function renderer(revision: number) {
  const image = vi.fn(async () => ({ blob: new Blob([png]), manifest: {} }));
  return {
    ready: vi.fn(async () => ({ revision, ready: true, warnings: [] })),
    currentCamera: () => camera,
    setCamera: vi.fn(),
    image,
  } as unknown as PublishRenderer;
}
describe("instruction publication", () => {
  it("preserves explicit order, counts leaf parts, and rejects duplicate or incomplete coverage", () => {
    const p = fixture(),
      ids = occurrences(p).map((o) => o.id),
      plan = prepareInstructionPlan(p, "test");
    expect(plan.steps[0].addedIds).toEqual([ids[1]]);
    expect(plan.steps[1].cumulativeIds).toEqual([ids[1], ids[0]]);
    expect(plan.inventory.reduce((n, l) => n + l.quantity, 0)).toBe(2);
    expect(plan.assemblyValidated).toBe(false);
    p.instructionPlans.test.steps = [[ids[0]], [ids[0]]];
    expect(() => prepareInstructionPlan(p, "test")).toThrow(/more than once/);
    p.instructionPlans.test.steps = [[ids[0]]];
    expect(() => prepareInstructionPlan(p, "test")).toThrow(/missing/);
  });
  it("captures only cumulative IDs in sequence and restores camera on failure", async () => {
    const p = fixture(),
      r = renderer(p.revision);
    vi.mocked(r.image).mockRejectedValueOnce(new Error("GPU lost"));
    await expect(
      publishInstructions(p, "test", r, { format: "png-zip" }),
    ).rejects.toThrow("GPU lost");
    expect(r.setCamera).toHaveBeenLastCalledWith(camera);
    expect(r.image).toHaveBeenCalledWith(
      expect.objectContaining({
        visibility: {
          mode: "occurrences",
          occurrenceIds: p.instructionPlans.test.steps[0],
        },
      }),
    );
  });
  it("writes PNG ZIP and escaped browsable HTML with exact coverage JSON", async () => {
    const p = fixture();
    p.title = '<script>alert("unsafe")</script>';
    const r = renderer(p.revision);
    const out = await publishInstructions(p, "test", r, { format: "html-zip" });
    const files = unzipSync(out.bytes);
    expect(Object.keys(files)).toEqual([
      "step-001.png",
      "step-002.png",
      "instructions.json",
      "index.html",
    ]);
    expect(strFromU8(files["index.html"])).not.toContain("<script>alert");
    expect(strFromU8(files["index.html"])).toContain("&lt;script&gt;");
    expect(
      JSON.parse(strFromU8(files["instructions.json"])).coverage.complete,
    ).toBe(true);
    expect(r.image).toHaveBeenCalledTimes(2);
  });
  it("creates a printable PDF with cover, sequential step pages and inventory", async () => {
    const p = fixture();
    const out = await publishInstructions(p, "test", renderer(p.revision), {
      format: "pdf",
    });
    expect(out.mimeType).toBe("application/pdf");
    const pdf = await PDFDocument.load(out.bytes);
    expect(pdf.getPageCount()).toBe(4);
    expect(pdf.getTitle()).toBe(p.title);
  });
  it("cancels between sequential captures and rejects stale revision and pixel budgets", async () => {
    const p = fixture(),
      r = renderer(p.revision),
      abort = new AbortController();
    await expect(
      publishInstructions(p, "test", r, {
        format: "png-zip",
        signal: abort.signal,
        onProgress: (done) => {
          if (done === 1) abort.abort();
        },
      }),
    ).rejects.toThrow(/cancelled/);
    expect(r.image).toHaveBeenCalledTimes(1);
    await expect(
      publishInstructions(p, "test", renderer(p.revision + 1), {
        format: "pdf",
      }),
    ).rejects.toThrow(/changed/);
    await expect(
      publishInstructions(p, "test", r, {
        format: "pdf",
        width: 10000,
        height: 10000,
      }),
    ).rejects.toThrow(/megapixels/);
  });
  it("rejects a revision change during final PDF composition without restoring a stale camera", async () => {
    const p = fixture(),
      r = renderer(p.revision);
    let checks = 0;
    vi.mocked(r.ready).mockImplementation(async () => ({
      revision: ++checks >= 5 ? p.revision + 1 : p.revision,
      ready: true,
      warnings: [],
    }));
    await expect(
      publishInstructions(p, "test", r, { format: "pdf" }),
    ).rejects.toThrow(/composing the PDF/);
    expect(r.setCamera).toHaveBeenCalledTimes(2);
  });
});
it("publishes per-step cameras and escaped notes while restoring the original view", async () => {
  const p = fixture(),
    view = {
      ...camera,
      position: [-300, -180, 100] as [number, number, number],
    },
    r = renderer(p.revision);
  p.instructionPlans.test.stepMetadata = [
    {
      camera: view,
      notes: "Turn the build <carefully>\nKeep this exact note.",
    },
    { notes: "Next step" },
  ];
  const artifact = await publishInstructions(p, "test", r, {
      format: "html-zip",
    }),
    files = unzipSync(artifact.bytes),
    report = JSON.parse(strFromU8(files["instructions.json"]));
  expect(r.setCamera).toHaveBeenNthCalledWith(1, view);
  expect(r.setCamera).toHaveBeenNthCalledWith(2, camera);
  expect(r.setCamera).toHaveBeenLastCalledWith(camera);
  expect(report.steps[0].camera).toEqual(view);
  expect(report.steps[0].notes).toBe(
    p.instructionPlans.test.stepMetadata[0].notes,
  );
  expect(strFromU8(files["index.html"])).toContain("&lt;carefully&gt;");
  const pdf = await publishInstructions(p, "test", renderer(p.revision), {
    format: "pdf",
  });
  expect((await PDFDocument.load(pdf.bytes)).getPageCount()).toBe(4);
});
