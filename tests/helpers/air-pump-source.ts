import { directReferences } from "../../src/catalog/full-pack";
import { occurrences } from "../../src/core/document";
import type { Project } from "../../src/core/types";
import { importLDraw } from "../../src/ldraw/io";
import {
  derivePneumaticPlay,
  PNEUMATIC_PLAY_LIBRARY_ROOTS,
  preparePneumaticPlay,
} from "../../src/play/pneumatic-play-source";
import type { PlayPneumaticSource } from "../../src/play/session";
import {
  fullLibrarySources,
  registerFullLibraryFromDisk,
} from "../../scripts/full-library-node";
import {
  AIR_PUMP_FILE,
  airPumpSampleSource,
} from "../../scripts/pneumatic-sample-node";
import { meshOf } from "./play-dynamic-source";

/** Every library text the sample and the reviewed seals read. */
export function airPumpSources(project: Project) {
  registerFullLibraryFromDisk();
  const needed = new Set<string>(PNEUMATIC_PLAY_LIBRARY_ROOTS);
  for (const m of Object.values(project.models))
    for (const ref of directReferences(m.records.map((r) => r.raw).join("\n")))
      if (!project.models[ref]) needed.add(ref);
  return fullLibrarySources([...needed]);
}
export function airPumpProject(text = airPumpSampleSource()) {
  return importLDraw(text, AIR_PUMP_FILE);
}
/** Derivation, preparation and collision meshes exactly as Play entry does. */
export async function airPumpPlay(project: Project = airPumpProject()) {
  const sources = airPumpSources(project),
    all = occurrences(project),
    derived = derivePneumaticPlay(project, { all });
  const candidate = derived.systems[0];
  const prepared = candidate
    ? await preparePneumaticPlay(project, candidate, (n) => sources[n])
    : undefined;
  const moving = new Set(prepared ? candidate.movingOccurrenceIds : []);
  // The test loader looks embedded subparts up under the library's
  // "parts/s/" path; give it their literal embedded text.
  const geometry: Record<string, string> = { ...sources };
  for (const m of Object.values(project.models))
    if (/^s[\\/]/i.test(m.name))
      geometry[
        "parts/s/" + m.name.slice(2).replaceAll("\\", "/").toLowerCase()
      ] = m.records.map((r) => r.raw).join("\n");
  const world = await meshOf(
    project,
    all.filter((o) => !moving.has(o.id)).map((o) => o.id),
    geometry,
  );
  const meshes: PlayPneumaticSource["meshes"] = {};
  if (prepared)
    for (const group of candidate.rig.groups)
      meshes[group.id] = await meshOf(project, group.occurrenceIds, geometry);
  return {
    project,
    sources,
    all,
    derived,
    prepared,
    world,
    pneumatics: { prepared, meshes, skipped: derived.skipped },
  };
}
