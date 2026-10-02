import { occurrences } from "../core/document";
import { ensure, type Project } from "../core/types";
import { partSpec } from "../catalog/extended";
import { paletteColors } from "../catalog/color-availability";
import { instructionComponents, type InstructionComponent } from "./components";
export type InstructionLot = {
  ref: string;
  colorCode: string;
  quantity: number;
  name?: string;
  colorName?: string;
  kind?: "generated-component" | "drawing";
  identityVerified?: false;
  thumbnailRef?: string;
};
/** Physical drawing owners count once; all source IDs remain in render coverage. */
export function instructionLots(
  p: Project,
  ids: string[],
  options: {
    named?: boolean;
    physical?: boolean;
    components?: InstructionComponent[];
    allowPartial?: boolean;
  } = {},
): InstructionLot[] {
  const selected = new Set(ids),
    grouped = new Map<string, InstructionLot>();
  const components = options.physical
    ? (options.components ?? instructionComponents(p))
    : [];
  const owners = new Map(
      components.flatMap((c) => c.occurrenceIds.map((id) => [id, c] as const)),
    ),
    seen = new Set<string>();
  for (const o of occurrences(p)) {
    if (!selected.has(o.id)) continue;
    const owner = owners.get(o.id);
    if (owner) {
      if (seen.has(owner.id)) continue;
      seen.add(owner.id);
      const complete = owner.occurrenceIds.every((id) => selected.has(id));
      ensure(
        complete || options.allowPartial,
        "INVALID_INPUT",
        "A generated flexible element is split across steps. Merge its drawing occurrences before publishing.",
      );
      const ref = "@generated:" + owner.sourceModelId,
        key = JSON.stringify([ref, owner.colorCode, owner.kind]);
      const lot = grouped.get(key) ?? {
        ref,
        colorCode: owner.colorCode,
        quantity: 0,
        name: owner.name,
        colorName:
          paletteColors.find((c) => c.code === owner.colorCode)?.name ??
          "Colour " + owner.colorCode,
        kind:
          !complete || owner.kind === "drawing"
            ? "drawing"
            : "generated-component",
        identityVerified: false,
      };
      if (complete && owner.kind !== "drawing") lot.quantity++;
      grouped.set(key, lot);
      continue;
    }
    if (o.node.kind === "geometry") continue;
    const originalName =
      o.namespace === "official" ? partSpec(o.node.ref)?.name : undefined;
    const moved =
      o.namespace === "official"
        ? originalName?.match(/^[~=]?\s*Moved to\s+([a-z0-9_/.\-]+)/i)?.[1]
        : undefined;
    const target = moved ? moved.replace(/\.dat$/i, "") + ".dat" : undefined;
    const canonical = target ? partSpec(target) : undefined;
    const key = JSON.stringify([o.node.ref, o.colorCode]);
    const lot = grouped.get(key) ?? {
      ref: o.node.ref,
      colorCode: o.colorCode,
      quantity: 0,
      ...(options.named && canonical ? { thumbnailRef: canonical.id } : {}),
      ...(options.named
        ? {
            name:
              canonical?.name ??
              originalName ??
              p.models[o.node.ref]?.records
                .find((r) =>
                  /^0\s+(?!FILE\b|Name:|Author:|!|BFC\b)/i.test(r.raw),
                )
                ?.raw.replace(/^0\s+/, "") ??
              o.node.ref,
            colorName:
              paletteColors.find((c) => c.code === o.colorCode)?.name ??
              "Colour " + o.colorCode,
          }
        : {}),
    };
    lot.quantity++;
    grouped.set(key, lot);
  }
  return [...grouped.values()].sort(
    (a, b) =>
      a.ref.localeCompare(b.ref) || a.colorCode.localeCompare(b.colorCode),
  );
}
