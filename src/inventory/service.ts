import { zipSync, strToU8 } from "fflate";
import {
  type Project,
  type Scope,
  type Diagnostic,
  ensure,
  AppError,
} from "../core/types";
import { occurrences } from "../core/document";
import { physical } from "../core/math";
import { sha256, stable } from "../core/hash";
import { mappingLock, libraryLock } from "../catalog/catalog";
import mappings from "../catalog/mappings.json";
import { validate } from "../core/validate";
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
};
export type Lot = {
  itemId: string;
  colorId: string;
  quantity: number;
  occurrenceIds: string[];
  layers: Record<string, number>;
  verification: "verified" | "acknowledged";
};
export type Preview = {
  previewId: string;
  documentRevision: number;
  mappingPackSha256: string;
  sourceOccurrenceCount: number;
  resolvedPhysicalUnitCount: number;
  lotCount: number;
  canExportComplete: boolean;
  rows: Lot[];
  diagnostics: Diagnostic[];
  excludedOccurrenceIds: string[];
  substitutions: string[];
  request: InventoryRequest;
  projectHash: string;
};
export function resolveScope(p: Project, scope: Scope) {
  const all = occurrences(p);
  if (scope.kind === "all") return all;
  if (scope.kind === "visible") return all.filter((o) => o.visible);
  if (scope.kind === "layers") {
    ensure(
      scope.layerIds.every((id) => p.layers[id]),
      "INVALID_INPUT",
      "Unknown layer",
    );
    return all.filter((o) => scope.layerIds.includes(o.layerId));
  }
  const selected =
    scope.kind === "selection" ? scope.occurrenceIds : [scope.occurrenceId];
  const paths = selected.map((id) => {
    try {
      const path = JSON.parse(id);
      ensure(
        Array.isArray(path) && path.every((s) => typeof s === "string"),
        "INVALID_INPUT",
        "Invalid occurrence path",
      );
      ensure(
        all.some((o) => path.every((s, i) => o.path[i] === s)),
        "INVALID_INPUT",
        "Unknown scope occurrence",
      );
      return path as string[];
    } catch {
      throw new AppError("INVALID_INPUT", "Invalid occurrence scope");
    }
  });
  return all.filter((o) =>
    paths.some((path) => path.every((s, i) => s === o.path[i])),
  );
}
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
export class InventoryService {
  private previews = new Map<string, Preview>();
  async preview(p: Project, request: InventoryRequest): Promise<Preview> {
    validate("inventory", request);
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
      substitutions: string[] = [];
    let units = 0;
    const multiplier = r.buildMultiplier ?? 1;
    const problem = (
      code: string,
      message: string,
      id: string,
      severity: "warning" | "error" = "error",
    ) => diagnostics.push({ code, message, severity, occurrenceIds: [id] });
    for (const o of scope) {
      if (
        r.excludeAuthoredFigures &&
        Array.isArray(p.metadata.authoredFigureIds) &&
        (p.metadata.authoredFigureIds as string[]).includes(o.id)
      ) {
        excluded.push(o.id);
        continue;
      }
      const override = p.marketplace.overrides[o.id];
      const rule = (
        mappings.parts as Record<
          string,
          { itemId: string; verifiedColors: string[] }
        >
      )[o.namespace + ":" + o.node.ref];
      let blocked = false;
      const block = (code: string, msg: string) => {
        problem(code, msg, o.id);
        blocked = true;
      };
      if (!physical(o.transform) && !override?.acknowledged)
        block(
          "NONPHYSICAL_TRANSFORM",
          "Mirrored, scaled or sheared occurrence needs an acknowledged purchasing decision.",
        );
      let itemId = override?.itemId || rule?.itemId,
        colorId =
          override?.colorId ||
          (mappings.colors as Record<string, string>)[o.colorCode];
      let verification: Lot["verification"] = "verified";
      if (override) {
        ensure(
          override.acknowledged,
          "INVALID_INPUT",
          "Unacknowledged override",
        );
        verification = "acknowledged";
        problem(
          "ACKNOWLEDGED_MAPPING",
          "User mapping is acknowledged, not catalogue verified.",
          o.id,
          "warning",
        );
        if (override.substitution) substitutions.push(o.id);
      } else {
        if (!rule)
          block(
            o.namespace === "project"
              ? "NON_ORDERABLE_GEOMETRY"
              : "UNMAPPED_PART",
            "No verified purchasing rule for " + o.node.ref,
          );
        if (!colorId || o.colorCode === "16")
          block(
            "UNMAPPED_COLOR",
            "No verified colour mapping for " + o.colorCode,
          );
        const customColor = Object.values(p.models).some((m) =>
          m.records.some((line) =>
            new RegExp(
              "^0\\s+!COLOUR.+\\sCODE\\s+" + o.colorCode + "(?:\\s|$)",
            ).test(line.raw),
          ),
        );
        if (customColor)
          block(
            "UNMAPPED_COLOR",
            "Project colour definition needs an explicit mapping",
          );
        if (rule && colorId && !rule.verifiedColors.includes(o.colorCode)) {
          if (r.acceptUnknownColors) {
            verification = "acknowledged";
            problem(
              "UNVERIFIED_PART_COLOR",
              "Colour combination uncertainty explicitly accepted.",
              o.id,
              "warning",
            );
          } else
            block(
              "UNVERIFIED_PART_COLOR",
              "Part/colour combination has not been audited; acknowledge uncertainty or choose a verified colour.",
            );
        }
      }
      if (blocked || !itemId || !colorId) {
        excluded.push(o.id);
        continue;
      }
      ensure(
        /^[\w.-]+$/.test(itemId) && /^\d+$/.test(colorId),
        "INVALID_INPUT",
        "Invalid catalogue identifiers",
      );
      const key = itemId + "|" + colorId;
      const lot = lots.get(key) || {
        itemId,
        colorId,
        quantity: 0,
        occurrenceIds: [],
        layers: {},
        verification,
      };
      if (
        !Number.isSafeInteger(lot.quantity + multiplier) ||
        !Number.isSafeInteger(units + multiplier)
      ) {
        block("QUANTITY_OVERFLOW", "Quantity exceeds safe integer range");
        excluded.push(o.id);
        continue;
      }
      lot.quantity += multiplier;
      units += multiplier;
      lot.occurrenceIds.push(o.id);
      lot.layers[o.layerId] = (lot.layers[o.layerId] || 0) + multiplier;
      if (verification === "acknowledged") lot.verification = verification;
      lots.set(key, lot);
    }
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
    validate("inventoryExport", r);
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
