import { describe, expect, it } from "vitest";
import { zipSync } from "fflate";
import { Editor } from "../../src/core/commands";
import { occurrences } from "../../src/core/document";
import { identity } from "../../src/core/math";
import { uid } from "../../src/core/types";
import { importLDraw } from "../../src/ldraw/io";
import { boundedUnzip } from "../../src/persistence/native";
import {
  detectResourceProfile,
  effectiveResourceProfile,
  resourceLimits,
} from "../../src/core/resource-profile";

const command = (e: Editor, type: string, payload: Record<string, unknown>) =>
  e.dispatch({
    schemaVersion: 1,
    commandId: uid(),
    expectedRevision: e.project.revision,
    type,
    payload,
  });
const bricks = (n: number, x = 0) =>
  Array.from({ length: n }, (_, i) => ({
    ref: "3005.dat",
    colorCode: "4",
    transform: { ...identity(), position: [x + i * 20, 0, 0] },
  }));
const flat = (n: number) =>
  "0 FILE root.ldr\n" +
  Array.from(
    { length: n },
    (_, i) => `1 4 ${i * 20} 0 0 1 0 0 0 1 0 0 0 1 3005.dat`,
  ).join("\n");
/** `rows` copies of a `perRow`-brick row submodel: a large model in a small file. */
const rows = (rows: number, perRow: number) =>
  "0 FILE root.ldr\n" +
  Array.from(
    { length: rows },
    (_, i) => `1 16 0 0 ${i * 20} 1 0 0 0 1 0 0 0 1 row.ldr`,
  ).join("\n") +
  "\n0 FILE row.ldr\n" +
  flat(perRow).slice("0 FILE root.ldr\n".length);

describe("resource profiles", () => {
  it("detects phone-class devices and keeps tablets/desktops on desktop limits", () => {
    const phone = { coarsePointer: true, screenShortSide: 393 };
    expect(detectResourceProfile(phone).profile).toBe("mobile");
    expect(
      detectResourceProfile({ coarsePointer: true, screenShortSide: 1080 })
        .profile,
    ).toBe("desktop");
    expect(
      detectResourceProfile({ coarsePointer: false, screenShortSide: 1080 })
        .profile,
    ).toBe("desktop");
    expect(
      detectResourceProfile({
        coarsePointer: false,
        screenShortSide: 1080,
        deviceMemory: 2,
      }).profile,
    ).toBe("mobile");
    const raised = effectiveResourceProfile("desktop", phone);
    expect(raised).toMatchObject({
      profile: "desktop",
      detected: "mobile",
      raisedAboveDevice: true,
    });
    expect(effectiveResourceProfile("auto", phone).raisedAboveDevice).toBe(
      false,
    );
    expect(resourceLimits("mobile")).toMatchObject({
      occurrences: 150000,
      additionsPerCommand: 2000,
      importBytes: 10 * 1024 * 1024,
      imagePixels: 4000000,
    });
    expect(() => resourceLimits("tablet" as never)).toThrow();
  });

  it("switching profile re-assesses the document without a new revision and is reversible", () => {
    // 151,000 parts, over the phone's 150,000: a 1,000-brick row placed 151 times.
    const e = new Editor(importLDraw(rows(151, 1000)));
    expect(e.materialization.status).toBe("available");
    const revision = e.project.revision;
    let notified = 0;
    e.subscribe(() => notified++);
    expect(e.setResourceProfile("mobile").status).toBe("limited");
    expect(e.resourceProfile).toBe("mobile");
    expect(e.project.revision).toBe(revision);
    expect(() => e.requireMaterialization()).toThrow(/leafCount/);
    expect(e.setResourceProfile("desktop").status).toBe("available");
    expect(notified).toBe(2);
    expect(() => e.setResourceProfile("huge" as never)).toThrow();
  });

  it("limits net additions per command by profile, not regrouping or undo", () => {
    const e = new Editor(undefined, { profile: "mobile" });
    expect(() => command(e, "parts.add", { parts: bricks(2001) })).toThrow(
      /2,001 parts; the mobile profile allows 2,000/,
    );
    expect(occurrences(e.project)).toHaveLength(0);
    command(e, "parts.add", { parts: bricks(2000) });
    command(e, "parts.add", { parts: bricks(1500, 50000) });
    const ids = occurrences(e.project).map((o) => o.id);
    // Regrouping 3,500 parts changes every ID but adds nothing.
    command(e, "models.makeSubmodel", { occurrenceIds: ids, name: "All" });
    expect(occurrences(e.project)).toHaveLength(3500);
    command(e, "parts.remove", {
      occurrenceIds: occurrences(e.project).map((o) => o.id),
    });
    // Undoing a removal restores more than one command may add.
    command(e, "history.undo", {});
    expect(occurrences(e.project)).toHaveLength(3500);
    const desktop = new Editor();
    command(desktop, "parts.add", { parts: bricks(2001) });
    expect(occurrences(desktop.project)).toHaveLength(2001);
  }, 30000);

  it("applies profile import and archive limits before expensive processing", () => {
    const text = "0 big\n" + "0 ".repeat(6 * 1024 * 1024);
    expect(() => importLDraw(text, "big.ldr", { profile: "mobile" })).toThrow(
      /10 MiB/,
    );
    expect(() => importLDraw(text, "big.ldr")).not.toThrow(/MiB/);
    const many = Object.fromEntries(
      Array.from({ length: 5001 }, (_, i) => [
        `f${i}.txt`,
        new Uint8Array([1]),
      ]),
    );
    const archive = zipSync(many);
    expect(() => boundedUnzip(archive, resourceLimits("mobile"))).toThrow(
      /Too many archive entries/,
    );
    expect(Object.keys(boundedUnzip(archive))).toHaveLength(5001);
  });
});
