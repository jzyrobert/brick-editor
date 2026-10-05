import { readFileSync } from "node:fs";
import { directReferences } from "../../src/catalog/full-pack";
import {
  registerFullLibraryFromDisk,
  fullLibrarySources,
} from "../../scripts/full-library-node";
import { importLDraw } from "../../src/ldraw/io";
import { sourceHardwareIndex } from "../../src/mechanisms/source-hardware-index";
import {
  PNEUMATIC_PUMP_REFS,
  prepareSourcePneumaticPump,
} from "../../src/play/pneumatic-pump-source";
import type { PneumaticCylinderSurface } from "../../src/play/pneumatic-cylinder-source";
import { compileCylinderMember } from "./pneumatic-cylinder-source";
export const PUMP_FIXTURE =
  "fixtures/play/mechanical-systems/42043-pneumatic-pump.mpd";
export async function pneumaticPumpFixture() {
  registerFullLibraryFromDisk();
  const project = importLDraw(readFileSync(PUMP_FIXTURE, "utf8")),
    needed = new Set<string>(["99798-f1.dat", "99798-f2.dat"]);
  for (const m of Object.values(project.models))
    for (const ref of directReferences(m.records.map((r) => r.raw).join("\n")))
      if (
        !Object.values(project.models).some(
          (m) => m.name.toLowerCase().replaceAll("\\", "/") === ref,
        )
      )
        needed.add(ref);
  const sources = fullLibrarySources([...needed]),
    surfaces = (await Promise.all(
      PNEUMATIC_PUMP_REFS.map((ref) =>
        compileCylinderMember(project, sources, ref),
      ),
    )) as [
      PneumaticCylinderSurface,
      PneumaticCylinderSurface,
      PneumaticCylinderSurface,
      PneumaticCylinderSurface,
    ],
    index = sourceHardwareIndex(project),
    ids = PNEUMATIC_PUMP_REFS.map(
      (ref) => index.hardware.find((h) => h.reference === ref)!.id,
    ) as [string, string, string, string];
  const token = await prepareSourcePneumaticPump(project, sources, {
    occurrenceIds: ids,
    surfaces,
  });
  return { project, sources, surfaces, index, ids, token };
}
