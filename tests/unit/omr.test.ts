import { afterEach, describe, expect, it, vi } from "vitest";
import {
  OMR_UPSTREAM,
  decodeOmrIndex,
  looksLikeLDraw,
  omrAttribution,
  omrCredit,
  omrFileAllowed,
  omrFileName,
  searchOmr,
  type OmrIndexFile,
  type OmrSet,
} from "../../src/catalog/omr";
import indexFile from "../../src/catalog/omr-index.json";
import { parseOmrListing } from "../../scripts/build-omr-index";
import { onRequest } from "../../functions/api/omr/[file]";
import { importLDraw } from "../../src/ldraw/io";

const sets = decodeOmrIndex(indexFile as unknown as OmrIndexFile);
const set = (number: string, name: string, theme: string, year: number) =>
  ({ number, name, theme, year, models: 1, id: 1 }) satisfies OmrSet;

describe("OMR index", () => {
  it("is a well-formed, unique index of the OMR listing", () => {
    const file = indexFile as unknown as OmrIndexFile;
    expect(file.count).toBe(sets.length);
    expect(sets.length).toBeGreaterThan(1000);
    expect(new Set(sets.map((s) => s.number)).size).toBe(sets.length);
    expect(new Set(sets.map((s) => s.id)).size).toBe(sets.length);
    for (const s of sets) {
      expect(s.number).toMatch(/^[\w.]+-\d+$/);
      expect(s.name).not.toBe("");
      expect(s.models).toBeGreaterThanOrEqual(1);
      expect(omrFileAllowed(omrFileName(s))).toBe(true);
    }
    expect(sets.find((s) => s.number === "10002-1")).toMatchObject({
      name: "Railroad Club Car",
      theme: "Train",
      year: 2001,
      id: 1413,
    });
  });

  it("parses the public listing's table cells", () => {
    const cell = (id: number, column: string, html: string) =>
      `<td wire:key="abc.table.record.${id}.column.${column}" class="fi-ta-cell"><a href="#"><!--[if BLOCK]><![endif]--> ${html} </a></td>`;
    const html =
      "<table>" +
      `<tr>${cell(657, "image", '<img src="x.png">')}${cell(657, "number", "10001-1")}${cell(657, "name", "Metroliner &amp; Co")}${cell(657, "theme.name", "Train &gt; 9V")}${cell(657, "year", "2001")}${cell(657, "models_count", "2")}</tr>` +
      `<tr>${cell(9, "number", "not a set")}</tr>` +
      "</table><span>Showing 1 to 25 of 1,470 results</span>";
    expect(parseOmrListing(html)).toEqual({
      rows: [["10001-1", "Metroliner & Co", "Train > 9V", 2001, 2, 657]],
      total: 1470,
    });
  });
});

describe("OMR search", () => {
  const sample = [
    set("10002-1", "Railroad Club Car", "Train", 2001),
    set("10020-1", "Santa Fe Super Chief", "Train > 9V", 2002),
    set("6399-1", "Airport Shuttle", "Town > Classic Town", 1990),
    set("100-1", "Café", "Town", 1978),
  ];
  it("matches set numbers first, then names, themes and years", () => {
    expect(searchOmr(sample, "10002").map((s) => s.number)).toEqual([
      "10002-1",
    ]);
    expect(searchOmr(sample, "1000").map((s) => s.number)).toEqual(["10002-1"]);
    expect(searchOmr(sample, "100").map((s) => s.number)[0]).toBe("100-1");
    expect(searchOmr(sample, "train").map((s) => s.number)).toEqual([
      "10020-1",
      "10002-1",
    ]);
    expect(searchOmr(sample, "classic 1990").map((s) => s.number)).toEqual([
      "6399-1",
    ]);
    expect(searchOmr(sample, "cafe").map((s) => s.number)).toEqual(["100-1"]);
    expect(searchOmr(sample, "railroad nope")).toEqual([]);
    expect(searchOmr(sample, "  ")).toEqual([]);
    expect(searchOmr(sample, "(")).toEqual([]);
  });
  it("limits results", () => {
    expect(searchOmr(sets, "star wars", 20)).toHaveLength(20);
  });
});

const HEADER = [
  "0 FILE 10002 - main.ldr",
  "0 main",
  "0 Name: 10002 - main.ldr",
  "0 Author: TotalyWicked [TotalyWicked]",
  "0 !LDRAW_ORG Model",
  "0 !LICENSE Redistributable under CCAL version 2.0 : see CAreadme.txt",
  "1 15 0 0 0 1 0 0 0 1 0 0 0 1 3001.dat",
  "0 STEP",
  "0 NOFILE",
  "0 FILE 10002 - minifig.ldr",
  "0 Author: Someone Else",
  "1 15 0 0 0 1 0 0 0 1 0 0 0 1 3003.dat",
  "0 NOFILE",
];

describe("OMR attribution", () => {
  it("reads the main model's author and licence", () => {
    const a = omrAttribution(HEADER)!;
    expect(a).toEqual({
      setNumber: "10002",
      name: "10002 - main.ldr",
      authors: ["TotalyWicked [TotalyWicked]"],
      license: "Redistributable under CCAL version 2.0 : see CAreadme.txt",
    });
    expect(omrCredit(a)).toBe(
      "TotalyWicked [TotalyWicked] · CC BY 2.0 · LDraw OMR",
    );
  });
  it("accepts OMR files without an !LDRAW_ORG line when named after a set", () => {
    const lines = HEADER.filter((l) => !l.includes("!LDRAW_ORG"));
    expect(omrAttribution(lines)?.authors).toEqual([
      "TotalyWicked [TotalyWicked]",
    ]);
  });
  it("ignores files that are not OMR models", () => {
    expect(
      omrAttribution(HEADER.filter((l) => !l.includes("!LICENSE"))),
    ).toBeUndefined();
    expect(
      omrAttribution([
        "0 My house",
        "0 Name: house.ldr",
        "0 Author: Me",
        "0 !LICENSE Redistributable under CCAL version 2.0",
        "1 15 0 0 0 1 0 0 0 1 0 0 0 1 3001.dat",
      ]),
    ).toBeUndefined();
  });
  it("stays in the imported project and its LDraw export", () => {
    const p = importLDraw(HEADER.join("\n"), "10002-1 Railroad Club Car.mpd");
    const root = p.models[p.rootModelId];
    expect(omrAttribution(root.records.map((r) => r.raw))?.authors).toEqual([
      "TotalyWicked [TotalyWicked]",
    ]);
    expect(p.title).toBe("10002-1 Railroad Club Car");
    expect(p.instructionPlans.imported?.steps).toHaveLength(1);
  });
});

describe("OMR proxy (Pages Function)", () => {
  const store = new Map<string, Response>();
  const context = (path: string, method = "GET") => {
    const waits: Promise<unknown>[] = [];
    return {
      waits,
      ctx: {
        request: new Request("https://bricks.example" + path, { method }),
        params: { file: decodeURIComponent(path.split("/").pop()!) },
        waitUntil: (p: Promise<unknown>) => waits.push(p),
      },
    };
  };
  const upstream = vi.fn();
  vi.stubGlobal("caches", {
    default: {
      match: async (r: Request) => store.get(r.url)?.clone(),
      put: async (r: Request, res: Response) => void store.set(r.url, res),
    },
  });
  vi.stubGlobal("fetch", upstream);
  afterEach(() => {
    upstream.mockReset();
    store.clear();
  });

  it("forwards only OMR model file names, unmodified, and caches them", async () => {
    upstream.mockResolvedValue(new Response(HEADER.join("\n")));
    const first = context("/api/omr/10002-1.mpd");
    const res = await onRequest(first.ctx);
    expect(res.status).toBe(200);
    expect(await res.text()).toBe(HEADER.join("\n"));
    expect(upstream).toHaveBeenCalledOnce();
    expect(upstream.mock.calls[0][0]).toBe(OMR_UPSTREAM + "10002-1.mpd");
    expect(res.headers.get("Content-Type")).toBe("text/plain; charset=utf-8");
    await Promise.all(first.waits);
    // A second request is served from the edge cache.
    const again = await onRequest(context("/api/omr/10002-1.mpd").ctx);
    expect(await again.text()).toBe(HEADER.join("\n"));
    expect(upstream).toHaveBeenCalledOnce();
  });

  it("refuses other paths, methods and non-LDraw answers", async () => {
    for (const path of [
      "/api/omr/..%2F..%2Fparts%2F3001.dat",
      "/api/omr/index.html",
      "/api/omr/.mpd",
      "/api/omr/10002-1.mpd?x=1",
    ])
      expect((await onRequest(context(path).ctx)).status).toBe(404);
    expect(
      (await onRequest(context("/api/omr/10002-1.mpd", "POST").ctx)).status,
    ).toBe(405);
    expect(upstream).not.toHaveBeenCalled();
    upstream.mockResolvedValue(new Response("<html>oops</html>"));
    expect((await onRequest(context("/api/omr/10002-1.mpd").ctx)).status).toBe(
      502,
    );
    upstream.mockResolvedValue(new Response("gone", { status: 404 }));
    expect((await onRequest(context("/api/omr/10002-1.mpd").ctx)).status).toBe(
      404,
    );
    expect(store.size).toBe(0);
  });

  it("recognises LDraw text", () => {
    expect(looksLikeLDraw("\n\n0 FILE a.ldr\n")).toBe(true);
    expect(looksLikeLDraw("1 4 0 0 0 1 0 0 0 1 0 0 0 1 3001.dat")).toBe(true);
    expect(looksLikeLDraw("<!doctype html>")).toBe(false);
    expect(looksLikeLDraw("")).toBe(false);
  });
});
