// Parts-list resolution (spec §6.6): part-level inventory decisions through
// the undoable `inventory.override` command, ambiguous candidates, derived and
// reviewed mappings, exclusions, accepted colours, native round trips, the
// maintainer review proposals and the explicit complete-library update.
import { beforeAll, describe, expect, it } from "vitest";
import { Editor } from "../../src/core/commands";
import { occurrences } from "../../src/core/document";
import { uid, type Project } from "../../src/core/types";
import { importLDraw } from "../../src/ldraw/io";
import { InventoryService } from "../../src/inventory/service";
import {
  itemNumberProblem,
  partKey,
  setPartDecision,
} from "../../src/inventory/decisions";
import { decodeNative, encodeNative } from "../../src/persistence/native";
import { registerFullLibraryFromDisk } from "../../scripts/full-library-node";
import mappings from "../../src/catalog/mappings.json";
import {
  adoptCurrentLocks,
  retiredFullLibraryLocks,
} from "../../src/catalog/catalog";
import { fullLibraryLock } from "../../src/catalog/full-library";
import { libraryUpdateStatus } from "../../src/catalog/library-update";
import { propose } from "../../scripts/review-mappings";
import review from "../../scripts/mapping-review.json";
import textureLock from "../../src/catalog/full-textures-lock.json";

beforeAll(() => {
  expect(registerFullLibraryFromDisk()).toBe(true);
});
const command = (
  e: Editor,
  type: string,
  payload: Record<string, unknown> = {},
) =>
  e.dispatch({
    schemaVersion: 1,
    commandId: uid(),
    expectedRevision: e.project.revision,
    type,
    payload,
  });
const request = (p: Project, extra: Record<string, unknown> = {}) => ({
  expectedRevision: p.revision,
  format: "bricklink-wanted-xml" as const,
  scope: { kind: "all" as const },
  ...extra,
});
const build = (...lines: string[]) =>
  new Editor(importLDraw("0 FILE t.ldr\n" + lines.join("\n") + "\n"));
const line = (colour: number, ref: string, x = 0) =>
  `1 ${colour} ${x} 0 0 1 0 0 0 1 0 0 0 1 ${ref}`;

describe("ambiguous candidates", () => {
  it("block until the user picks one, then export the chosen number (undoable)", async () => {
    // 3816cpq1: the part file names BrickLink 970c00pb0081 and 970c00pb0082.
    const e = build(line(272, "3816cpq1.dat"), line(272, "3816cpq1.dat", 40));
    const service = new InventoryService();
    const before = await service.preview(e.project, request(e.project));
    expect(before.canExportComplete).toBe(false);
    expect(before.resolution).toEqual([
      expect.objectContaining({
        part: "official:3816cpq1.dat",
        tier: "ambiguous",
        mapping: "ambiguous",
        candidates: ["970c00pb0081", "970c00pb0082"],
        quantity: 2,
        status: "needs-attention",
        problems: expect.arrayContaining(["AMBIGUOUS_MAPPING"]),
      }),
    ]);
    expect(
      before.diagnostics.find((d) => d.code === "AMBIGUOUS_MAPPING")?.details,
    ).toEqual({ candidates: ["970c00pb0081", "970c00pb0082"] });
    // Never the first candidate silently.
    expect(before.rows).toEqual([]);

    command(e, "inventory.override", {
      part: "official:3816cpq1.dat",
      decision: {
        itemId: "970c00pb0082",
        origin: "candidate",
        acceptedColors: ["272"],
        acknowledged: true,
      },
    });
    const after = await service.preview(e.project, request(e.project));
    expect(after.canExportComplete).toBe(true);
    expect(after.rows).toEqual([
      expect.objectContaining({
        itemId: "970c00pb0082",
        quantity: 2,
        verification: "acknowledged",
      }),
    ]);
    expect(after.resolution[0]).toMatchObject({
      mapping: "user",
      origin: "candidate",
      itemId: "970c00pb0082",
      status: "accepted",
      colorAccepted: true,
    });
    command(e, "history.undo");
    expect(e.project.marketplace.partDecisions).toBeUndefined();
    command(e, "history.redo");
    expect(
      e.project.marketplace.partDecisions?.["official:3816cpq1.dat"]?.itemId,
    ).toBe("970c00pb0082");
  });
});

describe("derived and reviewed mappings", () => {
  it("ships a reviewed tier of cross-checked keyword mappings with evidence", () => {
    const tier = mappings.reviewed as {
      confidence: string;
      parts: Record<string, { itemId: string; rebrickable: string }>;
    };
    expect(tier.confidence).toBe("cross-checked");
    const promoted = Object.entries(review.parts).filter(
      ([, r]) => r.decision === "promote",
    );
    expect(promoted.length).toBeGreaterThanOrEqual(80);
    expect(Object.keys(tier.parts).length).toBe(promoted.length);
    for (const [name, r] of promoted) {
      // Same number the LDraw file states, corroborated by Rebrickable.
      expect(tier.parts["official:" + name].itemId, name).toBe(r.itemId);
      expect(r.evidence.bricklinkKeyword, name).toBe(r.itemId);
      expect(r.evidence.rebrickablePart, name).toBe(r.itemId);
      expect(r.confidence).toBe("cross-checked");
    }
    // No curated part is in the reviewed tier.
    for (const key of Object.keys(tier.parts))
      expect(Object.hasOwn(mappings.parts, key), key).toBe(false);
  });
  it("reports a reviewed mapping distinctly and exports it once accepted", async () => {
    // 35371 (Tile 1 x 4 with Groove, an alias) states BrickLink 2431;
    // Rebrickable uses 2431 for the same tile.
    const e = build(line(4, "35371.dat"));
    const service = new InventoryService();
    const blocked = await service.preview(e.project, request(e.project));
    expect(blocked.resolution[0]).toMatchObject({
      tier: "reviewed",
      itemId: "2431",
      colorExistence: "derived",
      status: "needs-attention",
      problems: ["REVIEWED_MAPPING", "UNVERIFIED_PART_COLOR"],
    });
    command(e, "inventory.override", {
      part: "official:35371.dat",
      decision: {
        itemId: "2431",
        origin: "reviewed",
        checked: true,
        acceptedColors: ["4"],
        acknowledged: true,
      },
    });
    const ok = await service.preview(e.project, request(e.project));
    expect(ok.canExportComplete).toBe(true);
    expect(ok.rows[0]).toMatchObject({ itemId: "2431", colorId: "5" });
    // The whole-list switch still works without per-part decisions.
    const bulk = await service.preview(
      build(line(4, "35371.dat")).project,
      request(e.project, {
        expectedRevision: 0,
        acceptDerivedMappings: true,
        acceptUnknownColors: true,
      }),
    );
    expect(bulk.canExportComplete).toBe(true);
    expect(bulk.diagnostics.map((d) => d.code)).toContain("REVIEWED_MAPPING");
  });
  it("lets the user replace a mapping with a typed number whose colour stays unknown", async () => {
    const e = build(line(4, "3861c.dat"));
    command(e, "inventory.override", {
      part: "official:3861c.dat",
      decision: { itemId: "3861", origin: "user", acknowledged: true },
    });
    const r = await new InventoryService().preview(
      e.project,
      request(e.project),
    );
    expect(r.resolution[0]).toMatchObject({
      tier: "derived",
      mapping: "user",
      itemId: "3861",
      suggestedItemId: "3861",
      colorExistence: "unknown",
      status: "needs-attention",
      problems: ["UNVERIFIED_PART_COLOR"],
    });
  });
});

describe("exclusions and validation", () => {
  it("leaves an excluded part out, reported once, without blocking the rest", async () => {
    const e = build(line(4, "3001.dat"), line(4, "3816cpq1.dat", 40));
    command(e, "inventory.override", {
      part: "official:3816cpq1.dat",
      decision: { exclude: true, acknowledged: true },
    });
    const r = await new InventoryService().preview(
      e.project,
      request(e.project),
    );
    expect(r.canExportComplete).toBe(true);
    expect(r.rows.map((l) => l.itemId)).toEqual(["3001"]);
    expect(r.excludedOccurrenceIds).toHaveLength(1);
    expect(r.diagnostics.filter((d) => d.code === "EXCLUDED_BY_USER")).toEqual([
      expect.objectContaining({ severity: "warning" }),
    ]);
    expect(r.resolution.at(-1)).toMatchObject({
      status: "excluded",
      mapping: "excluded",
    });
  });
  it("refuses malformed numbers, unknown parts and unacknowledged decisions", () => {
    const e = build(line(4, "3001.dat"));
    const bad = (decision: unknown, part = "official:3001.dat") =>
      expect(() =>
        command(e, "inventory.override", { part, decision }),
      ).toThrow();
    bad({ itemId: "30 01", origin: "user", acknowledged: true });
    bad({ itemId: "3001", origin: "user" });
    bad({ itemId: "3001", acknowledged: true });
    bad({ exclude: true, acknowledged: true }, "official:3002.dat");
    bad({ exclude: true, itemId: "3001", origin: "user", acknowledged: true });
    expect(itemNumberProblem("")).toMatch(/Type/);
    expect(itemNumberProblem("30 01")).toMatch(/spaces/);
    expect(itemNumberProblem("3001<")).toMatch(/letters/);
    expect(itemNumberProblem("970c00pb0081")).toBeNull();
    // Clearing a decision is allowed even when nothing is stored.
    command(e, "inventory.override", {
      part: "official:3001.dat",
      decision: null,
    });
  });
  it("keeps project-local parts and official parts apart", () => {
    const p = importLDraw(
      "0 FILE t.ldr\n1 4 0 0 0 1 0 0 0 1 0 0 0 1 3001.dat\n1 4 40 0 0 1 0 0 0 1 0 0 0 1 mine.dat\n0 NOFILE\n0 FILE mine.dat\n3 16 0 0 0 1 0 0 0 0 1\n",
    );
    const keys = occurrences(p).map(partKey).sort();
    expect(keys).toContain("official:3001.dat");
    expect(keys.some((k) => k.startsWith("project:"))).toBe(true);
  });
  it("round-trips decisions through native projects", async () => {
    const e = build(line(4, "3816cpq1.dat"));
    command(e, "inventory.override", {
      part: "official:3816cpq1.dat",
      decision: {
        itemId: "970c00pb0081",
        origin: "candidate",
        checked: true,
        acceptedColors: ["4", "4"],
        acknowledged: true,
      },
    });
    const restored = await decodeNative(await encodeNative(e.project));
    expect(restored.marketplace.partDecisions).toEqual({
      "official:3816cpq1.dat": {
        itemId: "970c00pb0081",
        origin: "candidate",
        checked: true,
        acceptedColors: ["4"],
        acknowledged: true,
      },
    });
    const copy = structuredClone(restored);
    setPartDecision(copy, "official:3816cpq1.dat", null);
    expect(copy.marketplace.partDecisions).toBeUndefined();
  });
});

describe("maintainer review proposals", () => {
  const rbName = (x: string) =>
    ({ "2431": "Tile 1 x 4 with Groove", "3001": "Brick 2 x 4" })[x];
  it("promotes only a stated number Rebrickable uses for an agreeing title", () => {
    const entry = [
      "35371.dat",
      "=Tile  1 x  4 with Groove",
      "Tile",
      "BrickLink 2431, Rebrickable 2431",
    ] as const;
    expect(
      propose({ entry, derived: "2431", rbName, relationships: () => [] })
        .proposal,
    ).toBe("promote");
    // A Rebrickable mould family needs a person.
    expect(
      propose({
        entry,
        derived: "2431",
        rbName,
        relationships: () => ["M:2431b"],
      }).proposal,
    ).toBe("check-by-hand");
    // Rebrickable numbers it differently: no second source.
    expect(
      propose({
        entry: ["x.dat", "Tile 1 x 4", "Tile", "BrickLink 2431, Rebrickable 9"],
        derived: "2431",
        rbName,
        relationships: () => [],
      }).proposal,
    ).toBe("keep");
    // No stated number: never made from the file name.
    expect(
      propose({
        entry: ["3001.dat", "Brick  2 x  4", "Brick"],
        rbName,
        relationships: () => [],
      }),
    ).toMatchObject({ proposal: "check-by-hand" });
    expect(
      propose({
        entry: ["a.dat", "Leg", "Minifig"],
        ambiguous: ["1", "2"],
        rbName,
        relationships: () => [],
      }).proposal,
    ).toBe("check-by-hand");
  });
});

describe("updating to the latest parts library", () => {
  const retired = {
    releaseId: "ldraw-full-test-retired",
    manifestSha256: "0".repeat(64),
    affected: ["35371.dat"],
  };
  const pinned = (...lines: string[]) => {
    const p = importLDraw("0 FILE t.ldr\n" + lines.join("\n") + "\n");
    p.library = {
      ...p.library,
      full: {
        ...p.library.full!,
        releaseId: retired.releaseId,
        manifestSha256: retired.manifestSha256,
      },
    };
    return p;
  };
  beforeAll(() => {
    retiredFullLibraryLocks.push(retired);
    return () => {
      retiredFullLibraryLocks.splice(
        retiredFullLibraryLocks.indexOf(retired),
        1,
      );
    };
  });
  it("keeps a pin whose parts changed and previews exactly those parts", () => {
    const p = pinned(
      line(4, "35371.dat"),
      line(4, "35371.dat", 40),
      line(4, "3816cpq1.dat", 80),
      line(4, "3001.dat", 120),
    );
    expect(adoptCurrentLocks(p)).toBe(false);
    expect(p.library.full!.releaseId).toBe(retired.releaseId);
    const status = libraryUpdateStatus(p);
    expect(status).toMatchObject({
      needed: true,
      retired: true,
      changesKnown: true,
      changed: [{ ref: "35371.dat", occurrences: 2 }],
      changedOccurrences: 2,
      partsOutsideCatalogue: 2,
      current: fullLibraryLock,
      textures: textureLock,
    });
  });
  it("re-pins with the previous lock recorded, and undo restores it", () => {
    const e = new Editor(pinned(line(4, "35371.dat")));
    expect(() =>
      command(e, "library.update", {
        expected: { releaseId: "other", manifestSha256: "1".repeat(64) },
      }),
    ).toThrow(/preview the update again/);
    command(e, "library.update", {
      expected: {
        releaseId: retired.releaseId,
        manifestSha256: retired.manifestSha256,
      },
    });
    expect(e.project.library.full!.manifestSha256).toBe(
      fullLibraryLock.manifestSha256,
    );
    expect(e.project.metadata.previousLocks).toEqual([
      {
        full: expect.objectContaining({ releaseId: retired.releaseId }),
        reason: "user-update",
        textures: textureLock,
        changed: ["35371.dat"],
      },
    ]);
    expect(libraryUpdateStatus(e.project).needed).toBe(false);
    expect(() =>
      command(e, "library.update", {
        expected: {
          releaseId: retired.releaseId,
          manifestSha256: retired.manifestSha256,
        },
      }),
    ).toThrow(/already uses/);
    command(e, "history.undo");
    expect(e.project.library.full!.releaseId).toBe(retired.releaseId);
    expect(e.project.metadata.previousLocks).toBeUndefined();
  });
  it("lists every part outside the catalogue when a pin's changes are unknown", () => {
    const p = importLDraw(
      "0 FILE t.ldr\n" + line(4, "35371.dat") + "\n" + line(4, "3001.dat"),
    );
    p.library = {
      ...p.library,
      full: { ...p.library.full!, releaseId: "elsewhere", manifestSha256: "f" },
    };
    expect(libraryUpdateStatus(p)).toMatchObject({
      needed: true,
      retired: false,
      changesKnown: false,
      changed: [{ ref: "35371.dat", occurrences: 1 }],
    });
  });
});
