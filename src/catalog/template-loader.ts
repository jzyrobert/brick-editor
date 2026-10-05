import { isMotionSample } from "./motion-sample-specs";
import { template } from "./templates";
import {
  AIR_PUMP_SAMPLE,
  airPumpSourceLoaded,
  registerAirPumpSource,
} from "./air-pump-sample";
import type { TemplateName } from "./template-names";
import {
  loadFullLibraryIndex,
  unresolvedCuratedRefs,
} from "./full-library-loader";
import {
  isScriptTemplate,
  registerScriptTemplateSource,
  scriptTemplateSourceLoaded,
} from "./script-templates";

/**
 * A template with every official part resolvable: templates that use parts
 * from the complete library (the castle's flags, the roadster's wheels) are
 * built again once the library index is registered, so their import
 * diagnostics and part namespaces are exact rather than "missing".
 */
export async function loadTemplate(name: TemplateName) {
  // The build-script samples' LDraw text loads on demand.
  if (isScriptTemplate(name) && !scriptTemplateSourceLoaded(name)) {
    const { fetchScriptTemplateSource } = await import(
      "./script-template-urls"
    );
    registerScriptTemplateSource(name, await fetchScriptTemplateSource(name));
  }
  // The air pump sample's LDraw text (with its embedded definitions) also
  // loads on demand; its pneumatic parts come from the complete library.
  if (name === AIR_PUMP_SAMPLE.name && !airPumpSourceLoaded()) {
    const { fetchAirPumpSource } = await import("./air-pump-url");
    registerAirPumpSource(await fetchAirPumpSource());
  }
  // Reviewed Technic proposals require source identities from the full index
  // before their rigs can be authored, including the first open in a fresh tab.
  if (isMotionSample(name) || name === AIR_PUMP_SAMPLE.name)
    await loadFullLibraryIndex();
  const first = template(name);
  if (!unresolvedCuratedRefs(first).size) return first;
  try {
    await loadFullLibraryIndex();
  } catch {
    return first; // Offline without a cached index: parts stay unresolved.
  }
  return template(name);
}
