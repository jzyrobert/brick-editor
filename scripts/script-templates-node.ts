// Node host for the build-script samples (src/catalog/script-templates.ts):
// compiles their scripts (fixtures/build-scripts/) and registers their
// committed LDraw text (fixtures/ldraw/templates/) so `template()` works in
// scripts and tests without fetching.
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { compileBuildScript } from "../src/build-script/compile";
import {
  SCRIPT_TEMPLATES,
  registerScriptTemplateSource,
  type ScriptTemplateName,
} from "../src/catalog/script-templates";
import { registerAgentData } from "./build-script-cli";
import { registerFullLibraryFromDisk } from "./full-library-node";

const root = fileURLToPath(new URL("../", import.meta.url));

/** The sample's LDraw text compiled from its build script now. */
export function compileScriptTemplate(name: ScriptTemplateName) {
  registerFullLibraryFromDisk();
  registerAgentData();
  const script = JSON.parse(
    readFileSync(
      root + "fixtures/build-scripts/" + SCRIPT_TEMPLATES[name].script,
      "utf8",
    ),
  );
  return compileBuildScript(script, { check: false }).ldraw;
}

/** Registers every committed sample source; returns the names found. */
export function registerScriptTemplatesFromDisk() {
  const found: ScriptTemplateName[] = [];
  for (const name of Object.keys(SCRIPT_TEMPLATES) as ScriptTemplateName[]) {
    const file =
      root + "fixtures/ldraw/templates/" + SCRIPT_TEMPLATES[name].file;
    if (!existsSync(file)) continue;
    registerScriptTemplateSource(name, readFileSync(file, "utf8"));
    found.push(name);
  }
  return found;
}
