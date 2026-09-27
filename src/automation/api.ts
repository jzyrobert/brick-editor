import { type Editor } from "../core/commands";
import { type CameraSpec, type Command, ensure } from "../core/types";
import { occurrences } from "../core/document";
import { importLDraw, exportLDraw, scopedLDraw } from "../ldraw/io";
import { encodeNative, decodeNative } from "../persistence/native";
import {
  InventoryService,
  type InventoryRequest,
  resolveScope,
} from "../inventory/service";
import type { SceneAdapter, RenderRequest } from "../render/adapter";
import { template } from "../catalog/templates";
import capabilities from "./capabilities.json";
import { JobRegistry, runWorker } from "./jobs";
import type { Project } from "../core/types";
import { validate } from "../core/validate";
export function createAPI(
  editor: Editor,
  render: () => SceneAdapter | undefined,
) {
  const inventory = new InventoryService(),
    jobs = new JobRegistry();
  const renderer = () => {
    const r = render();
    ensure(r, "WEBGL_UNAVAILABLE", "WebGL2 renderer unavailable");
    return r;
  };
  return {
    apiVersion: "1.0" as const,
    capabilities: async () => capabilities,
    jobs: {
      list: async () => jobs.list(),
      status: async (id: string) => jobs.status(id),
      cancel: async (id: string) => jobs.cancel(id),
      wait: async (id: string) => jobs.wait(id),
    },
    ready: async (options: { minRevision?: number; strict?: boolean } = {}) =>
      renderer().ready(options.minRevision, options.strict),
    project: {
      import: async (input: {
        format: "ldraw" | "native" | "template";
        text?: string;
        bytes?: number[];
        name?: string;
        strict?: boolean;
        template?: "blank" | "room" | "wall" | "200";
      }) => {
        validate("importRequest", input);
        ensure(
          ["ldraw", "native", "template"].includes(input.format),
          "INVALID_INPUT",
          "Unknown import format",
        );
        const baseRevision = editor.project.revision;
        const p =
          input.format === "ldraw"
            ? await jobs.wait<Project>(
                jobs.start("import", (signal) =>
                  runWorker<Project>(
                    new Worker(
                      new URL("../workers/import.worker.ts", import.meta.url),
                      { type: "module" },
                    ),
                    { text: input.text || "", name: input.name },
                    signal,
                  ),
                ),
              )
            : input.format === "native"
              ? await jobs.wait<Project>(
                  jobs.start("native-import", () =>
                    decodeNative(new Uint8Array(input.bytes || [])),
                  ),
                )
              : template(input.template || "blank");
        if (input.strict)
          ensure(
            !p.diagnostics.some((d) => d.code === "REFERENCE_MISSING"),
            "REFERENCE_MISSING",
            "Strict import refuses missing references",
          );
        ensure(
          editor.project.revision === baseRevision,
          "REVISION_CONFLICT",
          "Document changed during import",
        );
        return editor.replace(p);
      },
      export: async (input: {
        format: "ldraw" | "native";
        scope?: Parameters<typeof resolveScope>[1];
      }) => {
        validate("exportRequest", input);
        const p = editor.project;
        return input.format === "native"
          ? {
              name: p.title + ".brickproj",
              mimeType: "application/zip",
              bytes: await encodeNative(p),
            }
          : {
              name: p.title + ".mpd",
              mimeType: "text/plain",
              bytes: new TextEncoder().encode(
                input.scope
                  ? scopedLDraw(
                      p,
                      resolveScope(p, input.scope).map((o) => o.id),
                    )
                  : exportLDraw(p),
              ),
            };
      },
    },
    inventory: {
      preview: async (input: InventoryRequest) =>
        inventory.preview(editor.project, input),
      export: async (input: Parameters<InventoryService["export"]>[1]) =>
        inventory.export(editor.project, input),
    },
    query: async (
      input: {
        colorCode?: string;
        ref?: string;
        layerId?: string;
        occurrenceIds?: string[];
      } = {},
    ) => {
      validate("query", input);
      const p = editor.project;
      return {
        revision: p.revision,
        occurrences: occurrences(p).filter(
          (o) =>
            (!input.colorCode || o.colorCode === input.colorCode) &&
            (!input.ref || o.node.ref === input.ref) &&
            (!input.layerId || o.layerId === input.layerId) &&
            (!input.occurrenceIds || input.occurrenceIds.includes(o.id)),
        ),
        diagnostics: p.diagnostics,
      };
    },
    dispatch: async (input: Command) => editor.dispatch(input),
    transaction: async (input: Parameters<Editor["transaction"]>[0]) =>
      editor.transaction(input),
    camera: { set: async (input: CameraSpec) => renderer().setCamera(input) },
    render: {
      image: async (input: RenderRequest) => {
        ensure(
          input.revision === editor.project.revision,
          "REVISION_CONFLICT",
          "Capture revision is stale",
        );
        const result = await renderer().image(input);
        ensure(
          input.revision === editor.project.revision,
          "REVISION_CONFLICT",
          "Document changed during capture",
        );
        return result;
      },
    },
  };
}
export type BrickEditorAPI = ReturnType<typeof createAPI>;
declare global {
  interface Window {
    brickEditor?: BrickEditorAPI;
  }
}
