import { WINDOW_GLASS } from "../../src/build-script/part-companions";
// Corrected generation data. v1 and legacy prose remain reproducible controls.
import { catalog } from "../../src/catalog/catalog";
import {
  placement,
  commonColours,
  type SearchArgs,
} from "../../src/build-script/part-list";
import { searchParts } from "../../src/build-script/part-search";
import {
  partReference,
  FIELD_GUIDES,
  type FactField,
  type PartReference,
} from "./part-reference";

export const REFERENCE_V2 = "spatial-part-facts/2";
export const REFERENCE_GUIDE =
  "Generation reference v2: x/z positions are studs (20 LDU), y positions are plates (8 LDU), positive y up. Nominal dimensions below are compiler placement/reservation dimensions, rounded to its grid; they are not measured physical extents or guaranteed stacking/contact surfaces. Default place quarter-turns use the minimum corner of the rotated footprint, not the original corner; group rotates about its at, while instance uses its declared plot. Geometry facts describe only the requested library part, excluding compiler-added companions. Unknown means unavailable, not zero or incompatible. Colour records are pinned snapshot evidence, not an exhaustive statement of real-world availability; the compiler can reject unrecorded combinations. A search role or partial match is a discovery suggestion, not proof of a shape, included component or usable interface. Compiler acceptance does not certify physical connections, stability or assembly order. Minimum-footprint place automatically adds panes for window frames 60592/60593/60594; wheels on 4600 adds two rims and two tyres. Origin-anchor place bypasses both expansions; macro counts depend on options. Library shortcuts may contain multiple physical pieces. Counts here mean compiler-emitted instances, not a certified physical-piece count.";
export const V2_GUIDES = {
  ...FIELD_GUIDES,
  shape: FIELD_GUIDES.shape
    .replace("facts v1", "facts v2")
    .replace(
      "nominal stacking height excludes them",
      "nominal stacking height is the compiler's rounded reservation, not necessarily a real stacking surface",
    ),
  capabilities:
    "Capabilities v2: pose support and validation coverage are separate. Upright quarter turns and whole studs/plates are expressible. Data availability does not certify any particular mating; stud checks and collision checks have partial coverage. Sideways/inverted placements, unsupported interfaces, strength and assembly order remain unavailable or unverified.",
};
export type ReferenceV2 = Omit<PartReference, "version"> & {
  version: typeof REFERENCE_V2;
  emission: ReturnType<typeof emissionFacts>;
};
export function referenceV2(
  ref: string,
  fields: FactField[],
  offset = 0,
  limit = 16,
): ReferenceV2 {
  const old = partReference(ref.toLowerCase(), fields, offset, limit);
  const out: ReferenceV2 = {
    ...old,
    version: REFERENCE_V2,
    emission: emissionFacts(old.part),
  };
  // This slab passes THROUGH the central opening, with positive height above
  // the underside. v1's negative-Y slab was merely below the entire arch.
  if (out.part === "3659.dat" && out.shape?.description.value) {
    out.shape.description = structuredClone(out.shape.description);
    out.shape.description.value!.opening = {
      min: [25, 0, -1],
      max: [55, 8, 21],
      guarantee: "conservative-clearance",
    };
    out.shape.description.provenance!.version = REFERENCE_V2;
  }
  if (out.capabilities) {
    out.capabilities.propertyCoverage.studMating = "partially";
    out.capabilities.interfacePose.uprightStudStack = "unknown";
    // Upright pose support is not evidence that this part offers a usable stack.
  }
  return out;
}
export function placementSize(ref: string) {
  try {
    const p = placement(ref);
    return { w: p.x, d: p.z, h: p.plates };
  } catch {
    return null;
  }
}
export function emissionFacts(ref: string) {
  return {
    automaticCompanions: WINDOW_GLASS[ref] ? [WINDOW_GLASS[ref]] : [],
    defaultPlaceInstances: WINDOW_GLASS[ref] ? 2 : 1,
    withWheelsInstances: ref === "4600.dat" ? 5 : null,
    originAnchorInstances: 1,
    scope:
      "compiler-emitted library instances; geometry facts exclude companions; not physical shortcut piece counts",
  };
}
export function discoveryEntry(ref: string, hideName = false) {
  const size = placementSize(ref);
  return {
    part: ref,
    name: hideName ? null : (catalog[ref]?.name ?? null),
    nominal: size
      ? { xStuds: size.w, zStuds: size.d, stackingPlates: size.h }
      : null,
    emission: emissionFacts(ref),
    dimensionMeaning: "compiler-placement-reservation",
    colours: commonColours(ref),
  };
}
export function parsePlacementSize(text: string) {
  const m =
    /^(\d+(?:\.5)?)\s*[x×*]\s*(\d+(?:\.5)?)(?:\s*[x×*]\s*(\d+)(b?))?$/i.exec(
      text.trim(),
    );
  if (
    !m ||
    Number(m[1]) <= 0 ||
    Number(m[2]) <= 0 ||
    (m[3] !== undefined && Number(m[3]) <= 0)
  )
    throw new Error(
      "Size requires positive whole or half studs, and whole plates (or b for bricks)",
    );
  return {
    w: Number(m[1]),
    d: Number(m[2]),
    ...(m[3] ? { h: Number(m[3]) * (m[4] ? 3 : 1) } : {}),
  };
}
export function correctedSearch(
  args: SearchArgs,
  palette: string[],
  hideNames = false,
) {
  return searchParts(
    {
      query: args.query,
      category: args.category,
      ...(args.size ? { size: parsePlacementSize(args.size) } : {}),
      colour: args.colour,
      availableInColour: args.available_in_colour,
      limit: args.limit ?? 15,
    },
    false,
    {
      ...(palette.length ? { allowedIds: new Set(palette) } : {}),
      sizeOf: placementSize,
    },
  ).map((p) => ({
    ...discoveryEntry(p.id, hideNames),
    name: hideNames ? null : p.name,
    partial: p.partial ?? false,
    ...(p.inColour ? { inColour: p.inColour } : {}),
  }));
}
