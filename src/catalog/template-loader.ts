import { template } from "./templates";
import type { TemplateName } from "./template-names";
import {
  loadFullLibraryIndex,
  unresolvedCuratedRefs,
} from "./full-library-loader";

/**
 * A template with every official part resolvable: templates that use parts
 * from the complete library (the castle's flags, the roadster's wheels) are
 * built again once the library index is registered, so their import
 * diagnostics and part namespaces are exact rather than "missing".
 */
export async function loadTemplate(name: TemplateName) {
  const first = template(name);
  if (!unresolvedCuratedRefs(first).size) return first;
  try {
    await loadFullLibraryIndex();
  } catch {
    return first; // Offline without a cached index: parts stay unresolved.
  }
  return template(name);
}
