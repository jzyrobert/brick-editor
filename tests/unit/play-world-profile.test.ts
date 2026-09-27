import { expect, it } from "vitest";
import { mechanismFixture } from "../../src/mechanisms/fixtures";
import { occurrences } from "../../src/core/document";
import {
  resolvePlayWorldProfile,
  validatePlayWorldProfile,
} from "../../src/play/world-profile";
import { PlaySession } from "../../src/play/session";
import type { CollisionSnapshot, PlayWorldProfile } from "../../src/play/types";
import { validate } from "../../src/core/validate";

it("includes hidden and locked authored occurrences by default and excludes only named layers", () => {
  const p = mechanismFixture(),
    all = occurrences(p);
  p.layers[p.defaultLayerId].visible = false;
  p.layers[p.defaultLayerId].locked = true;
  p.layers.roof = {
    id: "roof",
    name: "Roof",
    visible: false,
    locked: true,
    order: 2,
  };
  p.layers.empty = {
    id: "empty",
    name: "Empty",
    visible: true,
    locked: false,
    order: 3,
  };
  p.layerAssignments[all[0].id] = "roof";
  expect(resolvePlayWorldProfile(p).includedOccurrenceIds).toEqual(
    all.map((o) => o.id),
  );
  const profile = resolvePlayWorldProfile(p, {
    excludedLayerIds: ["roof", "empty"],
  });
  expect(profile.excludedLayerIds).toEqual(["empty", "roof"]);
  expect(profile.includedOccurrenceIds).toEqual(all.slice(1).map((o) => o.id));
  expect(() =>
    resolvePlayWorldProfile(p, { excludedLayerIds: ["missing"] }),
  ).toThrow("unknown layer");
  for (const input of [
    null,
    {},
    { excludedLayerIds: ["roof", "roof"] },
    { excludedLayerIds: [1] },
    { excludedLayerIds: [], visible: true },
  ])
    expect(() => validatePlayWorldProfile(input as PlayWorldProfile)).toThrow();
});

it("refuses any excluded moving-rig member but permits unrelated exclusions", () => {
  const p = mechanismFixture(),
    rig = p.motionRigs!.door;
  p.layers.excluded = {
    id: "excluded",
    name: "Excluded",
    visible: true,
    locked: false,
    order: 2,
  };
  const request = { excludedLayerIds: ["excluded"] };
  expect(() => resolvePlayWorldProfile(p, request, "door")).not.toThrow();
  p.layerAssignments[rig.groups[0].occurrenceIds[0]] = "excluded";
  expect(() => resolvePlayWorldProfile(p, request, "door")).toThrow(
    "selected rig",
  );
  for (const group of rig.groups)
    for (const id of group.occurrenceIds) p.layerAssignments[id] = "excluded";
  expect(() => resolvePlayWorldProfile(p, request, "door")).toThrow(
    "selected rig",
  );
  expect(() => resolvePlayWorldProfile(p, request)).not.toThrow();
});

it("requires collision extraction to match the requested profile and freezes reported inclusion", async () => {
  const mesh: CollisionSnapshot = {
    revision: 0,
    vertices: new Float32Array(),
    indices: new Uint32Array(),
    bounds: { min: [-10, -10, -10], max: [10, 0, 10] },
  };
  const request = { worldProfile: { excludedLayerIds: ["roof"] } };
  await expect(PlaySession.create(mesh, request)).rejects.toThrow("extracted");
  mesh.worldProfile = {
    excludedLayerIds: ["roof"],
    includedOccurrenceIds: [JSON.stringify(["floor"])],
  };
  const s = await PlaySession.create(mesh, request);
  try {
    mesh.worldProfile.includedOccurrenceIds.push(JSON.stringify(["wall"]));
    request.worldProfile.excludedLayerIds.length = 0;
    const report = s.snapshot();
    expect(report.worldProfile).toEqual({
      excludedLayerIds: ["roof"],
      includedOccurrenceIds: [JSON.stringify(["floor"])],
    });
    validate("playSnapshot", report);
    expect(() => {
      report.worldProfile.includedOccurrenceIds.length = 0;
    }).toThrow();
    expect(s.snapshot().worldProfile).toBe(report.worldProfile);
    expect(s.snapshot().worldProfile.includedOccurrenceIds).toEqual([
      JSON.stringify(["floor"]),
    ]);
  } finally {
    s.dispose();
  }
  mesh.worldProfile.includedOccurrenceIds = [
    JSON.stringify(["floor"]),
    JSON.stringify(["floor"]),
  ];
  await expect(
    PlaySession.create(mesh, { worldProfile: { excludedLayerIds: ["roof"] } }),
  ).rejects.toThrow("occurrence profile");
});
it("checks every selected rig layer and rejects inherited, duplicate and oversized rig selections", () => {
  const p = mechanismFixture(),
    vehicle = p.motionRigs.vehicle;
  p.layers.hidden = {
    id: "hidden",
    name: "Hidden",
    order: 2,
    visible: false,
    locked: false,
  };
  p.layerAssignments[vehicle.groups[0].occurrenceIds[0]] = "hidden";
  expect(() =>
    resolvePlayWorldProfile(p, undefined, ["door", "vehicle"]),
  ).not.toThrow();
  expect(() =>
    resolvePlayWorldProfile(p, { excludedLayerIds: ["hidden"] }, [
      "door",
      "vehicle",
    ]),
  ).toThrow("selected rig");
  expect(() => resolvePlayWorldProfile(p, undefined, ["door", "door"])).toThrow(
    "distinct",
  );
  expect(() => resolvePlayWorldProfile(p, undefined, ["__proto__"])).toThrow(
    "Unknown authored",
  );
  expect(() =>
    resolvePlayWorldProfile(
      p,
      undefined,
      Array.from({ length: 33 }, (_, i) => `r${i}`),
    ),
  ).toThrow("32");
});
