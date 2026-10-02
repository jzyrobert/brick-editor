import { describe, expect, it, vi } from "vitest";
import { PDFDocument, PDFPage, StandardFonts } from "pdf-lib";
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
  it("preserves authored interface captions when an incoming lot has the same reference", () => {
    const p = fixture();
    const ids = occurrences(p).map((o) => o.id);
    p.instructionPlans.test.stepMetadata = [
      {
        targets: [
          {
            label: "R1",
            occurrenceId: ids[1],
            position: [100, 0, 0],
            caption: "Locate the open socket mouth.",
          },
          {
            label: "1",
            occurrenceId: ids[1],
            position: [100, 0, 0],
            caption: "incoming",
          },
        ],
      },
    ];
    const prepared = prepareInstructionPlan(p, "test");
    expect(prepared.steps[0].targets![0].caption).toBe(
      "Locate the open socket mouth.",
    );
    expect(prepared.steps[0].targets![1].caption).not.toBe("incoming");
  });
  it("publishes authored pictorial trays and receiving views without generation claims", async () => {
    const p = fixture();
    p.instructionPlans.test.presentation = "pictorial";
    p.instructionPlans.test.stepMetadata = [
      { alternateCamera: camera, alternateBeforePlacement: true },
    ];
    const out = await publishInstructions(p, "test", renderer(p.revision), {
      format: "html-zip",
    });
    const files = unzipSync(out.bytes),
      html = strFromU8(files["index.html"]);
    expect(html).toContain("instruction-tray");
    expect(html).toContain("Receiving assembly before placement");
    const prepared = JSON.parse(strFromU8(files["instructions.json"]));
    expect(prepared.presentation).toBe("pictorial");
    expect(prepared.generation).toBeUndefined();
    expect(prepared.assemblyValidated).toBe(false);
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
        backdrop: "blank",
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
  it("keeps complete action notes on the diagram page before lots and receiving legends", async () => {
    const p = fixture();
    p.instructionPlans.test.presentation = "pictorial";
    const notes =
      "Support each loose roof plate from beneath. Keep the chimney upright and grip both sides. If the grip hides the receiving studs, choose another supported grip before placing the roof.";
    p.instructionPlans.test.stepMetadata = [
      {
        notes,
        targets: Array.from({ length: 8 }, (_, i) => ({
          label: `R${i + 1}`,
          position: [0, 0, 0] as [number, number, number],
          caption: "Receiving candidate; fit and handling need review.",
        })),
      },
    ];
    const text = vi.spyOn(PDFPage.prototype, "drawText");
    try {
      await publishInstructions(p, "test", renderer(p.revision), {
        format: "pdf",
      });
      const title = text.mock.calls.findIndex(
        ([value]) => value === "Step 1 of 2",
      );
      const main = text.mock.contexts[title];
      const lines = text.mock.calls.flatMap(([value], index) =>
        text.mock.contexts[index] === main ? [value] : [],
      );
      expect(lines.join(" ")).toContain(notes);
      expect(
        lines.findIndex((line) => line.startsWith("Support each")),
      ).toBeLessThan(lines.indexOf("Parts needed for this step"));
    } finally {
      text.mockRestore();
    }
  });
  it("keeps degree and fractional dimensions readable in PDF action text", async () => {
    const p = fixture();
    const notes =
      "Fit Slope 30° 1 × 1 × ⅔ and plate 4½ × ⅝; verify the receiving face.";
    p.instructionPlans.test.stepMetadata = [{ notes }];
    const text = vi.spyOn(PDFPage.prototype, "drawText");
    try {
      const out = await publishInstructions(p, "test", renderer(p.revision), {
        format: "pdf",
      });
      expect(text.mock.calls.map(([line]) => line).join(" ")).toContain(
        "Slope 30 deg 1 x 1 x 2/3 and plate 4 1/2 x 5/8",
      );
      expect(out.report.steps[0].notes).toBe(notes);
      expect(p.instructionPlans.test.stepMetadata[0].notes).toBe(notes);
    } finally {
      text.mockRestore();
    }
  });
  it("wraps action text to actual printed glyph advances within the page margin", async () => {
    const p = fixture();
    p.instructionPlans.test.presentation = "pictorial";
    const notes = Array.from({ length: 40 }, () => "AVATAR WAY TO AVENUE").join(
      " ",
    );
    p.instructionPlans.test.stepMetadata = [{ notes }];
    const text = vi.spyOn(PDFPage.prototype, "drawText");
    try {
      await publishInstructions(p, "test", renderer(p.revision), {
        format: "pdf",
      });
      const document = await PDFDocument.create();
      const font = await document.embedFont(StandardFonts.Helvetica);
      const lines = text.mock.calls.filter(([line]) =>
        /AVATAR|AVENUE/.test(line),
      );
      expect(lines.map(([line]) => line).join(" ")).toBe(notes);
      for (const [line, options] of lines) {
        const actualWidth = [...line].reduce(
          (width, character) =>
            width + font.widthOfTextAtSize(character, options!.size!),
          0,
        );
        expect(options!.x! + actualWidth).toBeLessThanOrEqual(555);
      }
    } finally {
      text.mockRestore();
    }
  });
  it("keeps a complete accessory action, receiver and legend with the part on its main page", async () => {
    const p = fixture();
    p.instructionPlans.test.presentation = "pictorial";
    const notes =
      "Use this radio's long cylindrical handle at the pictured hand grip. The bare-hand detail identifies this receiver before the accessory is present. Keep any supplied torso, arms and hands together; support the hand while checking handle seating and grip orientation. Source grip/handle axes differ by 14.5 degrees and their centre-line gap is 0.1 LDU. Physical fit and retention remain unverified; do not force the source pose. Receiver detail omits surrounding parts; locate it in the main view. Physical access remains unverified.";
    const legend = "Grip centre; handle fit and retention remain unverified.";
    p.instructionPlans.test.stepMetadata = [
      {
        notes,
        alternateCamera: camera,
        alternateBeforePlacement: true,
        targets: [{ label: "P", position: [0, 0, 0], caption: legend }],
      },
    ];
    const text = vi.spyOn(PDFPage.prototype, "drawText");
    const images = vi.spyOn(PDFPage.prototype, "drawImage");
    try {
      const out = await publishInstructions(p, "test", renderer(p.revision), {
        format: "pdf",
      });
      const title = text.mock.calls.findIndex(
        ([line]) => line === "Step 1 of 2",
      );
      const page = text.mock.contexts[title];
      const lines = text.mock.calls.flatMap(([line], i) =>
        text.mock.contexts[i] === page ? [line] : [],
      );
      expect(lines.join(" ")).toContain(notes);
      expect(lines.join(" ")).toContain(`P: ${legend}`);
      const drawn = images.mock.calls.flatMap(([, rect], i) =>
        images.mock.contexts[i] === page ? [rect] : [],
      );
      expect(drawn).toContainEqual(
        expect.objectContaining({ width: 120, height: 90 }),
      );
      expect((await PDFDocument.load(out.bytes)).getPageCount()).toBe(4);
      expect(out.report.steps[0].notes).toBe(notes);
    } finally {
      text.mockRestore();
      images.mockRestore();
    }
  });
  it("keeps a page-sized marker's complete qualifier together instead of splitting its final lines", async () => {
    const p = fixture();
    p.instructionPlans.test.presentation = "pictorial";
    const caption =
      Array.from({ length: 80 }, (_, i) => `ReceiverAlpha${i}`).join(" ") +
      " Final physical fit unverified.";
    p.instructionPlans.test.stepMetadata = [
      {
        notes:
          "Support the receiving body while checking this source position.",
        alternateCamera: camera,
        alternateBeforePlacement: true,
        targets: [{ label: "R1", position: [0, 0, 0], caption }],
      },
    ];
    const text = vi.spyOn(PDFPage.prototype, "drawText");
    try {
      await publishInstructions(p, "test", renderer(p.revision), {
        format: "pdf",
      });
      const first = text.mock.calls.findIndex(([line]) =>
        line.startsWith("R1: ReceiverAlpha0"),
      );
      const last = text.mock.calls.findIndex(([line]) =>
        line.includes("fit unverified."),
      );
      expect(first).toBeGreaterThan(-1);
      expect(last).toBeGreaterThan(first);
      expect(text.mock.contexts[first]).toBe(text.mock.contexts[last]);
      const lines = text.mock.calls
        .slice(first, last + 1)
        .map(([line]) => line)
        .join(" ");
      expect(lines).toBe(`R1: ${caption}`);
      expect(text.mock.calls[first][1]?.y).toBeGreaterThan(160);
    } finally {
      text.mockRestore();
    }
  });
  it("keeps a fourth short marker legend with its mixed-lot receiving diagram", async () => {
    const parts = [
      ["3004.dat", "Brick 1 x 2"],
      ["3622.dat", "Brick 1 x 3"],
      ["60602.dat", "Glass for Window 1 x 2 x 3"],
    ];
    const p = importLDraw(
      "0 FILE main.ldr\n0 Mixed lots\n" +
        parts
          .map(([ref], i) => `1 4 ${i * 40} 0 0 1 0 0 0 1 0 0 0 1 ${ref}`)
          .join("\n") +
        parts
          .map(
            ([ref, name]) =>
              `\n0 FILE ${ref}\n0 ${name}\n0 !LDRAW_ORG Unofficial_Part\n3 16 0 0 0 20 0 0 0 20 0`,
          )
          .join(""),
    );
    const notes = "Check the frame and hold the section. ".repeat(9).trim();
    const targets = Array.from({ length: 4 }, (_, i) => ({
      label: String(i + 1),
      position: [0, 0, 0] as [number, number, number],
      caption: "Glass for Window 1 x 2 x 3 / Red",
    }));
    p.instructionPlans = {
      test: {
        name: "Mixed lots",
        presentation: "pictorial",
        steps: [occurrences(p).map((o) => o.id)],
        stepMetadata: [
          { notes, contextCamera: camera, alternateCamera: camera, targets },
        ],
      },
    };
    const text = vi.spyOn(PDFPage.prototype, "drawText");
    try {
      const out = await publishInstructions(p, "test", renderer(p.revision), {
        format: "pdf",
      });
      const first = text.mock.calls.findIndex(
        ([line]) => line === "Step 1 of 1",
      );
      const main = text.mock.contexts[first];
      const lines = text.mock.calls.flatMap(([line], i) =>
        text.mock.contexts[i] === main ? [line] : [],
      );
      expect(lines.join(" ")).toContain(notes);
      for (const target of targets)
        expect(lines).toContain(`${target.label}: ${target.caption}`);
      expect((await PDFDocument.load(out.bytes)).getPageCount()).toBe(3);
    } finally {
      text.mockRestore();
    }
  });
  it("continues an oversized file-local part title without truncation or footer overlap", async () => {
    const longName =
      Array.from({ length: 700 }, (_, i) => `SourceName${i}`).join(" ") +
      " END_TITLE";
    const p = importLDraw(
      `0 FILE main.ldr\n0 Long title fixture\n1 4 0 0 0 1 0 0 0 1 0 0 0 1 3001.dat\n0 FILE 3001.dat\n0 ${longName}\n0 !LDRAW_ORG Unofficial_Part\n3 16 0 0 0 20 0 0 0 20 0`,
    );
    p.instructionPlans.test = {
      name: "Long source title",
      presentation: "pictorial",
      steps: [occurrences(p).map((o) => o.id)],
    };
    const text = vi.spyOn(PDFPage.prototype, "drawText");
    try {
      const result = await publishInstructions(
        p,
        "test",
        renderer(p.revision),
        { format: "pdf" },
      );
      expect(result.report.steps[0].lots[0].name).toBe(longName);
      const lines = text.mock.calls.filter(([line]) =>
        /SourceName|END_TITLE/.test(line),
      );
      expect(lines.map(([line]) => line).join(" ")).toBe(`1 x ${longName}`);
      expect(lines.every(([, rect]) => rect!.y! >= 55 && rect!.y! <= 750)).toBe(
        true,
      );
      expect(
        new Set(
          text.mock.calls.flatMap(([line], i) =>
            /SourceName|END_TITLE/.test(line) ? [text.mock.contexts[i]] : [],
          ),
        ).size,
      ).toBeGreaterThan(1);
    } finally {
      text.mockRestore();
    }
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

it("publishes explicit per-step additions for dimming without changing the authored plan", async () => {
  const p = fixture(),
    original = structuredClone(p),
    r = renderer(p.revision);
  const artifact = await publishInstructions(p, "test", r, {
    format: "png-zip",
    dimPrevious: true,
  });
  expect(p).toEqual(original);
  expect(
    vi.mocked(r.image).mock.calls.map(([request]) => request.instructionNewIds),
  ).toEqual(p.instructionPlans.test.steps);
  expect(artifact.report.dimPrevious).toBe(true);
  expect(artifact.report.warnings.join(" ")).toContain("opaque pale context");
  expect(r.setCamera).toHaveBeenLastCalledWith(camera);
});
