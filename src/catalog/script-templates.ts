/**
 * The big sample builds written as build scripts (docs/AGENT-BUILDING.md):
 * fixtures/build-scripts/<name>.json compiles to
 * fixtures/ldraw/templates/<file> (`npm run templates`; a unit test keeps the
 * two identical). Their LDraw text is tens of thousands of lines, so the app
 * loads it on demand (script-template-urls.ts, as bundle assets that the
 * offline snapshot precaches) instead of building it in code like the small
 * samples; `template()` builds the project once the text is registered.
 */
import { importLDraw } from "../ldraw/io";
import { sectionLayers } from "../build-script/layers";
import { AppError, type Project } from "../core/types";
import type { BackdropName } from "../core/scene";

export const TOWN_HINT = "Press Go to start the train round the town!";

export const SCRIPT_TEMPLATES = {
  town: {
    script: "market-town.json",
    file: "market-town.mpd",
    title: "Market town",
    backdrop: "street",
    playHint: TOWN_HINT,
  },
  cathedral: {
    script: "cathedral.json",
    file: "cathedral.mpd",
    title: "Cathedral",
    backdrop: "grass",
  },
  harbour: {
    script: "harbour.json",
    file: "harbour.mpd",
    title: "Harbour",
    backdrop: "beach",
  },
} as const satisfies Record<
  string,
  {
    script: string;
    file: string;
    title: string;
    backdrop: BackdropName;
    playHint?: string;
  }
>;
export type ScriptTemplateName = keyof typeof SCRIPT_TEMPLATES;
export const isScriptTemplate = (name: string): name is ScriptTemplateName =>
  Object.hasOwn(SCRIPT_TEMPLATES, name);

const sources = new Map<ScriptTemplateName, string>();
/** Registers a sample's compiled LDraw text (fetched, or read from disk). */
export function registerScriptTemplateSource(
  name: ScriptTemplateName,
  text: string,
) {
  sources.set(name, text);
}
export const scriptTemplateSourceLoaded = (name: ScriptTemplateName) =>
  sources.has(name);

/** The sample's project: its LDraw text, section layers and title. */
export function scriptTemplateProject(name: ScriptTemplateName): Project {
  const text = sources.get(name);
  if (text === undefined)
    throw new AppError(
      "INVALID_INPUT",
      `The ${SCRIPT_TEMPLATES[name].title} sample loads on demand: open it with loadTemplate()`,
    );
  const spec = SCRIPT_TEMPLATES[name];
  const project = importLDraw(text, spec.file);
  project.title = spec.title;
  sectionLayers(project, text);
  if ("playHint" in spec) project.scene = { playHint: spec.playHint };
  return project;
}
