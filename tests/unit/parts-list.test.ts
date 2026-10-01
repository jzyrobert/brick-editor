import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { importLDraw } from "../../src/ldraw/io";
import { occurrences } from "../../src/core/document";
import {
  filterParts,
  groupParts,
  partsList,
  partsListCSV,
  rebrickableCSV,
  sortParts,
} from "../../src/inventory/parts-list";
import colorNamesJson from "../../src/catalog/color-names.json";
import { colorNames } from "../../scripts/build-color-names";

const model = [
  "0 FILE main.ldr",
  "0 Main",
  "1 4 0 0 0 1 0 0 0 1 0 0 0 1 3001.dat",
  "1 4 80 0 0 1 0 0 0 1 0 0 0 1 3001.dat",
  "1 1 160 0 0 1 0 0 0 1 0 0 0 1 3001.dat",
  "1 16 0 -24 0 1 0 0 0 1 0 0 0 1 sub.ldr",
  "1 16 80 -24 0 1 0 0 0 1 0 0 0 1 sub.ldr",
  "2 24 0 0 0 10 0 0",
  "0 FILE sub.ldr",
  "0 Sub",
  "1 14 0 0 0 1 0 0 0 1 0 0 0 1 3024.dat",
  "",
].join("\n");

describe("parts list", () => {
  it("counts every part × colour, through submodels, without primitives", () => {
    const p = importLDraw(model, "main.mpd");
    const list = partsList(p, occurrences(p));
    expect(list.total).toBe(5);
    expect(list.primitives).toBe(1);
    expect(
      list.rows.map((r) => [r.number, r.colorCode, r.count, r.colorName]),
    ).toEqual([
      ["3001", "4", 2, "Red"],
      ["3024", "14", 2, "Yellow"],
      ["3001", "1", 1, "Blue"],
    ]);
    expect(list.rows[0].name).toMatch(/Brick\s+2\s*[x×]\s*4/i);
    expect(list.rows[0].category).toBeTruthy();
  });

  it("filters, sorts and groups", () => {
    const p = importLDraw(model, "main.mpd");
    const { rows } = partsList(p, occurrences(p));
    expect(filterParts(rows, "red 3001").map((r) => r.colorCode)).toEqual([
      "4",
    ]);
    expect(filterParts(rows, "plate").map((r) => r.number)).toEqual(["3024"]);
    expect(sortParts([...rows], "colour").map((r) => r.colorName)).toEqual([
      "Blue",
      "Red",
      "Yellow",
    ]);
    const byColour = groupParts(rows, "colour");
    expect(byColour.map((s) => [s.title, s.count])).toEqual([
      ["Red", 2],
      ["Yellow", 2],
      ["Blue", 1],
    ]);
    expect(groupParts(rows, "category").reduce((n, s) => n + s.count, 0)).toBe(
      5,
    );
  });

  it("writes CSV and Rebrickable CSV", () => {
    const p = importLDraw(
      model + "0 FILE custom.dat\n0 =Custom\n3 4 0 0 0 1 0 0 0 0 1\n",
      "main.mpd",
    );
    p.models[p.rootModelId].nodes.push({
      ...p.models[p.rootModelId].nodes[0],
      id: "custom-node",
      ref: Object.keys(p.models).find((k) => /custom/.test(k))!,
      colorCode: "10375",
    });
    const { rows } = partsList(p, occurrences(p));
    const csv = partsListCSV(rows);
    expect(csv.split("\r\n")[0]).toBe(
      "Part,Name,Category,LDraw colour,Colour,Quantity",
    );
    expect(csv).toContain("3001,");
    expect(csv).toMatch(/,4,Red,2\r\n/);
    const rb = rebrickableCSV(rows, (ref) =>
      ref === "3024.dat" ? "3024" : undefined,
    );
    expect(rb.csv.split("\r\n").slice(0, 4)).toEqual([
      "Part,Color,Quantity",
      "3001,4,2",
      "3024,14,2",
      "3001,1,1",
    ]);
    expect(rb.skipped.map((r) => r.custom)).toEqual([true]);
  });

  it("quotes cells a spreadsheet would run as formulas", () => {
    const csv = partsListCSV([
      {
        ref: "=cmd.dat",
        number: "=cmd",
        name: 'a "b", c',
        category: "Other",
        colorCode: "4",
        colorName: "Red",
        count: 1,
        custom: true,
      },
    ]);
    expect(csv.split("\r\n")[1]).toBe(`"'=cmd","a ""b"", c",Other,4,Red,1`);
  });

  it("keeps colour names in step with the checked colour joins", () => {
    const joins = JSON.parse(readFileSync("scripts/color-joins.json", "utf8"));
    expect(colorNamesJson).toEqual(colorNames(joins));
  });

  it("lists 150,000 parts quickly", () => {
    const p = importLDraw(model, "main.mpd");
    const [template] = occurrences(p);
    const all = Array.from({ length: 150_000 }, (_, i) => ({
      ...template,
      id: String(i),
      colorCode: ["1", "4", "14", "15"][i % 4],
      node: {
        ...template.node,
        ref: ["3001.dat", "3003.dat", "3024.dat"][i % 3],
      },
    }));
    const start = performance.now();
    const list = partsList(p, all);
    const ms = performance.now() - start;
    expect(list.total).toBe(150_000);
    expect(list.rows).toHaveLength(12);
    expect(ms).toBeLessThan(1000);
  });
});
