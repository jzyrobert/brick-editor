import { strToU8, zipSync } from "fflate";
import { occurrences } from "../core/document";
import { ensure, type Project, type CameraSpec } from "../core/types";
import type { SceneAdapter } from "../render/adapter";

export type PublishFormat = "png-zip" | "html-zip" | "pdf";
export type InstructionLot = {
  ref: string;
  colorCode: string;
  quantity: number;
};
export type PreparedPlan = {
  schemaVersion: 1;
  projectId: string;
  revision: number;
  title: string;
  name: string;
  method: "explicit-order";
  assemblyValidated: false;
  coverage: { intended: number; introduced: number; complete: true };
  steps: {
    number: number;
    addedIds: string[];
    cumulativeIds: string[];
    partCount: number;
    lots: InstructionLot[];
    notes?: string;
    camera?: CameraSpec;
  }[];
  inventory: InstructionLot[];
  warnings: string[];
};
const disclaimer =
  "Organisational sequence only. Connections, support and assembly feasibility have not been validated.";
export function prepareInstructionPlan(
  project: Project,
  planId: string,
): PreparedPlan {
  const plan = project.instructionPlans[planId];
  ensure(plan, "INVALID_INPUT", "Choose an instruction plan first.");
  ensure(
    plan.steps.length > 0 && plan.steps.length <= 200,
    "LIMIT_EXCEEDED",
    "Publishing supports 1 to 200 steps.",
  );
  const all = occurrences(project),
    byId = new Map(all.map((o) => [o.id, o]));
  ensure(
    all.length <= 5000,
    "LIMIT_EXCEEDED",
    "Publishing supports at most 5,000 placed occurrences.",
  );
  const seen = new Set<string>(),
    cumulative: string[] = [];
  let cumulativeCharacters = 0,
    publicationCharacters = 0;
  const lots = (ids: string[]) => {
    const grouped = new Map<string, InstructionLot>();
    for (const id of ids) {
      const o = byId.get(id)!;
      if (o.node.kind === "geometry") continue;
      const key = JSON.stringify([o.node.ref, o.colorCode]);
      const lot = grouped.get(key) ?? {
        ref: o.node.ref,
        colorCode: o.colorCode,
        quantity: 0,
      };
      lot.quantity++;
      grouped.set(key, lot);
    }
    return [...grouped.values()].sort(
      (a, b) =>
        a.ref.localeCompare(b.ref) || a.colorCode.localeCompare(b.colorCode),
    );
  };
  const steps = plan.steps.map((ids, index) => {
    ensure(
      ids.length > 0,
      "INVALID_INPUT",
      `Step ${index + 1} is empty. Remove empty steps before publishing.`,
    );
    for (const id of ids) {
      ensure(
        byId.has(id),
        "INVALID_INPUT",
        `Step ${index + 1} references a missing occurrence.`,
      );
      ensure(
        !seen.has(id),
        "INVALID_INPUT",
        `An occurrence is introduced more than once (step ${index + 1}).`,
      );
      seen.add(id);
      cumulative.push(id);
      cumulativeCharacters += id.length + 4;
    }
    publicationCharacters += cumulativeCharacters * 2;
    ensure(
      publicationCharacters <= 8_000_000,
      "LIMIT_EXCEEDED",
      "Instruction occurrence metadata exceeds the 8 million character budget. Use fewer steps.",
    );
    const stepLots = lots(ids);
    return {
      number: index + 1,
      addedIds: [...ids],
      cumulativeIds: [...cumulative],
      partCount: stepLots.reduce((n, l) => n + l.quantity, 0),
      lots: stepLots,
      ...structuredClone(plan.stepMetadata?.[index] ?? {}),
    };
  });
  ensure(
    seen.size === all.length,
    "INVALID_INPUT",
    `${all.length - seen.size} occurrences are missing from this plan. Regenerate or complete it before publishing.`,
  );
  const warnings = [
    disclaimer,
    "New parts are listed beside each cumulative view; prior geometry is not visually subdued.",
  ];
  if (all.some((o) => o.namespace !== "official"))
    warnings.push(
      "Custom geometry is included; loose drawing primitives are not counted as physical parts. Local part references are not marketplace inventory certification.",
    );
  return {
    schemaVersion: 1,
    projectId: project.id,
    revision: project.revision,
    title: project.title,
    name: plan.name,
    method: "explicit-order",
    assemblyValidated: false,
    coverage: { intended: all.length, introduced: seen.size, complete: true },
    steps,
    inventory: lots([...seen]),
    warnings,
  };
}
export type PublishRenderer = Pick<
  SceneAdapter,
  "ready" | "currentCamera" | "setCamera" | "image"
>;
export type PublishOptions = {
  format: PublishFormat;
  width?: number;
  height?: number;
  signal?: AbortSignal;
  onProgress?: (done: number, total: number) => void;
};
const escape = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
const pdfText = (s: string) =>
  s.replace(/×/g, "x").replace(/[^\x20-\x7e]/g, "?");
const MAX_BYTES = 100 * 1024 * 1024;

/** Sequential captures honor saved step cameras and restore the original view. */
export async function publishInstructions(
  project: Project,
  planId: string,
  renderer: PublishRenderer,
  options: PublishOptions,
) {
  const plan = prepareInstructionPlan(project, planId),
    width = options.width ?? 960,
    height = options.height ?? 720;
  ensure(
    ["png-zip", "html-zip", "pdf"].includes(options.format),
    "INVALID_INPUT",
    "Unknown instruction export format.",
  );
  ensure(
    Number.isInteger(width) &&
      Number.isInteger(height) &&
      width >= 64 &&
      height >= 64 &&
      width * height <= 4000000 &&
      width * height * plan.steps.length <= 64000000,
    "LIMIT_EXCEEDED",
    "Use dimensions of at least 64px, at most 4 megapixels per page and 64 megapixels for the full publication.",
  );
  const check = () =>
    ensure(
      !options.signal?.aborted,
      "CANCELLED",
      "Instruction publishing cancelled.",
    );
  check();
  const initial = await renderer.ready(project.revision, true);
  ensure(
    initial.revision === project.revision,
    "REVISION_CONFLICT",
    "The build changed. Restart publishing.",
  );
  const camera = structuredClone(renderer.currentCamera());
  const files: Record<string, Uint8Array> = {};
  let totalBytes = 0;
  const budget = (bytes: number) => {
    totalBytes += bytes;
    ensure(
      totalBytes <= MAX_BYTES,
      "LIMIT_EXCEEDED",
      "Instruction publication exceeds the 100 MiB output budget.",
    );
  };
  const pdfModule =
    options.format === "pdf" ? await import("pdf-lib") : undefined;
  const pdf = pdfModule ? await pdfModule.PDFDocument.create() : undefined;
  const font =
    pdf && pdfModule
      ? await pdf.embedFont(pdfModule.StandardFonts.Helvetica)
      : undefined;
  const ink = pdfModule?.rgb(0.18, 0.26, 0.3),
    accent = pdfModule?.rgb(0.73, 0.32, 0.12);
  let pages = 0;
  const page = (title: string) => {
    ensure(
      pages < 1000,
      "LIMIT_EXCEEDED",
      "Instruction PDF exceeds the 1,000-page budget.",
    );
    const p = pdf!.addPage([595.28, 841.89]);
    pages++;
    p.drawText(pdfText(title).slice(0, 72), {
      x: 40,
      y: 790,
      size: 20,
      font,
      color: ink,
    });
    p.drawText(`Brick Editor | ${pages}`, {
      x: 40,
      y: 25,
      size: 9,
      font,
      color: ink,
    });
    return p;
  };
  if (pdf) {
    pdf.setTitle(project.title);
    pdf.setSubject(disclaimer);
    pdf.setCreator("Brick Editor");
    pdf.setCreationDate(new Date(0));
    pdf.setModificationDate(new Date(0));
    const cover = page(project.title);
    cover.drawText(pdfText(plan.name).slice(0, 88), {
      x: 40,
      y: 742,
      size: 16,
      font,
      color: accent,
    });
    cover.drawText(
      `${plan.steps.length} steps | ${plan.inventory.reduce((n, l) => n + l.quantity, 0)} parts`,
      { x: 40, y: 702, size: 14, font, color: ink },
    );
    cover.drawText("A sequence for reviewing your build, one step at a time.", {
      x: 40,
      y: 660,
      size: 12,
      font,
      color: ink,
    });
    cover.drawText(
      "Connections, support and assembly feasibility are not validated.",
      { x: 40, y: 625, size: 11, font, color: ink },
    );
    cover.drawText(
      "Full Unicode labels and occurrence IDs are in attached instructions.json.",
      { x: 40, y: 600, size: 10, font, color: ink },
    );
  }
  options.onProgress?.(0, plan.steps.length);
  try {
    for (const step of plan.steps) {
      check();
      const state = await renderer.ready(project.revision, true);
      ensure(
        state.revision === project.revision,
        "REVISION_CONFLICT",
        "The build changed while publishing.",
      );
      renderer.setCamera(step.camera ?? camera);
      const image = await renderer.image({
        revision: project.revision,
        width,
        height,
        format: "png",
        visibility: { mode: "occurrences", occurrenceIds: step.cumulativeIds },
        background: { type: "solid", color: "#ffffff" },
        quality: "photo",
        strict: true,
      });
      check();
      const bytes = new Uint8Array(await image.blob.arrayBuffer());
      budget(bytes.byteLength);
      const name = `step-${String(step.number).padStart(3, "0")}.png`;
      if (pdf) {
        const png = await pdf.embedPng(bytes);
        const p = page(`Step ${step.number} of ${plan.steps.length}`);
        const scale = Math.min(515 / png.width, 450 / png.height);
        p.drawImage(png, {
          x: (595.28 - png.width * scale) / 2,
          y: 295,
          width: png.width * scale,
          height: png.height * scale,
        });
        p.drawText(
          `${step.partCount} new parts | ${step.cumulativeIds.length} cumulative occurrences`,
          { x: 40, y: 760, size: 11, font, color: ink },
        );
        p.drawText("Parts needed for this step", {
          x: 40,
          y: 265,
          size: 13,
          font,
          color: accent,
        });
        let listPage = p,
          y = 242;
        for (const lot of step.lots) {
          if (y < 55) {
            listPage = page(`Step ${step.number} - parts continued`);
            y = 750;
          }
          listPage.drawText(
            pdfText(
              `${lot.quantity} x ${lot.ref} | colour ${lot.colorCode}`,
            ).slice(0, 92),
            { x: 40, y, size: 11, font, color: ink },
          );
          y -= 18;
        }
        if (step.notes) {
          const wrap = (raw: string) => {
            const lines: string[] = [];
            let line = "";
            for (const character of pdfText(raw)) {
              if (line && font!.widthOfTextAtSize(line + character, 11) > 515) {
                lines.push(line);
                line = "";
              }
              line += character;
            }
            lines.push(line);
            return lines;
          };
          for (const raw of step.notes.split("\n"))
            for (const line of wrap(raw)) {
              if (y < 55) {
                listPage = page(`Step ${step.number} - notes continued`);
                y = 750;
              }
              listPage.drawText(pdfText(line), {
                x: 40,
                y,
                size: 11,
                font,
                color: ink,
              });
              y -= 16;
            }
        }
      } else files[name] = bytes;
      options.onProgress?.(step.number, plan.steps.length);
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    }
    check();
    ensure(
      (await renderer.ready(project.revision, true)).revision ===
        project.revision,
      "REVISION_CONFLICT",
      "The build changed while publishing.",
    );
    const json = strToU8(
      JSON.stringify({ ...plan, camera, width, height }, null, 2),
    );
    budget(json.byteLength);
    if (pdf) {
      let p = page("Complete parts inventory"),
        y = 750;
      for (const lot of plan.inventory) {
        if (y < 55) {
          p = page("Parts inventory - continued");
          y = 750;
        }
        p.drawText(
          pdfText(
            `${lot.quantity} x ${lot.ref} | colour ${lot.colorCode}`,
          ).slice(0, 92),
          { x: 40, y, size: 11, font, color: ink },
        );
        y -= 18;
      }
      await pdf.attach(json, "instructions.json", {
        mimeType: "application/json",
        description:
          "Original labels, exact occurrence ordering, camera and coverage report",
      });
      const bytes = await pdf.save();
      check();
      ensure(
        (await renderer.ready()).revision === project.revision,
        "REVISION_CONFLICT",
        "The build changed while composing the PDF.",
      );
      ensure(
        bytes.length <= MAX_BYTES,
        "LIMIT_EXCEEDED",
        "PDF exceeds 100 MiB.",
      );
      return {
        name: "instructions.pdf",
        mimeType: "application/pdf",
        bytes,
        report: plan,
      };
    }
    files["instructions.json"] = json;
    if (options.format === "html-zip") {
      const sections = plan.steps
        .map(
          (s) =>
            `<section id="step-${s.number}"><h2>Step ${s.number} of ${plan.steps.length}</h2><p>${s.partCount} new parts</p>${s.notes ? `<p style="white-space:pre-wrap">${escape(s.notes)}</p>` : ""}<img src="step-${String(s.number).padStart(3, "0")}.png" alt="Cumulative model at step ${s.number}"><details><summary>Parts needed (${s.partCount})</summary><ul>${s.lots.map((l) => `<li>${l.quantity} × ${escape(l.ref)} · colour ${escape(l.colorCode)}</li>`).join("")}</ul></details><nav>${s.number > 1 ? `<a href="#step-${s.number - 1}">Previous step</a>` : ""} ${s.number < plan.steps.length ? `<a href="#step-${s.number + 1}">Next step</a>` : ""}</nav></section>`,
        )
        .join("");
      files["index.html"] = strToU8(
        `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(project.title)}</title><style>body{font:16px system-ui;color:#29414d;background:#eef2f4;margin:auto;max-width:850px;padding:24px}section{background:white;padding:24px;margin:24px 0;border-radius:12px}section:target{outline:3px solid #bc662a}img{width:100%;height:auto}a,summary{display:inline-block;padding:12px;color:#8c431c}li{line-height:1.8}@media print{section{break-after:page}nav{display:none}}</style><h1>${escape(project.title)}</h1><p>${escape(disclaimer)}</p><p><a href="instructions.json">Download plan and coverage report</a></p>${sections}</html>`,
      );
      budget(files["index.html"].length);
    }
    const bytes = zipSync(files, { level: 0 });
    check();
    ensure(
      (await renderer.ready()).revision === project.revision,
      "REVISION_CONFLICT",
      "The build changed while composing the ZIP.",
    );
    ensure(bytes.length <= MAX_BYTES, "LIMIT_EXCEEDED", "ZIP exceeds 100 MiB.");
    return {
      name:
        options.format === "html-zip"
          ? "instructions-html.zip"
          : "instruction-images.zip",
      mimeType: "application/zip",
      bytes,
      report: plan,
    };
  } finally {
    try {
      if ((await renderer.ready()).revision === project.revision)
        renderer.setCamera(camera);
    } catch {
      /* A disposed or replaced renderer cannot be restored. */
    }
  }
}
