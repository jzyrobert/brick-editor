import {
  insertionCheckReader,
  insertionChecksCurrent,
  insertionSummary,
} from "./motion";
import { instructionDisplayStates } from "./programme";
import { pdfStepLayout } from "./pdf-layout";
import { strToU8, zipSync } from "fflate";
import { instructionLots, type InstructionLot } from "./lots";
import { instructionComponents } from "./components";
export type { InstructionLot } from "./lots";
import {
  captureInstructionIllustration,
  illustrationHtml,
  illustrationCss,
} from "./illustrate";
import { occurrences } from "../core/document";
import { ensure, type Project, type CameraSpec } from "../core/types";
import type { SceneAdapter } from "../render/adapter";

export type PublishFormat = "png-zip" | "html-zip" | "pdf";
export type PreparedPlan = {
  schemaVersion: 1;
  projectId: string;
  revision: number;
  title: string;
  name: string;
  method: "explicit-order";
  assemblyValidated: false;
  presentation?: "pictorial";
  generation?: import("./generate").GenerationReport;
  refinement?: import("../core/types").InstructionPlan["refinement"];
  modules?: import("../core/types").InstructionPlan["modules"];
  dimPrevious?: boolean;
  coverage: { intended: number; introduced: number; complete: true };
  steps: {
    number: number;
    addedIds: string[];
    cumulativeIds: string[];
    partCount: number;
    lots: InstructionLot[];
    notes?: string;
    camera?: CameraSpec;
    contextCamera?: CameraSpec;
    alternateCamera?: CameraSpec;
    alternateBeforePlacement?: boolean;
    alternateDetailIds?: string[];
    targets?: import("../core/types").InstructionStepMetadata["targets"];
    insertionChecks?: import("../core/types").InstructionStepMetadata["insertionChecks"];
    axisReference?: import("../core/types").InstructionStepMetadata["axisReference"];
    displayIds?: string[];
    highlightIds?: string[];
    incomingIds?: string[];
    incomingCamera?: CameraSpec;
    completedDetail?: import("../core/types").InstructionStepMetadata["completedDetail"];
    operationLabel?: string;
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
  const enhanced =
    plan.presentation === "pictorial" ||
    (!!plan.generation &&
      plan.generation.algorithm !== "connected-bottom-up-v1");
  const physical =
    plan.presentation === "pictorial" ||
    plan.generation?.algorithm === "connected-bottom-up-v4" ||
    plan.generation?.algorithm === "connected-bottom-up-v5" ||
    plan.generation?.algorithm === "connected-bottom-up-v6" ||
    plan.generation?.algorithm === "connected-bottom-up-v7" ||
    plan.generation?.algorithm === "connected-bottom-up-v8" ||
    plan.generation?.algorithm === "connected-bottom-up-v9" ||
    plan.generation?.algorithm === "connected-bottom-up-v10" ||
    plan.generation?.algorithm === "connected-bottom-up-v11" ||
    plan.generation?.algorithm === "connected-bottom-up-v13" ||
    plan.generation?.algorithm === "connected-bottom-up-v14" ||
    plan.generation?.algorithm === "connected-bottom-up-v15" ||
    plan.generation?.algorithm === "connected-bottom-up-v16" ||
    plan.generation?.algorithm === "connected-bottom-up-v12";
  const components = physical ? instructionComponents(project, all) : [];
  const lots = (ids: string[]) =>
    instructionLots(project, ids, { named: enhanced, physical, components });
  const states = instructionDisplayStates(plan);
  const readChecks = insertionCheckReader(project, plan);
  const steps = plan.steps.map((ids, index) => {
    ensure(
      ids.length > 0 || plan.stepMetadata?.[index]?.assembly?.type === "join",
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
    publicationCharacters +=
      cumulativeCharacters * 2 +
      (plan.modules
        ? states[index].displayIds.reduce((n, id) => n + id.length + 4, 0)
        : 0);
    ensure(
      publicationCharacters <= 8_000_000,
      "LIMIT_EXCEEDED",
      "Instruction occurrence metadata exceeds the 8 million character budget. Use fewer steps.",
    );
    const stepLots = lots(ids);
    const insertionChecks = readChecks(plan.stepMetadata?.[index]);
    const notes = [
      plan.stepMetadata?.[index]?.notes,
      insertionSummary(insertionChecks),
    ]
      .filter(Boolean)
      .join(" ");
    return {
      number: index + 1,
      addedIds: [...ids],
      cumulativeIds: [...cumulative],
      partCount: stepLots.reduce((n, l) => n + l.quantity, 0),
      lots: stepLots,
      ...structuredClone(plan.stepMetadata?.[index] ?? {}),
      ...(insertionChecks ? { insertionChecks } : {}),
      ...(notes ? { notes } : {}),
      ...(plan.stepMetadata?.[index]?.targets
        ? {
            targets: plan.stepMetadata[index].targets!.map((target) => {
              const occurrence = target.occurrenceId
                ? byId.get(target.occurrenceId)
                : undefined;
              const lot = occurrence
                ? stepLots.find(
                    (l) =>
                      l.ref === occurrence.node.ref &&
                      l.colorCode === occurrence.colorCode,
                  )
                : undefined;
              return {
                ...target,
                caption:
                  lot && !/^(?:R|J|S|P|B)\d*$/.test(target.label ?? "")
                    ? `${lot.name ?? lot.ref} / ${lot.colorName ?? lot.colorCode}`
                    : target.caption,
              };
            }),
          }
        : {}),
      ...(plan.modules ? states[index] : {}),
      ...(states[index].incomingIds
        ? {
            incomingCamera:
              plan.stepMetadata?.[index]?.incomingCamera ??
              plan.stepMetadata?.[index]?.camera,
          }
        : {}),
    };
  });
  ensure(
    seen.size === all.length,
    "INVALID_INPUT",
    `${all.length - seen.size} occurrences are missing from this plan. Regenerate or complete it before publishing.`,
  );
  const warnings = [
    ...(plan.refinement?.insertionFingerprint &&
    !insertionChecksCurrent(project, plan)
      ? [
          "Geometry or step order changed after agent refinement. Retained baseline approach results are unknown for this publication.",
        ]
      : []),
    ...(plan.generation?.insertionFingerprint &&
    !insertionChecksCurrent(project, plan)
      ? [
          "Geometry or step order changed. Saved generation totals describe the original draft; current approach results are unknown until regenerated.",
        ]
      : []),
    ...(plan.generation?.warnings ?? []),
    ...(components.length
      ? [
          "Generated component counts describe drawing representations, not a verified physical parts list; check each identity, length and part breakdown.",
        ]
      : []),
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
    ...(plan.presentation ? { presentation: plan.presentation } : {}),
    ...(plan.generation
      ? { generation: structuredClone(plan.generation) }
      : {}),
    ...(plan.refinement
      ? { refinement: structuredClone(plan.refinement) }
      : {}),
    ...(plan.modules ? { modules: structuredClone(plan.modules) } : {}),
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
  dimPrevious?: boolean;
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
const pdfDimensions: Record<string, string> = {
  "°": " deg",
  "½": " 1/2",
  "⅓": " 1/3",
  "⅔": " 2/3",
  "¼": " 1/4",
  "¾": " 3/4",
  "⅕": " 1/5",
  "⅖": " 2/5",
  "⅗": " 3/5",
  "⅘": " 4/5",
  "⅙": " 1/6",
  "⅚": " 5/6",
  "⅐": " 1/7",
  "⅛": " 1/8",
  "⅜": " 3/8",
  "⅝": " 5/8",
  "⅞": " 7/8",
  "⅑": " 1/9",
  "⅒": " 1/10",
};
const pdfText = (s: string) =>
  s
    .replace(/[°½⅓⅔¼¾⅕⅖⅗⅘⅙⅚⅐⅛⅜⅝⅞⅑⅒]/g, (c) => pdfDimensions[c])
    .replace(/×/g, "x")
    .replace(/[^\x20-\x7e]/g, "?");
const MAX_BYTES = 100 * 1024 * 1024;

/** Sequential captures honor saved step cameras and restore the original view. */
export async function publishInstructions(
  project: Project,
  planId: string,
  renderer: PublishRenderer,
  options: PublishOptions,
) {
  if (
    typeof document !== "undefined" &&
    (project.instructionPlans[planId]?.generation ||
      project.instructionPlans[planId]?.presentation === "pictorial")
  )
    await (await import("../catalog/full-library-loader"))
      .loadFullCatalog()
      .catch(() => undefined);
  const plan = prepareInstructionPlan(project, planId),
    width = options.width ?? 960,
    height = options.height ?? 720;
  ensure(
    options.dimPrevious === undefined ||
      typeof options.dimPrevious === "boolean",
    "INVALID_INPUT",
    "Dim previous parts must be a boolean.",
  );
  plan.dimPrevious = options.dimPrevious ?? false;
  if (plan.dimPrevious)
    plan.warnings[
      plan.warnings.indexOf(
        "New parts are listed beside each cumulative view; prior geometry is not visually subdued.",
      )
    ] =
      "Previously introduced geometry is shown as opaque pale context; new additions retain their original appearance.";
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
      width * height * plan.steps.length +
        plan.steps.reduce(
          (n, s) =>
            n +
            Number(!!s.contextCamera) +
            Number(!!s.alternateCamera) +
            Number(!!s.incomingIds) +
            Number(!!s.completedDetail),
          0,
        ) *
          240 *
          180 <=
        64000000,
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
  const inventoryLabel = plan.inventory.some((l) => l.kind)
    ? "parts / generated representations"
    : "parts";
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
      `${plan.steps.length} steps | ${plan.inventory.reduce((n, l) => n + l.quantity, 0)} ${inventoryLabel}`,
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
  const enhanced =
    plan.presentation === "pictorial" ||
    (!!plan.generation &&
      plan.generation.algorithm !== "connected-bottom-up-v1");
  const illustrations = new Map<number, string>();
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
      const illustration = await captureInstructionIllustration(
        project.revision,
        { ...step, camera: step.camera ?? camera },
        renderer,
        {
          width,
          height,
          dimPrevious: options.dimPrevious,
          pictorial: enhanced,
          rasterOperationLabel: options.format === "png-zip",
          quality: enhanced ? "balanced" : "photo",
        },
      );
      check();
      const bytes = illustration.main;
      budget(bytes.byteLength);
      if (illustration.context) budget(illustration.context.byteLength);
      if (illustration.alternate) budget(illustration.alternate.byteLength);
      if (illustration.incoming) budget(illustration.incoming.byteLength);
      if (illustration.completed) budget(illustration.completed.byteLength);
      for (const item of illustration.tray)
        if (item.png) budget(item.png.byteLength);
      if (enhanced)
        illustrations.set(step.number, illustrationHtml(step, illustration));
      const name = `step-${String(step.number).padStart(3, "0")}.png`;
      if (pdf) {
        const wrap = (
          raw: string,
          size = 11,
          width = 515,
          measure = (value: string) => {
            // drawText emits unkerned glyph advances. Helvetica's whole-string
            // metric includes kerning and can understate actual printed width.
            let advance = 0;
            for (const character of value)
              advance += font!.widthOfTextAtSize(character, size);
            return advance;
          },
        ) => {
          const lines: string[] = [];
          let line = "";
          for (const word of pdfText(raw).split(/\s+/)) {
            const next = line ? `${line} ${word}` : word;
            if (line && measure(next) > width) {
              lines.push(line);
              line = "";
            }
            // Keep normal words intact; long identifiers still need bounded
            // lines. Use the same wrapping for operation labels and notes.
            for (const character of line ? ` ${word}` : word) {
              if (line && measure(line + character) > width) {
                lines.push(line);
                line = "";
              }
              line += character;
            }
          }
          lines.push(line);
          return lines;
        };
        const operationLines = step.operationLabel
          ? wrap(step.operationLabel, 10)
          : [];
        const cadSummary = insertionSummary(step.insertionChecks),
          summaryLines = enhanced && cadSummary ? wrap(cadSummary, 10) : [];
        const imageHeaderLines =
          enhanced && cadSummary
            ? wrap(cadSummary, 10, 515, (value) =>
                font!.widthOfTextAtSize(value, 10),
              ).length
            : 0;
        const actionNotes =
          summaryLines.length && step.notes?.endsWith(cadSummary!)
            ? step.notes.slice(0, -cadSummary.length).trim()
            : step.notes;
        const actionLines = actionNotes
          ? actionNotes.split("\n").flatMap((raw) => wrap(raw))
          : [];
        const explanation = [
          ...operationLines.slice(2),
          ...(step.targets?.map(
            (t) =>
              `${t.label}: ${t.caption ?? "Approximate source destination"}`,
          ) ?? []),
          // The complete CAD outcome stays beside the main diagram.
          enhanced ? undefined : actionNotes,
        ]
          .filter(Boolean)
          .join("\n");
        const explanationLines = explanation
          ? explanation.split("\n").flatMap((raw) => wrap(raw)).length
          : 0;
        const supporting = [
          { bytes: illustration.context, title: "Where this fits" },
          { bytes: illustration.incoming, title: "Candidate - fit unknown" },
          {
            bytes: illustration.completed,
            title: "Completed joint; surrounds omitted, fit/access unknown",
          },
          {
            bytes: illustration.alternate,
            title: step.alternateDetailIds
              ? "Receiver detail (access unknown)"
              : step.alternateBeforePlacement
                ? "Receiver before placement"
                : "Another view (no flip)",
          },
        ].filter((item) => item.bytes);
        const supportingCaptions = supporting.map((item) =>
          wrap(item.title, 8, 120),
        );
        const partRows = (width: number) =>
          step.lots.map((lot) => {
            const name = wrap(
              `${lot.quantity} x ${lot.name ?? lot.ref}`,
              10,
              width - 55,
            );
            const colour = wrap(
              lot.colorName ?? `Colour ${lot.colorCode}`,
              10,
              width - 55,
            );
            const ref = wrap(lot.ref, 8, width - 55);
            return {
              lot,
              name,
              colour,
              ref,
              height: Math.max(
                54,
                name.length * 12 + colour.length * 12 + ref.length * 10 + 13,
              ),
            };
          });
        const png = await pdf.embedPng(bytes);
        const p = page(`Step ${step.number} of ${plan.steps.length}`);
        const scale = Math.min(
          515 / png.width,
          (enhanced
            ? 340 - (summaryLines.length ? summaryLines.length * 13 + 12 : 0)
            : 450) / png.height,
        );
        const layout = enhanced
          ? pdfStepLayout({
              imageWidth: png.width,
              imageHeight: png.height,
              summaryLines: summaryLines.length,
              imageHeaderLines,
              operationLines: operationLines.length,
              supportingCaptionLines: supportingCaptions.map(
                (lines) => lines.length,
              ),
              actionLines: actionLines.length,
              explanationLines,
              lotCount: step.lots.length,
              measureParts: (width) =>
                partRows(width).reduce((n, row) => n + row.height, 0),
              measurePartGrid: (width) =>
                Math.max(...partRows(width).map((row) => row.height)),
            })
          : undefined;
        p.drawImage(
          png,
          layout?.main ?? {
            x: (595.28 - png.width * scale) / 2,
            y: 295,
            width: png.width * scale,
            height: png.height * scale,
          },
        );
        p.drawText(
          `${step.partCount} new ${inventoryLabel} | ${step.cumulativeIds.length} cumulative occurrences`,
          { x: 40, y: 760, size: 11, font, color: ink },
        );
        for (const [index, line] of summaryLines.entries())
          p.drawText(line, {
            x: 40,
            y: 741 - index * 13,
            size: 10,
            font,
            color: ink,
          });
        if (enhanced) {
          for (let n = 0; n < supporting.length; n++) {
            const image = await pdf.embedPng(supporting[n].bytes!);
            const {
              x,
              y: supportingY,
              captionY,
            } = layout!.supportingPositions[n];
            p.drawImage(image, {
              x,
              y: supportingY,
              width: 120,
              height: 90,
            });
            supportingCaptions[n].forEach((line, index) =>
              p.drawText(line, {
                x,
                y: captionY - index * 10,
                size: 8,
                font,
                color: ink,
              }),
            );
          }
          for (const [index, line] of operationLines.slice(0, 2).entries())
            p.drawText(line, {
              x: 40,
              y: layout!.operationY - index * 13,
              size: 10,
              font,
              color: accent,
            });
        }
        let listPage = p,
          y = layout?.bodyY ?? 265;
        if (enhanced && actionNotes) {
          // Keep a complete ordinary action paragraph with its diagram before
          // purchasing rows and repeated target legends consume the page.
          if (actionLines.length * 16 > y - 55) {
            p.drawText(
              "Read the action notes on the next page before placement.",
              { x: 40, y, size: 10, font, color: accent },
            );
            listPage = page(`Step ${step.number} - action notes`);
            y = 750;
          }
          for (const line of actionLines) {
            if (y < 55) {
              listPage = page(`Step ${step.number} - action notes continued`);
              y = 750;
            }
            listPage.drawText(line, { x: 40, y, size: 11, font, color: ink });
            y -= 16;
          }
          y -= 12;
        }
        const column = layout?.partsColumn;
        const grid = layout?.partsGrid;
        if (!column && y < 85) {
          listPage = page(`Step ${step.number} - parts continued`);
          y = 750;
        }
        const partsPage = column ? p : listPage;
        let partsX = column?.x ?? 40;
        let partsY = column?.headingY ?? y;
        partsPage.drawText(
          step.incomingIds ? "No new parts" : "Parts needed for this step",
          { x: partsX, y: partsY, size: 13, font, color: accent },
        );
        partsY -= 30;
        const measuredRows = enhanced
          ? partRows(column?.width ?? grid?.width ?? 515)
          : [];
        for (const [index, lot] of step.lots.entries()) {
          partsX = grid?.x[index] ?? column?.x ?? 40;
          const row = measuredRows[index];
          const nameLines = row?.name ?? [];
          const rowHeight = enhanced ? row.height : 18;
          if (!column && !grid && partsY - rowHeight < 30) {
            listPage = page(`Step ${step.number} - parts continued`);
            partsY = 750;
          }
          const targetPage = column ? p : listPage;
          const trayItem = illustration.tray.find((t) => t.lot === lot);
          if (enhanced) {
            if (trayItem?.png) {
              const thumb = await pdf.embedPng(trayItem.png);
              targetPage.drawImage(thumb, {
                x: partsX,
                y: partsY - 25,
                width: 48,
                height: 48,
              });
            }
            if (!column && rowHeight > 720) {
              // A file-local title/reference can be longer than a whole page.
              // Preserve it through measured continuation lines, never draw
              // below the footer or silently truncate source identity.
              const lines = (
                values: string[],
                size: number,
                leading: number,
              ) => {
                for (const line of values) {
                  if (partsY < 55) {
                    listPage = page(`Step ${step.number} - parts continued`);
                    partsY = 750;
                  }
                  listPage.drawText(line, {
                    x: partsX + 55,
                    y: partsY,
                    size,
                    font,
                    color: ink,
                  });
                  partsY -= leading;
                }
              };
              lines(row.name, 10, 12);
              partsY -= 3;
              lines(row.colour, 10, 12);
              partsY -= 2;
              lines(row.ref, 8, 10);
              partsY -= 8;
              continue;
            }
            nameLines.forEach((line, index) =>
              targetPage.drawText(line, {
                x: partsX + 55,
                y: partsY - index * 12,
                size: 10,
                font,
                color: ink,
              }),
            );
            row.colour.forEach((line, index) =>
              targetPage.drawText(line, {
                x: partsX + 55,
                y: partsY - nameLines.length * 12 - 3 - index * 12,
                size: 10,
                font,
                color: ink,
              }),
            );
            row.ref.forEach((line, index) =>
              targetPage.drawText(line, {
                x: partsX + 55,
                y:
                  partsY -
                  nameLines.length * 12 -
                  row.colour.length * 12 -
                  5 -
                  index * 10,
                size: 8,
                font,
                color: ink,
              }),
            );
            if (!grid) partsY -= rowHeight;
          } else {
            targetPage.drawText(
              pdfText(
                `${lot.quantity} x ${lot.ref} | colour ${lot.colorCode}`,
              ).slice(0, 92),
              { x: partsX, y: partsY, size: 11, font, color: ink },
            );
            partsY -= 18;
          }
        }
        if (!column) y = partsY - (grid?.height ?? 0);
        if (explanation) {
          for (const raw of explanation.split("\n")) {
            const lines = wrap(raw);
            // Keep a page-sized marker description with all its qualifiers.
            // Truly oversized blocks still receive explicit continuation pages.
            if (lines.length <= 44 && y - (lines.length - 1) * 16 < 55) {
              listPage = page(`Step ${step.number} - notes continued`);
              y = 750;
            }
            for (const line of lines) {
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
        }
      } else {
        files[name] = bytes;
        for (const kind of [
          "context",
          "alternate",
          "incoming",
          "completed",
        ] as const)
          if (illustration[kind])
            files[`${kind}-${String(step.number).padStart(3, "0")}.png`] =
              illustration[kind]!;
      }
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
            `<section id="step-${s.number}"><h2>Step ${s.number} of ${plan.steps.length}</h2><p>${s.partCount} new ${inventoryLabel}</p>${illustrations.get(s.number) ?? `<img src="step-${String(s.number).padStart(3, "0")}.png" alt="Cumulative model at step ${s.number}">`}${s.notes ? `<p style="white-space:pre-wrap">${escape(s.notes)}</p>` : ""}<details><summary>Parts needed (${s.partCount})</summary><ul>${s.lots.map((l) => `<li>${l.quantity} × ${escape(l.ref)} · colour ${escape(l.colorCode)}</li>`).join("")}</ul></details><nav>${s.number > 1 ? `<a href="#step-${s.number - 1}">Previous step</a>` : ""} ${s.number < plan.steps.length ? `<a href="#step-${s.number + 1}">Next step</a>` : ""}</nav></section>`,
        )
        .join("");
      files["index.html"] = strToU8(
        `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(project.title)}</title><style>body{font:16px system-ui;color:#29414d;background:#eef2f4;margin:auto;max-width:850px;padding:24px}section{background:white;padding:24px;margin:24px 0;border-radius:12px}section:target{outline:3px solid #bc662a}img{width:100%;height:auto}a,summary{display:inline-block;padding:12px;color:#8c431c}li{line-height:1.8}@media print{section{break-after:page}nav{display:none}}${illustrationCss}</style><h1>${escape(project.title)}</h1><p>${escape(disclaimer)}</p><p><a href="instructions.json">Download plan and coverage report</a></p>${sections}</html>`,
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
