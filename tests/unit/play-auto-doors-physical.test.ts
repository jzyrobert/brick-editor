import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import {
  registerFullLibraryFromDisk,
  fullLibrarySources,
} from "../../scripts/full-library-node";
import { template } from "../../src/catalog/templates";
import { doorRoomSource } from "../../src/catalog/door-room";
import { occurrences } from "../../src/core/document";
import { importLDraw, exportLDraw } from "../../src/ldraw/io";
import type { Project } from "../../src/core/types";
import { deriveDoorRigs } from "../../src/play/auto-doors";

beforeAll(() => expect(registerFullLibraryFromDisk()).toBe(true));
const derive = (
  p: Project,
  strict = true,
  extra: Partial<Parameters<typeof deriveDoorRigs>[1]> = {},
) =>
  deriveDoorRigs(p, {
    all: occurrences(p),
    reserved: new Set(),
    maxRigs: 32,
    maxGroups: 128,
    requirePhysicalConnection: strict,
    ...extra,
  });
const kit =
  "1 15 0 -152 0 -1 0 0 0 1 0 0 0 -1 60596.dat\n1 4 32 -152 -5 -1 0 0 0 1 0 0 0 -1 60616a.dat\n";

describe("source pin/socket admission for normal Play doors", () => {
  it("preserves the actual House, Café, precise kit and identity door-room placements", () => {
    for (const p of [
      template("house"),
      template("cafe"),
      importLDraw(kit),
      importLDraw(doorRoomSource()),
    ]) {
      const source = exportLDraw(p),
        json = JSON.stringify(p),
        legacy = derive(p, false),
        strict = derive(p);
      expect(strict.doors.length).toBeGreaterThan(0);
      expect(strict.doors).toEqual(legacy.doors);
      expect(strict.rigs).toEqual(legacy.rigs);
      expect(strict.skipped).toEqual([]);
      expect(exportLDraw(p)).toBe(source);
      expect(JSON.stringify(p)).toBe(json);
    }
  });
  it("leaves a nearby brick column static while preserving the direct-engine legacy default", () => {
    const p = importLDraw(
      "1 15 -42 -72 5 1 0 0 0 1 0 0 0 1 3005.dat\n1 4 -32 -144 5 1 0 0 0 1 0 0 0 1 60616a.dat",
    );
    expect(derive(p, false).doors).toHaveLength(1);
    const strict = derive(p);
    expect(strict.doors).toEqual([]);
    expect(strict.skipped[0].reason).toMatch(/holder sockets/);
    const options = {
      all: occurrences(p),
      reserved: new Set<string>(),
      maxRigs: 32,
      maxGroups: 128,
    };
    expect(deriveDoorRigs(p, options).doors).toHaveLength(1);
  });
  it("requires both distinct source pins to seat and refuses ambiguous holders", () => {
    const p = importLDraw(kit),
      all = structuredClone(occurrences(p)),
      leaf = all.find((o) => o.node.ref === "60616a.dat")!;
    leaf.transform.position[1] += 8;
    expect(derive(p, true, { all }).doors).toHaveLength(0);
    const crooked = structuredClone(occurrences(p));
    crooked.find((o) => o.node.ref === "60616a.dat")!.transform.position[2] +=
      5;
    expect(derive(p, true, { all: crooked }).doors).toHaveLength(0);
    const duplicate = structuredClone(occurrences(p)),
      holder = structuredClone(
        duplicate.find((o) => o.node.ref === "60596.dat")!,
      );
    holder.id += "-duplicate";
    duplicate.push(holder);
    expect(derive(p, true, { all: duplicate }).skipped[0].reason).toMatch(
      /More than one source holder/,
    );
  });
  it("never grants a source connection to a borrowed project filename or copied holder", () => {
    const p = importLDraw(kit),
      all = structuredClone(occurrences(p)),
      leaf = all.find((o) => o.node.ref === "60616a.dat")!;
    // A custom embedded copy may carry a familiar filename and bounds; neither
    // certifies that its geometry equals the pinned official source.
    leaf.namespace = "project";
    leaf.node.ref = "21318 - 60616a.dat";
    p.models[leaf.node.ref] = {
      id: leaf.node.ref,
      name: leaf.node.ref,
      nodes: [],
      records: [],
      classification: "custom",
    };
    expect(derive(p, true, { all }).skipped[0].reason).toMatch(
      /geometry is not verified/,
    );
    const other = importLDraw(kit),
      members = structuredClone(occurrences(other));
    members.find((o) => o.node.ref === "60596.dat")!.namespace = "project";
    expect(derive(other, true, { all: members }).skipped[0].reason).toMatch(
      /holder sockets/,
    );
  });
  it("retains layer, ownership and moving-group budget refusals", () => {
    const p = importLDraw(kit),
      all = occurrences(p),
      leaf = all.find((o) => o.node.ref === "60616a.dat")!,
      holder = all.find((o) => o.node.ref === "60596.dat")!;
    expect(
      derive(p, true, { reserved: new Set([leaf.id]) }).skipped[0].reason,
    ).toMatch(/authored/);
    expect(
      derive(p, true, { reserved: new Set([holder.id]) }).doors,
    ).toHaveLength(0);
    expect(
      derive(p, true, { included: new Set([leaf.id]) }).doors,
    ).toHaveLength(0);
    expect(derive(p, true, { maxGroups: 1 }).skipped[0].reason).toMatch(
      /budget/,
    );
  });
  it("certifies only the actual classic shutter end bearing and unchanged OMR placements", () => {
    const text =
        "1 14 0 -48 30 1 0 0 0 1 0 0 0 1 3581.dat\n1 4 0 -48 17 0 0 -1 0 1 0 1 0 0 3582.dat",
      p = importLDraw(text);
    expect(derive(p).doors).toHaveLength(1);
    expect(derive(p).doors).toEqual(derive(p, false).doors);
    for (const [axis, amount] of [
      [1, 0.01],
      [2, 3],
    ] as const) {
      const all = structuredClone(occurrences(p));
      all.find((o) => o.node.ref === "3582.dat")!.transform.position[axis] +=
        amount;
      expect(derive(p, true, { all }).doors).toHaveLength(0);
    }
    const wrong = importLDraw(text.replace("3581.dat", "3005.dat"));
    expect(derive(wrong).doors).toHaveLength(0);
    const copy = structuredClone(occurrences(p));
    copy.find((o) => o.node.ref === "3581.dat")!.namespace = "project";
    expect(derive(p, true, { all: copy }).doors).toHaveLength(0);
    const omr = importLDraw(
        readFileSync("fixtures/ldraw/omr-doors.mpd", "utf8"),
      ),
      source = exportLDraw(omr),
      derived = derive(omr);
    expect(derived.doors.filter((d) => d.part === "3582")).toHaveLength(2);
    expect(exportLDraw(omr)).toBe(source);
  });
  it("ties the classic interface to literal pinned cylinder and end-cap source records", () => {
    const source = fullLibrarySources(["3581.dat", "3582.dat"]),
      lines = (p: string) => source[p].split(/\r?\n/);
    expect(lines("3582.dat")).toContain(
      "1 16 0 4 0 2 0 0 0 40 0 0 0 2 2-4cyli.dat",
    );
    expect(lines("3582.dat")).toContain(
      "1 16 0 4 0 2 0 0 0 1 0 0 0 2 2-4disc.dat",
    );
    expect(lines("3582.dat")).toContain(
      "1 16 0 44 0 2 0 0 0 -1 0 0 0 2 2-4disc.dat",
    );
    for (const y of [0, 44])
      expect(lines("3581.dat")).toContain(
        `1 16 0 ${y} -12 4 0 0 0 4 0 0 0 -4 2-4cyli.dat`,
      );
    expect(lines("3581.dat")).toContain(
      "1 16 0 4 -12 -4 0 0 0 -1 0 0 0 -4 2-4disc.dat",
    );
    expect(lines("3581.dat")).toContain(
      "1 16 0 44 -12 4 0 0 0 1 0 0 0 -4 2-4disc.dat",
    );
  });
});
