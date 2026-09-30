import { validateRequest } from "../core/validate-request";
import { zipSync, strToU8 } from "fflate";
import {
  type Project,
  type Scope,
  type Diagnostic,
  type Occurrence,
  ensure,
} from "../core/types";
import { partKey } from "./decisions";
import { resolveScope } from "../core/scope";
export { resolveScope } from "../core/scope";
import { physical } from "../core/math";
import { sha256, stable } from "../core/hash";
import { mappingLock, libraryLock } from "../catalog/catalog";
import mappings from "../catalog/mappings.json";
import { validate } from "../core/validate";
import {
  colorExistence,
  loadColorAvailability,
  type ColorExistence,
} from "../catalog/color-availability";
import { colors as palette } from "../catalog/catalog";
export type InventoryRequest = {
  expectedRevision: number;
  format: "bricklink-wanted-xml";
  scope: Scope;
  buildMultiplier?: number;
  condition?: "any" | "new" | "used";
  wantedListId?: string;
  remarks?: string;
  excludeAuthoredFigures?: boolean;
  errorPolicy?: "block" | "export-resolved";
  acceptUnknownColors?: boolean;
  /** Accept mappings derived from the LDraw part files' own BrickLink
   * keywords (not individually reviewed); reported as acknowledged. */
  acceptDerivedMappings?: boolean;
};
export type Lot = {
  itemId: string;
  colorId: string;
  quantity: number;
  occurrenceIds: string[];
  layers: Record<string, number>;
  verification: "verified" | "acknowledged";
  /** Whether the part is known to exist in this colour (colour availability
   * pack; the weakest of the lot's occurrences). */
  colorExistence: ColorExistence;
};
/** Mapping tier of a part in the mapping pack (spec §6.6), strongest first. */
export type MappingTier =
  /** Curated catalogue: BrickLink catalogue page reviewed (verified). */
  | "verified"
  /** Derived, then cross-checked against Rebrickable by a maintainer. */
  | "reviewed"
  /** The BrickLink number the LDraw part file states (not reviewed). */
  | "derived"
  /** The part file names several BrickLink numbers: a person must choose. */
  | "ambiguous"
  /** No mapping. */
  | "unmapped"
  /** Project-local geometry: not orderable unless mapped by hand. */
  | "custom";
/**
 * One line of the parts-list resolution list: every occurrence of one part in
 * one colour, whether or not it can be exported, with what the pack knows,
 * what the user decided and what still needs attention.
 */
export type ResolutionRow = {
  /** Decision key ("official:3001.dat"). */
  part: string;
  ref: string;
  namespace: "official" | "project" | "missing";
  colorCode: string;
  colorId?: string;
  quantity: number;
  occurrenceIds: string[];
  tier: MappingTier;
  /** What the list uses: the tier, the user's part decision ("user"), an
   * occurrence override or an exclusion. */
  mapping: MappingTier | "user" | "override" | "excluded";
  /** Item bought (decision, else the pack's mapping). */
  itemId?: string;
  /** The pack's own mapping, when it has one. */
  suggestedItemId?: string;
  /** Numbers the part file names when ambiguous. */
  candidates?: string[];
  origin?: "candidate" | "derived" | "reviewed" | "user";
  colorExistence: ColorExistence;
  /** The user accepted this colour's uncertain existence. */
  colorAccepted: boolean;
  status: "ready" | "accepted" | "needs-attention" | "excluded";
  /** Codes of the diagnostics that block this row. */
  problems: string[];
};
/** Weakest first: a lot is only as certain as its least certain occurrence. */
const existenceOrder: ColorExistence[] = [
  "not-produced",
  "not-recorded",
  "unknown",
  "derived",
  "verified",
];
const weakest = (a: ColorExistence, b: ColorExistence) =>
  existenceOrder.indexOf(b) < existenceOrder.indexOf(a) ? b : a;
function groupFor(
  groups: Map<string, ResolutionRow>,
  o: Occurrence,
  key: string,
  tier: MappingTier,
  suggested: string | undefined,
  candidates: string[] | undefined,
  multiplier: number,
) {
  const id = key + "|" + o.colorCode;
  let g = groups.get(id);
  if (!g)
    groups.set(
      id,
      (g = {
        part: key,
        ref: o.node.ref,
        namespace: o.namespace,
        colorCode: o.colorCode,
        quantity: 0,
        occurrenceIds: [],
        tier,
        mapping: tier,
        ...(suggested ? { itemId: suggested, suggestedItemId: suggested } : {}),
        ...(candidates ? { candidates: [...candidates] } : {}),
        colorExistence: "verified",
        colorAccepted: false,
        status: "ready",
        problems: [],
      }),
    );
  g.quantity += multiplier;
  g.occurrenceIds.push(o.id);
  return g;
}
export type Preview = {
  previewId: string;
  documentRevision: number;
  mappingPackSha256: string;
  sourceOccurrenceCount: number;
  resolvedPhysicalUnitCount: number;
  lotCount: number;
  canExportComplete: boolean;
  rows: Lot[];
  /** Every part/colour in scope with its mapping and colour status, needing
   * attention first (the Export dialog's resolution list). */
  resolution: ResolutionRow[];
  diagnostics: Diagnostic[];
  excludedOccurrenceIds: string[];
  substitutions: string[];
  request: InventoryRequest;
  projectHash: string;
};
export const xmlText = (s: string) => {
  ensure(
    !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\ufffe\uffff]|[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/u.test(
      s,
    ),
    "INVALID_INPUT",
    "Text contains invalid XML characters",
  );
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
};
export function wantedXML(rows: Lot[], r: InventoryRequest) {
  const tag = (name: string, value: string | number) =>
    `    <${name}>${xmlText(String(value))}</${name}>`;
  return (
    "<INVENTORY>\n" +
    rows
      .map((row) => {
        ensure(
          Number.isSafeInteger(row.quantity) && row.quantity > 0,
          "QUANTITY_OVERFLOW",
          "Invalid lot quantity",
        );
        return [
          "  <ITEM>",
          tag("ITEMTYPE", "P"),
          tag("ITEMID", row.itemId),
          tag("COLOR", row.colorId),
          tag("MINQTY", row.quantity),
          ...(r.condition && r.condition !== "any"
            ? [tag("CONDITION", r.condition === "new" ? "N" : "U")]
            : []),
          ...(r.wantedListId ? [tag("WANTEDLISTID", r.wantedListId)] : []),
          ...(r.remarks ? [tag("REMARKS", r.remarks)] : []),
          "  </ITEM>",
        ].join("\n");
      })
      .join("\n") +
    "\n</INVENTORY>\n"
  );
}
type DerivedTable = {
  parts: Record<string, string>;
  ambiguous?: Record<string, string[]>;
};
let derivedLoad: Promise<DerivedTable> | undefined;
/** The derived mapping table (src/catalog/mappings-derived.json), pinned by
 * hash in mappings.json and loaded only when an inventory is built. */
export const derivedMappings = () =>
  (derivedLoad ??= import("../catalog/mappings-derived.json").then(
    (m) => (m.default ?? m) as unknown as DerivedTable,
  ));

export class InventoryService {
  private previews = new Map<string, Preview>();
  async preview(p: Project, request: InventoryRequest): Promise<Preview> {
    validateRequest("inventory", request);
    ensure(
      request.expectedRevision === p.revision,
      "REVISION_CONFLICT",
      "Inventory revision is stale",
    );
    ensure(
      p.library.manifestSha256 === libraryLock.manifestSha256,
      "INVALID_INPUT",
      "Required geometry library is unavailable",
    );
    ensure(
      p.marketplace.mappingPackSha256 === mappingLock.mappingPackSha256,
      "INVALID_INPUT",
      "Required mapping pack is unavailable",
    );
    if (request.remarks) xmlText(request.remarks);
    const r = structuredClone(request),
      scope = resolveScope(p, r.scope),
      lots = new Map<string, Lot>(),
      diagnostics: Diagnostic[] = [],
      excluded: string[] = [],
      substitutions: string[] = [],
      groups = new Map<string, ResolutionRow>();
    let units = 0;
    const multiplier = r.buildMultiplier ?? 1;
    const decisions = p.marketplace.partDecisions ?? {};
    // The derived table is only needed (and loaded) when an official part in
    // scope has no curated mapping. Loaded lazily, it can be unavailable
    // offline before first use: those parts then stay unmapped (blocked).
    const curatedParts = mappings.parts as Record<
      string,
      { itemId: string; verifiedColors: string[] }
    >;
    const reviewedParts =
      (
        mappings as unknown as {
          reviewed?: { parts: Record<string, { itemId: string }> };
        }
      ).reviewed?.parts ?? {};
    let derivedMissing = false;
    const derived = scope.some(
      (o) =>
        o.namespace === "official" &&
        !Object.hasOwn(curatedParts, "official:" + o.node.ref),
    )
      ? await derivedMappings().catch(() => {
          derivedLoad = undefined;
          derivedMissing = true;
          return { parts: {}, ambiguous: {} } as DerivedTable;
        })
      : ({ parts: {}, ambiguous: {} } as DerivedTable);
    // Colour availability (verified/derived part colours) is its own field of
    // each lot; unavailable offline before first use, it counts as unknown.
    await loadColorAvailability().catch(() => undefined);
    const colourName = (code: string) =>
      palette.find((c) => c.code === code)?.name ?? "colour " + code;
    const problem = (
      code: string,
      message: string,
      id: string,
      severity: "warning" | "error" = "error",
      details?: unknown,
    ) =>
      diagnostics.push({
        code,
        message,
        severity,
        occurrenceIds: [id],
        ...(details !== undefined ? { details } : {}),
      });
    /** Custom colour definitions of the project (need an explicit mapping). */
    const customColours = new Set<string>();
    for (const m of Object.values(p.models))
      for (const line of m.records) {
        const c = /^0\s+!COLOUR.+\sCODE\s+(\d+)(?:\s|$)/.exec(line.raw);
        if (c) customColours.add(c[1]);
      }
    /** Parts left out by a decision: one warning per part, not per copy. */
    const excludedByDecision = new Map<string, string[]>();
    for (const o of scope) {
      if (
        r.excludeAuthoredFigures &&
        Array.isArray(p.metadata.authoredFigureIds) &&
        (p.metadata.authoredFigureIds as string[]).includes(o.id)
      ) {
        excluded.push(o.id);
        continue;
      }
      const key = partKey(o);
      const override = p.marketplace.overrides[o.id];
      const decision = override ? undefined : decisions[key];
      // Mapping tiers, strongest first: curated (catalogue verified), reviewed
      // (cross-checked), derived (the LDraw file's own BrickLink keyword),
      // ambiguous (the file names several numbers). Official parts only.
      const official = o.namespace === "official";
      const curated = curatedParts[o.namespace + ":" + o.node.ref];
      const reviewed =
        !curated && official
          ? reviewedParts["official:" + o.node.ref]
          : undefined;
      const keyword =
        !curated &&
        !reviewed &&
        official &&
        Object.hasOwn(derived.parts, o.node.ref)
          ? derived.parts[o.node.ref]
          : undefined;
      const candidates =
        !curated && !reviewed && !keyword && official
          ? derived.ambiguous?.[o.node.ref]
          : undefined;
      const tier: ResolutionRow["mapping"] = curated
        ? "verified"
        : reviewed
          ? "reviewed"
          : keyword
            ? "derived"
            : candidates
              ? "ambiguous"
              : o.namespace === "project"
                ? "custom"
                : "unmapped";
      const suggested = curated?.itemId ?? reviewed?.itemId ?? keyword;
      const group = groupFor(
        groups,
        o,
        key,
        tier,
        suggested,
        candidates,
        multiplier,
      );
      if (decision?.exclude) {
        excluded.push(o.id);
        excludedByDecision.set(key, [
          ...(excludedByDecision.get(key) ?? []),
          o.id,
        ]);
        group.mapping = "excluded";
        group.status = "excluded";
        continue;
      }
      const codes: string[] = [];
      let blocked = false;
      const block = (code: string, msg: string, details?: unknown) => {
        problem(code, msg, o.id, "error", details);
        codes.push(code);
        blocked = true;
      };
      if (!physical(o.transform) && !override?.acknowledged)
        block(
          "NONPHYSICAL_TRANSFORM",
          "Mirrored, scaled or sheared occurrence needs an acknowledged purchasing decision.",
        );
      const chosen = decision?.itemId;
      let itemId = override?.itemId || chosen || suggested,
        colorId =
          override?.colorId ||
          (mappings.colors as Record<string, string>)[o.colorCode];
      let verification: Lot["verification"] = "verified";
      // Colour existence is recorded per LDraw part; it no longer describes
      // an item the user typed themselves.
      const existence: ColorExistence =
        official && !override && decision?.origin !== "user"
          ? colorExistence(o.node.ref, o.colorCode)
          : "unknown";
      let colourAccepted = false;
      if (override) {
        ensure(
          override.acknowledged,
          "INVALID_INPUT",
          "Unacknowledged override",
        );
        verification = "acknowledged";
        group.mapping = "override";
        problem(
          "ACKNOWLEDGED_MAPPING",
          "User mapping is acknowledged, not catalogue verified.",
          o.id,
          "warning",
        );
        if (override.substitution) substitutions.push(o.id);
      } else {
        if (chosen) {
          verification = "acknowledged";
          group.mapping = "user";
          group.itemId = chosen;
          group.origin = decision!.origin;
          problem(
            "ACKNOWLEDGED_MAPPING",
            `You chose BrickLink ${chosen} for ${o.node.ref}${decision!.checked ? " and checked it yourself" : ""}; it is acknowledged, not catalogue verified.`,
            o.id,
            "warning",
          );
        } else if (candidates)
          block(
            "AMBIGUOUS_MAPPING",
            `${o.node.ref} could be BrickLink ${candidates.join(" or ")}; choose one.`,
            { candidates },
          );
        else if (!suggested)
          block(
            o.namespace === "project"
              ? "NON_ORDERABLE_GEOMETRY"
              : "UNMAPPED_PART",
            "No verified purchasing rule for " +
              o.node.ref +
              (derivedMissing && official
                ? " (the derived mapping table could not be loaded; it loads once online)"
                : ""),
          );
        else if (!curated) {
          const code = reviewed ? "REVIEWED_MAPPING" : "DERIVED_MAPPING";
          const origin = reviewed
            ? `BrickLink ${suggested} comes from the LDraw part file's own BrickLink keyword and was cross-checked against Rebrickable by a maintainer, not against BrickLink's catalogue`
            : `BrickLink ${suggested} comes from the LDraw part file's own BrickLink keyword, not a reviewed catalogue page`;
          if (r.acceptDerivedMappings) {
            verification = "acknowledged";
            problem(code, origin + "; accepted explicitly.", o.id, "warning");
          } else
            block(
              code,
              `${origin} (${o.node.ref}); accept it or map it yourself.`,
            );
        }
        if (!colorId || o.colorCode === "16")
          block(
            "UNMAPPED_COLOR",
            "No verified colour mapping for " + o.colorCode,
          );
        if (customColours.has(o.colorCode))
          block(
            "UNMAPPED_COLOR",
            "Project colour definition needs an explicit mapping",
          );
        if (
          itemId &&
          colorId &&
          (!curated || chosen || !curated.verifiedColors.includes(o.colorCode))
        ) {
          if (existence === "not-produced")
            block(
              "INVALID_PART_COLOR",
              `BrickLink's catalogue lists no ${itemId} in ${colourName(o.colorCode)}: it is not known to have been made. Choose another colour or map it yourself.`,
            );
          else {
            const why =
              existence === "derived"
                ? "Rebrickable records this part in this colour (derived, not catalogue verified)"
                : existence === "not-recorded"
                  ? "No source records this part in this colour; it may never have been made"
                  : "Whether this part was made in this colour is unknown";
            colourAccepted =
              r.acceptUnknownColors === true ||
              !!decision?.acceptedColors?.includes(o.colorCode);
            if (colourAccepted) {
              verification = "acknowledged";
              problem(
                "UNVERIFIED_PART_COLOR",
                why + "; uncertainty explicitly accepted.",
                o.id,
                "warning",
              );
            } else
              block(
                "UNVERIFIED_PART_COLOR",
                why +
                  ". Acknowledge the uncertainty or choose a verified colour.",
              );
          }
        }
      }
      group.colorExistence = weakest(group.colorExistence, existence);
      if (colourAccepted) group.colorAccepted = true;
      if (colorId) group.colorId = colorId;
      if (verification === "acknowledged" && group.status === "ready")
        group.status = "accepted";
      for (const c of codes)
        if (!group.problems.includes(c)) group.problems.push(c);
      if (blocked || !itemId || !colorId) {
        group.status = "needs-attention";
        excluded.push(o.id);
        continue;
      }
      ensure(
        /^[\w.-]+$/.test(itemId) && /^\d+$/.test(colorId),
        "INVALID_INPUT",
        "Invalid catalogue identifiers",
      );
      const lotKey = itemId + "|" + colorId;
      const lot = lots.get(lotKey) || {
        itemId,
        colorId,
        quantity: 0,
        occurrenceIds: [],
        layers: {},
        verification,
        colorExistence: existence,
      };
      if (
        !Number.isSafeInteger(lot.quantity + multiplier) ||
        !Number.isSafeInteger(units + multiplier)
      ) {
        block("QUANTITY_OVERFLOW", "Quantity exceeds safe integer range");
        group.status = "needs-attention";
        excluded.push(o.id);
        continue;
      }
      lot.quantity += multiplier;
      units += multiplier;
      lot.occurrenceIds.push(o.id);
      lot.layers[o.layerId] = (lot.layers[o.layerId] || 0) + multiplier;
      if (verification === "acknowledged") lot.verification = verification;
      lot.colorExistence = weakest(lot.colorExistence, existence);
      lots.set(lotKey, lot);
    }
    for (const [key, ids] of excludedByDecision)
      diagnostics.push({
        code: "EXCLUDED_BY_USER",
        message: `You left ${key.slice(key.indexOf(":") + 1)} out of the parts list (${ids.length} ${ids.length === 1 ? "copy" : "copies"}).`,
        severity: "warning",
        occurrenceIds: ids,
      });
    const rows = [...lots.values()].sort(
      (a, b) =>
        a.itemId.localeCompare(b.itemId, "en") ||
        Number(a.colorId) - Number(b.colorId),
    );
    if (!rows.length)
      diagnostics.push({
        code: "EMPTY_INVENTORY",
        message: "No resolved lots to export.",
        severity: "error",
        occurrenceIds: [],
      });
    const statusOrder = ["needs-attention", "accepted", "ready", "excluded"];
    const resolution = [...groups.values()].sort(
      (a, b) =>
        statusOrder.indexOf(a.status) - statusOrder.indexOf(b.status) ||
        a.ref.localeCompare(b.ref, "en") ||
        Number(a.colorCode) - Number(b.colorCode) ||
        a.colorCode.localeCompare(b.colorCode),
    );
    const projectHash = await sha256(stable(p)),
      previewId = await sha256(stable({ projectHash, request: r }));
    const preview: Preview = {
      previewId,
      projectHash,
      documentRevision: p.revision,
      mappingPackSha256: p.marketplace.mappingPackSha256,
      sourceOccurrenceCount: scope.length,
      resolvedPhysicalUnitCount: units,
      lotCount: rows.length,
      canExportComplete: !diagnostics.some((d) => d.severity === "error"),
      rows,
      resolution,
      diagnostics,
      excludedOccurrenceIds: excluded,
      substitutions,
      request: r,
    };
    validate("inventoryPreview", preview);
    this.previews.set(previewId, structuredClone(preview));
    if (this.previews.size > 32)
      this.previews.delete(this.previews.keys().next().value!);
    return preview;
  }
  async export(
    p: Project,
    r: {
      previewId: string;
      expectedRevision: number;
      expectedMappingPackSha256: string;
      errorPolicy: "block" | "export-resolved";
    },
  ) {
    validateRequest("inventoryExport", r);
    const preview = this.previews.get(r.previewId);
    ensure(
      preview &&
        r.expectedRevision === p.revision &&
        r.expectedMappingPackSha256 === p.marketplace.mappingPackSha256 &&
        preview.projectHash === (await sha256(stable(p))),
      "STALE_INVENTORY_PREVIEW",
      "Inventory preview is stale; generate a fresh preview",
    );
    const report = {
      ...preview,
      complete: preview.canExportComplete,
      profile: "bricklink-wanted-xml",
      mappingVersion: mappings.version,
      liveDestinationValidation: "not-performed",
      currentSellerAvailability: "not-queried",
    };
    ensure(
      preview.canExportComplete || r.errorPolicy === "export-resolved",
      "INVENTORY_BLOCKED",
      "Resolve inventory blockers or explicitly export resolved items.",
      report,
    );
    if (!preview.rows.length)
      return {
        name: "inventory-report.json",
        mimeType: "application/json",
        bytes: strToU8(JSON.stringify(report, null, 2)),
        manifest: report,
      };
    const xml = wantedXML(preview.rows, preview.request);
    if (!preview.canExportComplete)
      return {
        name: "wanted-list.partial.zip",
        mimeType: "application/zip",
        bytes: zipSync({
          "wanted-list.partial.xml": strToU8(xml),
          "inventory-report.json": strToU8(JSON.stringify(report, null, 2)),
        }),
        manifest: report,
      };
    return {
      name: "wanted-list.xml",
      mimeType: "application/xml",
      bytes: strToU8(xml),
      manifest: report,
    };
  }
}
