/** Shared illustration composition for publication and critic evaluations. */
import type { CameraSpec } from "../core/types";
import type { PreparedPlan, InstructionLot } from "./publish";
import type { RenderRequest } from "../render/adapter";
import { paletteColors } from "../catalog/color-availability";
import { partThumbnailPng } from "../catalog/part-thumbnails-loader";
export type IllustratedStep = {
  main: Uint8Array;
  context?: Uint8Array;
  alternate?: Uint8Array;
  incoming?: Uint8Array;
  completed?: Uint8Array;
  tray: { lot: InstructionLot; png?: Uint8Array }[];
};
type Renderer = {
  setCamera(c: CameraSpec): unknown;
  image(r: RenderRequest): Promise<{ blob: Blob }>;
};
type Step = PreparedPlan["steps"][number];
const thumbnailCache = new Map<string, Promise<Uint8Array | undefined>>();
const esc = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
const dataUrl = (b: Uint8Array) => {
  let s = "";
  for (let i = 0; i < b.length; i += 8192)
    s += String.fromCharCode(...b.slice(i, i + 8192));
  return "data:image/png;base64," + btoa(s);
};

/** LDraw cameras use downward Y: their screen-right has the opposite sign. */
export function contextLocator(
  camera: CameraSpec,
  context: CameraSpec,
  width: number,
  height: number,
) {
  if (
    camera.projection !== "orthographic" ||
    context.projection !== "orthographic" ||
    !camera.span ||
    !context.span
  )
    return;
  const direction = context.position.map((v, i) => v - context.target[i]),
    length = Math.hypot(...direction);
  const d = direction.map((v) => v / length),
    r = [d[2], 0, -d[0]],
    rl = Math.hypot(...r);
  if (!rl) return;
  const right = r.map((v) => v / rl),
    up = [
      right[1] * d[2] - right[2] * d[1],
      right[2] * d[0] - right[0] * d[2],
      right[0] * d[1] - right[1] * d[0],
    ];
  const delta = camera.target.map((v, i) => v - context.target[i]);
  const dot = (a: number[], b: number[]) =>
    a.reduce((n, v, i) => n + v * b[i], 0);
  const x = width / 2 - (dot(delta, right) * height) / context.span!,
    y = height / 2 - (dot(delta, up) * height) / context.span!;
  const h = Math.max(8, (height * camera.span!) / context.span!),
    w = (h * width) / height;
  return { x: x - w / 2, y: y - h / 2, width: w, height: h };
}
async function markContext(
  bytes: Uint8Array,
  camera: CameraSpec | undefined,
  context: CameraSpec,
  width: number,
  height: number,
) {
  if (!camera || typeof document === "undefined") return bytes;
  const rect = contextLocator(camera, context, width, height);
  if (!rect) return bytes;
  const bitmap = await createImageBitmap(new Blob([bytes as BlobPart]));
  try {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const c = canvas.getContext("2d")!;
    c.drawImage(bitmap, 0, 0, width, height);
    c.strokeStyle = "#a94e00";
    c.lineWidth = 2;
    c.strokeRect(rect.x, rect.y, rect.width, rect.height);
    return await new Promise<Uint8Array>((resolve) =>
      canvas.toBlob(
        async (b) => resolve(b ? new Uint8Array(await b.arrayBuffer()) : bytes),
        "image/png",
      ),
    );
  } finally {
    bitmap.close();
  }
}
/** Destination marks project source body positions, never an insertion trajectory. */
async function markDestinations(
  bytes: Uint8Array,
  camera: CameraSpec | undefined,
  targets: Step["targets"],
  operation: string | undefined,
  axisReference: Step["axisReference"],
  width: number,
  height: number,
  insertionChecks?: Step["insertionChecks"],
) {
  if (
    !camera ||
    typeof document === "undefined" ||
    (!targets?.length &&
      !operation &&
      !axisReference &&
      !insertionChecks?.some((c) => c.status === "clear"))
  )
    return bytes;
  const bitmap = await createImageBitmap(new Blob([bytes as BlobPart]));
  try {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(bitmap, 0, 0, width, height);
    if (axisReference) {
      const project = (position: typeof axisReference.from) => {
        const r = contextLocator(
          { ...camera, target: position },
          camera,
          width,
          height,
        );
        return r ? { x: r.x + r.width / 2, y: r.y + r.height / 2 } : undefined;
      };
      const a = project(axisReference.from),
        b = project(axisReference.to);
      if (a && b) {
        ctx.strokeStyle = "#a80065";
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
    const approaches =
      insertionChecks?.filter((c) => c.status === "clear" && c.from && c.to) ??
      [];
    // Short direction arrows represent the saved full straight path. Do not
    // stretch the camera to its external start or draw uncertified approaches.
    if (approaches.length <= 3)
      for (const check of approaches) {
        const delta = check.from!.map((v, i) => v - check.to![i]);
        const length = Math.hypot(...delta);
        if (!length) continue;
        const near = check.to!.map(
          (v, i) => v + (delta[i] * Math.min(36, length)) / length,
        );
        const project = (position: number[]) => {
          const r = contextLocator(
            { ...camera, target: position as CameraSpec["target"] },
            camera,
            width,
            height,
          );
          return r
            ? { x: r.x + r.width / 2, y: r.y + r.height / 2 }
            : undefined;
        };
        const a = project(near),
          b = project(check.to!);
        if (
          !a ||
          !b ||
          Math.hypot(b.x - a.x, b.y - a.y) < 10 ||
          [a, b].some(
            (p) => p.x < 4 || p.y < 4 || p.x > width - 4 || p.y > height - 4,
          )
        )
          continue;
        const angle = Math.atan2(b.y - a.y, b.x - a.x);
        ctx.strokeStyle = "#06734d";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        for (const sign of [-1, 1]) {
          ctx.moveTo(b.x, b.y);
          ctx.lineTo(
            b.x - 8 * Math.cos(angle + sign * 0.5),
            b.y - 8 * Math.sin(angle + sign * 0.5),
          );
        }
        ctx.stroke();
      }
    const placed: { x: number; y: number }[] = [];
    for (const target of targets ?? []) {
      const projected = contextLocator(
        { ...camera, target: target.position },
        camera,
        width,
        height,
      );
      if (!projected) continue;
      const point = {
        x: projected.x + projected.width / 2,
        y: projected.y + projected.height / 2,
      };
      if (
        point.x < 10 ||
        point.x > width - 10 ||
        point.y < 10 ||
        point.y > height - 10
      )
        continue;
      let { x, y } = point;
      const receivingPoint = /^P\d*$/.test(target.label) && !axisReference;
      if (
        receivingPoint ||
        axisReference ||
        (target.label.startsWith("B") &&
          placed.some((p) => Math.hypot(point.x - p.x, point.y - p.y) < 19))
      ) {
        // Keep the new body visible and separate labels. Leaders locate source
        // points; they have no arrowheads and do not prescribe motion.
        const offsets =
          receivingPoint || target.label === "1"
            ? [
                [18, -18],
                [18, 18],
                [-18, -18],
                [-18, 18],
              ]
            : [
                [0, 0],
                [0, -20],
                [0, 20],
                [-20, 0],
                [20, 0],
                [0, -40],
                [0, 40],
                [-40, 0],
                [40, 0],
              ];
        const offset = offsets.find(
          ([dx, dy]) =>
            point.x + dx >= 10 &&
            point.x + dx <= width - 10 &&
            point.y + dy >= 10 &&
            point.y + dy <= height - 10 &&
            placed.every(
              (p) => Math.hypot(point.x + dx - p.x, point.y + dy - p.y) >= 19,
            ),
        );
        if (offset) {
          x += offset[0];
          y += offset[1];
        }
        if (x !== point.x || y !== point.y) {
          ctx.strokeStyle = "#a80065";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(point.x, point.y);
          ctx.lineTo(x, y);
          ctx.stroke();
        }
      }
      placed.push({ x, y });
      ctx.beginPath();
      ctx.arc(x, y, 8, 0, Math.PI * 2);
      ctx.fillStyle = "white";
      ctx.fill();
      ctx.strokeStyle = "#a80065";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = "#a80065";
      ctx.font = "bold 10px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(target.label, x, y);
    }
    if (operation) {
      ctx.fillStyle = "rgba(255,255,255,0.95)";
      ctx.fillRect(0, 0, width, 35);
      ctx.fillStyle = "#444";
      ctx.font = "12px sans-serif";
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText(operation.slice(0, Math.floor(width / 7)), 8, 7);
      ctx.fillText(
        "Candidate only · fit and handling unknown · final orientation",
        8,
        21,
      );
    }
    return await new Promise<Uint8Array>((resolve) =>
      canvas.toBlob(
        async (b) => resolve(b ? new Uint8Array(await b.arrayBuffer()) : bytes),
        "image/png",
      ),
    );
  } finally {
    bitmap.close();
  }
}
export async function captureInstructionIllustration(
  revision: number,
  step: Step,
  renderer: Renderer,
  options: {
    width: number;
    height: number;
    dimPrevious?: boolean;
    pictorial?: boolean;
    quality?: RenderRequest["quality"];
    mainIsIllustrated?: boolean;
    rasterOperationLabel?: boolean;
  },
): Promise<IllustratedStep> {
  const capture = async (
    camera: CameraSpec | undefined,
    width: number,
    height: number,
    ids = step.displayIds ?? step.cumulativeIds,
    highlight = step.highlightIds ?? step.addedIds,
    dim = options.dimPrevious,
  ) => {
    if (camera) await renderer.setCamera(camera);
    const image = await renderer.image({
      revision,
      width,
      height,
      format: "png",
      visibility: { mode: "occurrences", occurrenceIds: ids },
      background: { type: "solid", color: "#ffffff" },
      backdrop: "blank",
      quality: options.quality ?? "balanced",
      strict: true,
      ...(dim ? { instructionNewIds: highlight } : {}),
    });
    return new Uint8Array(await image.blob.arrayBuffer());
  };
  const rawMain = await capture(step.camera, options.width, options.height);
  const main = options.mainIsIllustrated
    ? rawMain
    : await markDestinations(
        rawMain,
        step.camera,
        step.axisReference && step.contextCamera
          ? step.targets?.filter((t) => t.label !== "R")
          : step.targets,
        options.rasterOperationLabel ? step.operationLabel : undefined,
        step.axisReference,
        options.width,
        options.height,
        step.insertionChecks,
      );
  let alternate: Uint8Array | undefined, incoming: Uint8Array | undefined;
  const movingIds = new Set([...step.addedIds, ...(step.incomingIds ?? [])]);
  if (step.alternateCamera)
    alternate = await markDestinations(
      await capture(
        step.alternateCamera,
        240,
        180,
        step.alternateBeforePlacement
          ? (step.displayIds ?? step.cumulativeIds).filter(
              (id) =>
                !movingIds.has(id) &&
                (!step.alternateDetailIds ||
                  step.alternateDetailIds.includes(id)),
            )
          : undefined,
        undefined,
        step.alternateBeforePlacement ? false : undefined,
      ),
      step.alternateCamera,
      step.alternateBeforePlacement
        ? step.targets?.filter(
            (t) => /^P\d*$/.test(t.label) || /^R\d*$/.test(t.label),
          )
        : step.axisReference && step.contextCamera
          ? step.targets?.filter((t) => t.label !== "R")
          : step.targets,
      undefined,
      step.axisReference,
      240,
      180,
      step.alternateBeforePlacement ? undefined : step.insertionChecks,
    );
  if (step.incomingIds)
    incoming = await capture(
      step.incomingCamera ?? step.camera,
      240,
      180,
      step.incomingIds,
      step.incomingIds,
      false,
    );
  const completed = step.completedDetail
    ? await capture(
        step.completedDetail.camera,
        240,
        180,
        step.completedDetail.occurrenceIds,
        step.highlightIds ?? step.addedIds,
      )
    : undefined;
  let context: Uint8Array | undefined;
  if (step.contextCamera) {
    const width = 240,
      height = 180;
    context = await markContext(
      await capture(step.contextCamera, width, height),
      step.camera,
      step.contextCamera,
      width,
      height,
    );
    if (step.axisReference)
      context = await markDestinations(
        context,
        step.contextCamera,
        step.targets?.filter((t) => t.label === "R"),
        undefined,
        undefined,
        width,
        height,
      );
  }
  const tray = await Promise.all(
    step.lots.map(async (lot) => {
      if (!options.pictorial || lot.kind) return { lot };
      const color = paletteColors.find((c) => c.code === lot.colorCode),
        key = JSON.stringify([lot.thumbnailRef ?? lot.ref, lot.colorCode]);
      let pending = thumbnailCache.get(key);
      if (!pending) {
        pending = partThumbnailPng(
          lot.thumbnailRef ?? lot.ref,
          color?.hex ?? "#bac4cb",
          color?.transparent,
        );
        if (thumbnailCache.size >= 256) thumbnailCache.clear();
        thumbnailCache.set(key, pending);
        void pending.then((png) => {
          if (!png) thumbnailCache.delete(key);
        });
      }
      return { lot, png: await pending };
    }),
  );
  if ((context || alternate || incoming || completed) && step.camera)
    await renderer.setCamera(step.camera);
  return { main, context, alternate, incoming, completed, tray };
}
export function illustrationHtml(step: Step, illustration: IllustratedStep) {
  return `${step.insertionChecks?.some((c) => c.status === "clear") ? `<p class="target-legend">Green arrows, when visible, show a shortened checked CAD approach; physical fit and handling need review.</p>` : ""}${step.operationLabel ? `<p class="operation-label">${esc(step.operationLabel)}</p>` : ""}<div class="instruction-illustration"><img class="main-diagram" src="${dataUrl(illustration.main)}" alt="${step.contextCamera ? "Placement close-up" : "Assembly view"}">${illustration.context ? `<figure class="context-diagram"><img src="${dataUrl(illustration.context)}" alt="Whole assembly; outlined area locates the close-up"><figcaption>Where this fits</figcaption></figure>` : ""}${illustration.incoming ? `<figure class="context-diagram"><img src="${dataUrl(illustration.incoming)}" alt="Completed candidate, shown in its final orientation"><figcaption>Use this completed candidate — fit and access unknown</figcaption></figure>` : ""}${illustration.completed ? `<figure class="context-diagram"><img src="${dataUrl(illustration.completed)}" alt="Completed joint in unchanged source pose, surrounding parts omitted"><figcaption>Completed joint detail; surrounding model omitted, fit and access unverified</figcaption></figure>` : ""}${illustration.alternate ? `<figure class="context-diagram"><img src="${dataUrl(illustration.alternate)}" alt="Alternate view of the same unchanged assembly pose"><figcaption>${step.alternateDetailIds ? "Receiver detail before placement; surrounding model omitted, access unverified" : step.alternateBeforePlacement ? "Receiving assembly before placement" : "Another view — not a physical flip"}</figcaption></figure>` : ""}</div>${step.targets?.length ? `<p class="target-legend">${step.targets.map((target) => `<strong>${esc(target.label)}</strong>: ${esc(target.caption ?? "Approximate source destination")}`).join(" · ")}</p>` : ""}<div class="instruction-tray">${illustration.tray.map(({ lot, png }) => `<figure>${png ? `<img src="${dataUrl(png)}" alt="${esc(lot.name ?? lot.ref)}">` : `<span class="no-thumbnail">${lot.kind ? "Generated representation — verify real parts" : "No picture"}</span>`}<figcaption><strong>${lot.kind === "drawing" ? "Drawing only: " : lot.quantity + " × "}${esc(lot.name ?? lot.ref)}</strong><br>${esc(lot.colorName ?? "Colour " + lot.colorCode)}<br><small>${esc(lot.ref)}</small></figcaption></figure>`).join("")}</div>`;
}
export const illustrationCss = `.instruction-illustration{position:relative}.main-diagram{width:100%;height:auto}.context-diagram{width:32%;margin:0 0 8px auto;border:1px solid #a94e00;background:white}.context-diagram img{width:100%;height:auto}.context-diagram figcaption{font-size:11px;padding:3px}.instruction-tray{display:flex;gap:8px;flex-wrap:wrap;border-top:1px solid #bbb;padding-top:8px}.instruction-tray figure{margin:0;flex:1 1 110px;font-size:12px}.instruction-tray img{width:64px;height:64px;object-fit:contain}.instruction-tray small{color:#555}.no-thumbnail{display:block;color:#555;font-size:11px}@media(max-width:600px){.context-diagram{width:min(240px,100%);margin:8px auto}}`;
